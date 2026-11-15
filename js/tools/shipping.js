/* Shipping Calculator: chargeable weight (actual vs volumetric), editable sample rate table (CNY), live CNY conversion. */
(function () {
  "use strict";
  var RV = window.RV;

  var DEFAULT_RATES = [
    { id: "ems", name: "EMS", first: 140, cont: 45, divisor: 6000, max: 30, days: "8–20" },
    { id: "gdems", name: "GD-EMS", first: 125, cont: 42, divisor: 6000, max: 30, days: "10–20" },
    { id: "eub", name: "ePacket / EUB", first: 75, cont: 32, divisor: 0, max: 2, days: "12–25" },
    { id: "chinapost", name: "China Post Air Parcel", first: 100, cont: 38, divisor: 0, max: 20, days: "15–35" },
    { id: "taxfree", name: "Tax-free air line", first: 115, cont: 38, divisor: 6000, max: 25, days: "10–18" },
    { id: "dhl", name: "DHL Express", first: 280, cont: 60, divisor: 5000, max: 70, days: "4–8" },
    { id: "fedex", name: "FedEx International", first: 260, cont: 55, divisor: 5000, max: 68, days: "5–9" }
  ];
  var DEFAULT_ZONES = { us: 1, ca: 1.05, uk: 1, eu: 1.05, au: 1.1, other: 1.2 };
  var ZONE_NAMES = { us: "United States", ca: "Canada", uk: "United Kingdom", eu: "EU", au: "Australia / NZ", other: "Rest of world" };
  var COUNTRIES = [
    ["US", "United States", "us"], ["CA", "Canada", "ca"], ["GB", "United Kingdom", "uk"], ["DE", "Germany", "eu"], ["FR", "France", "eu"],
    ["IT", "Italy", "eu"], ["ES", "Spain", "eu"], ["NL", "Netherlands", "eu"], ["BE", "Belgium", "eu"], ["PL", "Poland", "eu"], ["SE", "Sweden", "eu"],
    ["IE", "Ireland", "eu"], ["AU", "Australia", "au"], ["NZ", "New Zealand", "au"], ["MX", "Mexico", "other"], ["BR", "Brazil", "other"],
    ["AE", "United Arab Emirates", "other"], ["SG", "Singapore", "other"], ["JP", "Japan", "other"], ["KZ", "Kazakhstan", "other"], ["XX", "Other country", "other"]
  ];

  function rates() { return JSON.parse(JSON.stringify(RV.store.get("shipRates") || DEFAULT_RATES)); }
  function zones() { return RV.store.get("zones") || Object.assign({}, DEFAULT_ZONES); }

  function quote(line, actualKg, dims, zoneMult) {
    var vol = 0;
    if (dims && line.divisor) vol = (dims[0] * dims[1] * dims[2]) / line.divisor;
    var chargeable = Math.max(actualKg, vol);
    var billed = Math.max(0.5, Math.ceil(chargeable * 2 - 1e-9) / 2);
    var steps = Math.max(0, (billed - 0.5) / 0.5);
    var base = line.first + steps * line.cont;
    return { line: line, vol: vol, chargeable: chargeable, billed: billed, steps: steps, base: base, total: base * zoneMult, over: billed > line.max };
  }

  RV.register("shipping", {
    title: "Shipping Calculator", icon: "truck", group: "tools",
    blurb: "Estimate international shipping by weight, size, line and destination.",
    meta: function () { return RV.store.get("shipRates") ? "Custom rates" : "Sample rates"; },
    render: function (el) {
      var wu = RV.setting("weightUnit") || "kg";
      el.innerHTML =
        '<div class="page-head"><div><span class="eyebrow">Tool</span><h1>Shipping Calculator</h1><p class="lede">Chargeable weight is the greater of actual and volumetric weight, billed in 0.5 kg steps. Costs are estimates from the editable rate table below.</p></div></div>' +
        '<div class="split">' +
          '<section class="card" aria-labelledby="sc-in-h"><div class="card-head"><h2 id="sc-in-h">Parcel</h2></div>' +
            '<form id="sc-form" class="form-grid" novalidate>' +
              '<div class="field"><label class="label" for="sc-w">Weight</label><input class="input" id="sc-w" type="number" inputmode="decimal" min="0" step="any" placeholder="e.g. 2.3"></div>' +
              '<div class="field"><label class="label" for="sc-wu">Unit</label><select class="select" id="sc-wu"><option value="g">grams (g)</option><option value="kg">kilograms (kg)</option><option value="lb">pounds (lb)</option></select></div>' +
              '<fieldset class="full" style="border:0;padding:0;margin:0"><legend class="label" style="margin-bottom:6px">Dimensions in cm (optional, for volumetric weight)</legend><div class="form-grid" style="grid-template-columns:repeat(3,minmax(0,1fr))">' +
                '<div class="field"><label class="sr-only" for="sc-l">Length (cm)</label><input class="input" id="sc-l" type="number" inputmode="decimal" min="0" step="any" placeholder="L"></div>' +
                '<div class="field"><label class="sr-only" for="sc-wd">Width (cm)</label><input class="input" id="sc-wd" type="number" inputmode="decimal" min="0" step="any" placeholder="W"></div>' +
                '<div class="field"><label class="sr-only" for="sc-h">Height (cm)</label><input class="input" id="sc-h" type="number" inputmode="decimal" min="0" step="any" placeholder="H"></div></div></fieldset>' +
              '<div class="field"><label class="label" for="sc-country">Destination</label><select class="select" id="sc-country">' + COUNTRIES.map(function (c) { return '<option value="' + c[0] + '">' + c[1] + "</option>"; }).join("") + "</select></div>" +
              '<div class="field"><label class="label" for="sc-line">Shipping line</label><select class="select" id="sc-line"></select></div>' +
              '<div class="full row"><button class="btn btn-primary" type="submit">' + RV.icon("truck") + 'Calculate</button><button class="btn btn-ghost" type="button" id="sc-reset">Reset</button></div>' +
            "</form>" +
          "</section>" +
          '<section class="card" aria-labelledby="sc-out-h"><div class="card-head"><div><h2 id="sc-out-h">Estimate</h2><p class="card-sub" id="sc-fx">Loading exchange rate…</p></div></div><div id="sc-out" aria-live="polite"><div class="empty" style="padding:28px"><p>Enter a weight to see an estimate.</p></div></div></section>' +
        "</div>" +
        '<section class="card" style="margin-top:18px" aria-labelledby="sc-cmp-h"><div class="card-head"><div><h2 id="sc-cmp-h">Compare all lines</h2><p class="card-sub">Same parcel, every line in your rate table.</p></div></div><div id="sc-cmp"><p class="muted">Calculate to compare.</p></div></section>' +
        '<section class="card" aria-labelledby="sc-rt-h"><div class="card-head"><div><h2 id="sc-rt-h">Rate table (CNY)</h2><p class="card-sub">Sample estimates, not live agent prices. Replace them with your agent’s current quote and save.</p></div><div class="actions"><button class="btn btn-sm" type="button" id="rt-add">' + RV.icon("plus") + 'Add line</button><button class="btn btn-sm btn-ghost" type="button" id="rt-default">Restore samples</button></div></div>' +
          '<form id="rt-form" novalidate><div class="table-wrap"><table><thead><tr><th scope="col">Line</th><th scope="col">First 0.5 kg ¥</th><th scope="col">Each extra 0.5 kg ¥</th><th scope="col">Vol. divisor</th><th scope="col">Max kg</th><th scope="col">Days</th><th scope="col"><span class="sr-only">Remove</span></th></tr></thead><tbody id="rt-body"></tbody></table></div>' +
          '<p class="hint" style="margin:10px 0">Volumetric divisor: L×W×H ÷ 5000 (express couriers) or ÷ 6000 (most postal/air lines). Use 0 to ignore size.</p>' +
          '<h3 style="margin:16px 0 10px">Destination multipliers</h3><div class="form-grid" style="grid-template-columns:repeat(auto-fit,minmax(130px,1fr))" id="zone-grid"></div>' +
          '<div class="row" style="margin-top:16px"><button class="btn btn-primary" type="submit">' + RV.icon("check") + "Save rate table</button></div></form>" +
        "</section>";

      var form = RV.$("#sc-form", el);
      RV.$("#sc-wu", el).value = wu;
      var lineSel = RV.$("#sc-line", el);
      function fillLines() {
        var cur = lineSel.value;
        lineSel.innerHTML = rates().map(function (r) { return '<option value="' + RV.esc(r.id) + '">' + RV.esc(r.name) + "</option>"; }).join("");
        if (cur && rates().some(function (r) { return r.id === cur; })) lineSel.value = cur;
      }
      fillLines();

      function fxLine() {
        var c = RV.fx.cached(), cur = RV.setting("currency");
        RV.$("#sc-fx", el).textContent = c ? "¥1 = " + RV.round(c.rates[cur], 4) + " " + cur + " · " + RV.fx.label() : "Exchange rate unavailable: showing CNY only.";
      }
      RV.fx.load().then(function () { fxLine(); if (lastCalc) calc(true); }, function () { fxLine(); });
      fxLine();

      var lastCalc = false;
      function readInputs(silent) {
        var w = RV.$("#sc-w", el), unitV = RV.$("#sc-wu", el).value;
        var n = RV.num(w.value);
        var err = !w.value.trim() ? "Enter the parcel weight." : !(n > 0) ? "Weight must be greater than 0." : null;
        var kg = unitV === "g" ? n / 1000 : unitV === "lb" ? n * 0.45359237 : n;
        if (!err && kg > 300) err = "That’s over 300 kg. Check the unit.";
        if (!silent || w.value.trim()) RV.fieldError(w, err);
        var dimsInputs = ["#sc-l", "#sc-wd", "#sc-h"].map(function (s) { return RV.$(s, el); });
        var dv = dimsInputs.map(function (i) { return i.value.trim(); });
        var dims = null, dimErr = false;
        if (dv.some(Boolean)) {
          var nums = dv.map(RV.num);
          dimsInputs.forEach(function (i, k) {
            var bad = !(nums[k] > 0) || nums[k] > 300;
            RV.fieldError(i, bad ? (dv[k] ? "1–300 cm" : "Required") : null);
            if (bad) dimErr = true;
          });
          if (!dimErr) dims = nums;
        } else dimsInputs.forEach(function (i) { RV.fieldError(i, null); });
        if (err || dimErr) return null;
        return { kg: kg, dims: dims };
      }

      function calc(silent) {
        var inp = readInputs(silent);
        var outEl = RV.$("#sc-out", el), cmp = RV.$("#sc-cmp", el);
        if (!inp) {
          if (!silent) RV.toast("Check the highlighted fields.", "error");
          return;
        }
        lastCalc = true;
        var country = COUNTRIES.filter(function (c) { return c[0] === RV.$("#sc-country", el).value; })[0];
        var zm = zones()[country[2]] || 1;
        var cur = RV.setting("currency");
        var all = rates().map(function (r) { return quote(r, inp.kg, inp.dims, zm); });
        var q = all.filter(function (x) { return x.line.id === lineSel.value; })[0] || all[0];
        if (!q) { outEl.innerHTML = '<div class="notice notice-error">' + RV.icon("alert") + "<div>Your rate table is empty. Add a line below.</div></div>"; return; }
        var conv = RV.fx.convert(q.total, cur);
        outEl.innerHTML =
          '<div class="stack"><div><span class="eyebrow">Estimated cost · ' + RV.esc(q.line.name) + " → " + RV.esc(country[1]) + '</span><div class="big-num">' + RV.fx.cny(q.total) + '</div><div class="muted" style="margin-top:6px">≈ ' + (conv != null ? RV.esc(RV.fx.format(conv, cur)) : "conversion unavailable") + "</div></div>" +
          (q.over ? '<div class="notice notice-error">' + RV.icon("alert") + "<div><strong>Over this line’s " + q.line.max + " kg limit.</strong> Split the parcel or choose another line.</div></div>" : "") +
          '<dl class="kv"><dt>Actual weight</dt><dd>' + RV.round(inp.kg, 3) + " kg</dd>" +
            "<dt>Volumetric weight</dt><dd>" + (inp.dims ? (q.line.divisor ? RV.round(q.vol, 3) + " kg (" + inp.dims.join("×") + " ÷ " + q.line.divisor + ")" : "Not used on this line") : "No dimensions entered") + "</dd>" +
            "<dt>Billed weight</dt><dd>" + q.billed + " kg (0.5 kg steps)</dd>" +
            "<dt>Calculation</dt><dd>¥" + q.line.first + " + " + q.steps + " × ¥" + q.line.cont + " = ¥" + RV.round(q.base, 2) + (zm !== 1 ? " × " + zm + " (" + ZONE_NAMES[country[2]] + ")" : "") + "</dd>" +
            "<dt>Typical transit</dt><dd>" + RV.esc(q.line.days || "—") + " days</dd></dl>" +
          '<p class="hint">Estimate only. Real costs depend on your agent, item type, battery/brand checks and remote-area fees.</p></div>';
        var sorted = all.slice().sort(function (a, b) { return a.over - b.over || a.total - b.total; });
        cmp.innerHTML = '<div class="table-wrap"><table><thead><tr><th scope="col">Line</th><th scope="col">Billed</th><th scope="col">Estimate (CNY)</th><th scope="col">≈ ' + cur + '</th><th scope="col">Days</th><th scope="col">Note</th></tr></thead><tbody>' +
          sorted.map(function (x, i) {
            var c = RV.fx.convert(x.total, cur);
            return "<tr" + (x.line.id === q.line.id ? ' class="is-hit"' : "") + "><td>" + RV.esc(x.line.name) + '</td><td class="num">' + x.billed + ' kg</td><td class="num">' + RV.fx.cny(x.total) + '</td><td class="num">' + (c != null ? RV.esc(RV.fx.format(c, cur)) : "—") + "</td><td>" + RV.esc(x.line.days || "—") + "</td><td>" + (x.over ? "Over " + x.line.max + " kg" : i === 0 ? "Cheapest" : "") + "</td></tr>";
          }).join("") + "</tbody></table></div>";
      }

      form.addEventListener("submit", function (e) { e.preventDefault(); calc(false); });
      form.addEventListener("input", function () { if (lastCalc) calc(true); });
      form.addEventListener("change", function (e) {
        if (e.target.id === "sc-wu") RV.setting("weightUnit", e.target.value);
        if (lastCalc) calc(true);
      });
      RV.$("#sc-reset", el).addEventListener("click", function () {
        form.reset(); RV.$("#sc-wu", el).value = RV.setting("weightUnit");
        RV.$$(".input", form).forEach(function (i) { RV.fieldError(i, null); });
        lastCalc = false;
        RV.$("#sc-out", el).innerHTML = '<div class="empty" style="padding:28px"><p>Enter a weight to see an estimate.</p></div>';
        RV.$("#sc-cmp", el).innerHTML = '<p class="muted">Calculate to compare.</p>';
      });

      // Rate table editor
      var draft = rates();
      var rtBody = RV.$("#rt-body", el);
      function paintRates() {
        rtBody.innerHTML = draft.map(function (r, i) {
          function cell(k, type, label) { return '<td><label class="sr-only" for="rt-' + k + "-" + i + '">' + label + " for " + RV.esc(r.name) + '</label><input class="input' + (type === "number" ? " num" : "") + '" id="rt-' + k + "-" + i + '" data-i="' + i + '" data-k="' + k + '" type="' + type + '"' + (type === "number" ? ' inputmode="decimal" min="0" step="any"' : "") + ' value="' + RV.esc(r[k]) + '"></td>'; }
          return "<tr>" + cell("name", "text", "Line name") + cell("first", "number", "First 0.5 kg price") + cell("cont", "number", "Extra 0.5 kg price") + cell("divisor", "number", "Volumetric divisor") + cell("max", "number", "Max weight") + cell("days", "text", "Transit days") +
            '<td><button class="icon-btn" type="button" data-del="' + i + '" aria-label="Remove ' + RV.esc(r.name) + '">' + RV.icon("trash") + "</button></td></tr>";
        }).join("") || '<tr><td colspan="7" class="muted">No lines. Add one or restore the samples.</td></tr>';
        var z = zones();
        RV.$("#zone-grid", el).innerHTML = Object.keys(DEFAULT_ZONES).map(function (k) {
          return '<div class="field"><label class="label" for="z-' + k + '">' + ZONE_NAMES[k] + ' ×</label><input class="input num" id="z-' + k + '" data-zone="' + k + '" type="number" inputmode="decimal" min="0.1" max="5" step="0.01" value="' + z[k] + '"></div>';
        }).join("");
      }
      rtBody.addEventListener("input", function (e) {
        var t = e.target; if (!t.dataset.k) return;
        draft[+t.dataset.i][t.dataset.k] = t.type === "number" ? t.value : t.value;
      });
      rtBody.addEventListener("click", function (e) {
        var b = e.target.closest("[data-del]"); if (!b) return;
        draft.splice(+b.dataset.del, 1); paintRates();
      });
      RV.$("#rt-add", el).addEventListener("click", function () {
        draft.push({ id: "line-" + RV.uid(), name: "New line", first: 100, cont: 40, divisor: 6000, max: 30, days: "" });
        paintRates();
        var inp = RV.$("#rt-name-" + (draft.length - 1), el); if (inp) { inp.focus(); inp.select(); }
      });
      RV.$("#rt-default", el).addEventListener("click", function () {
        RV.confirm("Restore sample rates?", "Your custom rate table and destination multipliers will be replaced with the built-in samples.", "Restore").then(function (ok) {
          if (!ok) return;
          RV.store.set("shipRates", null); RV.store.set("zones", null);
          draft = rates(); paintRates(); fillLines(); if (lastCalc) calc(true);
          RV.toast("Sample rates restored");
        });
      });
      RV.$("#rt-form", el).addEventListener("submit", function (e) {
        e.preventDefault();
        var ok = true, clean = [];
        draft.forEach(function (r, i) {
          var row = { id: r.id || "line-" + RV.uid(), name: String(r.name).trim(), first: RV.num(r.first), cont: RV.num(r.cont), divisor: RV.num(r.divisor), max: RV.num(r.max), days: String(r.days || "").trim() };
          RV.fieldError(RV.$("#rt-name-" + i, el), row.name ? null : "Name required");
          ["first", "cont", "divisor", "max"].forEach(function (k) {
            var bad = !(row[k] >= 0) || (k === "max" && !(row[k] > 0));
            RV.fieldError(RV.$("#rt-" + k + "-" + i, el), bad ? "Invalid" : null);
            if (bad) ok = false;
          });
          if (!row.name) ok = false;
          clean.push(row);
        });
        var z = {};
        RV.$$("[data-zone]", el).forEach(function (inp) {
          var v = RV.num(inp.value), bad = !(v >= 0.1 && v <= 5);
          RV.fieldError(inp, bad ? "0.1–5" : null); if (bad) ok = false; z[inp.dataset.zone] = v;
        });
        if (!clean.length) { RV.toast("Add at least one shipping line.", "error"); return; }
        if (!ok) { RV.toast("Fix the highlighted rate fields.", "error"); return; }
        if (RV.store.set("shipRates", clean) && RV.store.set("zones", z)) RV.toast("Rate table saved", "success");
        draft = rates(); paintRates(); fillLines(); if (lastCalc) calc(true);
      });
      paintRates();
    }
  });
})();
