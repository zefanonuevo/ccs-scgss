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
     '<td><input class="vf" type="text" maxlength="80" value="'+esc(w&&w.fund?w.fund:(ex&&ex.fund)||'')+'" placeholder="Funding source" aria-label="Funding source for '+esc(l.type)+'" style="width:100%"'+dis+'></td><td><input class="vw" value="'+esc(w&&w.why||'')+'" aria-label="Remarks for '+esc(l.type)+'" style="width:100%"'+dis+'></td></tr>'}).join('');
  $('#vpanel').innerHTML='<div class="screen"><div class="screen-bar"><b>'+esc(a.ref)+' · '+esc(a.studentName)+'</b><span class="mono">'+(ro?'Read only':'Role: Administrative Assistant')+'</span></div><div class="screen-body">'+
   '<div class="kpis"><div class="kpi"><b>₱'+money(a.grant.total)+'</b><span>Total amount of grant approved by the Dean</span></div><div class="kpi"><b>₱'+money(p.claimedTotal)+'</b><span>Listed by the student</span></div><div class="kpi"><b id="vs_appr">₱0</b><span>Approved for reimbursement</span></div><div class="kpi"><b id="vs_left">₱0</b><span>Left of the grant</span></div></div>'+
   '<div class="grid g2" style="margin-top:12px"><dl class="who"><dt>Conference</dt><dd>'+esc(a.conf.title)+'</dd><dt>Program</dt><dd>'+a.program+' · '+esc(a.studentName)+'</dd><dt>Report</dt><dd>Version '+p.cycle+' · submitted '+fmtT(p.submittedAt)+'</dd></dl>'+
   '<div>'+(p.missingNote?'<div class="callout">Student note on missing items: '+esc(p.missingNote)+'</div>':'')+(v&&p.status==='returned'?'<div class="callout">Returned: '+esc(v.overall)+'</div>':'')+'</div></div>'+
   '<h3>Documents</h3>'+C.docsHTML(a,true)+
   '<h3>Checklist: tick each item found in the PDF, or flag it to return to the student</h3><div class="tbl"><table><thead><tr><th>Item</th><th>Student says</th><th>Verified</th><th>Return</th><th>Remarks, changes or corrections</th></tr></thead><tbody>'+docRows+'</tbody></table></div>'+
   '<h3>Reimbursement per item</h3><p class="muted">Check each receipt against the PDF. You can correct the OR or invoice number, the merchant name, the amount and the funding source, and add a remark for each item.</p><div class="tbl"><table><thead><tr><th>Expense</th><th>OR or invoice no.</th><th>Merchant</th><th class="r">Listed (₱)</th><th class="r">Approved (₱)</th><th>Funding source</th><th>Remarks</th></tr></thead><tbody>'+itemRows+'</tbody><tfoot><tr><th colspan="3">Total · grant ₱'+money(a.grant.total)+'</th><th class="r num">'+money(p.claimedTotal)+'</th><th class="r num" id="va_total">0</th><th colspan="2" id="va_note" class="muted" style="text-transform:none;letter-spacing:0;font-weight:400"></th></tr></tfoot></table></div>'+
   '<div class="field"><label for="v_overall">Overall remarks</label><textarea id="v_overall" rows="2"'+dis+'>'+esc(v&&v.overall||'')+'</textarea></div><div class="msg" id="v_msg" style="color:var(--bad);font-size:12px"></div>'+
   (edit?'<div style="display:flex;flex-wrap:wrap;gap:8px"><button class="btn" data-act="vverify">Verify and approve amounts</button><button class="btn warn" data-act="vreturn">Return to student</button><button class="btn sec" data-act="vsave">Save progress</button></div>'
     :done?'<div class="callout ok">Verified by '+esc(v.by)+' on '+fmtT(v.at)+'. Approved reimbursement ₱'+money(v.total)+'.</div><div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:8px"><button class="btn" data-act="rdl" data-id="'+a.id+'">Download Reimbursement Report</button><button class="btn sec" data-act="rptopen" data-id="'+a.id+'">Open the report'+(a.status==='verified'&&u().role==='admin'?' and record the RFP':'')+'</button></div>':'<div class="callout">Waiting for the student.</div>')+
   '</div></div>';
  vTotals();
}
function vTotals(){const el=$('#va_total');if(!el)return;const t=round2($$('.va').reduce((s,i)=>s+(Number(i.value)||0),0)),a=D().apps.find(x=>x.id===VS.sel),g=a.grant.total,over=t>g;el.textContent=money(t);
  $('#vs_appr').textContent='₱'+money(t);$('#vs_left').textContent='₱'+money(round2(g-t));$('#vs_left').style.color=over?'var(--bad)':'';
  $('#va_note').textContent=over?'Above the ₱'+money(g)+' grant approved by the Dean.':'Within the grant of ₱'+money(g)+'.';$('#va_note').style.color=over?'var(--bad)':''}
