/* Dashboard: overview, recently used tools, quick actions, stats, live CNY rate. */
(function () {
  "use strict";
  var RV = window.RV;

  RV.register("dashboard", {
    title: "Dashboard", icon: "dashboard", group: "main",
    blurb: "Overview of your vault",
    render: function (el) {
      var products = RV.store.get("products") || [];
      var pkgs = RV.store.get("packages") || [];
      var qc = RV.store.get("qc") || [];
      var active = pkgs.filter(function (p) { return p.status !== "Delivered"; }).length;
      var qcPhotos = qc.reduce(function (n, f) { return n + (f.photos || []).length; }, 0);
      var recent = (RV.store.get("recent") || []).filter(function (r) { return RV.tools[r.id]; });
      var tools = RV.toolOrder.filter(function (id) { return RV.tools[id].group === "tools"; });
      var cur = RV.setting("currency");

      el.innerHTML =
        '<section class="hero">' +
          '<span class="eyebrow">Private shopping toolkit</span>' +
          "<h1>REPVAULT</h1>" +
          '<p class="lede">Check QC, track parcels, convert sizes and agent links, estimate shipping and keep every find organised. Everything is saved privately in this browser.</p>' +
          '<form class="row" id="dash-quick" novalidate>' +
            '<label class="sr-only" for="dash-link">Paste a product or agent link</label>' +
            '<div class="input-group" style="flex:1;min-width:240px"><input class="input" id="dash-link" type="url" inputmode="url" placeholder="Paste a Weidian, Taobao, 1688 or agent link" autocomplete="off"></div>' +
            '<button class="btn btn-primary" type="submit">' + RV.icon("link") + "Convert link</button>" +
          "</form>" +
        "</section>" +

        '<div class="grid grid-4 stats" style="margin-bottom:22px">' +
          stat(products.length, "Saved products", "#/products") +
          stat(active, "Active packages", "#/packages") +
          stat(qc.length, "QC folders · " + qcPhotos + " photos", "#/qc") +
          '<div class="stat" id="dash-fx"><div class="stat-num"><span class="skeleton" style="display:block;width:110px;height:36px"></span></div><div class="stat-label">Loading live CNY rate…</div></div>' +
        "</div>" +

        '<div class="split" style="margin-bottom:22px">' +
          '<section class="card" aria-labelledby="recent-h"><div class="card-head"><div><h2 id="recent-h">Recently used</h2><p class="card-sub">Jump back into the tools you opened last.</p></div></div>' +
            (recent.length ? '<div class="chip-list">' + recent.map(function (r) {
              var t = RV.tools[r.id];
              return '<a class="chip" href="#/' + r.id + '">' + RV.icon(t.icon) + RV.esc(t.title) + '<span class="faint small">' + RV.esc(RV.timeAgo(r.at)) + "</span></a>";
            }).join("") + "</div>" : '<p class="muted">No tools used yet. Pick one below to get started.</p>') +
          "</section>" +
          '<section class="card" aria-labelledby="quick-h"><div class="card-head"><div><h2 id="quick-h">Quick actions</h2><p class="card-sub">The things you do most.</p></div></div>' +
            '<div class="actions">' +
              '<a class="btn" href="#/packages?new=1">' + RV.icon("plus") + "Add package</a>" +
              '<a class="btn" href="#/products?new=1">' + RV.icon("plus") + "Save product</a>" +
              '<a class="btn" href="#/qc?new=1">' + RV.icon("folder") + "New QC folder</a>" +
              '<a class="btn" href="#/shipping">' + RV.icon("truck") + "Estimate shipping</a>" +
            "</div>" +
          "</section>" +
        "</div>" +

        '<section aria-labelledby="tools-h"><div class="card-head"><h2 id="tools-h">All tools</h2></div>' +
        '<div class="grid grid-3">' + tools.map(function (id) {
          var t = RV.tools[id];
          return '<a class="tile" href="#/' + id + '"><span class="tile-icon">' + RV.icon(t.icon) + "</span><h3>" + RV.esc(t.title) + "</h3><p>" + RV.esc(t.blurb) + '</p><span class="tile-meta"><span>' + RV.esc(t.meta ? t.meta() : "") + "</span>" + RV.icon("arrow") + "</span></a>";
        }).join("") + "</div></section>";

      RV.$("#dash-quick", el).addEventListener("submit", function (e) {
        e.preventDefault();
        var input = RV.$("#dash-link", el);
        var v = input.value.trim();
        if (!v) { RV.fieldError(input, "Paste a link first."); input.focus(); return; }
        if (!RV.links.parse(v)) { RV.fieldError(input, RV.links.explain(v)); input.focus(); return; }
        RV.fieldError(input, null);
        location.hash = "#/converter?link=" + encodeURIComponent(v);
      });

      function paintFx(res) {
        var box = RV.$("#dash-fx", el);
        if (!box) return;
        var rate = res.rates[cur];
        box.innerHTML = '<div class="stat-num">' + RV.esc(RV.fx.format(100 * rate, cur)) + '</div><div class="stat-label">per ¥100 · ' +
          (res.source === "stale" ? "cached rate (live update failed)" : "live rate") + " · " + RV.esc(RV.fmtDate(res.updated)) + "</div>";
      }
      RV.fx.load().then(paintFx, function (err) {
        var box = RV.$("#dash-fx", el);
        if (box) box.innerHTML = '<div class="stat-num">—</div><div class="stat-label">' + RV.esc(err.message) + ' <button class="btn btn-sm" type="button" id="fx-retry">Retry</button></div>';
        var b = RV.$("#fx-retry", el);
        if (b) b.addEventListener("click", function () { RV.rerender(); });
      });
    }
  });

  function stat(n, label, href) {
    return '<a class="stat tile" style="padding:20px 22px;gap:0" href="' + href + '"><div class="stat-num">' + n + '</div><div class="stat-label">' + RV.esc(label) + "</div></a>";
  }
})();
