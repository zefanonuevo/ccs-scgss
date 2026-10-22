/* CCS SCGSS v3.0 screens, part 1: sign-in, navigation, dashboards, application page, application form, post-activity report. */
(function(C){
"use strict";
const {$,$$,money,esc,fmtT,fmtD,fmtSize,pad3,round2}=C.u;
const E=C.E,D=()=>C.db,CHAIN=C.CHAIN,CH=C.CH,ROLE_NAME=C.ROLE_NAME;
const R=C.R={},ACT=C.ACT={};
const state=C.state={user:null,cur:'dash',curApp:null,back:'dash'};
const u=()=>state.user;
const ayLabel=v=>'AY 20'+v.slice(0,2)+'–20'+v.slice(2);
const opt=(v,l,sel)=>'<option value="'+esc(v)+'"'+(sel?' selected':'')+'>'+esc(l)+'</option>';
const ini=n=>{const p=n.replace(/^(Dr|Prof|Ms|Mr)\.\s+/,'').split(' ');return (p[0][0]+(p.length>1?p[p.length-1][0]:'')).toUpperCase()};
const pill=a=>{const i=C.info(a);return '<span class="pill '+i.cls+'">'+esc(i.label)+'</span>'};
const stepsHTML=a=>{const st=C.stepState(a);return '<ol class="steps">'+C.STEP_LABELS.map((l,i)=>'<li class="'+st[i]+'">'+l+'</li>').join('')+'</ol>'};
const isStaff=()=>['admin','sysadmin'].indexOf(u().role)>-1;
const msgs=C.toast=m=>toast(m);

/* ---------- tabs and roles ---------- */
const TABS=[['dash','Dashboard'],['form','Application form'],['par','Post-activity report'],['track','Tracking'],['verify','Verification'],['rpt','Reimbursement report'],['records','Sheet & Drive'],['notif','Notifications'],['guide','Guidelines'],['flow','Workflow'],['sim','Simulation'],['scen','Scenarios'],['settings','Settings'],['overview','Review & suggestions'],['ver','Versions']];
const ALL=TABS.map(t=>t[0]);
const APPR=['dash','notif','guide','flow','overview','ver'];
const ROLE_TABS={student:['dash','form','par','notif','guide','flow','overview','ver'],adviser:APPR,chair:APPR,assoc:APPR,dean:APPR,
  admin:['dash','track','verify','rpt','records','notif','guide','flow','sim','scen','overview','ver'],
  sysadmin:ALL};
const views=$$('.view'),tabsEl=$('#tabs');
const myTabs=()=>u()?TABS.filter(t=>ROLE_TABS[u().role].indexOf(t[0])>-1):[];
const allowed=id=>myTabs().some(t=>t[0]===id);
const unread=()=>D().notifs.filter(n=>n.to===u().email&&!n.read).length;
const tabLabel=t=>t[0]==='notif'&&unread()?'Notifications ('+unread()+')':t[1];
function buildTabs(){tabsEl.innerHTML='';myTabs().forEach(t=>{const b=document.createElement('button');b.type='button';b.setAttribute('role','tab');b.dataset.v=t[0];b.textContent=tabLabel(t);tabsEl.appendChild(b)})}
function tabFade(){tabsEl.classList.toggle('more',tabsEl.scrollWidth-tabsEl.clientWidth-tabsEl.scrollLeft>4)}
tabsEl.addEventListener('scroll',tabFade,{passive:true});window.addEventListener('resize',tabFade);
function show(id,push,appId){
  if(!u())return;
  if(id==='app'){if(D().apps.some(a=>a.id===appId))state.curApp=appId;else id='dash'}
  else if(!allowed(id)){if(push)toast('That page is not part of your role. Sign in as another sample account to see it.');id='dash'}
  if(id==='app'&&state.cur!=='app')state.back=state.cur;
  state.cur=id;
  $('#login').hidden=true;
  views.forEach(v=>v.hidden=v.id!=='v-'+id);
  const tabId=id==='app'?state.back:id;
  $$('#tabs button').forEach(b=>{b.setAttribute('aria-selected',String(b.dataset.v===tabId));if(b.dataset.v==='notif')b.textContent=tabLabel(['notif','Notifications'])});
  const sel=$('#tabs button[aria-selected="true"]');if(sel){const l=sel.offsetLeft,r=l+sel.offsetWidth;if(l<tabsEl.scrollLeft)tabsEl.scrollLeft=Math.max(0,l-8);else if(r>tabsEl.scrollLeft+tabsEl.clientWidth)tabsEl.scrollLeft=r-tabsEl.clientWidth+8}
  tabFade();
  if(R[id])R[id]();
  try{if(push)history.replaceState(null,'','#'+id)}catch(e){}
  window.scrollTo(0,0);
}
C.go=show;
C.refresh=()=>{const y=window.scrollY;if(R[state.cur])R[state.cur]();window.scrollTo(0,y);$$('#tabs button').forEach(b=>{if(b.dataset.v==='notif')b.textContent=tabLabel(['notif','Notifications'])})};
let toastEl=null,toastT=0,toastO=0;
function toast(m){
  if(!toastEl){toastEl=document.createElement('div');toastEl.className='toast';toastEl.setAttribute('role','status');document.body.appendChild(toastEl)}
  toastEl.textContent=m;toastEl.classList.remove('out');toastEl.hidden=false;toastEl.style.animation='none';void toastEl.offsetWidth;toastEl.style.animation='';
  clearTimeout(toastT);clearTimeout(toastO);
  toastT=setTimeout(()=>{toastEl.classList.add('out');toastO=setTimeout(()=>{toastEl.hidden=true;toastEl.classList.remove('out')},180)},3400);
}
document.addEventListener('click',e=>{
  const t=e.target.closest('[data-act],[data-go],[data-open],[data-toast],#tabs button,[data-fill],[data-logout],[data-showver],#ver-back');if(!t)return;
  if(t.dataset.act&&ACT[t.dataset.act]){e.preventDefault();ACT[t.dataset.act](t,e)}
  else if(t.dataset.open){e.preventDefault();show('app',true,t.dataset.open)}
  else if(t.dataset.go){e.preventDefault();show(t.dataset.go,true)}
  else if(t.dataset.toast){e.preventDefault();toast(t.dataset.toast)}
  else if(t.dataset.v){show(t.dataset.v,true)}
  else if(t.dataset.fill){$('#l-email').value=t.dataset.fill;$('#l-pass').value=PASSWORD;$('#l-err').textContent='';$('#l-email').removeAttribute('aria-invalid');$('#loginform button[type=submit]').focus()}
  else if(t.dataset.logout!==undefined)logout();
  else if(t.dataset.showver!==undefined){$('#login').hidden=true;views.forEach(v=>v.hidden=v.id!=='v-ver');$('#ver-back').hidden=false;window.scrollTo(0,0)}
  else if(t.id==='ver-back'){$('#ver-back').hidden=true;$('#v-ver').hidden=true;$('#login').hidden=false;window.scrollTo(0,0)}
});
ACT.back=()=>show(state.back||'dash');

/* ---------- sign in ---------- */
const PASSWORD='demo';
function buildLogin(){
  const grp=(title,list)=>'<h3>'+title+'</h3>'+list.map(a=>'<button type="button" class="acc" data-fill="'+esc(a.email)+'"><span class="av">'+ini(a.name)+'</span><b>'+esc(a.name)+'</b><small>'+esc(a.label)+'</small></button>').join('');
  const by=(...r)=>C.ACCOUNTS.filter(a=>r.indexOf(a.role)>-1);
  $('#login').innerHTML='<div class="loginwrap"><section class="logincard" aria-labelledby="lg-h"><h2 id="lg-h">Sign in</h2>'+
   '<p class="muted">Sign in with your college account to apply for a grant, endorse one, or manage reimbursements.</p>'+
   '<form id="loginform" novalidate><div class="field"><label for="l-email">Email</label><input id="l-email" type="email" value="'+esc(C.ACCOUNTS[0].email)+'" autocomplete="username"></div>'+
   '<div class="field" style="margin-top:10px"><label for="l-pass">Password</label><input id="l-pass" type="password" value="'+PASSWORD+'" autocomplete="current-password"></div>'+
   '<p class="err" id="l-err" role="alert" style="margin-top:8px"></p><button class="btn" type="submit" style="margin-top:12px;width:100%">Sign in</button></form>'+
   '<p class="note">Prototype. It accepts the sample accounts on the right with the password <b class="mono">'+PASSWORD+'</b>. The real build signs in with Google, limited to the DLSU domain, and takes roles from its own table.</p>'+
   '<p class="note">Data entered here is saved in this browser only, so you can sign in as each role in turn and watch one application move.</p>'+
   '<p class="note"><button type="button" class="lnk" data-showver>See the full version history</button> (no sign-in needed)</p></section>'+
   '<section class="accs" aria-label="Sample accounts"><h2>Sample accounts</h2><p class="note">Pick one, then press Sign in. Each role sees its own dashboard and tabs.</p>'+
   grp('Student',by('student'))+grp('Thesis advisers',by('adviser'))+grp('Department chairs (one per degree program)',by('chair'))+grp('Associate Dean and Dean',by('assoc','dean'))+grp('Office staff',by('admin'))+grp('Project owner (every tab)',by('sysadmin'))+'</section></div>';
  if(!$('#ver-back')){const vb=document.createElement('button');vb.type='button';vb.id='ver-back';vb.className='btn sec sm';vb.textContent='Back to sign in';vb.hidden=true;$('#v-ver').insertBefore(vb,$('#v-ver').firstChild)}
}
function doLogin(acc,hash){
  state.user=acc;try{sessionStorage.setItem('ccs-scgss-user',acc.email)}catch(e){}
  E.autoRemind();
  buildTabs();$('#tabbar').hidden=false;$('#me').hidden=false;
  $('#me').innerHTML='<span class="av">'+ini(acc.name)+'</span><span><b>'+esc(acc.name)+'</b><small>'+esc(acc.label)+'</small></span><button type="button" class="btn sm ghost" data-logout>Sign out</button>';
  show(hash&&allowed(hash)?hash:'dash',true);
}
function logout(){state.user=null;try{sessionStorage.removeItem('ccs-scgss-user')}catch(e){}$('#tabbar').hidden=true;$('#me').hidden=true;$('#me').innerHTML='';views.forEach(v=>v.hidden=true);$('#login').hidden=false;try{history.replaceState(null,'',location.pathname)}catch(e){}window.scrollTo(0,0)}
document.addEventListener('submit',e=>{
  if(e.target.id!=='loginform')return;e.preventDefault();
  const em=$('#l-email').value.trim().toLowerCase(),pw=$('#l-pass').value,acc=C.ACCOUNTS.filter(a=>a.email===em)[0];
  if(!acc||pw!==PASSWORD){$('#l-err').textContent='The email or password is not right. Pick a sample account on the right and try again.';$('#l-email').setAttribute('aria-invalid','true');return}
  doLogin(acc);
});

/* ---------- shared pieces ---------- */
const kpi=(n,l)=>'<div class="kpi"><b>'+n+'</b><span>'+l+'</span></div>';
function canView(a){const r=u().role,e=u().email;
  if(r==='student')return a.studentEmail===e;
  if(CHAIN.indexOf(r)>-1)return CHAIN.some(k=>a.route[k]===e);
  return true;}
function listTable(list,o){
  o=o||{};
  if(!list.length)return '<div class="empty-note">Nothing here.</div>';
  const rows=list.slice().sort((x,y)=>y.updated-x.updated).map(a=>{
    const i=C.info(a);
    return '<tr><td><button class="lnk mono" data-open="'+a.id+'">'+esc(a.ref)+'</button></td>'+(o.noStudent?'':'<td>'+esc(a.studentName)+' <span class="muted">· '+a.program+'</span></td>')+
    '<td>'+esc(a.conf.title)+'<div class="muted">'+fmtD(a.conf.start)+(a.conf.end!==a.conf.start?' to '+fmtD(a.conf.end):'')+' · '+esc(a.conf.venue)+'</div></td>'+
    '<td class="r num">'+money(C.projected(a))+(a.grant?'<div class="muted">grant '+money(a.grant.total)+'</div>':'')+'</td>'+
    '<td><span class="pill '+i.cls+'">'+esc(i.label)+'</span>'+(a.status==='pending'?'<div class="muted">'+esc(i.who)+'</div>':'')+'</td>'+(o.rfp?'<td class="mono">'+(a.report?esc(a.report.rfp):'<span class="muted">–</span>')+'</td>':'')+
    '<td class="mono muted">'+fmtT(a.updated).slice(5)+'</td><td>'+(o.action?o.action(a):'<button class="btn sm sec" data-open="'+a.id+'">Open</button>')+'</td></tr>'}).join('');
  return '<div class="tbl"><table class="lt"><thead><tr><th>Reference</th>'+(o.noStudent?'':'<th>Student</th>')+'<th>Conference</th><th class="r">Projected (₱)</th><th>Status</th>'+(o.rfp?'<th>RFP</th>':'')+'<th>Updated</th><th></th></tr></thead><tbody>'+rows+'</tbody></table></div>';
}
function matches(a,q){return !q||[a.ref,a.studentName,a.conf.title,a.program,a.conf.venue,C.info(a).label].join(' ').toLowerCase().indexOf(q.toLowerCase())>-1}
C.listTable=listTable;C.pill=pill;C.stepsHTML=stepsHTML;C.matches=matches;

/* ---------- dashboards ---------- */
let dashF='pending',dashQ='';
const dashP={ay:'',term:''}; /* period filter for the approver and staff dashboards */
const periodApps=()=>D().apps.filter(a=>(!dashP.ay||a.ay===dashP.ay)&&(!dashP.term||a.term===dashP.term));
const periodLabel=()=>(dashP.ay?ayLabel(dashP.ay):'All academic years')+' · '+(dashP.term?dashP.term.replace('Term','Term '):'All terms');
function periodBar(){
  return '<div class="row" style="max-width:560px;margin:12px 0 0"><div class="field"><label for="dp_ay">Academic year</label><select id="dp_ay"><option value="">All academic years</option>'+C.AYS.map(v=>opt(v,ayLabel(v),dashP.ay===v)).join('')+'</select></div>'+
   '<div class="field"><label for="dp_term">Term</label><select id="dp_term"><option value="">All terms</option>'+C.TERMS.map(v=>opt(v,v.replace('Term','Term '),dashP.term===v)).join('')+'</select></div></div>';
}
/* an approver may hold more than one signing step on an application (for example a Chair who is also the Thesis Adviser), so buckets follow the person, not the role */
function approverBuckets(email,apps){
  const mine=apps.filter(a=>CHAIN.some(k=>a.route[k]===email));
  return {assigned:mine,pending:mine.filter(a=>a.status==='pending'&&a.route[CHAIN[a.stage]]===email),
    approved:mine.filter(a=>Object.keys(a.decisions).some(k=>a.decisions[k].email===email&&['endorsed','approved'].indexOf(a.decisions[k].d)>-1)),
    returned:mine.filter(a=>a.status==='returned'&&a.route[a.returned.role]===email),rejected:mine.filter(a=>a.status==='rejected'&&a.route[a.rejected.role]===email)};
}
function staffBuckets(all){
  return {assigned:all,pending:all.filter(a=>a.status==='approved'&&a.post.status==='submitted'),approved:all.filter(a=>a.status==='verified'||a.status==='completed'),
    returned:all.filter(a=>a.status==='returned'||(a.status==='approved'&&a.post.status==='returned')),rejected:all.filter(a=>a.status==='rejected')};
}
const CHIPS=[['assigned','Assigned'],['pending','Pending'],['approved','Approved'],['returned','Returned'],['rejected','Rejected']];
const CHIP_HELP={
  approver:{assigned:'Every application routed to you',pending:'Waiting for your decision now',approved:'You endorsed or approved',returned:'You returned to the student',rejected:'You rejected'},
  staff:{assigned:'All applications',pending:'Reports waiting for verification',approved:'Verified or filed at the FAO',returned:'Returned to students',rejected:'Rejected'}};
function chipsHTML(b,help){return '<div class="kpis chips">'+CHIPS.map(c=>'<button type="button" class="kpi" data-act="dfilter" data-f="'+c[0]+'" aria-pressed="'+(dashF===c[0])+'"><b>'+b[c[0]].length+'</b><span>'+c[1]+' <small class="muted">· '+help[c[0]]+'</small></span></button>').join('')+'</div>'}
function dashList(b,o){
  const list=b[dashF].filter(a=>matches(a,dashQ));
  return '<div class="field"><label for="dsearch">Search these applications</label><input id="dsearch" type="search" value="'+esc(dashQ)+'" placeholder="Reference, student, conference, program"></div>'+
   '<p class="muted">'+list.length+' '+CHIPS.filter(c=>c[0]===dashF)[0][1].toLowerCase()+' application'+(list.length===1?'':'s')+'</p>'+listTable(list,o);
}
ACT.dfilter=t=>{dashF=t.dataset.f;R.dash()};
document.addEventListener('input',e=>{if(e.target.id==='dsearch'){dashQ=e.target.value;const p=e.target.selectionStart;R.dash();const el=$('#dsearch');if(el){el.focus();el.setSelectionRange(p,p)}}});
document.addEventListener('change',e=>{if(e.target.id==='dp_ay'||e.target.id==='dp_term'){dashP[e.target.id==='dp_ay'?'ay':'term']=e.target.value;R.dash()}});
R.dash=function(){
  const r=u().role,body=$('#dashBody');
  if(r==='student')body.innerHTML=dashStudent();
  else if(CHAIN.indexOf(r)>-1){
    const apps=periodApps(),b=approverBuckets(u().email,apps);
    const granted=b.approved.filter(a=>a.grant&&a.grant.byEmail===u().email);
    body.innerHTML='<header><h2>'+esc(u().label)+' dashboard</h2><p class="muted">Your applications by status. Pick a box to filter the list. You can act only when it is your turn.</p></header>'+
      (b.pending.length?'<div class="callout info"><b>'+b.pending.length+'</b> application'+(b.pending.length>1?'s':'')+' waiting for your decision.</div>':'<div class="callout ok">Nothing is waiting for you.</div>')+
      periodBar()+chipsHTML(b,CHIP_HELP.approver)+(r==='dean'?'<div class="kpis" style="margin-top:12px">'+kpi('₱'+money(C.total(granted.map(a=>({v:a.grant.total})),'v')),'Total grants approved · '+periodLabel())+kpi(granted.length,'Grants approved in this period')+'</div>':'')+
      '<div class="card" style="margin-top:14px">'+dashList(b,{action:a=>a.status==='pending'&&a.route[CHAIN[a.stage]]===u().email?'<button class="btn sm" data-open="'+a.id+'">Review</button>':'<button class="btn sm sec" data-open="'+a.id+'">Open</button>'})+'</div>';
  }else{
    const all=periodApps(),b=staffBuckets(all),wait=all.filter(a=>['completed','rejected'].indexOf(a.status)<0&&Date.now()-a.updated>2*864e5);
    const grants=C.total(all.filter(a=>a.grant).map(a=>({v:a.grant.total})),'v'),reimb=C.total(all.filter(a=>a.post.verify&&a.post.verify.total!=null&&!a.post.verify.draft).map(a=>({v:a.post.verify.total})),'v'),filed=all.filter(a=>a.status==='completed');
    body.innerHTML='<header><h2>'+esc(u().label)+' dashboard</h2><p class="muted">'+(r==='admin'?'Validate post-activity documents, edit reimbursement items, download the reimbursement report and record the RFP.':'All applications, with every tab available for testing.')+'</p></header>'+
      periodBar()+chipsHTML(b,CHIP_HELP.staff)+
      '<div class="kpis" style="margin-top:12px">'+kpi('₱'+money(grants),'Grants approved by the Dean · '+periodLabel())+kpi('₱'+money(reimb),'Reimbursement approved')+kpi(filed.length,'Filed at FAO (RFP recorded)')+kpi(all.filter(a=>a.status==='verified').length,'Verified, RFP still to record')+kpi(wait.length,'Waiting more than 2 days')+kpi(D().notifs.filter(n=>n.to===u().email&&!n.read).length,'Unread notifications')+'</div>'+
      '<div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap">'+(wait.length?'<button class="btn sec" data-act="sweep">Send reminders for the '+wait.length+' waiting</button>':'')+'<button class="btn sec" data-go="track">Open the tracking table</button></div>'+
      '<div class="card" style="margin-top:14px">'+dashList(b,{rfp:true,action:a=>{
        if(r==='admin'&&a.status==='approved'&&a.post.status==='submitted')return '<button class="btn sm" data-act="verifyopen" data-id="'+a.id+'">Verify</button>';
        if(a.status==='verified'||a.status==='completed')return '<button class="btn sm sec" data-act="rptopen" data-id="'+a.id+'">Report</button>';
        return '<button class="btn sm sec" data-open="'+a.id+'">Open</button>'}})+'</div>';
  }
};
ACT.sweep=()=>{const n=E.sweep(u(),2);toast(n?n+' reminder'+(n>1?'s':'')+' sent by email and in-app.':'Nothing to remind.');R.dash()};
ACT.verifyopen=t=>{C.verifySel=t.dataset.id;show('verify',true)};
ACT.rptopen=t=>{C.rptSel=t.dataset.id;show('rpt',true)};
function dashStudent(){
  const mine=D().apps.filter(a=>a.studentEmail===u().email).sort((x,y)=>y.updated-x.updated),n=D().notifs.filter(x=>x.to===u().email);
  const needs=[],today=C.manilaToday();
  mine.forEach(a=>{
    if(a.status==='returned')needs.push('<div class="callout"><b>'+a.ref+'</b> was returned by your '+CH[a.returned.role].label+': "'+esc(a.returned.why)+'" <button class="btn sm" data-open="'+a.id+'" style="margin-left:8px">Reply or edit</button></div>');
    if(a.status==='approved'&&a.post.status==='none'){const left=C.daysBetween(today,C.dueDate(a)),late=left<0;
      needs.push('<div class="callout '+(late?'':'info')+'"><b>'+a.ref+'</b> is approved. Submit the post-activity report and reimbursement requirements (one PDF) by <b>'+fmtD(C.dueDate(a))+'</b> ('+C.PAR_DAYS+' days after '+fmtD(a.conf.end)+')'+(today>=a.conf.end?(late?'. <b>It is overdue by '+(-left)+' day'+(left===-1?'':'s')+'.</b>':'. '+left+' day'+(left===1?'':'s')+' left.'):'. You will get a reminder by email and in-app.')+' <button class="btn sm" data-act="gopar" data-id="'+a.id+'" style="margin-left:8px">Submit report</button></div>')}
    if(a.status==='approved'&&a.post.status==='returned')needs.push('<div class="callout"><b>'+a.ref+'</b> post-activity requirements were returned: "'+esc(a.post.verify&&a.post.verify.overall||'see remarks')+'" <button class="btn sm" data-act="gopar" data-id="'+a.id+'" style="margin-left:8px">Correct and resubmit</button></div>');
  });
  const cnt=g=>mine.filter(a=>C.info(a).group===g).length;
  return '<header><h2>My grants</h2><p class="muted">Follow each application from submission to reimbursement. Open one for the documents, messages and full history.</p></header>'+
   '<div class="kpis">'+kpi(mine.length,'Applications')+kpi(cnt('pending'),'In approval')+kpi(cnt('returned')+mine.filter(a=>a.post.status==='returned').length,'Returned to me')+kpi(cnt('approved'),'Approved, report due')+kpi(cnt('post')+cnt('completed'),'Report or reimbursement stage')+kpi(cnt('rejected'),'Rejected')+'</div>'+
   '<div style="display:flex;flex-wrap:wrap;gap:8px;margin:14px 0"><button class="btn" data-go="form">Start new application</button><button class="btn sec" data-go="guide">View guidelines</button></div>'+
   (needs.length?'<h3 style="margin:8px 0">Needs your action</h3><div style="display:grid;gap:8px">'+needs.join('')+'</div>':'<div class="callout ok">Nothing needs your action right now.</div>')+
   '<div class="grid g2" style="margin-top:14px;align-items:start"><div style="display:grid;gap:14px">'+(mine.map(a=>{const i=C.info(a);return '<div class="card"><div style="display:flex;flex-wrap:wrap;justify-content:space-between;gap:6px"><div><span class="mono">'+esc(a.ref)+'</span><h3>'+esc(a.conf.title)+'</h3><span class="muted">'+esc(a.conf.venue)+' · '+fmtD(a.conf.start)+' to '+fmtD(a.conf.end)+'</span></div><span class="pill '+i.cls+'">'+esc(i.label)+'</span></div>'+stepsHTML(a)+
     '<p class="muted">'+(a.status==='pending'?'With the <b style="color:var(--fg)">'+i.by+'</b>, '+esc(i.who)+'.':a.status==='returned'?'Next action: <b style="color:var(--fg)">you</b> reply to the remarks.':a.status==='approved'&&a.post.status==='none'?'Approved grant: ₱'+money(a.grant.total)+'. Next action: <b style="color:var(--fg)">you</b> submit the report by '+fmtD(C.dueDate(a))+'.':a.status==='rejected'?'Reason: '+esc(a.rejected.why):a.status==='completed'?'Approved reimbursement ₱'+money(a.post.verify.total)+'. Processed at the FAO under RFP <b style="color:var(--fg)">'+esc(a.report.rfp)+'</b>. You may check with the FAO after 5 to 10 working days for an update.':a.status==='verified'?'Approved reimbursement ₱'+money(a.post.verify.total)+'. The Administrative Assistant will file it at the FAO.':'Waiting for the '+i.by+'.')+'</p>'+
     '<div style="margin-top:8px"><button class="btn sm sec" data-open="'+a.id+'">Open</button></div></div>'}).join('')||'<div class="card muted">You have no applications yet. Start one with the button above.</div>')+'</div>'+
   '<div class="card"><h4>Latest notifications</h4><div class="log" style="border:0;max-height:none;margin-top:8px">'+(n.slice(0,6).map(x=>'<div'+(x.read?'':' class="unread"')+'><b>'+esc(x.title)+'</b><span class="muted">'+esc(x.body.slice(0,140))+(x.body.length>140?'…':'')+'</span><span class="mono muted">'+fmtT(x.at)+' · <button class="lnk" data-open="'+x.appId+'">open</button></span></div>').join('')||'<div class="muted">No notifications yet.</div>')+'</div><p style="margin-top:8px"><button class="lnk" data-go="notif">See all</button></p></div></div>';
}
ACT.gopar=t=>{C.parSel=t.dataset.id;show('par',true)};

/* anything waiting for a reply from the signed-in person */
const _dash=R.dash;
R.dash=function(){
  _dash();
  const last=a=>a.comments[a.comments.length-1];
  const w=D().apps.filter(a=>{const c=last(a);return c&&c.to&&c.to.indexOf(u().email)>-1&&c.email!==u().email&&canView(a)});
  if(w.length)$('#dashBody').insertAdjacentHTML('afterbegin','<div class="callout" style="margin-bottom:12px"><b>'+w.length+' message'+(w.length>1?'s':'')+' waiting for your reply:</b> '+w.map(a=>'<button class="lnk mono" data-open="'+a.id+'">'+esc(a.ref)+'</button> <span class="muted">('+esc(last(a).by)+(last(a).topic?' · '+esc(last(a).topic.kind):'')+')</span>').join(' · ')+'</div>');
};

/* ---------- viewer, downloads, signature pad ---------- */
let viewUrl=null;
function viewerHTML(){return '<div class="viewer" data-viewer><div class="empty">Choose <b>Preview</b> beside a document to read it here, before you decide.</div></div>'}
ACT.preview=function(t){
  const id=t.dataset.id,m=D().files[id],box=$('#v-'+state.cur+' [data-viewer]');if(!m||!box)return;
  box.innerHTML='<div class="empty">Opening…</div>';
  C.getBlob(id).then(b=>{
    if(viewUrl)URL.revokeObjectURL(viewUrl);viewUrl=URL.createObjectURL(b);
    const pdf=(b.type||m.type||'').indexOf('pdf')>-1,img=(b.type||m.type||'').indexOf('image')>-1;
    box.innerHTML='<div class="vbar"><b>'+esc(m.name||m.orig)+'</b><span class="muted">'+esc(m.kind||'')+' · '+fmtSize(m.size)+'</span><span><a class="btn sm sec" href="'+viewUrl+'" target="_blank" rel="noopener">Open in new tab</a> <button class="btn sm sec" data-act="download" data-id="'+id+'">Download</button></span></div>'+
      (pdf?'<iframe src="'+viewUrl+'" title="Preview of '+esc(m.name||m.orig)+'"></iframe>':img?'<img src="'+viewUrl+'" alt="'+esc(m.name||m.orig)+'">':'<div class="empty">This file type cannot be previewed here. Use Download.</div>');
    const a=m.appId&&D().apps.find(x=>x.id===m.appId);
    if(a&&u().role!=='student'){E.markViewed(u(),a,id);const c=$('#viewcount');if(c)c.textContent=viewedCount(a)}
    box.scrollIntoView({behavior:'smooth',block:'nearest'});
  });
};
ACT.download=function(t){const m=D().files[t.dataset.id];C.getBlob(t.dataset.id).then(b=>{const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=m.name||m.orig;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),2000)})};
C.viewerHTML=viewerHTML;
function filesOf(a){return Object.values(D().files).filter(f=>f.appId===a.id&&f.name).sort((x,y)=>x.at-y.at)}
function docsHTML(a,viewerToo){
  const fs=filesOf(a);
  return '<div class="dlist">'+(fs.map(f=>'<div class="ditem"><div class="dmain"><span class="mono dname">'+esc(f.name)+'</span>'+(f.superseded?' <span class="pill p-idle">replaced</span>':'')+'<div class="muted">'+esc(f.kind)+' · '+fmtSize(f.size)+' · '+esc(f.by)+' · '+fmtT(f.at)+'</div></div><div class="dbtn"><button class="btn sm" data-act="preview" data-id="'+f.id+'">Preview</button> <button class="btn sm sec" data-act="download" data-id="'+f.id+'">Download</button></div></div>').join('')||'<p class="muted">No files.</p>')+'</div>'+(viewerToo?viewerHTML():'');
}
C.docsHTML=docsHTML;C.filesOf=filesOf;
function viewedCount(a){return Object.keys(a.viewed[u().email]||{}).filter(id=>D().files[id]&&!D().files[id].superseded).length}
function stageFiles(list){
  const out=[];for(const f of Array.from(list)){
    if(f.size>10*1048576)return Promise.reject(new Error(f.name+' is larger than 10 MB.'));
    if(!/\.(pdf|jpe?g|png)$/i.test(f.name))return Promise.reject(new Error(f.name+' must be a PDF, JPG or PNG.'));
    const m=C.registerFile({orig:f.name,size:f.size,type:f.type||'application/octet-stream',by:u().name});out.push(C.FILES.put(m.id,f).then(()=>m.id));}
  return Promise.all(out);
}
C.stageFiles=stageFiles;
/* signature pad */
function initSig(cv){
  const dpr=window.devicePixelRatio||1,w=cv.clientWidth||400,h=cv.clientHeight||140;cv.width=w*dpr;cv.height=h*dpr;
  const x=cv.getContext('2d');x.scale(dpr,dpr);x.lineWidth=2.4;x.lineCap='round';x.lineJoin='round';x.strokeStyle='#14325c';
  let down=false,lx=0,ly=0;
  const pos=e=>{const r=cv.getBoundingClientRect();return [e.clientX-r.left,e.clientY-r.top]};
  cv.addEventListener('pointerdown',e=>{down=true;[lx,ly]=pos(e);cv.setPointerCapture(e.pointerId);x.beginPath();x.moveTo(lx,ly);x.lineTo(lx+.1,ly+.1);x.stroke();cv.dataset.signed='1'});
  cv.addEventListener('pointermove',e=>{if(!down)return;const [px,py]=pos(e);x.beginPath();x.moveTo(lx,ly);x.lineTo(px,py);x.stroke();lx=px;ly=py});
  const up=()=>{down=false};cv.addEventListener('pointerup',up);cv.addEventListener('pointercancel',up);
  cv._x=x;cv._w=w;cv._h=h;
}
ACT.sigclear=()=>{const cv=$('#sigpad');if(!cv)return;cv._x.clearRect(0,0,cv._w,cv._h);cv.dataset.signed=''};
ACT.sigsaved=()=>{const s=D().sigs[u().email],cv=$('#sigpad');if(!s)return toast('No saved signature yet. Sign once and tick "Remember my signature".');
  const img=new Image();img.onload=()=>{ACT.sigclear();cv._x.drawImage(img,0,0,cv._w,cv._h);cv.dataset.signed='1'};img.src=s};
