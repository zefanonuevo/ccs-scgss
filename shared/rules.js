/* CCS SCGSS shared rules: constants, status helpers and form validation.
   Loaded by the server (require) and by the browser (script tag, attaches to window.CCS).
   Contains no storage, no DOM and no network code. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else{root.CCS=root.CCS||{};Object.assign(root.CCS,api)}})(typeof self!=='undefined'?self:this,function(){
"use strict";
const C={};
const now=()=>Date.now();
const money=n=>Number(n||0).toLocaleString('en-PH');
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pad3=n=>String(n).padStart(3,'0');
const MONTHS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const fmtT=ts=>new Date(ts).toLocaleString('sv-SE',{timeZone:'Asia/Manila',hour12:false}).slice(0,16);
const fmtD=s=>{if(!s)return '';const p=s.split('-');return (+p[2])+' '+MONTHS[p[1]-1]+' '+p[0]};
const fmtSize=n=>n>1048576?(n/1048576).toFixed(1)+' MB':Math.max(1,Math.round(n/1024))+' KB';
const addWorkdays=(s,n)=>{const d=new Date(s+'T00:00:00Z');while(n>0){d.setUTCDate(d.getUTCDate()+1);const w=d.getUTCDay();if(w!==0&&w!==6)n--}return d.toISOString().slice(0,10)};
const round2=n=>Math.round(n*100)/100;
let DIR=()=>null; /* the page or the server supplies the people directory */
C.setDirectory=f=>{DIR=f};
const acct=e=>DIR(e);
const nameOf=e=>{const a=acct(e);return a?a.name:e};
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
Object.assign(C,{PAR_DAYS,ADVISER_ROLES,PROGRAMS,AYS,TERMS,CAP,REGIONS,regionLabel,EXPENSE_TYPES,REQ_APP,REQ_POST,CHAIN,CH,ROLE_NAME,PRIVACY,acct,nameOf,now});
C.u={money,esc,pad3,fmtT,fmtD,fmtSize,addWorkdays,round2,now};
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
Object.assign(C,{info,stepState,STEP_LABELS,projected,grantTotal,dueDate,addDays,total,fundsOf,manilaToday,daysBetween});
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
/* the columns written to the Google Sheet, one row per application. getFiles() returns the files table. */
C.makeSheetCols=function(getFiles){
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
 ['Files',a=>Object.values(getFiles()).filter(f=>f.appId===a.id&&f.name).map(f=>f.name).join(' | ')],['Privacy consent',a=>a.privacy?fmtT(a.privacy.at):''],['Submitted',a=>fmtT(a.created)],['Last updated',a=>fmtT(a.updated)]
];
function dec(a,r){const d=a.decisions[r];return d?d.d+' '+fmtT(d.at):''}
  return SHEET_COLS;
};
return C;
});
