/**
 * Tastevin : serveur des dégustations (Google Apps Script)
 * Données : une Google Sheet « Tastevin · Dégustations ». Photos : dossier Drive « Tastevin · Photos ».
 * Le code de la cave partagée n’est jamais dans le dépôt : il se règle dans le script déployé (CODE) ou en propriété de script « CODE ».
 */
var CODE = "";
var PHOTO_FOLDER = "Tastevin · Photos";
var COLS = ["id", "updatedAt", "deleted", "date", "dégustateur", "type", "famille", "producteur", "cuvée", "millésime",
            "appellation", "région", "pays", "couleur", "arômes", "saveurs", "note /20", "commentaire", "photo", "json"];

function code() { return PropertiesService.getScriptProperties().getProperty("CODE") || CODE; }
function out(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

function doGet(e) {
  var p = (e && e.parameter) || {};
  if (!code() || p.token !== code()) return out({ ok: false, error: "token" });
  return out({ ok: true, tastings: readAll(), now: Date.now() });
}

function doPost(e) {
  var body;
  try { body = JSON.parse(e.postData.contents); } catch (err) { return out({ ok: false, error: "json" }); }
  if (!code() || body.token !== code()) return out({ ok: false, error: "token" });
  if (body.action !== "upsert" || !body.item || !body.item.id) return out({ ok: false, error: "bad request" });
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var item = body.item, sh = sheet(), cur = findRow(sh, item.id);
    if (cur.item && (cur.item.updatedAt || 0) > (item.updatedAt || 0)) return out({ ok: true, item: cur.item, stale: true });
    if (body.photo) item.photo = savePhoto(item.id, body.photo);
    else if (cur.item && cur.item.photo && !item.photo) item.photo = cur.item.photo;
    delete item.photoData;
    var values = row(item).concat([JSON.stringify(item)]);
    if (cur.row) sh.getRange(cur.row, 1, 1, values.length).setValues([values]); else sh.appendRow(values);
    return out({ ok: true, item: item });
  } finally { lock.releaseLock(); }
}

function fams(o) {
  return Object.keys(o || {}).map(function (k) { var c = o[k]; return k + " " + (c.i != null ? c.i : "") + "/10" + (c.sub && c.sub.length ? " (" + c.sub.join(", ") + ")" : ""); }).join(" · ");
}
function row(d) {
  return [d.id, d.updatedAt, !!d.deleted, d.date || "", d.author || "", d.type || "", d.famille || "", d.domName || "", d.nom || "", d.millesime || "",
          d.appellation || "", d.region || "", d.pays || "", (d.couleur || "").split("|")[0], fams(d.aromes), fams(d.saveurs), d.score || "", d.txt || "", d.photo || ""];
}

function book() {
  var props = PropertiesService.getScriptProperties(), id = props.getProperty("SHEET_ID");
  if (id) return SpreadsheetApp.openById(id);
  var created = SpreadsheetApp.create("Tastevin · Dégustations");
  props.setProperty("SHEET_ID", created.getId());
  return created;
}
function sheet() {
  var b = book(), sh = b.getSheetByName("Dégustations");
  if (!sh) {
    sh = b.insertSheet("Dégustations"); sh.appendRow(COLS); sh.setFrozenRows(1); sh.getRange(1, 1, 1, COLS.length).setFontWeight("bold");
    var first = b.getSheetByName("Feuille 1") || b.getSheetByName("Sheet1"); if (first && b.getSheets().length > 1) b.deleteSheet(first);
  }
  return sh;
}
function readAll() {
  var sh = sheet(), last = sh.getLastRow(); if (last < 2) return [];
  return sh.getRange(2, COLS.length, last - 1, 1).getValues().map(function (r) { try { return JSON.parse(r[0]); } catch (e) { return null; } }).filter(Boolean);
}
function findRow(sh, id) {
  var cell = sh.getRange("A:A").createTextFinder(id).matchEntireCell(true).findNext();
  if (!cell) return { row: 0 };
  var item = null; try { item = JSON.parse(sh.getRange(cell.getRow(), COLS.length).getValue()); } catch (e) {}
  return { row: cell.getRow(), item: item };
}
function folder() { var it = DriveApp.getFoldersByName(PHOTO_FOLDER); return it.hasNext() ? it.next() : DriveApp.createFolder(PHOTO_FOLDER); }
function savePhoto(id, dataUrl) {
  var m = /^data:(image\/[\w+]+);base64,(.+)$/.exec(dataUrl); if (!m) return "";
  var file = folder().createFile(Utilities.newBlob(Utilities.base64Decode(m[2]), m[1], id + ".jpg"));
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return "https://drive.google.com/thumbnail?id=" + file.getId() + "&sz=w1200";
}

/** À lancer une fois depuis l’éditeur : accorde les autorisations, crée la Sheet et le dossier photos. */
function setup() { sheet(); folder(); Logger.log("Sheet : " + book().getUrl()); }
