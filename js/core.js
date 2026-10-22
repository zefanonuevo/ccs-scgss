/* CCS SCGSS v3.0 core: data, rules, routing, notifications, Google sync, seed data.
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
/* Grant limit set by the University, by where the event takes place */
const REGIONS=[['ncr','NCR (Metro Manila)',6000],['luzon','Luzon, outside NCR',8000],['icb','Ilocos, Cagayan or Bicol',10000],['vismin','Visayas or Mindanao',12000],['intl','International',15000]];
const CAP={};REGIONS.forEach(r=>CAP[r[0]]=r[2]);
const regionLabel=k=>{const r=REGIONS.filter(x=>x[0]===k)[0];return r?r[1]:k};
const PAR_DAYS=15; /* the post-activity report and reimbursement requirements are due this many days after the event */
const ADVISER_ROLES=['adviser','chair','assoc','dean'];
const EXPENSE_TYPES=['Registration fee','Pre-departure fees','Roundtrip airfare','Accommodation','Per diem'];
const REQ_APP=['Copy of the paper (full text)','Letter of acceptance or notification','Proof of indexing (Scopus, ISI or ASEAN Citation)'];
const REQ_POST=[['accept','Proof of acceptance or invitation'],['paper','Conference paper'],['receipts','Scanned copies of official receipts or invoices'],['billing','Copy of billing statement'],['fx','Peso conversion rate'],['itin','Copy of itinerary receipt and invoice'],['sid','Student ID'],['article','Article write-up'],['poster','Poster']];
const CHAIN=['adviser','chair','assoc','dean'];
const CH={adviser:{label:'Thesis Adviser',verb:'Endorse'},chair:{label:'Department Chair',verb:'Endorse'},assoc:{label:'Associate Dean',verb:'Endorse'},dean:{label:'Dean',verb:'Approve'}};
const ROLE_NAME={student:'Student',adviser:'Thesis Adviser',chair:'Department Chair',assoc:'Associate Dean',dean:'Dean',admin:'Administrative Assistant',sysadmin:'System Administrator'};
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
 {email:'sysadmin@college.example',name:'Jun Bautista',role:'sysadmin',label:'System Administrator, project owner'}
];
Object.assign(C,{PAR_DAYS,ADVISER_ROLES,PROGRAMS,AYS,TERMS,CAP,REGIONS,regionLabel,EXPENSE_TYPES,REQ_APP,REQ_POST,CHAIN,CH,ROLE_NAME,PRIVACY,ACCOUNTS});
const acct=e=>ACCOUNTS.find(a=>a.email===e);
const nameOf=e=>{const a=acct(e);return a?a.name:e};
C.acct=acct;C.nameOf=nameOf;
C.advisers=()=>ACCOUNTS.filter(a=>ADVISER_ROLES.indexOf(a.role)>-1);

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
  const t=s=>String(s).replace(/₱/g,'PHP ').replace(/[^\x20-\x7e]/g,'?').replace(/[\\()]/g,'\\$&');
  const wrap=[];lines.forEach(l=>{l=String(l);if(!l){wrap.push('');return}while(l.length>92){let k=l.lastIndexOf(' ',92);if(k<40)k=92;wrap.push(l.slice(0,k));l=l.slice(k).trim()}wrap.push(l)});
  const per=42,pages=[];for(let i=0;i<Math.max(wrap.length,1)&&pages.length<12;i+=per)pages.push(wrap.slice(i,i+per));
  const o=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids ['+pages.map((p,n)=>(4+2*n)+' 0 R').join(' ')+'] /Count '+pages.length+' >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
  pages.forEach((ls,n)=>{let y=790,c='';if(n===0){c+='BT /F1 16 Tf 56 '+y+' Td ('+t(title).slice(0,80)+') Tj ET\n';y-=30}
    ls.forEach(l=>{c+='BT /F1 11 Tf 56 '+y+' Td ('+t(l)+') Tj ET\n';y-=17});
    o.push('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Contents '+(5+2*n)+' 0 R /Resources << /Font << /F1 3 0 R >> >> >>');
    o.push('<< /Length '+c.length+' >>\nstream\n'+c+'endstream')});
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
const KEY='ccs-scgss-v3';
let db=null;
function save(){try{localStorage.setItem(KEY,JSON.stringify(db))}catch(e){}}
function load(){try{db=JSON.parse(localStorage.getItem(KEY))}catch(e){db=null}if(!db||db.v!==3)seed();else migrate4();C.db=db}
/* 3.1: the Dean sets one amount and one funding source; the event location replaces local/international */
function migrate4(){
  if(db.regions)return;
  const m={local:'luzon',international:'intl'};
  db.apps.forEach(a=>{if(m[a.conf.scope])a.conf.scope=m[a.conf.scope];
    if(a.grant&&a.grant.fund===undefined)a.grant.fund=Array.from(new Set(a.expenses.filter(x=>x.fund).map(x=>x.fund))).join(', ')||'Not recorded';
    if(a.grant)a.expenses.forEach(x=>{x.approved=null;x.fund=''})});
  db.regions=1;save();
}
C.save=save;C.load=load;C.reset=()=>{try{localStorage.removeItem(KEY)}catch(e){}seed();save();C.db=db};
const byId=id=>db.apps.find(a=>a.id===id);
C.byId=byId;

