/* Daily Fit trend tracker. Runs free on GitHub Actions once a day (see .github/workflows/trends.yml).
   1. Reads streetwear editorial feeds (titles, text and article images).
   2. Tags every new article image with FashionCLIP (garment types, fits, colours) and counts keyword mentions.
   3. Adds the counts to a rolling weekly history, so a trend is "rising" only when it beats its own recent baseline.
   4. Writes data/trends.json, which the app downloads and blends into fits and the Shop.
   No API keys, no paid services. */
import { AutoProcessor, AutoTokenizer, CLIPVisionModelWithProjection, CLIPTextModelWithProjection, RawImage, env } from "@huggingface/transformers";
import fs from "fs";

const FEEDS = process.env.TREND_FEEDS ? JSON.parse(process.env.TREND_FEEDS) : [
  { name: "Hypebeast Fashion", url: "https://hypebeast.com/fashion/feed" },
  { name: "Hypebeast Footwear", url: "https://hypebeast.com/footwear/feed" },
  { name: "Hypebeast Korea", url: "https://hypebeast.kr/feed" },
  { name: "Highsnobiety", url: "https://www.highsnobiety.com/feed/" }
];
const MAX_IMAGES = 90, WEEKS_KEPT = 12;
const HIST = "data/trend-history.json", OUT = "data/trends.json";

/* What we track. Each attribute maps onto fields the app understands (cats/kinds/fits/subs/colors),
   with the words that signal it in English and Korean, and a prompt for the image model. */
