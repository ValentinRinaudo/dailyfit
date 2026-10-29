/* Daily Fit colour reader: perceptual (CIELAB) clustering on garment pixels and nearest-name matching.
   Works on raw RGBA pixel arrays so the same code runs in the app and in tests. */
(function (root) {
"use strict";
function srgb2lin(c){ c/=255; return c<=0.04045?c/12.92:Math.pow((c+0.055)/1.055,2.4); }
function rgbToLab(r,g,b){
  const R=srgb2lin(r), G=srgb2lin(g), B=srgb2lin(b);
  let x=(R*0.4124+G*0.3576+B*0.1805)/0.95047, y=(R*0.2126+G*0.7152+B*0.0722), z=(R*0.0193+G*0.1192+B*0.9505)/1.08883;
  const f=t=>t>0.008856?Math.cbrt(t):(7.787*t+16/116);
  x=f(x); y=f(y); z=f(z);
  return [116*y-16, 500*(x-y), 200*(y-z)];
}
const hex2rgb=h=>{ const n=parseInt(h.slice(1),16); return [n>>16&255,n>>8&255,n&255]; };
const rgb2hex=(r,g,b)=>"#"+[r,g,b].map(v=>Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,"0")).join("");
/* named references: several shades per name so real garments (washed, shadowed, heathered) still land right */
const NAMED = {
  black:["#0e0e10","#1c1c1e","#262628","#2b2d33"],
  "dark grey":["#3a3b3f","#4a4b50","#45464a"],
  grey:["#6e6f73","#808186","#8d8f94","#75777c"],
  "light grey":["#a9abaf","#bfc1c4","#cfd0d2"],
  white:["#f2f2ef","#e8e8e4","#fafafa","#e2e3e0"],
  cream:["#ece4d2","#e6dcc4","#f0e8d8"],
  beige:["#cdb894","#c8b48f","#d4c3a3","#bfa982"],
  brown:["#5a3e2b","#6b4a33","#4a3324","#7a5a3e","#8b6446"],
  olive:["#5b5b36","#6b6b3e","#4d5232","#727447"],
  khaki:["#a89f68","#9c9463","#b3a875"],
  navy:["#1e2a44","#232f4f","#1b2338","#2c3a5e"],
  denim:["#3b5277","#4a6285","#2f4566","#5b7394","#6f86a6"],
  blue:["#2e5cc4","#3a6fd8","#1f4fb0","#4a7fe0","#6a9bf0"],
  teal:["#2a7f7f","#1f6b6e","#3a8f8a"],
  green:["#2f7a3f","#3a8f4a","#2a6b36","#4caf50","#1e5c30"],
  yellow:["#d9c02b","#e8cc3a","#f0d850"],
  orange:["#d9772b","#e8843a","#c86a24"],
  red:["#b32626","#c62828","#9e1f1f","#d13434"],
  burgundy:["#6e1f2b","#5c1a24","#7a2332"],
  pink:["#d97aa6","#e89ab8","#f0b5c8"],
  purple:["#6b3fa0","#5a3388","#7b52b0","#5e2a5e"]
};
const REF=[]; for (const [n,hs] of Object.entries(NAMED)) for (const h of hs){ const [r,g,b]=hex2rgb(h); REF.push({n,lab:rgbToLab(r,g,b)}); }
const dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
function nameLab(lab){ let best=null; for (const r of REF){ const d=dist(lab,r.lab); if (!best||d<best.d) best={n:r.n,d}; } return best; }
function nameHex(hex){ const [r,g,b]=hex2rgb(hex); return nameLab(rgbToLab(r,g,b)).n; }
/* skin test in YCrCb (Chai & Ngan ranges, slightly widened) */
function isSkin(r,g,b){ const y=0.299*r+0.587*g+0.114*b, cr=(r-y)*0.713+128, cb=(b-y)*0.564+128; return cr>=136&&cr<=176&&cb>=78&&cb<=128&&y>60&&r>g&&r>b; }

/* data: Uint8ClampedArray RGBA, w,h. opts.alpha: true when transparency marks the background (cutout). */
function dominant(data, w, h, opts={}){
  const px=[]; const cx=w/2, cy=h/2;
  let bg=null;
  if (!opts.alpha){
    /* estimate background from the border (most common bucket) */
    const m=new Map();
    const add=i=>{ const k=(data[i]>>4)+"-"+(data[i+1]>>4)+"-"+(data[i+2]>>4); const o=m.get(k)||{n:0,r:0,g:0,b:0}; o.n++; o.r+=data[i]; o.g+=data[i+1]; o.b+=data[i+2]; m.set(k,o); };
    for (let x=0;x<w;x++){ add(x*4); add(((h-1)*w+x)*4); } for (let y=0;y<h;y++){ add(y*w*4); add((y*w+w-1)*4); }
    let b=null; for (const o of m.values()) if (!b||o.n>b.n) b=o;
    bg=rgbToLab(b.r/b.n,b.g/b.n,b.b/b.n);
  }
  const step=Math.max(1,Math.floor(Math.sqrt(w*h/9000)));
  let skin=0, total=0;
  for (let y=0;y<h;y+=step) for (let x=0;x<w;x+=step){
    const i=(y*w+x)*4, a=data[i+3];
    if (opts.alpha && a<160) continue;
    const r=data[i], g=data[i+1], b=data[i+2], lab=rgbToLab(r,g,b);
    if (bg && dist(lab,bg)<10) continue;
    total++;
    if (isSkin(r,g,b)){ skin++; continue; }
    const dx=(x-cx)/w, dy=(y-cy)/h, wgt=Math.exp(-(dx*dx+dy*dy)*3.2);
    px.push({lab, r,g,b, w:wgt});
  }
  /* if almost everything was "skin", the garment itself is skin-toned (beige, tan): use those pixels */
  if (px.length < Math.max(12,total*0.15)){
    px.length=0;
    for (let y=0;y<h;y+=step) for (let x=0;x<w;x+=step){ const i=(y*w+x)*4; if (opts.alpha&&data[i+3]<160) continue;
      const lab=rgbToLab(data[i],data[i+1],data[i+2]); if (bg&&dist(lab,bg)<10) continue; px.push({lab,r:data[i],g:data[i+1],b:data[i+2],w:1}); }
  }
  /* garment on a same-coloured backdrop (white tee on white wall): fall back to the centre */
  if (!px.length){ const i=((h>>1)*w+(w>>1))*4; return {hex:rgb2hex(data[i],data[i+1],data[i+2]), name:nameHex(rgb2hex(data[i],data[i+1],data[i+2])), share:1, second:null}; }
  /* weighted k-means in Lab */
  const K=Math.min(4,px.length);
  let C=[]; const sorted=[...px].sort((a,b)=>a.lab[0]-b.lab[0]); for (let k=0;k<K;k++) C.push([...sorted[Math.floor((k+.5)*sorted.length/K)].lab]);
  let assign=new Array(px.length).fill(0);
  for (let it=0;it<12;it++){
    for (let p=0;p<px.length;p++){ let bi=0,bd=1e9; for (let k=0;k<K;k++){ const d=dist(px[p].lab,C[k]); if (d<bd){bd=d;bi=k;} } assign[p]=bi; }
    const S=C.map(()=>[0,0,0,0]); for (let p=0;p<px.length;p++){ const s=S[assign[p]], q=px[p]; s[0]+=q.lab[0]*q.w; s[1]+=q.lab[1]*q.w; s[2]+=q.lab[2]*q.w; s[3]+=q.w; }
    C=C.map((c,k)=>S[k][3]?[S[k][0]/S[k][3],S[k][1]/S[k][3],S[k][2]/S[k][3]]:c);
  }
  const W=C.map(()=>0), RGB=C.map(()=>[0,0,0,0]); let tw=0;
  for (let p=0;p<px.length;p++){ const k=assign[p], q=px[p]; W[k]+=q.w; tw+=q.w; RGB[k][0]+=q.r*q.w; RGB[k][1]+=q.g*q.w; RGB[k][2]+=q.b*q.w; RGB[k][3]+=q.w; }
  const order=W.map((v,k)=>k).sort((a,b)=>W[b]-W[a]);
  /* merge clusters that read as the same named colour */
  const named=order.map(k=>({k, name:nameLab(C[k]).n, w:W[k]/tw}));
  const agg=new Map(); for (const c of named){ const o=agg.get(c.name)||{w:0,k:c.k}; o.w+=c.w; agg.set(c.name,o); }
  const ranked=[...agg.entries()].sort((a,b)=>b[1].w-a[1].w);
  const [topName,top]=ranked[0], k=top.k, rgb=RGB[k];
  return {hex:rgb2hex(rgb[0]/rgb[3],rgb[1]/rgb[3],rgb[2]/rgb[3]), name:topName, share:top.w, second:ranked[1]?{name:ranked[1][0],share:ranked[1][1].w}:null};
}
const CANON={}; for (const [n,hs] of Object.entries(NAMED)) CANON[n]=hs[0];
CANON.white="#f2f2ef"; CANON.grey="#808186"; CANON.navy="#232f4f"; CANON.denim="#4a6285"; CANON.brown="#6b4a33"; CANON.beige="#cdb894";
const api={rgbToLab, nameHex, dominant, NAMES:Object.keys(NAMED), CANON, isSkin};
if (typeof module!=="undefined" && module.exports) module.exports=api; else root.DFColor=api;
})(typeof window!=="undefined"?window:globalThis);
