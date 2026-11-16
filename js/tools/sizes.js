/* Size Converter: shoe sizes (US M/W, UK, EU, CM), clothing charts, saved body measurements and recommendations.
   Shoe chart follows Nike's published unisex conversion; clothing ranges follow common published menswear charts. */
(function () {
  "use strict";
  var RV = window.RV;

  // [US men, UK, EU, CM foot length]
  var SHOES = [
    [3.5, 3, 35.5, 22.5], [4, 3.5, 36, 23], [4.5, 4, 36.5, 23.5], [5, 4.5, 37.5, 23.5], [5.5, 5, 38, 24],
    [6, 5.5, 38.5, 24], [6.5, 6, 39, 24.5], [7, 6, 40, 25], [7.5, 6.5, 40.5, 25.5], [8, 7, 41, 26],
    [8.5, 7.5, 42, 26.5], [9, 8, 42.5, 27], [9.5, 8.5, 43, 27.5], [10, 9, 44, 28], [10.5, 9.5, 44.5, 28.5],
    [11, 10, 45, 29], [11.5, 10.5, 45.5, 29.5], [12, 11, 46, 30], [12.5, 11.5, 47, 30.5], [13, 12, 47.5, 31],
    [14, 13, 48.5, 32], [15, 14, 49.5, 33]
  ];
  var SHOE_COLS = { usm: "US Men", usw: "US Women", uk: "UK", eu: "EU", cm: "CM" };
  function shoeRow(r) { return { usm: r[0], usw: r[0] + 1.5, uk: r[1], eu: r[2], cm: r[3] }; }

  // Tops: chest cm min-max; Bottoms: waist & hip cm.
  var CLOTHES = [
    { us: "XS", eu: "44", uk: "34", cn: "S · 165/84A", chest: [82, 87], waist: [68, 72], hips: [82, 87], usW: "26–27" },
    { us: "S", eu: "46", uk: "36", cn: "M · 170/88A", chest: [88, 95], waist: [73, 79], hips: [88, 95], usW: "28–30" },
    { us: "M", eu: "48–50", uk: "38–40", cn: "L · 175/92A", chest: [96, 103], waist: [80, 87], hips: [96, 103], usW: "31–33" },
    { us: "L", eu: "52", uk: "42", cn: "XL · 180/96A", chest: [104, 111], waist: [88, 95], hips: [104, 111], usW: "34–36" },
    { us: "XL", eu: "54", uk: "44–46", cn: "XXL · 185/100A", chest: [112, 119], waist: [96, 103], hips: [112, 119], usW: "37–39" },
    { us: "XXL", eu: "56", uk: "48", cn: "3XL · 190/104A", chest: [120, 127], waist: [104, 111], hips: [120, 127], usW: "40–42" }
  ];
  var FIELDS = [
    { k: "chest", label: "Chest" }, { k: "waist", label: "Waist" }, { k: "hips", label: "Hips" },
    { k: "height", label: "Height" }, { k: "inseam", label: "Inseam / leg length" }, { k: "foot", label: "Foot length" }
  ];
  var IN = 2.54;

  function fmt(n) { return Number.isInteger(n) ? String(n) : String(n); }
  function pickClothes(cm, key) {
    if (!cm) return null;
    for (var i = 0; i < CLOTHES.length; i++) {
      var r = CLOTHES[i][key];
      if (cm <= r[1]) return { i: i, below: i === 0 && cm < r[0], between: i > 0 && cm < r[0] };
    }
    return { i: CLOTHES.length - 1, above: true };
  }
  function pickShoe(footCm) {
    if (!footCm) return null;
    for (var i = 0; i < SHOES.length; i++) if (footCm <= SHOES[i][3]) return i;
    return SHOES.length - 1;
  }

  RV.register("sizes", {
    title: "Size Converter", icon: "ruler", group: "tools",
    blurb: "Convert shoe and clothing sizes and get a recommendation from your saved measurements.",
    meta: function () { var m = RV.store.get("measurements") || {}; return Object.keys(m).filter(function (k) { return m[k]; }).length ? "Measurements saved" : "US · EU · UK · CM"; },
    render: function (el) {
      var unit = RV.setting("measureUnit") || "cm";
      var tab = "shoes";
      el.innerHTML =
        '<div class="page-head"><div><span class="eyebrow">Tool</span><h1>Size Converter</h1><p class="lede">Shoe and clothing conversions across US, EU, UK and Asian sizing, plus recommendations from your own measurements.</p></div></div>' +
        '<div class="split">' +
          '<div class="stack">' +
            '<section class="card" aria-labelledby="shoe-h"><div class="card-head"><div><h2 id="shoe-h">Shoe sizes</h2><p class="card-sub">Based on Nike’s published chart. Brands vary by about half a size.</p></div></div>' +
              '<div class="form-grid"><div class="field"><label class="label" for="sh-sys">Size system</label><select class="select" id="sh-sys">' + Object.keys(SHOE_COLS).map(function (k) { return '<option value="' + k + '">' + SHOE_COLS[k] + "</option>"; }).join("") + '</select></div>' +
              '<div class="field"><label class="label" for="sh-val">Size</label><select class="select" id="sh-val"></select></div></div>' +
              '<div id="sh-out" class="result" style="margin-top:14px" aria-live="polite"></div>' +
              '<details style="margin-top:14px"><summary class="small muted" style="cursor:pointer">Full shoe chart</summary><div class="table-wrap" style="margin-top:10px"><table id="sh-table"><thead><tr>' + Object.keys(SHOE_COLS).map(function (k) { return '<th scope="col">' + SHOE_COLS[k] + "</th>"; }).join("") + "</tr></thead><tbody></tbody></table></div></details>" +
            "</section>" +
            '<section class="card" aria-labelledby="cl-h"><div class="card-head"><div><h2 id="cl-h">Clothing charts</h2><p class="card-sub">Body measurements in ' + '<span id="cl-unit"></span>' + ".</p></div><div class=\"seg\" role=\"tablist\" aria-label=\"Chart type\"><button type=\"button\" role=\"tab\" data-tab=\"tops\" aria-selected=\"true\">Tops</button><button type=\"button\" role=\"tab\" data-tab=\"bottoms\" aria-selected=\"false\">Bottoms</button></div></div>" +
              '<div class="table-wrap"><table id="cl-table" class="compact"></table></div>' +
              '<div class="notice" style="margin-top:14px">' + RV.icon("info") + "<div><strong>Chinese sizes usually run 1–2 sizes small.</strong> A US M is often an L or XL on Taobao/Weidian. Always compare against the seller’s own chart of garment measurements (in cm) before ordering.</div></div>" +
            "</section>" +
          "</div>" +
          '<section class="card" aria-labelledby="me-h"><div class="card-head"><div><h2 id="me-h">My measurements</h2><p class="card-sub">Saved in this browser. Used for recommendations.</p></div>' +
            '<div class="seg" role="group" aria-label="Units"><button type="button" data-unit="cm" aria-pressed="' + (unit === "cm") + '">cm</button><button type="button" data-unit="in" aria-pressed="' + (unit === "in") + '">in</button></div></div>' +
            '<form id="me-form" class="form-grid" novalidate></form>' +
            '<div class="row" style="margin-top:16px"><button class="btn btn-primary" type="submit" form="me-form">' + RV.icon("check") + 'Save measurements</button><button class="btn btn-ghost" type="button" id="me-clear">Clear</button></div>' +
            '<hr class="divider"><h3 style="margin-bottom:10px">Recommendation</h3><div id="me-rec" aria-live="polite"></div>' +
          "</section>" +
        "</div>";

      var sys = RV.$("#sh-sys", el), val = RV.$("#sh-val", el), out = RV.$("#sh-out", el), tbody = RV.$("#sh-table tbody", el);
      var hitIndex = 7;
      function fillVals() {
        var k = sys.value;
        var counts = {};
        SHOES.forEach(function (r) { var v = shoeRow(r)[k]; counts[v] = (counts[v] || 0) + 1; });
        val.innerHTML = SHOES.map(function (r, i) {
          var row = shoeRow(r), v = row[k];
          var label = fmt(v) + (counts[v] > 1 ? (k === "usm" ? "" : " (US M " + fmt(row.usm) + ")") : "");
          if (counts[v] > 1 && k === "usm") label += " (EU " + row.eu + ")";
          return '<option value="' + i + '"' + (i === hitIndex ? " selected" : "") + ">" + label + "</option>";
        }).join("");
        paintShoe();
      }
      function paintShoe() {
        hitIndex = +val.value;
        var r = shoeRow(SHOES[hitIndex]);
        out.innerHTML = '<div class="grid grid-4" style="grid-template-columns:repeat(auto-fit,minmax(90px,1fr));gap:10px">' + Object.keys(SHOE_COLS).map(function (k) {
          return '<div><div class="faint small">' + SHOE_COLS[k] + '</div><div class="big-num" style="font-size:30px">' + fmt(r[k]) + "</div></div>";
        }).join("") + "</div>";
        tbody.innerHTML = SHOES.map(function (row, i) {
          var x = shoeRow(row);
          return "<tr" + (i === hitIndex ? ' class="is-hit"' : "") + ">" + Object.keys(SHOE_COLS).map(function (k) { return '<td class="num">' + fmt(x[k]) + "</td>"; }).join("") + "</tr>";
        }).join("");
      }
      sys.addEventListener("change", fillVals);
      val.addEventListener("change", paintShoe);
      fillVals();

      var chartTab = "tops";
      function cmToUnit(v) { return unit === "in" ? RV.round(v / IN, 1) : v; }
      function paintChart(hit) {
        RV.$("#cl-unit", el).textContent = unit === "in" ? "inches" : "centimetres";
        var t = RV.$("#cl-table", el);
        if (chartTab === "tops") {
          t.innerHTML = '<thead><tr><th scope="col">US</th><th scope="col">EU</th><th scope="col">UK (chest in)</th><th scope="col">Asian / Chinese</th><th scope="col">Chest</th></tr></thead><tbody>' +
            CLOTHES.map(function (c, i) { return "<tr" + (hit && hit.tops === i ? ' class="is-hit"' : "") + "><td>" + c.us + "</td><td>" + c.eu + "</td><td>" + c.uk + "</td><td>" + c.cn + '</td><td class="num">' + cmToUnit(c.chest[0]) + "–" + cmToUnit(c.chest[1]) + "</td></tr>"; }).join("") + "</tbody>";
        } else {
          t.innerHTML = '<thead><tr><th scope="col">US</th><th scope="col">US waist (in)</th><th scope="col">EU</th><th scope="col">Asian / Chinese</th><th scope="col">Waist</th><th scope="col">Hips</th></tr></thead><tbody>' +
            CLOTHES.map(function (c, i) { return "<tr" + (hit && hit.bottoms === i ? ' class="is-hit"' : "") + "><td>" + c.us + "</td><td>" + c.usW + "</td><td>" + c.eu + "</td><td>" + c.cn + '</td><td class="num">' + cmToUnit(c.waist[0]) + "–" + cmToUnit(c.waist[1]) + '</td><td class="num">' + cmToUnit(c.hips[0]) + "–" + cmToUnit(c.hips[1]) + "</td></tr>"; }).join("") + "</tbody>";
        }
      }
      RV.$$("[data-tab]", el).forEach(function (b) {
        b.addEventListener("click", function () {
          chartTab = b.dataset.tab;
          RV.$$("[data-tab]", el).forEach(function (x) { x.setAttribute("aria-selected", String(x === b)); });
          paintChart(lastHit);
        });
      });

      var form = RV.$("#me-form", el);
      function paintForm() {
        var m = RV.store.get("measurements") || {};
        form.innerHTML = FIELDS.map(function (f) {
          var v = m[f.k] ? cmToUnit(m[f.k]) : "";
          return '<div class="field"><label class="label" for="me-' + f.k + '">' + f.label + " (" + unit + ')</label><input class="input" id="me-' + f.k + '" name="' + f.k + '" type="number" inputmode="decimal" step="0.1" min="0" value="' + v + '"></div>';
        }).join("");
      }
      var LIMITS = { chest: [50, 200], waist: [40, 200], hips: [50, 200], height: [100, 230], inseam: [50, 110], foot: [15, 35] };
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        var m = {}, ok = true;
        FIELDS.forEach(function (f) {
          var inp = RV.$("#me-" + f.k, form), raw = inp.value.trim();
          if (!raw) { RV.fieldError(inp, null); return; }
          var n = RV.num(raw), cm = unit === "in" ? n * IN : n, lim = LIMITS[f.k];
          if (!isFinite(n) || cm < lim[0] || cm > lim[1]) {
            ok = false;
            RV.fieldError(inp, "Enter " + (unit === "in" ? RV.round(lim[0] / IN, 1) + "–" + RV.round(lim[1] / IN, 1) + " in" : lim[0] + "–" + lim[1] + " cm"));
          } else { RV.fieldError(inp, null); m[f.k] = RV.round(cm, 1); }
        });
        if (!ok) { RV.toast("Some measurements look off. Check the highlighted fields.", "error"); return; }
        if (!Object.keys(m).length) { RV.toast("Enter at least one measurement.", "error"); return; }
        if (RV.store.set("measurements", m)) RV.toast("Measurements saved", "success");
        paintRec();
      });
      RV.$("#me-clear", el).addEventListener("click", function () {
        var m = RV.store.get("measurements") || {};
        if (!Object.keys(m).length) { paintForm(); return RV.toast("Nothing saved yet"); }
        RV.confirm("Clear measurements?", "Your saved body measurements will be removed.", "Clear").then(function (ok) {
          if (!ok) return;
          RV.store.set("measurements", {}); paintForm(); paintRec(); RV.toast("Measurements cleared");
        });
      });
      RV.$$("[data-unit]", el).forEach(function (b) {
        b.addEventListener("click", function () {
          if (b.dataset.unit === unit) return;
          // Convert whatever is currently typed (saved or not) to the new unit.
          var from = unit, typed = {};
          FIELDS.forEach(function (f) { var v = RV.$("#me-" + f.k, form).value.trim(); typed[f.k] = v; });
          unit = b.dataset.unit; RV.setting("measureUnit", unit);
          RV.$$("[data-unit]", el).forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); });
          paintForm();
          FIELDS.forEach(function (f) {
            var inp = RV.$("#me-" + f.k, form), raw = typed[f.k], n = RV.num(raw);
            if (!raw) { inp.value = ""; return; }
            if (!isFinite(n)) { inp.value = raw; return; }
            inp.value = RV.round(from === "cm" ? n / IN : n * IN, 1);
          });
          paintChart(lastHit); paintRec();
        });
      });

      var lastHit = null;
      function paintRec() {
        var m = RV.store.get("measurements") || {};
        var box = RV.$("#me-rec", el), lines = [];
        lastHit = {};
        var top = pickClothes(m.chest, "chest");
        if (top) {
          var c = CLOTHES[top.i]; lastHit.tops = top.i;
          var cnIdx = Math.min(top.i + 1, CLOTHES.length - 1);
          lines.push('<div class="out-line"><div><div class="faint small">Tops (chest ' + cmToUnit(m.chest) + " " + unit + ')</div><div class="strong">US ' + c.us + " · EU " + c.eu + " · UK " + c.uk + '</div><div class="small muted">Chinese sellers: try ' + CLOTHES[cnIdx].cn.split(" ·")[0] + " (" + CLOTHES[cnIdx].cn.split("· ")[1] + ")" + (top.between ? " · between sizes, sized up" : "") + (top.above ? " · above chart range" : "") + "</div></div></div>");
        }
        var bot = pickClothes(m.waist, "waist");
        if (bot) {
          var hipFit = pickClothes(m.hips, "hips");
          var bi = hipFit ? Math.max(bot.i, hipFit.i) : bot.i;
          var b = CLOTHES[bi]; lastHit.bottoms = bi;
          var cnB = Math.min(bi + 1, CLOTHES.length - 1);
          lines.push('<div class="out-line"><div><div class="faint small">Bottoms (waist ' + cmToUnit(m.waist) + " " + unit + (m.hips ? ", hips " + cmToUnit(m.hips) + " " + unit : "") + ')</div><div class="strong">US ' + b.us + " (waist " + b.usW + ") · EU " + b.eu + '</div><div class="small muted">Chinese sellers: try ' + CLOTHES[cnB].cn.split(" ·")[0] + (m.inseam ? " · inseam " + cmToUnit(m.inseam) + " " + unit + ", compare with the seller’s length" : "") + "</div></div></div>");
        }
        var si = pickShoe(m.foot);
        if (si != null) {
          var r = shoeRow(SHOES[si]);
          lines.push('<div class="out-line"><div><div class="faint small">Shoes (foot ' + cmToUnit(m.foot) + " " + unit + ')</div><div class="strong">US M ' + r.usm + " · US W " + r.usw + " · UK " + r.uk + " · EU " + r.eu + '</div><div class="small muted">Chart CM ' + r.cm + ". Add 0.5 size for narrow or chunky models.</div></div></div>");
        }
        if (m.height && !top) lines.push('<p class="muted small">Height ' + cmToUnit(m.height) + " " + unit + " saved. Add your chest measurement for a tops recommendation.</p>");
        box.innerHTML = lines.length ? '<div class="stack">' + lines.join("") + '</div><p class="hint" style="margin-top:10px">Recommendations are estimates from standard charts, not a fit guarantee.</p>'
          : '<div class="empty" style="padding:24px"><p>Add your chest, waist or foot length and save to get size recommendations.</p></div>';
        paintChart(lastHit);
      }
      paintForm();
      paintRec();
    }
  });
})();