const A = (id, name, match, words, prompt, piece = null) => ({ id, name, match, words, prompt, piece });
const ATTRS = [
  A("wide-trousers", "Wide-leg trousers", { cats: ["bottom"], fits: ["wide"] }, ["wide[- ]leg", "wide trousers", "baggy", "balloon pant", "와이드"], "a photo of wide-leg baggy trousers", { cat: "bottom", kind: "trousers", fit: "wide" }),
  A("relaxed-denim", "Relaxed jeans", { kinds: ["jeans"], fits: ["relaxed", "wide"] }, ["baggy jeans", "relaxed jeans", "loose jeans", "wide jeans", "carpenter jean", "와이드 데님", "데님 팬츠"], "a photo of relaxed baggy jeans", { cat: "bottom", kind: "jeans", fit: "relaxed" }),
  A("cargo", "Cargo pants", { kinds: ["cargo pants"] }, ["cargo", "카고"], "a photo of cargo pants", { cat: "bottom", kind: "cargo pants", fit: "relaxed" }),
  A("track-pants", "Track pants", { kinds: ["track pants"] }, ["track ?pant", "trackpant", "트랙 팬츠"], "a photo of track pants", { cat: "bottom", kind: "track pants", fit: "relaxed" }),
  A("shorts", "Long shorts", { kinds: ["shorts"] }, ["jorts", "long shorts", "bermuda", "버뮤다"], "a photo of long baggy shorts", { cat: "bottom", kind: "shorts", fit: "relaxed" }),
  A("hoodie", "Heavy hoodies", { kinds: ["hoodie"] }, ["hoodie", "후디", "후드"], "a photo of a heavyweight hoodie", { cat: "layer", kind: "hoodie", fit: "relaxed" }),
  A("knit", "Chunky knits", { kinds: ["knit sweater", "cardigan", "jumper"] }, ["knit", "sweater", "cardigan", "jumper", "니트", "카디건"], "a photo of a chunky knit sweater", { cat: "layer", kind: "knit sweater", fit: "relaxed" }),
  A("fleece", "Fleece", { kinds: ["fleece pullover"] }, ["fleece", "플리스"], "a photo of a fleece jacket", { cat: "layer", kind: "fleece pullover" }),
  A("puffer", "Puffers", { kinds: ["puffer jacket", "parka"] }, ["puffer", "down jacket", "패딩", "다운 재킷"], "a photo of a puffer jacket", { cat: "outer", kind: "puffer jacket", warmth: 3 }),
  A("shell", "Technical shells", { kinds: ["windbreaker"] }, ["shell jacket", "gore-?tex", "windbreaker", "anorak", "바람막이", "고어텍스"], "a photo of a technical shell jacket", { cat: "outer", kind: "windbreaker" }),
  A("workwear", "Workwear jackets", { kinds: ["jacket", "denim jacket"] }, ["chore jacket", "work jacket", "workwear", "carhartt", "워크웨어"], "a photo of a workwear chore jacket", { cat: "outer", kind: "jacket" }),
  A("leather", "Leather jackets", { kinds: ["leather jacket"] }, ["leather jacket", "leather", "레더", "가죽"], "a photo of a leather jacket", { cat: "outer", kind: "leather jacket" }),
  A("bomber", "Bombers", { kinds: ["bomber jacket"] }, ["bomber", "ma-1", "봄버"], "a photo of a bomber jacket", { cat: "outer", kind: "bomber jacket" }),
  A("track-jacket", "Track jackets", { kinds: ["zip-up track jacket"] }, ["track jacket", "track top", "트랙 재킷", "트랙탑"], "a photo of a zip-up track jacket", { cat: "outer", kind: "zip-up track jacket", warmth: 1 }),
  A("coat", "Long coats", { kinds: ["coat"] }, ["overcoat", "long coat", "wool coat", "코트"], "a photo of a long wool coat", { cat: "outer", kind: "coat", warmth: 3 }),
  A("gilet", "Gilets", { kinds: ["gilet vest"] }, ["gilet", "vest", "베스트"], "a photo of a puffer vest gilet", { cat: "outer", kind: "gilet vest" }),
  A("graphic-tee", "Boxy tees", { kinds: ["t-shirt"], fits: ["relaxed", "wide"] }, ["graphic tee", "boxy tee", "t-shirt", "tee", "티셔츠"], "a photo of a boxy oversized t-shirt", { cat: "top", kind: "t-shirt", fit: "relaxed" }),
  A("rugby", "Rugby & polo shirts", { kinds: ["polo shirt"] }, ["rugby shirt", "polo", "럭비", "폴로"], "a photo of a rugby polo shirt", { cat: "top", kind: "polo shirt" }),
  A("flannel", "Flannel shirts", { kinds: ["flannel shirt", "button-up shirt"] }, ["flannel", "check shirt", "플란넬"], "a photo of a flannel shirt", { cat: "top", kind: "flannel shirt" }),
  A("retro-sneaker", "Low-profile sneakers", { subs: ["sneaker"] }, ["samba", "gazelle", "sl 72", "taekwondo", "low-?profile", "terrace", "suede sneaker", "스니커"], "a photo of slim low-profile retro sneakers", { cat: "shoes", kind: "sneakers", sub: "sneaker" }),
  A("runner", "Running shoes", { kinds: ["running shoes"] }, ["runner", "running shoe", "trail", "러닝화"], "a photo of technical running shoes", { cat: "shoes", kind: "running shoes", sub: "sneaker" }),
  A("boots", "Boots", { subs: ["boot"] }, ["boot", "부츠"], "a photo of boots", { cat: "shoes", kind: "boots", sub: "boot", form: 2 }),
  A("loafers", "Loafers", { subs: ["dress"] }, ["loafer", "로퍼"], "a photo of loafers", { cat: "shoes", kind: "loafers", sub: "dress", form: 2 }),
  A("beanie", "Beanies", { subs: ["beanie", "skullcap"] }, ["beanie", "비니"], "a photo of a knit beanie", { cat: "hat", kind: "beanie", sub: "beanie" }),
  A("cap", "Caps", { subs: ["cap"] }, ["baseball cap", "\\bcap\\b", "볼캡"], "a photo of a baseball cap", { cat: "hat", kind: "baseball cap", sub: "cap" }),
  A("balaclava", "Balaclavas", { subs: ["balaclava"] }, ["balaclava", "바라클라바"], "a photo of a balaclava", { cat: "hat", kind: "balaclava", sub: "balaclava", warmth: 3 }),
  A("chain", "Silver chains", { subs: ["chain", "pendant"] }, ["chain", "necklace", "pendant", "체인", "목걸이"], "a photo of a silver chain necklace", { cat: "jewelry", kind: "chain necklace", sub: "chain", metal: "silver" }),
  A("ring", "Rings", { subs: ["ring"] }, ["\\brings?\\b", "반지"], "a photo of silver rings", { cat: "jewelry", kind: "ring", sub: "ring", metal: "silver" }),
  A("bag", "Crossbody bags", { subs: ["bag"] }, ["crossbody", "shoulder bag", "messenger", "크로스백"], "a photo of a crossbody bag", { cat: "acc", kind: "crossbody bag", sub: "bag" })
];
const COLORS = ["black", "grey", "white", "cream", "beige", "brown", "olive", "khaki", "navy", "blue", "green", "red", "burgundy", "pink", "purple", "orange", "yellow"];
const COLOR_WORDS = { black: ["black", "블랙"], grey: ["grey", "gray", "charcoal", "그레이"], white: ["white", "화이트"], cream: ["cream", "ecru", "off-white", "크림"], beige: ["beige", "tan", "sand", "베이지"],
  brown: ["brown", "chocolate", "mocha", "브라운"], olive: ["olive", "올리브"], khaki: ["khaki", "카키"], navy: ["navy", "네이비"], blue: ["blue", "블루"], green: ["green", "그린"], red: ["\\bred\\b", "레드"],
  burgundy: ["burgundy", "maroon", "oxblood", "버건디"], pink: ["pink", "핑크"], purple: ["purple", "퍼플"], orange: ["orange", "오렌지"], yellow: ["yellow", "옐로"] };