ACT.sigsample=()=>{const img=new Image();const cv=$('#sigpad');img.onload=()=>{ACT.sigclear();cv._x.drawImage(img,10,10,cv._w-20,cv._h-20);cv.dataset.signed='1'};img.src=C.sampleSig()};

/* ---------- application page ---------- */
function factsHTML(a){
  const p=(l,v)=>'<dt>'+l+'</dt><dd>'+(v==null||v===''?'<span class="muted">–</span>':esc(v))+'</dd>';
  return '<dl class="who">'+p('Student',a.studentName+' · ID '+a.sid+' · '+a.program+' · year '+a.year)+p('Thesis Adviser',C.nameOf(a.route.adviser))+p('Department Chair',C.nameOf(a.route.chair)+' ('+a.program+')')+p('Associate Dean',C.nameOf(a.route.assoc))+p(a.route.dean!==D().settings.dean?'Approver (for the Dean)':'Dean',C.nameOf(a.route.dean))+
   p('Conference',a.conf.title)+p('Dates · venue',fmtD(a.conf.start)+' to '+fmtD(a.conf.end)+' · '+a.conf.venue)+p('Organizer · type',a.conf.org+' · '+a.conf.etype)+p('Event location',C.regionLabel(a.conf.scope)+' (grant limit ₱'+money(C.CAP[a.conf.scope])+')')+
   p('Paper',a.paper.title+' · '+a.paper.ptype+' · '+a.paper.cls)+p('Indexed in',a.paper.index)+p('Co-authors',[a.paper.coF&&'Faculty: '+a.paper.coF,a.paper.coS&&'Student: '+a.paper.coS].filter(Boolean).join(' · '))+
   p('Privacy consent',a.privacy?'Accepted '+fmtT(a.privacy.at):'')+p('Grant',a.grant?'₱'+money(a.grant.total)+' · funding source: '+a.grant.fund+' · e-signed by '+a.grant.by:'Not yet approved')+'</dl>';
}
function expensesHTML(a){
  const rows=a.expenses.map(x=>'<tr><td>'+esc(x.type)+'</td><td class="r num" data-label="Projected (₱)">'+money(x.amount)+'</td><td class="muted" data-label="Remarks">'+esc(x.remarks)+'</td></tr>').join('');
  return '<div class="tbl"><table class="stk"><thead><tr><th>Expense</th><th class="r">Projected (₱)</th><th>Remarks</th></tr></thead><tbody>'+rows+'</tbody><tfoot><tr><th>Total</th><th class="r num" data-label="Projected (₱)">'+money(C.projected(a))+'</th><th></th></tr></tfoot></table></div>'+
   (a.grant?'<div class="callout ok" style="margin-top:10px"><b>Grant approved: ₱'+money(a.grant.total)+'</b> · funding source: '+esc(a.grant.fund)+'. The Administrative Assistant breaks it down by receipt at reimbursement.</div>':'');
}
function grantFields(a){
  const cap=C.CAP[a.conf.scope],def=Math.min(cap,C.projected(a));
  return '<div class="row" style="margin-top:10px"><div class="field"><label for="d_amt">Approved grant (₱)</label><input id="d_amt" type="number" min="0" step="0.01" value="'+def+'"><small id="d_amtnote"></small></div>'+
   '<div class="field"><label for="d_fund">Funding source</label><input id="d_fund" type="text" maxlength="80" placeholder="e.g. Dean\'s Office fund"><small>One amount and one funding source for the whole grant. The Administrative Assistant breaks it down by receipt at reimbursement.</small></div></div>';
}
function historyHTML(a){
  return '<div class="tbl"><table><thead><tr><th>When</th><th>By</th><th>Action</th><th>Details</th></tr></thead><tbody>'+a.history.slice().reverse().map(h=>'<tr'+(h.cls?' class="denied"':'')+'><td class="mono muted">'+fmtT(h.at)+'</td><td>'+esc(h.by)+(h.role!=='system'?'<div class="muted">'+esc(ROLE_NAME[h.role]||h.role)+'</div>':'')+'</td><td><b>'+esc(h.action)+'</b></td><td>'+esc(h.note)+'</td></tr>').join('')+'</tbody></table></div>';
}
C.historyHTML=historyHTML;
function whoLabel(a,e){return e===a.studentEmail?a.studentName+' (Student)':C.acct(e)?C.acct(e).name+' ('+C.acct(e).label+')':e}
function commentItem(c,me){return '<div class="cm'+(c.email===me?' mine':'')+'"><div class="cm-h"><b>'+esc(c.by)+'</b> <span class="muted">· '+esc(ROLE_NAME[c.role])+(c.to&&c.to.length?' → '+esc(c.to.map(e=>C.nameOf(e)).join(', ')):'')+(c.topic?' · </span><span class="pill p-warn">'+esc(c.topic.kind+(c.topic.item?' · '+c.topic.item:''))+'</span><span class="muted"> ':'')+' · '+fmtT(c.at)+'</span></div>'+(c.text?'<p>'+esc(c.text).replace(/\n/g,'<br>')+'</p>':'')+(c.files.length?'<p>'+c.files.map(id=>'<button class="btn sm sec" data-act="preview" data-id="'+id+'">'+esc(D().files[id].name)+'</button>').join(' ')+'</p>':'')+'</div>'}
C.commentItem=commentItem;
function commentsHTML(a){
  const me=u().email,canSay=a.studentEmail===me||CHAIN.some(k=>a.route[k]===me)||u().role==='admin';
  const rc=C.participants(a).filter(e=>e!==me),def=C.counterparts(a,u());
  return '<div class="thread">'+(a.comments.map(c=>commentItem(c,me)).join('')||'<p class="muted">No messages yet. Use this to ask for or give a clarification: the student, each signatory and the Administrative Assistant can write to one another here.</p>')+'</div>'+
   (canSay?'<fieldset class="tolist"><legend>Send to</legend><div class="to-row">'+rc.map(e=>'<label><input type="checkbox" class="c-to" value="'+esc(e)+'"'+(def.indexOf(e)>-1?' checked':'')+'><span>'+esc(whoLabel(a,e))+'</span></label>').join('')+'</div><small>Everyone on the application can read the thread. Only the people you tick are notified by email and in-app.</small></fieldset>'+
    '<div class="field" style="margin-top:10px"><label for="c_text">Message</label><textarea id="c_text" rows="3" placeholder="Ask for or give a clarification"></textarea></div><div class="field" style="margin-top:8px"><label for="c_files">Attach documents (optional)</label><input id="c_files" type="file" multiple accept=".pdf,.jpg,.jpeg,.png"><small>PDF, JPG or PNG, 10 MB each. Saved as '+esc(a.ref)+'-C1, -C2 and so on.</small></div><div class="msg" id="c_msg" style="color:var(--bad);font-size:12px"></div><button class="btn" data-act="comment" style="margin-top:8px">Send message</button>':'');
}
function actionHTML(a){
  const r=u().role,me=u().email,i=C.info(a);let h='';
  if(r==='student'&&a.studentEmail===me){
    if(a.status==='returned')h+='<div class="card"><h3>Returned to you</h3><div class="callout"><b>'+esc(a.returned.by)+'</b> ('+CH[a.returned.role].label+'): '+esc(a.returned.why)+'</div><p class="muted" style="margin:8px 0">Earlier decisions are kept. After you resubmit, the file goes back to the '+CH[a.returned.role].label+', not to the start.</p>'+
      '<div class="field"><label for="r_text">Your reply</label><textarea id="r_text" rows="3" placeholder="Explain what you changed or attached"></textarea></div><div class="field" style="margin-top:8px"><label for="r_files">Attach documents (optional)</label><input id="r_files" type="file" multiple accept=".pdf,.jpg,.jpeg,.png"></div><div class="msg" id="r_msg" style="color:var(--bad);font-size:12px"></div>'+
      '<div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:8px"><button class="btn sec" data-act="editapp">Edit the application</button><button class="btn" data-act="resubmit">Resubmit with my reply</button></div></div>';
    else if(a.status==='approved'&&['none','returned'].indexOf(a.post.status)>-1)h+='<div class="card"><h3>Next: post-activity report</h3><p>Due <b>'+fmtD(C.dueDate(a))+'</b> ('+C.PAR_DAYS+' days after the event). One consolidated PDF with all the documents, plus the receipts you are claiming.</p><button class="btn" style="margin-top:8px" data-act="gopar" data-id="'+a.id+'">'+(a.post.status==='returned'?'Correct and resubmit the report':'Submit post-activity report')+'</button></div>';
    else h+='<div class="card"><h3>Status</h3><p>'+esc(i.label)+'. '+(a.status==='pending'?'Waiting for the '+i.by+'.':a.status==='completed'?'You may check with the FAO after 5 to 10 working days for an update.':'')+'</p></div>';
  }
  else if(CHAIN.some(k=>a.route[k]===me)){
    const s=CHAIN[a.stage],mine=a.status==='pending'&&a.route[s]===me;
    const done=CHAIN.filter(k=>a.decisions[k]&&a.decisions[k].email===me&&a.decisions[k].d!=='returned').map(k=>CH[k].label+': '+a.decisions[k].d+' '+fmtT(a.decisions[k].at)).join(' · ');
    if(mine){
      const dean=s==='dean',total=C.filesOf(a).filter(f=>!f.superseded).length;
      h+='<div class="card"><h3>Your decision as '+(s==='dean'&&a.route.dean!==D().settings.dean?'approver in place of the Dean':CH[s].label)+'</h3><p class="muted">Preview the documents first. <b id="viewcount">'+viewedCount(a)+'</b> of '+total+' previewed by you.</p>'+
       (dean?grantFields(a)+'<div class="field" style="margin-top:10px"><label>Your digital signature</label><canvas id="sigpad" class="sigpad" aria-label="Signature pad. Draw your signature."></canvas><div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:6px"><button type="button" class="btn sm sec" data-act="sigclear">Clear</button><button type="button" class="btn sm sec" data-act="sigsaved">Use my saved signature</button><button type="button" class="btn sm sec" data-act="sigupload">Upload a signature image</button><button type="button" class="btn sm sec" data-act="sigsample">Insert sample signature</button><input type="file" id="sigfile" accept="image/png,image/jpeg" hidden></div><label class="chk" style="margin-top:6px"><input type="checkbox" id="d_remember"> Remember my signature on this browser</label><small>Only the Dean signs. The endorsers appear on the reimbursement report with the date they endorsed.</small></div>':'')+
       '<div class="field" style="margin-top:10px"><label for="d_note">Remarks <span class="muted">(required to Return or Reject)</span></label><textarea id="d_note" rows="3"></textarea></div><div class="msg" id="d_msg" style="color:var(--bad);font-size:12px"></div><div id="d_confirm"></div>'+
       '<div id="d_btns" style="display:flex;flex-wrap:wrap;gap:8px;margin-top:10px"><button class="btn" data-act="decide" data-k="'+(dean?'approve':'endorse')+'">'+(dean?'Review and approve':'Endorse')+'</button><button class="btn warn" data-act="decide" data-k="return">Return with remarks</button><button class="btn bad" data-act="decide" data-k="reject">Reject…</button></div></div>';
    }else h+='<div class="card"><h3>Your part</h3><p>'+(done?esc(done)+'.':a.status==='pending'?'It is not your turn yet. It is with the '+i.by+'.':esc(i.label)+'.')+'</p></div>';
  }
  else if(r==='admin'){
    h+='<div class="card"><h3>Administrative Assistant</h3>'+(a.status==='approved'&&a.post.status==='submitted'?'<button class="btn" data-act="verifyopen" data-id="'+a.id+'">Verify post-activity documents</button>':a.status==='verified'||a.status==='completed'?'<button class="btn" data-act="rptopen" data-id="'+a.id+'">Open reimbursement report</button>':'<p class="muted">'+esc(i.label)+'. Nothing to verify yet.</p>')+'<p class="muted" style="margin-top:8px">To clarify something with the student, a signatory or the Dean, use <b>Messages and clarifications</b> below.</p></div>';
  }
  if(['admin','sysadmin'].indexOf(r)>-1&&['completed','rejected'].indexOf(a.status)<0)h+='<div class="card"><h4>Reminder</h4><p class="muted">Send an email and in-app reminder to whoever is holding this application.</p><button class="btn sec sm" style="margin-top:6px" data-act="remind" data-id="'+a.id+'">Send reminder</button></div>';
  return h;
}
function postHTML(a){
  if(a.post.status==='none')return '';
  const p=a.post,v=p.verify,ok=v&&!v.draft;
  const flagged=v&&v.returns?C.REQ_POST.filter(r=>v.returns[r[0]]):[];
  return '<div class="card"><h3>Post-activity report <span class="pill '+(p.status==='verified'?'p-ok':p.status==='returned'?'p-warn':'p-wait')+'">'+p.status+'</span></h3>'+
   '<p class="muted">Submitted '+fmtT(p.submittedAt)+(p.cycle>1?' (version '+p.cycle+'; earlier versions stay on record)':'')+'</p>'+
   (p.status==='returned'&&flagged.length?'<div class="callout" style="margin-top:8px"><b>Requirements returned:</b> '+flagged.map(r=>esc(r[1])+(v.remarks[r[0]]?' ('+esc(v.remarks[r[0]])+')':'')).join('; ')+'</div>':'')+
   '<div class="tbl" style="margin-top:8px"><table><thead><tr><th>Expense</th><th>OR or invoice no.</th><th>Merchant</th><th class="r">For reimbursement (₱)</th>'+(ok?'<th class="r">Approved (₱)</th><th>Funding source</th><th>Remarks</th>':'')+'</tr></thead><tbody>'+
   p.items.map((l,i)=>{const w=ok?v.items[i]:null;return '<tr><td>'+esc(l.type)+'</td><td class="mono">'+esc(w?w.or:l.or)+'</td><td>'+esc(w?w.merchant:l.merchant)+'</td><td class="r num">'+money(l.amount)+'</td>'+(w?'<td class="r num">'+money(w.approved)+'</td><td>'+esc(w.fund)+'</td><td class="muted">'+esc(w.why)+'</td>':'')+'</tr>'}).join('')+
   '</tbody><tfoot><tr><th colspan="3">Total (approved grant ₱'+money(a.grant.total)+')</th><th class="r num">'+money(p.claimedTotal)+'</th>'+(ok?'<th class="r num">'+money(v.total)+'</th><th colspan="2"></th>':'')+'</tr></tfoot></table></div>'+
   '<h4 style="margin-top:12px">Documents the student says are in the PDF</h4><p class="muted">'+C.REQ_POST.map(r=>(p.docs[r[0]]?'✓ ':'✗ ')+r[1]).join(' · ')+'</p>'+(p.missingNote?'<p class="muted">Note: '+esc(p.missingNote)+'</p>':'')+'</div>';
}
C.postHTML=postHTML;
R.app=function(){
  const a=D().apps.find(x=>x.id===state.curApp),box=$('#appBody');
  if(!a||!canView(a)){box.innerHTML='<div class="callout bad">You do not have access to this application.</div><button class="btn sec" data-act="back" style="margin-top:10px">Back</button>';return}
  const canDean=u().role==='dean'&&a.status==='pending'&&CHAIN[a.stage]==='dean'&&a.route.dean===u().email;
  box.innerHTML='<button class="btn sec sm" data-act="back" style="margin-bottom:12px">← Back</button>'+
   '<div class="card"><div style="display:flex;flex-wrap:wrap;justify-content:space-between;gap:8px"><div><span class="mono">'+esc(a.ref)+'</span> <span class="muted">· '+C.ayLabel(a.ay)+' · '+a.term.replace('Term','Term ')+'</span><h2 style="margin-top:2px">'+esc(a.conf.title)+'</h2></div><div>'+pill(a)+'</div></div>'+stepsHTML(a)+
   (a.status==='rejected'?'<div class="callout bad">Rejected by '+esc(a.rejected.by)+' ('+CH[a.rejected.role].label+'): '+esc(a.rejected.why)+'</div>':'')+'</div>'+
   '<div class="grid g2" style="margin-top:14px;align-items:start"><div style="display:grid;gap:14px;min-width:0">'+
    '<div class="card"><h3>Application</h3>'+factsHTML(a)+'</div>'+
    '<div class="card"><h3>Breakdown of projected expenses</h3>'+expensesHTML(a,canDean)+'</div>'+
    '<div class="card"><h3>Documents</h3>'+docsHTML(a,true)+'</div>'+postHTML(a)+'</div>'+
   '<div style="display:grid;gap:14px;min-width:0">'+actionHTML(a)+'<div class="card"><h3>Messages and clarifications</h3>'+commentsHTML(a)+'</div></div></div>'+
   '<div class="card" style="margin-top:14px"><h3>Approval history</h3><p class="muted">Every update is recorded: submissions, decisions, messages, uploads, document views and denied attempts.</p>'+historyHTML(a)+'</div>';
  const cv=$('#sigpad');if(cv)initSig(cv);
  if(canDean)amtNote();
};
C.ayLabel=ayLabel;
function amtNote(){
  const a=D().apps.find(x=>x.id===state.curApp),el=$('#d_amt'),n=$('#d_amtnote');if(!el||!n)return;
  const v=Number(el.value),cap=C.CAP[a.conf.scope],pt=C.projected(a),bad=!(v>0)||v>cap||v>pt;
  n.textContent='Limit ₱'+money(cap)+' for '+C.regionLabel(a.conf.scope)+'. The student projected ₱'+money(pt)+'.'+(v>cap?' Above the limit.':v>pt?' Above the projected budget.':'');
  n.style.color=bad&&el.value!==''?'var(--bad)':'';
}
document.addEventListener('input',e=>{if(e.target.id==='d_amt')amtNote()});
document.addEventListener('change',e=>{
  if(e.target.id==='sigfile'){
    const f=e.target.files[0];if(!f)return;
    if(f.size>2*1048576){toast('The signature image must be under 2 MB.');e.target.value='';return}
    const rd=new FileReader();
    rd.onload=()=>{const img=new Image(),cv=$('#sigpad');img.onload=()=>{ACT.sigclear();const k=Math.min((cv._w-20)/img.width,(cv._h-20)/img.height),w=img.width*k,h=img.height*k;cv._x.drawImage(img,(cv._w-w)/2,(cv._h-h)/2,w,h);cv.dataset.signed='1'};img.src=rd.result};
    rd.readAsDataURL(f);e.target.value='';
  }
});
ACT.sigupload=()=>{const el=$('#sigfile');if(el)el.click()};
/* The Dean first sees a summary and confirms. Nothing is recorded until Confirm approval. */
let pendingApproval=null;
ACT.decide=function(t){
  const a=D().apps.find(x=>x.id===state.curApp),k=t.dataset.k,note=$('#d_note').value.trim(),msg=$('#d_msg');msg.textContent='';
  let res;
  if(k==='endorse')res=E.endorse(u(),a,note);
  else if(k==='return')res=E.returnApp(u(),a,note);
  else if(k==='reject'){if(!note){msg.textContent='A reason is required to reject.';$('#d_note').focus();return}if(!confirm('Reject this application? It will be closed and the student notified.'))return;res=E.reject(u(),a,note)}
  else{
    const cv=$('#sigpad'),signed=cv&&cv.dataset.signed==='1';
    const o={signature:signed?cv.toDataURL('image/png'):'',note,amount:$('#d_amt').value,fund:$('#d_fund').value};
    const chk=E.approveGrant(u(),a,Object.assign({dry:true},o));
    if(chk.err){msg.textContent=chk.err;toast(chk.err);return}
    pendingApproval=o;
    $('#d_confirm').innerHTML='<div class="callout info" style="margin-top:10px" role="group" aria-label="Confirm the grant approval"><b>Confirm the grant approval</b>'+
      '<dl class="who" style="margin-top:8px"><dt>Approved grant</dt><dd><b>₱'+money(chk.total)+'</b> <span class="muted">(limit ₱'+money(C.CAP[a.conf.scope])+' for '+esc(C.regionLabel(a.conf.scope))+')</span></dd><dt>Funding source</dt><dd>'+esc(chk.fund)+'</dd></dl>'+
      '<p style="margin-top:8px">Your signature:</p><img class="sigimg" src="'+o.signature+'" alt="Your signature">'+
      '<div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:10px"><button class="btn" data-act="confirmapprove">Confirm approval</button><button class="btn sec" data-act="cancelconfirm">Go back and edit</button></div></div>';
    $('#d_btns').style.display='none';$('#d_confirm').scrollIntoView({block:'nearest',behavior:'smooth'});
    return;
  }
  if(res.err){msg.textContent=res.err;toast(res.err);return}
  toast(k==='endorse'?'Endorsed. The next approver was notified by email and in-app.':k==='return'?'Returned to the student with your remarks.':'Rejected. The student was notified.');
  R.app();
};
ACT.cancelconfirm=()=>{pendingApproval=null;$('#d_confirm').innerHTML='';$('#d_btns').style.display='flex'};
ACT.confirmapprove=function(){
  const a=D().apps.find(x=>x.id===state.curApp),msg=$('#d_msg'),keep=$('#d_remember')&&$('#d_remember').checked;
  if(!pendingApproval)return;
  const res=E.approveGrant(u(),a,Object.assign({confirm:true},pendingApproval));
  if(res.err){msg.textContent=res.err;toast(res.err);return}
  if(keep){D().sigs[u().email]=pendingApproval.signature;C.save()}
  pendingApproval=null;
  toast('Grant approved and signed. The student was notified by email and in-app.');
  R.app();
};
ACT.comment=function(t){
  const a=D().apps.find(x=>x.id===state.curApp),text=$('#c_text').value,fl=$('#c_files').files,to=$$('.c-to').filter(c=>c.checked).map(c=>c.value);
  const done=ids=>{const r=E.comment(u(),a,text,ids,to);if(r.err){$('#c_msg').textContent=r.err;return}toast('Message sent. The people you chose were notified.');R.app()};
  if(fl.length)stageFiles(fl).then(done).catch(e=>{$('#c_msg').textContent=e.message});else done([]);
};
ACT.resubmit=function(){
  const a=D().apps.find(x=>x.id===state.curApp),text=$('#r_text').value,fl=$('#r_files').files;
  const done=ids=>{const r=E.resubmit(u(),a,null,text,ids);if(r.err){$('#r_msg').textContent=r.err;return}toast('Resubmitted. It went back to the '+CH[CHAIN[a.stage]].label+'.');R.app()};
  if(fl.length)stageFiles(fl).then(done).catch(e=>{$('#r_msg').textContent=e.message});else done([]);
};
ACT.remind=function(t){const a=D().apps.find(x=>x.id===t.dataset.id),r=E.remind(u(),a);toast(r.err||'Reminder sent by email and in-app.');R.app()};

