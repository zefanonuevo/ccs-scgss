/* CCS SCGSS v2.0 core: data, rules, routing, notifications, Google sync, seed data.
   Everything is stored in this browser (localStorage + IndexedDB). Nothing is sent anywhere unless a Google Apps Script URL is set in Settings. */
(function(C){
"use strict";
const $=(s,r)=>(r||document).querySelector(s), $$=(s,r)=>Array.prototype.slice.call((r||document).querySelectorAll(s));
const money=n=>Number(n||0).toLocaleString('en-PH');
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pad3=n=>String(n).padStart(3,'0');
const MONTHS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
let T=null; /* fixed clock while seeding */
const now=()=>T||Date.now();
const fmtT=ts=>new Date(ts).toLocaleString('sv-SE',{timeZone:'Asia/Manila',hour12:false}).slice(0,16);
const fmtD=s=>{if(!s)return '';const p=s.split('-');return (+p[2])+' '+MONTHS[p[1]-1]+' '+p[0]};
const fmtSize=n=>n>1048576?(n/1048576).toFixed(1)+' MB':Math.max(1,Math.round(n/1024))+' KB';
const addWorkdays=(s,n)=>{const d=new Date(s+'T00:00:00Z');while(n>0){d.setUTCDate(d.getUTCDate()+1);const w=d.getUTCDay();if(w!==0&&w!==6)n--}return d.toISOString().slice(0,10)};
const round2=n=>Math.round(n*100)/100;
C.u={$,$$,money,esc,pad3,fmtT,fmtD,fmtSize,addWorkdays,round2,now};

/* ---------- constants ---------- */
const PROGRAMS=[['BSCS','BS Computer Science'],['BSIT','BS Information Technology'],['BSIS','BS Information Systems']];
const AYS=['2526','2627','2728'], TERMS=['Term1','Term2','Term3'];
const CAP={international:30000,local:15000};
const EXPENSE_TYPES=['Registration fee','Pre-departure fees','Roundtrip airfare','Accommodation','Per diem'];
const REQ_APP=['Copy of the paper (full text)','Letter of acceptance or notification','Proof of indexing (Scopus, ISI or ASEAN Citation)'];
const REQ_POST=[['accept','Proof of acceptance or invitation'],['paper','Conference paper'],['receipts','Scanned copies of official receipts or invoices'],['billing','Copy of billing statement'],['fx','Peso conversion rate'],['itin','Copy of itinerary receipt and invoice'],['sid','Student ID'],['article','Article write-up'],['poster','Poster']];
const CHAIN=['adviser','chair','assoc','dean'];
const CH={adviser:{label:'Thesis Adviser',verb:'Endorse'},chair:{label:'Department Chair',verb:'Endorse'},assoc:{label:'Associate Dean',verb:'Endorse'},dean:{label:'Dean',verb:'Approve'}};
const ROLE_NAME={student:'Student',adviser:'Thesis Adviser',chair:'Department Chair',assoc:'Associate Dean',dean:'Dean',admin:'Administrative Assistant',secretary:'Secretary',sysadmin:'System Administrator'};
const PRIVACY='Data Privacy Notice (draft for the University Data Protection Officer to review). By submitting this form I consent to De La Salle University, College of Computer Studies collecting and processing the personal information I provide (name, student ID, degree program, conference and expense details, and the documents I upload) to evaluate and administer my conference grant. This includes routing my application to my thesis adviser, department chair, associate dean and dean, and sharing it with the administrative and accounting offices, and keeping records and reports. My information is stored in the College\'s Google Workspace (Sheets and Drive), is open only to these offices, and is kept for the period the University sets. I understand my rights under the Data Privacy Act of 2012 (RA 10173), including to access and correct my data and to withdraw consent, by contacting the University Data Protection Officer.';
const ACCOUNTS=[
 {email:'maria.santos@college.example',name:'Maria Santos',role:'student',program:'BSCS',label:'Student, BSCS'},
 {email:'noel.ramos@college.example',name:'Noel Ramos',role:'student',program:'BSIT',label:'Student, BSIT'},
 {email:'adviser.reyes@college.example',name:'Dr. Paolo Reyes',role:'adviser',label:'Thesis Adviser'},
 {email:'adviser.villanueva@college.example',name:'Dr. Ana Villanueva',role:'adviser',label:'Thesis Adviser'},
 {email:'chair.cs@college.example',name:'Dr. Luis Mercado',role:'chair',program:'BSCS',label:'Department Chair, BSCS'},
 {email:'chair.it@college.example',name:'Dr. Grace Tan',role:'chair',program:'BSIT',label:'Department Chair, BSIT'},
 {email:'chair.is@college.example',name:'Dr. Ben Lim',role:'chair',program:'BSIS',label:'Department Chair, BSIS'},
 {email:'assoc.dean@college.example',name:'Dr. Carla Mendoza',role:'assoc',label:'Associate Dean'},
 {email:'dean@college.example',name:'Dr. Elena Navarro',role:'dean',label:'Dean'},
 {email:'admin.assistant@college.example',name:'Rosa Delgado',role:'admin',label:'Administrative Assistant'},
 {email:'secretary@college.example',name:'Marites Valdez',role:'secretary',label:'Secretary'},
 {email:'sysadmin@college.example',name:'Jun Bautista',role:'sysadmin',label:'System Administrator, project owner'}
];
Object.assign(C,{PROGRAMS,AYS,TERMS,CAP,EXPENSE_TYPES,REQ_APP,REQ_POST,CHAIN,CH,ROLE_NAME,PRIVACY,ACCOUNTS});
const acct=e=>ACCOUNTS.find(a=>a.email===e);
const nameOf=e=>{const a=acct(e);return a?a.name:e};
C.acct=acct;C.nameOf=nameOf;

/* ---------- files: IndexedDB blobs + a tiny PDF writer for sample documents ---------- */
const FILES=(function(){
  const mem={};let dbp=null;
  function open(){if(dbp)return dbp;dbp=new Promise((res,rej)=>{try{const r=indexedDB.open('ccs-scgss-files',1);r.onupgradeneeded=()=>r.result.createObjectStore('f');r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)}catch(e){rej(e)}});return dbp}
  return {
    put(id,blob){mem[id]=blob;return open().then(d=>new Promise((res,rej)=>{const t=d.transaction('f','readwrite');t.objectStore('f').put(blob,id);t.oncomplete=res;t.onerror=()=>rej(t.error)})).catch(()=>{})},
    get(id){if(mem[id])return Promise.resolve(mem[id]);return open().then(d=>new Promise((res,rej)=>{const r=d.transaction('f').objectStore('f').get(id);r.onsuccess=()=>res(r.result||null);r.onerror=()=>rej(r.error)})).catch(()=>null)}
  };
})();
function makePdf(title,lines){
  const t=s=>String(s).replace(/₱/g,'PHP ').replace(/[^\x20-\x7e]/g,'?').replace(/[\\()]/g,'\\$&').slice(0,95);
  let y=790,c='BT /F1 16 Tf 56 '+y+' Td ('+t(title)+') Tj ET\n';y-=30;
  lines.slice(0,38).forEach(l=>{c+='BT /F1 11 Tf 56 '+y+' Td ('+t(l)+') Tj ET\n';y-=18});
  const o=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>','<< /Length '+c.length+' >>\nstream\n'+c+'endstream','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
  let out='%PDF-1.4\n';const off=[];
  o.forEach((x,i)=>{off.push(out.length);out+=(i+1)+' 0 obj\n'+x+'\nendobj\n'});
  const xr=out.length;
  out+='xref\n0 '+(o.length+1)+'\n0000000000 65535 f \n'+off.map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')+'trailer\n<< /Size '+(o.length+1)+' /Root 1 0 R >>\nstartxref\n'+xr+'\n%%EOF';
  return new Blob([out],{type:'application/pdf'});
}
/* a stored file record. Seeded or sample files have no uploaded blob, so a placeholder PDF is made when someone previews them */
function registerFile(o){const id='f'+(++db.seq);db.files[id]=Object.assign({id,orig:'document.pdf',size:150000,type:'application/pdf',by:'',at:now(),name:null,appId:null,folder:'Unfiled',kind:'',version:1},o);return db.files[id]}
function getBlob(id){
  return FILES.get(id).then(b=>{if(b)return b;const m=db.files[id]||{};const a=m.appId&&db.apps.find(x=>x.id===m.appId);
    return makePdf(m.name||m.orig||'Sample document',['SAMPLE PLACEHOLDER. This is a generated stand-in, not an uploaded file.','',a?'Application: '+a.ref+' - '+a.conf.title:'','Document: '+(m.kind||''),'Uploaded by: '+(m.by||''),'File name: '+(m.name||m.orig||'')])});
}
function sampleSig(name){return 'data:image/svg+xml;utf8,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="320" height="110" viewBox="0 0 320 110"><path d="M12 70 C32 8 52 108 74 44 S118 14 132 62 S176 96 196 40 S246 20 262 58 L306 30" fill="none" stroke="#14325c" stroke-width="3.2" stroke-linecap="round"/></svg>')}
C.FILES=FILES;C.makePdf=makePdf;C.registerFile=f=>registerFile(f);C.getBlob=getBlob;C.sampleSig=sampleSig;

