/* Daily Fit 6 — standalone wardrobe app. Everything is stored on this device (IndexedDB).
   Network: free Open-Meteo forecast + city search, and a one-time download of the on-device AI. */
(() => {
"use strict";
const D = window.DF_DATA, AI = window.DFAI, COL = window.DFColor, ART = window.DFArt;

/* ================= constants ================= */
const CATS = [
  {k:"top",n:"Top"},{k:"layer",n:"Layer"},{k:"outer",n:"Outerwear"},{k:"bottom",n:"Bottom"},{k:"shoes",n:"Shoes"},
  {k:"hat",n:"Headwear"},{k:"gloves",n:"Gloves"},{k:"jewelry",n:"Jewellery"},{k:"acc",n:"Bag & more"}
];
const CATN = Object.fromEntries(CATS.map(c=>[c.k,c.n]));
const CORE = ["top","bottom","shoes"];
const CLOTH = ["outer","layer","top","bottom","shoes","hat","gloves"];
const EXTRA = ["bag","eyes","belt","neck","wrist","hand","ear"];
const SLOTS = [...CLOTH, ...EXTRA];
const SLOT_LABEL = {outer:"Outer",layer:"Layer",top:"Top",bottom:"Bottom",shoes:"Shoes",hat:"Head",gloves:"Hands",bag:"Bag",eyes:"Sunglasses",belt:"Belt",neck:"Neck",wrist:"Wrist",hand:"Rings",ear:"Ears"};
const SUBS = {
  hat:[["cap","Cap"],["skullcap","Skull cap"],["beanie","Beanie"],["balaclava","Balaclava"],["bucket","Bucket hat"]],
  jewelry:[["chain","Chain"],["pendant","Pendant"],["ring","Ring"],["bracelet","Bracelet"],["watch","Watch"],["earring","Earring"]],
  acc:[["bag","Bag"],["sunglasses","Sunglasses"],["belt","Belt"]],
  shoes:[["sneaker","Sneakers"],["boot","Boots"],["dress","Loafers / dress"],["open","Sandals / slides"]]
};
const JZONE = {chain:"neck",pendant:"neck",ring:"hand",bracelet:"wrist",watch:"wrist",earring:"ear"};
const ACCSLOT = {bag:"bag",sunglasses:"eyes",belt:"belt"};
const METALS = [["silver","Silver"],["gold","Gold"],["mixed","Mixed"]];
const METAL_HEX = {silver:"#C3C7CC", gold:"#C9A54B", mixed:"#B8AE96", other:"#8A8A8A"};
const FIT = {slim:"Slim", regular:"Regular", relaxed:"Relaxed", wide:"Wide"};
const FORM = ["", "Casual", "Smart", "Dressy"];
/* what each recognised garment type implies (so the AI never guesses these separately) */
const KIND = {
  "t-shirt":{w:1,f:1},"polo shirt":{w:1,f:2},"button-up shirt":{w:1,f:2},"flannel shirt":{w:2,f:1},"tank top":{w:1,f:1},
  "hoodie":{w:2,f:1},"sweatshirt":{w:2,f:1},"crewneck sweatshirt":{w:2,f:1},"knit sweater":{w:2,f:2},"jumper":{w:2,f:1},"cardigan":{w:2,f:2},"fleece pullover":{w:2,f:1},"quarter-zip sweater":{w:2,f:2},
  "jacket":{w:2,f:1},"zip-up track jacket":{w:1,f:1},"bomber jacket":{w:2,f:1},"puffer jacket":{w:3,f:1},"denim jacket":{w:2,f:1},"leather jacket":{w:2,f:2},"windbreaker":{w:1,f:1},"coat":{w:3,f:2},"parka":{w:3,f:1},"blazer":{w:2,f:3},"gilet vest":{w:2,f:1},
  "jeans":{w:2,f:1},"trousers":{w:2,f:2},"cargo pants":{w:2,f:1},"track pants":{w:2,f:1},"sweatpants":{w:2,f:1},"shorts":{w:1,f:1},"chinos":{w:2,f:2},
  "sneakers":{f:1,sub:"sneaker"},"running shoes":{f:1,sub:"sneaker"},"boots":{f:2,sub:"boot"},"loafers":{f:2,sub:"dress"},"dress shoes":{f:3,sub:"dress"},"sandals":{f:1,sub:"open"},"flip flops":{f:1,sub:"open"},"slides":{f:1,sub:"open"},
  "baseball cap":{sub:"cap",w:1},"beanie":{sub:"beanie",w:2},"bucket hat":{sub:"bucket",w:1},"balaclava":{sub:"balaclava",w:3},"gloves":{w:2},
  "necklace":{sub:"pendant"},"chain necklace":{sub:"chain"},"ring":{sub:"ring"},"bracelet":{sub:"bracelet"},"wristwatch":{sub:"watch"},"earring":{sub:"earring"},
  "backpack":{sub:"bag"},"crossbody bag":{sub:"bag"},"tote bag":{sub:"bag"},"sunglasses":{sub:"sunglasses"},"belt":{sub:"belt"}
};
const RATE_TAGS=["Felt sharp","Comfy","Got compliments","Too warm","Too cold","Not me"];
const DEFAULT_SETTINGS = {avoidRepeatDays:3, headwear:"auto", gloves:"auto", jewelry:"auto", avoidSkinny:true,
  outStart:9, outEnd:22, manual:false, manualTemp:15, manualRain:false, units:"C", theme:"system", region:"auto", thermal:0, aiEnabled:false};
const DEFAULT_PROFILE = {name:""};

const S = {
  items:[], settings:{...DEFAULT_SETTINGS}, profile:{...DEFAULT_PROFILE}, loc:null, weather:null,
  history:{wear:[], pairs:{}}, saved:[], dismissed:[], photos:[], taste:{w:{}, n:0}, plan:null, colorReview:[], onboarded:false,
  tab:"today", day:0, closetView:"pieces", filter:"all", query:"", sort:"new",
  feed:null, shuffle:0, closetV:0, locks:{}, wxState:"idle", ready:false, queue:[], presets:null,
  styleVec:null, aiBusy:false, gapCache:null
};

/* ================= storage (IndexedDB) ================= */
let dbp=null;
function idb(){ if (dbp) return dbp; dbp=new Promise((res,rej)=>{ const r=indexedDB.open("dailyfit",2);
  r.onupgradeneeded=()=>{ const db=r.result; if (!db.objectStoreNames.contains("items")) db.createObjectStore("items",{keyPath:"id"}); if (!db.objectStoreNames.contains("kv")) db.createObjectStore("kv"); if (!db.objectStoreNames.contains("diary")) db.createObjectStore("diary",{keyPath:"id"}); };
  r.onsuccess=()=>res(r.result); r.onerror=()=>rej(r.error); }); return dbp; }
async function tx(store,mode,fn){ const db=await idb(); return new Promise((res,rej)=>{ const t=db.transaction(store,mode); const out=fn(t.objectStore(store)); t.oncomplete=()=>res(out&&"result" in out?out.result:undefined); t.onerror=()=>rej(t.error); t.onabort=()=>rej(t.error); }); }
const itemsAll=()=>tx("items","readonly",s=>s.getAll());
const itemPut=it=>tx("items","readwrite",s=>s.put(it));
const itemsPut=l=>tx("items","readwrite",s=>{ l.forEach(i=>s.put(i)); });
const itemDel=id=>tx("items","readwrite",s=>s.delete(id));
const photosAll=()=>tx("diary","readonly",s=>s.getAll());
const photoPut=e=>tx("diary","readwrite",s=>s.put(e));
const photoDel=id=>tx("diary","readwrite",s=>s.delete(id));
const kvGet=k=>tx("kv","readonly",s=>s.get(k));
const kvSet=(k,v)=>tx("kv","readwrite",s=>s.put(v,k));
const kvClear=()=>Promise.all(["kv","items","diary"].map(n=>tx(n,"readwrite",s=>s.clear())));
function debounce(fn,ms){ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a),ms); }; }
const saveSettings=debounce(()=>kvSet("settings",S.settings).catch(storageFail),250);
const saveProfile=debounce(()=>kvSet("profile",S.profile).catch(storageFail),400);
const saveHistory=()=>kvSet("history",{wear:S.history.wear.slice(-500),pairs:trimPairs(S.history.pairs)}).catch(storageFail);
const saveTaste=debounce(()=>kvSet("taste",S.taste).catch(()=>{}),500);
function storageFail(){ toast("Couldn't save on this device. Free some space and try again."); }
function trimPairs(p){ const e=Object.entries(p); if (e.length<=800) return p; e.sort((a,b)=>Math.abs(b[1])-Math.abs(a[1])); return Object.fromEntries(e.slice(0,800)); }
function closetChanged(){ S.closetV++; S.feed=null; S.gapCache=null; }

/* ================= images ================= */
const urlCache=new Map();
function blobURL(key, blob){ if (!blob) return ""; if (typeof blob==="string") return blob; let u=urlCache.get(key); if (!u){ u=URL.createObjectURL(blob); urlCache.set(key,u); } return u; }
const thumbURL=it=>blobURL(it.id+":t", it.thumb||it.cut||it.photo);
const bigURL=it=>blobURL(it.id+(it.cut&&!it.useOriginal?":c":":p"), it.cut&&!it.useOriginal?it.cut:(it.photo||it.thumb));
function dropURLs(id){ for (const k of [":t",":c",":p"]) { const u=urlCache.get(id+k); if (u){ URL.revokeObjectURL(u); urlCache.delete(id+k); } } }
function loadImage(f){ return new Promise((res,rej)=>{ const im=new Image(); im.onload=()=>res(im); im.onerror=rej; im.src=URL.createObjectURL(f); }); }
function canvasFrom(src,max){ const w=src.naturalWidth||src.width, h=src.naturalHeight||src.height, r=Math.min(1,max/Math.max(w,h)), c=document.createElement("canvas");
  c.width=Math.max(1,Math.round(w*r)); c.height=Math.max(1,Math.round(h*r)); c.getContext("2d").drawImage(src,0,0,c.width,c.height); return c; }
const toBlob=(c,type="image/jpeg",q=.84)=>new Promise(res=>c.toBlob(b=>res(b),type,q));
async function cutBlob(c,max){ const s=canvasFrom(c,max); let b=await toBlob(s,"image/webp",.86); if (!b||b.type!=="image/webp") b=await toBlob(s,"image/png"); return b; }
function onWhite(c){ const o=document.createElement("canvas"); o.width=c.width; o.height=c.height; const x=o.getContext("2d"); x.fillStyle="#fff"; x.fillRect(0,0,o.width,o.height); x.drawImage(c,0,0); return o; }
function pixelsOf(src,max=240){ const c=canvasFrom(src,max), x=c.getContext("2d",{willReadFrequently:true}); return {data:x.getImageData(0,0,c.width,c.height).data, w:c.width, h:c.height}; }

/* ================= colour ================= */
const NEUTRAL=new Set(["black","dark grey","grey","light grey","white","cream","beige","khaki","brown","olive","navy","denim"]);
const COOL=new Set(["black","dark grey","grey","light grey","white","navy","denim"]);
const EARTH=new Set(["brown","olive","beige","khaki","cream"]);
const FAMILY={"dark grey":"grey","light grey":"grey",cream:"white",khaki:"beige",navy:"blue",denim:"blue",burgundy:"red"};
const fam=n=>FAMILY[n]||n;
function cname(it){ if (it.cat==="jewelry") return it.metal==="gold"?"yellow":"light grey"; return it.colorName||COL.nameHex(it.color||"#808080"); }
function hexOf(it){ return it.cat==="jewelry" ? (METAL_HEX[it.metal]||METAL_HEX.other) : (it.color||COL.CANON[it.colorName]||"#888"); }
function hexToHsl(hex){ const n=parseInt((hex||"#808080").slice(1),16); let r=(n>>16&255)/255,g=(n>>8&255)/255,b=(n&255)/255; const mx=Math.max(r,g,b),mn=Math.min(r,g,b); let h=0,s=0; const l=(mx+mn)/2;
  if (mx!==mn){ const d=mx-mn; s=l>.5?d/(2-mx-mn):d/(mx+mn); h=mx===r?(g-b)/d+(g<b?6:0):mx===g?(b-r)/d+2:(r-g)/d+4; h*=60; } return {h,s,l}; }
const hueDist=(a,b)=>{ const d=Math.abs(a-b)%360; return d>180?360-d:d; };
const lightness=it=>COL.rgbToLab(...[0,1,2].map(i=>parseInt(hexOf(it).slice(1+2*i,3+2*i),16)))[0];
/* fuse what the pixels say with what the AI sees; pixels win unless the AI is clearly sure */
function fuseColor(px, probs){
  if (!probs) return {name:px.name, hex:px.hex};
  const cand=new Set([px.name, px.second&&px.second.name, ...Object.entries(probs).sort((a,b)=>b[1]-a[1]).slice(0,2).map(x=>x[0])].filter(Boolean));
  let best=null;
  const lab=COL.rgbToLab(...[1,3,5].map(i=>parseInt(px.hex.slice(i,i+2),16))), grey=Math.hypot(lab[1],lab[2])<4, ACH=new Set(["black","dark grey","grey","light grey","white"]);
  for (const n of cand){ if (grey&&!ACH.has(n)) continue; const pw=n===px.name?px.share:(px.second&&n===px.second.name?px.second.share:0);
    const s=Math.log(pw+.08)+.8*Math.log((probs[n]||0)+.004); if (!best||s>best.s) best={n,s}; }
  if (!best) return {name:px.name, hex:px.hex};
  return {name:best.n, hex: best.n===px.name?px.hex:COL.CANON[best.n]};
}

/* ================= location & weather ================= */
const ALL_CITIES=Object.entries(D.regions).flatMap(([code,r])=>r.cities.map(c=>({...c,region:code})));
function km(a,b){ const R=6371,t=x=>x*Math.PI/180,dA=t(b.lat-a.lat),dO=t(b.lon-a.lon); const h=Math.sin(dA/2)**2+Math.cos(t(a.lat))*Math.cos(t(b.lat))*Math.sin(dO/2)**2; return 2*R*Math.asin(Math.sqrt(h)); }
function nearestCity(l){ let b=null; for (const c of ALL_CITIES){ const d=km(l,c); if (!b||d<b.d) b={...c,d}; } return b; }
function regionCode(){ if (S.settings.region!=="auto") return S.settings.region; const l=S.loc; if (!l) return "GLOBAL";
  if (l.country&&D.regions[l.country]) return l.country; if (l.lat!=null){ const n=nearestCity(l); if (n&&n.d<500) return n.region; } return "GLOBAL"; }