/* ---------- status, steps, helpers ---------- */
const STEP_LABELS=['Submitted','Thesis Adviser','Department Chair','Associate Dean','Dean','Post-activity report','Verified','Filed at FAO'];
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
    case 'completed':return {label:'Filed at FAO'+(a.report&&a.report.rfp?' · RFP '+a.report.rfp:''),cls:'p-ok',by:'None',who:'',group:'completed'};
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
const addDays=(s,n)=>{const d=new Date(s+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)};
const dueDate=a=>addDays(a.conf.end,PAR_DAYS);
const manilaToday=()=>new Date(now()+288e5).toISOString().slice(0,10);
const daysBetween=(from,to)=>Math.round((Date.UTC(+to.slice(0,4),+to.slice(5,7)-1,+to.slice(8,10))-Date.UTC(+from.slice(0,4),+from.slice(5,7)-1,+from.slice(8,10)))/864e5);
const fundsOf=a=>a.grant?a.grant.fund:'';
/* receipts that fit inside the approved grant, for sample data and demos */
const suggestItems=a=>{let left=a.grant.total;return a.expenses.filter(x=>x.amount>0).map(x=>{const amt=Math.min(x.amount,left);left=round2(left-amt);return {type:x.type,amount:amt}}).filter(x=>x.amount>0)};
C.suggestItems=suggestItems;
Object.assign(C,{info,stepState,STEP_LABELS,projected,grantTotal,dueDate,total,fundsOf,manilaToday,daysBetween});

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
 ['Reference',a=>a.ref],['Student email',a=>a.studentEmail],['Academic year',a=>a.ay],['Term',a=>a.term],['Status',a=>info(a).label],['Student',a=>a.studentName],['Student ID',a=>a.sid],['Degree program',a=>a.program],['Year level',a=>a.year],
 ['Thesis Adviser',a=>nameOf(a.route.adviser)],['Department Chair',a=>nameOf(a.route.chair)],['Associate Dean',a=>nameOf(a.route.assoc)],['Dean',a=>nameOf(a.route.dean)],
 ['Conference',a=>a.conf.title],['Event type',a=>a.conf.etype],['Start date',a=>a.conf.start],['End date',a=>a.conf.end],['Venue',a=>a.conf.venue],['Organizer',a=>a.conf.org],['Event location',a=>regionLabel(a.conf.scope)],
 ['Paper title',a=>a.paper.title],['Paper type',a=>a.paper.ptype],['Classification',a=>a.paper.cls],['Indexed in',a=>a.paper.index],['Co-authors (faculty)',a=>a.paper.coF],['Co-authors (student)',a=>a.paper.coS],
 ['Projected total (PHP)',a=>projected(a)],
 ...EXPENSE_TYPES.map((t,i)=>['Projected: '+t,a=>a.expenses[i]?a.expenses[i].amount:'']),
 ['Adviser decision',a=>dec(a,'adviser')],['Chair decision',a=>dec(a,'chair')],['Associate Dean decision',a=>dec(a,'assoc')],['Dean decision',a=>dec(a,'dean')],
 ['Grant approved (PHP)',a=>a.grant?a.grant.total:''],['Grant funding source',a=>fundsOf(a)],['Report due',a=>a.status==='approved'?dueDate(a):''],['Dean e-signature',a=>a.grant?'Signed '+fmtT(a.grant.at):''],
 ['Post-activity status',a=>a.post.status],['Actual claimed (PHP)',a=>a.post.claimedTotal||''],['Receipts (OR or invoice, merchant, amount)',a=>(a.post.items||[]).map(x=>x.or+' · '+x.merchant+' · '+x.amount).join(' | ')],['Reimbursement approved (PHP)',a=>a.post.verify&&a.post.verify.total!=null?a.post.verify.total:''],['Verified by',a=>a.post.verify&&a.post.verify.by||''],['Report no.',a=>a.report?a.report.no:''],['RFP no.',a=>a.report?a.report.rfp:''],['RFP recorded',a=>a.report?fmtT(a.report.at):''],
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
  req(f.venue,0,'f_venue','Enter the venue.');req(f.org,0,'f_org','Enter the organizer.');req(f.etype,0,'f_etype','Select the type of event.');req(f.scope,0,'f_scope','Select where the event takes place.');
  req(f.index,1,'f_index','Select where the paper is indexed.');req(f.title,1,'f_title','Enter the title of the paper.');
  const t=round2(f.exp.reduce((s,x)=>s+(Number(x.amount)||0),0)),cap=CAP[f.scope];
  if(f.exp.some(x=>Number(x.amount)<0))add(2,'ex_0','Amounts cannot be negative.');
  else if(!(t>0))add(2,'ex_0','Enter at least one projected expense amount.');
  else if(cap&&t>cap)add(2,'ex_0','The proposed budget of ₱'+money(t)+' is above the ₱'+money(cap)+' limit for '+regionLabel(f.scope)+'. Reduce the amounts to ₱'+money(cap)+' or less.');
  if(!f.file)add(3,'f_filebtn','Attach the single PDF that holds all required documents.');
  if(!f.attConfirm)add(3,'f_attconfirm','Confirm that every required document is attached.');
  if(!f.privacy)add(4,'f_privacy','Accept the data privacy notice to submit.');
  if(!f.brand)add(4,'f_brand','Tick this box to confirm the branding requirements.');
  return e;
}
C.validateForm=validateForm;
/* Who signs when the Thesis Adviser also holds a signing role:
   - a person never endorses the same application twice: a later step held by someone who already endorsed is skipped (see advance).
     So if the adviser is the Department Chair, the Associate Dean endorses next; if the adviser is the Associate Dean, the file goes straight to the Dean.
   - if the Dean is the adviser, the Dean cannot approve the grant for their own advisee, so the Associate Dean approves it in the Dean's place. */