/* ---------- database ---------- */
const KEY='ccs-scgss-v2';
let db=null;
function save(){try{localStorage.setItem(KEY,JSON.stringify(db))}catch(e){}}
function load(){try{db=JSON.parse(localStorage.getItem(KEY))}catch(e){db=null}if(!db||db.v!==2)seed();C.db=db}
C.save=save;C.load=load;C.reset=()=>{try{localStorage.removeItem(KEY)}catch(e){}seed();save();C.db=db};
const byId=id=>db.apps.find(a=>a.id===id);
C.byId=byId;

/* ---------- status, steps, helpers ---------- */
const STEP_LABELS=['Submitted','Thesis Adviser','Department Chair','Associate Dean','Dean','Post-activity report','Verified','Reimbursed'];
function info(a){
  switch(a.status){
    case 'pending':{const s=CHAIN[a.stage];return {label:'Pending: '+CH[s].label,cls:'p-wait',by:CH[s].label,who:nameOf(a.route[s]),group:'pending'}}
    case 'returned':{const s=a.returned&&a.returned.role||CHAIN[a.stage];return {label:'Returned by '+CH[s].label,cls:'p-warn',by:'Student',who:a.studentName,group:'returned'}}
    case 'rejected':return {label:'Rejected',cls:'p-bad',by:'None',who:'',group:'rejected'};
    case 'approved':
      if(a.post.status==='submitted')return {label:'Post-activity report: for verification',cls:'p-wait',by:'Administrative Assistant',who:'',group:'post'};
      if(a.post.status==='returned')return {label:'Post-activity report returned',cls:'p-warn',by:'Student',who:a.studentName,group:'post'};
      return {label:'Approved: report due',cls:'p-ok',by:'Student',who:a.studentName,group:'approved'};
    case 'verified':return {label:'Verified: reimbursement report ready',cls:'p-ok',by:'Administrative Assistant',who:'',group:'post'};
    case 'completed':return {label:'Completed',cls:'p-ok',by:'None',who:'',group:'completed'};
  }
  return {label:a.status,cls:'p-idle',by:'',who:'',group:''};
}
function stepState(a){ /* returns array of '', 'done', 'now', 'bad' for the 8 steps */
  const s=STEP_LABELS.map(()=>''),mark=(n,state)=>{for(let i=0;i<n;i++)s[i]='done';s[n]=state};
  if(a.status==='pending'||a.status==='returned')mark(1+a.stage,'now');
  else if(a.status==='rejected')mark(1+a.stage,'bad');
  else if(a.status==='approved')mark(5,'now');
  else if(a.status==='verified')mark(7,'now');
  else if(a.status==='completed')s.fill('done');
  return s;
}
const total=(list,k)=>round2(list.reduce((t,x)=>t+(Number(x[k])||0),0));
const projected=a=>total(a.expenses,'amount');
const grantTotal=a=>a.grant?a.grant.total:0;
const dueDate=a=>addWorkdays(a.conf.end,7);
Object.assign(C,{info,stepState,STEP_LABELS,projected,grantTotal,dueDate,total});