/* ---------- application form ---------- */
const FS={step:0,mode:'new',appId:null,file:null,done:null};
const FSTEPS=['1 Student & conference','2 Paper','3 Expenses','4 Requirements','5 Review & submit'];
function formHTML(){
  const adv=C.advisers();
  return '<ol class="steps" id="fsteps">'+FSTEPS.map(s=>'<li>'+s+'</li>').join('')+'</ol><form id="appForm" novalidate>'+
  '<div class="card" data-fs="0"><h3>Application period</h3><p class="muted">The academic year and term become part of the reference number and file names, for example <span class="mono">2627-Term1-001</span>.</p>'+
   '<div class="row" style="margin-top:10px"><div class="field"><label for="f_ay">Academic year</label><select id="f_ay">'+C.AYS.map(v=>opt(v,ayLabel(v)+' ('+v+')',v==='2627')).join('')+'</select><div class="msg"></div></div>'+
   '<div class="field"><label for="f_term">Term</label><select id="f_term">'+C.TERMS.map(v=>opt(v,v.replace('Term','Term '),v==='Term1')).join('')+'</select><div class="msg"></div></div></div>'+
   '<h3 style="margin-top:18px">Student information</h3><div class="row" style="margin-top:10px">'+
   '<div class="field"><label for="f_name">Name of student</label><input id="f_name" readonly value="'+esc(u().name)+'"><small>From your sign-in.</small></div>'+
   '<div class="field"><label for="f_sid">Student ID number</label><input id="f_sid" inputmode="numeric"><div class="msg"></div></div>'+
   '<div class="field"><label for="f_prog">Degree program</label><select id="f_prog"><option value="">Select</option>'+C.PROGRAMS.map(p=>opt(p[0],p[0]+' · '+p[1],p[0]===u().program)).join('')+'</select><small>Decides your Department Chair.</small><div class="msg"></div></div>'+
   '<div class="field"><label for="f_year">Year level</label><select id="f_year"><option value="">Select</option>'+[1,2,3,4,5].map(n=>opt(n,n)).join('')+'</select><div class="msg"></div></div>'+
   '<div class="field"><label for="f_adv">Thesis Adviser</label><select id="f_adv"><option value="">Select</option>'+adv.map(a=>opt(a.email,a.name+(a.role==='adviser'?'':' · '+a.label))).join('')+'</select><small>Your adviser is the first endorser. If your adviser is also your Chair or Associate Dean, they endorse once and the repeated step is skipped. If the Dean is your adviser, the alternate approver signs the grant.</small><div class="msg"></div></div></div>'+
   '<h3 style="margin-top:18px">Conference details</h3><div class="row" style="margin-top:10px">'+
   '<div class="field"><label for="f_conf">Conference title</label><input id="f_conf"><div class="msg"></div></div>'+
   '<div class="field"><label for="f_start">Start date</label><input id="f_start" type="date"><div class="msg"></div></div>'+
   '<div class="field"><label for="f_end">End date</label><input id="f_end" type="date"><small>The post-activity report and reimbursement requirements are due '+C.PAR_DAYS+' days after this date.</small><div class="msg"></div></div>'+
   '<div class="field"><label for="f_venue">Venue</label><input id="f_venue"><div class="msg"></div></div>'+
   '<div class="field"><label for="f_org">Organizer</label><input id="f_org"><div class="msg"></div></div>'+
   '<div class="field"><label for="f_etype">Type of event</label><select id="f_etype"><option value="">Select</option>'+['Conference','Competition','Exhibit','Public forum','Other'].map(v=>opt(v,v)).join('')+'</select><div class="msg"></div></div>'+
   '<div class="field"><label for="f_scope">Event location</label><select id="f_scope"><option value="">Select</option>'+C.REGIONS.map(r=>opt(r[0],r[1]+' · up to ₱'+money(r[2]))).join('')+'</select><small>The grant limit depends on where the event takes place.</small><div class="msg"></div></div></div></div>'+
  '<div class="card" data-fs="1" hidden><h3>Participation details</h3><div class="row" style="margin-top:10px">'+
   '<div class="field"><label for="f_class">Classification</label><select id="f_class"><option>Paper presenter</option><option>Poster presentation</option></select></div>'+
   '<div class="field"><label for="f_ptype">Paper type</label><select id="f_ptype"><option>Full paper</option><option>Short paper</option></select></div>'+
   '<div class="field"><label for="f_index">Indexed in</label><select id="f_index"><option value="">Select</option><option>Scopus</option><option>ISI</option><option>ASEAN Citation</option></select><small>Attach proof in step 4.</small><div class="msg"></div></div></div>'+
   '<div class="field" style="margin-top:12px"><label for="f_title">Title of paper</label><input id="f_title"><div class="msg"></div></div>'+
   '<div class="row" style="margin-top:12px"><div class="field"><label for="f_cof">Co-authors (faculty)</label><input id="f_cof"></div><div class="field"><label for="f_cos">Co-authors (student)</label><input id="f_cos"><small>Only one student co-author is funded per paper.</small></div></div></div>'+
  '<div class="card" data-fs="2" hidden><h3>Breakdown of projected expenses</h3><p class="muted">Include the day before the conference until the day after. The total cannot be more than the University limit for the event location (NCR ₱6,000, Luzon ₱8,000, Ilocos, Cagayan or Bicol ₱10,000, Visayas or Mindanao ₱12,000, international ₱15,000). The Dean approves one grant amount with one funding source; the Administrative Assistant breaks it down by receipt at reimbursement.</p>'+
   '<div class="tbl" style="margin-top:10px"><table><thead><tr><th>Expense type</th><th class="r">Amount (₱)</th><th>Funding source</th><th>Remarks</th></tr></thead><tbody>'+
   C.EXPENSE_TYPES.map((t,i)=>'<tr><td>'+t+'</td><td><input class="ex" aria-label="'+t+' amount" type="number" min="0" style="width:110px;text-align:right"></td><td class="muted">Assigned by the Dean</td><td><input class="exr" aria-label="'+t+' remarks" style="width:100%"></td></tr>').join('')+
   '</tbody><tfoot><tr><th>Total projected</th><th class="r num" id="exTotal">0</th><th colspan="2" id="exNote" class="muted" style="text-transform:none;letter-spacing:0;font-weight:400"></th></tr></tfoot></table></div><div class="msg" id="m_ex_0" style="color:var(--bad);font-size:12px;margin-top:6px"></div></div>'+
  '<div class="card" data-fs="3" hidden><h3>Requirements and attachment</h3>'+
   '<div class="callout info"><b>Reminder: put all required documents in ONE PDF file, in this order:</b><ol>'+C.REQ_APP.map(r=>'<li>'+r+'</li>').join('')+'</ol><span class="muted">The cover letter with endorsements is not needed: the in-system routing replaces it (to confirm with the Office of the Dean). Keep the file under 10 MB.</span></div>'+
   '<div style="margin-top:12px;display:flex;flex-wrap:wrap;gap:8px;align-items:center"><input id="f_file" type="file" accept="application/pdf,.pdf" hidden><button type="button" class="btn sec" id="f_filebtn" data-act="pickfile">Choose the PDF</button><span id="f_attname" class="muted">No file chosen.</span><button type="button" class="btn sm sec" id="f_prev" data-act="preview" data-id="" hidden>Preview</button></div>'+
   '<p class="muted" style="margin-top:6px">After you submit, the file is renamed to <b class="mono" id="f_newname">AY-Term-001.pdf</b> using your reference number. Replaced versions keep a suffix such as <span class="mono">-v2</span>.</p><div class="msg" id="m_f_filebtn" style="color:var(--bad);font-size:12px"></div>'+viewerHTML()+
   '<label class="chk" style="margin-top:12px"><input type="checkbox" id="f_attconfirm"><span>I confirm that I attached all required documents listed above, in one PDF file.</span></label><div class="msg" id="m_f_attconfirm" style="color:var(--bad);font-size:12px"></div></div>'+
  '<div class="card" data-fs="4" hidden><h3>Review before submitting</h3><dl class="who" id="review" style="margin-top:8px"></dl><div id="advis"></div>'+
   '<div class="field" id="replyWrap" hidden style="margin-top:10px"><label for="f_reply">Reply to the remarks (optional)</label><textarea id="f_reply" rows="2"></textarea></div>'+
   '<h4 style="margin-top:14px">Data privacy notice</h4><div class="privacy">'+esc(C.PRIVACY)+'</div>'+
   '<label class="chk" style="margin-top:8px"><input type="checkbox" id="f_privacy"><span>I have read the data privacy notice and I consent to the processing of my personal information as described.</span></label><div class="msg" id="m_f_privacy" style="color:var(--bad);font-size:12px"></div>'+
   '<label class="chk" style="margin-top:8px"><input type="checkbox" id="f_brand"><span>I will state De La Salle University, the College of Computer Studies and my degree program on all materials, and show the official DLSU and CCS logos, as the guidelines require.</span></label><div class="msg" id="m_f_brand" style="color:var(--bad);font-size:12px"></div>'+
   '<div class="callout info" style="margin-top:12px">After you submit, routing is automatic: Thesis Adviser, then Department Chair, then Associate Dean, then Dean. You can reply to remarks and upload documents on the application page. Every version stays on record.</div></div>'+
  '<div id="formErr" class="callout bad" hidden style="margin-top:12px"></div>'+
  '<div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:14px;justify-content:space-between"><div style="display:flex;gap:8px"><button type="button" class="btn sec" id="fBack">Back</button><button type="button" class="btn sec" id="fDraft" data-act="fdraft">Save draft</button></div>'+
  '<div style="display:flex;gap:8px"><button type="button" class="btn sec" data-act="ffill">Fill example</button><button type="button" class="btn" id="fNext" data-act="fnext">Next</button></div></div></form>';
}
function readForm(){
  const v=id=>{const el=$('#'+id);return el?String(el.value).trim():''};
  return {ay:v('f_ay'),term:v('f_term'),sid:v('f_sid'),prog:v('f_prog'),year:v('f_year'),adv:v('f_adv'),conf:v('f_conf'),start:v('f_start'),end:v('f_end'),venue:v('f_venue'),org:v('f_org'),etype:v('f_etype'),scope:v('f_scope'),
    cls:v('f_class'),ptype:v('f_ptype'),index:v('f_index'),title:v('f_title'),cof:v('f_cof'),cos:v('f_cos'),
    exp:C.EXPENSE_TYPES.map((t,i)=>({type:t,amount:$$('.ex')[i].value,remarks:$$('.exr')[i].value.trim()})),
    file:FS.file,attConfirm:$('#f_attconfirm').checked,privacy:$('#f_privacy').checked,brand:$('#f_brand').checked};
}
function writeForm(f){
  const set=(id,val)=>{const el=$('#'+id);if(el&&val!=null)el.value=val};
  set('f_ay',f.ay);set('f_term',f.term);set('f_sid',f.sid);set('f_prog',f.prog);set('f_year',f.year);set('f_adv',f.adv);set('f_conf',f.conf);set('f_start',f.start);set('f_end',f.end);set('f_venue',f.venue);set('f_org',f.org);set('f_etype',f.etype);set('f_scope',f.scope);
  set('f_class',f.cls);set('f_ptype',f.ptype);set('f_index',f.index);set('f_title',f.title);set('f_cof',f.cof);set('f_cos',f.cos);
  (f.exp||[]).forEach((x,i)=>{$$('.ex')[i].value=x.amount;$$('.exr')[i].value=x.remarks||''});
  FS.file=f.file||null;$('#f_attconfirm').checked=!!f.attConfirm;$('#f_privacy').checked=!!f.privacy;$('#f_brand').checked=!!f.brand;
  fileUI();expUpdate();refUpdate();
}
function appToForm(a){const fm=D().files[a.attach.fileId];
  return {ay:a.ay,term:a.term,sid:a.sid,prog:a.program,year:a.year,adv:a.route.adviser,conf:a.conf.title,start:a.conf.start,end:a.conf.end,venue:a.conf.venue,org:a.conf.org,etype:a.conf.etype,scope:a.conf.scope,cls:a.paper.cls,ptype:a.paper.ptype,index:a.paper.index,title:a.paper.title,cof:a.paper.coF,cos:a.paper.coS,
    exp:a.expenses.map(x=>({amount:x.amount,remarks:x.remarks})),file:{id:fm.id,orig:fm.orig,size:fm.size},attConfirm:true,privacy:true,brand:true}}