document.addEventListener('input',e=>{if(e.target.classList&&e.target.classList.contains('va'))vTotals()});
document.addEventListener('change',e=>{const c=e.target;if(!c.classList)return;
  if(c.classList.contains('vq')&&c.checked){const k=$('.vk[data-k="'+c.dataset.k+'"]');if(k)k.checked=false}
  if(c.classList.contains('vk')&&c.checked){const q=$('.vq[data-k="'+c.dataset.k+'"]');if(q)q.checked=false}});
function vCollect(){return {checks:Object.fromEntries($$('.vk').map(c=>[c.dataset.k,c.checked])),returns:Object.fromEntries($$('.vq').map(c=>[c.dataset.k,c.checked])),remarks:Object.fromEntries($$('.vr').map(i=>[i.dataset.k,i.value])),
  items:$$('.va').map((i,n)=>({approved:i.value,fund:$$('.vf')[n].value,or:$$('.vo')[n].value,merchant:$$('.vm')[n].value,why:$$('.vw')[n].value})),overall:$('#v_overall').value}}
function vDo(mode,okMsg){const a=D().apps.find(x=>x.id===VS.sel),r=E.postReview(u(),a,vCollect(),mode);if(r.err){$('#v_msg').textContent=r.err;toast(r.err);return}toast(okMsg);R.verify()}
ACT.vverify=()=>vDo('verify','Verified. The student was notified. You can now download the reimbursement report.');
ACT.vreturn=()=>vDo('return','Returned to the student with the requirements to clarify.');
ACT.vsave=()=>vDo('save','Progress saved.');

