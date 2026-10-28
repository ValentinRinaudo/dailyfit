/* Daily Fit v4 — standalone. Everything is stored on this device (IndexedDB).
   Network: free Open-Meteo weather + city search, and a one-time download of the on-device AI model. */
(() => {
"use strict";
const D = window.DF_DATA;
const AI = window.DFAI;

/* ================= constants ================= */
const CATS = [
  {k:"top",n:"Top"},{k:"layer",n:"Layer"},{k:"bottom",n:"Bottom"},{k:"outer",n:"Outerwear"},
  {k:"shoes",n:"Shoes"},{k:"hat",n:"Headwear"},{k:"gloves",n:"Gloves"},{k:"jewelry",n:"Jewellery"}
];
const CLOTH = ["outer","layer","top","bottom","shoes","hat","gloves"];
const JSLOTS = ["neck","wrist","hand","ear"];
const SLOTS = [...CLOTH, ...JSLOTS];
const SLOT_LABEL = {outer:"Outer",layer:"Layer",top:"Top",bottom:"Bottom",shoes:"Shoes",hat:"Head",gloves:"Hands",neck:"Neck",wrist:"Wrist",hand:"Rings",ear:"Ears"};
const HAT_SUBS = [["cap","Cap"],["skullcap","Skull cap"],["beanie","Beanie"],["balaclava","Balaclava"],["bucket","Bucket hat"]];
const JEWEL_SUBS = [["chain","Chain"],["pendant","Pendant"],["ring","Ring"],["bracelet","Bracelet"],["watch","Watch"],["earring","Earring"]];
const JZONE = {chain:"neck",pendant:"neck",ring:"hand",bracelet:"wrist",watch:"wrist",earring:"ear"};
const METALS = [["silver","Silver"],["gold","Gold"],["mixed","Mixed"],["other","Other"]];
const METAL_HEX = {silver:"#C3C7CC", gold:"#C9A54B", mixed:"#B8AE96", other:"#8A8A8A"};
const FIT = {slim:"Slim", regular:"Regular", relaxed:"Relaxed", wide:"Wide / baggy"};
const FORM = ["", "Casual", "Smart casual", "Dressed up"];
const STYLES = ["gorpcore","tech","workwear","minimal","vintage","skate","graphic","tailored","sport"];
const DIARY_TAGS = ["Felt sharp","Comfy","Got compliments","Too warm","Too cold","Not me"];
const DEFAULT_SETTINGS = {mixPatterns:false, avoidRepeatDays:3, headwear:"auto", gloves:"auto", jewelry:"auto", avoidSkinny:true,
  outStart:9, outEnd:22, manual:false, manualTemp:15, manualRain:false, units:"C", theme:"system", region:"auto",
  thermal:0, aiEnabled:false, autoTag:true};
const DEFAULT_PROFILE = {height:"1.80 m", weight:"70 kg", hair:"Black buzz cut", jewelry:"Mostly silver"};

/* AI prompt ensembles (category accuracy measured at 95% on 125 catalogue photos) */
const P_CAT = {
  top:["a t-shirt","a shirt","a polo shirt","a tank top","a long sleeve top"],
  layer:["a sweatshirt","a hoodie","a sweater","a cardigan","a fleece pullover"],
  bottom:["jeans","trousers","track pants","shorts","cargo pants"],
  outer:["a jacket","a coat","a puffer jacket","a windbreaker","a leather jacket"],
  shoes:["sneakers","shoes","boots","sandals","loafers"],
  hat:["a cap","a beanie","a bucket hat","a hat","a balaclava"],
  gloves:["gloves","mittens"],
  jewelry:["a necklace","a ring","a bracelet","a watch","an earring","a chain necklace"]
};
const P_HAT = {cap:["a baseball cap"], skullcap:["a skull cap","a short fisherman beanie"], beanie:["a knit beanie"], balaclava:["a knit balaclava"], bucket:["a bucket hat"]};
const P_JEWEL = {chain:["a chain necklace"], pendant:["a pendant necklace"], ring:["a ring"], bracelet:["a bracelet"], watch:["a wristwatch"], earring:["an earring"]};
const P_METAL = {silver:["silver jewellery","a silver metal accessory"], gold:["gold jewellery","a gold metal accessory"]};
const P_STYLE = {gorpcore:["gorpcore outdoor technical clothing"], tech:["techwear"], workwear:["workwear clothing"], minimal:["minimalist plain clothing"],
  vintage:["vintage retro clothing"], skate:["skatewear"], graphic:["a graphic print garment"], tailored:["tailored smart clothing"], sport:["athletic sportswear"]};
const P_PATTERN = {solid:["a plain solid colour garment"], pattern:["a garment with a graphic print","a striped or checked garment"]};
const P_FIT_UP = {relaxed:["an oversized boxy garment"], regular:["a regular fit garment"], slim:["a slim fit garment"]};
const P_FIT_LOW = {wide:["wide leg baggy jeans","baggy trousers"], relaxed:["relaxed straight leg trousers"], slim:["skinny slim fit jeans"]};
const P_FORM = {1:["casual streetwear"], 2:["smart casual clothing"], 3:["formal business clothing"]};
const P_WARM = {1:["lightweight summer clothing"], 2:["midweight clothing"], 3:["heavy warm winter clothing"]};
const P_HEAD = {hat:["a person wearing a cap","a person wearing a beanie","a person wearing a hat"], none:["a person without a hat","a bare head"]};

const S = {
  items:[], settings:{...DEFAULT_SETTINGS}, profile:{...DEFAULT_PROFILE}, loc:null, weather:null,
  history:{wear:[], pairs:{}}, saved:[], dismissed:[], diary:[], taste:{w:{}, n:0}, onboarded:false,
  tab:"today", closetView:"pieces", filter:"all", query:"", sort:"new",
  outfits:[], skipped:new Set(), locks:{}, lookIdx:0, wxState:"idle", ready:false, queue:[], presets:null,
  vibe:null, styleVec:null, vibeVecs:{}, aiBusy:false
};

/* ================= storage (IndexedDB) ================= */
let dbp = null;
function idb(){
  if (dbp) return dbp;
  dbp = new Promise((res, rej) => {
    const r = indexedDB.open("dailyfit", 2);
    r.onupgradeneeded = () => { const db = r.result;
      if (!db.objectStoreNames.contains("items")) db.createObjectStore("items", {keyPath:"id"});
      if (!db.objectStoreNames.contains("kv")) db.createObjectStore("kv");
      if (!db.objectStoreNames.contains("diary")) db.createObjectStore("diary", {keyPath:"id"}); };
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
  return dbp;
}
async function tx(store, mode, fn){
  const db = await idb();
  return new Promise((res, rej) => { const t = db.transaction(store, mode); const s = t.objectStore(store); const out = fn(s);
    t.oncomplete = () => res(out && "result" in out ? out.result : undefined); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error); });
}
const itemsAll = () => tx("items","readonly", s => s.getAll());
const itemPut = it => tx("items","readwrite", s => s.put(it));
const itemsPut = list => tx("items","readwrite", s => { list.forEach(i => s.put(i)); });
const itemDel = id => tx("items","readwrite", s => s.delete(id));
const diaryAll = () => tx("diary","readonly", s => s.getAll());
const diaryPut = e => tx("diary","readwrite", s => s.put(e));
const diaryDel = id => tx("diary","readwrite", s => s.delete(id));
const kvGet = k => tx("kv","readonly", s => s.get(k));
const kvSet = (k, v) => tx("kv","readwrite", s => s.put(v, k));
const kvClear = () => Promise.all(["kv","items","diary"].map(n => tx(n,"readwrite", s => s.clear())));
const saveSettings = debounce(() => kvSet("settings", S.settings).catch(storageFail), 300);
const saveProfile = debounce(() => kvSet("profile", S.profile).catch(storageFail), 400);
const saveHistory = () => kvSet("history", {wear:S.history.wear.slice(-400), pairs:trimPairs(S.history.pairs)}).catch(storageFail);
const saveTaste = debounce(() => kvSet("taste", S.taste).catch(()=>{}), 500);
function storageFail(){ toast("Couldn't save on this device. Free some space and try again."); }
function trimPairs(p){ const e=Object.entries(p); if (e.length<=800) return p; e.sort((a,b)=>Math.abs(b[1])-Math.abs(a[1])); return Object.fromEntries(e.slice(0,800)); }
function debounce(fn, ms){ let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }

/* object URLs for photo blobs */
const urlCache = new Map();
function photoURL(it, thumb=true){
  const b = thumb ? (it.thumb || it.photo) : (it.photo || it.thumb);
  if (!b) return "";
  if (typeof b === "string") return b;
  const key = it.id + (thumb ? ":t" : ":p");
  let u = urlCache.get(key);
  if (!u){ u = URL.createObjectURL(b); urlCache.set(key, u); }
  return u;
}
function dropURLs(id){ for (const k of [id+":t", id+":p"]) { const u=urlCache.get(k); if (u){ URL.revokeObjectURL(u); urlCache.delete(k); } } }

/* ================= colour ================= */
function hexToHsl(hex){
  const n=parseInt((hex||"#808080").slice(1),16); let r=(n>>16&255)/255,g=(n>>8&255)/255,b=(n&255)/255;
  const mx=Math.max(r,g,b),mn=Math.min(r,g,b); let h=0,s=0; const l=(mx+mn)/2;
  if (mx!==mn){ const d=mx-mn; s=l>.5?d/(2-mx-mn):d/(mx+mn); h=mx===r?(g-b)/d+(g<b?6:0):mx===g?(b-r)/d+2:(r-g)/d+4; h*=60; }
  return {h,s,l};
}
function colorName(hex){
  const {h,s,l}=hexToHsl(hex);
  if (l<.13) return "black"; if (l>.92) return "white";
  if (s<.16) return l>.6?"light grey":"grey";
  if (h>=205&&h<=235&&s<.55&&l<.45) return "navy";
  if (h>=20&&h<=50&&s<.5&&l>.5) return "beige";
  if (h>=15&&h<=40&&l<.35) return "brown";
  if (h>=55&&h<=100&&s<.4&&l<.45) return "olive";
  return [[15,"red"],[40,"orange"],[65,"yellow"],[160,"green"],[200,"teal"],[255,"blue"],[290,"purple"],[340,"pink"],[360,"red"]].find(([t])=>h<t)[1];
}
const NEUTRALS=new Set(["black","white","grey","light grey","navy","beige","brown","olive"]);
const COOL_NEUTRALS=new Set(["black","white","grey","light grey","navy"]);
const EARTH=new Set(["brown","olive","beige"]);
const isNeutral=hex=>NEUTRALS.has(colorName(hex));
const hueDist=(a,b)=>{const d=Math.abs(a-b)%360; return d>180?360-d:d;};
function dominantColor(img, box){
  const c=document.createElement("canvas"),W=64,H=64; c.width=W; c.height=H;
  const x=c.getContext("2d",{willReadFrequently:true});
  if (box) x.drawImage(img,box.x,box.y,box.w,box.h,0,0,W,H); else x.drawImage(img,0,0,W,H);
  const d=x.getImageData(0,0,W,H).data;
  /* background = the most common colour along the edges (robust to a sleeve touching the border) */
  const eb=new Map(); const add=p=>{ const k=(d[p]>>5)+"-"+(d[p+1]>>5)+"-"+(d[p+2]>>5), o=eb.get(k)||{n:0,r:0,g:0,b:0}; o.n++;o.r+=d[p];o.g+=d[p+1];o.b+=d[p+2]; eb.set(k,o); };
  for (let i=0;i<W;i++){ add(i*4); add(((H-1)*W+i)*4); } for (let j=0;j<H;j++){ add(j*W*4); add((j*W+W-1)*4); }
  let eBest=null; for (const o of eb.values()) if (!eBest||o.n>eBest.n) eBest=o;
  const br=eBest.r/eBest.n, bg=eBest.g/eBest.n, bb=eBest.b/eBest.n; const buckets=new Map();
  for (let j=10;j<54;j++) for (let i=10;i<54;i++){ const p=(j*W+i)*4,r=d[p],g=d[p+1],b=d[p+2];
    if (Math.hypot(r-br,g-bg,b-bb)<38) continue;
    const k=(r>>5)+"-"+(g>>5)+"-"+(b>>5), o=buckets.get(k)||{n:0,r:0,g:0,b:0}; o.n++;o.r+=r;o.g+=g;o.b+=b; buckets.set(k,o); }
  let best=null; for (const o of buckets.values()) if (!best||o.n>best.n) best=o;
  if (!best) return "#808080";
  const hx=v=>Math.round(v/best.n).toString(16).padStart(2,"0"); return "#"+hx(best.r)+hx(best.g)+hx(best.b);
}
const itemColor = it => it.cat==="jewelry" ? (METAL_HEX[it.metal]||METAL_HEX.other) : it.color;

/* ================= location & region ================= */
const ALL_CITIES = Object.entries(D.regions).flatMap(([code,r]) => r.cities.map(c => ({...c, region:code})));
function km(a,b){ const R=6371,toR=x=>x*Math.PI/180, dLa=toR(b.lat-a.lat), dLo=toR(b.lon-a.lon);
  const h=Math.sin(dLa/2)**2+Math.cos(toR(a.lat))*Math.cos(toR(b.lat))*Math.sin(dLo/2)**2; return 2*R*Math.asin(Math.sqrt(h)); }
function nearestCity(loc){ let best=null; for (const c of ALL_CITIES){ const d=km(loc,c); if (!best||d<best.d) best={...c,d}; } return best; }
function regionCode(){
  if (S.settings.region!=="auto") return S.settings.region;
  const l=S.loc; if (!l) return "GLOBAL";
  if (l.country && D.regions[l.country]) return l.country;
  if (l.lat!=null){ const n=nearestCity(l); if (n && n.d<500) return n.region; }
  return "GLOBAL";
}
const region = () => D.regions[regionCode()] || D.regions.GLOBAL;
async function useGPS(){
  if (!("geolocation" in navigator)) { toast("This device can't share its location. Search for your city instead."); return false; }
  toast("Finding your location…");
  try{
    const pos = await new Promise((res,rej)=>navigator.geolocation.getCurrentPosition(res,rej,{enableHighAccuracy:false,timeout:15000,maximumAge:6e5}));
    const loc={lat:+pos.coords.latitude.toFixed(4), lon:+pos.coords.longitude.toFixed(4), source:"gps"};
    const n=nearestCity(loc);
    loc.name = n && n.d<40 ? n.name : "Current location";
    loc.country = n && n.d<500 ? n.region : null;
    await setLocation(loc); toast("Location set: "+loc.name); return true;
  }catch(e){
    toast(e&&e.code===1?"Location permission was denied. Search for your city instead.":"Couldn't get your location. Search for your city instead.");
    return false;
  }
}
async function setLocation(loc){ S.loc=loc; await kvSet("loc",loc); S.weather=null; await kvSet("weather",null); fetchWeather(true); render(); }
async function searchCities(q){
  const r=await fetchT(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=8&language=en&format=json`);
  const j=await r.json(); return (j.results||[]).map(x=>({name:x.name, admin:x.admin1||"", countryName:x.country||"", country:x.country_code, lat:x.latitude, lon:x.longitude}));
}
function fetchT(url, ms=12000){ const c=new AbortController(); const t=setTimeout(()=>c.abort(),ms); return fetch(url,{signal:c.signal}).finally(()=>clearTimeout(t)); }

/* ================= weather ================= */
const WMO={0:"Clear",1:"Mostly clear",2:"Partly cloudy",3:"Overcast",45:"Fog",48:"Fog",51:"Drizzle",53:"Drizzle",55:"Drizzle",56:"Freezing drizzle",57:"Freezing drizzle",
  61:"Rain",63:"Rain",65:"Heavy rain",66:"Freezing rain",67:"Freezing rain",71:"Snow",73:"Snow",75:"Heavy snow",77:"Snow grains",80:"Showers",81:"Showers",82:"Heavy showers",85:"Snow showers",86:"Snow showers",95:"Thunderstorm",96:"Thunderstorm",99:"Thunderstorm"};
const isWetCode=c=>(c>=51&&c<=67)||(c>=80&&c<=82)||c>=95;
const isSnowCode=c=>(c>=71&&c<=77)||c===85||c===86;
async function fetchWeather(force=false){
  if (!S.loc || S.loc.lat==null) return;
  const age = S.weather ? (Date.now()-S.weather.fetchedAt)/6e4 : Infinity;
  if (!force && age<45) return;
  if (!navigator.onLine){ S.wxState="offline"; render(); return; }
  S.wxState="loading"; if (S.tab==="today") render();
  const u=`https://api.open-meteo.com/v1/forecast?latitude=${S.loc.lat}&longitude=${S.loc.lon}`+
    `&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,precipitation`+
    `&hourly=temperature_2m,apparent_temperature,precipitation_probability,weather_code`+
    `&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&forecast_days=2`;
  for (let attempt=0; attempt<2; attempt++){
    try{
      const r=await fetchT(u); if (!r.ok) throw new Error("http "+r.status);
      const d=await r.json();
      S.weather={fetchedAt:Date.now(), utcOffset:d.utc_offset_seconds, current:d.current,
        hours:d.hourly.time.map((t,i)=>({t, temp:d.hourly.temperature_2m[i], feels:d.hourly.apparent_temperature[i], pop:d.hourly.precipitation_probability[i]||0, code:d.hourly.weather_code[i]})),
        today:{min:d.daily.temperature_2m_min[0], max:d.daily.temperature_2m_max[0], pop:d.daily.precipitation_probability_max[0]||0}};
      await kvSet("weather",S.weather); S.wxState="ok"; S.skipped.clear(); render(); return;
    }catch{ await new Promise(r=>setTimeout(r,1200)); }
  }
  S.wxState="error"; render();
}
function locNowKey(){ const off=(S.weather&&S.weather.utcOffset)||(-new Date().getTimezoneOffset()*60);
  return new Date(Date.now()+off*1000).toISOString().slice(0,13); }
function conditions(){
  const st=S.settings, w=S.weather;
  const age = w ? (Date.now()-w.fetchedAt)/36e5 : Infinity;
  if (st.manual || !w || age>30){
    return {source: st.manual?"manual":"none", temp:st.manualTemp, low:st.manualTemp, high:st.manualTemp, wet:st.manualRain, snow:false, wind:0, label:"", window:[], hours:[]};
  }
  const now=locNowKey(), day=now.slice(0,10), nowH=+now.slice(11,13);
  const upcoming=w.hours.filter(h=>h.t.slice(0,13)>=now);
  const startH=Math.max(nowH, st.outStart);
  let win=upcoming.filter(h=>h.t.slice(0,10)===day && +h.t.slice(11,13)>=startH && +h.t.slice(11,13)<=st.outEnd);
  const late = !win.length;
  if (late) win=upcoming.slice(0,4);
  if (!win.length) win=[{t:now,feels:w.current.apparent_temperature,temp:w.current.temperature_2m,pop:0,code:w.current.weather_code}];
  const feels=win.map(h=>h.feels), low=Math.round(Math.min(...feels)), high=Math.round(Math.max(...feels));
  return {source:"forecast", temp:low, low, high, late,
    wet:win.some(h=>h.pop>=50||isWetCode(h.code)), snow:win.some(h=>isSnowCode(h.code)),
    wind:w.current.wind_speed_10m||0, label:WMO[w.current.weather_code]||"", nowFeels:Math.round(w.current.apparent_temperature),
    hours:upcoming.slice(0,18), window:win.map(h=>h.t), age};
}
const deg = c => S.settings.units==="F" ? Math.round(c*9/5+32)+"°" : Math.round(c)+"°";

/* ================= learned taste (online logistic regression) ================= */
const sigmoid = x => 1/(1+Math.exp(-x));
function tasteDot(f){ let s=0; for (const k of f) s+=S.taste.w[k]||0; return s; }
function learn(f, y, weight=1){
  if (!f||!f.length) return;
  const p=sigmoid(tasteDot(f)), g=.18*weight*(y-p);
  for (const k of f) S.taste.w[k]=Math.max(-4,Math.min(4,(S.taste.w[k]||0)+g));
  S.taste.n+=weight; saveTaste();
}
const tasteFactor = () => Math.min(1, S.taste.n/30);
const FEAT_TEXT = {"harm:none":"neutral-only palettes","harm:accent":"one colour accent","harm:analog":"analogous colours","harm:compl":"loud complementary colours","harm:clash":"clashing colours",
  "prop:relaxed":"relaxed top + relaxed bottom","prop:full":"full volume top and bottom","prop:fitloose":"fitted top, loose leg","prop:slim":"slim bottoms","prop:other":"regular proportions",
  "hat":"wearing headwear","gloves":"wearing gloves","pattern":"a graphic or patterned piece","metal:mixed":"mixing metals"};
function featText(k){ if (FEAT_TEXT[k]) return FEAT_TEXT[k]; const [a,b]=k.split(":");
  if (a==="style") return b+" pieces"; if (a==="up") return b+" up top"; if (a==="low") return b+" bottoms"; if (a==="layers") return b+" layers";
  if (a==="jewel") return b==="0"?"no jewellery":b+" piece"+(b==="1"?"":"s")+" of jewellery"; return k; }

/* ================= outfit engine ================= */
const pick=a=>a[Math.floor(Math.random()*a.length)];
const randInt=(a,b)=>a+Math.floor(Math.random()*(b-a+1));
const avail=()=>S.items.filter(i=>!i.inWash);
const byCat=(k,list=avail())=>list.filter(i=>i.cat===k);
const byZone=z=>byCat("jewelry").filter(i=>JZONE[i.sub]===z);
const pairKey=(a,b)=>a<b?a+"|"+b:b+"|"+a;
const vibeObj=()=>S.vibe?D.vibes.find(v=>v.id===S.vibe):null;
function recentlyWorn(){ const cut=Date.now()-S.settings.avoidRepeatDays*864e5, ids=new Set();
  for (const w of S.history.wear) if (w.t>=cut) w.ids.forEach(id=>ids.add(id)); return ids; }
function effTemp(c){ return c.temp - (S.settings.thermal||0); }
function weatherPlan(c){
  const t=effTemp(c), wet=c.wet||c.snow, V=vibeObj(); let p;
  if (t>=25) p={top:[1],layer:"none",outer:wet?"optional":"none",bottom:[1,2],note:"Hot. Light fabrics, one layer."};
  else if (t>=19) p={top:[1,2],layer:"none",outer:wet?"want":"none",bottom:[1,2],note:"Mild. One layer, maybe a light shell."};
  else if (t>=13) p={top:[1,2],layer:"optional",outer:"one",outerW:[1,2],bottom:[1,2,3],note:"Cool. Add a layer or a light jacket."};
  else if (t>=6) p={top:[1,2,3],layer:"optional",outer:"need",outerW:[2,3],bottom:[2,3],note:"Cold. A real jacket."};
  else if (t>=1) p={top:[1,2,3],layer:"need",outer:"need",outerW:[2,3],bottom:[2,3],note:"Very cold. A warm jacket over a layer."};
  else p={top:[1,2,3],layer:"need",outer:"need",outerW:[3],bottom:[2,3],note:"Freezing. Heavy coat over a layer."};
  if (V&&V.indoor&&t<13&&p.layer==="need") p.layer="optional";
  p.hatOK=h=>{ const s=h.sub||"beanie"; if (s==="balaclava") return t<=2; if (s==="beanie") return t<=(h.warmth>=3?8:14); if (s==="skullcap") return t<=20; return true; };
  const hw=S.settings.headwear;
  p.hat = hw==="never"?"none" : hw==="always"?"need" : (V&&V.hat===false)?"none" : (t<=8||(c.wind>25&&t<=12))?"need" : (wet&&t>8)?"want" : "optional";
  const gl=S.settings.gloves;
  p.gloves = gl==="never"?"none" : gl==="always"?"need" : t<=3?"need" : t<=7?"optional":"none";
  p.jewel = S.settings.jewelry==="never" ? [0,0] : V ? V.jewel : [1,2];
  if (c.source==="forecast" && c.high-c.low>=7) p.swing=`It goes from ${deg(c.low)} to ${deg(c.high)}; wear a top layer you can take off.`;
  if (S.settings.thermal) p.note+=` (dressed ${Math.abs(S.settings.thermal)}° ${S.settings.thermal>0?"warmer":"lighter"}, as you prefer)`;
  return p;
}
function pieceMatches(it,m){
  if (m.cats && !m.cats.includes(it.cat)) return false;
  if (m.fits && !m.fits.includes(it.fit)) return false;
  if (m.colors && !m.colors.includes(colorName(itemColor(it)))) return false;
  if (m.styles && !(it.styles||[]).some(s=>m.styles.includes(s))) return false;
  if (m.subs && !m.subs.includes(it.sub)) return false;
  return true;
}
const activeSignals = () => { const rc=regionCode(); return D.signals.filter(s=>s.regions.includes("all")||s.regions.includes(rc)); };
function hueCount(parts){ const hues=[]; for (const c of parts.filter(i=>!isNeutral(i.color))){ const h=hexToHsl(c.color).h; if (!hues.some(x=>hueDist(x,h)<25)) hues.push(h); } return hues; }
const clothesOf = o => ["top","layer","bottom","outer"].map(k=>o[k]).filter(Boolean);
const wearOf = o => CLOTH.map(k=>o[k]).filter(Boolean);
const jewelOf = o => JSLOTS.map(k=>o[k]).filter(Boolean);
const partsOf = o => SLOTS.map(k=>o[k]).filter(Boolean);
function trendHits(o){
  const clothes=clothesOf(o), all=[...wearOf(o),...jewelOf(o)], hits=[];
  for (const s of activeSignals()){ const m=s.match; let ok=true;
    if (m.layersMin && [o.top,o.layer,o.outer].filter(Boolean).length<m.layersMin) ok=false;
    if (ok && m.accessory && !(o.hat||o.gloves||jewelOf(o).length)) ok=false;
    if (ok && m.silver) ok=clothes.every(i=>m.colors.includes(colorName(i.color))) && (jewelOf(o).some(j=>j.metal==="silver")||/silver/i.test(S.profile.jewelry||""));
    else if (ok && m.accentOne) ok=all.some(i=>colorName(itemColor(i))==="black") && hueCount(wearOf(o)).length===1;
    else if (ok && (m.cats||m.fits||m.colors||m.styles||m.subs)) ok=all.some(i=>pieceMatches(i,m));
    if (ok) hits.push(s);
  }
  return hits;
}
function avgSim(parts, vec){ const e=parts.filter(p=>p.emb); if (!e.length||!vec) return null; return e.reduce((a,p)=>a+AI.cos(p.emb,vec),0)/e.length; }
let closetBase={style:null, vibe:{}};
function scoreOutfit(o){
  const why=[], tags=[], f=[]; let s=0;
  const wear=wearOf(o), jew=jewelOf(o), parts=partsOf(o);
  const upper=o.outer||o.layer||o.top, V=vibeObj();
  /* colour */
  const hues=hueCount(wear); let cs;
  if (!hues.length){ const d=Math.abs(hexToHsl(upper.color).l-hexToHsl(o.bottom.color).l); cs=d>.25?.85:.72; why.push(d>.25?"Neutrals with light/dark contrast":"Tonal neutral fit"); f.push("harm:none"); }
  else if (hues.length===1){ cs=1; const acc=wear.find(i=>!isNeutral(i.color)); why.push(cap(colorName(acc.color))+" is the one accent"); f.push("harm:accent"); }
  else if (hues.length===2){ const d=hueDist(hues[0],hues[1]); if (d<=40){cs=.85;why.push("Analogous colours");f.push("harm:analog");} else if (d>=150){cs=.65;why.push("Complementary colours, loud");f.push("harm:compl");} else {cs=.25;why.push("Two colours fighting");f.push("harm:clash");} }
  else { cs=.1; why.push("Too many colours"); f.push("harm:clash"); }
  s+=cs*3;
  const pat=wear.filter(i=>i.pattern).length; if (pat) f.push("pattern");
  if (pat>1 && !S.settings.mixPatterns){ s-=2; why.push("Pattern clash"); }
  /* proportions */
  const uf=upper.fit||"regular", bf=o.bottom.fit||"regular"; let ps;
  if (bf==="slim"){ ps=S.settings.avoidSkinny?.2:.6; f.push("prop:slim"); if (S.settings.avoidSkinny) tags.push({t:"Slim bottoms",c:"warn"}); }
  else if ((uf==="relaxed"||uf==="wide")&&(bf==="relaxed"||bf==="wide")){ const full=uf==="wide"&&bf==="wide"; ps=full?.8:.95; f.push(full?"prop:full":"prop:relaxed"); why.push(full?"Full volume top and bottom":"Relaxed proportions"); }
  else if (uf==="slim"&&(bf==="wide"||bf==="relaxed")){ ps=.9; f.push("prop:fitloose"); why.push("Fitted top, loose leg"); }
  else { ps=.8; f.push("prop:other"); }
  s+=ps*2;
  /* formality */
  const tgt=V?V.form:1, fs=wear.map(i=>i.form||1);
  const off=fs.reduce((a,x)=>a+Math.abs(x-tgt),0)/fs.length, spread=Math.max(...fs)-Math.min(...fs);
  s+=(1-off/2)*2-(spread>1?1:0); if (spread>1) why.push("Formality mismatch");
  /* jewellery */
  const metals=new Set(jew.map(j=>j.metal||"other"));
  if (metals.has("silver")&&metals.has("gold")&&!metals.has("mixed")){ s-=.6; why.push("Silver and gold together"); f.push("metal:mixed"); }
  const silverOn = jew.some(j=>j.metal==="silver") || (!byCat("jewelry").length && /silver/i.test(S.profile.jewelry||""));
  if (silverOn && COOL_NEUTRALS.has(colorName(upper.color))){ s+=.3; tags.push({t:"Silver pops on "+colorName(upper.color),c:"silver"}); }
  if (o.gloves && o.hand){ s-=1; }
  f.push("jewel:"+Math.min(3,jew.length));
  /* vibe */
  if (V){
    let vb=0;
    for (const p of wear){ const st=p.styles||[]; if (st.some(x=>V.likes.includes(x))) vb+=.25; if (st.some(x=>V.avoid.includes(x))) vb-=.6; }
    if (!V.patterns && pat) vb-=.5;
    if (V.palette==="tonal" && hues.length<=1 && hexToHsl(upper.color).l<.4) vb+=.4;
    if (V.palette==="earthy" && wear.some(i=>EARTH.has(colorName(i.color)))) vb+=.3;
    if (V.palette==="neutral" && !hues.length) vb+=.4;
    if (V.palette==="blackaccent" && wear.some(i=>colorName(i.color)==="black") && hues.length<=1) vb+=.4;
    if (jew.length<V.jewel[0]) vb-=.3*(V.jewel[0]-jew.length); if (jew.length>V.jewel[1]) vb-=.3*(jew.length-V.jewel[1]);
    const vv=S.vibeVecs[V.id]; const sim=avgSim(parts,vv);
    if (sim!=null && closetBase.vibe[V.id]!=null) vb+=Math.max(-.6,Math.min(.8,(sim-closetBase.vibe[V.id])*12));
    s+=Math.max(-2,Math.min(2,vb));
  }
  /* rest, pins, pair memory */
  const rec=recentlyWorn(); s-=wear.filter(i=>rec.has(i.id)).length*.6;
  s+=parts.filter(i=>i.pinned).length*.8;
  let pairs=0; for (let i=0;i<parts.length;i++) for (let j=i+1;j<parts.length;j++) pairs+=S.history.pairs[pairKey(parts[i].id,parts[j].id)]||0;
  s+=Math.max(-2,Math.min(2,pairs*.25)); if (pairs>1.5) why.push("Close to fits you wore");
  /* feature model */
  for (const p of wear) for (const st of (p.styles||[])) f.push("style:"+st);
  f.push("up:"+colorName(upper.color), "low:"+colorName(o.bottom.color), "layers:"+[o.top,o.layer,o.outer].filter(Boolean).length);
  if (o.hat) f.push("hat"); if (o.gloves) f.push("gloves");
  const uf2=[...new Set(f)];
  const tf=tasteFactor(); if (tf>0){ const d=tasteDot(uf2); s+=tf*Math.max(-1.5,Math.min(1.5,d*.5)); if (tf>.5&&d>1) tags.push({t:"Your taste",c:"trend"}); }
  /* AI style memory from diary */
  if (S.styleVec){ const sim=avgSim(wear,S.styleVec); if (sim!=null&&closetBase.style!=null){ const b=(sim-closetBase.style)*10; s+=Math.max(-.6,Math.min(.9,b)); if (b>.4) tags.push({t:"Like your best-rated fits",c:"trend"}); } }
  /* trends */
  let tb=0; for (const h of trendHits(o)){ tb+=h.strength*.25; tags.push({t:h.name,c:"trend"}); }
  s+=Math.min(1.5,tb);
  return {score:s, why, tags, f:uf2};
}
const cap=x=>x?x.charAt(0).toUpperCase()+x.slice(1):"";
function pools(c, p){
  const okW=(i,ws)=>!ws||ws.includes(i.warmth);
  const allHats=byCat("hat"); let hats=allHats.filter(p.hatOK);
  if (S.settings.headwear==="always" && !hats.length) hats=allHats;
  return {top:byCat("top").filter(i=>okW(i,p.top)), bottom:byCat("bottom").filter(i=>okW(i,p.bottom)), shoes:byCat("shoes"),
    layer:byCat("layer"), outer:byCat("outer").filter(i=>okW(i,p.outerW)), hat:hats, gloves:byCat("gloves"),
    neck:byZone("neck"), wrist:byZone("wrist"), hand:byZone("hand"), ear:byZone("ear")};
}
function addJewellery(o, P, p, L){
  for (const z of JSLOTS) if (L[z]) o[z]=L[z];
  const [lo,hi]=p.jewel; if (hi<=0) return;
  const k=randInt(lo,hi);
  const zones=JSLOTS.filter(z=>P[z].length && !(z==="hand"&&o.gloves));
  for (const z of zones){ const pin=P[z].filter(j=>j.pinned); if (pin.length&&!o[z]&&jewelOf(o).length<hi) o[z]=pick(pin); }
  for (const z of zones.sort(()=>Math.random()-.5)){ if (jewelOf(o).length>=k) break; if (!o[z]) o[z]=pick(P[z]); }
}
function generate(c){
  const p=weatherPlan(c), P=pools(c,p), L={};
  for (const [slot,id] of Object.entries(S.locks)){ const it=S.items.find(i=>i.id===id&&!i.inWash); if (it) L[slot]=it; else delete S.locks[slot]; }
  const missing=[], soft=[];
  /* never block on warmth alone: fall back to the warmest pieces you own and say so */
  const warmest=(cat)=>{ const all=byCat(cat); if (!all.length) return []; const m=Math.max(...all.map(i=>i.warmth||2)); return all.filter(i=>(i.warmth||2)===m); };
  if (!P.outer.length && p.outer==="need" && byCat("outer").length){ P.outer=warmest("outer"); soft.push(`Your warmest jacket is lighter than ideal for ${deg(c.temp)}; layer up underneath.`); if (p.layer==="optional") p.layer="need"; }
  if (!P.top.length && byCat("top").length) P.top=byCat("top");
  if (!P.bottom.length && byCat("bottom").length){ P.bottom=warmest("bottom"); }
  if (!L.top&&!P.top.length) missing.push(`a top for ${deg(c.temp)}`);
  if (!L.bottom&&!P.bottom.length) missing.push(`a bottom for ${deg(c.temp)}`);
  if (!L.shoes&&!P.shoes.length) missing.push("shoes");
  if (p.outer==="need"&&!L.outer&&!P.outer.length) missing.push("a jacket or coat warm enough");
  if (p.layer==="need"&&!L.layer&&!P.layer.length) missing.push("a warm mid layer");
  if (missing.length) return {p, missing, list:[], soft:[]};
  if (p.hat==="need"&&!P.hat.length) soft.push("A hat would help today; none in your closet suits this weather.");
  if (p.gloves==="need"&&!P.gloves.length) soft.push("Gloves would help today; you have none saved.");
  const pinnedHats=P.hat.filter(h=>h.pinned), cands=[], seen=new Set();
  for (let n=0;n<900;n++){
    const o={top:L.top||pick(P.top), bottom:L.bottom||pick(P.bottom), shoes:L.shoes||pick(P.shoes)};
    if (L.layer) o.layer=L.layer; else if (p.layer==="need"||(p.layer==="optional"&&P.layer.length&&Math.random()<.5)) o.layer=P.layer.length?pick(P.layer):undefined;
    if (L.outer) o.outer=L.outer; else if (P.outer.length&&(p.outer==="need"||p.outer==="want"||(p.outer==="one"&&(!o.layer||Math.random()<.4))||(p.outer==="optional"&&Math.random()<.3))) o.outer=pick(P.outer);
    if (p.outer==="one"&&!o.layer&&!o.outer&&P.layer.length) o.layer=pick(P.layer);
    if (L.hat) o.hat=L.hat; else if (P.hat.length&&p.hat!=="none"&&(p.hat==="need"||(p.hat==="want"&&Math.random()<.8)||(p.hat==="optional"&&(pinnedHats.length||Math.random()<.35))))
      o.hat=pinnedHats.length&&Math.random()<.85?pick(pinnedHats):pick(P.hat);
    if (L.gloves) o.gloves=L.gloves; else if (P.gloves.length&&(p.gloves==="need"||(p.gloves==="optional"&&Math.random()<.35))) o.gloves=pick(P.gloves);
    addJewellery(o,P,p,L);
    const key=SLOTS.map(k=>o[k]?o[k].id:"-").join(",");
    if (seen.has(key)||S.skipped.has(key)) continue; seen.add(key);
    cands.push({...o,key,...scoreOutfit(o)});
  }
  cands.sort((a,b)=>b.score-a.score);
  const list=[]; for (const x of cands){ if (list.length===3) break; if (list.some(l=>l.top===x.top&&l.bottom===x.bottom)&&cands.length>6) continue; list.push(x); }
  return {p, missing:[], soft, list};
}
function rescore(o){ const key=SLOTS.map(k=>o[k]?o[k].id:"-").join(","); return {...o,key,...scoreOutfit(o)}; }
function outfitFromIds(ids){ const o={}; for (const id of ids){ const it=S.items.find(i=>i.id===id); if (!it) continue;
  const slot=it.cat==="jewelry"?JZONE[it.sub]:it.cat; if (slot&&!o[slot]) o[slot]=it; } return o; }

/* ================= AI glue ================= */
const aiReady = () => !!AI && AI.state==="ready";
async function enableAI(){
  S.settings.aiEnabled=true; saveSettings();
  try{ await AI.load(); await afterAILoad(); toast("On-device AI is ready."); }
  catch{ toast("The AI model couldn't download. Check your connection and try again in Settings."); }
}
async function afterAILoad(){
  for (const v of D.vibes) S.vibeVecs[v.id]=await AI.textVector(v.prompts);
  await backfillEmbeddings(); recomputeStyle(); render();
}
async function backfillEmbeddings(){
  if (!aiReady()||S.aiBusy) return; S.aiBusy=true;
  try{
    for (const it of S.items.filter(i=>!i.emb && (i.photo||i.thumb))){ try{ it.emb=await AI.embedImage(it.thumb||it.photo); await itemPut(it); }catch{} }
    for (const e of S.diary.filter(e=>!e.emb && e.photo)){ try{ e.emb=await AI.embedImage(e.thumb||e.photo); await diaryPut(e); }catch{} }
  } finally { S.aiBusy=false; }
  recomputeBaselines();
}
function recomputeBaselines(){
  if (!AI) return;
  const embs=S.items.filter(i=>i.emb&&i.cat!=="jewelry");
  closetBase.style = S.styleVec&&embs.length ? embs.reduce((a,i)=>a+AI.cos(i.emb,S.styleVec),0)/embs.length : null;
  for (const v of D.vibes){ const vv=S.vibeVecs[v.id]; closetBase.vibe[v.id]= vv&&embs.length ? embs.reduce((a,i)=>a+AI.cos(i.emb,vv),0)/embs.length : null; }
}
function recomputeStyle(){
  if (!AI) return;
  const good=S.diary.filter(e=>e.rating>=4);
  const vecs=[...good.map(e=>e.emb), ...good.flatMap(e=>(e.itemIds||[]).map(id=>(S.items.find(i=>i.id===id)||{}).emb))].filter(Boolean);
  S.styleVec = vecs.length>=2 ? AI.mean(vecs) : null; recomputeBaselines();
}
async function aiTag(it){
  const emb=await AI.embedImage(it.photo||it.thumb); it.emb=emb; const tags=[];
  const pickIf=(r,m=.006)=>r[0].score-r[1].score>m?r[0].key:null;
  const cat=(await AI.classify(emb,P_CAT))[0].key; it.cat=cat; tags.push("cat");
  if (cat==="hat"){ it.sub=(await AI.classify(emb,P_HAT))[0].key; tags.push("sub"); }
  if (cat==="jewelry"){ it.sub=(await AI.classify(emb,P_JEWEL))[0].key; tags.push("sub");
    const m=pickIf(await AI.classify(emb,P_METAL),.004); if (m){ it.metal=m; tags.push("metal"); } }
  if (cat!=="jewelry"){
    const st=await AI.classify(emb,P_STYLE); if (st[0].score-st[2].score>.012){ it.styles=[st[0].key]; tags.push("styles"); }
    const pt=pickIf(await AI.classify(emb,P_PATTERN),.01); if (pt){ it.pattern=pt==="pattern"; tags.push("pattern"); }
    const fm=pickIf(await AI.classify(emb,P_FORM)); if (fm){ it.form=+fm; tags.push("form"); }
    if (["top","layer","outer","bottom"].includes(cat)){ const fit=pickIf(await AI.classify(emb,cat==="bottom"?P_FIT_LOW:P_FIT_UP)); if (fit){ it.fit=fit; tags.push("fit"); } }
    if (["layer","outer","top","bottom"].includes(cat)){ const w=pickIf(await AI.classify(emb,P_WARM),.008); if (w){ it.warmth=+w; tags.push("warmth"); } }
  }
  it.aiTags=tags; return it;
}
/* crop regions of a full-body photo (inspiration or mirror pic) */
function regionCanvas(img, y0, y1, x0=.12, x1=.88){
  const W=img.naturalWidth, H=img.naturalHeight, c=document.createElement("canvas");
  const box={x:Math.round(W*x0), y:Math.round(H*y0), w:Math.max(1,Math.round(W*(x1-x0))), h:Math.max(1,Math.round(H*(y1-y0)))};
  const scale=Math.min(1,448/Math.max(box.w,box.h)); c.width=Math.max(1,Math.round(box.w*scale)); c.height=Math.max(1,Math.round(box.h*scale));
  c.getContext("2d").drawImage(img,box.x,box.y,box.w,box.h,0,0,c.width,c.height); return {canvas:c, box};
}
async function readLook(img){
  const R={head:regionCanvas(img,0,.2,.25,.75), upper:regionCanvas(img,.14,.56), lower:regionCanvas(img,.5,.9,.15,.85), feet:regionCanvas(img,.84,1,.1,.9)};
  const E={}; for (const k of Object.keys(R)) E[k]=await AI.embedImage(R[k].canvas);
  E.full=await AI.embedImage(img);
  const upperCat=(await AI.classify(E.upper,{top:P_CAT.top,layer:P_CAT.layer,outer:P_CAT.outer}))[0].key;
  const head=await AI.classify(E.head,P_HEAD); const hasHat=head[0].key==="hat"&&head[0].score-head[1].score>.004;
  const style=(await AI.classify(E.full,P_STYLE)).slice(0,2).map(x=>x.key);
  const colors={upper:colorName(dominantColor(img,R.upper.box)), lower:colorName(dominantColor(img,R.lower.box)), feet:colorName(dominantColor(img,R.feet.box))};
  return {E, upperCat, hasHat, style, colors};
}
function bestMatch(cat, emb, extra=()=>true, color=null){
  const cands=byCat(cat).filter(i=>i.emb&&extra(i)); if (!cands.length) return null;
  const fam=c=>c==="light grey"?"grey":c;
  let best=null; for (const it of cands){ const sim=AI.cos(it.emb,emb); const rank=sim+(color&&fam(colorName(it.color))===fam(color)?.05:0);
    if (!best||rank>best.rank) best={it,s:sim,rank}; } return best;
}
const matchLabel = s => s>=.78?"close match":s>=.68?"similar":"loose match";
const garmentWord = c => c==="outer"?"jacket":c==="layer"?"knit or hoodie":"top";

/* ================= UI helpers ================= */
const $=s=>document.querySelector(s);
const esc=s=>String(s??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
function phHTML(it, {badge=""}={}){
  const src=photoURL(it,true);
  return `<div class="ph">${src?`<img src="${esc(src)}" alt="" loading="lazy" decoding="async">`:`<span class="noimg">${esc(it.cat==="jewelry"?(it.metal||"metal"):colorName(it.color))}</span>`}<span class="sw" style="background:${esc(itemColor(it))}"></span>${badge}${it.inWash?'<span class="badge wash">WASH</span>':it.pinned?'<span class="badge">PIN</span>':""}</div>`;
}
const seg=(name,opts,cur,extra="")=>`<div class="seg ${extra}" role="group" aria-label="${esc(name)}">${opts.map(([v,l])=>`<button type="button" data-${name}="${esc(v)}" aria-pressed="${String(v)===String(cur)}">${esc(l)}</button>`).join("")}</div>`;
function ago(ts){ if(!ts) return "never"; const m=(Date.now()-ts)/6e4; return m<1?"just now":m<60?Math.round(m)+" min ago":m<1440?Math.round(m/60)+" h ago":Math.round(m/1440)+" d ago"; }
const fmtDay=t=>new Date(t).toLocaleDateString(undefined,{weekday:"short",day:"numeric",month:"short"});
let toastT;
function toast(m, action){ const t=$("#toast"); t.innerHTML=`<span>${esc(m)}</span>${action?`<button type="button">${esc(action.label)}</button>`:""}`; t.hidden=false;
  if (action) t.querySelector("button").onclick=()=>{ t.hidden=true; action.fn(); };
  clearTimeout(toastT); toastT=setTimeout(()=>t.hidden=true, action?6000:2800); }
const buzz=()=>{ try{ navigator.vibrate&&navigator.vibrate(12); }catch{} };
function applyTheme(){ const t=S.settings.theme; if (t==="system") document.documentElement.removeAttribute("data-theme"); else document.documentElement.setAttribute("data-theme",t); }
function openSheet(html, {full=false}={}){ const el=$("#sheet"); el.className="sheet"+(full?" full":""); el.innerHTML=`<div class="panel" role="dialog" aria-modal="true">${html}</div>`;
  if (el.hidden && !(history.state&&history.state.sheet)) { try{ history.pushState({sheet:1},""); }catch{} }
  el.hidden=false; el.onclick=e=>{ if (e.target===el && !full) closeSheet(); }; document.body.style.overflow="hidden"; return el.firstElementChild; }
function closeSheet(){ const el=$("#sheet"); el.hidden=true; el.innerHTML=""; document.body.style.overflow=""; }
function confirmSheet(text, okLabel, fn){
  const p=openSheet(`<h2>${esc(text)}</h2><div class="row"><button type="button" class="btn danger" id="cOk">${esc(okLabel)}</button><button type="button" class="btn quiet" id="cNo">Cancel</button></div>`);
  p.querySelector("#cOk").onclick=()=>{ closeSheet(); fn(); }; p.querySelector("#cNo").onclick=closeSheet;
}
function busySheet(text){ return openSheet(`<h2>${esc(text)}</h2><div class="skeleton"></div><p class="muted small">Running on your phone. This takes a few seconds.</p>`); }

/* ================= navigation ================= */
function setTab(t){ S.tab=t; document.querySelectorAll("nav.tabs button").forEach(b=>b.setAttribute("aria-current",String(b.dataset.tab===t)));
  try{ history.replaceState(history.state,"","#"+t); }catch{} render(); window.scrollTo(0,0); }
function render(){
  const v=$("#view");
  $("#dateLabel").textContent=new Date().toLocaleDateString(undefined,{weekday:"long",day:"numeric",month:"long"});
  const ta=$("#topActions"); ta.innerHTML=`<button type="button" class="btn primary" id="addBtn">+ Add</button>`; $("#addBtn").onclick=addMenu;
  if (!S.ready){ v.innerHTML=`<div class="skeleton"></div>`; return; }
  ({today:renderToday,closet:renderCloset,shop:renderShop,settings:renderSettings})[S.tab](v);
}

/* ================= TODAY ================= */
function renderToday(v){
  const c=conditions(), st=S.settings, V=vibeObj();
  const res=avail().length?generate(c):null; if (res) S.outfits=res.list;
  const p=res?res.p:weatherPlan(c);
  const locName=S.loc?S.loc.name:"No location";
  const wxLine = c.source==="forecast" ? `${esc(locName)} · ${S.wxState==="loading"?"updating…":"updated "+ago(S.weather.fetchedAt)}`
    : c.source==="manual" ? "Temperature set by you" : S.wxState==="loading" ? "Loading forecast…" : S.loc ? (S.wxState==="offline"?"Offline · set it by hand":"Forecast unavailable · set it by hand") : "No location · set it by hand";
  const hours=c.hours.map(h=>`<div class="hr${c.window.includes(h.t)?" in":""}"><span>${h.t.slice(11,13)}</span><b>${deg(h.feels)}</b><span>${h.pop>=30?h.pop+"%":"&nbsp;"}</span></div>`).join("");
  const lockCount=Object.keys(S.locks).length;
  v.innerHTML=`<div class="stack">
  <section class="wx" aria-label="Weather">
    <div class="row between"><span class="label">${wxLine}</span>
      ${S.loc?`<button type="button" class="btn icon" id="wxRefresh" aria-label="Refresh forecast" title="Refresh forecast">↻</button>`:`<button type="button" class="btn" id="setLoc">Set location</button>`}</div>
    <div class="big">
      <div class="temp" id="tempOut">${c.source==="forecast"?deg(c.nowFeels):deg(c.temp)}</div>
      <div><div class="cond">${esc(c.label||(c.source==="forecast"?"":"Your call"))}${c.wet?" · wet":""}${c.snow?" · snow":""}</div>
        <div class="label">${c.source==="forecast"?(c.late?`feels like now · next hours ${deg(c.low)}–${deg(c.high)}`:`feels like now · out ${st.outStart}–${st.outEnd}h ${deg(c.low)} to ${deg(c.high)}`):"dressing for this"}</div></div>
    </div>
    ${hours?`<div class="hours" aria-label="Hourly feels-like">${hours}</div>`:""}
    ${c.source!=="forecast"?`<input type="range" id="tempIn" min="-20" max="38" step="1" value="${st.manualTemp}" aria-label="Temperature">
      <div class="seg"><button type="button" id="rainBtn" aria-pressed="${st.manualRain}">${st.manualRain?"Rain or snow":"Dry"}</button></div>`:""}
    <div class="label">${esc(p.note)}${p.swing?" "+esc(p.swing):""}</div>
  </section>
  ${V?`<div class="vibebar"><div><span class="label">Vibe</span> <strong>${esc(V.name)}</strong><p class="small muted">${esc(V.tip)}</p></div><button type="button" class="btn quiet" id="clearVibe" aria-label="Clear vibe">✕ Clear</button></div>`:""}
  <div id="fits"></div>
  ${S.items.length?`<section class="stack tight">
    <span class="label">${V?"Try another vibe":"Nothing feels right? Pick a vibe"}</span>
    ${seg("vibe",D.vibes.map(x=>[x.id,x.name]),S.vibe||"","scroll")}
    <div class="two"><button type="button" class="btn" id="recreateBtn">◎ Recreate a look</button><button type="button" class="btn quiet" id="mirrorBtn">▣ Log a mirror pic</button></div>
  </section>`:""}
  </div>`;
  const fits=$("#fits");
  if (!S.items.length) fits.innerHTML=needsHTML();
  else if (!res) fits.innerHTML=`<div class="notice solid">Everything is in the wash. Mark pieces as clean in the closet.</div>`;
  else if (res.missing.length) fits.innerHTML=`<div class="notice solid">For ${deg(c.temp)} you still need ${res.missing.map(esc).join(", ")}. ${S.items.some(i=>i.inWash)?"Some pieces are in the wash. ":""}The Shop tab suggests what to get.</div>`;
  else {
    S.lookIdx=Math.min(S.lookIdx,res.list.length-1);
    fits.innerHTML=`<div class="stack tight">${res.soft.length?`<div class="notice">${res.soft.map(esc).join(" ")}</div>`:""}
      <div class="strip" id="strip">${res.list.map(lookHTML).join("")}</div>
      ${res.list.length>1?`<div class="dotsnav" aria-hidden="true">${res.list.map((_,i)=>`<span class="${i===S.lookIdx?"on":""}"></span>`).join("")}</div>`:""}
      <div class="row between"><button type="button" class="btn" id="shuffle">↻ Three more</button>
        ${lockCount?`<button type="button" class="btn quiet" id="unlock">Unlock ${lockCount}</button>`:`<span class="muted small">Tap a piece to lock or swap it.</span>`}</div></div>`;
    const strip=$("#strip");
    strip.onscroll=debounce(()=>{ const w=strip.firstElementChild.getBoundingClientRect().width+12; S.lookIdx=Math.round(strip.scrollLeft/w);
      document.querySelectorAll(".dotsnav span").forEach((d,i)=>d.classList.toggle("on",i===S.lookIdx)); },60);
    if (S.lookIdx>0) requestAnimationFrame(()=>{ const w=strip.firstElementChild.getBoundingClientRect().width+12; strip.scrollLeft=S.lookIdx*w; });
    $("#shuffle").onclick=()=>{ S.outfits.forEach(o=>S.skipped.add(o.key)); S.lookIdx=0; render(); };
    const ul=$("#unlock"); if (ul) ul.onclick=()=>{ S.locks={}; render(); };
    bindLooks(fits,c);
  }
  const ti=$("#tempIn"); if (ti){ ti.oninput=e=>{ st.manualTemp=+e.target.value; $("#tempOut").textContent=deg(st.manualTemp); }; ti.onchange=()=>{ S.skipped.clear(); saveSettings(); render(); }; }
  const rb=$("#rainBtn"); if (rb) rb.onclick=()=>{ st.manualRain=!st.manualRain; saveSettings(); render(); };
  const wr=$("#wxRefresh"); if (wr) wr.onclick=()=>fetchWeather(true);
  const sl=$("#setLoc"); if (sl) sl.onclick=locationSheet;
  const cv=$("#clearVibe"); if (cv) cv.onclick=()=>{ S.vibe=null; S.skipped.clear(); S.lookIdx=0; render(); };
  v.querySelectorAll("[data-vibe]").forEach(b=>b.onclick=()=>{ S.vibe=S.vibe===b.dataset.vibe?null:b.dataset.vibe; S.skipped.clear(); S.lookIdx=0; render(); window.scrollTo({top:0,behavior:"smooth"}); });
  const rc=$("#recreateBtn"); if (rc) rc.onclick=startRecreate;
  const mb=$("#mirrorBtn"); if (mb) mb.onclick=()=>startDiary();
}
function bindLooks(root,c){
  root.querySelectorAll("[data-wear]").forEach(b=>b.onclick=()=>wear(+b.dataset.wear));
  root.querySelectorAll("[data-skip]").forEach(b=>b.onclick=()=>skip(+b.dataset.skip));
  root.querySelectorAll("[data-save]").forEach(b=>b.onclick=()=>saveFit(+b.dataset.save));
  root.querySelectorAll("[data-piece]").forEach(b=>b.onclick=()=>{ const [i,slot]=b.dataset.piece.split(":"); pieceSheet(+i,slot,c); });
}
function collageHTML(o, i, interactive=true){
  const ups=["outer","layer","top"].filter(k=>o[k]);
  const slot=(k,cls)=>{ if (!o[k]) return ""; const inner=`${phHTML(o[k],{badge:S.locks[k]===o[k].id?'<span class="badge lock">LOCK</span>':""})}<span class="label">${SLOT_LABEL[k]}</span><span class="nm">${esc(o[k].name)}</span>`;
    return interactive?`<button type="button" class="piece ${cls}" data-piece="${i}:${k}" aria-label="${esc(SLOT_LABEL[k]+": "+o[k].name)}">${inner}</button>`:`<div class="piece ${cls}">${inner}</div>`; };
  const acc=["hat","gloves",...JSLOTS].filter(k=>o[k]);
  return `<div class="collage">${ups.map(k=>slot(k,ups.length===1?"wide":"")).join("")}${slot("bottom","wide")}${slot("shoes","wide")}</div>
    ${acc.length?`<div class="collage acc">${acc.map(k=>slot(k,"")).join("")}</div>`:""}`;
}
function lookHTML(o,i){
  const isSaved=S.saved.some(f=>f.key===o.key);
  return `<article class="look" aria-label="Fit ${i+1}">
    <div class="row between"><div class="num">${String(i+1).padStart(2,"0")}</div><div class="row"><span class="score">score ${o.score.toFixed(1)}</span>
      <button type="button" class="btn icon quiet" data-save="${i}" aria-label="${isSaved?"Saved":"Save fit"}" aria-pressed="${isSaved}">${isSaved?"★":"☆"}</button></div></div>
    ${collageHTML(o,i)}
    <div class="chips">${o.tags.map(t=>`<span class="chip ${t.c}">${t.c==="trend"?"◆ ":""}${esc(t.t)}</span>`).join("")}</div>
    <div class="chips">${o.why.map(r=>`<span class="chip">${esc(r)}</span>`).join("")}</div>
    <div class="row"><button type="button" class="btn accent" data-wear="${i}">Wearing this</button><button type="button" class="btn quiet" data-skip="${i}">Not this</button></div>
  </article>`;
}
function pieceSheet(i, slot, c){
  const o=S.outfits[i]; if (!o) return; const cur=o[slot], p=weatherPlan(c), P=pools(c,p);
  const pool=(P[slot]||[]).filter(x=>x.id!==cur.id);
  const alts=pool.map(x=>({x, s:rescore({...o,[slot]:x}).score})).sort((a,b)=>b.s-a.s).slice(0,9);
  const locked=S.locks[slot]===cur.id, optional=!["top","bottom","shoes"].includes(slot);
  const panel=openSheet(`<div class="row between"><h2>${SLOT_LABEL[slot]}: ${esc(cur.name)}</h2><button type="button" class="btn quiet" id="x">Close</button></div>
    <div class="row"><button type="button" class="btn ${locked?"":"primary"}" id="lockBtn">${locked?"Unlock":"Lock in"}</button>
      ${optional?`<button type="button" class="btn quiet" id="dropBtn">Leave it off</button>`:""}<button type="button" class="btn quiet" id="editBtn">Edit piece</button></div>
    <p class="muted small">Locking keeps this piece in every new fit until you unlock it.</p>
    ${alts.length?`<span class="label">Swap for</span><div class="alt">${alts.map(a=>`<button type="button" class="item" data-alt="${esc(a.x.id)}">${phHTML(a.x)}<span class="nm">${esc(a.x.name)}</span><span class="score">${(a.s-o.score>=0?"+":"")+(a.s-o.score).toFixed(1)}</span></button>`).join("")}</div>`:`<p class="muted small">Nothing else in your closet fits this slot right now.</p>`}`);
  panel.querySelector("#x").onclick=closeSheet;
  panel.querySelector("#lockBtn").onclick=()=>{ if (locked) delete S.locks[slot]; else S.locks[slot]=cur.id; closeSheet(); if (!locked){ S.skipped.clear(); } render(); toast(locked?"Unlocked.":"Locked. New fits keep this piece."); };
  const db=panel.querySelector("#dropBtn"); if (db) db.onclick=()=>{ const n={...o}; delete n[slot]; delete S.locks[slot]; S.outfits[i]=rescore(n); closeSheet(); patchLooks(); };
  panel.querySelector("#editBtn").onclick=()=>{ closeSheet(); openEditor(cur); };
  panel.querySelectorAll("[data-alt]").forEach(b=>b.onclick=()=>{ const x=S.items.find(it=>it.id===b.dataset.alt); S.outfits[i]=rescore({...o,[slot]:x}); if (S.locks[slot]) S.locks[slot]=x.id; closeSheet(); patchLooks(); buzz(); });
}
function patchLooks(){ const strip=$("#strip"); if (!strip) return render(); const sl=strip.scrollLeft; strip.innerHTML=S.outfits.map(lookHTML).join(""); strip.scrollLeft=sl; bindLooks($("#fits"),conditions()); }
function needsHTML(){
  const has=k=>byCat(k,S.items).length>0, line=(ok,t)=>`<div class="${ok?"ok":"no"}">${ok?"■":"□"} ${t}</div>`;
  return `<div class="look" style="border-style:dashed"><h2>Build your closet</h2>
    <p class="muted">Shoot each piece flat or on a hanger against a plain wall. ${aiReady()?"The on-device AI tags it for you; check and save.":"The app reads its colour; you tag type, warmth and fit once."} Fits appear when you have at least:</p>
    <div class="need">${line(has("top"),"a top")}${line(has("bottom"),"a bottom")}${line(has("shoes"),"shoes")}${line(has("outer"),"a jacket or coat")}${line(has("hat"),"headwear (optional)")}${line(has("jewelry"),"jewellery (optional)")}</div>
    <div class="row"><button type="button" class="btn primary" id="nCam">Take a photo</button><button type="button" class="btn" id="nLib">Pick photos</button></div></div>`;
}
document.addEventListener("click", e => { const t=e.target.closest("#nCam,#nLib"); if (!t) return; S.presets=null; (t.id==="nCam"?$("#fileCam"):$("#fileLib")).click(); });
function feedback(o,delta){ const ps=partsOf(o);
  for (let i=0;i<ps.length;i++) for (let j=i+1;j<ps.length;j++){ const k=pairKey(ps[i].id,ps[j].id); S.history.pairs[k]=Math.max(-6,Math.min(6,(S.history.pairs[k]||0)+delta)); } }
async function wear(i, list=S.outfits){
  const o=list[i]; if(!o) return; buzz(); feedback(o,1); learn(o.f,1,1);
  const ps=partsOf(o), now=Date.now(), c=conditions();
  const entry={t:now, ids:ps.map(x=>x.id), temp:c.temp, vibe:S.vibe||null}; S.history.wear.push(entry);
  ps.forEach(x=>{ x.wearCount=(x.wearCount||0)+1; x.lastWorn=now; });
  try{ await saveHistory(); await itemsPut(ps); }catch{ storageFail(); }
  toast(`Logged. Snap a mirror pic to rate it?`, {label:"Mirror pic", fn:()=>startDiary(entry)});
}
function skip(i){ const o=S.outfits[i]; if(!o) return; feedback(o,-.5); learn(o.f,0,.6); S.skipped.add(o.key); saveHistory(); render(); }
async function saveFit(i){ const o=S.outfits[i]; if (!o) return; const ex=S.saved.findIndex(f=>f.key===o.key);
  if (ex>=0){ S.saved.splice(ex,1); toast("Removed from saved fits."); } else { S.saved.unshift({key:o.key, t:Date.now(), slots:Object.fromEntries(SLOTS.filter(k=>o[k]).map(k=>[k,o[k].id]))}); learn(o.f,1,.5); toast("Saved. Find it under Closet › Saved."); buzz(); }
  await kvSet("saved",S.saved).catch(storageFail); patchLooks(); }

/* ================= RECREATE A LOOK ================= */
const inspoIn=document.createElement("input"); inspoIn.type="file"; inspoIn.accept="image/*"; inspoIn.hidden=true; inspoIn.id="inspoIn"; document.body.appendChild(inspoIn);
function startRecreate(){
  if (!aiReady()){ aiNeededSheet("Recreating a look reads the photo with the on-device AI."); return; }
  if (S.items.filter(i=>i.emb).length<3){ toast("Add a few photographed pieces first, so there's something to match."); return; }
  inspoIn.value=""; inspoIn.click();
}
inspoIn.onchange=async()=>{
  const f=inspoIn.files[0]; if (!f) return;
  busySheet("Reading the look…");
  try{
    const img=await loadImage(f), look=await readLook(img), c=conditions(), p=weatherPlan(c);
    const o={}, notes=[], miss=[];
    const up=bestMatch(look.upperCat, look.E.upper, ()=>true, look.colors.upper);
    if (up){ o[look.upperCat]=up.it; if (up.s<.68) miss.push(`a ${look.colors.upper} ${garmentWord(look.upperCat)} closer to this one`); }
    else miss.push(`a ${look.colors.upper} ${garmentWord(look.upperCat)}`);
    if (look.upperCat!=="top"){ const t=bestMatch("top",look.E.upper,i=>(p.top||[1,2,3]).includes(i.warmth)); if (t) o.top=t.it; }
    const lo=bestMatch("bottom",look.E.lower, ()=>true, look.colors.lower); if (lo){ o.bottom=lo.it; if (lo.s<.68) miss.push(`${look.colors.lower} trousers closer to these`); } else miss.push(`${look.colors.lower} trousers`);
    const sh=bestMatch("shoes",look.E.feet, ()=>true, look.colors.feet); if (sh){ o.shoes=sh.it; if (sh.s<.68) miss.push(`${look.colors.feet} shoes closer to these`); }
    if (look.hasHat){ const h=bestMatch("hat",look.E.head); if (h) o.hat=h.it; else miss.push("headwear"); }
    if (p.outer==="need" && !o.outer){ const warm=byCat("outer").filter(i=>(p.outerW||[2,3]).includes(i.warmth));
      if (warm.length){ warm.sort((a,b)=>AI.cos(b.emb||look.E.upper,look.E.upper)-AI.cos(a.emb||look.E.upper,look.E.upper)); o.outer=warm[0]; notes.push(`It's ${deg(c.temp)}, so a warm jacket goes over it.`); } }
    if (o.outer && p.outerW && !p.outerW.includes(o.outer.warmth)) notes.push(`That jacket is ${o.outer.warmth<p.outerW[0]?"light":"heavy"} for ${deg(c.temp)}.`);
    for (const z of JSLOTS){ const pin=byZone(z).filter(j=>j.pinned); if (pin.length) o[z]=pin[0]; }
    if (!o.top||!o.bottom||!o.shoes){ closeSheet(); toast("Not enough matching pieces yet. Add tops, bottoms and shoes first."); return; }
    const r=rescore(o);
    const sims=["outer","layer","top","bottom","shoes","hat"].filter(k=>o[k]&&o[k].emb).map(k=>({k, s:AI.cos(o[k].emb, k==="bottom"?look.E.lower:k==="shoes"?look.E.feet:k==="hat"?look.E.head:look.E.upper)}));
    const url=URL.createObjectURL(f);
    const panel=openSheet(`<div class="row between"><h2>Your version</h2><button type="button" class="btn quiet" id="x">Close</button></div>
      <div class="row" style="align-items:flex-start;flex-wrap:nowrap"><div class="preview"><img src="${url}" alt="Inspiration"></div>
        <div class="stack tight" style="min-width:0"><span class="label">The look reads as</span><div class="chips">${look.style.map(s=>`<span class="chip">${esc(s)}</span>`).join("")}<span class="chip">${esc(look.colors.upper)} up top</span><span class="chip">${esc(look.colors.lower)} bottoms</span></div>
          <div class="chips">${sims.map(x=>`<span class="chip">${SLOT_LABEL[x.k]}: ${matchLabel(x.s)}</span>`).join("")}</div></div></div>
      <article class="look">${collageHTML(r,0,false)}<div class="chips">${r.tags.map(t=>`<span class="chip ${t.c}">${esc(t.t)}</span>`).join("")}</div></article>
      ${notes.length?`<div class="notice">${notes.map(esc).join(" ")}</div>`:""}
      ${miss.length?`<div class="notice solid"><strong>To nail it you'd need:</strong> ${miss.map(esc).join(", ")}.</div>`:""}
      <div class="row"><button type="button" class="btn accent" id="rWear">Wearing this</button><button type="button" class="btn" id="rSave">☆ Save</button><button type="button" class="btn quiet" id="rToday">Use on Today</button></div>
      <p class="muted small">Matches come from the on-device AI comparing the photo with your pieces. It reads colour and garment type well; exact cuts less so.</p>`,{full:true});
    const done=()=>{ URL.revokeObjectURL(url); closeSheet(); };
    panel.querySelector("#x").onclick=done;
    panel.querySelector("#rWear").onclick=async()=>{ done(); await wear(0,[r]); };
    panel.querySelector("#rSave").onclick=async()=>{ S.saved.unshift({key:r.key,t:Date.now(),slots:Object.fromEntries(SLOTS.filter(k=>r[k]).map(k=>[k,r[k].id])),inspo:true}); await kvSet("saved",S.saved); toast("Saved under Closet › Saved."); };
    panel.querySelector("#rToday").onclick=()=>{ done(); S.locks=Object.fromEntries(["outer","layer","top","bottom","shoes","hat"].filter(k=>r[k]).map(k=>[k,r[k].id])); S.skipped.clear(); setTab("today"); toast("Locked in as your base. Unlock pieces to vary it."); };
  }catch(e){ closeSheet(); toast("Couldn't read that photo. Try a clear full-body shot."); }
};
function aiNeededSheet(why){
  const p=openSheet(`<h2>Turn on the fashion AI</h2><p>${esc(why)} It runs entirely on your phone: a one-time download of about 150 MB (use Wi-Fi), then it works offline and costs nothing.</p>
    <div class="row"><button type="button" class="btn accent" id="aiGo">Download and turn on</button><button type="button" class="btn quiet" id="aiNo">Not now</button></div>`);
  p.querySelector("#aiNo").onclick=closeSheet;
  p.querySelector("#aiGo").onclick=()=>{ closeSheet(); enableAI(); setTab("settings"); };
}

/* ================= FIT DIARY ================= */
const diaryIn=document.createElement("input"); diaryIn.type="file"; diaryIn.accept="image/*"; diaryIn.hidden=true; diaryIn.id="diaryIn"; document.body.appendChild(diaryIn);
let diaryCtx=null;
function startDiary(wearEntry=null){ diaryCtx={wearEntry}; diaryIn.value=""; diaryIn.click(); }
diaryIn.onchange=async()=>{
  const f=diaryIn.files[0]; if (!f) return;
  try{
    const img=await loadImage(f), photo=await resize(img,1200,.84), thumb=await resize(img,420,.78);
    const today=new Date().toDateString();
    const lastWear=(diaryCtx&&diaryCtx.wearEntry) || [...S.history.wear].reverse().find(w=>new Date(w.t).toDateString()===today);
    const e={id:"d"+Date.now().toString(36), t:Date.now(), rating:0, tags:[], note:"", itemIds:lastWear?[...lastWear.ids]:[], photo, thumb, vibe:lastWear?lastWear.vibe:S.vibe};
    let aiPicked=false;
    if (aiReady()){
      busySheet("Recognising your pieces…");
      try{
        const look=await readLook(img); e.emb=look.E.full;
        if (!lastWear){
          const pick1=(cat,emb,col)=>{ const b=bestMatch(cat,emb,()=>true,col); return b&&b.s>.6?b.it.id:null; };
          e.itemIds=[...new Set([pick1(look.upperCat,look.E.upper,look.colors.upper), look.upperCat!=="top"?pick1("top",look.E.upper):null, pick1("bottom",look.E.lower,look.colors.lower), pick1("shoes",look.E.feet,look.colors.feet), look.hasHat?pick1("hat",look.E.head):null].filter(Boolean))];
          aiPicked=e.itemIds.length>0;
        }
      }catch{}
    }
    URL.revokeObjectURL(img.src);
    diaryEditor(e, true, aiPicked);
  }catch{ closeSheet(); toast("That photo couldn't be read."); }
};
function diaryEditor(e, isNew, aiPicked=false){
  const src=isNew?URL.createObjectURL(e.thumb||e.photo):photoURL(e,true);
  const grouped=CATS.map(c=>({c, items:S.items.filter(i=>i.cat===c.k)})).filter(g=>g.items.length);
  const panel=openSheet(`<div class="row between"><h2>${isNew?"Rate today's fit":"Diary entry"}</h2><button type="button" class="btn quiet" id="x">Close</button></div>
    <div class="row" style="align-items:flex-start;flex-wrap:nowrap"><div class="preview"><img src="${esc(src)}" alt=""></div>
      <div class="stack tight" style="min-width:0"><span class="label">${fmtDay(e.t)}</span>
        <div class="stars" role="group" aria-label="Rating">${[1,2,3,4,5].map(n=>`<button type="button" data-star="${n}" aria-pressed="${e.rating>=n}" aria-label="${n} star${n>1?"s":""}">★</button>`).join("")}</div>
        <div class="seg">${DIARY_TAGS.map(t=>`<button type="button" data-dtag="${esc(t)}" aria-pressed="${e.tags.includes(t)}">${esc(t)}</button>`).join("")}</div></div></div>
    <div class="field"><span class="label">Pieces in this fit${aiPicked?" · picked by AI, check them":e.itemIds.length?" · from what you logged":""}</span>
      ${grouped.length?grouped.map(g=>`<div class="stack tight"><span class="label">${g.c.n}</span><div class="mini sel">${g.items.map(it=>`<button type="button" class="item" data-di="${esc(it.id)}" aria-pressed="${e.itemIds.includes(it.id)}">${phHTML(it)}</button>`).join("")}</div></div>`).join(""):`<p class="muted small">Add pieces to your closet to link them here.</p>`}</div>
    <div class="field"><label class="label" for="dNote">Note</label><input type="text" id="dNote" value="${esc(e.note)}" placeholder="Where you wore it, what worked"></div>
    <div class="row between"><button type="button" class="btn primary" id="dSave">Save to diary</button>${isNew?"":`<button type="button" class="btn danger" id="dDel">Delete</button>`}</div>
    <p class="muted small">Ratings teach the app: 4–5 stars pull future fits toward this look, 1–2 push away. "Too warm" or "Too cold" shifts how warmly it dresses you.</p>`,{full:true});
  const done=()=>{ if (isNew) URL.revokeObjectURL(src); closeSheet(); };
  panel.querySelector("#x").onclick=done;
  panel.querySelectorAll("[data-star]").forEach(b=>b.onclick=()=>{ e.rating=+b.dataset.star; panel.querySelectorAll("[data-star]").forEach(x=>x.setAttribute("aria-pressed",String(+x.dataset.star<=e.rating))); buzz(); });
  panel.querySelectorAll("[data-dtag]").forEach(b=>b.onclick=()=>{ const t=b.dataset.dtag,i=e.tags.indexOf(t); if (i>=0) e.tags.splice(i,1); else e.tags.push(t); b.setAttribute("aria-pressed",String(i<0)); });
  panel.querySelectorAll("[data-di]").forEach(b=>b.onclick=()=>{ const id=b.dataset.di,i=e.itemIds.indexOf(id); if (i>=0) e.itemIds.splice(i,1); else e.itemIds.push(id); b.setAttribute("aria-pressed",String(i<0)); });
  panel.querySelector("#dNote").oninput=ev=>e.note=ev.target.value;
  panel.querySelector("#dSave").onclick=async()=>{
    if (!e.rating){ toast("Give it a star rating first."); return; }
    try{
      if (!e.learned){
        const o=outfitFromIds(e.itemIds);
        if (o.top&&o.bottom){ const sc=scoreOutfit(o); if (e.rating>=4) learn(sc.f,1,2); else if (e.rating<=2) learn(sc.f,0,2);
          const ps=partsOf(o), d=e.rating>=4?1.5:e.rating<=2?-1.5:0;
          if (d){ for (let i=0;i<ps.length;i++) for (let j=i+1;j<ps.length;j++){ const k=pairKey(ps[i].id,ps[j].id); S.history.pairs[k]=Math.max(-6,Math.min(6,(S.history.pairs[k]||0)+d)); } saveHistory(); } }
        if (e.tags.includes("Too cold")) S.settings.thermal=Math.min(5,(S.settings.thermal||0)+1);
        if (e.tags.includes("Too warm")) S.settings.thermal=Math.max(-5,(S.settings.thermal||0)-1);
        saveSettings(); e.learned=true;
      }
      await diaryPut(e); const ix=S.diary.findIndex(x=>x.id===e.id); if (ix>=0) S.diary[ix]=e; else S.diary.unshift(e);
      recomputeStyle(); done(); S.skipped.clear(); render(); toast(isNew?"Saved to your diary. The app learned from it.":"Saved.");
    }catch{ toast("Couldn't save. Try again."); }
  };
  const del=panel.querySelector("#dDel"); if (del) del.onclick=()=>confirmSheet("Delete this diary entry and its photo?","Delete",async()=>{ await diaryDel(e.id); dropURLs(e.id); S.diary=S.diary.filter(x=>x.id!==e.id); recomputeStyle(); render(); });
}

/* ================= CLOSET ================= */
function renderCloset(v){
  const views=[["pieces",`Pieces ${S.items.length}`],["diary",`Diary ${S.diary.length}`],["worn","Worn"],["saved",`Saved ${S.saved.length}`]];
  v.innerHTML=`<div class="stack">${seg("cv",views,S.closetView,"scroll")}<div id="cvBody" class="stack"></div></div>`;
  v.querySelectorAll("[data-cv]").forEach(b=>b.onclick=()=>{ S.closetView=b.dataset.cv; render(); });
  const body=$("#cvBody");
  ({pieces:renderPieces, diary:renderDiary, worn:renderWorn, saved:renderSaved})[S.closetView](body);
}
function renderPieces(body){
  let list=S.filter==="all"?S.items.slice():S.items.filter(i=>i.cat===S.filter);
  const q=S.query.trim().toLowerCase();
  if (q) list=list.filter(i=>(i.name+" "+colorName(itemColor(i))+" "+(i.styles||[]).join(" ")+" "+(FIT[i.fit]||"")+" "+(i.metal||"")+" "+(i.sub||"")).toLowerCase().includes(q));
  const sorts={new:(a,b)=>b.added-a.added, most:(a,b)=>(b.wearCount||0)-(a.wearCount||0), least:(a,b)=>(a.wearCount||0)-(b.wearCount||0)||(a.lastWorn||0)-(b.lastWorn||0),
    color:(a,b)=>hexToHsl(itemColor(a)).h-hexToHsl(itemColor(b)).h, wash:(a,b)=>(b.inWash?1:0)-(a.inWash?1:0)};
  list.sort(sorts[S.sort]||sorts.new);
  const washCount=S.items.filter(i=>i.inWash).length;
  body.innerHTML=`
    <div class="search"><input type="search" id="q" placeholder="Search name, colour, style" value="${esc(S.query)}" aria-label="Search closet">
      <select id="sortSel" aria-label="Sort">${[["new","Newest"],["most","Most worn"],["least","Least worn"],["color","By colour"],["wash","In wash first"]].map(([k,l])=>`<option value="${k}" ${S.sort===k?"selected":""}>${l}</option>`).join("")}</select></div>
    ${seg("f",[["all","All"],...CATS.map(c=>[c.k,`${c.n} ${S.items.filter(i=>i.cat===c.k).length}`])],S.filter,"scroll")}
    ${washCount?`<div class="row between"><span class="muted small">${washCount} in the wash</span><button type="button" class="btn quiet" id="allClean">Mark all clean</button></div>`:""}
    ${list.length?`<div class="grid">${list.map(it=>`<button type="button" class="item" data-id="${esc(it.id)}">${phHTML(it)}<span class="nm">${esc(it.name)}</span><span class="label">${it.wearCount?`worn ${it.wearCount}×`:"not worn yet"}</span></button>`).join("")}</div>`
      : S.items.length?`<p class="muted">Nothing matches.</p>`:needsHTML()}`;
  const qi=$("#q"); qi.oninput=debounce(()=>{ S.query=qi.value; renderPieces(body); const n=$("#q"); n.focus(); n.setSelectionRange(n.value.length,n.value.length); },180);
  $("#sortSel").onchange=e=>{ S.sort=e.target.value; renderPieces(body); };
  body.querySelectorAll("[data-f]").forEach(b=>b.onclick=()=>{ S.filter=b.dataset.f; renderPieces(body); });
  body.querySelectorAll("[data-id]").forEach(b=>b.onclick=()=>openEditor(S.items.find(i=>i.id===b.dataset.id)));
  const ac=$("#allClean"); if (ac) ac.onclick=async()=>{ const w=S.items.filter(i=>i.inWash); w.forEach(i=>i.inWash=false); await itemsPut(w).catch(storageFail); S.skipped.clear(); renderPieces(body); toast("All clean."); };
}
function renderDiary(body){
  const rated=S.diary.filter(e=>e.rating), avg=rated.length?(rated.reduce((a,e)=>a+e.rating,0)/rated.length).toFixed(1):null;
  body.innerHTML=`<div class="row between"><span class="muted small">${S.diary.length?`${S.diary.length} fits logged${avg?` · average ${avg}★`:""}`:"Mirror pics of what you actually wore, rated by you."}</span>
      <button type="button" class="btn primary" id="dAdd">+ Mirror pic</button></div>
    ${S.styleVec?`<div class="notice">Your best-rated fits now steer suggestions${aiReady()?"":" once the AI is on"}.</div>`:S.diary.length?`<div class="notice">Rate at least two fits 4★ or higher${aiReady()?"":" and turn on the AI in Settings"} so the app can learn your look.</div>`:""}
    <div class="dgrid">${S.diary.slice().sort((a,b)=>b.t-a.t).map(e=>`<button type="button" class="ditem" data-de="${esc(e.id)}"><div class="ph tall"><img src="${esc(photoURL(e,true))}" alt="" loading="lazy"></div>
      <span class="row between"><span class="label">${fmtDay(e.t)}</span><span class="dots">${"★".repeat(e.rating||0)}</span></span>${e.tags.length?`<span class="small muted">${esc(e.tags.join(" · "))}</span>`:""}</button>`).join("")}</div>`;
  $("#dAdd").onclick=()=>startDiary();
  body.querySelectorAll("[data-de]").forEach(b=>b.onclick=()=>diaryEditor(S.diary.find(e=>e.id===b.dataset.de),false));
}
function renderWorn(body){
  const days=new Map();
  for (const w of S.history.wear.slice().reverse()){ const d=new Date(w.t).toDateString(); if (!days.has(d)) days.set(d,[]); days.get(d).push(w); }
  if (!days.size){ body.innerHTML=`<p class="muted">Fits you mark as "Wearing this" show up here.</p>`; return; }
  const least=S.items.filter(i=>!i.inWash&&i.cat!=="jewelry").sort((a,b)=>(a.lastWorn||0)-(b.lastWorn||0)).slice(0,6);
  body.innerHTML=`${least.length>=3?`<div class="card"><span class="label">Waiting the longest</span><div class="mini">${least.map(it=>`<div title="${esc(it.name)}">${phHTML(it)}</div>`).join("")}</div></div>`:""}
    ${[...days.entries()].slice(0,40).map(([d,ws])=>`<div class="day"><div class="row between"><h3>${fmtDay(ws[0].t)}</h3><span class="label">${ws[0].temp!=null?deg(ws[0].temp):""}${ws[0].vibe?" · "+esc((D.vibes.find(x=>x.id===ws[0].vibe)||{}).name||""):""}</span></div>
      ${ws.map(w=>`<div class="mini">${w.ids.map(id=>S.items.find(i=>i.id===id)).filter(Boolean).map(it=>`<div title="${esc(it.name)}">${phHTML(it)}</div>`).join("")}</div>`).join("")}</div>`).join("")}`;
}
function renderSaved(body){
  const fits=S.saved.map(f=>({f, parts:Object.entries(f.slots).map(([k,id])=>[k,S.items.find(i=>i.id===id)]).filter(x=>x[1])})).filter(x=>x.parts.length);
  if (!fits.length){ body.innerHTML=`<p class="muted">Tap ☆ on a fit, or save a recreated look, to keep it here.</p>`; return; }
  body.innerHTML=fits.map(({f,parts},n)=>`<div class="card"><div class="row between"><span class="label">${f.inspo?"From inspiration · ":""}Saved ${fmtDay(f.t)}</span>
    <div class="row"><button type="button" class="btn quiet" data-unsave="${n}">Remove</button><button type="button" class="btn accent" data-wearsaved="${n}">Wear today</button></div></div>
    <div class="mini">${parts.map(([k,it])=>`<div title="${esc(it.name)}">${phHTML(it)}</div>`).join("")}</div></div>`).join("");
  body.querySelectorAll("[data-unsave]").forEach(b=>b.onclick=async()=>{ const f=fits[+b.dataset.unsave].f; S.saved=S.saved.filter(x=>x!==f); await kvSet("saved",S.saved); renderSaved(body); });
  body.querySelectorAll("[data-wearsaved]").forEach(b=>b.onclick=async()=>{ const {parts}=fits[+b.dataset.wearsaved]; const o=Object.fromEntries(parts);
    if (!o.top||!o.bottom||!o.shoes){ toast("This fit is missing a piece you removed."); return; }
    await wear(0,[rescore(o)]); });
}

/* ================= add / edit pieces ================= */
function addMenu(){
  const p=openSheet(`<div class="row between"><h2>Add</h2><button type="button" class="btn quiet" id="x">Close</button></div>
    <span class="label">Pieces for your closet</span>
    <div class="two"><button type="button" class="btn primary block" id="aCam">Take a photo</button><button type="button" class="btn block" id="aLib">Pick photos</button></div>
    <p class="muted small">Plain background, daylight, one piece per photo. Pick many photos at once and tag them in a row.${aiReady()?" The AI fills in the tags for you.":""}</p>
    <span class="label">Looks</span>
    <div class="two"><button type="button" class="btn block" id="aMirror">▣ Mirror pic</button><button type="button" class="btn block" id="aInspo">◎ Recreate a look</button></div>`);
  p.querySelector("#x").onclick=closeSheet;
  p.querySelector("#aCam").onclick=()=>{ closeSheet(); S.presets=null; $("#fileCam").click(); };
  p.querySelector("#aLib").onclick=()=>{ closeSheet(); S.presets=null; $("#fileLib").click(); };
  p.querySelector("#aMirror").onclick=()=>{ closeSheet(); startDiary(); };
  p.querySelector("#aInspo").onclick=()=>{ closeSheet(); startRecreate(); };
}
$("#fileCam").onchange=e=>{ startQueue([...e.target.files]); e.target.value=""; };
$("#fileLib").onchange=e=>{ startQueue([...e.target.files]); e.target.value=""; };
function startQueue(files){ if (!files.length) return; S.queue=files; S.queueTotal=files.length; nextInQueue(); }
async function nextInQueue(){
  const f=S.queue.shift(); if (!f){ S.presets=null; render(); return; }
  try{
    const img=await loadImage(f);
    const photo=await resize(img,1100,.84), thumb=await resize(img,360,.78);
    const pr=S.presets||{};
    let it={id:"i"+Date.now().toString(36)+Math.random().toString(36).slice(2,6), name:"", cat:pr.cat||"top", sub:pr.sub||"", metal:pr.metal||"", color:dominantColor(img), warmth:pr.warmth||2,
      fit:pr.fit||"relaxed", form:1, pattern:false, styles:pr.styles?[...pr.styles]:[], pinned:false, inWash:false, added:Date.now(), wearCount:0, photo, thumb};
    URL.revokeObjectURL(img.src);
    if (aiReady() && S.settings.autoTag && !S.presets){ busySheet("Tagging with AI…"); try{ it=await aiTag(it); }catch{} }
    else if (aiReady()){ try{ it.emb=await AI.embedImage(thumb); }catch{} }
    if (it.cat==="jewelry"&&!it.metal) it.metal=/gold/i.test(S.profile.jewelry||"")?"gold":"silver";
    openEditor(it, true);
  }catch{ closeSheet(); toast("That photo couldn't be read. Try a JPG or PNG."); nextInQueue(); }
}
function loadImage(f){ return new Promise((res,rej)=>{ const im=new Image(); im.onload=()=>res(im); im.onerror=rej; im.src=URL.createObjectURL(f); }); }
function resize(img,max,q){ const r=Math.min(1,max/Math.max(img.naturalWidth,img.naturalHeight)), c=document.createElement("canvas");
  c.width=Math.round(img.naturalWidth*r); c.height=Math.round(img.naturalHeight*r); c.getContext("2d").drawImage(img,0,0,c.width,c.height);
  return new Promise(res=>c.toBlob(res,"image/jpeg",q)); }
let draft=null;
function openEditor(item, isNew=false){
  draft={isNew, item:{styles:[],aiTags:[],...item}}; const it=draft.item;
  const src=isNew?URL.createObjectURL(it.photo):photoURL(it,false);
  draft.tmpURL=isNew?src:null;
  const isJ=it.cat==="jewelry", noFit=["hat","gloves","shoes","jewelry"].includes(it.cat);
  const ai=k=>it.aiTags&&it.aiTags.includes(k)?` <span class="aichip">AI</span>`:"";
  const qpos=isNew&&S.queueTotal>1?`<span class="label">${S.queueTotal-S.queue.length} of ${S.queueTotal}</span>`:"";
  const panel=openSheet(`<div class="row between"><h2>${isNew?"Tag this piece":"Edit piece"}</h2><div class="row">${qpos}<button type="button" class="btn quiet" id="x">${isNew&&S.queue.length?"Skip":"Close"}</button></div></div>
    ${isNew&&it.aiTags&&it.aiTags.length?`<div class="notice">The AI pre-filled the fields marked AI. Check them: it gets the type right about 19 times in 20 on clean photos, the finer details less often.</div>`:""}
    <div class="row" style="align-items:flex-start;flex-wrap:nowrap">
      ${src?`<div class="preview"><img src="${esc(src)}" alt=""></div>`:""}
      <div class="field" style="flex:1"><label class="label" for="nm">Name</label><input type="text" id="nm" value="${esc(it.name)}" placeholder="${isJ?"Silver curb chain":"Black heavyweight tee"}" autocomplete="off">
        ${isJ?"":`<span class="label">Main colour</span><div class="colorrow"><input type="color" id="clr" value="${esc(it.color)}" aria-label="Main colour"><span id="clrName">${esc(colorName(it.color))}</span></div>`}</div>
    </div>
    <div class="field"><span class="label">Type${ai("cat")}</span>${seg("cat",CATS.map(c=>[c.k,c.n]),it.cat)}</div>
    ${it.cat==="hat"?`<div class="field"><span class="label">Headwear style${ai("sub")}</span>${seg("sub",HAT_SUBS,it.sub)}</div>`:""}
    ${isJ?`<div class="field"><span class="label">Piece${ai("sub")}</span>${seg("sub",JEWEL_SUBS,it.sub)}</div><div class="field"><span class="label">Metal${ai("metal")}</span>${seg("metal",METALS,it.metal)}</div>`:""}
    ${isJ?"":`<div class="field"><span class="label">Warmth${ai("warmth")}</span>${seg("warmth",[[1,"Light"],[2,"Medium"],[3,"Heavy"]],it.warmth)}</div>`}
    ${noFit?"":`<div class="field"><span class="label">Fit${ai("fit")}</span>${seg("fit",Object.entries(FIT),it.fit)}</div>`}
    <div class="field"><span class="label">Formality${ai("form")}</span>${seg("form",[[1,"Casual"],[2,"Smart casual"],[3,"Dressed up"]],it.form)}</div>
    ${isJ?"":`<div class="field"><span class="label">Surface${ai("pattern")}</span>${seg("pattern",[[false,"Solid"],[true,"Graphic / pattern"]],it.pattern)}</div>
    <div class="field"><span class="label">Style${ai("styles")}</span><div class="seg">${STYLES.map(s=>`<button type="button" data-style="${s}" aria-pressed="${it.styles.includes(s)}">${s}</button>`).join("")}</div></div>`}
    <label class="toggle"><span><strong>Pin</strong><br><span class="muted small">${isJ?"Your everyday piece: added whenever the fit calls for jewellery.":"Used whenever it suits the fit. A pinned skull cap with headwear on \"Always\" goes on even when it's warm."}</span></span><input type="checkbox" id="pinIt" ${it.pinned?"checked":""}></label>
    ${isNew||isJ?"":`<label class="toggle"><span><strong>In the wash</strong><br><span class="muted small">Left out of fits until you mark it clean.</span></span><input type="checkbox" id="washIt" ${it.inWash?"checked":""}></label>`}
    <div class="row between"><button type="button" class="btn primary" id="saveIt">${isNew?(S.queue.length?"Save & next":"Add to closet"):"Save"}</button>
      ${isNew?"":`<button type="button" class="btn danger" id="delIt">Remove</button>`}</div>
    ${isNew?"":`<p class="label">Added ${fmtDay(it.added||Date.now())} · worn ${it.wearCount||0}× ${it.lastWorn?"· last "+fmtDay(it.lastWorn):""}</p>`}`);
  panel.querySelector("#x").onclick=()=>{ cleanupDraft(); closeSheet(); if (isNew) nextInQueue(); };
  panel.querySelector("#nm").oninput=e=>it.name=e.target.value;
  const clr=panel.querySelector("#clr"); if (clr) clr.oninput=e=>{ it.color=e.target.value; panel.querySelector("#clrName").textContent=colorName(it.color); };
  for (const k of ["cat","sub","metal","warmth","fit","form","pattern"]) panel.querySelectorAll(`[data-${k}]`).forEach(b=>b.onclick=()=>{
    const raw=b.dataset[k]; it[k]=k==="warmth"||k==="form"?+raw:k==="pattern"?raw==="true":raw;
    if (it.aiTags) it.aiTags=it.aiTags.filter(x=>x!==k);
    if (k==="cat"){ if (raw==="hat") it.sub=HAT_SUBS.some(h=>h[0]===it.sub)?it.sub:"beanie"; else if (raw==="jewelry"){ it.sub=JZONE[it.sub]?it.sub:"chain"; it.metal=it.metal||"silver"; } else it.sub="";
      it.name=panel.querySelector("#nm").value; if (draft.tmpURL) URL.revokeObjectURL(draft.tmpURL); openEditor(it,isNew); return; }
    panel.querySelectorAll(`[data-${k}]`).forEach(x=>x.setAttribute("aria-pressed",String(x===b))); });
  panel.querySelectorAll("[data-style]").forEach(b=>b.onclick=()=>{ const s=b.dataset.style,i=it.styles.indexOf(s); if (i>=0) it.styles.splice(i,1); else it.styles.push(s); b.setAttribute("aria-pressed",String(i<0)); });
  panel.querySelector("#pinIt").onchange=e=>it.pinned=e.target.checked;
  const wi=panel.querySelector("#washIt"); if (wi) wi.onchange=e=>it.inWash=e.target.checked;
  panel.querySelector("#saveIt").onclick=commit;
  const d=panel.querySelector("#delIt"); if (d) d.onclick=()=>confirmSheet("Remove this piece and its photo?","Remove",removeItem.bind(null,it));
}
function cleanupDraft(){ if (draft&&draft.tmpURL) URL.revokeObjectURL(draft.tmpURL); draft=null; }
async function commit(){
  const {item:it,isNew}=draft;
  if (it.cat!=="hat"&&it.cat!=="jewelry") it.sub="";
  if (it.cat!=="jewelry") it.metal="";
  if (it.cat==="jewelry"){ it.color=METAL_HEX[it.metal]||METAL_HEX.other; it.warmth=1; }
  if (!it.name.trim()) it.name = it.cat==="jewelry" ? cap(it.metal||"")+" "+((JEWEL_SUBS.find(j=>j[0]===it.sub)||["","piece"])[1]).toLowerCase()
    : cap(colorName(it.color))+" "+(it.cat==="hat"?(HAT_SUBS.find(h=>h[0]===it.sub)||["","hat"])[1].toLowerCase():CATS.find(c=>c.k===it.cat).n.toLowerCase());
  it.name=it.name.trim();
  try{
    if (!it.emb && aiReady() && (it.thumb||it.photo)){ try{ it.emb=await AI.embedImage(it.thumb||it.photo); }catch{} }
    await itemPut(it); dropURLs(it.id);
    const idx=S.items.findIndex(x=>x.id===it.id); if (idx>=0) S.items[idx]=it; else S.items.push(it);
    for (const [k,id] of Object.entries(S.locks)) if (id===it.id && it.inWash) delete S.locks[k];
    cleanupDraft(); closeSheet(); S.skipped.clear(); buzz(); recomputeBaselines();
    if (isNew&&S.queue.length){ toast("Added."); nextInQueue(); } else { render(); toast(isNew?"Added to your closet.":"Saved."); if (isNew) S.presets=null; }
  }catch(e){ toast(e&&e.name==="QuotaExceededError"?"This phone is out of storage for photos. Remove a few pieces first.":"Couldn't save. Try again."); }
}
async function removeItem(it){
  try{ await itemDel(it.id); dropURLs(it.id); S.items=S.items.filter(x=>x.id!==it.id);
    for (const [k,id] of Object.entries(S.locks)) if (id===it.id) delete S.locks[k];
    cleanupDraft(); render(); toast("Removed."); }catch{ toast("Couldn't remove. Try again."); }
}

/* ================= SHOP ================= */
function ownsSimilar(p){
  if (p.cat==="jewelry") return S.items.find(i=>i.cat==="jewelry"&&i.sub===p.sub&&(!p.metal||i.metal===p.metal));
  const near=(a,b)=>a===b||(["grey","light grey"].includes(a)&&["grey","light grey"].includes(b));
  return S.items.find(i=>i.cat===p.cat&&(!p.sub||i.sub===p.sub)&&(!p.fit||i.fit===p.fit||(["relaxed","wide"].includes(p.fit)&&["relaxed","wide"].includes(i.fit)))&&(!p.color||near(colorName(i.color),p.color)));
}
function renderShop(v){
  const rc=regionCode(), R=region(), lang=R.lang;
  const sigs=activeSignals(), sigName=id=>(D.signals.find(s=>s.id===id)||{}).name;
  const picks=D.picks.filter(p=>!p.regions||p.regions.includes(rc)).filter(p=>!S.dismissed.includes(p.id)).map(p=>({...p,own:ownsSimilar(p)}))
    .sort((a,b)=>(a.own?1:0)-(b.own?1:0));
  const missing=picks.filter(p=>!p.own).length;
  const loc=S.loc&&S.loc.lat!=null?S.loc:null;
  const cities=R.cities.map(c=>({...c,d:loc?km(loc,c):null})).sort((a,b)=>(a.d??1e9)-(b.d??1e9));
  const mapURL=a=>"https://www.google.com/maps/search/?api=1&query="+encodeURIComponent(a);
  v.innerHTML=`<div class="stack">
    <div class="row between"><span class="label">${esc(R.name)}${S.settings.region==="auto"?" · from your location":""} · trends ${esc(D.compiled)}</span>
      <button type="button" class="btn quiet" id="regionBtn">Change</button></div>
    <section class="stack"><div class="sectionhead"><h2>Shopping list</h2><span class="label">${missing} missing</span></div>
      ${picks.map(p=>{ const terms=[...(p.q[lang]||[]),...(lang!=="en"?p.q.en:[])]; const price=p.price&&p.price[rc];
        return `<article class="card ${p.own?"":"missing"}">
        <div class="row between"><span class="label">${esc((CATS.find(c=>c.k===p.cat)||{}).n)}${sigName(p.trend)?" · "+esc(sigName(p.trend)):""}</span>
          <span class="status ${p.own?"have":"miss"}">${p.own?"You have: "+esc(p.own.name):"Missing"}</span></div>
        <h3>${esc(p.name)}</h3><p class="small">${esc(p.why)}</p>
        ${price?`<p class="small"><strong>${esc(price)}</strong> · <a href="${esc(p.priceSource)}" target="_blank" rel="noopener">source</a></p>`:""}
        <div class="row">${terms.map(q=>`<button type="button" class="copy" data-copy="${esc(q)}" aria-label="Copy search term ${esc(q)}">${esc(q)} ⧉</button>`).join("")}</div>
        <div class="row">${p.own?"":`<button type="button" class="btn quiet" data-got="${esc(p.id)}">I got it</button>`}<button type="button" class="btn quiet" data-dismiss="${esc(p.id)}">Not for me</button></div>
      </article>`; }).join("")}
      ${S.dismissed.length?`<button type="button" class="btn quiet" id="undismiss">Show ${S.dismissed.length} hidden</button>`:""}
      <p class="muted small">Tap a search term to copy it into a shop's app. Prices appear only where a source states them.</p>
    </section>
    <section class="stack"><div class="sectionhead"><h2>Where to shop</h2><span class="label">${esc(R.name)}</span></div>
      <div class="card"><span class="label">Online</span><div class="src">${R.online.map(o=>`<a href="${esc(o.url)}" target="_blank" rel="noopener">${esc(o.name)}</a>`).join("")}</div></div>
      ${cities.length?cities.map(c=>`<div class="stack tight"><div class="row between"><h3>${esc(c.name)}</h3><span class="label">${c.d==null?"":c.d<40?"your city":Math.round(c.d)+" km away"}</span></div>
        ${c.stores.map(s=>`<div class="card"><div class="row between"><strong>${esc(s.name)}</strong><span class="label">${esc(s.area)}</span></div>
          <div class="row small between"><span>${esc(s.address)}</span><span class="row"><a href="${mapURL(s.name+", "+s.address)}" target="_blank" rel="noopener">Map</a><button type="button" class="copy" data-copy="${esc(s.address)}">copy ⧉</button></span></div>
          ${s.note?`<p class="small muted">${esc(s.note)}</p>`:""}<div class="src"><a href="${esc(s.source)}" target="_blank" rel="noopener">source</a></div></div>`).join("")}</div>`).join("")
        :`<p class="muted small">No store list for this region yet; the online shops above ship there.</p>`}
      ${R.brands&&R.brands.length?`<div class="card"><span class="label">Brands to look at</span><div class="chips">${R.brands.map(b=>`<span class="chip">${esc(b)}</span>`).join("")}</div></div>`:""}
    </section>
    <section class="stack"><div class="sectionhead"><h2>Trend report</h2><span class="label">${sigs.length} signals · ${esc(D.compiled)}</span></div>
      <p class="muted small">Compiled from fashion press, retail coverage and street-style reports that track TikTok and Instagram. These signals also steer your daily fits.</p>
      ${sigs.map(s=>`<article class="card"><div class="row between"><h3>${esc(s.name)}</h3><span class="dots" aria-label="strength ${s.strength} of 3">${"■".repeat(s.strength)}${"□".repeat(3-s.strength)}</span></div>
        <p class="small">${esc(s.why)}</p>${s.conflict?`<p class="small muted">Counterpoint: ${esc(s.conflict)}</p>`:""}
        <div class="src">${s.sources.map(x=>`<a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.title)}</a>`).join("")}</div></article>`).join("")}
      <div class="card"><span class="label">On the way out</span><div class="chips">${D.out.map(o=>`<span class="chip">${esc(o)}</span>`).join("")}</div></div>
    </section>
    <section class="stack"><div class="sectionhead"><h2>Vibes</h2><span class="label">what each one changes</span></div>
      ${D.vibes.map(x=>`<div class="card"><div class="row between"><strong>${esc(x.name)}</strong><span class="label">${FORM[Math.min(3,Math.round(x.form))]} · jewellery ${x.jewel[0]}–${x.jewel[1]}</span></div><p class="small">${esc(x.tip)}</p>
        ${x.source?`<div class="src"><a href="${esc(x.source.url)}" target="_blank" rel="noopener">${esc(x.source.title)}</a></div>`:`<span class="small muted">Daily Fit house rule</span>`}</div>`).join("")}
    </section></div>`;
  v.querySelectorAll("[data-copy]").forEach(b=>b.onclick=()=>copyText(b.dataset.copy));
  v.querySelectorAll("[data-dismiss]").forEach(b=>b.onclick=async()=>{ S.dismissed.push(b.dataset.dismiss); await kvSet("dismissed",S.dismissed); render(); toast("Hidden from your list.",{label:"Undo",fn:async()=>{ S.dismissed.pop(); await kvSet("dismissed",S.dismissed); render(); }}); });
  v.querySelectorAll("[data-got]").forEach(b=>b.onclick=()=>{ const p=D.picks.find(x=>x.id===b.dataset.got);
    S.presets={cat:p.cat, sub:p.sub, fit:p.fit, warmth:p.warmth, styles:p.styles, metal:p.metal}; toast("Nice. Take a photo of it to add it."); $("#fileCam").click(); });
  const ud=$("#undismiss"); if (ud) ud.onclick=async()=>{ S.dismissed=[]; await kvSet("dismissed",S.dismissed); render(); };
  $("#regionBtn").onclick=regionSheet;
}
function copyText(t){ const ok=()=>toast("Copied: "+t); try{ navigator.clipboard.writeText(t).then(ok,()=>fallbackCopy(t)); }catch{ fallbackCopy(t); } }
function fallbackCopy(t){ const a=document.createElement("textarea"); a.value=t; document.body.appendChild(a); a.select(); try{ document.execCommand("copy"); toast("Copied: "+t); }catch{ toast(t); } a.remove(); }
function regionSheet(){
  const opts=[["auto","Automatic (from location)"],...Object.entries(D.regions).map(([k,r])=>[k,r.name])];
  const p=openSheet(`<div class="row between"><h2>Shopping region</h2><button type="button" class="btn quiet" id="x">Close</button></div>
    <div class="list">${opts.map(([k,l])=>`<button type="button" data-reg="${k}"><span>${esc(l)}</span><span>${S.settings.region===k?"●":""}</span></button>`).join("")}</div>
    <p class="muted small">Region decides which stores, search languages and local trend signals you see.</p>`);
  p.querySelector("#x").onclick=closeSheet;
  p.querySelectorAll("[data-reg]").forEach(b=>b.onclick=()=>{ S.settings.region=b.dataset.reg; saveSettings(); S.skipped.clear(); closeSheet(); render(); });
}

/* ================= location sheet ================= */
function locationSheet(){
  const p=openSheet(`<div class="row between"><h2>Location</h2><button type="button" class="btn quiet" id="x">Close</button></div>
    <p class="muted small">Used for the weather forecast, nearby stores and local trends. It stays on this phone.</p>
    <button type="button" class="btn primary block" id="gps">◎ Use my current location</button>
    <div class="field"><label class="label" for="cityQ">Or search a city</label><input type="search" id="cityQ" placeholder="Seoul, Berlin, Zürich…" autocomplete="off" enterkeyhint="search"></div>
    <div class="list" id="cityRes"></div>
    ${S.loc?`<button type="button" class="btn quiet" id="clearLoc">Remove location (use the slider)</button>`:""}`);
  p.querySelector("#x").onclick=closeSheet;
  p.querySelector("#gps").onclick=async()=>{ if (await useGPS()) closeSheet(); };
  const q=p.querySelector("#cityQ"), out=p.querySelector("#cityRes");
  q.oninput=debounce(async()=>{ const s=q.value.trim(); if (s.length<2){ out.innerHTML=""; return; }
    out.innerHTML=`<p class="muted small" style="padding:10px 0">Searching…</p>`;
    try{ const r=await searchCities(s);
      out.innerHTML=r.length?r.map((c,i)=>`<button type="button" data-ci="${i}"><span><strong>${esc(c.name)}</strong> <span class="muted small">${esc([c.admin,c.countryName].filter(Boolean).join(", "))}</span></span><span>›</span></button>`).join(""):`<p class="muted small" style="padding:10px 0">No city found.</p>`;
      out.querySelectorAll("[data-ci]").forEach(b=>b.onclick=async()=>{ const c=r[+b.dataset.ci]; await setLocation({name:c.name, country:c.country, lat:c.lat, lon:c.lon, source:"search"}); closeSheet(); toast("Location set: "+c.name); });
    }catch{ out.innerHTML=`<p class="muted small" style="padding:10px 0">City search needs a connection. Try again when you're online.</p>`; }
  },350);
  const cl=p.querySelector("#clearLoc"); if (cl) cl.onclick=async()=>{ S.loc=null; S.weather=null; await kvSet("loc",null); await kvSet("weather",null); closeSheet(); render(); };
  setTimeout(()=>q.focus(),250);
}

/* ================= SETTINGS ================= */
function renderSettings(v){
  const st=S.settings, pr=S.profile, hrs=[...Array(24).keys()];
  const mode=(key,label,help,opts=[["auto","By weather"],["always","Always"],["never","Never"]])=>`<div class="field"><span class="label">${label}</span>${seg("m-"+key,opts,st[key])}${help?`<p class="muted small">${help}</p>`:""}</div>`;
  const aiState=AI?AI.state:"off";
  const learned=Object.entries(S.taste.w).filter(([,w])=>Math.abs(w)>.25).sort((a,b)=>Math.abs(b[1])-Math.abs(a[1])).slice(0,8);
  v.innerHTML=`<div class="stack">
    <section class="stack"><div class="sectionhead"><h2>Fashion AI</h2><span class="label">on this phone</span></div>
      ${aiState==="ready"?`<div class="notice solid">On. ${S.items.filter(i=>i.emb).length} of ${S.items.length} pieces analysed${S.aiBusy?" (working…)":""}. Runs offline; nothing leaves your phone.</div>
        <label class="toggle"><span><strong>Auto-tag new pieces</strong><br><span class="muted small">Pre-fills type, style, fit and more when you add a photo.</span></span><input type="checkbox" id="autoTag" ${st.autoTag?"checked":""}></label>`
      : aiState==="loading"?`<div class="notice">Downloading the model: ${Math.round((AI.progress||0)*100)}%. Keep the app open.</div>`
      : `<p class="small">FashionCLIP (Marqo's fashion-trained vision model) runs inside the app. It powers auto-tagging, recreating looks from inspiration photos, recognising pieces in mirror pics and learning your style from rated fits.</p>
         <p class="muted small">One-time download of about 150 MB; use Wi-Fi. After that it works offline and costs nothing.${aiState==="error"?" Last attempt failed: "+esc(AI.error):""}</p>
         <button type="button" class="btn accent" id="aiOn">${aiState==="error"?"Try again":"Download and turn on"}</button>`}
    </section>
    <section class="stack"><div class="sectionhead"><h2>What it has learned</h2><span class="label">${Math.round(S.taste.n)} signals</span></div>
      ${learned.length&&S.taste.n>=5?`<div class="chips">${learned.map(([k,w])=>`<span class="chip ${w>0?"trend":"warn"}">${w>0?"+ likes":"− avoids"} ${esc(featText(k))}</span>`).join("")}</div>`
        :`<p class="muted small">Every "Wearing this", "Not this", saved fit and rated mirror pic trains a small model of your taste. It starts steering suggestions after a handful of signals and is fully weighted after about 30.</p>`}
      <div class="toggle"><span><strong>Warmth preference</strong><br><span class="muted small">${st.thermal?`Dressing you as if it's ${Math.abs(st.thermal)}° ${st.thermal>0?"colder":"warmer"} than the forecast.`:"Learns from \"Too cold\" and \"Too warm\" in the diary."}</span></span>
        <span class="row"><button type="button" class="btn icon quiet" id="thMinus" aria-label="Dress lighter">−</button><span class="tnum">${st.thermal>0?"+":""}${st.thermal||0}°</span><button type="button" class="btn icon quiet" id="thPlus" aria-label="Dress warmer">+</button></span></div>
      <button type="button" class="btn quiet" id="resetTaste">Reset what it learned</button>
    </section>
    <section class="stack"><div class="sectionhead"><h2>Location</h2></div>
      <button type="button" class="card" id="locBtn" style="text-align:left;cursor:pointer"><span class="label">Weather, stores and trends for</span><strong>${S.loc?esc(S.loc.name)+(S.loc.source==="gps"?" (GPS)":""):"Not set — tap to choose"}</strong></button>
      <button type="button" class="card" id="regBtn" style="text-align:left;cursor:pointer"><span class="label">Shopping region</span><strong>${esc(region().name)}${st.region==="auto"?" (automatic)":""}</strong></button>
      <label class="toggle"><span><strong>Set the temperature myself</strong><br><span class="muted small">Ignore the forecast and use a slider.</span></span><input type="checkbox" id="manual" ${st.manual?"checked":""}></label>
      <div class="two"><div class="field"><label class="label" for="oS">Out from</label><select id="oS">${hrs.map(h=>`<option value="${h}" ${h===st.outStart?"selected":""}>${h}:00</option>`).join("")}</select></div>
        <div class="field"><label class="label" for="oE">Until</label><select id="oE">${hrs.map(h=>`<option value="${h}" ${h===st.outEnd?"selected":""}>${h}:00</option>`).join("")}</select></div></div>
    </section>
    <section class="stack"><div class="sectionhead"><h2>You</h2></div>
      <div class="two">
        <div class="field"><label class="label" for="pH">Height</label><input type="text" id="pH" value="${esc(pr.height)}"></div>
        <div class="field"><label class="label" for="pW">Weight</label><input type="text" id="pW" value="${esc(pr.weight)}"></div>
        <div class="field"><label class="label" for="pHair">Hair</label><input type="text" id="pHair" value="${esc(pr.hair)}"></div>
        <div class="field"><label class="label" for="pJ">Jewellery</label><input type="text" id="pJ" value="${esc(pr.jewelry)}"></div>
      </div>
      <label class="toggle"><span><strong>No skinny fits</strong><br><span class="muted small">Slim bottoms go to the back of the line.</span></span><input type="checkbox" id="avoidSkinny" ${st.avoidSkinny?"checked":""}></label>
    </section>
    <section class="stack"><div class="sectionhead"><h2>Accessories</h2></div>
      ${mode("headwear","Headwear",'"Always" puts a hat on every fit. Pin a piece (your skull cap, say) to make it the first choice, even when it\'s warm.')}
      ${mode("gloves","Gloves","")}
      ${mode("jewelry","Jewellery","1–2 pieces normally; the vibe changes it (more for nights out, none for active days). Pinned pieces come first; rings come off when gloves go on.",[["auto","Automatic"],["never","Never"]])}
    </section>
    <section class="stack"><div class="sectionhead"><h2>Rules</h2></div>
      <label class="toggle"><span><strong>Mix patterns</strong><br><span class="muted small">Off: one graphic or patterned piece per fit.</span></span><input type="checkbox" id="mixP" ${st.mixPatterns?"checked":""}></label>
      <div class="toggle"><span><strong>Rest worn pieces</strong><br><span class="muted small">Days before a worn piece comes back to the top.</span></span><select id="rest" aria-label="Rest days">${[0,1,2,3,5,7].map(n=>`<option ${n===st.avoidRepeatDays?"selected":""}>${n}</option>`).join("")}</select></div>
      <div class="field"><span class="label">Units</span>${seg("units",[["C","°C"],["F","°F"]],st.units)}</div>
      <div class="field"><span class="label">Theme</span>${seg("theme",[["system","System"],["light","Light"],["dark","Dark"]],st.theme)}</div>
    </section>
    <section class="stack"><div class="sectionhead"><h2>Your data</h2><span class="label" id="storeUse"></span></div>
      <p class="muted small">Your closet and diary live only on this phone. Back up now and then, and before changing phones.</p>
      <div class="two"><button type="button" class="btn" id="exportBtn">Back up</button><button type="button" class="btn quiet" id="importBtn">Restore</button></div>
      <button type="button" class="btn danger" id="wipe">Delete everything</button>
    </section>
    <section class="stack"><div class="sectionhead"><h2>How it works</h2></div>
      <div class="notice">Weather sets warmth and layers. Colour scores best as one accent on neutrals. Relaxed and wide cuts beat slim. Jewellery follows the vibe and keeps metals consistent. A learned model of your taste, your best-rated mirror pics (via the AI) and current trend signals add points. No account, no tracking; the only network calls are the free forecast, city search and the one-time AI download.</div>
      <p class="label">Daily Fit 4.0 · trend data ${esc(D.compiled)}</p>
    </section>
  </div>`;
  const ao=$("#aiOn"); if (ao) ao.onclick=()=>{ enableAI(); };
  const at=$("#autoTag"); if (at) at.onchange=e=>{ st.autoTag=e.target.checked; saveSettings(); };
  $("#thMinus").onclick=()=>{ st.thermal=Math.max(-5,(st.thermal||0)-1); saveSettings(); S.skipped.clear(); renderSettings(v); };
  $("#thPlus").onclick=()=>{ st.thermal=Math.min(5,(st.thermal||0)+1); saveSettings(); S.skipped.clear(); renderSettings(v); };
  $("#resetTaste").onclick=()=>confirmSheet("Forget everything it learned about your taste?","Reset",async()=>{ S.history.pairs={}; S.taste={w:{},n:0}; st.thermal=0; saveSettings(); await saveHistory(); await kvSet("taste",S.taste); render(); toast("Learned taste cleared."); });
  $("#locBtn").onclick=locationSheet; $("#regBtn").onclick=regionSheet;
  $("#manual").onchange=e=>{ st.manual=e.target.checked; saveSettings(); };
  $("#oS").onchange=e=>{ st.outStart=+e.target.value; saveSettings(); };
  $("#oE").onchange=e=>{ st.outEnd=+e.target.value; saveSettings(); };
  const prof=(id,key)=>{ $(id).oninput=e=>{ pr[key]=e.target.value; saveProfile(); }; };
  prof("#pH","height"); prof("#pW","weight"); prof("#pHair","hair"); prof("#pJ","jewelry");
  $("#avoidSkinny").onchange=e=>{ st.avoidSkinny=e.target.checked; saveSettings(); };
  for (const k of ["headwear","gloves","jewelry"]) v.querySelectorAll(`[data-m-${k}]`).forEach(b=>b.onclick=()=>{ st[k]=b.getAttribute(`data-m-${k}`); saveSettings(); S.skipped.clear(); renderSettings(v); });
  v.querySelectorAll("[data-units]").forEach(b=>b.onclick=()=>{ st.units=b.dataset.units; saveSettings(); renderSettings(v); });
  v.querySelectorAll("[data-theme]").forEach(b=>b.onclick=()=>{ st.theme=b.dataset.theme; saveSettings(); applyTheme(); renderSettings(v); });
  $("#mixP").onchange=e=>{ st.mixPatterns=e.target.checked; saveSettings(); };
  $("#rest").onchange=e=>{ st.avoidRepeatDays=+e.target.value; saveSettings(); };
  $("#exportBtn").onclick=exportData; $("#importBtn").onclick=()=>$("#fileImport").click();
  $("#wipe").onclick=()=>confirmSheet("Delete your whole closet, diary, history and settings from this phone?","Delete everything",async()=>{ await kvClear(); location.reload(); });
  if (navigator.storage&&navigator.storage.estimate) navigator.storage.estimate().then(e=>{ const el=$("#storeUse"); if (el) el.textContent=`${(e.usage/1048576).toFixed(0)} MB used`; }).catch(()=>{});
}
if (AI) AI.subscribe(debounce(()=>{ if (S.ready && S.tab==="settings" && $("#sheet").hidden) renderSettings($("#view")); },250));

/* ================= backup ================= */
const blobToDataURL=b=>new Promise(res=>{ if (!b||typeof b==="string") return res(b||""); const r=new FileReader(); r.onload=()=>res(r.result); r.readAsDataURL(b); });
const dataURLToBlob=async u=>u?(await fetch(u)).blob():null;
async function exportData(){
  toast("Preparing backup…");
  try{
    const items=await Promise.all(S.items.map(async ({emb,...it})=>({...it, photo:await blobToDataURL(it.photo), thumb:await blobToDataURL(it.thumb)})));
    const diary=await Promise.all(S.diary.map(async ({emb,...e})=>({...e, photo:await blobToDataURL(e.photo), thumb:await blobToDataURL(e.thumb)})));
    const data={app:"dailyfit", v:4, exported:new Date().toISOString(), items, diary, settings:S.settings, profile:S.profile, loc:S.loc, history:S.history, saved:S.saved, dismissed:S.dismissed, taste:S.taste};
    const blob=new Blob([JSON.stringify(data)],{type:"application/json"}), name=`dailyfit-backup-${new Date().toISOString().slice(0,10)}.json`;
    const file=new File([blob],name,{type:"application/json"});
    if (navigator.canShare&&navigator.canShare({files:[file]})){ try{ await navigator.share({files:[file],title:"Daily Fit backup"}); return; }catch(e){ if (e&&e.name==="AbortError") return; } }
    const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download=name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(a.href),5000);
    toast("Backup saved to your downloads.");
  }catch{ toast("Backup failed. Try again."); }
}
$("#fileImport").onchange=async e=>{
  const f=e.target.files[0]; e.target.value=""; if (!f) return;
  try{
    const d=JSON.parse(await f.text()); if (d.app!=="dailyfit"||!Array.isArray(d.items)) throw new Error("bad");
    confirmSheet(`Replace this phone's closet with the backup (${d.items.length} pieces)?`,"Restore",async()=>{
      await kvClear();
      const items=await Promise.all(d.items.map(async it=>({...it, photo:await dataURLToBlob(it.photo), thumb:await dataURLToBlob(it.thumb)})));
      await itemsPut(items);
      for (const de of (d.diary||[])) await diaryPut({...de, photo:await dataURLToBlob(de.photo), thumb:await dataURLToBlob(de.thumb)});
      await Promise.all([kvSet("settings",{...DEFAULT_SETTINGS,...d.settings}), kvSet("profile",{...DEFAULT_PROFILE,...d.profile}), kvSet("loc",d.loc||null),
        kvSet("history",d.history||{wear:[],pairs:{}}), kvSet("saved",d.saved||[]), kvSet("dismissed",d.dismissed||[]), kvSet("taste",d.taste||{w:{},n:0}), kvSet("onboarded",true)]);
      location.reload();
    });
  }catch{ toast("That file isn't a Daily Fit backup."); }
};

/* ================= onboarding ================= */
function onboarding(step=0){
  const steps=4, dots=`<div class="steps">${[...Array(steps)].map((_,i)=>`<span class="${i<=step?"on":""}"></span>`).join("")}</div>`;
  let html="";
  if (step===0) html=`${dots}<div class="hero">Your closet.<br>Today's weather.<br>Three fits.</div>
    <p>Photograph what you own once. Every morning Daily Fit builds three streetwear fits for the day's forecast, with headwear, gloves and jewellery when they make sense.</p>
    <p class="muted small">Everything stays on this phone. No account, no cost.</p>
    <button type="button" class="btn accent block" id="next">Get started</button>`;
  if (step===1) html=`${dots}<h1>Where are you?</h1><p class="muted">For the forecast, nearby stores and local trends.</p>
    <button type="button" class="btn primary block" id="gps">◎ Use my location</button>
    <button type="button" class="btn block" id="search">Search a city</button>
    <button type="button" class="btn quiet block" id="next">Skip, I'll set the temperature myself</button>
    ${S.loc?`<p class="small">Location: <strong>${esc(S.loc.name)}</strong></p><button type="button" class="btn accent block" id="next2">Continue</button>`:""}`;
  if (step===2) html=`${dots}<h1>Your style</h1>
    <div class="field"><span class="label">Headwear</span>${seg("ob-hw",[["auto","By weather"],["always","Always"],["never","Never"]],S.settings.headwear)}</div>
    <label class="toggle"><span><strong>No skinny fits</strong></span><input type="checkbox" id="obSkinny" ${S.settings.avoidSkinny?"checked":""}></label>
    <div class="two"><div class="field"><label class="label" for="obH">Height</label><input type="text" id="obH" value="${esc(S.profile.height)}"></div>
      <div class="field"><label class="label" for="obJ">Jewellery</label><input type="text" id="obJ" value="${esc(S.profile.jewelry)}"></div></div>
    <label class="toggle"><span><strong>Fashion AI</strong><br><span class="muted small">Auto-tags photos, recreates looks, learns from mirror pics. One-time ~150 MB download, then offline.</span></span><input type="checkbox" id="obAI" ${S.settings.aiEnabled?"checked":""}></label>
    <button type="button" class="btn accent block" id="next">Continue</button>`;
  if (step===3) html=`${dots}<h1>Add your first pieces</h1>
    <p>Start with what you wear most: two or three tops, trousers, shoes, a jacket, and your everyday jewellery. Pick several photos at once and tag them one after another.</p>
    <button type="button" class="btn primary block" id="obLib">Pick photos</button>
    <button type="button" class="btn block" id="obCam">Take a photo</button>
    <button type="button" class="btn quiet block" id="done">Look around first</button>`;
  const p=openSheet(html,{full:true});
  const go=n=>onboarding(n);
  const nx=p.querySelector("#next"); if (nx) nx.onclick=()=>go(step+1);
  const n2=p.querySelector("#next2"); if (n2) n2.onclick=()=>go(step+1);
  const g=p.querySelector("#gps"); if (g) g.onclick=async()=>{ if (await useGPS()) go(2); };
  const sr=p.querySelector("#search"); if (sr) sr.onclick=()=>{ locationSheet(); const back=new MutationObserver(()=>{ if ($("#sheet").hidden){ back.disconnect(); go(S.loc?2:1); } }); back.observe($("#sheet"),{attributes:true,attributeFilter:["hidden"]}); };
  p.querySelectorAll("[data-ob-hw]").forEach(b=>b.onclick=()=>{ S.settings.headwear=b.getAttribute("data-ob-hw"); saveSettings(); p.querySelectorAll("[data-ob-hw]").forEach(x=>x.setAttribute("aria-pressed",String(x===b))); });
  const sk=p.querySelector("#obSkinny"); if (sk) sk.onchange=e=>{ S.settings.avoidSkinny=e.target.checked; saveSettings(); };
  const oh=p.querySelector("#obH"); if (oh) oh.oninput=e=>{ S.profile.height=e.target.value; saveProfile(); };
  const oj=p.querySelector("#obJ"); if (oj) oj.oninput=e=>{ S.profile.jewelry=e.target.value; saveProfile(); };
  const oa=p.querySelector("#obAI"); if (oa) oa.onchange=e=>{ if (e.target.checked) enableAI(); else { S.settings.aiEnabled=false; saveSettings(); } };
  const finish=async()=>{ S.onboarded=true; await kvSet("onboarded",true); closeSheet(); render(); };
  const ol=p.querySelector("#obLib"); if (ol) ol.onclick=async()=>{ await finish(); $("#fileLib").click(); };
  const oc=p.querySelector("#obCam"); if (oc) oc.onclick=async()=>{ await finish(); $("#fileCam").click(); };
  const dn=p.querySelector("#done"); if (dn) dn.onclick=finish;
}

/* ================= boot ================= */
document.querySelectorAll("nav.tabs button").forEach(b=>b.onclick=()=>setTab(b.dataset.tab));
window.addEventListener("online", ()=>fetchWeather());
document.addEventListener("visibilitychange", ()=>{ if (document.visibilityState==="visible"&&S.ready){ fetchWeather(); if (S.tab==="today"&&$("#sheet").hidden) render(); } });
window.addEventListener("popstate", ()=>{ if (!$("#sheet").hidden){ const wasOnboarding=!S.onboarded; closeSheet(); if (wasOnboarding){ S.onboarded=true; kvSet("onboarded",true); } } });
render();
(async()=>{
  try{
    const [items,settings,profile,loc,weather,history,saved,dismissed,onboarded,diary,taste]=await Promise.all(
      [itemsAll(),kvGet("settings"),kvGet("profile"),kvGet("loc"),kvGet("weather"),kvGet("history"),kvGet("saved"),kvGet("dismissed"),kvGet("onboarded"),diaryAll(),kvGet("taste")]);
    S.items=(items||[]).map(i=>({styles:[],pinned:false,inWash:false,wearCount:0,added:0,...i}));
    S.settings={...DEFAULT_SETTINGS,...(settings||{})}; S.profile={...DEFAULT_PROFILE,...(profile||{})};
    S.loc=loc||null; S.weather=weather||null; S.history=history||{wear:[],pairs:{}}; S.saved=saved||[]; S.dismissed=dismissed||[]; S.onboarded=!!onboarded;
    S.diary=diary||[]; S.taste=taste||{w:{},n:0};
  }catch{ toast("This browser blocked storage, so nothing will be saved. Open Daily Fit as an installed app."); }
  applyTheme();
  const h=location.hash.slice(1); if (["today","closet","shop","settings"].includes(h)) { S.tab=h; document.querySelectorAll("nav.tabs button").forEach(b=>b.setAttribute("aria-current",String(b.dataset.tab===h))); }
  S.ready=true; render();
  if (!S.onboarded) onboarding(0);
  fetchWeather();
  if (S.settings.aiEnabled && AI) AI.load().then(afterAILoad).catch(()=>{});
  if (navigator.storage&&navigator.storage.persist) navigator.storage.persist().catch(()=>{});
  if ("serviceWorker" in navigator && location.protocol!=="file:") navigator.serviceWorker.register("sw.js").catch(()=>{});
  window.__df = S; /* for debugging and tests */
})();
})();