/* ---------- feeds ---------- */
const decode = s => s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#0?39;/g, "'");
const tag = (x, t) => { const m = x.match(new RegExp(`<${t}[^>]*>([\\s\\S]*?)</${t}>`, "i")); return m ? decode(m[1]).trim() : ""; };
async function readFeed(f) {
  const r = await fetch(f.url, { headers: { "user-agent": "DailyFitTrendBot/1.0 (+personal wardrobe app)" }, signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error(f.name + " " + r.status);
  const xml = await r.text(); const items = [];
  for (const m of xml.matchAll(/<item[\s>][\s\S]*?(?:<\/item>|$)/gi)) {
    const x = m[0], title = tag(x, "title"), link = tag(x, "link") || tag(x, "guid"), date = Date.parse(tag(x, "pubDate")) || Date.now();
    const html = tag(x, "description") + " " + tag(x, "content:encoded");
    const imgs = [...html.matchAll(/<img[^>]+src="([^"]+)"/gi), ...x.matchAll(/<media:(?:content|thumbnail)[^>]+url="([^"]+)"/gi), ...x.matchAll(/<enclosure[^>]+url="([^"]+\.(?:jpe?g|png|webp)[^"]*)"/gi)].map(m => m[1]);
    const text = (title + " " + html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ");
    if (title && link) items.push({ id: link, title, link, date, text, imgs: [...new Set(imgs)].slice(0, 2), source: f.name });
  }
  return items;
}

/* ---------- model ---------- */
env.cacheDir = "./trends-cache";
const MID = "Marqo/marqo-fashionCLIP";
let proc, tok, vis, txt;
const norm = v => { let s = 0; for (const x of v) s += x * x; s = Math.sqrt(s) || 1; return Array.from(v, x => x / s); };
const dot = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; };
async function textVecs(arr) { const out = []; for (let i = 0; i < arr.length; i += 32) { const enc = tok(arr.slice(i, i + 32), { padding: "max_length", max_length: 77, truncation: true }); const { text_embeds: t } = await txt(enc); const d = t.dims[1]; for (let j = 0; j < t.dims[0]; j++) out.push(norm(t.data.slice(j * d, (j + 1) * d))); } return out; }
const softmax = xs => { const l = xs.map(x => x * 100), m = Math.max(...l), e = l.map(x => Math.exp(x - m)), z = e.reduce((a, b) => a + b, 0); return e.map(x => x / z); };

/* ---------- main ---------- */
const now = Date.now(), weekStart = t => { const d = new Date(t); d.setUTCHours(0, 0, 0, 0); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return d.toISOString().slice(0, 10); };
fs.mkdirSync("data", { recursive: true });
const hist = fs.existsSync(HIST) ? JSON.parse(fs.readFileSync(HIST, "utf8")) : { weeks: {}, seen: [], examples: {}, colorOf: {}, vector: null, runs: 0 };
const seen = new Set(hist.seen);
const fresh = [], feedStatus = [];
for (const f of FEEDS) { try { const items = await readFeed(f); feedStatus.push({ name: f.name, ok: true, items: items.length }); for (const it of items) if (!seen.has(it.id) && now - it.date < 21 * 864e5) fresh.push(it); } catch (e) { feedStatus.push({ name: f.name, ok: false, error: String(e.message || e).slice(0, 80) }); } }
console.log("feeds:", feedStatus.map(f => `${f.name}:${f.ok ? f.items : "x"}`).join(" "), "| new articles:", fresh.length);

const counts = {}, colorHits = {}; let images = 0, vecSum = null, vecN = 0;
const add = (k, v) => counts[k] = (counts[k] || 0) + v;
for (const it of fresh) {
  const low = it.text.toLowerCase();
  for (const a of ATTRS) if (a.words.some(w => new RegExp(w, "i").test(low))) { add(a.id, 1); (hist.examples[a.id] ||= []).unshift({ title: it.title.slice(0, 120), link: it.link, img: it.imgs[0] || null, t: it.date }); }
  for (const [c, ws] of Object.entries(COLOR_WORDS)) if (ws.some(w => new RegExp(w, "i").test(low))) add("color:" + c, 0.5);
}
if (fresh.some(it => it.imgs.length)) {
  proc = await AutoProcessor.from_pretrained(MID); tok = await AutoTokenizer.from_pretrained(MID);
  vis = await CLIPVisionModelWithProjection.from_pretrained(MID, { dtype: "q8" }); txt = await CLIPTextModelWithProjection.from_pretrained(MID, { dtype: "q8" });
  const NOT = ["a photo of a person's face", "a photo of a car", "a photo of a watch dial", "a photo of furniture", "a photo of food", "a poster with text", "a photo of a building"];
  const TA = await textVecs([...ATTRS.map(a => a.prompt), ...NOT]);
  const TC = await textVecs(COLORS.map(c => `a ${c} clothing item`));
  outer: for (const it of fresh) for (const url of it.imgs) {
    if (images >= MAX_IMAGES) break outer;
    try {
      const img = (await RawImage.read(url)).rgb(); const { image_embeds } = await vis(await proc(img)); const v = norm(image_embeds.data); images++;
      const P = softmax(TA.map(t => dot(v, t))); const clothing = P.slice(0, ATTRS.length).reduce((a, b) => a + b, 0);
      if (clothing < 0.5) continue;                              /* not a clothing image */
      const top = ATTRS.map((a, i) => [a, P[i]]).sort((x, y) => y[1] - x[1]).slice(0, 2).filter(([, p]) => p > 0.12);
      const PC = softmax(TC.map(t => dot(v, t))); const ci = PC.indexOf(Math.max(...PC)), col = PC[ci] > 0.35 ? COLORS[ci] : null;
      for (const [a, p] of top) { add(a.id, 0.6 * p / top[0][1]); if (col) { (colorHits[a.id] ||= {}); colorHits[a.id][col] = (colorHits[a.id][col] || 0) + 1; } (hist.examples[a.id] ||= []).unshift({ title: it.title.slice(0, 120), link: it.link, img: url, t: it.date }); }
      if (col) add("color:" + col, 0.5);
      vecSum = vecSum ? vecSum.map((x, i) => x + v[i]) : v.slice(); vecN++;
    } catch { /* unreadable image: skip */ }
  }
}
console.log("images analysed:", images);

/* ---------- rolling history & momentum ---------- */
const wk = weekStart(now); const W = (hist.weeks[wk] ||= { counts: {}, articles: 0 });
for (const [k, v] of Object.entries(counts)) W.counts[k] = (W.counts[k] || 0) + v; W.articles += fresh.length;
for (const k of Object.keys(hist.weeks).sort().slice(0, -WEEKS_KEPT)) delete hist.weeks[k];
for (const [id, cs] of Object.entries(colorHits)) { const o = (hist.colorOf[id] ||= {}); for (const [c, n] of Object.entries(cs)) o[c] = (o[c] || 0) * 0.9 + n; }
for (const k of Object.keys(hist.examples)) hist.examples[k] = hist.examples[k].filter((e, i, a) => a.findIndex(x => x.link === e.link) === i).slice(0, 6);
if (vecN) { const v = norm(vecSum.map(x => x / vecN)); hist.vector = hist.vector ? norm(hist.vector.map((x, i) => 0.8 * x + 0.2 * v[i])) : v; }
fresh.forEach(it => seen.add(it.id)); hist.seen = [...seen].slice(-3000); hist.runs++;

const weeks = Object.keys(hist.weeks).sort(), recent = weeks.slice(-2), past = weeks.slice(-10, -2);
const share = (ws, k) => { let n = 0, tot = 0; for (const w of ws) { const c = hist.weeks[w]; n += c.counts[k] || 0; tot += Math.max(1, c.articles); } return tot ? n / tot : 0; };
const signals = [];
for (const a of ATTRS) {
  const r = share(recent, a.id), b = share(past, a.id), n = recent.reduce((s, w) => s + (hist.weeks[w].counts[a.id] || 0), 0);
  if (n < 2) continue;
  const momentum = past.length ? (r + 0.01) / (b + 0.01) : 1;   /* >1 means more than its own recent baseline */
  const strength = Math.max(0.2, Math.min(1, 0.35 * Math.log1p(n) * Math.min(2, momentum)));
  const colors = Object.entries(hist.colorOf[a.id] || {}).sort((x, y) => y[1] - x[1]).map(([c]) => c);
  signals.push({ id: "live-" + a.id, name: a.name, match: a.match, regions: ["all"], strength: +strength.toFixed(2), momentum: +momentum.toFixed(2), mentions: +n.toFixed(1),
    rising: past.length >= 2 && momentum >= 1.3, color: colors[0] || null, piece: a.piece, examples: (hist.examples[a.id] || []).slice(0, 3) });
}
signals.sort((x, y) => (y.rising - x.rising) || (y.strength - x.strength));
const colorTrend = COLORS.map(c => ({ c, r: share(recent, "color:" + c), b: share(past, "color:" + c) })).filter(x => x.r > 0).sort((x, y) => (y.r + 0.01) / (y.b + 0.01) - (x.r + 0.01) / (x.b + 0.01)).slice(0, 4).map(x => x.c);

const out = { v: 1, updated: new Date(now).toISOString(), weeksOfHistory: weeks.length, articles: W.articles, imagesThisRun: images, feeds: feedStatus,
  signals: signals.slice(0, 14), colors: colorTrend, vector: hist.vector ? hist.vector.map(x => +x.toFixed(4)) : null };
fs.writeFileSync(OUT, JSON.stringify(out));
fs.writeFileSync(HIST, JSON.stringify(hist));
console.log("signals:", out.signals.map(s => `${s.name}${s.rising ? "↑" : ""}(${s.strength})`).join(", "));