/* ---------- reimbursement report ---------- */
const FAO='FAO';
const dShort=ts=>fmtD(fmtT(ts).slice(0,10));
/* an endorser appears with the date they endorsed. If the same person already endorsed as the Thesis Adviser, the repeated step shows that date and says so. */
function signInfo(a,r){
  const d=a.decisions[r];if(!d)return '';
  if(d.d==='skipped'){const k=C.CHAIN.find(x=>a.decisions[x]&&a.decisions[x].email===d.email&&a.decisions[x].d==='endorsed');return 'Endorsed on '+(k?dShort(a.decisions[k].at)+' as '+CH[k].label:'')}
  return 'Endorsed on '+dShort(d.at);
}
const rptItems=a=>a.post.verify.items.filter(x=>x.approved>0); /* the report carries the final approved amounts only */
function reportHTML(a){
  const p=a.post,v=p.verify,dl=a.grant,sig=dl.signature,items=rptItems(a);
  const endorsed=['adviser','chair','assoc'].map(r=>'<td>'+CH[r].label+'<br><b>'+esc(C.nameOf(a.route[r]))+'</b><br><span class="muted2">'+esc(signInfo(a,r))+'</span></td>').join('');
  return '<div class="paper" id="rptPaper">'+
   '<div class="rp-head"><div><p class="rp-org">De La Salle University · College of Computer Studies</p><h3>Student Conference Grant · Reimbursement Report</h3></div><div class="rp-no"><span>Report no.</span><b class="mono">RR-'+esc(a.ref)+'</b>'+(a.report?'<span>Filed at FAO '+dShort(a.report.at)+'</span><span>RFP '+esc(a.report.rfp)+'</span>':'<span>Not yet filed at FAO</span>')+'</div></div>'+
   '<table class="rp"><tr><th>Application reference</th><td class="mono">'+esc(a.ref)+'</td><th>Academic year · term</th><td>'+C.ayLabel(a.ay)+' · '+a.term.replace('Term','Term ')+'</td></tr>'+
   '<tr><th>Student</th><td>'+esc(a.studentName)+'</td><th>ID number · program</th><td>'+esc(a.sid)+' · '+a.program+' · year '+a.year+'</td></tr>'+
   '<tr><th>Thesis Adviser</th><td>'+esc(C.nameOf(a.route.adviser))+'</td><th>Travel</th><td>'+(a.conf.scope==='international'?'International':'Local')+'</td></tr>'+
   '<tr><th>Conference</th><td colspan="3">'+esc(a.conf.title)+' · '+esc(a.conf.org)+'</td></tr>'+
   '<tr><th>Dates · venue</th><td colspan="3">'+fmtD(a.conf.start)+' to '+fmtD(a.conf.end)+' · '+esc(a.conf.venue)+'</td></tr>'+
   '<tr><th>Paper</th><td colspan="3">'+esc(a.paper.title)+' ('+esc(a.paper.ptype)+', '+esc(a.paper.index)+')</td></tr></table>'+
   '<p class="rp-h">Grant approved by the Dean</p><table class="rp"><tr><th>Total amount of grant</th><td class="r">₱'+money(dl.total)+'</td><th>Dean</th><td>'+esc(dl.by)+'<br><span class="muted2">Approved '+dShort(dl.at)+'</span></td></tr><tr><th>Digital signature</th><td colspan="3"><img class="sigimg" src="'+sig+'" alt="Signature of the Dean"></td></tr></table>'+
   '<p class="rp-h">Itemised reimbursement (final approved amounts)</p><table class="rp"><tr><th>#</th><th>Expense</th><th>OR or invoice no.</th><th>Merchant</th><th class="r">Approved (₱)</th><th>Funding source</th><th>Remarks</th></tr>'+
   items.map((l,i)=>'<tr><td>'+(i+1)+'</td><td>'+esc(l.type)+'</td><td class="mono">'+esc(l.or)+'</td><td>'+esc(l.merchant)+'</td><td class="r">'+money(l.approved)+'</td><td>'+esc(l.fund)+'</td><td>'+esc(l.why)+'</td></tr>').join('')+
   '<tr><th colspan="4">Total reimbursement approved</th><th class="r">'+money(v.total)+'</th><th colspan="2"></th></tr></table>'+(v.overall?'<p class="rp-note">Remarks: '+esc(v.overall)+'</p>':'')+
   '<p class="rp-h">Endorsements and approval</p><table class="rp rp-sign"><tr>'+endorsed+'<td>Dean<br><b>'+esc(dl.by)+'</b><br><span class="muted2">Approved '+dShort(dl.at)+'</span></td></tr></table>'+
   '<table class="rp rp-sign" style="margin-top:10px"><tr><td>Prepared and verified by<br><br><b>'+esc(v.by)+'</b><br>Administrative Assistant<br><span class="muted2">'+dShort(v.at)+'</span></td><td>Received by the '+FAO+'<br><br>RFP no.: '+(a.report?'<b>'+esc(a.report.rfp)+'</b>':'_______________')+'<br>Name and signature: _______________<br>Date: ______________</td></tr></table>'+
   '<p class="rp-foot">Generated '+fmtT(Date.now())+' from the CCS Student Conference Grant Support System · template v1, under review by the College.</p></div>';
}
/* plain-text PDF copy of the report (the printed copy from the browser also carries the Dean's signature image) */
function reportLines(a){
  const p=a.post,v=p.verify,dl=a.grant,L=[];
  L.push('De La Salle University - College of Computer Studies','Student Conference Grant - Reimbursement Report','');
  L.push('Report no.: RR-'+a.ref,'Application reference: '+a.ref+'   '+C.ayLabel(a.ay)+' '+a.term.replace('Term','Term '));
  L.push(a.report?'Filed at '+FAO+' on '+dShort(a.report.at)+'   RFP no.: '+a.report.rfp:'Not yet filed at '+FAO,'');
  L.push('Student: '+a.studentName+'   ID '+a.sid+'   '+a.program+'   year '+a.year,'Thesis Adviser: '+C.nameOf(a.route.adviser),'Conference: '+a.conf.title+' ('+a.conf.org+')','Dates and venue: '+fmtD(a.conf.start)+' to '+fmtD(a.conf.end)+', '+a.conf.venue,'Travel: '+a.conf.scope,'');
  L.push('TOTAL AMOUNT OF GRANT: PHP '+money(dl.total)+'   approved by '+dl.by+' on '+dShort(dl.at),'');
  L.push('ITEMISED REIMBURSEMENT (final approved amounts)');
  rptItems(a).forEach((l,i)=>L.push((i+1)+'. '+l.type+' | '+l.or+' | '+l.merchant+' | PHP '+money(l.approved)+' | '+l.fund+(l.why?' | '+l.why:'')));
  L.push('TOTAL REIMBURSEMENT APPROVED: PHP '+money(v.total),'');
  if(v.overall)L.push('Remarks: '+v.overall,'');
  L.push('ENDORSEMENTS AND APPROVAL');
  ['adviser','chair','assoc'].forEach(r=>L.push(CH[r].label+': '+C.nameOf(a.route[r])+'   '+signInfo(a,r)));
  L.push('Dean: '+dl.by+'   Approved '+dShort(dl.at)+' (digital signature on file)','');
  L.push('Prepared and verified by: '+v.by+', Administrative Assistant, '+dShort(v.at),'Received by the '+FAO+': ______________________   Date: __________');
  return L;
}
function downloadBlob(name,blob){const x=document.createElement('a');x.href=URL.createObjectURL(blob);x.download=name;document.body.appendChild(x);x.click();x.remove();setTimeout(()=>URL.revokeObjectURL(x.href),2000)}
ACT.rdl=t=>{const a=D().apps.find(x=>x.id===(t.dataset.id||state.rpt));if(!a||!a.post.verify||a.post.verify.draft)return toast('Verify the reimbursement amounts first.');downloadBlob('RR-'+a.ref+'.pdf',C.makePdf('Reimbursement Report RR-'+a.ref,reportLines(a)));toast('Reimbursement report downloaded.')};
R.rpt=function(){
  const list=D().apps.filter(a=>a.status==='verified'||a.status==='completed');
  if(C.rptSel&&list.some(a=>a.id===C.rptSel))state.rpt=C.rptSel;C.rptSel=null;
  if(!list.some(a=>a.id===state.rpt))state.rpt=list[0]&&list[0].id;
  if(!list.length){$('#rptBody').innerHTML='<div class="callout">No verified reimbursements yet. A report can be downloaded once the Administrative Assistant verifies the post-activity documents and the reimbursement amounts.</div>';return}
  const a=D().apps.find(x=>x.id===state.rpt);
  $('#rptBody').innerHTML='<div class="row" style="max-width:640px"><div class="field"><label for="r_sel">Application</label><select id="r_sel">'+list.map(x=>opt(x.id,x.ref+' · '+x.studentName+' · ₱'+money(x.post.verify.total)+(x.report?' · RFP '+x.report.rfp:''),x.id===a.id)).join('')+'</select></div></div>'+
   '<div style="display:flex;flex-wrap:wrap;gap:8px;margin:10px 0"><button class="btn" data-act="rdl" data-id="'+a.id+'">Download Reimbursement Report</button><button class="btn sec" data-act="rprint">Print or save as PDF (with signature)</button><button class="btn sec" data-act="rcsv">Download CSV</button></div>'+
   (a.status==='completed'?'<div class="callout ok">Filed at the '+FAO+' as '+esc(a.report.no)+' on '+fmtT(a.report.at)+' by '+esc(a.report.by)+'. <b>RFP: '+esc(a.report.rfp)+'.</b> The student was told to check with the '+FAO+' after 5 to 10 working days.</div>':
    u().role==='admin'?'<div class="card" style="margin:10px 0"><h4>Mark as filed at the '+FAO+'</h4><p class="muted">After the report is submitted to the '+FAO+', record the RFP number here. The student is then notified by email and in-app that the request was processed and may check with the '+FAO+' after 5 to 10 working days.</p>'+
      '<div class="row" style="max-width:420px;margin-top:8px"><div class="field"><label for="r_rfp">RFP number</label><input id="r_rfp" maxlength="40" autocomplete="off"></div></div><div class="msg" id="r_msg" style="color:var(--bad);font-size:12px"></div><button class="btn" style="margin-top:8px" data-act="rfile">Mark filed at '+FAO+' and notify the student</button></div>':'<div class="callout">Waiting for the Administrative Assistant to record the RFP.</div>')+reportHTML(a);
};
document.addEventListener('change',e=>{if(e.target.id==='r_sel'){state.rpt=e.target.value;R.rpt()}});
ACT.rprint=()=>window.print();
ACT.rcsv=()=>{const a=D().apps.find(x=>x.id===state.rpt),v=a.post.verify;download('RR-'+a.ref+'.csv',csv([['Reference','Student','Program','Report no.','RFP no.','Item','Expense','OR or invoice no.','Merchant','Approved PHP','Funding source','Remarks']].concat(rptItems(a).map((l,i)=>[a.ref,a.studentName,a.program,'RR-'+a.ref,a.report?a.report.rfp:'',i+1,l.type,l.or,l.merchant,l.approved,l.fund,l.why]))))};
ACT.rfile=()=>{const a=D().apps.find(x=>x.id===state.rpt),r=E.complete(u(),a,{rfp:$('#r_rfp').value});if(r.err){$('#r_msg').textContent=r.err;toast(r.err);return}toast('Filed at the '+FAO+'. The student was notified.');R.rpt()};

