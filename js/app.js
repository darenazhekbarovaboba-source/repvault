/* REPVAULT app shell: navigation, hash routing, mobile menu, exchange-rate chip. */
(function () {
  "use strict";
  var RV = window.RV;
  var view = document.getElementById("view");
  var nav = document.getElementById("nav");
  var sidebar = document.getElementById("sidebar");
  var scrim = document.getElementById("scrim");
  var menuBtn = document.getElementById("menu-btn");
  var current = null;

  function buildNav() {
    var html = "";
    var groups = { main: "Overview", tools: "Tools", app: "Vault" };
    var lastGroup = null;
    RV.toolOrder.forEach(function (id) {
      var t = RV.tools[id];
      if (t.group !== lastGroup) { html += '<p class="nav-group">' + groups[t.group] + "</p>"; lastGroup = t.group; }
      html += '<a href="#/' + id + '" data-route="' + id + '">' + RV.icon(t.icon) + "<span>" + RV.esc(t.title) + "</span></a>";
    });
    nav.innerHTML = html;
  }

  function setMenu(open) {
    sidebar.classList.toggle("open", open);
    scrim.hidden = !open;
    menuBtn.setAttribute("aria-expanded", String(open));
    menuBtn.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    if (open) { var a = nav.querySelector("a"); if (a) a.focus(); }
  }
  menuBtn.addEventListener("click", function () { setMenu(!sidebar.classList.contains("open")); });
  scrim.addEventListener("click", function () { setMenu(false); menuBtn.focus(); });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && sidebar.classList.contains("open")) { setMenu(false); menuBtn.focus(); }
  });

  function parseHash() {
    var h = location.hash.replace(/^#\/?/, "");
    var parts = h.split("?");
    return { route: parts[0] || "dashboard", query: new URLSearchParams(parts[1] || "") };
  }

  function render() {
    var r = parseHash();
    if (r.route === "main") return; // skip-link target
    var tool = RV.tools[r.route];
    if (current && current.destroy) { try { current.destroy(); } catch (e) {} }
    view.classList.remove("view-enter");
    void view.offsetWidth;
    view.classList.add("view-enter");
    RV.$$("a[data-route]", nav).forEach(function (a) {
      if (a.dataset.route === r.route) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
    });
    setMenu(false);
    if (!tool) {
      current = null;
      document.title = "Not found · REPVAULT";
      view.innerHTML = '<section class="notfound"><p class="big-num">404</p><h1>This page isn’t in the vault</h1><p class="lede" style="margin:12px auto 24px">The link may be mistyped or the page was moved.</p><a class="btn btn-primary" href="#/dashboard">' + RV.icon("dashboard") + "Back to dashboard</a></section>";
      return;
    }
    current = tool;
    document.title = tool.title + " · REPVAULT";
    try {
      tool.render(view, r.query);
    } catch (err) {
      console.error(err);
      view.innerHTML = '<div class="notice notice-error">' + RV.icon("alert") + "<div><strong>Something went wrong loading this tool.</strong> " + RV.esc(err.message) + "</div></div>";
    }
    RV.trackRecent(r.route);
    window.scrollTo(0, 0);
  }
  RV.rerender = render;

  function renderFxChip() {
    var chip = document.getElementById("fx-chip");
    var cur = RV.setting("currency");
    var rate = RV.fx.rate(cur);
    var c = RV.fx.cached();
    if (!rate) { chip.innerHTML = "Exchange rate unavailable"; return; }
    var stale = Date.now() - c.fetchedAt > 6 * 3600 * 1000;
    chip.innerHTML = "<strong>¥100 ≈ " + RV.esc(RV.fx.format(100 * rate, cur)) + "</strong><br>" + (stale ? "Cached rate · " : "Live rate · ") + RV.esc(RV.fmtDate(c.updated, true));
  }
  document.addEventListener("rv:fx", renderFxChip);

  document.querySelector(".skip-link").addEventListener("click", function (e) {
    e.preventDefault();
    var m = document.getElementById("main");
    m.focus({ preventScroll: true });
    m.scrollIntoView();
  });

  buildNav();
  window.addEventListener("hashchange", render);
  if (!location.hash) history.replaceState(null, "", "#/dashboard");
  render();
  renderFxChip();
  RV.fx.load().then(renderFxChip, function (err) {
    document.getElementById("fx-chip").textContent = "Exchange rate unavailable";
    console.warn(err.message);
  });
})();
