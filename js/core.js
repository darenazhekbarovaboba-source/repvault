/* REPVAULT core: storage, helpers, toasts, modals, lightbox, exchange rates, images, icons. */
(function () {
  "use strict";
  var RV = (window.RV = window.RV || {});
  RV.tools = {};
  RV.toolOrder = [];

  /* ---------------- Storage ---------------- */
  var KEY = "repvault:v1";
  var DEFAULTS = function () {
    return {
      version: 1,
      settings: { currency: "USD", agent: "kakobuy", weightUnit: "kg", measureUnit: "cm", productView: "grid" },
      recent: [],
      products: [],
      qc: [],
      packages: [],
      measurements: {},
      shipRates: null,
      zones: null,
      convHistory: [],
      fx: null
    };
  };

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return DEFAULTS();
      var data = JSON.parse(raw);
      var base = DEFAULTS();
      Object.keys(base).forEach(function (k) { if (data[k] === undefined) data[k] = base[k]; });
      data.settings = Object.assign(base.settings, data.settings || {});
      return data;
    } catch (e) {
      console.warn("REPVAULT: could not read saved data", e);
      return DEFAULTS();
    }
  }

  var state = load();
  RV.store = {
    KEY: KEY,
    get: function (k) { return state[k]; },
    set: function (k, v) { state[k] = v; return RV.store.save(); },
    all: function () { return state; },
    replaceAll: function (data) { state = data; return RV.store.save(); },
    reset: function () { state = DEFAULTS(); try { localStorage.removeItem(KEY); } catch (e) {} return true; },
    defaults: DEFAULTS,
    save: function () {
      try {
        localStorage.setItem(KEY, JSON.stringify(state));
        return true;
      } catch (e) {
        var full = e && (e.name === "QuotaExceededError" || e.code === 22 || e.code === 1014);
        RV.toast(full ? "Browser storage is full. Delete some photos or export and clear old data." : "Could not save: " + (e.message || e), "error");
        return false;
      }
    },
    bytes: function () { try { return (localStorage.getItem(KEY) || "").length * 2; } catch (e) { return 0; } }
  };
  RV.setting = function (k, v) {
    if (v === undefined) return state.settings[k];
    state.settings[k] = v; RV.store.save(); return v;
  };

  /* ---------------- Helpers ---------------- */
  RV.esc = function (s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  };
  RV.uid = function () { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); };
  RV.$ = function (sel, root) { return (root || document).querySelector(sel); };
  RV.$$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  RV.num = function (v) { var n = parseFloat(String(v).replace(",", ".")); return isFinite(n) ? n : NaN; };
  RV.round = function (n, d) { var p = Math.pow(10, d || 0); return Math.round(n * p) / p; };
  RV.fmtDate = function (ts, withTime) {
    var d = new Date(ts);
    if (isNaN(d)) return "";
    var o = { year: "numeric", month: "short", day: "numeric" };
    if (withTime) { o.hour = "numeric"; o.minute = "2-digit"; }
    return d.toLocaleString(undefined, o);
  };
  RV.timeAgo = function (ts) {
    var s = Math.round((Date.now() - ts) / 1000);
    if (s < 60) return "just now";
    var m = Math.round(s / 60); if (m < 60) return m + " min ago";
    var h = Math.round(m / 60); if (h < 24) return h + " h ago";
    var d = Math.round(h / 24); if (d < 30) return d + " d ago";
    return RV.fmtDate(ts);
  };
  RV.todayISO = function () {
    var d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 10);
  };
  RV.daysUntil = function (iso) {
    if (!iso) return null;
    var p = iso.split("-").map(Number);
    var target = new Date(p[0], p[1] - 1, p[2]);
    var now = new Date(); now.setHours(0, 0, 0, 0);
    return Math.round((target - now) / 86400000);
  };
  RV.copy = function (text, label) {
    function ok() { RV.toast((label || "Copied") + " to clipboard", "success"); }
    function fallback() {
      var ta = document.createElement("textarea");
      ta.value = text; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      var done = false; try { done = document.execCommand("copy"); } catch (e) {}
      ta.remove();
      if (done) ok(); else RV.toast("Copy failed. Select the text and copy it manually.", "error");
    }
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(ok, fallback);
    } else fallback();
  };
  RV.download = function (filename, text, type) {
    var blob = new Blob([text], { type: type || "application/json" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url; a.download = filename; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 500);
  };
  RV.readFileText = function (file) {
    return new Promise(function (res, rej) {
      var r = new FileReader();
      r.onload = function () { res(r.result); };
      r.onerror = function () { rej(new Error("Could not read the file")); };
      r.readAsText(file);
    });
  };
  RV.isUrl = function (s) { try { var u = new URL(s); return u.protocol === "http:" || u.protocol === "https:"; } catch (e) { return false; } };
  RV.setBusy = function (btn, busy, text) {
    if (!btn) return;
    if (busy) {
      btn.dataset.label = btn.innerHTML;
      btn.setAttribute("aria-busy", "true");
      btn.innerHTML = '<span class="spinner" aria-hidden="true"></span>' + RV.esc(text || "Working…");
    } else {
      btn.removeAttribute("aria-busy");
      if (btn.dataset.label) btn.innerHTML = btn.dataset.label;
    }
  };
  RV.fieldError = function (input, msg) {
    if (!input) return;
    var holder = input.closest(".field") || input.parentNode;
    var old = holder.querySelector(".field-error");
    if (old) old.remove();
    if (msg) {
      input.setAttribute("aria-invalid", "true");
      var p = document.createElement("p");
      p.className = "field-error"; p.id = (input.id || RV.uid()) + "-err"; p.textContent = msg;
      holder.appendChild(p);
      input.setAttribute("aria-describedby", p.id);
    } else {
      input.removeAttribute("aria-invalid");
      input.removeAttribute("aria-describedby");
    }
  };

  /* ---------------- Icons ---------------- */
  var P = {
    dashboard: '<rect x="3" y="3" width="7.5" height="7.5" rx="2"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="2"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="2"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2"/>',
    qc: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2M8.5 11l1.8 1.8 3.4-3.6"/>',
    package: '<path d="M3.5 7.5L12 3l8.5 4.5v9L12 21l-8.5-4.5z"/><path d="M3.5 7.5L12 12l8.5-4.5M12 12v9M7.8 5.2l8.4 4.6"/>',
    ruler: '<path d="M3 16.5L16.5 3 21 7.5 7.5 21z"/><path d="M7 12.5l2 2M10 9.5l1.5 1.5M13 6.5l2 2"/>',
    truck: '<path d="M2.5 6.5h11v9h-11zM13.5 9.5h4l3 3v3h-7"/><circle cx="6.5" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    box: '<rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="M3 9h18M9 13h6"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8"/>',
    external: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
    image: '<rect x="3" y="4" width="18" height="16" rx="2.5"/><circle cx="9" cy="10" r="1.8"/><path d="M21 16l-5-5-9 9"/>',
    upload: '<path d="M12 16V4M7 9l5-5 5 5M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/>',
    download: '<path d="M12 4v12M7 11l5 5 5-5M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/>',
    refresh: '<path d="M20 11a8 8 0 0 0-14.3-4.9L4 8M4 4v4h4M4 13a8 8 0 0 0 14.3 4.9L20 16M20 20v-4h-4"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
    alert: '<path d="M12 3l9.5 17h-19z"/><path d="M12 10v4M12 17h.01"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    grid: '<rect x="4" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5"/>',
    list: '<path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01"/>',
    folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2.5h8a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    swap: '<path d="M7 4L3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7"/>'
  };
  RV.icon = function (name, label) {
    return '<svg viewBox="0 0 24 24"' + (label ? ' role="img" aria-label="' + RV.esc(label) + '"' : ' aria-hidden="true"') + ">" + (P[name] || P.info) + "</svg>";
  };

  /* ---------------- Toasts ---------------- */
  RV.toast = function (msg, type) {
    var host = document.getElementById("toasts");
    if (!host) return;
    var el = document.createElement("div");
    el.className = "toast" + (type ? " is-" + type : "");
    el.innerHTML = RV.icon(type === "error" ? "alert" : type === "success" ? "check" : "info") + '<span class="toast-msg"></span>';
    el.querySelector(".toast-msg").textContent = msg;
    host.appendChild(el);
    var ttl = type === "error" ? 5200 : 3200;
    setTimeout(function () {
      el.classList.add("leaving");
      setTimeout(function () { el.remove(); }, 260);
    }, ttl);
  };

  /* ---------------- Modal ---------------- */
  var modal, mTitle, mBody, mActions, mResolve, lastFocus;
  function closeModal(value) {
    if (!modal || !modal.open) return;
    modal.close();
    var r = mResolve; mResolve = null;
    if (lastFocus && document.contains(lastFocus)) lastFocus.focus();
    if (r) r(value);
  }
  RV.modal = function (opts) {
    modal = modal || document.getElementById("modal");
    mTitle = document.getElementById("modal-title");
    mBody = document.getElementById("modal-body");
    mActions = document.getElementById("modal-actions");
    if (modal.open) closeModal(null);
    lastFocus = document.activeElement;
    mTitle.textContent = opts.title || "";
    mBody.innerHTML = opts.body || "";
    mActions.innerHTML = "";
    (opts.actions || []).forEach(function (a) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "btn " + (a.className || "");
      b.textContent = a.label;
      b.addEventListener("click", function () {
        if (a.onClick) {
          var res = a.onClick(mBody);
          if (res === false) return;
          closeModal(res === undefined ? a.value : res);
        } else closeModal(a.value);
      });
      mActions.appendChild(b);
    });
    return new Promise(function (resolve) {
      mResolve = resolve;
      modal.showModal();
      if (opts.onOpen) opts.onOpen(mBody);
      var first = mBody.querySelector("input, select, textarea") || mActions.querySelector(".btn-primary") || mActions.querySelector("button");
      if (first) first.focus();
    });
  };
  RV.closeModal = function (v) { closeModal(v); };
  RV.confirm = function (title, text, confirmLabel) {
    return RV.modal({
      title: title,
      body: "<p>" + RV.esc(text) + "</p>",
      actions: [
        { label: "Cancel", value: false },
        { label: confirmLabel || "Delete", className: "btn-primary", value: true }
      ]
    }).then(function (v) { return v === true; });
  };
  document.addEventListener("click", function (e) {
    if (e.target.closest("[data-modal-close]")) closeModal(null);
  });
  document.addEventListener("DOMContentLoaded", function () {
    var m = document.getElementById("modal");
    m.addEventListener("cancel", function (e) { e.preventDefault(); closeModal(null); });
    m.addEventListener("click", function (e) { if (e.target === m) closeModal(null); });
    document.getElementById("modal-form").addEventListener("submit", function (e) {
      e.preventDefault();
      var primary = document.querySelector("#modal-actions .btn-primary");
      if (primary) primary.click();
    });
  });

  /* ---------------- Lightbox ---------------- */
  var lb = { items: [], i: 0 };
  function lbShow() {
    var it = lb.items[lb.i];
    var img = document.getElementById("lb-img");
    img.src = it.src;
    img.alt = it.caption || "Photo " + (lb.i + 1);
    document.getElementById("lb-cap").textContent = (it.caption ? it.caption + " · " : "") + (lb.i + 1) + " / " + lb.items.length;
    var multi = lb.items.length > 1;
    document.getElementById("lb-prev").hidden = !multi;
    document.getElementById("lb-next").hidden = !multi;
  }
  RV.lightbox = function (items, index) {
    if (!items || !items.length) return;
    lb.items = items; lb.i = index || 0; lastFocus = document.activeElement;
    var d = document.getElementById("lightbox");
    lbShow(); d.showModal();
    document.getElementById("lb-close").focus();
  };
  document.addEventListener("DOMContentLoaded", function () {
    var d = document.getElementById("lightbox");
    function step(n) { lb.i = (lb.i + n + lb.items.length) % lb.items.length; lbShow(); }
    document.getElementById("lb-close").addEventListener("click", function () { d.close(); });
    document.getElementById("lb-prev").addEventListener("click", function () { step(-1); });
    document.getElementById("lb-next").addEventListener("click", function () { step(1); });
    d.addEventListener("keydown", function (e) {
      if (e.key === "ArrowLeft") step(-1);
      if (e.key === "ArrowRight") step(1);
    });
    d.addEventListener("click", function (e) { if (e.target === d || e.target.classList.contains("lightbox-inner")) d.close(); });
    d.addEventListener("close", function () { if (lastFocus && document.contains(lastFocus)) lastFocus.focus(); });
    document.getElementById("lb-img").addEventListener("error", function () {
      if (lb.items.length) document.getElementById("lb-cap").textContent = "This image could not be loaded (the URL may be broken or blocks embedding).";
    });
  });

  /* ---------------- Images ---------------- */
  var MAX_RAW = 15 * 1024 * 1024;
  var MAX_STORED = 450 * 1024; // characters of dataURL
  RV.images = {
    fromFile: function (file) {
      return new Promise(function (resolve, reject) {
        if (!file) return reject(new Error("No file selected."));
        if (!/^image\//.test(file.type)) return reject(new Error(file.name + " is not an image."));
        if (file.size > MAX_RAW) return reject(new Error(file.name + " is larger than 15 MB."));
        var url = URL.createObjectURL(file);
        var img = new Image();
        img.onload = function () {
          URL.revokeObjectURL(url);
          var tries = [[1200, 0.8], [1000, 0.72], [800, 0.65], [640, 0.6]];
          for (var t = 0; t < tries.length; t++) {
            var max = tries[t][0], q = tries[t][1];
            var scale = Math.min(1, max / Math.max(img.width, img.height));
            var c = document.createElement("canvas");
            c.width = Math.max(1, Math.round(img.width * scale));
            c.height = Math.max(1, Math.round(img.height * scale));
            var ctx = c.getContext("2d");
            ctx.fillStyle = "#080808"; ctx.fillRect(0, 0, c.width, c.height);
            ctx.drawImage(img, 0, 0, c.width, c.height);
            var data = c.toDataURL("image/jpeg", q);
            if (data.length <= MAX_STORED) return resolve(data);
          }
          reject(new Error(file.name + " is still too large after compression."));
        };
        img.onerror = function () { URL.revokeObjectURL(url); reject(new Error(file.name + " could not be decoded.")); };
        img.src = url;
      });
    },
    checkUrl: function (src) {
      return new Promise(function (resolve, reject) {
        if (!RV.isUrl(src)) return reject(new Error("Enter a full image URL starting with https://"));
        var img = new Image();
        var timer = setTimeout(function () { img.src = ""; reject(new Error("The image took too long to load.")); }, 12000);
        img.onload = function () { clearTimeout(timer); resolve(src); };
        img.onerror = function () { clearTimeout(timer); reject(new Error("That URL did not load as an image (broken link or hotlinking blocked).")); };
        img.referrerPolicy = "no-referrer";
        img.src = src;
      });
    }
  };

  /* ---------------- Exchange rates (real API) ---------------- */
  var FX_URL = "https://open.er-api.com/v6/latest/CNY";
  var FX_TTL = 6 * 3600 * 1000;
  var inflight = null;
  RV.fx = {
    currencies: ["USD", "EUR", "GBP", "CAD", "AUD"],
    symbols: { USD: "$", EUR: "€", GBP: "£", CAD: "C$", AUD: "A$", CNY: "¥" },
    cached: function () { return RV.store.get("fx"); },
    load: function (force) {
      var c = RV.fx.cached();
      if (!force && c && Date.now() - c.fetchedAt < FX_TTL) return Promise.resolve(Object.assign({ source: "cache-fresh" }, c));
      if (inflight) return inflight;
      var ctrl = "AbortController" in window ? new AbortController() : null;
      var to = setTimeout(function () { if (ctrl) ctrl.abort(); }, 10000);
      inflight = fetch(FX_URL, ctrl ? { signal: ctrl.signal } : undefined)
        .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
        .then(function (j) {
          if (j.result !== "success" || !j.rates) throw new Error("Unexpected response");
          var rates = {};
          RV.fx.currencies.forEach(function (k) { rates[k] = j.rates[k]; });
          var rec = { rates: rates, updated: j.time_last_update_unix * 1000, fetchedAt: Date.now() };
          RV.store.set("fx", rec);
          return Object.assign({ source: "live" }, rec);
        })
        .catch(function (err) {
          if (c) return Object.assign({ source: "stale", error: err.message || String(err) }, c);
          throw new Error("Exchange rate unavailable (" + (err.name === "AbortError" ? "timed out" : err.message || err) + ")");
        })
        .finally(function () { clearTimeout(to); inflight = null; document.dispatchEvent(new CustomEvent("rv:fx")); });
      return inflight;
    },
    rate: function (cur) { var c = RV.fx.cached(); return c && c.rates ? c.rates[cur || RV.setting("currency")] : null; },
    convert: function (cny, cur) { var r = RV.fx.rate(cur); return r ? cny * r : null; },
    format: function (amount, cur) {
      cur = cur || RV.setting("currency");
      if (amount == null || !isFinite(amount)) return "—";
      try { return new Intl.NumberFormat(undefined, { style: "currency", currency: cur, maximumFractionDigits: 2 }).format(amount); }
      catch (e) { return (RV.fx.symbols[cur] || "") + amount.toFixed(2); }
    },
    cny: function (amount) { return isFinite(amount) ? "¥" + (Math.round(amount * 100) / 100).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 }) : "—"; },
    label: function () {
      var c = RV.fx.cached();
      if (!c) return "No exchange rate loaded";
      var stale = Date.now() - c.fetchedAt > FX_TTL;
      return (stale ? "Cached rate from " : "Rate updated ") + RV.fmtDate(c.updated, true) + (stale ? " (may be outdated)" : "");
    }
  };

  /* ---------------- Tool registry ---------------- */
  RV.register = function (id, def) { def.id = id; RV.tools[id] = def; RV.toolOrder.push(id); };
  RV.trackRecent = function (id) {
    if (id === "dashboard" || id === "settings") return;
    var list = (RV.store.get("recent") || []).filter(function (r) { return r.id !== id; });
    list.unshift({ id: id, at: Date.now() });
    RV.store.set("recent", list.slice(0, 6));
  };
})();
