'use strict';
/* SCGSS engine: the approval rules, run on the server.
   The rule code below (status flow, routing, skip logic, grant limits, reimbursement checks, reminders) is the code from the browser
   prototype (js/core.js v3.1.2), unchanged except where it touched browser storage, the sample accounts or the Google link.
   State lives in memory and is written to PostgreSQL after every action (one transaction). */
const crypto = require('node:crypto');
const R = require('../shared/rules');
const { money, fmtT, fmtD, pad3, round2 } = R.u;
const { PAR_DAYS, ADVISER_ROLES, EXPENSE_TYPES, REQ_POST, REQ_CHECK, ARTICLE_WORDS, wordCount, CHAIN, CH, ROLE_NAME, CAP, regionLabel, info, projected, dueDate, total, manilaToday, daysBetween, validateForm, nameOf } = R;

const fs = require('node:fs');
const path = require('node:path');

async function createEngine({ store, gas, filesDir }) {
  const now = () => Date.now();
  const db = await store.loadAll();
  db.sigs = {}; db.drafts = {};
  const syncLog = [];
  R.setDirectory((email) => { const u = store.getUser(email); return u ? decorate(u) : null; });
  const LABELS = { student: 'Student', adviser: 'Thesis Adviser', chair: 'Department Chair', assoc: 'Associate Dean', dean: 'Dean', admin: 'Administrative Assistant', sysadmin: 'System Administrator' };
  function decorate(u) { return { email: u.email, name: u.name || u.email, role: u.role, program: u.program || '', active: u.active === 1, label: LABELS[u.role] + (u.program ? ', ' + u.program : '') }; }
  const acct = (e) => { const u = store.getUser(e); return u ? decorate(u) : null; };
  const adminsOf = () => store.usersByRole('admin').map((x) => x.email);
  /* who signs, from the roles table: one Associate Dean, one Dean, one Department Chair per department (each degree belongs to a department) */
  function signers() {
    const one = (r) => { const l = store.usersByRole(r); return l.length ? l[0].email : ''; };
    const deptChairs = {}, chairs = {};
    store.usersByRole('chair').forEach((c) => { if (!deptChairs[c.program]) deptChairs[c.program] = c.email; });
    R.PROGRAMS.forEach((p) => { const c = deptChairs[R.DEGREE_DEPT[p[0]]]; if (c) chairs[p[0]] = c; });   /* by degree, for routing */
    return { assoc: one('assoc'), dean: one('dean'), chairs, deptChairs };
  }
  const advisers = () => store.listUsers().filter((u) => u.active === 1 && ADVISER_ROLES.indexOf(u.role) > -1).map(decorate);

  /* actions run one at a time; the state is changed in memory, then written to the database in one transaction.
     If the write fails, the memory is reloaded from the database, so memory and database never disagree. */
  let chain = Promise.resolve();
  const locked = (fn) => { const p = chain.then(fn, fn); chain = p.catch(() => {}); return p; };
  const save = () => {}; /* the rule code calls this after a change; the write happens once, after the whole action, in run() */
  async function reload() { const fresh = await store.loadAll(); Object.keys(db).forEach((k) => { delete db[k]; }); Object.assign(db, fresh); db.sigs = {}; db.drafts = {}; }
  /* only: ids of the applications this action touched (others are not compared); omit it to compare them all */
  async function persist(only) {
    try { await store.commit(db, only); } catch (e) { await reload(); throw e; }
  }
  /* run fn, then write once. If fn throws half-way, memory is reloaded from the database so a half-done change is never saved later. */
  const atomic = (fn, ids) => locked(async () => {
    let r; try { r = fn(); } catch (e) { await reload(); throw e; }
    await persist(ids ? ids(r) : undefined); return r;
  });
  const byId = (id) => db.apps.find((a) => a.id === id);
  const addDays = R.addDays;
  const fundsOf = R.fundsOf;

  /* ---------- history, notifications, Google sync ---------- */
  /* a student is shown by the name they typed on the form, not their sign-in name (which may be a nickname) */
  const nm = (a, actor) => (actor.email === a.studentEmail && a.studentName ? a.studentName : actor.name);
  function hist(a, actor, action, note, cls) { a.history.push({ at: now(), by: actor ? (actor.email === a.studentEmail && a.studentName ? a.studentName : actor.name) : 'System', role: actor ? actor.role : 'system', action, note: note || '', cls: cls || '' }); a.updated = now(); }
  function notify(to, a, subject, body, key) {
    (Array.isArray(to) ? to : [to]).forEach((email) => {
      if (!email) return; const k = key + ':' + email; if (db.keys[k]) return; db.keys[k] = 1;
      const subj = '[' + (a.ref || 'draft') + '] ' + subject;
      db.notifs.unshift({ id: 'n' + (++db.seq), to: email, at: now(), appId: a.id, title: subject, body, read: false });
      const mail = body + summary(a);
      db.outbox.unshift({ id: 'm' + (++db.seq), to: email, at: now(), subject: subj, body: mail });
      gas.post({ action: 'email', to: email, subject: subj, body: mail });
    });
  }
  /* email footer: who and what, no amounts or thesis details (email is stored and forwarded) */
  function summary(a) {
    const c = a.conf || {};
    return '\n\n---\nApplicant: ' + (a.studentName || '-') + (a.program ? ' (' + a.program + ')' : '') + '\nReference: ' + (a.ref || 'draft') +
      '\nEvent: ' + (c.title || '-') + (c.scope ? ', ' + regionLabel(c.scope) : '') + (c.start ? '\nDates: ' + fmtD(c.start) + (c.end && c.end !== c.start ? ' to ' + fmtD(c.end) : '') : '') +
      '\nStatus: ' + info(a).label + '\nOpen the application in SCGSS to see the full details.\n\nThis message contains personal information meant only for you (Data Privacy Act of 2012). Do not forward it. If it reached you by mistake, delete it and tell computerstudies@dlsu.edu.ph.';
  }
  const SHEET_COLS = R.makeSheetCols(() => db.files);
  function sync(a, why) {
    syncLog.unshift({ at: now(), ref: a.ref, why, mode: gas.live() ? 'live' : 'off' }); syncLog.length = Math.min(syncLog.length, 80);
    if (gas.live()) {
      const row = {}; SHEET_COLS.forEach((c) => { row[c[0]] = c[1](a); }); gas.post({ action: 'upsert', key: a.ref, row });
      Object.values(db.files).filter((f) => f.appId === a.id && f.name && !f.pushed).forEach((f) => gas.pushFile(f)); /* gas sets f.pushed only after Google accepts it */
    }
    save();
  }

  function routeFor(prog, adv) {
    const s = signers(), a = acct(adv);
    if (!a || !a.active || ADVISER_ROLES.indexOf(a.role) < 0) return { err: 'Choose a valid Thesis Adviser.' };
    if (!s.chairs[prog]) return { err: 'No Department Chair is set for ' + prog + '. Ask the System Administrator.' };
    if (!s.assoc || !s.dean) return { err: 'The Associate Dean or Dean is not set. Ask the System Administrator.' };
    return { adviser: adv, chair: s.chairs[prog], assoc: s.assoc, dean: adv === s.dean ? s.assoc : s.dean };
  }
  const nextRef = (ay, term) => ay + '-' + term + '-' + pad3(((db.counters[ay + '-' + term]) || 0) + 1);
  const advisories = (email, ay, exceptId) => db.apps.filter((a) => a.studentEmail === email && a.ay === ay && a.id !== exceptId && a.status !== 'rejected');

  /* ---------- engine: every action checks the actor and writes history ---------- */
  const OK = { ok: true }, ERR = (m) => ({ err: m }), E = {};
function turnErr(a,actor){
  if(a.status!=='pending')return 'This application is not waiting for an approver.';
  const s=CHAIN[a.stage];
  if(actor.email===a.studentEmail)return 'Applicants cannot act on their own application.';
  if(actor.email!==a.route[s]){
    if(CHAIN.some((k,i)=>i>a.stage&&a.route[k]===actor.email))return 'It is the '+CH[s].label+"'s turn, not yours. Approvals follow the sequence.";
    return 'This application is assigned to '+nameOf(a.route[s])+' at the '+CH[s].label+' step, not to you.';
  }
  return null;
}
function deny(a,actor,msg){hist(a,actor,'Denied (403)',msg,'bad');sync(a,'Denied action');return {err:msg,denied:true}}
function fileExt(n){const m=/\.[A-Za-z0-9]+$/.exec(n||'');return m?m[0].toLowerCase():'.pdf'}
/* a file can be attached only by the person who uploaded it, and only while it is not yet attached to any application */
function ownFile(actor,id){const m=id&&Object.prototype.hasOwnProperty.call(db.files,id)?db.files[id]:null;return m&&m.byEmail===actor.email&&!m.appId?m:null}
const NOT_YOURS='One of the attached files could not be used. Upload it again from your own computer.';
const badFiles=(actor,ids)=>(ids||[]).some(id=>!ownFile(actor,id));
function lineReq(a,s){notify(a.route[s],a,'Action required: '+CH[s].verb.toLowerCase()+' grant application',a.studentName+' ('+a.program+') applied for a conference grant: '+a.conf.title+'. It now needs your decision as '+CH[s].label+': '+CH[s].verb+', Return with remarks, or Reject.','req:'+a.id+':'+a.stage+':'+a.cycle)}
function applyForm(a,f){
  a.studentName=R.tidyName(f.name)||a.studentName;a.sid=f.sid;a.program=f.prog;a.year=f.year;
  a.conf={title:f.conf,start:f.start,end:f.end,venue:f.venue,org:f.org,etype:f.etype,scope:f.scope};
  a.paper={cls:f.cls,ptype:f.ptype,index:f.index,title:f.title,coF:f.cof,coS:f.cos};
  a.expenses=f.exp.map((x,i)=>({type:x.type,amount:Number(x.amount)||0,remarks:x.remarks||'',fund:'',approved:null}));
}
E.submit=function(actor,f){
  if(!actor||actor.role!=='student')return ERR('Only students can submit an application.');
  const errs=validateForm(f);if(errs.length)return {err:errs[0].msg,errs};
  const route=routeFor(f.prog,f.adv);if(route.err)return route;
  const fm=ownFile(actor,f.file&&f.file.id);if(!fm)return ERR('The attached file could not be found. Attach it again.');
  const key=f.ay+'-'+f.term;db.counters[key]=(db.counters[key]||0)+1;
  const ref=key+'-'+pad3(db.counters[key]);
  const a={id:'a'+(++db.seq),ref,key,ay:f.ay,term:f.term,status:'pending',stage:0,cycle:1,studentEmail:actor.email,studentName:R.tidyName(f.name),route,
    attach:{fileId:f.file.id,version:1},privacy:{at:now(),v:R.PRIVACY_VERSION},decisions:{},returned:null,rejected:null,grant:null,comments:[],history:[],post:{status:'none',cycle:0},report:null,viewed:{},created:now(),updated:now(),clar:0};
  applyForm(a,f);
  fm.name=ref+'.pdf';fm.appId=a.id;fm.kind='Application requirements';fm.folder='Applications/'+key;fm.by=nm(a,actor);fm.at=now();fm.version=1;
  db.apps.push(a);
  hist(a,actor,'Submitted','Reference '+ref+' assigned. Requirements PDF saved as '+fm.name+'. Data privacy notice accepted. Routed to the Thesis Adviser, '+nameOf(route.adviser)+'.'+(route.dean!==signers().dean?' The Dean is the Thesis Adviser, so the Associate Dean, '+nameOf(route.dean)+', will approve the grant in the Dean\'s place.':''));
  notify(actor.email,a,'Application submitted','Your application was received as '+ref+'. It is now with your Thesis Adviser, '+nameOf(route.adviser)+'. You can follow it on your dashboard.','sub:'+a.id);
  lineReq(a,'adviser');
  sync(a,'Application submitted');
  return {ok:true,app:a};
};
/* a person endorses an application once: later steps held by someone who already endorsed are skipped. The grant approval is never skipped. */
const endorsedBy=(a,email)=>Object.keys(a.decisions).some(k=>a.decisions[k].email===email&&(a.decisions[k].d==='endorsed'||a.decisions[k].d==='skipped'));
function advance(a){
  a.stage++;
  while(a.stage<CHAIN.length-1){
    const n=CHAIN[a.stage],who=a.route[n];
    const inPlace=n==='assoc'&&a.route.dean===who; /* the Dean is the adviser: the Associate Dean only approves the grant */
    if(!inPlace&&!endorsedBy(a,who))break;
    a.decisions[n]={d:'skipped',at:now(),by:nameOf(who),email:who,inPlace};
    hist(a,null,'Step skipped',inPlace?'The Associate Dean endorsement was skipped: '+nameOf(who)+' will approve the grant in the Dean\'s place instead.':'The '+CH[n].label+' step was skipped: '+nameOf(who)+' already endorsed this application as another signatory.');
    a.stage++;
  }
}
E.endorse=function(actor,a,note){
  const err=turnErr(a,actor);if(err)return deny(a,actor,err);
  const s=CHAIN[a.stage];
  if(s==='dean')return ERR('The Dean approves the grant with an amount per item and an e-signature.');
  a.decisions[s]={d:'endorsed',at:now(),by:actor.name,email:actor.email};
  hist(a,actor,'Endorsed',note);
  const from=a.stage;advance(a);const n=CHAIN[a.stage];
  const skipped=CHAIN.slice(from+1,a.stage).map(k=>CH[k].label);
  hist(a,null,'Routed','Sent automatically to the '+CH[n].label+', '+nameOf(a.route[n])+'.');
  lineReq(a,n);
  notify(a.studentEmail,a,'Endorsed by your '+CH[s].label,'Your '+CH[s].label+' endorsed the application. It is now with the '+CH[n].label+'.'+(skipped.length?' The '+skipped.join(' and ')+' step was skipped because the same person already endorsed it.':''),'prog:'+a.id+':'+a.stage+':'+a.cycle);
  sync(a,'Endorsed by '+CH[s].label);return OK;
};
/* o = {confirm, dry, note, amount, fund}. The Dean sets ONE approved amount and ONE funding source for the whole grant (no signature: since 1.0.0-rc.6
   the Dean signs the Summary of Expenses instead);
   the Administrative Assistant breaks it down by receipt at reimbursement.
   dry runs every check and returns the total without recording anything, so the screen can show a confirmation first. */
E.approveGrant=function(actor,a,o){
  const err=turnErr(a,actor);if(err)return deny(a,actor,err);
  if(CHAIN[a.stage]!=='dean')return ERR('Only the Dean approves the grant.');
  const amt=Number(o.amount),fund=String(o.fund||'').trim(),cap=CAP[a.conf.scope],pt=projected(a);
  if(o.amount===''||o.amount==null||!(amt>0))return ERR('Enter the approved grant amount. Use Reject to decline the application.');
  if(!fund)return ERR('Enter the funding source for the grant.');
  if(fund.length>80)return ERR('The funding source is too long.');
  if(amt>cap)return ERR('The approved grant of ₱'+money(amt)+' is above the ₱'+money(cap)+' limit for '+regionLabel(a.conf.scope)+'.');
  if(amt>pt)return ERR('The approved grant of ₱'+money(amt)+' is above the ₱'+money(pt)+' the student projected.');
  const tot=round2(amt);
  if(o.dry)return {ok:true,dry:true,total:tot,fund};
  if(!o.confirm)return ERR('Press Confirm approval to record the grant.');
  a.grant={total:tot,fund,by:actor.name,byEmail:actor.email,at:now()};
  a.decisions.dean={d:'approved',at:now(),by:actor.name,email:actor.email};a.status='approved';
  hist(a,actor,'Approved grant','Approved ₱'+money(tot)+' · funding source: '+fund+'.'+(o.note?' "'+o.note+'"':''));
  notify(a.studentEmail,a,'Your grant is approved','Good news: the Dean approved your conference grant of ₱'+money(tot)+' (funding source: '+fund+'). After the conference, submit the post-activity report within '+PAR_DAYS+' days after '+fmtD(a.conf.end)+' (by '+fmtD(dueDate(a))+'): one consolidated PDF of your documents, the Post-Conference Report (PDF), and an article of '+ARTICLE_WORDS[0]+' to '+ARTICLE_WORDS[1]+' words with a poster or social media graphic. You will get reminders by email and in-app.','appr:'+a.id);
  notify(adminsOf(),a,'Grant approved','Grant approved for '+a.studentName+': ₱'+money(tot)+' ('+fund+'). You will break it down by receipt at reimbursement. Expect a post-activity report by '+fmtD(dueDate(a))+'.','apprfyi:'+a.id);
  sync(a,'Grant approved');return OK;
};
E.returnApp=function(actor,a,note){
  const err=turnErr(a,actor);if(err)return deny(a,actor,err);
  if(!String(note||'').trim())return ERR('Add remarks so the student knows what to clarify or correct.');
  const s=CHAIN[a.stage];
  a.status='returned';a.returned={role:s,by:actor.name,why:note,at:now(),stage:a.stage};a.decisions[s]={d:'returned',at:now(),by:actor.name,email:actor.email};
  hist(a,actor,'Returned to student',note);
  notify(a.studentEmail,a,'Returned for clarification','Your '+CH[s].label+' returned the application: "'+note+'". Reply, upload documents if needed, and resubmit. Earlier decisions are kept.','ret:'+a.id+':'+a.cycle);
  sync(a,'Returned');return OK;
};
E.reject=function(actor,a,note){
  const err=turnErr(a,actor);if(err)return deny(a,actor,err);
  if(!String(note||'').trim())return ERR('A reason is required to reject.');
  const s=CHAIN[a.stage];
  a.status='rejected';a.rejected={role:s,by:actor.name,why:note,at:now()};a.decisions[s]={d:'rejected',at:now(),by:actor.name,email:actor.email};
  hist(a,actor,'Rejected',note);
  notify(a.studentEmail,a,'Application rejected','Your '+CH[s].label+' rejected the application. Reason: "'+note+'". The application is closed and all earlier decisions stay on record.','rej:'+a.id);
  sync(a,'Rejected');return OK;
};
function saveClar(a,actor,fileIds){
  return (fileIds||[]).map(id=>{const m=ownFile(actor,id);if(!m)return null;a.clar++;m.name=a.ref+'-C'+a.clar+fileExt(m.orig);m.appId=a.id;m.kind='Clarification';m.folder='Clarifications/'+a.key;m.by=actor.name;m.at=now();return id}).filter(Boolean);
}
/* everyone who may be asked a question about an application: the student, each signatory and the Administrative Assistants */
const participants=a=>Array.from(new Set([a.studentEmail].concat(Object.keys(a.route).map(k=>a.route[k])).concat(adminsOf())));
function counterparts(a,actor){
  const last=a.comments.slice().reverse().filter(c=>c.email!==actor.email&&participants(a).indexOf(c.email)>-1)[0];
  if(actor.email===a.studentEmail){
    if(a.status==='pending')return [a.route[CHAIN[a.stage]]];
    if(a.status==='returned')return [a.route[a.returned.role]];
    if(a.post.status==='submitted'||a.post.status==='returned'||a.status==='verified')return adminsOf();
    return [a.route.adviser];
  }
  return [last?last.email:a.studentEmail];
}
/* to (optional): who should receive the message. The thread itself stays visible to everyone on the application. */
E.comment=function(actor,a,text,fileIds,to,topic){
  const isRoute=Object.keys(a.route).some(k=>a.route[k]===actor.email);
  const ok=actor.email===a.studentEmail||isRoute||actor.role==='admin';
  if(!ok)return deny(a,actor,'You are not part of this application, so you cannot comment on it.');
  text=String(text||'').trim();
  if(!text&&!(fileIds&&fileIds.length))return ERR('Write a message or attach a file.');
  let rcpt=to&&to.length?to.filter(e=>e!==actor.email&&participants(a).indexOf(e)>-1):counterparts(a,actor).filter(e=>e!==actor.email);
  if(!rcpt.length)return ERR('Choose who should receive this message.');
  if(badFiles(actor,fileIds))return ERR(NOT_YOURS);
  const ids=saveClar(a,actor,fileIds);
  a.comments.push({id:'c'+(++db.seq),at:now(),by:nm(a,actor),role:actor.role,email:actor.email,text,files:ids,to:rcpt,topic:topic||null});
  hist(a,actor,topic?'Reimbursement question':'Comment','To '+rcpt.map(nameOf).join(', ')+(topic?' ['+topic.kind+(topic.item?' · '+topic.item:'')+']':'')+': '+(text.length>150?text.slice(0,150)+'...':text)+(ids.length?' · '+ids.length+' file(s): '+ids.map(i=>db.files[i].name).join(', '):''));
  notify(rcpt,a,topic?'Reimbursement question: '+topic.kind:'New message from '+nm(a,actor),nm(a,actor)+' ('+ROLE_NAME[actor.role]+') wrote: "'+(text||'(file attached)')+'"','cm:'+a.id+':'+db.seq);
  sync(a,'Comment');return OK;
};
E.resubmit=function(actor,a,f,reply,fileIds){
  if(actor.email!==a.studentEmail)return deny(a,actor,'Only the applicant can resubmit this application.');
  if(a.status!=='returned')return ERR('This application was not returned.');
  reply=String(reply||'').trim();
  if(!f&&!reply)return ERR('Reply to the remarks, or edit the application, before resubmitting.');
  if(badFiles(actor,fileIds))return ERR(NOT_YOURS);
  if(f&&f.file&&f.file.id!==a.attach.fileId&&!ownFile(actor,f.file.id))return ERR(NOT_YOURS);
  let changed=[];
  if(f){
    f=Object.assign({},f,{ay:a.ay,term:a.term});
    const errs=validateForm(f);if(errs.length)return {err:errs[0].msg,errs};
    const was=JSON.stringify([a.conf,a.paper,a.expenses.map(x=>x.amount+x.remarks),a.program,a.year,a.sid,a.studentName]);
    const adv=a.route.adviser,oldProg=a.program;
    applyForm(a,f);
    if(JSON.stringify([a.conf,a.paper,a.expenses.map(x=>x.amount+x.remarks),a.program,a.year,a.sid,a.studentName])!==was)changed.push('form details');
    if(f.adv!==adv||oldProg!==f.prog){const r=routeFor(f.prog,f.adv);if(r.err)return r;a.route=r;if(f.adv!==adv)changed.push('thesis adviser');if(oldProg!==f.prog)changed.push('degree program (Department Chair re-set)')}
    if(f.file&&f.file.id!==a.attach.fileId){const old=db.files[a.attach.fileId],fm=db.files[f.file.id];a.attach.version++;a.attach.fileId=f.file.id;
      fm.name=a.ref+'-v'+a.attach.version+'.pdf';fm.appId=a.id;fm.kind='Application requirements (v'+a.attach.version+')';fm.folder='Applications/'+a.key;fm.by=actor.name;fm.at=now();fm.version=a.attach.version;if(old)old.superseded=true;changed.push('requirements PDF (v'+a.attach.version+')')}
  }
  const ids=saveClar(a,actor,fileIds);
  if(reply||ids.length)a.comments.push({id:'c'+(++db.seq),at:now(),by:nm(a,actor),role:'student',email:actor.email,text:reply,files:ids,to:[a.route[a.returned.role]]});
  const s=a.returned.role;a.status='pending';a.stage=a.returned.stage;a.returned=null;a.cycle++;
  hist(a,actor,'Resubmitted',(changed.length?'Edited: '+changed.join(', ')+'. ':'')+(reply?'Reply: "'+reply+'"':'')+(ids.length?' '+ids.length+' file(s) attached.':'')+' Back to the '+CH[s].label+'; earlier decisions kept.');
  lineReq(a,s);
  sync(a,'Resubmitted');return OK;
};
/* d = {file, report, poster (uploads), article:{title, date, summary}, docs, missingNote, items:[{type, or, merchant, amount}]}. Amounts are in pesos. */
E.submitPost=function(actor,a,d){
  if(actor.email!==a.studentEmail)return deny(a,actor,'Only the applicant can submit the post-activity report.');
  if(a.status!=='approved'||a.post.status==='submitted'||a.post.status==='dean')return ERR('A post-activity report can only be submitted for an approved grant that is not already under review.');
  const p=a.post,n=p.cycle+1;
  /* the three uploads. On a resubmission, an upload left empty keeps the earlier version. */
  const pick=(f,prevId,label)=>{if(f&&f.id){const m=ownFile(actor,f.id);return m?{m}:{err:'The '+label+' could not be found. Upload it again.'}}return prevId&&db.files[prevId]?{keep:prevId}:{err:'Upload the '+label+'.'}};
  const pdf=pick(d.file,p.fileId,'consolidated PDF');if(pdf.err)return ERR(pdf.err);
  const rep=pick(d.report,p.reportId,'Post-Conference Report (PDF)');if(rep.err)return ERR(rep.err);
  const gfx=pick(d.poster,p.posterId,'poster or social media graphic');if(gfx.err)return ERR(gfx.err);
  if(pdf.m&&pdf.m.type!=='application/pdf')return ERR('The consolidated file must be a PDF.');
  if(rep.m&&rep.m.type!=='application/pdf')return ERR('The Post-Conference Report must be a PDF.');
  if(gfx.m&&['image/png','image/jpeg','application/pdf'].indexOf(gfx.m.type)<0)return ERR('The poster or social media graphic must be a PNG, JPG or PDF.');
  if(new Set([pdf.m,rep.m,gfx.m].filter(Boolean)).size!==[pdf.m,rep.m,gfx.m].filter(Boolean).length)return ERR('Use a different file for each of the three uploads.');
  /* the article write-up */
  const ar=d.article||{},title=String(ar.title||'').trim(),date=String(ar.date||'').trim(),summary=String(ar.summary||'').trim(),words=wordCount(summary);
  if(!title)return ERR('Enter the conference title for the article.');
  if(title.length>200)return ERR('The conference title is too long.');
  if(!date)return ERR('Enter the conference date for the article.');
  if(date.length>80)return ERR('The conference date is too long.');
  if(words<ARTICLE_WORDS[0]||words>ARTICLE_WORDS[1])return ERR('The article summary must be '+ARTICLE_WORDS[0]+' to '+ARTICLE_WORDS[1]+' words. It has '+words+'.');
  if(summary.length>6000)return ERR('The article summary is too long.');
  /* expenses */
  const items=[];
  for(const it of (d.items||[])){
    const amt=it.amount===''||it.amount==null?0:Number(it.amount),or=String(it.or||'').trim(),mer=String(it.merchant||'').trim();
    if(!amt&&!or&&!mer)continue;
    if(!(amt>=0))return ERR('Amounts cannot be negative.');
    if(EXPENSE_TYPES.indexOf(it.type)<0)return ERR('Choose the expense type for every expense.');
    if(!(amt>0))return ERR('Enter the amount for expense '+(or||mer)+'.');
    if(!or)return ERR('Enter the OR or invoice number for the '+it.type+' expense of ₱'+money(amt)+'.');
    if(!mer)return ERR('Enter the merchant name for '+or+'.');
    items.push({type:it.type,or,merchant:mer,amount:round2(amt)});
  }
  const ct=total(items,'amount');if(!(ct>0))return ERR('Enter at least one expense taken from your receipts or invoices.');
  if(ct>a.grant.total)return ERR('The total of ₱'+money(ct)+' is above the approved grant of ₱'+money(a.grant.total)+', so it cannot be accepted. Reduce the amounts to ₱'+money(a.grant.total)+' or less.');
  const docs=d.docs||{},missing=REQ_POST.filter(r=>!docs[r[0]]);
  if(missing.length&&!String(d.missingNote||'').trim())return ERR('Explain why these documents are not in the consolidated PDF: '+missing.map(m=>m[1]).join(', ')+'.');
  const v=n>1?'-v'+n:'',saved=[];
  const take=(x,prevId,name,kind)=>{if(!x.m)return x.keep;const fm=x.m,prev=prevId&&db.files[prevId];fm.name=name;fm.appId=a.id;fm.kind=kind+(n>1?' (v'+n+')':'');fm.folder='Post-activity/'+a.key;fm.by=actor.name;fm.at=now();fm.version=n;if(prev)prev.superseded=true;saved.push(fm.name);return fm.id};
  const fileId=take(pdf,p.fileId,a.ref+'-PAR'+v+'.pdf','Post-activity documents (consolidated PDF)');
  const reportId=take(rep,p.reportId,a.ref+'-PCR'+v+'.pdf','Post-Conference Report');
  const posterId=take(gfx,p.posterId,a.ref+'-GRAPHIC'+v+fileExt(gfx.m&&gfx.m.orig),'Poster or social media graphic');
  a.post=Object.assign({},p,{status:'submitted',cycle:n,fileId,reportId,posterId,items:items.map((x,i)=>Object.assign({id:'i'+(i+1)},x)),claimedTotal:ct,docs,missingNote:String(d.missingNote||'').trim(),
    article:{title,date,location:a.conf.venue+(a.conf.scope?' ('+regionLabel(a.conf.scope)+')':''),summary,words},submittedAt:now(),verify:null});
  hist(a,actor,n>1?'Post-activity report resubmitted':'Post-activity report submitted','Total for reimbursement ₱'+money(ct)+' across '+items.length+' expense(s). Article of '+words+' words.'+(saved.length?' Saved: '+saved.join(', ')+'.':'')+(missing.length?' Not in the PDF: '+missing.map(m=>m[1]).join(', ')+'.':''));
  notify(adminsOf(),a,'Action required: verify post-activity report',a.studentName+' submitted the post-activity report for '+a.conf.title+'. Check the consolidated PDF, the Post-Conference Report and the article with its graphic, check each expense, set the approved amount per item, and verify.','par:'+a.id+':'+n);
  notify(a.studentEmail,a,'Post-activity report received','Your post-activity report was received'+(saved.length?' (saved as '+saved.join(', ')+')':'')+'. The Administrative Assistant will verify it.','parc:'+a.id+':'+n);
  sync(a,'Post-activity report submitted');return OK;
};
/* d = {checks, remarks, returns, overall, items:[{approved, fund, or, merchant, why}]}. mode: save | return | verify
   verify = the three requirements are verified and the validated Summary of Expenses goes to the Dean for approval (since 1.0.0-rc.6). */
E.postReview=function(actor,a,d,mode){
  if(actor.role!=='admin')return deny(a,actor,'Only the Administrative Assistant verifies post-activity documents and sets reimbursement amounts.');
  /* a report verified before rc.6 has no Dean approval: the Administrative Assistant can send it to the Dean the same way */
  const legacy=a.status==='verified'&&!a.post.summary;
  if(!legacy&&(a.status!=='approved'||a.post.status!=='submitted'))return ERR('There is no submitted report waiting for verification.');
  if(legacy&&mode!=='verify')return ERR('This report was verified before the Dean\'s approval step. Send the summary to the Dean instead.');
  const p=a.post,rows=d.items||[];
  const v={checks:d.checks||{},remarks:d.remarks||{},returns:d.returns||{},overall:d.overall||'',by:actor.name,at:now(),
    items:p.items.map((x,i)=>{const r=rows[i]||{};return {id:x.id,type:x.type,claimed:x.amount,
      approved:r.approved===''||r.approved==null?null:Number(r.approved),or:r.or!=null?String(r.or).trim():x.or,merchant:r.merchant!=null?String(r.merchant).trim():x.merchant,fund:String(r.fund||'').trim(),why:String(r.why||'').trim()}})};
  const flagged=REQ_CHECK.filter(r=>v.returns[r[0]]);
  if(mode==='save'){p.verify=Object.assign(v,{total:null,draft:true});hist(a,actor,'Verification saved','Progress saved; not yet verified.');sync(a,'Verification saved');return OK}
  if(mode==='return'){
    if(!flagged.length&&!String(v.overall).trim()&&!Object.keys(v.remarks).some(k=>String(v.remarks[k]).trim()))return ERR('Flag the requirements to return, or add remarks that tell the student what to correct or add.');
    p.status='returned';p.verify=Object.assign(v,{total:null,draft:true});
    const list=flagged.map(r=>r[1]).join(', ');
    hist(a,actor,'Post-activity report returned',(list?'Requirements to return: '+list+'. ':'')+(v.overall||'See remarks per document.'));
    notify(a.studentEmail,a,'Post-activity requirements returned','The Administrative Assistant returned your report'+(list?' and asks you to clarify or resubmit: '+list+'.':'.')+' "'+(v.overall||'see the remarks per document')+'" Upload a corrected PDF: it is saved as a new version and the original stays on record. Reply by '+fmtD(dueDate(a))+' if you can.','parret:'+a.id+':'+p.cycle);
    sync(a,'Post-activity report returned');return OK}
  if(flagged.length)return ERR('You flagged '+flagged.map(r=>r[1]).join(', ')+' to return. Use Return to student, or clear the flags.');
  const bad=REQ_CHECK.filter(r=>!v.checks[r[0]]&&!String(v.remarks[r[0]]||'').trim());
  if(bad.length)return ERR('Tick '+bad.map(b=>b[1]).join(', ')+', or add a remark explaining why it is not included.');
  for(let i=0;i<v.items.length;i++){const l=v.items[i],nm=l.type+' ('+l.or+')';
    if(l.approved==null||!(l.approved>=0))return ERR('Enter the approved amount for '+nm+' (0 if not reimbursed).');
    if(l.approved>0&&!l.fund)return ERR('Enter the funding source for '+nm+'.');
    if(l.approved>0&&(!l.or||!l.merchant))return ERR('Enter the OR or invoice number and the merchant name for '+l.type+'.');
    if(l.approved!==l.claimed&&!l.why)return ERR('Add a remark for '+nm+': the approved amount differs from the amount the student listed.')}
  const tot=total(v.items,'approved');
  if(!(tot>0))return ERR('The approved reimbursement is zero. Return the report to the student with remarks instead.');
  if(tot>a.grant.total)return ERR('The approved reimbursement of ₱'+money(tot)+' is above the grant of ₱'+money(a.grant.total)+' approved by the Dean.');
  v.total=tot;v.draft=false;p.verify=v;p.status='dean';a.status='approved';p.summary=null;p.deanReturn=null;
  hist(a,actor,'Summary of Expenses submitted to the Dean','Requirements verified. Validated reimbursement ₱'+money(tot)+' of ₱'+money(p.claimedTotal)+' listed by the student, sent to '+nameOf(a.route.dean)+' for approval.'+(v.overall?' "'+v.overall+'"':''));
  notify(a.route.dean,a,'Action required: approve the Summary of Expenses','The Administrative Assistant verified the post-activity requirements of '+a.studentName+' ('+a.conf.title+') and prepared the Summary of Expenses: ₱'+money(tot)+' for reimbursement. Review it, add your digital signature and approve it.','soe:'+a.id+':'+p.cycle+':'+now());
  notify(a.studentEmail,a,'Post-activity requirements verified','Your post-activity requirements were verified. The Summary of Expenses (₱'+money(tot)+') is now with the Dean for approval.','ver:'+a.id+':'+p.cycle);
  sync(a,'Summary of Expenses submitted to the Dean');return OK;
};
/* "Santos, Maria L." -> "Maria L. Santos" for the greeting */
const greetName=n=>{const m=/^([^,]+),\s*(.+)$/.exec(String(n||'').trim());return m?m[2].trim()+' '+m[1].trim():String(n||'').trim()||'Student'};
/* the email the student gets when the Administrative Assistant records the RFP (wording from the College, 18 Nov 2026) */
const faoMail=(a,rfp)=>'Hi '+greetName(a.studentName)+',\n\nGood day!\n\nWe would like to inform you that your reimbursement request has been processed and submitted to the Finance and Accounting Office (FAO) for review and approval, with Request for Payment (reference number '+rfp+').\n\nYou may check the status of your reimbursement at Window A or B, Finance Office at St. La Salle Hall, approximately 5 to 10 business days from receipt of this email. Please be reminded that you are required to submit the original receipts or invoices (or printed copies of electronic receipts) when claiming your reimbursement.\n\nThank you.';
/* o = {signature, confirm, dry, note}. The Dean (or the approver in the Dean's place) reviews the validated Summary of Expenses,
   signs it and approves it. Only then can the Summary of Expenses be generated, downloaded and printed. */
E.approveSummary=function(actor,a,o){
  o=o||{};
  if(actor.email!==a.route.dean)return deny(a,actor,'Only '+nameOf(a.route.dean)+', who approved the grant, approves the Summary of Expenses.');
  if(a.status!=='approved'||a.post.status!=='dean')return ERR('There is no Summary of Expenses waiting for your approval.');
  const sig=String(o.signature||'');
  if(sig.indexOf('data:image/png;base64,')!==0)return ERR('Add your digital signature before approving.');
  if(sig.length>300000)return ERR('The signature image is too large. Draw it again or upload a smaller image.');
  if(o.dry)return {ok:true,dry:true,total:a.post.verify.total};
  if(!o.confirm)return ERR('Press Confirm approval to sign the Summary of Expenses.');
  const p=a.post,note=String(o.note||'').trim().slice(0,1000);
  p.summary={by:actor.name,byEmail:actor.email,at:now(),signature:sig,note,inPlace:a.route.dean!==signers().dean};p.status='verified';a.status='verified';
  hist(a,actor,'Summary of Expenses approved','Approved and e-signed: reimbursement ₱'+money(p.verify.total)+'.'+(note?' "'+note+'"':''));
  notify(adminsOf(),a,'Summary of Expenses approved','The Dean approved the Summary of Expenses for '+a.studentName+' (₱'+money(p.verify.total)+'). Download or print it, submit it to the FAO, then record the RFP number.','soeok:'+a.id+':'+p.cycle);
  notify(a.studentEmail,a,'Reimbursement approved by the Dean','The Dean approved your reimbursement of ₱'+money(p.verify.total)+'. The Administrative Assistant will submit it to the Finance and Accounting Office next.','soeoks:'+a.id+':'+p.cycle);
  sync(a,'Summary of Expenses approved');return OK;
};
/* The Dean sends the summary back to the Administrative Assistant with remarks (amounts or funding sources to change). */
E.returnSummary=function(actor,a,note){
  if(actor.email!==a.route.dean)return deny(a,actor,'Only '+nameOf(a.route.dean)+' can return the Summary of Expenses.');
  if(a.status!=='approved'||a.post.status!=='dean')return ERR('There is no Summary of Expenses waiting for your approval.');
  note=String(note||'').trim();if(!note)return ERR('Add remarks that tell the Administrative Assistant what to change.');
  const p=a.post;p.status='submitted';p.verify=Object.assign({},p.verify,{draft:true,total:null});p.deanReturn={by:actor.name,at:now(),note:note.slice(0,2000)};
  hist(a,actor,'Summary of Expenses returned','Returned to the Administrative Assistant: "'+p.deanReturn.note+'"');
  notify(adminsOf(),a,'Summary of Expenses returned by the Dean','The Dean returned the Summary of Expenses for '+a.studentName+': "'+p.deanReturn.note+'" Correct it on the Verification screen and send it again.','soeret:'+a.id+':'+now());
  sync(a,'Summary of Expenses returned');return OK;
};
/* o = {rfp}. Marks the Summary of Expenses as filed at the FAO, records the RFP number and emails the student. */
E.complete=function(actor,a,o){
  if(actor.role!=='admin')return deny(a,actor,'Only the Administrative Assistant files the Summary of Expenses at the FAO.');
  if(a.status!=='verified'||!a.post.summary)return ERR('The Dean must approve the Summary of Expenses first.');
  const rfp=String(o&&o.rfp||'').trim();
  if(!rfp)return ERR('Enter the RFP number to mark the report as filed at the FAO.');
  if(rfp.length>40)return ERR('The RFP number is too long.');
  a.report={no:'SOE-'+a.ref,at:now(),by:actor.name,rfp};a.status='completed';
  hist(a,actor,'Filed at FAO','Summary of Expenses '+a.report.no+' submitted to the FAO. RFP '+rfp+'. The student was emailed.');
  notify(a.studentEmail,a,'Reimbursement request submitted to the FAO (RFP '+rfp+')',faoMail(a,rfp),'done:'+a.id);
  sync(a,'Filed at FAO');return OK;
};
E.remind=function(actor,a,auto){
  if(['admin','sysadmin'].indexOf(actor.role)<0)return deny(a,actor,'Only office staff can send reminders.');
  const day=Math.floor(now()/864e5);let to=null,what='';
  if(a.status==='pending'){const s=CHAIN[a.stage];to=a.route[s];what='is waiting for your decision'}
  else if(a.status==='returned'){to=a.studentEmail;what='was returned to you and is waiting for your reply'}
  else if(a.status==='approved'&&(a.post.status==='submitted')){to=adminsOf();what='has a post-activity report waiting for verification'}
  else if(a.status==='approved'&&a.post.status==='dean'){to=a.route.dean;what='has a Summary of Expenses waiting for your approval and signature'}
  else if(a.status==='approved'&&a.post.status!=='returned'){if(manilaToday()<=a.conf.end)return ERR('The conference has not ended yet.');to=a.studentEmail;what='needs its post-activity report and reimbursement requirements (due '+fmtD(dueDate(a))+')'}
  else if(a.status==='approved'){to=a.studentEmail;what='has returned post-activity requirements waiting for your correction'}
  else if(a.status==='verified'){to=adminsOf();what='is verified and waiting to be filed at the FAO with an RFP number'}
  if(!to)return ERR('Nothing is waiting on anyone for this application.');
  notify(to,a,'Reminder: application '+what,'Application '+a.ref+' ('+a.conf.title+') '+what+'.','rem:'+a.id+':'+a.status+':'+a.stage+':'+day);
  hist(a,auto?null:actor,'Reminder sent','Email and in-app reminder sent.');sync(a,'Reminder sent');return OK;
};
E.sweep=function(actor,days){
  let n=0;const cut=now()-(days||2)*864e5;
  db.apps.forEach(a=>{if(['rejected','completed'].indexOf(a.status)>-1)return;if(a.updated<cut){const r=E.remind(actor,a,true);if(r.ok)n++}});
  return n;
};
/* Automatic reminders to students for the post-activity report and reimbursement requirements, due PAR_DAYS days after the event.
   Sent as an email and an in-app notice at 15, 7, 3 and 1 days before the due date, on the due date, and every 3 days when overdue.
   Each reminder has a key, so running this again the same day sends nothing twice. In the real build a daily trigger runs it. */
const REMIND_AT=[15,7,3,1,0];
E.autoRemind=function(){
  const today=manilaToday();let n=0;
  db.apps.forEach(a=>{
    if(a.status!=='approved'||['none','returned'].indexOf(a.post.status)<0||today<a.conf.end)return;
    const left=daysBetween(today,dueDate(a)),returned=a.post.status==='returned';
    let step,subject,when;
    if(left<0){step='over'+Math.floor(-left/3);subject='Overdue: post-activity report';when='were due on '+fmtD(dueDate(a))+' ('+(-left)+' day'+(left===-1?'':'s')+' ago)'}
    else{const m=REMIND_AT.filter(x=>left<=x).pop();step='d'+m;subject=left===0?'Due today: post-activity report':'Reminder: post-activity report due '+(left===1?'tomorrow':'in '+left+' days');when=left===0?'are due today ('+fmtD(dueDate(a))+')':'are due on '+fmtD(dueDate(a))+' ('+left+' day'+(left===1?'':'s')+' left)'}
    const key='parrem:'+a.id+':'+a.post.cycle+':'+step;
    if(db.keys[key+':'+a.studentEmail])return;
    notify(a.studentEmail,a,subject,(returned?'Your returned post-activity requirements ':'Your post-activity report and reimbursement requirements for '+a.conf.title+' ')+when+'. Submit the consolidated PDF, the Post-Conference Report and the article with its graphic, and list your actual expenses.',key);
    a.history.push({at:now(),by:'System',role:'system',action:'Automatic reminder',note:subject+' sent to '+a.studentName+' by email and in-app.',cls:''});
    n++;
  });
  if(n)save();
  return n;
};
E.markRead=function(email,id){db.notifs.forEach(n=>{if(n.to===email&&(!id||n.id===id))n.read=true});save()};
E.markViewed=function(actor,a,fileId){
  const f=Object.prototype.hasOwnProperty.call(db.files,fileId)?db.files[fileId]:null;if(!f||f.appId!==a.id)return;
  const k=actor.email+':'+fileId+':'+a.cycle+':'+(a.post.cycle||0);if(db.keys['view:'+k])return;db.keys['view:'+k]=1;
  const m=db.files[fileId];hist(a,actor,'Viewed document',m?m.name:fileId);a.viewed[actor.email]=a.viewed[actor.email]||{};a.viewed[actor.email][fileId]=1;save();
};

  /* ---------- registering uploaded files ---------- */
  /* write(id) saves the bytes first, so a full disk leaves no record without a file. A person may hold only MAX_UNATTACHED files that are not on an application yet. */
  const MAX_UNATTACHED = 15;
  const registerFile = (o, write) => locked(async () => {
    if (Object.values(db.files).filter((f) => !f.appId && f.byEmail === o.byEmail).length >= MAX_UNATTACHED) return { err: 'You have too many files waiting to be attached. Submit or finish your application first.' };
    const id = 'f' + crypto.randomUUID().replace(/-/g, ''); /* random, so one file's id says nothing about another's */
    if (write) await write(id);
    db.files[id] = Object.assign({ id, orig: 'document.pdf', size: 0, type: 'application/pdf', by: '', at: now(), name: null, appId: null, folder: 'Unfiled', kind: '', version: 1 }, o);
    try { await persist(); } catch (e) { if (filesDir) await fs.promises.unlink(path.join(filesDir, id)).catch(() => {}); throw e; }
    return db.files[id];
  });
  /* files nobody attached to an application within `days` are deleted (a saved draft may still point at a recent one) */
  const purgeUnattached = (days) => locked(async () => {
    const cut = now() - days * 864e5, old = Object.values(db.files).filter((f) => !f.appId && f.at < cut);
    old.forEach((f) => { delete db.files[f.id]; if (filesDir) fs.promises.unlink(path.join(filesDir, f.id)).catch(() => {}); });
    if (old.length) await persist([]);
    return old.length;
  });

  /* ---------- what a person may see ---------- */
  const isStaff = (u) => u.role === 'admin' || u.role === 'sysadmin';
  const mayView = (u, a) => isStaff(u) || a.studentEmail === u.email || Object.keys(a.route).some((k) => a.route[k] === u.email);
  async function snapshotFor(u) {
    /* the Dean's signature image goes only to staff and to the signer, not to the student or the other approvers */
    const hideSig = (a) => {
      if (isStaff(u) || a.route.dean === u.email || !((a.post && a.post.summary && a.post.summary.signature) || (a.grant && a.grant.signature))) return a;
      const c = Object.assign({}, a);
      if (a.post && a.post.summary) c.post = Object.assign({}, a.post, { summary: Object.assign({}, a.post.summary, { signature: null }) });
      if (a.grant && a.grant.signature) c.grant = Object.assign({}, a.grant, { signature: null });
      return c;
    };
    const apps = db.apps.filter((a) => mayView(u, a)).map(hideSig);
    const ids = new Set(apps.map((a) => a.id));
    const files = {}; Object.values(db.files).forEach((f) => { if ((f.appId && ids.has(f.appId)) || (!f.appId && f.byEmail === u.email)) files[f.id] = f; });
    /* staff see everyone; anyone else sees only the people they can pick or deal with: advisers, the office, and the signers on their applications */
    const route = new Set(apps.flatMap((a) => Object.values(a.route)));
    const dir = store.listUsers().filter((x) => x.active === 1 && (isStaff(u) || ADVISER_ROLES.includes(x.role) || x.role === 'admin' || route.has(x.email) || x.email === u.email)).map(decorate);
    return {
      me: decorate(u), apps, files, directory: dir, settings: signers(), counters: db.counters,
      notifs: db.notifs.filter((n) => n.to === u.email).slice(0, 200),
      outbox: u.role === 'sysadmin' ? db.outbox.slice(0, 200) : db.outbox.filter((m) => m.to === u.email).slice(0, 100),
      syncLog: isStaff(u) ? syncLog.slice(0, 80) : [], draft: await store.getDraft(u.email), sig: await store.getSig(u.email), live: gas.live(), serverTime: now()
    };
  }

  /* ---------- run one action on the server ---------- */
  const ACTIONS = new Set(['submit', 'endorse', 'approveGrant', 'returnApp', 'reject', 'comment', 'resubmit', 'submitPost', 'postReview', 'approveSummary', 'returnSummary', 'complete', 'remind', 'markRead', 'markViewed']);
  /* no typed text may be longer than this (the signature image and the article, which has its own limit, are the longest allowed) */
  const tooLong = (x, d = 0) => (typeof x === 'string' ? x.length > 6000 && x.indexOf('data:image/') !== 0 : !!x && typeof x === 'object' && d < 6 && Object.values(x).some((v) => tooLong(v, d + 1)));
  const runNow = (actor, name, appId, args) => {
    if (!ACTIONS.has(name)) return ERR('Unknown action.');
    if (tooLong(args)) return ERR('One of the texts is too long. Shorten it and try again.');
    if (name === 'submit') return E.submit(actor, args[0]);
    if (name === 'markRead') { E.markRead(actor.email, args[0]); return OK; }
    const a = byId(appId);
    if (!a || !mayView(actor, a)) return ERR('That application was not found.');
    if (name === 'markViewed') { E.markViewed(actor, a, args[0]); return OK; }
    const before = JSON.stringify(a), filesBefore = JSON.stringify(db.files);
    const r = E[name](actor, a, ...args);
    if (r && r.err && !r.denied) { /* a failed action leaves nothing behind */
      const snap = JSON.parse(before); Object.keys(a).forEach((k) => { delete a[k]; }); Object.assign(a, snap); db.files = JSON.parse(filesBefore);
    }
    return r;
  };
  /* an action changes one application (or creates one), so only that one is compared when saving */
  const run = (actor, name, appId, args) => atomic(() => runNow(actor, name, appId, args), (r) => (r && r.app ? [r.app.id] : appId ? [appId] : []));

  return { E, db, run, byId, registerFile, purgeUnattached, snapshotFor, mayView, signers, advisers, nextRef, advisories, acct, decorate, syncLog, autoRemind: () => atomic(() => E.autoRemind()), sweep: (actor, days) => atomic(() => E.sweep(actor, days)) };
}

module.exports = { createEngine };