function fileUI(){
  const f=FS.file,pv=$('#f_prev');
  $('#f_attname').textContent=f?f.orig+' ('+fmtSize(f.size)+')':'No file chosen.';
  pv.hidden=!f;pv.dataset.id=f?f.id:'';
  const a=FS.appId&&D().apps.find(x=>x.id===FS.appId);
  const f2=readForm();
  $('#f_newname').textContent=a?a.ref+(f&&f.id!==a.attach.fileId?'-v'+(a.attach.version+1):'')+'.pdf':C.nextRef(f2.ay||'2627',f2.term||'Term1')+'.pdf';
}
function refUpdate(){
  const a=FS.appId&&D().apps.find(x=>x.id===FS.appId),f=readForm();
  $('#refPrev').textContent=a?'Reference '+a.ref+' · resubmission':'Next reference: '+C.nextRef(f.ay||'2627',f.term||'Term1')+' (assigned on submit)';
  fileUI();
}
function expUpdate(){
  const t=C.total(readForm().exp.map(x=>({v:x.amount})),'v');$('#exTotal').textContent=money(t);
  const cap=C.CAP[$('#f_scope').value];
  $('#exNote').textContent=cap?(t>cap?'Above the ₱'+money(cap)+' limit by ₱'+money(round2(t-cap))+'. Reduce the amounts: the application cannot be submitted.':'Within the ₱'+money(cap)+' limit for '+C.regionLabel($('#f_scope').value)+'.'):'Choose where the event takes place in step 1 to see the limit.';
  $('#exNote').style.color=cap&&t>cap?'var(--bad)':'';
}
function showErrs(errs){
  $$('#appForm .msg').forEach(m=>m.textContent='');$$('#appForm .field').forEach(f=>f.classList.remove('invalid'));
  errs.forEach(e=>{const el=$('#'+e.id),fld=el&&el.closest('.field'),m=fld?fld.querySelector('.msg'):$('#m_'+e.id);if(fld)fld.classList.add('invalid');if(m)m.textContent=e.msg});
}
function fShow(){
  $$('[data-fs]').forEach(c=>c.hidden=+c.dataset.fs!==FS.step);
  $$('#fsteps li').forEach((s,i)=>s.className=i<FS.step?'done':i===FS.step?'now':'');
  $('#fBack').disabled=FS.step===0;
  $('#fNext').textContent=FS.step===4?(FS.mode==='edit'?'Resubmit application':'Submit application'):'Next';
  $('#replyWrap').hidden=FS.mode!=='edit';
  if(FS.step===4)buildReview();
}
function buildReview(){
  const f=readForm(),pr=C.PROGRAMS.filter(p=>p[0]===f.prog)[0];
  const rows=[['Period',ayLabel(f.ay||'2627')+' · '+f.term.replace('Term','Term ')],['Student',u().name+' · ID '+f.sid+' · '+(pr?pr[0]:'')+' · year '+f.year],['Thesis Adviser',C.nameOf(f.adv)||'–'],['Department Chair (from your program)',C.nameOf(D().settings.chairs[f.prog])||'–'],['Associate Dean (set once)',C.nameOf(D().settings.assoc)],['Dean',C.nameOf(D().settings.dean)],
    ['Conference',f.conf+' · '+fmtD(f.start)+' to '+fmtD(f.end)+' · '+f.venue],['Organizer · type',f.org+' · '+f.etype],['Event location',C.regionLabel(f.scope)],['Paper',f.title+' ('+f.ptype+', '+f.cls+', '+f.index+')'],['Projected total','₱'+money(C.total(f.exp.map(x=>({v:x.amount})),'v'))],['Attachment',f.file?f.file.orig:'none']];
  $('#review').innerHTML=rows.map(r=>'<dt>'+r[0]+'</dt><dd>'+esc(r[1])+'</dd>').join('');
  const adv=C.advisories(u().email,f.ay,FS.appId);
  $('#advis').innerHTML=adv.length?'<div class="callout" style="margin-top:10px">Note for reviewers: you already have '+adv.map(a=>'<b>'+a.ref+'</b> ('+esc(C.info(a).label)+')').join(', ')+' in '+ayLabel(f.ay)+'. The grant is available once every academic year, so the adviser and staff will confirm eligibility. This does not block your submission.</div>':'';
}
R.form=function(){
  const body=$('#formBody'),draft=D().drafts[u().email];
  if(FS.done){body.innerHTML=FS.done;return}
  body.innerHTML='<div class="screen"><div class="screen-bar"><b id="fTitle">New application</b><span class="mono" id="refPrev"></span></div><div class="screen-body">'+formHTML()+'</div></div>';
  $('#fTitle').textContent=FS.mode==='edit'?'Edit and resubmit':'New application · Draft';
  if(FS.mode==='edit'&&FS.appId){const a=D().apps.find(x=>x.id===FS.appId);writeForm(appToForm(a));$('#f_ay').disabled=true;$('#f_term').disabled=true;
    body.insertAdjacentHTML('afterbegin','<div class="callout" style="margin-bottom:12px">Returned by '+esc(a.returned.by)+' ('+CH[a.returned.role].label+'): '+esc(a.returned.why)+'</div>')}
  else if(draft){writeForm(draft);body.insertAdjacentHTML('afterbegin','<div class="callout info" style="margin-bottom:12px">Your saved draft was restored. <button class="lnk" data-act="fdiscard">Discard draft</button></div>')}
  else{writeForm({ay:'2627',term:'Term1',prog:u().program,exp:C.EXPENSE_TYPES.map(()=>({amount:'',remarks:''}))})}
  FS.step=0;fShow();expUpdate();refUpdate();
};
document.addEventListener('input',e=>{if(e.target.closest&&e.target.closest('#appForm')){if(e.target.classList.contains('ex'))expUpdate();if(e.target.id==='f_ay'||e.target.id==='f_term')refUpdate()}});
document.addEventListener('change',e=>{
  if(e.target.id==='f_scope')expUpdate();
  if(e.target.id==='f_ay'||e.target.id==='f_term')refUpdate();
  if(e.target.id==='f_file'){const f=e.target.files[0];if(!f)return;const bad=!/\.pdf$/i.test(f.name)?'The attachment must be a single PDF file.':f.size>10*1048576?'The file is larger than 10 MB.':'';
    if(bad){$('#m_f_filebtn').textContent=bad;e.target.value='';return}
    const m=C.registerFile({orig:f.name,size:f.size,type:'application/pdf',by:u().name});C.FILES.put(m.id,f).then(()=>{FS.file={id:m.id,orig:m.orig,size:m.size};$('#m_f_filebtn').textContent='';fileUI()})}
});
ACT.pickfile=()=>$('#f_file').click();
ACT.fdiscard=()=>{delete D().drafts[u().email];C.save();R.form()};
ACT.fdraft=()=>{D().drafts[u().email]=readForm();C.save();toast('Draft saved on this browser. You can return to it any time.')};
document.addEventListener('click',e=>{if(e.target.id==='fBack'&&FS.step>0){FS.step--;$('#formErr').hidden=true;fShow()}});
ACT.ffill=function(){
  const pdf=C.makePdf('Consolidated requirements (sample)',['SAMPLE FILE for the demo.','1. Copy of the paper (full text)','2. Letter of acceptance or notification','3. Proof of indexing (Scopus)']);
  const m=C.registerFile({orig:'consolidated-requirements.pdf',size:pdf.size,type:'application/pdf',by:u().name});
  C.FILES.put(m.id,pdf).then(()=>{
    writeForm({ay:'2627',term:'Term1',sid:'12145678',prog:u().program||'BSCS',year:'4',adv:'adviser.reyes@college.example',conf:'Sample International Conference on Applied Computing (SICAC 2027)',start:'2027-01-18',end:'2027-01-20',venue:'Tokyo, Japan',org:'Sample Applied Computing Society',etype:'Conference',scope:'intl',cls:'Paper presenter',ptype:'Full paper',index:'Scopus',title:'Sample Title on Federated Learning',cof:'Dr. Paolo Reyes',cos:'',
      exp:[5000,600,4400,3000,2000].map((n,i)=>({amount:n||'',remarks:''})),file:{id:m.id,orig:m.orig,size:m.size},attConfirm:true,privacy:true,brand:true});
    toast('Example data filled in, with a sample PDF attached.');if(FS.step===4)buildReview();
  });
};
ACT.fnext=function(){
  const f=readForm(),errs=C.validateForm(f);
  if(FS.step<4){const here=errs.filter(e=>e.step===FS.step);showErrs(here);if(here.length){const el=$('#'+here[0].id);if(el&&el.focus)el.focus();return}FS.step++;$('#formErr').hidden=true;fShow();return}
  showErrs(errs);
  if(errs.length){FS.step=errs[0].step;fShow();showErrs(errs);const box=$('#formErr');box.className='callout bad';box.hidden=false;box.innerHTML='<b>Some required items are missing:</b> '+errs.map(e=>esc(e.msg)).join(' ');const el=$('#'+errs[0].id);if(el&&el.focus)el.focus();return}
  let res;
  if(FS.mode==='edit'){const a=D().apps.find(x=>x.id===FS.appId);res=E.resubmit(u(),a,f,$('#f_reply').value,[])}
  else res=E.submit(u(),f);
  if(res.err){const box=$('#formErr');box.className='callout bad';box.hidden=false;box.textContent=res.err;return}
  const a=res.app||D().apps.find(x=>x.id===FS.appId);
  delete D().drafts[u().email];C.save();
  FS.done='<div class="screen"><div class="screen-bar"><b>'+(FS.mode==='edit'?'Resubmitted':'Submitted')+'</b><span class="mono">'+esc(a.ref)+'</span></div><div class="screen-body"><div class="callout ok"><b>'+(FS.mode==='edit'?'Resubmitted':'Submitted')+' as '+esc(a.ref)+'.</b> '+(FS.mode==='edit'?'The file went back to the '+CH[CHAIN[a.stage]].label+'.':'Your Thesis Adviser, '+esc(C.nameOf(a.route.adviser))+', was notified by email and in-app.')+' Your PDF was saved as <span class="mono">'+esc(D().files[a.attach.fileId].name)+'</span>.</div>'+stepsHTML(a)+
    '<p class="muted">Routing continues automatically after each decision. You will be notified at every step.</p><div style="display:flex;flex-wrap:wrap;gap:8px"><button class="btn" data-open="'+a.id+'">Open the application</button><button class="btn sec" data-act="fnew">Start another</button><button class="btn sec" data-go="dash">Go to dashboard</button></div></div></div>';
  FS.mode='new';FS.appId=null;FS.file=null;R.form();
};
ACT.fnew=()=>{FS.done=null;FS.mode='new';FS.appId=null;FS.file=null;R.form()};
ACT.editapp=()=>{FS.done=null;FS.mode='edit';FS.appId=state.curApp;show('form',true)};