/* ---------- Google Sheet and Drive (simulated unless a script URL is set) ---------- */
let drvSel=null;
R.records=function(){
  const live=C.live(),apps=D().apps,files=Object.values(D().files).filter(f=>f.appId&&f.name);
  const folders={};files.forEach(f=>{(folders['CCS-SCGSS/'+f.folder]=folders['CCS-SCGSS/'+f.folder]||[]).push(f)});
  $('#recBody').innerHTML='<div class="callout '+(live?'ok':'info')+'">'+(live?'<b>Live.</b> Every save is also sent to your Google Apps Script web app, which writes the sheet row and the Drive files.':'<b>Simulated.</b> This view shows exactly what the Google Sheet and Drive folder would hold. To make it real, deploy <span class="mono">google/Code.gs</span> and paste its web app URL in Settings.')+'</div>'+
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
   '<h3 style="margin:22px 0 8px">Email copies '+(u().role==='sysadmin'?'(all recipients)':'sent to you')+'</h3><p class="muted">Each event sends one email and one in-app notice. These are the emails the system would send'+(C.live()?' (also sent through Google).':' (simulated).')+'</p>'+
   '<div style="display:grid;gap:8px;margin-top:8px">'+(mail.slice(0,25).map(m=>'<div class="mail"><div class="mail-h"><span><b>To:</b> '+esc(m.to)+' · '+fmtT(m.at)+'</span><span><b>Subject:</b> '+esc(m.subject)+'</span></div><div class="mail-b"><p>'+esc(m.body)+'</p></div></div>').join('')||'<div class="muted">No emails yet.</div>')+'</div>';
};
ACT.readall=()=>{E.markRead(u().email);C.refresh()};
ACT.nopen=t=>{E.markRead(u().email,t.dataset.id);C.go('app',true,t.dataset.app)};

