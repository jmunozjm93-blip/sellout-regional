/* Lectores de los Excel que mandan los clientes regionales.
 * Cada formato de stock devuelve { formato, items: { 'MODELO-COLOR': {mo, d, st, compra, costo, precio, marca, vi, needColor, colName} } }
 * con SOLO calzado. Se usan en cargar.html (necesita SheetJS: window.XLSX).
 *
 * Para agregar un formato nuevo: escribir una funcion (aoa) => resultado|null y sumarla a LECTORES_STOCK.
 */
(function (G) {
  'use strict';
  var S = function (v) { return v == null ? '' : String(v).trim(); };
  var N = function (v) {
    if (v == null || v === '') return null;
    if (typeof v === 'number') return isFinite(v) ? v : null;
    var t = String(v).trim().replace(/\s/g, '');
    // 1.234,5 -> 1234.5 ; 1234.5 -> 1234.5 ; 25709,14 -> 25709.14
    if (/,\d+$/.test(t)) t = t.replace(/\./g, '').replace(',', '.');
    var n = parseFloat(t); return isFinite(n) ? n : null;
  };
  var pad = function (x) { return String(x).padStart(2, '0'); };
  function findHeader(aoa, test) { for (var i = 0; i < Math.min(15, aoa.length); i++) { var h = (aoa[i] || []).map(S); if (test(h)) return { i: i, h: h }; } return null; }
  function colIx(h, re) { return h.findIndex(function (x) { return re.test(x); }); }
  function esMC(s) { return /^[A-Z0-9]{4,}-[A-Z0-9]{2,5}$/i.test(S(s)); }

  // ---------- Formatos de stock ----------

  // SAP por SKU-talla (Casa Anny 08-07): '# | Numero de articulo | Descripcion del articulo | En stock'
  function sap(aoa) {
    var H = findHeader(aoa, function (h) { return h.some(function (x) { return /mero de art/i.test(x); }) && h.some(function (x) { return /en stock/i.test(x); }); });
    if (!H) return null;
    var cS = colIx(H.h, /mero de art/i), cD = colIx(H.h, /^descrip/i), cQ = colIx(H.h, /en stock/i), items = {};
    for (var i = H.i + 1; i < aoa.length; i++) {
      var r = aoa[i] || [], sku = S(r[cS]); if (!sku) continue;
      var des = S(r[cD]), st = N(r[cQ]) || 0, p = sku.split('-'), mo = p[0];
      // el color proveedor va despues del modelo en la descripcion (Umbro usa otro codigo en el SKU: 82291U-3611 -> 82291U-A66)
      var tok = des.split(/\s+/), ix = tok.indexOf(mo);
      var col = ix >= 0 && ix + 1 < tok.length - 1 ? tok[ix + 1] : (p.length >= 3 ? p[1] : '');
      var mc = (col ? mo + '-' + col : mo).toUpperCase();
      var it = items[mc] || (items[mc] = { mo: mo, d: ix > 0 ? tok.slice(0, ix).join(' ') : des, st: 0 });
      it.st += st;
    }
    return { formato: 'SAP por SKU-talla', items: items };
  }

  // Resumen por modelo (Casa Anny 18-05): MOD | COLOR PROV | COMPRA | STOCK | PRECIO (costo) | $ Venta (precio publico)
  function resumen(aoa) {
    var H = findHeader(aoa, function (h) { return h.indexOf('MOD') >= 0 && h.indexOf('STOCK') >= 0 && h.indexOf('COLOR PROV') >= 0; });
    if (!H) return null;
    var ix = {}; H.h.forEach(function (x, c) { if (x && !(x in ix)) ix[x] = c; });
    var items = {}, marca = '', mo = '', d = '';
    for (var i = H.i + 1; i < aoa.length; i++) {
      var r = aoa[i] || [], first = S(r[0]);
      if (/^Total/i.test(first)) continue;
      if (first) marca = first;
      var m = S(r[ix['MOD']]); if (m) { mo = m; d = S(r[ix['DESCRIPCION']]); }
      var col = S(r[ix['COLOR PROV']]); if (!col || !mo) continue;
      if (/^\d{1,2}$/.test(col)) col = col.padStart(3, '0');
      items[(mo + '-' + col).toUpperCase()] = { mo: mo, d: d.replace(mo, '').trim(), st: N(r[ix['STOCK']]) || 0, compra: N(r[ix['COMPRA']]), costo: N(r[ix['PRECIO']]), precio: N(r[ix['$ Venta']]), marca: marca };
    }
    return { formato: 'Resumen por modelo', items: items };
  }

  // Detalle SKU-talla (Nace 11-05): Marca | ... | cod color | linea | ... | Stock actual. Solo linea CALZADO.
  function detalle(aoa) {
    var H = findHeader(aoa, function (h) { return h.some(function (x) { return /^cod color$/i.test(x); }) && h.some(function (x) { return /stock actual/i.test(x); }); });
    if (!H) return null;
    var cC = colIx(H.h, /^cod color$/i), cQ = colIx(H.h, /stock actual/i), cL = colIx(H.h, /^linea$/i), cM = colIx(H.h, /^marca$/i), cD = colIx(H.h, /^descrip/i), items = {};
    for (var i = H.i + 1; i < aoa.length; i++) {
      var r = aoa[i] || [], mc = S(r[cC]).toUpperCase(); if (!mc) continue;
      if (cL >= 0 && !/CALZADO/i.test(S(r[cL]))) continue;
      var it = items[mc] || (items[mc] = { mo: mc.split('-')[0], d: S(r[cD]), st: 0, marca: S(r[cM]) });
      it.st += N(r[cQ]) || 0;
    }
    return { formato: 'Detalle SKU-talla (solo calzado)', items: items };
  }

  // Lista modelo-color (Nace 04-02): 1a columna el codigo-color, una columna STK / Stock
  function lista(aoa) {
    var H = findHeader(aoa, function (h) { return h.some(function (x) { return /^(stk|stock)\b/i.test(x); }); });
    if (!H) return null;
    var cQ = colIx(H.h, /^(stk|stock)\b/i), cD = colIx(H.h, /^descrip/i);
    var body = aoa.slice(H.i + 1).filter(function (r) { return r && S(r[0]) && !/^Total/i.test(S(r[0])); });
    if (!body.length || body.filter(function (r) { return esMC(r[0]); }).length < body.length * 0.8) return null;
    var items = {};
    body.forEach(function (r) {
      if (!esMC(r[0])) return;
      var mc = S(r[0]).toUpperCase();
      var it = items[mc] || (items[mc] = { mo: mc.split('-')[0], d: cD >= 0 ? S(r[cD]) : '', st: 0 });
      it.st += N(r[cQ]) || 0;
    });
    return { formato: 'Lista por modelo-color', items: items };
  }

  // Venta y stock del cliente (Multihogar): Marca | articulo | Modelo | Color | PVP | UPC | Unid Vta Total | Inv Actual
  // Sin codigo de color: se resuelve en el dashboard con la facturacion. Si trae filas "Total <articulo>", manda el total
  // (el detalle por talla puede venir incompleto).
  function ventaStock(aoa) {
    var H = findHeader(aoa, function (h) { return h.some(function (x) { return /^modelo$/i.test(x); }) && h.some(function (x) { return /inv\.?\s*actual/i.test(x); }); });
    if (!H) return null;
    var c = function (re) { return colIx(H.h, re); };
    var cMo = c(/^modelo$/i), cCo = c(/^color$/i), cA = c(/^articulo$/i), cP = c(/^pvp$/i), cU = c(/^upc$/i), cV = c(/unid\.?\s*vta/i), cI = c(/inv\.?\s*actual/i), cD = c(/^(descripcion|dsc_corta)$/i), cMa = c(/^marca$/i);
    var det = {}, tot = {};
    for (var i = H.i + 1; i < aoa.length; i++) {
      var r = aoa[i] || [], art = cA >= 0 ? S(r[cA]) : String(i);
      var mT = art.match(/^total\s+(.+)$/i);
      if (mT) { tot[mT[1].trim()] = { st: N(r[cI]) || 0, vi: N(r[cV]) || 0 }; continue; }
      var mo = S(r[cMo]).toUpperCase(); if (!mo) continue;
      if (cMa >= 0 && S(r[cMa]) && !/CALZADO/i.test(S(r[cMa]))) continue;
      var d = det[art] || (det[art] = { mo: mo, colName: S(r[cCo]).toUpperCase(), d: S(r[cD]), precio: N(r[cP]), costo: N(r[cU]), st: 0, vi: 0 });
      d.st += N(r[cI]) || 0; d.vi += N(r[cV]) || 0;
    }
    var items = {};
    Object.keys(det).forEach(function (art) {
      var x = det[art], t = tot[art] || x, conColor = x.mo.indexOf('-') >= 0;
      var raw = conColor ? x.mo : x.mo + '·' + x.colName;
      var it = items[raw] || (items[raw] = { mo: x.mo.split('-')[0], d: x.d, st: 0, vi: 0, precio: x.precio, costo: x.costo, needColor: !conColor, colName: x.colName });
      it.st += t.st; it.vi += t.vi;
    });
    return { formato: 'Venta y stock del cliente', items: items };
  }

  var LECTORES_STOCK = [sap, resumen, detalle, lista, ventaStock];

  // ---------- Facturacion detallada ----------
  var isoDeSerial = function (n) { return new Date(Math.round((n - 25569) * 864e5)).toISOString().slice(0, 10); };
  function facturacion(aoa) {
    var H = findHeader(aoa, function (h) { return h.some(function (x) { return /^card name$/i.test(x); }) && h.some(function (x) { return /^modelo-color$/i.test(x); }) && h.some(function (x) { return /^cantidad$/i.test(x); }); });
    if (!H) return null;
    var c = function (re) { return colIx(H.h, re); };
    var cF = c(/^fecha$/i), cN = c(/^card name$/i), cM = c(/^modelo-color$/i), cQ = c(/^cantidad$/i), cT = c(/^total neto$/i), cL = c(/^linea$/i), cD = c(/^tipo doc$/i);
    var rows = [];
    for (var i = H.i + 1; i < aoa.length; i++) {
      var r = aoa[i] || []; if (cL >= 0 && !/CALZADO/i.test(S(r[cL]))) continue;
      var f = r[cF], iso = typeof f === 'number' ? isoDeSerial(f) : null;
      if (!iso) {
        var t = S(f), m = t.match(/^(\d{4})-(\d{2})-(\d{2})/) || t.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
        if (!m) continue;
        iso = m[1].length === 4 ? m[1] + '-' + m[2] + '-' + m[3] : m[3] + '-' + pad(m[2]) + '-' + pad(m[1]);
      }
      rows.push({ card: S(r[cN]).toUpperCase(), f: iso, mc: S(r[cM]).toUpperCase(), q: N(r[cQ]) || 0, neto: N(r[cT]) || 0, td: S(r[cD]).toUpperCase() });
    }
    return rows.length ? { formato: 'Facturación detallada (calzado)', rows: rows } : null;
  }

  // ---------- Excel_Macro (hoja Imagenes) ----------
  function imagenes(aoa) {
    var H = findHeader(aoa, function (h) { return h.some(function (x) { return /nombre del archivo/i.test(x); }) && h.some(function (x) { return /^link/i.test(x); }); });
    if (!H) return null;
    var cN = colIx(H.h, /nombre del archivo/i), cL = colIx(H.h, /^link/i), map = {};
    for (var i = H.i + 1; i < aoa.length; i++) {
      var r = aoa[i] || [], k = S(r[cN]).replace(/\.(jpe?g|png|webp)$/i, '').toUpperCase(), m = S(r[cL]).match(/id=([\w-]+)/);
      if (k && m && !(k in map)) map[k] = m[1];
    }
    return map;
  }

  // ---------- Libro completo ----------
  function leerLibro(bytes) {
    var wb = G.XLSX.read(bytes, { type: 'array' });
    for (var s = 0; s < wb.SheetNames.length; s++) {
      var name = wb.SheetNames[s];
      var aoa = G.XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: true, defval: null });
      var img = imagenes(aoa); if (img) return { tipo: 'img', map: img };
      var fac = facturacion(aoa); if (fac) return Object.assign({ tipo: 'fact' }, fac);
      for (var p = 0; p < LECTORES_STOCK.length; p++) {
        var r = LECTORES_STOCK[p](aoa);
        if (r && Object.keys(r.items).length) {
          Object.keys(r.items).forEach(function (k) { var it = r.items[k]; it.st = Math.round(it.st * 100) / 100; });
          return Object.assign({ tipo: 'stock', hoja: name }, r);
        }
      }
    }
    return { tipo: '?' };
  }

  // ---------- Cliente y fecha desde el nombre del archivo ----------
  var ALIAS = [[/anny/i, 'CASA ANNY'], [/nace/i, 'COMERCIAL NACE'], [/multihoga/i, 'MULTIHOGAR']];
  var RE_FECHA = /(\d{1,2})[-._ ](\d{1,2})[-._ ](\d{2,4})(?!\d)/;
  function fechaDe(name) { var m = name.match(RE_FECHA); if (!m) return null; var y = +m[3]; if (y < 100) y += 2000; return pad(m[1]) + '-' + pad(m[2]) + '-' + y; }
  function clienteDe(name, conocidos) {
    for (var i = 0; i < ALIAS.length; i++) if (ALIAS[i][0].test(name)) return ALIAS[i][1];
    var n = name.toLowerCase(), k = (conocidos || []).find(function (c) { return n.indexOf(c.toLowerCase()) >= 0; });
    if (k) return k;
    return name.replace(/\.xlsx?$/i, '').replace(RE_FECHA, '').replace(/status de stock|venta|stock|sell ?out|converse|\bal\b/ig, '').replace(/\s+/g, ' ').trim().toUpperCase();
  }

  G.Lectores = { leerLibro: leerLibro, fechaDe: fechaDe, clienteDe: clienteDe, N: N, S: S };
})(window);