function routeFor(prog,adv){
  const s=db.settings,a=acct(adv);
  if(!a||ADVISER_ROLES.indexOf(a.role)<0)return {err:'Choose a valid Thesis Adviser.'};
  if(!s.chairs[prog])return {err:'No Department Chair is set for '+prog+'. Ask the System Administrator.'};
  if(!s.assoc||!s.dean)return {err:'The Associate Dean or Dean is not set. Ask the System Administrator.'};
  return {adviser:adv,chair:s.chairs[prog],assoc:s.assoc,dean:adv===s.dean?s.assoc:s.dean};
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
  if(actor.email!==a.route[s]){
    if(CHAIN.some((k,i)=>i>a.stage&&a.route[k]===actor.email))return 'It is the '+CH[s].label+"'s turn, not yours. Approvals follow the sequence.";
    return 'This application is assigned to '+nameOf(a.route[s])+' at the '+CH[s].label+' step, not to you.';
  }
  return null;
}
function deny(a,actor,msg){hist(a,actor,'Denied (403)',msg,'bad');sync(a,'Denied action');return ERR(msg)}
function fileExt(n){const m=/\.[A-Za-z0-9]+$/.exec(n||'');return m?m[0].toLowerCase():'.pdf'}
function lineReq(a,s){notify(a.route[s],a,'Action required: '+CH[s].verb.toLowerCase()+' grant application',a.studentName+' ('+a.program+') applied for a conference grant: '+a.conf.title+'. It now needs your decision as '+CH[s].label+': '+CH[s].verb+', Return with remarks, or Reject.','req:'+a.id+':'+a.stage+':'+a.cycle)}
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
  hist(a,actor,'Submitted','Reference '+ref+' assigned. Requirements PDF saved as '+fm.name+'. Data privacy notice accepted. Routed to the Thesis Adviser, '+nameOf(route.adviser)+'.'+(route.dean!==db.settings.dean?' The Dean is the Thesis Adviser, so the Associate Dean, '+nameOf(route.dean)+', will approve the grant in the Dean\'s place.':''));
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
/* o = {signature, confirm, dry, note, amount, fund}. The Dean sets ONE approved amount and ONE funding source for the whole grant;
   the Administrative Assistant breaks it down by receipt at reimbursement.
   dry runs every check and returns the total without recording anything, so the screen can show a confirmation first. */
