/* CCS SCGSS v4.0 client data layer.
   All data and every approval rule now live on the server (server/engine.js, shared/rules.js). This file keeps a copy of what the signed-in
   person may see (C.db), sends their actions to the server, and uploads and downloads files. Nothing is stored in the browser.
   Sign-in is the CCS portal's: the server asks the portal who you are, then checks its own roles table. */
(function(C){
"use strict";
const $=(s,r)=>(r||document).querySelector(s), $$=(s,r)=>Array.prototype.slice.call((r||document).querySelectorAll(s));
Object.assign(C.u,{$,$$});

/* ---------- what the person may see ---------- */
C.db={apps:[],files:{},notifs:[],outbox:[],syncLog:[],settings:{assoc:'',dean:'',chairs:{}},counters:{},drafts:{},sigs:{},live:false};
C.directory=[];C.me=null;
C.setDirectory(e=>C.directory.find(x=>x.email===e)||null);
Object.defineProperty(C,'ACCOUNTS',{get:()=>C.directory});
C.advisers=()=>C.directory.filter(a=>C.ADVISER_ROLES.indexOf(a.role)>-1);
C.live=()=>!!C.db.live;
C.SHEET_COLS=C.makeSheetCols(()=>C.db.files);
const byId=id=>C.db.apps.find(a=>a.id===id);
C.byId=byId;
C.nextRef=(ay,term)=>ay+'-'+term+'-'+C.u.pad3(((C.db.counters[ay+'-'+term])||0)+1);
C.advisories=(email,ay,exceptId)=>C.db.apps.filter(a=>a.studentEmail===email&&a.ay===ay&&a.id!==exceptId&&a.status!=='rejected');
const adminsOf=()=>C.directory.filter(x=>x.role==='admin').map(x=>x.email);
/* everyone who may be asked a question about an application: the student, each signatory and the Administrative Assistants */
const participants=a=>Array.from(new Set([a.studentEmail].concat(Object.keys(a.route).map(k=>a.route[k])).concat(adminsOf())));
C.participants=participants;
C.counterparts=function(a,actor){
  const CHAIN=C.CHAIN;
  const last=a.comments.slice().reverse().filter(c=>c.email!==actor.email&&participants(a).indexOf(c.email)>-1)[0];
  if(actor.email===a.studentEmail){
    if(a.status==='pending')return [a.route[CHAIN[a.stage]]];
    if(a.status==='returned')return [a.route[a.returned.role]];
    if(a.post.status==='submitted'||a.post.status==='returned'||a.status==='verified')return adminsOf();
    return [a.route.adviser];
  }
  return [last?last.email:a.studentEmail];
};

/* ---------- talking to the server ---------- */
function apply(st){
  C.me=st.me;C.directory=st.directory;
  Object.assign(C.db,{apps:st.apps,files:Object.assign({},st.files),notifs:st.notifs,outbox:st.outbox,syncLog:st.syncLog,settings:st.settings,counters:st.counters,live:st.live,
    drafts:st.draft?{[st.me.email]:st.draft}:{},sigs:st.sig?{[st.me.email]:st.sig}:{}});
}
const http=async(path,opt)=>{const r=await fetch(path,Object.assign({credentials:'same-origin'},opt));let body=null;try{body=await r.json()}catch(e){}return {status:r.status,body}};
const post=(path,data)=>http(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
C.api={
  async load(){
    let r;try{r=await http('api/state',{cache:'no-store'})}catch(e){return {ok:false,status:0,error:'The server could not be reached. Check your connection and try again.'}}
    if(r.status===200&&r.body&&r.body.ok){apply(r.body.state);return {ok:true}}
    return {ok:false,status:r.status,error:r.body&&r.body.error,email:r.body&&r.body.email};
  },
  /* runs one action on the server; resolves to {ok:true,...} or {err:'...'} and refreshes C.db */
  async act(name,appId,...args){
    let r;try{r=await post('api/action',{name,appId:appId||'',args})}catch(e){return {err:'The server could not be reached. Nothing was saved. Try again.'}}
    if(r.body&&r.body.state)apply(r.body.state);
    if(!r.body)return {err:'The server did not answer properly. Nothing was saved.'};
    if(!r.body.result)return {err:r.body.error||'That was not allowed.'};
    const out=Object.assign({},r.body.result);if(out.appId)out.app=byId(out.appId);
    return out;
  },
  async saveDraft(form){const r=await post('api/draft',{form});if(r.body&&r.body.ok)C.db.drafts[C.me.email]=form;return r.body&&r.body.ok},
  async clearDraft(){await post('api/draft',{clear:true});delete C.db.drafts[C.me.email]},
  async saveSignature(data){const r=await post('api/sig',{data});if(r.body&&r.body.ok)C.db.sigs[C.me.email]=data},
  users:()=>http('api/users',{cache:'no-store'}),
  setUser:u=>post('api/users',u),
  bulk:b=>post('api/users/bulk',b)
};
/* the same call names the screens always used; each now returns a promise */
const E=C.E={
  submit:(actor,f)=>C.api.act('submit','',f),
  endorse:(actor,a,note)=>C.api.act('endorse',a.id,note),
  approveGrant:(actor,a,o)=>C.api.act('approveGrant',a.id,o),
  returnApp:(actor,a,note)=>C.api.act('returnApp',a.id,note),
  reject:(actor,a,note)=>C.api.act('reject',a.id,note),
  comment:(actor,a,text,fileIds,to,topic)=>C.api.act('comment',a.id,text,fileIds||[],to||null,topic||null),
  resubmit:(actor,a,f,reply,fileIds)=>C.api.act('resubmit',a.id,f||null,reply,fileIds||[]),
  submitPost:(actor,a,d)=>C.api.act('submitPost',a.id,d),
  postReview:(actor,a,d,mode)=>C.api.act('postReview',a.id,d,mode),
  complete:(actor,a,o)=>C.api.act('complete',a.id,o),
  remind:(actor,a)=>C.api.act('remind',a.id),
  markRead:(email,id)=>C.api.act('markRead','',id||null),
  markViewed:(actor,a,fileId)=>C.api.act('markViewed',a.id,fileId)
};

/* ---------- files ---------- */
C.uploadFile=async function(f){
  const r=await fetch('api/files',{method:'POST',credentials:'same-origin',headers:{'X-File-Name':encodeURIComponent(f.name),'Content-Type':f.type||'application/octet-stream'},body:f});
  let j=null;try{j=await r.json()}catch(e){}
  if(!r.ok||!j||!j.ok)throw new Error((j&&j.error)||'The upload failed. Try again.');
  C.db.files[j.file.id]={id:j.file.id,orig:j.file.orig,size:j.file.size,type:f.type||'application/pdf',name:null,by:C.me.name,kind:'',at:Date.now(),appId:null};
  return j.file;
};
C.getBlob=id=>fetch('api/files/'+encodeURIComponent(id),{credentials:'same-origin'}).then(r=>{if(!r.ok)throw new Error('The file could not be opened.');return r.blob()});
})(window.CCS=window.CCS||{});