/* ---------- history, notifications, Google sync ---------- */
function hist(a,actor,action,note,cls){a.history.push({at:now(),by:actor?actor.name:'System',role:actor?actor.role:'system',action,note:note||'',cls:cls||''});a.updated=now()}
function live(){const g=db.settings.gas;return !T&&g&&g.url}
function gasPost(p){if(!live())return;p.token=db.settings.gas.token;try{fetch(db.settings.gas.url,{method:'POST',mode:'no-cors',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(p)}).catch(()=>{})}catch(e){}}
function notify(to,a,subject,body,key){
  (Array.isArray(to)?to:[to]).forEach(email=>{
    if(!email)return;const k=key+':'+email;if(db.keys[k])return;db.keys[k]=1;
    const subj='['+(a.ref||'draft')+'] '+subject;
    db.notifs.unshift({id:'n'+(++db.seq),to:email,at:now(),appId:a.id,title:subject,body,read:false});
    db.outbox.unshift({id:'m'+(++db.seq),to:email,at:now(),subject:subj,body});
    gasPost({action:'email',to:email,subject:subj,body});
  });
}
const adminsOf=()=>ACCOUNTS.filter(x=>x.role==='admin').map(x=>x.email);
const SHEET_COLS=[
 ['Reference',a=>a.ref],['Academic year',a=>a.ay],['Term',a=>a.term],['Status',a=>info(a).label],['Student',a=>a.studentName],['Student ID',a=>a.sid],['Degree program',a=>a.program],['Year level',a=>a.year],
 ['Thesis Adviser',a=>nameOf(a.route.adviser)],['Department Chair',a=>nameOf(a.route.chair)],['Associate Dean',a=>nameOf(a.route.assoc)],['Dean',a=>nameOf(a.route.dean)],
 ['Conference',a=>a.conf.title],['Event type',a=>a.conf.etype],['Start date',a=>a.conf.start],['End date',a=>a.conf.end],['Venue',a=>a.conf.venue],['Organizer',a=>a.conf.org],['Travel',a=>a.conf.scope],
 ['Paper title',a=>a.paper.title],['Paper type',a=>a.paper.ptype],['Classification',a=>a.paper.cls],['Indexed in',a=>a.paper.index],['Co-authors (faculty)',a=>a.paper.coF],['Co-authors (student)',a=>a.paper.coS],
 ['Projected total (PHP)',a=>projected(a)],
 ...EXPENSE_TYPES.map((t,i)=>['Projected: '+t,a=>a.expenses[i]?a.expenses[i].amount:'']),
 ['Adviser decision',a=>dec(a,'adviser')],['Chair decision',a=>dec(a,'chair')],['Associate Dean decision',a=>dec(a,'assoc')],['Dean decision',a=>dec(a,'dean')],
 ['Grant approved (PHP)',a=>a.grant?a.grant.total:''],['Grant funding source',a=>a.grant?a.grant.fund:''],['Dean e-signature',a=>a.grant?'Signed '+fmtT(a.grant.at):''],
 ['Post-activity status',a=>a.post.status],['Actual claimed (PHP)',a=>a.post.claimedTotal||''],['Reimbursement approved (PHP)',a=>a.post.verify&&a.post.verify.total!=null?a.post.verify.total:''],['Verified by',a=>a.post.verify&&a.post.verify.by||''],['Report no.',a=>a.report?a.report.no:''],
 ['Files',a=>Object.values(db.files).filter(f=>f.appId===a.id&&f.name).map(f=>f.name).join(' | ')],['Privacy consent',a=>a.privacy?fmtT(a.privacy.at):''],['Submitted',a=>fmtT(a.created)],['Last updated',a=>fmtT(a.updated)]
];
function dec(a,r){const d=a.decisions[r];return d?d.d+' '+fmtT(d.at):''}
C.SHEET_COLS=SHEET_COLS;C.live=live;
function sync(a,why){
  db.syncLog.unshift({at:now(),ref:a.ref,why,mode:live()?'live':'simulated'});db.syncLog.length=Math.min(db.syncLog.length,80);
  if(live()){const row={};SHEET_COLS.forEach(c=>row[c[0]]=c[1](a));gasPost({action:'upsert',key:a.ref,row});
    Object.values(db.files).filter(f=>f.appId===a.id&&f.name&&!f.pushed).forEach(f=>{f.pushed=true;
      FILES.get(f.id).then(b=>{if(!b)return;const r=new FileReader();r.onload=()=>gasPost({action:'file',folder:f.folder,name:f.name,mime:b.type||f.type,b64:String(r.result).split(',')[1]});r.readAsDataURL(b)})})}
  save();
}

/* ---------- validation ---------- */
function validateForm(f){
  const e=[],add=(step,id,msg)=>e.push({step,id,msg}),req=(v,step,id,msg)=>{if(!String(v==null?'':v).trim())add(step,id,msg)};
  req(f.ay,0,'f_ay','Select the academic year.');req(f.term,0,'f_term','Select the term.');req(f.sid,0,'f_sid','Enter your student ID number.');req(f.prog,0,'f_prog','Select your degree program.');
  req(f.year,0,'f_year','Select your year level.');req(f.adv,0,'f_adv','Select your thesis adviser.');req(f.conf,0,'f_conf','Enter the conference title.');
  req(f.start,0,'f_start','Enter the start date.');req(f.end,0,'f_end','Enter the end date.');
  if(f.start&&f.end&&f.end<f.start)add(0,'f_end','The end date is before the start date.');
  req(f.venue,0,'f_venue','Enter the venue.');req(f.org,0,'f_org','Enter the organizer.');req(f.etype,0,'f_etype','Select the type of event.');req(f.scope,0,'f_scope','Select international or local travel.');
  req(f.index,1,'f_index','Select where the paper is indexed.');req(f.title,1,'f_title','Enter the title of the paper.');
  const t=f.exp.reduce((s,x)=>s+(Number(x.amount)||0),0);
  if(f.exp.some(x=>Number(x.amount)<0))add(2,'ex_0','Amounts cannot be negative.');
  else if(!(t>0))add(2,'ex_0','Enter at least one projected expense amount.');
  if(!f.file)add(3,'f_filebtn','Attach the single PDF that holds all required documents.');
  if(!f.attConfirm)add(3,'f_attconfirm','Confirm that every required document is attached.');
  if(!f.privacy)add(4,'f_privacy','Accept the data privacy notice to submit.');
  if(!f.brand)add(4,'f_brand','Tick this box to confirm the branding requirements.');
  return e;
}
C.validateForm=validateForm;
function routeFor(prog,adv){
  const s=db.settings,a=acct(adv);
  if(!a||a.role!=='adviser')return {err:'Choose a valid Thesis Adviser.'};
  if(!s.chairs[prog])return {err:'No Department Chair is set for '+prog+'. Ask the System Administrator.'};
  if(!s.assoc||!s.dean)return {err:'The Associate Dean or Dean is not set. Ask the System Administrator.'};
  return {adviser:adv,chair:s.chairs[prog],assoc:s.assoc,dean:s.dean};
}
C.nextRef=(ay,term)=>ay+'-'+term+'-'+pad3(((db.counters[ay+'-'+term])||0)+1);
C.advisories=(email,ay,exceptId)=>db.apps.filter(a=>a.studentEmail===email&&a.ay===ay&&a.id!==exceptId&&a.status!=='rejected');