E.approveGrant=function(actor,a,o){
  const err=turnErr(a,actor);if(err)return deny(a,actor,err);
  if(CHAIN[a.stage]!=='dean')return ERR('Only the Dean approves the grant.');
  if(!o.signature||String(o.signature).indexOf('data:image')!==0)return ERR('Affix your digital signature before approving.');
  const amt=Number(o.amount),fund=String(o.fund||'').trim(),cap=CAP[a.conf.scope],pt=projected(a);
  if(o.amount===''||o.amount==null||!(amt>0))return ERR('Enter the approved grant amount. Use Reject to decline the application.');
  if(!fund)return ERR('Enter the funding source for the grant.');
  if(fund.length>80)return ERR('The funding source is too long.');
  if(amt>cap)return ERR('The approved grant of ₱'+money(amt)+' is above the ₱'+money(cap)+' limit for '+regionLabel(a.conf.scope)+'.');
  if(amt>pt)return ERR('The approved grant of ₱'+money(amt)+' is above the ₱'+money(pt)+' the student projected.');
  const tot=round2(amt);
  if(o.dry)return {ok:true,dry:true,total:tot,fund};
  if(!o.confirm)return ERR('Press Confirm approval to record the grant and your signature.');
  a.grant={total:tot,fund,by:actor.name,byEmail:actor.email,at:now(),signature:o.signature};
  a.decisions.dean={d:'approved',at:now(),by:actor.name,email:actor.email};a.status='approved';
  hist(a,actor,'Approved grant','Approved ₱'+money(tot)+' · funding source: '+fund+' · e-signed.'+(o.note?' "'+o.note+'"':''));
  notify(a.studentEmail,a,'Your grant is approved','Good news: the Dean approved your conference grant of ₱'+money(tot)+' (funding source: '+fund+'). After the conference, submit the post-activity report and reimbursement requirements (one PDF) within '+PAR_DAYS+' days after '+fmtD(a.conf.end)+' (by '+fmtD(dueDate(a))+'). You will get reminders by email and in-app.','appr:'+a.id);
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
  return (fileIds||[]).map(id=>{const m=db.files[id];if(!m)return null;a.clar++;m.name=a.ref+'-C'+a.clar+fileExt(m.orig);m.appId=a.id;m.kind='Clarification';m.folder='Clarifications/'+a.key;m.by=actor.name;m.at=now();return id}).filter(Boolean);
}
/* everyone who may be asked a question about an application: the student, each signatory and the Administrative Assistants */
const participants=a=>Array.from(new Set([a.studentEmail].concat(Object.keys(a.route).map(k=>a.route[k])).concat(adminsOf())));
C.participants=participants;
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
C.counterparts=counterparts;
/* to (optional): who should receive the message. The thread itself stays visible to everyone on the application. */
E.comment=function(actor,a,text,fileIds,to,topic){
  const isRoute=Object.keys(a.route).some(k=>a.route[k]===actor.email);
  const ok=actor.email===a.studentEmail||isRoute||actor.role==='admin';
  if(!ok)return deny(a,actor,'You are not part of this application, so you cannot comment on it.');
  text=String(text||'').trim();
  if(!text&&!(fileIds&&fileIds.length))return ERR('Write a message or attach a file.');
  let rcpt=to&&to.length?to.filter(e=>e!==actor.email&&participants(a).indexOf(e)>-1):counterparts(a,actor).filter(e=>e!==actor.email);
  if(!rcpt.length)return ERR('Choose who should receive this message.');
  const ids=saveClar(a,actor,fileIds);
  a.comments.push({id:'c'+(++db.seq),at:now(),by:actor.name,role:actor.role,email:actor.email,text,files:ids,to:rcpt,topic:topic||null});
  hist(a,actor,topic?'Reimbursement question':'Comment','To '+rcpt.map(nameOf).join(', ')+(topic?' ['+topic.kind+(topic.item?' · '+topic.item:'')+']':'')+': '+(text.length>150?text.slice(0,150)+'...':text)+(ids.length?' · '+ids.length+' file(s): '+ids.map(i=>db.files[i].name).join(', '):''));
  notify(rcpt,a,topic?'Reimbursement question: '+topic.kind:'New message from '+actor.name,actor.name+' ('+ROLE_NAME[actor.role]+') wrote: "'+(text||'(file attached)')+'"','cm:'+a.id+':'+db.seq);
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
  if(reply||ids.length)a.comments.push({id:'c'+(++db.seq),at:now(),by:actor.name,role:'student',email:actor.email,text:reply,files:ids,to:[a.route[a.returned.role]]});
  const s=a.returned.role;a.status='pending';a.stage=a.returned.stage;a.returned=null;a.cycle++;
  hist(a,actor,'Resubmitted',(changed.length?'Edited: '+changed.join(', ')+'. ':'')+(reply?'Reply: "'+reply+'"':'')+(ids.length?' '+ids.length+' file(s) attached.':'')+' Back to the '+CH[s].label+'; earlier decisions kept.');
  lineReq(a,s);
  sync(a,'Resubmitted');return OK;
};
/* d = {file, docs, missingNote, items:[{type, or, merchant, amount}]}. Amounts are in pesos. */
E.submitPost=function(actor,a,d){
  if(actor.email!==a.studentEmail)return deny(a,actor,'Only the applicant can submit the post-activity report.');
  if(a.status!=='approved'||a.post.status==='submitted')return ERR('A post-activity report can only be submitted for an approved grant that is not already under review.');
  if(!d.file)return ERR('Attach the single consolidated PDF.');
  const items=[];
  for(const it of (d.items||[])){
    const amt=it.amount===''||it.amount==null?0:Number(it.amount),or=String(it.or||'').trim(),mer=String(it.merchant||'').trim();
    if(!amt&&!or&&!mer)continue;
    if(!(amt>=0))return ERR('Amounts cannot be negative.');
    if(EXPENSE_TYPES.indexOf(it.type)<0)return ERR('Choose the expense type for every receipt.');
    if(!(amt>0))return ERR('Enter the amount for receipt '+(or||mer)+'.');
    if(!or)return ERR('Enter the OR or invoice number for the '+it.type+' receipt of ₱'+money(amt)+'.');
    if(!mer)return ERR('Enter the merchant name for '+or+'.');
    items.push({type:it.type,or,merchant:mer,amount:round2(amt)});
  }
  const ct=total(items,'amount');if(!(ct>0))return ERR('Enter at least one expense taken from your receipts or invoices.');
  if(ct>a.grant.total)return ERR('The total of ₱'+money(ct)+' is above the approved grant of ₱'+money(a.grant.total)+', so it cannot be accepted. Reduce the amounts to ₱'+money(a.grant.total)+' or less.');
  const missing=REQ_POST.filter(r=>!d.docs[r[0]]);
  if(missing.length&&!String(d.missingNote||'').trim())return ERR('Tick every document you included, or explain what is missing: '+missing.map(m=>m[1]).join(', ')+'.');
  const fm=db.files[d.file.id];if(!fm)return ERR('The attached file could not be found. Attach it again.');
  const n=a.post.cycle+1;
  fm.name=a.ref+'-PAR'+(n>1?'-v'+n:'')+'.pdf';fm.appId=a.id;fm.kind='Post-activity report'+(n>1?' (v'+n+')':'');fm.folder='Post-activity/'+a.key;fm.by=actor.name;fm.at=now();fm.version=n;
  const prev=a.post.fileId&&db.files[a.post.fileId];if(prev)prev.superseded=true; /* a resubmission is saved as a new version; the original stays on record */
  a.post=Object.assign({},a.post,{status:'submitted',cycle:n,fileId:fm.id,items:items.map((x,i)=>Object.assign({id:'i'+(i+1)},x)),claimedTotal:ct,docs:d.docs,missingNote:d.missingNote||'',submittedAt:now(),verify:null});
  hist(a,actor,n>1?'Post-activity report resubmitted':'Post-activity report submitted','Total for reimbursement ₱'+money(ct)+' across '+items.length+' receipt(s). PDF saved as '+fm.name+'.');
  notify(adminsOf(),a,'Action required: verify post-activity report',a.studentName+' submitted the post-activity report for '+a.conf.title+'. Tick the documents included, check each receipt, set the approved amount per item, and verify.','par:'+a.id+':'+n);
  notify(a.studentEmail,a,'Post-activity report received','Your report was received (saved as '+fm.name+'). The Administrative Assistant will verify it.','parc:'+a.id+':'+n);
  sync(a,'Post-activity report submitted');return OK;
};
/* d = {checks, remarks, returns, overall, items:[{approved, fund, or, merchant, why}]}. mode: save | return | verify */
E.postReview=function(actor,a,d,mode){
  if(actor.role!=='admin')return deny(a,actor,'Only the Administrative Assistant verifies post-activity documents and sets reimbursement amounts.');
  if(a.status!=='approved'||a.post.status!=='submitted')return ERR('There is no submitted report waiting for verification.');
  const p=a.post,rows=d.items||[];
  const v={checks:d.checks||{},remarks:d.remarks||{},returns:d.returns||{},overall:d.overall||'',by:actor.name,at:now(),
    items:p.items.map((x,i)=>{const r=rows[i]||{};return {id:x.id,type:x.type,claimed:x.amount,
      approved:r.approved===''||r.approved==null?null:Number(r.approved),or:r.or!=null?String(r.or).trim():x.or,merchant:r.merchant!=null?String(r.merchant).trim():x.merchant,fund:String(r.fund||'').trim(),why:String(r.why||'').trim()}})};
  const flagged=REQ_POST.filter(r=>v.returns[r[0]]);
  if(mode==='save'){p.verify=Object.assign(v,{total:null,draft:true});hist(a,actor,'Verification saved','Progress saved; not yet verified.');sync(a,'Verification saved');return OK}
  if(mode==='return'){
    if(!flagged.length&&!String(v.overall).trim()&&!Object.keys(v.remarks).some(k=>String(v.remarks[k]).trim()))return ERR('Flag the requirements to return, or add remarks that tell the student what to correct or add.');
    p.status='returned';p.verify=Object.assign(v,{total:null,draft:true});
    const list=flagged.map(r=>r[1]).join(', ');
    hist(a,actor,'Post-activity report returned',(list?'Requirements to return: '+list+'. ':'')+(v.overall||'See remarks per document.'));
    notify(a.studentEmail,a,'Post-activity requirements returned','The Administrative Assistant returned your report'+(list?' and asks you to clarify or resubmit: '+list+'.':'.')+' "'+(v.overall||'see the remarks per document')+'" Upload a corrected PDF: it is saved as a new version and the original stays on record. Reply by '+fmtD(dueDate(a))+' if you can.','parret:'+a.id+':'+p.cycle);
    sync(a,'Post-activity report returned');return OK}
  if(flagged.length)return ERR('You flagged '+flagged.map(r=>r[1]).join(', ')+' to return. Use Return to student, or clear the flags.');
  const bad=REQ_POST.filter(r=>!v.checks[r[0]]&&!String(v.remarks[r[0]]||'').trim());
  if(bad.length)return ERR('Tick '+bad.map(b=>b[1]).join(', ')+', or add a remark explaining why it is not included.');
  for(let i=0;i<v.items.length;i++){const l=v.items[i],nm=l.type+' ('+l.or+')';
    if(l.approved==null||!(l.approved>=0))return ERR('Enter the approved amount for '+nm+' (0 if not reimbursed).');
    if(l.approved>0&&!l.fund)return ERR('Enter the funding source for '+nm+'.');
    if(l.approved>0&&(!l.or||!l.merchant))return ERR('Enter the OR or invoice number and the merchant name for '+l.type+'.');
    if(l.approved!==l.claimed&&!l.why)return ERR('Add a remark for '+nm+': the approved amount differs from the amount the student listed.')}
  const tot=total(v.items,'approved');
  if(!(tot>0))return ERR('The approved reimbursement is zero. Return the report to the student with remarks instead.');
  if(tot>a.grant.total)return ERR('The approved reimbursement of ₱'+money(tot)+' is above the grant of ₱'+money(a.grant.total)+' approved by the Dean.');
  v.total=tot;v.draft=false;p.verify=v;p.status='verified';a.status='verified';
  hist(a,actor,'Post-activity documents verified','Approved reimbursement ₱'+money(tot)+' of ₱'+money(p.claimedTotal)+' listed by the student.'+(v.overall?' "'+v.overall+'"':''));
  notify(a.studentEmail,a,'Post-activity report verified','Your documents were verified. Approved reimbursement: ₱'+money(tot)+'. The Administrative Assistant will file the reimbursement report at the FAO next.','ver:'+a.id+':'+p.cycle);
  sync(a,'Post-activity documents verified');return OK;
};
/* o = {rfp}. Marks the report as filed at the FAO and records the RFP number. */
E.complete=function(actor,a,o){
  if(actor.role!=='admin')return deny(a,actor,'Only the Administrative Assistant files the reimbursement report.');
  if(a.status!=='verified')return ERR('Verify the post-activity documents first.');
  const rfp=String(o&&o.rfp||'').trim();
  if(!rfp)return ERR('Enter the RFP number to mark the report as filed at the FAO.');
  if(rfp.length>40)return ERR('The RFP number is too long.');
  a.report={no:'RR-'+a.ref,at:now(),by:actor.name,rfp};a.status='completed';
  hist(a,actor,'Filed at FAO','Reimbursement report '+a.report.no+' marked and filed at the FAO. RFP '+rfp+'.');
  notify(a.studentEmail,a,'Your reimbursement request was processed','Your reimbursement request ('+a.report.no+', ₱'+money(a.post.verify.total)+') was processed at the FAO under RFP '+rfp+'. You may check with the FAO after 5 to 10 working days for an update.','done:'+a.id);
  sync(a,'Filed at FAO');return OK;
};
E.remind=function(actor,a,auto){
  if(['admin','sysadmin'].indexOf(actor.role)<0)return deny(a,actor,'Only office staff can send reminders.');
  const day=Math.floor(now()/864e5);let to=null,what='';
  if(a.status==='pending'){const s=CHAIN[a.stage];to=a.route[s];what='is waiting for your decision'}
  else if(a.status==='returned'){to=a.studentEmail;what='was returned to you and is waiting for your reply'}
  else if(a.status==='approved'&&(a.post.status==='submitted')){to=adminsOf();what='has a post-activity report waiting for verification'}
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
    notify(a.studentEmail,a,subject,(returned?'Your returned post-activity requirements ':'Your post-activity report and reimbursement requirements for '+a.conf.title+' ')+when+'. Submit one consolidated PDF with your actual expenses on or before '+PAR_DAYS+' days after the event.',key);
    a.history.push({at:now(),by:'System',role:'system',action:'Automatic reminder',note:subject+' sent to '+a.studentName+' by email and in-app.',cls:''});
    n++;
  });
  if(n)save();
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
  const MERCH={'Registration fee':'Sample Conference Secretariat','Pre-departure fees':'Sample Visa Center','Roundtrip airfare':'Sample Airlines','Accommodation':'Sample Hotel','Per diem':'Sample Meals Co.'};
  db={v:3,seq:0,keys:{},counters:{},apps:[],notifs:[],outbox:[],files:{},sigs:{},syncLog:[],drafts:{},
    settings:{assoc:'assoc.dean@college.example',dean:'dean@college.example',chairs:{BSCS:'chair.cs@college.example',BSIT:'chair.it@college.example',BSIS:'chair.is@college.example'},gas:{url:'',token:''}}};
  const U=e=>acct(e),REY='adviser.reyes@college.example',VIL='adviser.villanueva@college.example';
  const stu=(n,p)=>({email:n.toLowerCase().replace(/ /g,'.')+'@college.example',name:n,role:'student',program:p});
  const hrs=h=>{T+=h*36e5};
  const mk=(s,o)=>{const fm=registerFile({orig:'requirements.pdf',size:210000,by:s.name});
    return Object.assign({ay:'2627',term:'Term1',sid:'122'+(1000+db.seq*7),prog:s.program,year:'4',adv:REY,etype:'Conference',scope:'intl',cls:'Paper presenter',ptype:'Full paper',index:'Scopus',cof:'',cos:'',attConfirm:true,privacy:true,brand:true,file:{id:fm.id,orig:fm.orig,size:fm.size},
      exp:EXPENSE_TYPES.map((t,i)=>({type:t,amount:o.amts[i],remarks:''}))},o)};
  const dean=U('dean@college.example'),sig=sampleSig();
  const approve=(a,fund)=>E.approveGrant(dean,a,{signature:sig,confirm:true,amount:projected(a),fund,note:'Approved.'});
  const itemsOf=a=>suggestItems(a).map((x,i)=>({type:x.type,or:'OR-'+(4100+db.seq+i),merchant:MERCH[x.type],amount:x.amount}));
  const par=(a,s,docsAll)=>{const fm=registerFile({orig:'post-activity.pdf',size:480000,by:s.name});
    return E.submitPost(s,a,{file:{id:fm.id},items:itemsOf(a),docs:docsAll,missingNote:''})};
  const allDocs={};REQ_POST.forEach(r=>allDocs[r[0]]=true);
  const adm=U('admin.assistant@college.example');
  const verify=a=>{const items=a.post.items.map(it=>({approved:it.amount,fund:a.grant.fund,why:''}));return E.postReview(adm,a,{checks:allDocs,remarks:{},items,overall:'All documents complete.'},'verify')};
  const go=(r)=>r.app||r;
  let s,a;
  /* completed, AY 2526 */
  T=Date.UTC(2026,3,6,1,0);s=stu('Ivan Garcia','BSCS');a=go(E.submit(s,mk(s,{ay:'2526',term:'Term3',conf:'Sample Meeting on Information Retrieval',start:'2026-05-12',end:'2026-05-14',venue:'Singapore',org:'Sample Retrieval Society',title:'Sample Title on Retrieval Models',amts:[5000,500,4500,3000,2000]})));
  hrs(20);E.endorse(U(REY),a,'Endorsed.');hrs(20);E.endorse(U('chair.cs@college.example'),a,'Endorsed.');hrs(20);E.endorse(U('assoc.dean@college.example'),a,'Endorsed.');hrs(20);approve(a,FUND[1]);
  T=Date.UTC(2026,4,24,1,0);par(a,s,allDocs);hrs(48);verify(a);hrs(24);E.complete(adm,a,{rfp:'RFP-2026-0412'});
  /* rejected, AY 2526 */
  T=Date.UTC(2026,4,2,1,0);s=stu('Tina Lopez','BSIT');a=go(E.submit(s,mk(s,{ay:'2526',term:'Term3',adv:VIL,scope:'ncr',conf:'Sample Meeting on Robotics',start:'2026-06-10',end:'2026-06-11',venue:'Quezon City',org:'Sample Robotics Group',title:'Sample Title on Robot Planning',index:'ASEAN Citation',amts:[1000,300,0,3000,1500]})));
  hrs(20);E.endorse(U(VIL),a,'Endorsed.');hrs(20);E.endorse(U('chair.it@college.example'),a,'Endorsed.');hrs(20);E.reject(U('assoc.dean@college.example'),a,'The proceedings are not in a Scopus, ISI or ASEAN Citation listed index.');
  /* Maria: approved, report due */
  T=Date.UTC(2026,8,2,1,0);s=U('maria.santos@college.example');a=go(E.submit(s,mk(s,{sid:'12145678',conf:'International Conference on Sample Computing (ICSC 2026)',start:'2026-10-05',end:'2026-10-09',venue:'Kyoto, Japan',org:'Sample Computing Society',title:'Sample Title on Edge Inference',amts:[5500,600,4400,3000,1500],cos:'Noel Ramos'})));
  hrs(22);E.endorse(U(REY),a,'Endorsed.');hrs(22);E.endorse(U('chair.cs@college.example'),a,'Strong paper. Endorsed.');hrs(22);E.endorse(U('assoc.dean@college.example'),a,'Endorsed.');hrs(22);
  E.approveGrant(dean,a,{signature:sig,confirm:true,amount:13500,fund:FUND[0],note:'Approved. Accommodation is partly funded.'});
  /* Ramon: post-activity report waiting for verification */
  T=Date.UTC(2026,8,5,1,0);s=stu('Ramon Dizon','BSIS');a=go(E.submit(s,mk(s,{adv:VIL,scope:'ncr',conf:'Sample Forum on Networks',start:'2026-09-28',end:'2026-09-30',venue:'Manila',org:'Sample Networks Forum',title:'Sample Title on Network Telemetry',index:'ISI',amts:[1500,300,0,3000,1000]})));
  hrs(20);E.endorse(U(VIL),a,'Endorsed.');hrs(20);E.endorse(U('chair.is@college.example'),a,'Endorsed.');hrs(20);E.endorse(U('assoc.dean@college.example'),a,'Endorsed.');hrs(20);approve(a,FUND[2]);
  T=Date.UTC(2026,9,9,2,0);par(a,s,allDocs);
  /* Jorge: waiting for the adviser for a long time */
  T=Date.UTC(2026,8,20,1,0);s=stu('Jorge Villanueva','BSCS');a=go(E.submit(s,mk(s,{scope:'vismin',conf:'Sample Workshop on Embedded Systems',start:'2026-11-03',end:'2026-11-04',venue:'Cebu City',org:'Sample Embedded Group',title:'Sample Title on Firmware Updates',amts:[3500,500,0,5000,3000]})));
  /* Lea: returned by the chair */
  T=Date.UTC(2026,9,1,1,0);s=stu('Lea Mendoza','BSIT');a=go(E.submit(s,mk(s,{scope:'vismin',conf:'Sample Conference on Data Systems',start:'2026-11-17',end:'2026-11-18',venue:'Davao City',org:'Sample Data Society',title:'Sample Title on Query Planning',amts:[3500,500,0,5000,3000]})));
  hrs(20);E.endorse(U(REY),a,'Endorsed.');hrs(20);E.returnApp(U('chair.it@college.example'),a,'The acceptance letter does not show the conference dates. Please attach a letter that does.');
  /* Noel: with the chair */
  T=Date.UTC(2026,9,5,1,0);s=U('noel.ramos@college.example');a=go(E.submit(s,mk(s,{sid:'12156789',scope:'ncr',conf:'Sample Symposium on Edge Computing',start:'2026-11-12',end:'2026-11-13',venue:'Manila',org:'Sample Edge Society',title:'Sample Title on Edge Caching',amts:[1500,300,0,3000,1000]})));
  hrs(26);E.endorse(U(REY),a,'Endorsed.');
  /* Sofia: with the associate dean */
  T=Date.UTC(2026,9,8,1,0);s=stu('Sofia Lim','BSIS');a=go(E.submit(s,mk(s,{adv:VIL,conf:'Sample Conference on Cloud Systems',start:'2026-12-01',end:'2026-12-03',venue:'Singapore',org:'Sample Cloud Forum',title:'Sample Title on Serverless Scheduling',amts:[5000,600,4900,3000,1500]})));
  hrs(20);E.endorse(U(VIL),a,'Endorsed.');hrs(20);E.endorse(U('chair.is@college.example'),a,'Endorsed.');
  /* Paolo: the Thesis Adviser is the Department Chair, so the Chair step is skipped and the file goes to the Associate Dean */
  T=Date.UTC(2026,9,12,1,0);s=stu('Paolo Cruz','BSCS');a=go(E.submit(s,mk(s,{adv:'chair.cs@college.example',scope:'vismin',conf:'Sample Workshop on Program Analysis',start:'2026-11-24',end:'2026-11-25',venue:'Iloilo City',org:'Sample Analysis Group',title:'Sample Title on Static Checking',amts:[3500,500,0,5000,3000]})));
  hrs(20);E.endorse(U('chair.cs@college.example'),a,'Endorsed as Thesis Adviser.');
  T=null;db.syncLog=[];save();
}
C.seed=()=>{seed();C.db=db};
})(window.CCS=window.CCS||{});
