/* Tastevin : carnet de dégustation. Tout est gardé sur le téléphone, puis synchronisé avec le serveur (backend/). */
(function(){
"use strict";

var API = "https://script.google.com/macros/s/AKfycbx6TtDCO3fKeaxl26MX8qkIV5tPDdk2MYaPyFnI72DFk0Vw0nN3a92kGUcFXjVCpKIgtA/exec";   // URL « /exec » du serveur Google Apps Script (backend/README.md)
var KEY = "tastevin-v1";

function $(id){ return document.getElementById(id); }
function esc(t){ return String(t == null ? "" : t).replace(/[&<>"]/g, function(c){ return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]; }); }
function trim(v){ return v == null ? "" : String(v).trim(); }
function uid(){ return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function p2(n){ return (n < 10 ? "0" : "") + n; }
function today(){ var d = new Date(); return d.getFullYear() + "-" + p2(d.getMonth() + 1) + "-" + p2(d.getDate()); }
var MOIS = ["janv.","févr.","mars","avr.","mai","juin","juil.","août","sept.","oct.","nov.","déc."];
function fdate(iso){ var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || ""); return m ? parseInt(m[3], 10) + " " + MOIS[parseInt(m[2], 10) - 1] + " " + m[1] : ""; }
function norm(t){ return String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""); }
var toastT = 0;
function toast(msg){ var t = $("toast"); t.textContent = msg; t.classList.add("on"); clearTimeout(toastT); toastT = setTimeout(function(){ t.classList.remove("on"); }, 2600); }

/* ---------- Données ---------- */
var S = {t:{}, queue:[], me:"", code:"", local:false, last:0, draft:null};
try { var saved = JSON.parse(localStorage.getItem(KEY) || "null"); if (saved) Object.keys(S).forEach(function(k){ if (saved[k] != null) S[k] = saved[k]; }); } catch(e) {}
function save(){ try { localStorage.setItem(KEY, JSON.stringify(S)); } catch(e) { toast("Mémoire du téléphone pleine : synchronise pour libérer les photos"); } }
function list(){ return Object.keys(S.t).map(function(k){ return S.t[k]; }).filter(function(x){ return !x.deleted; }); }
function put(item){ S.t[item.id] = item; if (S.queue.indexOf(item.id) < 0) S.queue.push(item.id); save(); sync(); }

var T_TYPES = {
  vin:{icon:"🍷", label:"Vin", fams:[["Blanc","#EBD77A"],["Rouge","#9B1B30"],["Rosé","#F4B092"],["Orange","#E59A3A"],["Effervescent","#F3E9A0"],["Moelleux / liquoreux","#C8963A"]]},
  biere:{icon:"🍺", label:"Bière", fams:[["Blonde","#ECC14A"],["Blanche","#F0E2A6"],["Ambrée","#B9672A"],["Brune","#6B3A1E"],["Stout / porter","#2A1A12"],["IPA","#D9A33A"],["Lager / pils","#F6E27F"],["Triple / abbaye","#D49A3A"],["Sour / gueuze","#E8B86A"]]},
  spiritueux:{icon:"🥃", label:"Spiritueux", fams:[["Whisky","#C27A2C"],["Rhum","#9A5420"],["Cognac / armagnac","#8A4A1C"],["Eau-de-vie de fruit","#F4F6F8"],["Gin","#EEF3F5"],["Vodka","#F4F6F8"],["Liqueur","#7FA34A"],["Marc","#E7D9A6"]]}
};
var T_COLORS = {
  "vin:Blanc":[["Vert pâle","#E6EAB2"],["Citron","#EFE7A1"],["Jaune pâle","#F1DF8C"],["Jaune paille","#E8CF6E"],["Doré","#DDB84A"],["Or","#D3A63E"],["Vieil or","#C8963A"],["Ambre clair","#CFA552"],["Ambré","#A86A2A"]],
  "vin:Rouge":[["Rubis clair","#B8323F"],["Cerise","#A8213A"],["Rubis","#9B1B30"],["Pourpre","#6E1640"],["Violacé","#5B1640"],["Grenat","#7A1F2B"],["Tuilé","#8F3E2A"],["Brique","#A0522D"]],
  "vin:Rosé":[["Gris","#F2DCD3"],["Pétale","#F5C6C3"],["Pêche","#F4B092"],["Saumon","#EE9779"],["Corail","#E9785F"],["Framboise","#D9536B"]],
  "vin:Orange":[["Orangé","#E59A3A"],["Cuivré","#C0702F"],["Ambré","#A86A2A"]],
  "vin:Effervescent":[["Blanc argenté","#F1EFD8"],["Jaune pâle","#F3E9A0"],["Doré","#DDB84A"],["Rosé","#F5C3C2"]],
  "vin:Moelleux / liquoreux":[["Doré","#DDB84A"],["Vieil or","#C8963A"],["Topaze","#B57B2C"],["Ambré","#A86A2A"]],
  biere:[["Voilée","#F0E2A6"],["Paille","#F6E27F"],["Blonde","#ECC14A"],["Dorée","#D9A33A"],["Ambrée","#B9672A"],["Cuivrée","#A0522D"],["Brune","#6B3A1E"],["Noire","#2A1A12"]],
  spiritueux:[["Vert","#9BBF4A"],["Incolore","#F4F6F8"],["Paille","#EBD77A"],["Or","#D9A33A"],["Ambre","#B9672A"],["Cuivré","#A0522D"],["Acajou","#7A3B1C"]]
};
var T_ASPECT = {
  base:["Limpide","Brillant","Voilé","Trouble","Soyeux","Huileux","Crémeux","Pétillant","Larmes fines","Larmes grasses"],
  biere:["Mousse fine","Mousse épaisse","Mousse tenace","Bulles fines","Bulles grossières"],
  spiritueux:["Jambes lentes","Jambes rapides"]
};
var T_AROMES = [
  ["fruite","🍎","Fruité",["Agrumes","Pomme","Poire","Pêche","Abricot","Coing","Fruits exotiques","Litchi","Fruits rouges","Fruits noirs","Fruits secs","Fruits confits"]],
  ["floral","🌸","Floral",["Fleurs blanches","Acacia","Rose","Violette","Tilleul","Sureau","Miel"]],
  ["vegetal","🌿","Végétal",["Herbe coupée","Foin","Poivron","Fougère","Menthe","Thé","Houblon herbacé","Houblon résineux","Houblon agrumes"]],
  ["mineral","💎","Minéral",["Pierre à fusil","Silex","Craie","Iodé","Hydrocarbure","Graphite"]],
  ["lactique","🥛","Lactique",["Beurre","Crème","Lait","Yaourt","Fromage"]],
  ["fermentaire","🍞","Fermentaire",["Levure","Brioche","Pain","Mie de pain","Malt","Céréales","Biscuit"]],
  ["chimique","🧪","Chimique",["Soufre","Solvant","Vernis","Colle","Plastique","Médicinal"]],
  ["boise","🪵","Boisé",["Chêne","Cèdre","Vanille","Toasté","Résineux","Fût neuf"]],
  ["epice","🌶️","Épicé",["Poivre","Cannelle","Clou de girofle","Réglisse","Gingembre","Muscade","Anis"]],
  ["empyreumatique","🔥","Empyreumatique",["Café","Cacao","Caramel","Grillé","Pain grillé","Fumé","Tabac"]],
  ["animal","🦌","Animal",["Cuir","Musc","Gibier","Écurie","Fourrure"]],
  ["sousbois","🍄","Sous-bois",["Champignon","Humus","Feuilles mortes","Truffe","Terre humide","Mousse"]],
  ["oxydatif","🥜","Oxydatif",["Noix","Amande","Noisette","Pâte d’amande","Rancio","Curry","Pomme blette"]],
  ["defauts","⚠️","Défauts",["Bouchonné","Moisi","Vinaigre","Œuf pourri","Oxydé","Brett"]]
];
var T_MORE = {
  fruite:["Citron","Pamplemousse","Orange","Mandarine","Pomme verte","Pomme cuite","Melon","Ananas","Mangue","Fruit de la passion","Banane","Cerise","Fraise","Framboise","Groseille","Cassis","Mûre","Myrtille","Prune","Pruneau","Figue","Datte","Raisin sec","Kirsch","Mirabelle"],
  floral:["Chèvrefeuille","Fleur d’oranger","Lilas","Lavande","Camomille","Jasmin","Pivoine","Géranium","Aubépine","Fleur de vigne"],
  vegetal:["Buis","Bourgeon de cassis","Asperge","Tomate","Eucalyptus","Herbes de Provence","Cire","Sauge","Ortie","Lierre"],
  mineral:["Pierre mouillée","Calcaire","Ardoise","Craie humide","Fumée de silex","Pétrole","Sel","Galet"],
  lactique:["Beurre frais","Crème fraîche","Lait caillé","Petit-lait","Fromage frais","Croûte de fromage"],
  fermentaire:["Autolyse","Brioche grillée","Lie","Pâte à pain","Cidre","Bière","Kombucha","Pain d’épices","Croûte de pain"],
  chimique:["Acétone","Éthanol","Caoutchouc","Allumette","Iode","Dissolvant","Peinture","Pharmacie"],
  boise:["Fût toasté","Copeaux","Crayon","Bois de santal","Pin","Coco","Sciure"],
  epice:["Safran","Curcuma","Cardamome","Coriandre","Badiane","Piment","Poivre blanc","Poivre noir","Cumin","Paprika"],
  empyreumatique:["Torréfaction","Chocolat noir","Moka","Amande grillée","Noisette grillée","Brûlé","Goudron","Cendre","Feu de bois","Pain brûlé"],
  animal:["Viande","Sueur","Cire d’abeille","Peau","Bouillon","Lard"],
  sousbois:["Cèpe","Feuilles humides","Racines","Betterave","Terreux","Lichen"],
  oxydatif:["Noix verte","Vin jaune","Xérès","Madère","Pomme oxydée","Fruits secs grillés","Caramel au beurre"],
  defauts:["TCA","Géranium (sorbate)","Souris","Colle","Écurie forte","Évent","Poussière","Carton mouillé"]
};
/* Anciennes familles de la première bêta, rangées dans les nouvelles pour ne rien perdre */
var T_OLD_FAMS = {torrefie:"empyreumatique", cereale:"fermentaire", gourmand:"oxydatif"};
var T_SAVEURS = [
  ["sucre","🍬","Sucré",["Léger","Mielleux","Sirupeux","Confit","Caramélisé"]],
  ["acide","🍋","Acide",["Frais","Vif","Citronné","Acidulé","Tranchant"]],
  ["amer","🌱","Amer",["Zeste","Houblon","Quinine","Cacao","Végétal"]],
  ["sale","🧂","Salé",["Salin","Iodé","Minéral"]],
  ["umami","🍜","Umami",["Bouillon","Champignon","Sauce soja"]]
].concat(T_AROMES.filter(function(f){ return ["fruite","floral","vegetal","mineral","lactique","boise","epice","empyreumatique"].indexOf(f[0]) >= 0; }));
var T_POWER = ["Discret","Léger","Moyen","Marqué","Puissant"];
var T_STRUCT = [
  ["acidite","Acidité","Molle","Tranchante"],["sucre","Sucre","Sec","Liquoreux"],["corps","Corps","Léger","Puissant"],
  ["attaque","Attaque","Discrète","Explosive"],["longueur","Longueur","Courte","Interminable"],["alcool","Alcool","Léger","Chaud"],
  ["amertume","Amertume","Absente","Intense",function(d){ return d.type !== "vin"; }],
  ["tanins","Tanins","Soyeux","Asséchants",function(d){ return d.type === "vin" && d.famille === "Rouge"; }],
  ["bulles","Effervescence","Fine","Explosive",function(d){ return d.type === "biere" || d.famille === "Effervescent"; }],
  ["equilibre","Équilibre","Bancal","Parfait"]
];

var T_STEPS = ["Boisson","Détails","L’œil","Le nez","La bouche","Structure","Note"];
var T_GRAPES = ["Chardonnay","Pinot noir","Riesling","Gewurztraminer","Pinot gris","Sauvignon","Chenin","Syrah","Grenache","Mourvèdre","Merlot","Cabernet sauvignon","Cabernet franc","Gamay","Malbec","Viognier","Sylvaner","Muscat","Savagnin","Assemblage"];

function col(s){ return s == null ? "var(--muted)" : s >= 16 ? "var(--good)" : s >= 13 ? "var(--accent)" : s >= 10 ? "var(--warn)" : "var(--muted)"; }
function fmt(s){ return s == null || s === "" ? "–" : (Math.round(s * 10) / 10).toString().replace(".", ","); }
function lbl(s){ return s < 8 ? "À oublier" : s < 11 ? "Bof" : s < 13 ? "Correct" : s < 15 ? "Bon" : s < 17 ? "Très bon" : s < 19 ? "Superbe" : "Légendaire"; }
function title(d){ return d.nom || d.famille || (T_TYPES[d.type] || {}).label || "Dégustation"; }
function palette(d){ return T_COLORS[d.type === "vin" ? "vin:" + d.famille : d.type] || T_COLORS["vin:Blanc"]; }
function hexOf(d){ return d.couleur ? d.couleur.split("|")[1] : (((T_TYPES[d.type] || {}).fams || []).filter(function(f){ return f[0] === d.famille; })[0] || [])[1] || "var(--panel-2)"; }
function years(cur){ var y0 = new Date().getFullYear() - 1, ys = []; for (var y = y0; y > y0 - 12; y--) ys.push(String(y)); if (cur && ys.indexOf(String(cur)) < 0) ys.push(String(cur)); return ys; }
function known(field){ var seen = {}; list().forEach(function(x){ var v = trim(x[field]); if (v) seen[v] = 1; }); return Object.keys(seen).sort(); }

/* Petits composants */
function pills(name, opts, val, multi){
  var vals = multi ? (val || []) : [val];
  return '<div class="pills'+(multi ? '' : ' one')+'">'+opts.map(function(o){
    return '<label><input type="checkbox" name="'+name+'" value="'+esc(o)+'"'+(vals.indexOf(o) >= 0 ? ' checked' : '')+'><span>'+esc(o)+'</span></label>';
  }).join("")+'</div>';
}
function field(label, inner, wide){ return '<label class="f'+(wide ? ' wide' : '')+'"><span>'+label+'</span>'+inner+'</label>'; }
function group(label, inner){ return '<div class="f wide"><span>'+label+'</span>'+inner+'</div>'; }
function input(name, val, attrs){ return '<input class="inp" name="'+name+'" value="'+esc(val == null ? "" : val)+'" '+(attrs || 'type="text"')+'>'; }
function text(name, val, ph){ return '<textarea class="inp" name="'+name+'" rows="2" placeholder="'+esc(ph || "")+'">'+esc(val || "")+'</textarea>'; }
function datalist(id, vals){ return '<datalist id="'+id+'">'+vals.map(function(v){ return '<option value="'+esc(v)+'">'; }).join("")+'</datalist>'; }
function top(t, sub, back){
  return '<header class="top">'+(back ? '<button class="ic" type="button" data-a="back" aria-label="Retour">‹</button>' : '')+
    '<div class="tt"><h1>'+esc(t)+'</h1>'+(sub ? '<small>'+esc(sub)+'</small>' : '')+'</div>'+(V.screen === "wiz" ? '<button class="ic" type="button" data-a="quit" aria-label="Quitter la saisie">✕</button>' : '')+'</header>';
}
function fams(obj){
  var out = {};
  Object.keys(obj || {}).forEach(function(k){
    var nk = T_OLD_FAMS[k] || k, c = obj[k], ci = c.i != null ? c.i : (c.p || 3) * 2, cur = out[nk];
    out[nk] = cur ? {sub:cur.sub.concat((c.sub || []).filter(function(x){ return cur.sub.indexOf(x) < 0; })), i:Math.max(cur.i, ci)} : {sub:(c.sub || []).slice(), i:ci};
  });
  return out;
}

/* ---------- Écrans ---------- */
var V = {screen:"home", back:[], d:null, step:0, id:null, q:"", type:"all", sort:"date", sheet:null, photo:null, adv:false};

function card(d, rank){
  var ph = d.photoData || d.photo;
  return '<button class="card" type="button" data-a="view" data-id="'+esc(d.id)+'"><span class="rk">'+(rank ? (rank <= 3 ? ["🥇","🥈","🥉"][rank - 1] : rank) : '')+'</span>'+
    '<span class="th" style="background:'+hexOf(d)+'">'+(ph ? '<img src="'+esc(ph)+'" alt="" loading="lazy" onerror="this.remove()">' : (T_TYPES[d.type] || {}).icon || '🍷')+'</span>'+
    '<span class="ct"><b>'+esc(title(d))+(d.millesime ? ' '+esc(d.millesime) : '')+'</b><small>'+esc([d.domName, d.appellation || d.region].filter(Boolean).join(" · "))+'</small>'+
    '<small>'+esc([(T_TYPES[d.type] || {}).label, d.famille, d.author, fdate(d.date)].filter(Boolean).join(" · "))+'</small></span>'+
    '<span class="sc" style="--s:'+col(d.score)+'">'+fmt(d.score)+'<small>/20</small></span></button>';
}
function syncLine(){
  if (!API) return '<p class="sync">Carnet sur ce téléphone.</p>';
  if (!S.code) return '<p class="sync">Carnet sur ce téléphone. <button class="link" type="button" data-go="settings">Rejoindre une cave partagée</button></p>';
  var n = S.queue.length;
  if (V.busy) return '<p class="sync">Synchronisation…</p>';
  if (V.err) return '<p class="sync err">⚠️ '+esc(V.err)+(n ? ' · '+n+' en attente' : '')+' <button class="link" type="button" data-a="sync">Réessayer</button></p>';
  if (n) return '<p class="sync">'+n+' dégustation'+(n > 1 ? 's' : '')+' en attente d’envoi</p>';
  if (!S.last) return '<p class="sync">Connexion…</p>';
  var d = new Date(S.last); return '<p class="sync">Synchronisé à '+p2(d.getHours())+':'+p2(d.getMinutes())+'</p>';
}
function home(){
  var all = list(), q = norm(V.q);
  var rows = all.filter(function(d){
    if (V.type !== "all" && d.type !== V.type) return false;
    if (!q) return true;
    return norm([d.nom, d.domName, d.famille, d.appellation, d.region, d.pays, d.parcelle, d.millesime, d.author, d.txt, (d.cepages || []).join(" ")].join(" ")).indexOf(q) >= 0;
  });
  rows.sort(V.sort === "score" ? function(a, b){ return (b.score || 0) - (a.score || 0); } : function(a, b){ return (b.date || "").localeCompare(a.date || "") || (b.createdAt || 0) - (a.createdAt || 0); });
  var h = '<header class="top"><div class="tt"><span class="brand">Taste<i>vin</i></span><small>'+all.length+' dégustation'+(all.length > 1 ? 's' : '')+'</small></div></header>';
  h += '<span id="syncLine">'+syncLine()+'</span>';
  if (S.draft) h += '<div class="row" style="margin-bottom:.5rem"><button class="btn block" type="button" data-a="resume">↩️ Reprendre la saisie en cours</button></div>';
  h += '<label class="search"><span aria-hidden="true">🔍</span><input id="q" type="search" value="'+esc(V.q)+'" placeholder="Domaine, cuvée, cépage, millésime…" aria-label="Rechercher"></label>';
  h += '<div class="chips">'+[["all","Tout"],["vin","🍷 Vins"],["biere","🍺 Bières"],["spiritueux","🥃 Spiritueux"]].map(function(f){
    return '<button class="chip" type="button" data-a="type" data-v="'+f[0]+'" aria-pressed="'+(V.type === f[0])+'">'+f[1]+'</button>';
  }).join("")+'<button class="chip" type="button" data-a="sort" aria-pressed="false">'+(V.sort === "score" ? '↓ Meilleures notes' : '↓ Plus récentes')+'</button></div>';
  if (!all.length) return h + '<p class="empty">Ton carnet est vide.<br>Touche <b>＋ Déguster</b> pour noter ton premier vin.</p>';
  if (!rows.length) return h + '<p class="empty">Aucune dégustation ne correspond.</p>';
  var last = "";
  h += '<div class="list">'+rows.map(function(d, k){
    var m = V.sort === "date" && d.date ? d.date.slice(0, 7) : "", sep = "";
    if (m && m !== last) { last = m; sep = '<p class="day">'+MOIS[parseInt(m.slice(5), 10) - 1].replace(".", "")+' '+m.slice(0, 4)+'</p>'; }
    return sep + card(d, V.sort === "score" ? k + 1 : 0);
  }).join("")+'</div>';
  return h;
}

/* Saisie en 7 écrans */
function newDraft(){ return {type:"", famille:"", aspect:[], aromes:{}, saveurs:{}, structure:{}, cepages:[], date:today(), author:S.me}; }
function collect(){
  var f = $("wf"); if (!f) return;
  var d = V.d, fd = new FormData(f), step = parseInt(f.getAttribute("data-step"), 10);
  function g(k){ return trim(fd.get(k)); }
  if (step === 0) d.famille = g("famille") || d.famille;
  else if (step === 1) {
    ["domName","nom","millesime","pays","region","appellation","parcelle","degre","prix","elevage","achat","infos"].forEach(function(k){ if (fd.has(k)) d[k] = g(k); });
    if (fd.has("autreAnnee") && g("autreAnnee")) d.millesime = g("autreAnnee");
    if (fd.has("cep_present")) d.cepages = fd.getAll("cepages");
    if (V.photo) { d.photoData = V.photo; V.photo = null; }
  }
  else if (step === 2) { d.couleur = g("couleur"); d.cpos = fd.get("cpos") ? parseInt(fd.get("cpos"), 10) : null; d.intensite = parseInt(fd.get("intensite"), 10) || 0; d.aspect = fd.getAll("aspect"); }
  else if (step === 5) { var st = {}; T_STRUCT.forEach(function(s){ if (fd.has("st_" + s[0])) st[s[0]] = parseInt(fd.get("st_" + s[0]), 10) || 0; }); d.structure = st; }
  else if (step === 6) { d.score = parseFloat(fd.get("score")) || d.score; d.author = g("author"); d.date = g("date") || d.date; d.lieu = g("lieu"); d.rachat = g("rachat"); d.accords = g("accords"); d.txt = g("txt"); }
  S.draft = d; save();
}
function hexRgb(h){ var n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
function mix(pal, t){
  if (pal.length < 2) return pal[0][1];
  var x = Math.max(0, Math.min(1, t)) * (pal.length - 1), k = Math.min(pal.length - 2, Math.floor(x)), f = x - k, a = hexRgb(pal[k][1]), b = hexRgb(pal[k + 1][1]);
  return "#" + [0,1,2].map(function(j){ var v = Math.round(a[j] + (b[j] - a[j]) * f); return (v < 16 ? "0" : "") + v.toString(16); }).join("").toUpperCase();
}
function grad(pal){ return "linear-gradient(90deg," + pal.map(function(c, k){ return c[1] + " " + Math.round(k / (pal.length - 1) * 100) + "%"; }).join(",") + ")"; }
function glass(type, hex){
  var g = 'fill="rgba(127,127,127,.08)" stroke="var(--muted)" stroke-width="3"';
  if (type === "biere") return '<svg viewBox="0 0 200 300" aria-hidden="true"><path d="M52 26 L148 26 L136 276 L64 276 Z" '+g+'/><path id="liq" d="M56 70 L144 70 L134.6 271 L65.4 271 Z" fill="'+hex+'"/>'+
    '<path d="M54 34 L146 34 L144 74 Q120 82 100 74 Q80 66 56 74 Z" fill="#FFF6E2"/><circle cx="80" cy="52" r="7" fill="#fff"/><circle cx="112" cy="48" r="9" fill="#fff"/><path d="M70 90 L76 255" stroke="rgba(255,255,255,.35)" stroke-width="6" stroke-linecap="round"/></svg>';
  if (type === "spiritueux") return '<svg viewBox="0 0 200 300" aria-hidden="true"><path d="M46 110 L154 110 L146 276 L54 276 Z" '+g+'/><path id="liq" d="M49.5 190 L150.5 190 L145.6 262 L54.4 262 Z" fill="'+hex+'"/>'+
    '<rect x="70" y="150" width="34" height="30" rx="6" fill="rgba(255,255,255,.35)" transform="rotate(-12 87 165)"/><path d="M62 125 L66 250" stroke="rgba(255,255,255,.35)" stroke-width="6" stroke-linecap="round"/></svg>';
  return '<svg viewBox="0 0 200 300" aria-hidden="true"><path d="M58 18 L142 18 C152 80 154 120 146 152 C137 186 119 198 100 200 C81 198 63 186 54 152 C46 120 48 80 58 18 Z" '+g+'/>'+
    '<path id="liq" d="M51 108 C72 116 128 116 149 106 C152 124 151 140 146 153 C137 186 119 197 100 198 C81 197 63 186 54 153 C49 140 48 124 51 108 Z" fill="'+hex+'"/>'+
    '<path d="M70 40 C64 90 62 120 66 150" stroke="rgba(255,255,255,.4)" stroke-width="6" fill="none" stroke-linecap="round"/>'+
    '<rect x="96" y="200" width="8" height="70" fill="rgba(127,127,127,.12)" stroke="var(--muted)" stroke-width="2"/><ellipse cx="100" cy="276" rx="52" ry="9" fill="rgba(127,127,127,.12)" stroke="var(--muted)" stroke-width="2"/></svg>';
}
function colorSet(t, touched){
  var pal = palette(V.d), k = Math.round(t * (pal.length - 1)), hex = mix(pal, t);
  var liq = $("liq"); if (liq) liq.setAttribute("fill", hex);
  $("cg").value = Math.round(t * 1000);
  if (touched) { $("cv").value = pal[k][0] + "|" + hex; $("cp").value = Math.round(t * 1000); $("cn").textContent = pal[k][0]; }
  Array.prototype.forEach.call(document.querySelectorAll(".sw"), function(b, j){ b.setAttribute("aria-pressed", touched && j === k ? "true" : "false"); });
}
function scoreHTML(s){ return '<button type="button" class="sb" data-a="score" data-d="-0.5" aria-label="Baisser la note">−</button><span class="sv"><b>'+fmt(s)+'</b><small>/20</small><span>'+lbl(s)+'</span></span><button type="button" class="sb" data-a="score" data-d="0.5" aria-label="Monter la note">+</button>'; }
function scoreSet(v){ v = Math.max(1, Math.min(20, v)); var o = $("so"), r = $("sr"); if (!o || !r) return; r.value = v; o.style.setProperty("--s", col(v)); o.innerHTML = scoreHTML(v); }

function step(i){
  var d = V.d, h = '';
  if (i === 0) {
    h += '<div class="types">'+Object.keys(T_TYPES).map(function(k){ var t = T_TYPES[k];
      return '<button type="button" class="type" data-a="kind" data-v="'+k+'" aria-pressed="'+(d.type === k)+'"><i>'+t.icon+'</i>'+t.label+'</button>'; }).join("")+'</div>';
    if (d.type) h += '<span class="lbl">Famille <small>(passe à la suite)</small></span><div class="fams">'+T_TYPES[d.type].fams.map(function(f){
      return '<label class="fam"><input type="radio" name="famille" value="'+esc(f[0])+'"'+(d.famille === f[0] ? ' checked' : '')+'><span><i style="background:'+f[1]+'"></i>'+esc(f[0])+'</span></label>'; }).join("")+'</div>';
    else h += '<p class="empty">Vin, bière ou spiritueux ?</p>';
  }
  else if (i === 1) {
    var ph = V.photo || d.photoData || d.photo, vin = d.type === "vin";
    h += '<div class="sec ph"><div class="pv" id="pv">'+(ph ? '<img src="'+esc(ph)+'" alt="Photo">' : '📷')+'</div>'+
      '<label class="btn">Photo<input type="file" accept="image/*" capture="environment" data-photo hidden></label><label class="btn">Galerie<input type="file" accept="image/*" data-photo hidden></label></div>';
    h += '<div class="sec"><div class="grid">'+
      field(vin ? "Domaine" : "Producteur", input("domName", d.domName, 'type="text" list="dlDom" placeholder="'+(vin ? 'Ex. Domaine Weinbach' : 'Ex. Brasserie Météor')+'"'), true)+
      field("Cuvée / nom", input("nom", d.nom, 'type="text" list="dlNom" placeholder="Ex. Schlossberg"'), true)+
      group(vin ? "Millésime" : "Année", pills("millesime", years(d.millesime), d.millesime ? String(d.millesime) : ""))+
      '</div>'+datalist("dlDom", known("domName"))+datalist("dlNom", known("nom"))+'</div>';
    h += '<details class="adv"'+(V.adv ? ' open' : '')+' data-adv><summary>Mode avancé : origine, cépages, parcelle, prix…</summary><div class="sec"><div class="grid">'+
      field("Autre année", input("autreAnnee", "", 'type="number" inputmode="numeric" min="1900" max="2100" placeholder="Ex. 1998"'))+
      field("Pays", input("pays", d.pays, 'type="text" list="dlPays" placeholder="France"'))+
      field("Région", input("region", d.region, 'type="text" list="dlReg" placeholder="Alsace"'))+
      field(vin ? "Appellation" : "Style / origine", input("appellation", d.appellation, 'type="text" list="dlApp"'))+
      field("Parcelle / lieu-dit", input("parcelle", d.parcelle, 'type="text"'), true)+
      (vin ? '<input type="hidden" name="cep_present" value="1">'+group("Cépages", pills("cepages", T_GRAPES.concat((d.cepages || []).filter(function(c){ return T_GRAPES.indexOf(c) < 0; })), d.cepages, true)) : '')+
      field("Degré (%)", input("degre", d.degre, 'type="number" inputmode="decimal" step="0.1" min="0" max="80"'))+
      field("Prix (€)", input("prix", d.prix, 'type="number" inputmode="decimal" step="0.5" min="0"'))+
      field("Élevage", input("elevage", d.elevage, 'type="text" placeholder="Foudre, barrique, 12 ans…"'))+
      field("Acheté / goûté où", input("achat", d.achat, 'type="text"'))+
      field("Infos", text("infos", d.infos, "Sol, vinification, ce qu’a raconté le producteur…"), true)+
      '</div>'+datalist("dlPays", known("pays").concat(["France","Italie","Espagne","Allemagne","Portugal","Belgique","Écosse","Japon"]))+datalist("dlReg", known("region"))+datalist("dlApp", known("appellation"))+'</div></details>';
  }
  else if (i === 2) {
    var pal = palette(d), t = d.cpos != null && d.couleur ? d.cpos / 1000 : 0.5, hex = d.couleur ? d.couleur.split("|")[1] : mix(pal, t);
    h += '<div class="sec"><span class="lbl">Couleur</span><div class="glass">'+glass(d.type, hex)+'</div>'+
      '<p class="cname" id="cn">'+(d.couleur ? esc(d.couleur.split("|")[0]) : 'Glisse ou touche une pastille')+'</p>'+
      '<input type="range" class="grad" id="cg" min="0" max="1000" value="'+Math.round(t * 1000)+'" style="background:'+grad(pal)+'" aria-label="Couleur">'+
      '<input type="hidden" name="couleur" id="cv" value="'+esc(d.couleur || "")+'"><input type="hidden" name="cpos" id="cp" value="'+(d.cpos != null ? d.cpos : "")+'">'+
      '<div class="sws">'+pal.map(function(c, k){ return '<button type="button" class="sw" data-a="sw" data-i="'+k+'" style="background:'+c[1]+'" aria-label="'+esc(c[0])+'" aria-pressed="'+(!!d.couleur && d.couleur.split("|")[0] === c[0])+'"></button>'; }).join("")+'</div>'+
      '<label class="rng"><span>Intensité</span><input type="range" min="1" max="5" name="intensite" value="'+(d.intensite || 3)+'" data-pw><output>'+T_POWER[(d.intensite || 3) - 1]+'</output></label></div>';
    h += '<div class="sec"><span class="lbl">Aspect et texture</span>'+pills("aspect", T_ASPECT.base.concat(T_ASPECT[d.type] || []), d.aspect, true)+'</div>';
  }
  else if (i === 3 || i === 4) {
    var cur = fams(i === 3 ? d.aromes : d.saveurs);
    h += '<div class="fhead"><p>'+(i === 3 ? 'Quels arômes sens-tu ?' : 'Quelles saveurs en bouche ?')+' Touche une famille.</p><button type="button" class="ic" data-a="search" aria-label="Rechercher un arôme">🔍</button></div>';
    h += '<div class="flist">'+(i === 3 ? T_AROMES : T_SAVEURS).map(function(f){
      var c = cur[f[0]], v = c ? c.i : 0;
      return '<button type="button" class="frow'+(c ? ' on' : '')+'" data-a="fam" data-f="'+f[0]+'"><span class="fi">'+f[1]+'</span><span class="fn">'+esc(f[2])+(c && c.sub.length ? '<small>'+esc(c.sub.join(", "))+'</small>' : '')+'</span>'+
        '<span class="fb" aria-label="Intensité '+v+' sur 10"><b style="width:'+(v * 10)+'%"></b></span></button>';
    }).join("")+'</div>';
  }
  else if (i === 5) {
    h += '<div class="sec">'+T_STRUCT.filter(function(s){ return !s[4] || s[4](d); }).map(function(s){
      var v = d.structure[s[0]] || 0;
      return '<label class="st"><span class="sl">'+s[1]+' <b>'+(v ? v + '/5' : '–')+'</b></span><i class="a">'+s[2]+'</i><input type="range" min="0" max="5" name="st_'+s[0]+'" value="'+v+'" data-st><i class="b">'+s[3]+'</i></label>';
    }).join("")+'</div>';
  }
  else {
    var sc = d.score || 14;
    h += '<div class="sec"><div class="score" id="so" style="--s:'+col(sc)+'">'+scoreHTML(sc)+'</div>'+
      '<input class="big-range" id="sr" name="score" type="range" min="1" max="20" step="0.5" value="'+sc+'" aria-label="Note sur 20">'+
      '<div class="scale20"><span>1</span><span>5</span><span>10</span><span>15</span><span>20</span></div><div class="grid">'+
      field("Dégusté par", input("author", d.author || S.me, 'type="text" list="dlAut" placeholder="Ton prénom"'))+
      field("Date", input("date", d.date || today(), 'type="date"'))+
      field("Lieu", input("lieu", d.lieu, 'type="text" list="dlLieu" placeholder="Au domaine, au resto…"'), true)+
      group("J’en rachète ?", pills("rachat", ["Oui, un carton","Oui, une bouteille","Non"], d.rachat))+
      field("Accords", input("accords", d.accords, 'type="text" placeholder="Ex. munster, volaille"'), true)+
      field("Commentaire", text("txt", d.txt, "Ton avis en une phrase"), true)+
      '</div>'+datalist("dlAut", known("author"))+datalist("dlLieu", known("lieu"))+'</div>';
  }
  return h;
}
function wiz(){
  var i = V.step, d = V.d, last = T_STEPS.length - 1;
  var h = top(d.id ? "Modifier" : "Nouvelle dégustation", (i + 1)+'/'+T_STEPS.length+' · '+T_STEPS[i]+(d.type ? ' · '+T_TYPES[d.type].label+(d.famille ? ' '+d.famille.toLowerCase() : '') : ''));
  h += '<ol class="prog">'+T_STEPS.map(function(s, k){
    return '<li><button type="button" data-a="go" data-i="'+k+'" class="'+(k === i ? 'on' : k < i ? 'done' : '')+'"'+(k > 0 && !d.type ? ' disabled' : '')+' aria-label="'+esc(s)+'"'+(k === i ? ' aria-current="step"' : '')+'><span>'+esc(s)+'</span></button></li>';
  }).join("")+'</ol>';
  h += '<form id="wf" data-step="'+i+'" autocomplete="off">'+step(i)+
    '<div class="bar-nav">'+(i > 0 ? '<button type="button" class="btn" data-a="prev">‹ Retour</button>' : '<span></span>')+
    (i < last ? '<button type="button" class="btn pri" data-a="next">Suivant ›</button>' : '<button type="submit" class="btn pri">Enregistrer</button>')+'</div></form>';
  return h;
}
function famText(obj, lst){
  obj = fams(obj);
  return lst.filter(function(f){ return obj[f[0]]; }).map(function(f){ var c = obj[f[0]];
    return '<p><b>'+f[1]+' '+esc(f[2])+'</b> '+c.i+'/10'+(c.sub.length ? ' · '+esc(c.sub.join(", ")) : '')+'</p>'; }).join("");
}
function view(){
  var d = S.t[V.id];
  if (!d || d.deleted) { V.screen = "home"; V.back = []; return home(); }
  var ph = d.photoData || d.photo, c = d.couleur ? d.couleur.split("|") : null;
  var h = top(title(d) + (d.millesime ? " " + d.millesime : ""), [d.domName, (T_TYPES[d.type] || {}).label, d.famille].filter(Boolean).join(" · "), true);
  if (ph) h += '<div class="photo"><img src="'+esc(ph)+'" alt="Photo de la bouteille" onerror="this.parentNode.remove()"></div>';
  h += '<div class="hero" style="--s:'+col(d.score)+'"><div><b class="big">'+fmt(d.score)+'<small>/20</small></b><br><span class="muted">'+(d.score ? esc(lbl(d.score)) : '')+(d.author ? ' · '+esc(d.author) : '')+(d.date ? ' · '+fdate(d.date) : '')+'</span></div>'+
    '<div class="row"><button class="btn" type="button" data-a="edit">Modifier</button><button class="btn" type="button" data-a="again" title="Nouvelle dégustation du même vin">Re-déguster</button></div></div>';
  var kv = [["Producteur", d.domName], ["Cuvée", d.nom], [d.type === "vin" ? "Millésime" : "Année", d.millesime], ["Origine", [d.appellation, d.region, d.pays].filter(Boolean).join(", ")], ["Parcelle", d.parcelle],
    ["Cépages", (d.cepages || []).join(", ")], ["Degré", d.degre ? d.degre + " %" : ""], ["Prix", d.prix ? String(d.prix).replace(".", ",") + " €" : ""], ["Élevage", d.elevage], ["Acheté / goûté", d.achat], ["Lieu", d.lieu], ["Infos", d.infos]];
  h += '<div class="sec"><span class="lbl">Identité</span><dl class="kv">'+kv.filter(function(r){ return r[1]; }).map(function(r){ return '<dt>'+r[0]+'</dt><dd>'+esc(r[1])+'</dd>'; }).join("")+'</dl></div>';
  h += '<div class="sec txt"><span class="lbl">L’œil</span>'+(c ? '<p><span class="swatch" style="background:'+c[1]+'"></span><b>'+esc(c[0])+'</b> · intensité '+T_POWER[(d.intensite || 3) - 1].toLowerCase()+'</p>' : '<p class="muted">–</p>')+((d.aspect || []).length ? '<p>'+esc(d.aspect.join(", "))+'</p>' : '')+'</div>';
  h += '<div class="sec txt"><span class="lbl">Le nez</span>'+(famText(d.aromes, T_AROMES) || '<p class="muted">–</p>')+'</div>';
  h += '<div class="sec txt"><span class="lbl">La bouche</span>'+(famText(d.saveurs, T_SAVEURS) || '<p class="muted">–</p>')+'</div>';
  var st = T_STRUCT.filter(function(s){ return d.structure && d.structure[s[0]]; });
  if (st.length) h += '<div class="sec"><span class="lbl">Structure</span><div class="bars">'+st.map(function(s){ var v = d.structure[s[0]];
    return '<div><span>'+s[1]+'</span><i><b style="width:'+(v * 20)+'%"></b></i><em>'+v+'/5</em></div>'; }).join("")+'</div></div>';
  if (d.txt || d.accords || d.rachat) h += '<div class="sec txt"><span class="lbl">Avis</span>'+(d.txt ? '<p class="quote">« '+esc(d.txt)+' »</p>' : '')+(d.accords ? '<p><b>Accords</b> '+esc(d.accords)+'</p>' : '')+(d.rachat ? '<p><b>J’en rachète</b> '+esc(d.rachat)+'</p>' : '')+'</div>';
  h += '<div class="row"><button class="btn" type="button" data-a="del">Supprimer</button></div>';
  return h;
}
function stats(){
  var all = list(), scored = all.filter(function(d){ return d.score; });
  var avg = scored.length ? scored.reduce(function(s, d){ return s + d.score; }, 0) / scored.length : null;
  var h = top("Palmarès", "Tes meilleures dégustations");
  h += '<div class="kpis"><div class="kpi"><b>'+all.length+'</b><small>dégustations</small></div><div class="kpi"><b>'+fmt(avg)+'</b><small>note moyenne</small></div><div class="kpi"><b>'+known("domName").length+'</b><small>producteurs</small></div></div>';
  if (!scored.length) return h + '<p class="empty">Note quelques bouteilles pour voir ton palmarès.</p>';
  var by = V.type;
  h += '<div class="chips">'+[["all","Tout"],["vin","🍷 Vins"],["biere","🍺 Bières"],["spiritueux","🥃 Spiritueux"]].map(function(f){
    return '<button class="chip" type="button" data-a="type" data-v="'+f[0]+'" aria-pressed="'+(by === f[0])+'">'+f[1]+'</button>'; }).join("")+'</div>';
  var rows = scored.filter(function(d){ return by === "all" || d.type === by; }).sort(function(a, b){ return b.score - a.score; });
  h += '<span class="lbl">Top 10</span><div class="list" style="margin-bottom:.6rem">'+rows.slice(0, 10).map(function(d, k){ return card(d, k + 1); }).join("")+'</div>';
  var prod = {};
  rows.forEach(function(d){ if (!d.domName) return; var p = prod[d.domName] || (prod[d.domName] = {s:0, n:0}); p.s += d.score; p.n++; });
  var pl = Object.keys(prod).map(function(k){ return [k, prod[k].s / prod[k].n, prod[k].n]; }).sort(function(a, b){ return b[1] - a[1]; }).slice(0, 8);
  if (pl.length) h += '<div class="sec"><span class="lbl">Producteurs</span><ol class="rank">'+pl.map(function(p){ return '<li><span>'+esc(p[0])+' <small class="muted">'+p[2]+' vin'+(p[2] > 1 ? 's' : '')+'</small></span><b style="color:'+col(p[1])+'">'+fmt(p[1])+'</b></li>'; }).join("")+'</ol></div>';
  var ar = {};
  rows.forEach(function(d){ var f = fams(d.aromes); Object.keys(f).forEach(function(k){ f[k].sub.forEach(function(a){ ar[a] = (ar[a] || 0) + 1; }); }); });
  var al = Object.keys(ar).sort(function(a, b){ return ar[b] - ar[a]; }).slice(0, 10);
  if (al.length) h += '<div class="sec"><span class="lbl">Arômes les plus cités</span><ol class="rank">'+al.map(function(a){ return '<li><span>'+esc(a)+'</span><b>'+ar[a]+'</b></li>'; }).join("")+'</ol></div>';
  return h;
}
function settings(){
  var h = top("Réglages", "Profil, cave partagée, sauvegarde");
  h += '<form id="sf" class="sec"><div class="grid">'+field("Ton prénom", input("me", S.me, 'type="text" placeholder="Il signe tes dégustations"'))+
    (API ? field("Code de la cave partagée", input("code", S.code, 'type="text" autocomplete="off" placeholder="Pour partager le carnet"')) : '')+
    '</div><div class="row" style="margin-top:.5rem"><button class="btn pri" type="submit">Enregistrer</button></div></form>';
  h += '<span id="syncLine">'+syncLine()+'</span>';
  h += '<div class="sec"><span class="lbl">Sauvegarde</span><div class="row"><button class="btn" type="button" data-a="export">Exporter (JSON)</button><button class="btn" type="button" data-a="csv">Exporter (tableur CSV)</button>'+
    '<label class="btn">Importer<input type="file" accept="application/json,.json" data-import hidden></label></div>'+
    '<p class="muted" style="font-size:.8rem;margin:.5rem 0 0">L’import accepte aussi l’export de Vinlo (dégustations avancées).</p></div>';
  h += '<p class="muted" style="font-size:.8rem">Tastevin garde tout sur ce téléphone, même hors ligne. Avec un code de cave, les dégustations sont partagées et sauvegardées sur le serveur.</p>';
  return h;
}
function welcome(){
  return '<div class="welcome"><h1>Taste<span style="color:var(--accent)">vin</span></h1><p>Ton carnet de dégustation : robe, nez, bouche, structure et note sur 20. Vins, bières et spiritueux.</p>'+
    '<form id="wl" class="sec"><div class="grid">'+field("Ton prénom", input("me", S.me, 'type="text" required autocomplete="given-name"'), true)+
    (API ? field("Code de la cave partagée (facultatif)", input("code", "", 'type="text" autocomplete="off" placeholder="Donné par l’organisateur"'), true) : '')+
    '</div><div class="row" style="margin-top:.6rem"><button class="btn pri block" type="submit">Commencer</button></div></form></div>';
}
var SCREENS = {home:home, wiz:wiz, view:view, stats:stats, settings:settings, welcome:welcome};
function render(){
  document.documentElement.classList.toggle("wiz", V.screen === "wiz" || V.screen === "welcome");
  $("app").innerHTML = (SCREENS[V.screen] || home)();
  Array.prototype.forEach.call(document.querySelectorAll("#nav [data-go]"), function(b){
    var g = b.getAttribute("data-go"), on = g === V.screen || (g === "home" && V.screen === "view");
    if (on) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current");
  });
}
function go(screen, keep){ V.back.push({screen:V.screen, id:V.id}); V.screen = screen; if (!keep) V.photo = null; render(); window.scrollTo(0, 0); }
function back(){ var p = V.back.pop() || {screen:"home"}; V.screen = p.screen; V.id = p.id; render(); window.scrollTo(0, 0); }
function editing(){ var a = document.activeElement; return !!(a && /^(INPUT|SELECT|TEXTAREA)$/.test(a.tagName)); }

/* Navigation de la saisie */
function goStep(i){
  sheetClose(); collect();
  if (i > 0 && !V.d.type) { toast("Choisis d’abord le type de boisson"); return; }
  V.step = Math.max(0, Math.min(T_STEPS.length - 1, i)); render(); window.scrollTo(0, 0);
}
function startWiz(d){ V.d = d; V.step = 0; V.photo = null; S.draft = d; save(); V.back = [{screen:V.screen === "wiz" ? "home" : V.screen, id:V.id}]; V.screen = "wiz"; render(); window.scrollTo(0, 0); }
function saveEntry(){
  collect();
  var d = V.d;
  if (!d.type) { V.step = 0; render(); toast("Choisis le type de boisson"); return; }
  if (!d.author) { toast("Indique qui déguste"); return; }
  if (!S.me) S.me = d.author;
  var old = d.id ? S.t[d.id] || {} : {}, e = JSON.parse(JSON.stringify(d));
  e.id = d.id || uid(); e.createdAt = old.createdAt || Date.now(); e.updatedAt = Date.now();
  if (!e.photoData && old.photo) e.photo = old.photo;
  S.draft = null; put(e);
  V.id = e.id; V.back = [{screen:"home"}]; V.screen = "view"; render(); window.scrollTo(0, 0);
  toast("Enregistré : " + fmt(e.score) + "/20");
}

/* Fenêtre d’une famille d’arômes */
function famList(){ return V.step === 3 ? T_AROMES : T_SAVEURS; }
function famDef(k){ return famList().filter(function(f){ return f[0] === k; })[0]; }
function sheetChips(){
  var sh = V.sheet, q = norm(sh.q);
  if (sh.all) {
    if (!q) return '<p class="muted" style="font-size:.85rem">Tape un arôme : café, citron, truffe…</p>';
    var hits = [];
    famList().forEach(function(f){ f[3].concat(T_MORE[f[0]] || []).forEach(function(a){ if (norm(a).indexOf(q) >= 0) hits.push([f, a]); }); });
    return hits.length ? '<div class="sh-chips">'+hits.slice(0, 30).map(function(x){ return '<button type="button" class="sh-chip" data-a="pick" data-f="'+x[0][0]+'" data-v="'+esc(x[1])+'">'+x[0][1]+' '+esc(x[1])+'</button>'; }).join("")+'</div>' : '<p class="muted">Aucun arôme trouvé.</p>';
  }
  var f = famDef(sh.fam), lst = q ? f[3].concat(T_MORE[f[0]] || []).filter(function(a){ return norm(a).indexOf(q) >= 0; }) : f[3].slice();
  sh.sub.forEach(function(a){ if (lst.indexOf(a) < 0 && (!q || norm(a).indexOf(q) >= 0)) lst.push(a); });
  var h = '<span class="lbl">'+(q ? 'Résultats' : 'Les plus courants')+'</span><div class="sh-chips">'+lst.map(function(a){
    return '<button type="button" class="sh-chip" data-a="sub" data-v="'+esc(a)+'" aria-pressed="'+(sh.sub.indexOf(a) >= 0)+'">'+esc(a)+'</button>'; }).join("")+'</div>';
  if (q && lst.map(norm).indexOf(q) < 0) h += '<button type="button" class="sh-add" data-a="sub" data-v="'+esc(trim(sh.q))+'">＋ Ajouter « '+esc(trim(sh.q))+' »</button>';
  return h;
}
function sheetOpen(fam, preset){
  var cur = fams(V.step === 3 ? V.d.aromes : V.d.saveurs)[fam] || {sub:[], i:0};
  V.sheet = {fam:fam, i:cur.i, sub:cur.sub.slice(), q:""};
  if (preset && V.sheet.sub.indexOf(preset) < 0) { V.sheet.sub.push(preset); if (!V.sheet.i) V.sheet.i = 5; }
  sheetRender();
}
function sheetRender(){
  var sh = V.sheet, el = $("sheet"), f = sh.all ? null : famDef(sh.fam);
  if (!el) { el = document.createElement("div"); el.id = "sheet"; el.className = "sh-back"; document.body.appendChild(el); }
  el.innerHTML = '<div class="sh" role="dialog" aria-modal="true" aria-label="'+(f ? esc(f[2]) : 'Rechercher un arôme')+'"><div class="sh-h"><h2>'+(f ? f[1]+' '+esc(f[2]) : 'Rechercher un arôme')+'</h2>'+
    '<button type="button" class="sh-x" data-a="shclose" aria-label="Fermer sans enregistrer">✕</button></div>'+
    (f ? '<p class="sh-v" id="shv">Intensité : <b>'+sh.i+'/10</b></p><input type="range" id="shi" min="0" max="10" value="'+sh.i+'" aria-label="Intensité">'+
      '<div class="scale"><span>0</span><span>2</span><span>4</span><span>6</span><span>8</span><span>10</span></div>' : '')+
    '<label class="search"><span aria-hidden="true">🔍</span><input id="shq" type="search" value="'+esc(sh.q)+'" placeholder="Rechercher un arôme…" autocomplete="off"></label>'+
    '<div id="shc">'+sheetChips()+'</div><div class="sh-f"><button type="button" class="btn" data-a="shclose">Annuler</button>'+(f ? '<button type="button" class="btn pri" data-a="shok">Valider</button>' : '')+'</div></div>';
  document.documentElement.classList.add("sh-open");
}
function sheetClose(){ var el = $("sheet"); if (el) el.remove(); V.sheet = null; document.documentElement.classList.remove("sh-open"); }
function sheetSave(){
  var sh = V.sheet, k = V.step === 3 ? "aromes" : "saveurs", obj = fams(V.d[k]);
  if (sh.i > 0 || sh.sub.length) obj[sh.fam] = {sub:sh.sub, i:sh.i || 5}; else delete obj[sh.fam];
  V.d[k] = obj; S.draft = V.d; save(); sheetClose(); render();
}

/* Photo réduite avant stockage */
function resize(file){
  return new Promise(function(res, rej){
    var url = URL.createObjectURL(file), img = new Image();
    img.onload = function(){ var w = img.naturalWidth, h = img.naturalHeight, r = Math.min(1, 1000 / Math.max(w, h)), c = document.createElement("canvas");
      c.width = Math.round(w * r); c.height = Math.round(h * r); c.getContext("2d").drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url); res(c.toDataURL("image/jpeg", 0.7)); };
    img.onerror = function(){ URL.revokeObjectURL(url); rej(new Error("image")); };
    img.src = url;
  });
}

/* ---------- Synchronisation ---------- */
function apiJson(r){
  return r.text().then(function(t){
    var j; try { j = JSON.parse(t); } catch(e) { throw new Error(/authori[sz]|autoris|accounts\.google/i.test(t) ? "auth" : "html"); }
    if (!j.ok) throw new Error(j.error || "erreur");
    return j;
  });
}
function errText(e){
  var m = e && e.message;
  if (m === "token") return "Code de cave refusé";
  if (m === "auth") return "Serveur pas encore autorisé (lancer « setup »)";
  if (m === "html") return "Le serveur répond mal (déploiement)";
  if (e instanceof TypeError) return navigator.onLine === false ? "Hors ligne : tout est gardé ici" : "Serveur injoignable";
  return "Erreur du serveur : " + (m || "inconnue");
}
function push(){
  return S.queue.slice().reduce(function(chain, id){
    return chain.then(function(){
      var item = S.t[id]; if (!item) { S.queue = S.queue.filter(function(q){ return q !== id; }); return; }
      var send = JSON.parse(JSON.stringify(item)), photo = send.photoData; delete send.photoData;
      return fetch(API, {method:"POST", headers:{"Content-Type":"text/plain;charset=utf-8"}, body:JSON.stringify({action:"upsert", token:S.code, item:send, photo:photo})}).then(apiJson).then(function(j){
        var cur = S.t[id];
        if (cur && photo && cur.photoData === photo && j.item.photo) { cur.photo = j.item.photo; delete cur.photoData; }
        if (cur && cur.updatedAt > item.updatedAt) return;
        S.t[id] = j.item; S.queue = S.queue.filter(function(q){ return q !== id; });
      }, function(e){ if (e && e.message === "bad request") { S.queue = S.queue.filter(function(q){ return q !== id; }); return; } throw e; });
    });
  }, Promise.resolve());
}
function pull(){
  return fetch(API + "?token=" + encodeURIComponent(S.code) + "&t=" + Date.now()).then(apiJson).then(function(j){
    (j.tastings || []).forEach(function(it){
      if (!it || !it.id || S.queue.indexOf(it.id) >= 0) return;
      var cur = S.t[it.id]; if (!cur || (it.updatedAt || 0) >= (cur.updatedAt || 0)) S.t[it.id] = it;
    });
  });
}
function sync(){
  var line = function(){ var el = $("syncLine"); if (el) el.innerHTML = syncLine(); };
  if (!API || !S.code || V.busy || navigator.onLine === false) { line(); return; }
  V.busy = true; line();
  var pe = null;
  push().catch(function(e){ pe = e; }).then(pull).then(function(){ if (pe) throw pe; S.last = Date.now(); V.err = ""; }, function(e){ V.err = errText(e); })
    .then(function(){ V.busy = false; save(); if (["home","stats","view"].indexOf(V.screen) >= 0 && !editing() && !V.sheet) render(); else line(); });
}
setInterval(function(){ if (document.visibilityState === "visible") sync(); }, 60000);
window.addEventListener("online", sync);
document.addEventListener("visibilitychange", function(){ if (document.visibilityState === "visible") sync(); });

/* ---------- Import / export ---------- */
function download(name, type, content){
  var a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([content], {type:type})); a.download = name;
  document.body.appendChild(a); a.click(); setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
function toCsv(){
  var cols = [["date","Date"],["author","Dégustateur"],["type","Type"],["famille","Famille"],["domName","Producteur"],["nom","Cuvée"],["millesime","Millésime"],["appellation","Appellation"],["region","Région"],["pays","Pays"],["score","Note /20"],["txt","Commentaire"]];
  var q = function(v){ v = String(v == null ? "" : v); return /[";\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
  return "﻿" + cols.map(function(c){ return c[1]; }).join(";") + "\n" + list().map(function(d){ return cols.map(function(c){ return q(d[c[0]]); }).join(";"); }).join("\n");
}
function importJson(data){
  var src = data.t || data.pro || data.tastings || {}, n = 0;
  if (Array.isArray(src)) { var o = {}; src.forEach(function(x){ if (x && x.id) o[x.id] = x; }); src = o; }
  Object.keys(src).forEach(function(k){ var x = src[k]; if (!x || !x.type || x.deleted) return; if (!S.t[x.id] || (x.updatedAt || 0) > (S.t[x.id].updatedAt || 0)) { S.t[x.id] = x; if (S.queue.indexOf(x.id) < 0) S.queue.push(x.id); n++; } });
  save(); sync(); return n;
}

/* ---------- Événements ---------- */
document.addEventListener("click", function(e){
  var g = e.target.closest("[data-go]");
  if (g) {
    var to = g.getAttribute("data-go");
    if (to === "new") { startWiz(S.draft && !S.draft.id ? S.draft : newDraft()); return; }
    V.back = []; V.screen = to; render(); window.scrollTo(0, 0); return;
  }
  if (e.target.id === "sheet") { sheetClose(); return; }
  var b = e.target.closest("[data-a]"); if (!b) return;
  var a = b.getAttribute("data-a");
  if (a === "back") back();
  else if (a === "quit") { collect(); sheetClose(); V.screen = "home"; V.back = []; render(); toast("Saisie gardée : « Reprendre » sur le carnet"); }
  else if (a === "resume") startWiz(S.draft);
  else if (a === "view") { V.id = b.getAttribute("data-id"); go("view"); }
  else if (a === "type") { V.type = b.getAttribute("data-v"); render(); }
  else if (a === "sort") { V.sort = V.sort === "date" ? "score" : "date"; render(); }
  else if (a === "sync") sync();
  else if (a === "kind") { collect(); var t = b.getAttribute("data-v"); if (V.d.type !== t) { V.d.type = t; V.d.famille = ""; V.d.couleur = ""; } S.draft = V.d; save(); render(); }
  else if (a === "next") goStep(V.step + 1);
  else if (a === "prev") goStep(V.step - 1);
  else if (a === "go") goStep(parseInt(b.getAttribute("data-i"), 10));
  else if (a === "sw") colorSet(parseInt(b.getAttribute("data-i"), 10) / (palette(V.d).length - 1), true);
  else if (a === "score") scoreSet(parseFloat($("sr").value) + parseFloat(b.getAttribute("data-d")));
  else if (a === "fam") sheetOpen(b.getAttribute("data-f"));
  else if (a === "search") { V.sheet = {all:true, q:"", sub:[], i:0}; sheetRender(); setTimeout(function(){ $("shq").focus(); }, 50); }
  else if (a === "pick") sheetOpen(b.getAttribute("data-f"), b.getAttribute("data-v"));
  else if (a === "sub") {
    var v = b.getAttribute("data-v"), k = V.sheet.sub.indexOf(v);
    if (k >= 0) V.sheet.sub.splice(k, 1); else { V.sheet.sub.push(v); if (!V.sheet.i) { V.sheet.i = 5; $("shi").value = 5; $("shv").innerHTML = 'Intensité : <b>5/10</b>'; } }
    if (b.classList.contains("sh-add")) { V.sheet.q = ""; $("shq").value = ""; }
    $("shc").innerHTML = sheetChips();
  }
  else if (a === "shok") sheetSave();
  else if (a === "shclose") sheetClose();
  else if (a === "edit") startWiz(JSON.parse(JSON.stringify(S.t[V.id])));
  else if (a === "again") {
    var src = S.t[V.id], d = newDraft();
    ["type","famille","domName","nom","millesime","pays","region","appellation","parcelle","cepages","degre","prix","elevage"].forEach(function(k){ if (src[k] != null) d[k] = JSON.parse(JSON.stringify(src[k])); });
    if (src.photo) d.photo = src.photo;
    startWiz(d); V.step = 2; render();
  }
  else if (a === "del") {
    if (!b.getAttribute("data-sure")) { b.setAttribute("data-sure", "1"); b.textContent = "Confirmer la suppression"; return; }
    var x = JSON.parse(JSON.stringify(S.t[V.id])); x.deleted = true; x.updatedAt = Date.now(); delete x.photoData; put(x);
    V.screen = "home"; V.back = []; render(); toast("Dégustation supprimée");
  }
  else if (a === "export") download("tastevin.json", "application/json", JSON.stringify({t:S.t}, null, 1));
  else if (a === "csv") download("tastevin.csv", "text/csv", toCsv());
});
document.addEventListener("submit", function(e){
  e.preventDefault();
  var f = e.target, fd = new FormData(f);
  if (f.id === "wf") { if (V.step < T_STEPS.length - 1) goStep(V.step + 1); else saveEntry(); }
  else if (f.id === "sf" || f.id === "wl") {
    S.me = trim(fd.get("me")) || S.me; if (fd.has("code")) S.code = trim(fd.get("code")); S.local = true; V.err = ""; save();
    V.screen = "home"; V.back = []; render(); sync(); toast(f.id === "wl" ? "Bienvenue " + S.me + " !" : "Réglages enregistrés");
  }
});
document.addEventListener("change", function(e){
  var t = e.target;
  if (t.matches(".pills.one input") && t.checked) Array.prototype.forEach.call(t.closest(".pills").querySelectorAll("input"), function(i){ if (i !== t) i.checked = false; });
  if (t.name === "famille" && t.closest("#wf")) setTimeout(function(){ if (V.screen === "wiz" && V.step === 0) goStep(1); }, 150);
  if (t.hasAttribute("data-photo") && t.files && t.files[0]) {
    resize(t.files[0]).then(function(data){ V.photo = data; $("pv").innerHTML = '<img src="'+data+'" alt="Photo">'; }, function(){ toast("Photo illisible, réessaie"); });
    t.value = "";
  }
  if (t.hasAttribute("data-import") && t.files && t.files[0]) {
    t.files[0].text().then(function(txt){ var n = importJson(JSON.parse(txt)); render(); toast(n + " dégustation" + (n > 1 ? "s" : "") + " importée" + (n > 1 ? "s" : "")); }).catch(function(){ toast("Fichier illisible"); });
    t.value = "";
  }
});
document.addEventListener("input", function(e){
  var t = e.target;
  if (t.id === "q") { V.q = t.value; var pos = t.selectionStart; render(); var q = $("q"); q.focus(); q.setSelectionRange(pos, pos); }
  else if (t.id === "cg") colorSet(parseInt(t.value, 10) / 1000, true);
  else if (t.id === "sr") scoreSet(parseFloat(t.value));
  else if (t.hasAttribute("data-pw")) t.nextElementSibling.textContent = T_POWER[parseInt(t.value, 10) - 1];
  else if (t.hasAttribute("data-st")) { var v = parseInt(t.value, 10); t.parentNode.querySelector(".sl b").textContent = v ? v + "/5" : "–"; }
  else if (t.id === "shi") { V.sheet.i = parseInt(t.value, 10); $("shv").innerHTML = 'Intensité : <b>'+V.sheet.i+'/10</b>'; }
  else if (t.id === "shq") { V.sheet.q = t.value; $("shc").innerHTML = sheetChips(); }
});
document.addEventListener("toggle", function(e){ if (e.target.hasAttribute && e.target.hasAttribute("data-adv")) V.adv = e.target.open; }, true);
document.addEventListener("keydown", function(e){ if (e.key === "Escape" && V.sheet) sheetClose(); });

/* ---------- Démarrage ---------- */
if (!S.me && !S.local) V.screen = "welcome";
render();
sync();
if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(function(){});
})();
