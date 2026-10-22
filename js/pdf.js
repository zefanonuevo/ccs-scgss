/* CCS SCGSS: a small PDF writer for the reimbursement report.
   Draws real text, complete table borders and the Dean's signature image on A4 pages, so the downloaded file looks like the report on screen. */
(function(C){
"use strict";
const W=595.28,H=841.89,M=40,PAD=4,LW=0.6;
const latin=s=>String(s==null?'':s).replace(/₱/g,'PHP ').replace(/[“”]/g,'"').replace(/[‘’]/g,"'").replace(/…/g,'...').replace(/[–—]/g,'-').replace(/✓/g,'Yes').replace(/[^\x20-\x7e\xa0-\xff]/g,'?');
const esc=s=>latin(s).replace(/[\\()]/g,'\\$&');
const mc=document.createElement('canvas').getContext('2d');
const tw=(s,size,bold)=>{mc.font=(bold?'bold ':'')+size+'px Helvetica, Arial, sans-serif';return mc.measureText(latin(s)).width};
function wrap(s,w,size,bold){
  const out=[];
  String(s==null?'':s).split('\n').forEach(par=>{
    let line='';
    par.split(/\s+/).filter(Boolean).forEach(word=>{
      while(tw(word,size,bold)>w&&word.length>1){let k=word.length-1;while(k>1&&tw(word.slice(0,k),size,bold)>w)k--;if(line){out.push(line);line=''}out.push(word.slice(0,k));word=word.slice(k)}
      const t=line?line+' '+word:word;
      if(tw(t,size,bold)<=w)line=t;else{out.push(line);line=word}
    });
    out.push(line);
  });
  return out.length?out:[''];
}
const bytes=s=>{const u=new Uint8Array(s.length);for(let i=0;i<s.length;i++)u[i]=s.charCodeAt(i)&255;return u};
function Doc(){this.pages=[];this.imgs=[];this.newPage()}
Doc.prototype.newPage=function(){this.ops=[];this.pages.push(this.ops);this.y=M};
Doc.prototype.text=function(s,x,top,size,bold,rgb){
  const c=rgb?rgb.join(' ')+' rg':'0 g';
  this.ops.push('BT /F'+(bold?2:1)+' '+size+' Tf '+c+' '+x.toFixed(2)+' '+(H-top-size*0.82).toFixed(2)+' Td ('+esc(s)+') Tj ET 0 g');
};
Doc.prototype.rect=function(x,top,w,h,fill){
  if(fill)this.ops.push(fill.join(' ')+' rg '+x.toFixed(2)+' '+(H-top-h).toFixed(2)+' '+w.toFixed(2)+' '+h.toFixed(2)+' re f 0 g');
  this.ops.push(LW+' w 0.25 G '+x.toFixed(2)+' '+(H-top-h).toFixed(2)+' '+w.toFixed(2)+' '+h.toFixed(2)+' re S');
};
Doc.prototype.image=function(img,x,top,w,h){
  let i=this.imgs.indexOf(img);if(i<0){this.imgs.push(img);i=this.imgs.length-1}
  this.ops.push('q '+w.toFixed(2)+' 0 0 '+h.toFixed(2)+' '+x.toFixed(2)+' '+(H-top-h).toFixed(2)+' cm /Im'+i+' Do Q');
};
/* cols: widths. rows: arrays of cells. A cell is a string or {t, b (bold), a ('r'), fill, span, size, img:{jpeg,w,h,fit}}. Every cell gets a full border. */
Doc.prototype.table=function(cols,rows,o){
  o=o||{};const size=o.size||9,lh=size*1.3,x0=M;
  rows.forEach(row=>{
    let ci=0;const cells=row.map(c=>{c=typeof c==='string'?{t:c}:c;const span=c.span||1,w=cols.slice(ci,ci+span).reduce((a,b)=>a+b,0),x=x0+cols.slice(0,ci).reduce((a,b)=>a+b,0);ci+=span;
      const sz=c.size||size,lines=wrap(c.t,w-2*PAD,sz,c.b),th=c.t?lines.length*sz*1.3:0,ih=c.img?c.img.h:0;
      return Object.assign({},c,{w,x,lines,sz,h:th+ih+(c.t&&c.img?PAD:0)+2*PAD+1})});
    const h=Math.max.apply(null,cells.map(c=>c.h));
    if(this.y+h>H-M){this.newPage()}
    cells.forEach(c=>{
      this.rect(c.x,this.y,c.w,h,c.fill);
      let ty=this.y+PAD+1;
      if(c.t)c.lines.forEach(l=>{const tx=c.a==='r'?c.x+c.w-PAD-tw(l,c.sz,c.b):c.x+PAD;this.text(l,tx,ty,c.sz,c.b);ty+=c.sz*1.3});
      if(c.img){const im=c.img;this.image(im.jpeg,c.x+PAD,ty+(c.t?PAD:0),im.w,im.h)}
    });
    this.y+=h;
  });
};
Doc.prototype.gap=function(n){this.y+=n};
Doc.prototype.block=function(s,size,bold,rgb,x){
  wrap(s,W-2*M-(x||0),size,bold).forEach(l=>{if(this.y+size*1.4>H-M)this.newPage();this.text(l,M+(x||0),this.y,size,bold,rgb);this.y+=size*1.4});
};
Doc.prototype.finish=function(){
  const objs=[],add=p=>{objs.push(p);return objs.length};
  const cat=add(null),pgs=add(null),f1=add(['<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>']),f2=add(['<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>']);
  const imgIds=this.imgs.map(im=>add(['<< /Type /XObject /Subtype /Image /Width '+im.pw+' /Height '+im.ph+' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length '+im.bytes.length+' >>\nstream\n',im.bytes,'\nendstream']));
  const kids=[];
  this.pages.forEach((ops,n)=>{
    ops.push('BT /F1 7.5 Tf 0.4 g '+(W-M-40).toFixed(2)+' 22 Td (Page '+(n+1)+' of '+this.pages.length+') Tj ET 0 g');
    const content=ops.join('\n'),cid=add(['<< /Length '+content.length+' >>\nstream\n'+content+'\nendstream']);
    kids.push(add(['<< /Type /Page /Parent '+pgs+' 0 R /MediaBox [0 0 '+W+' '+H+'] /Contents '+cid+' 0 R /Resources << /Font << /F1 '+f1+' 0 R /F2 '+f2+' 0 R >> /XObject << '+imgIds.map((id,i)=>'/Im'+i+' '+id+' 0 R').join(' ')+' >> >> >>']));
  });
  objs[cat-1]=['<< /Type /Catalog /Pages '+pgs+' 0 R >>'];objs[pgs-1]=['<< /Type /Pages /Kids ['+kids.map(k=>k+' 0 R').join(' ')+'] /Count '+kids.length+' >>'];
  const parts=[],offs=[];let len=0;const push=p=>{const b=typeof p==='string'?bytes(p):p;parts.push(b);len+=b.length};
  push('%PDF-1.4\n');
  objs.forEach((o,i)=>{offs.push(len);push((i+1)+' 0 obj\n');o.forEach(push);push('\nendobj\n')});
  const xr=len;
  push('xref\n0 '+(objs.length+1)+'\n0000000000 65535 f \n'+offs.map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')+'trailer\n<< /Size '+(objs.length+1)+' /Root '+cat+' 0 R >>\nstartxref\n'+xr+'\n%%EOF');
  return new Blob(parts,{type:'application/pdf'});
};
/* a picture (data URL) as a JPEG on a white background, ready for the PDF. Resolves to null when it cannot be loaded. */
function jpegOf(src,maxW,maxH){
  return new Promise(res=>{
    if(!src)return res(null);
    const img=new Image();
    img.onload=()=>{
      const iw=img.naturalWidth||img.width||300,ih=img.naturalHeight||img.height||100,k=Math.min(1,900/iw),pw=Math.max(1,Math.round(iw*k)),ph=Math.max(1,Math.round(ih*k));
      const cv=document.createElement('canvas');cv.width=pw;cv.height=ph;const x=cv.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,pw,ph);x.drawImage(img,0,0,pw,ph);
      const b=atob(cv.toDataURL('image/jpeg',0.92).split(',')[1]),u=new Uint8Array(b.length);for(let i=0;i<b.length;i++)u[i]=b.charCodeAt(i);
      const f=Math.min(maxW/pw,maxH/ph);
      res({bytes:u,pw,ph,w:pw*f,h:ph*f});
    };
    img.onerror=()=>res(null);img.src=src;
  });
}
C.PDF={Doc,jpegOf,W,H,M,tw};
})(window.CCS);
