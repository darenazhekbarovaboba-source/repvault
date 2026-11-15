/* Settings: display currency, preferred agent, units, backup/restore, clear data. */
(function () {
  "use strict";
  var RV = window.RV;
  var COLLECTIONS = ["products", "qc", "packages", "convHistory"];

  RV.register("settings", {
    title: "Settings", icon: "settings", group: "app",
    blurb: "Preferences and your data",
    render: function (el) {
      var s = RV.store.get("settings");
      var kb = RV.round(RV.store.bytes() / 1024, 1);
      el.innerHTML =
        '<div class="page-head"><div><span class="eyebrow">Vault</span><h1>Settings</h1><p class="lede">Preferences apply across every tool and are saved in this browser.</p></div></div>' +
        '<div class="split">' +
          '<section class="card" aria-labelledby="st-pref-h"><div class="card-head"><h2 id="st-pref-h">Preferences</h2></div><form id="st-form" class="stack" novalidate>' +
            '<div class="field"><label class="label" for="st-cur">Display currency</label><select class="select" id="st-cur">' + RV.fx.currencies.map(function (c) { return '<option value="' + c + '"' + (s.currency === c ? " selected" : "") + ">" + c + "</option>"; }).join("") + '</select><p class="hint">CNY prices are converted with live rates from ExchangeRate-API (open.er-api.com), cached for 6 hours.</p></div>' +
            '<div class="field"><label class="label" for="st-agent">Preferred agent</label><select class="select" id="st-agent">' + RV.links.agentOptions(s.agent) + '</select><p class="hint">Used for “Open on agent” buttons in QC Finder and Product Organizer.</p></div>' +
            '<div class="form-grid"><div class="field"><label class="label" for="st-wu">Default weight unit</label><select class="select" id="st-wu"><option value="g">g</option><option value="kg">kg</option><option value="lb">lb</option></select></div>' +
            '<div class="field"><label class="label" for="st-mu">Measurement unit</label><select class="select" id="st-mu"><option value="cm">cm</option><option value="in">in</option></select></div></div>' +
            '<div class="row"><button class="btn btn-primary" type="submit">' + RV.icon("check") + "Save preferences</button></div>" +
          "</form></section>" +
          '<div class="stack">' +
            '<section class="card" aria-labelledby="st-fx-h"><div class="card-head"><div><h2 id="st-fx-h">Exchange rate</h2><p class="card-sub" id="st-fx-label">' + RV.esc(RV.fx.label()) + '</p></div><button class="btn btn-sm" type="button" id="st-fx-refresh">' + RV.icon("refresh") + 'Refresh</button></div><div id="st-fx"></div></section>' +
            '<section class="card" aria-labelledby="st-data-h"><div class="card-head"><div><h2 id="st-data-h">Your data</h2><p class="card-sub">Using about ' + kb + " KB of browser storage (most browsers allow ~5 MB).</p></div></div>" +
              '<div class="actions"><button class="btn" type="button" id="st-export">' + RV.icon("download") + 'Export full backup</button><label class="btn" style="cursor:pointer">' + RV.icon("upload") + 'Restore backup<input class="sr-only" type="file" accept="application/json,.json" id="st-import"></label><button class="btn btn-danger" type="button" id="st-clear">' + RV.icon("trash") + "Clear all data</button></div>" +
              '<p class="hint" style="margin-top:12px">Nothing is sent to a server. Clearing your browser data also clears RepVault, so export a backup now and then.</p>' +
            "</section>" +
          "</div>" +
        "</div>";
      RV.$("#st-wu", el).value = s.weightUnit;
      RV.$("#st-mu", el).value = s.measureUnit;

      function paintFx() {
        var c = RV.fx.cached(), box = RV.$("#st-fx", el);
        RV.$("#st-fx-label", el).textContent = RV.fx.label();
        if (!c) { box.innerHTML = '<p class="muted">No rate loaded yet.</p>'; return; }
        box.innerHTML = '<div class="table-wrap"><table><thead><tr><th scope="col">Currency</th><th scope="col">¥1 =</th><th scope="col">¥100 =</th></tr></thead><tbody>' +
          RV.fx.currencies.map(function (k) { return "<tr><td>" + k + '</td><td class="num">' + RV.round(c.rates[k], 4) + '</td><td class="num">' + RV.esc(RV.fx.format(c.rates[k] * 100, k)) + "</td></tr>"; }).join("") + "</tbody></table></div>";
      }
      paintFx();
      RV.$("#st-fx-refresh", el).addEventListener("click", function () {
        var b = this; RV.setBusy(b, true, "Refreshing…");
        RV.fx.load(true).then(function (r) {
          RV.setBusy(b, false); paintFx();
          if (r.source === "stale") RV.toast("Live update failed (" + r.error + "). Showing the cached rate.", "error");
          else RV.toast("Exchange rate updated", "success");
        }, function (err) { RV.setBusy(b, false); paintFx(); RV.toast(err.message, "error"); });
      });

      RV.$("#st-form", el).addEventListener("submit", function (e) {
        e.preventDefault();
        RV.setting("currency", RV.$("#st-cur", el).value);
        RV.setting("agent", RV.$("#st-agent", el).value);
        RV.setting("weightUnit", RV.$("#st-wu", el).value);
        RV.setting("measureUnit", RV.$("#st-mu", el).value);
        document.dispatchEvent(new CustomEvent("rv:fx"));
        RV.toast("Preferences saved", "success");
      });

      RV.$("#st-export", el).addEventListener("click", function () {
        var data = Object.assign({ app: "REPVAULT", type: "backup", exportedAt: new Date().toISOString() }, RV.store.all());
        RV.download("repvault-backup-" + RV.todayISO() + ".json", JSON.stringify(data, null, 2));
        RV.toast("Backup downloaded", "success");
      });
      RV.$("#st-import", el).addEventListener("change", function (e) {
        var f = e.target.files && e.target.files[0]; e.target.value = "";
        if (!f) return;
        RV.readFileText(f).then(function (text) {
          var d; try { d = JSON.parse(text); } catch (err) { throw new Error("That file isn’t valid JSON."); }
          if (!d || d.app !== "REPVAULT" || d.type !== "backup") throw new Error("This isn’t a RepVault full backup. (Product exports can be imported in Product Organizer.)");
          return RV.confirm("Restore backup?", "This replaces all current RepVault data with the backup from " + (d.exportedAt ? RV.fmtDate(d.exportedAt, true) : "the file") + ".", "Restore").then(function (ok) {
            if (!ok) return;
            var base = RV.store.defaults();
            Object.keys(base).forEach(function (k) { if (d[k] !== undefined) base[k] = d[k]; });
            base.settings = Object.assign(RV.store.defaults().settings, d.settings || {});
            COLLECTIONS.forEach(function (k) {
              if (!Array.isArray(base[k])) base[k] = [];
              var seen = {};
              base[k] = base[k].filter(function (x) { return x && typeof x === "object"; });
              base[k].forEach(function (x) { if (!x.id || seen[x.id]) x.id = RV.uid(); seen[x.id] = true; }); // unique ids
            });
            if (RV.store.replaceAll(base)) { RV.toast("Backup restored", "success"); RV.rerender(); }
          });
        }).catch(function (err) { RV.toast(err.message, "error"); });
      });
      RV.$("#st-clear", el).addEventListener("click", function () {
        RV.confirm("Clear all data?", "Every product, QC folder, package, measurement, rate table and setting will be permanently deleted from this browser.", "Clear everything").then(function (ok) {
          if (!ok) return;
          RV.store.reset(); RV.toast("All RepVault data cleared"); RV.rerender(); RV.fx.load(true).catch(function () {}).then(function () { document.dispatchEvent(new CustomEvent("rv:fx")); });
        });
      });
    }
  });
})();
