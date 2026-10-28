/* Tattoi Swipe — sheets: every detail view and flow opens as a full-height sheet over the swipe pages. */
(function () {
  "use strict";
  const D = window.Data;
  const { esc, icon, person, first, av, img, pill, act, sec, row, empty, kv, plural, timeRange, dayLong, project, readiness, convoFor, money, seg, voucherCard, initials } = window.V;
  const App = () => window.App;
  const bind = (path, value, attrs) => `data-bind="${path}" value="${esc(value == null ? "" : value)}" ${attrs || ""}`;
  const field = (label, input) => `<label class="field"><span>${label}</span>${input}</label>`;
  const text = (path, value, extra) => `<input class="input" ${bind(path, value, extra)}>`;
  const area = (path, value, extra) => `<textarea class="input" data-bind="${path}" ${extra || ""}>${esc(value || "")}</textarea>`;
  const sw = (on, path, label) => `<button class="switch" role="switch" aria-checked="${!!on}" aria-label="${esc(label)}" ${act("toggle", path)}></button>`;
  const toggleRow = (t, s, on, path) => `<div class="row"><span class="grow"><span class="t">${t}</span>${s ? `<span class="s wrap">${s}</span>` : ""}</span>${sw(on, path, t)}</div>`;
  const stepper = (value, decAct, incAct, label) => `<span style="display:inline-flex;align-items:center;gap:4px" role="group" aria-label="${esc(label)}"><button class="icon-btn" style="background:var(--surface-2);width:38px;height:38px" ${decAct} aria-label="Decrease ${esc(label)}">${icon("minus")}</button><span class="num" style="min-width:28px;text-align:center;font-weight:650">${value}</span><button class="icon-btn" style="background:var(--surface-2);width:38px;height:38px" ${incAct} aria-label="Increase ${esc(label)}">${icon("plus")}</button></span>`;
  const iso = (t) => {
    const d = new Date(t);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };
  const steps = (n, i) => `<div class="steps" aria-label="Step ${i + 1} of ${n}">${Array.from({ length: n }, (_, k) => `<i class="${k <= i ? "on" : ""}"></i>`).join("")}</div>`;

  // ── Messages ──────────────────────────────────────────────
  function proposalCard(S, pid, me) {
    const ss = D.projectSittings(S, pid);
    if (!ss.length) return `<div class="card msgcard"><h3>Booking proposal</h3><p class="muted small">This proposal was removed.</p></div>`;
    const live = ss.filter((s) => s.status !== "cancelled");
    const allCancelled = !live.length;
    const pending = live.some((s) => s.status === "proposed");
    const list = allCancelled ? ss : live;
    const total = list.reduce((s, a) => s + a.price, 0);
    const deposit = list.reduce((s, a) => s + a.deposit, 0);
    const pct = list[0].price ? Math.round((list[0].deposit / list[0].price) * 100) : 0;
    const artistId = ss[0].artistId;
    const isClient = me === ss[0].clientId;
    let actions = "";
    if (pending && isClient) actions = `<div class="btns" style="margin-top:12px"><button class="btn small primary" ${act("open", "proposal:" + pid)}>Review & pay deposit</button><button class="btn small" ${act("declineProposal", pid)}>Decline</button></div>`;
    else if (pending && me === artistId) actions = `<div class="btns" style="margin-top:12px"><button class="btn small" ${act("open", "booking:" + live[0].id)}>Review booking</button><button class="btn small quiet" ${act("withdraw", pid)}>Withdraw</button></div>`;
    return `<div class="card flat msgcard">
      <div class="split"><span class="small muted">Booking proposal</span>${allCancelled ? pill("bad", project(pid).withdrawn ? "Withdrawn" : "Declined") : pending ? pill("wait", "Awaiting deposit") : pill("good", "Accepted")}</div>
      <div style="font-weight:650;font-size:18px;margin:4px 0 8px">${esc(project(pid).name)}</div>
      ${list.map((s) => `<div class="kv small"><span>${s.total > 1 ? `Sitting ${s.idx}` : "Sitting"}</span><span>${esc(D.fmtDate(s.start))}, ${D.fmtTime(s.start)}, ${D.duration(s.mins)}</span></div>`).join("")}
      ${kv("Project estimate", money(total), "total")}
      ${kv(`Deposit, ${pct}% of every sitting, paid once`, money(deposit))}
      ${kv("Balance per sitting, due on the day", money(list[0].price - list[0].deposit))}
      ${actions}
    </div>`;
  }
  function msgHTML(S, c, m, me) {
    const mine = m.from === me;
    const meta = `<div class="bubble-meta ${mine ? "me" : ""}">${D.fmtTime(m.at)}${mine && m.read ? ", read" : ""}</div>`;
    if (m.type === "system") return `<div class="sysmsg">${esc(m.text)}</div>`;
    if (m.type === "image") {
      const src = m.src || window.Art.url(m.motif || "botanical", m.seed || m.id, 300, 375);
      return `<div class="bubble img ${mine ? "me" : ""}"><img src="${src}" alt="Shared photo"></div>${meta}`;
    }
    if (m.type === "proposal") return proposalCard(S, m.proposal.projectId, me);
    if (m.type === "payreq") {
      const a = S.appts.find((x) => x.id === m.apptId);
      const payable = m.status === "open" && me === (a && a.clientId);
      return `<div class="card flat msgcard"><div class="split"><span class="small muted">Payment requested</span>${m.status === "paid" ? pill("good", "Paid") : pill("wait", "Open")}</div><div class="mid-num" style="margin:6px 0 2px">${money(m.amount)}</div><div class="small muted">${a ? esc(project(a.projectId).name + ", " + D.sittingLabel(a).toLowerCase()) : ""}</div>${payable ? `<div class="btns" style="margin-top:12px"><button class="btn small primary" ${act("open", "checkout:payreq|" + m.id)}>Review payment</button></div>` : ""}</div>`;
    }
    if (m.type === "reschedule") {
      const a = S.appts.find((x) => x.id === m.apptId);
      const isClient = a && me === a.clientId;
      const status = m.status === "accepted" ? pill("good", "New time confirmed") : m.status === "declined" ? pill("", "Original time kept") : pill("st", "Awaiting confirmation");
      return `<div class="card flat msgcard"><div class="split"><span class="small muted">Rescheduled booking</span>${status}</div><div class="kv small"><span>Originally proposed</span><span><s>${esc(D.fmtDate(m.from))}, ${D.fmtTime(m.from)}</s></span></div><div class="kv"><span>New time</span><span style="font-weight:650">${esc(D.fmtDate(m.to))}, ${D.fmtTime(m.to)}</span></div>${m.status === "pending" && isClient ? `<div class="btns" style="margin-top:10px"><button class="btn small primary" ${act("rescheduleAnswer", m.id + "|yes")}>Confirm change</button><button class="btn small" ${act("rescheduleAnswer", m.id + "|no")}>Keep original</button></div>` : m.status === "pending" ? `<p class="small muted" style="margin:6px 0 0">Waiting for ${esc(first(a.clientId))} to confirm.</p>` : ""}</div>`;
    }
    if (m.type === "offer") {
      const i = S.issued.find((x) => x.id === m.issuedId);
      const o = i && S.offers.find((x) => x.id === i.offerId);
      if (!o) return "";
      return `<div class="msgcard">${voucherCard(S, Object.assign({}, o, i.remaining != null ? { value: i.remaining } : {}), "Code " + esc(i.code))}<p class="small muted" style="margin:6px 4px 0">${me === i.clientId ? "Apply it when you pay a deposit or balance." : "Sent to " + esc(first(i.clientId)) + "."}</p></div>`;
    }
    if (m.type === "waitoffer") {
      const w = S.waitlist.find((x) => x.id === m.waitId);
      const isClient = w && me === w.clientId;
      const live = w && w.status === "offered" && w.offer && w.offer.msgId === m.id;
      return `<div class="card flat msgcard"><div class="split"><span class="small muted">Cancellation offer</span>${live ? pill("st", "Ends " + D.fmtRel(m.expires)) : w && w.status === "accepted" && w.offer && w.offer.msgId === m.id ? pill("good", "Accepted") : pill("", "Closed")}</div><div style="font-weight:650;margin:6px 0">${esc(dayLong(m.start))}, ${D.fmtTime(m.start)}</div><div class="small muted">${D.duration(m.mins)} for ${esc(project(w ? w.projectId : "").name)}. Your existing deposit moves with you.</div>${live && isClient ? `<div class="btns" style="margin-top:10px"><button class="btn small primary" ${act("waitAccept", w.id)}>Accept offer</button><button class="btn small" ${act("waitDecline", w.id)}>Not this time</button></div>` : ""}</div>`;
    }
    return `<div class="bubble ${mine ? "me" : ""}">${esc(m.text)}</div>${meta}`;
  }
  function thread(S, c, me) {
    let out = "", lastDay = null;
    c.msgs.forEach((m) => {
      const day = D.startOfDay(m.at);
      if (day !== lastDay) {
        const d = D.daysBetween(m.at, Date.now());
        out += `<div class="daylabel">${d === 0 ? "Today" : d === 1 ? "Yesterday" : esc(D.fmtDate(m.at))}</div>`;
        lastDay = day;
      }
      out += msgHTML(S, c, m, me);
    });
    return out || `<div class="empty">Say hello. Messages and photos you share stay with this booking.</div>`;
  }

  // ── Sheets ────────────────────────────────────────────────
  const Sheets = {};

  Sheets.chat = (id, S, ui, draft) => {
    const c = S.convos.find((x) => x.id === id);
    const me = App().me();
    const other = c.a === me ? c.b : c.a;
    const p = c.projectId ? project(c.projectId) : null;
    const role = S.role;
    let tools = "";
    if (role === "artist" && person(other).role === "client") {
      const owing = S.appts.find((a) => a.clientId === other && a.artistId === "a1" && ["confirmed", "completed"].includes(a.status) && a.paid < a.price && a.start < Date.now() + 3 * D.DAY);
      tools = [
        `<button class="chip" ${act("open", "composer:client=" + other)}>${icon("cal")}Book in</button>`,
        owing ? `<button class="chip" ${act("requestBalance", owing.id)}>${icon("wallet")}Request balance</button>` : "",
        `<button class="chip" ${act("open", "offerPick:" + other)}>${icon("gift")}Create promo</button>`,
        `<button class="chip" ${act("open", "templates:" + c.id)}>${icon("list")}Templates</button>`,
        c.projectId ? `<button class="chip" ${act("open", "brief:" + c.id)}>${icon("file")}Design brief</button>` : "",
        `<button class="chip" ${act("open", "notes:" + c.id)}>${icon("pen")}Private note</button>`,
      ].join("");
    } else if (role === "client") {
      const pend = S.appts.find((a) => a.clientId === me && a.artistId === other && a.status === "proposed");
      tools = [pend ? `<button class="chip" ${act("open", "proposal:" + pend.projectId)}>${icon("card")}Review booking</button>` : "", c.projectId ? `<button class="chip" ${act("open", "project:" + c.projectId)}>${icon("leaf")}Booking details</button>` : "", `<button class="chip" ${act("open", "artist:" + other)}>${icon("user")}Artist profile</button>`].join("");
    } else if (role === "supplier") {
      tools = `<button class="chip" ${act("open", "templates:" + c.id)}>${icon("list")}Templates</button>`;
    }
    return {
      chat: true,
      title: person(other).name,
      motif: p ? p.motif : "waves",
      seed: p ? p.seed : c.id,
      short: true,
      sub: p ? `${p.name}${role === "client" ? "" : ""}` : person(other).role === "supplier" ? "Supplier" : person(other).city || "",
      lead: av(other),
      body: `<div class="bubbles">${thread(S, c, me)}</div>`,
      foot: `${tools ? `<div class="tools" aria-label="Conversation tools">${tools}</div>` : ""}<div class="composer"><label class="icon-btn" style="background:var(--surface-2)" aria-label="Attach photo">${icon("image")}<input type="file" accept="image/*" data-upload="chat:${c.id}" hidden></label><textarea class="input" rows="1" placeholder="Write a message…" aria-label="Message" data-bind="draft.msg.${c.id}" data-enter="send" data-arg="${c.id}">${esc((draft.msg || {})[c.id] || "")}</textarea><button class="icon-btn solid" ${act("send", c.id)} aria-label="Send message">${icon("send")}</button></div>`,
      footBare: true,
    };
  };

  Sheets.booking = (id, S, ui, draft) => {
    const a = S.appts.find((x) => x.id === id);
    if (!a) return { title: "Booking", body: empty("This sitting is no longer available.") };
    const p = project(a.projectId);
    const now = Date.now();
    const started = now >= a.start;
    const owing = a.price - a.paid;
    const openReq = S.convos.some((c) => c.msgs.some((m) => m.type === "payreq" && m.apptId === a.id && m.status === "open"));
    const confirm = draft.confirm;
    let actions = "";
    if (a.status === "proposed") {
      actions = `<div class="note wait">Awaiting payment. Dates aren't held until ${esc(first(a.clientId))} pays the deposit.</div><div class="btns"><button class="btn" ${act("chatWith", a.clientId)}>${icon("chat")}Message</button><button class="btn danger" ${act("withdraw", a.projectId)}>Withdraw proposal</button></div>`;
    } else if (a.status === "confirmed" && !started) {
      if (confirm === "cancel:" + a.id) actions = `<div class="card flat"><h3>Cancel this session?</h3><p class="small muted" style="margin:6px 0 12px">${esc(first(a.clientId))} is told straight away. Handle any refund from Money.</p><div class="btns"><button class="btn danger" ${act("cancelSitting", a.id)}>Confirm cancellation</button><button class="btn" ${act("confirm", "")}>Keep session</button></div></div>`;
      else if (ui.resOpen === a.id) {
        const opts = D.suggestDates(S, now + D.DAY, "consecutive", 6, a.mins).filter((t) => !D.sameDay(t, a.start));
        const pick = (draft.res || {})[a.id];
        actions = `<div class="card flat"><h3>Reschedule session</h3><p class="small muted" style="margin:4px 0 10px">Choose a new time. ${esc(first(a.clientId))} confirms the change before it moves.</p><div class="chips">${opts.map((t) => `<button class="chip" aria-pressed="${pick === t}" data-act="set" data-path="draft.res.${a.id}" data-v="${t}">${esc(D.fmtDate(t))}, ${D.fmtTime(t)}</button>`).join("")}</div><div class="btns" style="margin-top:12px"><button class="btn primary" ${act("rescheduleSend", a.id)} ${pick ? "" : "disabled"}>Send for client approval</button><button class="btn quiet" data-act="set" data-path="ui.resOpen" data-v="">Close</button></div></div>`;
      } else
        actions = `<div class="btns"><button class="btn" data-act="set" data-path="ui.resOpen" data-v="${a.id}" ${a.reschedule && a.reschedule.status === "pending" ? "disabled" : ""}>${icon("swap")}Reschedule</button>${owing > 0 && !openReq ? `<button class="btn" ${act("requestBalance", a.id)}>${icon("wallet")}Request ${money(owing)}</button>` : ""}<button class="btn" ${act("chatWith", a.clientId)}>${icon("chat")}Message</button><button class="btn quiet danger" ${act("confirm", "cancel:" + a.id)}>Cancel session</button></div>${a.reschedule && a.reschedule.status === "pending" ? `<div class="note st">New time sent: ${esc(D.fmtDate(a.reschedule.to))}, ${D.fmtTime(a.reschedule.to)}. Waiting for ${esc(first(a.clientId))}.</div>` : ""}`;
    } else if (a.status === "confirmed" && started) {
      if (confirm === "noshow:" + a.id) actions = `<div class="card flat"><h3>Record a no-show?</h3><p class="small muted" style="margin:6px 0 12px">Record that the client did not attend this session. The deposit stays with you.</p><div class="btns"><button class="btn danger" ${act("noShow", a.id)}>Confirm no-show</button><button class="btn" ${act("confirm", "")}>Go back</button></div></div>`;
      else actions = `<div class="btns">${a.arrived ? "" : `<button class="btn" ${act("arrived", a.id)}>${icon("check")}Client arrived</button>`}<button class="btn primary" ${act("finish", a.id)}>${owing > 0 ? "Finish & request " + money(owing) : "Finish session"}</button><button class="btn quiet danger" ${act("confirm", "noshow:" + a.id)}>Mark no-show</button></div><p class="small muted" style="margin:0">${owing > 0 ? "Finishing records the end time and sends the balance request." : "Mark the session complete and record its finish time."}</p>`;
    } else if (a.status === "completed") {
      actions = owing > 0 ? `<div class="btns"><button class="btn primary" ${act("requestBalance", a.id)} ${openReq ? "disabled" : ""}>${openReq ? "Balance requested" : "Request remaining balance"}</button></div>` : `<div class="note">Paid in full. Finished ${esc(D.fmtRel(a.finishedAt || a.start))}. The aftercare guide is in ${esc(first(a.clientId))}'s booking.</div>`;
    } else actions = `<div class="note">${a.status === "no-show" ? "Recorded as a no-show." : "This session was cancelled."}</div>`;
    const ss = D.projectSittings(S, a.projectId);
    const pr = D.progress(ss);
    const pm = D.projectMoney(ss);
    const forms = S.forms.filter((f) => f.apptId === a.id);
    const c = convoFor(S, "a1", a.clientId);
    return {
      title: person(a.clientId).name,
      motif: p.motif,
      seed: p.seed,
      sub: `${p.name}, ${D.sittingLabel(a).toLowerCase()}`,
      body: `
        <div class="card"><div class="split"><span style="font-weight:650">${esc(dayLong(a.start))}</span><span class="muted num">${timeRange(a)}</span></div><div class="pills" style="margin-top:10px">${a.status === "completed" ? pill("good", "Completed") : a.status === "no-show" ? pill("bad", "No-show") : a.status === "cancelled" ? pill("bad", "Cancelled") : ""}${a.status === "confirmed" || a.status === "proposed" ? readiness(S, a) : ""}${a.arrived ? pill("st", "Arrived " + D.fmtTime(a.arrived)) : ""}</div></div>
        ${actions}
        <div class="card"><h3>Payment, AUD</h3>${kv("Sitting price", money(a.price))}${kv("Received", money(a.paid))}${kv("Outstanding", money(Math.max(0, owing)), "total")}</div>
        <div class="card"><div class="split"><h3>Project progress</h3><span class="small muted">${pr.total ? `${pr.completed} of ${pr.total} done` : plural(pr.completed, "sitting") + " done"}</span></div>${pr.total ? `<div class="bar-track" style="margin:10px 0 4px"><i class="st" style="width:${(pr.completed / pr.total) * 100}%"></i></div>` : ""}${ss.map((s) => row({ act: s.id === a.id ? null : act("open", "booking:" + s.id), t: esc(D.sittingLabel(s)), s: `${esc(D.fmtDate(s.start))}, ${D.fmtTime(s.start)}`, end: s.status === "completed" ? pill("good", "Done") : s.status === "proposed" ? pill("wait", "Proposed") : s.status === "cancelled" ? pill("bad", "Cancelled") : s.status === "no-show" ? pill("bad", "No-show") : pill("", "Booked") })).join("")}${kv("Project total", money(pm.total))}${kv("Paid so far", money(pm.paid))}</div>
        <div class="card"><h3>Project design notes</h3><p class="muted" style="margin:6px 0 10px">${esc(p.brief || "Discuss the design in Messages.")}</p>${p.refs && p.refs.length ? `<div class="grid3">${p.refs.map((r) => `<div>${img(p.motif, r, 140, 140)}</div>`).join("")}</div>` : ""}</div>
        ${forms.length ? `<div class="card tight">${forms.map((f) => row({ t: esc(f.kind), s: f.status === "signed" ? "Signed " + esc(D.fmtDate(f.signedAt)) : "Waiting for the client", end: f.status === "signed" ? pill("good", "Signed") : pill("wait", "Pending") })).join("")}</div>` : ""}
        ${c ? `<div class="card"><h3>Private artist note</h3><p class="small faint" style="margin:2px 0 8px">Only you can see this.</p>${area("draft.note." + c.id, (draft.note || {})[c.id] != null ? draft.note[c.id] : c.note, 'placeholder="Useful details for the next session"')}<div class="btns" style="margin-top:8px"><button class="btn small" ${act("saveNote", c.id)}>Save note</button></div></div>` : ""}
      `,
    };
  };

  Sheets.lead = (id, S) => {
    const l = S.leads.find((x) => x.id === id);
    const p = person(l.clientId);
    return {
      title: p.name,
      motif: window.Art.STYLE_MOTIF[l.styles[0]] || "mandala",
      seed: l.id,
      sub: `Consultation request, ${D.fmtRel(l.created)}`,
      body: `
        <div class="card"><div class="quote">${esc(l.idea)}</div></div>
        <div class="card">${kv("Project", esc(l.project))}${kv("Styles", esc(l.styles.join(", ")))}${kv("Placement", esc(l.placement))}${kv("Size", esc(l.size))}${kv("Budget", esc(l.budget))}${kv("Timing", esc(l.timeframe))}</div>
        ${l.refs.length ? `<div class="card"><h3>Reference images</h3><div class="grid3" style="margin-top:10px">${l.refs.map((r) => `<div>${r.startsWith && r.startsWith("data:") ? `<img src="${r}" alt="">` : img(window.Art.STYLE_MOTIF[l.styles[0]] || "mandala", r, 140, 140)}</div>`).join("")}</div></div>` : ""}
        <div class="card">${kv("Placement photo", l.placementPhoto ? "Attached" : "Not sent")}${kv("Email", esc(p.email || ""))}${kv("Phone", esc(p.phone || ""))}</div>
      `,
      foot: l.status === "new" ? `<div class="btns"><button class="btn primary" ${act("open", "composer:lead=" + l.id)}>Book in</button><button class="btn" ${act("chatWith", l.clientId)}>Message</button></div><button class="btn quiet" ${act("leadArchive", l.id)}>Archive request</button>` : `<div class="note">${l.status === "proposal" ? "Proposal sent." : "Archived."}</div>`,
    };
  };

  Sheets.client = (id, S, ui, draft) => {
    const p = person(id);
    const appts = S.appts.filter((a) => a.artistId === "a1" && a.clientId === id).sort((a, b) => b.start - a.start);
    const projects = [...new Set(appts.map((a) => a.projectId))];
    const forms = S.forms.filter((f) => f.clientId === id && f.artistId === "a1");
    const c = convoFor(S, "a1", id);
    const paid = window.V.lifetimePaid(S, id);
    return {
      title: p.name,
      motif: "whorl",
      seed: id,
      short: true,
      sub: `${p.city || ""}${p.status === "imported" ? ", imported record" : ""}`,
      body: `
        <div class="card"><div class="cols"><div><div class="mid-num">${money(paid, { whole: true })}</div><div class="small muted">Paid to you</div></div><div><div class="mid-num">${appts.filter((a) => a.status === "completed").length}</div><div class="small muted">Sittings done</div></div></div></div>
        <div class="btns"><button class="btn primary" ${act("chatWith", id)}>${icon("chat")}Message</button><button class="btn" ${act("open", "composer:client=" + id)}>${icon("cal")}New booking</button></div>
        <div class="card"><h3>Client information</h3>${kv("Email", `<span style="user-select:all">${esc(p.email || "Not given")}</span>`)}${kv("Phone", `<span style="user-select:all">${esc(p.phone || "Not given")}</span>`)}${p.birthday ? kv("Birthday", esc(new Date(p.birthday).toLocaleDateString("en-AU", { day: "numeric", month: "long" }))) : ""}<div class="btns" style="margin-top:8px">${p.phone ? `<button class="btn small" ${act("copy", p.phone)}>${icon("phone")}Copy number</button>` : ""}${p.email ? `<button class="btn small" ${act("copy", p.email)}>${icon("mail")}Copy email</button>` : ""}</div></div>
        ${sec("Session history", appts.length)}
        <div class="card tight">${appts.length ? appts.map((a) => row({ act: act("open", "booking:" + a.id), t: esc(a.consult ? "Consultation" : project(a.projectId).name), s: `${esc(D.fmtDate(a.start))}, ${esc(D.sittingLabel(a).toLowerCase())}`, end: a.status === "completed" ? pill("good", "Done") : a.status === "proposed" ? pill("wait", "Proposed") : a.status === "no-show" ? pill("bad", "No-show") : a.status === "cancelled" ? pill("bad", "Cancelled") : pill("", "Booked") })).join("") : empty("No sessions yet. Start a booking from the conversation.")}</div>
        ${sec("Consent & medical forms", forms.length)}
        <div class="card tight">${forms.length ? forms.map((f) => row({ t: esc(f.kind), s: esc(D.fmtDate((S.appts.find((a) => a.id === f.apptId) || {}).start || Date.now())), end: f.status === "signed" ? pill("good", "Signed") : pill("wait", "Pending") })).join("") : empty("Forms will appear when sessions are booked.")}</div>
        ${c ? `<div class="card"><h3>Private artist note</h3>${area("draft.note." + c.id, (draft.note || {})[c.id] != null ? draft.note[c.id] : c.note, 'placeholder="Useful details for the next session"')}<div class="btns" style="margin-top:8px"><button class="btn small" ${act("saveNote", c.id)}>Save note</button></div></div>` : ""}
        ${projects.length ? `<div class="grid3">${projects.map((pid) => `<div>${img(project(pid).motif, project(pid).seed, 160, 160, null, project(pid).name)}</div>`).join("")}</div>` : ""}
      `,
    };
  };

  Sheets.addClient = (arg, S, ui, draft) => {
    const d = draft.addClient || {};
    return {
      title: "Add client",
      plain: true,
      sub: "Add their details now. You can send a booking proposal when you're ready.",
      body: `${field("Full name", text("draft.addClient.name", d.name, 'autocomplete="off"'))}${field("Email (optional)", text("draft.addClient.email", d.email, 'type="email"'))}${field("Phone (optional)", text("draft.addClient.phone", d.phone, 'type="tel"'))}`,
      foot: `<button class="btn primary block" ${act("addClientSave", "")}>Add client</button>`,
    };
  };

  Sheets.task = (key, S) => {
    const t = S.tasks.find((x) => x.key === key);
    if (!t) return { title: "Done", plain: true, body: empty("This task has been handled.") };
    let primary = "";
    if (t.kind === "request" && t.leadId) primary = `<button class="btn primary" ${act("open", "lead:" + t.leadId)}>Open request</button>`;
    else if (t.kind === "deposit") primary = `<button class="btn primary" ${act("sendTemplate", t.clientId + "|t1")}>Send deposit reminder</button>`;
    else if (t.kind === "form") primary = `<button class="btn primary" ${act("chatWith", t.clientId)}>Remind about the form</button>`;
    else if (t.kind === "balance") primary = `<button class="btn primary" ${act("requestBalance", t.apptId)}>Request balance</button>`;
    else if (t.kind === "reply") primary = `<button class="btn primary" ${act("chat", t.convoId)}>Reply</button>`;
    else if (t.kind === "waitlist") primary = `<button class="btn primary" ${act("open", "waitlist:")}>Offer a time</button>`;
    else if (t.kind === "setup") primary = `<button class="btn primary" ${act("open", "bank:")}>Connect payouts</button>`;
    else primary = `<button class="btn primary" ${act("chatWith", t.clientId)}>Message ${esc(first(t.clientId))}</button>`;
    return {
      title: t.title,
      plain: true,
      sub: t.context,
      body: `${t.clientId ? `<div class="card tight">${row({ act: act("open", "client:" + t.clientId), lead: av(t.clientId), t: esc(person(t.clientId).name), s: esc(person(t.clientId).phone || person(t.clientId).email || "") })}</div>` : ""}`,
      foot: `${primary}<div class="btns"><button class="btn" ${act("taskDone", key)}>${icon("check")}Mark done</button><button class="btn" ${act("taskSnooze", key)}>${icon("clock")}Tomorrow</button></div>`,
    };
  };

  Sheets.txn = (id, S, ui, draft) => {
    const t = S.txns.find((x) => x.id === id);
    const f = D.fees(t.base, t.tier || "free");
    const canRefund = t.status === "paid" && t.kind !== "Gift voucher";
    const confirming = draft.confirm === "refund:" + id;
    return {
      title: money(t.base),
      plain: true,
      sub: `${t.kind} from ${person(t.clientId).name}, ${D.fmtDate(t.at, { year: "numeric" })}`,
      body: `<div class="card">${kv("Clients paid you", money(t.base))}${kv(`Your Tattoi fee (${Math.round(D.TIERS[t.tier || "free"].artistFee * 100)}%)`, money(-f.artist))}${kv("You earned", money(f.payout), "total")}${kv("Card processing, paid by the client", money(f.platform), "tertiary")}${kv("Client paid in total", money(f.clientTotal), "tertiary")}</div>
        ${t.status === "refunded" ? `<div class="note">Refunded to the original card ${esc(D.fmtRel(t.refundedAt))}.</div>` : ""}
        ${!canRefund && t.kind === "Gift voucher" ? `<div class="note">${esc(D.OFFER_TERMS)}</div>` : ""}
        ${confirming ? `<div class="card flat"><h3>Refund ${money(t.base)} to ${esc(first(t.clientId))}?</h3><p class="small muted" style="margin:6px 0 12px">It goes back to the original card. The Tattoi fee on this payment is reversed with it.</p><div class="btns"><button class="btn danger" ${act("refund", id)}>Confirm refund</button><button class="btn" ${act("confirm", "")}>Cancel</button></div></div>` : ""}`,
      foot: canRefund && !confirming ? `<button class="btn" ${act("confirm", "refund:" + id)}>Refund this payment</button>` : "",
    };
  };

  // Booking composer: client → service → dates → review
  Sheets.composer = (arg, S, ui, draft) => {
    const d = draft.comp;
    const N = 4;
    const nav = (canNext, nextLabel, nextAct) => `<div class="btns">${d.step > 0 ? `<button class="btn" ${act("compStep", -1)}>Back</button>` : ""}<button class="btn primary" ${nextAct || act("compStep", 1)} ${canNext ? "" : "disabled"}>${nextLabel || "Continue"}</button></div>`;
    let body = "", foot = "";
    if (d.step === 0) {
      const q = (d.q || "").toLowerCase();
      const list = Object.values(S.people).filter((p) => p.role === "client" && (!q || p.name.toLowerCase().includes(q)));
      body = `${window.V.searchBox("draft.comp.q", d.q, "Search your clients")}<div class="card tight">${list.map((p) => `<button type="button" class="row" data-act="set" data-path="draft.comp.clientId" data-v="${p.id}" aria-pressed="${d.clientId === p.id}">${av(p.id)}<span class="grow"><span class="t">${esc(p.name)}</span><span class="s">${esc(p.city || "")}</span></span>${d.clientId === p.id ? `<span style="color:var(--stencil)">${icon("checkc")}</span>` : ""}</button>`).join("")}</div>`;
      foot = nav(!!d.clientId);
    } else if (d.step === 1) {
      body = `${field("Project name", text("draft.comp.name", d.name, 'placeholder="Use the design or subject"'))}
        <div class="field"><span>Saved services</span><div class="chips">${S.services.map((s) => `<button class="chip" aria-pressed="${d.serviceId === s.id}" ${act("compService", s.id)}>${esc(s.name)}</button>`).join("")}</div></div>
        <div class="card">
          <div class="split" style="align-items:center"><span>Sittings</span>${stepper(d.sittings, act("compNum", "sittings|-1"), act("compNum", "sittings|1"), "sittings")}</div>
          <div class="hr" style="margin:10px 0"></div>
          <div class="split" style="align-items:center"><span>Time per sitting</span>${stepper(D.duration(d.mins), act("compNum", "mins|-30"), act("compNum", "mins|30"), "time per sitting")}</div>
          <div class="hr" style="margin:10px 0"></div>
          ${field("Price per sitting, AUD", `<input class="input" inputmode="decimal" data-type="cents" ${bind("draft.comp.price", (d.price / 100).toFixed(0))}>`)}
        </div>`;
      foot = nav(d.name && d.name.trim().length > 1 && d.price > 0);
    } else if (d.step === 2) {
      const from = d.from || iso(Date.now() + D.DAY);
      const feasible = d.sittings > 1 ? D.feasibleFrequencies(S, new Date(from + "T00:00").getTime(), d.sittings, d.mins) : [];
      body = `${field("Starting from", `<input class="input" type="date" ${bind("draft.comp.from", from)} min="${iso(Date.now())}" data-live="1">`)}
        ${d.sittings > 1 ? `<div class="field"><span>How often</span><div class="chips">${D.FREQUENCIES.filter(([f]) => feasible.includes(f)).map(([f, label]) => `<button class="chip" aria-pressed="${d.freq === f}" data-act="set" data-path="draft.comp.freq" data-v="${f}">${esc(label)}</button>`).join("")}</div>${feasible.length < D.FREQUENCIES.length ? `<span class="small faint">${D.FREQUENCIES.filter(([f]) => !feasible.includes(f)).map(([, l]) => l).join(", ")} can't fit all ${d.sittings} sittings from this date.</span>` : ""}</div>` : ""}
        <button class="btn" ${act("compFind", "")}>${icon("search")}Find available dates</button>
        ${d.dates.length ? `<div class="card tight">${d.dates.map((t, i) => `<div class="row"><span class="time">${d.sittings > 1 ? "#" + (i + 1) : ""}</span><span class="grow"><span class="t">${esc(dayLong(t))}</span><span class="s">${D.fmtTime(t)}, ${D.duration(d.mins)}</span></span><button class="icon-btn" ${act("compRemove", i)} aria-label="Remove this date">${icon("x")}</button></div>`).join("")}</div>` : ""}
        ${d.searched && d.dates.length < d.sittings ? `<div class="note wait">Not enough available dates were found. Try a different starting date.</div>` : ""}
        <p class="small faint">Suggestions skip non-working days, breaks, travel and existing bookings.</p>`;
      foot = nav(d.dates.length === d.sittings);
    } else {
      const sp = D.split(d.price, d.sittings, S);
      const credits = S.issued.filter((i) => i.clientId === d.clientId && i.status === "active");
      body = `<div class="card"><div style="display:flex;gap:10px;align-items:center">${av(d.clientId)}<div class="stack-s"><span style="font-weight:650">${esc(person(d.clientId).name)}</span><span class="small muted">${esc(d.name)}</span></div></div><div class="hr" style="margin:12px 0 6px"></div>${d.dates.map((t, i) => kv(d.sittings > 1 ? `Sitting ${i + 1}` : "Sitting", `${esc(D.fmtDate(t))}, ${D.fmtTime(t)}`)).join("")}</div>
        <div class="card">${kv(`${d.sittings} × ${money(d.price)}`, money(sp.total))}${kv(`Deposit, ${sp.pct}% of every sitting`, money(sp.deposit), "total")}${kv("Balance per sitting, due on the day", money(sp.balancePerSitting))}<p class="small faint" style="margin:8px 0 0">${S.settings.tier === "free" ? "Free plan deposits are fixed at 25%." : "Deposit set in your plan settings."} Clients also pay card processing of 3.4% (minimum $5).</p></div>
        ${credits.length ? `<div class="field"><span>Apply an offer</span><div class="chips"><button class="chip" aria-pressed="${!d.issuedId}" data-act="set" data-path="draft.comp.issuedId" data-v="">None</button>${credits.map((i) => { const o = S.offers.find((x) => x.id === i.offerId); return `<button class="chip" aria-pressed="${d.issuedId === i.id}" data-act="set" data-path="draft.comp.issuedId" data-v="${i.id}">${esc(o.name)}</button>`; }).join("")}</div><span class="small faint">Eligible dates apply. The client sees it at checkout.</span></div>` : ""}
        <div class="note">Rescheduling needs ${S.settings.rescheduleHours} hours' notice. Dates are held once the deposit is paid.</div>`;
      foot = nav(true, "Send proposal", act("compSend", ""));
    }
    return { title: ["Who are you booking?", "What are we planning?", "Let's find your dates", "Review and send"][d.step], plain: true, sub: steps(N, d.step), body: `<div class="step-anim ${d.dir < 0 ? "back" : ""} stack" style="gap:12px">${body}</div>`, foot };
  };
  Sheets.composer.init = (arg) => App().compInit(arg);

  Sheets.proposal = (pid, S) => {
    const ss = D.projectSittings(S, pid).filter((s) => s.status !== "cancelled");
    const p = project(pid);
    if (!ss.length) return { title: p.name, body: empty("This proposal is no longer available.") };
    const deposit = ss.reduce((s, a) => s + a.deposit, 0);
    return {
      title: p.name,
      motif: p.motif,
      seed: p.seed,
      sub: `Booking proposal from ${person(ss[0].artistId).name}`,
      body: `<div class="note st">Review the dates, terms and deposit to secure your booking.</div>${proposalCard(S, pid, "preview")}<div class="card"><h3>Before you pay</h3><p class="small muted" style="margin:6px 0 0">Your deposit secures every date in this plan and comes off each sitting's price. The rest of each sitting is paid on the day. Rescheduling needs ${S.settings.rescheduleHours} hours' notice.</p></div>`,
      foot: ss.some((s) => s.status === "proposed") ? `<button class="btn primary block" ${act("open", "checkout:deposit|" + pid)}>Review ${money(deposit)} deposit</button><button class="btn quiet" ${act("declineProposal", pid)}>Decline plan</button>` : `<div class="note">This plan is confirmed.</div>`,
    };
  };

  // Checkout: deposits, balances, payment requests, gift vouchers, plans
  Sheets.checkout = (arg, S, ui, draft) => {
    const pay = draft.pay && draft.pay.key === arg ? draft.pay : { status: "idle" };
    // Once paid, show the amounts that were confirmed rather than re-quoting a settled request.
    const q = pay.q || App().quote(arg);
    if (!q) return { title: "Payment", plain: true, body: empty("This request changed or checkout is unavailable. Please refresh the details.") };
    if (pay.status === "processing") return { title: "Confirming your payment", plain: true, sub: "Your payment was submitted. Please don't pay again while we check its status.", body: `<div class="card" style="display:grid;place-items:center;padding:40px"><div class="spinner" style="width:42px;height:42px;border-radius:50%;border:3px solid var(--line-strong);border-top-color:var(--stencil);animation:spin 0.9s linear infinite"></div></div><style>@keyframes spin{to{transform:rotate(360deg)}}</style>` };
    if (pay.status === "done") return { title: "Payment confirmed", plain: true, sub: q.doneText, body: `<div class="card">${kv(q.label, money(q.charge))}${q.fee ? kv("Card processing", money(q.fee)) : ""}${kv("Paid", money(q.charge + q.fee), "total")}</div>`, foot: `<button class="btn primary block" ${act("closeTop", "")}>Done</button>` };
    const credits = q.creditable ? S.issued.filter((i) => i.clientId === "c1" && i.status === "active") : [];
    return {
      title: q.title,
      plain: true,
      sub: q.sub,
      body: `<div class="card">${q.lines.map(([l, v]) => kv(l, v)).join("")}${q.credit ? kv(q.creditLabel, money(-q.credit)) : ""}${kv(q.label, money(q.charge), "total")}${q.fee ? kv("Card processing, 3.4% (min $5)", money(q.fee)) : ""}${kv("You pay today", money(q.charge + q.fee), "total")}</div>
        ${credits.length ? `<div class="field"><span>Voucher or discount</span><div class="chips"><button class="chip" aria-pressed="${!draft.credit}" data-act="set" data-path="draft.credit" data-v="">None</button>${credits.map((i) => { const o = S.offers.find((x) => x.id === i.offerId); return `<button class="chip" aria-pressed="${draft.credit === i.id}" data-act="set" data-path="draft.credit" data-v="${i.id}">${esc(o.name)}${i.remaining != null ? ", " + money(i.remaining, { whole: true }) : ""}</button>`; }).join("")}</div>${q.creditNote ? `<span class="small" style="color:var(--wait)">${esc(q.creditNote)}</span>` : ""}</div>` : ""}
        <div class="card tight">${row({ lead: `<span class="icon-btn" style="background:var(--surface-2)">${icon("card")}</span>`, t: "Card ending 4242", s: "Sample card for this prototype. No money moves." })}</div>`,
      foot: `<button class="btn primary block" ${act("pay", arg)}>${q.charge + q.fee > 0 ? "Pay " + money(q.charge + q.fee) : "Confirm with voucher / discount"}</button><p class="small faint" style="margin:0;text-align:center">${icon("lock")} Pay securely. The booking updates once payment is confirmed.</p>`,
    };
  };

  Sheets.sign = (apptId, S, ui, draft) => {
    const a = S.appts.find((x) => x.id === apptId);
    const forms = S.forms.filter((f) => f.apptId === apptId);
    const d = (draft.sign || {})[apptId] || { answers: {} };
    const Q = [["blood", "Are you taking blood thinners or other medication?"], ["skin", "Any skin conditions, moles or scars in the area?"], ["preg", "Are you pregnant or breastfeeding?"], ["food", "Will you have eaten in the four hours before?"]];
    const yn = (k, label) => `<div class="field"><span>${esc(label)}</span>${seg(`draft.sign.${apptId}.answers.${k}`, d.answers[k], [["no", "No"], ["yes", "Yes"]])}</div>`;
    const ready = Q.every(([k]) => d.answers[k]) && d.answers.photo && d.drawn;
    const allSigned = forms.every((f) => f.status === "signed");
    return {
      title: "Sitting forms",
      plain: true,
      sub: `${project(a.projectId).name}, ${D.fmtDate(a.start)}. Review the documents for your appointment.`,
      body: allSigned ? `<div class="note">All forms for this sitting are signed. Thank you.</div>` : `
        <div class="card"><h3>Procedure consent</h3><p class="small muted" style="margin:8px 0 0">I understand that tattooing is permanent and involves needles and pigment entering the skin. I've told ${esc(person(a.artistId).name)} about anything that may affect the procedure or healing. I'll follow the aftercare guide I'm given. I'm over 18 and not under the influence of alcohol or drugs.</p></div>
        <div class="card stack"><h3>Medical history</h3>${Q.map(([k, l]) => yn(k, l)).join("")}</div>
        <div class="card stack"><h3>Photos of your tattoo</h3>${yn("photo", "May your artist share photos of the finished piece?")}<span class="small faint">Your choice here doesn't affect your booking.</span></div>
        <div class="card stack"><div class="split"><h3>Signature</h3><button class="link" ${act("sigClear", apptId)}>Clear</button></div><canvas class="sigpad" data-sig="${apptId}" aria-label="Signature pad. Draw your signature."></canvas><span class="small faint">Signing this form doesn't replace your saved signature.</span></div>`,
      foot: allSigned ? `<button class="btn block" ${act("closeTop", "")}>Close</button>` : `<button class="btn primary block" ${act("signForms", apptId)} ${ready ? "" : "disabled"}>Sign and submit</button>`,
      mount: (el) => App().mountSig(el, apptId),
    };
  };

  Sheets.project = (pid, S, ui) => {
    const p = project(pid);
    const ss = D.projectSittings(S, pid);
    const tab = ui.projTab || "overview";
    const artistId = ss[0] ? ss[0].artistId : "a1";
    const pr = D.progress(ss);
    const pm = D.projectMoney(ss);
    const next = D.nextSitting(ss);
    const w = S.waitlist.find((x) => x.clientId === "c1" && x.projectId === pid && ["waiting", "offered"].includes(x.status));
    const care = D.aftercareFor(S, "c1");
    let body = seg("ui.projTab", tab, [["overview", "Overview"], ["files", "Files"], ["payments", "Payments"]]);
    if (tab === "overview") {
      body += next ? `<div class="card"><div class="split"><h3>${esc(D.sittingLabel(next))}</h3>${next.status === "proposed" ? pill("wait", "Awaiting deposit") : pill("good", "Confirmed")}</div><div style="margin-top:8px">${icon("cal")} ${esc(dayLong(next.start))}, ${D.fmtTime(next.start)}</div><div class="small muted" style="margin-top:4px">${icon("pin")} ${esc(artistId === "a1" ? S.artist.studio + ", " + S.artist.address : person(artistId).city)}</div><div class="small faint" style="margin-top:4px">Times in Australia/Brisbane</div></div>` : "";
      if (next && next.status === "confirmed") {
        const forms = S.forms.filter((f) => f.apptId === next.id);
        body += `<div class="card"><h3>Ready for the session</h3>${row({ t: next.paid >= next.price ? "Paid in full" : `${money(next.paid)} payment received`, s: next.paid < next.price ? `${money(next.price - next.paid)} due on the day` : "", end: next.paid < next.price ? `<button class="btn small" ${act("open", "checkout:balance|" + next.id)}>Pay early</button>` : pill("good", "Done") })}${forms.map((f) => row({ t: esc(f.kind), end: f.status === "signed" ? pill("good", "Signed") : `<button class="btn small" ${act("open", "sign:" + next.id)}>Review & sign</button>` })).join("")}</div>`;
      }
      if (next && next.status === "proposed") body += `<button class="btn primary block" ${act("open", "proposal:" + pid)}>Review your booking proposal</button>`;
      body += `<div class="card"><div class="split"><h3>Project progress</h3><span class="small muted">${pr.total ? `${pr.completed} of ${pr.total} sittings` : plural(pr.completed, "sitting") + " done"}</span></div>${pr.total ? `<div class="bar-track" style="margin:10px 0 2px"><i class="st" style="width:${(pr.completed / pr.total) * 100}%"></i></div>` : ""}${ss.map((s) => row({ t: esc(D.sittingLabel(s)), s: `${esc(D.fmtDate(s.start))}, ${D.fmtTime(s.start)}`, end: s.status === "completed" ? pill("good", "Done") : s.status === "proposed" ? pill("wait", "Proposed") : s.status === "cancelled" ? pill("bad", "Cancelled") : pill("", "Booked") })).join("")}</div>`;
      if (care && care.appt.projectId === pid) body += `<div class="card"><div class="split"><h3>Your aftercare</h3><span class="small faint">Day ${care.day}</span></div><p style="margin:6px 0 0"><b>${esc(care.phase.label)}.</b> ${esc(care.phase.text)}</p></div>`;
      if (next && next.status === "confirmed" && artistId === "a1") body += w ? `<div class="card"><h3>${w.status === "offered" ? "An earlier time is waiting for you" : "You're on the waitlist"}</h3><p class="small muted" style="margin:6px 0 12px">${w.status === "offered" ? `${esc(D.fmtRel(w.offer.start))}, offer ends ${esc(D.fmtRel(w.offer.expires))}.` : "If a space opens before your sitting, you'll get an offer here and in Messages. Your existing booking stays in place."}</p><div class="btns">${w.status === "offered" ? `<button class="btn small primary" ${act("waitAccept", w.id)}>Accept offer</button>` : ""}<button class="btn small" ${act("waitLeave", w.id)}>Leave waitlist</button></div></div>` : `<div class="card"><h3>Want to come in sooner?</h3><p class="small muted" style="margin:6px 0 12px">Join your artist's cancellation waitlist. Your existing booking stays in place until you accept an earlier time.</p><button class="btn small" ${act("waitJoin", pid)}>Join waitlist</button></div>`;
    } else if (tab === "files") {
      const c = convoFor(S, artistId, "c1");
      const photos = c ? c.msgs.filter((m) => m.type === "image") : [];
      body += `<div class="card"><h3>Project reference images</h3><p class="small muted" style="margin:4px 0 10px">These references are linked to this tattoo project.</p>${p.refs && p.refs.length ? `<div class="grid3">${p.refs.map((r) => `<div>${img(p.motif, r, 140, 140)}</div>`).join("")}</div>` : empty("No references yet.")}</div><div class="card"><h3>Photos shared in this conversation</h3>${photos.length ? `<div class="grid3" style="margin-top:10px">${photos.map((m) => `<div>${m.src ? `<img src="${m.src}" alt="">` : img(m.motif || "botanical", m.seed || m.id, 140, 140)}</div>`).join("")}</div>` : `<p class="small muted">Share photos in Messages.</p>`}</div>`;
    } else {
      const tx = S.txns.filter((t) => t.clientId === "c1" && t.artistId === artistId);
      body += `<div class="card">${kv("Project estimate", money(pm.total))}${kv("Paid so far", money(pm.paid))}${kv("Still to pay", money(pm.outstanding), "total")}</div><div class="card tight">${tx.length ? tx.map((t) => row({ t: esc(t.kind), s: esc(D.fmtDate(t.at)), end: money(t.base) })).join("") : empty("No linked transactions recorded.")}</div>`;
    }
    return { title: p.name, motif: p.motif, seed: p.seed, sub: `${person(artistId).name}${p.placement ? ", " + p.placement.toLowerCase() : ""}`, body, foot: `<div class="btns"><button class="btn" ${act("chatWith", artistId)}>${icon("chat")}Message</button></div>` };
  };

  Sheets.artist = (id, S, ui) => {
    const a = person(id);
    const motifs = a.styles.map((s) => window.Art.STYLE_MOTIF[s] || "mandala");
    const fav = S.favourites.includes(id);
    const isClient = S.role === "client";
    const sale = id === "a1" && S.offers.find((o) => o.kind === "voucher" && o.funding === "sale" && !o.archived);
    return {
      title: a.name,
      motif: motifs[0],
      seed: id + "-hero",
      sub: `@${a.handle}, ${a.city}`,
      body: `
        <p style="margin:0">${esc(id === "a1" ? S.artist.bio : a.bio)}</p>
        <div class="pills">${a.styles.map((s) => pill("", s)).join("")}${pill("st", a.next)}</div>
        ${isClient ? `<div class="btns"><button class="btn" aria-pressed="${fav}" ${act("fav", id)}>${icon("heart")}${fav ? "In your artists" : "Add to your artists"}</button>${sale ? `<button class="btn" ${act("open", "giftBuy:" + id)}>${icon("gift")}Buy gift voucher</button>` : ""}</div>` : `<div class="note st">This is how clients see your public profile.</div>`}
        ${(() => {
          // Fill complete rows: an odd count leads with one wide piece, the rest sit two or three across.
          const n = Math.min(9, window.Art.photoCount(id) || 9);
          const lead = n % 2 === 1 && n % 3 !== 0;
          const cols = (n - (lead ? 1 : 0)) % 3 === 0 ? 3 : 2;
          return `<div class="grid3" style="grid-template-columns:repeat(${cols},1fr)">${Array.from({ length: n }, (_, i) => `<button type="button" ${lead && i === 0 ? 'style="grid-column:1/-1;aspect-ratio:2/1"' : ""} ${act("open", `piece:${motifs[i % motifs.length]}|${id}-${i}|${id}`)} aria-label="Portfolio piece ${i + 1}">${img(motifs[i % motifs.length], id + "-" + i, 160, 160)}</button>`).join("")}</div>`;
        })()}
        ${id === "a1" ? `<div class="card">${kv("Deposit", `${D.depositPercent(S)}% of each sitting`)}${kv("Rescheduling", `${S.settings.rescheduleHours} hours' notice`)}${kv("Studio", esc(S.artist.studio))}</div>` : ""}`,
      foot: id === "a1" && !S.artist.link.enabled ? `<div class="note">Booking requests are paused right now.</div>` : `<button class="btn primary block" ${act("open", "intake:" + id)}>Request a booking</button>`,
    };
  };

  Sheets.piece = (arg, S) => {
    const [motif, seed, artistId] = arg.split("|");
    const saved = S.saved.some((s) => s.seed === seed);
    const cr = window.Art.credit(seed);
    return {
      title: person(artistId).name,
      motif,
      seed,
      sub: (S.role === "client" ? "Save it for later or use it as a reference." : "Portfolio piece.") + (cr ? ` Photo by <a href="${esc(cr.page)}" target="_blank" rel="noopener" style="color:#fff">${esc(cr.by)}</a> on Unsplash.` : ""),
      body: `<div class="thumb" style="border-radius:20px">${img(motif, seed, 360, 450)}</div>`,
      foot: S.role === "client" ? `<div class="btns"><button class="btn" ${act("savePiece", arg)}>${icon("heart")}${saved ? "Saved" : "Save piece"}</button><button class="btn primary" ${act("useRef", arg)}>Use as reference</button></div>` : "",
    };
  };

  // Six-step client intake: idea, placement, references, photo, contact, review
  Sheets.intake = (artistId, S, ui, draft) => {
    const d = draft.intake;
    const N = 6;
    const chips = (path, options, current, multi) => `<div class="chips">${options.map((o) => `<button class="chip" aria-pressed="${multi ? (current || []).includes(o) : current === o}" ${multi ? act("toggleIn", path + "|" + o) : `data-act="set" data-path="${path}" data-v="${esc(o)}"`}>${esc(o)}</button>`).join("")}</div>`;
    let body = "", ok = true;
    if (d.done) {
      return { title: "Request sent", motif: "flash", seed: "sent", sub: `${person(artistId).name} has your idea.`, body: `<div class="card"><p style="margin:0">Your request has been received. Proposed dates will appear in My tattoos and in Messages when ${esc(first(artistId))} replies.</p></div><div class="card">${kv("Project", esc(d.type))}${kv("Placement", esc(d.placement))}${kv("Budget", esc(d.budget))}${kv("Timing", esc(d.timeframe))}</div>`, foot: `<button class="btn primary block" ${act("closeTop", "")}>Done</button>` };
    }
    if (d.step === 0) {
      body = `<div class="field"><span>What are you looking for?</span>${chips("draft.intake.type", D.PROJECT_TYPES, d.type)}</div><div class="field"><span>Styles you love</span>${chips("draft.intake.styles", D.STYLES, d.styles, true)}</div>${field("Your idea", area("draft.intake.idea", d.idea, 'placeholder="The subject, the feeling, anything that matters to you"'))}`;
      ok = d.type && d.styles.length && (d.idea || "").trim().length > 5;
    } else if (d.step === 1) {
      body = `<div class="field"><span>Placement</span>${chips("draft.intake.placement", D.PLACEMENTS, d.placement)}</div><div class="field"><span>Size</span>${chips("draft.intake.size", D.SIZES.map((s) => s[0]), d.size)}<span class="small faint">${esc((D.SIZES.find((s) => s[0] === d.size) || ["", ""])[1])}</span></div><div class="field"><span>When would you like to get tattooed?</span>${chips("draft.intake.timeframe", D.TIMEFRAMES, d.timeframe)}</div><div class="field"><span>Your budget</span>${chips("draft.intake.budget", D.BUDGETS, d.budget)}</div>`;
      ok = d.placement && d.size && d.timeframe && d.budget;
    } else if (d.step === 2) {
      body = `<p class="muted" style="margin:0">Add up to six images. Screenshots and photos of other tattoos are fine.</p><div class="grid3">${d.refs.map((r, i) => `<div style="position:relative">${r.src ? `<img src="${r.src}" alt="Reference ${i + 1}">` : img(r.motif, r.seed, 140, 140)}<button class="icon-btn glass" style="position:absolute;top:4px;right:4px;width:32px;height:32px" ${act("refRemove", i)} aria-label="Remove image">${icon("x")}</button></div>`).join("")}${d.refs.length < 6 ? `<label style="aspect-ratio:1;display:grid;place-items:center;border:1px dashed var(--line-strong);border-radius:8px;cursor:pointer;gap:4px;text-align:center" class="small muted">${icon("upload")}Add image<input type="file" accept="image/*" multiple data-upload="intake:refs" hidden></label>` : ""}</div>${S.saved.length ? `<div class="field"><span>From your saved pieces</span><div class="chips">${S.saved.map((s) => `<button class="chip" ${act("refAddSaved", s.motif + "|" + s.seed)}>${esc(person(s.artistId).name.split(" ")[0])}'s piece</button>`).join("")}</div></div>` : ""}`;
      ok = true;
    } else if (d.step === 3) {
      body = `<p class="muted" style="margin:0">A clear photo of the area helps ${esc(first(artistId))} plan the size and flow.</p>${d.photo ? `<div style="position:relative"><img src="${d.photo}" alt="Placement photo" style="width:100%;border-radius:16px"><button class="btn small" style="margin-top:8px" data-act="set" data-path="draft.intake.photo" data-v="">Remove photo</button></div>` : `<label class="card" style="display:grid;place-items:center;gap:8px;padding:36px;cursor:pointer;text-align:center">${icon("camera")}<span style="font-weight:650">Add a placement photo</span><span class="small muted">From your camera roll</span><input type="file" accept="image/*" data-upload="intake:photo" hidden></label>`}`;
      ok = true;
    } else if (d.step === 4) {
      body = `${field("Name", text("draft.intake.name", d.name, 'autocomplete="name"'))}${field("Email", text("draft.intake.email", d.email, 'type="email" autocomplete="email"'))}${field("Phone", text("draft.intake.phone", d.phone, 'type="tel" autocomplete="tel"'))}`;
      ok = (d.name || "").trim() && /.+@.+\..+/.test(d.email || "");
    } else {
      body = `<div class="card">${kv("Project", esc(d.type))}${kv("Styles", esc(d.styles.join(", ")))}${kv("Placement", esc(d.placement + ", " + d.size.toLowerCase()))}${kv("Timing", esc(d.timeframe))}${kv("Budget", esc(d.budget))}${kv("References", String(d.refs.length))}${kv("Placement photo", d.photo ? "Added" : "Not added")}</div><div class="quote">${esc(d.idea)}</div><div class="card">${kv("Name", esc(d.name))}${kv("Email", esc(d.email))}${kv("Phone", esc(d.phone || "Not given"))}</div>`;
    }
    const titles = ["Your idea and style", "Placement and timing", "Reference images", "Placement photo", "Your contact details", "Review your request"];
    return {
      title: titles[d.step],
      plain: true,
      sub: `${steps(N, d.step)}<span style="display:block;margin-top:8px">Booking request for ${esc(person(artistId).name)}</span>`,
      body: `<div class="step-anim ${d.dir < 0 ? "back" : ""} stack" style="gap:14px">${body}</div>`,
      foot: `<div class="btns">${d.step > 0 ? `<button class="btn" ${act("intakeStep", -1)}>Back</button>` : ""}${d.step === 3 && !d.photo ? `<button class="btn" ${act("intakeStep", 1)}>Skip for now</button>` : ""}<button class="btn primary" ${d.step === N - 1 ? act("intakeSend", "") : act("intakeStep", 1)} ${ok ? "" : "disabled"}>${d.step === N - 1 ? "Send request" : "Continue"}</button></div>`,
    };
  };
  Sheets.intake.init = (artistId) => App().intakeInit(artistId);

  // Offers
  Sheets.offerWizard = (mode, S, ui, draft) => {
    const d = draft.offer;
    const N = 4;
    let body = "", ok = true;
    if (d.step === 0) {
      const card = (k, t, s) => `<button type="button" class="card" style="text-align:left;${d.kind === k ? "border-color:var(--ink);box-shadow:inset 0 0 0 1px var(--ink)" : ""}" data-act="set" data-path="draft.offer.kind" data-v="${k}"><span style="font-weight:650;display:block">${t}</span><span class="small muted">${s}</span></button>`;
      body = card("discount", "Discount", "A fixed amount or percentage off a booking. Limit it to a few hours to fill calendar space.") + card("voucher", "Gift voucher", "A fixed value clients can spend on deposits and balances. Give it away or sell it.");
    } else if (d.step === 1) {
      body = `${field("Name", text("draft.offer.name", d.name, 'placeholder="Spring flash day"'))}${field("Description (optional)", area("draft.offer.description", d.description))}
        ${d.kind === "discount" ? `<div class="field"><span>Discount type</span>${seg("draft.offer.valueType", d.valueType, [["percentage", "Percentage"], ["fixed", "Fixed amount"]])}</div>` : `<div class="field"><span>How it's funded</span>${seg("draft.offer.funding", d.funding, [["gift", "Complimentary"], ["sale", "Sell to clients"]])}<span class="small faint">${d.funding === "gift" ? "This issues complimentary credit without collecting a payment." : "Clients buy it for themselves or someone else."}</span></div>`}
        ${field(d.kind === "discount" && d.valueType === "percentage" ? "Percentage off" : "Value, AUD", `<input class="input" inputmode="decimal" ${bind("draft.offer.value", d.value)}>`)}`;
      const v = Number(d.value);
      ok = (d.name || "").trim().length >= 2 && v > 0 && (d.kind === "voucher" || d.valueType === "fixed" || v <= 100);
      if (d.kind === "discount" && d.valueType === "percentage" && v > 100) body += `<div class="note wait">Percentages cannot exceed 100.</div>`;
    } else if (d.step === 2) {
      const months = Array.from({ length: 6 }, (_, i) => {
        const t = new Date();
        t.setDate(1);
        t.setMonth(t.getMonth() + i);
        return [`${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}`, t.toLocaleDateString("en-AU", { month: "short" })];
      });
      body = `<div class="field"><span>Who can use it</span>${seg("draft.offer.eligibility", d.eligibility, [["new", "New bookings only"], ["unpaid", "New & existing unpaid balances"]])}</div>
        <div class="field"><span>Expiry</span>${seg("draft.offer.expiry", d.expiry, [["none", "No expiry"], ["date", "On a date"]])}${d.expiry === "date" ? `<input class="input" type="date" ${bind("draft.offer.expiresOn", d.expiresOn)} min="${iso(Date.now())}">` : ""}</div>
        ${d.kind === "discount" ? `<div class="field"><span>Limited availability</span>${seg("draft.offer.hours", String(d.hours || ""), [["", "Always"], ["24", "24 h"], ["48", "48 h"], ["72", "72 h"]])}<span class="small faint">A short window makes it a calendar offer for open dates.</span></div>` : `<div class="field"><span>Valid for</span>${seg("draft.offer.years", String(d.years), [["3", "3 years"], ["5", "5 years"], ["10", "10 years"]])}</div>`}
        <div class="field"><span>Sittings in these months (optional)</span><div class="chips">${months.map(([k, l]) => `<button class="chip" aria-pressed="${d.months.includes(k)}" ${act("toggleIn", "draft.offer.months|" + k)}>${esc(l)}</button>`).join("")}</div></div>`;
    } else {
      const o = App().offerFromDraft();
      body = `${voucherCard(S, o)}<div class="field"><span>Colour</span><div class="chips">${[["ink", "Ink"], ["stencil", "Stencil"], ["rose", "Rose"]].map(([k, l]) => `<button class="chip" aria-pressed="${d.colour === k}" data-act="set" data-path="draft.offer.colour" data-v="${k}">${l}</button>`).join("")}</div></div><div class="card">${kv("Who can use it", d.eligibility === "new" ? "New bookings only" : "New & existing unpaid balances")}${kv("Expiry", d.expiry === "date" && d.expiresOn ? esc(D.fmtDate(new Date(d.expiresOn + "T23:59").getTime(), { year: "numeric" })) : "No expiry")}${d.kind === "discount" && d.hours ? kv("Available for", d.hours + " hours") : ""}${d.months.length ? kv("Sitting months", esc(d.months.join(", "))) : ""}</div><p class="small faint" style="margin:0">${esc(D.OFFER_TERMS)}</p>`;
    }
    return {
      title: ["Choose type", "Set value", "Set rules", "Preview & create"][d.step],
      plain: true,
      sub: steps(N, d.step),
      body: `<div class="step-anim ${d.dir < 0 ? "back" : ""} stack" style="gap:12px">${body}</div>`,
      foot: `<div class="btns">${d.step > 0 ? `<button class="btn" ${act("offerStep", -1)}>Back</button>` : ""}<button class="btn primary" ${d.step === N - 1 ? act("offerSave", "") : act("offerStep", 1)} ${ok ? "" : "disabled"}>${d.step === N - 1 ? "Save promotion" : "Continue"}</button></div>`,
    };
  };
  Sheets.offerWizard.init = (mode) => App().offerInit(mode);

  Sheets.offer = (id, S, ui, draft) => {
    const o = S.offers.find((x) => x.id === id);
    const sel = ((draft.send || {})[id]) || {};
    const issued = S.issued.filter((i) => i.offerId === id);
    const clientsAll = Object.values(S.people).filter((p) => p.role === "client");
    const month = new Date().getMonth() + 1;
    const n = Object.values(sel).filter(Boolean).length;
    return {
      title: o.name,
      plain: true,
      sub: o.archived ? "Archived. Issued offers remain valid." : "",
      body: `${voucherCard(S, o)}
        <div class="card">${kv("Type", o.kind === "voucher" ? (o.funding === "sale" ? "Gift voucher, sold to clients" : "Complimentary credit") : o.availableHours ? `Calendar offer, ${o.availableHours} hours` : "Discount")}${kv("Who can use it", o.eligibility === "new" ? "New bookings only" : "New & existing unpaid balances")}${kv("Expiry", o.expiresAt ? esc(D.fmtDate(o.expiresAt, { year: "numeric" })) : "No expiry")}</div>
        ${o.archived ? "" : `${sec("Send to clients", n ? `${n} selected` : null)}
        <div class="chips"><button class="chip" ${act("audience", id + "|birthday")}>Birthday this month</button><button class="chip" ${act("audience", id + "|inactive")}>Not seen in 60 days</button><button class="chip" ${act("audience", id + "|spend")}>Spent $1,000+</button><button class="chip" ${act("audience", id + "|clear")}>Clear</button></div>
        <div class="card tight">${clientsAll.map((p) => `<button type="button" class="row" ${act("audienceOne", id + "|" + p.id)} aria-pressed="${!!sel[p.id]}">${av(p.id, "sm")}<span class="grow"><span class="t">${esc(p.name)}</span><span class="s">${p.birthday && Number(p.birthday.slice(5, 7)) === month ? "Birthday this month" : esc(p.city || "")}</span></span><span style="color:${sel[p.id] ? "var(--stencil)" : "var(--line-strong)"}">${icon(sel[p.id] ? "checkc" : "plus")}</span></button>`).join("")}</div>`}
        ${sec("Delivery activity", issued.length)}
        <div class="card tight">${issued.length ? issued.map((i) => row({ lead: av(i.clientId, "sm"), t: esc(person(i.clientId).name), s: `${esc(i.code)}, ${esc(D.fmtDate(i.at))}`, end: pill(i.status === "active" ? "good" : "", i.status === "active" ? "Active" : i.status === "used" ? "Used" : "Transferred") })).join("") : empty("Not sent to anyone yet.")}</div>
        ${o.archived ? "" : draft.confirm === "archive:" + id ? `<div class="card flat"><h3>Archive this promotion?</h3><p class="small muted" style="margin:6px 0 12px">Issued offers will remain valid.</p><div class="btns"><button class="btn danger" ${act("offerArchive", id)}>Archive</button><button class="btn" ${act("confirm", "")}>Keep it</button></div></div>` : `<button class="btn quiet" ${act("confirm", "archive:" + id)}>Archive promotion</button>`}`,
      foot: o.archived ? "" : `<button class="btn primary block" ${act("offerSend", id)} ${n ? "" : "disabled"}>${n ? `Add offers to ${plural(n, "client")}` : "Choose clients to send to"}</button>`,
    };
  };

  Sheets.offerPick = (clientId, S) => ({
    title: `Send ${first(clientId)} an offer`,
    plain: true,
    sub: "It arrives in your conversation and their profile.",
    body: S.offers.filter((o) => !o.archived).map((o) => `<button type="button" style="text-align:left" ${act("offerSendOne", o.id + "|" + clientId)}>${voucherCard(S, o)}</button>`).join("") + `<button class="btn" ${act("open", "offerWizard:")}>${icon("plus")}Create a new offer</button>`,
  });

  Sheets.issued = (id, S, ui, draft) => {
    const i = S.issued.find((x) => x.id === id);
    const o = S.offers.find((x) => x.id === i.offerId);
    const t = (draft.transfer || {});
    return {
      title: o.name,
      plain: true,
      sub: `From ${person("a1").name}`,
      body: `${voucherCard(S, Object.assign({}, o, i.remaining != null ? { value: i.remaining } : {}), "Code " + esc(i.code))}<div class="card">${kv("Code", `<span style="user-select:all">${esc(i.code)}</span>`)}${i.remaining != null ? kv("Remaining", money(i.remaining)) : ""}${kv("Use it on", o.eligibility === "new" ? "New bookings" : "Deposits and unpaid balances")}</div><p class="small faint" style="margin:0">${esc(D.OFFER_TERMS)}</p>
        ${i.from === "purchase" && i.status === "active" ? `<div class="card stack"><h3>Transfer your gift</h3>${field("Their name", text("draft.transfer.name", t.name))}${field("Their email", text("draft.transfer.email", t.email, 'type="email"'))}<button class="btn" ${act("giftTransfer", id)}>Transfer</button></div>` : ""}`,
      foot: `<button class="btn block" ${act("copy", i.code)}>${icon("copy")}Copy code</button>`,
    };
  };

  Sheets.giftBuy = (artistId, S, ui, draft) => {
    const g = draft.gift || {};
    return {
      title: "Buy gift voucher",
      motif: "flash",
      seed: "gift",
      sub: `Spend it with ${person(artistId).name} on deposits and balances.`,
      body: `<div class="field"><span>Amount</span><div class="chips">${[10000, 20000, 30000, 50000].map((v) => `<button class="chip" aria-pressed="${g.amount === v}" data-act="set" data-path="draft.gift.amount" data-v="${v}" data-num="1">${money(v, { whole: true })}</button>`).join("")}</div></div>${field("Who is it for? (optional)", text("draft.gift.to", g.to, 'placeholder="Leave blank to keep it yourself"'))}${field("Message (optional)", area("draft.gift.message", g.message))}<p class="small faint" style="margin:0">${esc(D.OFFER_TERMS)}</p>`,
      foot: `<button class="btn primary block" ${act("open", "checkout:gift|" + artistId)} ${g.amount ? "" : "disabled"}>Continue to secure checkout</button>`,
    };
  };

  Sheets.purchases = (arg, S) => ({ title: "Your purchases", plain: true, body: `<div class="card tight">${S.purchases.length ? S.purchases.map((p) => row({ t: esc(p.name), s: `${esc(D.fmtDate(p.at))}, ${esc(p.status)}`, end: money(p.amount) })).join("") : empty("Gift vouchers and shop orders appear here.")}</div>` });

  Sheets.formsList = (arg, S) => {
    const forms = S.forms.filter((f) => f.clientId === "c1");
    return { title: "Forms & documents", plain: true, sub: "Consent forms from your artists.", body: `<div class="card tight">${forms.map((f) => { const a = S.appts.find((x) => x.id === f.apptId); return row({ act: f.status === "pending" ? act("open", "sign:" + f.apptId) : null, t: esc(f.kind), s: `${esc(project(a.projectId).name)}, ${esc(D.fmtDate(a.start))}`, end: f.status === "signed" ? pill("good", "Signed") : pill("wait", "To sign") }); }).join("") || empty("Forms from your artist will appear here when they're ready.")}</div>` };
  };

  Sheets.personal = (arg, S) => {
    const p = S.people.c1;
    return { title: "Personal details", plain: true, sub: "Your contact and appointment information.", body: `${field("Name", text("S.people.c1.name", p.name))}${field("Email", text("S.people.c1.email", p.email, 'type="email"'))}${field("Phone", text("S.people.c1.phone", p.phone, 'type="tel"'))}${field("City", text("S.people.c1.city", p.city))}${field("Birthday", `<input class="input" type="date" ${bind("S.people.c1.birthday", p.birthday)}>`)}<p class="small faint">Changes save as you type.</p>` };
  };

  // Waitlist
  Sheets.waitlist = (arg, S, ui, draft) => {
    const list = S.waitlist.filter((w) => w.artistId === "a1" && ["waiting", "offered"].includes(w.status));
    let gap = null;
    for (let i = 1; i <= 21 && !gap; i++) gap = D.workable(S, D.at(i, 0), 240);
    return {
      title: "Cancellation waitlist",
      motif: "moons",
      seed: "waitlist",
      short: true,
      sub: "Offer a space to a client who's ready for it.",
      body: list.length ? list.map((w) => {
        const booked = S.appts.filter((a) => a.projectId === w.projectId && a.status === "confirmed" && a.start > Date.now()).sort((a, b) => a.start - b.start)[0];
        const f = (draft.wait || {})[w.id];
        let inner = "";
        if (w.status === "offered") inner = `<div class="note st">Offered ${esc(dayLong(w.offer.start))}, ${D.fmtTime(w.offer.start)}. Ends ${esc(D.fmtRel(w.offer.expires))}.</div><button class="btn small" ${act("waitWithdraw", w.id)}>Withdraw offer</button>`;
        else if (f) inner = `<div class="stack">${field("Offer date and time", `<span style="display:flex;gap:8px"><input class="input" type="date" ${bind(`draft.wait.${w.id}.date`, f.date)} min="${iso(Date.now())}"><input class="input" type="time" ${bind(`draft.wait.${w.id}.time`, f.time)}></span>`)}<div class="field"><span>Duration</span>${seg(`draft.wait.${w.id}.mins`, String(f.mins), [["120", "2 h"], ["240", "4 h"], ["360", "6 h"], ["480", "8 h"]])}</div><div class="field"><span>Offer valid for</span>${seg(`draft.wait.${w.id}.hours`, String(f.hours), [["24", "24 hours"], ["48", "48 hours"], ["72", "72 hours"]])}</div><div class="btns"><button class="btn primary" ${act("waitSend", w.id)}>Send offer</button><button class="btn quiet" ${act("waitForm", w.id + "|close")}>Cancel</button></div></div>`;
        else inner = `<button class="btn small primary" ${act("waitForm", w.id + "|" + (gap || ""))}>Offer an available time</button>`;
        return `<div class="card stack"><div style="display:flex;gap:10px;align-items:center">${av(w.clientId)}<div class="stack-s" style="flex:1"><span style="font-weight:650">${esc(person(w.clientId).name)}</span><span class="small muted">${esc(project(w.projectId).name)}${booked ? `, booked ${esc(D.fmtDate(booked.start))}` : ""}. Joined ${esc(D.fmtRel(w.joined))}.</span></div></div>${inner}</div>`;
      }).join("") : empty("No clients have joined yet. Clients can opt in from their booking workspace."),
    };
  };

  // Business settings
  Sheets.hours = (arg, S) => ({
    title: "Services & availability",
    plain: true,
    sub: "Pricing, working hours and breaks. Booking suggestions use these.",
    body: `${sec("Working hours")}<div class="card tight">${["mon", "tue", "wed", "thu", "fri", "sat", "sun"].map((k) => {
      const h = S.hours[k];
      return `<div class="row" style="flex-wrap:wrap"><span class="grow"><span class="t">${D.DAY_NAMES[k]}</span><span class="s">${h.on ? `${h.breaks.length ? "Break " + h.breaks.map((b) => b.start + "–" + b.end).join(", ") : "No breaks"}` : "Not working"}</span></span>${h.on ? `<input class="input" type="time" style="width:108px;min-height:40px;padding:6px 8px" ${bind(`S.hours.${k}.start`, h.start)} aria-label="${D.DAY_NAMES[k]} start"><input class="input" type="time" style="width:108px;min-height:40px;padding:6px 8px" ${bind(`S.hours.${k}.end`, h.end)} aria-label="${D.DAY_NAMES[k]} end">` : ""}${sw(h.on, `hours.${k}.on`, D.DAY_NAMES[k] + " working")}</div>`;
    }).join("")}</div>
    ${sec("Services", S.services.length)}
    ${S.services.map((s, i) => `<div class="card stack">${field("Name", text(`S.services.${i}.name`, s.name))}<div class="grid2">${field("Price per sitting, AUD", `<input class="input" inputmode="decimal" data-type="cents" ${bind(`S.services.${i}.price`, s.price / 100)}>`)}${field("Sittings", `<input class="input" inputmode="numeric" data-type="int" ${bind(`S.services.${i}.sittings`, s.sittings)}>`)}</div>${field("Minutes per sitting", `<input class="input" inputmode="numeric" data-type="int" ${bind(`S.services.${i}.mins`, s.mins)}>`)}<button class="btn small quiet danger" ${act("serviceRemove", s.id)}>Remove service</button></div>`).join("")}
    <button class="btn" ${act("serviceAdd", "")}>${icon("plus")}Add service</button>`,
  });

  Sheets.link = (arg, S) => {
    const L = S.artist.link;
    return {
      title: "Booking link & intake",
      plain: true,
      sub: "Client entry and intake settings.",
      body: `<div class="card tight">${toggleRow("Accept booking requests", "Turn off to pause new requests. Existing clients can still message you.", L.enabled, "artist.link.enabled")}</div>
        <div class="card"><div class="split" style="align-items:center"><span class="num" style="font-weight:650">tattoi.app/${esc(S.artist.handle)}</span><button class="btn small" ${act("copy", "https://tattoi.app/" + S.artist.handle)}>${icon("copy")}Copy</button></div></div>
        ${field("Welcome message", area("S.artist.link.welcome", L.welcome))}
        ${sec("Intake steps")}<div class="card tight">${toggleRow("Reference images", "Clients can add up to six.", L.steps.references, "artist.link.steps.references")}${toggleRow("Placement photo", "Ask for a photo of the area.", L.steps.placementPhoto, "artist.link.steps.placementPhoto")}</div>
        <div class="btns"><button class="btn" ${act("open", "artist:a1")}>Preview your page</button></div>`,
    };
  };

  Sheets.formsAdmin = (arg, S) => {
    const signed = S.forms.filter((f) => f.artistId === "a1" && f.status === "signed");
    return {
      title: "Forms & consent",
      plain: true,
      sub: "Keep your paperwork close to the booking.",
      body: `${field("Licence number", text("S.artist.licence", S.artist.licence))}
        ${field("Consent template wording", area("S.settings.consentText", S.settings.consentText || "I understand that tattooing is permanent and involves needles and pigment entering the skin…"))}
        ${sec("Procedure log", signed.length)}<div class="card tight">${signed.length ? signed.map((f) => row({ lead: av(f.clientId, "sm"), t: esc(person(f.clientId).name), s: `${esc(f.kind)}, signed ${esc(D.fmtDate(f.signedAt))}`, end: `<span class="small faint">${esc(S.artist.licence)}</span>` })).join("") : empty("Signed forms appear here.")}</div>`,
    };
  };

  Sheets.travel = (arg, S, ui, draft) => {
    const t = draft.travel || {};
    return {
      title: "Travel & guest spots",
      plain: true,
      sub: "Booking suggestions skip days you're away.",
      body: `<div class="card tight">${S.travel.length ? S.travel.map((x) => row({ lead: `<span class="icon-btn" style="background:var(--surface-2)">${icon("plane")}</span>`, t: esc(x.city), s: `${esc(x.place)}, ${esc(D.fmtDate(x.from))} to ${esc(D.fmtDate(x.to))}`, end: `<button class="icon-btn" ${act("travelRemove", x.id)} aria-label="Remove trip">${icon("trash")}</button>` })).join("") : empty("No trips planned.")}</div>
        <div class="card stack"><h3>Add a trip</h3>${field("City", text("draft.travel.city", t.city))}${field("Studio or venue", text("draft.travel.place", t.place))}<div class="grid2">${field("From", `<input class="input" type="date" ${bind("draft.travel.from", t.from)}>`)}${field("To", `<input class="input" type="date" ${bind("draft.travel.to", t.to)}>`)}</div><button class="btn" ${act("travelAdd", "")}>Add trip</button></div>`,
    };
  };

  Sheets.shop = (arg, S, ui, draft) => {
    const e = draft.event || {};
    return {
      title: "Shopfront",
      motif: "flash",
      seed: "shopfront",
      short: true,
      sub: "Your products and experiences.",
      body: `${sec("Products", S.shop.products.length)}<div class="card tight">${S.shop.products.map((p) => row({ lead: `<span class="thumb" style="width:44px;height:44px">${img(p.motif, p.id, 88, 88, p.variant)}</span>`, t: esc(p.name), s: `${money(p.price)}, ${p.stock} in stock` })).join("")}</div>
        ${sec("Events", S.shop.events.length)}<div class="card tight">${S.shop.events.map((x) => row({ t: esc(x.title), s: `${esc(x.format)}, ${esc(D.fmtDate(x.start))}, ${money(x.price, { whole: true })}`, end: `<span class="small num">${x.registered}/${x.seats}</span>` })).join("") || empty("Create your first workshop when you're ready to take registrations.")}</div>
        <div class="card stack"><h3>Create an event</h3>${field("Title", text("draft.event.title", e.title, 'placeholder="Workshop or seminar"'))}<div class="field"><span>Event format</span>${seg("draft.event.format", e.format || "In person", [["In person", "In person"], ["Online", "Online"]])}</div><div class="grid2">${field("Date", `<input class="input" type="date" ${bind("draft.event.date", e.date)} min="${iso(Date.now())}">`)}${field("Seats", `<input class="input" inputmode="numeric" ${bind("draft.event.seats", e.seats || 12)}>`)}</div>${field("Price, AUD", `<input class="input" inputmode="decimal" ${bind("draft.event.price", e.price || 150)}>`)}<button class="btn" ${act("eventAdd", "")}>Publish event</button></div>`,
    };
  };

  Sheets.studio = (arg, S, ui, draft) => {
    const tier = S.settings.tier;
    let body;
    if (tier !== "top") body = `<div class="card"><h3>Make room for your team</h3><p class="muted" style="margin:6px 0 12px">A shared schedule. An independent practice. Studio gives up to 10 active artists Pro benefits, a shared calendar and team invitations. Your clients stay yours.</p><button class="btn primary" ${act("open", "plans:")}>Choose Studio</button></div>`;
    else if (!S.studio) body = `<div class="card stack"><h3>Create studio</h3>${field("Studio name", text("draft.studioName", draft.studioName || S.artist.studio))}<button class="btn primary" ${act("studioCreate", "")}>Create studio</button></div>`;
    else body = `<div class="card tight">${row({ lead: av("a1"), t: esc(S.artist.name), s: "Owner" })}${S.studio.members.map((m) => row({ lead: `<span class="avatar" style="--h:${window.V.hue(m.email)}">${esc(initials(m.name || m.email))}</span>`, t: esc(m.name || m.email), s: m.status === "pending" ? "Invitation pending" : "Artist", end: m.status === "pending" ? pill("wait", "Pending") : "" })).join("")}</div><div class="card stack"><h3>Invite an artist</h3>${field("Their email", text("draft.invite", draft.invite, 'type="email"'))}<button class="btn" ${act("studioInvite", "")}>Send invitation</button></div>`;
    return { title: S.studio ? S.studio.name : "Studio", motif: "sacred", seed: "studio", short: true, sub: "Your people and shared workspace.", body };
  };

  Sheets.plans = (arg, S) => {
    const cur = S.settings.tier;
    const plan = (k, name, price, items) => `<div class="card stack" style="${cur === k ? "border-color:var(--ink);box-shadow:inset 0 0 0 1px var(--ink)" : ""}"><div class="split"><h3 style="font-size:18px">${name}</h3>${cur === k ? pill("st", "Your current plan") : ""}</div><div class="mid-num">${price}</div><div>${items.map((x) => `<div class="kv small" style="justify-content:flex-start;gap:8px"><span style="color:var(--good)">${icon("check")}</span><span style="text-align:left;color:var(--ink)">${esc(x)}</span></div>`).join("")}</div>${cur === k ? "" : `<button class="btn ${k === "pro" ? "primary" : ""}" ${act("open", "checkout:plan|" + k)}>${k === "free" ? "Switch to Free" : "Choose " + name}</button>`}</div>`;
    return {
      title: "Your plan",
      plain: true,
      sub: "Less admin. More time for your work.",
      body: `${plan("free", "Free", "$0", ["Calendar, bookings and client messaging", "Deposits and client records", "2% Tattoi fee on payments you receive", "Deposit fixed at 25% of each sitting"])}
        ${plan("pro", "Pro", "$99 a month", ["Everything in Free", "No Tattoi artist fee on new payments", "Choose your deposit percentage", "Offer payment in full"])}
        ${plan("top", "Studio", "$499 a month", ["Pro benefits for up to 10 active artists", "Shared studio schedule", "Team invitations and access controls", "Your clients stay yours"])}
        ${cur !== "free" ? `<div class="card stack"><h3>Deposits</h3><div class="field"><span>Deposit per sitting: ${S.settings.depositPct}%</span><input type="range" min="10" max="50" step="5" ${bind("S.settings.depositPct", S.settings.depositPct)} data-type="int" data-live="1" aria-label="Deposit percentage"></div>${toggleRow("Offer payment in full", "Clients can pay the whole project upfront.", S.settings.allowUpfront, "settings.allowUpfront")}</div>` : ""}
        <div class="card"><h3>Payment fees</h3><p class="small muted" style="margin:6px 0 0">Clients pay card processing of 3.4% (minimum $5) on each payment. On Free, Tattoi keeps 2% of what you're paid. Pro and Studio keep 0%.</p></div>`,
    };
  };

  Sheets.bank = (arg, S, ui, draft) => {
    const on = S.artist.setup.payouts;
    return {
      title: "Bank payouts",
      plain: true,
      sub: on ? "Your account can accept payments and send payouts." : "Complete your business verification with Stripe to accept payments.",
      body: on ? `<div class="card">${kv("Payout account", "Westpac ••• 4821")}${kv("Schedule", "Daily, two business days after payment")}${kv("Status", pill("good", "Your payments are ready"))}</div><button class="btn" ${act("goPage", "money")}>See payout history</button>` : draft.bankStep ? `<div class="card stack"><h3>Stripe verification</h3><p class="small muted" style="margin:0">In the app this opens Stripe's secure onboarding. This prototype simulates the result.</p><button class="btn primary" ${act("connectPayouts", "")}>Finish verification</button></div>` : `<div class="card"><p style="margin:0">Payments clients make are held until payouts are connected. Setup takes about five minutes and needs your ABN and bank details.</p></div>`,
      foot: on || draft.bankStep ? "" : `<button class="btn primary block" data-act="set" data-path="draft.bankStep" data-v="1">Connect Stripe</button>`,
    };
  };

  Sheets.importClients = (arg, S, ui, draft) => {
    const csv = draft.csv != null ? draft.csv : "name,email,phone\nGrace Liu,grace@example.test,0400 220 118\nSam Chen,sam@example.test,\nJordan Reid,jordan@example.test,0400 905 332";
    const rows = csv.trim().split(/\n/).slice(1).map((l) => l.split(",")).filter((r) => (r[0] || "").trim());
    return {
      title: "Import clients",
      plain: true,
      sub: "Bring your existing records. Paste CSV with name, email and phone columns.",
      body: `${area("draft.csv", csv, 'rows="6" data-live="1" aria-label="CSV"')}${sec("Preview", rows.length)}<div class="card tight">${rows.map((r) => row({ lead: `<span class="avatar sm" style="--h:${window.V.hue(r[0])}">${esc(initials(r[0]))}</span>`, t: esc(r[0]), s: esc([r[1], r[2]].filter(Boolean).join(", ") || "No contact details") })).join("") || empty("Nothing to import yet.")}</div>`,
      foot: `<button class="btn primary block" ${act("csvImport", "")} ${rows.length ? "" : "disabled"}>Import ${plural(rows.length, "client")}</button>`,
    };
  };

  Sheets.instagram = (arg, S, ui, draft) => {
    const ig = S.artist.instagram;
    const prog = draft.igProg;
    return {
      title: "Instagram import",
      motif: "geo",
      seed: "insta",
      short: true,
      sub: "Copy portfolio posts into your Tattoi profile.",
      body: prog != null ? `<div class="card stack"><h3>Importing your posts</h3><div class="bar-track"><i class="st" style="width:${prog}%"></i></div><span class="small muted">${prog < 100 ? "Copying images to your portfolio…" : "Done. New pieces are in your portfolio."}</span></div>` : `<div class="card">${kv("Connected", ig.connected ? "Yes" : "No")}${kv("Imported posts", String(ig.imported))}</div><p class="small muted">Imported images are copied, so they stay on your profile even if a post changes.</p>`,
      foot: prog != null && prog < 100 ? "" : `<button class="btn primary block" ${act("igImport", "")}>${ig.connected ? "Import new posts" : "Connect Instagram"}</button>`,
    };
  };

  Sheets.notifications = (arg, S) => {
    const a = S.settings.alerts;
    return {
      title: "Notifications",
      plain: true,
      sub: "Device alerts and saved message templates.",
      body: `<div class="card tight">${toggleRow("Messages", "New messages and photos", a.messages, "settings.alerts.messages")}${toggleRow("Bookings", "Requests, proposals and changes", a.bookings, "settings.alerts.bookings")}${toggleRow("Payments", "Deposits, balances and payouts", a.payments, "settings.alerts.payments")}${toggleRow("App updates", "When a new version is ready", a.updates, "settings.alerts.updates")}</div>
        ${S.role === "client" ? "" : `${sec("Saved message templates", S.settings.templates.length)}${S.settings.templates.map((t, i) => `<div class="card stack">${field("Name", text(`S.settings.templates.${i}.name`, t.name))}${field("Wording", area(`S.settings.templates.${i}.body`, t.body))}<button class="btn small quiet danger" ${act("templateRemove", t.id)}>Remove</button></div>`).join("")}<button class="btn" ${act("templateAdd", "")}>${icon("plus")}Add template</button><p class="small faint">Templates are reusable wording. {name} becomes the client's first name.</p>`}`,
    };
  };

  Sheets.templates = (cid, S) => {
    const c = S.convos.find((x) => x.id === cid);
    const other = c.a === App().me() ? c.b : c.a;
    return { title: "Templates", plain: true, sub: "Tap one to add it to your message.", body: `<div class="card tight">${S.settings.templates.map((t) => row({ act: act("useTemplate", cid + "|" + t.id), t: esc(t.name), s: esc(t.body.replace("{name}", first(other))), wrap: true, noChev: true })).join("")}</div>` };
  };

  Sheets.brief = (cid, S, ui, draft) => {
    const c = S.convos.find((x) => x.id === cid);
    const p = project(c.projectId);
    const i = S.projects.indexOf(p);
    const photos = c.msgs.filter((m) => m.type === "image");
    return { title: "Design brief", motif: p.motif, seed: p.seed, short: true, sub: p.name, body: `${field("Brief", area(`S.projects.${i}.brief`, p.brief))}${field("Placement", text(`S.projects.${i}.placement`, p.placement))}<div class="card"><h3>Shared in this conversation</h3>${photos.length ? `<div class="grid3" style="margin-top:10px">${photos.map((m) => `<div>${m.src ? `<img src="${m.src}" alt="">` : img(m.motif || "botanical", m.seed || m.id, 140, 140)}</div>`).join("")}</div>` : `<p class="small muted">No photos yet.</p>`}</div><p class="small faint">The brief saves as you type and appears on every sitting in this project.</p>` };
  };

  Sheets.notes = (cid, S, ui, draft) => {
    const c = S.convos.find((x) => x.id === cid);
    return { title: "Private note", plain: true, sub: `About ${person(c.b).name}. Only you can see this.`, body: area("draft.note." + cid, (draft.note || {})[cid] != null ? draft.note[cid] : c.note, 'rows="8" placeholder="Useful details for the next session"'), foot: `<button class="btn primary block" ${act("saveNote", cid)}>Save note</button>` };
  };

  Sheets.profileEdit = (arg, S) => {
    const A = S.artist;
    return {
      title: "Profile & portfolio",
      plain: true,
      sub: "Your work and public booking page. Changes save as you type.",
      body: `${field("Name", text("S.artist.name", A.name))}${field("Handle", text("S.artist.handle", A.handle))}${field("Studio", text("S.artist.studio", A.studio))}${field("Tattooing location", text("S.artist.address", A.address))}${field("Phone", text("S.artist.phone", A.phone, 'type="tel"'))}${field("Email", text("S.artist.email", A.email, 'type="email"'))}${field("Bio", area("S.artist.bio", A.bio))}<div class="field"><span>Styles</span><div class="chips">${D.STYLES.map((s) => `<button class="chip" aria-pressed="${A.styles.includes(s)}" ${act("toggleIn", "S.artist.styles|" + s)}>${esc(s)}</button>`).join("")}</div></div>`,
    };
  };

  Sheets.account = (arg, S, ui, draft) => {
    const roles = window.Views.roles;
    return {
      title: "Help & account",
      plain: true,
      sub: "This prototype keeps its sample data in your browser.",
      body: `${sec("View the app as")}<div class="card tight">${Object.entries(roles).map(([k, r]) => row({ act: act("role", k), lead: av(r.persona), t: esc(r.label), s: esc(person(r.persona).name), end: S.role === k ? pill("st", "Current") : "", noChev: S.role === k })).join("")}</div>
        <div class="card tight">${row({ act: act("open", "credits:"), lead: `<span class="icon-btn" style="background:var(--surface-2)">${icon("image")}</span>`, t: "Photo credits", s: "Sample tattoo photos from Unsplash" })}${row({ act: act("signOut", ""), lead: `<span class="icon-btn" style="background:var(--surface-2)">${icon("logout")}</span>`, t: "Sign out", s: "Back to the start screen" })}</div>
        ${draft.confirm === "reset" ? `<div class="card flat"><h3>Reset the sample data?</h3><p class="small muted" style="margin:6px 0 12px">Every booking, message and setting you changed goes back to the start.</p><div class="btns"><button class="btn danger" ${act("resetData", "")}>Reset</button><button class="btn" ${act("confirm", "")}>Keep my changes</button></div></div>` : `<button class="btn" ${act("confirm", "reset")}>Reset sample data</button>`}
        ${draft.confirm === "delete" ? `<div class="card flat"><h3>Delete account</h3><p class="small muted" style="margin:6px 0 12px">In the app this checks outstanding subscriptions with Stripe before removing access. The prototype has no account to delete.</p><button class="btn" ${act("confirm", "")}>Close</button></div>` : `<button class="btn quiet danger" ${act("confirm", "delete")}>Delete account</button>`}`,
    };
  };

  // Supplies (artist buying)
  Sheets.store = (id, S, ui) => {
    const s = S.suppliers.find((x) => x.id === id);
    const cat = ui.storeCat || "All";
    const inStock = ui.inStock;
    const q = (ui.storeQ || "").toLowerCase();
    const all = S.products.filter((p) => p.supplierId === id && p.published !== false);
    const cats = ["All", ...new Set(all.map((p) => p.category))];
    const list = all.filter((p) => (cat === "All" || p.category === cat) && (!inStock || p.variants.some((v) => v.stock > 0)) && (!q || p.name.toLowerCase().includes(q)));
    const asSupplier = S.role === "supplier";
    return {
      title: s.name,
      motif: s.motif,
      seed: s.id,
      short: true,
      sub: `${s.category}, ships from ${s.city}`,
      body: `${asSupplier ? `<div class="note st">This is what artists see.</div>` : `<div class="btns"><button class="btn small" ${act("linkSupplier", id)}>${s.linked ? "Remove from your suppliers" : "Add to your suppliers"}</button></div>`}
        ${window.V.searchBox("ui.storeQ", ui.storeQ, "Search products")}
        <div class="hscroll chips" style="flex-wrap:nowrap">${cats.map((c) => `<button class="chip" aria-pressed="${cat === c}" data-act="set" data-path="ui.storeCat" data-v="${esc(c)}">${esc(c)}</button>`).join("")}<button class="chip" aria-pressed="${!!inStock}" ${act("toggleUi", "inStock")}>In stock</button></div>
        <div class="grid2">${list.map((p) => {
          const prices = p.variants.map((v) => v.price);
          const any = p.variants.some((v) => v.stock > 0);
          return `<button type="button" class="card flat" style="padding:0;overflow:hidden;text-align:left" ${asSupplier ? "" : act("open", "item:" + p.id)}><div style="aspect-ratio:1">${img("product", p.id, 200, 200, p.variant, p.name)}</div><div style="padding:10px 12px;display:grid;gap:2px"><span style="font-weight:650">${esc(p.name)}</span><span class="small muted num">${money(Math.min(...prices))}${prices.length > 1 ? "+" : ""}</span>${any ? "" : `<span>${pill("bad", "Out of stock")}</span>`}</div></button>`;
        }).join("") || empty("Try adjusting your search or category filters.")}</div>`,
      foot: !asSupplier && S.cart.length ? `<button class="btn primary block" ${act("open", "cart:")}>Review cart (${S.cart.reduce((a, l) => a + l.qty, 0)})</button>` : "",
    };
  };

  Sheets.item = (pid, S, ui, draft) => {
    const p = S.products.find((x) => x.id === pid);
    const pick = draft.pick && draft.pick.pid === pid ? draft.pick : { pid, vid: (p.variants.find((v) => v.stock > 0) || p.variants[0]).id, qty: 1 };
    draft.pick = pick;
    const v = p.variants.find((x) => x.id === pick.vid);
    const inCart = S.cart.filter((l) => l.variantId === v.id).reduce((s, l) => s + l.qty, 0);
    const room = v.stock - inCart;
    return {
      title: p.name,
      plain: true,
      sub: "Choose a product and variant. Checkout confirms availability.",
      body: `<div class="thumb" style="border-radius:20px;aspect-ratio:1">${img("product", p.id, 360, 360, p.variant, p.name)}</div><div class="card tight">${p.variants.map((x) => `<button type="button" class="row" data-act="set" data-path="draft.pick.vid" data-v="${x.id}" ${x.stock ? "" : "disabled"} aria-pressed="${x.id === v.id}"><span class="grow"><span class="t">${esc(x.name)}</span><span class="s">${x.stock ? (x.stock < 8 ? `Only ${x.stock} left` : "In stock") : "Out of stock"}</span></span><span class="end num">${money(x.price)}</span><span style="color:${x.id === v.id ? "var(--stencil)" : "transparent"}">${icon("checkc")}</span></button>`).join("")}</div><div class="split" style="align-items:center"><span style="font-weight:600">Quantity</span>${stepper(pick.qty, act("pickQty", -1), act("pickQty", 1), "quantity")}</div>${room <= 0 ? `<div class="note wait">All available stock added.</div>` : ""}`,
      foot: `<button class="btn primary block" ${act("addToCart", "")} ${room > 0 && pick.qty <= room ? "" : "disabled"}>Add to cart, ${money(v.price * pick.qty)}</button>`,
    };
  };

  Sheets.cart = (arg, S, ui, draft) => {
    const pay = draft.pay && draft.pay.key === "supplies" ? draft.pay : { status: "idle" };
    if (pay.status === "processing") return { title: "Confirming your order", plain: true, sub: "Please don't pay again while we check its status.", body: `<div class="card" style="display:grid;place-items:center;padding:40px"><div style="width:42px;height:42px;border-radius:50%;border:3px solid var(--line-strong);border-top-color:var(--stencil);animation:spin 0.9s linear infinite"></div></div><style>@keyframes spin{to{transform:rotate(360deg)}}</style>` };
    if (pay.status === "done") return { title: "Payment confirmed", plain: true, sub: "Sent to supplier. You'll see it move from paid to delivered in Your orders.", body: "", foot: `<button class="btn primary block" ${act("closeTop", "")}>Done</button>` };
    const bySup = {};
    S.cart.forEach((l, i) => (bySup[l.supplierId] = bySup[l.supplierId] || []).push(Object.assign({ i }, l)));
    const subtotal = S.cart.reduce((s, l) => s + l.price * l.qty, 0);
    const shipping = Object.keys(bySup).length * 1200;
    return {
      title: "Your cart",
      plain: true,
      sub: S.cart.length ? "Review checkout total." : "",
      body: S.cart.length ? Object.entries(bySup).map(([sid, lines]) => `<div class="card tight"><div style="padding:12px 0 4px;font-weight:650">${esc(S.suppliers.find((s) => s.id === sid).name)}</div>${lines.map((l) => `<div class="row"><span class="grow"><span class="t">${esc(l.name)}</span><span class="s">${esc(l.variantName)}, ${money(l.price)}</span></span>${stepper(l.qty, act("cartQty", l.i + "|-1"), act("cartQty", l.i + "|1"), "quantity")}</div>`).join("")}${kv("Shipping", money(1200))}</div>`).join("") + `<div class="card">${kv("Subtotal", money(subtotal))}${kv("Shipping", money(shipping))}${kv("Total", money(subtotal + shipping), "total")}</div>` : empty("Your cart is empty."),
      foot: S.cart.length ? `<button class="btn primary block" ${act("paySupplies", "")}>Pay ${money(subtotal + shipping)}</button><p class="small faint" style="margin:0;text-align:center">Sample card ending 4242. No money moves.</p>` : "",
    };
  };

  Sheets.supplyOrder = (id, S) => {
    const o = S.supplyOrders.find((x) => x.id === id);
    const st = ["paid", "fulfilled", "delivered"];
    const idx = st.indexOf(o.status);
    return {
      title: "Order " + o.number,
      plain: true,
      sub: `${S.suppliers.find((s) => s.id === o.supplierId).name}, ${D.fmtDate(o.at, { year: "numeric" })}`,
      body: `<div class="phases card">${["Paid", "Shipped", "Delivered"].map((l, i) => `<div class="phase ${i < idx ? "done" : i === idx ? "now" : "future"}"><i></i><div style="font-weight:600">${l}</div></div>`).join("")}</div><div class="card">${o.items.map((i) => kv(`${i.qty} × ${esc(i.name)}, ${esc(i.variantName)}`, money(i.price * i.qty))).join("")}${kv("Shipping", money(o.shipping))}${kv("Total", money(o.total), "total")}</div>`,
      foot: `<button class="btn block" ${act("chatWith", o.supplierId === "m1" ? "m1" : "m1")}>${icon("chat")}Message supplier</button>`,
    };
  };

  // Supplier
  Sheets.order = (id, S) => {
    const o = S.supplyOrders.find((x) => x.id === id);
    return {
      title: "#" + o.number,
      plain: true,
      sub: `${o.buyerName}, ${D.fmtDate(o.at, { year: "numeric" })}`,
      body: `<div class="pills">${o.status === "paid" ? pill("wait", "Paid, ready to fulfil") : o.status === "fulfilled" ? pill("st", "Shipped") : pill("good", "Delivered")}</div><div class="card">${o.items.map((i) => kv(`${i.qty} × ${esc(i.name)}, ${esc(i.variantName)}`, money(i.price * i.qty))).join("")}${kv("Shipping", money(o.shipping))}${kv("Total", money(o.total), "total")}</div><div class="card"><h3>Deliver to</h3><p class="muted" style="margin:6px 0 0">${esc(o.buyerId === "a1" ? S.artist.studio + ", " + S.artist.address : o.buyerName + ", address on file")}</p></div>`,
      foot: `${o.status === "paid" ? `<button class="btn primary block" ${act("fulfil", id)}>Mark fulfilled</button>` : o.status === "fulfilled" ? `<button class="btn primary block" ${act("deliver", id)}>Mark delivered</button>` : ""}<button class="btn block" ${act("chatWith", o.buyerId)}>${icon("chat")}Message ${esc(o.buyerName.split(",")[0])}</button>`,
    };
  };

  Sheets.product = (id, S, ui, draft) => {
    if (id === "new") {
      const n = draft.newProduct || { name: "", category: "Ink", price: "", stock: "" };
      draft.newProduct = n;
      return { title: "Add product", plain: true, sub: "Set the details your customers need to order.", body: `${field("Product name", text("draft.newProduct.name", n.name))}${field("Category", text("draft.newProduct.category", n.category))}<div class="grid2">${field("Price, AUD", `<input class="input" inputmode="decimal" ${bind("draft.newProduct.price", n.price)}>`)}${field("Available quantity", `<input class="input" inputmode="numeric" ${bind("draft.newProduct.stock", n.stock)}>`)}</div>`, foot: `<button class="btn primary block" ${act("productAdd", "")}>Save product</button>` };
    }
    const i = S.products.findIndex((p) => p.id === id);
    const p = S.products[i];
    return {
      title: p.name,
      plain: true,
      sub: "Changes save as you type.",
      body: `<div class="thumb" style="border-radius:20px;aspect-ratio:16/10">${img("product", p.id, 360, 225, p.variant, p.name)}</div>${field("Product name", text(`S.products.${i}.name`, p.name))}${field("Category", text(`S.products.${i}.category`, p.category))}<div class="card tight">${toggleRow("Published", "Visible to artists in your store", p.published !== false, `products.${i}.published`)}</div>${sec("Variants", p.variants.length)}${p.variants.map((v, j) => `<div class="card stack">${field("Variant", text(`S.products.${i}.variants.${j}.name`, v.name))}${field("Price, AUD", `<input class="input" inputmode="decimal" data-type="cents" ${bind(`S.products.${i}.variants.${j}.price`, v.price / 100)}>`)}<div class="split" style="align-items:center"><span style="font-weight:600">Available quantity</span>${stepper(v.stock, act("stockAdj", `${i}|${j}|-1`), act("stockAdj", `${i}|${j}|1`), "stock")}</div></div>`).join("")}`,
    };
  };

  Sheets.shopify = (arg, S, ui, draft) => {
    const sh = S.store.shopify;
    const prog = draft.shopProg;
    return {
      title: "Shopify connection",
      motif: "ridges",
      seed: "shopify",
      short: true,
      sub: "Import and review your catalogue.",
      body: prog != null ? `<div class="card stack"><h3>${prog < 100 ? "Importing catalogue" : "Import complete"}</h3><div class="bar-track"><i class="st" style="width:${prog}%"></i></div><span class="small muted">${prog < 34 ? "Reading products…" : prog < 67 ? "Matching variants and stock…" : prog < 100 ? "Publishing to your Tattoi store…" : "New products are in your catalogue. Review prices before publishing more."}</span></div>` : sh.connected ? `<div class="card">${kv("Store", "inkandiron.myshopify.com")}${kv("Last synced", D.fmtAgo(sh.lastSync) + " ago")}</div>` : `${field("Shopify store domain", text("draft.shopDomain", draft.shopDomain || "inkandiron.myshopify.com"))}<p class="small faint">Credentials stay with Shopify. Stock levels sync both ways.</p>`,
      foot: prog != null && prog < 100 ? "" : sh.connected ? `<button class="btn primary block" ${act("shopifyImport", "")}>Force deep sync</button>` : `<button class="btn primary block" ${act("shopifyConnect", "")}>Connect & save</button>`,
    };
  };

  Sheets.storeSettings = (arg, S) => {
    const b = S.store.business;
    return { title: "Store settings", plain: true, sub: "Your business, payments and connections.", body: `${field("Business name", text("S.store.business.name", b.name))}${field("Contact name", text("S.store.business.contact", b.contact))}${field("Business address", text("S.store.business.address", b.address))}<div class="card"><h3>Payments & payouts</h3><div style="margin-top:8px">${pill("good", "Your payments are ready")}</div><p class="small muted" style="margin:8px 0 0">Your account can accept payments and send payouts.</p></div>` };
  };

  // One day's agenda, opened from the calendar's week rows.
  Sheets.day = (ts, S) => {
    const t = Number(ts);
    const now = Date.now();
    const items = S.appts.filter((a) => a.artistId === "a1" && a.status !== "cancelled" && D.sameDay(a.start, t)).sort((a, b) => a.start - b.start);
    const blocks = S.blocks.filter((x) => D.sameDay(x.start, t));
    const away = S.travel.find((x) => t >= D.startOfDay(x.from) && t <= D.startOfDay(x.to));
    const hrs = S.hours[D.DAY_KEYS[new Date(t).getDay()]];
    const entries = items.map((a) => ({ t: a.start, html: `<div class="tl-item"><span class="when">${D.fmtTime(a.start)}</span><button type="button" class="tl-block ${a.status === "proposed" ? "proposed" : ""} ${a.status === "completed" || a.status === "no-show" ? "done" : ""}" ${act("open", "booking:" + a.id)}><span class="split"><span style="font-weight:600">${esc(person(a.clientId).name)}</span><span class="small faint">${D.duration(a.mins)}</span></span><span class="small muted">${esc(a.consult ? "Consultation" : project(a.projectId).name + ", " + D.sittingLabel(a).toLowerCase())}</span><span class="pills">${a.status === "completed" ? pill("good", "Completed") : a.status === "no-show" ? pill("bad", "No-show") : readiness(S, a)}</span></button></div>` }));
    blocks.forEach((x) => entries.push({ t: x.start, html: `<div class="tl-item"><span class="when">${D.fmtTime(x.start)}</span><div class="tl-block block"><span style="font-weight:600">${esc(x.title)}</span><span class="small muted">External calendar, ${D.duration(x.mins)}</span></div></div>` }));
    const tl = entries.sort((a, b) => a.t - b.t).map((e) => e.html).join("");
    const canBook = hrs.on && !away && D.startOfDay(t) >= D.startOfDay(now);
    return {
      title: dayLong(t),
      plain: true,
      sub: away ? `Away: ${esc(away.city)}, ${esc(away.place)}.` : hrs.on ? `Open ${hrs.start} to ${hrs.end}${hrs.breaks.length ? `, break ${hrs.breaks.map((b) => b.start + "–" + b.end).join(", ")}` : ""}.` : "Not a working day.",
      body: tl ? `<div class="tl">${tl}</div>` : `<div class="card">${empty(canBook ? "Nothing booked yet." : "Nothing booked.")}</div>`,
      foot: canBook ? `<div class="btns"><button class="btn primary" ${act("open", "composer:date=" + D.startOfDay(t))}>Book this day</button><button class="btn" ${act("open", "waitlist:")}>Offer to waitlist</button></div>` : "",
    };
  };

  // Every page as a card, the way Weather lists your locations.
  Sheets.pages = (arg, S, ui) => {
    const r = window.Views.roles[S.role];
    return {
      title: "Pages",
      plain: true,
      sub: "Tap one to jump straight to it.",
      body: r.pages.map((p) => {
        const h = p.render(S, ui);
        return `<button type="button" class="card" style="${window.Art.skyVars(window.Views.skyOf(p))};background:linear-gradient(180deg,var(--top),var(--bottom));display:flex;justify-content:space-between;align-items:flex-start;gap:12px;text-align:left;min-height:104px" ${act("goPage", p.key)}><span class="stack-s"><span style="font-size:22px;font-weight:600">${esc(p.title)}</span><span class="small muted">${esc(h.sub || "")}</span></span><span style="text-align:right;flex-shrink:0"><span style="display:block;font-size:44px;font-weight:200;line-height:1;letter-spacing:-0.03em">${esc(h.big)}</span><span class="small muted">${esc(h.cond)}</span></span></button>`;
      }).join(""),
    };
  };

  // Who took the sample photos. All are free to use under the Unsplash License.
  Sheets.credits = () => ({
    title: "Photo credits",
    plain: true,
    sub: `The sample tattoo photos come from <a href="https://unsplash.com/license" target="_blank" rel="noopener" style="color:#fff">Unsplash</a> and are free to use. They stand in for each artist's real portfolio.`,
    body: `<div class="card tight">${Object.entries(window.Art.CREDITS).map(([k, [by, page]]) => `<a class="row" href="${esc(page)}" target="_blank" rel="noopener" style="color:inherit;text-decoration:none"><span class="thumb" style="width:44px;height:44px"><img src="img/${k}.jpg" alt=""></span><span class="grow"><span class="t">${esc(by)}</span><span class="s">Shown as ${esc(person(Object.entries({ rory: "a1", kenji: "a2", sofia: "a3", hana: "a4", theo: "a5", ines: "a6", callum: "a7" }).find(([p]) => k.startsWith(p + "-"))[1]).name)}'s work</span></span><span class="chev">${icon("chevR")}</span></a>`).join("")}</div>`,
  });

  // Pages reached from Business open as pushed screens with the same content.
  Sheets.page = (key, S, ui) => {
    const def = window.Views.roles[S.role].more.find((p) => p.key === key);
    const r = def.render(S, ui);
    const st = window.ViewStats[key] ? window.ViewStats[key](S) : null;
    return { title: def.title, plain: true, sub: esc(r.big + " " + r.cond) + (r.sub ? ". " + esc(r.sub) + "." : ""), body: (st ? `<div class="h-stats">${st.map(([a, b]) => `<div><b>${esc(a)}</b><span>${esc(b)}</span></div>`).join("")}</div>` : "") + r.body, foot: def.fab ? `<button class="btn primary block" ${act(def.fab.act, def.fab.arg)}>${esc(def.fab.label)}</button>` : "" };
  };

  window.Sheets = Sheets;
})();
