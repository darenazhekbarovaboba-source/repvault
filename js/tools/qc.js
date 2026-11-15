/* QC Finder: parse product links, real outbound QC search links, and QC photo folders with GL/RL verdicts. */
(function () {
  "use strict";
  var RV = window.RV;
  var VERDICTS = { pending: "Pending", gl: "GL · Green light", rl: "RL · Red light" };
  var MAX_PHOTOS = 24;

  function folders() { return RV.store.get("qc") || []; }
  function saveFolders(list) { return RV.store.set("qc", list); }
  function verdictBadge(v) {
    if (v === "gl") return '<span class="badge badge-solid">' + RV.icon("check") + "GL</span>";
    if (v === "rl") return '<span class="badge badge-dashed">' + RV.icon("alert") + "RL</span>";
    return '<span class="badge badge-ring"><span class="dot"></span>Pending</span>';
  }

  RV.register("qc", {
    title: "QC Finder", icon: "qc", group: "tools",
    blurb: "Find QC photos for a listing and keep your own GL/RL photo folders.",
    meta: function () { return folders().length + " folders"; },
    render: function (el, query) {
      var state = { search: "", verdict: "all" };
      el.innerHTML =
        '<div class="page-head"><div><span class="eyebrow">Tool</span><h1>QC Finder</h1><p class="lede">Paste a product link to find QC photos from public sources, then keep your own warehouse photos organised by item with a GL/RL verdict.</p></div>' +
        '<div class="page-actions"><button class="btn btn-primary" type="button" id="qc-new">' + RV.icon("plus") + "New QC folder</button></div></div>" +

        '<section class="card" aria-labelledby="qc-find-h"><div class="card-head"><div><h2 id="qc-find-h">Look up a listing</h2><p class="card-sub">Works with Weidian, Taobao, Tmall, 1688 and agent links.</p></div></div>' +
          '<form id="qc-form" class="stack" novalidate><div class="field"><label class="label" for="qc-link">Product link</label><div class="input-group"><input class="input" id="qc-link" type="url" inputmode="url" autocomplete="off" placeholder="https://weidian.com/item.html?itemID=…"><button class="btn btn-primary" type="submit">' + RV.icon("search") + "Find</button></div></div></form>" +
          '<div id="qc-result" aria-live="polite"></div>' +
        "</section>" +

        '<section class="card" aria-labelledby="qc-lib-h"><div class="card-head"><div><h2 id="qc-lib-h">Your QC folders</h2><p class="card-sub">Photos are compressed and stored in this browser only.</p></div></div>' +
          '<div class="row" style="margin-bottom:16px"><div class="field" style="flex:1;min-width:200px"><label class="sr-only" for="qc-search">Search QC folders</label><input class="input" id="qc-search" type="search" placeholder="Search by name, item ID or notes"></div>' +
          '<div class="seg" role="group" aria-label="Filter by verdict"><button type="button" data-v="all" aria-pressed="true">All</button><button type="button" data-v="pending" aria-pressed="false">Pending</button><button type="button" data-v="gl" aria-pressed="false">GL</button><button type="button" data-v="rl" aria-pressed="false">RL</button></div></div>' +
          '<div id="qc-list" class="list"></div>' +
        "</section>";

      var form = RV.$("#qc-form", el), input = RV.$("#qc-link", el), out = RV.$("#qc-result", el);

      function lookup(v) {
        out.innerHTML = "";
        if (!v) { RV.fieldError(input, "Paste a product link first."); return; }
        var p = RV.links.parse(v);
        if (!p) { RV.fieldError(input, RV.links.explain(v)); return; }
        RV.fieldError(input, null);
        var agent = RV.setting("agent");
        var agentUrl = RV.links.toAgent(p, agent);
        var existing = folders().filter(function (f) { return f.itemId === p.id && f.platform === p.platform; })[0];
        out.innerHTML = '<div class="result" style="margin-top:16px">' +
          '<dl class="kv"><dt>Platform</dt><dd>' + RV.esc(p.platformName) + (p.via ? ' <span class="faint">(from ' + RV.esc(p.via) + " link)</span>" : "") + '</dd><dt>Item ID</dt><dd class="mono">' + RV.esc(p.id) + '</dd><dt>Original</dt><dd class="mono">' + RV.esc(p.original) + "</dd></dl>" +
          '<div class="actions">' +
            '<a class="btn btn-primary btn-sm" href="' + RV.esc(RV.links.qcFinder(p)) + '" target="_blank" rel="noopener">' + RV.icon("qc") + "Search QC photos (RepTools)</a>" +
            '<a class="btn btn-sm" href="' + RV.esc(p.original) + '" target="_blank" rel="noopener">' + RV.icon("external") + "Open on " + RV.esc(p.platformName) + "</a>" +
            (agentUrl ? '<a class="btn btn-sm" href="' + RV.esc(agentUrl) + '" target="_blank" rel="noopener">' + RV.icon("external") + "Open on " + RV.esc(RV.links.AGENTS[agent].name) + "</a>" : "") +
            (existing ? '<button class="btn btn-sm" type="button" data-goto="' + existing.id + '">' + RV.icon("folder") + "Go to your folder</button>"
                      : '<button class="btn btn-sm" type="button" id="qc-make">' + RV.icon("folder") + "Create QC folder</button>") +
          "</div>" +
          '<p class="hint">QC photos are hosted by RepTools (rep.tools), a public QC finder. RepVault does not fetch or display third-party photos itself. Agent item pages also show QC photos once someone has ordered the item.</p>' +
        "</div>";
        var mk = RV.$("#qc-make", out);
        if (mk) mk.addEventListener("click", function () { openFolderModal(null, { link: p.original }); });
        var go = RV.$("[data-goto]", out);
        if (go) go.addEventListener("click", function () { focusFolder(go.dataset.goto); });
      }
      form.addEventListener("submit", function (e) { e.preventDefault(); lookup(input.value.trim()); });

      RV.$("#qc-new", el).addEventListener("click", function () { openFolderModal(null, {}); });
      RV.$("#qc-search", el).addEventListener("input", function (e) { state.search = e.target.value.trim().toLowerCase(); paint(); });
      RV.$$(".seg button", el).forEach(function (b) {
        b.addEventListener("click", function () {
          state.verdict = b.dataset.v;
          RV.$$(".seg button", el).forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); });
          paint();
        });
      });

      function focusFolder(id) {
        state.search = ""; state.verdict = "all";
        RV.$("#qc-search", el).value = "";
        RV.$$(".seg button", el).forEach(function (x) { x.setAttribute("aria-pressed", String(x.dataset.v === "all")); });
        paint();
        var card = RV.$('[data-folder="' + id + '"]', el);
        if (card) { card.scrollIntoView({ behavior: "smooth", block: "start" }); card.focus({ preventScroll: true }); }
      }

      function paint() {
        var list = RV.$("#qc-list", el);
        var all = folders();
        var items = all.filter(function (f) {
          if (state.verdict !== "all" && f.verdict !== state.verdict) return false;
          if (!state.search) return true;
          return [f.name, f.itemId, f.notes, f.platform].join(" ").toLowerCase().indexOf(state.search) >= 0;
        });
        if (!all.length) {
          list.innerHTML = '<div class="empty"><div class="empty-icon">' + RV.icon("folder") + "</div><h3>No QC folders yet</h3><p>Create a folder per item, add your agent’s warehouse photos and mark it GL or RL.</p>" +
            '<button class="btn btn-primary" type="button" data-act="new">' + RV.icon("plus") + "Create first folder</button></div>";
          return;
        }
        if (!items.length) { list.innerHTML = '<div class="empty"><h3>No QC folders match</h3><p>Try a different search or verdict filter.</p></div>'; return; }
        list.innerHTML = items.map(folderCard).join("");
      }

      function folderCard(f) {
        var p = f.link ? RV.links.parse(f.link) : null;
        return '<article class="item" tabindex="-1" data-folder="' + f.id + '">' +
          '<div class="item-head"><div style="min-width:0"><h3 class="item-title">' + RV.esc(f.name) + '</h3><div class="item-meta">' +
            (p ? "<span>" + RV.esc(p.platformName) + ' · <span class="mono">' + RV.esc(p.id) + "</span></span>" : "<span>No link</span>") +
            "<span>" + (f.photos || []).length + " photos</span><span>Updated " + RV.esc(RV.timeAgo(f.updatedAt || f.createdAt)) + "</span></div></div>" +
            verdictBadge(f.verdict) + "</div>" +
          (f.notes ? '<p class="muted wrap-anywhere">' + RV.esc(f.notes) + "</p>" : "") +
          ((f.photos || []).length ? '<div class="photos">' + f.photos.map(function (ph, i) {
            return '<div class="photo"><button class="photo-open" type="button" data-act="view" data-i="' + i + '" aria-label="View photo ' + (i + 1) + '"><img src="' + RV.esc(ph.src) + '" alt="QC photo ' + (i + 1) + " of " + RV.esc(f.name) + '" loading="lazy" referrerpolicy="no-referrer"></button>' +
              '<button class="photo-del" type="button" data-act="del-photo" data-i="' + i + '" aria-label="Delete photo ' + (i + 1) + '">' + RV.icon("trash") + "</button></div>";
          }).join("") + "</div>" : '<p class="faint small">No photos yet. Upload your QC pictures or add an image URL.</p>') +
          '<div class="row">' +
            '<label class="sr-only" for="v-' + f.id + '">Verdict</label><select class="select" style="width:auto;min-height:36px;padding-top:6px;padding-bottom:6px" id="v-' + f.id + '" data-act="verdict">' +
              Object.keys(VERDICTS).map(function (k) { return '<option value="' + k + '"' + (f.verdict === k ? " selected" : "") + ">" + VERDICTS[k] + "</option>"; }).join("") + "</select>" +
            '<label class="btn btn-sm" style="cursor:pointer">' + RV.icon("upload") + 'Upload photos<input class="sr-only" type="file" accept="image/*" multiple data-act="upload"></label>' +
            '<button class="btn btn-sm" type="button" data-act="add-url">' + RV.icon("image") + "Add image URL</button>" +
            (p ? '<a class="btn btn-sm" href="' + RV.esc(RV.links.qcFinder(p)) + '" target="_blank" rel="noopener">' + RV.icon("qc") + "Find QC</a>" : "") +
            '<span class="spacer"></span>' +
            '<button class="btn btn-sm btn-ghost" type="button" data-act="edit">' + RV.icon("edit") + "Edit</button>" +
            '<button class="btn btn-sm btn-ghost btn-danger" type="button" data-act="delete">' + RV.icon("trash") + "Delete</button>" +
          "</div></article>";
      }

      function update(id, fn) {
        var list = folders();
        var f = list.filter(function (x) { return x.id === id; })[0];
        if (!f) return null;
        var snapshot = JSON.stringify(f);
        fn(f); f.updatedAt = Date.now();
        if (!saveFolders(list)) { Object.assign(f, JSON.parse(snapshot)); return null; }
        return f;
      }

      var listEl = RV.$("#qc-list", el);
      listEl.addEventListener("click", function (e) {
        var btn = e.target.closest("[data-act]");
        if (!btn || btn.tagName === "SELECT" || btn.tagName === "INPUT") return;
        var act = btn.dataset.act;
        if (act === "new") return openFolderModal(null, {});
        var card = btn.closest("[data-folder]");
        if (!card) return;
        var id = card.dataset.folder;
        var f = folders().filter(function (x) { return x.id === id; })[0];
        if (!f) return;
        if (act === "view") {
          RV.lightbox(f.photos.map(function (ph, i) { return { src: ph.src, caption: f.name + " · photo " + (i + 1) }; }), +btn.dataset.i);
        } else if (act === "del-photo") {
          RV.confirm("Delete photo?", "This photo will be removed from “" + f.name + "”.").then(function (ok) {
            if (!ok) return;
            if (update(id, function (x) { x.photos.splice(+btn.dataset.i, 1); })) { RV.toast("Photo deleted"); paint(); }
          });
        } else if (act === "add-url") {
          RV.modal({
            title: "Add image URL",
            body: '<div class="field"><label class="label" for="img-url">Image URL</label><input class="input" id="img-url" type="url" placeholder="https://…/photo.jpg"><p class="hint">The image stays hosted where it is; RepVault saves the link.</p></div>',
            actions: [{ label: "Cancel", value: null }, {
              label: "Add photo", className: "btn-primary", onClick: function (body) {
                var inp = RV.$("#img-url", body), btnEl = this;
                var v = inp.value.trim();
                var primary = RV.$("#modal-actions .btn-primary");
                RV.setBusy(primary, true, "Checking…");
                RV.images.checkUrl(v).then(function (src) {
                  RV.setBusy(primary, false);
                  if ((f.photos || []).length >= MAX_PHOTOS) { RV.fieldError(inp, "This folder already has " + MAX_PHOTOS + " photos."); return; }
                  if (update(id, function (x) { x.photos.push({ id: RV.uid(), src: src, addedAt: Date.now() }); })) {
                    RV.closeModal(true);
                    RV.toast("Photo added", "success"); paint();
                  }
                }, function (err) { RV.setBusy(primary, false); RV.fieldError(inp, err.message); });
                return false;
              }
            }]
          });
        } else if (act === "edit") {
          openFolderModal(f, {});
        } else if (act === "delete") {
          RV.confirm("Delete QC folder?", "“" + f.name + "” and its " + (f.photos || []).length + " photos will be permanently deleted.").then(function (ok) {
            if (!ok) return;
            saveFolders(folders().filter(function (x) { return x.id !== id; }));
            RV.toast("QC folder deleted"); paint();
          });
        }
      });
      listEl.addEventListener("change", function (e) {
        var t = e.target, card = t.closest("[data-folder]");
        if (!card) return;
        var id = card.dataset.folder;
        if (t.dataset.act === "verdict") {
          if (update(id, function (x) { x.verdict = t.value; })) { RV.toast("Verdict set to " + VERDICTS[t.value].split(" ·")[0]); paint(); }
        } else if (t.dataset.act === "upload") {
          var files = Array.prototype.slice.call(t.files || []);
          if (!files.length) return;
          var f = folders().filter(function (x) { return x.id === id; })[0];
          var room = MAX_PHOTOS - (f.photos || []).length;
          if (room <= 0) { RV.toast("This folder already has " + MAX_PHOTOS + " photos.", "error"); return; }
          if (files.length > room) { RV.toast("Only " + room + " more photo(s) fit in this folder; extra files were skipped.", "error"); files = files.slice(0, room); }
          var label = t.closest("label"); label.setAttribute("aria-busy", "true");
          var errors = [];
          Promise.all(files.map(function (file) { return RV.images.fromFile(file).catch(function (err) { errors.push(err.message); return null; }); }))
            .then(function (srcs) {
              label.removeAttribute("aria-busy");
              srcs = srcs.filter(Boolean);
              if (srcs.length && update(id, function (x) { srcs.forEach(function (s) { x.photos.push({ id: RV.uid(), src: s, addedAt: Date.now() }); }); })) {
                RV.toast(srcs.length + " photo" + (srcs.length > 1 ? "s" : "") + " added", "success");
              }
              errors.forEach(function (m) { RV.toast(m, "error"); });
              paint();
            });
        }
      });

      function openFolderModal(f, preset) {
        var isEdit = !!f;
        f = f || { name: "", link: preset.link || "", notes: "", verdict: "pending" };
        RV.modal({
          title: isEdit ? "Edit QC folder" : "New QC folder",
          body: '<div class="field"><label class="label" for="qf-name">Item name</label><input class="input" id="qf-name" maxlength="120" value="' + RV.esc(f.name) + '" placeholder="e.g. Black hoodie, size L"></div>' +
            '<div class="field"><label class="label" for="qf-link">Product link (optional)</label><input class="input" id="qf-link" type="url" value="' + RV.esc(f.link) + '" placeholder="Weidian, Taobao, 1688 or agent link"><p class="hint" id="qf-detect"></p></div>' +
            '<div class="field"><label class="label" for="qf-verdict">Verdict</label><select class="select" id="qf-verdict">' + Object.keys(VERDICTS).map(function (k) { return '<option value="' + k + '"' + (f.verdict === k ? " selected" : "") + ">" + VERDICTS[k] + "</option>"; }).join("") + "</select></div>" +
            '<div class="field"><label class="label" for="qf-notes">Notes</label><textarea class="textarea" id="qf-notes" maxlength="2000" placeholder="Flaws, measurements, what to ask the agent…">' + RV.esc(f.notes) + "</textarea></div>",
          onOpen: function (body) {
            var li = RV.$("#qf-link", body), hint = RV.$("#qf-detect", body);
            function det() {
              var v = li.value.trim();
              if (!v) { hint.textContent = ""; return; }
              var p = RV.links.parse(v);
              hint.textContent = p ? "Detected " + p.platformName + " item " + p.id : RV.links.explain(v);
            }
            li.addEventListener("input", det); det();
          },
          actions: [{ label: "Cancel", value: null }, {
            label: isEdit ? "Save changes" : "Create folder", className: "btn-primary", onClick: function (body) {
              var name = RV.$("#qf-name", body), link = RV.$("#qf-link", body);
              var nv = name.value.trim(), lv = link.value.trim();
              RV.fieldError(name, nv ? null : "Give the folder a name.");
              var p = lv ? RV.links.parse(lv) : null;
              RV.fieldError(link, lv && !p ? RV.links.explain(lv) : null);
              if (!nv || (lv && !p)) return false;
              var data = { name: nv, link: p ? p.original : "", platform: p ? p.platform : "", itemId: p ? p.id : "", verdict: RV.$("#qf-verdict", body).value, notes: RV.$("#qf-notes", body).value.trim() };
              if (isEdit) {
                if (update(f.id, function (x) { Object.assign(x, data); })) RV.toast("QC folder updated", "success");
              } else {
                var list = folders();
                list.unshift(Object.assign({ id: RV.uid(), photos: [], createdAt: Date.now(), updatedAt: Date.now() }, data));
                if (saveFolders(list)) RV.toast("QC folder created", "success");
              }
              paint();
              return true;
            }
          }]
        });
      }

      paint();
      if (query.get("link")) { input.value = query.get("link"); lookup(input.value); }
      if (query.get("new")) { history.replaceState(null, "", "#/qc"); openFolderModal(null, {}); }
    }
  });
})();
