/* Package Tracker: manual status + timestamped history, carrier auto-detect, ETA countdown, official carrier & 17TRACK links.
   Live tracking is NOT fetched (carrier APIs need private keys). */
(function () {
  "use strict";
  var RV = window.RV;

  var CARRIERS = {
    usps: { name: "USPS", url: function (n) { return "https://tools.usps.com/go/TrackConfirmAction?tLabels=" + n; } },
    chinapost: { name: "China Post", url: null }, // no verified deep-link for non-EMS mail; 17TRACK covers it
    ems: { name: "China EMS", url: function (n) { return "https://www.ems.com.cn/queryList?searchType=EMS&mailNo=" + n; } },
    cainiao: { name: "Cainiao", url: function (n) { return "https://global.cainiao.com/detail.htm?mailNoList=" + n; } },
    yunexpress: { name: "YunExpress", url: function (n) { return "https://www.yuntrack.com/parcelTracking?id=" + n; } },
    "4px": { name: "4PX", url: function (n) { return "https://track.4px.com/query/" + n; } },
    ups: { name: "UPS", url: function (n) { return "https://www.ups.com/track?tracknum=" + n; } },
    fedex: { name: "FedEx", url: function (n) { return "https://www.fedex.com/fedextrack/?trknbr=" + n; } },
    dhl: { name: "DHL", url: function (n) { return "https://www.dhl.com/global-en/home/tracking/tracking-express.html?tracking-id=" + n; } },
    other: { name: "Other / unknown", url: null }
  };
  var STATUSES = ["Ordered", "At warehouse", "Shipped", "In transit", "Customs", "Out for delivery", "Delivered", "Exception"];

  function norm(s) { return String(s || "").replace(/[\s-]+/g, "").toUpperCase(); }
  function detect(raw) {
    var n = norm(raw);
    if (!n) return null;
    if (/^1Z[A-Z0-9]{16}$/.test(n)) return "ups";
    if (/^YT\d{16}$/.test(n)) return "yunexpress";
    if (/^4PX[A-Z0-9]{8,}$/.test(n)) return "4px";
    if (/^(LP|CNG|CAINIAO)[A-Z0-9]{8,}$/.test(n)) return "cainiao";
    if (/^E[A-Z]\d{9}CN$/.test(n)) return "ems";
    if (/^[A-Z]{2}\d{9}CN$/.test(n)) return "chinapost";
    if (/^[A-Z]{2}\d{9}US$/.test(n)) return "usps";
    if (/^96\d{20}$/.test(n)) return "fedex"; // FedEx Ground 96 + 20 digits
    if (/^(91|92|93|94|95)\d{18,24}$/.test(n) || /^420\d{5,9}9\d{21,25}$/.test(n)) return "usps";
    if (/^(70|71|73|82)\d{18,20}$/.test(n)) return "usps"; // USPS certified/registered 20-22 digits
    if (/^J?JD\d{16,}$/.test(n) || /^JVGL\d+$/.test(n) || /^\d{10}$/.test(n)) return "dhl";
    if (/^\d{12}$/.test(n) || /^\d{15}$/.test(n)) return "fedex";
    return null;
  }
  function pkgs() { return RV.store.get("packages") || []; }
  function savePkgs(l) { return RV.store.set("packages", l); }

  function statusBadge(s) {
    if (s === "Delivered") return '<span class="badge badge-solid">' + RV.icon("check") + "Delivered</span>";
    if (s === "Exception") return '<span class="badge badge-dashed">' + RV.icon("alert") + "Exception</span>";
    if (s === "Ordered" || s === "At warehouse") return '<span class="badge badge-ring"><span class="dot"></span>' + RV.esc(s) + "</span>";
    return '<span class="badge badge-brown"><span class="dot"></span>' + RV.esc(s) + "</span>";
  }
  function etaText(p) {
    if (p.status === "Delivered") return { text: "Delivered", cls: "" };
    if (!p.eta) return { text: "No estimate set", cls: "faint" };
    var d = RV.daysUntil(p.eta);
    if (d > 1) return { text: "Estimated in " + d + " days", cls: "" };
    if (d === 1) return { text: "Estimated tomorrow", cls: "strong" };
    if (d === 0) return { text: "Estimated today", cls: "strong" };
    return { text: Math.abs(d) + " day" + (Math.abs(d) > 1 ? "s" : "") + " past estimate", cls: "strong overdue" };
  }

  RV.register("packages", {
    title: "Package Tracker", icon: "package", group: "tools",
    blurb: "Log parcels, history and delivery estimates; open official tracking in one tap.",
    meta: function () { return pkgs().filter(function (p) { return p.status !== "Delivered"; }).length + " active"; },
    render: function (el, query) {
      var state = { filter: "active", search: "" };
      el.innerHTML =
        '<div class="page-head"><div><span class="eyebrow">Tool</span><h1>Package Tracker</h1><p class="lede">Keep every parcel in one place: carrier, status, history and estimated delivery.</p></div>' +
        '<div class="page-actions"><button class="btn btn-primary" type="button" id="pk-new">' + RV.icon("plus") + "Add package</button></div></div>" +
        '<div class="notice" style="margin-bottom:18px">' + RV.icon("info") + "<div><strong>Live status is not fetched.</strong> Carrier tracking APIs require private keys, so RepVault never invents scan events. You set the status and log updates yourself; the Track buttons open the official carrier page or 17TRACK with your number filled in.</div></div>" +
        '<div class="row" style="margin-bottom:16px"><div class="field" style="flex:1;min-width:200px"><label class="sr-only" for="pk-search">Search packages</label><input class="input" id="pk-search" type="search" placeholder="Search by name, number or carrier"></div>' +
        '<div class="seg" role="group" aria-label="Filter packages"><button type="button" data-f="active" aria-pressed="true">Active</button><button type="button" data-f="delivered" aria-pressed="false">Delivered</button><button type="button" data-f="all" aria-pressed="false">All</button></div></div>' +
        '<div id="pk-list" class="list"></div>';

      var listEl = RV.$("#pk-list", el);
      RV.$("#pk-new", el).addEventListener("click", function () { openModal(null); });
      RV.$("#pk-search", el).addEventListener("input", function (e) { state.search = e.target.value.trim().toLowerCase(); paint(); });
      RV.$$(".seg button", el).forEach(function (b) {
        b.addEventListener("click", function () {
          state.filter = b.dataset.f;
          RV.$$(".seg button", el).forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); });
          paint();
        });
      });

      function paint() {
        var all = pkgs();
        var items = all.filter(function (p) {
          if (state.filter === "active" && p.status === "Delivered") return false;
          if (state.filter === "delivered" && p.status !== "Delivered") return false;
          if (!state.search) return true;
          return [p.name, p.number, CARRIERS[p.carrier] ? CARRIERS[p.carrier].name : "", p.notes].join(" ").toLowerCase().indexOf(state.search) >= 0;
        }).sort(function (a, b) {
          var da = a.eta ? RV.daysUntil(a.eta) : 9999, db = b.eta ? RV.daysUntil(b.eta) : 9999;
          return (a.status === "Delivered") - (b.status === "Delivered") || da - db || b.createdAt - a.createdAt;
        });
        if (!all.length) {
          listEl.innerHTML = '<div class="empty"><div class="empty-icon">' + RV.icon("package") + "</div><h3>No packages yet</h3><p>Add a tracking number. The carrier is detected automatically.</p>" +
            '<button class="btn btn-primary" type="button" data-act="new">' + RV.icon("plus") + "Add your first package</button></div>";
          return;
        }
        if (!items.length) { listEl.innerHTML = '<div class="empty"><h3>No packages match</h3><p>Nothing matches this search or filter.</p><button class="btn" type="button" data-act="clear-filters">Clear filters</button></div>'; return; }
        listEl.innerHTML = items.map(card).join("");
      }

      function card(p) {
        var c = CARRIERS[p.carrier] || CARRIERS.other;
        var eta = etaText(p);
        var official = c.url ? c.url(encodeURIComponent(p.number)) : null;
        var hist = (p.history || []).slice().sort(function (a, b) { return b.at - a.at; });
        return '<article class="item" data-pkg="' + p.id + '">' +
          '<div class="item-head"><div style="min-width:0"><h3 class="item-title">' + RV.esc(p.name) + '</h3><div class="item-meta"><span>' + RV.esc(c.name) + '</span><span class="mono">' + RV.esc(p.number) + "</span></div></div>" + statusBadge(p.status) + "</div>" +
          '<div class="row small"><span class="' + eta.cls + '">' + RV.icon(eta.cls.indexOf("overdue") >= 0 ? "alert" : "clock") + " " + RV.esc(eta.text) + "</span>" + (p.eta ? '<span class="faint">· ETA ' + RV.esc(RV.fmtDate(p.eta + "T12:00:00")) + " (your estimate)</span>" : "") + "</div>" +
          (p.notes ? '<p class="muted small wrap-anywhere">' + RV.esc(p.notes) + "</p>" : "") +
          (hist.length ? '<details' + (hist.length <= 3 ? " open" : "") + '><summary class="small muted" style="cursor:pointer;margin-bottom:10px">History (' + hist.length + ")</summary><ol class=\"timeline\">" + hist.map(function (h) {
            return '<li><time datetime="' + new Date(h.at).toISOString() + '">' + RV.esc(RV.fmtDate(h.at, true)) + "</time><p>" + (h.status ? '<span class="strong">' + RV.esc(h.status) + "</span>" + (h.text ? " — " : "") : "") + RV.esc(h.text || "") + "</p></li>";
          }).join("") + "</ol></details>" : "") +
          '<div class="actions">' +
            (official ? '<a class="btn btn-sm btn-primary" href="' + RV.esc(official) + '" target="_blank" rel="noopener">' + RV.icon("external") + "Track on " + RV.esc(c.name) + "</a>" : "") +
            '<a class="btn btn-sm' + (official ? "" : " btn-primary") + '" href="https://t.17track.net/en#nums=' + encodeURIComponent(p.number) + '" target="_blank" rel="noopener">' + RV.icon("external") + "Track on 17TRACK</a>" +
            '<button class="btn btn-sm" type="button" data-act="log">' + RV.icon("plus") + "Log update</button>" +
            '<button class="btn btn-sm" type="button" data-act="copy">' + RV.icon("copy") + "Copy number</button>" +
            '<span class="spacer"></span>' +
            '<button class="btn btn-sm btn-ghost" type="button" data-act="edit">' + RV.icon("edit") + "Edit</button>" +
            '<button class="btn btn-sm btn-ghost btn-danger" type="button" data-act="delete">' + RV.icon("trash") + "Delete</button>" +
          "</div></article>";
      }

      listEl.addEventListener("click", function (e) {
        var b = e.target.closest("[data-act]");
        if (!b) return;
        if (b.dataset.act === "new") return openModal(null);
        if (b.dataset.act === "clear-filters") {
          state.filter = "all"; state.search = ""; RV.$("#pk-search", el).value = "";
          RV.$$(".seg button", el).forEach(function (x) { x.setAttribute("aria-pressed", String(x.dataset.f === "all")); });
          return paint();
        }
        var id = b.closest("[data-pkg]").dataset.pkg;
        var list = pkgs();
        var p = list.filter(function (x) { return x.id === id; })[0];
        if (!p) return;
        if (b.dataset.act === "copy") RV.copy(p.number, "Tracking number copied");
        if (b.dataset.act === "edit") openModal(p);
        if (b.dataset.act === "delete") {
          RV.confirm("Delete package?", "“" + p.name + "” and its history will be permanently deleted.").then(function (ok) {
            if (!ok) return;
            savePkgs(pkgs().filter(function (x) { return x.id !== id; })); RV.toast("Package deleted"); paint();
          });
        }
        if (b.dataset.act === "log") {
          RV.modal({
            title: "Log update",
            body: '<p>Record what the carrier page shows. It is saved with the current time.</p>' +
              '<div class="field"><label class="label" for="lg-status">Status</label><select class="select" id="lg-status">' + STATUSES.map(function (s) { return "<option" + (s === p.status ? " selected" : "") + ">" + s + "</option>"; }).join("") + "</select></div>" +
              '<div class="field"><label class="label" for="lg-text">Update</label><input class="input" id="lg-text" maxlength="300" placeholder="e.g. Departed Guangzhou sorting center"></div>',
            actions: [{ label: "Cancel", value: null }, {
              label: "Save update", className: "btn-primary", onClick: function (body) {
                var st = RV.$("#lg-status", body).value, tx = RV.$("#lg-text", body);
                if (!tx.value.trim() && st === p.status) { RV.fieldError(tx, "Write an update or change the status."); return false; }
                p.history = p.history || [];
                p.history.push({ at: Date.now(), status: st !== p.status ? st : "", text: tx.value.trim() });
                p.status = st; p.updatedAt = Date.now();
                if (savePkgs(list)) RV.toast("Update logged", "success");
                paint(); return true;
              }
            }]
          });
        }
      });

      function openModal(p) {
        var isEdit = !!p;
        p = p || { name: "", number: "", carrier: "", status: "Shipped", eta: "", notes: "" };
        RV.modal({
          title: isEdit ? "Edit package" : "Add package",
          body: '<div class="form-grid">' +
            '<div class="field full"><label class="label" for="pk-num">Tracking number</label><input class="input mono" id="pk-num" autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="40" value="' + RV.esc(p.number) + '" placeholder="e.g. EB123456789CN"><p class="hint" id="pk-detect" aria-live="polite"></p></div>' +
            '<div class="field full"><label class="label" for="pk-name">Name</label><input class="input" id="pk-name" maxlength="80" value="' + RV.esc(p.name) + '" placeholder="e.g. Haul #3 — hoodies"></div>' +
            '<div class="field"><label class="label" for="pk-carrier">Carrier</label><select class="select" id="pk-carrier">' + Object.keys(CARRIERS).map(function (k) { return '<option value="' + k + '"' + (p.carrier === k ? " selected" : "") + ">" + CARRIERS[k].name + "</option>"; }).join("") + "</select></div>" +
            '<div class="field"><label class="label" for="pk-status">Status</label><select class="select" id="pk-status">' + STATUSES.map(function (s) { return "<option" + (s === p.status ? " selected" : "") + ">" + s + "</option>"; }).join("") + "</select></div>" +
            '<div class="field"><label class="label" for="pk-eta">Estimated delivery</label><input class="input" id="pk-eta" type="date" value="' + RV.esc(p.eta) + '"><div class="row" style="gap:6px"><button class="btn btn-sm btn-ghost" type="button" data-days="10">+10 d</button><button class="btn btn-sm btn-ghost" type="button" data-days="15">+15 d</button><button class="btn btn-sm btn-ghost" type="button" data-days="25">+25 d</button></div></div>' +
            '<div class="field"><span class="label">Typical transit</span><p class="hint" id="pk-typical">Pick a carrier to see a typical range.</p></div>' +
            '<div class="field full"><label class="label" for="pk-notes">Notes</label><textarea class="textarea" id="pk-notes" maxlength="1000" placeholder="Agent, contents, declared value…">' + RV.esc(p.notes) + "</textarea></div>" +
          "</div>",
          onOpen: function (body) {
            var num = RV.$("#pk-num", body), sel = RV.$("#pk-carrier", body), hint = RV.$("#pk-detect", body), typ = RV.$("#pk-typical", body);
            var manual = isEdit;
            var TYP = { usps: "2–8 days domestic", chinapost: "15–40 days", ems: "8–20 days", cainiao: "10–25 days", yunexpress: "8–20 days", "4px": "8–20 days", ups: "4–8 days international", fedex: "4–8 days international", dhl: "3–7 days international", other: "Varies by line" };
            function showTyp() { typ.textContent = (TYP[sel.value] || "Varies") + " (rough industry range, not a promise)."; }
            function det() {
              var d = detect(num.value);
              if (!num.value.trim()) { hint.textContent = ""; return; }
              var amb = /^\d+$/.test(norm(num.value)) ? " Numeric-only numbers can match more than one carrier, so double-check." : "";
              if (d) { if (!manual) sel.value = d; hint.textContent = "Detected: " + CARRIERS[d].name + (manual && sel.value !== d ? " (you picked " + CARRIERS[sel.value].name + ")" : "") + "." + amb + " Change it if wrong."; }
              else { if (!manual) sel.value = "other"; hint.textContent = "Carrier not recognised. Pick one, or keep Other and use 17TRACK."; }
              showTyp();
            }
            num.addEventListener("input", det);
            sel.addEventListener("change", function () { manual = true; showTyp(); det(); });
            RV.$$("[data-days]", body).forEach(function (b) {
              b.addEventListener("click", function () {
                var d = new Date(); d.setDate(d.getDate() + (+b.dataset.days));
                d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
                RV.$("#pk-eta", body).value = d.toISOString().slice(0, 10);
              });
            });
            if (!isEdit && !p.carrier) sel.value = "other";
            det(); showTyp();
          },
          actions: [{ label: "Cancel", value: null }, {
            label: isEdit ? "Save changes" : "Add package", className: "btn-primary", onClick: function (body) {
              var num = RV.$("#pk-num", body), name = RV.$("#pk-name", body);
              var n = norm(num.value);
              var bad = !n ? "Enter a tracking number." : !/^[A-Z0-9]{6,40}$/.test(n) ? "Tracking numbers use letters and digits only (6–40 characters)." : null;
              if (!bad && pkgs().some(function (x) { return x.number === n && x.id !== p.id; })) bad = "You are already tracking this number.";
              RV.fieldError(num, bad);
              if (bad) return false;
              var data = { number: n, name: name.value.trim() || n, carrier: RV.$("#pk-carrier", body).value, status: RV.$("#pk-status", body).value, eta: RV.$("#pk-eta", body).value, notes: RV.$("#pk-notes", body).value.trim() };
              var list = pkgs();
              if (isEdit) {
                var x = list.filter(function (q) { return q.id === p.id; })[0];
                if (x.status !== data.status) (x.history = x.history || []).push({ at: Date.now(), status: data.status, text: "Status changed" });
                Object.assign(x, data, { updatedAt: Date.now() });
                if (savePkgs(list)) RV.toast("Package updated", "success");
              } else {
                list.unshift(Object.assign({ id: RV.uid(), createdAt: Date.now(), updatedAt: Date.now(), history: [{ at: Date.now(), status: data.status, text: "Added to RepVault" }] }, data));
                if (savePkgs(list)) RV.toast("Package added", "success");
                if (data.status === "Delivered" && state.filter === "active") RV.toast("Saved under the Delivered filter");
              }
              paint(); return true;
            }
          }]
        });
      }

      paint();
      if (query.get("new")) { history.replaceState(null, "", "#/packages"); openModal(null); }
    }
  });
  RV.packagesDetect = detect;
})();
