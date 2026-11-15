/* Product Organizer: saved finds with price (CNY + live conversion), photos, category, tags, status; grid/list, search, filter, sort, import/export. */
(function () {
  "use strict";
  var RV = window.RV;
  var STATUSES = { wishlist: "Wishlist", ordered: "Ordered", received: "Received" };
  var CATEGORIES = ["Tops", "Bottoms", "Outerwear", "Shoes", "Bags", "Accessories", "Electronics", "Other"];
  var MAX_PHOTOS = 4;

  function list() { return RV.store.get("products") || []; }
  function save(l) { return RV.store.set("products", l); }
  function statusBadge(s) {
    if (s === "received") return '<span class="badge badge-solid">' + RV.icon("check") + "Received</span>";
    if (s === "ordered") return '<span class="badge badge-brown"><span class="dot"></span>Ordered</span>';
    return '<span class="badge badge-ring"><span class="dot"></span>Wishlist</span>';
  }
  function normalizeImported(p) {
    if (!p || typeof p !== "object" || !String(p.name || "").trim()) return null;
    var price = RV.num(p.price);
    return {
      id: String(p.id || ""), name: String(p.name).trim().slice(0, 160), link: String(p.link || ""), platform: p.platform || RV.links.platformOf(p.link || "") || "",
      price: isFinite(price) && price >= 0 ? price : null, photos: Array.isArray(p.photos) ? p.photos.filter(function (x) { return typeof x === "string" && (/^data:image\//.test(x) || RV.isUrl(x)); }).slice(0, MAX_PHOTOS) : [],
      category: String(p.category || "Other"), tags: Array.isArray(p.tags) ? p.tags.map(String).slice(0, 12) : [], notes: String(p.notes || "").slice(0, 2000),
      status: STATUSES[p.status] ? p.status : "wishlist", createdAt: +p.createdAt || Date.now(), updatedAt: Date.now()
    };
  }

  RV.register("products", {
    title: "Product Organizer", icon: "box", group: "tools",
    blurb: "Save finds with prices, photos, tags and status. Search, sort and export.",
    meta: function () { return list().length + " saved"; },
    render: function (el, query) {
      var st = { q: "", status: "all", category: "all", sort: "new", view: RV.setting("productView") || "grid" };
      el.innerHTML =
        '<div class="page-head"><div><span class="eyebrow">Tool</span><h1>Product Organizer</h1><p class="lede">Your private list of finds. Prices are entered in CNY and converted with the live exchange rate.</p></div>' +
        '<div class="page-actions"><button class="btn" type="button" id="pr-export">' + RV.icon("download") + 'Export</button><label class="btn" style="cursor:pointer">' + RV.icon("upload") + 'Import<input class="sr-only" type="file" accept="application/json,.json" id="pr-import"></label><button class="btn btn-primary" type="button" id="pr-new">' + RV.icon("plus") + "Add product</button></div></div>" +
        '<div class="card" style="margin-bottom:18px;padding:16px"><div class="row">' +
          '<div class="field" style="flex:2;min-width:200px"><label class="sr-only" for="pr-q">Search products</label><input class="input" id="pr-q" type="search" placeholder="Search name, tags, notes, item ID"></div>' +
          '<div class="field" style="flex:1;min-width:130px"><label class="sr-only" for="pr-status">Status</label><select class="select" id="pr-status"><option value="all">All statuses</option>' + Object.keys(STATUSES).map(function (k) { return '<option value="' + k + '">' + STATUSES[k] + "</option>"; }).join("") + "</select></div>" +
          '<div class="field" style="flex:1;min-width:140px"><label class="sr-only" for="pr-cat">Category</label><select class="select" id="pr-cat"></select></div>' +
          '<div class="field" style="flex:1;min-width:150px"><label class="sr-only" for="pr-sort">Sort</label><select class="select" id="pr-sort"><option value="new">Newest first</option><option value="old">Oldest first</option><option value="price-asc">Price: low to high</option><option value="price-desc">Price: high to low</option><option value="name">Name A–Z</option></select></div>' +
          '<div class="seg" role="group" aria-label="View"><button type="button" data-view="grid" aria-pressed="' + (st.view === "grid") + '" aria-label="Grid view">' + RV.icon("grid") + '</button><button type="button" data-view="list" aria-pressed="' + (st.view === "list") + '" aria-label="List view">' + RV.icon("list") + "</button></div>" +
        '</div><p class="hint" id="pr-summary" style="margin-top:10px"></p></div>' +
        '<div id="pr-list"></div>';

      var listEl = RV.$("#pr-list", el);
      function fillCats() {
        var cats = CATEGORIES.slice();
        list().forEach(function (p) { if (p.category && cats.indexOf(p.category) < 0) cats.push(p.category); });
        var sel = RV.$("#pr-cat", el), cur = sel.value || "all";
        sel.innerHTML = '<option value="all">All categories</option>' + cats.map(function (c) { return '<option value="' + RV.esc(c) + '">' + RV.esc(c) + "</option>"; }).join("");
        sel.value = cats.indexOf(cur) >= 0 ? cur : "all";
        st.category = sel.value;
      }

      function paint() {
        var all = list();
        var items = all.filter(function (p) {
          if (st.status !== "all" && p.status !== st.status) return false;
          if (st.category !== "all" && p.category !== st.category) return false;
          if (!st.q) return true;
          var parsed = p.link ? RV.links.parse(p.link) : null;
          return [p.name, (p.tags || []).join(" "), p.notes, p.category, parsed ? parsed.id : ""].join(" ").toLowerCase().indexOf(st.q) >= 0;
        });
        var sorters = {
          "new": function (a, b) { return b.createdAt - a.createdAt; },
          old: function (a, b) { return a.createdAt - b.createdAt; },
          "price-asc": function (a, b) { return (a.price == null ? Infinity : a.price) - (b.price == null ? Infinity : b.price); },
          "price-desc": function (a, b) { return (b.price == null ? -1 : b.price) - (a.price == null ? -1 : a.price); },
          name: function (a, b) { return a.name.localeCompare(b.name); }
        };
        items.sort(sorters[st.sort]);
        var total = items.reduce(function (s, p) { return s + (p.price || 0); }, 0);
        var conv = RV.fx.convert(total);
        RV.$("#pr-summary", el).textContent = all.length ? items.length + " of " + all.length + " products · total " + RV.fx.cny(total) + (conv != null ? " ≈ " + RV.fx.format(conv) : "") : "";
        if (!all.length) {
          listEl.className = "";
          listEl.innerHTML = '<div class="empty"><div class="empty-icon">' + RV.icon("box") + "</div><h3>No saved products</h3><p>Save a find with its link, price and photos. Or import a RepVault JSON export.</p>" +
            '<button class="btn btn-primary" type="button" data-act="new">' + RV.icon("plus") + "Add your first product</button></div>";
          return;
        }
        if (!items.length) { listEl.className = ""; listEl.innerHTML = '<div class="empty"><h3>No products match</h3><p>Try clearing the search or filters.</p><button class="btn" type="button" data-act="clear">Clear filters</button></div>'; return; }
        listEl.className = "products " + (st.view === "list" ? "list-view" : "grid-view");
        listEl.innerHTML = items.map(card).join("");
      }

      function card(p) {
        var parsed = p.link ? RV.links.parse(p.link) : null;
        var agentUrl = parsed ? RV.links.toAgent(parsed, RV.setting("agent")) : null;
        var conv = p.price != null ? RV.fx.convert(p.price) : null;
        var img = p.photos && p.photos[0];
        return '<article class="pcard" data-id="' + p.id + '">' +
          (img ? '<button class="pcard-img" type="button" data-act="photos" aria-label="View photos of ' + RV.esc(p.name) + '"><img src="' + RV.esc(img) + '" alt="" loading="lazy" referrerpolicy="no-referrer"></button>' : '<div class="pcard-img is-empty" aria-hidden="true">' + RV.icon("image") + "</div>") +
          '<div class="pcard-body"><div class="row" style="justify-content:space-between">' + statusBadge(p.status) + '<span class="faint small">' + RV.esc(p.category || "") + "</span></div>" +
            '<h3 class="pcard-title">' + RV.esc(p.name) + "</h3>" +
            '<div class="price">' + (p.price != null ? RV.fx.cny(p.price) + "<small>" + (conv != null ? "≈ " + RV.esc(RV.fx.format(conv)) : "") + "</small>" : '<span class="faint">No price</span>') + "</div>" +
            (parsed ? '<div class="small muted">' + RV.esc(parsed.platformName) + ' · <span class="mono">' + RV.esc(parsed.id) + "</span>" + ((p.photos || []).length > 1 ? " · " + p.photos.length + " photos" : "") + "</div>" : (p.link ? '<div class="small muted wrap-anywhere">' + RV.esc(p.link) + "</div>" : "")) +
            ((p.tags || []).length ? '<div class="tags">' + p.tags.map(function (t) { return '<span class="badge badge-muted">#' + RV.esc(t) + "</span>"; }).join("") + "</div>" : "") +
            (p.notes ? '<p class="small muted wrap-anywhere">' + RV.esc(p.notes.length > 140 ? p.notes.slice(0, 140) + "…" : p.notes) + "</p>" : "") +
          "</div>" +
          '<div class="pcard-foot">' +
            (p.link ? '<a class="btn btn-sm" href="' + RV.esc(parsed ? parsed.original : p.link) + '" target="_blank" rel="noopener" aria-label="Open listing for ' + RV.esc(p.name) + '">' + RV.icon("external") + "Listing</a>" : "") +
            (agentUrl ? '<a class="btn btn-sm" href="' + RV.esc(agentUrl) + '" target="_blank" rel="noopener" aria-label="Open ' + RV.esc(p.name) + " on " + RV.esc(RV.links.AGENTS[RV.setting("agent")].name) + '">' + RV.esc(RV.links.AGENTS[RV.setting("agent")].name) + "</a>" : "") +
            '<button class="btn btn-sm btn-ghost" type="button" data-act="edit" aria-label="Edit ' + RV.esc(p.name) + '">' + RV.icon("edit") + "Edit</button>" +
            '<button class="btn btn-sm btn-ghost btn-danger" type="button" data-act="delete" aria-label="Delete ' + RV.esc(p.name) + '">' + RV.icon("trash") + "Delete</button>" +
          "</div></article>";
      }

      listEl.addEventListener("click", function (e) {
        var b = e.target.closest("[data-act]");
        if (!b) return;
        var act = b.dataset.act;
        if (act === "new") return openModal(null, {});
        if (act === "clear") {
          st.q = ""; st.status = "all"; st.category = "all";
          RV.$("#pr-q", el).value = ""; RV.$("#pr-status", el).value = "all"; RV.$("#pr-cat", el).value = "all";
          return paint();
        }
        var id = b.closest("[data-id]").dataset.id;
        var p = list().filter(function (x) { return x.id === id; })[0];
        if (!p) return;
        if (act === "photos") RV.lightbox(p.photos.map(function (src, i) { return { src: src, caption: p.name + " · " + (i + 1) }; }), 0);
        if (act === "edit") openModal(p, {});
        if (act === "delete") RV.confirm("Delete product?", "“" + p.name + "” will be permanently removed.").then(function (ok) {
          if (!ok) return;
          save(list().filter(function (x) { return x.id !== id; })); RV.toast("Product deleted"); fillCats(); paint();
        });
      });

      RV.$("#pr-q", el).addEventListener("input", function (e) { st.q = e.target.value.trim().toLowerCase(); paint(); });
      RV.$("#pr-status", el).addEventListener("change", function (e) { st.status = e.target.value; paint(); });
      RV.$("#pr-cat", el).addEventListener("change", function (e) { st.category = e.target.value; paint(); });
      RV.$("#pr-sort", el).addEventListener("change", function (e) { st.sort = e.target.value; paint(); });
      RV.$$("[data-view]", el).forEach(function (b) {
        b.addEventListener("click", function () {
          st.view = b.dataset.view; RV.setting("productView", st.view);
          RV.$$("[data-view]", el).forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); });
          paint();
        });
      });
      RV.$("#pr-new", el).addEventListener("click", function () { openModal(null, {}); });
      RV.$("#pr-export", el).addEventListener("click", function () {
        var all = list();
        if (!all.length) return RV.toast("Nothing to export yet.", "error");
        RV.download("repvault-products-" + RV.todayISO() + ".json", JSON.stringify({ app: "REPVAULT", type: "products", version: 1, exportedAt: new Date().toISOString(), products: all }, null, 2));
        RV.toast("Exported " + all.length + " products", "success");
      });
      RV.$("#pr-import", el).addEventListener("change", function (e) {
        var file = e.target.files && e.target.files[0];
        e.target.value = "";
        if (!file) return;
        if (file.size > 20 * 1024 * 1024) return RV.toast("That file is over 20 MB.", "error");
        RV.readFileText(file).then(function (text) {
          var data;
          try { data = JSON.parse(text); } catch (err) { throw new Error("That file isn’t valid JSON."); }
          var arr = Array.isArray(data) ? data : data && Array.isArray(data.products) ? data.products : null;
          if (!arr) throw new Error("No products found. Use a file exported from RepVault.");
          var clean = arr.map(normalizeImported).filter(Boolean);
          if (!clean.length) throw new Error("The file has no valid products (each needs a name).");
          return RV.modal({
            title: "Import " + clean.length + " products",
            body: "<p>Add them to your current " + list().length + " products, or replace everything?" + (arr.length > clean.length ? " " + (arr.length - clean.length) + " invalid entries will be skipped." : "") + "</p>",
            actions: [{ label: "Cancel", value: null }, { label: "Replace all", value: "replace" }, { label: "Merge", className: "btn-primary", value: "merge" }]
          }).then(function (choice) {
            if (!choice) return;
            var existing = choice === "replace" ? [] : list();
            var ids = {};
            existing.forEach(function (p) { ids[p.id] = true; });
            clean.forEach(function (p) { if (!p.id || ids[p.id]) p.id = RV.uid(); ids[p.id] = true; }); // always unique ids
            if (save(existing.concat(clean))) RV.toast("Imported " + clean.length + " products", "success");
            fillCats(); paint();
          });
        }).catch(function (err) { RV.toast(err.message, "error"); });
      });

      function openModal(p, preset) {
        var isEdit = !!p;
        p = p || { name: "", link: preset.link || "", price: null, photos: [], category: "Other", tags: [], notes: "", status: "wishlist" };
        var photos = (p.photos || []).slice();
        RV.modal({
          title: isEdit ? "Edit product" : "Add product",
          body: '<div class="form-grid">' +
            '<div class="field full"><label class="label" for="pf-name">Name</label><input class="input" id="pf-name" maxlength="160" value="' + RV.esc(p.name) + '" placeholder="e.g. Grey zip hoodie"></div>' +
            '<div class="field full"><label class="label" for="pf-link">Link</label><input class="input" id="pf-link" type="url" value="' + RV.esc(p.link) + '" placeholder="Weidian, Taobao, 1688 or agent link"><p class="hint" id="pf-detect" aria-live="polite"></p></div>' +
            '<div class="field"><label class="label" for="pf-price">Price (CNY ¥)</label><input class="input" id="pf-price" type="number" inputmode="decimal" min="0" step="0.01" value="' + (p.price != null ? p.price : "") + '"><p class="hint" id="pf-conv" aria-live="polite"></p></div>' +
            '<div class="field"><label class="label" for="pf-status">Status</label><select class="select" id="pf-status">' + Object.keys(STATUSES).map(function (k) { return '<option value="' + k + '"' + (p.status === k ? " selected" : "") + ">" + STATUSES[k] + "</option>"; }).join("") + "</select></div>" +
            '<div class="field"><label class="label" for="pf-cat">Category</label><input class="input" id="pf-cat" list="pf-cats" maxlength="40" value="' + RV.esc(p.category) + '"><datalist id="pf-cats">' + CATEGORIES.map(function (c) { return '<option value="' + c + '">'; }).join("") + "</datalist></div>" +
            '<div class="field"><label class="label" for="pf-tags">Tags (comma separated)</label><input class="input" id="pf-tags" maxlength="200" value="' + RV.esc((p.tags || []).join(", ")) + '" placeholder="grail, gift"></div>' +
            '<div class="field full"><span class="label">Photos (up to ' + MAX_PHOTOS + ')</span><div class="photos" id="pf-photos"></div><div class="row"><label class="btn btn-sm" style="cursor:pointer">' + RV.icon("upload") + 'Upload<input class="sr-only" id="pf-file" type="file" accept="image/*" multiple></label><div class="input-group" style="flex:1;min-width:200px"><label class="sr-only" for="pf-imgurl">Image URL</label><input class="input" id="pf-imgurl" type="url" placeholder="or paste image URL"><button class="btn btn-sm" type="button" id="pf-addurl">Add</button></div></div></div>' +
            '<div class="field full"><label class="label" for="pf-notes">Notes</label><textarea class="textarea" id="pf-notes" maxlength="2000" placeholder="Size, color, seller, batch…">' + RV.esc(p.notes) + "</textarea></div>" +
          "</div>",
          onOpen: function (body) {
            var link = RV.$("#pf-link", body), det = RV.$("#pf-detect", body), price = RV.$("#pf-price", body), conv = RV.$("#pf-conv", body);
            function d() { var v = link.value.trim(); if (!v) { det.textContent = ""; return; } var pp = RV.links.parse(v); det.textContent = pp ? "Detected " + pp.platformName + " item " + pp.id + (pp.via ? " (from " + pp.via + ")" : "") : "Platform not recognised. The link will be saved as-is."; }
            function c() { var n = RV.num(price.value); var x = n >= 0 ? RV.fx.convert(n) : null; conv.textContent = x != null ? "≈ " + RV.fx.format(x) + " (" + RV.fx.label().toLowerCase() + ")" : price.value ? "Conversion unavailable right now" : ""; }
            link.addEventListener("input", d); price.addEventListener("input", c); d(); c();
            function paintPhotos() {
              RV.$("#pf-photos", body).innerHTML = photos.length ? photos.map(function (src, i) {
                return '<div class="photo"><button class="photo-open" type="button" data-view="' + i + '" aria-label="View photo ' + (i + 1) + '"><img src="' + RV.esc(src) + '" alt="Photo ' + (i + 1) + '" referrerpolicy="no-referrer"></button><button class="photo-del" type="button" data-rm="' + i + '" aria-label="Remove photo ' + (i + 1) + '">' + RV.icon("trash") + "</button></div>";
              }).join("") : '<p class="hint">No photos added.</p>';
            }
            RV.$("#pf-photos", body).addEventListener("click", function (e) {
              var rm = e.target.closest("[data-rm]"); if (rm) { photos.splice(+rm.dataset.rm, 1); paintPhotos(); return; }
              var v = e.target.closest("[data-view]"); if (v) RV.lightbox(photos.map(function (s) { return { src: s }; }), +v.dataset.view);
            });
            RV.$("#pf-file", body).addEventListener("change", function (e) {
              var files = Array.prototype.slice.call(e.target.files || []); e.target.value = "";
              var room = MAX_PHOTOS - photos.length;
              if (room <= 0) return RV.toast("Up to " + MAX_PHOTOS + " photos per product.", "error");
              if (files.length > room) { RV.toast("Only " + room + " more photo(s) fit; extras skipped.", "error"); files = files.slice(0, room); }
              var holder = RV.$("#pf-photos", body); holder.insertAdjacentHTML("beforeend", '<div class="photo" id="pf-loading" style="display:grid;place-items:center"><span class="spinner" aria-label="Processing photos"></span></div>');
              Promise.all(files.map(function (f) { return RV.images.fromFile(f).catch(function (err) { RV.toast(err.message, "error"); return null; }); }))
                .then(function (srcs) { srcs.filter(Boolean).forEach(function (s) { photos.push(s); }); paintPhotos(); });
            });
            RV.$("#pf-addurl", body).addEventListener("click", function () {
              var inp = RV.$("#pf-imgurl", body), btn = this;
              if (photos.length >= MAX_PHOTOS) return RV.fieldError(inp, "Up to " + MAX_PHOTOS + " photos per product.");
              RV.setBusy(btn, true, "…");
              RV.images.checkUrl(inp.value.trim()).then(function (src) { RV.setBusy(btn, false); RV.fieldError(inp, null); photos.push(src); inp.value = ""; paintPhotos(); },
                function (err) { RV.setBusy(btn, false); RV.fieldError(inp, err.message); });
            });
            paintPhotos();
          },
          actions: [{ label: "Cancel", value: null }, {
            label: isEdit ? "Save changes" : "Save product", className: "btn-primary", onClick: function (body) {
              var name = RV.$("#pf-name", body), link = RV.$("#pf-link", body), price = RV.$("#pf-price", body);
              var nv = name.value.trim(), lv = link.value.trim(), pv = price.value.trim(), pn = RV.num(pv);
              RV.fieldError(name, nv ? null : "Name is required.");
              RV.fieldError(link, lv && !RV.isUrl(lv) ? "Enter a full link starting with https://" : null);
              RV.fieldError(price, pv && !(pn >= 0 && pn < 1e7) ? "Enter a valid price." : null);
              if (!nv || (lv && !RV.isUrl(lv)) || (pv && !(pn >= 0 && pn < 1e7))) return false;
              var parsed = lv ? RV.links.parse(lv) : null;
              var data = {
                name: nv, link: parsed ? parsed.original : lv, platform: parsed ? parsed.platform : "", price: pv ? RV.round(pn, 2) : null, photos: photos,
                category: RV.$("#pf-cat", body).value.trim() || "Other", status: RV.$("#pf-status", body).value,
                tags: RV.$("#pf-tags", body).value.split(",").map(function (t) { return t.trim().replace(/^#/, ""); }).filter(Boolean).slice(0, 12),
                notes: RV.$("#pf-notes", body).value.trim(), updatedAt: Date.now()
              };
              var all = list();
              if (isEdit) {
                var x = all.filter(function (q) { return q.id === p.id; })[0];
                Object.assign(x, data);
                if (!save(all)) return false;
                RV.toast("Product updated", "success");
              } else {
                all.unshift(Object.assign({ id: RV.uid(), createdAt: Date.now() }, data));
                if (!save(all)) return false;
                RV.toast("Product saved", "success");
              }
              fillCats(); paint(); return true;
            }
          }]
        });
      }

      fillCats();
      paint();
      document.addEventListener("rv:fx", paintIfMounted);
      function paintIfMounted() { if (document.body.contains(listEl)) paint(); else document.removeEventListener("rv:fx", paintIfMounted); }
      if (query.get("new")) { var l = query.get("link") || ""; history.replaceState(null, "", "#/products"); openModal(null, { link: l }); }
    }
  });
})();
