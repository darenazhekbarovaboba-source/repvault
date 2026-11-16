/* REPVAULT link intelligence: marketplace parsing, agent unwrapping and agent link generation.
   Agent URL formats were checked on 15 Nov 2026 (see README "Verified agent link formats"). */
(function () {
  "use strict";
  var RV = window.RV;

  var PLATFORMS = {
    weidian: { name: "Weidian", url: function (id) { return "https://weidian.com/item.html?itemID=" + id; } },
    taobao: { name: "Taobao", url: function (id) { return "https://item.taobao.com/item.htm?id=" + id; } },
    tmall: { name: "Tmall", url: function (id) { return "https://detail.tmall.com/item.htm?id=" + id; } },
    "1688": { name: "1688", url: function (id) { return "https://detail.1688.com/offer/" + id + ".html"; } }
  };

  var ACBUY_CODES = { weidian: "WD", taobao: "TB", tmall: "TB", "1688": "AL" };

  // Agents RepVault can generate links for (formats verified).
  var AGENTS = {
    kakobuy: {
      name: "KakoBuy", platforms: ["weidian", "taobao", "tmall", "1688"],
      build: function (p) { return "https://www.kakobuy.com/item/details?url=" + encodeURIComponent(p.original); }
    },
    superbuy: {
      name: "Superbuy", platforms: ["weidian", "taobao", "tmall", "1688"],
      build: function (p) { return "https://www.superbuy.com/en/page/buy/?nTag=Home-search&from=search-input&_search=url&position=&url=" + encodeURIComponent(p.original); }
    },
    sugargoo: {
      name: "Sugargoo", platforms: ["weidian", "taobao", "tmall", "1688"],
      // Current SPA route (live bundle, 15 Nov 2026): /products?productLink=<encoded original>. Old #/home/productDetail links still unwrap.
      build: function (p) { return "https://www.sugargoo.com/products?productLink=" + encodeURIComponent(p.original); }
    },
    oopbuy: {
      name: "OopBuy", platforms: ["weidian", "taobao", "tmall", "1688"], tmallAsTaobao: true,
      build: function (p) {
        var seg = p.platform === "weidian" ? "weidian/" : p.platform === "1688" ? "1688/" : "";
        return "https://oopbuy.com/product/" + seg + p.id;
      }
    },
    cssbuy: {
      name: "CSSBuy", platforms: ["weidian", "taobao", "tmall", "1688"], tmallAsTaobao: true,
      build: function (p) {
        var seg = p.platform === "weidian" ? "item-micro-" : p.platform === "1688" ? "item-1688-" : "item-";
        return "https://www.cssbuy.com/" + seg + p.id + ".html";
      }
    },
    usfans: {
      name: "USFans", platforms: ["weidian", "taobao", "tmall", "1688"], tmallAsTaobao: true,
      build: function (p) {
        var code = p.platform === "weidian" ? 3 : p.platform === "1688" ? 1 : 2;
        return "https://www.usfans.com/product/" + code + "/" + p.id;
      }
    },
    acbuy: {
      // source flag: WD = Weidian, TB = Taobao/Tmall, AL = 1688 (verified 15 Nov 2026)
      name: "ACBuy", platforms: ["weidian", "taobao", "tmall", "1688"], tmallAsTaobao: true,
      build: function (p) { return "https://www.acbuy.com/product?id=" + p.id + "&source=" + ACBUY_CODES[p.platform]; }
    }
  };

  // Agents whose links can be READ (unwrapped) but not generated (closed/unreachable or ambiguous format).
  var READ_ONLY = {
    cnfans: "CNFans (closed, Aug 2026)",
    mulebuy: "Mulebuy (unreachable since Oct 2026)",
    hoobuy: "Hoobuy (unreachable since Nov 2026)",
    allchinabuy: "AllChinaBuy (maintenance since Aug 2026)",
    joyagoo: "Joyagoo (format varies)"
  };

  function cleanInput(s) {
    s = String(s || "").trim();
    var m = s.match(/https?:\/\/[^\s"'<>，。]+/i);
    if (m) return m[0];
    if (/^[\w.-]+\.(com|cn|net)\//i.test(s)) return "https://" + s.split(/\s/)[0];
    return s;
  }
  function safeDecode(s) { try { return decodeURIComponent(s); } catch (e) { return s; } }
  function fullyDecode(s) { var prev; var n = 0; while (prev !== s && n < 4) { prev = s; s = safeDecode(s); n++; } return s; }
  function host(u) { return u.hostname.replace(/^www\.|^m\.|^h5\./, "").toLowerCase(); }
  function params(u) {
    var out = {};
    u.searchParams.forEach(function (v, k) { out[k.toLowerCase()] = v; });
    // Hash-based routes like sugargoo.com/#/home/productDetail?productLink=...
    var h = u.hash || "";
    var qi = h.indexOf("?");
    if (qi >= 0) new URLSearchParams(h.slice(qi + 1)).forEach(function (v, k) { out[k.toLowerCase()] = v; });
    return out;
  }
  function platformWord(v) {
    v = String(v || "").toLowerCase();
    if (/weidian|micro|^wd$/.test(v)) return "weidian";
    if (/1688|ali_1688|alibaba/.test(v)) return "1688";
    if (/tmall/.test(v)) return "tmall";
    if (/taobao|^tb$/.test(v)) return "taobao";
    return null;
  }
  function result(platform, id, via) {
    if (!platform || !id || !/^\d{5,}$/.test(id)) return null;
    return { platform: platform, platformName: PLATFORMS[platform].name, id: id, original: PLATFORMS[platform].url(id), via: via || null };
  }

  // Parse a direct marketplace URL.
  function parseMarketplace(u) {
    var h = host(u), p = params(u), path = u.pathname;
    if (/(^|\.)weidian\.com$|(^|\.)koudai\.com$/.test(h)) {
      var wid = p.itemid || p.itemID || p.id;
      if (!wid) { var wm = path.match(/item\/(\d+)/); if (wm) wid = wm[1]; }
      return result("weidian", wid);
    }
    if (/(^|\.)tmall\.(com|hk)$/.test(h)) return result("tmall", p.id);
    if (/(^|\.)taobao\.com$/.test(h)) {
      var tid = p.id || p.itemid;
      if (!tid) { var tm = path.match(/item\/(\d+)\.htm/); if (tm) tid = tm[1]; }
      return result("taobao", tid);
    }
    if (/(^|\.)1688\.com$/.test(h)) {
      var om = path.match(/offer\/(\d+)(?:\.html)?(?:[/?#]|$)/);
      return result("1688", om ? om[1] : p.offerid);
    }
    return null;
  }

  // Parse an agent URL back to the marketplace item.
  function parseAgent(u) {
    var h = host(u), p = params(u), path = u.pathname;
    var agentKey = Object.keys(AGENTS).concat(Object.keys(READ_ONLY)).filter(function (k) { return h.indexOf(k) >= 0; })[0] || null;
    var via = agentKey ? (AGENTS[agentKey] ? AGENTS[agentKey].name : READ_ONLY[agentKey].split(" (")[0]) : "agent link";

    // 1) Wrapped original URL (KakoBuy, Superbuy, AllChinaBuy, Sugargoo, many others)
    var wrapped = p.url || p.productlink || p.link || p.producturl;
    if (wrapped) {
      var inner = parse(fullyDecode(wrapped), true);
      if (inner) { inner.via = via; return inner; }
    }
    // 2) Path formats
    var m;
    if (agentKey === "oopbuy" && (m = path.match(/\/product\/(?:(weidian|1688|taobao)\/)?(\d+)/i))) return result(m[1] ? platformWord(m[1]) : "taobao", m[2], via);
    if (agentKey === "cssbuy") {
      if ((m = path.match(/item-micro-(\d+)/))) return result("weidian", m[1], via);
      if ((m = path.match(/item-1688-(\d+)/))) return result("1688", m[1], via);
      if ((m = path.match(/item-(\d+)/))) return result("taobao", m[1], via);
      if (p.type && p.id) return result(platformWord(p.type) || "taobao", p.id, via);
    }
    if (agentKey === "hoobuy" && (m = path.match(/\/product\/([012])\/(\d+)/))) return result({ 0: "1688", 1: "taobao", 2: "weidian" }[m[1]], m[2], via);
    if (agentKey === "usfans" && (m = path.match(/\/product\/([123])\/(\d+)/))) return result({ 1: "1688", 2: "taobao", 3: "weidian" }[m[1]], m[2], via);
    if (agentKey === "acbuy" && p.id) {
      var src = String(p.source || "").toUpperCase();
      var acMap = { WD: "weidian", TB: "taobao", AL: "1688" };
      if (acMap[src]) return result(acMap[src], p.id, via);
    }
    // 3) id + platform word (CNFans, Mulebuy, Joyagoo, LoveGoBuy and similar)
    var pw = platformWord(p.shop_type || p.platform || p.shoptype || p.channel || p.source);
    var id = p.id || p.itemid || p.item_id || p.goodsid;
    if (pw && id) return result(pw, id, via);
    return null;
  }

  function parse(input, nested) {
    var s = cleanInput(input);
    if (!s) return null;
    var u;
    try { u = new URL(s); } catch (e) { return null; }
    var mk = parseMarketplace(u);
    if (mk) return mk;
    return parseAgent(u);
  }

  function explain(input) {
    var s = cleanInput(input);
    if (!s) return "Paste a product link.";
    if (!/^https?:\/\//i.test(s)) return "That doesn't look like a link. It should start with https://";
    try { new URL(s); } catch (e) { return "That link is not a valid URL."; }
    if (/(m\.tb\.cn|tb\.cn|k\.youshop10\.com|bit\.ly|tinyurl|qr\.1688|s\.click)/i.test(s)) return "This is a short/share link that hides the item number. Open it once in your browser and paste the full address it lands on.";
    if (/yupoo/i.test(s)) return "Yupoo albums are photo albums, not product listings. Find the Weidian/Taobao link in the album and paste that.";
    if (/shop\d*\.?weidian|weidian\.com\/\?userid|shop\.taobao/i.test(s)) return "That is a shop page, not a single product. Open the product and copy its link.";
    return "Couldn't find a Weidian, Taobao, Tmall or 1688 item number in this link. Supported: direct marketplace links and KakoBuy, Superbuy, Sugargoo, OopBuy, CSSBuy, USFans, ACBuy, CNFans, Mulebuy, Hoobuy, AllChinaBuy and Joyagoo links.";
  }

  function toAgent(parsed, agentKey) {
    var a = AGENTS[agentKey];
    if (!a || !parsed) return null;
    var plat = parsed.platform;
    if (a.platforms.indexOf(plat) < 0) return null;
    return a.build(parsed);
  }

  function platformOf(input) { var p = parse(input); return p ? p.platform : null; }

  RV.links = {
    PLATFORMS: PLATFORMS, AGENTS: AGENTS, READ_ONLY: READ_ONLY,
    parse: parse, explain: explain, toAgent: toAgent, platformOf: platformOf,
    losesTmall: function (parsed, agentKey) { return !!(parsed && parsed.platform === "tmall" && AGENTS[agentKey] && AGENTS[agentKey].tmallAsTaobao); },
    TMALL_NOTE: "This agent's link format has no separate Tmall code, so it is built with the Taobao code. The item ID is the same; converting it back gives a Taobao-format link. Keep the original Tmall link shown here.",
    qcFinder: function (parsed) { return "https://rep.tools/qc-finder?link=" + encodeURIComponent(parsed.original); },
    agentOptions: function (selected) {
      return Object.keys(AGENTS).map(function (k) {
        return '<option value="' + k + '"' + (k === selected ? " selected" : "") + ">" + RV.esc(AGENTS[k].name) + (AGENTS[k].platforms.length < 4 ? " (" + AGENTS[k].platforms.map(function (x) { return PLATFORMS[x].name; }).join(", ") + " only)" : "") + "</option>";
      }).join("");
    }
  };
})();
