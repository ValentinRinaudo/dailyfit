/* Daily Fit garment drawings: simple flat silhouettes, filled with the piece's colour. Used in the Shop. */
(function(root){
"use strict";
const S = {
  tee:'<path d="M31 17 43 13q7 9 14 0l12 4 17 15-10 10-6-5v50H30V37l-6 5-10-10z"/>',
  shirt:'<path d="M32 15 44 11l6 9 6-9 12 4 12 10 8 46-10 2-8-31v47H30V42l-8 31-10-2 8-46z"/><path class="ln" d="M50 20v66M44 11l6 9 6-9"/>',
  hoodie:'<path d="M36 18Q50 0 64 18l16 8 8 46-10 2-8-31v47H30V43l-8 31-10-2 8-46z"/><path class="ln" d="M40 22q10 10 20 0M38 66h24v12H38z"/>',
  sweater:'<path d="M34 15q16 9 32 0l14 9 8 48-10 2-8-31v45H30V43l-8 31-10-2 8-48z"/><path class="ln" d="M30 82h40M22 70l-10-2M78 70l10-2"/>',
  jacket:'<path d="M32 13 44 11l6 7 6-7 12 2 14 10 6 51-10 2-6-32v46H28V44l-6 32-10-2 6-51z"/><path class="ln" d="M50 18v72M44 11l-2 14 8-7M56 11l2 14-8-7"/>',
  puffer:'<path d="M30 14Q50 6 70 14l14 10 6 50-12 3-6-32v45H28V45l-6 32-12-3 6-50z"/><path class="ln" d="M28 34h44M28 50h44M28 66h44M28 80h44M50 14v76"/>',
  coat:'<path d="M32 10 44 8l6 10 6-10 12 2 13 10 7 64-10 2-8-38v56H30V48l-8 38-10-2 7-64z"/><path class="ln" d="M50 18v76M44 8l-4 26 10-16M56 8l4 26-10-16"/>',
  vest:'<path d="M34 12q16 8 32 0l6 12v66H28V24z"/><path class="ln" d="M50 18v72M28 40h44M28 58h44M28 74h44"/>',
  trousers:'<path d="M28 10h44l6 82H56L50 38l-6 54H22z"/><path class="ln" d="M28 18h44"/>',
  cargo:'<path d="M27 10h46l7 82H56L50 38l-6 54H20z"/><path class="ln" d="M27 18h46M23 52h12v14H23zM65 52h12v14H65z"/>',
  shorts:'<path d="M27 22h46l5 42H55l-5-24-5 24H22z"/><path class="ln" d="M27 30h46"/>',
  sneaker:'<path d="M9 64q2-20 17-20l17-4q9 13 28 15l16 4q6 4 4 14H11z"/><path class="ln" d="M10 70h82M30 48l6 8M38 46l6 8"/>',
  boot:'<path d="M26 16h26l2 40q22 2 32 9 5 6 3 15H24z"/><path class="ln" d="M24 74h66M30 26h20"/>',
  loafer:'<path d="M9 68q4-14 21-14l28-2q20 2 31 10 4 7 0 13H11z"/><path class="ln" d="M44 54q8 6 18 2"/>',
  sandal:'<path d="M12 70q0-8 10-8h56q12 0 12 8t-12 6H22q-10 0-10-6z"/><path class="ln" d="M32 64q14-18 28 0"/>',
  cap:'<path d="M20 60q2-32 30-34 26 2 28 34z"/><path d="M70 58q18-1 24 9H62z"/><path class="ln" d="M50 26v34"/>',
  beanie:'<path d="M24 62q0-38 26-40 26 2 26 40z"/><path d="M21 58h58v15H21z"/><path class="ln" d="M30 58v15M40 58v15M50 58v15M60 58v15M70 58v15"/>',
  skull:'<path d="M24 66q0-30 26-32 26 2 26 32z"/><path d="M22 62h56v10H22z"/>',
  bucket:'<path d="M30 52q2-26 20-26t20 26z"/><path d="M14 66l16-14h40l16 14z"/>',
  balaclava:'<path d="M26 88V44q0-30 24-30t24 30v44z"/><path class="hole" d="M34 40h32v12H34z"/>',
  gloves:'<path d="M30 90V46l-6-16q-2-6 3-7t7 5l4 10V18q0-5 4-5t4 5v18-24q0-5 4-5t4 5v24-20q0-5 4-5t4 5v24-14q0-5 4-5t4 5v34q0 10-6 18v18z"/>',
  chain:'<path class="ln thick" d="M22 20q2 50 28 58 26-8 28-58"/><path class="ln" d="M22 20q2 50 28 58 26-8 28-58" stroke-dasharray="3 3"/>',
  ring:'<circle class="ln thick" cx="50" cy="54" r="22"/><path d="M42 26h16l-4 8H46z"/>',
  bracelet:'<ellipse class="ln thick" cx="50" cy="52" rx="32" ry="20"/>',
  watch:'<path d="M40 8h20l2 28H38zM38 64h24l-2 28H40z"/><circle cx="50" cy="50" r="17"/><path class="ln" d="M50 42v8l6 4"/>',
  earring:'<circle class="ln thick" cx="50" cy="56" r="14"/>',
  bag:'<path d="M22 44h56l4 38H18z"/><path class="ln thick" d="M26 44Q50-6 74 44"/><path class="ln" d="M22 56h56"/>',
  sunglasses:'<path d="M10 42h34l-3 18q-2 8-12 8H19q-9 0-9-10zM56 42h34v16q0 10-9 10H71q-10 0-12-8z"/><path class="ln thick" d="M44 46q6-5 12 0"/>',
  belt:'<path d="M6 44h88v14H6z"/><path class="hole" d="M58 40h16v22H58z"/>'
};
const KIND = {"t-shirt":"tee","polo shirt":"tee","tank top":"tee","button-up shirt":"shirt","flannel shirt":"shirt",
  "hoodie":"hoodie","sweatshirt":"sweater","crewneck sweatshirt":"sweater","knit sweater":"sweater","jumper":"sweater","cardigan":"sweater","fleece pullover":"sweater","quarter-zip sweater":"sweater",
  "jacket":"jacket","zip-up track jacket":"jacket","bomber jacket":"jacket","denim jacket":"jacket","leather jacket":"jacket","windbreaker":"jacket","blazer":"jacket","puffer jacket":"puffer","parka":"puffer","coat":"coat","gilet vest":"vest",
  "jeans":"trousers","trousers":"trousers","chinos":"trousers","sweatpants":"trousers","track pants":"trousers","cargo pants":"cargo","shorts":"shorts",
  "sneakers":"sneaker","running shoes":"sneaker","boots":"boot","loafers":"loafer","dress shoes":"loafer","sandals":"sandal","flip flops":"sandal","slides":"sandal",
  "baseball cap":"cap","beanie":"beanie","bucket hat":"bucket","balaclava":"balaclava","gloves":"gloves",
  "necklace":"chain","chain necklace":"chain","ring":"ring","bracelet":"bracelet","wristwatch":"watch","earring":"earring",
  "backpack":"bag","crossbody bag":"bag","tote bag":"bag","sunglasses":"sunglasses","belt":"belt"};
const CAT_DEFAULT = {top:"tee",layer:"sweater",outer:"jacket",bottom:"trousers",shoes:"sneaker",hat:"beanie",gloves:"gloves",jewelry:"chain",acc:"bag"};
const SUB_SHAPE = {cap:"cap",skullcap:"skull",beanie:"beanie",balaclava:"balaclava",bucket:"bucket",chain:"chain",pendant:"chain",ring:"ring",bracelet:"bracelet",watch:"watch",earring:"earring",bag:"bag",sunglasses:"sunglasses",belt:"belt",
  sneaker:"sneaker",boot:"boot",dress:"loafer",open:"sandal"};
function shade(hex, f){ const n=parseInt(hex.slice(1),16); const ch=[n>>16&255,n>>8&255,n&255].map(c=>Math.round(f<0?c*(1+f):c+(255-c)*f)); return "#"+ch.map(c=>c.toString(16).padStart(2,"0")).join(""); }
function lum(hex){ const n=parseInt(hex.slice(1),16); return (0.299*(n>>16&255)+0.587*(n>>8&255)+0.114*(n&255))/255; }
function svg(item, hex){
  const key = (item.sub && SUB_SHAPE[item.sub]) || KIND[item.kind] || CAT_DEFAULT[item.cat] || "tee";
  const fill = hex || "#888888", L=lum(fill), line = L<0.25 ? shade(fill,.35) : shade(fill,-.35);
  return `<svg class="art" viewBox="0 0 100 100" role="img" aria-label="${item.name||key}"><g fill="${fill}" stroke="${line}" stroke-width="1.6" stroke-linejoin="round">${S[key]}</g>
</svg>`;
}
root.DFArt = { svg, KIND };
})(window);
