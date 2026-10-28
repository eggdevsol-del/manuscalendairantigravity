/* Tattoi Swipe — swipe pages for each role, in the calm idiom of iOS Weather:
   one big figure per page, a short summary, then a few frosted modules. Shared helpers live on window.V. */
(function () {
  "use strict";
  const D = window.Data;

  // ── Helpers ───────────────────────────────────────────────
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const ICONS = {
    plus: "M12 5v14M5 12h14",
    briefcase: "M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2ZM8 6V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v1M3 13h18",
    chat: "M21 11.5a8.4 8.4 0 0 1-9 8.4 8.6 8.6 0 0 1-3.9-.9L3 20l1.1-4.4A8.4 8.4 0 1 1 21 11.5Z",
    cal: "M3 6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2ZM3 10h18M8 2v4M16 2v4",
    user: "M20 21a8 8 0 0 0-16 0M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z",
    users: "M16 21a6 6 0 0 0-12 0M10 13a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM22 21a6 6 0 0 0-4-5.6M16 5.2a4 4 0 0 1 0 7.6",
    wallet: "M3 7a2 2 0 0 1 2-2h13v4M3 7v11a2 2 0 0 0 2 2h15V9H5a2 2 0 0 1-2-2ZM16 14.5h.01",
    box: "M21 8 12 3 3 8v8l9 5 9-5ZM3 8l9 5 9-5M12 13v8",
    tag: "M12.6 2.6l8.8 8.8a2 2 0 0 1 0 2.8l-7.2 7.2a2 2 0 0 1-2.8 0L2.6 12.6A2 2 0 0 1 2 11.2V4a2 2 0 0 1 2-2h7.2a2 2 0 0 1 1.4.6ZM7.5 7.5h.01",
    gift: "M20 12v9H4v-9M2 7h20v5H2ZM12 21V7M12 7H7.5a2.5 2.5 0 1 1 0-5C11 2 12 7 12 7ZM12 7h4.5a2.5 2.5 0 1 0 0-5C13 2 12 7 12 7Z",
    sliders: "M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6",
    search: "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM21 21l-4.3-4.3",
    heart: "M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2-1.5-1.5-2.7-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7Z",
    send: "M22 2 11 13M22 2l-7 20-4-9-9-4Z",
    image: "M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2ZM8.5 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM21 15l-5-5L5 21",
    check: "M20 6 9 17l-5-5",
    checkc: "M22 11.1V12a10 10 0 1 1-5.9-9.1M22 4 12 14l-3-3",
    x: "M18 6 6 18M6 6l12 12",
    chevL: "m15 18-6-6 6-6",
    chevR: "m9 18 6-6-6-6",
    chevD: "m6 9 6 6 6-6",
    phone: "M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2Z",
    mail: "M2 6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2ZM22 7l-10 6L2 7",
    clock: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20ZM12 6v6l4 2",
    pin: "M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0ZM12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
    link: "M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7",
    copy: "M8 8h12v12H8ZM16 8V4H4v12h4",
    bell: "M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.9 1.9 0 0 0 3.4 0",
    bag: "M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4ZM3 6h18M16 10a4 4 0 0 1-8 0",
    truck: "M1 3h15v13H1ZM16 8h4l3 3v5h-7ZM5.5 21a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM18.5 21a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z",
    refresh: "M21 12a9 9 0 0 1-15.5 6.2L3 16M3 12a9 9 0 0 1 15.5-6.2L21 8M21 3v5h-5M3 21v-5h5",
    lock: "M5 11h14v10H5ZM8 11V7a4 4 0 0 1 8 0v4",
    upload: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12",
    pen: "M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z",
    trash: "M3 6h18M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2",
    card: "M2 6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2ZM2 10h20",
    shield: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z",
    plane: "M2 16l20-8-3 13-6-4-3 4v-5l9-8-11 6Z",
    file: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8ZM14 2v6h6M8 13h8M8 17h5",
    leaf: "M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.5 19 2c1 2 2 4.2 2 8 0 5.5-4.8 10-10 10ZM2 21c0-3 1.9-5.4 5.1-6",
    compass: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20ZM16.2 7.8l-2.1 6.3-6.3 2.1 2.1-6.3Z",
    sparkle: "M12 3l1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2Z",
    store: "M3 9 4.5 3h15L21 9M3 9v11h18V9M3 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0M9 20v-6h6v6",
    camera: "M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2ZM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z",
    logout: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9",
    hourglass: "M5 22h14M5 2h14M17 22v-4.2a2 2 0 0 0-.6-1.4L12 12l-4.4 4.4a2 2 0 0 0-.6 1.4V22M7 2v4.2a2 2 0 0 0 .6 1.4L12 12l4.4-4.4a2 2 0 0 0 .6-1.4V2",
    drop: "M12 2.7C13.5 7 19 9.6 19 15a7 7 0 0 1-14 0c0-5.4 5.5-8 7-12.3Z",
    sun: "M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10ZM12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4",
    moon: "M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z",
    list: "M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01",
    swap: "M16 3l4 4-4 4M20 7H4M8 21l-4-4 4-4M4 17h16",
    minus: "M5 12h14",
    eye: "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12ZM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
    alert: "M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z",
  };
  function icon(name, cls) {
    return `<svg class="${cls || ""}" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${ICONS[name] || ICONS.sparkle}"/></svg>`;
  }
  // Each person keeps a stable pale tint; twelve hues 30° apart keep neighbours distinct.
  function hue(id) {
    let h = 2166136261;
    for (const ch of String(id)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
    return (h % 12) * 30 + 15;
  }
  const OTHERS = { ironbark: "Ironbark Studio", saint: "Saint & Sparrow Tattoo" };
  function person(id) {
    return window.App.S.people[id] || { id, name: OTHERS[id] || "Unknown", role: "other" };
  }
  function first(id) {
    return person(id).name.split(" ")[0];
  }
  function initials(name) {
    return name.split(/\s+/).filter((w) => /[A-Za-z]/.test(w[0] || "")).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  }
  function av(id, cls) {
    return `<span class="avatar ${cls || ""}" style="--h:${hue(id)}" aria-hidden="true">${esc(initials(person(id).name))}</span>`;
  }
  function img(motif, seed, w, h, variant, alt) {
    return `<img src="${window.Art.url(motif, seed, w, h, variant)}" alt="${esc(alt || "")}" width="${w}" height="${h}">`;
  }
  function pill(kind, text) {
    return `<span class="pill ${kind || ""}">${esc(text)}</span>`;
  }
  function act(name, arg, extra) {
    return `data-act="${name}"${arg != null ? ` data-arg="${esc(arg)}"` : ""}${extra || ""}`;
  }
  function sec(title, count, right) {
    return `<div class="sec"><h2>${esc(title)}${count != null ? ` <span class="count num">${count}</span>` : ""}</h2>${right || ""}</div>`;
  }
  function row(o) {
    const tag = o.act ? "button" : "div";
    return `<${tag} class="row" ${o.act || ""}${tag === "button" ? ' type="button"' : ""}>${o.lead || ""}<span class="grow"><span class="t">${o.t}</span>${o.s ? `<span class="s${o.wrap ? " wrap" : ""}">${o.s}</span>` : ""}</span>${o.end ? `<span class="end">${o.end}</span>` : ""}${o.act && !o.noChev ? `<span class="chev">${icon("chevR")}</span>` : ""}</${tag}>`;
  }
  function empty(text) {
    return `<div class="empty small">${esc(text)}</div>`;
  }
  function kv(label, value, cls) {
    return `<div class="kv ${cls || ""}"><span>${label}</span><span>${value}</span></div>`;
  }
  function plural(n, one, many) {
    return `${n} ${n === 1 ? one : many || one + "s"}`;
  }
  function timeRange(a) {
    return `${D.fmtTime(a.start)}–${D.fmtTime(a.start + a.mins * 60000)}`;
  }
  function dayLong(t) {
    return new Date(t).toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long" });
  }
  function project(id) {
    return window.App.S.projects.find((p) => p.id === id) || { id, name: "Tattoo project", motif: "mandala", seed: id };
  }
  function readiness(S, a) {
    const out = [];
    if (a.status === "proposed") out.push(pill("wait", "Awaiting deposit"));
    else if (a.price === 0) out.push(pill("", "No charge"));
    else if (a.paid >= a.price) out.push(pill("good", "Paid in full"));
    else if (a.paid > 0) out.push(pill("good", "Deposit received"));
    else out.push(pill("wait", "Payment outstanding"));
    const forms = S.forms.filter((f) => f.apptId === a.id);
    if (forms.length) out.push(forms.every((f) => f.status === "signed") ? pill("good", "Forms signed") : pill("wait", "Awaiting signature"));
    if (a.reschedule && a.reschedule.status === "pending") out.push(pill("st", "New time proposed"));
    return out.join("");
  }
  function readinessText(S, a) {
    const pay = a.price === 0 ? "" : a.paid >= a.price ? "Paid in full" : a.paid > 0 ? "Deposit received" : "No deposit yet";
    const forms = S.forms.filter((f) => f.apptId === a.id);
    const f = !forms.length ? "" : forms.every((x) => x.status === "signed") ? "forms signed" : "consent form not signed yet";
    return [pay, f].filter(Boolean).join(", ") + ".";
  }
  function lifetimePaid(S, clientId) {
    return S.txns.filter((t) => t.clientId === clientId && t.artistId === "a1" && t.status === "paid").reduce((s, t) => s + t.base, 0);
  }
  function convoFor(S, a, b) {
    return S.convos.find((c) => (c.a === a && c.b === b) || (c.a === b && c.b === a));
  }
  function unreadFor(S, me) {
    return S.convos.reduce((s, c) => s + ((c.unread || {})[me] || 0), 0);
  }
  function activeTasks(S) {
    const now = Date.now();
    return S.tasks.filter((t) => !t.done && !(t.snoozedUntil && t.snoozedUntil > now));
  }
  function money(c, o) {
    return D.money(c, o);
  }
  function searchBox(path, value, label) {
    return `<label class="search">${icon("search")}<input class="input" type="search" placeholder="${esc(label)}" value="${esc(value || "")}" data-bind="${path}" data-live="1" aria-label="${esc(label)}"></label>`;
  }
  function seg(path, current, options) {
    return `<div class="seg" role="group">${options.map(([v, label]) => `<button type="button" aria-pressed="${String(current === v)}" data-act="set" data-path="${path}" data-v="${esc(v)}">${esc(label)}</button>`).join("")}</div>`;
  }
  // A frosted module: small uppercase header with an icon, then its content.
  function mh(ic, label, right) {
    return `<div class="mh">${icon(ic)}<span>${esc(label)}</span>${right ? `<span class="r">${right}</span>` : ""}</div>`;
  }
  function mod(ic, label, inner, right) {
    return `<section class="card tight">${mh(ic, label, right)}${inner}</section>`;
  }
  function tile(ic, label, value, text, actAttr, extra) {
    const tag = actAttr ? "button" : "div";
    return `<${tag} class="card tile" ${actAttr || ""}${tag === "button" ? ' type="button"' : ""}>${mh(ic, label)}<div class="tv">${value}</div>${extra || ""}<div class="tt">${text}</div></${tag}>`;
  }
  function tiles(list) {
    const even = list.filter(Boolean);
    if (even.length % 2) even.pop();
    return even.length ? `<div class="tiles">${even.join("")}</div>` : "";
  }
  function earnings(S, fromTime) {
    const tx = S.txns.filter((t) => t.artistId === "a1" && t.at >= fromTime);
    let gross = 0, artistFee = 0, processing = 0, refunded = 0;
    tx.forEach((t) => {
      const f = D.fees(t.base, t.tier || "free");
      gross += t.base;
      artistFee += f.artist;
      processing += f.platform;
      if (t.status === "refunded") refunded += t.base;
    });
    return { gross, artistFee, processing, refunded, net: gross - artistFee - refunded, count: tx.length };
  }
  function balance(S) {
    const all = earnings(S, 0);
    const paidOut = S.payouts.reduce((s, p) => s + p.amount, 0);
    const transit = S.payouts.filter((p) => p.status === "in_transit").reduce((s, p) => s + p.amount, 0);
    return { available: Math.max(0, all.net - paidOut), transit, next: S.payouts.find((p) => p.status === "in_transit") };
  }
  function weekBars(S, weeks) {
    const now = new Date();
    const thisWeek = D.startOfDay(now.getTime()) - ((now.getDay() + 6) % 7) * D.DAY;
    const out = [];
    for (let i = weeks - 1; i >= 0; i--) {
      const from = thisWeek - i * 7 * D.DAY, to = from + 7 * D.DAY;
      const v = S.txns.filter((t) => t.artistId === "a1" && t.at >= from && t.at < to && t.status === "paid").reduce((s, t) => s + D.fees(t.base, t.tier || "free").payout, 0);
      out.push({ from, v, current: i === 0 });
    }
    return out;
  }
  // Kept for sheets that still chart money.
  function barChart(bars, label) {
    const W = 320, H = 110, bw = (W - 8) / bars.length;
    const max = Math.max(1, ...bars.map((b) => b.v));
    const y = (v) => H - 18 - (v / max) * (H - 30);
    return `<div class="chart" role="img" aria-label="${esc(label)}"><svg viewBox="0 0 ${W} ${H}">${bars.map((b, i) => `<rect x="${i * bw + 6}" y="${y(b.v)}" width="${bw - 10}" height="${Math.max(0, y(0) - y(b.v))}" rx="3" fill="#fff" opacity="${b.current ? 1 : 0.45}"/>`).join("")}</svg></div>`;
  }
  function spark(values) {
    return lineHorizon(values, [], "Weekly sales");
  }
  function voucherCard(S, o, extra) {
    const value = o.valueType === "percentage" ? o.value + "%" : money(o.value, { whole: true });
    const kind = o.kind === "voucher" ? (o.funding === "sale" ? "Gift voucher" : "Complimentary credit") : o.availableHours ? "Calendar offer" : "Discount";
    return `<div class="voucher ${o.colour === "stencil" ? "stencil" : o.colour === "rose" ? "rose" : ""}"><div class="split"><span class="vn">${esc(o.name)}</span><span class="vc">${esc(kind)}</span></div><div><div class="vv">${value}${o.kind === "discount" ? `<span style="font-size:22px;font-weight:300"> off</span>` : ""}</div><div class="vc">${extra || esc(S.artist.name)}</div></div></div>`;
  }
  function fileInputHidden(id, multiple) {
    return `<input type="file" id="${id}" accept="image/*" ${multiple ? "multiple" : ""} hidden>`;
  }

  // ── Horizons: one quiet line of data low in the sky ──
  function lineHorizon(values, labels, label) {
    const W = 320, H = 70;
    const max = Math.max(1, ...values);
    const pts = values.map((v, i) => [(i / (values.length - 1)) * (W - 16) + 8, H - 14 - (v / max) * (H - 30)]);
    const d = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
    const last = pts[pts.length - 1];
    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)}"><path d="${d} L${last[0]} ${H - 14} L8 ${H - 14} Z" fill="rgba(255,255,255,0.12)"/><path d="${d}" fill="none" stroke="#fff" stroke-width="2" stroke-linejoin="round" opacity="0.9"/><circle cx="${last[0]}" cy="${last[1]}" r="4.5" fill="#fff"/>${labels.map(([i, t]) => `<text x="${pts[i][0]}" y="${H}" text-anchor="${i === 0 ? "start" : i === values.length - 1 ? "end" : "middle"}">${esc(t)}</text>`).join("")}</svg>`;
  }
  // Today's working hours drawn like the sun's path, with sittings along it and a dot for now.
  function dayArc(S, appts) {
    const now = Date.now();
    const dayKey = D.DAY_KEYS[new Date().getDay()];
    const h = S.hours[dayKey];
    const toT = (str) => {
      const [hh, mm] = str.split(":").map(Number);
      return D.at(0, hh, mm);
    };
    let open = h && h.on ? toT(h.start) : D.at(0, 9, 30), close = h && h.on ? toT(h.end) : D.at(0, 17, 30);
    appts.forEach((a) => {
      open = Math.min(open, a.start);
      close = Math.max(close, a.start + a.mins * 60000);
    });
    const W = 320, H = 96, x0 = 14, x1 = W - 14, base = 78, peak = 64;
    const pt = (t) => {
      const u = Math.max(0, Math.min(1, (t - open) / (close - open)));
      return [x0 + u * (x1 - x0), base - Math.sin(Math.PI * u) * peak];
    };
    const path = (a, b) => {
      let d = "";
      for (let i = 0; i <= 40; i++) {
        const p = pt(a + ((b - a) * i) / 40);
        d += (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1);
      }
      return d;
    };
    const segs = appts.map((a) => `<path d="${path(a.start, Math.min(close, a.start + a.mins * 60000))}" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity="${a.status === "completed" ? 0.5 : 1}"/>`).join("");
    const n = pt(now);
    const showNow = now >= open && now <= close;
    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Working day from ${D.fmtTime(open)} to ${D.fmtTime(close)}, with today's sittings marked"><line x1="0" x2="${W}" y1="${base}" y2="${base}" stroke="rgba(255,255,255,0.35)" stroke-width="1"/><path d="${path(open, close)}" fill="none" stroke="rgba(255,255,255,0.45)" stroke-width="1.5" stroke-dasharray="2 5" stroke-linecap="round"/>${segs}${showNow ? `<circle cx="${n[0]}" cy="${n[1]}" r="11" fill="rgba(255,255,255,0.25)"/><circle cx="${n[0]}" cy="${n[1]}" r="6" fill="#fff"/>` : ""}<text x="${x0}" y="${H - 2}">${D.fmtTime(open)}</text><text x="${x1}" y="${H - 2}" text-anchor="end">${D.fmtTime(close)}</text></svg>`;
  }
  // A project's sittings as dots on a line: done, next, still to come.
  function sittingLine(sittings, nextId) {
    const W = 320, H = 64, n = sittings.length;
    if (!n) return "";
    const x = (i) => (n === 1 ? W / 2 : 24 + (i * (W - 48)) / (n - 1));
    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Sittings in this project"><line x1="${x(0)}" x2="${x(n - 1)}" y1="26" y2="26" stroke="rgba(255,255,255,0.4)" stroke-width="1.5"/>${sittings.map((s, i) => {
      const done = s.status === "completed";
      const next = s.id === nextId;
      return `${next ? `<circle cx="${x(i)}" cy="26" r="14" fill="rgba(255,255,255,0.22)"/>` : ""}<circle cx="${x(i)}" cy="26" r="${next ? 8 : 6}" fill="${done || next ? "#fff" : "none"}" stroke="#fff" stroke-width="2"/><text x="${x(i)}" y="${H - 6}" text-anchor="middle">${esc(new Date(s.start).toLocaleDateString("en-AU", { day: "numeric", month: "short" }))}</text>`;
    }).join("")}</svg>`;
  }

  window.V = { esc, icon, hue, person, first, av, img, pill, act, sec, row, empty, kv, plural, timeRange, dayLong, project, readiness, lifetimePaid, convoFor, unreadFor, money, searchBox, seg, earnings, balance, weekBars, barChart, spark, voucherCard, fileInputHidden, initials, mod, mh, tile, tiles };

  // ── Artist ────────────────────────────────────────────────
  const myAppts = (S) => S.appts.filter((a) => a.artistId === "a1");
  const taskIcon = (kind) => ({ request: "sparkle", deposit: "card", form: "pen", balance: "wallet", reply: "chat", waitlist: "hourglass", setup: "shield", followup: "clock" })[kind] || "bell";

  function today(S, ui) {
    const now = Date.now();
    const mine = myAppts(S).filter((a) => a.status !== "cancelled");
    const todays = mine.filter((a) => D.sameDay(a.start, now)).sort((a, b) => a.start - b.start);
    const chair = todays.filter((a) => !a.consult);
    const live = chair.find((a) => a.status === "confirmed" && now >= a.start && now < a.start + a.mins * 60000);
    const nextToday = todays.find((a) => a.status === "confirmed" && a.start > now);
    const nextAny = nextToday || mine.filter((a) => a.start > now && a.status === "confirmed").sort((a, b) => a.start - b.start)[0];
    const tasks = activeTasks(S);
    const needs = tasks.filter((t) => !t.cold && !t.quiet);
    const cold = tasks.filter((t) => t.cold);
    const hero = {
      kicker: dayLong(now),
      big: String(chair.length),
      cond: chair.length === 1 ? "sitting today" : "sittings today",
      sub: live ? `${first(live.clientId)} is in the chair until ${D.fmtTime(live.start + live.mins * 60000)}` : nextAny ? `Next up ${first(nextAny.clientId)}, ${D.sameDay(nextAny.start, now) ? D.fmtTime(nextAny.start) : D.fmtRel(nextAny.start)}` : "Nothing else booked",
      horizon: dayArc(S, chair),
    };
    let b = "";

    // Summary sentence and the hour-by-hour strip, like Weather's hourly card.
    const focus = live || nextToday;
    let summary;
    if (focus) {
      const owing = focus.price - focus.paid;
      let actions = `<button class="btn small" ${act("open", "booking:" + focus.id)}>Open booking</button>`;
      if (live && !live.arrived) actions = `<button class="btn small primary" ${act("arrived", live.id)}>Client arrived</button>` + actions;
      else if (live) actions = `<button class="btn small primary" ${act("finish", live.id)}>${owing > 0 ? "Finish & request " + money(owing) : "Finish session"}</button>` + actions;
      summary = `<div class="summary">${live ? `${live.arrived ? `${esc(first(live.clientId))} arrived at ${D.fmtTime(live.arrived)}` : `${esc(person(live.clientId).name)} is booked in now`} for ${esc(project(live.projectId).name.toLowerCase())}, ${esc(D.sittingLabel(live).toLowerCase())}.` : `${esc(person(focus.clientId).name)} is next at ${D.fmtTime(focus.start)} for ${esc(project(focus.projectId).name.toLowerCase())}.`} ${esc(readinessText(S, focus))}<div class="btns">${actions}</div></div>`;
    } else summary = `<div class="summary">${chair.length ? "Today's sittings are done." : "No sittings today. A good day for drawing."}</div>`;
    const dayKey = D.DAY_KEYS[new Date().getDay()];
    const hrs = S.hours[dayKey];
    let startH = hrs && hrs.on ? Number(hrs.start.split(":")[0]) : 9, endH = hrs && hrs.on ? Number(hrs.end.split(":")[0]) : 17;
    chair.forEach((a) => {
      startH = Math.min(startH, new Date(a.start).getHours());
      endH = Math.max(endH, new Date(a.start + a.mins * 60000 - 1).getHours());
    });
    const nowH = new Date().getHours();
    // Like Weather, the strip starts at "Now" while the working day is still running.
    const fromH = nowH >= startH && nowH <= endH ? nowH : startH;
    let cols = "";
    for (let h = fromH; h <= endH; h++) {
      const t = D.at(0, h, 0);
      const a = chair.find((x) => x.start < t + 3600000 && x.start + x.mins * 60000 > t);
      const label = h === nowH ? "Now" : new Date(t).toLocaleTimeString("en-AU", { hour: "numeric" }).replace(" ", "").toLowerCase();
      cols += a
        ? `<button type="button" ${act("open", "booking:" + a.id)} aria-label="${esc(person(a.clientId).name)} at ${label}"><span class="hh">${label}</span><span class="hi">${av(a.clientId, "sm")}</span><span>${esc(first(a.clientId))}</span></button>`
        : `<div><span class="hh">${label}</span><span class="hi" style="color:var(--text-3)">${icon("minus")}</span><span class="free">Free</span></div>`;
    }
    b += `<section class="card tight">${summary}<div class="hours" aria-label="Today by the hour">${cols}</div></section>`;

    const capped = ui.allTasks ? needs : needs.slice(0, 4);
    b += mod("bell", "Needs you", (capped.length ? capped.map((t) => row({ act: act("open", "task:" + t.key), t: esc(t.title), s: esc(t.context) })).join("") : empty("You're up to date.")) + (needs.length > 4 ? `<button class="row" type="button" ${act("toggleUi", "allTasks")} style="justify-content:center;min-height:46px;color:var(--text-2)">${ui.allTasks ? "Show fewer" : `Show ${needs.length - 4} more`}</button>` : ""));

    let gap = null;
    for (let i = 1; i <= 14 && !gap; i++) gap = D.workable(S, D.at(i, 0), 240);
    const waiting = S.waitlist.filter((w) => w.artistId === "a1" && w.status === "waiting").length;
    const steps = ["profile", "location", "hours", "services", "payouts"];
    const doneN = steps.filter((k) => S.artist.setup[k]).length;
    const last = S.supplyOrders.filter((o) => o.buyerId === "a1").sort((a, b) => b.at - a.at)[0];
    b += tiles([
      gap ? tile("sun", "Open day", new Date(gap).toLocaleDateString("en-AU", { weekday: "short", day: "numeric" }), waiting ? `Nothing booked. ${plural(waiting, "client")} on your waitlist.` : "Nothing booked yet.", act("open", "waitlist:")) : null,
      doneN < steps.length ? tile("shield", "Setup", `${doneN}/${steps.length}`, S.artist.setup.profile ? "Connect payouts" : "Add a profile photo", act("open", S.artist.setup.profile ? "bank:" : "profileEdit:"), `<div class="bar-track" style="margin-top:8px"><i style="width:${(doneN / steps.length) * 100}%"></i></div>`) : null,
      cold.length ? tile("clock", "Gone quiet", String(cold.length), esc(cold[0].title), act("open", "task:" + cold[0].key)) : null,
      last ? tile("bag", "Reorder", `${D.daysBetween(last.at, now)}d`, `Since your last ${esc(S.suppliers.find((s) => s.id === last.supplierId).name)} order.`, act("reorder", last.id)) : null,
    ]);
    return Object.assign(hero, { body: b });
  }

  function inbox(S, ui) {
    const me = window.App.me();
    const role = S.role;
    const q = (ui.inboxQ || "").toLowerCase();
    const other = (c) => (c.a === me ? c.b : c.a);
    const list = S.convos
      .filter((c) => c.a === me || c.b === me)
      .map((c) => ({ c, last: c.msgs[c.msgs.length - 1], who: other(c) }))
      .filter((x) => !q || person(x.who).name.toLowerCase().includes(q) || (x.last && (x.last.text || "").toLowerCase().includes(q)))
      .sort((a, b) => (b.last ? b.last.at : 0) - (a.last ? a.last.at : 0));
    const leads = role === "artist" ? S.leads.filter((l) => (l.artistId || "a1") === "a1" && l.status === "new" && (!q || person(l.clientId).name.toLowerCase().includes(q))) : [];
    const unread = unreadFor(S, me);
    const hero = { big: String(unread), cond: "unread", sub: role === "artist" ? (leads.length ? plural(leads.length, "new booking request") : "No new booking requests") : role === "client" ? "From your artists" : "From artists you supply" };
    let b = searchBox("ui.inboxQ", ui.inboxQ, "Search");
    if (leads.length) b += mod("sparkle", "New requests", leads.map((l) => row({ act: act("open", "lead:" + l.id), lead: av(l.clientId), t: esc(person(l.clientId).name), s: `${esc(l.project)}, ${esc(l.budget)}`, end: `<span class="small">${D.fmtAgo(l.created)}</span>` })).join(""));
    const preview = (m) => (!m ? "" : m.type === "image" ? "Photo" : m.type === "proposal" ? "Booking proposal" : m.type === "payreq" ? "Payment requested" : m.type === "offer" ? "Offer" : m.type === "reschedule" ? "New time proposed" : m.type === "waitoffer" ? "Earlier time offered" : m.text);
    b += mod("chat", "Conversations", list.length ? list.map(({ c, last, who }) => {
      const n = (c.unread || {})[me] || 0;
      return row({ act: act("chat", c.id), lead: av(who), t: esc(person(who).name), s: `${last && last.from === me ? "You: " : ""}${esc(preview(last))}`, end: `<span class="small">${last ? D.fmtAgo(last.at) : ""}</span>${n ? `<span class="dot" style="margin:6px 0 0 auto" aria-label="${n} unread"></span>` : ""}`, noChev: true });
    }).join("") : empty(q ? "No conversations match your search." : "Your conversations will appear here."));
    return Object.assign(hero, { body: b });
  }

  function calendar(S, ui) {
    const now = Date.now();
    const off = ui.calWeek || 0;
    const nowD = new Date();
    const monday = D.startOfDay(now) - ((nowD.getDay() + 6) % 7) * D.DAY + off * 7 * D.DAY;
    const mine = myAppts(S).filter((a) => a.status !== "cancelled" && !a.consult);
    const week = mine.filter((a) => a.start >= monday && a.start < monday + 7 * D.DAY);
    const held = week.filter((a) => a.status !== "proposed");
    const value = week.reduce((s, a) => s + a.price, 0);
    const weekLabel = off === 0 ? "this week" : off === 1 ? "next week" : off === -1 ? "last week" : "week of " + new Date(monday).toLocaleDateString("en-AU", { day: "numeric", month: "short" });
    const hero = { kicker: new Date(monday).toLocaleDateString("en-AU", { month: "long", year: "numeric" }), big: String(held.length), cond: held.length === 1 ? `sitting ${weekLabel}` : `sittings ${weekLabel}`, sub: value ? `${money(value, { whole: true })} booked${week.some((a) => a.status === "proposed") ? ", some awaiting deposit" : ""}` : "Nothing booked yet" };
    // Seven days drawn like Weather's ten-day forecast: booked hours across the working window.
    const W0 = 8, W1 = 21;
    const rows = Array.from({ length: 7 }, (_, i) => {
      const d = monday + i * D.DAY;
      const dd = new Date(d);
      const hrs = S.hours[D.DAY_KEYS[dd.getDay()]];
      const away = S.travel.find((t) => d >= D.startOfDay(t.from) && d <= D.startOfDay(t.to));
      const items = mine.filter((a) => D.sameDay(a.start, d));
      const pos = (t) => Math.max(0, Math.min(100, ((new Date(t).getHours() + new Date(t).getMinutes() / 60 - W0) / (W1 - W0)) * 100));
      const label = D.sameDay(d, now) ? "Today" : dd.toLocaleDateString("en-AU", { weekday: "short" });
      const ic = away ? "plane" : items.length ? "user" : !hrs.on ? "moon" : "sun";
      const segs = items.map((a) => `<i class="${a.status === "proposed" ? "p" : ""}" style="left:${pos(a.start)}%;right:${100 - pos(a.start + a.mins * 60000)}%"></i>`).join("");
      const nowDot = D.sameDay(d, now) ? `<b style="left:${pos(now)}%"></b>` : "";
      const v = items.length ? String(items.length) : away ? "Away" : !hrs.on ? "Off" : "Free";
      return `<button type="button" class="wrow" ${act("open", "day:" + d)} aria-label="${esc(dayLong(d))}, ${items.length ? plural(items.length, "sitting") : v}"><span class="wd">${label}</span><span class="wi">${icon(ic)}</span><span class="wtrack">${segs}${nowDot}</span><span class="wv">${v}</span></button>`;
    }).join("");
    const nav = `<button type="button" ${act("calWeek", -1)} aria-label="Previous week">${icon("chevL")}</button>${off ? `<button type="button" ${act("calWeek", 0)}>Today</button>` : ""}<button type="button" ${act("calWeek", 1)} aria-label="Next week">${icon("chevR")}</button>`;
    let b = mod("cal", off === 0 ? "This week" : "Week of " + new Date(monday).toLocaleDateString("en-AU", { day: "numeric", month: "short" }), rows, nav);
    const upcoming = mine.filter((a) => a.start > now && a.status !== "completed").sort((a, b) => a.start - b.start).slice(0, 4);
    b += mod("clock", "Coming up", upcoming.map((a) => row({ act: act("open", "booking:" + a.id), lead: av(a.clientId, "sm"), t: esc(person(a.clientId).name), s: `${esc(project(a.projectId).name)}, ${esc(D.sittingLabel(a).toLowerCase())}`, end: `<span class="small">${esc(D.fmtDate(a.start))}</span>` })).join("") || empty("Nothing coming up."));
    const proposed = [...new Set(mine.filter((a) => a.status === "proposed").map((a) => a.projectId))];
    const trip = S.travel.filter((t) => t.to >= now).sort((a, b) => a.from - b.from)[0];
    b += tiles([
      tile("card", "Awaiting deposit", String(proposed.length), proposed.length ? `${esc(first(S.appts.find((a) => a.projectId === proposed[0]).clientId))}'s dates aren't held yet.` : "Every proposal is paid.", proposed.length ? act("open", "booking:" + S.appts.find((a) => a.projectId === proposed[0]).id) : null),
      tile("plane", "Away", trip ? esc(trip.city) : "None", trip ? `From ${esc(D.fmtDate(trip.from))}. Those days are blocked.` : "Add guest spots and travel.", act("open", "travel:")),
    ]);
    return Object.assign(hero, { body: b });
  }

  function clientList(S) {
    return Object.values(S.people)
      .filter((p) => p.role === "client")
      .map((p) => {
        const appts = S.appts.filter((a) => a.artistId === "a1" && a.clientId === p.id);
        const next = appts.filter((a) => a.start > Date.now() && ["confirmed", "proposed"].includes(a.status)).sort((a, b) => a.start - b.start)[0];
        const lead = S.leads.find((l) => l.clientId === p.id && l.status === "new" && (l.artistId || "a1") === "a1");
        const status = next ? "booked" : lead ? "enquiry" : appts.some((a) => a.status === "completed") ? "past" : "other";
        return { p, next, status, paid: lifetimePaid(S, p.id), sittings: appts.filter((a) => a.status === "completed").length };
      });
  }
  function clients(S, ui) {
    const all = clientList(S);
    const q = (ui.clientQ || "").toLowerCase();
    const list = all.filter((x) => !q || [x.p.name, x.p.email, x.p.phone].join(" ").toLowerCase().includes(q));
    const booked = all.filter((x) => x.status === "booked").length;
    const hero = { big: String(all.length), cond: "clients", sub: `${booked} with work booked` };
    const r = (x) => row({ act: act("open", "client:" + x.p.id), lead: av(x.p.id), t: esc(x.p.name), s: x.next ? `${esc(D.fmtDate(x.next.start))}${x.next.status === "proposed" ? ", deposit due" : ""}` : x.status === "enquiry" ? "Booking request" : x.sittings ? `${plural(x.sittings, "sitting")} done` : "No bookings yet", end: x.paid ? money(x.paid, { whole: true }) : "" });
    const group = (st) => list.filter((x) => (st === "other" ? ["past", "other"].includes(x.status) : x.status === st)).sort((a, b) => (a.next ? a.next.start : 0) - (b.next ? b.next.start : 0) || a.p.name.localeCompare(b.p.name));
    let b = searchBox("ui.clientQ", ui.clientQ, "Name, email or phone");
    const g1 = group("booked"), g2 = group("enquiry"), g3 = group("other");
    if (g1.length) b += mod("cal", "Booked", g1.map(r).join(""));
    if (g2.length) b += mod("sparkle", "Booking requests", g2.map(r).join(""));
    if (g3.length) b += mod("users", "Everyone else", g3.map(r).join(""));
    if (!list.length) b += `<div class="card">${empty(q ? "No matching clients. Try a different name." : "Clients appear here when they enquire.")}</div>`;
    return Object.assign(hero, { body: b });
  }

  function moneyPage(S, ui) {
    const period = ui.moneyPeriod || "30";
    const from = period === "all" ? 0 : Date.now() - Number(period) * D.DAY;
    const e = earnings(S, from);
    const bal = balance(S);
    const tier = S.settings.tier;
    const bars = weekBars(S, 8);
    const hero = { big: money(bal.available, { whole: true }), cond: "ready for your next payout", sub: bal.next ? `${money(bal.transit)} arrives ${D.fmtDate(bal.next.at)}` : "No payouts on the way", horizon: lineHorizon(bars.map((x) => x.v), [[0, new Date(bars[0].from).toLocaleDateString("en-AU", { day: "numeric", month: "short" })], [bars.length - 1, "This week"]], "Weekly earnings, last eight weeks") };
    const per = ["30", "90", "all"].map((p) => `<button type="button" aria-pressed="${period === p}" data-act="set" data-path="ui.moneyPeriod" data-v="${p}">${p === "all" ? "All" : p + "d"}</button>`).join("");
    let b = mod("wallet", "Earnings", `<div style="padding:6px 0 10px">${kv("Clients paid you", money(e.gross))}${e.refunded ? kv("Refunds", money(-e.refunded)) : ""}${kv(`Your Tattoi fee`, money(-e.artistFee))}${kv("You earned", money(e.net), "total")}</div>`, per);
    b += tiles([
      tile("tag", "Tattoi fee", `${Math.round(D.TIERS[tier].artistFee * 100)}%`, tier === "free" && e.artistFee ? `On Pro you'd have kept ${money(e.artistFee, { whole: true })} this period.` : "You keep every dollar on this plan.", act("open", "plans:")),
      tile("card", "Card processing", "3.4%", `Paid by your clients, minimum $5. ${money(e.processing, { whole: true })} this period.`),
    ]);
    const tx = S.txns.filter((t) => t.artistId === "a1" && t.at >= from).sort((a, b) => b.at - a.at);
    b += mod("list", "Transactions", (tx.length ? tx.slice(0, ui.allTx ? 99 : 5).map((t) => row({ act: act("open", "txn:" + t.id), lead: av(t.clientId, "sm"), t: esc(person(t.clientId).name), s: `${esc(t.kind)}, ${D.fmtDate(t.at)}`, end: t.status === "refunded" ? `<s>${money(t.base)}</s>` : money(t.base) })).join("") : empty("No transactions in this period.")) + (tx.length > 5 ? `<button class="row" type="button" ${act("toggleUi", "allTx")} style="justify-content:center;min-height:46px;color:var(--text-2)">${ui.allTx ? "Show fewer" : `Show all ${tx.length}`}</button>` : ""));
    b += mod("truck", "Payouts", S.payouts.slice().sort((a, b) => b.at - a.at).map((p) => row({ t: money(p.amount), s: p.status === "paid" ? `Paid ${D.fmtDate(p.at)}` : `Arrives ${D.fmtDate(p.at)}`, end: p.status === "paid" ? pill("good", "Paid") : pill("st", "On its way") })).join(""));
    if (S.refunds.length) b += mod("refresh", "Refunds", S.refunds.map((r) => row({ t: `${money(r.amount)} to ${esc(person(r.clientId).name)}`, s: `${esc(r.kind)}, ${D.fmtDate(r.at)}` })).join(""));
    return Object.assign(hero, { body: b });
  }

  function offers(S, ui) {
    const live = S.offers.filter((o) => !o.archived);
    const issued = S.issued.slice().sort((a, b) => b.at - a.at);
    const active = issued.filter((i) => i.status === "active");
    const waiting = S.waitlist.filter((w) => w.artistId === "a1" && w.status === "waiting");
    const sold = S.txns.filter((t) => t.kind === "Gift voucher" && t.artistId === "a1");
    const hero = { big: String(live.length), cond: live.length === 1 ? "live offer" : "live offers", sub: `${active.length} with clients right now` };
    let b = `<div class="hscroll">${live.map((o) => `<button type="button" style="width:min(74vw,280px);text-align:left" ${act("open", "offer:" + o.id)} aria-label="${esc(o.name)}">${voucherCard(S, o)}</button>`).join("")}<button type="button" class="card" style="width:140px;display:grid;place-items:center;align-content:center;gap:6px;text-align:center" ${act("open", "offerWizard:")}>${icon("plus")}<span style="font-weight:600">New offer</span></button></div>`;
    b += tiles([
      tile("hourglass", "Waitlist", String(waiting.length), waiting.length ? `${waiting.map((w) => esc(first(w.clientId))).join(" and ")} want an earlier sitting.` : "Offer open slots here first.", act("open", "waitlist:")),
      tile("gift", "Vouchers sold", money(sold.reduce((s, t) => s + t.base, 0), { whole: true }), `${plural(sold.length, "gift voucher")} bought by clients.`),
    ]);
    b += mod("users", "With clients", issued.length ? issued.map((i) => {
      const o = S.offers.find((x) => x.id === i.offerId) || {};
      return row({ act: act("chatWith", i.clientId), lead: av(i.clientId, "sm"), t: esc(person(i.clientId).name), s: `${esc(o.name || "Offer")}, ${esc(i.code)}`, end: i.status === "active" ? (i.remaining != null ? money(i.remaining, { whole: true }) : "Active") : i.status === "used" ? "Used" : "Given", noChev: true });
    }).join("") : empty("Offers you send appear here."));
    b += `<p class="small faint" style="margin:4px 4px 0">${esc(D.OFFER_TERMS)}</p>`;
    return Object.assign(hero, { body: b });
  }

  function supplies(S, ui) {
    const cartN = S.cart.reduce((s, l) => s + l.qty, 0);
    const mine = S.supplyOrders.filter((o) => o.buyerId === "a1").sort((a, b) => b.at - a.at);
    const onWay = mine.filter((o) => o.status !== "delivered").length;
    const hero = { big: String(cartN), cond: cartN === 1 ? "item in your cart" : "items in your cart", sub: onWay ? `${plural(onWay, "order")} on the way` : "Nothing on the way" };
    let b = "";
    if (cartN) {
      const total = S.cart.reduce((s, l) => s + l.price * l.qty, 0);
      b += `<section class="card tight"><div class="summary">${plural(cartN, "item")} come to ${money(total)} before delivery.<div class="btns"><button class="btn small primary" ${act("open", "cart:")}>Review cart</button></div></div></section>`;
    }
    const linked = S.suppliers.filter((s) => s.linked);
    b += mod("store", "Your suppliers", linked.map((s) => row({ act: act("open", "store:" + s.id), lead: `<span class="thumb" style="width:40px;height:40px;border-radius:10px">${img(s.motif, s.id, 80, 80)}</span>`, t: esc(s.name), s: esc(s.category) })).join("") || empty("Add a supplier below."));
    const q = (ui.supQ || "").toLowerCase();
    const others = S.suppliers.filter((s) => !s.linked && (!q || (s.name + s.category).toLowerCase().includes(q)));
    b += mod("search", "Find suppliers", `<div style="padding-top:10px">${searchBox("ui.supQ", ui.supQ, "Search suppliers")}</div>` + (others.length ? others.map((s) => row({ act: act("open", "store:" + s.id), lead: `<span class="thumb" style="width:40px;height:40px;border-radius:10px">${img(s.motif, s.id, 80, 80)}</span>`, t: esc(s.name), s: `${esc(s.category)}, ${esc(s.city)}` })).join("") : empty(q ? "No suppliers match." : "You've added every supplier.")));
    b += mod("truck", "Your orders", mine.length ? mine.map((o) => row({ act: act("open", "supplyOrder:" + o.id), t: `Order ${o.number}`, s: `${esc(S.suppliers.find((s) => s.id === o.supplierId).name)}, ${D.fmtDate(o.at)}`, end: o.status === "delivered" ? pill("good", "Delivered") : o.status === "fulfilled" ? pill("st", "Shipped") : pill("wait", "Paid") })).join("") : empty("Orders you place appear here."));
    return Object.assign(hero, { body: b });
  }

  function business(S, ui) {
    const A = S.artist;
    const hero = { kicker: A.studio, big: String(A.link.requests), cond: "booking requests", sub: `${A.link.views.toLocaleString("en-AU")} profile views` };
    let b = mod("link", "Booking link", `<div class="row"><span class="grow"><span class="t">tattoi.app/${esc(A.handle)}</span><span class="s">${A.link.enabled ? "Taking booking requests" : "Paused"}</span></span><button class="switch" role="switch" aria-checked="${A.link.enabled}" aria-label="Booking link on" ${act("toggle", "artist.link.enabled")}></button></div><div class="btns" style="padding:0 0 14px"><button class="btn small" ${act("copy", "https://tattoi.app/" + A.handle)}>Copy link</button><button class="btn small" ${act("open", "artist:a1")}>Preview page</button></div>`);
    b += mod("image", "Portfolio", `<div class="grid3" style="margin:12px 0 14px">${Array.from({ length: 6 }, (_, i) => {
      const motif = ["botanical", "blackwork", "sacred", "botanical", "mandala", "geo"][i];
      return `<button type="button" ${act("open", `piece:${motif}|rory-${i}|a1`)} aria-label="Portfolio piece ${i + 1}">${img(motif, "rory-" + i, 160, 160)}</button>`;
    }).join("")}</div>`, `<button type="button" ${act("open", "instagram:")}>Import</button>`);
    const R = (t, s, sheet) => row({ act: act("open", sheet), t, s });
    const bal = balance(S);
    b += mod("wallet", "Daily tools", R("Money", `${money(bal.available, { whole: true })} ready for payout`, "page:money") + R("Offers", `${S.offers.filter((o) => !o.archived).length} live offers`, "page:offers") + R("Supplies", `${S.cart.reduce((s, l) => s + l.qty, 0)} in your cart`, "page:supplies"));
    b += mod("sliders", "Your business", R("Services & availability", "Pricing, hours, breaks and time off", "hours:") + R("Booking link & intake", "What clients fill in", "link:") + R("Forms & consent", "Templates and procedure records", "formsAdmin:") + R("Travel & guest spots", S.travel.length ? `${S.travel[0].city}, ${D.fmtDate(S.travel[0].from)}` : "Dates and destinations", "travel:") + R("Cancellation waitlist", plural(S.waitlist.filter((w) => w.status === "waiting").length, "client") + " waiting", "waitlist:") + R("Shopfront", "Products and workshops", "shop:") + R("Studio", S.studio ? esc(S.studio.name) : "A shared schedule with your team", "studio:"));
    b += mod("user", "Account", R("Profile", "Name, photo, bio and styles", "profileEdit:") + R("Bank payouts", A.setup.payouts ? "Connected" : "Not connected", "bank:") + R("Your plan", `${D.TIERS[S.settings.tier].label}, ${S.settings.tier === "free" ? "2% Tattoi fee" : "no Tattoi fee"}`, "plans:") + R("Import clients", "Bring your existing records", "importClients:") + R("Notifications", "Alerts and saved messages", "notifications:") + R("Help & account", "Role, sample data and sign out", "account:"));
    return Object.assign(hero, { body: b });
  }

  // ── Client ────────────────────────────────────────────────
  function tattoos(S, ui) {
    const now = Date.now();
    const mineA = S.appts.filter((a) => a.clientId === "c1" && a.status !== "cancelled");
    const next = mineA.filter((a) => a.status === "confirmed" && a.start + a.mins * 60000 > now).sort((a, b) => a.start - b.start)[0];
    const pending = [...new Set(mineA.filter((a) => a.status === "proposed").map((a) => a.projectId))];
    let hero;
    if (next) {
      const d = D.daysBetween(now, next.start);
      hero = { kicker: dayLong(next.start), big: d === 0 ? D.fmtTime(next.start).replace(/(am|pm)/, "") : String(d), cond: d === 0 ? "today" : d === 1 ? "day to your next sitting" : "days to your next sitting", sub: `${project(next.projectId).name} with ${first(next.artistId)}`, horizon: (() => { const ss = D.projectSittings(S, next.projectId).filter((s) => s.status !== "cancelled"); return ss.length > 1 ? sittingLine(ss, next.id) : ""; })() };
    } else hero = { big: String(pending.length), cond: "proposals waiting", sub: "Your tattoos, bookings and aftercare" };
    let b = "";
    if (next) {
      const forms = S.forms.filter((f) => f.apptId === next.id && f.status === "pending");
      const owing = next.price - next.paid;
      const lines = [forms.length ? "Your consent forms for this sitting are ready to sign." : "Your forms are signed.", owing > 0 ? `${money(owing)} is due on the day.` : "This sitting is paid in full."];
      b += `<section class="card tight"><div class="summary">${esc(D.sittingLabel(next))}, ${D.fmtTime(next.start)} at ${esc(next.artistId === "a1" ? S.artist.studio : person(next.artistId).city)}. ${lines.join(" ")}<div class="btns">${forms.length ? `<button class="btn small primary" ${act("open", "sign:" + next.id)}>Review & sign</button>` : ""}${owing > 0 ? `<button class="btn small" ${act("open", "checkout:balance|" + next.id)}>Pay early</button>` : ""}<button class="btn small" ${act("open", "project:" + next.projectId)}>Details</button></div></div></section>`;
    }
    pending.forEach((pid) => {
      const ss = D.projectSittings(S, pid).filter((s) => s.status === "proposed");
      b += mod("card", "Booking proposal", `<div class="summary">${esc(person(ss[0].artistId).name)} proposed ${plural(ss.length, "sitting")} for ${esc(project(pid).name.toLowerCase())}, starting ${esc(D.fmtDate(ss[0].start))}. A ${money(ss.reduce((s, a) => s + a.deposit, 0))} deposit secures every date.<div class="btns"><button class="btn small primary" ${act("open", "proposal:" + pid)}>Review proposal</button></div></div>`);
    });
    S.waitlist.filter((w) => w.clientId === "c1" && w.status === "offered").forEach((w) => {
      b += mod("hourglass", "Earlier time", `<div class="summary">${esc(first(w.artistId))} can see you ${esc(D.fmtRel(w.offer.start))}. The offer ends ${esc(D.fmtRel(w.offer.expires))}.<div class="btns"><button class="btn small primary" ${act("waitAccept", w.id)}>Accept</button><button class="btn small" ${act("waitDecline", w.id)}>Not this time</button></div></div>`);
    });
    const care = D.aftercareFor(S, "c1");
    const offersMine = S.issued.filter((i) => i.clientId === "c1" && i.status === "active");
    b += tiles([
      care ? tile("leaf", "Aftercare", `Day ${care.day}`, `${esc(care.phase.label)}. ${esc(care.phase.text.split(". ")[0])}.`, act("open", "project:" + care.appt.projectId), `<div class="gauge"><b style="left:${Math.min(100, (care.day / 30) * 100)}%"></b></div>`) : null,
      tile("gift", "Offers", String(offersMine.length), offersMine.length ? esc(S.offers.find((o) => o.id === offersMine[0].offerId).name) + (offersMine.length > 1 ? ` and ${offersMine.length - 1} more` : "") : "Offers from your artists land here.", act("go", "3")),
    ]);
    const projects = [...new Set(mineA.map((a) => a.projectId))].filter((pid) => !pending.includes(pid));
    b += mod("leaf", "Your projects", projects.map((pid) => {
      const ss = D.projectSittings(S, pid);
      const pr = D.progress(ss);
      return row({ act: act("open", "project:" + pid), lead: `<span class="thumb" style="width:44px;height:44px">${img(project(pid).motif, project(pid).seed, 88, 88)}</span>`, t: esc(project(pid).name), s: `${esc(person(ss[0].artistId).name)}, ${pr.total ? `${pr.completed} of ${pr.total} done` : plural(pr.completed, "sitting") + " done"}` });
    }).join("") || empty("Your projects appear here once an artist books you in."));
    const reqs = S.leads.filter((l) => l.clientId === "c1");
    if (reqs.length) b += mod("sparkle", "Your requests", reqs.map((l) => row({ act: act("chatWith", l.artistId || "a1"), t: `${esc(l.project)} with ${esc(first(l.artistId || "a1"))}`, s: "Received. Proposed dates will appear here." })).join(""));
    return Object.assign(hero, { body: b });
  }

  function discover(S, ui) {
    const style = ui.style || "All";
    const artists = Object.values(S.people).filter((p) => p.role === "artist" && (style === "All" || p.styles.includes(style)));
    const hero = { big: String(artists.length), cond: style === "All" ? "artists near you" : `${style.toLowerCase()} artists`, sub: "Brisbane and the coast" };
    let b = `<div class="hscroll">${["All", ...D.STYLES].map((s) => `<button type="button" class="chip" aria-pressed="${s === style}" data-act="set" data-path="ui.style" data-v="${esc(s)}">${esc(s)}</button>`).join("")}</div>`;
    b += mod("pin", "Near you", `<div class="map">${artists.map((a) => `<button type="button" class="pin" style="left:${12 + a.x * 76}%;top:${18 + a.y * 70}%" ${act("open", "artist:" + a.id)}><span>${esc(a.name.split(" ")[0])}</span><i></i></button>`).join("")}</div>`);
    // Artist cards in the shape of Weather's location list.
    b += artists.map((a) => {
      const motif = window.Art.STYLE_MOTIF[a.styles[0]] || "mandala";
      const fav = S.favourites.includes(a.id);
      return `<article class="card photo-card" style="position:relative;overflow:hidden;padding:0;min-height:132px"><img src="${window.Art.url(motif, a.id + "-card", 360, 140)}" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover"><span aria-hidden="true" style="position:absolute;inset:0;background:linear-gradient(90deg,rgba(10,14,28,0.66),rgba(10,14,28,0.18))"></span><button type="button" style="position:relative;display:flex;justify-content:space-between;gap:12px;width:100%;padding:14px 16px;text-align:left" ${act("open", "artist:" + a.id)}><span class="stack-s"><span style="font-size:22px;font-weight:600">${esc(a.name)}</span><span class="small muted">${esc(a.city)}</span><span class="small" style="margin-top:14px">${esc(a.styles.join(", "))}</span></span><span class="small muted" style="text-align:right;max-width:40%">${esc(a.next)}</span></button><button type="button" class="icon-btn glass" style="position:absolute;right:12px;bottom:12px" aria-pressed="${fav}" aria-label="${fav ? "Remove from" : "Add to"} your artists" ${act("fav", a.id)}>${fav ? `<svg viewBox="0 0 24 24" width="20" height="20" fill="#fff" aria-hidden="true"><path d="${ICONS.heart}"/></svg>` : icon("heart")}</button></article>`;
    }).join("") || `<div class="card">${empty("No artists in this style yet.")}</div>`;
    return Object.assign(hero, { body: b });
  }

  function profileClient(S, ui) {
    const me = S.people.c1;
    const pendingForms = S.forms.filter((f) => f.clientId === "c1" && f.status === "pending");
    const offersMine = S.issued.filter((i) => i.clientId === "c1" && i.status === "active");
    const hero = { kicker: me.city, big: String(pendingForms.length), cond: pendingForms.length === 1 ? "form to sign" : "forms to sign", sub: `${plural(offersMine.length, "offer")} from your artists` };
    let b = "";
    if (pendingForms.length) b += `<section class="card tight"><div class="summary">${esc(pendingForms.map((f) => f.kind).join(" and "))} for ${esc(D.fmtDate(S.appts.find((a) => a.id === pendingForms[0].apptId).start))}.<div class="btns"><button class="btn small primary" ${act("open", "sign:" + pendingForms[0].apptId)}>Review & sign</button></div></div></section>`;
    b += mod("gift", "Promotions", `<div class="hscroll" style="padding-top:12px;padding-bottom:12px">${offersMine.map((i) => {
      const o = S.offers.find((x) => x.id === i.offerId);
      return `<button type="button" style="width:min(70vw,260px);text-align:left" ${act("open", "issued:" + i.id)}>${voucherCard(S, Object.assign({}, o, i.remaining != null ? { value: i.remaining } : {}), `${esc(i.code)}, from ${esc(person("a1").name)}`)}</button>`;
    }).join("") || `<div class="empty small">Offers from your artists will appear here.</div>`}</div><div class="btns" style="padding-bottom:14px"><button class="btn small" ${act("open", "giftBuy:a1")}>Buy a gift voucher</button></div>`);
    const favs = S.favourites.map((id) => S.people[id]).filter(Boolean);
    b += mod("heart", "Your artists", favs.map((a) => row({ act: act("open", "artist:" + a.id), lead: av(a.id), t: esc(a.name), s: `${esc(a.styles.join(", "))}, ${esc(a.city)}` })).join("") || empty("Tap the heart on an artist to keep them here."));
    if (S.saved.length) b += mod("image", "Saved pieces", `<div class="grid3" style="margin:12px 0 14px">${S.saved.map((s) => `<button type="button" ${act("open", `piece:${s.motif}|${s.seed}|${s.artistId}`)}>${img(s.motif, s.seed, 160, 160)}</button>`).join("")}</div>`);
    const R = (t, s, a) => row({ act: a, t, s });
    b += mod("user", "Account", R(esc(me.name), "Personal details", act("open", "personal:")) + R("Forms & documents", "Consent forms from your artists", act("open", "formsList:")) + R("Purchases", plural(S.purchases.length, "purchase"), act("open", "purchases:")) + R("Notifications", "Messages and bookings", act("open", "notifications:")) + R("Help & account", "Role, sample data and sign out", act("open", "account:")));
    return Object.assign(hero, { body: b });
  }

  // ── Supplier ──────────────────────────────────────────────
  function lowStock(S) {
    const out = [];
    S.products.filter((p) => p.supplierId === "m1").forEach((p) => p.variants.forEach((v) => v.stock <= Math.max(5, Math.round(p.min / 2)) && out.push({ p, v })));
    return out;
  }
  function storeHome(S, ui) {
    const orders = S.supplyOrders.filter((o) => o.supplierId === "m1");
    const toFulfil = orders.filter((o) => o.status === "paid");
    const low = lowStock(S);
    const st = S.store;
    const weeks = Array.from({ length: 8 }, (_, i) => orders.filter((o) => Date.now() - o.at < (8 - i) * 7 * D.DAY && Date.now() - o.at >= (7 - i) * 7 * D.DAY).reduce((s, o) => s + o.total, 0) + [42000, 61000, 38000, 73000, 55000, 80000, 64000, 0][i]);
    const hero = { kicker: st.business.name, big: String(toFulfil.length), cond: toFulfil.length === 1 ? "order to fulfil" : "orders to fulfil", sub: `${plural(low.length, "variant")} running low`, horizon: lineHorizon(weeks, [[0, "8 weeks ago"], [7, "This week"]], "Weekly sales, last eight weeks") };
    let b = mod("store", "Your store", `<div class="row"><span class="grow"><span class="t">${st.published ? "Live on Tattoi" : "Hidden"}</span><span class="s wrap">${st.published ? "Artists can find your store and order." : "Publish so artists can order from you."}</span></span><button class="switch" role="switch" aria-checked="${st.published}" aria-label="Store published" ${act("toggle", "store.published")}></button></div>`);
    b += mod("bell", "Needs you", toFulfil.map((o) => row({ act: act("open", "order:" + o.id), t: `Fulfil order ${o.number}`, s: `${esc(o.buyerName)}, ${money(o.total)}` })).join("") + low.map(({ p, v }) => row({ act: act("open", "product:" + p.id), t: `${esc(p.name)}, ${esc(v.name)}`, s: v.stock === 0 ? "Out of stock" : `${v.stock} left`, end: v.stock === 0 ? pill("bad", "Out") : pill("wait", "Low") })).join("") || empty("You're all caught up."));
    const total30 = orders.filter((o) => Date.now() - o.at < 30 * D.DAY).reduce((s, o) => s + o.total, 0);
    b += tiles([tile("wallet", "Sales, 30 days", money(total30, { whole: true }), "Orders paid through Tattoi."), tile("box", "Orders", String(orders.length), "Since you joined Tattoi.", act("go", "1"))]);
    const R = (t, s, a) => row({ act: a, t, s });
    b += mod("sliders", "Manage", R("Shopify connection", st.shopify.connected ? `Synced ${D.fmtAgo(st.shopify.lastSync)} ago` : "Import your catalogue", act("open", "shopify:")) + R("Store settings", "Business details and payments", act("open", "storeSettings:")) + R("Preview your store", "What artists see", act("open", "store:m1")) + R("Help & account", "Role, sample data and sign out", act("open", "account:")));
    return Object.assign(hero, { body: b });
  }
  function storeOrders(S, ui) {
    const view = ui.orderView || "paid";
    const q = (ui.orderQ || "").toLowerCase();
    const all = S.supplyOrders.filter((o) => o.supplierId === "m1").sort((a, b) => b.at - a.at);
    const list = all.filter((o) => (view === "all" || o.status === view) && (!q || (o.number + " " + o.buyerName).toLowerCase().includes(q)));
    const n = all.filter((o) => o.status === "paid").length;
    const hero = { big: String(n), cond: "waiting to ship", sub: `${all.length} orders in total` };
    let b = searchBox("ui.orderQ", ui.orderQ, "Order number or customer");
    b += seg("ui.orderView", view, [["paid", "To fulfil"], ["fulfilled", "Shipped"], ["delivered", "Delivered"], ["all", "All"]]);
    b += mod("box", "Orders", list.length ? list.map((o) => row({ act: act("open", "order:" + o.id), lead: av(o.buyerId, "sm"), t: `#${o.number} ${esc(o.buyerName.split(",")[0])}`, s: `${D.fmtDate(o.at)}, ${plural(o.items.reduce((s, i) => s + i.qty, 0), "item")}`, end: money(o.total) })).join("") : empty(view === "paid" ? "You're all caught up. New paid orders will appear here." : "No matching orders."));
    return Object.assign(hero, { body: b });
  }
  function storeProducts(S, ui) {
    const q = (ui.prodQ || "").toLowerCase();
    const list = S.products.filter((p) => p.supplierId === "m1" && (!q || (p.name + p.category).toLowerCase().includes(q)));
    const units = list.reduce((s, p) => s + p.variants.reduce((t, v) => t + v.stock, 0), 0);
    const hero = { big: String(list.length), cond: "products", sub: `${units.toLocaleString("en-AU")} units in stock` };
    let b = searchBox("ui.prodQ", ui.prodQ, "Search products");
    b += `<div class="grid2">${list.map((p) => {
      const stock = p.variants.reduce((s, v) => s + v.stock, 0);
      const out = p.variants.some((v) => v.stock === 0);
      const prices = p.variants.map((v) => v.price);
      return `<button type="button" class="card" style="padding:0;overflow:hidden;text-align:left" ${act("open", "product:" + p.id)}><div style="aspect-ratio:4/3">${img("product", p.id, 200, 150, p.variant, p.name)}</div><div style="padding:10px 12px 12px;display:grid;gap:2px"><span style="font-weight:600">${esc(p.name)}</span><span class="small muted">${money(Math.min(...prices))}${prices.length > 1 ? "+" : ""}, ${stock} in stock</span>${out ? `<span style="margin-top:4px">${pill("bad", "A variant is out")}</span>` : ""}</div></button>`;
    }).join("")}</div>`;
    return Object.assign(hero, { body: b });
  }

  // ── Hero stats: three quiet figures under each page's headline, like Weather's high and low ──
  const whole = (c) => money(c, { whole: true });
  const daysAgo = (t) => Math.max(0, D.daysBetween(t, Date.now()));
  window.ViewStats = {
    today(S) {
      const now = Date.now();
      const todays = myAppts(S).filter((a) => D.sameDay(a.start, now) && a.status !== "cancelled" && !a.consult);
      const collect = todays.reduce((s, a) => s + Math.max(0, a.price - a.paid), 0);
      let free = null;
      for (let i = 1; i <= 21 && !free; i++) free = D.workable(S, D.at(i, 0), 240);
      return [[whole(collect), "to collect"], [String(activeTasks(S).filter((t) => !t.cold && !t.quiet).length), "need you"], [free ? new Date(free).toLocaleDateString("en-AU", { weekday: "short", day: "numeric" }) : "None", "next free day"]];
    },
    inbox(S) {
      const leads = S.leads.filter((l) => (l.artistId || "a1") === "a1" && l.status === "new");
      const oldest = leads.length ? Math.max(...leads.map((l) => daysAgo(l.created))) : 0;
      const convos = S.convos.filter((c) => c.a === "a1").length;
      return [[String(leads.length), "requests"], [leads.length ? oldest + "d" : "None", "oldest waiting"], [String(convos), "conversations"]];
    },
    calendar(S) {
      const now = Date.now();
      const monday = D.startOfDay(now) - ((new Date().getDay() + 6) % 7) * D.DAY;
      const week = myAppts(S).filter((a) => a.start >= monday && a.start < monday + 7 * D.DAY && a.status !== "cancelled" && !a.consult);
      const proposed = new Set(myAppts(S).filter((a) => a.status === "proposed").map((a) => a.projectId)).size;
      return [[Math.round(week.reduce((s, a) => s + a.mins, 0) / 60) + "h", "booked"], [whole(week.reduce((s, a) => s + a.paid, 0)), "held"], [String(proposed), "awaiting deposit"]];
    },
    clients(S) {
      const ids = Object.values(S.people).filter((p) => p.role === "client").map((p) => p.id);
      const owed = myAppts(S).filter((a) => ["confirmed", "completed"].includes(a.status)).reduce((s, a) => s + Math.max(0, a.price - a.paid), 0);
      const top = Math.max(0, ...ids.map((id) => lifetimePaid(S, id)));
      return [[String(S.leads.filter((l) => l.status === "new").length), "enquiries"], [whole(owed), "owed to you"], [whole(top), "top client"]];
    },
    money(S) {
      const m = earnings(S, Date.now() - 30 * D.DAY);
      const owed = myAppts(S).filter((a) => ["confirmed", "completed"].includes(a.status)).reduce((s, a) => s + Math.max(0, a.price - a.paid), 0);
      return [[whole(m.gross), "30 days"], [whole(m.artistFee), "in fees"], [whole(owed), "still owed"]];
    },
    offers(S) {
      const used = S.issued.filter((i) => i.status === "used").length;
      const credit = S.issued.filter((i) => i.status === "active" && i.remaining != null).reduce((s, i) => s + i.remaining, 0);
      return [[String(S.issued.length), "issued"], [String(used), "redeemed"], [whole(credit), "credit out"]];
    },
    supplies(S) {
      const mine = S.supplyOrders.filter((o) => o.buyerId === "a1");
      const last = mine.sort((a, b) => b.at - a.at)[0];
      return [[String(S.suppliers.filter((s) => s.linked).length), "suppliers"], [whole(mine.filter((o) => Date.now() - o.at < 30 * D.DAY).reduce((s, o) => s + o.total, 0)), "spent, 30 days"], [last ? daysAgo(last.at) + "d" : "None", "since last order"]];
    },
    business(S) {
      const A = S.artist;
      return [[Math.round((A.link.requests / Math.max(1, A.link.views)) * 100) + "%", "views to requests"], [D.TIERS[S.settings.tier].label, "plan"], [String(S.waitlist.filter((w) => w.status === "waiting").length), "on waitlist"]];
    },
    tattoos(S) {
      const mine = S.appts.filter((a) => a.clientId === "c1" && a.status !== "cancelled");
      const owed = mine.filter((a) => a.status === "confirmed").reduce((s, a) => s + Math.max(0, a.price - a.paid), 0);
      const forms = S.forms.filter((f) => f.clientId === "c1" && f.status === "pending").length;
      return [[String(mine.filter((a) => a.status === "completed").length), "sittings done"], [String(forms), "forms to sign"], [whole(owed), "still to pay"]];
    },
    messages(S) {
      return [[String(S.convos.filter((c) => c.b === "c1").length), "artists"], [String(S.leads.filter((l) => l.clientId === "c1").length), "requests sent"], [String(S.issued.filter((i) => i.clientId === "c1" && i.status === "active").length), "offers"]];
    },
    discover(S) {
      const near = Object.values(S.people).filter((p) => p.role === "artist" && p.city === "Brisbane").length;
      return [[String(near), "in Brisbane"], [String(S.favourites.length), "saved artists"], [String(S.saved.length), "saved pieces"]];
    },
    me(S) {
      return [[String(S.purchases.length), "purchases"], [String(S.favourites.length), "artists"], [String(S.forms.filter((f) => f.clientId === "c1" && f.status === "signed").length), "forms signed"]];
    },
    store(S) {
      const o = S.supplyOrders.filter((x) => x.supplierId === "m1");
      const avg = o.length ? o.reduce((s, x) => s + x.total, 0) / o.length : 0;
      return [[String(new Set(o.map((x) => x.buyerId)).size), "studios buying"], [whole(avg), "average order"], [S.store.published ? "Live" : "Hidden", "store"]];
    },
    orders(S) {
      const o = S.supplyOrders.filter((x) => x.supplierId === "m1");
      return [[String(o.filter((x) => x.status === "fulfilled").length), "shipped"], [String(o.filter((x) => x.status === "delivered").length), "delivered"], [whole(o.filter((x) => x.status === "paid").reduce((s, x) => s + x.total, 0)), "waiting"]];
    },
    products(S) {
      const p = S.products.filter((x) => x.supplierId === "m1");
      const vs = p.flatMap((x) => x.variants);
      return [[String(vs.length), "variants"], [String(vs.filter((v) => v.stock === 0).length), "out of stock"], [whole(vs.reduce((s, v) => s + v.price * v.stock, 0)), "stock value"]];
    },
    sinbox(S) {
      return [[String(S.convos.filter((c) => c.b === "m1").length), "conversations"], [String(new Set(S.supplyOrders.filter((x) => x.supplierId === "m1").map((x) => x.buyerId)).size), "customers"], [String(S.convos.filter((c) => c.b === "m1").reduce((s, c) => s + ((c.unread || {}).m1 || 0), 0)), "unread"]];
    },
  };

  // ── Roles: pages in swipe order, each with its sky and the dock's action ──
  window.Views = {
    roles: {
      artist: {
        label: "Artist",
        persona: "a1",
        pages: [
          { key: "today", title: "Today", tab: "Today", icon: "sun", sky: "day", render: today, fab: { label: "New booking", icon: "plus", act: "open", arg: "composer:" } },
          { key: "inbox", title: "Inbox", tab: "Inbox", icon: "chat", sky: "day", render: inbox },
          { key: "calendar", title: "Calendar", tab: "Calendar", icon: "cal", sky: "day", render: calendar, fab: { label: "New booking", icon: "plus", act: "open", arg: "composer:" } },
          { key: "clients", title: "Clients", tab: "Clients", icon: "users", sky: "day", render: clients, fab: { label: "Add client", icon: "plus", act: "open", arg: "addClient:" } },
          { key: "business", title: "Business", tab: "Business", icon: "briefcase", sky: "day", render: business },
        ],
        more: [
          { key: "money", title: "Money", render: moneyPage },
          { key: "offers", title: "Offers", render: offers, fab: { label: "New offer", icon: "plus", act: "open", arg: "offerWizard:" } },
          { key: "supplies", title: "Supplies", render: supplies },
        ],
      },
      client: {
        label: "Client",
        persona: "c1",
        pages: [
          { key: "tattoos", title: "My Tattoos", tab: "Tattoos", icon: "leaf", sky: "day", render: tattoos },
          { key: "messages", title: "Messages", tab: "Messages", icon: "chat", sky: "day", render: inbox },
          { key: "discover", title: "Discover", tab: "Discover", icon: "compass", sky: "day", render: discover },
          { key: "me", title: "Profile", tab: "Profile", icon: "user", sky: "day", render: profileClient },
        ],
      },
      supplier: {
        label: "Supplier",
        persona: "m1",
        pages: [
          { key: "store", title: "Store", tab: "Store", icon: "store", sky: "day", render: storeHome },
          { key: "orders", title: "Orders", tab: "Orders", icon: "box", sky: "day", render: storeOrders },
          { key: "products", title: "Products", tab: "Products", icon: "tag", sky: "day", render: storeProducts, fab: { label: "Add product", icon: "plus", act: "open", arg: "product:new" } },
          { key: "sinbox", title: "Messages", tab: "Messages", icon: "chat", sky: "day", render: inbox },
        ],
      },
    },
    skyOf(page) {
      return typeof page.sky === "function" ? page.sky() : page.sky;
    },
  };
})();
