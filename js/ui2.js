/* CCS SCGSS v3.0 screens, part 2: tracking, verification, reimbursement report, Google records, notifications, settings, simulation. */
(function(C){
"use strict";
const {$,$$,money,esc,fmtT,fmtD,fmtSize,round2}=C.u;
const E=C.E,D=()=>C.db,R=C.R,ACT=C.ACT,state=C.state,CH=C.CH,CHAIN=C.CHAIN;
const u=()=>state.user,toast=m=>C.toast(m);
const opt=(v,l,sel)=>'<option value="'+esc(v)+'"'+(sel?' selected':'')+'>'+esc(l)+'</option>';
const csv=rows=>rows.map(r=>r.map(c=>{c=String(c==null?'':c);return /[",\n]/.test(c)?'"'+c.replace(/"/g,'""')+'"':c}).join(',')).join('\r\n');
function download(name,text,type){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type:type||'text/csv'}));a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),2000)}

/* ---------- tracking table ---------- */
const TF={q:'',g:'',p:'',k:'',f:''};
R.track=function(){
  const all=D().apps,keys=Array.from(new Set(all.map(a=>a.key))).sort();
  const list=all.filter(a=>C.matches(a,TF.q)&&(!TF.g||C.info(a).group===TF.g)&&(!TF.p||a.program===TF.p)&&(!TF.k||a.key===TF.k)&&(!TF.f||C.fundsOf(a).toLowerCase().indexOf(TF.f.toLowerCase())>-1));
  $('#trackBody').innerHTML='<div class="screen"><div class="screen-bar"><b>All applications</b><span class="mono">Role: '+esc(u().label)+'</span></div><div class="screen-body">'+
   '<div class="row"><div class="field"><label for="t_q">Search</label><input id="t_q" type="search" value="'+esc(TF.q)+'" placeholder="Reference, student, conference, program"></div>'+
   '<div class="field"><label for="t_g">Stage</label><select id="t_g"><option value="">All</option>'+[['pending','In approval'],['returned','Returned'],['approved','Approved, report due'],['post','Report or reimbursement'],['completed','Completed'],['rejected','Rejected']].map(g=>opt(g[0],g[1],TF.g===g[0])).join('')+'</select></div>'+
   '<div class="field"><label for="t_p">Degree program</label><select id="t_p"><option value="">All</option>'+C.PROGRAMS.map(p=>opt(p[0],p[0],TF.p===p[0])).join('')+'</select></div>'+
   '<div class="field"><label for="t_k">AY and term</label><select id="t_k"><option value="">All</option>'+keys.map(k=>opt(k,k,TF.k===k)).join('')+'</select></div>'+
   '<div class="field"><label for="t_f">Funding source contains</label><input id="t_f" type="search" value="'+esc(TF.f)+'" placeholder="Any funding source"></div></div>'+
   '<div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;align-items:center"><span class="muted">'+list.length+' of '+all.length+' applications</span><button class="btn sec sm" data-act="trkcsv">Export filtered rows (CSV)</button></div>'+
   (list.length?'<div class="tbl"><table><thead><tr><th>Reference</th><th>Student</th><th>Conference</th><th>Stage</th><th>Next action by</th><th>Funding</th><th class="r">Approved (₱)</th><th>RFP</th><th>Updated</th></tr></thead><tbody>'+
   list.sort((a,b)=>b.updated-a.updated).map(a=>{const i=C.info(a);return '<tr><td><button class="lnk mono" data-open="'+a.id+'">'+esc(a.ref)+'</button></td><td>'+esc(a.studentName)+' <span class="muted">· '+a.program+'</span></td><td>'+esc(a.conf.title)+'</td><td><span class="pill '+i.cls+'">'+esc(i.label)+'</span></td><td>'+esc(i.by)+(i.who&&a.status==='pending'?'<div class="muted">'+esc(i.who)+'</div>':'')+'</td><td>'+(C.fundsOf(a)?esc(C.fundsOf(a)):'<span class="muted">Not yet set</span>')+'</td><td class="r num">'+(a.grant?money(a.grant.total):'–')+'</td><td class="mono">'+(a.report?esc(a.report.rfp):'–')+'</td><td class="mono muted">'+fmtT(a.updated).slice(5)+'</td></tr>'}).join('')+'</tbody></table></div>':'<div class="empty-note">No applications match these filters.</div>')+'</div></div>';
};
document.addEventListener('input',e=>{const m={t_q:'q',t_g:'g',t_p:'p',t_k:'k',t_f:'f'};if(m[e.target.id]){TF[m[e.target.id]]=e.target.value;const p=e.target.selectionStart;R.track();const el=$('#'+e.target.id);if(el){el.focus();try{el.setSelectionRange(p,p)}catch(x){}}}});
ACT.trkcsv=()=>{const all=D().apps.filter(a=>C.matches(a,TF.q)&&(!TF.g||C.info(a).group===TF.g)&&(!TF.p||a.program===TF.p)&&(!TF.k||a.key===TF.k));download('applications-'+new Date().toISOString().slice(0,10)+'.csv',csv([C.SHEET_COLS.map(c=>c[0])].concat(all.map(a=>C.SHEET_COLS.map(c=>c[1](a))))))};

/* ---------- verification (Administrative Assistant) ---------- */
const VS={f:'submitted'};
const postApps=()=>D().apps.filter(a=>a.post.status!=='none');
R.verify=function(){
  const all=postApps(),f={submitted:a=>a.post.status==='submitted',returned:a=>a.post.status==='returned',verified:a=>a.post.status==='verified',all:()=>true};
  if(C.verifySel){VS.sel=C.verifySel;C.verifySel=null}
  const list=all.filter(f[VS.f]);
  $('#verifyBody').innerHTML='<div class="kpis chips">'+[['submitted','For verification'],['returned','Returned to student'],['verified','Verified'],['all','All reports']].map(c=>'<button type="button" class="kpi" data-act="vfilter" data-f="'+c[0]+'" aria-pressed="'+(VS.f===c[0])+'"><b>'+all.filter(f[c[0]]).length+'</b><span>'+c[1]+'</span></button>').join('')+'</div>'+
   '<div class="card" style="margin-top:14px">'+(list.length?'<div class="tbl"><table><thead><tr><th>Reference</th><th>Student</th><th>Conference</th><th class="r">Grant (₱)</th><th class="r">Listed (₱)</th><th>Report</th><th></th></tr></thead><tbody>'+list.map(a=>'<tr'+(a.id===VS.sel?' class="sel"':'')+'><td class="mono">'+esc(a.ref)+'</td><td>'+esc(a.studentName)+'</td><td>'+esc(a.conf.title)+'</td><td class="r num">'+money(a.grant.total)+'</td><td class="r num">'+money(a.post.claimedTotal)+'</td><td>'+(C.info(a).label)+'</td><td><button class="btn sm" data-act="vopen" data-id="'+a.id+'">Open</button></td></tr>').join('')+'</tbody></table></div>':'<div class="empty-note">No reports in this list.</div>')+'</div><div id="vpanel" style="margin-top:14px"></div>';
  if(VS.sel&&D().apps.some(a=>a.id===VS.sel))panel(D().apps.find(a=>a.id===VS.sel));
};
ACT.vfilter=t=>{VS.f=t.dataset.f;VS.sel=null;R.verify()};
ACT.vopen=t=>{VS.sel=t.dataset.id;R.verify();$('#vpanel').scrollIntoView({behavior:'smooth'})};
function panel(a){
  const p=a.post,v=p.verify,edit=a.status==='approved'&&p.status==='submitted'&&u().role==='admin',ro=!edit;
  const dis=ro?' disabled':'',done=a.status==='verified'||a.status==='completed';
  const docRows=C.REQ_POST.map(r=>'<tr><td>'+r[1]+'</td><td>'+(p.docs&&p.docs[r[0]]?'<span class="pill p-ok">Included</span>':'<span class="pill p-warn">Not ticked</span>')+'</td><td><input type="checkbox" class="vk" data-k="'+r[0]+'" aria-label="Verified: '+r[1]+'"'+(v&&v.checks[r[0]]?' checked':'')+dis+'></td><td><input type="checkbox" class="vq" data-k="'+r[0]+'" aria-label="Return to the student: '+r[1]+'"'+(v&&v.returns&&v.returns[r[0]]?' checked':'')+dis+'></td><td><input class="vr" data-k="'+r[0]+'" aria-label="Remarks for '+r[1]+'" value="'+esc(v&&v.remarks[r[0]]||'')+'" style="width:100%"'+dis+'></td></tr>').join('');
  const itemRows=p.items.map((l,i)=>{
    const w=v&&v.items&&v.items[i],ex=a.expenses.find(e=>e.type===l.type),pre=w&&w.approved!=null?w.approved:l.amount;
    return '<tr><td>'+esc(l.type)+'</td><td><input class="vo" aria-label="OR or invoice number for '+esc(l.type)+'" value="'+esc(w?w.or:l.or)+'" maxlength="40" style="width:100%"'+dis+'></td><td><input class="vm" aria-label="Merchant name for '+esc(l.type)+'" value="'+esc(w?w.merchant:l.merchant)+'" maxlength="80" style="width:100%"'+dis+'></td>'+
     '<td class="r num">'+money(l.amount)+'</td><td class="r"><input class="va" type="number" min="0" step="0.01" value="'+pre+'" aria-label="Approved amount for '+esc(l.type)+'" style="width:110px;text-align:right"'+dis+'></td>'+
     '<td><input class="vf" type="text" maxlength="80" value="'+esc(w&&w.fund?w.fund:a.grant.fund)+'" placeholder="Funding source" aria-label="Funding source for '+esc(l.type)+'" style="width:100%"'+dis+'></td><td><input class="vw" value="'+esc(w&&w.why||'')+'" aria-label="Remarks for '+esc(l.type)+'" style="width:100%"'+dis+'></td></tr>'}).join('');
  $('#vpanel').innerHTML='<div class="screen"><div class="screen-bar"><b>'+esc(a.ref)+' · '+esc(a.studentName)+'</b><span class="mono">'+(ro?'Read only':'Role: Administrative Assistant')+'</span></div><div class="screen-body">'+
   '<div class="kpis"><div class="kpi"><b>₱'+money(a.grant.total)+'</b><span>Total amount of grant approved by the Dean</span></div><div class="kpi"><b>₱'+money(p.claimedTotal)+'</b><span>Listed by the student</span></div><div class="kpi"><b id="vs_appr">₱0</b><span>Approved for reimbursement</span></div><div class="kpi"><b id="vs_left">₱0</b><span>Left of the grant</span></div></div>'+
   '<div class="grid g2" style="margin-top:12px"><dl class="who"><dt>Conference</dt><dd>'+esc(a.conf.title)+'</dd><dt>Program</dt><dd>'+a.program+' · '+esc(a.studentName)+'</dd><dt>Report</dt><dd>Version '+p.cycle+' · submitted '+fmtT(p.submittedAt)+'</dd></dl>'+
   '<div>'+(p.missingNote?'<div class="callout">Student note on missing items: '+esc(p.missingNote)+'</div>':'')+(v&&p.status==='returned'?'<div class="callout">Returned: '+esc(v.overall)+'</div>':'')+'</div></div>'+
   '<h3>Documents</h3>'+C.docsHTML(a,true)+
   '<h3>Checklist: tick each item found in the PDF, or flag it to return to the student</h3><div class="tbl"><table><thead><tr><th>Item</th><th>Student says</th><th>Verified</th><th>Return</th><th>Remarks, changes or corrections</th></tr></thead><tbody>'+docRows+'</tbody></table></div>'+
   '<h3>Reimbursement per item</h3><p class="muted">Check each receipt against the PDF. You can correct the OR or invoice number, the merchant name, the amount and the funding source, and add a remark for each item.</p><div class="tbl"><table><thead><tr><th>Expense</th><th>OR or invoice no.</th><th>Merchant</th><th class="r">Listed (₱)</th><th class="r">Approved (₱)</th><th>Funding source</th><th>Remarks</th></tr></thead><tbody>'+itemRows+'</tbody><tfoot><tr><th colspan="3">Total · grant ₱'+money(a.grant.total)+'</th><th class="r num">'+money(p.claimedTotal)+'</th><th class="r num" id="va_total">0</th><th colspan="2" id="va_note" class="muted" style="text-transform:none;letter-spacing:0;font-weight:400"></th></tr></tfoot></table></div>'+
   clarifyHTML(a)+
   '<div class="field"><label for="v_overall">Overall remarks</label><textarea id="v_overall" rows="2"'+dis+'>'+esc(v&&v.overall||'')+'</textarea></div><div class="msg" id="v_msg" style="color:var(--bad);font-size:12px"></div>'+
   (edit?'<div style="display:flex;flex-wrap:wrap;gap:8px"><button class="btn" data-act="vverify">Verify and approve amounts</button><button class="btn warn" data-act="vreturn">Return to student</button><button class="btn sec" data-act="vsave">Save progress</button></div>'
     :done?'<div class="callout ok">Verified by '+esc(v.by)+' on '+fmtT(v.at)+'. Approved reimbursement ₱'+money(v.total)+'.</div><div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:8px"><button class="btn" data-act="rdl" data-id="'+a.id+'">Download Reimbursement Report</button><button class="btn sec" data-act="rptopen" data-id="'+a.id+'">Open the report'+(a.status==='verified'&&u().role==='admin'?' and record the RFP':'')+'</button></div>':'<div class="callout">Waiting for the student.</div>')+
   '</div></div>';
  vTotals();
}
/* The Administrative Assistant asks the Dean about a funding source or a final approved amount, without leaving the verification screen */
function clarifyThread(a){
  const d=a.route.dean,list=a.comments.filter(c=>c.topic||c.email===d||(c.to&&c.to.indexOf(d)>-1));
  return list.length?list.map(c=>C.commentItem(c,u().email)).join(''):'<p class="muted">No questions yet.</p>';
}
function clarifyHTML(a){
  const dean=C.nameOf(a.route.dean),items=a.post.items,ask=u().role==='admin';
  return '<div class="card" style="margin-top:12px"><h3>Clarify with the '+(a.route.dean!==D().settings.dean?'approver':'Dean')+'</h3><p class="muted">Ask '+esc(dean)+' about a funding source or a final approved amount. They are notified by email and in-app, and answer in Messages on the application page. The conversation shows here.</p>'+
   '<div class="thread" id="q_thread" style="margin-top:8px">'+clarifyThread(a)+'</div>'+
   (ask?'<div class="row" style="margin-top:10px"><div class="field"><label for="q_item">About</label><select id="q_item"><option value="">All items</option>'+items.map(l=>opt(l.type+' · '+l.or,l.type+' · '+l.or+' · ₱'+money(l.amount))).join('')+'</select></div>'+
   '<div class="field"><label for="q_kind">Topic</label><select id="q_kind"><option>Funding source</option><option>Final approved amount</option><option>Other</option></select></div></div>'+
   '<div class="field" style="margin-top:8px"><label for="q_text">Your question</label><textarea id="q_text" rows="2" placeholder="For example: May the airfare be charged to the College Fund instead of the Dean\'s Office fund?"></textarea></div><div class="msg" id="q_msg" style="color:var(--bad);font-size:12px"></div><button type="button" class="btn sec" data-act="askdean" style="margin-top:6px">Send to '+esc(dean)+'</button>':'')+'</div>';
}
ACT.askdean=async function(){
  const a=D().apps.find(x=>x.id===VS.sel),t=$('#q_text').value,item=$('#q_item').value;
  const r=await E.comment(u(),a,t,[],[a.route.dean],{kind:$('#q_kind').value,item});
  if(r.err){$('#q_msg').textContent=r.err;return}
  $('#q_text').value='';$('#q_msg').textContent='';$('#q_thread').innerHTML=clarifyThread(D().apps.find(x=>x.id===a.id));toast('Sent. '+C.nameOf(a.route.dean)+' was notified by email and in-app. Your entries above are kept.');
};
function vTotals(){const el=$('#va_total');if(!el)return;const t=round2($$('.va').reduce((s,i)=>s+(Number(i.value)||0),0)),a=D().apps.find(x=>x.id===VS.sel),g=a.grant.total,over=t>g;el.textContent=money(t);
  $('#vs_appr').textContent='₱'+money(t);$('#vs_left').textContent='₱'+money(round2(g-t));$('#vs_left').style.color=over?'var(--bad)':'';
  $('#va_note').textContent=over?'Above the ₱'+money(g)+' grant approved by the Dean.':'Within the grant of ₱'+money(g)+'.';$('#va_note').style.color=over?'var(--bad)':''}
document.addEventListener('input',e=>{if(e.target.classList&&e.target.classList.contains('va'))vTotals()});
document.addEventListener('change',e=>{const c=e.target;if(!c.classList)return;
  if(c.classList.contains('vq')&&c.checked){const k=$('.vk[data-k="'+c.dataset.k+'"]');if(k)k.checked=false}
  if(c.classList.contains('vk')&&c.checked){const q=$('.vq[data-k="'+c.dataset.k+'"]');if(q)q.checked=false}});
function vCollect(){return {checks:Object.fromEntries($$('.vk').map(c=>[c.dataset.k,c.checked])),returns:Object.fromEntries($$('.vq').map(c=>[c.dataset.k,c.checked])),remarks:Object.fromEntries($$('.vr').map(i=>[i.dataset.k,i.value])),
  items:$$('.va').map((i,n)=>({approved:i.value,fund:$$('.vf')[n].value,or:$$('.vo')[n].value,merchant:$$('.vm')[n].value,why:$$('.vw')[n].value})),overall:$('#v_overall').value}}
async function vDo(mode,okMsg){const a=D().apps.find(x=>x.id===VS.sel),r=await E.postReview(u(),a,vCollect(),mode);if(r.err){$('#v_msg').textContent=r.err;toast(r.err);return}toast(okMsg);R.verify()}
ACT.vverify=()=>vDo('verify','Verified. The student was notified. You can now download the reimbursement report.');
ACT.vreturn=()=>vDo('return','Returned to the student with the requirements to clarify.');
ACT.vsave=()=>vDo('save','Progress saved.');

/* ---------- reimbursement report ---------- */
const FAO='FAO';
const dShort=ts=>fmtD(fmtT(ts).slice(0,10));
/* an endorser appears with the date they endorsed. If the same person already endorsed as the Thesis Adviser, the repeated step shows that date and says so. */
function signInfo(a,r){
  const d=a.decisions[r];if(!d)return '';
  if(d.d==='skipped'&&d.inPlace)return 'Not required: approves the grant in the Dean\'s place';
  if(d.d==='skipped'){const k=C.CHAIN.find(x=>a.decisions[x]&&a.decisions[x].email===d.email&&a.decisions[x].d==='endorsed');return 'Endorsed on '+(k?dShort(a.decisions[k].at)+' as '+CH[k].label:'')}
  return 'Endorsed on '+dShort(d.at);
}
const apprLabel=a=>a.route.dean!==D().settings.dean?'Associate Dean, approving in the Dean\'s place':'Dean';
const rptItems=a=>a.post.verify.items.filter(x=>x.approved>0); /* the report carries the final approved amounts only */
function reportHTML(a){
  const p=a.post,v=p.verify,dl=a.grant,sig=dl.signature,items=rptItems(a);
  const endorsed=['adviser','chair','assoc'].map(r=>'<td>'+CH[r].label+'<br><b>'+esc(C.nameOf(a.route[r]))+'</b><br><span class="muted2">'+esc(signInfo(a,r))+'</span></td>').join('');
  return '<div class="paper" id="rptPaper">'+
   '<div class="rp-head"><div><p class="rp-org">De La Salle University · College of Computer Studies</p><h3>Student Conference Grant · Reimbursement Report</h3></div><div class="rp-no"><span>Report no.</span><b class="mono">RR-'+esc(a.ref)+'</b>'+(a.report?'<span>Filed at FAO '+dShort(a.report.at)+'</span><span>RFP '+esc(a.report.rfp)+'</span>':'<span>Not yet filed at FAO</span>')+'</div></div>'+
   '<table class="rp"><tr><th>Application reference</th><td class="mono">'+esc(a.ref)+'</td><th>Academic year · term</th><td>'+C.ayLabel(a.ay)+' · '+a.term.replace('Term','Term ')+'</td></tr>'+
   '<tr><th>Student</th><td>'+esc(a.studentName)+'</td><th>ID number · program</th><td>'+esc(a.sid)+' · '+a.program+' · year '+a.year+'</td></tr>'+
   '<tr><th>Thesis Adviser</th><td>'+esc(C.nameOf(a.route.adviser))+'</td><th>Event location</th><td>'+esc(C.regionLabel(a.conf.scope))+'</td></tr>'+
   '<tr><th>Conference</th><td colspan="3">'+esc(a.conf.title)+' · '+esc(a.conf.org)+'</td></tr>'+
   '<tr><th>Dates · venue</th><td colspan="3">'+fmtD(a.conf.start)+' to '+fmtD(a.conf.end)+' · '+esc(a.conf.venue)+'</td></tr>'+
   '<tr><th>Paper</th><td colspan="3">'+esc(a.paper.title)+' ('+esc(a.paper.ptype)+', '+esc(a.paper.index)+')</td></tr></table>'+
   '<p class="rp-h">Grant approved by the '+esc(apprLabel(a))+'</p><table class="rp"><tr><th>Total amount of grant</th><td class="r">₱'+money(dl.total)+'</td><th>Funding source</th><td>'+esc(dl.fund)+'</td></tr><tr><th>Approved by</th><td>'+esc(dl.by)+'<br><span class="muted2">Approved '+dShort(dl.at)+'</span></td><th>Digital signature</th><td><img class="sigimg" src="'+sig+'" alt="Signature of '+esc(dl.by)+'"></td></tr></table>'+
   '<p class="rp-h">Itemised reimbursement (final approved amounts)</p><table class="rp"><tr><th>#</th><th>Expense</th><th>OR or invoice no.</th><th>Merchant</th><th class="r">Approved (₱)</th><th>Funding source</th><th>Remarks</th></tr>'+
   items.map((l,i)=>'<tr><td>'+(i+1)+'</td><td>'+esc(l.type)+'</td><td class="mono">'+esc(l.or)+'</td><td>'+esc(l.merchant)+'</td><td class="r">'+money(l.approved)+'</td><td>'+esc(l.fund)+'</td><td>'+esc(l.why)+'</td></tr>').join('')+
   '<tr><th colspan="4">Total reimbursement approved</th><th class="r">'+money(v.total)+'</th><th colspan="2"></th></tr></table>'+(v.overall?'<p class="rp-note">Remarks: '+esc(v.overall)+'</p>':'')+
   '<p class="rp-h">Endorsements and approval</p><table class="rp rp-sign"><tr>'+endorsed+'<td>'+esc(apprLabel(a))+'<br><b>'+esc(dl.by)+'</b><br><span class="muted2">Approved '+dShort(dl.at)+'</span></td></tr></table>'+
   '<table class="rp rp-sign" style="margin-top:10px"><tr><td>Prepared and verified by<br><br><b>'+esc(v.by)+'</b><br>Administrative Assistant<br><span class="muted2">'+dShort(v.at)+'</span></td><td>Received by the '+FAO+'<br><br>RFP no.: '+(a.report?'<b>'+esc(a.report.rfp)+'</b>':'_______________')+'<br>Name and signature: _______________<br>Date: ______________</td></tr></table>'+
   '<p class="rp-foot">Generated '+fmtT(Date.now())+' from the CCS Student Conference Grant Support System · template v1, under review by the College.</p></div>';
}
/* The downloaded report: real text, complete borders and the Dean's signature image */
const GREEN=[0.04,0.36,0.27],GREY=[0.93,0.94,0.93];
async function reportPdf(a){
  const p=a.post,v=p.verify,dl=a.grant,items=rptItems(a),P=C.PDF,doc=new P.Doc(),CW=P.W-2*P.M;
  const sig=await P.jpegOf(dl.signature,150,50),simg=sig?{jpeg:sig,w:sig.w,h:sig.h}:null;
  const right=(t,y,sz,b)=>doc.text(t,P.W-P.M-P.tw(t,sz,b),y,sz,b);
  doc.text('DE LA SALLE UNIVERSITY · COLLEGE OF COMPUTER STUDIES',P.M,40,8,true,GREEN);
  doc.text('Student Conference Grant · Reimbursement Report',P.M,53,15,true);
  right('Report no. RR-'+a.ref,41,9,true);right(a.report?'Filed at the '+FAO+' on '+dShort(a.report.at)+' · RFP '+a.report.rfp:'Not yet filed at the '+FAO,54,8,false);
  doc.y=82;
  const T=(t,o)=>Object.assign({t,b:true,fill:GREY},o||{}),c4=[104,153.5,104,153.5];
  doc.table(c4,[
    [T('Application reference'),a.ref,T('Academic year · term'),C.ayLabel(a.ay)+' · '+a.term.replace('Term','Term ')],
    [T('Student'),a.studentName,T('ID number · program'),a.sid+' · '+a.program+' · year '+a.year],
    [T('Thesis Adviser'),C.nameOf(a.route.adviser),T('Event location'),C.regionLabel(a.conf.scope)],
    [T('Conference'),{t:a.conf.title+' · '+a.conf.org,span:3}],
    [T('Dates · venue'),{t:fmtD(a.conf.start)+' to '+fmtD(a.conf.end)+' · '+a.conf.venue,span:3}],
    [T('Paper'),{t:a.paper.title+' ('+a.paper.ptype+', '+a.paper.index+')',span:3}]]);
  doc.gap(10);doc.block('Grant approved by the '+apprLabel(a),10,true);doc.gap(2);
  doc.table(c4,[
    [T('Total amount of grant'),{t:'₱ '+money(dl.total),a:'r',b:true},T('Funding source'),dl.fund],
    [T('Approved by'),dl.by+'\nApproved '+dShort(dl.at),T('Digital signature'),simg?{img:simg}:'(signature on file)']]);
  doc.gap(10);doc.block('Itemised reimbursement (final approved amounts)',10,true);doc.gap(2);
  const ic=[22,86,78,100,72,87,70];
  doc.table(ic,[[T('#'),T('Expense'),T('OR or invoice no.'),T('Merchant'),T('Approved (PHP)',{a:'r'}),T('Funding source'),T('Remarks')]].concat(
    items.map((l,i)=>[String(i+1),l.type,l.or,l.merchant,{t:money(l.approved),a:'r'},l.fund,l.why||'']),
    [[T('Total reimbursement approved',{span:4}),T(money(v.total),{a:'r'}),T('',{span:2})]]),{size:8.5});
  doc.gap(6);
  doc.table([90,65,110,80,100,70],[[T('Grant approved'),{t:'₱ '+money(dl.total),a:'r'},T('Reimbursement approved'),{t:'₱ '+money(v.total),a:'r',b:true},T('Unused balance of grant'),{t:'₱ '+money(C.u.round2(dl.total-v.total)),a:'r'}]],{size:8.5});
  if(v.overall){doc.gap(6);doc.block('Remarks: '+v.overall,9,false)}
  doc.gap(10);doc.block('Endorsements and approval',10,true);doc.gap(2);
  const q=CW/4,sg=r=>({t:CH[r].label+'\n'+C.nameOf(a.route[r])+'\n'+signInfo(a,r)});
  doc.table([q,q,q,q],[[sg('adviser'),sg('chair'),sg('assoc'),{t:apprLabel(a)+'\n'+dl.by+'\nApproved '+dShort(dl.at),img:simg?{jpeg:sig,w:Math.min(sig.w,q-2*P.M/5-2),h:sig.h*Math.min(sig.w,q-2*P.M/5-2)/sig.w}:undefined}]],{size:8.5});
  doc.gap(8);
  const h2=CW/2;
  doc.table([h2,h2],[[{t:'Prepared and verified by\n\n'+v.by+'\nAdministrative Assistant\n'+dShort(v.at)},{t:'Received by the '+FAO+'\n\nRFP no.: '+(a.report?a.report.rfp:'____________________')+'\nName and signature: ______________________\nDate: ______________'}]],{size:8.5});
  doc.gap(8);doc.block('Generated '+fmtT(Date.now())+' from the CCS Student Conference Grant Support System · template v1, under review by the College.',7.5,false,[0.4,0.4,0.4]);
  return doc.finish();
}
function downloadBlob(name,blob){const x=document.createElement('a');x.href=URL.createObjectURL(blob);x.download=name;document.body.appendChild(x);x.click();x.remove();setTimeout(()=>URL.revokeObjectURL(x.href),2000)}
ACT.rdl=t=>{const a=D().apps.find(x=>x.id===(t.dataset.id||state.rpt));if(!a||!a.post.verify||a.post.verify.draft)return toast('Verify the reimbursement amounts first.');reportPdf(a).then(b=>{downloadBlob('RR-'+a.ref+'.pdf',b);toast('Reimbursement report downloaded, with the Dean\'s signature.')}).catch(()=>toast('The report could not be created. Try again.'))};
R.rpt=function(){
  const list=D().apps.filter(a=>a.status==='verified'||a.status==='completed');
  if(C.rptSel&&list.some(a=>a.id===C.rptSel))state.rpt=C.rptSel;C.rptSel=null;
  if(!list.some(a=>a.id===state.rpt))state.rpt=list[0]&&list[0].id;
  if(!list.length){$('#rptBody').innerHTML='<div class="callout">No verified reimbursements yet. A report can be downloaded once the Administrative Assistant verifies the post-activity documents and the reimbursement amounts.</div>';return}
  const a=D().apps.find(x=>x.id===state.rpt);
  $('#rptBody').innerHTML='<div class="row" style="max-width:640px"><div class="field"><label for="r_sel">Application</label><select id="r_sel">'+list.map(x=>opt(x.id,x.ref+' · '+x.studentName+' · ₱'+money(x.post.verify.total)+(x.report?' · RFP '+x.report.rfp:''),x.id===a.id)).join('')+'</select></div></div>'+
   '<div style="display:flex;flex-wrap:wrap;gap:8px;margin:10px 0"><button class="btn" data-act="rdl" data-id="'+a.id+'">Download Reimbursement Report</button></div>'+
   (a.status==='completed'?'<div class="callout ok">Filed at the '+FAO+' as '+esc(a.report.no)+' on '+fmtT(a.report.at)+' by '+esc(a.report.by)+'. <b>RFP: '+esc(a.report.rfp)+'.</b> The student was told to check with the '+FAO+' after 5 to 10 working days.</div>':
    u().role==='admin'?'<div class="card" style="margin:10px 0"><h4>Mark as filed at the '+FAO+'</h4><p class="muted">After the report is submitted to the '+FAO+', record the RFP number here. The student is then notified by email and in-app that the request was processed and may check with the '+FAO+' after 5 to 10 working days.</p>'+
      '<div class="row" style="max-width:420px;margin-top:8px"><div class="field"><label for="r_rfp">RFP number</label><input id="r_rfp" maxlength="40" autocomplete="off"></div></div><div class="msg" id="r_msg" style="color:var(--bad);font-size:12px"></div><button class="btn" style="margin-top:8px" data-act="rfile">Mark filed at '+FAO+' and notify the student</button></div>':'<div class="callout">Waiting for the Administrative Assistant to record the RFP.</div>')+reportHTML(a);
};
document.addEventListener('change',e=>{if(e.target.id==='r_sel'){state.rpt=e.target.value;R.rpt()}});
ACT.rfile=async()=>{const a=D().apps.find(x=>x.id===state.rpt),r=await E.complete(u(),a,{rfp:$('#r_rfp').value});if(r.err){$('#r_msg').textContent=r.err;toast(r.err);return}toast('Filed at the '+FAO+'. The student was notified.');R.rpt()};

/* ---------- Google Sheet and Drive ---------- */
let drvSel=null;
R.records=function(){
  const live=C.live(),apps=D().apps,files=Object.values(D().files).filter(f=>f.appId&&f.name);
  const folders={};files.forEach(f=>{(folders['CCS-SCGSS/'+f.folder]=folders['CCS-SCGSS/'+f.folder]||[]).push(f)});
  $('#recBody').innerHTML='<div class="callout '+(live?'ok':'info')+'">'+(live?'<b>Live.</b> Every save is also sent to your Google Apps Script web app, which writes the sheet row and the Drive files.':'<b>Google sync is off.</b> This view shows what the Google Sheet and Drive folder will hold. To turn it on, deploy <span class="mono">google/Code.gs</span> and set GAS_URL and GAS_TOKEN in the server settings on the VM.')+'</div>'+
   '<h3 style="margin:16px 0 8px">Google Sheet · one row per application</h3><div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px"><button class="btn sec sm" data-act="sheetcsv">Download as CSV</button><span class="muted">'+apps.length+' rows · '+C.SHEET_COLS.length+' columns · rows update on every change</span></div>'+
   '<div class="tbl sheet"><table><thead><tr>'+C.SHEET_COLS.map(c=>'<th>'+esc(c[0])+'</th>').join('')+'</tr></thead><tbody>'+apps.slice().sort((a,b)=>a.ref<b.ref?-1:1).map(a=>'<tr>'+C.SHEET_COLS.map(c=>'<td>'+esc(c[1](a))+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>'+
   '<h3 style="margin:22px 0 8px">Google Drive · designated folder</h3><div class="grid g2" style="align-items:start"><div class="card">'+Object.keys(folders).sort().map(k=>'<h4 style="margin-top:8px">📁 '+esc(k)+'</h4><ul class="flist">'+folders[k].sort((x,y)=>x.at-y.at).map(f=>'<li><button class="lnk mono" data-act="preview" data-id="'+f.id+'">'+esc(f.name)+'</button> <span class="muted">'+fmtSize(f.size)+' · '+esc(f.by)+(f.superseded?' · replaced':'')+'</span></li>').join('')+'</ul>').join('')+'</div><div>'+C.viewerHTML()+'</div></div>'+
   '<h3 style="margin:22px 0 8px">Sync log</h3><div class="log">'+(D().syncLog.slice(0,20).map(s=>'<div><span><b>'+esc(s.ref||'')+'</b> · '+esc(s.why)+'</span><span class="mono muted">'+fmtT(s.at)+' · '+s.mode+'</span></div>').join('')||'<div class="muted">No changes yet in this session.</div>')+'</div>';
};
ACT.sheetcsv=()=>download('ccs-scgss-sheet.csv',csv([C.SHEET_COLS.map(c=>c[0])].concat(D().apps.map(a=>C.SHEET_COLS.map(c=>c[1](a))))));

/* ---------- notifications ---------- */
R.notif=function(){
  const mine=D().notifs.filter(n=>n.to===u().email),mail=D().outbox.filter(m=>u().role==='sysadmin'||m.to===u().email);
  $('#notifBody').innerHTML='<div style="display:flex;flex-wrap:wrap;gap:8px;justify-content:space-between;align-items:center"><span class="muted">'+mine.filter(n=>!n.read).length+' unread of '+mine.length+'</span><button class="btn sec sm" data-act="readall">Mark all as read</button></div>'+
   '<div class="log" style="max-height:none;margin-top:10px">'+(mine.map(n=>'<div'+(n.read?'':' class="unread"')+'><b>'+esc(n.title)+'</b><span>'+esc(n.body)+'</span><span class="mono muted">'+fmtT(n.at)+' · <button class="lnk" data-act="nopen" data-id="'+n.id+'" data-app="'+n.appId+'">Open application</button></span></div>').join('')||'<div class="muted">No notifications yet.</div>')+'</div>'+
   '<h3 style="margin:22px 0 8px">Email copies '+(u().role==='sysadmin'?'(all recipients)':'sent to you')+'</h3><p class="muted">Each event sends one email and one in-app notice. These are the emails the system would send'+(C.live()?' (also sent through Google).':' (not sent: Google sync is off).')+'</p>'+
   '<div style="display:grid;gap:8px;margin-top:8px">'+(mail.slice(0,25).map(m=>'<div class="mail"><div class="mail-h"><span><b>To:</b> '+esc(m.to)+' · '+fmtT(m.at)+'</span><span><b>Subject:</b> '+esc(m.subject)+'</span></div><div class="mail-b"><p>'+esc(m.body)+'</p></div></div>').join('')||'<div class="muted">No emails yet.</div>')+'</div>';
};
ACT.readall=async()=>{await E.markRead(u().email);C.refresh()};
ACT.nopen=async t=>{await E.markRead(u().email,t.dataset.id);C.go('app',true,t.dataset.app)};

/* ---------- roles (System Administrator) ---------- */
R.settings=async function(){
  const box=$('#setBody');box.innerHTML='<div class="empty-note">Loading…</div>';
  const r=await C.api.users();
  if(!r.body||!r.body.ok){box.innerHTML='<div class="callout bad">'+esc((r.body&&r.body.error)||'The roles could not be loaded.')+'</div>';return}
  const {users,roles,programs,audit}=r.body,s=D().settings,nm=e=>{const x=users.find(y=>y.email===e);return x?x.name||x.email:''};
  const need=[['Associate Dean',s.assoc],['Dean',s.dean]].concat(programs.map(p=>['Department Chair '+p,s.chairs[p]]));
  box.innerHTML='<div class="callout '+(need.every(n=>n[1])?'ok':'bad')+'"><b>Who signs now.</b> '+need.map(n=>esc(n[0])+': '+(n[1]?esc(nm(n[1])||n[1]):'<b>not set</b>')).join(' · ')+'. Applications cannot be submitted while a signer is missing. Each application keeps its own copy of the signers, so changes apply to new applications only.</div>'+
   '<div class="grid g2" style="align-items:start;margin-top:12px"><div class="card"><h3>Add or change a person</h3>'+
   '<div class="field"><label for="u_email">DLSU email</label><input id="u_email" autocomplete="off" placeholder="maria.delacruz@dlsu.edu.ph"></div>'+
   '<div class="field" style="margin-top:8px"><label for="u_name">Name</label><input id="u_name" autocomplete="off"></div>'+
   '<div class="row" style="margin-top:8px"><div class="field"><label for="u_role">Role</label><select id="u_role">'+roles.map(x=>opt(x,C.ROLE_NAME[x])).join('')+'</select></div>'+
   '<div class="field"><label for="u_prog">Program (students and chairs)</label><select id="u_prog"><option value="">None</option>'+programs.map(p=>opt(p,p)).join('')+'</select></div></div>'+
   '<label style="display:flex;gap:6px;align-items:center;margin-top:8px"><input type="checkbox" id="u_active" checked> Active</label>'+
   '<p class="muted" style="margin-top:6px">Only one Dean, one Associate Dean and one Department Chair per program can be active. Switch the old holder off first.</p>'+
   '<div class="msg" id="u_msg" role="alert" style="color:var(--bad);font-size:12px;margin-top:6px"></div><button class="btn" style="margin-top:8px" data-act="userset">Save</button></div>'+
   '<div class="card"><h3>Recent changes</h3><div class="log" style="max-height:260px">'+(audit.map(a=>'<div><span><b>'+esc(a.event)+'</b> · '+esc(a.email||'')+' '+esc(a.detail)+'</span><span class="mono muted">'+esc(a.ts.slice(0,16).replace("T"," "))+'</span></div>').join('')||'<div class="muted">Nothing yet.</div>')+'</div></div></div>'+
   '<h3 style="margin:18px 0 8px">People with a role ('+users.length+')</h3><div class="tbl"><table><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Program</th><th>Status</th><th></th></tr></thead><tbody>'+
   users.map(x=>'<tr><td>'+esc(x.name||'')+'</td><td class="mono">'+esc(x.email)+'</td><td>'+esc(C.ROLE_NAME[x.role])+'</td><td>'+esc(x.program||'')+'</td><td>'+(x.active?'<span class="pill p-ok">Active</span>':'<span class="pill p-idle">Switched off</span>')+'</td>'+
    '<td><button class="btn sm sec" data-act="useredit" data-email="'+esc(x.email)+'" data-name="'+esc(x.name||'')+'" data-role="'+x.role+'" data-prog="'+esc(x.program||'')+'">Edit</button> <button class="btn sm sec" data-act="usertoggle" data-email="'+esc(x.email)+'" data-name="'+esc(x.name||'')+'" data-role="'+x.role+'" data-prog="'+esc(x.program||'')+'" data-on="'+(x.active?1:0)+'">'+(x.active?'Switch off':'Switch on')+'</button></td></tr>').join('')+'</tbody></table></div>'+
   '<p class="muted" style="margin-top:8px">Signing in is done on the CCS portal. A person who is not in this list can sign in to the portal but is refused here.</p>';
};
const saveUser=async u=>{const r=await C.api.setUser(u);if(!r.body||!r.body.ok){const m=(r.body&&r.body.error)||'Not saved.';$('#u_msg').textContent=m;toast(m);return false}await C.api.load();toast('Saved.');R.settings();return true};
ACT.userset=()=>saveUser({email:$('#u_email').value,name:$('#u_name').value,role:$('#u_role').value,program:$('#u_prog').value,active:$('#u_active').checked});
ACT.useredit=t=>{$('#u_email').value=t.dataset.email;$('#u_name').value=t.dataset.name;$('#u_role').value=t.dataset.role;$('#u_prog').value=t.dataset.prog;$('#u_active').checked=true;$('#u_email').focus()};
ACT.usertoggle=t=>saveUser({email:t.dataset.email,name:t.dataset.name,role:t.dataset.role,program:t.dataset.prog,active:t.dataset.on!=='1'});
})(window.CCS);
