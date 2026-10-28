/* Daily Fit on-device AI: Marqo FashionCLIP running in the browser via Transformers.js.
   Downloads once (~150 MB), then works offline. Nothing leaves the phone. */
(() => {
"use strict";
const LIB = "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.5/dist/transformers.min.js";
const MODEL = "Marqo/marqo-fashionCLIP";
const EXPECTED_BYTES = 152e6;
let T = null, proc = null, tok = null, vis = null, txt = null, loading = null;
const st = { state: "off", progress: 0, error: "" };
const subs = new Set();
const emit = () => subs.forEach(f => { try { f({ ...st }); } catch {} });
const textCache = new Map();

function norm(arr){ let s = 0; for (let i = 0; i < arr.length; i++) s += arr[i] * arr[i]; s = Math.sqrt(s) || 1;
  const out = new Float32Array(arr.length); for (let i = 0; i < arr.length; i++) out[i] = arr[i] / s; return out; }
function cos(a, b){ if (!a || !b) return 0; let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; }
function mean(vs){ const v = vs.filter(Boolean); if (!v.length) return null; const out = new Float32Array(v[0].length);
  for (const x of v) for (let i = 0; i < out.length; i++) out[i] += x[i]; return norm(out); }

async function load(){
  if (st.state === "ready") return;
  if (loading) return loading;
  st.state = "loading"; st.progress = 0; st.error = ""; emit();
  loading = (async () => {
    T = await import(LIB);
    T.env.allowLocalModels = false;
    const files = {};
    const cb = p => { if (p && p.status === "progress" && p.loaded != null){ files[p.file || p.name] = p.loaded;
      st.progress = Math.min(.99, Object.values(files).reduce((a, b) => a + b, 0) / EXPECTED_BYTES); emit(); } };
    proc = await T.AutoProcessor.from_pretrained(MODEL, { progress_callback: cb });
    tok = await T.AutoTokenizer.from_pretrained(MODEL, { progress_callback: cb });
    vis = await T.CLIPVisionModelWithProjection.from_pretrained(MODEL, { dtype: "q8", device: "wasm", progress_callback: cb });
    txt = await T.CLIPTextModelWithProjection.from_pretrained(MODEL, { dtype: "q8", device: "wasm", progress_callback: cb });
    st.state = "ready"; st.progress = 1; emit();
  })().catch(e => { st.state = "error"; st.error = String((e && e.message) || e); loading = null; emit(); throw e; });
  return loading;
}

/* source: Blob, HTMLCanvasElement or HTMLImageElement */
async function embedImage(source){
  if (st.state !== "ready") throw new Error("AI not ready");
  let blob = source;
  if (source instanceof HTMLCanvasElement) blob = await new Promise(r => source.toBlob(r, "image/jpeg", .9));
  else if (source instanceof HTMLImageElement){ const c = document.createElement("canvas"); c.width = source.naturalWidth; c.height = source.naturalHeight;
    c.getContext("2d").drawImage(source, 0, 0); blob = await new Promise(r => c.toBlob(r, "image/jpeg", .9)); }
  const img = await T.RawImage.fromBlob(blob);
  const { image_embeds } = await vis(await proc(img));
  return norm(image_embeds.data);
}
async function embedTexts(arr){
  if (st.state !== "ready") throw new Error("AI not ready");
  const need = arr.filter(t => !textCache.has(t));
  if (need.length){
    const enc = tok(need, { padding: "max_length", max_length: 77, truncation: true });
    const { text_embeds: e } = await txt(enc); const d = e.dims[1];
    need.forEach((t, i) => textCache.set(t, norm(e.data.slice(i * d, (i + 1) * d))));
  }
  return arr.map(t => textCache.get(t));
}
/* groups: {key: [prompt, ...]} -> ranked [{key, score}] */
async function classify(emb, groups){
  const keys = Object.keys(groups), out = [];
  for (const k of keys){ const v = mean(await embedTexts(groups[k])); out.push({ key: k, score: cos(emb, v) }); }
  return out.sort((a, b) => b.score - a.score);
}
async function textVector(prompts){ return mean(await embedTexts(prompts)); }

window.DFAI = { load, embedImage, embedTexts, classify, textVector, cos, mean, norm,
  get state(){ return st.state; }, get progress(){ return st.progress; }, get error(){ return st.error; },
  subscribe(f){ subs.add(f); return () => subs.delete(f); } };
})();