/* ---------- settings (System Administrator) ---------- */
R.settings=function(){
  const s=D().settings,by=r=>C.ACCOUNTS.filter(a=>a.role===r),g=s.gas||{};
  $('#setBody').innerHTML='<div class="grid g2" style="align-items:start"><div class="card"><h3>Routing</h3><p class="muted">Each application keeps a copy of its signatories at submission. Changes here apply to new applications only.</p>'+
   '<div class="field" style="margin-top:10px"><label for="s_assoc">Associate Dean (set once, for every application)</label><select id="s_assoc">'+by('assoc').map(a=>opt(a.email,a.name,a.email===s.assoc)).join('')+'</select></div>'+
   '<div class="field" style="margin-top:10px"><label for="s_dean">Dean</label><select id="s_dean">'+by('dean').map(a=>opt(a.email,a.name,a.email===s.dean)).join('')+'</select></div>'+
   '<div class="field" style="margin-top:10px"><label for="s_alt">Alternate approver when the Dean is the Thesis Adviser</label><select id="s_alt">'+by('dean').map(a=>opt(a.email,a.name,a.email===s.deanAlt)).join('')+'</select><small>The Dean cannot approve the grant of their own advisee. This person signs instead. To be confirmed with the Office of the Dean.</small></div>'+
   '<h4 style="margin-top:14px">Department Chair by degree program</h4>'+C.PROGRAMS.map(p=>'<div class="field" style="margin-top:8px"><label for="s_ch_'+p[0]+'">'+p[0]+' · '+p[1]+'</label><select id="s_ch_'+p[0]+'">'+by('chair').map(a=>opt(a.email,a.name+' ('+(a.program||'')+')',a.email===s.chairs[p[0]])).join('')+'</select></div>').join('')+
   '<button class="btn" style="margin-top:12px" data-act="setroute">Save routing</button></div>'+
   '<div style="display:grid;gap:14px"><div class="card"><h3>Funding sources</h3><p class="muted">Funding sources are not predefined. The Dean types one for each line of the breakdown, and the Administrative Assistant can correct it when verifying.</p></div>'+
   '<div class="card"><h3>Google Sheet, Drive and email</h3><p class="muted">Deploy <span class="mono">google/Code.gs</span> as a web app, then paste its URL and the shared token. Saves then also write the sheet row, the Drive files and the emails. Leave blank to stay simulated.</p>'+
   '<div class="field" style="margin-top:8px"><label for="s_gurl">Web app URL</label><input id="s_gurl" value="'+esc(g.url||'')+'" placeholder="https://script.google.com/macros/s/…/exec"></div><div class="field" style="margin-top:8px"><label for="s_gtok">Shared token</label><input id="s_gtok" type="password" value="'+esc(g.token||'')+'" autocomplete="off"></div>'+
   '<div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap"><button class="btn" data-act="setgas">Save</button></div></div>'+
   '<div class="card"><h3>Demo data</h3><p class="muted">Restore the sample applications and clear everything entered in this browser.</p><button class="btn bad" style="margin-top:8px" data-act="resetdb">Reset demo data</button></div></div></div>';
};
ACT.setroute=()=>{const s=D().settings;if($('#s_alt').value===$('#s_dean').value)return toast('The alternate approver must be a different person from the Dean.');s.assoc=$('#s_assoc').value;s.dean=$('#s_dean').value;s.deanAlt=$('#s_alt').value;C.PROGRAMS.forEach(p=>s.chairs[p[0]]=$('#s_ch_'+p[0]).value);C.save();toast('Routing saved. New applications will use it.')};
ACT.setgas=()=>{D().settings.gas={url:$('#s_gurl').value.trim(),token:$('#s_gtok').value};C.save();toast(D().settings.gas.url?'Saved. New changes will be sent to Google.':'Saved. Staying simulated.')};
ACT.resetdb=()=>{if(!confirm('Reset all demo data in this browser?'))return;C.reset();toast('Demo data restored.');R.settings()};

