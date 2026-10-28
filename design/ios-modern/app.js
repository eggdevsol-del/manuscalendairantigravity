/* Tattoi Swipe — swipe engine, sheet stack and every action in the prototype. */
(function () {
  "use strict";
  const D = window.Data, Art = window.Art, V = window.V, Views = window.Views, Sheets = window.Sheets;
  const $ = (s, el) => (el || document).querySelector(s);
  const root = document.documentElement;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  let S = D.load();
  const ui = {};
  const draft = { msg: {}, note: {}, res: {}, sign: {}, wait: {}, send: {} };
  const App = {
    get S() { return S; },
    me() { return S.role ? Views.roles[S.role].persona : null; },
  };
  window.App = App;

  // ── Elements ──────────────────────────────────────────────
  const track = $("#track"), bar = $("#bar"), dock = $("#dock"), dotsEl = $(".dots"), dockAct = $("#dock-act"), who = $("#who"), scrim = $("#scrim"), sheetsEl = $("#sheets"), gate = $("#gate"), toastEl = $("#toast"), aside = $("#aside"), stageBg = $("#stage-bg");
  let pages = [], current = 0, W = 0, H = 0, raf = 0;
  const stack = [];
  const skyOf = (def) => Views.skyOf(def);
  function currentSky() {
    const p = pages[current];
    return p ? skyOf(p.def) : Art.todaySky();
  }

  // ── Gate (role choice) ────────────────────────────────────
  function renderGate() {
    if (S.role) {
      gate.hidden = true;
      return;
    }
    gate.hidden = false;
    gate.setAttribute("style", Art.skyVars(Art.todaySky()));
    const card = (role, persona, title, text) => `<button type="button" class="role-card" data-act="role" data-arg="${role}">${V.av(persona)}<span><span class="t">${title}</span><span class="s">${text}</span></span><span class="chev">${V.icon("chevR")}</span></button>`;
    gate.innerHTML = `<div class="sky"><i class="a"></i><i class="b"></i></div><div class="gate-in"><h1>tattoi</h1><p class="gate-sub">Booking and revenue protection for tattoo artists.</p>
      <div class="gate-roles">
      ${card("artist", "a1", "I'm an artist", "Rory Vale. Requests, bookings, money and offers.")}
      ${card("client", "c1", "I'm getting tattooed", "Mia Chen. Bookings, forms and aftercare.")}
      ${card("supplier", "m1", "I'm a supplier", "Ink & Iron Supply. Orders and stock.")}
      <p class="small faint" style="margin:6px 0 0;text-align:center">Sample data only. Your changes stay in this browser.</p></div></div>`;
    dock.hidden = true;
    who.hidden = true;
    bar.classList.remove("solid");
    stageBg.setAttribute("style", Art.skyVars(Art.todaySky()));
    renderAside();
  }

  // ── Pages ─────────────────────────────────────────────────
  function role() {
    return Views.roles[S.role];
  }
  function enterRole(r) {
    S.role = r;
    while (stack.length) closeTop(true);
    Object.keys(ui).forEach((k) => delete ui[k]);
    gate.hidden = true;
    dock.hidden = false;
    who.hidden = false;
    buildTrack();
    D.buildTasks(S);
    renderPages();
    const saved = Math.min((S.pages || {})[r] || 0, pages.length - 1);
    measure();
    current = -1;
    goTo(saved, false);
    setCurrent(saved);
    updateChrome();
    D.save(S);
  }
  function buildTrack() {
    const defs = role().pages;
    track.innerHTML = defs.map((p, i) => `<section class="page" data-i="${i}" aria-label="${V.esc(p.title)}" aria-roledescription="page"><div class="sky"><i class="a"></i><i class="b"></i></div><div class="scroller"><header class="hero"></header><div class="deck"></div></div></section>`).join("");
    pages = [...track.children].map((el, i) => {
      const p = { el, def: defs[i], scroller: $(".scroller", el), hero: $(".hero", el), deck: $(".deck", el) };
      p.scroller.addEventListener("scroll", () => onPageScroll(p, i), { passive: true });
      return p;
    });
    dotsEl.innerHTML = defs.map((p, i) => `<button type="button" class="tab" role="tab" data-act="go" data-arg="${i}">${V.icon(p.icon || "sparkle")}<span>${V.esc(p.tab || p.title)}</span></button>`).join("");
  }
  function bigSize(s) {
    const n = String(s).length;
    return n <= 2 ? 112 : n <= 4 ? 96 : n <= 6 ? 80 : 64;
  }
  function renderPages() {
    if (!S.role) return;
    pages.forEach((p) => {
      const r = p.def.render(S, ui);
      p.last = r;
      p.el.setAttribute("style", Art.skyVars(skyOf(p.def)));
      if (r.raw) { p.hero.innerHTML = ""; p.deck.innerHTML = r.body; return; }
      p.hero.innerHTML = `${r.kicker ? `<div class="h-kicker">${V.esc(r.kicker)}</div>` : ""}<h1 class="h-title">${V.esc(p.def.title)}</h1><div class="h-big" style="font-size:${bigSize(r.big)}px">${V.esc(r.big)}</div><div class="h-cond">${V.esc(r.cond)}</div>${r.sub ? `<div class="h-sub">${V.esc(r.sub)}</div>` : ""}${(() => { const st = window.ViewStats[p.def.key]; const list = st ? st(S) : null; return list ? `<div class="h-stats">${list.map(([v, l]) => `<div><b>${V.esc(v)}</b><span>${V.esc(l)}</span></div>`).join("")}</div>` : ""; })()}${r.horizon ? `<div class="horizon">${r.horizon}</div>` : ""}`;
      p.deck.innerHTML = r.body;
    });
    if (window.LineHook) window.LineHook(S, pages, ui, current);
    updateBar();
  }
  function updateBar() {
    const p = pages[current];
    if (!p || !p.last) return;
    $(".bt", bar).textContent = p.def.title;
    $(".bs", bar).textContent = `${p.last.big}  ${p.last.cond}`;
  }
  // Like Weather, the big figure lifts away as the modules rise, and a compact title takes its place.
  function onPageScroll(p, i) {
    const st = p.scroller.scrollTop;
    const k = Math.min(1, st / (H * 0.32));
    if (!reduced) p.hero.style.transform = `translate3d(0,${(st * 0.45).toFixed(1)}px,0)`;
    p.hero.style.opacity = (1 - k).toFixed(3);
    if (i === current) bar.classList.toggle("solid", st > H * 0.3);
  }
  function measure() {
    W = track.clientWidth;
    H = track.clientHeight;
  }
  function onTrackScroll() {
    // The current page is tracked on every scroll event; the visual drift waits for a frame.
    if (W) {
      const idx = Math.max(0, Math.min(pages.length - 1, Math.round(track.scrollLeft / W)));
      if (idx !== current) setCurrent(idx);
    }
    if (!raf) raf = requestAnimationFrame(parallax);
  }
  function parallax() {
    raf = 0;
    if (!W || reduced) return;
    const x = track.scrollLeft / W;
    pages.forEach((p, i) => {
      const d = i - x;
      if (Math.abs(d) > 1.1) {
        if (p.moved) {
          p.deck.style.transform = "";
          p.hero.style.translate = "";
          p.moved = false;
        }
        return;
      }
      p.moved = true;
      p.hero.style.translate = `${(d * W * 0.18).toFixed(1)}px 0`;
      p.deck.style.transform = `translate3d(${(d * W * 0.06).toFixed(1)}px,0,0)`;
    });
  }
  function setCurrent(i) {
    current = i;
    S.pages = S.pages || {};
    S.pages[S.role] = i;
    [...dotsEl.children].forEach((b, k) => {
      b.classList.toggle("on", k === i);
      b.setAttribute("aria-current", k === i ? "page" : "false");
    });
    const p = pages[i];
    if (p) {
      bar.classList.toggle("solid", p.scroller.scrollTop > H * 0.3);
      pages.forEach((q, k) => q.el.setAttribute("aria-hidden", k === i ? "false" : "true"));
      const vars = Art.skyVars(skyOf(p.def));
      dock.setAttribute("style", vars);
      bar.setAttribute("style", vars);
    }
    updateBar();
    updateFab();
    if (window.LineHook) window.LineHook(S, pages, ui, current);
    renderAside();
    updateStageBg();
    D.save(S);
  }
  function goTo(i, smooth) {
    i = Math.max(0, Math.min(pages.length - 1, i));
    measure();
    track.scrollTo({ left: i * W, behavior: "auto" });
    if (true) {
      parallax();
      setCurrent(i);
    }
  }
  // The dock's left button is the page's one action, so pages don't need floating buttons.
  function updateFab() {
    const p = pages[current];
    let f = p && p.def.fab;
    if (f === "cart") {
      const n = S.cart.reduce((s, l) => s + l.qty, 0);
      f = n ? { label: `Cart, ${n} items`, icon: "bag", act: "open", arg: "cart:" } : null;
    }
    if (!f) {
      dockAct.hidden = true;
      return;
    }
    dockAct.hidden = false;
    dockAct.innerHTML = V.icon(f.icon);
    dockAct.setAttribute("aria-label", f.label);
    dockAct.title = f.label;
    dockAct.dataset.act = f.act;
    dockAct.dataset.arg = f.arg;
  }
  function updateChrome() {
    who.innerHTML = S.role ? V.av(role().persona) : "";
    who.setAttribute("aria-label", S.role ? `${role().label}: ${V.person(role().persona).name}. Account and role` : "Account");
    updateFab();
    renderAside();
  }
  function updateStageBg() {
    if (S.role && pages[current]) stageBg.setAttribute("style", Art.skyVars(skyOf(pages[current].def)));
  }
  function renderAside() {
    if (innerWidth < 820) return;
    const roles = Views.roles;
    const r = S.role && roles[S.role];
    aside.innerHTML = `<div class="aside-mark">tattoi</div><p class="aside-sub">A swipe-first prototype. Each page is a calm sky with one number that matters; swipe across for the next page and scroll up for the detail.</p>
      <div class="aside-roles" role="group" aria-label="View as">${Object.entries(roles).map(([k, x]) => `<button type="button" aria-pressed="${S.role === k}" data-act="role" data-arg="${k}">${x.label}</button>`).join("")}</div>
      ${r ? `<nav class="aside-pages" aria-label="Pages">${r.pages.map((p, i) => `<button type="button" data-act="goPage" data-arg="${p.key}" aria-current="${i === current}">${V.esc(p.title)}</button>`).join("")}</nav>` : ""}
      <div class="aside-hint"><span>Swipe, drag or press <kbd>←</kbd> <kbd>→</kbd></span><span>Scroll a page to lift its cards</span><span>Switch roles to see a request, payment or message arrive on the other side</span></div>
      <button class="aside-reset" data-act="confirmReset">Reset sample data</button>`;
  }

  // ── Mouse drag between pages (touch and trackpads scroll natively) ──
  let drag = null, suppressClick = false;
  track.addEventListener("pointerdown", (e) => {
    return; // Tabs, not swipes: pages change from the tab bar.
    if (e.target.closest("input, textarea, select, label, .hscroll, .hours, .map")) return;
    drag = { x0: e.clientX, y0: e.clientY, left0: track.scrollLeft, t0: performance.now(), moved: false };
  });
  window.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x0;
    if (!drag.moved && Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(e.clientY - drag.y0)) {
      drag.moved = true;
      track.classList.add("dragging");
    }
    if (drag.moved) track.scrollLeft = drag.left0 - dx;
  });
  window.addEventListener("pointerup", (e) => {
    if (!drag) return;
    const d = drag;
    drag = null;
    if (!d.moved) return;
    suppressClick = true;
    setTimeout(() => (suppressClick = false), 60);
    const dx = e.clientX - d.x0;
    const v = dx / Math.max(1, performance.now() - d.t0);
    let target = Math.round(track.scrollLeft / W);
    if (Math.abs(v) > 0.35) target = Math.round(d.left0 / W) + (dx < 0 ? 1 : -1);
    target = Math.max(0, Math.min(pages.length - 1, target));
    track.scrollTo({ left: target * W, behavior: reduced ? "auto" : "smooth" });
    setTimeout(() => track.classList.remove("dragging"), 480);
  });
  track.addEventListener("scroll", onTrackScroll, { passive: true });

  // ── Sheets ────────────────────────────────────────────────
  function open(spec) {
    const k = spec.indexOf(":");
    const name = k < 0 ? spec : spec.slice(0, k), arg = k < 0 ? "" : spec.slice(k + 1);
    const def0 = Sheets[name];
    if (!def0) return toast("That isn't in the prototype yet.");
    if (def0.init) def0.init(arg);
    draft.confirm = "";
    const el = document.createElement("section");
    el.className = "sheet";
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-modal", "true");
    el.setAttribute("style", Art.skyVars(currentSky()));
    el.innerHTML = `<div class="sheet-top"><span class="grab" aria-hidden="true"></span><button class="close" type="button" data-act="closeTop" aria-label="Close">${V.icon("chevD")}</button><span class="st-title"></span><span></span></div><div class="sheet-scroll"><div class="sheet-head"></div><div class="sheet-body"></div></div><div class="sheet-foot"></div>`;
    sheetsEl.appendChild(el);
    // Mosaic: a section zooms open from the tile that was tapped.
    const z = window.__zoomFrom;
    window.__zoomFrom = null;
    if (z && !reduced) {
      const ar = $("#app").getBoundingClientRect();
      el.classList.add("zoom");
      el.style.transformOrigin = "0 0";
      el.style.transform = `translate(${z.left - ar.left}px,${z.top - ar.top}px) scale(${z.width / ar.width},${z.height / ar.height})`;
    } else if (z) el.classList.add("zoom");
    const entry = { name, arg, el };
    if (stack.length) stack[stack.length - 1].el.classList.add("under");
    stack.push(entry);
    renderSheet(entry, true);
    const sc = $(".sheet-scroll", el), top = $(".sheet-top", el);
    sc.addEventListener("scroll", () => top.classList.toggle("solid", sc.scrollTop > 36), { passive: true });
    sheetDrag(entry);
    scrim.classList.add("on");
    el.getBoundingClientRect();
    el.classList.add("in");
    if (z) requestAnimationFrame(() => (el.style.transform = ""));
    setTimeout(() => $(".sheet-top .close", el).focus({ preventScroll: true }), 60);
  }
  function renderSheet(entry, first) {
    const def = Sheets[entry.name](entry.arg, S, ui, draft);
    entry.def = def;
    const el = entry.el;
    el.classList.toggle("chat", !!def.chat);
    el.setAttribute("aria-label", def.title);
    $(".st-title", el).textContent = def.title;
    const sc = $(".sheet-scroll", el);
    const prevTop = sc.scrollTop;
    const atBottom = sc.scrollHeight - sc.scrollTop - sc.clientHeight < 90;
    $(".sheet-head", el).innerHTML = `${def.lead ? `<div style="margin-bottom:8px">${def.lead}</div>` : ""}<h1>${V.esc(def.title)}</h1>${def.sub ? `<p>${def.sub}</p>` : ""}`;
    const body = $(".sheet-body", el);
    body.innerHTML = def.body || "";
    body.style.padding = def.chat ? "0" : "";
    const foot = $(".sheet-foot", el);
    foot.innerHTML = def.foot || "";
    foot.hidden = !def.foot;
    foot.style.cssText = def.footBare ? "padding:0" : "";
    if (def.chat && (first || atBottom)) requestAnimationFrame(() => (sc.scrollTop = sc.scrollHeight));
    else sc.scrollTop = prevTop;
    if (def.chat) markRead(entry.arg);
    if (def.mount) def.mount(el);
  }
  function closeTop(instant) {
    const e = stack.pop();
    if (!e) return;
    if (e.name === "checkout" || e.name === "cart") draft.pay = null;
    e.el.classList.remove("in");
    const prev = stack[stack.length - 1];
    if (prev) prev.el.classList.remove("under");
    else scrim.classList.remove("on");
    if (instant || reduced) e.el.remove();
    else setTimeout(() => e.el.remove(), 480);
    draft.confirm = "";
    if (prev) renderSheet(prev);
  }
  function sheetDrag(entry) {
    const top = $(".sheet-top", entry.el);
    let y0 = null, dy = 0;
    top.addEventListener("pointerdown", (e) => {
      if (e.target.closest("button")) return;
      y0 = e.clientY;
      dy = 0;
      entry.el.classList.add("dragging");
      top.setPointerCapture(e.pointerId);
    });
    top.addEventListener("pointermove", (e) => {
      if (y0 == null) return;
      dy = Math.max(0, e.clientY - y0);
      entry.el.style.transform = `translateY(${dy}px)`;
    });
    const end = () => {
      if (y0 == null) return;
      y0 = null;
      entry.el.classList.remove("dragging");
      entry.el.style.transform = "";
      if (dy > 110 && stack[stack.length - 1] === entry) closeTop();
    };
    top.addEventListener("pointerup", end);
    top.addEventListener("pointercancel", end);
  }

  // ── Refresh ───────────────────────────────────────────────
  function refresh() {
    D.buildTasks(S);
    const ae = document.activeElement;
    const path = ae && ae.dataset && ae.dataset.bind;
    const sel = path && "selectionStart" in ae ? [ae.selectionStart, ae.selectionEnd] : null;
    const inSheet = ae && ae.closest && ae.closest(".sheet");
    renderPages();
    stack.forEach((e) => renderSheet(e));
    updateChrome();
    if (path) {
      const scope = inSheet && stack.length ? stack[stack.length - 1].el : pages[current] && pages[current].el;
      const el = scope && scope.querySelector(`[data-bind="${CSS.escape(path)}"]`);
      if (el) {
        el.focus({ preventScroll: true });
        try {
          if (sel && el.setSelectionRange) el.setSelectionRange(sel[0], sel[1]);
        } catch (e) {}
      }
    }
    D.save(S);
  }
  App.refresh = refresh;
  Object.defineProperty(App, "S", { get: () => S });
  Object.defineProperty(App, "draft", { get: () => draft });

  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add("on");
    clearTimeout(toast.t);
    toast.t = setTimeout(() => toastEl.classList.remove("on"), 2600);
  }

  // ── Paths & binding ───────────────────────────────────────
  function resolve(path) {
    const parts = path.split(".");
    let rootObj = S;
    if (parts[0] === "draft") rootObj = draft;
    else if (parts[0] === "ui") rootObj = ui;
    else if (parts[0] === "S") rootObj = S;
    else parts.unshift("S");
    let o = rootObj;
    for (let i = 1; i < parts.length - 1; i++) {
      if (o[parts[i]] == null || typeof o[parts[i]] !== "object") o[parts[i]] = {};
      o = o[parts[i]];
    }
    return [o, parts[parts.length - 1]];
  }
  function setPath(path, value) {
    const [o, k] = resolve(path);
    o[k] = value;
  }
  function getPath(path) {
    const [o, k] = resolve(path);
    return o[k];
  }
  function convert(el, raw) {
    const t = el.dataset.type;
    if (t === "cents") return Math.max(0, Math.round(parseFloat(String(raw).replace(/[^0-9.]/g, "")) * 100) || 0);
    if (t === "int") return parseInt(raw, 10) || 0;
    return raw;
  }

  // ── Domain helpers ────────────────────────────────────────
  const now = () => Date.now();
  function msg(c, from, type, extra) {
    const m = Object.assign({ id: D.uid("m"), from, type, text: "", at: now() }, extra || {});
    c.msgs.push(m);
    const to = c.a === from ? c.b : c.a;
    if (from !== "system") c.unread[to] = (c.unread[to] || 0) + 1;
    else {
      c.unread[c.a] = (c.unread[c.a] || 0) + (App.me() === c.a ? 0 : 1);
      c.unread[c.b] = (c.unread[c.b] || 0) + (App.me() === c.b ? 0 : 1);
    }
    return m;
  }
  function convo(a, b, projectId) {
    let c = S.convos.find((x) => (x.a === a && x.b === b) || (x.a === b && x.b === a));
    if (!c) {
      c = { id: D.uid("cv"), a, b, unread: {}, note: "", msgs: [], projectId: projectId || null };
      S.convos.push(c);
    }
    if (projectId && !c.projectId) c.projectId = projectId;
    return c;
  }
  // Conversations keep the artist (or buyer) as "a" and the client (or supplier) as "b".
  function convoWith(personId) {
    const me = App.me();
    const p = V.person(personId);
    if (S.role === "client") return convo(personId, me);
    if (S.role === "supplier") return convo(personId, me);
    if (p.role === "supplier") return convo(me, personId);
    return convo(me, personId);
  }
  function markRead(cid) {
    const c = S.convos.find((x) => x.id === cid);
    const me = App.me();
    if (!c || !c.unread[me]) return;
    c.unread[me] = 0;
    c.msgs.forEach((m) => m.from !== me && (m.read = true));
    setTimeout(() => {
      renderPages();
      D.save(S);
    }, 0);
  }
  function openChat(cid) {
    const idx = stack.findIndex((e) => e.name === "chat" && e.arg === cid);
    if (idx >= 0) {
      while (stack.length > idx + 1) closeTop(true);
      renderSheet(stack[idx]);
      return;
    }
    open("chat:" + cid);
  }
  function iso(t) {
    const d = new Date(t);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  function code(prefix) {
    const a = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
    let s = "";
    for (let i = 0; i < 4; i++) s += a[Math.floor(Math.random() * a.length)];
    return prefix + "-" + s;
  }
  function closeNamed(name) {
    const i = stack.map((e) => e.name).lastIndexOf(name);
    if (i >= 0) while (stack.length > i) closeTop(true);
  }

  // Booking composer
  App.compInit = (arg) => {
    const pre = Object.fromEntries((arg || "").split("&").filter(Boolean).map((kv) => kv.split("=")));
    const lead = pre.lead && S.leads.find((l) => l.id === pre.lead);
    let svc = S.services[1];
    if (lead) svc = /sleeve|back|chest/i.test(lead.project) ? S.services[2] : /small/i.test(lead.project) ? S.services[3] : S.services[0];
    const clientId = pre.client || (lead && lead.clientId) || "";
    draft.comp = {
      step: clientId ? 1 : 0, dir: 1, q: "", clientId,
      name: lead ? `${lead.styles[0]} ${lead.project.toLowerCase()}` : "",
      serviceId: svc.id, sittings: lead && /half sleeve/i.test(lead.project) ? 3 : svc.sittings, mins: svc.mins, price: svc.price,
      from: iso(pre.date ? Number(pre.date) : now() + D.DAY), freq: "weekly", dates: [], searched: false, issuedId: "", leadId: lead ? lead.id : "",
    };
  };
  function compFind() {
    const d = draft.comp;
    const from = new Date(d.from + "T00:00").getTime();
    let freq = "consecutive";
    if (d.sittings > 1) {
      const feas = D.feasibleFrequencies(S, from, d.sittings, d.mins);
      freq = feas.includes(d.freq) ? d.freq : feas[0] || "weekly";
      d.freq = freq;
    }
    d.dates = D.suggestDates(S, from, freq, d.sittings, d.mins);
    d.searched = true;
  }

  // Intake
  App.intakeInit = (artistId) => {
    const me = S.people.c1;
    draft.intake = { artistId, step: 0, dir: 1, type: "", styles: [], idea: "", placement: "", size: "", timeframe: "", budget: "", refs: draft.intakeRef ? [draft.intakeRef] : [], photo: null, name: me.name, email: me.email, phone: me.phone, done: false };
    draft.intakeRef = null;
  };

  // Offers
  App.offerInit = (mode) => {
    const cal = mode === "calendar";
    draft.offer = { step: cal ? 1 : 0, dir: 1, kind: "discount", valueType: "percentage", value: cal ? "15" : "", funding: "gift", name: cal ? "Open day offer" : "", description: "", eligibility: "new", expiry: "none", expiresOn: "", hours: cal ? 48 : "", years: 3, months: [], colour: "stencil" };
  };
  App.offerFromDraft = () => {
    const d = draft.offer;
    const valueType = d.kind === "voucher" ? "fixed" : d.valueType;
    const v = Number(d.value) || 0;
    return { id: "preview", name: d.name || "Untitled offer", description: d.description, kind: d.kind, funding: d.kind === "voucher" ? d.funding : "gift", valueType, value: valueType === "percentage" ? v : Math.round(v * 100), eligibility: d.eligibility, availableHours: d.kind === "discount" && d.hours ? Number(d.hours) : null, expiresAt: d.expiry === "date" && d.expiresOn ? new Date(d.expiresOn + "T23:59").getTime() : null, validityYears: Number(d.years) || 3, sittingMonths: d.months.slice(), colour: d.colour, archived: false, created: now() };
  };
  function issue(offer, clientId, from) {
    const prefix = offer.kind === "voucher" ? (from === "purchase" ? "GIFT" : "CREDIT") : offer.availableHours ? "FLASH" : "OFFER";
    const i = { id: D.uid("i"), offerId: offer.id, clientId, code: code(prefix), remaining: offer.kind === "voucher" ? offer.value : null, status: "active", at: now(), from: from || "artist" };
    S.issued.push(i);
    return i;
  }

  // Checkout quotes follow shared/fees.ts: clients pay 3.4% processing, minimum $5.
  App.quote = (arg) => {
    const [kind, ref] = arg.split("|");
    let base = 0, title = "", sub = "", lines = [], label = "Amount", doneText = "", creditable = false, feeOn = true, artistId = "a1";
    if (kind === "deposit") {
      const ss = D.projectSittings(S, ref).filter((s) => s.status === "proposed");
      if (!ss.length) return null;
      artistId = ss[0].artistId;
      base = ss.reduce((s, a) => s + a.deposit, 0);
      const total = ss.reduce((s, a) => s + a.price, 0);
      title = "Secure your booking";
      sub = `${V.project(ref).name} with ${V.person(artistId).name}`;
      lines = [["Project estimate", D.money(total)], [`Sittings`, String(ss.length)]];
      label = "Deposit";
      creditable = true;
      doneText = "Deposit paid. Your sessions are confirmed.";
    } else if (kind === "balance") {
      const a = S.appts.find((x) => x.id === ref);
      if (!a || a.price - a.paid <= 0) return null;
      artistId = a.artistId;
      base = a.price - a.paid;
      title = "Your session balance";
      sub = `${V.project(a.projectId).name}, ${D.sittingLabel(a).toLowerCase()}, ${D.fmtDate(a.start)}`;
      lines = [["Sitting price", D.money(a.price)], ["Already paid", D.money(-a.paid)]];
      label = "Balance";
      creditable = true;
      doneText = "Balance paid. You're all set for the day.";
    } else if (kind === "payreq") {
      let m = null;
      S.convos.forEach((c) => c.msgs.forEach((x) => x.id === ref && (m = x)));
      if (!m || m.status !== "open") return null;
      const a = S.appts.find((x) => x.id === m.apptId);
      artistId = a.artistId;
      base = m.amount;
      title = "Review your payment";
      sub = `${V.project(a.projectId).name}, requested by ${V.person(a.artistId).name}`;
      label = "Payment request";
      creditable = true;
      doneText = "Payment received.";
    } else if (kind === "gift") {
      base = Number((draft.gift || {}).amount) || 0;
      if (!base) return null;
      title = "Buy gift voucher";
      sub = `For ${(draft.gift || {}).to || "you"}, to spend with ${V.person(ref).name}`;
      label = "Gift voucher";
      doneText = "Your voucher is in your profile under Promotions.";
    } else if (kind === "plan") {
      const t = D.TIERS[ref];
      title = ref === "free" ? "Switch to Free" : `Choose ${t.label}`;
      sub = ref === "free" ? "You'll return to Free straight away in this prototype." : "Billed monthly. Cancel renewal any time in billing.";
      base = t.priceCents;
      feeOn = false;
      label = ref === "free" ? "Free" : `${t.label}, first month`;
      lines = [["Tattoi artist fee", ref === "free" ? "2%" : "0%"]];
      doneText = `You're on ${t.label}.`;
    }
    let credit = 0, creditNote = "", creditLabel = "";
    const ci = creditable && draft.credit && S.issued.find((i) => i.id === draft.credit && i.status === "active");
    if (ci) {
      const o = S.offers.find((x) => x.id === ci.offerId);
      creditLabel = o.kind === "voucher" ? "Voucher credit" : "Promotion discount";
      if (o.eligibility === "new" && kind !== "deposit") creditNote = "Available for new bookings made after this offer was issued.";
      else if (o.expiresAt && o.expiresAt <= now()) creditNote = "This offer has expired.";
      else if (artistId !== "a1") creditNote = `This offer is from ${V.person("a1").name}.`;
      else credit = o.kind === "voucher" ? Math.min(ci.remaining || 0, base) : o.valueType === "percentage" ? Math.round((base * o.value) / 100) : Math.min(o.value, base);
    }
    const charge = Math.max(0, base - credit);
    const fee = feeOn && charge > 0 ? D.fees(charge, S.settings.tier).platform : 0;
    return { title, sub, lines, label, charge, fee, credit, creditLabel, creditNote, creditable, doneText, base, issued: credit ? ci : null };
  };
  function settle(arg, q) {
    const [kind, ref] = arg.split("|");
    if (q.issued) {
      const i = q.issued;
      const o = S.offers.find((x) => x.id === i.offerId);
      if (o.kind === "voucher") {
        i.remaining -= q.credit;
        if (i.remaining <= 0) i.status = "used";
      } else i.status = "used";
    }
    const tier = S.settings.tier;
    if (kind === "deposit") {
      const ss = D.projectSittings(S, ref).filter((s) => s.status === "proposed");
      const artistId = ss[0].artistId;
      ss.forEach((a) => {
        a.status = "confirmed";
        a.paid += a.deposit;
        a.forms = "pending";
        ["Procedure consent", "Medical history"].forEach((kindF) => S.forms.push({ id: D.uid("f"), apptId: a.id, clientId: a.clientId, artistId, kind: kindF, status: "pending" }));
      });
      S.txns.push({ id: D.uid("tx"), artistId, clientId: ss[0].clientId, kind: "Deposit", base: q.base, at: now(), status: "paid", tier });
      const c = convo(artistId, ss[0].clientId, ref);
      c.msgs.forEach((m) => m.type === "proposal" && m.proposal.projectId === ref && (m.proposal.status = "accepted"));
      msg(c, "system", "system", { text: `Deposit paid, ${D.money(q.base)}. ${ss.length === 1 ? "Your sitting is" : `Your ${ss.length} sittings are`} confirmed.` });
      S.leads.forEach((l) => l.clientId === ss[0].clientId && l.status === "proposal" && (l.status = "converted"));
    } else if (kind === "balance" || kind === "payreq") {
      let a, amount;
      if (kind === "balance") {
        a = S.appts.find((x) => x.id === ref);
        amount = a.price - a.paid;
      } else {
        S.convos.forEach((c) => c.msgs.forEach((m) => {
          if (m.id === ref) {
            m.status = "paid";
            a = S.appts.find((x) => x.id === m.apptId);
            amount = m.amount;
          }
        }));
      }
      a.paid = Math.min(a.price, a.paid + amount);
      S.convos.forEach((c) => c.msgs.forEach((m) => m.type === "payreq" && m.apptId === a.id && m.status === "open" && a.paid >= a.price && (m.status = "paid")));
      S.txns.push({ id: D.uid("tx"), artistId: a.artistId, clientId: a.clientId, kind: "Balance", base: amount, at: now(), status: "paid", tier });
      msg(convo(a.artistId, a.clientId), "system", "system", { text: `Balance paid, ${D.money(amount)}. ${a.paid >= a.price ? "This sitting is paid in full." : ""}` });
    } else if (kind === "gift") {
      const o = S.offers.find((x) => x.kind === "voucher" && x.funding === "sale" && !x.archived);
      const i = issue(Object.assign({}, o, { value: q.base }), "c1", "purchase");
      i.remaining = q.base;
      if (draft.gift.to) i.note = "For " + draft.gift.to;
      S.purchases.push({ id: D.uid("pu"), kind: "Gift voucher", name: `Gift voucher for ${V.person(ref).name}${draft.gift.to ? ", for " + draft.gift.to : ""}`, amount: q.charge + q.fee, at: now(), status: "Paid" });
      S.txns.push({ id: D.uid("tx"), artistId: ref, clientId: "c1", kind: "Gift voucher", base: q.base, at: now(), status: "paid", tier, note: draft.gift.to ? "Bought for " + draft.gift.to : "" });
      draft.gift = {};
    } else if (kind === "plan") {
      S.settings.tier = ref;
      if (ref === "free") {
        S.settings.depositPct = 25;
        S.settings.allowUpfront = false;
      }
    }
  }

  // Signature pad
  App.mountSig = (el, apptId) => {
    const cv = el.querySelector("canvas[data-sig]");
    if (!cv) return;
    const d = (draft.sign[apptId] = draft.sign[apptId] || { answers: {}, strokes: [] });
    d.strokes = d.strokes || [];
    const r = cv.getBoundingClientRect();
    const dpr = Math.min(devicePixelRatio || 1, 2);
    cv.width = r.width * dpr;
    cv.height = r.height * dpr;
    const c = cv.getContext("2d");
    c.scale(dpr, dpr);
    c.lineWidth = 2.2;
    c.lineCap = c.lineJoin = "round";
    c.strokeStyle = getComputedStyle(root).getPropertyValue("--ink").trim() || "#231d18";
    const draw = (s) => {
      c.beginPath();
      s.forEach(([x, y], i) => (i ? c.lineTo(x * r.width, y * r.height) : c.moveTo(x * r.width, y * r.height)));
      c.stroke();
    };
    d.strokes.forEach(draw);
    let cur = null;
    const pt = (e) => {
      const b = cv.getBoundingClientRect();
      return [(e.clientX - b.left) / b.width, (e.clientY - b.top) / b.height];
    };
    cv.onpointerdown = (e) => {
      cur = [pt(e)];
      cv.setPointerCapture(e.pointerId);
    };
    cv.onpointermove = (e) => {
      if (!cur) return;
      cur.push(pt(e));
      draw(cur.slice(-2));
    };
    cv.onpointerup = () => {
      if (!cur) return;
      if (cur.length > 2) {
        d.strokes.push(cur);
        d.drawn = true;
      }
      cur = null;
      refresh();
    };
  };

  // Downscale uploaded photos so they fit comfortably in browser storage.
  function readImage(file) {
    return new Promise((res) => {
      const fr = new FileReader();
      fr.onload = () => {
        const im = new Image();
        im.onload = () => {
          const k = Math.min(1, 720 / Math.max(im.width, im.height));
          const cv = document.createElement("canvas");
          cv.width = Math.round(im.width * k);
          cv.height = Math.round(im.height * k);
          cv.getContext("2d").drawImage(im, 0, 0, cv.width, cv.height);
          res(cv.toDataURL("image/jpeg", 0.78));
        };
        im.onerror = () => res(null);
        im.src = fr.result;
      };
      fr.onerror = () => res(null);
      fr.readAsDataURL(file);
    });
  }

  // ── Actions ───────────────────────────────────────────────
  const A = {
    open: (arg) => open(arg),
    closeTop: () => closeTop(),
    go: (arg) => goTo(Number(arg)),
    goPage(key) {
      while (stack.length) closeTop(true);
      const i = pages.findIndex((p) => p.def.key === key);
      if (i >= 0) goTo(i);
    },
    role(r) {
      enterRole(r);
      toast(`Viewing as ${V.person(Views.roles[r].persona).name}`);
    },
    account: () => open("account:"),
    signOut() {
      while (stack.length) closeTop(true);
      S.role = null;
      D.save(S);
      renderGate();
    },
    confirm(arg) {
      draft.confirm = arg;
      refresh();
    },
    confirmReset() {
      if (!S.role) return A.resetData();
      open("account:");
      draft.confirm = "reset";
      refresh();
    },
    resetData() {
      const r = S.role;
      while (stack.length) closeTop(true);
      S = D.reset();
      Object.keys(draft).forEach((k) => typeof draft[k] === "object" && draft[k] && !Array.isArray(draft[k]) ? (draft[k] = {}) : (draft[k] = null));
      r ? enterRole(r) : renderGate();
      toast("Sample data reset");
    },
    set(_, el) {
      let v = el.dataset.v;
      if (el.dataset.num || /^-?\d+$/.test(v)) v = v === "" ? "" : Number(v);
      setPath(el.dataset.path, v);
      refresh();
    },
    toggleUi(k) {
      ui[k] = !ui[k];
      refresh();
    },
    toggle(path) {
      setPath(path, !getPath(path));
      if (path.startsWith("hours.")) S.artist.setup.hours = true;
      refresh();
    },
    toggleIn(arg) {
      const [path, v] = arg.split("|");
      const p = /^(draft|S|ui)\./.test(path) ? path : "draft." + path.replace(/^draft\./, "");
      const list = getPath(p) || [];
      const i = list.indexOf(v);
      i >= 0 ? list.splice(i, 1) : list.push(v);
      setPath(p, list);
      refresh();
    },
    copy(text) {
      const done = () => toast("Copied");
      try {
        navigator.clipboard.writeText(text).then(done, () => toast(text));
      } catch (e) {
        toast(text);
      }
    },
    calWeek(arg) {
      const n = Number(arg);
      ui.calWeek = n === 0 ? 0 : (ui.calWeek || 0) + n;
      refresh();
    },

    // Messaging
    chat: (cid) => openChat(cid),
    chatWith(pid) {
      const c = convoWith(pid);
      openChat(c.id);
      refresh();
    },
    send(cid) {
      const t = ((draft.msg || {})[cid] || "").trim();
      if (!t) return;
      const c = S.convos.find((x) => x.id === cid);
      msg(c, App.me(), "text", { text: t });
      draft.msg[cid] = "";
      refresh();
      const e = stack[stack.length - 1];
      if (e) requestAnimationFrame(() => ($(".sheet-scroll", e.el).scrollTop = 1e9));
    },
    useTemplate(arg) {
      const [cid, tid] = arg.split("|");
      const c = S.convos.find((x) => x.id === cid);
      const t = S.settings.templates.find((x) => x.id === tid);
      const other = c.a === App.me() ? c.b : c.a;
      draft.msg[cid] = t.body.replace(/\{name\}/g, V.first(other));
      closeTop(true);
      refresh();
    },
    sendTemplate(arg) {
      const [clientId, tid] = arg.split("|");
      const t = S.settings.templates.find((x) => x.id === tid);
      const c = convoWith(clientId);
      msg(c, App.me(), "text", { text: t.body.replace(/\{name\}/g, V.first(clientId)) });
      closeTop(true);
      refresh();
      toast(`Reminder sent to ${V.first(clientId)}`);
    },
    saveNote(cid) {
      const c = S.convos.find((x) => x.id === cid);
      if (draft.note[cid] != null) c.note = draft.note[cid];
      delete draft.note[cid];
      if (stack.length && stack[stack.length - 1].name === "notes") closeTop(true);
      refresh();
      toast("Note saved");
    },

    // Sessions (SessionActions.tsx)
    arrived(id) {
      const a = S.appts.find((x) => x.id === id);
      a.arrived = now();
      refresh();
      toast(`${V.first(a.clientId)} is in the chair`);
    },
    finish(id) {
      const a = S.appts.find((x) => x.id === id);
      if (now() < a.start) return toast("This action is available once the confirmed session starts.");
      a.status = "completed";
      a.finishedAt = now();
      const c = convo(a.artistId, a.clientId, a.projectId);
      msg(c, "system", "system", { text: "Session finished. Your aftercare guide is ready in your booking." });
      if (a.price > a.paid) A.requestBalance(id, true);
      refresh();
      toast(a.price > a.paid ? "Session complete. Balance request sent." : "Session complete");
    },
    noShow(id) {
      const a = S.appts.find((x) => x.id === id);
      if (now() < a.start) return toast("This action is available once the confirmed session starts.");
      a.status = "no-show";
      draft.confirm = "";
      refresh();
      toast("Recorded as a no-show");
    },
    cancelSitting(id) {
      const a = S.appts.find((x) => x.id === id);
      a.status = "cancelled";
      draft.confirm = "";
      msg(convo(a.artistId, a.clientId, a.projectId), "system", "system", { text: `${D.sittingLabel(a)} on ${D.fmtDate(a.start)} was cancelled.` });
      refresh();
      toast("Session cancelled");
    },
    requestBalance(id, quiet) {
      const a = S.appts.find((x) => x.id === id);
      const amount = a.price - a.paid;
      if (amount <= 0) return;
      const c = convo(a.artistId, a.clientId, a.projectId);
      if (c.msgs.some((m) => m.type === "payreq" && m.apptId === id && m.status === "open")) return quiet ? null : toast("A balance request is already open");
      msg(c, a.artistId, "payreq", { apptId: id, amount, status: "open" });
      if (quiet !== true) {
        refresh();
        toast("Final balance request sent!");
      }
    },
    rescheduleSend(id) {
      const a = S.appts.find((x) => x.id === id);
      const to = Number(draft.res[id]);
      if (!to || to <= now()) return toast("Choose a valid future time.");
      if (D.sameDay(to, a.start) && to === a.start) return toast("Choose a different date or time to reschedule.");
      const c = convo(a.artistId, a.clientId, a.projectId);
      const m = msg(c, a.artistId, "reschedule", { apptId: id, from: a.start, to, status: "pending" });
      a.reschedule = { to, status: "pending", msgId: m.id };
      ui.resOpen = "";
      refresh();
      toast("Sent for client approval");
    },
    rescheduleAnswer(arg) {
      const [mid, yes] = arg.split("|");
      S.convos.forEach((c) => c.msgs.forEach((m) => {
        if (m.id !== mid) return;
        const a = S.appts.find((x) => x.id === m.apptId);
        m.status = yes === "yes" ? "accepted" : "declined";
        a.reschedule = Object.assign({}, a.reschedule, { status: m.status });
        if (yes === "yes") a.start = m.to;
        msg(c, "system", "system", { text: yes === "yes" ? `New time confirmed: ${D.fmtDate(m.to)}, ${D.fmtTime(m.to)}.` : "The original time was kept." });
      }));
      refresh();
      toast(yes === "yes" ? "New time confirmed" : "Original time kept");
    },
    withdraw(pid) {
      D.projectSittings(S, pid).forEach((a) => a.status === "proposed" && (a.status = "cancelled"));
      V.project(pid).withdrawn = true;
      const a = S.appts.find((x) => x.projectId === pid);
      msg(convo(a.artistId, a.clientId, pid), "system", "system", { text: "The booking proposal was withdrawn." });
      refresh();
      toast("Proposal withdrawn");
    },
    declineProposal(pid) {
      D.projectSittings(S, pid).forEach((a) => a.status === "proposed" && (a.status = "cancelled"));
      const a = S.appts.find((x) => x.projectId === pid);
      msg(convo(a.artistId, a.clientId, pid), "system", "system", { text: `${V.first(a.clientId)} declined the booking proposal.` });
      closeNamed("proposal");
      refresh();
      toast("Proposal declined");
    },

    // Booking composer
    compService(id) {
      const s = S.services.find((x) => x.id === id);
      Object.assign(draft.comp, { serviceId: id, mins: s.mins, price: s.price, sittings: s.sittings, dates: [], searched: false });
      if (!draft.comp.name) draft.comp.name = s.name;
      refresh();
    },
    compNum(arg) {
      const [k, d] = arg.split("|");
      const c = draft.comp;
      if (k === "sittings") c.sittings = Math.max(1, Math.min(12, c.sittings + Number(d)));
      else c.mins = Math.max(60, Math.min(600, c.mins + Number(d)));
      c.dates = [];
      c.searched = false;
      refresh();
    },
    compStep(d) {
      const c = draft.comp;
      c.step = Math.max(0, Math.min(3, c.step + Number(d)));
      c.dir = Number(d);
      if (c.step === 2 && !c.dates.length) compFind();
      refresh();
    },
    compFind() {
      compFind();
      refresh();
    },
    compRemove(i) {
      draft.comp.dates.splice(Number(i), 1);
      refresh();
    },
    compSend() {
      const d = draft.comp;
      if (d.dates.some((t) => t <= now())) return toast("New booking proposals need future dates.");
      const lead = d.leadId && S.leads.find((l) => l.id === d.leadId);
      const style = lead ? lead.styles[0] : "Fine line";
      const p = { id: D.uid("p"), artistId: "a1", clientId: d.clientId, name: d.name.trim(), service: d.serviceId, style, placement: lead ? lead.placement : "", motif: Art.STYLE_MOTIF[style] || "botanical", seed: D.uid("seed"), brief: lead ? lead.idea : "", refs: lead ? lead.refs.filter((r) => !String(r).startsWith("data:")) : [], creditId: d.issuedId || null };
      S.projects.push(p);
      const sp = D.split(d.price, d.dates.length, S);
      d.dates.forEach((t, i) => S.appts.push({ id: D.uid("ap"), artistId: "a1", clientId: d.clientId, projectId: p.id, idx: i + 1, total: d.dates.length, start: t, mins: d.mins, price: d.price, deposit: sp.depositPerSitting, paid: 0, status: "proposed", forms: "none", reschedule: null, arrived: false, finishedAt: null }));
      const c = convo("a1", d.clientId, p.id);
      msg(c, "a1", "proposal", { proposal: { projectId: p.id, status: "pending", service: (S.services.find((s) => s.id === d.serviceId) || {}).name, sittings: d.dates.length } });
      if (lead) lead.status = "proposal";
      closeNamed("composer");
      refresh();
      toast(`Proposal sent to ${V.first(d.clientId)}`);
    },

    // Checkout
    pay(arg) {
      const q = App.quote(arg);
      if (!q) return toast("This request changed or checkout is unavailable. Please refresh the details.");
      draft.pay = { key: arg, status: "processing", q };
      refresh();
      setTimeout(() => {
        settle(arg, q);
        draft.pay = { key: arg, status: "done", q };
        draft.credit = "";
        refresh();
        toast(q.doneText);
      }, 1300);
    },
    paySupplies() {
      draft.pay = { key: "supplies", status: "processing" };
      refresh();
      setTimeout(() => {
        const bySup = {};
        S.cart.forEach((l) => (bySup[l.supplierId] = bySup[l.supplierId] || []).push(l));
        Object.entries(bySup).forEach(([sid, lines]) => {
          const subtotal = lines.reduce((s, l) => s + l.price * l.qty, 0);
          const num = Math.max(1040, ...S.supplyOrders.map((o) => o.number)) + 1;
          S.supplyOrders.push({ id: D.uid("so"), number: num, supplierId: sid, buyerId: "a1", buyerName: `${S.artist.name}, ${S.artist.studio}`, items: lines.map((l) => ({ productId: l.productId, variantId: l.variantId, name: l.name, variantName: l.variantName, qty: l.qty, price: l.price })), subtotal, shipping: 1200, total: subtotal + 1200, at: now(), status: "paid" });
          lines.forEach((l) => {
            const v = S.products.find((p) => p.id === l.productId).variants.find((x) => x.id === l.variantId);
            v.stock = Math.max(0, v.stock - l.qty);
          });
        });
        S.cart = [];
        draft.pay = { key: "supplies", status: "done" };
        refresh();
        toast("Sent to supplier");
      }, 1300);
    },

    // Forms
    sigClear(apptId) {
      const d = draft.sign[apptId];
      if (d) {
        d.strokes = [];
        d.drawn = false;
      }
      refresh();
    },
    signForms(apptId) {
      const d = draft.sign[apptId] || {};
      S.forms.filter((f) => f.apptId === apptId && f.status === "pending").forEach((f) => Object.assign(f, { status: "signed", signedAt: now(), answers: Object.assign({}, d.answers) }));
      const a = S.appts.find((x) => x.id === apptId);
      a.forms = "signed";
      msg(convo(a.artistId, a.clientId, a.projectId), "system", "system", { text: `${V.first(a.clientId)} signed the forms for ${D.sittingLabel(a).toLowerCase()}.` });
      refresh();
      toast("Forms signed");
    },

    // Waitlist (server/domain/waitlist.ts)
    waitJoin(pid) {
      const a = S.appts.find((x) => x.projectId === pid);
      S.waitlist.push({ id: D.uid("w"), artistId: a.artistId, clientId: "c1", projectId: pid, joined: now(), status: "waiting", offer: null });
      refresh();
      toast("You're on the waitlist");
    },
    waitLeave(wid) {
      const w = S.waitlist.find((x) => x.id === wid);
      w.status = "left";
      refresh();
      toast("You've left the waitlist");
    },
    waitForm(arg) {
      const [wid, gap] = arg.split("|");
      if (gap === "close") delete draft.wait[wid];
      else {
        const w = S.waitlist.find((x) => x.id === wid);
        const booked = S.appts.find((a) => a.projectId === w.projectId && a.status === "confirmed" && a.start > now());
        const t = Number(gap) || D.at(1, 9, 30);
        draft.wait[wid] = { date: iso(t), time: new Date(t).toTimeString().slice(0, 5), mins: booked ? booked.mins : 240, hours: 48 };
      }
      refresh();
    },
    waitSend(wid) {
      const f = draft.wait[wid];
      const w = S.waitlist.find((x) => x.id === wid);
      const start = new Date(`${f.date}T${f.time || "09:30"}`).getTime();
      if (!(start > now())) return toast("Choose a valid future time.");
      const c = convo(w.artistId, w.clientId, w.projectId);
      const expires = now() + Number(f.hours) * 3600000;
      const m = msg(c, w.artistId, "waitoffer", { waitId: wid, start, mins: Number(f.mins), expires });
      w.status = "offered";
      w.offer = { start, mins: Number(f.mins), expires, msgId: m.id };
      delete draft.wait[wid];
      refresh();
      toast(`Offer sent to ${V.first(w.clientId)}`);
    },
    waitWithdraw(wid) {
      const w = S.waitlist.find((x) => x.id === wid);
      w.status = "waiting";
      w.offer = null;
      refresh();
      toast("Offer withdrawn");
    },
    waitAccept(wid) {
      const w = S.waitlist.find((x) => x.id === wid);
      if (w.status !== "offered" || !w.offer || !(w.offer.expires > now()) || !(w.offer.start > now())) return toast("This offer has expired. Ask your artist about another time.");
      const a = S.appts.filter((x) => x.projectId === w.projectId && x.status === "confirmed" && x.start > now()).sort((x, y) => x.start - y.start)[0];
      const from = a ? a.start : null;
      if (a) {
        a.start = w.offer.start;
        a.mins = w.offer.mins;
      }
      w.status = "accepted";
      msg(convo(w.artistId, w.clientId, w.projectId), "system", "system", { text: `Earlier time accepted. ${from ? `The sitting on ${D.fmtDate(from)} moved to ${D.fmtDate(w.offer.start)}, ${D.fmtTime(w.offer.start)}.` : ""} The deposit moved with it.` });
      refresh();
      toast("Your sitting moved earlier");
    },
    waitDecline(wid) {
      const w = S.waitlist.find((x) => x.id === wid);
      w.status = "waiting";
      w.offer = null;
      refresh();
      toast("Offer declined. You're still on the waitlist.");
    },

    // Tasks, money, leads, clients
    taskDone(key) {
      const t = S.tasks.find((x) => x.key === key);
      if (t) t.done = true;
      closeTop(true);
      refresh();
      toast("Marked done");
    },
    taskSnooze(key) {
      const t = S.tasks.find((x) => x.key === key);
      if (t) t.snoozedUntil = D.at(1, 8);
      closeTop(true);
      refresh();
      toast("Snoozed until tomorrow");
    },
    refund(id) {
      const t = S.txns.find((x) => x.id === id);
      t.status = "refunded";
      t.refundedAt = now();
      S.refunds.push({ id: D.uid("rf"), txnId: id, clientId: t.clientId, amount: t.base, kind: t.kind, at: now() });
      draft.confirm = "";
      refresh();
      toast(`Refunded ${D.money(t.base)}`);
    },
    leadArchive(id) {
      S.leads.find((l) => l.id === id).status = "archived";
      closeTop(true);
      refresh();
      toast("Request archived");
    },
    addClientSave() {
      const d = draft.addClient || {};
      if (!d.name || d.name.trim().length < 2) return toast("Add their full name first.");
      const id = D.uid("c");
      S.people[id] = { id, role: "client", name: d.name.trim(), email: (d.email || "").trim(), phone: (d.phone || "").trim(), city: "", status: "imported" };
      draft.addClient = {};
      closeTop(true);
      refresh();
      toast(`${d.name.trim()} added`);
    },

    // Offers
    offerStep(d) {
      const o = draft.offer;
      o.step = Math.max(0, Math.min(3, o.step + Number(d)));
      o.dir = Number(d);
      refresh();
    },
    offerSave() {
      const o = App.offerFromDraft();
      o.id = D.uid("o");
      S.offers.push(o);
      closeNamed("offerWizard");
      refresh();
      toast("Promotion created");
      open("offer:" + o.id);
    },
    audience(arg) {
      const [id, kind] = arg.split("|");
      const month = new Date().getMonth() + 1;
      const sel = {};
      Object.values(S.people).filter((p) => p.role === "client").forEach((p) => {
        const last = S.appts.filter((a) => a.clientId === p.id && a.artistId === "a1" && a.start < now()).sort((a, b) => b.start - a.start)[0];
        if (kind === "birthday" && p.birthday && Number(p.birthday.slice(5, 7)) === month) sel[p.id] = true;
        if (kind === "inactive" && (!last || now() - last.start > 60 * D.DAY)) sel[p.id] = true;
        if (kind === "spend" && V.lifetimePaid(S, p.id) >= 100000) sel[p.id] = true;
      });
      draft.send[id] = kind === "clear" ? {} : sel;
      refresh();
    },
    audienceOne(arg) {
      const [id, cid] = arg.split("|");
      draft.send[id] = draft.send[id] || {};
      draft.send[id][cid] = !draft.send[id][cid];
      refresh();
    },
    offerSend(id) {
      const o = S.offers.find((x) => x.id === id);
      const ids = Object.keys(draft.send[id] || {}).filter((k) => draft.send[id][k]);
      ids.forEach((cid) => {
        const i = issue(o, cid);
        msg(convo("a1", cid), "a1", "offer", { issuedId: i.id });
      });
      draft.send[id] = {};
      refresh();
      toast(`Offers added to ${V.plural(ids.length, "client")}`);
    },
    offerSendOne(arg) {
      const [oid, cid] = arg.split("|");
      const o = S.offers.find((x) => x.id === oid);
      const i = issue(o, cid);
      const c = convo("a1", cid);
      msg(c, "a1", "offer", { issuedId: i.id });
      closeNamed("offerPick");
      refresh();
      toast(`${o.name} sent to ${V.first(cid)}`);
    },
    offerArchive(id) {
      S.offers.find((x) => x.id === id).archived = true;
      draft.confirm = "";
      refresh();
      toast("Promotion archived");
    },
    giftTransfer(id) {
      const t = draft.transfer || {};
      if (!t.name || !/.+@.+\..+/.test(t.email || "")) return toast("Add their name and a valid email.");
      const i = S.issued.find((x) => x.id === id);
      i.status = "transferred";
      i.giftTo = t.name;
      draft.transfer = {};
      closeTop(true);
      refresh();
      toast(`Gift sent to ${t.name}`);
    },

    // Client
    fav(id) {
      const i = S.favourites.indexOf(id);
      i >= 0 ? S.favourites.splice(i, 1) : S.favourites.push(id);
      refresh();
      toast(i >= 0 ? "Removed from your artists" : "Added to your artists");
    },
    savePiece(arg) {
      const [motif, seed, artistId] = arg.split("|");
      const i = S.saved.findIndex((s) => s.seed === seed);
      i >= 0 ? S.saved.splice(i, 1) : S.saved.push({ motif, seed, artistId });
      refresh();
      toast(i >= 0 ? "Removed from saved pieces" : "Saved to your profile");
    },
    useRef(arg) {
      const [motif, seed, artistId] = arg.split("|");
      draft.intakeRef = { motif, seed };
      open("intake:" + artistId);
    },
    intakeStep(d) {
      const x = draft.intake;
      x.step = Math.max(0, Math.min(5, x.step + Number(d)));
      x.dir = Number(d);
      if (x.step === 2 && !S.artist.link.steps.references && x.artistId === "a1") x.step += Number(d) > 0 ? 1 : -1;
      if (x.step === 3 && !S.artist.link.steps.placementPhoto && x.artistId === "a1") x.step += Number(d) > 0 ? 1 : -1;
      refresh();
    },
    refRemove(i) {
      draft.intake.refs.splice(Number(i), 1);
      refresh();
    },
    refAddSaved(arg) {
      const [motif, seed] = arg.split("|");
      if (draft.intake.refs.length < 6) draft.intake.refs.push({ motif, seed });
      refresh();
    },
    intakeSend() {
      const x = draft.intake;
      const l = { id: D.uid("l"), artistId: x.artistId, clientId: "c1", project: x.type, styles: x.styles.slice(), placement: x.placement, size: x.size, budget: x.budget, timeframe: x.timeframe, idea: x.idea.trim(), refs: x.refs.map((r) => r.src || r.seed), placementPhoto: !!x.photo, created: now(), status: "new" };
      S.leads.push(l);
      const p = S.people.c1;
      p.name = x.name.trim() || p.name;
      p.email = x.email.trim();
      p.phone = (x.phone || "").trim();
      const c = convo(x.artistId, "c1");
      msg(c, "system", "system", { text: `Booking request sent: ${x.type.toLowerCase()}, ${x.placement.toLowerCase()}, ${x.budget}.` });
      x.refs.filter((r) => r.src).forEach((r) => msg(c, "c1", "image", { src: r.src }));
      if (x.artistId === "a1") S.artist.link.requests++;
      x.done = true;
      refresh();
      toast("Request sent");
    },

    // Supplies
    linkSupplier(id) {
      const s = S.suppliers.find((x) => x.id === id);
      s.linked = !s.linked;
      refresh();
      toast(s.linked ? `${s.name} added to your suppliers` : `${s.name} removed`);
    },
    pickQty(d) {
      const pk = draft.pick;
      const p = S.products.find((x) => x.id === pk.pid);
      const v = p.variants.find((x) => x.id === pk.vid);
      const room = v.stock - S.cart.filter((l) => l.variantId === v.id).reduce((s, l) => s + l.qty, 0);
      pk.qty = Math.max(1, Math.min(Math.max(1, room), pk.qty + Number(d)));
      refresh();
    },
    addToCart() {
      const pk = draft.pick;
      const p = S.products.find((x) => x.id === pk.pid);
      const v = p.variants.find((x) => x.id === pk.vid);
      const line = S.cart.find((l) => l.variantId === v.id);
      if (line) line.qty += pk.qty;
      else S.cart.push({ supplierId: p.supplierId, productId: p.id, variantId: v.id, name: p.name, variantName: v.name, price: v.price, qty: pk.qty });
      draft.pick = null;
      closeTop(true);
      refresh();
      toast("Added to cart");
    },
    cartQty(arg) {
      const [i, d] = arg.split("|").map(Number);
      const l = S.cart[i];
      const v = S.products.find((p) => p.id === l.productId).variants.find((x) => x.id === l.variantId);
      l.qty = Math.min(v.stock, l.qty + d);
      if (l.qty <= 0) S.cart.splice(i, 1);
      refresh();
    },
    reorder(id) {
      const o = S.supplyOrders.find((x) => x.id === id);
      let skipped = 0;
      o.items.forEach((it) => {
        const p = S.products.find((x) => x.id === it.productId);
        const v = p.variants.find((x) => x.id === it.variantId);
        const qty = Math.min(it.qty, v.stock);
        if (!qty) return skipped++;
        const line = S.cart.find((l) => l.variantId === v.id);
        line ? (line.qty = Math.min(v.stock, line.qty + qty)) : S.cart.push({ supplierId: p.supplierId, productId: p.id, variantId: v.id, name: p.name, variantName: v.name, price: v.price, qty });
      });
      refresh();
      open("cart:");
      if (skipped) toast(`${V.plural(skipped, "item")} out of stock and left out`);
    },

    // Supplier
    fulfil(id) {
      const o = S.supplyOrders.find((x) => x.id === id);
      o.status = "fulfilled";
      if (o.buyerId === "a1") msg(convo("a1", "m1"), "m1", "text", { text: `Order ${o.number} has shipped. It should arrive in two to three business days.` });
      refresh();
      toast(`Order ${o.number} marked fulfilled`);
    },
    deliver(id) {
      const o = S.supplyOrders.find((x) => x.id === id);
      o.status = "delivered";
      refresh();
      toast(`Order ${o.number} delivered`);
    },
    productAdd() {
      const n = draft.newProduct || {};
      const price = Math.round(parseFloat(n.price) * 100);
      if (!n.name || n.name.trim().length < 2 || !(price > 0)) return toast("Add a product name and price.");
      S.products.push({ id: D.uid("pr"), supplierId: "m1", name: n.name.trim(), category: (n.category || "Other").trim(), variant: "box", min: 8, published: true, variants: [{ id: D.uid("v"), name: "Standard", price, stock: parseInt(n.stock, 10) || 0 }] });
      draft.newProduct = null;
      closeTop(true);
      refresh();
      toast("Product saved");
    },
    stockAdj(arg) {
      const [i, j, d] = arg.split("|").map(Number);
      const v = S.products[i].variants[j];
      v.stock = Math.max(0, v.stock + d);
      refresh();
    },
    shopifyConnect() {
      S.store.shopify.connected = true;
      A.shopifyImport();
    },
    shopifyImport() {
      draft.shopProg = 0;
      refresh();
      const tick = setInterval(() => {
        draft.shopProg = Math.min(100, draft.shopProg + 12);
        if (draft.shopProg >= 100) {
          clearInterval(tick);
          if (!S.store.shopify.imported) {
            S.store.shopify.imported = true;
            [["Grey wash set", "Ink", "bottle", 5600, 18], ["Disposable grips, 25 mm", "Needles", "box", 3900, 40], ["Stencil primer", "Stencils", "bottle", 2200, 26]].forEach(([name, category, variant, price, stock]) => S.products.push({ id: D.uid("pr"), supplierId: "m1", name, category, variant, min: 8, published: true, variants: [{ id: D.uid("v"), name: "Standard", price, stock }] }));
          }
          S.store.shopify.lastSync = now();
          setTimeout(() => {
            draft.shopProg = null;
            refresh();
          }, 1400);
        }
        refresh();
      }, 160);
    },

    // Business settings
    serviceAdd() {
      S.services.push({ id: D.uid("s"), name: "New service", mins: 240, price: 60000, sittings: 1 });
      S.artist.setup.services = true;
      refresh();
    },
    serviceRemove(id) {
      if (S.services.length <= 1) return toast("Keep at least one service.");
      S.services = S.services.filter((s) => s.id !== id);
      refresh();
    },
    travelAdd() {
      const t = draft.travel || {};
      if (!t.city || !t.from || !t.to) return toast("Add the city and both dates.");
      const from = new Date(t.from + "T00:00").getTime(), to = new Date(t.to + "T00:00").getTime();
      if (to < from) return toast("The trip must end after it starts.");
      S.travel.push({ id: D.uid("tr"), city: t.city.trim(), place: (t.place || "Guest spot").trim(), from, to });
      draft.travel = {};
      refresh();
      toast("Trip added. Those days are blocked for bookings.");
    },
    travelRemove(id) {
      S.travel = S.travel.filter((t) => t.id !== id);
      refresh();
    },
    eventAdd() {
      const e = draft.event || {};
      if (!e.title || !e.date) return toast("Add a title and date.");
      S.shop.events.push({ id: D.uid("e"), title: e.title.trim(), format: e.format || "In person", start: new Date(e.date + "T10:00").getTime(), price: Math.round(parseFloat(e.price || 150) * 100), seats: parseInt(e.seats || 12, 10), registered: 0 });
      draft.event = {};
      refresh();
      toast("Event published");
    },
    studioCreate() {
      S.studio = { name: (draft.studioName || S.artist.studio).trim(), members: [] };
      refresh();
      toast("Studio created");
    },
    studioInvite() {
      const e = (draft.invite || "").trim();
      if (!/.+@.+\..+/.test(e)) return toast("Enter a valid email.");
      S.studio.members.push({ email: e, status: "pending" });
      draft.invite = "";
      refresh();
      toast("Invitation sent");
    },
    templateAdd() {
      S.settings.templates.push({ id: D.uid("t"), name: "New template", body: "Hi {name}, " });
      refresh();
    },
    templateRemove(id) {
      S.settings.templates = S.settings.templates.filter((t) => t.id !== id);
      refresh();
    },
    connectPayouts() {
      S.artist.setup.payouts = true;
      S.artist.stripe = "ready";
      draft.bankStep = null;
      refresh();
      toast("Payouts connected");
    },
    csvImport() {
      const csv = draft.csv != null ? draft.csv : "name,email,phone\nGrace Liu,grace@example.test,0400 220 118\nSam Chen,sam@example.test,\nJordan Reid,jordan@example.test,0400 905 332";
      const rows = csv.trim().split(/\n/).slice(1).map((l) => l.split(",")).filter((r) => (r[0] || "").trim());
      rows.forEach((r) => {
        const id = D.uid("c");
        S.people[id] = { id, role: "client", name: r[0].trim(), email: (r[1] || "").trim(), phone: (r[2] || "").trim(), city: "", status: "imported" };
      });
      draft.csv = null;
      closeTop(true);
      refresh();
      toast(`Imported ${V.plural(rows.length, "client")}`);
    },
    igImport() {
      draft.igProg = 0;
      refresh();
      const tick = setInterval(() => {
        draft.igProg = Math.min(100, draft.igProg + 10);
        if (draft.igProg >= 100) {
          clearInterval(tick);
          S.artist.instagram.connected = true;
          S.artist.instagram.imported += 6;
          setTimeout(() => {
            draft.igProg = null;
            refresh();
            toast("6 posts imported");
          }, 1200);
        }
        refresh();
      }, 150);
    },
  };

  // ── Events ────────────────────────────────────────────────
  document.addEventListener("click", (e) => {
    if (suppressClick) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    const el = e.target.closest("[data-act]");
    if (!el || el.disabled) return;
    const fn = A[el.dataset.act] || (window.MosaicActs || {})[el.dataset.act];
    if (!fn) return;
    e.preventDefault();
    fn(el.dataset.arg, el, e);
  }, true);

  let liveT = null;
  document.addEventListener("input", (e) => {
    const el = e.target;
    if (!el.dataset || !el.dataset.bind) return;
    setPath(el.dataset.bind, convert(el, el.value));
    if (el.dataset.bind.startsWith("S.")) D.save(S);
    if (el.dataset.live) {
      clearTimeout(liveT);
      liveT = setTimeout(refresh, el.type === "date" || el.type === "range" ? 0 : 140);
    } else if (stack.length && /^draft\.(comp|offer|intake|addClient|newProduct|gift|transfer|travel|event)/.test(el.dataset.bind)) {
      // Footer buttons depend on these drafts; refresh the footer only, so typing isn't interrupted.
      clearTimeout(liveT);
      liveT = setTimeout(() => {
        const top = stack[stack.length - 1];
        const def = Sheets[top.name](top.arg, S, ui, draft);
        const foot = $(".sheet-foot", top.el);
        if (foot.innerHTML !== (def.foot || "")) foot.innerHTML = def.foot || "";
      }, 120);
    }
  });
  document.addEventListener("change", async (e) => {
    const el = e.target;
    if (el.dataset && el.dataset.bind && (el.type === "date" || el.type === "time")) {
      setPath(el.dataset.bind, el.value);
      refresh();
    }
    if (!el.dataset || !el.dataset.upload) return;
    const files = [...el.files].slice(0, 6);
    if (!files.length) return;
    const [kind, ref] = el.dataset.upload.split(":");
    const srcs = (await Promise.all(files.map(readImage))).filter(Boolean);
    if (!srcs.length) return toast("Couldn't read that image. Try another photo.");
    if (kind === "chat") {
      const c = S.convos.find((x) => x.id === ref);
      srcs.forEach((src) => msg(c, App.me(), "image", { src }));
    } else if (ref === "refs") srcs.forEach((src) => draft.intake.refs.length < 6 && draft.intake.refs.push({ src }));
    else if (ref === "photo") draft.intake.photo = srcs[0];
    refresh();
    if (kind === "chat") {
      const top = stack[stack.length - 1];
      if (top) requestAnimationFrame(() => ($(".sheet-scroll", top.el).scrollTop = 1e9));
    }
  });
  document.addEventListener("keydown", (e) => {
    const t = e.target;
    if (e.key === "Enter" && !e.shiftKey && t.dataset && t.dataset.enter === "send") {
      e.preventDefault();
      A.send(t.dataset.arg);
      return;
    }
    if (e.key === "Escape" && stack.length) {
      closeTop();
      return;
    }
    if (stack.length || !S.role || /input|textarea|select/i.test(t.tagName)) return;

  });
  let rT = null;
  window.addEventListener("resize", () => {
    clearTimeout(rT);
    rT = setTimeout(() => {
      measure();
      if (S.role) goTo(current, false);
      renderAside();
    }, 180);
  });

  // ── Boot ──────────────────────────────────────────────────
  if (S.role && Views.roles[S.role]) enterRole(S.role);
  else {
    S.role = null;
    renderGate();
  }
  window.addEventListener("load", measure);
  $("#app").appendChild(dockAct);
})();
