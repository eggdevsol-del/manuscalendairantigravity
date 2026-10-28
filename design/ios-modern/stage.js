/* Tattoi Stage — every screen opens with a Stage: a live preview, in the dusk gradient, of what that
   screen controls. Controls sit below on lavender mist. Values are set with touch fill sliders, and the
   Stage redraws as you drag. The landing page is a lock screen for the studio; there is no tab bar. */
(function () {
  "use strict";
  const D = window.Data, V = window.V, Art = window.Art;
  const { esc, icon, av, person, first, project, money, act, plural, dayLong } = V;
  const orig = window.Views.roles;
  const pick = (role, key, list) => (orig[role][list || "pages"].find((p) => p.key === key) || {}).render;
  const R = { inbox: pick("artist", "inbox"), clients: pick("artist", "clients"), business: pick("artist", "business"), offers: pick("artist", "offers", "more"), supplies: pick("artist", "supplies", "more"), cinbox: pick("client", "messages"), me: pick("client", "me"), tattoos: pick("client", "tattoos"), discover: pick("client", "discover"), store: pick("supplier", "store"), orders: pick("supplier", "orders"), products: pick("supplier", "products"), sinbox: pick("supplier", "sinbox") };
  const HOUR = 3600000, now = () => Date.now();
  const hash = (s) => [...String(s)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
  const S0 = () => window.App.S;
  const L = { earn: 800000, week: 0, offPct: 20, offDays: 30, depPrev: null, svc: 0, var: 0 }; // local, unsaved values the sliders drive
  const sit = (x) => `${D.fmtTime(x.start)}–${D.fmtTime(x.start + x.mins * 60000)}`;

  function photo(pid) {
    const p = project(pid);
    if (Art.photoFor(p.seed)) return Art.url(p.motif, p.seed, 400, 300);
    return (p.artistId || "a1") === "a1" ? `img/rory-${(hash(pid) % 7) + 1}.jpg` : Art.url(p.motif, p.seed, 400, 300);
  }
  const mine = (S) => S.appts.filter((a) => a.artistId === "a1" && a.status !== "cancelled");
  const liveOf = (S) => mine(S).find((a) => a.status === "confirmed" && !a.consult && a.start <= now() && a.start + a.mins * 60000 > now());
  const nextOf = (S) => mine(S).filter((a) => a.status === "confirmed" && !a.consult && a.start > now()).sort((a, b) => a.start - b.start)[0];
  const ahead = (S) => mine(S).filter((x) => x.start > now()).reduce((s, x) => s + (x.price - x.paid), 0);

  // ── The touch fill slider ───────────────────────────────
  // The whole bar is the control: press anywhere and drag, like Control Center's volume.
  const FMT = { money: (v) => money(v, { whole: true }), pct: (v) => v + "%", mins: (v) => D.duration(v), int: (v) => String(v), days: (v) => plural(v, "day"), week: (v) => (v === 0 ? "This week" : v < 0 ? `${-v} weeks ago` : `${v} weeks ahead`), qty: (v) => "× " + v };
  function fs(path, min, max, step, label, fmt, opts = {}) {
    const v = getP(path), f = (v - min) / (max - min);
    return `<div class="fs ${opts.cls || ""}" role="slider" tabindex="0" aria-label="${esc(label)}" aria-valuemin="${min}" aria-valuemax="${max}" aria-valuenow="${v}" data-fs="${path}" data-min="${min}" data-max="${max}" data-step="${step}" data-fmt="${fmt}" ${opts.stage ? `data-st="${opts.stage}"` : ""}><i style="width:${Math.max(0, Math.min(1, f)) * 100}%"></i><span><b>${esc(label)}</b><em>${FMT[fmt](v)}</em></span></div>`;
  }
  function resolve(path) { const parts = path.split("."), root = parts.shift() === "L" ? L : S0(); let o = root; while (parts.length > 1) o = o[parts.shift()]; return [o, parts[0]]; }
  function getP(path) { const [o, k] = resolve(path); return o[k]; }
  function setP(path, v) { const [o, k] = resolve(path); o[k] = v; }
  let drag = null;
  function fsSet(el, e) {
    const r = el.getBoundingClientRect(), min = +el.dataset.min, max = +el.dataset.max, step = +el.dataset.step;
    const f = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
    const v = Math.round((min + f * (max - min)) / step) * step;
    if (v === getP(el.dataset.fs)) return;
    setP(el.dataset.fs, v);
    el.querySelector("i").style.width = ((v - min) / (max - min)) * 100 + "%";
    el.querySelector("em").textContent = FMT[el.dataset.fmt](v);
    el.setAttribute("aria-valuenow", v);
    redrawStage(el);
  }
  function redrawStage(el) {
    const box = el.closest(".sheet, .page") || document;
    box.querySelectorAll("[data-stage]").forEach((st) => { const [k, a] = st.dataset.stage.split("|"); if (STAGES[k]) st.innerHTML = STAGES[k](S0(), a); });
  }
  document.addEventListener("pointerdown", (e) => { const el = e.target.closest("[data-fs]"); if (!el || el.classList.contains("locked")) return; drag = el; el.classList.add("on"); el.setPointerCapture(e.pointerId); fsSet(el, e); e.stopPropagation(); }, true);
  document.addEventListener("pointermove", (e) => { if (drag) { fsSet(drag, e); e.preventDefault(); } }, true);
  const end = () => { if (!drag) return; drag.classList.remove("on"); const p = drag.dataset.fs; drag = null; if (p.startsWith("S.") || p.startsWith("settings") || !p.startsWith("L.")) D.save(S0()); setTimeout(() => window.App.refresh(), 0); };
  document.addEventListener("pointerup", end, true);
  document.addEventListener("pointercancel", end, true);
  document.addEventListener("keydown", (e) => { const el = e.target.closest && e.target.closest("[data-fs]"); if (!el || !/Arrow(Left|Right)/.test(e.key)) return; const v = Math.max(+el.dataset.min, Math.min(+el.dataset.max, getP(el.dataset.fs) + (e.key === "ArrowRight" ? 1 : -1) * +el.dataset.step)); setP(el.dataset.fs, v); D.save(S0()); window.App.refresh(); e.preventDefault(); });

  // ── Shared drawing ───────────────────────────────────────
  function ring(frac, size, inner, cls) {
    const r = size / 2 - 5, c = 2 * Math.PI * r, f = Math.max(0, Math.min(1, frac));
    return `<span class="rg ${cls || ""}" style="width:${size}px;height:${size}px"><svg viewBox="0 0 ${size} ${size}" aria-hidden="true"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" class="bg"/>${f > 0.01 ? `<circle cx="${size / 2}" cy="${size / 2}" r="${r}" class="fg" stroke-dasharray="${(c * f).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 ${size / 2} ${size / 2})"/>` : ""}</svg><b>${inner || ""}</b></span>`;
  }
  function stage(key, arg, S, cls) { return `<div class="stage ${cls || ""}" data-stage="${key}|${arg || ""}">${STAGES[key](S, arg)}</div>`; }
  const STAGES = {};

  // Time-sized photo cards: a sitting is as tall as it is long.
  function dayColumn(S, d, PX) {
    const items = mine(S).filter((a) => D.sameDay(a.start, d)).sort((a, b) => a.start - b.start);
    let h0 = 8, h1 = 20;
    items.forEach((a) => { h0 = Math.min(h0, new Date(a.start).getHours()); h1 = Math.max(h1, Math.ceil((a.start + a.mins * 60000 - D.startOfDay(d)) / HOUR)); });
    const t0 = D.startOfDay(d) + h0 * HOUR, y = (t) => ((t - t0) / HOUR) * PX;
    let ticks = "";
    for (let h = h0; h <= h1; h++) ticks += `<span class="tk${h % 2 ? " odd" : ""}" style="top:${(h - h0) * PX}px">${h % 2 ? "" : new Date(D.startOfDay(d) + h * HOUR).toLocaleTimeString("en-AU", { hour: "numeric" }).replace(" ", "").toLowerCase()}</span>`;
    const cards = items.map((a) => {
      const lv = a.status === "confirmed" && a.start <= now() && a.start + a.mins * 60000 > now();
      const forms = S.forms.filter((f) => f.apptId === a.id);
      const ready = [a.price === 0 ? null : a.paid >= a.price ? ["Paid", 1] : a.paid > 0 ? ["Deposit", 1] : ["No deposit", 0], forms.length ? ["Forms", forms.every((f) => f.status === "signed") ? 1 : 0] : null].filter(Boolean);
      const h = Math.max(54, (a.mins / 60) * PX - 4);
      return `<button type="button" class="sc ${a.status}${lv ? " live" : ""}${h < 90 ? " short" : ""}" style="top:${y(a.start) + 2}px;height:${h}px" ${act("open", "booking:" + a.id)}><img src="${photo(a.projectId)}" alt=""><span><i>${sit(a)}${lv ? " · now" : a.status === "proposed" ? " · awaiting deposit" : ""}</i><b>${esc(person(a.clientId).name)}</b><em>${esc(a.consult ? "Consultation" : project(a.projectId).name)}${a.total > 1 ? `, ${a.idx} of ${a.total}` : ""}</em><u>${ready.map(([t, ok]) => `<s class="${ok ? "ok" : "due"}">${ok ? "✓" : "!"} ${t}</s>`).join("")}</u></span></button>`;
    }).join("");
    const nowL = D.sameDay(d, now()) && now() > t0 ? `<div class="nowl" style="top:${y(now())}px"><span>Now</span></div>` : "";
    return `<div class="dcol" style="height:${(h1 - h0) * PX + 12}px">${ticks}${cards}${nowL}${items.length ? "" : `<p class="dfree">A free day. Tap “Book this day” to fill it.</p>`}</div>`;
  }
  // Money river: ten weeks earned, today, eight weeks already booked.
  function weeks(S) {
    const mon0 = D.startOfDay(now()) - ((new Date().getDay() + 6) % 7) * D.DAY, out = [];
    for (let w = -10; w <= 8; w++) {
      const a = mon0 + w * 7 * D.DAY, b = a + 7 * D.DAY;
      out.push({ w, a, earned: w <= 0 ? S.txns.filter((t) => t.artistId === "a1" && t.status === "paid" && t.at >= a && t.at < b).reduce((s, t) => s + t.base, 0) : 0, booked: mine(S).filter((x) => x.start >= a && x.start < b && x.start > now()).reduce((s, x) => s + (x.price - x.paid), 0) });
    }
    return out;
  }
  function river(S, W, H, scrub) {
    const ws = weeks(S), pb = 20, max = Math.max(1, ...ws.map((x) => Math.max(x.earned, x.booked)));
    const X = (i) => 8 + (i / (ws.length - 1)) * (W - 16), Y = (v) => H - pb - (v / max) * (H - pb - 18);
    const i0 = ws.findIndex((x) => x.w === 0);
    const past = ws.slice(0, i0 + 1).map((x, i) => [X(i), Y(x.earned)]), fut = ws.slice(i0).map((x, i) => [X(i + i0), Y(x.booked)]);
    const area = (p) => `M${p[0][0]} ${H - pb} ` + p.map((q) => `L${q[0].toFixed(1)} ${q[1].toFixed(1)}`).join(" ") + ` L${p[p.length - 1][0]} ${H - pb} Z`;
    const line = (p) => p.map((q, i) => `${i ? "L" : "M"}${q[0].toFixed(1)} ${q[1].toFixed(1)}`).join(" ");
    const si = ws.findIndex((x) => x.w === scrub), sw = ws[si], sv = sw ? (sw.w <= 0 ? sw.earned : sw.booked) : 0;
    return `<svg class="river" viewBox="0 0 ${W} ${H}" role="img" aria-label="Earnings for the last ten weeks and income booked for the next eight"><defs><pattern id="hx" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="2" height="6" fill="rgba(255,255,255,.45)"/></pattern><linearGradient id="rv" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity=".05"/></linearGradient></defs><path d="${area(past)}" fill="url(#rv)"/><path d="${line(past)}" class="el"/><path d="${area(fut)}" fill="url(#hx)"/><path d="${line(fut)}" class="bl"/><line x1="${X(i0)}" x2="${X(i0)}" y1="6" y2="${H - pb}" class="nl"/><text x="${X(i0)}" y="${H - 5}" text-anchor="middle">Today</text><text x="8" y="${H - 5}">10 weeks ago</text><text x="${W - 8}" y="${H - 5}" text-anchor="end">8 weeks ahead</text>${sw ? `<line x1="${X(si)}" x2="${X(si)}" y1="6" y2="${H - pb}" class="sl"/><circle cx="${X(si)}" cy="${Y(sv)}" r="6" class="sd"/>` : ""}</svg>`;
  }
  function peopleList(S) {
    return Object.values(S.people).filter((p) => p.role === "client").map((p) => {
      const next = mine(S).filter((a) => a.clientId === p.id && a.start > now() && !a.consult).sort((a, b) => a.start - b.start)[0];
      const proj = S.projects.find((x) => x.clientId === p.id && x.artistId === "a1");
      return { p, next, paid: V.lifetimePaid(S, p.id), proj, days: next ? D.daysBetween(now(), next.start) : null, lead: S.leads.find((l) => l.clientId === p.id && l.status === "new") };
    });
  }
  function orb(x, size) {
    const frac = x.days === null ? 0 : Math.max(0.06, 1 - x.days / 60), r = size / 2 + 5, c = 2 * Math.PI * r, s2 = size / 2 + 7;
    return `<span class="orb" style="width:${size}px;height:${size}px">${x.proj ? `<img src="${photo(x.proj.id)}" alt="">` : av(x.p.id)}<svg viewBox="0 0 ${size + 14} ${size + 14}" aria-hidden="true"><circle cx="${s2}" cy="${s2}" r="${r}" class="bg"/>${frac ? `<circle cx="${s2}" cy="${s2}" r="${r}" class="fg" stroke-dasharray="${(c * frac).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 ${s2} ${s2})"/>` : ""}</svg></span>`;
  }
  const leadImg = (l, w) => (l.refs[0] && !String(l.refs[0]).startsWith("data:") ? Art.url(Art.STYLE_MOTIF[l.styles[0]] || "mandala", l.refs[0], w, w) : l.refs[0] || Art.url("botanical", l.id, w, w));
  const postcard = (l) => `<button type="button" class="post" ${act("open", "lead:" + l.id)}><img src="${leadImg(l, 300)}" alt=""><span><i>${esc(l.budget)} · ${esc(l.timeframe.toLowerCase())}</i><b>${esc(person(l.clientId).name)}</b><q>${esc(l.idea)}</q><em>${esc(l.project)}, ${esc(l.placement.toLowerCase())}</em></span></button>`;
  const newLeads = (S) => S.leads.filter((l) => (l.artistId || "a1") === "a1" && l.status === "new");
  const ctl = (title, inner, note) => `<section class="ctl">${title ? `<h3>${title}</h3>` : ""}${inner}${note ? `<p class="note">${note}</p>` : ""}</section>`;
  const tg = (label, sub, path, on) => `<div class="tg"><span><b>${label}</b>${sub ? `<em>${sub}</em>` : ""}</span><button class="switch" role="switch" aria-checked="${!!on}" aria-label="${esc(label)}" ${act("toggle", path)}></button></div>`;
  const plain = (r) => `<div class="plainwrap">${r.body}</div>`;
  const btn = (label, a, arg, cls) => `<button type="button" class="pb ${cls || ""}" ${act(a, arg)}>${label}</button>`;

  // ── Landing: a lock screen for the studio ──────────────
  const sky = () => { const h = new Date().getHours(); return h < 6 || h >= 20 ? "night" : h < 10 ? "dawn" : h < 17 ? "day" : "dusk"; };
  STAGES.lock = (S) => {
    const t = new Date(), a = liveOf(S), n = nextOf(S);
    const today = mine(S).filter((x) => D.sameDay(x.start, now()) && !x.consult);
    const hrs = today.reduce((s, x) => s + x.mins, 0) / 60;
    const tasks = (S.tasks || []).filter((x) => !x.quiet).slice(0, 4);
    const leads = newLeads(S);
    const live = a || n;
    return `<div class="lk-time">${t.toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit" }).replace(/\s?(am|pm)/i, "")}</div><div class="lk-date">${t.toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long" })}</div>
      <div class="lk-widgets"><button type="button" ${act("open", "st:day")}>${ring(hrs / 8, 58, Math.round(hrs) + "h")}<small>in the chair</small></button><button type="button" ${act("open", "st:money")}>${ring(Math.min(1, ahead(S) / 4000000), 58, "$" + Math.round(ahead(S) / 100000) + "k")}<small>booked ahead</small></button><button type="button" ${act("open", "st:req")}>${ring(Math.min(1, leads.length / 6), 58, leads.length)}<small>new requests</small></button></div>
      ${live ? `<button type="button" class="lk-live" ${act("open", "session:" + live.id)}><img src="${photo(live.projectId)}" alt=""><span><small>${a ? "In the chair" : "Next up " + esc(D.fmtRel(live.start))}</small><b>${esc(person(live.clientId).name)}</b><em>${esc(project(live.projectId).name)} · ${sit(live)}</em></span>${a ? `<i class="lk-prog"><s style="width:${((now() - a.start) / (a.mins * 60000)) * 100}%"></s></i>` : ""}</button>` : ""}
      ${""}<div class="lk-stack" hidden>${tasks.map((x, i) => `<button type="button" class="nt" style="--i:${i}" ${act("open", "task:" + x.key)}><i>${icon({ request: "sparkle", deposit: "card", form: "pen", balance: "wallet", reply: "chat", waitlist: "hourglass", setup: "shield", followup: "clock" }[x.kind] || "bell")}</i><span><b>${esc(x.title)}</b>${esc(x.context || "")}</span><small>now</small></button>`).join("") || `<p class="nt empty">Nothing needs you right now</p>`}</div>`;
  };
  const room = (key, title, sub, visual, cls) => `<button type="button" class="room ${cls || ""}" ${act("open", key)}><span class="rv">${visual}</span><span class="rt"><b>${title}</b><em>${sub}</em></span>${icon("chevR")}</button>`;
  // ── Artist sections ─────────────────────────────────────
  const SEC = {};
  // Calendar: an endless river of days. Scroll down for the future, up for the past; more days load as you go.
  const CAL = { from: -3, to: 28 };
  // Free working minutes on a day: opening hours (or a standard day on a day off) minus breaks and bookings.
  function freeMins(S, d) {
    const h = S.hours[D.DAY_KEYS[new Date(d).getDay()]], on = h && h.on;
    const open = (on ? toMin(h.end) - toMin(h.start) : 480) - (on ? h.breaks.reduce((s, b) => s + toMin(b.end) - toMin(b.start), 0) : 0);
    const booked = mine(S).filter((a) => D.sameDay(a.start, d) && a.status !== "cancelled").reduce((s, a) => s + a.mins, 0);
    return Math.max(0, open - booked);
  }
  function dayBlock(S, d) {
    const items = mine(S).filter((a) => D.sameDay(a.start, d)), hrs = items.reduce((s, a) => s + a.mins, 0) / 60;
    const away = S.travel.find((t) => d >= D.startOfDay(t.from) && d <= t.to), td = D.sameDay(d, now()), dd = new Date(d);
    const head = `<div class="cd-h ${td ? "td" : ""}" ${dd.getDate() === 1 ? `data-month="${dd.toLocaleDateString("en-AU", { month: "long", year: "numeric" })}"` : ""}><span class="cd-n"><small>${dd.toLocaleDateString("en-AU", { weekday: "short" })}</small><b>${dd.getDate()}</b></span><span class="cd-t"><b>${td ? "Today" : dd.toLocaleDateString("en-AU", { month: "long" })}</b><em>${away ? `Away in ${esc(away.city)}` : items.length ? `${plural(items.length, "sitting")} · ${Math.round(hrs)}h in the chair` : "Free"}</em></span>${ring(hrs / 8, 34, "")}</div>`;
    const free = away || d < D.startOfDay(now()) ? 0 : freeMins(S, d);
    const fill = free >= 120 ? `<button type="button" class="cd-free" ${act("open", "fill:" + d)}>${icon("sparkle")} ${items.length ? `Fill the gap · ${D.duration(free)} free` : "Fill this day"}</button>` : "";
    const inner = fill + (items.length ? dayColumn(S, d, 40) : "");
    return `<section class="cd ${items.length ? "" : "empty"}" data-day="${d}">${dd.getDate() === 1 ? `<h3 class="cd-m">${dd.toLocaleDateString("en-AU", { month: "long", year: "numeric" })}</h3>` : ""}${head}${inner}</section>`;
  }
  const dayRange = (S, a, b) => { let h = ""; for (let i = a; i < b; i++) h += dayBlock(S, D.startOfDay(now()) + i * D.DAY); return h; };
  STAGES.sky = (S) => {
    const days = Array.from({ length: 60 }, (_, i) => D.startOfDay(now()) + i * D.DAY);
    return `<div class="sky-h"><b>Next 60 days</b><small>Tap a day to jump to it</small></div><div class="skyline">${days.map((d, i) => { const it = mine(S).filter((a) => D.sameDay(a.start, d) && !a.consult); const h = it.reduce((s, a) => s + a.mins, 0) / 60; const dd = new Date(d); const lbl = dd.getDate() === 1 || i === 0 ? dd.toLocaleDateString("en-AU", { month: "short" }) : ""; const away = S.travel.some((t) => d >= D.startOfDay(t.from) && d <= t.to); return `<button type="button" class="bld ${away ? "away" : ""} ${i === 0 ? "td" : ""}" ${act("calJump", i)} aria-label="${esc(dayLong(d))}, ${h ? Math.round(h) + " hours booked" : "free"}">${lbl ? `<small>${lbl}</small>` : ""}<i style="height:${h ? 18 + (h / 8) * 82 : 4}%">${it[0] ? `<img src="${photo(it[0].projectId)}" alt="">` : ""}</i></button>`; }).join("")}</div>`;
  };
  function mountCal(el) {
    const sc = el.querySelector(".sheet-scroll"), list = el.querySelector(".cal-list");
    if (!sc || !list) return;
    const top = list.querySelector(".cal-top"), bot = list.querySelector(".cal-bot");
    let ready = false, busy = false;
    setTimeout(() => (ready = true), 400); // let the opening position settle before loading the past
    const grow = () => {
      if (busy || sc.dataset.jump) return;
      busy = true;
      const S = S0();
      if (sc.scrollHeight - sc.scrollTop - sc.clientHeight < 900) { bot.insertAdjacentHTML("beforebegin", dayRange(S, CAL.to, CAL.to + 21)); CAL.to += 21; }
      else if (ready && sc.scrollTop < 300) { const h = sc.scrollHeight; top.insertAdjacentHTML("afterend", dayRange(S, CAL.from - 14, CAL.from)); CAL.from -= 14; sc.scrollTop += sc.scrollHeight - h; }
      busy = false;
    };
    sc.addEventListener("scroll", grow, { passive: true });
    const pill = el.querySelector(".cal-today"), mon = el.querySelector(".cal-mon");
    sc.addEventListener("scroll", () => {
      const t = list.querySelector('.cd-h.td'); if (pill && t) { const r = t.getBoundingClientRect().top - sc.getBoundingClientRect().top; pill.hidden = r > -200 && r < sc.clientHeight; }
      if (mon) { const hs = [...list.querySelectorAll(".cd")]; const cur = hs.find((x) => x.getBoundingClientRect().bottom > sc.getBoundingClientRect().top + 120); if (cur) mon.textContent = new Date(+cur.dataset.day).toLocaleDateString("en-AU", { month: "long", year: "numeric" }); }
    }, { passive: true });
  }
  SEC.day = () => ({ title: "Calendar", sub: "", stage: "", body: `<div class="cal-mon" aria-live="polite"></div><div class="cal-list"><i class="cal-top"></i>${dayRange(S0(), CAL.from, CAL.to)}<i class="cal-bot"></i></div><button type="button" class="cal-today" hidden ${act("calJump", 0)}>Today</button>`, mount: mountCal });

  STAGES.posts = (S) => { const l = newLeads(S); return l.length ? `<div class="posts">${l.map(postcard).join("")}</div>` : `<p class="st-empty">No new requests. Your booking page is ${S.artist.link.enabled ? "open" : "paused"}.</p>`; };
  SEC.req = (S, ui) => {
    const inner = R.inbox(S, ui).body.replace(/<section class="card tight"><div class="mh">.*?New requests.*?<\/section>/s, "");
    return { title: "Requests & messages", sub: newLeads(S).length ? "Swipe through new requests. Tap one to reply, quote or book." : "", stage: stage("posts", "", S, "flush"), body: ctl("Conversations", plain({ body: inner })) };
  };
  STAGES.money = (S) => {
    const ws = weeks(S), w = ws.find((x) => x.w === L.week) || ws[10];
    const val = w.w <= 0 ? w.earned : w.booked;
    return `<div class="st-num"><small>${FMT.week(L.week)} · week of ${D.fmtDate(w.a)}</small><b>${money(val, { whole: true })}</b><em>${w.w < 0 ? "earned" : w.w === 0 ? "earned so far" : "still to come from bookings"}</em></div>${river(S, 340, 150, L.week)}`;
  };
  SEC.money = (S, ui) => {
    const bal = V.balance(S), e30 = V.earnings(S, now() - 30 * D.DAY), held = mine(S).filter((x) => x.start > now()).reduce((s, x) => s + x.paid, 0);
    const tx = S.txns.filter((t) => t.artistId === "a1").sort((a, b) => b.at - a.at).slice(0, ui.allTx ? 40 : 6);
    return { title: "Money", sub: bal.next ? `${money(bal.transit)} lands ${D.fmtDate(bal.next.at)}` : "", stage: stage("money", "", S), body: fs("L.week", -10, 8, 1, "Drag through time", "week", { cls: "money" }) + `<div class="facts"><div><b>${money(bal.available, { whole: true })}</b><span>ready to pay out</span></div><div><b>${money(e30.gross, { whole: true })}</b><span>earned, 30 days</span></div><div><b>${money(held, { whole: true })}</b><span>deposits held</span></div></div>` + ctl("Ledger", tx.map((t) => `<button type="button" class="led" ${act("open", "txn:" + t.id)}>${av(t.clientId, "sm")}<span>${esc(person(t.clientId).name)}<i>${esc(t.kind)}, ${D.fmtDate(t.at)}</i></span><b class="${t.status === "refunded" ? "ref" : ""}">+${money(t.base, { whole: true })}</b></button>`).join("") + `<button class="more" ${act("toggleUi", "allTx")}>${ui.allTx ? "Show less" : "Show all"}</button>`) + `<div class="row2">${btn("Payouts", "open", "wb:payouts")}${btn("Your plan", "open", "wb:plan")}</div>` };
  };
  STAGES.people = (S) => {
    const ppl = peopleList(S).filter((x) => x.next).sort((a, b) => a.days - b.days).slice(0, 5);
    return `<div class="pp-row">${ppl.map((x, i) => `<button type="button" ${act("open", "client:" + x.p.id)}>${orb(x, i ? 50 : 72)}<b>${esc(first(x.p.id))}</b><small>${x.days === 0 ? "Today" : x.days === 1 ? "Tomorrow" : "in " + x.days + " days"}</small></button>`).join("")}</div><p class="st-cap">The ring fills as their next sitting gets closer.</p>`;
  };
  SEC.people = (S, ui) => {
    const q = (ui.clientQ || "").toLowerCase(), all = peopleList(S).filter((x) => !q || x.p.name.toLowerCase().includes(q));
    const max = Math.max(1, ...all.map((x) => x.paid));
    const star = (x) => `<button type="button" class="star" ${act("open", "client:" + x.p.id)}>${orb(x, Math.round(48 + (x.paid / max) * 26))}<b>${esc(x.p.name.split(" ")[0])}</b><span>${x.days === null ? (x.lead ? "Sent a request" : x.paid ? money(x.paid, { whole: true }) + " spent" : "New") : x.days === 0 ? "Today" : x.days === 1 ? "Tomorrow" : `in ${x.days} days`}</span></button>`;
    const groups = [["This week", all.filter((x) => x.days !== null && x.days <= 7)], ["This month", all.filter((x) => x.days !== null && x.days > 7 && x.days <= 31)], ["Later", all.filter((x) => x.days !== null && x.days > 31)], ["Not booked yet", all.filter((x) => x.days === null)]].filter(([, g]) => g.length);
    return { title: "People", sub: "Bigger circles have spent more with you.", stage: stage("people", "", S), body: `<label class="search">${icon("search")}<input type="search" placeholder="Find someone" value="${esc(ui.clientQ || "")}" data-bind="ui.clientQ" data-live="1" aria-label="Find someone"></label>` + groups.map(([t, g]) => ctl(`${t} <span>${g.length}</span>`, `<div class="stars">${g.sort((a, b) => (a.days ?? 999) - (b.days ?? 999) || b.paid - a.paid).map(star).join("")}</div>`)).join("") + `<div class="row2">${btn(`${icon("plus")} Add someone`, "open", "addClient:", "accent")}${btn(`${icon("upload")} Import`, "open", "importClients:")}</div>` };
  };
  // Offers: build a voucher by sliding, and watch it print.
  STAGES.voucher = (S) => `<div class="vch"><small>${esc(S.artist.name)} · ${esc(S.artist.studio)}</small><b>${L.offPct}% off</b><em>your next sitting</em><span>Valid for ${plural(L.offDays, "day")} · until ${D.fmtDate(now() + L.offDays * D.DAY)}</span><i class="perf"></i><s>On a ${money(200000, { whole: true })} day the client saves ${money(200000 * L.offPct / 100, { whole: true })}</s></div>`;
  SEC.offers = (S, ui) => {
    const r = R.offers(S, ui);
    return { title: "Offers & vouchers", sub: "Slide to design an offer. The voucher updates as you go.", stage: stage("voucher", "", S), body: fs("L.offPct", 5, 50, 5, "Discount", "pct", { cls: "offers" }) + fs("L.offDays", 7, 90, 1, "Valid for", "days", { cls: "offers" }) + `<div class="row2">${btn("Create this offer", "makeOffer", "", "accent")}${btn("More options", "open", "offerWizard:")}</div>` + ctl("Your offers", plain(r)) };
  };
  // Supplies: a shelf you shop from, and a tray that fills toward free shipping.
  const FREE_SHIP = 15000;
  STAGES.tray = (S) => {
    const sub = S.cart.reduce((s, l) => s + l.price * l.qty, 0), n = S.cart.reduce((s, l) => s + l.qty, 0);
    return `<div class="tray"><div class="tray-items">${S.cart.slice(0, 6).map((l) => `<span class="bottle" style="--h:${(hash(l.productId) % 300) + 20}"><i></i><b>${l.qty}</b></span>`).join("") || `<span class="tray-empty">Your tray is empty</span>`}</div><div class="st-num sm"><small>${plural(n, "item")} in your cart</small><b>${money(sub, { whole: true })}</b></div><div class="ship"><i style="width:${Math.min(100, (sub / FREE_SHIP) * 100)}%"></i></div><p class="st-cap">${sub >= FREE_SHIP ? "Free shipping unlocked" : `${money(FREE_SHIP - sub, { whole: true })} more for free shipping`}</p></div>`;
  };
  SEC.supplies = (S, ui) => {
    const sups = S.suppliers.filter((s) => s.published);
    const prods = S.products.slice(0, 12);
    return { title: "Supplies", sub: "Restock from the suppliers you trust without leaving the studio.", stage: stage("tray", "", S), body: (S.cart.length ? ctl("In your cart", S.cart.map((l, i) => `<div class="cl"><span><b>${esc(l.name)}</b><em>${esc(l.variantName)} · ${money(l.price)}</em></span><span class="stp"><button ${act("cartQty", i + "|-1")} aria-label="One fewer">−</button><b>${l.qty}</b><button ${act("cartQty", i + "|1")} aria-label="One more">+</button></span></div>`).join("") + btn("Check out", "open", "cart:", "accent wide")) : "") + ctl("The shelf", `<div class="shelf">${prods.map((p) => { const v = p.variants[0], lowS = v.stock < (p.min || 8); return `<button type="button" class="prod" ${act("open", "item:" + p.id)}><span class="jar" style="--h:${hash(p.id) % 360}"><i style="height:${Math.min(100, (v.stock / 40) * 100)}%"></i></span><b>${esc(p.name)}</b><em>${money(v.price)}${lowS ? " · few left" : ""}</em></button>`; }).join("")}</div>`) + ctl("Suppliers", sups.map((s) => `<button type="button" class="led" ${act("open", "store:" + s.id)}><span class="sup-ic">${icon("store")}</span><span>${esc(s.name)}<i>${esc(s.category)}, ${esc(s.city)}</i></span>${s.linked ? `<b class="tagok">Linked</b>` : icon("chevR")}</button>`).join("")) + ctl("Orders", plain(R.supplies(S, ui))) };
  };

  // ── Settings: each one is a live preview with direct controls ──
  function defaultPolicies() {
    return [
      { id: "deposit", name: "Deposits", on: true, text: "Your deposit secures your dates and comes off the final price of each sitting." },
      { id: "reschedule", name: "Rescheduling", on: true, text: "Moving a sitting needs 72 hours' notice. Your deposit moves with you." },
      { id: "cancel", name: "Cancellations", on: true, text: "Cancelling with less than 72 hours' notice forfeits the deposit for that sitting." },
      { id: "design", name: "Design", on: false, text: "Designs are drawn for you and shown on the day. Two rounds of changes are included." },
    ];
  }
  function benchRooms(S) {
    const on = Object.values(S.hours).filter((h) => h.on).length, q = S.settings.quiet || { on: true, start: "21:00", end: "08:00" };
    const r = (k, ic, t, sub) => `<button type="button" class="srow" ${act("open", "wb:" + k)}><span class="si g-${k}">${icon(ic)}</span><span><b>${t}</b><em>${sub}</em></span>${icon("chevR")}</button>`;
    return `<div class="sgroup">${r("hours", "clock", "Hours", `${on} days a week`)}${r("services", "tag", "Services & prices", `${S.services.length} services`)}${r("split", "wallet", "Deposits", `${D.depositPercent(S)}% up front`)}${r("plan", "sparkle", "Your plan", D.TIERS[S.settings.tier].label)}</div><div class="sgroup">${r("link", "link", "Booking page", S.artist.link.enabled ? "Taking requests" : "Paused")}${r("profile", "user", "Profile", esc(S.artist.studio))}${r("alerts", "bell", "Notifications", q.on ? `Quiet ${q.start}–${q.end}` : "Always on")}${r("docs", "file", "Policies & forms", `${(S.settings.policies || defaultPolicies()).filter((p) => p.on).length} active`)}</div><div class="sgroup">${r("travel", "plane", "Travel", S.travel.length ? S.travel[0].city : "None planned")}${r("payouts", "card", "Payouts", S.artist.setup.payouts ? "Connected" : "Not set up")}${r("theme", "sparkle", "Wallpaper", (WALLS.find((x) => x[0] === curWall(S)) || WALLS[0])[1])}${r("identity", "users", "Accounts & roles", "Switch, reset, sign out")}</div>`;
  }
  const WB = {};
  const toMin = (s) => { const [a, b] = s.split(":").map(Number); return a * 60 + b; };
  const toStr = (m) => `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  function dialSVG(h) {
    const C = 130, Rr = 96, pt = (m, r) => { const a = (m / 1440) * 2 * Math.PI - Math.PI / 2; return [C + Math.cos(a) * (r || Rr), C + Math.sin(a) * (r || Rr)]; };
    const arc = (a, b) => { const [x1, y1] = pt(a), [x2, y2] = pt(b), large = (b - a + 1440) % 1440 > 720 ? 1 : 0; return `M${x1.toFixed(1)} ${y1.toFixed(1)} A${Rr} ${Rr} 0 ${large} 1 ${x2.toFixed(1)} ${y2.toFixed(1)}`; };
    let marks = "";
    for (let i = 0; i < 24; i++) { const [x1, y1] = pt(i * 60, Rr - 26), [x2, y2] = pt(i * 60, Rr - (i % 6 ? 22 : 18)); marks += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="mk${i % 6 ? "" : " big"}"/>`; if (i % 6 === 0) { const [tx, ty] = pt(i * 60, Rr - 40); marks += `<text x="${tx}" y="${ty}" text-anchor="middle" dominant-baseline="middle">${i === 0 ? "12am" : i === 12 ? "12pm" : i < 12 ? i + "am" : i - 12 + "pm"}</text>`; } }
    const s = toMin(h.start), e = toMin(h.end), [sx, sy] = pt(s), [ex, ey] = pt(e);
    return `<svg viewBox="0 0 260 260" aria-label="Working hours dial"><circle cx="${C}" cy="${C}" r="${Rr}" class="track"/>${marks}${h.on ? `<path d="${arc(s, e)}" class="open"/>${h.breaks.map((b) => `<path d="${arc(toMin(b.start), toMin(b.end))}" class="brk"/>`).join("")}<g class="hd" data-h="start"><circle cx="${sx}" cy="${sy}" r="17"/><text x="${sx}" y="${sy}" text-anchor="middle" dominant-baseline="central">☀︎</text></g><g class="hd" data-h="end"><circle cx="${ex}" cy="${ey}" r="17"/><text x="${ex}" y="${ey}" text-anchor="middle" dominant-baseline="central">☾</text></g>` : `<text x="${C}" y="${C}" text-anchor="middle" class="off">Day off</text>`}<text x="${C}" y="${C - 6}" text-anchor="middle" class="ctr">${h.on ? (toMin(h.end) - toMin(h.start)) / 60 + "h" : ""}</text><text x="${C}" y="${C + 14}" text-anchor="middle" class="ctr2">${h.on ? h.start + " – " + h.end : ""}</text></svg>`;
  }
  WB.hours = (S, ui) => {
    const key = ui.wbDay || D.DAY_KEYS[new Date().getDay()], h = S.hours[key], days = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
    const total = (x) => (x.on ? (toMin(x.end) - toMin(x.start)) / 60 : 0), week = days.reduce((s, k) => s + total(S.hours[k]), 0);
    return { title: "Hours", sub: `${Math.round(week)} hours a week. Drag the sun and moon to set ${D.DAY_NAMES[key]}.`, stage: `<div class="stage"><div class="weekbars">${days.map((k) => { const x = S.hours[k]; return `<button type="button" class="${k === key ? "sel" : ""}" data-act="set" data-path="ui.wbDay" data-v="${k}"><span><i style="top:${(toMin(x.start) / 1440) * 100}%;height:${(total(x) / 24) * 100}%;${x.on ? "" : "display:none"}"></i></span><small>${D.DAY_NAMES[k][0]}</small></button>`; }).join("")}</div><div class="dial" data-day="${key}">${dialSVG(h)}</div></div>`, body: tg(D.DAY_NAMES[key], h.on ? "A working day" : "A day off", `hours.${key}.on`, h.on) + `<p class="note">${h.breaks.length ? `The gap in the ring is your break, ${h.breaks.map((b) => b.start + " to " + b.end).join(", ")}. ` : ""}Booking suggestions only use these hours.</p>`, mount: (el) => mountDial(el, key) };
  };
  function mountDial(el, key) {
    const box = el.querySelector(".dial");
    if (!box) return;
    let which = null;
    const angleToMin = (e) => { const r = box.querySelector("svg").getBoundingClientRect(); let a = Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)) + Math.PI / 2; if (a < 0) a += 2 * Math.PI; return (Math.round(((a / (2 * Math.PI)) * 1440) / 15) * 15) % 1440; };
    box.onpointerdown = (e) => { const g = e.target.closest(".hd"); if (!g) return; which = g.dataset.h; box.setPointerCapture(e.pointerId); };
    box.onpointermove = (e) => { if (!which) return; const S = S0(), m = angleToMin(e), h = S.hours[key]; if (which === "start" && m < toMin(h.end) - 60) h.start = toStr(m); if (which === "end" && m > toMin(h.start) + 60) h.end = toStr(m); box.innerHTML = dialSVG(h); };
    box.onpointerup = () => { if (!which) return; which = null; S0().artist.setup.hours = true; D.save(S0()); window.App.refresh(); };
  }
  // Services: slide price and length; the stage shows the sitting as a time-sized card and what it earns.
  STAGES.svc = (S) => {
    const s = S.services[L.svc] || S.services[0];
    if (!s) return `<p class="st-empty">Add your first service</p>`;
    const dep = Math.round((s.price * D.depositPercent(S)) / 100);
    return `<div class="svc-prev"><div class="svc-card" style="height:${40 + (s.mins / 60) * 18}px"><img src="img/rory-${(L.svc % 7) + 1}.jpg" alt=""><span><i>10:00am – ${D.fmtTime(D.startOfDay(now()) + 10 * HOUR + s.mins * 60000)}</i><b>${esc(s.name)}</b></span></div><div class="svc-num"><div class="st-num sm"><small>Per sitting</small><b>${money(s.price, { whole: true })}</b></div><div><small>${D.duration(s.mins)}</small><b>${money(Math.round(s.price / (s.mins / 60)), { whole: true })}/h</b></div><div><small>Deposit to book</small><b>${money(dep, { whole: true })}</b></div>${s.sittings > 1 ? `<div><small>${s.sittings} sittings</small><b>${money(s.price * s.sittings, { whole: true })}</b></div>` : ""}</div></div>`;
  };
  WB.services = (S) => {
    const i = Math.min(L.svc, S.services.length - 1), s = S.services[i];
    return { title: "Services & prices", sub: "Pick a service, then slide. The card is drawn to the length of the sitting.", stage: stage("svc", "", S), body: `<div class="chips">${S.services.map((x, j) => `<button type="button" aria-pressed="${j === i}" ${act("svcPick", j)}>${esc(x.name)}</button>`).join("")}<button type="button" ${act("serviceAdd", "")}>${icon("plus")} New</button></div>` + (s ? `<label class="fld"><span>Name</span><input class="input" value="${esc(s.name)}" data-bind="S.services.${i}.name"></label>` + fs(`S.services.${i}.price`, 10000, 400000, 5000, "Price per sitting", "money", { cls: "offers" }) + fs(`S.services.${i}.mins`, 60, 600, 30, "Length", "mins", { cls: "day" }) + fs(`S.services.${i}.sittings`, 1, 10, 1, "Sittings", "int", { cls: "day" }) + `<button class="pb danger wide" ${act("serviceRemove", s.id)}>Remove ${esc(s.name)}</button>` : "") };
  };
  // Deposits: the split bar *is* the slider.
  STAGES.split = (S) => {
    const day = (S.services[0] || { price: 200000 }).price, locked = S.settings.tier === "free", pct = L.depPrev ?? D.depositPercent(S);
    const dep = Math.round((day * pct) / 100), f = D.fees(dep, S.settings.tier), fb = D.fees(day - dep, S.settings.tier);
    return `<div class="st-num sm"><small>A ${money(day, { whole: true })} day${locked && L.depPrev != null && L.depPrev !== 25 ? " · preview, Pro lets you keep this" : ""}</small></div><div class="split-legend"><div><small>Client pays to book</small><b>${money(dep + f.platform)}</b><em>${money(dep)} + ${money(f.platform)} card fee</em></div><div><small>On the day</small><b>${money(day - dep + fb.platform)}</b><em>${money(day - dep)} + ${money(fb.platform)} card fee</em></div></div><div class="keep"><small>You keep</small><b>${money(f.payout + fb.payout)}</b><em>${S.settings.tier === "free" ? `after the 2% Tattoi fee of ${money(f.artist + fb.artist)}` : "no Tattoi fee on your plan"}</em></div>`;
  };
  WB.split = (S) => {
    const locked = S.settings.tier === "free";
    if (L.depPrev == null) L.depPrev = D.depositPercent(S);
    return { title: "Deposits", sub: locked ? "Free plans take 25%. Drag to preview other splits." : "Drag the green to set how much clients pay to book.", stage: stage("split", "", S), body: fs(locked ? "L.depPrev" : "S.settings.depositPct", 10, 50, 5, "Deposit", "pct", { cls: "money big split" }) + (locked ? btn("Unlock your own deposit with Pro", "open", "wb:plan", "accent wide") : tg("Let clients pay in full", "One payment covers the whole project", "settings.allowUpfront", S.settings.allowUpfront)) };
  };
  STAGES.plan = (S) => {
    const earn = L.earn, tiers = [["free", "Free", earn - earn * 0.02], ["pro", "Pro", earn - 9900], ["top", "Studio", earn - 49900]];
    const best = tiers.reduce((a, b) => (b[2] > a[2] ? b : a)), max = Math.max(...tiers.map((t) => t[2]), 1);
    return `<div class="st-num"><small>A month of ${money(earn, { whole: true })} in payments</small><b>${best[1]}</b><em>leaves you the most</em></div><div class="plans">${tiers.map(([k, l, keep]) => `<div class="pl ${k === best[0] ? "best" : ""}"><span><i style="height:${Math.max(6, (keep / max) * 100)}%"></i></span><b>${l}</b><em>${money(keep, { whole: true })}</em>${S.settings.tier === k ? "<s>Yours</s>" : ""}</div>`).join("")}</div>`;
  };
  WB.plan = (S) => ({ title: "Your plan", sub: "Slide to a typical month. Pro pays for itself above $4,950 a month.", stage: stage("plan", "", S), body: fs("L.earn", 100000, 3000000, 50000, "Monthly takings", "money", { cls: "money big" }) + `<div class="planpick">${["free", "pro", "top"].map((k) => `<button type="button" class="${S.settings.tier === k ? "cur" : ""}" ${S.settings.tier === k ? "" : act("open", "checkout:plan|" + k)}><b>${D.TIERS[k].label}</b><em>${k === "free" ? "2% per payment, 25% deposit" : money(D.TIERS[k].priceCents, { whole: true }) + " a month, no fee, your deposit"}</em><span>${S.settings.tier === k ? "Current" : "Choose"}</span></button>`).join("")}</div><p class="note">Clients pay the 3.4% card fee on every plan.</p>` });
  // Booking page and profile: a phone that shows exactly what clients see.
  STAGES.phone = (S) => { const A = S.artist; return `<div class="phone"><div class="scr"><div class="pp-cover"><img src="img/rory-1.jpg" alt=""></div><div class="pp-me">${av("a1", "lg")}<b>${esc(A.name)}</b><span>${esc(A.styles.join(", "))} · ${esc(A.city)}</span></div><p>${esc(A.link.welcome)}</p><div class="pp-grid">${[2, 3, 4].map((n) => `<img src="img/rory-${n}.jpg" alt="">`).join("")}</div><div class="pp-steps">${A.link.steps.references ? "<i>Reference images</i>" : ""}${A.link.steps.placementPhoto ? "<i>Placement photo</i>" : ""}</div><span class="pp-btn ${A.link.enabled ? "" : "off"}">${A.link.enabled ? "Request a booking" : "Not taking requests"}</span></div></div>`; };
  WB.link = (S) => { const A = S.artist; return { title: "Booking page", sub: "Exactly what clients see. Edit below and watch it change.", stage: stage("phone", "", S), body: `<div class="url"><b>tattoi.app/${esc(A.handle)}</b><button ${act("copy", "https://tattoi.app/" + A.handle)}>Copy</button></div>` + tg("Taking requests", "Turn off when your books are full", "artist.link.enabled", A.link.enabled) + `<label class="fld"><span>Welcome message</span><textarea class="input" data-bind="S.artist.link.welcome" data-live="1">${esc(A.link.welcome)}</textarea></label>` + tg("Ask for reference images", "", "artist.link.steps.references", A.link.steps.references) + tg("Ask for a placement photo", "", "artist.link.steps.placementPhoto", A.link.steps.placementPhoto) + `<p class="note">${A.link.views} views, ${A.link.requests} requests this year.</p>` }; };
  WB.profile = (S) => ({ title: "Profile", sub: "Your profile appears on your booking page and in Discover.", stage: stage("phone", "", S), body: btn("Edit name, studio, bio and styles", "open", "profileEdit:", "accent wide") + btn("Import clients", "open", "importClients:", "wide") + btn("Connect Instagram", "open", "instagram:", "wide") });
  // Notifications: the lock screen preview, the favourite.
  STAGES.alerts = (S) => {
    const a = S.settings.alerts, q = S.settings.quiet;
    const samples = [["messages", "chat", "Mia Chen", "Could we add a few more gum leaves around the elbow?"], ["bookings", "sparkle", "New request", "Elena Rodriguez asked about a half sleeve"], ["payments", "card", "Deposit paid", "Maya Patel paid $500 for 3 Nov"], ["updates", "bell", "Tattoi", "A new version is ready"]];
    return `<div class="lk-time sm">${new Date().toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit" }).replace(/\s?(am|pm)/i, "")}</div><div class="lk-date">${new Date().toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long" })}</div><div class="lk-stack">${samples.filter(([k]) => a[k]).map(([, ic, t, b], i) => `<div class="nt" style="--i:${i}"><i>${icon(ic)}</i><span><b>${t}</b>${b}</span><small>now</small></div>`).join("") || `<p class="nt empty">Nothing will come through</p>`}</div>${q.on ? `<div class="quiet">${icon("moon")} Quiet ${q.start}–${q.end}</div>` : ""}`;
  };
  WB.alerts = (S) => {
    const a = S.settings.alerts, q = S.settings.quiet || (S.settings.quiet = { on: true, start: "21:00", end: "08:00" });
    return { title: "Notifications", sub: "Your lock screen, as it will look.", stage: stage("alerts", "", S, "lock"), body: tg("Messages", "From clients and suppliers", "settings.alerts.messages", a.messages) + tg("Bookings and requests", "", "settings.alerts.bookings", a.bookings) + tg("Payments", "Deposits, balances, payouts", "settings.alerts.payments", a.payments) + tg("App updates", "", "settings.alerts.updates", a.updates) + tg("Quiet hours", "Hold alerts overnight", "settings.quiet.on", q.on) + (q.on ? `<div class="two"><label class="fld"><span>From</span><input class="input" type="time" value="${q.start}" data-bind="S.settings.quiet.start"></label><label class="fld"><span>Until</span><input class="input" type="time" value="${q.end}" data-bind="S.settings.quiet.end"></label></div>` : "") + btn("Saved replies", "open", "templates:" + (S.convos.find((c) => c.a === "a1") || {}).id, "wide") };
  };
  // Policies: the client's phone showing what they agree to when booking.
  STAGES.docs = (S) => { const P = S.settings.policies || defaultPolicies(); return `<div class="phone"><div class="scr doc"><b class="doc-h">Before you book with ${esc(first("a1"))}</b>${P.filter((p) => p.on).map((p) => `<div class="doc-p"><b>${esc(p.name)}</b><p>${esc(p.text)}</p></div>`).join("") || "<p>No policies shown.</p>"}<span class="pp-btn">I agree</span></div></div>`; };
  WB.docs = (S, ui) => {
    const P = S.settings.policies || (S.settings.policies = defaultPolicies());
    return { title: "Policies & forms", sub: "Clients agree to these when they book. The phone shows their screen.", stage: stage("docs", "", S), body: P.map((p, i) => `<div class="paper ${p.on ? "" : "off"}">${tg(esc(p.name), p.on ? "Shown to clients" : "Hidden", `settings.policies.${i}.on`, p.on)}${ui.docOpen === p.id ? `<textarea class="input" data-bind="S.settings.policies.${i}.text" data-live="1">${esc(p.text)}</textarea>` : `<button class="paper-t" data-act="set" data-path="ui.docOpen" data-v="${p.id}">${esc(p.text)} <u>Edit</u></button>`}</div>`).join("") + btn(`Consent and medical forms · ${S.forms.filter((f) => f.artistId === "a1" && f.status === "signed").length} signed`, "open", "formsAdmin:", "wide") };
  };
  // Travel: a six-month flight ribbon with stamps.
  STAGES.travel = (S) => {
    const start = D.startOfDay(now()), span = 180 * D.DAY;
    const months = Array.from({ length: 6 }, (_, i) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() + i); return d; });
    return `<div class="rib"><div class="rib-m">${months.map((m) => `<span>${m.toLocaleDateString("en-AU", { month: "short" })}</span>`).join("")}</div><div class="rib-r"><i class="rib-home">${esc(S.artist.city)}</i>${S.travel.map((t) => { const l = ((t.from - start) / span) * 100, w = Math.max(2, ((t.to - t.from + D.DAY) / span) * 100); return `<span class="trip" style="left:${Math.max(0, l)}%;width:${w}%"></span><span class="stamp" style="left:${Math.max(0, Math.min(70, l))}%"><b>${esc(t.city)}</b><small>${D.fmtDate(t.from)}</small></span>`; }).join("")}</div></div>`;
  };
  WB.travel = (S) => ({ title: "Travel", sub: "Days away are blocked from bookings automatically.", stage: stage("travel", "", S), body: S.travel.map((t) => `<div class="tg"><span><b>${esc(t.city)}</b><em>${esc(t.place)}, ${D.fmtDate(t.from)} to ${D.fmtDate(t.to)}</em></span><button class="pb sm" ${act("travelRemove", t.id)}>Remove</button></div>`).join("") + btn(`${icon("plus")} Plan a trip`, "open", "travel:", "accent wide") });
  STAGES.card = (S) => { const on = S.artist.setup.payouts, bal = V.balance(S); return `<div class="bcard ${on ? "" : "off"}"><span>Tattoi payouts</span><b>${on ? "Westpac •••• 4821" : "No account yet"}</b><em>${esc(S.artist.name)}</em><i></i></div>${on ? `<div class="drops">${[0, 1, 2, 3].map((i) => `<div><small>${D.fmtDate(D.at(i * 7 + 2, 0))}</small><b>${i === 0 && bal.next ? money(bal.transit, { whole: true }) : "~" + money(Math.round(bal.available / 2), { whole: true })}</b></div>`).join("")}</div>` : ""}`; };
  WB.payouts = (S) => ({ title: "Payouts", sub: S.artist.setup.payouts ? "Payments land in your bank every week." : "Connect a bank account so deposits reach you.", stage: stage("card", "", S), body: S.artist.setup.payouts ? btn("Open Money", "open", "st:money", "wide") : btn("Connect with Stripe", "open", "bank:", "accent wide") });
  WB.identity = (S) => ({ title: "Accounts & roles", sub: "Tap a pass to see Tattoi as that person.", stage: `<div class="stage"><div class="passes">${Object.entries(window.Views.roles).map(([k, r], i) => `<button type="button" class="pass p${i} ${S.role === k ? "cur" : ""}" ${act("role", k)}><span>${esc(r.label)}</span><b>${esc(person(r.persona).name)}</b>${av(r.persona)}<em>${S.role === k ? "You're here" : "Switch"}</em></button>`).join("")}</div></div>`, body: btn("Sample data and sign out", "open", "account:", "wide") });

  // A notification group that can expand: collapsed it shows a glance; "Show more" grows it to about twice
  // the height and lets it scroll on its own. At its top or bottom edge the same swipe carries on into the
  // page (native scroll chaining), and only one group is open at a time.
  const nt = (ic, title, body, when, arg, img, cls) => `<button type="button" class="nt ${cls || ""}" ${arg ? act("open", arg) : ""}>${img ? `<img src="${img}" alt="">` : `<i>${icon(ic)}</i>`}<span><b>${title}</b>${body}</span><small>${when || ""}</small></button>`;
  const grp = (key, ic, name, arg, items, peek) => `<section class="grp" data-grp="${key}"><button type="button" class="grp-h" ${act("open", arg)}><i>${icon(ic)}</i><b>${name}</b><span>Open ${icon("chevR")}</span></button><div class="gb" data-peek="${peek || 2}">${items.join("")}</div><button type="button" class="gx" ${act("grpToggle", key)} aria-expanded="false" hidden><span>Show more</span>${icon("chevD")}</button></section>`;
  const relT = (t) => { const m = Math.round((t - now()) / 60000); return m < 1 ? "now" : m < 60 ? `in ${m} min` : D.sameDay(t, now()) ? D.fmtTime(t) : D.fmtRel(t); };
  const readyLine = (S, a) => { const forms = S.forms.filter((f) => f.apptId === a.id); return [a.price === 0 ? "" : a.paid > 0 ? "✓ Deposit" : "! No deposit", forms.length ? (forms.every((f) => f.status === "signed") ? "✓ Forms" : "! Form") : ""].filter(Boolean).join(" · "); };
  function todayCard(S) {
    const t = now(), items = mine(S).filter((a) => D.sameDay(a.start, t) && a.status !== "cancelled").sort((a, b) => a.start - b.start);
    const key = D.DAY_KEYS[new Date().getDay()], h = S.hours[key];
    let s0 = D.startOfDay(t) + (h && h.on ? toMin(h.start) : 9 * 60) * 60000, s1 = D.startOfDay(t) + (h && h.on ? toMin(h.end) : 18 * 60) * 60000;
    items.forEach((a) => { s0 = Math.min(s0, a.start); s1 = Math.max(s1, a.start + a.mins * 60000); });
    const x = (v) => ((v - s0) / (s1 - s0)) * 100;
    const done = items.filter((a) => a.start + a.mins * 60000 <= t).length;
    const left = items.reduce((s, a) => s + Math.max(0, a.start + a.mins * 60000 - Math.max(t, a.start)), 0) / HOUR;
    const ticks = []; for (let hh = Math.ceil(s0 / HOUR) * HOUR; hh <= s1; hh += 3 * HOUR) ticks.push(`<s style="left:${x(hh)}%">${new Date(hh).toLocaleTimeString("en-AU", { hour: "numeric" }).replace(" ", "").toLowerCase()}</s>`);
    const head = items.length ? (done === items.length ? `All ${items.length} done today` : `${done} of ${items.length} done · ${left.toFixed(1).replace(".0", "")}h left in the chair`) : "Nothing booked today";
    return `<button type="button" class="today" ${act("open", "st:day")}><span class="td-h"><b>Today</b><em>${head}</em></span><span class="td-line">${items.map((a) => { const fin = a.start + a.mins * 60000 <= t, lv = a.start <= t && !fin; return `<img src="${photo(a.projectId)}" alt="" class="${fin ? "fin" : ""}${lv ? " lv" : ""}${a.status === "proposed" ? " prop" : ""}" style="left:${x(a.start)}%;width:calc(${x(a.start + a.mins * 60000) - x(a.start)}% - 3px)">`; }).join("")}${t > s0 && t < s1 ? `<i style="left:${x(t)}%"></i>` : ""}</span><span class="td-ticks">${ticks.join("")}</span></button>`;
  }
  function weekStrip(S) {
    const days = Array.from({ length: 7 }, (_, i) => D.startOfDay(now()) + i * D.DAY);
    return `<div class="wk">${days.map((d, i) => { const it = mine(S).filter((a) => D.sameDay(a.start, d) && !a.consult); const hrs = it.reduce((s, a) => s + a.mins, 0) / 60; const dd = new Date(d); const away = S.travel.some((t) => d >= D.startOfDay(t.from) && d <= t.to); return `<button type="button" class="${i === 0 ? "td" : ""}" ${act("calOpen", i)} aria-label="${esc(dayLong(d))}: ${it.length ? plural(it.length, "sitting") : "free"}"><small>${dd.toLocaleDateString("en-AU", { weekday: "narrow" })}</small>${away ? `<span class="wk-away">${icon("plane")}</span>` : ring(hrs / 8, 36, dd.getDate())}<em>${it.length ? Math.round(hrs) + "h" : "free"}</em></button>`; }).join("")}</div>`;
  }
  // Mini endless calendar inside the expanded Calendar group: one slim row per day, loading more as you scroll.
  const MINI_MAX = 90;
  // Each day is the same card the Calendar page uses: photo cards sized to the length of each sitting.
  const miniDay = (S, i) => dayBlock(S, D.startOfDay(now()) + i * D.DAY);
  const miniRange = (S, a, b) => { let h = ""; for (let i = a; i < b; i++) h += miniDay(S, i); return h; };
  function miniCal(S) {
    const n = Math.min(MINI_MAX, L.miniN || 14);
    return `<div class="mini-cal" data-n="${n}">${miniRange(S, 1, n)}${n >= MINI_MAX ? btn("Open full calendar", "open", "st:day", "wide") : `<i class="mc-more">Loading more days</i>`}</div>`;
  }
  // Loads more days when the open Calendar group nears its bottom. Stops at MINI_MAX so the swipe can hand
  // off to the page again.
  function growMini(gb) {
    const mc = gb.querySelector(".mini-cal");
    if (!mc || gb.scrollHeight - gb.scrollTop - gb.clientHeight > 300) return;
    const n = +mc.dataset.n;
    if (n >= MINI_MAX) return;
    const m = Math.min(MINI_MAX, n + 14), more = mc.querySelector(".mc-more");
    more.insertAdjacentHTML("beforebegin", miniRange(S0(), n, m));
    mc.dataset.n = L.miniN = m;
    if (m >= MINI_MAX) more.outerHTML = btn("Open full calendar", "open", "st:day", "wide");
  }
  function home(S) {
    const t = now(), today = mine(S).filter((a) => D.sameDay(a.start, t)).sort((a, b) => a.start - b.start);
    const upcoming = today.filter((a) => a.start + a.mins * 60000 > t && a.status !== "cancelled");
    const tomorrow = mine(S).filter((a) => a.start > D.startOfDay(t) + D.DAY && a.status === "confirmed").sort((a, b) => a.start - b.start)[0];
    const leads = newLeads(S), ppl = peopleList(S).filter((x) => x.next).sort((a, b) => a.days - b.days);
    const bal = V.balance(S), tasks = (S.tasks || []).filter((x) => !x.quiet);
    const tx = S.txns.filter((x) => x.artistId === "a1").sort((a, b) => b.at - a.at).slice(0, 12);
    const tki = { request: "sparkle", deposit: "card", form: "pen", balance: "wallet", reply: "chat", waitlist: "hourglass", setup: "shield", followup: "clock" };
    const cal = [todayCard(S), ...(upcoming.length ? upcoming.map((a) => nt("", esc(person(a.clientId).name), `${esc(a.consult ? "Consultation" : project(a.projectId).name)}${readyLine(S, a) ? " · " + readyLine(S, a) : ""}`, relT(a.start), "session:" + a.id, photo(a.projectId), a.start <= t ? "live" : "")) : [nt("check", "Done for today", tomorrow ? `Next: ${esc(person(tomorrow.clientId).name)}, ${esc(D.fmtRel(tomorrow.start))}` : "Nothing else booked", "", tomorrow ? "session:" + tomorrow.id : "st:day")]), `<h4 class="gsub">Coming up</h4>`, miniCal(S)];
    const body = `<div class="land">${stage("lock", "", S, "lock top")}
      ${grp("cal", "cal", "Calendar", "st:day", cal, 1 + Math.min(2, Math.max(1, upcoming.length)))}
      ${tasks.length ? grp("needs", "bell", "Needs you", "st:req", tasks.map((x) => nt(tki[x.kind] || "bell", esc(x.title), esc(x.context || ""), "now", "task:" + x.key))) : ""}
      ${leads.length ? grp("req", "sparkle", "Requests", "st:req", [`<div class="posts">${leads.map(postcard).join("")}</div>`, ...leads.map((l) => nt("sparkle", esc(person(l.clientId).name), `${esc(l.project)} · ${esc(l.budget)}`, esc(D.fmtRel(l.at || now())), "lead:" + l.id))], 1) : ""}
      ${grp("money", "wallet", "Money", "st:money", [nt("wallet", `${money(bal.available, { whole: true })} ready to pay out`, `${money(ahead(S), { whole: true })} booked over the next 8 weeks`, bal.next ? D.fmtDate(bal.next.at) : "", "st:money"), `<div class="mini-river">${river(S, 340, 110, 99)}</div>`, `<h4 class="gsub">Latest payments</h4>`, ...tx.map((x) => nt("", esc(person(x.clientId).name), `${esc(x.kind)} · ${money(x.base, { whole: true })}`, D.fmtDate(x.at), "txn:" + x.id, Art.photoFor ? null : null))], 2)}
      ${ppl.length ? grp("people", "users", "People", "st:people", [`<div class="pp-row">${ppl.slice(0, 5).map((x) => `<button type="button" ${act("open", "client:" + x.p.id)}>${orb(x, 46)}<b>${esc(first(x.p.id))}</b><small>${x.days === 0 ? "Today" : x.days === 1 ? "Tomorrow" : "in " + x.days + "d"}</small></button>`).join("")}</div>`, ...ppl.map((x) => nt("user", esc(x.p.name), `${esc(x.proj ? x.proj.name : "Booked")} · ${money(x.paid, { whole: true })} spent`, x.days === 0 ? "today" : x.days === 1 ? "tomorrow" : `in ${x.days}d`, "client:" + x.p.id))], 1) : ""}
      ${grp("offers", "gift", "Offers", "st:offers", S.offers.filter((o) => !o.archived).map((o) => nt("gift", esc(o.name), o.expiresAt ? `Ends ${D.fmtDate(o.expiresAt)}` : "No end date", "", "offer:" + o.id)))}
      ${grp("supplies", "bag", "Supplies", "st:supplies", [...(S.cart.length ? S.cart.map((l) => nt("bag", esc(l.name), `${esc(l.variantName)} · × ${l.qty}`, money(l.price * l.qty, { whole: true }), "cart:")) : [nt("bag", "Restock from your suppliers", `${S.products.length} products available`, "", "st:supplies")]), ...S.products.slice(0, 10).map((p) => nt("tag", esc(p.name), `${money(p.variants[0].price)} · ${esc(S.suppliers.find((s) => s.id === p.supplierId)?.name || "")}`, "", "item:" + p.id))], 2)}
      <p class="foot-hint">Settings live behind your photo, top right.</p></div>`;
    return { raw: true, big: "", cond: "", body };
  }
  // The open group never stretches or bounces at its edges. Instead, once it can't scroll any further, the
  // rest of the swipe moves the page, the way scroll chaining feels on iOS.
  function handOff(gb) {
    const page = () => gb.closest(".scroller");
    const edge = (dy) => (dy > 0 && gb.scrollTop + gb.clientHeight >= gb.scrollHeight - 1) || (dy < 0 && gb.scrollTop <= 0);
    gb.addEventListener("wheel", (e) => { if (!gb.closest(".grp.open") || !edge(e.deltaY)) return; e.preventDefault(); page().scrollTop += e.deltaY; }, { passive: false });
    let y = null;
    gb.addEventListener("touchstart", (e) => { y = e.touches[0].clientY; }, { passive: true });
    gb.addEventListener("touchmove", (e) => {
      if (y === null || !gb.closest(".grp.open")) return;
      const ny = e.touches[0].clientY, dy = y - ny;
      y = ny;
      if (!edge(dy)) return;
      e.preventDefault();
      page().scrollTop += dy;
    }, { passive: false });
    gb.addEventListener("touchend", () => (y = null), { passive: true });
  }
  // Size each group: collapsed shows its first few items; expanded is about twice that and scrolls.
  function sizeGroups(root) {
    root.querySelectorAll(".grp").forEach((g) => {
      const gb = g.querySelector(".gb"), kids = [...gb.children], n = +gb.dataset.peek || 2, btn = g.querySelector(".gx");
      if (!kids.length) return;
      const last = kids[Math.min(n, kids.length) - 1];
      const ch = last.offsetTop + last.offsetHeight - gb.offsetTop;
      const full = gb.scrollHeight;
      gb.style.setProperty("--ch", ch + "px");
      gb.style.setProperty("--xh", (g.dataset.grp === "cal" ? Math.max(ch * 2, 560) : Math.min(full, Math.max(ch * 2, 360))) + "px");
      if (g.dataset.grp === "cal" && !gb.dataset.grow) { gb.dataset.grow = 1; gb.addEventListener("scroll", () => growMini(gb), { passive: true }); }
      btn.hidden = full <= ch + 4;
      const open = L.grp === g.dataset.grp && !btn.hidden;
      g.classList.toggle("open", open);
      requestAnimationFrame(() => g.classList.toggle("more", open && gb.scrollHeight - gb.scrollTop - gb.clientHeight > 8));
      if (!gb.dataset.hand) { gb.dataset.hand = 1; handOff(gb); }
      if (!gb.dataset.fade) { gb.dataset.fade = 1; gb.addEventListener("scroll", () => g.classList.toggle("more", gb.scrollHeight - gb.scrollTop - gb.clientHeight > 8), { passive: true }); }
      btn.setAttribute("aria-expanded", open);
      btn.querySelector("span").textContent = open ? "Show less" : `Show more${kids.length > n ? ` · ${kids.length - n}` : ""}`;
    });
  }
  // Wallpapers: the same design in different colourways. Previews are tiny lock screens in each one.
  const WALLS = [["violet", "Midnight", "linear-gradient(170deg,#1b1840,#2e2766 38%,#4b3592 72%,#7a4cad)", "#ff6a5c"], ["ocean", "Ocean", "linear-gradient(170deg,#071a33,#0b3157 40%,#10577a 75%,#1b8a9a)", "#ffb340"], ["sunset", "Sunset", "linear-gradient(170deg,#2a1033,#6b1f4f 40%,#c2455a 75%,#f08a5d)", "#ffd166"], ["forest", "Forest", "linear-gradient(170deg,#0c1f17,#173a2b 40%,#2b5e45 75%,#5c8f6a)", "#f2c14e"], ["graphite", "Graphite", "linear-gradient(170deg,#121417,#262a31 40%,#3e4550 75%,#66707e)", "#0a84ff"], ["rose", "Rosé", "linear-gradient(170deg,#2b0f1e,#5c1a3a 40%,#a03a63 75%,#e07a9a)", "#ffffff"], ["dawn", "Dawn", "linear-gradient(170deg,#3b3a7a,#7a6cc2 40%,#d89bc4 75%,#ffc39a)", "#ff5e7e"]];
  const curWall = (S) => S.settings.wall || "violet";
  STAGES.wall = (S) => { const w = WALLS.find((x) => x[0] === curWall(S)) || WALLS[0]; return `<div class="st-num" style="text-align:center"><small>Wallpaper</small><b>${w[1]}</b><em>Every screen, every card, same design</em></div>`; };
  WB.theme = (S) => ({ title: "Wallpaper", sub: "Pick a colourway. Everything else stays the same.", stage: stage("wall", "", S), body: `<div class="walls">${WALLS.map(([k, name, bg, a]) => `<button type="button" class="wall" aria-pressed="${curWall(S) === k}" ${act("setWall", k)}><span class="wall-ph" style="background:${bg};--a:${a}"><b>9:41</b><small>Wednesday</small><i></i><i></i><i></i></span><span>${name}</span></button>`).join("")}</div>` });
  WB.index = (S) => ({ title: "Settings", sub: "Everything that shapes how you work.", stage: "", body: benchRooms(S) });
  // ── Client ──────────────────────────────────────────────
  STAGES.clock = (S) => {
    const next = S.appts.filter((a) => a.clientId === "c1" && a.status === "confirmed" && a.start > now()).sort((a, b) => a.start - b.start)[0];
    const care = D.aftercareFor(S, "c1"), t = new Date();
    return `<div class="lk-time">${t.toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit" }).replace(/\s?(am|pm)/i, "")}</div><div class="lk-date">${t.toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long" })}</div><div class="lk-widgets">${next ? `<button type="button" ${act("open", "project:" + next.projectId)}>${ring(1 - Math.min(1, D.daysBetween(now(), next.start) / 60), 58, D.daysBetween(now(), next.start) + "d")}<small>to next sitting</small></button>` : ""}${care ? `<button type="button" ${act("open", "project:" + care.appt.projectId)}>${ring(care.day / 30, 58, "D" + care.day)}<small>${esc(care.phase.label.toLowerCase())}</small></button>` : ""}<button type="button" ${act("open", "formsList:")}>${ring(0, 58, S.forms.filter((f) => f.clientId === "c1" && f.status === "pending").length)}<small>forms to sign</small></button></div>${next ? `<button type="button" class="lk-live" ${act("open", "project:" + next.projectId)}><img src="${photo(next.projectId)}" alt=""><span><small>Next sitting ${esc(D.fmtRel(next.start))}</small><b>${esc(project(next.projectId).name)}</b><em>with ${esc(person(next.artistId).name)} · ${sit(next)}</em></span></button>` : ""}${care ? `<div class="lk-stack"><div class="nt"><i>${icon("drop")}</i><span><b>Aftercare, day ${care.day}</b>${esc(care.phase.tip || care.phase.label)}</span><small>today</small></div></div>` : ""}`;
  };

  STAGES.ctat = (S) => { const ps = S.projects.filter((p) => p.clientId === "c1"); return `<div class="posts">${ps.map((p) => { const ap = S.appts.filter((a) => a.projectId === p.id), done = ap.filter((a) => a.status === "completed").length; return `<button type="button" class="post tall" ${act("open", "project:" + p.id)}><img src="${photo(p.id)}" alt=""><span><i>${done} of ${ap.length || 1} sittings</i><b>${esc(p.name)}</b><em>with ${esc(person(p.artistId).name)}</em>${ring(done / Math.max(1, ap.length), 40, "")}</span></button>`; }).join("")}</div>`; };
  STAGES.cdisc = (S) => { const art = Object.values(S.people).filter((p) => p.role === "artist"); return `<div class="posts">${art.map((a) => `<button type="button" class="post tall" ${act("open", "artist:" + a.id)}><img src="${Art.url(Art.STYLE_MOTIF[a.styles[0]] || "mandala", a.id + "-0", 300, 300)}" alt=""><span><i>${esc((a.styles || []).join(", "))}</i><b>${esc(a.name)}</b><em>${esc(a.city || "")}</em></span></button>`).join("")}</div>`; };
  STAGES.cme = (S) => { const c = person("c1"); return `<div class="pass p1 solo"><span>Tattoi client</span><b>${esc(c.name)}</b>${av("c1")}<em>${S.issued.filter((v) => v.clientId === "c1").length} vouchers · ${S.projects.filter((p) => p.clientId === "c1").length} projects</em></div>`; };
  const CS = {
    tattoos: (S, ui) => ({ title: "My tattoos", sub: "Swipe through your work.", stage: stage("ctat", "", S, "flush"), body: ctl("", plain(R.tattoos(S, ui))) }),
    discover: (S, ui) => ({ title: "Discover", sub: "Artists whose work suits your idea.", stage: stage("cdisc", "", S, "flush"), body: ctl("", plain(R.discover(S, ui))) }),
    messages: (S, ui) => ({ title: "Messages", sub: "", stage: stage("lock2", "c1", S, "lock"), body: ctl("", plain(R.cinbox(S, ui))) }),
    me: (S, ui) => ({ title: "You", sub: "", stage: stage("cme", "", S), body: btn(`${icon("sparkle")} Wallpaper · ${(WALLS.find((x) => x[0] === curWall(S)) || WALLS[0])[1]}`, "open", "wb:theme", "wide") + ctl("", plain(R.me(S, ui))) }),
  };
  STAGES.lock2 = (S, who) => { const cs = S.convos.filter((c) => c.a === who || c.b === who || c.c === who).slice(0, 3); return `<div class="lk-stack">${cs.map((c, i) => { const m = c.msgs[c.msgs.length - 1] || {}; const other = [c.a, c.b].find((x) => x !== who) || c.a; return `<button type="button" class="nt" style="--i:${i}" ${act("open", "chat:" + c.id)}><i>${icon("chat")}</i><span><b>${esc(person(other).name)}</b>${esc((m.text || "Sent a card").slice(0, 70))}</span><small>${m.at ? esc(D.fmtRel(m.at)) : ""}</small></button>`; }).join("") || `<p class="nt empty">No conversations yet</p>`}</div>`; };

  // ── Supplier ────────────────────────────────────────────
  STAGES.belt = (S) => {
    const os = S.supplyOrders.filter((o) => o.supplierId === "m1").sort((a, b) => b.at - a.at).slice(0, 8);
    const lanes = [["paid", "To pack"], ["fulfilled", "On the way"], ["delivered", "Delivered"]];
    return `<div class="belt">${lanes.map(([k, t]) => `<div class="lane"><small>${t}</small>${os.filter((o) => o.status === k).map((o) => `<button type="button" class="box ${k}" ${act("open", "order:" + o.id)}><b>#${o.number}</b><em>${money(o.total, { whole: true })}</em></button>`).join("") || "<i>—</i>"}</div>`).join("")}</div>`;
  };
  STAGES.stock = (S) => {
    const ps = S.products.filter((p) => p.supplierId === "m1"), p = ps[L.var] || ps[0];
    if (!p) return "";
    return `<div class="shelf st">${ps.slice(0, 8).map((x, i) => { const st = x.variants.reduce((s, v) => s + v.stock, 0); return `<button type="button" class="prod ${i === L.var ? "sel" : ""}" ${act("varPick", i)}><span class="jar" style="--h:${hash(x.id) % 360}"><i style="height:${Math.min(100, (st / 60) * 100)}%"></i></span><b>${esc(x.name)}</b><em>${st} left${st < (x.min || 8) ? " · low" : ""}</em></button>`; }).join("")}</div>`;
  };

  STAGES.storefront = (S) => { const ps = S.products.filter((p) => p.supplierId === "m1" && p.published).slice(0, 4); return `<div class="phone"><div class="scr"><div class="pp-me pad"><b>${esc(S.store.business.name)}</b><span>${S.store.published ? "Open on Tattoi" : "Hidden from artists"}</span></div><div class="pp-grid two">${ps.map((p) => `<div class="pp-prod"><span class="jar" style="--h:${hash(p.id) % 360}"><i style="height:70%"></i></span><b>${esc(p.name)}</b><em>${money(p.variants[0].price)}</em></div>`).join("")}</div></div></div>`; };
  const SS = {
    orders: (S, ui) => ({ title: "Orders", sub: "Orders move along the belt as you pack and ship.", stage: stage("belt", "", S), body: ctl("", plain(R.orders(S, ui))) }),
    products: (S, ui) => {
      const ps = S.products.filter((p) => p.supplierId === "m1"), i = Math.min(L.var, ps.length - 1), p = ps[i], pi = S.products.indexOf(p);
      return { title: "Stock", sub: "Tap a jar, then slide to count stock.", stage: stage("stock", "", S), body: (p ? ctl(esc(p.name), p.variants.map((v, j) => fs(`S.products.${pi}.variants.${j}.stock`, 0, 120, 1, v.name, "int", { cls: v.stock < (p.min || 8) ? "warn" : "supplies" })).join("") + btn("Edit product", "open", "product:" + p.id, "wide")) : "") + btn(`${icon("plus")} New product`, "open", "product:new", "accent wide") + ctl("All products", plain(R.products(S, ui))) };
    },
    sinbox: (S, ui) => ({ title: "Messages", sub: "", stage: stage("lock2", "m1", S, "lock"), body: ctl("", plain(R.sinbox(S, ui))) }),
    store: (S, ui) => ({ title: "Store", sub: "Your storefront as artists see it.", stage: stage("storefront", "", S), body: tg("Visible to artists", "", "store.published", S.store.published) + btn(`${icon("sparkle")} Wallpaper · ${(WALLS.find((x) => x[0] === curWall(S)) || WALLS[0])[1]}`, "open", "wb:theme", "wide") + ctl("", plain(R.store(S, ui))) }),
  };

  // Fill this day: every way to turn an empty day into a booked one, with a live preview of the day.
  STAGES.fill = (S, d) => {
    d = Number(d);
    const h = S.hours[D.DAY_KEYS[new Date(d).getDay()]], open = h && h.on;
    const svc = S.services[0] || { price: 200000, mins: 480 };
    const s0 = toMin(open ? h.start : "09:30"), s1 = toMin(open ? h.end : "17:30");
    const offered = S.waitlist.filter((w) => w.status === "offered" && w.offer && D.sameDay(w.offer.start, d)).length;
    const free = freeMins(S, d), booked = mine(S).filter((a) => D.sameDay(a.start, d) && a.status !== "cancelled").length;
    const worth = Math.round((svc.price / svc.mins) * free / 5000) * 5000;
    return `<div class="st-num"><small>${esc(dayLong(d))}${open ? "" : " · usually a day off"}</small><b>${money(worth, { whole: true })}</b><em>open to earn · ${D.duration(free)} free${booked ? ` around ${plural(booked, "booking")}` : ` · ${toStr(s0)}–${toStr(s1)}`}</em></div><div class="fill-day"><span class="fd-ghost"><b>${offered ? `Offered to ${plural(offered, "client")}` : booked ? "Room for more" : "Your empty day"}</b><em>${D.duration(free)} free</em></span></div>`;
  };
  Sheets.fill = (arg, S) => {
    const d = Number(arg), t = d + toMin((S.hours[D.DAY_KEYS[new Date(d).getDay()]] || {}).start || "09:30") * 60000;
    const wait = S.waitlist.filter((w) => w.artistId === "a1" && w.status === "waiting");
    const unbooked = S.projects.filter((p) => p.artistId === "a1" && !S.appts.some((a) => a.projectId === p.id && a.start > now() && a.status !== "cancelled") && S.appts.some((a) => a.projectId === p.id && a.total > a.idx)).slice(0, 6);
    const leads = newLeads(S);
    const opt = (ic, title, body, a, arg2, img) => `<button type="button" class="nt" ${act(a, arg2)}>${img ? `<img src="${img}" alt="">` : `<i>${icon(ic)}</i>`}<span><b>${title}</b>${body}</span><small>${icon("chevR")}</small></button>`;
    const body = [
      wait.length ? `<h4 class="gsub">Ready to come in sooner</h4>${wait.map((w) => opt("hourglass", `Offer it to ${esc(person(w.clientId).name)}`, `On your waitlist for ${esc(project(w.projectId).name.toLowerCase())}`, "fillWait", `${w.id}|${t}`, photo(w.projectId))).join("")}` : "",
      unbooked.length ? `<h4 class="gsub">Next sitting not booked yet</h4>${unbooked.map((p) => opt("cal", `Book ${esc(first(p.clientId))}'s next sitting`, esc(p.name), "open", `composer:date=${d}`, photo(p.id))).join("")}` : "",
      leads.length ? `<h4 class="gsub">Waiting on a reply</h4>${leads.slice(0, 3).map((l) => opt("sparkle", `Quote ${esc(first(l.clientId))} for this day`, `${esc(l.project)} · ${esc(l.budget)}${(S.holds || {})[l.clientId] === d ? " · date saved" : ""}`, "fillQuote", `${l.clientId}|${d}|${l.id}`, leadImg(l, 120))).join("")}` : "",
      `<h4 class="gsub">Reach more people</h4>${opt("gift", "Post a last-minute offer", `${L.offPct}% off a sitting on ${esc(D.fmtDate(d))}, sent to your clients`, "fillOffer", d)}${opt("link", S.artist.link.enabled ? "Share your booking page" : "Open your booking page", S.artist.link.enabled ? `tattoi.app/${esc(S.artist.handle)}` : "It's paused, so new clients can't ask", S.artist.link.enabled ? "copy" : "toggle", S.artist.link.enabled ? "https://tattoi.app/" + S.artist.handle : "artist.link.enabled")}`,
      `<h4 class="gsub">Or</h4>${opt("plus", "Book someone yourself", "Choose a client, a project and a time", "open", `composer:date=${d}`)}`,
    ].join("");
    return { title: freeMins(S, d) < (480) && mine(S).some((a) => D.sameDay(a.start, d)) ? "Fill the gap" : "Fill this day", plain: true, sub: "Everyone who could take it, best match first.", body: stage("fill", d, S) + `<div class="ctls fill">${body}${fs("L.offPct", 5, 40, 5, "Last-minute discount", "pct", { cls: "offers" })}</div>` };
  };
  // The booking wizard: when you saved a day for this client from "Fill this day", the dates step offers it.
  const composer0 = Sheets.composer;
  Sheets.composer = (arg, S, ui, draft) => {
    const r = composer0(arg, S, ui, draft), c = draft.comp, d = c && (S.holds || {})[c.clientId];
    if (!c || c.step !== 2 || !d || d < D.startOfDay(now())) return r;
    const using = c.dates.length && D.sameDay(c.dates[0], d);
    const card = `<div class="held ${using ? "on" : ""}"><span class="held-d"><small>${new Date(d).toLocaleDateString("en-AU", { weekday: "short" })}</small><b>${new Date(d).getDate()}</b></span><span class="held-t"><b>${using ? "Using the day you saved" : "The day you saved for " + esc(first(c.clientId))}</b><em>${esc(dayLong(d))}${c.sittings > 1 ? `, then ${plural(c.sittings - 1, "more sitting")} after` : ""}</em></span>${using ? `<span class="held-ok">${icon("check")}</span>` : `<button type="button" class="held-use" ${act("compHeld", "")}>Use</button>`}<button type="button" class="held-x" ${act("compHeldDrop", "")} aria-label="Forget this day">${icon("x")}</button></div>`;
    return Object.assign({}, r, { body: card + r.body });
  };
  Sheets.composer.init = composer0.init;

  // ── Register sheets ─────────────────────────────────────
  const wrap = (fn) => (arg, S, ui, draft) => { const r = fn(S, ui, draft, arg); return { title: r.title, plain: true, sub: r.sub, body: (r.stage || "") + `<div class="ctls">${r.body}</div>`, foot: r.foot || "", mount: r.mount }; };
  Object.assign(window.Sheets, {
    st: (arg, S, ui, d) => wrap(SEC[arg])(arg, S, ui, d),
    wb: (arg, S, ui, d) => wrap(WB[arg])(arg, S, ui, d),
    cs: (arg, S, ui, d) => wrap(CS[arg])(arg, S, ui, d),
    ss: (arg, S, ui, d) => wrap(SS[arg])(arg, S, ui, d),
    session: (id, S) => {
      const a = S.appts.find((x) => x.id === id);
      if (!a) return { title: "Session", plain: true, body: "" };
      const lv = a.status === "confirmed" && a.start <= now() && a.start + a.mins * 60000 > now(), frac = lv ? (now() - a.start) / (a.mins * 60000) : 0, owing = a.price - a.paid;
      return { title: person(a.clientId).name, plain: true, sub: `${esc(project(a.projectId).name)}${a.total > 1 ? `, sitting ${a.idx} of ${a.total}` : ""}`, body: `<div class="stage np"><img class="np-art" src="${photo(a.projectId)}" alt=""><div class="np-bar"><i style="width:${frac * 100}%"></i></div><div class="np-t"><span>${D.fmtTime(a.start)}</span><span>${lv ? "Now" : esc(D.fmtRel(a.start))}</span><span>${D.fmtTime(a.start + a.mins * 60000)}</span></div></div><div class="ctls">${lv ? (a.arrived ? btn(owing > 0 ? "Finish and request " + money(owing, { whole: true }) : "Finish session", "finish", a.id, "accent wide big") : btn("Client arrived", "arrived", a.id, "accent wide big")) : btn("Open booking", "open", "booking:" + a.id, "accent wide big")}<div class="row3">${btn(`${icon("chat")} Message`, "chatWith", a.clientId)}${btn(`${icon("file")} Booking`, "open", "booking:" + a.id)}${btn(`${icon("user")} Client`, "open", "client:" + a.clientId)}</div>${ctl("Ready?", V.readiness(S, a))}</div>` };
    },
  });
  // ── Live displays on every detail screen ─────────────────
  // Each detail sheet opens with a Stage that shows its subject the way it really is, before the controls.
  function withStage(name, fn) {
    const base = Sheets[name];
    if (!base) return;
    const wrapped = (arg, S, ui, draft) => {
      const r = base(arg, S, ui, draft);
      if (!r || r.chat) return r;
      let st = "";
      try { st = fn(arg, S, ui, draft) || ""; } catch (e) { st = ""; }
      return st ? Object.assign({}, r, { body: `<div class="stage detail">${st}</div>` + (r.body || "") }) : r;
    };
    if (base.init) wrapped.init = base.init;
    Sheets[name] = wrapped;
  }
  const bar = (parts) => `<div class="sbar">${parts.filter((p) => p[1] > 0).map(([lbl, v, cls]) => `<i class="${cls || ""}" style="flex:${v}"><b>${lbl}</b></i>`).join("")}</div>`;
  const hero = (img, over) => `<div class="shero"><img src="${img}" alt="">${over ? `<span>${over}</span>` : ""}</div>`;
  withStage("booking", (id, S) => {
    const a = S.appts.find((x) => x.id === id), owing = a.price - a.paid, t = now();
    const lv = a.start <= t && a.start + a.mins * 60000 > t, days = D.daysBetween(t, a.start);
    return `<div class="sdet"><div class="svc-card" style="height:${Math.min(260, 60 + (a.mins / 60) * 22)}px"><img src="${photo(a.projectId)}" alt=""><span><i>${sit(a)}</i><b>${esc(person(a.clientId).name)}</b></span></div><div class="svc-num"><div class="st-num sm"><small>${lv ? "In the chair" : a.start < t ? "Finished" : "Starts"}</small><b>${lv ? "Now" : a.start < t ? D.fmtDate(a.start) : days === 0 ? D.fmtTime(a.start) : days === 1 ? "Tomorrow" : `In ${days} days`}</b></div><div><small>${D.duration(a.mins)}</small><b>${money(a.price, { whole: true })}</b></div><div><small>${owing > 0 ? "Still to pay" : "Paid"}</small><b>${money(owing > 0 ? owing : a.paid, { whole: true })}</b></div></div></div>${a.price ? bar([["Paid", a.paid, "ok"], ["Owing", owing, ""]]) : ""}`;
  });
  withStage("session", () => "");
  withStage("lead", (id, S) => {
    const l = S.leads.find((x) => x.id === id);
    return `${hero(leadImg(l, 600), `<i>${esc(l.budget)} · ${esc(l.timeframe.toLowerCase())}</i><b>${esc(l.project)}</b><em>${esc(l.placement)}</em>`)}<p class="squote">“${esc(l.idea)}”</p>`;
  });
  withStage("client", (cid, S) => {
    const x = peopleList(S).find((y) => y.p.id === cid);
    if (!x) return "";
    const past = S.appts.filter((a) => a.clientId === cid && a.artistId === "a1" && a.start < now() && !a.consult).sort((a, b) => a.start - b.start).slice(-6);
    return `<div class="sclient">${orb(x, 92)}<div><div class="st-num sm"><small>Spent with you</small><b>${money(x.paid, { whole: true })}</b><em>${x.days === null ? "No sitting booked" : x.days === 0 ? "In today" : `Next sitting in ${plural(x.days, "day")}`}</em></div></div></div>${past.length ? `<div class="shist">${past.map((a) => `<img src="${photo(a.projectId)}" alt="" title="${esc(D.fmtDate(a.start))}">`).join("")}</div>` : ""}`;
  });
  withStage("project", (pid, S) => {
    const p = S.projects.find((x) => x.id === pid), ap = S.appts.filter((a) => a.projectId === pid && !a.consult).sort((a, b) => a.start - b.start);
    const total = Math.max(ap.length, ap[0] ? ap[0].total : 1), done = ap.filter((a) => a.status === "completed").length;
    const care = D.aftercareFor(S, p.clientId), healing = care && care.appt.projectId === pid;
    return `${hero(photo(pid), `<i>with ${esc(person(p.artistId).name)}</i><b>${esc(p.name)}</b>`)}<div class="sprog">${Array.from({ length: total }, (_, i) => { const a = ap[i]; return `<span class="${a ? a.status : "todo"}"><b>${i + 1}</b><small>${a ? D.fmtDate(a.start) : "to book"}</small></span>`; }).join("")}</div>${healing ? `<div class="lk-stack"><div class="nt"><i>${icon("drop")}</i><span><b>Healing, day ${care.day}</b>${esc(care.phase.label)}</span>${ring(care.day / 30, 34, "")}</div></div>` : `<p class="st-cap">${done} of ${total} sittings done</p>`}`;
  });
  withStage("offer", (id, S) => {
    const o = S.offers.find((x) => x.id === id);
    return `<div class="vch"><small>${esc(S.artist.name)} · ${esc(S.artist.studio)}</small><b>${o.valueType === "percentage" ? o.value + "% off" : money(o.value, { whole: true })}</b><em>${esc(o.name)}</em><span>${o.expiresAt ? "Until " + D.fmtDate(o.expiresAt) : o.validityYears ? `Valid for ${o.validityYears} years` : "No end date"}</span><i class="perf"></i><s>${S.issued.filter((i) => i.offerId === o.id).length} sent so far</s></div>`;
  });
  withStage("txn", (id, S) => {
    const t = S.txns.find((x) => x.id === id), f = D.fees(t.base, t.tier || S.settings.tier);
    return `<div class="st-num"><small>${esc(person(t.clientId).name)} · ${esc(t.kind)} · ${D.fmtDate(t.at)}</small><b>${money(f.payout)}</b><em>${t.status === "refunded" ? "refunded" : "reached you"}</em></div>${bar([["You", f.payout, "ok"], ["Tattoi", f.artist, ""]])}<p class="st-cap">Client paid ${money(t.base + f.platform)}, including a ${money(f.platform)} card fee.</p>`;
  });
  withStage("checkout", (arg, S, ui, draft) => {
    const q = (draft.pay && draft.pay.q) || window.App.quote(arg);
    return q ? `<div class="bcard"><span>Paying Tattoi</span><b>•••• •••• •••• 4242</b><em>${esc(person(S.role === "client" ? "c1" : "a1").name)}</em><i></i></div><div class="st-num sm" style="margin-top:14px;text-align:center"><small>Total today</small><b>${money(q.total)}</b></div>` : "";
  });
  withStage("cart", (a, S) => STAGES.tray(S));
  withStage("item", (pid, S) => {
    const p = S.products.find((x) => x.id === pid), sup = S.suppliers.find((s) => s.id === p.supplierId);
    return `<div class="sitem"><span class="jar big" style="--h:${hash(p.id) % 360}"><i style="height:${Math.min(100, (p.variants.reduce((s, v) => s + v.stock, 0) / 60) * 100)}%"></i></span><div class="st-num sm"><small>${esc(sup ? sup.name : "")}</small><b>${money(p.variants[0].price)}</b><em>${plural(p.variants.length, "option")}, ${p.variants.reduce((s, v) => s + v.stock, 0)} in stock</em></div></div>`;
  });
  withStage("product", (pid, S) => {
    const p = S.products.find((x) => x.id === pid);
    if (!p) { const n = window.App.draft.newProduct || {}, st = parseInt(n.stock, 10) || 0, pr = parseFloat(n.price) || 0; return `<div class="sitem"><span class="jar big" style="--h:${hash(n.name || "x") % 360}"><i style="height:${Math.min(100, (st / 40) * 100)}%"></i></span><div class="st-num sm"><small>${esc(n.category || "New product")}</small><b>${esc(n.name || "Fill the jar")}</b><em>${pr ? money(Math.round(pr * 100)) : "No price yet"} · ${st} in stock</em></div></div>`; }
    return `<div class="shelf st">${p.variants.map((v) => `<div class="prod"><span class="jar" style="--h:${hash(v.id) % 360}"><i style="height:${Math.min(100, (v.stock / 40) * 100)}%"></i></span><b>${esc(v.name)}</b><em>${v.stock} left · ${money(v.price)}</em></div>`).join("")}</div>`;
  });
  const track = (o) => { const st = ["paid", "fulfilled", "delivered"], i = st.indexOf(o.status); return `<div class="strack">${["Paid", "Shipped", "Delivered"].map((l, k) => `<span class="${k <= i ? "on" : ""}"><i></i><small>${l}</small></span>`).join("")}</div><div class="st-num sm" style="text-align:center"><small>Order #${o.number}</small><b>${money(o.total)}</b><em>${plural(o.items.reduce((s, x) => s + x.qty, 0), "item")}</em></div>`; };
  withStage("order", (id, S) => { const o = S.supplyOrders.find((x) => x.id === id); return o ? track(o) : ""; });
  withStage("supplyOrder", (id, S) => { const o = S.supplyOrders.find((x) => x.id === id); return o ? track(o) : ""; });
  withStage("artist", (aid, S) => { const a = person(aid); return `${hero(Art.url(Art.STYLE_MOTIF[(a.styles || [])[0]] || "mandala", aid + "-0", 600, 400), `<i>${esc((a.styles || []).join(", "))}</i><b>${esc(a.name)}</b><em>${esc(a.city || "")}</em>`)}<div class="shist">${[1, 2, 3, 4].map((n) => `<img src="${Art.url(Art.STYLE_MOTIF[(a.styles || [])[0]] || "mandala", aid + "-" + n, 200, 200)}" alt="">`).join("")}</div>`; });
  withStage("waitlist", (a, S) => { const w = S.waitlist.filter((x) => x.artistId === "a1" && ["waiting", "offered"].includes(x.status)); return w.length ? `<div class="pp-row">${w.map((x) => `<span class="wl">${av(x.clientId)}<b>${esc(first(x.clientId))}</b><small>${x.status === "offered" ? "Offer sent" : "Waiting"}</small></span>`).join("")}</div><p class="st-cap">Ready to come in sooner if a space opens up.</p>` : ""; });
  withStage("proposal", (id, S) => { const ap = S.appts.filter((a) => a.projectId === id || a.id === id); if (!ap.length) return ""; const tot = ap.reduce((s, a) => s + a.price, 0), dep = ap.reduce((s, a) => s + (a.deposit || 0), 0); return `<div class="st-num"><small>${plural(ap.length, "sitting")}</small><b>${money(tot, { whole: true })}</b><em>${money(dep, { whole: true })} deposit to hold the dates</em></div>${bar([["Deposit", dep, "ok"], ["Later", tot - dep, ""]])}`; });
  withStage("formsList", (a, S) => { const f = S.forms.filter((x) => x.clientId === "c1"), sg = f.filter((x) => x.status === "signed").length; return `<div class="sclient">${ring(f.length ? sg / f.length : 1, 92, `${sg}/${f.length}`)}<div class="st-num sm"><small>Forms signed</small><b>${f.length - sg ? `${f.length - sg} to go` : "All done"}</b><em>Sign them on your phone before your sitting</em></div></div>`; });
  withStage("formsAdmin", (a, S) => { const f = S.forms.filter((x) => x.artistId === "a1"), sg = f.filter((x) => x.status === "signed").length; return `<div class="sclient">${ring(f.length ? sg / f.length : 1, 92, `${sg}/${f.length}`)}<div class="st-num sm"><small>Consent and medical forms</small><b>${sg} signed</b><em>${f.length - sg} waiting on clients · licence ${esc(S.artist.licence)}</em></div></div>`; });
  withStage("store", (sid, S) => { const s = S.suppliers.find((x) => x.id === sid); return s ? `<div class="sitem"><span class="rv-ic g-supplies" style="width:72px;height:72px;border-radius:22px">${icon("store")}</span><div class="st-num sm"><small>${esc(s.city)}</small><b>${esc(s.name)}</b><em>${esc(s.category)}</em></div></div>` : ""; });
  // The booking wizard previews the proposal the client will receive, filling in as you go.
  withStage("composer", (a, S, ui, draft) => {
    const c = draft.comp;
    if (!c) return "";
    const sp = D.split(c.price, c.sittings, S);
    return `<div class="sitem">${c.clientId ? av(c.clientId, "lg") : `<span class="rv-ic g-identity" style="width:56px;height:56px">${icon("user")}</span>`}<div class="st-num sm"><small>${c.clientId ? esc(person(c.clientId).name) : "Choose a client"}</small><b>${esc(c.name || "New project")}</b><em>${plural(c.sittings, "sitting")} × ${D.duration(c.mins)} · ${money(sp.total, { whole: true })}</em></div></div><div class="sprog">${Array.from({ length: c.sittings }, (_, i) => `<span class="${c.dates[i] ? "confirmed" : "todo"}"><b>${i + 1}</b><small>${c.dates[i] ? D.fmtDate(c.dates[i]) : "date"}</small></span>`).join("")}</div>${bar([["Deposit " + money(sp.deposit, { whole: true }), sp.deposit, "ok"], ["On the days", sp.total - sp.deposit, ""]])}`;
  });
  withStage("offerWizard", (a, S, ui, draft) => {
    let o; try { o = window.App.offerFromDraft(); } catch (e) { return ""; }
    return `<div class="vch"><small>${esc(S.artist.name)} · ${esc(S.artist.studio)}</small><b>${o.valueType === "percentage" ? (o.value || 0) + "% off" : money(o.value || 0, { whole: true })}</b><em>${esc(o.name || "Your offer")}</em><span>${o.expiresAt ? "Until " + D.fmtDate(o.expiresAt) : "No end date"}</span><i class="perf"></i><s>Preview of what clients receive</s></div>`;
  });
  withStage("intake", (aid, S, ui, draft) => { const d = draft.intake || {}, step = d.step || 0; return `<div class="sitem">${ring((step + 1) / 6, 92, `${step + 1}/6`)}<div class="st-num sm"><small>Request to ${esc(person(aid || "a1").name)}</small><b>${["Your idea", "Style", "Placement", "Size and budget", "Timing", "Review"][step] || "Your request"}</b><em>Six short steps. ${esc(first(aid || "a1"))} replies within two working days.</em></div></div>`; });
  withStage("purchases", (a, S) => { const v = S.issued.filter((i) => i.clientId === "c1"); return `<div class="sitem">${ring(v.length ? v.filter((x) => x.status === "active").length / v.length : 0, 92, v.length)}<div class="st-num sm"><small>Your vouchers</small><b>${v.filter((x) => x.status === "active").length} to use</b><em>They apply when you book</em></div></div>`; });
  // Old links to the original pages land in the matching section.
  const pageMap = { money: "st:money", offers: "st:offers", supplies: "st:supplies", clients: "st:people", inbox: "st:req", calendar: "st:day" };
  Sheets.page = (key, S, ui, draft) => { const k = (pageMap[key] || "st:day").split(":")[1]; return Sheets.st(k, S, ui, draft); };

  // ── Client and supplier landings: same glance-and-expand groups as the artist ──
  function clientHome(S) {
    const next = S.appts.filter((a) => a.clientId === "c1" && a.status === "confirmed" && a.start > now()).sort((a, b) => a.start - b.start);
    const care = D.aftercareFor(S, "c1"), forms = S.forms.filter((f) => f.clientId === "c1" && f.status === "pending");
    const art = Object.values(S.people).filter((p) => p.role === "artist"), cs = S.convos.filter((c) => c.a === "c1" || c.b === "c1" || c.c === "c1");
    const vouchers = S.issued.filter((i) => i.clientId === "c1" && i.status === "active");
    return { raw: true, big: "", cond: "", body: `<div class="land">${stage("clock", "", S, "lock top")}
      ${next.length ? grp("next", "cal", "Your sittings", "cs:tattoos", next.map((a) => nt("", esc(project(a.projectId).name), `${esc(dayLong(a.start))} · ${sit(a)}`, relT(a.start), "project:" + a.projectId, photo(a.projectId)))) : ""}
      ${care ? grp("care", "drop", "Healing", "project:" + care.appt.projectId, [nt("drop", `Day ${care.day}: ${esc(care.phase.label)}`, esc(care.phase.tip || "Follow your aftercare guide"), "today", "project:" + care.appt.projectId), ...care.phases.map((p) => nt("leaf", esc(p.label), `Days ${p.from} to ${p.to}`, care.day >= p.from && care.day <= p.to ? "now" : "", "project:" + care.appt.projectId))], 1) : ""}
      ${forms.length ? grp("forms", "pen", "To sign", "formsList:", forms.map((f) => nt("pen", esc(f.kind), "Before your next sitting", "", "formsList:"))) : ""}
      ${grp("msgs", "chat", "Messages", "cs:messages", cs.map((c) => { const m = c.msgs[c.msgs.length - 1] || {}, o = [c.a, c.b].find((x) => x !== "c1") || c.a; return nt("chat", esc(person(o).name), esc((m.text || "Sent a card").slice(0, 80)), m.at ? esc(D.fmtRel(m.at)) : "", "chat:" + c.id); }))}
      ${grp("tattoos", "leaf", "My tattoos", "cs:tattoos", [STAGES.ctat(S)], 1)}
      ${grp("discover", "compass", "Discover artists", "cs:discover", [STAGES.cdisc(S), ...art.map((a) => nt("", esc(a.name), `${esc((a.styles || []).join(", "))} · ${esc(a.city || "")}`, "", "artist:" + a.id, Art.url(Art.STYLE_MOTIF[(a.styles || [])[0]] || "mandala", a.id + "-0", 80, 80)))], 1)}
      ${vouchers.length ? grp("vouchers", "gift", "Vouchers", "purchases:", vouchers.map((v) => nt("gift", "Voucher", esc(S.offers.find((o) => o.id === v.offerId)?.name || ""), "", "issued:" + v.id))) : ""}
      <p class="foot-hint">Your details and settings live behind your photo, top right.</p></div>` };
  }
  function supplierHome(S) {
    const os = S.supplyOrders.filter((o) => o.supplierId === "m1").sort((a, b) => b.at - a.at), paid = os.filter((o) => o.status === "paid");
    const prods = S.products.filter((p) => p.supplierId === "m1"), low = prods.filter((p) => p.variants.some((v) => v.stock < (p.min || 8)));
    const t = new Date(), rev = os.filter((o) => o.at > now() - 30 * D.DAY).reduce((s, o) => s + o.total, 0);
    const cs = S.convos.filter((c) => c.a === "m1" || c.b === "m1");
    return { raw: true, big: "", cond: "", body: `<div class="land"><div class="stage lock top"><div class="lk-time">${t.toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit" }).replace(/\s?(am|pm)/i, "")}</div><div class="lk-date">${esc(S.store.business.name)}</div><div class="lk-widgets"><button type="button" ${act("open", "ss:orders")}>${ring(Math.min(1, paid.length / 5), 58, paid.length)}<small>to pack</small></button><button type="button" ${act("open", "ss:products")}>${ring(Math.min(1, low.length / 5), 58, low.length)}<small>running low</small></button><button type="button" ${act("open", "ss:store")}>${ring(Math.min(1, rev / 200000), 58, "$" + (rev / 100000).toFixed(1) + "k")}<small>sold, 30 days</small></button></div></div>
      ${grp("pack", "box", "To pack", "ss:orders", paid.length ? paid.map((o) => nt("box", `Order #${o.number}`, `${esc(o.buyerName.split(",")[0])} · ${plural(o.items.reduce((s, x) => s + x.qty, 0), "item")}`, money(o.total, { whole: true }), "order:" + o.id)) : [nt("check", "All packed", "Nothing waiting to ship", "", "ss:orders")])}
      ${grp("belt", "box", "Order belt", "ss:orders", [STAGES.belt(S)], 1)}
      ${grp("low", "tag", "Running low", "ss:products", low.length ? low.map((p) => nt("tag", esc(p.name), p.variants.filter((v) => v.stock < (p.min || 8)).map((v) => `${esc(v.name)}: ${v.stock}`).join(" · "), "", "product:" + p.id)) : [nt("check", "Stock looks healthy", `${prods.length} products`, "", "ss:products")])}
      ${grp("smsgs", "chat", "Messages", "ss:sinbox", cs.map((c) => { const m = c.msgs[c.msgs.length - 1] || {}, o = [c.a, c.b].find((x) => x !== "m1") || c.a; return nt("chat", esc(person(o).name), esc((m.text || "").slice(0, 80)), m.at ? esc(D.fmtRel(m.at)) : "", "chat:" + c.id); }))}
      <p class="foot-hint">Store settings live behind your logo, top right.</p></div>` };
  }
  window.MosaicActs = {
    setWall(k) { const S = S0(); S.settings.wall = k; D.save(S); document.documentElement.dataset.wall = k; window.App.refresh(); },
    grpToggle(key) {
      L.grp = L.grp === key ? null : key;
      document.querySelectorAll(".grp").forEach((g) => { const gb = g.querySelector(".gb"); if (g.dataset.grp !== L.grp) gb.scrollTop = 0; });
      sizeGroups(document);
      const g = document.querySelector(`.grp[data-grp="${key}"]`);
      if (L.grp && g) { const sc = g.closest(".scroller"), r = g.getBoundingClientRect(), sr = sc.getBoundingClientRect(); if (r.bottom - sr.top + g.querySelector(".gb").offsetHeight > sr.height) sc.scrollBy({ top: Math.min(r.top - sr.top - 60, 400), behavior: "smooth" }); }
    },
    calOpen(i) {
      const t = document.createElement("button"); t.dataset.act = "open"; t.dataset.arg = "st:day"; document.body.appendChild(t); t.click(); t.remove();
      setTimeout(() => window.MosaicActs.calJump(i), 60);
    },
    calJump(i) {
      i = Number(i);
      const sh = [...document.querySelectorAll(".sheet")].pop(); if (!sh) return;
      const list = sh.querySelector(".cal-list"), bot = list.querySelector(".cal-bot");
      if (i >= CAL.to) { bot.insertAdjacentHTML("beforebegin", dayRange(S0(), CAL.to, i + 14)); CAL.to = i + 14; }
      const d = D.startOfDay(now()) + i * D.DAY, el = list.querySelector(`[data-day="${d}"]`);
      const scr = sh.querySelector(".sheet-scroll"); scr.dataset.jump = "1"; setTimeout(() => delete scr.dataset.jump, 1200);
      if (el) scr.scrollTo({ top: el.getBoundingClientRect().top - sh.querySelector(".sheet-scroll").getBoundingClientRect().top + sh.querySelector(".sheet-scroll").scrollTop - 70, behavior: "auto" });
    },
    svcPick(i) { L.svc = Number(i); window.App.refresh(); },
    varPick(i) { L.var = Number(i); window.App.refresh(); },
    fillWait(arg) {
      const [wid, t] = arg.split("|");
      const b = document.createElement("button"); b.dataset.act = "waitForm"; b.dataset.arg = `${wid}|${t}`; document.body.appendChild(b); b.click(); b.remove();
      const o = document.createElement("button"); o.dataset.act = "open"; o.dataset.arg = "waitlist:"; document.body.appendChild(o); o.click(); o.remove();
    },
    // Remember the day for this client. The booking wizard offers it as a choice when you book them later.
    fillQuote(arg) {
      const [cid, d, lid] = arg.split("|"), S = S0();
      (S.holds = S.holds || {})[cid] = Number(d); D.save(S);
      const b = document.createElement("button"); b.dataset.act = "open"; b.dataset.arg = "lead:" + lid; document.body.appendChild(b); b.click(); b.remove();
    },
    compHeld() {
      const S = S0(), c = window.App.draft.comp, d = (S.holds || {})[c.clientId];
      if (!d) return;
      const h = S.hours[D.DAY_KEYS[new Date(d).getDay()]], start = d + toMin(h && h.on ? h.start : "09:30") * 60000;
      c.from = new Date(d - new Date(d).getTimezoneOffset() * 60000).toISOString().slice(0, 10);
      c.dates = [start, ...(c.sittings > 1 ? D.suggestDates(S, d + D.DAY, c.freq || "weekly", c.sittings - 1, c.mins) : [])];
      c.searched = true;
      window.App.refresh();
    },
    compHeldDrop() { const S = S0(); delete (S.holds || {})[window.App.draft.comp.clientId]; D.save(S); window.App.refresh(); },
    fillOffer(d) {
      const S = S0(), o = { id: D.uid("o"), name: `Last-minute: ${D.fmtDate(Number(d))}`, kind: "discount", valueType: "percentage", value: L.offPct, eligibility: "all", funding: "gift", availableHours: 48, expiresAt: Number(d), sittingMonths: [], colour: "rose", archived: false, created: now() };
      S.offers.push(o); D.save(S);
      const b = document.createElement("button"); b.dataset.act = "open"; b.dataset.arg = "offer:" + o.id; document.body.appendChild(b); b.click(); b.remove();
    },
    makeOffer() {
      const S = S0();
      S.offers.push({ id: D.uid("o"), name: `${L.offPct}% off your next sitting`, kind: "discount", valueType: "percentage", value: L.offPct, eligibility: "all", funding: "gift", availableHours: null, expiresAt: now() + L.offDays * D.DAY, sittingMonths: [], colour: "rose", archived: false, created: now() });
      D.save(S); window.App.refresh();
    },
  };
  window.Views.roles = {
    artist: { label: "Artist", persona: "a1", pages: [{ key: "home", title: "Home", tab: "Home", icon: "sparkle", sky: "day", render: home }], more: [] },
    client: { label: "Client", persona: "c1", pages: [{ key: "home", title: "Home", tab: "Home", icon: "sparkle", sky: "day", render: clientHome }], more: [] },
    supplier: { label: "Supplier", persona: "m1", pages: [{ key: "home", title: "Home", tab: "Home", icon: "sparkle", sky: "day", render: supplierHome }], more: [] },
  };
  // The account button opens settings for whichever role you're in.
  window.LineHook = (S) => {
    const who = document.getElementById("who");
    document.documentElement.dataset.wall = (S.settings && S.settings.wall) || "violet";
    if (!who || !S.role) return;
    who.dataset.act = "open";
    who.dataset.arg = { artist: "wb:index", client: "cs:me", supplier: "ss:store" }[S.role];
    requestAnimationFrame(() => sizeGroups(document));
  };
})();
