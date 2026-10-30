/* Daily Fit AI worker: runs the models off the main thread so the app never freezes while they work. */
const LIB = "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.5/dist/transformers.min.js";
const CLIP = "Marqo/marqo-fashionCLIP";
const RMBG = "briaai/RMBG-1.4";
let T = null, proc = null, tok = null, vis = null, txt = null, seg = null, loading = null;
let chain = Promise.resolve();                 /* one job at a time: the models are not re-entrant */
const run = fn => (chain = chain.then(fn, fn));

function norm(a){ let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * a[i]; s = Math.sqrt(s) || 1; const o = new Float32Array(a.length); for (let i = 0; i < a.length; i++) o[i] = a[i] / s; return o; }

async function load(){
  if (loading) return loading;
  loading = (async () => {
    T = await import(LIB); T.env.allowLocalModels = false;
    const files = {};
    const cb = p => { if (p && p.status === "progress" && p.loaded != null){ files[(p.name || "") + (p.file || "")] = p.loaded; postMessage({ type:"progress", loaded:Object.values(files).reduce((a, b) => a + b, 0) }); } };
    proc = await T.AutoProcessor.from_pretrained(CLIP, { progress_callback:cb });
    tok = await T.AutoTokenizer.from_pretrained(CLIP, { progress_callback:cb });
    vis = await T.CLIPVisionModelWithProjection.from_pretrained(CLIP, { dtype:"q8", device:"wasm", progress_callback:cb });
    txt = await T.CLIPTextModelWithProjection.from_pretrained(CLIP, { dtype:"q8", device:"wasm", progress_callback:cb });
    try { seg = await T.pipeline("background-removal", RMBG, { dtype:"q8", device:"wasm", progress_callback:cb }); } catch (e) { seg = null; }
    return { canCutout: !!seg };
  })().catch(e => { loading = null; throw e; });
  return loading;
}
async function embedImage(blob){
  const img = (await T.RawImage.fromBlob(blob)).rgb();
  const { image_embeds } = await vis(await proc(img));
  return norm(image_embeds.data);
}
async function embedTexts(arr){
  const out = [];
  for (let i = 0; i < arr.length; i += 32){
    const chunk = arr.slice(i, i + 32), enc = tok(chunk, { padding:"max_length", max_length:77, truncation:true });
    const { text_embeds:e } = await txt(enc); const d = e.dims[1];
    chunk.forEach((_, j) => out.push(norm(e.data.slice(j * d, (j + 1) * d))));
  }
  return out;
}
/* cut out the garment and trim to it; returns RGBA pixels or null when almost nothing was kept */
async function cutout(blob){
  if (!seg) return null;
  const out = await seg((await T.RawImage.fromBlob(blob)).rgb()); const img = Array.isArray(out) ? out[0] : out;
  const { width:w, height:h, data:d } = img, ch = img.channels || 4;
  if (ch !== 4) return null;
  let x0 = w, y0 = h, x1 = -1, y1 = -1, fg = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++){ if (d[(y * w + x) * 4 + 3] > 40){ fg++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } }
  if (fg < w * h * 0.03 || x1 < 0) return null;
  const pad = Math.round(Math.max(x1 - x0, y1 - y0) * 0.04);
  x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(w - 1, x1 + pad); y1 = Math.min(h - 1, y1 + pad);
  const cw = x1 - x0 + 1, chh = y1 - y0 + 1, o = new Uint8ClampedArray(cw * chh * 4);
  for (let y = 0; y < chh; y++) o.set(d.subarray(((y + y0) * w + x0) * 4, ((y + y0) * w + x0 + cw) * 4), y * cw * 4);
  return { w:cw, h:chh, data:o };
}
onmessage = async e => {
  const { id, type, arg } = e.data;
  try {
    let result, transfer = [];
    if (type === "load") result = await load();
    else {
      await load();
      result = await run(async () => {
        if (type === "embedImage"){ const v = await embedImage(arg); transfer = [v.buffer]; return v; }
        if (type === "embedTexts"){ const v = await embedTexts(arg); transfer = v.map(x => x.buffer); return v; }
        if (type === "cutout"){ const c = await cutout(arg); if (c) transfer = [c.data.buffer]; return c; }
        throw new Error("unknown job " + type);
      });
    }
    postMessage({ id, ok:true, result }, transfer);
  } catch (err) {
    postMessage({ id, ok:false, error:String((err && err.message) || err) });
  }
};