/* ---------- simulation ---------- */
const DEMO_EXP=[10000,1500,10000,6000,2500];
function demoForm(S,adv,conf){
  const fm=C.registerFile({orig:'consolidated-requirements.pdf',size:240000,by:S.name});
  return {ay:'2627',term:'Term1',sid:'12145678',prog:S.program||'BSCS',year:'4',adv:adv.email,conf:conf,start:'2026-12-08',end:'2026-12-10',venue:'Osaka, Japan',org:'Sample Systems Society',etype:'Conference',scope:'international',cls:'Paper presenter',ptype:'Full paper',index:'Scopus',title:'Demo Title on Resilient Pipelines',cof:'',cos:'',
    exp:C.EXPENSE_TYPES.map((t,i)=>({type:t,amount:DEMO_EXP[i],remarks:''})),file:{id:fm.id,orig:fm.orig,size:fm.size},attConfirm:true,privacy:true,brand:true};
}
function runDemo(){
  const log=[],step=(who,what,r)=>{if(r&&r.err)throw new Error(who+': '+r.err);log.push([who,what])};
  const S=C.acct('maria.santos@college.example'),adv=C.acct('adviser.reyes@college.example'),ch=C.acct('chair.cs@college.example'),as=C.acct('assoc.dean@college.example'),de=C.acct('dean@college.example'),ad=C.acct('admin.assistant@college.example');
  const r=E.submit(S,demoForm(S,adv,'Demo International Conference on Sample Systems'));step(S.name,'Submitted the application',r);const a=r.app;
  step(adv.name,'Endorsed (Thesis Adviser)',E.endorse(adv,a,'Endorsed.'));
  step(ch.name,'Returned with remarks (Department Chair)',E.returnApp(ch,a,'Please attach the conference page that shows the dates.'));
  step(S.name,'Replied and resubmitted; the file went back to the Chair',E.resubmit(S,a,null,'Attached the conference page with the dates.',[]));
  step(ch.name,'Endorsed (Department Chair)',E.endorse(ch,a,'Endorsed.'));
  step(as.name,'Endorsed (Associate Dean)',E.endorse(as,a,'Endorsed.'));
  const lines=a.expenses.map(x=>({approved:x.type==='Accommodation'?4500:x.amount,fund:x.type==='Roundtrip airfare'?'College Fund':"Dean's Office"}));
  step(de.name,'Chose the funding source per line, approved ₱'+money(round2(lines.reduce((t,l)=>t+l.approved,0)))+' and confirmed',E.approveGrant(de,a,{signature:C.sampleSig(),confirm:true,lines,note:'Approved.'}));
  const pf=C.registerFile({orig:'post-activity.pdf',size:520000,by:S.name}),docs={};C.REQ_POST.forEach(x=>docs[x[0]]=true);
  const items=a.expenses.filter(x=>x.approved>0).map((x,n)=>({type:x.type,or:'OR-9'+n+'01',merchant:'Sample Merchant '+(n+1),amount:x.approved}));
  step(S.name,'Listed '+items.length+' receipts with OR or invoice number and merchant, and submitted the post-activity report (one PDF)',E.submitPost(S,a,{file:{id:pf.id},items,docs,missingNote:''}));
  const rows=a.post.items.map(l=>({approved:l.amount,fund:a.expenses.find(e=>e.type===l.type).fund,why:''}));
  step(ad.name,'Asked the Dean a question about a line',E.comment(ad,a,'Is the airfare funded from the College Fund for all trips?',[],[de.email]));
  step(ad.name,'Verified all documents and items',E.postReview(ad,a,{checks:docs,remarks:{},items:rows,overall:'Complete.'},'verify'));
  step(ad.name,'Downloaded the report and recorded the RFP at the FAO',E.complete(ad,a,{rfp:'RFP-DEMO-'+a.ref.slice(-3)}));
  return {log,app:a};
}
/* the Thesis Adviser also holds a signing role */
function runAdviserDemo(){
  const log=[],step=(who,what,r)=>{if(r&&r.err)throw new Error(who+': '+r.err);log.push([who,what])};
  const S=C.acct('noel.ramos@college.example'),ch=C.acct('chair.it@college.example'),as=C.acct('assoc.dean@college.example'),de=C.acct('dean@college.example'),alt=C.acct('oic.dean@college.example');
  S.program='BSIT';
  let r=E.submit(S,demoForm(S,ch,'Demo Conference: the adviser is the Department Chair'));step(S.name,'Submitted; the Department Chair '+ch.name+' is the Thesis Adviser',r);let a=r.app;
  step(ch.name,'Endorsed as Thesis Adviser. The Department Chair step was skipped',E.endorse(ch,a,'Endorsed.'));
  log.push(['System','Now pending: '+C.info(a).label]);
  r=E.submit(S,demoForm(S,as,'Demo Conference: the adviser is the Associate Dean'));step(S.name,'Submitted; the Associate Dean is the Thesis Adviser',r);a=r.app;
  step(as.name,'Endorsed as Thesis Adviser',E.endorse(as,a,'Endorsed.'));
  step(ch.name,'Endorsed (Department Chair)',E.endorse(ch,a,'Endorsed.'));
  log.push(['System','Now pending: '+C.info(a).label+' (the Associate Dean step was skipped)']);
  r=E.submit(S,demoForm(S,de,'Demo Conference: the adviser is the Dean'));step(S.name,'Submitted; the Dean is the Thesis Adviser',r);a=r.app;
  log.push(['System','The grant will be approved by '+C.nameOf(a.route.dean)+', not by the Dean']);
  step(de.name,'Endorsed as Thesis Adviser',E.endorse(de,a,'Endorsed.'));step(ch.name,'Endorsed (Department Chair)',E.endorse(ch,a,'Endorsed.'));step(as.name,'Endorsed (Associate Dean)',E.endorse(as,a,'Endorsed.'));
  const denied=E.approveGrant(de,a,{signature:C.sampleSig(),confirm:true,lines:a.expenses.map(x=>({approved:x.amount,fund:'x'}))});
  log.push([de.name,'Tried to approve the grant for their own advisee: '+(denied.err||'allowed')]);
  return {log,app:a};
}
R.sim=function(){
  const res=state.simOut||'';
  $('#simBody').innerHTML='<div class="grid g2" style="align-items:start"><div style="display:grid;gap:14px"><div class="card"><h3>Run a full demo</h3><p class="muted">Creates one new application and moves it through every role: submit, adviser, a return and reply, chair, associate dean, dean with funding per line and a confirmation, post-activity report with receipts, a question from the Administrative Assistant to the Dean, verification, and filing at the FAO with an RFP. Everything it does appears in the dashboards, the history, the Sheet and Drive view and the notifications.</p><button class="btn" style="margin-top:10px" data-act="rundemo">Run full demo</button></div>'+
   '<div class="card"><h3>When the Thesis Adviser is also a signatory</h3><p class="muted">Submits three applications whose adviser is the Department Chair, the Associate Dean and the Dean, and shows who endorses and who approves each time.</p><button class="btn sec" style="margin-top:10px" data-act="runadv">Run the adviser demo</button></div>'+
   '<div class="card"><h3>Security checks</h3><p class="muted">Try actions the rules refuse. Each refusal is written to that application\'s approval history.</p><div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:8px">'+
   '<button class="btn sec sm" data-act="sec" data-k="self">Student endorses own application</button><button class="btn sec sm" data-act="sec" data-k="skip">Dean approves out of sequence</button><button class="btn sec sm" data-act="sec" data-k="role">Admin Assistant endorses a grant</button><button class="btn sec sm" data-act="sec" data-k="wrong">Another adviser endorses</button><button class="btn sec sm" data-act="sec" data-k="verify">Adviser verifies a reimbursement</button></div></div>'+
   '<div class="card"><h3>Reminders</h3><p class="muted">Staff reminders go to anyone an application has waited on for more than 2 days. Student reminders for the post-activity report are automatic: at 15, 7, 3 and 1 days before the due date, on the due date, and every 3 days when overdue. The real build runs both every morning.</p><div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px"><button class="btn sec" data-act="sweep2">Run staff reminder check now</button><button class="btn sec" data-act="autorem">Run the student report reminders now</button></div></div></div>'+
   '<div class="card"><h3>Result</h3><div id="simOut" class="log" style="max-height:none">'+(res||'<div class="muted">Nothing run yet.</div>')+'</div></div></div>';
};
const logHTML=r=>r.log.map((l,i)=>'<div><span><b>'+(i+1)+'. '+esc(l[0])+'</b> · '+esc(l[1])+'</span></div>').join('')+'<div><span><b>Done.</b> Last reference <button class="lnk mono" data-open="'+r.app.id+'">'+esc(r.app.ref)+'</button></span></div>';
ACT.rundemo=()=>{try{const r=runDemo();state.simOut=logHTML(r);toast('Demo finished: '+r.app.ref)}catch(e){state.simOut='<div class="bad-row"><b>Stopped.</b> '+esc(e.message)+'</div>';toast(e.message)}R.sim()};
ACT.runadv=()=>{try{const r=runAdviserDemo();state.simOut=logHTML(r);toast('Adviser demo finished')}catch(e){state.simOut='<div class="bad-row"><b>Stopped.</b> '+esc(e.message)+'</div>';toast(e.message)}R.sim()};
ACT.sweep2=()=>{const n=E.sweep(C.acct('admin.assistant@college.example'),2);state.simOut='<div><span><b>'+n+'</b> reminder'+(n===1?'':'s')+' sent by email and in-app.</span></div>';R.sim()};
ACT.autorem=()=>{const n=E.autoRemind();state.simOut='<div><span><b>'+n+'</b> student reminder'+(n===1?'':'s')+' sent by email and in-app for post-activity reports. Reminders already sent today are not repeated.</span></div>';R.sim()};
ACT.sec=t=>{
  const apps=D().apps,k=t.dataset.k;let a,actor,r;
  if(k==='self'){a=apps.find(x=>x.status==='pending');actor=C.acct(a.studentEmail)||{email:a.studentEmail,name:a.studentName,role:'student'};r=E.endorse(actor,a,'x')}
  else if(k==='skip'){a=apps.find(x=>x.status==='pending'&&x.stage<3);actor=C.acct('dean@college.example');r=E.approveGrant(actor,a,{signature:C.sampleSig(),lines:[]})}
  else if(k==='role'){a=apps.find(x=>x.status==='pending');actor=C.acct('admin.assistant@college.example');r=E.endorse(actor,a,'x')}
  else if(k==='wrong'){a=apps.find(x=>x.status==='pending'&&x.stage===0);actor=C.ACCOUNTS.find(x=>x.role==='adviser'&&x.email!==a.route.adviser);r=E.endorse(actor,a,'x')}
  else{a=apps.find(x=>x.post.status==='submitted');actor=C.acct('adviser.reyes@college.example');r=a?E.postReview(actor,a,{items:[]},'verify'):{err:'No report is waiting for verification. Run the full demo or reset first.'}}
  if(!a){state.simOut='<div class="muted">No suitable application. Reset the demo data.</div>';R.sim();return}
  state.simOut='<div class="bad-row"><span><b>Refused (403)</b> · '+esc(actor.name)+' on '+esc(a.ref)+'</span><span>'+esc(r.err||'It was allowed.')+'</span></div>'+(state.simOut&&state.simOut.indexOf('Nothing')<0?'':'');
  R.sim();toast('Refused and written to the approval history.');
};
})(window.CCS);