/* ---------- post-activity report (student) ---------- */
const PS={appId:null,file:null,done:null,rows:[]};
const blankRow=type=>({type:type||C.EXPENSE_TYPES[0],or:'',merchant:'',amount:''});
function parRow(r,i){
  return '<tr><td><select class="pr-type" aria-label="Expense type">'+C.EXPENSE_TYPES.map(t=>opt(t,t,r.type===t)).join('')+'</select></td>'+
   '<td><input class="pr-or" aria-label="OR or invoice number" value="'+esc(r.or)+'" maxlength="40"></td><td><input class="pr-mer" aria-label="Merchant name" value="'+esc(r.merchant)+'" maxlength="80"></td>'+
   '<td class="r"><input class="pr-amt" type="number" min="0" step="0.01" aria-label="Amount to be reimbursed in pesos" value="'+esc(r.amount)+'" style="width:120px;text-align:right"></td>'+
   '<td><button type="button" class="btn sm ghost" data-act="parrm" data-i="'+i+'" aria-label="Remove this receipt">Remove</button></td></tr>';
}
const readRows=()=>$$('#parRows tr').map(tr=>({type:tr.querySelector('.pr-type').value,or:tr.querySelector('.pr-or').value,merchant:tr.querySelector('.pr-mer').value,amount:tr.querySelector('.pr-amt').value}));
function renderRows(){$('#parRows').innerHTML=PS.rows.map(parRow).join('');parCalc()}
ACT.paradd=()=>{PS.rows=readRows();PS.rows.push(blankRow());renderRows()};
ACT.parrm=t=>{PS.rows=readRows();PS.rows.splice(+t.dataset.i,1);if(!PS.rows.length)PS.rows.push(blankRow());renderRows()};
R.par=function(){
  if($('#parRows'))PS.rows=readRows();
  const body=$('#parBody'),all=D().apps.filter(a=>a.studentEmail===u().email),open=all.filter(a=>a.status==='approved'&&['none','returned'].indexOf(a.post.status)>-1);
  if(PS.done){body.innerHTML=PS.done;return}
  const prevApp=PS.appId;
  if(C.parSel&&open.some(a=>a.id===C.parSel))PS.appId=C.parSel;C.parSel=null;
  if(!open.some(a=>a.id===PS.appId))PS.appId=open[0]&&open[0].id;
  const other=all.filter(a=>a.status==='approved'&&a.post.status==='submitted'||a.status==='verified'||a.status==='completed');
  if(!open.length){body.innerHTML='<div class="callout">You have no approved grant waiting for a post-activity report.</div>'+(other.length?'<div class="card" style="margin-top:12px"><h3>Already submitted</h3>'+listTable(other,{noStudent:true})+'</div>':'')+'<p style="margin-top:12px"><button class="btn sec" data-go="dash">Back to dashboard</button></p>';return}
  const a=D().apps.find(x=>x.id===PS.appId),p=a.post,v=p.verify;
  if(a.id!==prevApp||!PS.rows.length)PS.rows=p.items&&p.items.length?p.items.map(x=>({type:x.type,or:x.or,merchant:x.merchant,amount:x.amount})):a.expenses.filter(x=>x.amount>0).map(x=>blankRow(x.type));
  const flagged=v&&v.returns?C.REQ_POST.filter(r=>v.returns[r[0]]):[];
  const left=C.daysBetween(C.manilaToday(),C.dueDate(a));
  body.innerHTML='<div class="screen"><div class="screen-bar"><b>Post-activity report</b><span class="mono">'+esc(a.ref)+'</span></div><div class="screen-body">'+
   (open.length>1?'<div class="field"><label for="p_app">Application</label><select id="p_app">'+open.map(x=>opt(x.id,x.ref+' · '+x.conf.title,x.id===a.id)).join('')+'</select></div>':'')+
   '<div class="grid g2"><dl class="who"><dt>Conference</dt><dd>'+esc(a.conf.title)+'</dd><dt>Dates</dt><dd>'+fmtD(a.conf.start)+' to '+fmtD(a.conf.end)+'</dd><dt>Due</dt><dd><b>'+fmtD(C.dueDate(a))+'</b> ('+C.PAR_DAYS+' days after the end date)'+(C.manilaToday()>=a.conf.end?(left<0?' · <b style="color:var(--bad)">overdue by '+(-left)+' day'+(left===-1?'':'s')+'</b>':' · '+left+' day'+(left===1?'':'s')+' left'):'')+'</dd><dt>Approved grant</dt><dd><b>₱'+money(a.grant.total)+'</b></dd></dl>'+
   '<div class="callout info"><b>Reminder: put all post-conference documents in ONE consolidated PDF:</b><ol>'+C.REQ_POST.map(r=>'<li>'+r[1]+'</li>').join('')+'</ol></div></div>'+
   (a.post.status==='returned'?'<div class="callout"><b>Returned by the Administrative Assistant:</b> '+esc(v&&v.overall||'see the remarks below')+(flagged.length?'<br><b>Requirements to clarify or resubmit:</b>':'')+(v?'<ul>'+flagged.map(r=>'<li>'+r[1]+(v.remarks[r[0]]?': '+esc(v.remarks[r[0]]):'')+'</li>').join('')+C.REQ_POST.filter(r=>!v.returns[r[0]]&&v.remarks[r[0]]).map(r=>'<li>'+r[1]+': '+esc(v.remarks[r[0]])+'</li>').join('')+'</ul>':'')+'<span class="muted">Upload the corrected PDF. It is saved as a new version (for example '+esc(a.ref)+'-PAR-v'+(p.cycle+1)+') and the original stays on record.</span></div>':'')+
   '<h3>Receipts and amounts to be reimbursed</h3><p class="muted">List each receipt or invoice. Amounts are in pesos. The total cannot be more than your approved grant of ₱'+money(a.grant.total)+'.</p>'+
   '<div class="tbl"><table><thead><tr><th>Expense</th><th>OR or invoice no.</th><th>Merchant name</th><th class="r">Amount (₱)</th><th></th></tr></thead><tbody id="parRows"></tbody><tfoot><tr><th colspan="3">Total to be reimbursed</th><th class="r num" id="pl_total">0</th><th></th></tr></tfoot></table></div>'+
   '<div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:8px"><button type="button" class="btn sec sm" data-act="paradd">Add a receipt</button><span id="pl_note" class="muted" data-grant="'+a.grant.total+'"></span></div><div class="msg" id="p_msg_lines" style="color:var(--bad);font-size:12px"></div>'+
   '<h3 style="margin-top:16px">Documents included in the PDF</h3><div class="chk-grid">'+C.REQ_POST.map(r=>'<label class="chk"><input type="checkbox" class="pl-doc" data-k="'+r[0]+'"'+((p.docs||{})[r[0]]?' checked':'')+'><span>'+r[1]+'</span></label>').join('')+'</div>'+
   '<div class="field" style="margin-top:8px"><label for="p_missing">If something is not included, say why</label><textarea id="p_missing" rows="2">'+esc(p.missingNote||'')+'</textarea></div>'+
   '<div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:8px"><input id="p_file" type="file" accept="application/pdf,.pdf" hidden><button type="button" class="btn sec" data-act="parpick">Choose the consolidated PDF</button><span id="p_attname" class="muted">No file chosen.</span><button type="button" class="btn sm sec" id="p_prev" data-act="preview" data-id="" hidden>Preview</button></div>'+
   '<p class="muted" style="margin-top:6px">Saved as <b class="mono">'+esc(a.ref)+'-PAR'+(p.cycle?'-v'+(p.cycle+1):'')+'.pdf</b>, in the designated Google Drive folder.</p>'+viewerHTML()+
   '<div id="p_err" class="callout bad" hidden style="margin-top:10px"></div><div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px"><button class="btn" id="parSubmit" data-act="parsubmit">Submit post-activity report</button><button class="btn sec" data-act="parfill">Fill example</button></div></div></div>';
  PS.file=null;renderRows();
};
function parCalc(){
  const note=$('#pl_note');if(!note)return;
  const t=round2($$('.pr-amt').reduce((s,i)=>s+(Number(i.value)||0),0)),g=Number(note.dataset.grant),over=t>g;
  $('#pl_total').textContent=money(t);
  note.textContent=over?'Above your approved grant of ₱'+money(g)+' by ₱'+money(round2(t-g))+'. It will not be accepted. Reduce the amounts.':'Within your approved grant of ₱'+money(g)+'.';
  note.style.color=over?'var(--bad)':'';
  const b=$('#parSubmit');if(b)b.disabled=over;
}
document.addEventListener('input',e=>{if(e.target.classList&&e.target.classList.contains('pr-amt'))parCalc()});
document.addEventListener('change',e=>{
  if(e.target.id==='p_app'){PS.appId=e.target.value;PS.rows=[];R.par()}
  if(e.target.id==='p_file'){const f=e.target.files[0];if(!f)return;if(!/\.pdf$/i.test(f.name)||f.size>10*1048576){toast('The report must be a single PDF under 10 MB.');e.target.value='';return}
    const m=C.registerFile({orig:f.name,size:f.size,type:'application/pdf',by:u().name});C.FILES.put(m.id,f).then(()=>{PS.file={id:m.id,orig:m.orig,size:m.size};parFile()})}
});
function parFile(){const f=PS.file;$('#p_attname').textContent=f?f.orig+' ('+fmtSize(f.size)+')':'No file chosen.';$('#p_prev').hidden=!f;$('#p_prev').dataset.id=f?f.id:''}
ACT.parpick=()=>$('#p_file').click();
ACT.parfill=function(){
  const a=D().apps.find(x=>x.id===PS.appId),shops={'Registration fee':'Sample Conference Secretariat','Pre-departure fees':'Sample Visa Center','Roundtrip airfare':'Sample Airlines','Accommodation':'Sample Hotel','Per diem':'Sample Meals Co.'};
  PS.rows=C.suggestItems(a).map((x,n)=>({type:x.type,or:'OR-'+(5100+n),merchant:shops[x.type],amount:x.amount}));renderRows();
  $$('.pl-doc').forEach(c=>c.checked=true);
  const pdf=C.makePdf('Post-activity documents (sample)',['SAMPLE FILE for the demo.'].concat(C.REQ_POST.map((r,i)=>(i+1)+'. '+r[1])));
  const m=C.registerFile({orig:'post-activity-documents.pdf',size:pdf.size,type:'application/pdf',by:u().name});
  C.FILES.put(m.id,pdf).then(()=>{PS.file={id:m.id,orig:m.orig,size:m.size};parFile();toast('Example data filled in, with a sample PDF attached.')});
};
ACT.parsubmit=function(){
  const a=D().apps.find(x=>x.id===PS.appId),docs={};$$('.pl-doc').forEach(c=>docs[c.dataset.k]=c.checked);
  const res=E.submitPost(u(),a,{file:PS.file,items:readRows(),docs,missingNote:$('#p_missing').value});
  if(res.err){const b=$('#p_err');b.hidden=false;b.textContent=res.err;b.scrollIntoView({block:'center'});return}
  PS.done='<div class="screen"><div class="screen-bar"><b>Report submitted</b><span class="mono">'+esc(a.ref)+'</span></div><div class="screen-body"><div class="callout ok"><b>Submitted.</b> Saved as <span class="mono">'+esc(D().files[a.post.fileId].name)+'</span>. The Administrative Assistant was notified and will verify your documents.</div><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" data-open="'+a.id+'">Open the application</button><button class="btn sec" data-act="parnew">Back</button></div></div></div>';
  PS.file=null;PS.rows=[];R.par();
};
ACT.parnew=()=>{PS.done=null;R.par()};

/* ---------- start ---------- */
C.start=function(){
  C.load();E.autoRemind();buildLogin();
  let em=null;try{em=sessionStorage.getItem('ccs-scgss-user')}catch(e){}
  let h='';try{h=location.hash.slice(1)}catch(e){}
  const acc=em&&C.acct(em);if(acc)doLogin(acc,h);
};
})(window.CCS);
