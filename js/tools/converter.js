/* Link Converter: agent link -> original marketplace link, original -> any verified agent format, batch mode, history. */
(function () {
  "use strict";
  var RV = window.RV;
  var MAX_HISTORY = 30;

  function hist() { return RV.store.get("convHistory") || []; }

  RV.register("converter", {
    title: "Link Converter", icon: "link", group: "tools",
    blurb: "Turn agent links back into Weidian, Taobao or 1688 links, or into any supported agent.",
    meta: function () { return Object.keys(RV.links.AGENTS).length + " agents"; },
    render: function (el, query) {
      var mode = "single";
      var A = RV.links.AGENTS;
      el.innerHTML =
        '<div class="page-head"><div><span class="eyebrow">Tool</span><h1>Link Converter</h1><p class="lede">Paste a Weidian, Taobao, Tmall, 1688 or agent link. RepVault reads the platform and item number and rebuilds it for the agent you choose. Everything happens in your browser.</p></div></div>' +
        '<section class="card" aria-labelledby="cv-h"><div class="card-head"><h2 id="cv-h">Convert</h2>' +
          '<div class="seg" role="tablist" aria-label="Mode"><button type="button" role="tab" data-mode="single" aria-selected="true">Single</button><button type="button" role="tab" data-mode="batch" aria-selected="false">Batch</button></div></div>' +
          '<form id="cv-form" class="stack" novalidate>' +
            '<div class="field" id="cv-single"><label class="label" for="cv-in">Link</label><input class="input" id="cv-in" type="url" inputmode="url" autocomplete="off" placeholder="https://www.kakobuy.com/item/details?url=…"></div>' +
            '<div class="field hidden" id="cv-batch"><label class="label" for="cv-many">Links (one per line, up to 200)</label><textarea class="textarea mono" id="cv-many" rows="7" placeholder="One link per line"></textarea></div>' +
            '<div class="row"><div class="field" style="min-width:220px;flex:1"><label class="label" for="cv-agent">Convert to</label><select class="select" id="cv-agent"><option value="original">Original marketplace link</option>' + RV.links.agentOptions(RV.setting("agent")) + "</select></div>" +
            '<div class="row" style="align-self:flex-end"><button class="btn btn-primary" type="submit">' + RV.icon("swap") + 'Convert</button><button class="btn btn-ghost" type="button" id="cv-clear">Clear</button></div></div>' +
          "</form>" +
          '<div id="cv-out" aria-live="polite" style="margin-top:16px"></div>' +
        "</section>" +
        '<div class="split" style="margin-top:18px">' +
          '<section class="card" aria-labelledby="cvh-h"><div class="card-head"><div><h2 id="cvh-h">History</h2><p class="card-sub">Last ' + MAX_HISTORY + " conversions, saved locally.</p></div><button class=\"btn btn-sm btn-ghost\" type=\"button\" id=\"cvh-clear\">Clear history</button></div><div id=\"cvh\"></div></section>" +
          '<section class="card" aria-labelledby="cvs-h"><div class="card-head"><div><h2 id="cvs-h">Supported formats</h2><p class="card-sub">Agent URL patterns checked on 15 Nov 2026.</p></div></div>' +
            '<div class="table-wrap"><table><thead><tr><th scope="col">Agent</th><th scope="col">Convert to</th><th scope="col">Platforms</th></tr></thead><tbody>' +
              Object.keys(A).map(function (k) { return "<tr><td>" + A[k].name + "</td><td>Yes</td><td>" + (A[k].platforms.length === 1 ? "Weidian" : "All 4") + "</td></tr>"; }).join("") +
              Object.keys(RV.links.READ_ONLY).map(function (k) { return "<tr><td>" + RV.esc(RV.links.READ_ONLY[k]) + '</td><td class="muted">Read only</td><td class="muted">Unwrap</td></tr>'; }).join("") +
            "</tbody></table></div>" +
            '<p class="hint" style="margin-top:10px">“All 4” = Weidian, Taobao, Tmall and 1688. Short links (m.tb.cn, bit.ly), shop pages and Yupoo albums don’t contain an item number. Open them first and paste the full product address.</p>' +
          "</section>" +
        "</div>";

      var out = RV.$("#cv-out", el), single = RV.$("#cv-in", el), many = RV.$("#cv-many", el), agentSel = RV.$("#cv-agent", el);

      RV.$$("[data-mode]", el).forEach(function (b) {
        b.addEventListener("click", function () {
          mode = b.dataset.mode;
          RV.$$("[data-mode]", el).forEach(function (x) { x.setAttribute("aria-selected", String(x === b)); });
          RV.$("#cv-single", el).classList.toggle("hidden", mode !== "single");
          RV.$("#cv-batch", el).classList.toggle("hidden", mode !== "batch");
          out.innerHTML = "";
          (mode === "single" ? single : many).focus();
        });
      });

      function convertOne(link, target) {
        var p = RV.links.parse(link);
        if (!p) return { input: link, error: RV.links.explain(link) };
        if (target === "original") return { input: link, parsed: p, output: p.original };
        var url = RV.links.toAgent(p, target);
        if (!url) return { input: link, parsed: p, error: A[target].name + " links are verified for Weidian items only. Original: " + p.original };
        return { input: link, parsed: p, output: url };
      }
      function targetName(t) { return t === "original" ? "Original" : A[t].name; }
      function addHistory(r, target) {
        var list = hist().filter(function (h) { return h.output !== r.output; });
        list.unshift({ id: RV.uid(), at: Date.now(), input: r.input, output: r.output, target: targetName(target), platform: r.parsed.platformName, itemId: r.parsed.id });
        RV.store.set("convHistory", list.slice(0, MAX_HISTORY));
      }

      function outLine(r) {
        return '<div class="out-line"><span class="mono">' + RV.esc(r.output) + '</span><span class="actions"><button class="btn btn-sm" type="button" data-copy="' + RV.esc(r.output) + '">' + RV.icon("copy") + 'Copy</button><a class="btn btn-sm" href="' + RV.esc(r.output) + '" target="_blank" rel="noopener">' + RV.icon("external") + "Open</a></span></div>";
      }

      RV.$("#cv-form", el).addEventListener("submit", function (e) {
        e.preventDefault();
        var target = agentSel.value;
        if (mode === "single") {
          var v = single.value.trim();
          if (!v) { RV.fieldError(single, "Paste a link to convert."); single.focus(); return; }
          var r = convertOne(v, target);
          if (!r.parsed) { RV.fieldError(single, r.error); out.innerHTML = ""; return; }
          RV.fieldError(single, null);
          var others = Object.keys(A).filter(function (k) { return k !== target; }).map(function (k) { return { k: k, url: RV.links.toAgent(r.parsed, k) }; }).filter(function (x) { return x.url; });
          out.innerHTML = '<div class="result">' +
            '<dl class="kv"><dt>Detected</dt><dd>' + RV.esc(r.parsed.platformName) + ' item <span class="mono">' + RV.esc(r.parsed.id) + "</span>" + (r.parsed.via ? " · from " + RV.esc(r.parsed.via) : "") + "</dd><dt>Result</dt><dd>" + RV.esc(targetName(target)) + "</dd></dl>" +
            (r.output ? outLine(r) : '<div class="notice notice-error">' + RV.icon("alert") + "<div>" + RV.esc(r.error) + "</div></div>") +
            (target !== "original" ? '<div class="out-line"><span class="mono">' + RV.esc(r.parsed.original) + '</span><span class="actions"><button class="btn btn-sm" type="button" data-copy="' + RV.esc(r.parsed.original) + '">' + RV.icon("copy") + "Copy original</button></span></div>" : "") +
            '<details><summary class="small muted" style="cursor:pointer">Same item on other agents (' + others.length + ")</summary><div class=\"chip-list\" style=\"margin-top:10px\">" +
              others.map(function (x) { return '<a class="chip" href="' + RV.esc(x.url) + '" target="_blank" rel="noopener">' + RV.icon("external") + RV.esc(A[x.k].name) + "</a>"; }).join("") + "</div></details>" +
            '<div class="actions"><a class="btn btn-sm" href="#/qc?link=' + encodeURIComponent(r.parsed.original) + '">' + RV.icon("qc") + 'Find QC</a><a class="btn btn-sm" href="#/products?new=1&link=' + encodeURIComponent(r.parsed.original) + '">' + RV.icon("plus") + "Save product</a></div>" +
          "</div>";
          if (r.output) { addHistory(r, target); paintHistory(); }
        } else {
          var lines = many.value.split(/\n+/).map(function (s) { return s.trim(); }).filter(Boolean);
          if (!lines.length) { RV.fieldError(many, "Paste at least one link."); many.focus(); return; }
          if (lines.length > 200) { RV.fieldError(many, "Up to 200 links at a time (you pasted " + lines.length + ")."); return; }
          RV.fieldError(many, null);
          var res = lines.map(function (l) { return convertOne(l, target); });
          var okCount = res.filter(function (r) { return r.output; }).length;
          var allOut = res.map(function (r) { return r.output || ""; }).join("\n");
          out.innerHTML = '<div class="result"><div class="row"><span class="strong">' + okCount + " of " + res.length + " converted</span>" + (okCount < res.length ? '<span class="badge badge-dashed">' + (res.length - okCount) + " failed</span>" : "") + '<span class="spacer"></span><button class="btn btn-sm btn-primary" type="button" id="cv-copy-all">' + RV.icon("copy") + "Copy all</button></div>" +
            '<ol class="stack" style="margin:0;padding-left:20px">' + res.map(function (r) {
              return '<li style="min-width:0">' + (r.output ? outLine(r) : '<div class="out-line"><span class="small"><span class="mono">' + RV.esc(r.input) + "</span><br>" + RV.esc(r.error) + "</span></div>") + "</li>";
            }).join("") + "</ol><p class=\"hint\">Copy all keeps line order; failed lines are left blank.</p></div>";
          RV.$("#cv-copy-all", out).addEventListener("click", function () { RV.copy(allOut, okCount + " links copied"); });
          res.filter(function (r) { return r.output; }).slice(0, 10).forEach(function (r) { addHistory(r, target); });
          paintHistory();
        }
      });

      out.addEventListener("click", function (e) { var b = e.target.closest("[data-copy]"); if (b) RV.copy(b.dataset.copy, "Link copied"); });
      RV.$("#cv-clear", el).addEventListener("click", function () { single.value = ""; many.value = ""; out.innerHTML = ""; RV.fieldError(single, null); RV.fieldError(many, null); (mode === "single" ? single : many).focus(); });

      function paintHistory() {
        var box = RV.$("#cvh", el), list = hist();
        if (!list.length) { box.innerHTML = '<p class="muted">No conversions yet.</p>'; return; }
        box.innerHTML = '<div class="stack">' + list.map(function (h) {
          return '<div class="out-line"><div style="min-width:0"><div class="small faint">' + RV.esc(h.platform) + " " + RV.esc(h.itemId) + " → " + RV.esc(h.target) + " · " + RV.esc(RV.timeAgo(h.at)) + '</div><span class="mono">' + RV.esc(h.output) + '</span></div><span class="actions"><button class="btn btn-sm" type="button" data-copy="' + RV.esc(h.output) + '" aria-label="Copy ' + RV.esc(h.target) + ' link">' + RV.icon("copy") + '</button><button class="btn btn-sm btn-ghost" type="button" data-hdel="' + h.id + '" aria-label="Remove from history">' + RV.icon("trash") + "</button></span></div>";
        }).join("") + "</div>";
      }
      RV.$("#cvh", el).addEventListener("click", function (e) {
        var c = e.target.closest("[data-copy]"); if (c) return RV.copy(c.dataset.copy, "Link copied");
        var d = e.target.closest("[data-hdel]");
        if (d) { RV.store.set("convHistory", hist().filter(function (h) { return h.id !== d.dataset.hdel; })); paintHistory(); }
      });
      RV.$("#cvh-clear", el).addEventListener("click", function () {
        if (!hist().length) return RV.toast("History is already empty");
        RV.confirm("Clear history?", "All saved conversions will be removed.", "Clear").then(function (ok) {
          if (ok) { RV.store.set("convHistory", []); paintHistory(); RV.toast("History cleared"); }
        });
      });
      paintHistory();

      if (query.get("link")) { single.value = query.get("link"); RV.$("#cv-form", el).requestSubmit ? RV.$("#cv-form", el).requestSubmit() : RV.$("#cv-form", el).dispatchEvent(new Event("submit", { cancelable: true })); }
    }
  });
})();