/* ---------- engine: every action checks the actor and writes history ---------- */
const OK={ok:true},ERR=m=>({err:m}),E={};
C.E=E;
function turnErr(a,actor){
  if(a.status!=='pending')return 'This application is not waiting for an approver.';
  const s=CHAIN[a.stage];
  if(actor.email===a.studentEmail)return 'Applicants cannot act on their own application.';
  if(actor.role!==s)return 'It is the '+CH[s].label+"'s turn, not the "+ROLE_NAME[actor.role]+"'s. Approvals follow the sequence.";
  if(actor.email!==a.route[s])return 'This application is assigned to '+nameOf(a.route[s])+', not to you.';
  return null;
}
function deny(a,actor,msg){hist(a,actor,'Denied (403)',msg,'bad');sync(a,'Denied action');return ERR(msg)}
function fileExt(n){const m=/\.[A-Za-z0-9]+$/.exec(n||'');return m?m[0].toLowerCase():'.pdf'}
function lineReq(a,s){notify(a.route[s],a,'Action required: '+CH[s].verb.toLowerCase()+' grant application',a.studentName+' ('+a.program+') applied for a conference grant: '+a.conf.title+'. It now needs your decision: '+CH[s].verb+', Return with remarks, or Reject.','req:'+a.id+':'+a.stage+':'+a.cycle)}
function applyForm(a,f){
  a.sid=f.sid;a.program=f.prog;a.year=f.year;
  a.conf={title:f.conf,start:f.start,end:f.end,venue:f.venue,org:f.org,etype:f.etype,scope:f.scope};
  a.paper={cls:f.cls,ptype:f.ptype,index:f.index,title:f.title,coF:f.cof,coS:f.cos};
  a.expenses=f.exp.map((x,i)=>({type:x.type,amount:Number(x.amount)||0,remarks:x.remarks||'',fund:'',approved:null}));
}
E.submit=function(actor,f){
  if(!actor||actor.role!=='student')return ERR('Only students can submit an application.');
  const errs=validateForm(f);if(errs.length)return {err:errs[0].msg,errs};
  const route=routeFor(f.prog,f.adv);if(route.err)return route;
  const fm=db.files[f.file.id];if(!fm)return ERR('The attached file could not be found. Attach it again.');
  const key=f.ay+'-'+f.term;db.counters[key]=(db.counters[key]||0)+1;
  const ref=key+'-'+pad3(db.counters[key]);
  const a={id:'a'+(++db.seq),ref,key,ay:f.ay,term:f.term,status:'pending',stage:0,cycle:1,studentEmail:actor.email,studentName:actor.name,route,
    attach:{fileId:f.file.id,version:1},privacy:{at:now()},decisions:{},returned:null,rejected:null,grant:null,comments:[],history:[],post:{status:'none',cycle:0},report:null,viewed:{},created:now(),updated:now(),clar:0};
  applyForm(a,f);
  fm.name=ref+'.pdf';fm.appId=a.id;fm.kind='Application requirements';fm.folder='Applications/'+key;fm.by=actor.name;fm.at=now();fm.version=1;
  db.apps.push(a);
  hist(a,actor,'Submitted','Reference '+ref+' assigned. Requirements PDF saved as '+fm.name+'. Data privacy notice accepted. Routed to the Thesis Adviser, '+nameOf(route.adviser)+'.');
  notify(actor.email,a,'Application submitted','Your application was received as '+ref+'. It is now with your Thesis Adviser, '+nameOf(route.adviser)+'. You can follow it on your dashboard.','sub:'+a.id);
  lineReq(a,'adviser');
  sync(a,'Application submitted');
  return {ok:true,app:a};
};
E.endorse=function(actor,a,note){
  const err=turnErr(a,actor);if(err)return deny(a,actor,err);
  const s=CHAIN[a.stage];
  if(s==='dean')return ERR('The Dean approves the grant with a funding source and an e-signature.');
  a.decisions[s]={d:'endorsed',at:now(),by:actor.name};
  hist(a,actor,'Endorsed',note);
  a.stage++;const n=CHAIN[a.stage];
  hist(a,null,'Routed','Sent automatically to the '+CH[n].label+', '+nameOf(a.route[n])+'.');
  lineReq(a,n);
  notify(a.studentEmail,a,'Endorsed by your '+CH[s].label,'Your '+CH[s].label+' endorsed the application. It is now with the '+CH[n].label+'.','prog:'+a.id+':'+a.stage+':'+a.cycle);
  sync(a,'Endorsed by '+CH[s].label);return OK;
};
E.approveGrant=function(actor,a,o){
  const err=turnErr(a,actor);if(err)return deny(a,actor,err);
  if(CHAIN[a.stage]!=='dean')return ERR('Only the Dean approves the grant.');
  if(!o.fund)return ERR('Select the funding source for the grant.');
  if(!o.signature||String(o.signature).indexOf('data:image')!==0)return ERR('Affix your digital signature before approving.');
  if(o.lines.length!==a.expenses.length)return ERR('Approved amounts are missing.');
  for(let i=0;i<o.lines.length;i++){
    const v=Number(o.lines[i].approved);
    if(!(v>=0)||String(o.lines[i].approved).trim()==='')return ERR('Enter an approved amount for '+a.expenses[i].type+' (0 if not funded).');
    if(v>a.expenses[i].amount)return ERR('The approved amount for '+a.expenses[i].type+' is above what the student projected.');
    if(v>0&&!o.lines[i].fund)return ERR('Select a funding source for '+a.expenses[i].type+'.');
  }
  const tot=round2(o.lines.reduce((s,l)=>s+Number(l.approved),0)),cap=CAP[a.conf.scope];
  if(!(tot>0))return ERR('The approved grant must be more than zero. Use Reject to decline the application.');
  if(tot>cap)return ERR('The approved grant of '+money(tot)+' is above the ₱'+money(cap)+' limit for '+a.conf.scope+' travel.');
  a.expenses.forEach((x,i)=>{x.approved=Number(o.lines[i].approved);x.fund=Number(o.lines[i].approved)>0?o.lines[i].fund:''});
  a.grant={total:tot,fund:o.fund,by:actor.name,byEmail:actor.email,at:now(),signature:o.signature};
  a.decisions.dean={d:'approved',at:now(),by:actor.name};a.status='approved';
  hist(a,actor,'Approved grant','Approved ₱'+money(tot)+' · funding source: '+o.fund+' · e-signed.'+(o.note?' "'+o.note+'"':''));
  notify(a.studentEmail,a,'Your grant is approved','Good news: the Dean approved your conference grant of ₱'+money(tot)+'. Funding source: '+o.fund+'. After the conference, submit the post-activity report (one PDF) within 7 working days after '+fmtD(a.conf.end)+' (by '+fmtD(dueDate(a))+').','appr:'+a.id);
  notify(adminsOf(),a,'Grant approved','Grant approved for '+a.studentName+': ₱'+money(tot)+' ('+o.fund+'). Expect a post-activity report after '+fmtD(a.conf.end)+'.','apprfyi:'+a.id);
  sync(a,'Grant approved');return OK;
};
E.returnApp=function(actor,a,note){
  const err=turnErr(a,actor);if(err)return deny(a,actor,err);
  if(!String(note||'').trim())return ERR('Add remarks so the student knows what to clarify or correct.');
  const s=CHAIN[a.stage];
  a.status='returned';a.returned={role:s,by:actor.name,why:note,at:now(),stage:a.stage};a.decisions[s]={d:'returned',at:now(),by:actor.name};
  hist(a,actor,'Returned to student',note);
  notify(a.studentEmail,a,'Returned for clarification','Your '+CH[s].label+' returned the application: "'+note+'". Reply, upload documents if needed, and resubmit. Earlier decisions are kept.','ret:'+a.id+':'+a.cycle);
  sync(a,'Returned');return OK;
};
E.reject=function(actor,a,note){
  const err=turnErr(a,actor);if(err)return deny(a,actor,err);
  if(!String(note||'').trim())return ERR('A reason is required to reject.');
  const s=CHAIN[a.stage];
  a.status='rejected';a.rejected={role:s,by:actor.name,why:note,at:now()};a.decisions[s]={d:'rejected',at:now(),by:actor.name};
  hist(a,actor,'Rejected',note);
  notify(a.studentEmail,a,'Application rejected','Your '+CH[s].label+' rejected the application. Reason: "'+note+'". The application is closed and all earlier decisions stay on record.','rej:'+a.id);
  sync(a,'Rejected');return OK;
};
function saveClar(a,actor,fileIds){
  return (fileIds||[]).map(id=>{const m=db.files[id];if(!m)return null;a.clar++;m.name=a.ref+'-C'+a.clar+fileExt(m.orig);m.appId=a.id;m.kind='Clarification';m.folder='Clarifications/'+a.key;m.by=actor.name;m.at=now();return id}).filter(Boolean);
}
function counterparts(a,actor){
  if(actor.email===a.studentEmail){
    if(a.status==='pending')return [a.route[CHAIN[a.stage]]];
    if(a.status==='returned')return [a.route[a.returned.role]];
    if(a.post.status==='submitted'||a.post.status==='returned'||a.status==='verified')return adminsOf();
    return [a.route.adviser];
  }
  return [a.studentEmail];
}
E.comment=function(actor,a,text,fileIds){
  const isRoute=Object.keys(a.route).some(k=>a.route[k]===actor.email);
  const ok=actor.email===a.studentEmail||isRoute||(actor.role==='admin'&&['approved','verified','completed'].indexOf(a.status)>-1);
  if(!ok)return deny(a,actor,'You are not part of this application, so you cannot comment on it.');
  text=String(text||'').trim();
  if(!text&&!(fileIds&&fileIds.length))return ERR('Write a message or attach a file.');
  const ids=saveClar(a,actor,fileIds);
  a.comments.push({id:'c'+(++db.seq),at:now(),by:actor.name,role:actor.role,email:actor.email,text,files:ids});
  hist(a,actor,'Comment',(text.length>150?text.slice(0,150)+'...':text)+(ids.length?' · '+ids.length+' file(s): '+ids.map(i=>db.files[i].name).join(', '):''));
  notify(counterparts(a,actor),a,'New message from '+actor.name,actor.name+' ('+ROLE_NAME[actor.role]+') wrote: "'+(text||'(file attached)')+'"','cm:'+a.id+':'+db.seq);
  sync(a,'Comment');return OK;
};
E.resubmit=function(actor,a,f,reply,fileIds){
  if(actor.email!==a.studentEmail)return deny(a,actor,'Only the applicant can resubmit this application.');
  if(a.status!=='returned')return ERR('This application was not returned.');
  reply=String(reply||'').trim();
  if(!f&&!reply)return ERR('Reply to the remarks, or edit the application, before resubmitting.');
  let changed=[];
  if(f){
    f=Object.assign({},f,{ay:a.ay,term:a.term});
    const errs=validateForm(f);if(errs.length)return {err:errs[0].msg,errs};
    const was=JSON.stringify([a.conf,a.paper,a.expenses.map(x=>x.amount+x.remarks),a.program,a.year,a.sid]);
    const adv=a.route.adviser,oldProg=a.program;
    applyForm(a,f);
    if(JSON.stringify([a.conf,a.paper,a.expenses.map(x=>x.amount+x.remarks),a.program,a.year,a.sid])!==was)changed.push('form details');
    if(f.adv!==adv||oldProg!==f.prog){const r=routeFor(f.prog,f.adv);if(r.err)return r;a.route=r;if(f.adv!==adv)changed.push('thesis adviser');if(oldProg!==f.prog)changed.push('degree program (Department Chair re-set)')}
    if(f.file&&f.file.id!==a.attach.fileId){const old=db.files[a.attach.fileId],fm=db.files[f.file.id];a.attach.version++;a.attach.fileId=f.file.id;
      fm.name=a.ref+'-v'+a.attach.version+'.pdf';fm.appId=a.id;fm.kind='Application requirements (v'+a.attach.version+')';fm.folder='Applications/'+a.key;fm.by=actor.name;fm.at=now();fm.version=a.attach.version;if(old)old.superseded=true;changed.push('requirements PDF (v'+a.attach.version+')')}
  }
  const ids=saveClar(a,actor,fileIds);
  if(reply||ids.length)a.comments.push({id:'c'+(++db.seq),at:now(),by:actor.name,role:'student',email:actor.email,text:reply,files:ids});
  const s=a.returned.role;a.status='pending';a.stage=a.returned.stage;a.returned=null;a.cycle++;
  hist(a,actor,'Resubmitted',(changed.length?'Edited: '+changed.join(', ')+'. ':'')+(reply?'Reply: "'+reply+'"':'')+(ids.length?' '+ids.length+' file(s) attached.':'')+' Back to the '+CH[s].label+'; earlier decisions kept.');
  lineReq(a,s);
  sync(a,'Resubmitted');return OK;
};
E.submitPost=function(actor,a,d){
  if(actor.email!==a.studentEmail)return deny(a,actor,'Only the applicant can submit the post-activity report.');
  if(a.status!=='approved'||a.post.status==='submitted')return ERR('A post-activity report can only be submitted for an approved grant that is not already under review.');
  if(!d.file)return ERR('Attach the single consolidated PDF.');
  const rate=Number(d.rate);if(!(rate>0))return ERR('Enter the peso conversion rate (1 if all amounts are in pesos).');
  const lines=EXPENSE_TYPES.map((t,i)=>({type:t,orig:Number(d.lines[i]&&d.lines[i].orig)||0}));
  if(lines.some(l=>l.orig<0))return ERR('Amounts cannot be negative.');
  lines.forEach(l=>l.claimed=round2(l.orig*rate));
  const ct=total(lines,'claimed');if(!(ct>0))return ERR('Enter at least one expense taken from your receipts or invoices.');
  const missing=REQ_POST.filter(r=>!d.docs[r[0]]);
  if(missing.length&&!String(d.missingNote||'').trim())return ERR('Tick every document you included, or explain what is missing: '+missing.map(m=>m[1]).join(', ')+'.');
  const fm=db.files[d.file.id];if(!fm)return ERR('The attached file could not be found. Attach it again.');
  const n=a.post.cycle+1;
  fm.name=a.ref+'-PAR'+(n>1?'-v'+n:'')+'.pdf';fm.appId=a.id;fm.kind='Post-activity report';fm.folder='Post-activity/'+a.key;fm.by=actor.name;fm.at=now();fm.version=n;
  const prev=a.post.fileId&&db.files[a.post.fileId];if(prev)prev.superseded=true;
  a.post=Object.assign({},a.post,{status:'submitted',cycle:n,fileId:fm.id,cur:d.cur||'PHP',rate,lines,claimedTotal:ct,docs:d.docs,missingNote:d.missingNote||'',submittedAt:now(),verify:null});
  hist(a,actor,n>1?'Post-activity report resubmitted':'Post-activity report submitted','Claimed ₱'+money(ct)+' across '+lines.filter(l=>l.claimed>0).length+' line item(s). PDF saved as '+fm.name+'.');
  notify(adminsOf(),a,'Action required: verify post-activity report',a.studentName+' submitted the post-activity report for '+a.conf.title+'. Tick the documents included, set the approved amount per item, and verify.','par:'+a.id+':'+n);
  notify(a.studentEmail,a,'Post-activity report received','Your report was received (saved as '+fm.name+'). The Administrative Assistant will verify it.','parc:'+a.id+':'+n);
  sync(a,'Post-activity report submitted');return OK;
};
E.postReview=function(actor,a,d,mode){
  if(actor.role!=='admin')return deny(a,actor,'Only the Administrative Assistant verifies post-activity documents and sets reimbursement amounts.');
  if(a.status!=='approved'||a.post.status!=='submitted')return ERR('There is no submitted report waiting for verification.');
  const p=a.post,lines=p.lines;
  const v={checks:d.checks||{},remarks:d.remarks||{},lines:lines.map((l,i)=>({type:l.type,claimed:l.claimed,approved:d.lines[i].approved===''||d.lines[i].approved==null?null:Number(d.lines[i].approved),fund:d.lines[i].fund||'',why:d.lines[i].why||''})),overall:d.overall||'',by:actor.name,at:now()};
  if(mode==='save'){p.verify=Object.assign(v,{total:null,draft:true});hist(a,actor,'Verification saved','Progress saved; not yet verified.');sync(a,'Verification saved');return OK}
  if(mode==='return'){
    if(!String(v.overall).trim()&&!Object.keys(v.remarks).some(k=>String(v.remarks[k]).trim()))return ERR('Add remarks that tell the student what to correct or add.');
    p.status='returned';p.verify=Object.assign(v,{total:null,draft:true});
    hist(a,actor,'Post-activity report returned',v.overall||'See remarks per document.');
    notify(a.studentEmail,a,'Post-activity report returned','The Administrative Assistant returned your report: "'+(v.overall||'see the remarks per document')+'". Correct it and resubmit.','parret:'+a.id+':'+p.cycle);
    sync(a,'Post-activity report returned');return OK}
  const bad=REQ_POST.filter(r=>!v.checks[r[0]]&&!String(v.remarks[r[0]]||'').trim());
  if(bad.length)return ERR('Tick '+bad.map(b=>b[1]).join(', ')+', or add a remark explaining why it is not included.');
  for(let i=0;i<v.lines.length;i++){const l=v.lines[i];
    if(l.approved==null||!(l.approved>=0))return ERR('Enter the approved amount for '+l.type+' (0 if not reimbursed).');
    if(l.approved>l.claimed)return ERR('The approved amount for '+l.type+' is above the amount claimed.');
    if(l.approved!==l.claimed&&!String(l.why).trim())return ERR('Add a remark for '+l.type+': the approved amount differs from the amount claimed.');
    if(l.approved>0&&!l.fund)return ERR('Select the funding source for '+l.type+'.')}
  const tot=total(v.lines,'approved');
  if(!(tot>0))return ERR('The approved reimbursement is zero. Return the report to the student with remarks instead.');
  if(tot>a.grant.total)return ERR('The approved reimbursement of ₱'+money(tot)+' is above the grant of ₱'+money(a.grant.total)+' approved by the Dean.');
  v.total=tot;v.draft=false;p.verify=v;p.status='verified';a.status='verified';
  hist(a,actor,'Post-activity documents verified','Approved reimbursement ₱'+money(tot)+' of ₱'+money(p.claimedTotal)+' claimed.'+(v.overall?' "'+v.overall+'"':''));
  notify(a.studentEmail,a,'Post-activity report verified','Your documents were verified. Approved reimbursement: ₱'+money(tot)+'. The reimbursement report goes to the Accounting Office next.','ver:'+a.id+':'+p.cycle);
  sync(a,'Post-activity documents verified');return OK;
};
E.complete=function(actor,a){
  if(actor.role!=='admin')return deny(a,actor,'Only the Administrative Assistant files the reimbursement report.');
  if(a.status!=='verified')return ERR('Verify the post-activity documents first.');
  a.report={no:'RR-'+a.ref,at:now(),by:actor.name};a.status='completed';
  hist(a,actor,'Reimbursement report filed','Report '+a.report.no+' generated and submitted to the Accounting Office.');
  notify(a.studentEmail,a,'Reimbursement sent to Accounting','The reimbursement report '+a.report.no+' for ₱'+money(a.post.verify.total)+' was sent to the Accounting Office.','done:'+a.id);
  sync(a,'Reimbursement report filed');return OK;
};
E.remind=function(actor,a,auto){
  if(['admin','secretary','sysadmin'].indexOf(actor.role)<0)return deny(a,actor,'Only office staff can send reminders.');
  const day=Math.floor(now()/864e5);let to=null,what='';
  if(a.status==='pending'){const s=CHAIN[a.stage];to=a.route[s];what='is waiting for your decision'}
  else if(a.status==='returned'){to=a.studentEmail;what='was returned to you and is waiting for your reply'}
  else if(a.status==='approved'&&(a.post.status==='submitted')){to=adminsOf();what='has a post-activity report waiting for verification'}
  else if(a.status==='approved'&&a.post.status!=='returned'){if(new Date(now()+288e5).toISOString().slice(0,10)<=a.conf.end)return ERR('The conference has not ended yet.');to=a.studentEmail;what='needs its post-activity report (due '+fmtD(dueDate(a))+')'}
  else if(a.status==='approved'){to=a.studentEmail;what='has a returned post-activity report waiting for your correction'}
  if(!to)return ERR('Nothing is waiting on anyone for this application.');
  notify(to,a,'Reminder: application '+what,'Application '+a.ref+' ('+a.conf.title+') '+what+'.','rem:'+a.id+':'+a.status+':'+a.stage+':'+day);
  hist(a,auto?null:actor,'Reminder sent','Email and in-app reminder sent.');sync(a,'Reminder sent');return OK;
};
E.sweep=function(actor,days){
  let n=0;const cut=now()-(days||2)*864e5;
  db.apps.forEach(a=>{if(['rejected','completed'].indexOf(a.status)>-1)return;if(a.updated<cut){const r=E.remind(actor,a,true);if(r.ok)n++}});
  return n;
};
E.markRead=function(email,id){db.notifs.forEach(n=>{if(n.to===email&&(!id||n.id===id))n.read=true});save()};
E.markViewed=function(actor,a,fileId){
  const k=actor.email+':'+fileId+':'+a.cycle+':'+(a.post.cycle||0);if(db.keys['view:'+k])return;db.keys['view:'+k]=1;
  const m=db.files[fileId];hist(a,actor,'Viewed document',m?m.name:fileId);a.viewed[actor.email]=a.viewed[actor.email]||{};a.viewed[actor.email][fileId]=1;save();
};