const region=()=>D.regions[regionCode()]||D.regions.GLOBAL;
function fetchT(url,ms=12000){ const c=new AbortController(); const t=setTimeout(()=>c.abort(),ms); return fetch(url,{signal:c.signal}).finally(()=>clearTimeout(t)); }
async function useGPS(){
  if (!("geolocation" in navigator)){ toast("This device can't share its location. Search for your city instead."); return false; }
  toast("Finding your location…");
  try{ const pos=await new Promise((res,rej)=>navigator.geolocation.getCurrentPosition(res,rej,{timeout:15000,maximumAge:6e5}));
    const loc={lat:+pos.coords.latitude.toFixed(4),lon:+pos.coords.longitude.toFixed(4),source:"gps"}; const n=nearestCity(loc);
    loc.name=n&&n.d<40?n.name:"Current location"; loc.country=n&&n.d<500?n.region:null; await setLocation(loc); toast("Location set: "+loc.name); return true;
  }catch(e){ toast(e&&e.code===1?"Location permission was denied. Search for your city instead.":"Couldn't get your location. Search for your city instead."); return false; }
}
async function setLocation(loc){ S.loc=loc; await kvSet("loc",loc); S.weather=null; await kvSet("weather",null); S.feed=null; S.gapCache=null; fetchWeather(true); render(); }
async function searchCities(q){ const r=await fetchT(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=8&language=en&format=json`); const j=await r.json();
  return (j.results||[]).map(x=>({name:x.name,admin:x.admin1||"",countryName:x.country||"",country:x.country_code,lat:x.latitude,lon:x.longitude})); }
const WMO={0:"Clear",1:"Mostly clear",2:"Partly cloudy",3:"Overcast",45:"Fog",48:"Fog",51:"Drizzle",53:"Drizzle",55:"Drizzle",56:"Freezing drizzle",57:"Freezing drizzle",61:"Rain",63:"Rain",65:"Heavy rain",66:"Freezing rain",67:"Freezing rain",71:"Snow",73:"Snow",75:"Heavy snow",77:"Snow",80:"Showers",81:"Showers",82:"Heavy showers",85:"Snow showers",86:"Snow showers",95:"Thunderstorm",96:"Thunderstorm",99:"Thunderstorm"};
const isWet=c=>(c>=51&&c<=67)||(c>=80&&c<=82)||c>=95, isSnow=c=>(c>=71&&c<=77)||c===85||c===86;
async function fetchWeather(force=false){
  if (!S.loc||S.loc.lat==null) return;
  const age=S.weather?(Date.now()-S.weather.fetchedAt)/6e4:Infinity; if (!force&&age<45) return;
  if (!navigator.onLine){ S.wxState="offline"; render(); return; }
  S.wxState="loading"; if (S.tab==="today") render();
  const u=`https://api.open-meteo.com/v1/forecast?latitude=${S.loc.lat}&longitude=${S.loc.lon}&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m&hourly=temperature_2m,apparent_temperature,precipitation_probability,weather_code,wind_speed_10m&timezone=auto&forecast_days=3`;
  for (let a=0;a<2;a++){ try{ const r=await fetchT(u); if (!r.ok) throw 0; const d=await r.json();
      S.weather={fetchedAt:Date.now(),utcOffset:d.utc_offset_seconds,current:d.current,hours:d.hourly.time.map((t,i)=>({t,feels:d.hourly.apparent_temperature[i],pop:d.hourly.precipitation_probability[i]||0,code:d.hourly.weather_code[i],wind:d.hourly.wind_speed_10m[i]||0}))};
      await kvSet("weather",S.weather); S.wxState="ok"; S.feed=null; render(); return; }catch{ await new Promise(r=>setTimeout(r,1200)); } }
  S.wxState="error"; render();
}
function locNowKey(){ const off=(S.weather&&S.weather.utcOffset)??(-new Date().getTimezoneOffset()*60); return new Date(Date.now()+off*1000).toISOString().slice(0,13); }
function dateKey(day=0){ const now=locNowKey(); const d=new Date(now.slice(0,10)+"T12:00:00Z"); d.setUTCDate(d.getUTCDate()+day); return d.toISOString().slice(0,10); }
function conditions(day=S.day){
  const st=S.settings, w=S.weather, age=w?(Date.now()-w.fetchedAt)/36e5:Infinity;
  if (st.manual||!w||age>30) return {source:st.manual?"manual":"none", temp:st.manualTemp, low:st.manualTemp, high:st.manualTemp, wet:st.manualRain, snow:false, sunny:!st.manualRain, wind:0, label:"", hours:[], window:[], day};
  const now=locNowKey(), dk=dateKey(day), nowH=+now.slice(11,13), start=day===0?Math.max(nowH,st.outStart):st.outStart;
  const dayHours=w.hours.filter(h=>h.t.slice(0,10)===dk);
  let win=dayHours.filter(h=>+h.t.slice(11,13)>=start&&+h.t.slice(11,13)<=st.outEnd), late=false;
  if (!win.length&&day===0){ late=true; win=w.hours.filter(h=>h.t.slice(0,13)>=now).slice(0,4); }
  if (!win.length) win=dayHours.length?dayHours:[{t:now,feels:w.current.apparent_temperature,pop:0,code:w.current.weather_code,wind:0}];
  const f=win.map(h=>h.feels), low=Math.round(Math.min(...f)), high=Math.round(Math.max(...f));
  const codes=win.map(h=>h.code), mode=codes.sort((a,b)=>codes.filter(x=>x===b).length-codes.filter(x=>x===a).length)[0];
  const dayWin=win.filter(h=>{ const hh=+h.t.slice(11,13); return hh>=9&&hh<=17; });
  return {source:"forecast", day, temp:low, low, high, late,
    wet:win.some(h=>h.pop>=50||isWet(h.code)), snow:win.some(h=>isSnow(h.code)),
    sunny:dayWin.length>=2&&dayWin.filter(h=>h.code<=2).length>=dayWin.length*.6,
    wind:Math.max(...win.map(h=>h.wind||0)), label:day===0?(WMO[w.current.weather_code]||""):(WMO[mode]||""),
    nowFeels:day===0?Math.round(w.current.apparent_temperature):high,
    hours:(day===0?w.hours.filter(h=>h.t.slice(0,13)>=now):dayHours.filter(h=>+h.t.slice(11,13)>=6)).slice(0,18), window:win.map(h=>h.t)};
}
const deg=c=>S.settings.units==="F"?Math.round(c*9/5+32)+"°":Math.round(c)+"°";

/* ================= learned taste ================= */
const sigmoid=x=>1/(1+Math.exp(-x));
const tasteDot=f=>{ let s=0; for (const k of f) s+=S.taste.w[k]||0; return s; };
function learn(f,y,weight=1){ if (!f||!f.length) return; const g=.18*weight*(y-sigmoid(tasteDot(f))); for (const k of f) S.taste.w[k]=Math.max(-4,Math.min(4,(S.taste.w[k]||0)+g)); S.taste.n+=weight; saveTaste(); }
const tasteFactor=()=>Math.min(1,S.taste.n/30);
const FEAT_TEXT={"harm:none":"neutral palettes","harm:accent":"one colour accent","harm:analog":"matching colours","harm:compl":"loud colour combos","harm:clash":"clashing colours","harm:allblack":"all black",
  "prop:relaxed":"relaxed fits","prop:full":"oversized top and bottom","prop:fitloose":"fitted top, loose leg","prop:slim":"slim bottoms","prop:other":"regular fits",
  "hat":"headwear","gloves":"gloves","bag":"a bag","metal:mixed":"mixing metals"};
function featText(k){ if (FEAT_TEXT[k]) return FEAT_TEXT[k]; const [a,b]=k.split(":"); if (a==="up") return b+" up top"; if (a==="low") return b+" bottoms"; if (a==="kind") return b+"s";
  if (a==="layers") return b+" layers"; if (a==="jewel") return b==="0"?"no jewellery":"jewellery"; return k; }

/* ================= outfit engine ================= */
function mulberry(seed){ let a=seed>>>0; return ()=>{ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
const hashStr=s=>{ let h=2166136261; for (let i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619); } return h>>>0; };
const cap=x=>x?x.charAt(0).toUpperCase()+x.slice(1):"";
const avail=()=>S.items.filter(i=>!i.inWash);
const byCat=(k,l=avail())=>l.filter(i=>i.cat===k);
function slotOf(it){ if (it.cat==="jewelry") return JZONE[it.sub]||"neck"; if (it.cat==="acc") return ACCSLOT[it.sub]||"bag"; return it.cat; }
const pairKey=(a,b)=>a<b?a+"|"+b:b+"|"+a;
const effTemp=c=>c.temp-(S.settings.thermal||0);
const wearOf=o=>CLOTH.map(k=>o[k]).filter(Boolean);
const clothesOf=o=>["top","layer","outer","bottom"].map(k=>o[k]).filter(Boolean);
const jewelOf=o=>["neck","wrist","hand","ear"].map(k=>o[k]).filter(Boolean);
const partsOf=o=>SLOTS.map(k=>o[k]).filter(Boolean);
const keyOf=o=>SLOTS.map(k=>o[k]?o[k].id:"-").join(",");
function recentlyWorn(){ const cut=Date.now()-S.settings.avoidRepeatDays*864e5, s=new Set(); for (const w of S.history.wear) if (w.t>=cut) w.ids.forEach(id=>s.add(id)); return s; }
function weatherPlan(c){
  const t=effTemp(c), wet=c.wet||c.snow; let p;
  if (t>=25) p={top:[1],layer:"none",outer:wet?"optional":"none",bottom:[1,2],note:"Hot. Light fabrics, one layer."};
  else if (t>=19) p={top:[1,2],layer:"none",outer:wet?"want":"none",bottom:[1,2],note:"Mild. One layer, maybe a light jacket."};
  else if (t>=13) p={top:[1,2],layer:"optional",outer:"one",outerW:[1,2],bottom:[1,2,3],note:"Cool. Add a layer or a light jacket."};
  else if (t>=6) p={top:[1,2,3],layer:"optional",outer:"need",outerW:[2,3],bottom:[2,3],note:"Cold. A real jacket."};
  else if (t>=1) p={top:[1,2,3],layer:"need",outer:"need",outerW:[2,3],bottom:[2,3],note:"Very cold. A warm jacket over a layer."};
  else p={top:[1,2,3],layer:"need",outer:"need",outerW:[3],bottom:[2,3],note:"Freezing. Heavy coat over a layer."};
  p.t=t; p.wet=wet; p.sunny=c.sunny;
  p.hatOK=h=>{ const s=h.sub||"beanie"; if (s==="balaclava") return t<=2; if (s==="beanie") return t<=((h.warmth||2)>=3?8:14); if (s==="skullcap") return t<=20; return true; };
  const hw=S.settings.headwear; p.hat=hw==="never"?"none":hw==="always"?"need":(t<=8||(c.wind>25&&t<=12))?"need":(wet&&t>8)?"want":"optional";
  const gl=S.settings.gloves; p.gloves=gl==="never"?"none":gl==="always"?"need":t<=3?"need":t<=7?"optional":"none";
  p.jewel=S.settings.jewelry==="never"?[0,0]:[1,2];
  if (c.source==="forecast"&&c.high-c.low>=7) p.note+=` It swings from ${deg(c.low)} to ${deg(c.high)}, so wear a layer you can take off.`;
  return p;
}
function pools(c,p,extra=[]){
  const all=[...avail(),...extra], ok=(i,ws)=>!ws||ws.includes(i.warmth||2), cat=k=>all.filter(i=>i.cat===k);
  let hats=cat("hat").filter(p.hatOK); if (S.settings.headwear==="always"&&!hats.length) hats=cat("hat");
  const shoes=cat("shoes").filter(s=>s.sub!=="open"||(p.t>=20&&!p.wet));
  const z=s=>cat("jewelry").filter(i=>(JZONE[i.sub]||"neck")===s), a=s=>cat("acc").filter(i=>(i.sub||"bag")===s);
  return {top:cat("top").filter(i=>ok(i,p.top)), bottom:cat("bottom").filter(i=>ok(i,p.bottom)), shoes, layer:cat("layer"), outer:cat("outer").filter(i=>ok(i,p.outerW)),
    hat:hats, gloves:cat("gloves"), bag:a("bag"), eyes:p.sunny?a("sunglasses"):[], belt:a("belt"), neck:z("neck"), wrist:z("wrist"), hand:z("hand"), ear:z("ear")};
}
function buildOutfit(P,p,L,rnd,force){
  const pick=a=>a[Math.floor(rnd()*a.length)];
  const F=force?{[force.slot]:force.item}:{};
  const get=(slot)=>F[slot]||L[slot];
  const o={top:get("top")||pick(P.top), bottom:get("bottom")||pick(P.bottom), shoes:get("shoes")||pick(P.shoes)};
  if (!o.top||!o.bottom||!o.shoes) return null;
  if (get("layer")) o.layer=get("layer"); else if (P.layer.length&&(p.layer==="need"||(p.layer==="optional"&&rnd()<.5))) o.layer=pick(P.layer);
  if (get("outer")) o.outer=get("outer"); else if (P.outer.length&&(p.outer==="need"||p.outer==="want"||(p.outer==="one"&&(!o.layer||rnd()<.4))||(p.outer==="optional"&&rnd()<.3))) o.outer=pick(P.outer);
  if (p.outer==="one"&&!o.layer&&!o.outer&&P.layer.length) o.layer=pick(P.layer);
  const pinHat=P.hat.filter(h=>h.pinned);
  if (get("hat")) o.hat=get("hat"); else if (P.hat.length&&p.hat!=="none"&&(p.hat==="need"||(p.hat==="want"&&rnd()<.8)||(p.hat==="optional"&&(pinHat.length||rnd()<.35)))) o.hat=pinHat.length&&rnd()<.85?pick(pinHat):pick(P.hat);
  if (get("gloves")) o.gloves=get("gloves"); else if (P.gloves.length&&(p.gloves==="need"||(p.gloves==="optional"&&rnd()<.35))) o.gloves=pick(P.gloves);
  const pinBag=P.bag.filter(b=>b.pinned);
  if (get("bag")) o.bag=get("bag"); else if (P.bag.length&&(pinBag.length||rnd()<.35)) o.bag=pinBag.length?pick(pinBag):pick(P.bag);
  if (get("eyes")) o.eyes=get("eyes"); else if (P.eyes.length&&rnd()<.75) o.eyes=pick(P.eyes);
  if (get("belt")) o.belt=get("belt"); else if (P.belt.length&&wearOf(o).some(i=>(i.form||1)>=2)&&rnd()<.5) o.belt=pick(P.belt);
  for (const z of ["neck","wrist","hand","ear"]) if (get(z)) o[z]=get(z);
  const [lo,hi]=p.jewel;
  if (hi>0){ const zones=["neck","wrist","hand","ear"].filter(z=>P[z].length&&!(z==="hand"&&o.gloves));
    for (const z of zones){ const pin=P[z].filter(j=>j.pinned); if (pin.length&&!o[z]&&jewelOf(o).length<hi) o[z]=pick(pin); }
    const k=lo+Math.floor(rnd()*(hi-lo+1)); for (const z of zones.sort(()=>rnd()-.5)){ if (jewelOf(o).length>=k) break; if (!o[z]) o[z]=pick(P[z]); } }
  if (force && o[force.slot]!==force.item) return null;
  return o;
}
function hueCount(parts){ const hues=[]; for (const c of parts){ if (NEUTRAL.has(cname(c))) continue; const h=hexToHsl(hexOf(c)).h; if (!hues.some(x=>hueDist(x,h)<25)) hues.push(h); } return hues; }
const activeSignals=()=>{ const rc=regionCode(); return D.signals.filter(s=>s.regions.includes("all")||s.regions.includes(rc)); };
function trendHits(o){
  const all=[...wearOf(o),...jewelOf(o)], hits=[];
  for (const s of activeSignals()){ const m=s.match; let ok=true;
    if (m.layersMin&&[o.top,o.layer,o.outer].filter(Boolean).length<m.layersMin) ok=false;
    if (ok&&m.accessory&&!(o.hat||o.gloves||jewelOf(o).length||o.bag)) ok=false;
    if (ok&&m.accentOne) ok=all.some(i=>cname(i)==="black")&&hueCount(wearOf(o)).length===1;
    else if (ok&&(m.cats||m.kinds||m.colors||m.fits||m.subs)) ok=all.some(i=>(!m.cats||m.cats.includes(i.cat))&&(!m.kinds||m.kinds.includes(i.kind))&&(!m.colors||m.colors.includes(cname(i)))&&(!m.fits||m.fits.includes(i.fit))&&(!m.subs||m.subs.includes(i.sub)));
    if (ok) hits.push(s); }
  return hits;
}
let closetBase={style:null};
function avgSim(parts,vec){ const e=parts.filter(p=>p.emb); if (!e.length||!vec) return null; return e.reduce((a,p)=>a+AI.cos(p.emb,vec),0)/e.length; }
function scoreOutfit(o,ctx={}){
  const why=[], tags=[], f=[]; let s=0;
  const wear=wearOf(o), jew=jewelOf(o), parts=partsOf(o), upper=o.outer||o.layer||o.top;
  /* colour */
  const names=wear.map(cname), hues=hueCount(wear), blacks=names.filter(n=>n==="black").length;
  if (!hues.length){ if (blacks>=3){ s+=2.7; f.push("harm:allblack"); why.push("All black"); }
    else { const d=Math.abs(lightness(upper)-lightness(o.bottom)); s+=d>25?2.6:2.2; f.push("harm:none"); why.push(d>25?"Neutrals with light/dark contrast":"Tonal neutrals"); } }
  else if (hues.length===1){ s+=3; f.push("harm:accent"); const acc=wear.find(i=>!NEUTRAL.has(cname(i))); why.push(cap(cname(acc))+" as the one colour"); }
  else if (hues.length===2){ const d=hueDist(hues[0],hues[1]); if (d<=40){ s+=2.5; f.push("harm:analog"); why.push("Matching colours"); } else if (d>=150){ s+=1.9; f.push("harm:compl"); why.push("Bold colour contrast"); } else { s+=.7; f.push("harm:clash"); } }
  else { s+=.3; f.push("harm:clash"); }
  /* proportions */
  const uf=upper.fit||"regular", bf=o.bottom.fit||"regular";
  if (bf==="slim"){ s+=S.settings.avoidSkinny?.4:1.2; f.push("prop:slim"); }
  else if ((uf==="relaxed"||uf==="wide")&&(bf==="relaxed"||bf==="wide")){ const full=uf==="wide"&&bf==="wide"; s+=full?1.6:1.9; f.push(full?"prop:full":"prop:relaxed"); why.push(full?"Oversized all the way":"Relaxed proportions"); }
  else if (uf==="slim"&&(bf==="wide"||bf==="relaxed")){ s+=1.8; f.push("prop:fitloose"); why.push("Fitted top, loose leg"); }
  else { s+=1.6; f.push("prop:other"); }
  /* dressiness hangs together */
  const fs=wear.map(i=>i.form||1), spread=Math.max(...fs)-Math.min(...fs); s+=spread>1?-1.2:spread===1?-.15:.3;
  /* weather details */
  if (o.layer&&effTemp(ctx.c||{temp:15})>=17) s-=.4;
  if (o.shoes.sub==="boot"&&ctx.p&&(ctx.p.wet||ctx.p.t<3)) s+=.4;
  if (o.shoes.sub==="dress"&&ctx.p&&ctx.p.wet) s-=.3;
  /* jewellery */
  const metals=new Set(jew.map(j=>j.metal||"other"));
  if (metals.has("silver")&&metals.has("gold")&&!metals.has("mixed")){ s-=.6; f.push("metal:mixed"); }
  if (jew.some(j=>j.metal==="silver")&&COOL.has(cname(upper))){ s+=.3; tags.push({t:"Silver pops on "+cname(upper),c:"silver"}); }
  f.push("jewel:"+Math.min(2,jew.length));
  /* your history */
  const rec=ctx.rest||recentlyWorn(); s-=wear.filter(i=>rec.has(i.id)).length*.7;
  s+=parts.filter(i=>i.pinned).length*.5;
  let pairs=0; for (let i=0;i<parts.length;i++) for (let j=i+1;j<parts.length;j++) pairs+=S.history.pairs[pairKey(parts[i].id,parts[j].id)]||0;
  s+=Math.max(-2,Math.min(2,pairs*.25));
  for (const i of clothesOf(o)) if (i.kind) f.push("kind:"+i.kind);
  f.push("up:"+cname(upper),"low:"+cname(o.bottom),"layers:"+[o.top,o.layer,o.outer].filter(Boolean).length);
  if (o.hat) f.push("hat"); if (o.gloves) f.push("gloves"); if (o.bag) f.push("bag");
  const uf2=[...new Set(f)], tf=tasteFactor(); if (tf>0){ const d=tasteDot(uf2); s+=tf*Math.max(-1.5,Math.min(1.5,d*.5)); }
  if (S.styleVec){ const sim=avgSim(wear,S.styleVec); if (sim!=null&&closetBase.style!=null) s+=Math.max(-.6,Math.min(.9,(sim-closetBase.style)*10)); }
  const th=trendHits(o); s+=Math.min(1,th.reduce((a,h)=>a+h.strength*.2,0)); if (th[0]) tags.push({t:th[0].name,c:"trend"});
  return {score:s, why, tags:tags.slice(0,2), f:uf2};
}
function titleOf(o){
  const wear=wearOf(o), names=wear.map(cname), blacks=names.filter(n=>n==="black").length, acc=wear.find(i=>!NEUTRAL.has(cname(i)));
  const upper=o.outer||o.layer||o.top;
  let pal;
  if (blacks>=3) pal=names.every(n=>n==="black"||n==="dark grey")?"All black":"Mostly black";
  else if (acc) pal=cap(cname(acc))+" accent";
  else if (wear.filter(i=>EARTH.has(cname(i))).length>=2) pal="Earth tones";
  else if (lightness(upper)>72&&lightness(o.bottom)>60) pal="Light neutrals";
  else if (fam(cname(upper))===fam(cname(o.bottom))) pal="Tonal "+fam(cname(upper));
  else pal=cap(cname(upper))+" & "+cname(o.bottom);
  const key=o.outer||o.layer, nm=it=>{ if (it.kind) return it.kind; const sb=SUBS[it.cat]&&(SUBS[it.cat].find(x=>x[0]===it.sub)||[])[1]; if (sb&&it.cat!=="shoes") return sb.toLowerCase();
    const w=(it.name||"").toLowerCase().replace(new RegExp("\\b("+COL.NAMES.join("|")+"|dark|light|charcoal|off-white|my|the)\\b","g"),"").replace(/\s+/g," ").trim(); return (w&&w.length<=22?w:(sb||CATN[it.cat]).toLowerCase()); };
  const bf=o.bottom.fit, leg=(bf==="wide"||bf==="relaxed")&&o.bottom.kind?(bf+" "+o.bottom.kind):"";
  return pal+" · "+nm(key||o.top)+", "+(leg||nm(o.bottom));
}
function generate(c,{n=1400,seed=1,locks=S.locks,extra=[],force=null}={}){
  const p=weatherPlan(c), P=pools(c,p,extra), L={};
  for (const [slot,id] of Object.entries(locks)){ const it=S.items.find(i=>i.id===id&&!i.inWash); if (it) L[slot]=it; }
  const missing=[];
  if (!force){ if (!L.top&&!P.top.length) missing.push(`a top for ${deg(c.temp)}`); if (!L.bottom&&!P.bottom.length) missing.push(`a bottom for ${deg(c.temp)}`); if (!L.shoes&&!P.shoes.length) missing.push("shoes for this weather"); }
  const soft=[];
  if (p.outer==="need"&&!L.outer&&!P.outer.length){ const all=byCat("outer"); if (all.length){ const m=Math.max(...all.map(i=>i.warmth||2)); P.outer=all.filter(i=>(i.warmth||2)===m); soft.push(`Your warmest jacket is light for ${deg(c.temp)}. Layer up underneath.`); if (p.layer==="optional") p.layer="need"; } else soft.push(`A jacket would help at ${deg(c.temp)}. See Shop.`); }
  if (!P.top.length&&byCat("top").length) P.top=byCat("top");
  if (!P.bottom.length&&byCat("bottom").length) P.bottom=byCat("bottom");
  if (p.hat==="need"&&!P.hat.length&&!force) soft.push("A hat would help today; none in your closet suits this weather.");
  if (missing.length) return {p,missing,soft,cands:[]};
  const rnd=mulberry(seed), rest=recentlyWorn(), seen=new Set(), cands=[];
  for (let i=0;i<n;i++){ const o=buildOutfit(P,p,L,rnd,force); if (!o) continue; const k=keyOf(o); if (seen.has(k)) continue; seen.add(k);
    const r=scoreOutfit(o,{c,p,rest}); cands.push({...o,key:k,...r,score:r.score+rnd()*.25}); }
  cands.sort((a,b)=>b.score-a.score);
  return {p,missing,soft,cands};
}
const DIV_W={top:1,layer:.9,outer:1,bottom:1,shoes:.5,hat:.3,gloves:.2,bag:.2,eyes:.1,belt:.1,neck:.15,wrist:.15,hand:.15,ear:.1};
function selectDiverse(cands,k,chosen=[]){
  const use=new Map(), out=[], taken=new Set(chosen.map(c=>c.key)); for (const c of chosen) for (const s of SLOTS) if (c[s]) use.set(c[s].id,(use.get(c[s].id)||0)+1);
  let pool=cands.filter(c=>!taken.has(c.key)&&!S.feedSkipped?.has(c.key));
  while (out.length<k&&pool.length){
    let bi=-1,bv=-1e9; const lim=Math.min(pool.length,500);
    for (let i=0;i<lim;i++){ const c=pool[i]; let pen=0; for (const s of SLOTS) if (c[s]){ const n=use.get(c[s].id)||0; if (n) pen+=DIV_W[s]*n*(n>1?1.6:1); } const v=c.score-1.3*pen; if (v>bv){ bv=v; bi=i; } }
    const c=pool.splice(bi,1)[0]; out.push(c); for (const s of SLOTS) if (c[s]) use.set(c[s].id,(use.get(c[s].id)||0)+1);
  }
  return out;
}
function feed(){
  const c=conditions();
  const key=[dateKey(S.day),S.day,Math.round(effTemp(c)/2),c.wet,c.snow,c.sunny,JSON.stringify(S.locks),S.closetV,S.shuffle,S.settings.headwear,S.settings.gloves,S.settings.jewelry,S.settings.avoidSkinny,S.settings.thermal].join("|");
  if (S.feed&&S.feed.key===key) return S.feed;
  const g=generate(c,{seed:hashStr(key)});
  S.feedSkipped=new Set();
  let list=selectDiverse(g.cands,9);
  /* a planned fit for today goes first */
  if (S.plan&&S.plan.date===dateKey(S.day)){ const o=outfitFromIds(S.plan.ids); if (o.top&&o.bottom&&o.shoes&&partsOf(o).every(i=>!i.inWash)){ const r=rescore(o); r.planned=true; list=[r,...list.filter(x=>x.key!==r.key)].slice(0,9); } }
  S.feed={key,c,p:g.p,missing:g.missing,soft:g.soft,cands:g.cands,list,shown:9};
  return S.feed;
}
function moreFits(){ const F=S.feed; if (!F) return; const add=selectDiverse(F.cands,6,F.list); F.list.push(...add); render(); if (!add.length) toast("That's every good combination for today. Add pieces for more."); }
function rescore(o){ const c=conditions(); return {...o,key:keyOf(o),...scoreOutfit(o,{c,p:weatherPlan(c)})}; }
function outfitFromIds(ids){ const o={}; for (const id of ids){ const it=S.items.find(i=>i.id===id); if (!it) continue; const s=slotOf(it); if (!o[s]) o[s]=it; } return o; }

/* ================= AI glue ================= */
const aiReady=()=>!!AI&&AI.state==="ready";
async function enableAI(){ S.settings.aiEnabled=true; saveSettings(); try{ await AI.load(); await afterAILoad(); toast("Fashion AI is ready."); }catch{ toast("The AI couldn't download. Check your connection and try again under You."); } }
async function afterAILoad(){ recomputeStyle(); render(); backfill(); }
async function analyzeColor(src, isCut, emb){
  const {data,w,h}=pixelsOf(src,240); const px=COL.dominant(data,w,h,{alpha:isCut});
  let probs=null; if (aiReady()&&emb){ try{ probs=await AI.colorProbs(emb); }catch{} }
  return fuseColor(px,probs);
}
/* the whole "look at a new photo" pipeline */
async function analyzePiece(img, it, onStep){
  const photoC=canvasFrom(img,1100); it.photo=await toBlob(photoC,"image/jpeg",.85);
  let cut=null;
  if (aiReady()&&AI.canCutout){ onStep&&onStep("Cutting out the background…"); try{ cut=await AI.removeBackground(it.photo); }catch{} }
  if (cut){ it.cut=await cutBlob(cut,800); it.thumb=await cutBlob(cut,360); } else { it.thumb=await toBlob(canvasFrom(img,360),"image/jpeg",.8); }
  it.cutTried=true;
  if (aiReady()){
    onStep&&onStep("Recognising the piece…");
    it.emb=await AI.embedImage(photoC);
    const r=await AI.recognize(it.emb); it.ai=r;
    if (r.cat!=="none"){ it.cat=r.cat; it.kind=r.kind; const k=KIND[r.kind]||{};
      if (k.w&&["top","layer","outer","bottom","hat","gloves"].includes(it.cat)) it.warmth=k.w;
      if (k.f) it.form=k.f; if (k.sub) it.sub=k.sub;
      if (it.cat==="jewelry"){ const m=await AI.metal(it.emb); if (m) it.metal=m; } }
  }
  const col=await analyzeColor(cut||img, !!cut, it.emb); it.color=col.hex; it.colorName=col.name;
  return it;
}
async function backfill(){
  if (!aiReady()||S.aiBusy) return; S.aiBusy=true; let changed=0;
  try{
    for (const it of S.items.filter(i=>!i.virtual)){
      let touched=false;
      if (AI.canCutout&&!it.cutTried&&(it.photo||it.thumb)){ try{ const cut=await AI.removeBackground(it.photo||it.thumb);
          if (cut){ it.cut=await cutBlob(cut,800); it.thumb=await cutBlob(cut,360); dropURLs(it.id);
            if (!it.colorUser&&it.cat!=="jewelry"){ const emb=it.emb||await AI.embedImage(it.photo||it.thumb); it.emb=emb; const col=await analyzeColor(cut,true,emb); const old=it.colorName||COL.nameHex(it.color);
              if (col.name!==old){ S.colorReview.push({id:it.id,oldHex:it.color,oldName:old}); changed++; } it.color=col.hex; it.colorName=col.name; } }
        }catch{} it.cutTried=true; touched=true; }
      if (!it.emb&&(it.photo||it.thumb)){ try{ it.emb=await AI.embedImage(it.photo||it.thumb); touched=true; }catch{} }
      if (touched){ await itemPut(it); }
    }
    for (const e of S.photos.filter(e=>!e.emb&&e.photo)){ try{ e.emb=await AI.embedImage(e.thumb||e.photo); await photoPut(e); }catch{} }
  } finally { S.aiBusy=false; }
  if (changed){ await kvSet("colorReview",S.colorReview); toast(`Cutouts done. Colours changed on ${changed} piece${changed>1?"s":""}.`,{label:"Review",fn:colorReviewSheet}); }
  closetChanged(); recomputeStyle(); render();
}
function recomputeStyle(){
  if (!AI) return;
  const good=S.history.wear.filter(w=>w.rating>=4);
  const vecs=[...good.map(w=>w.photoId&&(S.photos.find(p=>p.id===w.photoId)||{}).emb), ...good.flatMap(w=>w.ids.map(id=>(S.items.find(i=>i.id===id)||{}).emb))].filter(Boolean);
  S.styleVec=vecs.length>=2?AI.mean(vecs):null;
  const embs=S.items.filter(i=>i.emb&&CLOTH.includes(i.cat));
  closetBase.style=S.styleVec&&embs.length?embs.reduce((a,i)=>a+AI.cos(i.emb,S.styleVec),0)/embs.length:null;
}
function regionCanvas(img,y0,y1,x0=.12,x1=.88){ const W=img.naturalWidth,H=img.naturalHeight,c=document.createElement("canvas");
  const b={x:Math.round(W*x0),y:Math.round(H*y0),w:Math.max(1,Math.round(W*(x1-x0))),h:Math.max(1,Math.round(H*(y1-y0)))}; const sc=Math.min(1,448/Math.max(b.w,b.h));
  c.width=Math.max(1,Math.round(b.w*sc)); c.height=Math.max(1,Math.round(b.h*sc)); c.getContext("2d").drawImage(img,b.x,b.y,b.w,b.h,0,0,c.width,c.height); return c; }
async function readLook(img){
  const R={head:regionCanvas(img,0,.2,.25,.75),upper:regionCanvas(img,.14,.56),lower:regionCanvas(img,.5,.9,.15,.85),feet:regionCanvas(img,.84,1,.1,.9)};
  const E={}; for (const k of Object.keys(R)) E[k]=await AI.embedImage(R[k]); E.full=await AI.embedImage(img);
  const up=await AI.recognize(E.upper,["top","layer","outer"]);
  const head=await AI.recognize(E.head,["hat","none"]);
  const col=k=>{ const {data,w,h}=pixelsOf(R[k],160); return COL.dominant(data,w,h,{}).name; };
  return {E, upperCat:up.cat, upperKind:up.kind, hasHat:head.cat==="hat"&&head.conf>.6, colors:{upper:col("upper"),lower:col("lower"),feet:col("feet")}};
}
function bestMatch(cat,emb,color=null,extra=()=>true){ const c=byCat(cat).filter(i=>i.emb&&extra(i)); if (!c.length) return null;
  let b=null; for (const it of c){ const sim=AI.cos(it.emb,emb), r=sim+(color&&fam(cname(it))===fam(color)?.05:0); if (!b||r>b.r) b={it,s:sim,r}; } return b; }
const matchLabel=s=>s>=.78?"close match":s>=.68?"similar":"loose match";

/* ================= UI helpers ================= */
const $=s=>document.querySelector(s);
const esc=s=>String(s??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
const IC={
  refresh:'<svg class="icon" viewBox="0 0 24 24"><path d="M20 12a8 8 0 1 1-2.3-5.6M20 4v5h-5"/></svg>',
  spark:'<svg class="icon" viewBox="0 0 24 24"><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z"/></svg>',
  mirror:'<svg class="icon" viewBox="0 0 24 24"><rect x="6" y="3" width="12" height="18" rx="6"/><path d="M10 8l3-2M9.5 12l5-3.5"/></svg>',
  heart:'<svg class="icon" viewBox="0 0 24 24"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z"/></svg>',
  x:'<svg class="icon" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  check:'<svg class="icon" viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  plus:'<svg class="icon" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  ext:'<svg class="icon" viewBox="0 0 24 24"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>',
  cal:'<svg class="icon" viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/></svg>',
  person:'<svg class="icon" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>'
};
function phHTML(it,{badge="",big=false}={}){
  const src=big?bigURL(it):thumbURL(it), cut=!!(it.cut&&!it.useOriginal);
  return `<div class="ph${cut?" cut":""}">${src?`<img src="${esc(src)}" alt="" loading="lazy" decoding="async">`:it.virtual||!src?ART.svg(it,hexOf(it)):""}${badge}${it.inWash?'<span class="badge wash">Wash</span>':it.pinned?'<span class="badge">Pin</span>':""}</div>`;
}
const seg=(name,opts,cur,extra="")=>`<div class="seg ${extra}" role="group">${opts.map(([v,l])=>`<button type="button" data-${name}="${esc(v)}" aria-pressed="${String(v)===String(cur)}">${esc(l)}</button>`).join("")}</div>`;
const fmtDay=t=>new Date(t).toLocaleDateString(undefined,{weekday:"short",day:"numeric",month:"short"});
function ago(ts){ if (!ts) return "never"; const m=(Date.now()-ts)/6e4; return m<1?"just now":m<60?Math.round(m)+" min ago":m<1440?Math.round(m/60)+" h ago":Math.round(m/1440)+" d ago"; }
let toastT;
function toast(m,action){ const t=$("#toast"); t.innerHTML=`<span>${esc(m)}</span>${action?`<button type="button">${esc(action.label)}</button>`:""}`; t.hidden=false;
  if (action) t.querySelector("button").onclick=()=>{ t.hidden=true; action.fn(); }; clearTimeout(toastT); toastT=setTimeout(()=>t.hidden=true,action?6000:2800); }
const buzz=()=>{ try{ navigator.vibrate&&navigator.vibrate(12); }catch{} };
function applyTheme(){ const t=S.settings.theme; if (t==="system") document.documentElement.removeAttribute("data-theme"); else document.documentElement.setAttribute("data-theme",t); }
function openSheet(html,{full=false}={}){ const el=$("#sheet"); el.className="sheet"+(full?" full":""); el.innerHTML=`<div class="panel" role="dialog" aria-modal="true">${html}</div>`;
  if (el.hidden&&!(history.state&&history.state.sheet)){ try{ history.pushState({sheet:1},""); }catch{} }
  el.hidden=false; el.onclick=e=>{ if (e.target===el&&!full) closeSheet(); }; document.body.style.overflow="hidden"; return el.firstElementChild; }
function closeSheet(){ const el=$("#sheet"); el.hidden=true; el.innerHTML=""; document.body.style.overflow=""; }
function confirmSheet(text,ok,fn){ const p=openSheet(`<h2>${esc(text)}</h2><div class="row"><button type="button" class="btn danger" id="cOk">${esc(ok)}</button><button type="button" class="btn quiet" id="cNo">Cancel</button></div>`);
  p.querySelector("#cOk").onclick=()=>{ closeSheet(); fn(); }; p.querySelector("#cNo").onclick=closeSheet; }
function busySheet(text){ return openSheet(`<h2 id="busyText">${esc(text)}</h2><div class="skeleton"></div><p class="muted small">Running on your phone, nothing is uploaded.</p>`); }
const setBusy=t=>{ const el=$("#busyText"); if (el) el.textContent=t; };
const PERSON=IC.person;
const initials=()=>{ const n=(S.profile.name||"").trim(); return n?n.split(/\s+/).map(w=>w[0]).slice(0,2).join("").toUpperCase():""; };
const avatarHTML=()=>initials()?esc(initials()):PERSON;

/* ================= navigation ================= */
function setTab(t){ if (t==="settings") t="you";
  const go=()=>{ S.tab=t; document.querySelectorAll("nav.tabs button").forEach(b=>b.setAttribute("aria-current",String(b.dataset.tab===t))); try{ history.replaceState(history.state,"","#"+t); }catch{} render(); window.scrollTo(0,0); };
  if (document.startViewTransition&&!matchMedia("(prefers-reduced-motion: reduce)").matches) document.startViewTransition(go); else go(); }
function render(){
  const v=$("#view");
  $("#dateLabel").textContent=new Date().toLocaleDateString(undefined,{weekday:"long",day:"numeric",month:"long"});
  $("#avatarBtn").innerHTML=avatarHTML();
  if (!S.ready){ v.innerHTML=`<div class="skeleton"></div>`; return; }
  ({today:renderToday,closet:renderCloset,shop:renderShop,you:renderYou})[S.tab](v);
}

/* ================= TODAY ================= */
function collageHTML(o,i,interactive=true,big=false){
  const ups=["outer","layer","top"].filter(k=>o[k]);
  const slot=(k,cls)=>{ if (!o[k]) return ""; const inner=`${phHTML(o[k],{big,badge:S.locks[k]===o[k].id?'<span class="badge lock">Locked</span>':o[k].virtual?'<span class="badge new">New</span>':""})}<span class="tag">${SLOT_LABEL[k]}</span>`;
    return interactive?`<button type="button" class="piece ${cls}" data-piece="${i}:${k}" aria-label="${esc(SLOT_LABEL[k]+": "+o[k].name)}">${inner}</button>`:`<div class="piece ${cls}" title="${esc(o[k].name)}">${inner}</div>`; };
  const acc=["hat","gloves","bag","eyes","belt","neck","wrist","hand","ear"].filter(k=>o[k]);
  return `<div class="collage">${ups.map(k=>slot(k,ups.length===1?"wide":"")).join("")}${slot("bottom","wide")}${slot("shoes","wide")}</div>${acc.length?`<div class="collage acc">${acc.map(k=>slot(k,"")).join("")}</div>`:""}`;
}
function miniCollage(o){ const ps=[o.outer||o.layer||o.top, o.bottom, o.shoes, o.outer&&o.layer?o.layer:(o.outer||o.layer)?o.top:(o.hat||o.bag||jewelOf(o)[0])].filter(Boolean).slice(0,4);
  return `<div class="mini4">${ps.map(it=>phHTML(it)).join("")}</div>`; }
function renderToday(v){
  const st=S.settings, c=conditions(), fc=c.source==="forecast", pend=S.day===0?pendingRating():null;
  const F=S.items.length?feed():null, p=F?F.p:weatherPlan(c);
  const sub=fc?`Feels ${deg(c.low)} to ${deg(c.high)}${c.late?" in the next hours":" while you're out"}`:c.source==="manual"?"Set by you":S.wxState==="loading"?"Loading forecast…":S.loc?"Forecast unavailable":"No location yet";
  const hours=c.hours.map(h=>`<div class="hr${c.window.includes(h.t)?" in":""}"><span>${h.t.slice(11,13)}</span><b>${deg(h.feels)}</b><span>${h.pop>=30?h.pop+"%":"&nbsp;"}</span></div>`).join("");
  const lockN=Object.keys(S.locks).length;
  v.innerHTML=`<div class="stack">
    ${S.loc&&fc?seg("day",[[0,"Today"],[1,"Tomorrow"]],S.day,"dayseg"):""}
    <section class="wx">
      <div class="wx-main"><div class="wx-temp" id="tempOut">${fc?deg(c.nowFeels):deg(c.temp)}</div>
        <div class="grow"><div class="wx-cond">${esc(fc?c.label:"Your call")}${c.wet?" · wet":""}${c.snow?" · snow":""}${S.loc&&fc?` <span class="muted">· ${esc(S.loc.name)}</span>`:""}</div><div class="wx-sub">${S.day===1&&fc?"Tomorrow · ":""}${sub}</div></div>
        ${S.loc&&fc&&S.day===0?`<button type="button" class="btn icon-only quiet" id="wxRefresh" aria-label="Refresh forecast">${IC.refresh}</button>`:""}</div>
      ${hours?`<div class="hours">${hours}</div>`:""}
      ${!fc?`<input type="range" id="tempIn" min="-20" max="38" step="1" value="${st.manualTemp}" aria-label="Temperature"><div class="row">${seg("rain",[[0,"Dry"],[1,"Rain or snow"]],st.manualRain?1:0)}</div>`:""}
      <div class="wx-note"><span>${esc(p.note)}</span>${S.loc&&fc?`<button type="button" class="linkbtn" id="manualOn">Set it myself</button>`:st.manual&&S.loc?`<button type="button" class="linkbtn" id="manualOff">Use forecast</button>`:!S.loc?`<button type="button" class="linkbtn" id="setLoc">Set location</button>`:""}</div>
    </section>
    ${pend?rateCardHTML(pend):""}
    <div id="fits"></div>
    ${S.items.length?`<div class="feature-row">
      <button type="button" class="feature" id="recreateBtn"><span class="ficon">${IC.spark}</span><span><strong>Recreate an inspo fit</strong><span class="h">Pick a photo you like; it's rebuilt from your clothes.</span></span></button>
      <button type="button" class="feature" id="mirrorBtn"><span class="ficon">${IC.mirror}</span><span><strong>Mirror pic</strong><span class="h">Log what you wore and rate it.</span></span></button></div>`:""}
  </div>`;
  const fits=$("#fits");
  if (!S.items.length) fits.innerHTML=needsHTML();
  else if (F.missing.length) fits.innerHTML=`<div class="notice solid">For ${deg(c.temp)} you still need ${F.missing.map(esc).join(", ")}. The Shop tab suggests what to get.</div>`;
  else if (!F.list.length) fits.innerHTML=`<div class="notice solid">Nothing in your closet works together for this weather yet. Check what's in the wash.</div>`;
  else {
    const hero=F.list[0], rest=F.list.slice(1);
    fits.innerHTML=`<div class="stack">
      ${F.soft.length?`<div class="notice">${F.soft.map(esc).join(" ")}</div>`:""}
      ${lockN?`<div class="row between notice"><span>${lockN} piece${lockN>1?"s":""} locked in every fit</span><button type="button" class="linkbtn" id="unlock">Unlock</button></div>`:""}
      ${heroHTML(hero)}
      ${rest.length?`<div class="row between"><h2>More fits</h2><button type="button" class="linkbtn" id="shuffle">${IC.refresh} New set</button></div>
      <div class="fitgrid">${rest.map((o,j)=>`<button type="button" class="fitcard" data-open="${j+1}">${miniCollage(o)}<span class="fc-title">${esc(titleOf(o))}</span></button>`).join("")}</div>
      <button type="button" class="btn quiet block" id="moreBtn">Show more fits</button>`:""}
    </div>`;
    bindHero(fits); fits.querySelectorAll("[data-open]").forEach(b=>b.onclick=()=>fitSheet(+b.dataset.open));
  }
  const on=(id,fn)=>{ const el=$(id); if (el) el.onclick=fn; };
  const ti=$("#tempIn"); if (ti){ ti.oninput=e=>{ st.manualTemp=+e.target.value; $("#tempOut").textContent=deg(st.manualTemp); }; ti.onchange=()=>{ saveSettings(); render(); }; }
  v.querySelectorAll("[data-rain]").forEach(b=>b.onclick=()=>{ st.manualRain=b.dataset.rain==="1"; saveSettings(); render(); });
  v.querySelectorAll("[data-day]").forEach(b=>b.onclick=()=>{ S.day=+b.dataset.day; buzz(); render(); });
  on("#wxRefresh",()=>fetchWeather(true)); on("#setLoc",locationSheet);
  on("#manualOn",()=>{ st.manual=true; st.manualTemp=c.temp; saveSettings(); render(); }); on("#manualOff",()=>{ st.manual=false; saveSettings(); render(); });
  on("#shuffle",()=>{ S.shuffle++; buzz(); render(); }); on("#moreBtn",moreFits); on("#unlock",()=>{ S.locks={}; render(); });
  on("#recreateBtn",startRecreate); on("#mirrorBtn",()=>startMirror());
  const rc=v.querySelector(".ratecard"); if (rc) bindRateCard(rc,pend);
}
function heroHTML(o){
  const saved=S.saved.some(f=>f.key===o.key), tomorrow=S.day===1;
  return `<article class="look pick">
    <div class="look-head"><div><span class="eyebrow">${o.planned?"Your plan":tomorrow?"Tomorrow's pick":"Today's pick"}</span><h2>${esc(titleOf(o))}</h2></div>
      <button type="button" class="savebtn" data-save="0" aria-label="${saved?"Saved":"Save fit"}" aria-pressed="${saved}">${IC.heart}</button></div>
    ${collageHTML(o,0,true,true)}
    ${o.tags.length?`<div class="chips">${o.tags.map(t=>`<span class="chip ${t.c}">${esc(t.t)}</span>`).join("")}</div>`:""}
    <div class="look-actions"><button type="button" class="btn icon-only quiet" data-skip="0" aria-label="Not this one">${IC.x}</button>
      ${tomorrow?`<button type="button" class="btn accent" data-plan="0">${IC.cal}Plan for tomorrow</button>`:`<button type="button" class="btn accent" data-wear="0">${IC.check}Wear this</button>`}</div>
    <p class="hint">Tap a piece to swap or lock it.</p>
  </article>`;
}
function bindHero(root){
  root.querySelectorAll("[data-wear]").forEach(b=>b.onclick=()=>wear(S.feed.list[+b.dataset.wear]));
  root.querySelectorAll("[data-plan]").forEach(b=>b.onclick=()=>planFit(S.feed.list[+b.dataset.plan]));
  root.querySelectorAll("[data-skip]").forEach(b=>b.onclick=()=>skipFit(+b.dataset.skip));
  root.querySelectorAll("[data-save]").forEach(b=>b.onclick=()=>saveFit(S.feed.list[+b.dataset.save]));
  root.querySelectorAll("[data-piece]").forEach(b=>b.onclick=()=>{ const [i,slot]=b.dataset.piece.split(":"); pieceSheet(+i,slot); });
}
function fitSheet(i){
  const o=S.feed.list[i]; if (!o) return; const saved=S.saved.some(f=>f.key===o.key), tomorrow=S.day===1;
  const p=openSheet(`<div class="row between"><h2>${esc(titleOf(o))}</h2><button type="button" class="btn quiet" id="x">Close</button></div>
    ${collageHTML(o,i,true,true)}
    ${o.tags.length?`<div class="chips">${o.tags.map(t=>`<span class="chip ${t.c}">${esc(t.t)}</span>`).join("")}</div>`:""}
    <div class="look-actions three"><button type="button" class="btn icon-only quiet" id="fsSkip" aria-label="Not this one">${IC.x}</button>
      <button type="button" class="btn icon-only quiet" id="fsSave" aria-pressed="${saved}" aria-label="Save">${IC.heart}</button>
      ${tomorrow?`<button type="button" class="btn accent" id="fsGo">${IC.cal}Plan for tomorrow</button>`:`<button type="button" class="btn accent" id="fsGo">${IC.check}Wear this</button>`}</div>
    <p class="hint">Tap a piece to swap or lock it.</p>`);
  p.querySelector("#x").onclick=closeSheet;
  p.querySelector("#fsSkip").onclick=()=>{ closeSheet(); skipFit(i); };
  p.querySelector("#fsSave").onclick=()=>{ saveFit(o); closeSheet(); };
  p.querySelector("#fsGo").onclick=()=>{ closeSheet(); tomorrow?planFit(o):wear(o); };
  p.querySelectorAll("[data-piece]").forEach(b=>b.onclick=()=>{ const [ii,slot]=b.dataset.piece.split(":"); pieceSheet(+ii,slot); });
}
function pieceSheet(i,slot){
  const o=S.feed.list[i]; if (!o) return; const cur=o[slot], c=conditions(), p=weatherPlan(c), P=pools(c,p);
  const alts=(P[slot]||[]).filter(x=>x.id!==cur.id).map(x=>({x,s:rescore({...o,[slot]:x}).score})).sort((a,b)=>b.s-a.s).slice(0,9);
  const locked=S.locks[slot]===cur.id, optional=!["top","bottom","shoes"].includes(slot);
  const panel=openSheet(`<div class="row between"><div><span class="label">${SLOT_LABEL[slot]}</span><h2>${esc(cur.name)}</h2></div><button type="button" class="btn quiet" id="x">Close</button></div>
    <div class="row"><button type="button" class="btn ${locked?"":"primary"}" id="lockBtn">${locked?"Unlock":"Lock in"}</button>${optional?`<button type="button" class="btn quiet" id="dropBtn">Leave it off</button>`:""}<button type="button" class="btn quiet" id="editBtn">Edit piece</button></div>
    <p class="hint">Locked pieces stay in every new fit until you unlock them.</p>
    ${alts.length?`<span class="label">Swap for</span><div class="alt">${alts.map(a=>`<button type="button" class="item" data-alt="${esc(a.x.id)}">${phHTML(a.x)}<span class="nm">${esc(a.x.name)}</span></button>`).join("")}</div>`:`<p class="muted small">Nothing else in your closet fits this slot for this weather.</p>`}`);
  panel.querySelector("#x").onclick=closeSheet;
  panel.querySelector("#lockBtn").onclick=()=>{ if (locked) delete S.locks[slot]; else S.locks[slot]=cur.id; closeSheet(); render(); toast(locked?"Unlocked.":"Locked into every fit."); };
  const db=panel.querySelector("#dropBtn"); if (db) db.onclick=()=>{ const n={...o}; delete n[slot]; delete S.locks[slot]; S.feed.list[i]=rescore(n); closeSheet(); render(); };
  panel.querySelector("#editBtn").onclick=()=>{ closeSheet(); openEditor(cur); };
  panel.querySelectorAll("[data-alt]").forEach(b=>b.onclick=()=>{ const x=S.items.find(it=>it.id===b.dataset.alt); S.feed.list[i]=rescore({...o,[slot]:x}); if (S.locks[slot]) S.locks[slot]=x.id; closeSheet(); render(); buzz(); });
}
function needsHTML(){
  const has=k=>S.items.some(i=>i.cat===k), line=(ok,t)=>`<div class="${ok?"ok":"no"}">${ok?"■":"□"} ${t}</div>`;
  return `<div class="look" style="border:1.5px dashed var(--line2);box-shadow:none"><h2>Build your closet</h2>
    <p class="muted">Photograph each piece on a plain surface. ${aiReady()?"The AI cuts it out and tags it; you check and save.":"You tag type, warmth and fit once."} Fits appear when you have:</p>
    <div class="need">${line(has("top"),"a top")}${line(has("bottom"),"a bottom")}${line(has("shoes"),"shoes")}${line(has("outer"),"a jacket for cold days")}</div>
    <div class="row"><button type="button" class="btn primary" id="nCam">Take a photo</button><button type="button" class="btn" id="nLib">Pick photos</button></div></div>`;
}
document.addEventListener("click",e=>{ const t=e.target.closest("#nCam,#nLib"); if (!t) return; S.presets=null; (t.id==="nCam"?$("#fileCam"):$("#fileLib")).click(); });
function feedback(o,d){ const ps=partsOf(o); for (let i=0;i<ps.length;i++) for (let j=i+1;j<ps.length;j++){ const k=pairKey(ps[i].id,ps[j].id); S.history.pairs[k]=Math.max(-6,Math.min(6,(S.history.pairs[k]||0)+d)); } }
async function wear(o){
  if (!o) return; buzz(); feedback(o,1); learn(o.f,1,1);
  const ps=partsOf(o), now=Date.now(), c=conditions(0);
  const entry={t:now,ids:ps.map(x=>x.id),temp:c.temp,f:o.f,rating:null,tags:[]}; S.history.wear.push(entry);
  ps.forEach(x=>{ x.wearCount=(x.wearCount||0)+1; x.lastWorn=now; });
  if (S.plan&&S.plan.date===dateKey(0)){ S.plan=null; kvSet("plan",null); }
  try{ await saveHistory(); await itemsPut(ps); }catch{ storageFail(); }
  S.feed=null; setTab("today"); toast("Logged. Rate it when you're back.",{label:"Rate now",fn:()=>rateSheet(entry)});
}
async function planFit(o){ S.plan={date:dateKey(1),ids:partsOf(o).map(x=>x.id)}; await kvSet("plan",S.plan); buzz(); toast("Planned. It'll be your pick tomorrow morning."); }
function skipFit(i){ const F=S.feed, o=F.list[i]; if (!o) return; feedback(o,-.5); learn(o.f,0,.6); F.feedSkipped=F.feedSkipped||new Set(); S.feedSkipped.add(o.key);
  F.list.splice(i,1); const add=selectDiverse(F.cands,1,F.list); F.list.splice(i,0,...add); saveHistory(); render(); }
async function saveFit(o){ const ex=S.saved.findIndex(f=>f.key===o.key);
  if (ex>=0){ S.saved.splice(ex,1); toast("Removed from saved fits."); } else { S.saved.unshift({key:o.key,t:Date.now(),slots:Object.fromEntries(SLOTS.filter(k=>o[k]).map(k=>[k,o[k].id]))}); learn(o.f,1,.5); buzz(); toast("Saved. Find it in Closet › Saved."); }
  await kvSet("saved",S.saved).catch(storageFail); render(); }

/* ================= RATINGS ================= */
async function rateWear(w,rating,tags=w.tags||[]){
  const first=!w.rated; w.rating=rating; w.tags=[...tags];
  if (first){ let f=w.f; if (!f){ const o=outfitFromIds(w.ids); if (o.top&&o.bottom&&o.shoes) f=scoreOutfit(o).f; }
    if (rating>=4) learn(f,1,1.5); else if (rating<=2) learn(f,0,2.5);
    const ps=w.ids.map(id=>S.items.find(i=>i.id===id)).filter(Boolean), d=rating>=4?1:rating<=2?-1.5:0;
    if (d) for (let i=0;i<ps.length;i++) for (let j=i+1;j<ps.length;j++){ const k=pairKey(ps[i].id,ps[j].id); S.history.pairs[k]=Math.max(-6,Math.min(6,(S.history.pairs[k]||0)+d)); }
    if (tags.includes("Too cold")) S.settings.thermal=Math.min(5,(S.settings.thermal||0)+1);
    if (tags.includes("Too warm")) S.settings.thermal=Math.max(-5,(S.settings.thermal||0)-1);
    saveSettings(); w.rated=true; }
  await saveHistory(); S.feed=null; recomputeStyle(); buzz();
}
function pendingRating(){ const cut=Date.now()-36*36e5; return [...S.history.wear].reverse().find(w=>w.t>=cut&&!w.rating&&!w.dismissed)||null; }
const photoOf=w=>w.photoId?S.photos.find(p=>p.id===w.photoId):null;
function miniFitHTML(ids){ return `<div class="mini">${ids.map(id=>S.items.find(i=>i.id===id)).filter(Boolean).map(it=>`<div title="${esc(it.name)}">${phHTML(it)}</div>`).join("")}</div>`; }
function rateCardHTML(w){
  return `<section class="ratecard"><div class="row between"><div><span class="label">${new Date(w.t).toDateString()===new Date().toDateString()?"Today's fit":"Yesterday's fit"}</span><h3>How did it feel?</h3></div><button type="button" class="linkbtn" id="rLater">Later</button></div>
    ${miniFitHTML(w.ids)}
    <div class="stars big" role="group" aria-label="Your rating">${[1,2,3,4,5].map(n=>`<button type="button" data-rstar="${n}" aria-label="${n} star${n>1?"s":""}">★</button>`).join("")}</div>
    <div class="seg">${RATE_TAGS.map(t=>`<button type="button" data-rtag="${esc(t)}" aria-pressed="false">${esc(t)}</button>`).join("")}</div>
    <button type="button" class="linkbtn" id="rMirror">${IC.mirror} Add a mirror pic</button></section>`;
}
function bindRateCard(root,w){ const tags=[];
  root.querySelectorAll("[data-rtag]").forEach(b=>b.onclick=()=>{ const t=b.dataset.rtag,i=tags.indexOf(t); if (i>=0) tags.splice(i,1); else tags.push(t); b.setAttribute("aria-pressed",String(i<0)); });
  root.querySelectorAll("[data-rstar]").forEach(b=>b.onclick=async()=>{ const n=+b.dataset.rstar; root.querySelectorAll("[data-rstar]").forEach(x=>x.setAttribute("aria-pressed",String(+x.dataset.rstar<=n))); await rateWear(w,n,tags); toast(n>=4?"Noted. More fits like this.":n<=2?"Noted. Fewer fits like this.":"Noted."); setTimeout(render,350); });
  root.querySelector("#rLater").onclick=async()=>{ w.dismissed=true; await saveHistory(); render(); };
  root.querySelector("#rMirror").onclick=()=>startMirror(w);
}
function rateSheet(w){
  let n=w.rating||0; const tags=[...(w.tags||[])], ph=photoOf(w);
  const p=openSheet(`<div class="row between"><div><span class="label">${fmtDay(w.t)}${w.temp!=null?" · "+deg(w.temp):""}</span><h2>Rate this fit</h2></div><button type="button" class="btn quiet" id="x">Close</button></div>
    ${ph?`<div class="mirror-ph"><img src="${esc(blobURL(ph.id+":t",ph.thumb||ph.photo))}" alt="Mirror pic"></div>`:""}
    ${miniFitHTML(w.ids)}
    <div class="stars big">${[1,2,3,4,5].map(k=>`<button type="button" data-rs="${k}" aria-pressed="${k<=n}" aria-label="${k} star${k>1?"s":""}">★</button>`).join("")}</div>
    <div class="seg">${RATE_TAGS.map(t=>`<button type="button" data-rt="${esc(t)}" aria-pressed="${tags.includes(t)}">${esc(t)}</button>`).join("")}</div>
    <div class="row"><button type="button" class="btn accent" id="rsSave">Save rating</button><button type="button" class="btn quiet" id="rsPhoto">${IC.mirror}${ph?"Replace mirror pic":"Add mirror pic"}</button></div>`);
  p.querySelector("#x").onclick=closeSheet;
  p.querySelectorAll("[data-rs]").forEach(b=>b.onclick=()=>{ n=+b.dataset.rs; p.querySelectorAll("[data-rs]").forEach(x=>x.setAttribute("aria-pressed",String(+x.dataset.rs<=n))); buzz(); });
  p.querySelectorAll("[data-rt]").forEach(b=>b.onclick=()=>{ const t=b.dataset.rt,i=tags.indexOf(t); if (i>=0) tags.splice(i,1); else tags.push(t); b.setAttribute("aria-pressed",String(i<0)); });
  p.querySelector("#rsSave").onclick=async()=>{ if (!n){ toast("Pick 1 to 5 stars first."); return; } await rateWear(w,n,tags); closeSheet(); render(); toast("Rating saved."); };
  p.querySelector("#rsPhoto").onclick=()=>{ closeSheet(); startMirror(w); };
}

/* ================= MIRROR PICS ================= */
const mirrorIn=document.createElement("input"); mirrorIn.type="file"; mirrorIn.accept="image/*"; mirrorIn.hidden=true; mirrorIn.id="mirrorIn"; document.body.appendChild(mirrorIn);
let mirrorCtx=null;
function startMirror(w=null){ mirrorCtx={w}; mirrorIn.value=""; mirrorIn.click(); }
mirrorIn.onchange=async()=>{
  const f=mirrorIn.files[0]; if (!f) return;
  try{
    const img=await loadImage(f), photo=await toBlob(canvasFrom(img,1200),"image/jpeg",.84), thumb=await toBlob(canvasFrom(img,420),"image/jpeg",.78);
    const today=new Date().toDateString();
    let w=(mirrorCtx&&mirrorCtx.w)||[...S.history.wear].reverse().find(x=>new Date(x.t).toDateString()===today);
    const e={id:"d"+Date.now().toString(36),t:Date.now(),photo,thumb};
    if (aiReady()){ busySheet("Recognising your pieces…"); try{ const look=await readLook(img); e.emb=look.E.full;
        if (!w){ const pick=(cat,emb,col)=>{ const b=bestMatch(cat,emb,col); return b&&b.s>.6?b.it.id:null; };
          const ids=[...new Set([pick(look.upperCat,look.E.upper,look.colors.upper),look.upperCat!=="top"?pick("top",look.E.upper):null,pick("bottom",look.E.lower,look.colors.lower),pick("shoes",look.E.feet,look.colors.feet),look.hasHat?pick("hat",look.E.head):null].filter(Boolean))];
          w={t:Date.now(),ids,temp:conditions(0).temp,rating:null,tags:[],fromMirror:true}; S.history.wear.push(w); } }catch{} }
    if (!w){ w={t:Date.now(),ids:[],temp:conditions(0).temp,rating:null,tags:[],fromMirror:true}; S.history.wear.push(w); }
    if (w.photoId){ await photoDel(w.photoId).catch(()=>{}); S.photos=S.photos.filter(p=>p.id!==w.photoId); }
    e.wearT=w.t; w.photoId=e.id; await photoPut(e); S.photos.push(e); await saveHistory(); URL.revokeObjectURL(img.src);
    closeSheet(); render(); mirrorPieces(w);
  }catch{ closeSheet(); toast("That photo couldn't be read."); }
};
function mirrorPieces(w){
  const ph=photoOf(w), grouped=CATS.map(c=>({c,items:S.items.filter(i=>i.cat===c.k)})).filter(g=>g.items.length);
  const sel=new Set(w.ids);
  const p=openSheet(`<div class="row between"><h2>What's in this fit?</h2><button type="button" class="btn quiet" id="x">Close</button></div>
    ${ph?`<div class="mirror-ph"><img src="${esc(blobURL(ph.id+":t",ph.thumb||ph.photo))}" alt=""></div>`:""}
    <p class="hint">${w.ids.length?"Pre-selected by the AI or from what you logged. Tap to fix.":"Tap the pieces you're wearing."}</p>
    ${grouped.map(g=>`<div class="stack tight"><span class="label">${g.c.n}</span><div class="mini sel">${g.items.map(it=>`<button type="button" class="item" data-mi="${esc(it.id)}" aria-pressed="${sel.has(it.id)}">${phHTML(it)}</button>`).join("")}</div></div>`).join("")}
    <button type="button" class="btn accent block" id="mpNext">Next: rate it</button>`,{full:true});
  p.querySelector("#x").onclick=closeSheet;
  p.querySelectorAll("[data-mi]").forEach(b=>b.onclick=()=>{ const id=b.dataset.mi; if (sel.has(id)) sel.delete(id); else sel.add(id); b.setAttribute("aria-pressed",String(sel.has(id))); });
  p.querySelector("#mpNext").onclick=async()=>{ w.ids=[...sel]; await saveHistory(); closeSheet(); rateSheet(w); };
}

/* ================= RECREATE AN INSPO FIT ================= */
const inspoIn=document.createElement("input"); inspoIn.type="file"; inspoIn.accept="image/*"; inspoIn.hidden=true; inspoIn.id="inspoIn"; document.body.appendChild(inspoIn);
function startRecreate(){
  if (!aiReady()){ aiNeededSheet("Recreating an inspo fit reads the photo with the on-device fashion AI, then rebuilds it from your clothes."); return; }
  if (S.items.filter(i=>i.emb).length<3){ toast("Add at least a top, bottom and shoes first, so there's something to rebuild it from."); return; }
  inspoIn.value=""; inspoIn.click();
}
inspoIn.onchange=async()=>{
  const f=inspoIn.files[0]; if (!f) return; busySheet("Reading the look…");
  try{
    const img=await loadImage(f), look=await readLook(img), c=conditions(0), p=weatherPlan(c), o={}, miss=[], notes=[];
    const word=k=>k==="outer"?"jacket":k==="layer"?"knit or hoodie":"top";
    const up=bestMatch(look.upperCat,look.E.upper,look.colors.upper); if (up){ o[look.upperCat]=up.it; if (up.s<.68) miss.push(`a ${look.colors.upper} ${look.upperKind||word(look.upperCat)} closer to this one`); } else miss.push(`a ${look.colors.upper} ${look.upperKind||word(look.upperCat)}`);
    if (look.upperCat!=="top"){ const t=bestMatch("top",look.E.upper,null,i=>(p.top||[1,2,3]).includes(i.warmth||1)); if (t) o.top=t.it; }
    const lo=bestMatch("bottom",look.E.lower,look.colors.lower); if (lo){ o.bottom=lo.it; if (lo.s<.68) miss.push(`${look.colors.lower} trousers closer to these`); } else miss.push(`${look.colors.lower} trousers`);
    const sh=bestMatch("shoes",look.E.feet,look.colors.feet); if (sh){ o.shoes=sh.it; if (sh.s<.68) miss.push(`${look.colors.feet} shoes closer to these`); }
    if (look.hasHat){ const h=bestMatch("hat",look.E.head); if (h) o.hat=h.it; else miss.push("headwear"); }
    if (p.outer==="need"&&!o.outer){ const warm=byCat("outer").filter(i=>(p.outerW||[2,3]).includes(i.warmth||2)); if (warm.length){ warm.sort((a,b)=>AI.cos(b.emb||look.E.upper,look.E.upper)-AI.cos(a.emb||look.E.upper,look.E.upper)); o.outer=warm[0]; notes.push(`It's ${deg(c.temp)}, so a warm jacket goes over it.`); } }
    for (const z of ["neck","wrist","hand","ear"]){ const pin=avail().filter(j=>j.cat==="jewelry"&&JZONE[j.sub]===z&&j.pinned); if (pin.length) o[z]=pin[0]; }
    if (!o.top||!o.bottom||!o.shoes){ closeSheet(); toast("Not enough matching pieces yet. Add tops, bottoms and shoes first."); return; }
    const r=rescore(o), url=URL.createObjectURL(f), inspoThumb=await toBlob(canvasFrom(img,420),"image/jpeg",.8);
    const sims=["outer","layer","top","bottom","shoes","hat"].filter(k=>o[k]&&o[k].emb).map(k=>({k,s:AI.cos(o[k].emb,k==="bottom"?look.E.lower:k==="shoes"?look.E.feet:k==="hat"?look.E.head:look.E.upper)}));
    const panel=openSheet(`<div class="row between"><h2>Your version</h2><button type="button" class="btn quiet" id="x">Close</button></div>
      <div class="row" style="align-items:flex-start;flex-wrap:nowrap"><div class="preview"><img src="${url}" alt="Inspiration"></div>
        <div class="stack tight" style="min-width:0"><span class="label">Reads as</span><div class="chips"><span class="chip">${esc(look.colors.upper)} ${esc(look.upperKind||word(look.upperCat))}</span><span class="chip">${esc(look.colors.lower)} bottoms</span><span class="chip">${esc(look.colors.feet)} shoes</span></div>
          <div class="chips">${sims.map(x=>`<span class="chip">${SLOT_LABEL[x.k]}: ${matchLabel(x.s)}</span>`).join("")}</div></div></div>
      <article class="look">${collageHTML(r,0,false,true)}</article>
      ${notes.length?`<div class="notice">${notes.map(esc).join(" ")}</div>`:""}
      ${miss.length?`<div class="notice solid"><strong>To nail it you'd need:</strong> ${miss.map(esc).join(", ")}.</div>`:""}
      <div class="row"><button type="button" class="btn accent" id="rWear">${IC.check}Wear this</button><button type="button" class="btn" id="rSave">${IC.heart}Save</button></div>`,{full:true});
    const done=()=>{ URL.revokeObjectURL(url); closeSheet(); };
    panel.querySelector("#x").onclick=done;
    panel.querySelector("#rWear").onclick=async()=>{ done(); await wear(r); };
    panel.querySelector("#rSave").onclick=async()=>{ S.saved.unshift({key:r.key,t:Date.now(),slots:Object.fromEntries(SLOTS.filter(k=>r[k]).map(k=>[k,r[k].id])),inspo:true,inspoThumb}); await kvSet("saved",S.saved); toast("Saved with your inspo photo in Closet › Saved."); };
  }catch(e){ closeSheet(); toast("Couldn't read that photo. Try a clear full-body shot."); }
};
function aiNeededSheet(why){
  const p=openSheet(`<h2>Turn on the fashion AI</h2><p>${esc(why)} It runs entirely on your phone: a one-time download of about 200 MB (use Wi-Fi), then it works offline and costs nothing.</p>
    <div class="row"><button type="button" class="btn accent" id="aiGo">Download and turn on</button><button type="button" class="btn quiet" id="aiNo">Not now</button></div>`);
  p.querySelector("#aiNo").onclick=closeSheet; p.querySelector("#aiGo").onclick=()=>{ closeSheet(); enableAI(); setTab("you"); };
}

/* ================= CLOSET ================= */
function renderCloset(v){
  const worn=S.history.wear.length;
  v.innerHTML=`<div class="stack">${seg("cv",[["pieces",`Pieces ${S.items.length}`],["fits",`Worn ${worn}`],["saved",`Saved ${S.saved.length}`]],S.closetView,"scroll")}<div id="cvBody" class="stack"></div></div>`;
  v.querySelectorAll("[data-cv]").forEach(b=>b.onclick=()=>{ S.closetView=b.dataset.cv; render(); });
  ({pieces:renderPieces,fits:renderWorn,saved:renderSaved})[S.closetView]($("#cvBody"));
}
function renderPieces(body){
  let list=S.filter==="all"?S.items.slice():S.items.filter(i=>i.cat===S.filter);
  const q=S.query.trim().toLowerCase(); if (q) list=list.filter(i=>(i.name+" "+cname(i)+" "+(i.kind||"")+" "+(CATN[i.cat]||"")).toLowerCase().includes(q));
  const sorts={new:(a,b)=>b.added-a.added,most:(a,b)=>(b.wearCount||0)-(a.wearCount||0),least:(a,b)=>(a.wearCount||0)-(b.wearCount||0)||(a.lastWorn||0)-(b.lastWorn||0),color:(a,b)=>lightness(a)-lightness(b)};
  list.sort(sorts[S.sort]||sorts.new);
  const cats=CATS.filter(c=>S.items.some(i=>i.cat===c.k)), wash=S.items.filter(i=>i.inWash).length, review=S.colorReview.filter(r=>S.items.some(i=>i.id===r.id));
  body.innerHTML=`${review.length?`<div class="row between notice solid"><span>Colours updated on ${review.length} piece${review.length>1?"s":""} after cutting out backgrounds.</span><button type="button" class="linkbtn" id="reviewBtn">Review</button></div>`:""}
    ${S.items.length>12?`<div class="search"><input type="search" id="q" placeholder="Search your closet" value="${esc(S.query)}" aria-label="Search closet">
      <select id="sortSel" aria-label="Sort">${[["new","Newest"],["most","Most worn"],["least","Least worn"],["color","Dark to light"]].map(([k,l])=>`<option value="${k}" ${S.sort===k?"selected":""}>${l}</option>`).join("")}</select></div>`:""}
    ${cats.length>1?seg("f",[["all","All"],...cats.map(c=>[c.k,`${c.n} ${S.items.filter(i=>i.cat===c.k).length}`])],S.filter,"scroll"):""}
    ${wash?`<div class="row between"><span class="muted small">${wash} in the wash</span><button type="button" class="linkbtn" id="allClean">Mark all clean</button></div>`:""}
    ${list.length?`<div class="grid">${list.map(it=>`<button type="button" class="item" data-id="${esc(it.id)}">${phHTML(it)}<span class="nm">${esc(it.name)}</span><span class="sub">${it.wearCount?`Worn ${it.wearCount}×`:"Not worn yet"}</span></button>`).join("")}</div>`:S.items.length?`<p class="muted">Nothing matches.</p>`:needsHTML()}`;
  const qi=$("#q"); if (qi) qi.oninput=debounce(()=>{ S.query=qi.value; renderPieces(body); const n=$("#q"); n.focus(); n.setSelectionRange(n.value.length,n.value.length); },180);
  const ss=$("#sortSel"); if (ss) ss.onchange=e=>{ S.sort=e.target.value; renderPieces(body); };
  body.querySelectorAll("[data-f]").forEach(b=>b.onclick=()=>{ S.filter=b.dataset.f; renderPieces(body); });
  body.querySelectorAll("[data-id]").forEach(b=>b.onclick=()=>openEditor(S.items.find(i=>i.id===b.dataset.id)));
  const ac=$("#allClean"); if (ac) ac.onclick=async()=>{ const w=S.items.filter(i=>i.inWash); w.forEach(i=>i.inWash=false); await itemsPut(w).catch(storageFail); closetChanged(); renderPieces(body); toast("All clean."); };
  const rb=$("#reviewBtn"); if (rb) rb.onclick=colorReviewSheet;
}
function colorReviewSheet(){
  const rows=S.colorReview.map(r=>({r,it:S.items.find(i=>i.id===r.id)})).filter(x=>x.it);
  if (!rows.length){ toast("Nothing to review."); return; }
  const p=openSheet(`<div class="row between"><h2>Check the new colours</h2><button type="button" class="btn quiet" id="x">Done</button></div>
    <p class="hint">Cutting out the background lets the app read colours more accurately. Keep the old colour if the new one is wrong.</p>
    ${rows.map(({r,it})=>`<div class="rowi" data-rv="${esc(it.id)}"><div class="row" style="flex-wrap:nowrap"><div style="width:56px">${phHTML(it)}</div><div><div class="k">${esc(it.name)}</div><div class="h"><span class="dot" style="background:${esc(r.oldHex)}"></span>${esc(r.oldName)} → <span class="dot" style="background:${esc(it.color)}"></span><b>${esc(cname(it))}</b></div></div></div>
      <button type="button" class="btn quiet" data-keep="${esc(it.id)}">Keep old</button></div>`).join("")}`);
  const finish=async()=>{ S.colorReview=[]; await kvSet("colorReview",[]); closeSheet(); render(); };
  p.querySelector("#x").onclick=finish;
  p.querySelectorAll("[data-keep]").forEach(b=>b.onclick=async()=>{ const it=S.items.find(i=>i.id===b.dataset.keep), r=S.colorReview.find(x=>x.id===it.id);
    it.color=r.oldHex; it.colorName=r.oldName; it.colorUser=true; await itemPut(it); S.colorReview=S.colorReview.filter(x=>x.id!==it.id); await kvSet("colorReview",S.colorReview); closetChanged(); b.closest(".rowi").remove(); if (!S.colorReview.length) finish(); });
}
function renderWorn(body){
  const list=[...S.history.wear].reverse();
  if (!list.length){ body.innerHTML=`<p class="muted">Fits you wear show up here, with your mirror pics and ratings.</p><button type="button" class="btn" id="wMirror">${IC.mirror}Log a mirror pic</button>`; $("#wMirror").onclick=()=>startMirror(); return; }
  const rated=S.history.wear.filter(w=>w.rating), avg=rated.length?(rated.reduce((a,w)=>a+w.rating,0)/rated.length).toFixed(1):"–";
  body.innerHTML=`<div class="stats"><div class="stat"><b>${S.history.wear.length}</b><span>fits worn</span></div><div class="stat"><b>${rated.length}</b><span>rated</span></div><div class="stat"><b>${avg}</b><span>avg rating</span></div></div>
    ${list.slice(0,80).map((w,n)=>{ const ph=photoOf(w); return `<button type="button" class="wornrow" data-wr="${S.history.wear.length-1-n}">
      ${ph?`<div class="wr-ph"><img src="${esc(blobURL(ph.id+":t",ph.thumb||ph.photo))}" alt=""></div>`:""}
      <div class="wr-body"><div class="row between"><span class="k">${fmtDay(w.t)}<span class="muted small"> · ${w.temp!=null?deg(w.temp):""}</span></span><span class="${w.rating?"stars-sm":"muted small"}">${w.rating?"★".repeat(w.rating):"Rate"}</span></div>
      ${miniFitHTML(w.ids)}${w.tags&&w.tags.length?`<span class="small muted">${esc(w.tags.join(" · "))}</span>`:""}</div></button>`; }).join("")}`;
  body.querySelectorAll("[data-wr]").forEach(b=>b.onclick=()=>rateSheet(S.history.wear[+b.dataset.wr]));
}
const inspoURLs=new Map();
function inspoURL(f){ let u=inspoURLs.get(f.key+f.t); if (!u){ u=URL.createObjectURL(f.inspoThumb); inspoURLs.set(f.key+f.t,u); } return u; }
function renderSaved(body){
  const fits=S.saved.map(f=>({f,parts:Object.entries(f.slots).map(([k,id])=>[k,S.items.find(i=>i.id===id)]).filter(x=>x[1])})).filter(x=>x.parts.length);
  if (!fits.length){ body.innerHTML=`<p class="muted">Tap the heart on a fit, or save a recreated inspo look, to keep it here.</p>`; return; }
  body.innerHTML=fits.map(({f,parts},n)=>`<div class="card"><div class="row between"><span class="label">${f.inspo?"From inspiration · ":""}${fmtDay(f.t)}</span>
    <div class="row"><button type="button" class="linkbtn" data-unsave="${n}">Remove</button><button type="button" class="btn accent" data-wearsaved="${n}">Wear today</button></div></div>
    <div class="mini">${f.inspoThumb?`<div title="Inspiration"><div class="ph inspo"><img src="${esc(inspoURL(f))}" alt="Inspiration"><span class="badge">Inspo</span></div></div>`:""}${parts.map(([k,it])=>`<div title="${esc(it.name)}">${phHTML(it)}</div>`).join("")}</div></div>`).join("");
  body.querySelectorAll("[data-unsave]").forEach(b=>b.onclick=async()=>{ const f=fits[+b.dataset.unsave].f; S.saved=S.saved.filter(x=>x!==f); await kvSet("saved",S.saved); renderSaved(body); });
  body.querySelectorAll("[data-wearsaved]").forEach(b=>b.onclick=async()=>{ const o=Object.fromEntries(fits[+b.dataset.wearsaved].parts); if (!o.top||!o.bottom||!o.shoes){ toast("This fit is missing a piece you removed."); return; } await wear(rescore(o)); });
}

/* ================= ADD / EDIT PIECES ================= */
function addMenu(){
  const p=openSheet(`<div class="row between"><h2>Add</h2><button type="button" class="btn quiet" id="x">Close</button></div>
    <div class="two"><button type="button" class="btn primary block" id="aCam">Take a photo</button><button type="button" class="btn block" id="aLib">Pick photos</button></div>
    <p class="hint">One piece per photo, on a plain surface, in daylight. Pick many photos at once to tag them in a row.${aiReady()?" The AI cuts each one out and tags it.":""}</p>
    <div class="two"><button type="button" class="btn block quiet" id="aMirror">${IC.mirror}Mirror pic</button><button type="button" class="btn block quiet" id="aInspo">${IC.spark}Inspo fit</button></div>`);
  p.querySelector("#x").onclick=closeSheet;
  p.querySelector("#aCam").onclick=()=>{ closeSheet(); S.presets=null; $("#fileCam").click(); };
  p.querySelector("#aLib").onclick=()=>{ closeSheet(); S.presets=null; $("#fileLib").click(); };
  p.querySelector("#aMirror").onclick=()=>{ closeSheet(); startMirror(); };
  p.querySelector("#aInspo").onclick=()=>{ closeSheet(); startRecreate(); };
}
$("#fileCam").onchange=e=>{ startQueue([...e.target.files]); e.target.value=""; };
$("#fileLib").onchange=e=>{ startQueue([...e.target.files]); e.target.value=""; };
function startQueue(files){ if (!files.length) return; S.queue=files; S.queueTotal=files.length; nextInQueue(); }
async function nextInQueue(){
  const f=S.queue.shift(); if (!f){ S.presets=null; render(); return; }
  try{
    const img=await loadImage(f), pr=S.presets||{};
    let it={id:"i"+Date.now().toString(36)+Math.random().toString(36).slice(2,6),name:"",cat:pr.cat||null,kind:pr.kind||"",sub:pr.sub||"",metal:pr.metal||"",warmth:pr.warmth||2,fit:pr.fit||"regular",form:pr.form||1,pinned:false,inWash:false,added:Date.now(),wearCount:0};
    if (aiReady()) busySheet("Looking at your photo…");
    it=await analyzePiece(img,it,setBusy);
    if (pr.cat){ Object.assign(it,{cat:pr.cat,kind:pr.kind||it.kind,sub:pr.sub||it.sub,metal:pr.metal||it.metal,warmth:pr.warmth||it.warmth,form:pr.form||it.form,fit:pr.fit||it.fit}); it.ai=null; }
    if (it.cat==="jewelry"&&!it.metal) it.metal="silver";
    URL.revokeObjectURL(img.src); openEditor(it,true);
  }catch(e){ closeSheet(); toast("That photo couldn't be read. Try a JPG or PNG."); nextInQueue(); }
}
const suggestName=it=>{ if (!it.cat) return ""; if (it.cat==="jewelry") return cap(it.metal||"")+" "+((SUBS.jewelry.find(j=>j[0]===it.sub)||["","piece"])[1]).toLowerCase();
  const kind=it.kind||(SUBS[it.cat]?(SUBS[it.cat].find(s=>s[0]===it.sub)||[])[1]:"")||CATN[it.cat]||""; const col=cname(it);
  return cap(`${col==="denim"&&it.kind==="jeans"?"blue":col} ${kind.toLowerCase()}`.trim()); };
let draft=null;
function openEditor(item,isNew=false){
  draft={isNew,item:{...item}}; const it=draft.item; const ai=it.ai||null;
  const src=isNew?URL.createObjectURL(it.cut||it.photo):bigURL(it); draft.tmpURL=isNew?src:null;
  const clothes=["top","layer","outer","bottom"].includes(it.cat), hasWarm=["top","layer","outer","bottom","hat","gloves"].includes(it.cat), hasForm=["top","layer","outer","bottom","shoes"].includes(it.cat);
  const qpos=isNew&&S.queueTotal>1?`<span class="label">${S.queueTotal-S.queue.length} of ${S.queueTotal}</span>`:"";
  let aiNote="";
  if (isNew&&ai){ if (ai.cat==="none") aiNote=`<div class="notice solid">This looks like <b>${esc(ai.kind)}</b>, which Daily Fit doesn't use in fits. If it's something else, pick the type below.</div>`;
    else if (ai.conf<.7&&ai.second&&ai.second!=="none") aiNote=`<div class="notice solid ask"><span>Not sure: is this <b>${esc(ai.kind)}</b> or <b>${esc(ai.secondKind)}</b>?</span><div class="row"><button type="button" class="btn ${it.cat===ai.cat?"primary":""}" data-guess="1">${esc(cap(ai.kind))}</button><button type="button" class="btn" data-guess="2">${esc(cap(ai.secondKind))}</button></div></div>`;
    else aiNote=`<div class="notice">Recognised as <b>${esc(ai.kind)}</b>. Check the details and save.</div>`; }
  if (!it.name) it.name=suggestName(it);
  const swatches=COL.NAMES.map(n=>`<button type="button" class="swatch${cname(it)===n?" on":""}" data-color="${n}" style="background:${COL.CANON[n]}" aria-label="${n}" title="${n}"></button>`).join("");
  const panel=openSheet(`<div class="row between"><h2>${isNew?"New piece":"Edit piece"}</h2><div class="row">${qpos}<button type="button" class="btn quiet" id="x">${isNew&&S.queue.length?"Skip":"Close"}</button></div></div>
    <div class="ed-photo${it.cut&&!it.useOriginal?" cut":""}">${src?`<img src="${esc(src)}" alt="">`:""}</div>
    ${it.cut&&!isNew?`<label class="toggle"><span>Use the original photo</span><input type="checkbox" class="switch" id="origIt" ${it.useOriginal?"checked":""}></label>`:""}
    ${aiNote}
    <div class="field"><label class="label" for="nm">Name</label><input type="text" id="nm" value="${esc(it.name)}" autocomplete="off"></div>
    <div class="field"><span class="label">Type</span>${seg("cat",CATS.map(c=>[c.k,c.n]),it.cat||"")}</div>
    ${SUBS[it.cat]?`<div class="field"><span class="label">${it.cat==="shoes"?"Kind":"Style"}</span>${seg("sub",SUBS[it.cat],it.sub)}</div>`:""}
    ${it.cat==="jewelry"?`<div class="field"><span class="label">Metal</span>${seg("metal",METALS,it.metal)}</div>`:`<div class="field"><span class="label">Colour · <span id="colName">${esc(cname(it))}</span></span><div class="swatches">${swatches}</div></div>`}
    ${hasWarm?`<div class="field"><span class="label">Warmth</span>${seg("warmth",[[1,"Light"],[2,"Medium"],[3,"Warm"]],it.warmth)}</div>`:""}
    ${clothes?`<div class="field"><span class="label">Fit</span>${seg("fit",Object.entries(FIT),it.fit)}</div>`:""}
    ${hasForm?`<div class="field"><span class="label">Dressiness</span>${seg("form",[[1,"Casual"],[2,"Smart"],[3,"Dressy"]],it.form)}</div>`:""}
    <label class="toggle"><span><strong>Pin</strong><br><span class="muted small">${it.cat==="jewelry"?"Your everyday piece: worn whenever fits include jewellery.":it.cat==="hat"?"Your go-to: used whenever headwear fits (set headwear to Always under You to wear it every day).":"Shows up in fits more often."}</span></span><input type="checkbox" class="switch" id="pinIt" ${it.pinned?"checked":""}></label>
    ${isNew?"":`<label class="toggle"><span><strong>In the wash</strong><br><span class="muted small">Left out of fits until it's clean.</span></span><input type="checkbox" class="switch" id="washIt" ${it.inWash?"checked":""}></label>`}
    <div class="row between"><button type="button" class="btn primary" id="saveIt" ${it.cat?"":"disabled"}>${isNew?(S.queue.length?"Save & next":"Add to closet"):"Save"}</button>${isNew?"":`<button type="button" class="btn danger" id="delIt">Remove</button>`}</div>
    ${isNew?"":`<p class="label">Added ${fmtDay(it.added||Date.now())} · worn ${it.wearCount||0}×${it.lastWorn?" · last "+fmtDay(it.lastWorn):""}</p>`}`);
  const nameAuto=()=>{ const el=panel.querySelector("#nm"); if (el&&el.dataset.touched!=="1"){ it.name=suggestName(it); el.value=it.name; } };
  panel.querySelector("#x").onclick=()=>{ cleanupDraft(); closeSheet(); if (isNew) nextInQueue(); };
  const nm=panel.querySelector("#nm"); nm.oninput=e=>{ it.name=e.target.value; nm.dataset.touched="1"; };
  if (!isNew) nm.dataset.touched="1";
  panel.querySelectorAll("[data-guess]").forEach(b=>b.onclick=()=>{ const two=b.dataset.guess==="2"; const kind=two?ai.secondKind:ai.kind, cat=two?ai.second:ai.cat; const k=KIND[kind]||{};
    Object.assign(it,{cat,kind,sub:k.sub||"",warmth:k.w||it.warmth,form:k.f||it.form}); it.ai={...ai,conf:1,cat,kind}; it.name=""; reopen(); });
  const reopen=()=>{ it.name=nm.dataset.touched==="1"?nm.value:""; if (draft.tmpURL) URL.revokeObjectURL(draft.tmpURL); openEditor(it,isNew); };
  for (const k of ["cat","sub","metal","warmth","fit","form"]) panel.querySelectorAll(`[data-${k}]`).forEach(b=>b.onclick=()=>{
    const raw=b.dataset[k]; it[k]=k==="warmth"||k==="form"?+raw:raw;
    if (k==="cat"){ it.sub=SUBS[raw]?(SUBS[raw].some(s=>s[0]===it.sub)?it.sub:SUBS[raw][0][0]):""; if (raw==="jewelry"&&!it.metal) it.metal="silver"; if (it.ai) it.ai={...it.ai,conf:1}; if (!KIND[it.kind]||(it.ai&&it.ai.cat!==raw)) it.kind=""; reopen(); return; }
    panel.querySelectorAll(`[data-${k}]`).forEach(x=>x.setAttribute("aria-pressed",String(x===b))); if (k==="sub"||k==="metal") nameAuto(); });
  panel.querySelectorAll("[data-color]").forEach(b=>b.onclick=()=>{ it.colorName=b.dataset.color; it.color=COL.CANON[it.colorName]; it.colorUser=true;
    panel.querySelectorAll("[data-color]").forEach(x=>x.classList.toggle("on",x===b)); panel.querySelector("#colName").textContent=it.colorName; nameAuto(); });
  panel.querySelector("#pinIt").onchange=e=>it.pinned=e.target.checked;
  const wi=panel.querySelector("#washIt"); if (wi) wi.onchange=e=>it.inWash=e.target.checked;
  const oi=panel.querySelector("#origIt"); if (oi) oi.onchange=e=>{ it.useOriginal=e.target.checked; panel.querySelector(".ed-photo").classList.toggle("cut",!it.useOriginal); panel.querySelector(".ed-photo img").src=it.useOriginal?blobURL(it.id+":p",it.photo):blobURL(it.id+":c",it.cut); };
  panel.querySelector("#saveIt").onclick=commit;
  const d=panel.querySelector("#delIt"); if (d) d.onclick=()=>confirmSheet("Remove this piece and its photo?","Remove",()=>removeItem(it));
}
function cleanupDraft(){ if (draft&&draft.tmpURL) URL.revokeObjectURL(draft.tmpURL); draft=null; }
async function commit(){
  const {item:it,isNew}=draft; if (!it.cat) return;
  if (!SUBS[it.cat]) it.sub=""; if (it.cat!=="jewelry") it.metal=""; else { it.color=METAL_HEX[it.metal]||METAL_HEX.other; it.colorName=it.metal==="gold"?"yellow":"light grey"; }
  if (!it.name.trim()) it.name=suggestName(it); it.name=it.name.trim();
  delete it.ai;
  try{ if (!it.emb&&aiReady()&&(it.cut||it.photo)){ try{ it.emb=await AI.embedImage(it.photo||it.cut); }catch{} }
    await itemPut(it); dropURLs(it.id);
    const idx=S.items.findIndex(x=>x.id===it.id); if (idx>=0) S.items[idx]=it; else S.items.push(it);
    for (const [k,id] of Object.entries(S.locks)) if (id===it.id&&it.inWash) delete S.locks[k];
    cleanupDraft(); closeSheet(); closetChanged(); buzz(); recomputeStyle();
    if (isNew&&S.queue.length){ toast("Added."); nextInQueue(); } else { render(); toast(isNew?"Added to your closet.":"Saved."); if (isNew) S.presets=null; }
  }catch(e){ toast(e&&e.name==="QuotaExceededError"?"This phone is out of storage for photos. Remove a few pieces first.":"Couldn't save. Try again."); }
}
async function removeItem(it){ try{ await itemDel(it.id); dropURLs(it.id); S.items=S.items.filter(x=>x.id!==it.id); for (const [k,id] of Object.entries(S.locks)) if (id===it.id) delete S.locks[k];
  cleanupDraft(); closetChanged(); render(); toast("Removed."); }catch{ toast("Couldn't remove. Try again."); } }

/* ================= SHOP: what to buy next, ranked by what it unlocks ================= */
function ownsSimilar(g){
  if (["hat","gloves","acc"].includes(g.cat)) return S.items.find(i=>i.cat===g.cat&&(!g.sub||i.sub===g.sub));
  if (g.cat==="jewelry") return S.items.find(i=>i.cat==="jewelry"&&(JZONE[i.sub]||"neck")===(JZONE[g.sub]||"neck")&&(!g.metal||i.metal===g.metal));
  return S.items.find(i=>i.cat===g.cat&&(!g.sub||!i.sub||i.sub===g.sub||g.cat==="shoes"&&i.sub===g.sub)&&(g.cat==="jewelry"?(!g.metal||i.metal===g.metal):fam(cname(i))===fam(g.color))&&(g.cat!=="bottom"||!g.kind||i.kind===g.kind||!i.kind||(["jeans"].includes(g.kind)===(i.kind==="jeans"))));
}
const virtualOf=g=>({id:"virt:"+g.id,virtual:true,name:g.name,cat:g.cat,kind:g.kind,sub:g.sub||(KIND[g.kind]||{}).sub||"",metal:g.metal||"",colorName:g.color,color:COL.CANON[g.color]||"#888",warmth:g.warmth||2,form:g.form||1,fit:g.fit||"regular"});
async function analyzeGaps(){
  const ck=[S.closetV,regionCode(),Math.round(conditions(0).temp/3),S.dismissed.length].join("|");
  if (S.gapCache&&S.gapCache.key===ck) return S.gapCache;
  const c0=conditions(0), temps=[c0.temp-8,c0.temp-3,c0.temp+3].map(t=>Math.max(-15,Math.min(30,t)));
  const scen=[...temps.map(t=>({...c0,temp:t,low:t,high:t,wet:false,snow:false,sunny:true,source:"sim"})),{...c0,temp:c0.temp,low:c0.temp,high:c0.temp,wet:true,sunny:false,source:"sim"}];
  const base=generate(scen[1],{n:600,seed:7,locks:{}});
  const thr=base.cands.length?Math.max(6,base.cands[Math.min(base.cands.length-1,8)].score-.4):0;
  const missingCats=CORE.filter(k=>!S.items.some(i=>i.cat===k));
  const out=[];
  for (const g of D.gaps){
    if (S.dismissed.includes(g.id)||ownsSimilar(g)) continue;
    const V=virtualOf(g), slot=slotOf(V), good=new Set(), partners=new Set(); let best=null;
    if (!missingCats.length||missingCats.includes(g.cat)){
      for (const sc of scen){ const r=generate(sc,{n:140,seed:hashStr(g.id+sc.temp),locks:{},extra:[V],force:{slot,item:V}});
        for (const o of r.cands){ if (o.score>=thr){ good.add(o.key); for (const it of partsOf(o)) if (!it.virtual) partners.add(it.id); }
          if (!best||o.score>best.score) best=o; } }
    }
    const trend=activeSignals().find(s=>{ const m=s.match; return (!m.cats||m.cats.includes(g.cat))&&(!m.kinds||m.kinds.includes(g.kind))&&(!m.colors||m.colors.includes(g.color))&&(!m.fits||m.fits.includes(g.fit))&&(!m.subs||m.subs.includes(g.sub))&&!m.layersMin&&!m.accentOne; });
    const needed=missingCats.includes(g.cat);
    out.push({g,V,n:good.size,partners:partners.size,best,trend,needed,rank:(needed?1000:0)+good.size+(trend?trend.strength*1.5:0)});
    await new Promise(r=>setTimeout(r,0));
  }
  out.sort((a,b)=>b.rank-a.rank);
  S.gapCache={key:ck,list:out.filter(x=>x.needed||x.n>0).slice(0,8),missingCats};
  return S.gapCache;
}
function renderShop(v){
  const R=region(), rc=regionCode();
  v.innerHTML=`<div class="stack"><div class="row between"><div><h1>Shop</h1><p class="muted small">What to get next, ranked by how many new fits it unlocks with your closet.</p></div>
    <button type="button" class="chipbtn" id="regionBtn">${esc(R.name)}</button></div><div id="gaps" class="stack"><div class="skeleton"></div><div class="skeleton"></div></div>
    ${R.cities.length?`<details class="stores"><summary>Stores near you</summary><div class="stack tight">${R.cities.map(c=>`<span class="label">${esc(c.name)}</span>${c.stores.map(s=>`<div class="rowi"><div><div class="k">${esc(s.name)}</div><div class="h">${esc(s.address)}</div></div><a class="linkbtn" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s.name+", "+s.address)}" target="_blank" rel="noopener">Map ${IC.ext}</a></div>`).join("")}`).join("")}</div></details>`:""}</div>`;
  $("#regionBtn").onclick=regionSheet;
  analyzeGaps().then(G=>{ const box=$("#gaps"); if (!box||S.tab!=="shop") return;
    if (!G.list.length){ box.innerHTML=`<div class="notice solid">Your closet already covers the essentials for this weather. Nothing to buy right now.</div>`; return; }
    box.innerHTML=(G.missingCats.length?`<div class="notice solid">You have no ${G.missingCats.map(k=>CATN[k].toLowerCase()).join(" or ")} yet, so those come first.</div>`:"")+G.list.map((x,i)=>gapHTML(x,i,R,rc)).join("");
    box.querySelectorAll("[data-got]").forEach(b=>b.onclick=()=>{ const g=D.gaps.find(x=>x.id===b.dataset.got); S.presets={cat:g.cat,kind:g.kind,sub:g.sub||(KIND[g.kind]||{}).sub,metal:g.metal,warmth:g.warmth,form:g.form,fit:g.fit}; toast("Nice. Take a photo of it to add it."); $("#fileCam").click(); });
    box.querySelectorAll("[data-hide]").forEach(b=>b.onclick=async()=>{ S.dismissed.push(b.dataset.hide); await kvSet("dismissed",S.dismissed); S.gapCache=null; renderShop(v); toast("Hidden.",{label:"Undo",fn:async()=>{ S.dismissed.pop(); await kvSet("dismissed",S.dismissed); S.gapCache=null; renderShop($("#view")); }}); });
  });
}
function gapHTML(x,i,R,rc){
  const g=x.g, q=g.q[R.lang]||g.q.en, price=g.price&&g.price[rc];
  const look=x.best?`<div class="ctl"><span class="label">A fit it makes with your clothes</span><div class="mini">${partsOf(x.best).map(it=>`<div title="${esc(it.name)}">${phHTML(it,{badge:it.virtual?'<span class="badge new">New</span>':""})}</div>`).join("")}</div></div>`:"";
  return `<article class="gap">
    <div class="gap-top"><div class="gap-art">${ART.svg(x.V,x.V.color)}</div>
      <div class="gap-body"><span class="label">${CATN[g.cat]}${x.trend?` · <span class="trendtag">Trending</span>`:""}</span><h3>${esc(g.name)}</h3>
        ${x.needed?`<p class="metric">You have no ${CATN[g.cat].toLowerCase()} yet</p>`:`<p class="metric"><b>${x.n}</b> new fit${x.n===1?"":"s"}</p><p class="small muted">Works with ${x.partners} of your pieces</p>`}
        ${price?`<p class="small">${esc(price)}</p>`:""}</div></div>
    ${look}
    <div class="gap-actions"><a class="btn" href="https://www.google.com/search?tbm=isch&q=${encodeURIComponent(g.q.en)}" target="_blank" rel="noopener">Photos ${IC.ext}</a>
      <a class="btn" href="${R.search.url}${encodeURIComponent(q)}" target="_blank" rel="noopener">${esc(R.search.name)} ${IC.ext}</a>
      <button type="button" class="btn quiet" data-got="${esc(g.id)}">I got it</button><button type="button" class="linkbtn" data-hide="${esc(g.id)}">Hide</button></div>
  </article>`;
}
function regionSheet(){
  const opts=[["auto","Automatic (from location)"],...Object.entries(D.regions).map(([k,r])=>[k,r.name])];
  const p=openSheet(`<div class="row between"><h2>Shopping region</h2><button type="button" class="btn quiet" id="x">Close</button></div>
    <div class="list">${opts.map(([k,l])=>`<button type="button" data-reg="${k}"><span>${esc(l)}</span><span>${S.settings.region===k?"●":""}</span></button>`).join("")}</div>
    <p class="hint">Decides which shops, search language and nearby stores you see.</p>`);
  p.querySelector("#x").onclick=closeSheet;
  p.querySelectorAll("[data-reg]").forEach(b=>b.onclick=()=>{ S.settings.region=b.dataset.reg; saveSettings(); S.gapCache=null; S.feed=null; closeSheet(); render(); });
}
function locationSheet(){
  const p=openSheet(`<div class="row between"><h2>Location</h2><button type="button" class="btn quiet" id="x">Close</button></div>
    <p class="hint">Used for the forecast and nearby stores. It stays on this phone.</p>
    <button type="button" class="btn primary block" id="gps">Use my current location</button>
    <div class="field"><label class="label" for="cityQ">Or search a city</label><input type="search" id="cityQ" placeholder="Seoul, Berlin, Zürich…" autocomplete="off" enterkeyhint="search"></div>
    <div class="list" id="cityRes"></div>${S.loc?`<button type="button" class="linkbtn" id="clearLoc">Remove location and set temperatures myself</button>`:""}`);
  p.querySelector("#x").onclick=closeSheet; p.querySelector("#gps").onclick=async()=>{ if (await useGPS()) closeSheet(); };
  const q=p.querySelector("#cityQ"), out=p.querySelector("#cityRes");
  q.oninput=debounce(async()=>{ const s=q.value.trim(); if (s.length<2){ out.innerHTML=""; return; } out.innerHTML=`<p class="hint">Searching…</p>`;
    try{ const r=await searchCities(s); out.innerHTML=r.length?r.map((c,i)=>`<button type="button" data-ci="${i}"><span><strong>${esc(c.name)}</strong> <span class="muted small">${esc([c.admin,c.countryName].filter(Boolean).join(", "))}</span></span><span>›</span></button>`).join(""):`<p class="hint">No city found.</p>`;
      out.querySelectorAll("[data-ci]").forEach(b=>b.onclick=async()=>{ const c=r[+b.dataset.ci]; await setLocation({name:c.name,country:c.country,lat:c.lat,lon:c.lon,source:"search"}); closeSheet(); toast("Location set: "+c.name); });
    }catch{ out.innerHTML=`<p class="hint">City search needs a connection.</p>`; } },350);
  const cl=p.querySelector("#clearLoc"); if (cl) cl.onclick=async()=>{ S.loc=null; S.weather=null; await kvSet("loc",null); await kvSet("weather",null); S.settings.manual=false; saveSettings(); closeSheet(); render(); };
  setTimeout(()=>q.focus(),250);
}

/* ================= YOU ================= */
function renderYou(v){
  const st=S.settings, pr=S.profile, hrs=[...Array(24).keys()], aiState=AI?AI.state:"off";
  const learned=Object.entries(S.taste.w).filter(([,w])=>Math.abs(w)>.25).sort((a,b)=>Math.abs(b[1])-Math.abs(a[1])).slice(0,8);
  const rated=S.history.wear.filter(w=>w.rating), avg=rated.length?(rated.reduce((a,w)=>a+w.rating,0)/rated.length).toFixed(1):"–";
  const best=rated.filter(w=>w.rating>=4).sort((a,b)=>b.rating-a.rating||b.t-a.t).slice(0,3);
  const pr2={}; for (const w of rated) for (const id of w.ids) (pr2[id]=pr2[id]||[]).push(w.rating);
  const loved=Object.entries(pr2).filter(([,r])=>r.length>=2).map(([id,r])=>({it:S.items.find(i=>i.id===id),a:r.reduce((x,y)=>x+y,0)/r.length})).filter(x=>x.it).sort((a,b)=>b.a-a.a).slice(0,6);
  const never=S.items.filter(i=>!i.wearCount&&CLOTH.includes(i.cat)&&Date.now()-(i.added||0)>14*864e5).length;
  v.innerHTML=`<div class="stack">
    <section class="me"><div class="me-top"><div class="avatar lg" aria-hidden="true">${avatarHTML()}</div>
      <div style="flex:1;min-width:0"><input class="me-name" id="pName" type="text" value="${esc(pr.name||"")}" placeholder="Your name" aria-label="Your name" autocomplete="off"><div class="muted small">${S.items.length} pieces${never?` · ${never} never worn`:""}</div></div></div>
      <div class="stats"><div class="stat"><b>${S.history.wear.length}</b><span>fits worn</span></div><div class="stat"><b>${avg}</b><span>avg rating</span></div><div class="stat"><b>${S.saved.length}</b><span>saved</span></div></div>
      <div class="stack tight"><span class="label">Your style, learned</span>${learned.length&&S.taste.n>=5?`<div class="chips">${learned.map(([k,w])=>`<span class="chip ${w>0?"trend":"warn"}">${w>0?"likes":"avoids"} ${esc(featText(k))}</span>`).join("")}</div>`:`<p class="muted small">Builds itself as you wear, skip and rate fits.</p>`}</div>
    </section>
    ${best.length||loved.length?`<section><div class="group-title label">Your best</div><div class="card">${best.length?`<span class="label">Top-rated fits</span>${best.map(w=>`<button type="button" class="bestrow" data-best="${S.history.wear.indexOf(w)}"><span class="small"><span class="stars-sm">${"★".repeat(w.rating)}</span> <span class="muted">${fmtDay(w.t)}</span></span>${miniFitHTML(w.ids)}</button>`).join("")}`:""}
      ${loved.length?`<span class="label">Most-loved pieces</span><div class="mini">${loved.map(x=>`<div title="${esc(x.it.name)}">${phHTML(x.it)}<span class="small muted">${x.a.toFixed(1)}★</span></div>`).join("")}</div>`:""}</div></section>`:""}
    <section><div class="group-title label">How you dress</div><div class="group">
      <div class="rowi stackrow"><span class="k">Trousers</span>${seg("skinny",[["avoid","No skinny fits"],["any","Anything goes"]],st.avoidSkinny?"avoid":"any")}</div>
      <div class="rowi stackrow"><span class="k">Headwear</span>${seg("m-headwear",[["auto","When it's cold"],["always","Every day"],["never","Never"]],st.headwear)}</div>
      <div class="rowi stackrow"><span class="k">Gloves</span>${seg("m-gloves",[["auto","When it's cold"],["always","Always"],["never","Never"]],st.gloves)}</div>
      <div class="rowi stackrow"><span class="k">Jewellery in fits</span>${seg("m-jewelry",[["auto","Yes"],["never","No"]],st.jewelry)}</div>
      <div class="rowi"><div><div class="k">You run</div><div class="h">${st.thermal>0?`cold, so fits are ${st.thermal}° warmer`:st.thermal<0?`warm, so fits are ${-st.thermal}° lighter`:"neutral"} · learns from "too warm/cold"</div></div>
        <div class="stepper"><button type="button" id="thMinus" aria-label="Dress lighter">−</button><span class="tnum">${st.thermal>0?"+":""}${st.thermal||0}°</span><button type="button" id="thPlus" aria-label="Dress warmer">+</button></div></div>
      <div class="rowi"><span class="k">Out of the house</span><span class="row" style="gap:6px;flex-wrap:nowrap"><select id="oS" aria-label="From">${hrs.map(h=>`<option value="${h}" ${h===st.outStart?"selected":""}>${h}:00</option>`).join("")}</select><span class="muted">–</span><select id="oE" aria-label="Until">${hrs.map(h=>`<option value="${h}" ${h===st.outEnd?"selected":""}>${h}:00</option>`).join("")}</select></span></div>
    </div></section>
    <section><div class="group-title label">App</div><div class="group">
      <button type="button" class="rowi" id="locBtn"><div><div class="k">Location</div><div class="h">${S.loc?esc(S.loc.name):"Not set"}</div></div><span class="chev"></span></button>
      <button type="button" class="rowi" id="regBtn"><div><div class="k">Shopping region</div><div class="h">${esc(region().name)}${st.region==="auto"?" · automatic":""}</div></div><span class="chev"></span></button>
      <div class="rowi stackrow"><div class="row between"><div><div class="k">Fashion AI</div><div class="h">${aiState==="ready"?`On · offline${S.aiBusy?" · processing your closet…":""}`:aiState==="loading"?`Downloading ${Math.round((AI.progress||0)*100)}%`:aiState==="error"?"Download failed":"Cuts out photos, tags pieces, reads looks. ~200 MB once."}</div></div>
        ${aiState==="ready"||aiState==="loading"?"":`<button type="button" class="btn accent" id="aiOn">${aiState==="error"?"Retry":"Turn on"}</button>`}</div>
        ${aiState==="loading"?`<div class="progress"><span style="width:${Math.round((AI.progress||0)*100)}%"></span></div>`:""}</div>
      <div class="rowi"><span class="k">Units</span>${seg("units",[["C","°C"],["F","°F"]],st.units)}</div>
      <div class="rowi"><span class="k">Theme</span>${seg("theme",[["system","Auto"],["light","Light"],["dark","Dark"]],st.theme)}</div>
    </div></section>
    <section><div class="group-title label">Your data stays on this phone <span id="storeUse"></span></div><div class="group">
      <button type="button" class="rowi" id="exportBtn"><span class="k">Back up</span><span class="chev"></span></button>
      <button type="button" class="rowi" id="importBtn"><span class="k">Restore from backup</span><span class="chev"></span></button>
      ${S.taste.n?`<button type="button" class="rowi" id="resetTaste"><span class="k">Reset learned style</span><span class="chev"></span></button>`:""}
      <button type="button" class="rowi" id="wipe"><span class="k" style="color:var(--bad)">Delete everything</span></button></div></section>
    <p class="label" style="text-align:center">Daily Fit 6</p></div>`;
  const on=(id,ev,fn)=>{ const el=$(id); if (el) el[ev]=fn; };
  on("#pName","oninput",e=>{ pr.name=e.target.value; saveProfile(); $("#avatarBtn").innerHTML=avatarHTML(); v.querySelector(".avatar.lg").innerHTML=avatarHTML(); });
  v.querySelectorAll("[data-skinny]").forEach(b=>b.onclick=()=>{ st.avoidSkinny=b.dataset.skinny==="avoid"; saveSettings(); renderYou(v); });
  for (const k of ["headwear","gloves","jewelry"]) v.querySelectorAll(`[data-m-${k}]`).forEach(b=>b.onclick=()=>{ st[k]=b.getAttribute(`data-m-${k}`); saveSettings(); renderYou(v); });
  on("#oS","onchange",e=>{ st.outStart=+e.target.value; saveSettings(); }); on("#oE","onchange",e=>{ st.outEnd=+e.target.value; saveSettings(); });
  on("#thMinus","onclick",()=>{ st.thermal=Math.max(-5,(st.thermal||0)-1); saveSettings(); renderYou(v); });
  on("#thPlus","onclick",()=>{ st.thermal=Math.min(5,(st.thermal||0)+1); saveSettings(); renderYou(v); });
  on("#resetTaste","onclick",()=>confirmSheet("Reset what the app learned about your style?","Reset",async()=>{ S.history.pairs={}; S.taste={w:{},n:0}; st.thermal=0; saveSettings(); await saveHistory(); await kvSet("taste",S.taste); render(); toast("Learned style reset."); }));
  on("#locBtn","onclick",locationSheet); on("#regBtn","onclick",regionSheet); on("#aiOn","onclick",()=>enableAI());
  v.querySelectorAll("[data-units]").forEach(b=>b.onclick=()=>{ st.units=b.dataset.units; saveSettings(); renderYou(v); });
  v.querySelectorAll("[data-theme]").forEach(b=>b.onclick=()=>{ st.theme=b.dataset.theme; saveSettings(); applyTheme(); renderYou(v); });
  v.querySelectorAll("[data-best]").forEach(b=>b.onclick=()=>rateSheet(S.history.wear[+b.dataset.best]));
  on("#exportBtn","onclick",exportData); on("#importBtn","onclick",()=>$("#fileImport").click());
  on("#wipe","onclick",()=>confirmSheet("Delete your whole closet, photos, history and settings from this phone?","Delete everything",async()=>{ await kvClear(); location.reload(); }));
  if (navigator.storage&&navigator.storage.estimate) navigator.storage.estimate().then(e=>{ const el=$("#storeUse"); if (el) el.textContent=`· ${(e.usage/1048576).toFixed(0)} MB`; }).catch(()=>{});
}
if (AI) AI.subscribe(debounce(()=>{ if (S.ready&&S.tab==="you"&&$("#sheet").hidden) renderYou($("#view")); },250));

/* ================= backup ================= */
const b2u=b=>new Promise(res=>{ if (!b||typeof b==="string") return res(b||""); const r=new FileReader(); r.onload=()=>res(r.result); r.readAsDataURL(b); });
const u2b=async u=>u?(await fetch(u)).blob():null;
async function exportData(){
  toast("Preparing backup…");
  try{ const items=await Promise.all(S.items.map(async({emb,...it})=>({...it,photo:await b2u(it.photo),thumb:await b2u(it.thumb),cut:await b2u(it.cut)})));
    const photos=await Promise.all(S.photos.map(async({emb,...e})=>({...e,photo:await b2u(e.photo),thumb:await b2u(e.thumb)})));
    const saved=await Promise.all(S.saved.map(async f=>f.inspoThumb?{...f,inspoThumb:await b2u(f.inspoThumb)}:f));
    const data={app:"dailyfit",v:6,exported:new Date().toISOString(),items,photos,settings:S.settings,profile:S.profile,loc:S.loc,history:S.history,saved,dismissed:S.dismissed,taste:S.taste};
    const blob=new Blob([JSON.stringify(data)],{type:"application/json"}), name=`dailyfit-backup-${new Date().toISOString().slice(0,10)}.json`, file=new File([blob],name,{type:"application/json"});
    if (navigator.canShare&&navigator.canShare({files:[file]})){ try{ await navigator.share({files:[file],title:"Daily Fit backup"}); return; }catch(e){ if (e&&e.name==="AbortError") return; } }
    const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download=name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(a.href),5000); toast("Backup saved to your downloads.");
  }catch{ toast("Backup failed. Try again."); }
}
$("#fileImport").onchange=async e=>{ const f=e.target.files[0]; e.target.value=""; if (!f) return;
  try{ const d=JSON.parse(await f.text()); if (d.app!=="dailyfit"||!Array.isArray(d.items)) throw 0;
    confirmSheet(`Replace this phone's closet with the backup (${d.items.length} pieces)?`,"Restore",async()=>{ await kvClear();
      await itemsPut(await Promise.all(d.items.map(async it=>({...it,photo:await u2b(it.photo),thumb:await u2b(it.thumb),cut:await u2b(it.cut)}))));
      for (const p of (d.photos||d.diary||[])) await photoPut({...p,photo:await u2b(p.photo),thumb:await u2b(p.thumb)});
      await Promise.all([kvSet("settings",{...DEFAULT_SETTINGS,...d.settings}),kvSet("profile",{...DEFAULT_PROFILE,name:(d.profile||{}).name||""}),kvSet("loc",d.loc||null),kvSet("history",d.history||{wear:[],pairs:{}}),
        kvSet("saved",await Promise.all((d.saved||[]).map(async f=>f.inspoThumb?{...f,inspoThumb:await u2b(f.inspoThumb)}:f))),kvSet("dismissed",d.dismissed||[]),kvSet("taste",d.taste||{w:{},n:0}),kvSet("onboarded",true)]);
      location.reload(); });
  }catch{ toast("That file isn't a Daily Fit backup."); } };

/* ================= onboarding ================= */
function onboarding(step=0){
  const dots=`<div class="steps">${[0,1,2,3].map(i=>`<span class="${i<=step?"on":""}"></span>`).join("")}</div>`; let html="";
  if (step===0) html=`${dots}<div class="hero">Your closet.<br>Today's weather.<br>Fits that work.</div><p>Photograph what you own once. Every morning Daily Fit builds a set of varied fits for the forecast, and learns what you like.</p><p class="muted small">Everything stays on this phone. No account, no cost.</p><button type="button" class="btn accent block" id="next">Get started</button>`;
  if (step===1) html=`${dots}<h1>Where are you?</h1><p class="muted">For the forecast and nearby stores.</p><button type="button" class="btn primary block" id="gps">Use my location</button><button type="button" class="btn block" id="search">Search a city</button><button type="button" class="linkbtn" id="next">Skip, I'll set the temperature myself</button>${S.loc?`<p class="small">Location: <strong>${esc(S.loc.name)}</strong></p><button type="button" class="btn accent block" id="next2">Continue</button>`:""}`;
  if (step===2) html=`${dots}<h1>Turn on the fashion AI?</h1><p>It cuts your photos out cleanly, recognises each piece and its colour, recreates inspo fits and reads mirror pics.</p><p class="muted small">Runs on your phone. One-time download of about 200 MB, best on Wi-Fi.</p><button type="button" class="btn accent block" id="aiYes">Turn it on</button><button type="button" class="linkbtn" id="next">Not now</button>`;
  if (step===3) html=`${dots}<h1>Add your first pieces</h1><p>Start with what you wear most: a few tops, trousers, shoes, a jacket, your everyday jewellery. Pick several photos at once and tag them in a row.</p><button type="button" class="btn primary block" id="obLib">Pick photos</button><button type="button" class="btn block" id="obCam">Take a photo</button><button type="button" class="linkbtn" id="done">Look around first</button>`;
  const p=openSheet(html,{full:true}), go=n=>onboarding(n);
  const on=(id,fn)=>{ const el=p.querySelector(id); if (el) el.onclick=fn; };
  on("#next",()=>go(step+1)); on("#next2",()=>go(step+1));
  on("#gps",async()=>{ if (await useGPS()) go(2); });
  on("#search",()=>{ locationSheet(); const back=new MutationObserver(()=>{ if ($("#sheet").hidden){ back.disconnect(); go(S.loc?2:1); } }); back.observe($("#sheet"),{attributes:true,attributeFilter:["hidden"]}); });
  on("#aiYes",()=>{ enableAI(); go(3); });
  const finish=async()=>{ S.onboarded=true; await kvSet("onboarded",true); closeSheet(); render(); };
  on("#obLib",async()=>{ await finish(); $("#fileLib").click(); }); on("#obCam",async()=>{ await finish(); $("#fileCam").click(); }); on("#done",finish);
}

/* ================= boot ================= */
document.querySelectorAll("nav.tabs button").forEach(b=>b.onclick=()=>setTab(b.dataset.tab));
$("#addBtn").onclick=()=>addMenu(); $("#avatarBtn").onclick=()=>setTab("you");
window.addEventListener("online",()=>fetchWeather());
document.addEventListener("visibilitychange",()=>{ if (document.visibilityState==="visible"&&S.ready){ fetchWeather(); if (S.tab==="today"&&$("#sheet").hidden) render(); } });
window.addEventListener("popstate",()=>{ if (!$("#sheet").hidden){ const wasOb=!S.onboarded; closeSheet(); if (wasOb){ S.onboarded=true; kvSet("onboarded",true); } } });
render();
(async()=>{
  try{
    const [items,settings,profile,loc,weather,history,saved,dismissed,onboarded,photos,taste,plan,review]=await Promise.all([itemsAll(),kvGet("settings"),kvGet("profile"),kvGet("loc"),kvGet("weather"),kvGet("history"),kvGet("saved"),kvGet("dismissed"),kvGet("onboarded"),photosAll(),kvGet("taste"),kvGet("plan"),kvGet("colorReview")]);
    S.items=(items||[]).map(i=>({pinned:false,inWash:false,wearCount:0,added:0,warmth:2,form:1,fit:"regular",...i}));
    for (const i of S.items){ if (i.cat==="shoes"&&!i.sub) i.sub="sneaker"; if (!i.colorName&&i.cat!=="jewelry") i.colorName=COL.nameHex(i.color||"#808080"); }
    S.settings={...DEFAULT_SETTINGS,...(settings||{})}; S.profile={...DEFAULT_PROFILE,name:(profile||{}).name||""};
    S.loc=loc||null; S.weather=weather||null; S.history=history||{wear:[],pairs:{}}; S.saved=saved||[]; S.dismissed=(dismissed||[]).filter(id=>String(id).startsWith("g-")); S.onboarded=!!onboarded;
    S.photos=photos||[]; S.taste=taste||{w:{},n:0}; S.plan=plan||null; S.colorReview=review||[];
    /* migrate v4/v5 diary entries into the worn log */
    let mig=false;
    for (const e of S.photos){ let w=e.wearT&&S.history.wear.find(x=>x.t===e.wearT);
      if (!w){ w={t:e.t,ids:e.itemIds||[],rating:e.rating||null,tags:e.tags||[],rated:!!e.rating,temp:null,fromMirror:true}; S.history.wear.push(w); e.wearT=w.t; mig=true; }
      if (!w.photoId){ w.photoId=e.id; mig=true; if (!w.rating&&e.rating){ w.rating=e.rating; w.rated=true; w.tags=[...new Set([...(w.tags||[]),...(e.tags||[])])]; } } }
    if (mig){ S.history.wear.sort((a,b)=>a.t-b.t); await saveHistory(); for (const e of S.photos) await photoPut(e); }
  }catch{ toast("This browser blocked storage, so nothing will be saved. Open Daily Fit as an installed app."); }
  applyTheme();
  let h=location.hash.slice(1); if (h==="settings") h="you"; if (["today","closet","shop","you"].includes(h)){ S.tab=h; document.querySelectorAll("nav.tabs button").forEach(b=>b.setAttribute("aria-current",String(b.dataset.tab===h))); }
  S.ready=true; render();
  if (!S.onboarded) onboarding(0);
  fetchWeather();
  if (S.settings.aiEnabled&&AI) AI.load().then(afterAILoad).catch(()=>{});
  if (navigator.storage&&navigator.storage.persist) navigator.storage.persist().catch(()=>{});
  if ("serviceWorker" in navigator&&location.protocol!=="file:") navigator.serviceWorker.register("sw.js").catch(()=>{});
  window.__df=S; window.__dfx={generate,conditions,feed,analyzeGaps,titleOf,partsOf,cname};
})();
})();
