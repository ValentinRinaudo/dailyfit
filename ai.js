/* Daily Fit on-device AI. The models run in a background worker (ai-worker.js), so the app stays responsive.
   - FashionCLIP (Marqo) for recognising garments and comparing looks
   - RMBG-1.4 (BRIA, non-commercial licence; fine for personal use) for cutting out the background */
(() => {
"use strict";
const EXPECTED_BYTES = 200e6;
const st = { state:"off", progress:0, error:"", canCutout:false };
const subs = new Set();
const emit = () => subs.forEach(f => { try { f({...st}); } catch {} });
const textCache = new Map();
let W = null, seq = 0, loading = null;
const pending = new Map();

function worker(){
  if (W) return W;
  W = new Worker("ai-worker.js", { type:"module" });
  W.onmessage = e => {
    const m = e.data;
    if (m.type === "progress"){ st.progress = Math.min(.99, m.loaded / EXPECTED_BYTES); emit(); return; }
    const p = pending.get(m.id); if (!p) return; pending.delete(m.id);
    m.ok ? p.res(m.result) : p.rej(new Error(m.error));
  };
  W.onerror = e => { for (const p of pending.values()) p.rej(new Error(e.message || "AI worker failed")); pending.clear(); };
  return W;
}
function call(type, arg, transfer = []){
  return new Promise((res, rej) => { const id = ++seq; pending.set(id, { res, rej }); worker().postMessage({ id, type, arg }, transfer); });
}

/* garment vocabulary (benchmarked: 96% category accuracy on 304 catalogue photos) */
const FINE = {
  top:["t-shirt","polo shirt","button-up shirt","flannel shirt","tank top"],
  layer:["hoodie","sweatshirt","crewneck sweatshirt","knit sweater","jumper","cardigan","fleece pullover","quarter-zip sweater"],
  outer:["jacket","zip-up track jacket","bomber jacket","puffer jacket","denim jacket","leather jacket","windbreaker","coat","parka","blazer","gilet vest"],
  bottom:["jeans","trousers","cargo pants","track pants","sweatpants","shorts","chinos"],
  shoes:["sneakers","running shoes","boots","loafers","dress shoes","sandals","flip flops","slides"],
  hat:["baseball cap","beanie","bucket hat","balaclava"],
  gloves:["gloves"],
  jewelry:["necklace","chain necklace","ring","bracelet","wristwatch","earring"],
  acc:["backpack","crossbody bag","tote bag","sunglasses","belt"],
  none:["socks","wallet","underwear","perfume","phone case"]
};
const LABELS = []; for (const [c,ls] of Object.entries(FINE)) for (const l of ls) LABELS.push({c,l});
const COLOR_NAMES = ["black","dark grey","grey","light grey","white","cream","beige","brown","olive","khaki","navy","denim","blue","teal","green","yellow","orange","red","burgundy","pink","purple"];

function norm(arr){ let s=0; for (let i=0;i<arr.length;i++) s+=arr[i]*arr[i]; s=Math.sqrt(s)||1; const o=new Float32Array(arr.length); for (let i=0;i<arr.length;i++) o[i]=arr[i]/s; return o; }
function cos(a,b){ if (!a||!b) return 0; let s=0; const n=Math.min(a.length,b.length); for (let i=0;i<n;i++) s+=a[i]*b[i]; return s; }
function mean(vs){ const v=vs.filter(Boolean); if (!v.length) return null; const o=new Float32Array(v[0].length); for (const x of v) for (let i=0;i<o.length;i++) o[i]+=x[i]; return norm(o); }
function softmax(xs, scale=100){ const l=xs.map(x=>x*scale), m=Math.max(...l), e=l.map(x=>Math.exp(x-m)), z=e.reduce((a,b)=>a+b,0); return e.map(x=>x/z); }

async function load(){
  if (st.state === "ready") return;
  if (loading) return loading;
  st.state = "loading"; st.progress = 0; st.error = ""; emit();
  loading = call("load").then(r => { st.canCutout = !!(r && r.canCutout); st.state = "ready"; st.progress = 1; emit(); })
    .catch(e => { st.state = "error"; st.error = String((e && e.message) || e); loading = null; if (W){ W.terminate(); W = null; } emit(); throw e; });
  return loading;
}
/* images go to the worker as compact JPEG/PNG blobs, capped in size so the copy is cheap */
async function toBlob(src, max = 640){
  if (src instanceof Blob){
    if (src.size < 400e3) return src;
    try { const bm = await createImageBitmap(src); const r = Math.min(1, max / Math.max(bm.width, bm.height));
      const c = document.createElement("canvas"); c.width = Math.round(bm.width * r); c.height = Math.round(bm.height * r); c.getContext("2d").drawImage(bm, 0, 0, c.width, c.height); bm.close && bm.close();
      return await new Promise(res => c.toBlob(res, "image/jpeg", .9)); } catch { return src; }
  }
  if (src instanceof HTMLCanvasElement || src instanceof HTMLImageElement || (typeof ImageBitmap!=="undefined" && src instanceof ImageBitmap)){
    const w = src.naturalWidth || src.width, h = src.naturalHeight || src.height, r = Math.min(1, max / Math.max(w, h));
    const c = document.createElement("canvas"); c.width = Math.max(1, Math.round(w * r)); c.height = Math.max(1, Math.round(h * r)); c.getContext("2d").drawImage(src, 0, 0, c.width, c.height);
    return await new Promise(res => c.toBlob(res, "image/jpeg", .9));
  }
  throw new Error("unsupported image");
}
async function embedImage(src){ if (st.state !== "ready") throw new Error("AI not ready"); return await call("embedImage", await toBlob(src, 448)); }
async function embedTexts(arr){
  if (st.state !== "ready") throw new Error("AI not ready");
  const need = [...new Set(arr.filter(t => !textCache.has(t)))];
  if (need.length){ const v = await call("embedTexts", need); need.forEach((t, i) => textCache.set(t, v[i])); }
  return arr.map(t => textCache.get(t));
}
/* garment recognition with honest confidence */
/* emb can be one embedding or several views of the same piece (e.g. photo + cutout): their probabilities are averaged */
async function recognize(emb, only=null){
  const labels = only ? LABELS.filter(x=>only.includes(x.c)) : LABELS;
  const TV=await embedTexts(labels.map(x=>`a photo of a ${x.l}`));
  const views = Array.isArray(emb) ? emb : [emb];
  const Ps = views.map(e=>softmax(TV.map(v=>cos(e,v))));
  const P = Ps[0].map((_,i)=>Ps.reduce((a,p)=>a+p[i],0)/Ps.length);
  const cat={}, kindBest={};
  labels.forEach((x,i)=>{ cat[x.c]=(cat[x.c]||0)+P[i]; if (!kindBest[x.c]||P[i]>kindBest[x.c].p) kindBest[x.c]={l:x.l,p:P[i]}; });
  const ranked=Object.entries(cat).sort((a,b)=>b[1]-a[1]);
  return { cat:ranked[0][0], conf:ranked[0][1], kind:kindBest[ranked[0][0]].l, second:ranked[1]?ranked[1][0]:null, secondConf:ranked[1]?ranked[1][1]:0, secondKind:ranked[1]?kindBest[ranked[1][0]].l:null };
}
async function colorProbs(emb){
  const TV=await embedTexts(COLOR_NAMES.map(n=>`a ${n==="denim"?"denim blue":n} clothing item`));
  const P=softmax(TV.map(v=>cos(emb,v)));
  const o={}; COLOR_NAMES.forEach((n,i)=>o[n]=P[i]); return o;
}
async function metal(emb){
  const TV=await embedTexts(["a silver metal jewellery piece","a gold metal jewellery piece"]);
  const P=softmax(TV.map(v=>cos(emb,v))); return P[0]>.6?"silver":P[1]>.6?"gold":null;
}
/* returns a canvas with transparent background, trimmed to the garment, or null if it failed */
async function removeBackground(blob){
  if (st.state !== "ready" || !st.canCutout) return null;
  const r = await call("cutout", await toBlob(blob, 1024));
  if (!r) return null;
  const c = document.createElement("canvas"); c.width = r.w; c.height = r.h;
  c.getContext("2d").putImageData(new ImageData(r.data, r.w, r.h), 0, 0);
  return c;
}
async function textVector(prompts){ return mean(await embedTexts(prompts)); }

window.DFAI = { load, embedImage, embedTexts, recognize, colorProbs, metal, removeBackground, textVector, cos, mean, norm, FINE,
  get state(){ return st.state; }, get progress(){ return st.progress; }, get error(){ return st.error; }, get canCutout(){ return st.canCutout; },
  subscribe(f){ subs.add(f); return ()=>subs.delete(f); } };
})();