/* ---------- seed ---------- */
function seed(){
  const FUND=["Dean's Office (sample)","College Fund (sample)","Department Fund (sample)","External sponsor (sample)"];
  db={v:2,seq:0,keys:{},counters:{},apps:[],notifs:[],outbox:[],files:{},sigs:{},syncLog:[],drafts:{},
    settings:{assoc:'assoc.dean@college.example',dean:'dean@college.example',chairs:{BSCS:'chair.cs@college.example',BSIT:'chair.it@college.example',BSIS:'chair.is@college.example'},funding:FUND,gas:{url:'',token:''}}};
  const U=e=>acct(e),REY='adviser.reyes@college.example',VIL='adviser.villanueva@college.example';
  const stu=(n,p)=>({email:n.toLowerCase().replace(/ /g,'.')+'@college.example',name:n,role:'student',program:p});
  const hrs=h=>{T+=h*36e5};
  const mk=(s,o)=>{const fm=registerFile({orig:'requirements.pdf',size:210000,by:s.name});
    return Object.assign({ay:'2627',term:'Term1',sid:'122'+(1000+db.seq*7),prog:s.program,year:'4',adv:REY,etype:'Conference',scope:'international',cls:'Paper presenter',ptype:'Full paper',index:'Scopus',cof:'',cos:'',attConfirm:true,privacy:true,brand:true,file:{id:fm.id,orig:fm.orig,size:fm.size},
      exp:EXPENSE_TYPES.map((t,i)=>({type:t,amount:o.amts[i],remarks:''}))},o)};
  const dean=U('dean@college.example'),sig=sampleSig();
  const approve=(a,fund)=>E.approveGrant(dean,a,{fund,signature:sig,lines:a.expenses.map(x=>({approved:x.amount,fund})),note:'Approved.'});
  const par=(a,s,docsAll)=>{const fm=registerFile({orig:'post-activity.pdf',size:480000,by:s.name});
    return E.submitPost(s,a,{file:{id:fm.id},cur:a.conf.scope==='local'?'PHP':'USD',rate:a.conf.scope==='local'?1:56.5,lines:a.expenses.map(x=>({orig:a.conf.scope==='local'?x.amount:round2(x.amount/56.5)})),docs:docsAll,missingNote:''})};
  const allDocs={};REQ_POST.forEach(r=>allDocs[r[0]]=true);
  const adm=U('admin.assistant@college.example');
  const verify=a=>{const checks=allDocs,lines=a.post.lines.map((l,i)=>{const ap=Math.min(l.claimed,a.expenses[i].approved);return {approved:ap,fund:a.expenses[i].fund||FUND[0],why:ap!==l.claimed?'Rounding difference.':''}});return E.postReview(adm,a,{checks,remarks:{},lines,overall:'All documents complete.'},'verify')};
  const go=(r)=>r.app||r;
  let s,a;
  /* completed, AY 2526 */
  T=Date.UTC(2026,3,6,1,0);s=stu('Ivan Garcia','BSCS');a=go(E.submit(s,mk(s,{ay:'2526',term:'Term3',conf:'Sample Meeting on Information Retrieval',start:'2026-05-12',end:'2026-05-14',venue:'Singapore',org:'Sample Retrieval Society',title:'Sample Title on Retrieval Models',amts:[9000,1000,8500,5000,2500]})));
  hrs(20);E.endorse(U(REY),a,'Endorsed.');hrs(20);E.endorse(U('chair.cs@college.example'),a,'Endorsed.');hrs(20);E.endorse(U('assoc.dean@college.example'),a,'Endorsed.');hrs(20);approve(a,FUND[1]);
  T=Date.UTC(2026,4,24,1,0);par(a,s,allDocs);hrs(48);verify(a);hrs(24);E.complete(adm,a);
  /* rejected, AY 2526 */
  T=Date.UTC(2026,4,2,1,0);s=stu('Tina Lopez','BSIT');a=go(E.submit(s,mk(s,{ay:'2526',term:'Term3',adv:VIL,scope:'local',conf:'Sample Meeting on Robotics',start:'2026-06-10',end:'2026-06-11',venue:'Quezon City',org:'Sample Robotics Group',title:'Sample Title on Robot Planning',index:'ASEAN Citation',amts:[3000,500,0,6000,3000]})));
  hrs(20);E.endorse(U(VIL),a,'Endorsed.');hrs(20);E.endorse(U('chair.it@college.example'),a,'Endorsed.');hrs(20);E.reject(U('assoc.dean@college.example'),a,'The proceedings are not in a Scopus, ISI or ASEAN Citation listed index.');
  /* Maria: approved, report due */
  T=Date.UTC(2026,8,2,1,0);s=U('maria.santos@college.example');a=go(E.submit(s,mk(s,{sid:'12145678',conf:'International Conference on Sample Computing (ICSC 2026)',start:'2026-10-05',end:'2026-10-09',venue:'Kyoto, Japan',org:'Sample Computing Society',title:'Sample Title on Edge Inference',amts:[12430,1200,11800,6500,3000],cos:'Noel Ramos'})));
  hrs(22);E.endorse(U(REY),a,'Endorsed.');hrs(22);E.endorse(U('chair.cs@college.example'),a,'Strong paper. Endorsed.');hrs(22);E.endorse(U('assoc.dean@college.example'),a,'Endorsed.');hrs(22);
  E.approveGrant(dean,a,{fund:FUND[0],signature:sig,note:'Approved. Accommodation is capped at the limit.',lines:[{approved:12430,fund:FUND[0]},{approved:1200,fund:FUND[0]},{approved:11800,fund:FUND[0]},{approved:2570,fund:FUND[1]},{approved:0,fund:''}]});
  /* Ramon: post-activity report waiting for verification */
  T=Date.UTC(2026,8,5,1,0);s=stu('Ramon Dizon','BSIS');a=go(E.submit(s,mk(s,{adv:VIL,scope:'local',conf:'Sample Forum on Networks',start:'2026-09-28',end:'2026-09-30',venue:'Manila',org:'Sample Networks Forum',title:'Sample Title on Network Telemetry',index:'ISI',amts:[4000,500,0,6000,3500]})));
  hrs(20);E.endorse(U(VIL),a,'Endorsed.');hrs(20);E.endorse(U('chair.is@college.example'),a,'Endorsed.');hrs(20);E.endorse(U('assoc.dean@college.example'),a,'Endorsed.');hrs(20);approve(a,FUND[2]);
  T=Date.UTC(2026,9,9,2,0);par(a,s,allDocs);
  /* Jorge: waiting for the adviser for a long time */
  T=Date.UTC(2026,8,20,1,0);s=stu('Jorge Villanueva','BSCS');a=go(E.submit(s,mk(s,{scope:'local',conf:'Sample Workshop on Embedded Systems',start:'2026-11-03',end:'2026-11-04',venue:'Cebu City',org:'Sample Embedded Group',title:'Sample Title on Firmware Updates',amts:[3500,500,0,5000,3000]})));
  /* Lea: returned by the chair */
  T=Date.UTC(2026,9,1,1,0);s=stu('Lea Mendoza','BSIT');a=go(E.submit(s,mk(s,{scope:'local',conf:'Sample Conference on Data Systems',start:'2026-11-17',end:'2026-11-18',venue:'Davao City',org:'Sample Data Society',title:'Sample Title on Query Planning',amts:[4500,500,0,6000,3000]})));
  hrs(20);E.endorse(U(REY),a,'Endorsed.');hrs(20);E.returnApp(U('chair.it@college.example'),a,'The acceptance letter does not show the conference dates. Please attach a letter that does.');
  /* Noel: with the chair */
  T=Date.UTC(2026,9,5,1,0);s=U('noel.ramos@college.example');a=go(E.submit(s,mk(s,{sid:'12156789',scope:'local',conf:'Sample Symposium on Edge Computing',start:'2026-11-12',end:'2026-11-13',venue:'Manila',org:'Sample Edge Society',title:'Sample Title on Edge Caching',amts:[4000,500,0,6000,3500]})));
  hrs(26);E.endorse(U(REY),a,'Endorsed.');
  /* Sofia: with the associate dean */
  T=Date.UTC(2026,9,8,1,0);s=stu('Sofia Lim','BSIS');a=go(E.submit(s,mk(s,{adv:VIL,conf:'Sample Conference on Cloud Systems',start:'2026-12-01',end:'2026-12-03',venue:'Singapore',org:'Sample Cloud Forum',title:'Sample Title on Serverless Scheduling',amts:[11000,1500,12000,8000,3500]})));
  hrs(20);E.endorse(U(VIL),a,'Endorsed.');hrs(20);E.endorse(U('chair.is@college.example'),a,'Endorsed.');
  T=null;db.syncLog=[];save();
}
C.seed=()=>{seed();C.db=db};
})(window.CCS=window.CCS||{});
