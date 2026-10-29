/* Daily Fit bundled data. Ships with the app: no network, no AI needed.
   Trend signals compiled October 2026 from the sources listed; they act silently as a small bonus in fit scoring. */
window.DF_DATA = {
  version: "2026-10b",
  compiled: "October 2026",

  /* trend signals (regions "all" or region codes). match: cats/kinds/colors/fits; layersMin; accessory; accentOne */
  signals: [
    {id:"relaxed-denim", regions:["all"], name:"Relaxed and straight denim", strength:3, match:{cats:["bottom"], fits:["relaxed","wide"]},
     sources:["https://www.aol.com/gen-z-men-embracing-baggy-035425086.html","https://monfrerefashion.com/en-mx/blogs/news/mens-street-style-trends-2026-whats-in-whats-out-and-how-to-wear-it"]},
    {id:"earth-tones", regions:["all"], name:"Earth tones", strength:3, match:{colors:["brown","olive","beige","khaki","cream"]},
     sources:["https://www.highsnobiety.com/p/menswear-2025-trends-review-ssense/"]},
    {id:"tech-shell", regions:["all"], name:"Technical shells", strength:2, match:{kinds:["windbreaker","zip-up track jacket","puffer jacket","parka","gilet vest"]},
     sources:["https://pausemag.co.uk/2025/12/mens-fashion-trends-2026-street-style-nightlife-aesthetics-modern-menswear/"]},
    {id:"three-layers", regions:["all"], name:"Three layers plus an accent", strength:2, match:{layersMin:3, accessory:true},
     sources:["https://pausemag.co.uk/2025/12/mens-fashion-trends-2026-street-style-nightlife-aesthetics-modern-menswear/"]},
    {id:"headwear", regions:["all"], name:"Skull caps and balaclavas", strength:2, match:{cats:["hat"], subs:["skullcap","balaclava","beanie"]},
     sources:["https://www.highsnobiety.com/p/post-beanie-hats/"]},
    {id:"knit-mid", regions:["all"], name:"Quarter-zips and cardigans", strength:1, match:{kinds:["quarter-zip sweater","cardigan","knit sweater"]},
     sources:["https://www.highsnobiety.com/p/menswear-2025-trends-review-ssense/"]},
    {id:"k-layers", regions:["KR"], name:"Oversized layers on loose denim", strength:2, match:{cats:["outer","layer"], fits:["relaxed","wide"]},
     sources:["https://blog.namanecard.com/zh/korean-fashion-trends-2026-seoul-streetwear-zh/"]},
    {id:"eu-black-accent", regions:["DE","CH"], name:"Black base, one accent", strength:2, match:{colors:["black"], accentOne:true},
     sources:["https://www.nssmag.com/en/fashion/46096/the-best-street-style-looks-from-berlin-fashion-week-ss27-men-s"]},
    {id:"eu-leather", regions:["DE","CH"], name:"Leather outer layers", strength:1, match:{kinds:["leather jacket"]},
     sources:["https://www.nssmag.com/en/fashion/46096/the-best-street-style-looks-from-berlin-fashion-week-ss27-men-s"]}
  ],

  /* pieces the Shop can suggest. The app ranks them by how many new fits each one unlocks with YOUR closet and weather. */
  gaps: [
    {id:"g-tee-white", kind:"t-shirt", cat:"top", color:"white", warmth:1, form:1, fit:"relaxed", name:"White heavyweight tee", q:{en:"heavyweight white t-shirt", ko:"헤비웨이트 화이트 반팔", de:"Heavyweight T-Shirt weiß Herren"}, price:{KR:"about KRW 29,000 at Musinsa Standard"}, priceSource:"https://www.seoulz.com/musinsa-k-fashion-empire-2026/"},
    {id:"g-tee-black", kind:"t-shirt", cat:"top", color:"black", warmth:1, form:1, fit:"relaxed", name:"Black heavyweight tee", q:{en:"heavyweight black t-shirt", ko:"헤비웨이트 블랙 반팔", de:"Heavyweight T-Shirt schwarz Herren"}},
    {id:"g-shirt-oxford", kind:"button-up shirt", cat:"top", color:"light grey", warmth:1, form:2, fit:"relaxed", name:"Light oxford shirt", q:{en:"relaxed oxford shirt", ko:"옥스포드 셔츠", de:"Oxford Hemd Herren relaxed"}},
    {id:"g-flannel", kind:"flannel shirt", cat:"top", color:"brown", warmth:2, form:1, fit:"relaxed", name:"Brown flannel shirt", q:{en:"brown flannel shirt men", ko:"브라운 플란넬 셔츠", de:"Flanellhemd braun Herren"}},
    {id:"g-hoodie-grey", kind:"hoodie", cat:"layer", color:"grey", warmth:2, form:1, fit:"relaxed", name:"Grey heavyweight hoodie", q:{en:"grey heavyweight hoodie", ko:"그레이 헤비웨이트 후드", de:"Hoodie grau Herren heavyweight"}},
    {id:"g-hoodie-black", kind:"hoodie", cat:"layer", color:"black", warmth:2, form:1, fit:"relaxed", name:"Black hoodie", q:{en:"black heavyweight hoodie", ko:"블랙 후드티", de:"Hoodie schwarz Herren"}},
    {id:"g-qzip", kind:"quarter-zip sweater", cat:"layer", color:"brown", warmth:2, form:2, fit:"relaxed", name:"Brown quarter-zip knit", q:{en:"brown quarter zip knit", ko:"브라운 하프집업 니트", de:"Troyer braun Herren"}},
    {id:"g-knit-cream", kind:"knit sweater", cat:"layer", color:"cream", warmth:2, form:2, fit:"relaxed", name:"Cream knit sweater", q:{en:"cream knit sweater men", ko:"크림 니트", de:"Strickpullover creme Herren"}},
    {id:"g-crew-navy", kind:"crewneck sweatshirt", cat:"layer", color:"navy", warmth:2, form:1, fit:"relaxed", name:"Navy crewneck sweatshirt", q:{en:"navy crewneck sweatshirt", ko:"네이비 맨투맨", de:"Sweatshirt navy Herren"}},
    {id:"g-puffer", kind:"puffer jacket", cat:"outer", color:"black", warmth:3, form:1, fit:"relaxed", name:"Black hooded puffer", q:{en:"black hooded puffer jacket", ko:"블랙 후드 패딩", de:"Pufferjacke schwarz Kapuze Herren"}, price:{KR:"about KRW 159,000 at Musinsa Standard"}, priceSource:"https://www.seoulz.com/musinsa-k-fashion-empire-2026/"},
    {id:"g-shell", kind:"windbreaker", cat:"outer", color:"olive", warmth:1, form:1, fit:"relaxed", name:"Olive shell jacket", q:{en:"olive shell jacket men", ko:"올리브 바람막이", de:"Windbreaker oliv Herren"}},
    {id:"g-denim-jacket", kind:"denim jacket", cat:"outer", color:"denim", warmth:2, form:1, fit:"relaxed", name:"Washed denim jacket", q:{en:"oversized denim jacket men", ko:"데님 자켓", de:"Jeansjacke Herren oversized"}},
    {id:"g-leather", kind:"leather jacket", cat:"outer", color:"black", warmth:2, form:2, fit:"relaxed", name:"Black leather jacket", q:{en:"boxy black leather jacket", ko:"블랙 레더 자켓", de:"Lederjacke schwarz Herren boxy"}},
    {id:"g-work-jacket", kind:"jacket", cat:"outer", color:"brown", warmth:2, form:1, fit:"relaxed", name:"Brown work jacket", q:{en:"brown canvas work jacket", ko:"브라운 워크 자켓", de:"Workwear Jacke braun Herren"}},
    {id:"g-coat", kind:"coat", cat:"outer", color:"dark grey", warmth:3, form:2, fit:"relaxed", name:"Charcoal wool coat", q:{en:"charcoal wool overcoat men", ko:"차콜 울 코트", de:"Wollmantel anthrazit Herren"}},
    {id:"g-jeans-black", kind:"jeans", cat:"bottom", color:"black", warmth:2, form:1, fit:"relaxed", name:"Black relaxed jeans", q:{en:"black relaxed straight jeans", ko:"블랙 와이드 데님", de:"Schwarze Jeans relaxed Herren"}},
    {id:"g-jeans-blue", kind:"jeans", cat:"bottom", color:"denim", warmth:2, form:1, fit:"relaxed", name:"Blue straight jeans", q:{en:"relaxed straight blue jeans", ko:"와이드 데님 팬츠", de:"Relaxed Fit Jeans blau Herren"}},
    {id:"g-sweats", kind:"sweatpants", cat:"bottom", color:"grey", warmth:2, form:1, fit:"relaxed", name:"Grey sweatpants", q:{en:"grey heavyweight sweatpants", ko:"그레이 스웻팬츠", de:"Jogginghose grau Herren"}},
    {id:"g-chinos", kind:"chinos", cat:"bottom", color:"beige", warmth:2, form:2, fit:"relaxed", name:"Beige wide chinos", q:{en:"beige wide chino pants", ko:"베이지 와이드 치노", de:"Chino beige weit Herren"}},
    {id:"g-cargo", kind:"cargo pants", cat:"bottom", color:"olive", warmth:2, form:1, fit:"wide", name:"Olive cargo pants", q:{en:"olive wide cargo pants", ko:"올리브 카고 팬츠", de:"Cargohose oliv weit Herren"}},
    {id:"g-trousers", kind:"trousers", cat:"bottom", color:"black", warmth:2, form:2, fit:"wide", name:"Black wide trousers", q:{en:"black wide pleated trousers", ko:"블랙 와이드 슬랙스", de:"Weite Hose schwarz Herren"}},
    {id:"g-sneaker-white", kind:"sneakers", cat:"shoes", color:"white", warmth:2, form:1, name:"White leather sneakers", q:{en:"white leather sneakers men", ko:"화이트 레더 스니커즈", de:"Weiße Leder Sneaker Herren"}},
    {id:"g-runner", kind:"running shoes", cat:"shoes", color:"grey", warmth:2, form:1, name:"Grey retro runners", q:{en:"grey retro running sneakers", ko:"그레이 레트로 러닝화", de:"Retro Runner grau Herren"}},
    {id:"g-boots", kind:"boots", cat:"shoes", color:"black", warmth:3, form:2, name:"Black leather boots", q:{en:"black leather boots men", ko:"블랙 워커 부츠", de:"Schwarze Lederboots Herren"}},
    {id:"g-loafers", kind:"loafers", cat:"shoes", color:"brown", warmth:2, form:2, name:"Brown suede loafers", q:{en:"brown suede loafers men", ko:"브라운 스웨이드 로퍼", de:"Wildleder Loafer braun Herren"}},
    {id:"g-skull", kind:"beanie", cat:"hat", sub:"skullcap", color:"black", warmth:1, form:1, name:"Black skull cap", q:{en:"short fisherman skull cap", ko:"숏비니 와치캡", de:"Skull Cap Mütze schwarz"}},
    {id:"g-beanie", kind:"beanie", cat:"hat", sub:"beanie", color:"grey", warmth:2, form:1, name:"Grey wool beanie", q:{en:"grey wool beanie", ko:"그레이 울 비니", de:"Wollmütze grau"}},
    {id:"g-balaclava", kind:"balaclava", cat:"hat", sub:"balaclava", color:"black", warmth:3, form:1, name:"Black knit balaclava", q:{en:"black knit balaclava", ko:"블랙 바라클라바", de:"Sturmhaube Strick schwarz"}},
    {id:"g-cap", kind:"baseball cap", cat:"hat", sub:"cap", color:"navy", warmth:1, form:1, name:"Navy washed cap", q:{en:"navy washed baseball cap", ko:"네이비 볼캡", de:"Basecap navy washed"}},
    {id:"g-gloves", kind:"gloves", cat:"gloves", color:"black", warmth:2, form:1, name:"Black leather gloves", q:{en:"black leather gloves men", ko:"블랙 가죽 장갑", de:"Lederhandschuhe schwarz Herren"}},
    {id:"g-chain", kind:"chain necklace", cat:"jewelry", sub:"chain", metal:"silver", color:"light grey", warmth:1, form:1, name:"Silver curb chain", q:{en:"silver curb chain 3mm men", ko:"실버 체인 목걸이", de:"Silberkette Herren 3mm"}},
    {id:"g-ring", kind:"ring", cat:"jewelry", sub:"ring", metal:"silver", color:"light grey", warmth:1, form:1, name:"Silver signet ring", q:{en:"silver signet ring men", ko:"실버 시그넷 반지", de:"Siegelring Silber Herren"}},
    {id:"g-bag", kind:"crossbody bag", cat:"acc", sub:"bag", color:"black", warmth:1, form:1, name:"Black crossbody bag", q:{en:"black nylon crossbody bag", ko:"블랙 크로스백", de:"Crossbody Bag schwarz Herren"}},
    {id:"g-sunnies", kind:"sunglasses", cat:"acc", sub:"sunglasses", color:"black", warmth:1, form:1, name:"Black sunglasses", q:{en:"black acetate sunglasses men", ko:"블랙 선글라스", de:"Sonnenbrille schwarz Herren"}}
  ],

  /* ---- regions, cities and stores (addresses from the cited guides) ---- */
  regions: {
    KR: {name:"South Korea", lang:"ko", search:{name:"Musinsa", url:"https://www.musinsa.com/search/goods?keyword="},
      online:[{name:"Musinsa", url:"https://www.musinsa.com"},{name:"29CM", url:"https://www.29cm.co.kr"},{name:"KREAM (resale)", url:"https://kream.co.kr"}],
      brands:["thisisneverthat","mahagrid","Covernat","IISE","Andersson Bell","ADER Error","POST ARCHIVE FACTION"],
      cities:[{name:"Seoul", lat:37.5665, lon:126.978, stores:[
        {name:"Musinsa Megastore Seongsu", area:"Seongsu", address:"Seongsui-ro, Seongdong-gu, Seoul (near Seoul Forest)", note:"Five floors incl. Musinsa Standard, Bag & Cap Club, KICKS shoe wall", source:"https://www.koreatimes.co.kr/amp/lifestyle/20260424/musinsa-opens-seongsu-megastore-to-challenge-olive-young"},
        {name:"Musinsa Standard Seongsu", area:"Seongsu", address:"83 Yeonmujang-gil, Seongdong-gu, Seoul", source:"https://creatrip.com/en/news/14284"},
        {name:"Musinsa Standard Hongdae", area:"Hongdae", address:"144 Yanghwa-ro, Mapo-gu, Seoul", source:"https://creatrip.com/en/news/14284"},
        {name:"Musinsa Hongdae", area:"Hongdae", address:"164 Yanghwa-ro, Mapo-gu, Seoul", source:"https://creatrip.com/en/news/14284"},
        {name:"Musinsa Standard Gangnam", area:"Gangnam", address:"54 Seocho-daero 77-gil, Seocho-gu, Seoul", source:"https://creatrip.com/en/news/14284"},
        {name:"Worksout", area:"Hongdae", address:"Hongdae, Mapo-gu, Seoul", note:"Sneakers and streetwear", source:"https://blog.namanecard.com/zh/korean-fashion-trends-2026-seoul-streetwear-zh/"}
      ]}]},
    DE: {name:"Germany", lang:"de", search:{name:"Zalando", url:"https://www.zalando.de/katalog/?q="},
      online:[{name:"Zalando", url:"https://www.zalando.de"},{name:"END.", url:"https://www.endclothing.com"},{name:"BSTN", url:"https://www.bstn.com"},{name:"Solebox", url:"https://www.solebox.com"}],
      brands:["Carhartt WIP","Stüssy","Norse Projects","Arc'teryx","Our Legacy"],
      cities:[
        {name:"Berlin", lat:52.52, lon:13.405, stores:[
          {name:"Overkill", area:"Kreuzberg", address:"Köpenicker Str. 195A, 10997 Berlin", note:"Large sneaker and streetwear store", source:"https://www.sneakerjagers.com/en/n/sneaker-touring-the-15-best-sneaker-shops-in-berlin/23388"},
          {name:"Voo Store", area:"Kreuzberg", address:"Oranienstraße 24, 10999 Berlin", note:"Concept store with café", source:"https://www.sneakerjagers.com/en/n/sneaker-touring-the-15-best-sneaker-shops-in-berlin/23388"},
          {name:"SOTO", area:"Mitte", address:"Torstraße 72, 10119 Berlin", note:"Menswear and sneakers", source:"https://www.sneakerjagers.com/en/n/sneaker-touring-the-15-best-sneaker-shops-in-berlin/23388"},
          {name:"Sneakersnstuff Berlin", area:"Mitte", address:"Schönhauser Allee 6-7, 10119 Berlin", source:"https://www.sneakerjagers.com/en/n/sneaker-touring-the-15-best-sneaker-shops-in-berlin/23388"},
          {name:"Solebox Berlin", area:"Schöneberg", address:"Nürnberger Str. 14, 10789 Berlin", source:"https://www.sneakerjagers.com/en/n/sneaker-touring-the-15-best-sneaker-shops-in-berlin/23388"},
          {name:"HHV Berlin", area:"Friedrichshain", address:"Grünberger Str. 54, 10245 Berlin", note:"Streetwear, sneakers, vinyl", source:"https://www.sneakerjagers.com/en/n/sneaker-touring-the-15-best-sneaker-shops-in-berlin/23388"},
          {name:"Stickabush", area:"Neukölln", address:"Friedelstraße 52, 12047 Berlin", source:"https://www.sneakerjagers.com/en/n/sneaker-touring-the-15-best-sneaker-shops-in-berlin/23388"},
          {name:"Paul's Boutique", area:"Prenzlauer Berg", address:"Oderberger Str. 47, 10435 Berlin", note:"Second-hand clothing and sneakers", source:"https://www.sneakerjagers.com/en/n/sneaker-touring-the-15-best-sneaker-shops-in-berlin/23388"}
        ]},
        {name:"Hamburg", lat:53.5511, lon:9.9937, stores:[
          {name:"BSTN Hamburg", area:"Schanze", address:"Schanzenstraße 52, 20357 Hamburg", source:"https://www.sneakerjagers.com/en/n/sneaker-city-shopping-guide-the-13-best-sneaker-shops-in-hamburg/6609"},
          {name:"Carhartt WIP", area:"Schanze", address:"Schanzenstraße 27, 20357 Hamburg", source:"https://www.sneakerjagers.com/en/n/sneaker-city-shopping-guide-the-13-best-sneaker-shops-in-hamburg/6609"},
          {name:"Underpressure", area:"Schanze", address:"Schanzenstraße 10, 20357 Hamburg", note:"Sneakers, streetwear, graffiti", source:"https://www.sneakerjagers.com/en/n/sneaker-city-shopping-guide-the-13-best-sneaker-shops-in-hamburg/6609"},
          {name:"Lobby Skateshop", area:"Karoviertel", address:"Marktstraße 145, 20357 Hamburg", note:"Stüssy, Palace", source:"https://www.sneakerjagers.com/en/n/sneaker-city-shopping-guide-the-13-best-sneaker-shops-in-hamburg/6609"},
          {name:"JustFitteds", area:"Karoviertel", address:"Feldstraße 31, 20357 Hamburg", note:"Cap specialist", source:"https://www.sneakerjagers.com/en/n/sneaker-city-shopping-guide-the-13-best-sneaker-shops-in-hamburg/6609"},
          {name:"Allike & a.plus", area:"Altona", address:"Virchowstraße 2, 22767 Hamburg", source:"https://www.sneakerjagers.com/en/n/sneaker-city-shopping-guide-the-13-best-sneaker-shops-in-hamburg/6609"}
        ]},
        {name:"Munich", lat:48.1351, lon:11.582, stores:[
          {name:"BSTN Munich", area:"Maxvorstadt", address:"Amalienstraße 44, 80799 München", source:"https://bstn.com/eu_fr/bstn-stores"},
          {name:"Solebox Munich", area:"Altstadt", address:"Altheimer Eck 6, 80331 München", source:"https://www.sneakerjagers.com/n/sneaker-shopping-city-guide-8-sneakerwinkels-in-munchen/220376"},
          {name:"TINT", area:"Gärtnerplatz", address:"Klenzestraße 22, 80469 München", note:"Stüssy, Carhartt", source:"https://www.sneakerjagers.com/n/sneaker-shopping-city-guide-8-sneakerwinkels-in-munchen/220376"},
          {name:"Solefood", area:"Glockenbach", address:"Reichenbachstraße 38, 80469 München", source:"https://www.sneakerjagers.com/n/sneaker-shopping-city-guide-8-sneakerwinkels-in-munchen/220376"},
          {name:"Laced Up Store", area:"Schwanthalerhöhe", address:"Theresienhöhe 5, 80339 München", source:"https://www.sneakerjagers.com/n/sneaker-shopping-city-guide-8-sneakerwinkels-in-munchen/220376"},
          {name:"KICKZ Stachus", area:"Altstadt", address:"Herzog-Wilhelm-Straße 1, 80331 München", source:"https://www.sneakerjagers.com/n/sneaker-shopping-city-guide-8-sneakerwinkels-in-munchen/220376"}
        ]}
      ]},
    CH: {name:"Switzerland", lang:"de", search:{name:"Zalando", url:"https://www.zalando.ch/katalog/?q="},
      online:[{name:"Zalando", url:"https://www.zalando.ch"},{name:"END.", url:"https://www.endclothing.com"}],
      brands:["Carhartt WIP","Stüssy","Norse Projects","Arc'teryx","Our Legacy"],
      cities:[{name:"Zurich", lat:47.3769, lon:8.5417, stores:[
        {name:"Street-Files Viadukt", area:"Kreis 5", address:"Viaduktstrasse 31, 8005 Zürich", source:"https://www.sneakerjagers.com/de/n/sneaker-shopping-guide-die-11-besten-sneaker-shops-in-zuerich/250096"},
        {name:"District 5 Sneakerstore", area:"Kreis 5", address:"Josefstrasse 93, 8005 Zürich", source:"https://www.sneakerjagers.com/de/n/sneaker-shopping-guide-die-11-besten-sneaker-shops-in-zuerich/250096"},
        {name:"Titolo", area:"Niederdorf", address:"Niederdorfstrasse 10, 8001 Zürich", source:"https://www.sneakerjagers.com/de/n/sneaker-shopping-guide-die-11-besten-sneaker-shops-in-zuerich/250096"},
        {name:"Sneaker ZH", area:"Kreis 4", address:"Körnerstrasse 8, 8004 Zürich", source:"https://www.sneakerjagers.com/de/n/sneaker-shopping-guide-die-11-besten-sneaker-shops-in-zuerich/250096"},
        {name:"Pomp it Up", area:"Altstadt", address:"Oberdorfstrasse 23, 8001 Zürich", source:"https://www.sneakerjagers.com/de/n/sneaker-shopping-guide-die-11-besten-sneaker-shops-in-zuerich/250096"},
        {name:"Blue Tomato", area:"Altstadt", address:"Limmatquai 122, 8001 Zürich", note:"Skate: Dickies, Carhartt WIP", source:"https://www.sneakerjagers.com/de/n/sneaker-shopping-guide-die-11-besten-sneaker-shops-in-zuerich/250096"},
        {name:"Diallo Store", area:"Altstadt", address:"Schoffelgasse 6, 8001 Zürich", note:"Designer streetwear", source:"https://www.sneakerjagers.com/de/n/sneaker-shopping-guide-die-11-besten-sneaker-shops-in-zuerich/250096"}
      ]}]},
    GLOBAL: {name:"Elsewhere", lang:"en", search:{name:"END.", url:"https://www.endclothing.com/search?q="},
      online:[{name:"END.", url:"https://www.endclothing.com"},{name:"SSENSE", url:"https://www.ssense.com"},{name:"Uniqlo", url:"https://www.uniqlo.com"}],
      brands:["Carhartt WIP","Stüssy","Arc'teryx","Uniqlo U"],
      cities:[]}
  }
};
