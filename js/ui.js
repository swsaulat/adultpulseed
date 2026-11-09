/* PulseED — user interface. Plain DOM + template strings; every user-entered value goes through esc(). */
(function (PE) {
  'use strict';
  const U = PE.util, D = PE.domain, S = PE.store;
  const esc = U.esc;
  const UI = (PE.ui = {});
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  // ------------------------------------------------------------------ icons (inline, offline-safe)
  const P = {
    grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
    heart: 'M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10zM3 12h4l2-3 3 6 2-3h7',
    bed: 'M3 18V7M3 14h18v4M21 14v-2a3 3 0 0 0-3-3h-7v5M7 11.5a1.5 1.5 0 1 0 0-.01',
    syringe: 'M18 2l4 4M17 3l4 4-11 11H6v-4zM14 6l4 4M6 18l-4 4M9 11l2 2',
    users: 'M16 20v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 20v-1a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8',
    chart: 'M3 3v18h18M7 15l4-4 3 3 6-6',
    clock: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2',
    sliders: 'M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6',
    plus: 'M12 5v14M5 12h14',
    bell: 'M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0',
    belloff: 'M13.7 21a2 2 0 0 1-3.4 0M18.6 13A17 17 0 0 1 18 8M6.3 6.3A6 6 0 0 0 6 8c0 7-3 9-3 9h14M18 8a6 6 0 0 0-9.3-5M1 1l22 22',
    eye: 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
    eyeoff: 'M17.9 17.9A10 10 0 0 1 12 20c-7 0-11-8-11-8a18 18 0 0 1 5-5.9M9.9 4.2A9 9 0 0 1 12 4c7 0 11 8 11 8a18 18 0 0 1-2.2 3.2M14.1 14.1a3 3 0 1 1-4.2-4.2M1 1l22 22',
    moon: 'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z',
    sun: 'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4',
    clip: 'M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2M9 2h6v4H9zM8 12h8M8 16h5',
    lock: 'M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4',
    alert: 'M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01',
    check: 'M20 6L9 17l-5-5',
    door: 'M13 4h3a2 2 0 0 1 2 2v14M2 20h3M13 20h9M10 12v.01M13 4.6v16.8L5 20V5.5a1 1 0 0 1 .8-1z',
    edit: 'M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z',
    search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.4-4.4',
    x: 'M18 6L6 18M6 6l12 12',
    chev: 'M6 9l6 6 6-6',
    download: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3',
    upload: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12',
    shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10zM9 12l2 2 4-4',
    undo: 'M3 7v6h6M21 17a9 9 0 0 0-15-6.7L3 13',
    logo: 'M3 12h4l3-8 4 16 3-8h4',
  };
  const ic = (n, cls = '') => `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true"><path d="${P[n] || ''}"/></svg>`;
  UI.ic = ic;

  // ------------------------------------------------------------------ small helpers
  const st = () => S.settings;
  const now = () => Date.now();
  const nm = p => (S.device.privacy ? U.initials(p.name) : esc(p.name));
  const ctasCls = c => ({ 'CTAS 1': 'c1', 'CTAS 2': 'c2', 'CTAS 3': 'c3', 'CTAS 4': 'c4', 'CTAS 5': 'c5' }[c] || 'c0');
  const ctasB = c => `<span class="ctas ${ctasCls(c)}">${esc(c === 'Other' ? 'CTAS ?' : c)}</span>`;
  const TIMING_ICON = { overdue: 'alert', dueSoon: 'clock', ok: 'check', continuous: 'heart', noTarget: 'alert' };
  const timingB = t => `<span class="tb t-${t.state}">${ic(TIMING_ICON[t.state] || 'clock')}${esc(t.label || '')}</span>`;
  /** Short form for narrow lists: "overdue 27m", "in 12m", "Continuous". */
  const timingS = t => `<span class="tb t-${t.state}">${ic(TIMING_ICON[t.state] || 'clock')}${esc(t.state === 'overdue' ? 'overdue ' + (t.overdueMin < 1 ? '<1m' : U.dur(t.overdueMin)) : t.minsToDue != null ? 'in ' + U.dur(t.minsToDue) : t.label || '')}</span>`;
  const waitB = w => `<span class="wait w-${w.level}">${w.level !== 'ok' ? ic('alert') : ''}${U.dur(w.mins)}</span>`;
  const pill = (txt, tone = '') => `<span class="pill ${tone}">${esc(txt)}</span>`;
  const urnLink = p => `<button class="urn" data-act="open" data-id="${esc(p.id)}" title="Open patient record">${esc(p.urn)}</button>`;
  const btn = (act, id, label, cls = '', icon = '') => `<button class="btn sm ${cls}" data-act="${act}" data-id="${esc(id)}">${icon ? ic(icon) : ''}<span>${label}</span></button>`;
  const exitPill = x => pill(D.exitText(x), x.type === 'bed' ? 'green' : x.type === 'error' ? 'grey' : /^(dama|absconded|lwbs)$/i.test(x.reason) ? 'amber' : 'sky');
  const procTone = s => ({ Waiting: 'amber', 'In Progress': 'blue', Done: 'green', Cancelled: 'grey', 'Closed at exit': 'grey' }[s] || 'amber');
  const empty = (msg, cols) => `<tr><td class="empty" colspan="${cols}">${esc(msg)}</td></tr>`;
  const searchBox = (key, ph) => `<label class="search">${ic('search')}<input type="search" data-filter="${key}" placeholder="${esc(ph)}" value="${esc(UI.vs[key] || '')}" aria-label="${esc(ph)}"></label>`;
  const selectF = (key, label, opts) => `<label class="fsel"><span class="sr">${esc(label)}</span><select data-filter="${key}" aria-label="${esc(label)}">${opts.map(o => `<option value="${esc(o[0])}"${(UI.vs[key] || '') === o[0] ? ' selected' : ''}>${esc(o[1])}</option>`).join('')}</select></label>`;
  const matches = (p, q) => !q || [p.urn, p.name, p.encounterId, p.diagnosis, p.physician, p.team].some(x => U.key(x).includes(U.key(q)));
  const active = () => D.activePatients(S.state);
  UI.lists = () => {
    const s = st(), t = now(), a = active();
    const vit = a.filter(p => p.workflows.vitals.active).sort(D.byVitalsUrgency(s, t));
    const bed = a.filter(p => p.workflows.bed.active).sort((x, y) => D.bedWait(y, s, t).mins - D.bedWait(x, s, t).mins);
    const proc = a.filter(p => p.workflows.procedure.active).sort((x, y) => D.procWait(y, s, t).mins - D.procWait(x, s, t).mins);
    const overdue = vit.filter(p => D.vitalsTiming(p, s, t).state === 'overdue');
    const dueSoon = vit.filter(p => D.vitalsTiming(p, s, t).state === 'dueSoon');
    const ctas1 = a.filter(p => p.ctas === 'CTAS 1');
    const noWf = a.filter(p => !D.activeWfs(p).length);
    const longBed = bed.filter(p => D.bedWait(p, s, t).level === 'red');
    return { a, vit, bed, proc, overdue, dueSoon, ctas1, noWf, longBed };
  };

  UI.vs = { };
  UI.view = 'dashboard';

  // ------------------------------------------------------------------ shell
  const NAV = [
    ['dashboard', 'Dashboard', 'grid'], ['vitals', 'Vital Signs', 'heart'], ['bed', 'Waiting for Bed', 'bed'], ['procedure', 'Procedure / Imaging', 'syringe'],
    ['patients', 'All Patients', 'users'], ['analytics', 'Reports', 'chart'], ['audit', 'Audit Trail', 'clock'], ['settings', 'Settings', 'sliders'],
  ];
  // The detailed view (analytics, audit trail, exports) is for Charge Nurses, ED Leaders and Admins.
  const LEADER_VIEWS = ['analytics', 'audit'];
  const canSee = view => !LEADER_VIEWS.includes(view) || D.isSupervisor(S.user);
  UI.canSee = canSee;

  UI.mount = () => {
    document.getElementById('app').innerHTML = `
      <div id="modeBar"></div>
      <header class="top">
        <div class="brand">
          <div class="logo">${ic('logo')}</div>
          <div><h1>PulseED <span class="sub">Reassessment Area</span></h1><p id="siteLine"></p></div>
        </div>
        <div class="tools">
          <span id="syncChip" class="chip"></span>
          <span id="clock" class="chip mono" aria-live="off"></span>
          <button class="ibtn" data-act="privacy" id="privBtn"></button>
          <button class="ibtn" data-act="sound" id="soundBtn"></button>
          <button class="ibtn" data-act="theme" id="themeBtn"></button>
          <button class="btn amber" data-act="handoff">${ic('clip')}<span>Shift Handover</span></button>
          <button class="chip user" data-act="lock" id="userChip" title="Lock station / switch user"></button>
          <button class="btn primary" data-act="new">${ic('plus')}<span>Add Patient</span></button>
        </div>
      </header>
      <div id="alertBar" role="alert"></div>
      <div class="body">
        <aside id="side"></aside>
        <main id="main" tabindex="-1"><div id="viewHead"></div><div id="viewBody"></div></main>
      </div>
      <div id="modalRoot"></div>
      <div id="toasts" aria-live="polite"></div>
      <div id="datalists"></div>`;
    document.addEventListener('click', onClick);
    document.addEventListener('input', onFilter);
    document.addEventListener('change', onFilter);
    document.addEventListener('keydown', e => { if (e.key === 'Escape') UI.closeTopModal(true); });
  };

  UI.applyTheme = () => { document.documentElement.dataset.theme = S.device.theme === 'dark' ? 'dark' : 'light'; };

  UI.renderChrome = () => {
    const L = UI.lists();
    const demo = S.device.mode === 'demo';
    $('#modeBar').innerHTML = demo
      ? `<div class="modebar demo">${ic('shield')}<b>TRAINING / DEMO MODE</b> — synthetic data only. Never enter real patients here. <a class="link" href="quick-guide.html" target="_blank" rel="noopener">Quick guide</a> · <button class="link" data-act="switchmode">Switch to live mode</button></div>`
      : '';
    $('#siteLine').textContent = `${st().siteName} · ${S.device.deviceName || st().stationName}`;
    const ss = S.adapter ? S.adapter.status() : { ok: false, label: '…' };
    const sync = $('#syncChip');
    sync.className = 'chip ' + (S.error ? 'bad' : ss.ok ? 'ok' : 'bad');
    sync.innerHTML = `<i class="dot"></i>${esc(S.error ? 'Sync problem' : ss.label)}`;
    sync.title = S.error || ss.detail || '';
    $('#privBtn').innerHTML = ic(S.device.privacy ? 'eyeoff' : 'eye');
    $('#privBtn').title = S.device.privacy ? 'Privacy screen ON — names shown as initials. Click to show names.' : 'Show initials only (privacy screen for public-facing displays)';
    $('#privBtn').classList.toggle('on', !!S.device.privacy);
    $('#soundBtn').innerHTML = ic(S.device.sound ? 'bell' : 'belloff');
    $('#soundBtn').title = S.device.sound ? 'Audio alerts ON (click to mute)' : 'Audio alerts MUTED — overdue patients will not chime';
    $('#soundBtn').classList.toggle('warn', !S.device.sound);
    $('#themeBtn').innerHTML = ic(S.device.theme === 'dark' ? 'sun' : 'moon');
    $('#themeBtn').title = S.device.theme === 'dark' ? 'Day mode' : 'Night mode';
    $('#userChip').innerHTML = S.user ? `${ic('lock')}<span>${esc(S.user.name)} · ${esc(S.user.title || S.user.role)}</span>` : `${ic('lock')}<span>Signed out</span>`;
    $('#userChip').title = S.user ? `Role: ${S.user.role}` : '';

    // alert bar
    const ab = $('#alertBar');
    // One slim line of alert chips. A chip opens its patient list as a drop-down over the page, so alerts never push the screen down.
    const A = [];
    const lst = (arr, f) => arr.slice(0, 15).map(f).join('') + (arr.length > 15 ? `<span class="amore">+${arr.length - 15} more</span>` : '');
    if (L.ctas1.length) A.push({ k: 'ctas1', ic: 'alert', pulse: true, label: `CTAS 1 here: ${L.ctas1.length}`, note: 'Move now to a resus bed, or any free monitored ED bed if resus is full. Continuous observation.',
      list: lst(L.ctas1, p => `<button class="link" data-act="open" data-id="${esc(p.id)}">${esc(p.urn)}</button>`) });
    if (L.overdue.length) A.push({ k: 'overdue', ic: 'bell', label: `${L.overdue.length} vital signs overdue`, note: 'Click a patient when the vital signs are done.' + (!S.device.sound ? ' <span class="pill amber">sound muted</span>' : ''),
      list: lst(L.overdue, p => { const m = D.vitalsTiming(p, st(), now()).overdueMin; return `<button class="link" data-act="reassess" data-id="${esc(p.id)}">${esc(p.urn)} (${esc(m < 1 ? '<1m' : U.dur(m))})</button>`; }) });
    if (L.longBed.length) A.push({ k: 'longbed', ic: 'bed', label: `${L.longBed.length} waiting for bed over ${U.dur(st().bedWaitRedMin)}`, note: 'Escalate to the bed coordinator. Click a patient to assign the bed.',
      list: lst(L.longBed, p => `<button class="link" data-act="bed" data-id="${esc(p.id)}">${esc(p.urn)} (${esc(U.dur(D.bedWait(p, st(), now()).mins))}, booked by ${esc(p.workflows.bed.bookedBy)})</button>`) });
    if (UI.alertOpen && !A.some(x => x.k === UI.alertOpen)) UI.alertOpen = null;
    const open = A.find(x => x.k === UI.alertOpen);
    const chips = A.map(x => `<button class="achip ${x.pulse ? 'pulse' : ''} ${UI.alertOpen === x.k ? 'on' : ''}" data-act="alerttoggle" data-id="${x.k}" aria-expanded="${UI.alertOpen === x.k}">${ic(x.ic)}<span>${esc(x.label)}</span>${ic('chev')}</button>`).join('');
    const extra = (PE.audio && PE.audio.blocked && S.device.sound) ? `<span class="achip amber">${ic('belloff')}<span>Click anywhere to enable sound alerts</span></span>` : '';
    ab.innerHTML = (S.error ? `<div class="alert red">${ic('alert')}<b>${esc(S.error)}</b></div>` : '')
      + (A.length || extra ? `<div class="abar">${chips}${extra}</div>` : '')
      + (open ? `<div class="apop" role="dialog" aria-label="${esc(open.label)}"><div class="apoph">${ic(open.ic)}<b>${esc(open.label)}</b><span>${open.note}</span><button class="x" data-act="alerttoggle" data-id="${open.k}" aria-label="Close">${ic('x')}</button></div><div class="aplist">${open.list}</div></div>` : '');

    // sidebar
    const badges = { dashboard: L.a.length, vitals: L.vit.length, bed: L.bed.length, procedure: L.proc.length, patients: L.a.length };
    const hot = { vitals: L.overdue.length > 0, bed: L.longBed.length > 0 };
    $('#side').innerHTML = `<nav aria-label="Views"><div class="navh">Reassessment Area</div>${NAV.filter(([k]) => canSee(k)).map(([k, label, icon]) => `
      <button class="nav ${UI.view === k ? 'active' : ''}" data-act="nav" data-id="${k}" aria-current="${UI.view === k ? 'page' : 'false'}">
        ${ic(icon)}<span>${label}</span>${badges[k] != null ? `<b class="nb ${hot[k] ? 'hot' : ''}">${badges[k]}</b>` : ''}</button>`).join('')}</nav>
      <div class="sidefoot">
        <div><span>Patients here</span><b>${L.a.length}</b></div>
        <div><span>Vital signs overdue</span><b class="${L.overdue.length ? 'tred' : ''}">${L.overdue.length}</b></div>
        <div><span>Waiting for bed</span><b class="${L.longBed.length ? 'tred' : ''}">${L.bed.length}</b></div>
        ${L.noWf.length ? `<div><span>Nothing open</span><b class="tamber">${L.noWf.length}</b></div>` : ''}
        <div class="learn">${(window.PULSEED_SITE || {}).training
          ? `<a class="link" href="${esc(location.pathname)}">${ic('shield')}Back to live PulseED</a>`
          : `<a class="link" href="${esc(location.pathname)}?training" target="_blank" rel="noopener" title="Opens in a new tab; this station stays signed in">${ic('shield')}Training version</a>`}
          <a class="link" href="quick-guide.html" target="_blank" rel="noopener">${ic('clock')}Quick guide</a></div>
        <div class="ver">PulseED v${PE.VERSION}</div>
      </div>`;
    const alarms = L.overdue.length + L.ctas1.length;
    document.title = (alarms ? `(${alarms}) ⚠ ` : '') + 'PulseED · Reassessment Area';
  };

  UI.renderDatalists = () => {
    const s = st();
    const phys = U.uniq((s.physicians || []).concat(active().map(p => p.physician), active().filter(p => p.workflows.bed.active).map(p => p.workflows.bed.bookedBy)).filter(x => x && x !== 'Unassigned'));
    const dl = (id, arr) => `<datalist id="${id}">${arr.map(x => `<option value="${esc(x)}">`).join('')}</datalist>`;
    $('#datalists').innerHTML = dl('dl-spec', s.specialties) + dl('dl-proc', s.procedures) + dl('dl-phys', phys) + dl('dl-bedsel', s.beds) + dl('dl-names', U.ls.get('pulseed:v2:recentUsers') || []);
  };

  // ------------------------------------------------------------------ view rendering
  UI.go = view => {
    if (!VIEWS[view]) view = 'dashboard';
    if (!canSee(view)) { if (S.user) UI.toast('Analytics and the audit trail are for Charge Nurses, ED Leaders and Admins.', 'warn'); view = 'dashboard'; }
    UI.view = view;
    UI._forceSettings = true;
    try { history.replaceState(null, '', '#' + view); } catch (e) { /* file:// */ }
    $('#viewHead').innerHTML = VIEWS[view].head();
    UI.renderBody();
    UI.renderChrome();
    $('#main').scrollTop = 0;
  };
  UI.renderBody = () => {
    // Someone without the detailed view signed in (or the leader locked the station): back to the dashboard.
    if (!canSee(UI.view)) { UI.view = 'dashboard'; $('#viewHead').innerHTML = VIEWS.dashboard.head(); try { history.replaceState(null, '', '#dashboard'); } catch (e) { /* file:// */ } }
    const v = VIEWS[UI.view];
    const body = $('#viewBody');
    // Never rebuild the settings form underneath someone typing in it, except when the signed-in user changes
    // (sign-in, lock), because what the page shows depends on the role.
    const who = S.user ? `${S.user.name}|${S.user.role}` : '';
    if (UI.view === 'settings' && body.childElementCount && !UI._forceSettings && UI._settingsWho === who) return;
    UI._forceSettings = false;
    UI._settingsWho = who;
    const y = $('#main').scrollTop;
    body.innerHTML = v.body();
    if (v.after) v.after();
    $('#main').scrollTop = y;
    // After a re-triage the lists re-sort by urgency, so the patient can jump rows: scroll to them and highlight the row.
    if (UI.flashId && Date.now() < UI.flashUntil) {
      const hit = body.querySelector(`[data-id="${CSS.escape(UI.flashId)}"]`);
      const row = hit && (hit.closest('tr, .bedtile, .tile, .spot, li') || hit);
      if (row) { row.classList.add('flash'); row.scrollIntoView({ block: 'center', behavior: 'smooth' }); UI.flashId = null; }
    }
  };
  /** Show a re-triaged patient where they now sit, even if a CTAS filter would hide them. */
  UI.flashPatient = (id, ctas) => {
    if (ctas && UI.vs.vctas && UI.vs.vctas !== ctas) { UI.vs.vctas = ''; $('#viewHead').innerHTML = VIEWS[UI.view].head(); }
    UI.flashId = id; UI.flashUntil = Date.now() + 4000; UI.renderBody();
  };
  UI.refresh = () => { UI.renderChrome(); UI.renderBody(); UI.renderDatalists(); };

  function onFilter(e) {
    const el = e.target.closest('[data-filter]');
    if (!el) return;
    UI.vs[el.dataset.filter] = el.value;
    UI.renderBody();
  }

  const head = (title, desc, tools = '') => `<div class="vhead"><div><h2>${title}</h2><p>${desc}</p></div><div class="vtools">${tools}</div></div>`;

  // Shifts follow this PC's clock, like every other time on the station. The doctor / nursing choice is saved per PC.
  const offsetAt = ms => -new Date(ms).getTimezoneOffset();
  const shiftPattern = () => PE.SHIFT_PATTERNS[S.device.shiftView === 'nursing' ? 'nursing' : 'doctor'];
  const shiftToggle = attr => `<div class="seg" role="group" aria-label="Shift view">${Object.keys(PE.SHIFT_PATTERNS).map(k => { const p = PE.SHIFT_PATTERNS[k], on = p === shiftPattern(); return `<button type="button" class="${on ? 'on' : ''}" aria-pressed="${on}" ${attr(k)}>${esc(p.label)} · ${p.hours} h</button>`; }).join('')}</div>`;
  function shiftPanel(t) {
    const pat = shiftPattern();
    const cur = D.shiftAt(pat.shifts, t, offsetAt(t));
    const prevRef = cur.from - 1, prev = D.shiftAt(pat.shifts, prevRef, offsetAt(prevRef));
    const a = D.shiftStats(S.state, st(), cur.from, cur.to, t), b = D.shiftStats(S.state, st(), prev.from, prev.to, t);
    const mins = k => (k.median == null ? '—' : `${k.median} min <span class="hint">(n=${k.n})</span>`);
    const pct = c => (c.pct == null ? '—' : `${c.pct}% <span class="hint">(n=${c.n})</span>`);
    const row = (label, f) => `<tr><td>${label}</td><td class="b">${f(a)}</td><td>${f(b)}</td></tr>`;
    const can = canExportShift(S.device.shiftView === 'nursing' ? 'nursing' : 'doctor');
    const other = canExportShift(S.device.shiftView === 'nursing' ? 'doctor' : 'nursing');
    const pdf = can
      ? `<div class="row wrap"><button class="btn primary" data-act="shiftpdf" data-id="previous">${ic('download')}Previous shift (${esc(prev.label)}) PDF</button><button class="btn ghost" data-act="shiftpdf" data-id="current">${ic('download')}This shift so far PDF</button></div>`
      : other ? `<p class="hint">To export your handover PDF, switch to ${esc(PE.SHIFT_PATTERNS[S.device.shiftView === 'nursing' ? 'doctor' : 'nursing'].label)} · ${PE.SHIFT_PATTERNS[S.device.shiftView === 'nursing' ? 'doctor' : 'nursing'].hours} h.</p>` : '';
    return `<section class="panel shiftp">
      <div class="ph"><h3>${ic('clock', 'tsky')}${esc(D.shiftTitle(cur))} <small class="hint">${U.dur(Math.max(0, Math.ceil((cur.to - t) / 60000)))} left</small></h3>${shiftToggle(k => `data-act="shiftview" data-id="${k}"`)}</div>
      <div class="tw"><table><thead><tr><th>Measure</th><th>This shift so far</th><th>Previous shift (${esc(prev.label)})</th></tr></thead><tbody>
        ${row('Added to the area', x => x.registered)}
        ${row('Left the area', x => `${x.exited} <span class="hint">(bed ${x.bedAssigned} · discharged ${x.discharged})</span>`)}
        ${row('Discharge reasons', x => (x.reasons.length ? x.reasons.map(r => `${esc(r.label)} ${r.n}`).join(' · ') : '—'))}
        ${row(`Vital signs on time (target ≥ ${st().complianceTargetPct}%)`, x => pct(x.compliance))}
        ${row('Median wait: bed booked → assigned', x => mins(x.bedWait))}
        ${row('Median time: procedure / imaging done', x => mins(x.procTat))}
      </tbody></table></div>${pdf}</section>`;
  }
  const canExportShift = key => !!S.user && PE.SHIFT_EXPORT_ROLES[key].includes(S.user.role);

  /** Handover PDF. Live: the server builds a real PDF file. Training: a print view, saved with the browser's "Save as PDF". */
  UI.shiftPdf = async which => {
    const key = S.device.shiftView === 'nursing' ? 'nursing' : 'doctor';
    if (!canExportShift(key)) return UI.toast(`Your role cannot export the ${PE.SHIFT_PATTERNS[key].hours}-hour shift report.`, 'warn');
    if (S.isShared()) {
      UI.toast('Preparing the PDF…');
      try {
        const r = await S.adapter.shiftPdf(key, which);
        const bytes = Uint8Array.from(atob(r.pdf), c => c.charCodeAt(0));
        const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' })), download: r.fileName });
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 60000);
        UI.toast(`${r.title}: PDF downloaded.`);
      } catch (e) { UI.toast(e.message, 'error'); }
      return;
    }
    const t = now(), pat = PE.SHIFT_PATTERNS[key].shifts, cur = D.shiftAt(pat, t, offsetAt(t));
    const ref = which === 'previous' ? cur.from - 1 : t, w = D.shiftAt(pat, ref, offsetAt(ref));
    const to = which === 'previous' ? w.to : t, title = D.shiftTitle(w) + (which === 'previous' ? '' : ', so far');
    const x = D.shiftStats(S.state, st(), w.from, to, t);
    const k = v => (v.median == null ? '—' : `${v.median} min (n=${v.n})`);
    const page = window.open('', '_blank');
    if (!page) return UI.toast('Pop-up blocked — allow pop-ups to print.', 'warn');
    page.document.write(`<!doctype html><meta charset="utf-8"><title>PulseED ${esc(title)}</title><style>@page{size:A4;margin:12mm}body{font:13px Arial,sans-serif;color:#0f172a}table{width:100%;border-collapse:collapse;margin:10px 0}td{border-bottom:1px solid #e2e8f0;padding:5px}pre{white-space:pre-wrap;font:11px Consolas,monospace}</style>
      <h1>PulseED Reassessment Area — Shift Report</h1><p><b>${esc(title)}</b>${S.device.mode === 'demo' ? ' · TRAINING: synthetic data' : ''}</p>
      <table><tr><td>Added to the area</td><td>${x.registered}</td></tr><tr><td>Left the area</td><td>${x.exited} (bed assigned ${x.bedAssigned}, discharged ${x.discharged})</td></tr>
      <tr><td>Discharge reasons</td><td>${esc(x.reasons.map(r => r.label + ' ' + r.n).join(', ') || '—')}</td></tr><tr><td>Vital signs on time</td><td>${x.compliance.pct == null ? '—' : x.compliance.pct + '%'}</td></tr>
      <tr><td>Median wait: bed booked → assigned</td><td>${k(x.bedWait)}</td></tr><tr><td>Median time: procedure / imaging done</td><td>${k(x.procTat)}</td></tr></table>
      <pre>${esc(D.sbar(S.state, st(), t, { privacy: true, user: S.user.name, demo: S.device.mode === 'demo', window: { from: w.from, to, title } }))}</pre>`);
    page.document.close(); page.print();
  };

  const VIEWS = {
    dashboard: {
      head: () => '',
      body() {
        const s = st(), t = now(), L = UI.lists();
        const since = t - 12 * 3600000;
        const exited = Object.values(S.state.patients).filter(p => p.exit && U.toMs(p.exit.time) >= since).sort((a, b) => U.toMs(b.exit.time) - U.toMs(a.exit.time));
        const urgent = L.ctas1.length + L.overdue.length;
        const more = (n, view) => (n > 5 ? `<button class="link more" data-act="nav" data-id="${view}">+ ${n - 5} more — view all</button>` : '');
        // One card per need: the three things a patient can be waiting for in the reassessment area.
        const card = (k, tone, icon, count, sub, rows, view) => `<section class="need ${tone}">
            <button class="nh" data-act="nav" data-id="${view}"><span class="ni">${ic(icon)}</span><span class="nt"><b>${D.WF[k]}</b><small>${sub}</small></span><span class="nc">${count}</span></button>
            <ul class="nlist">${rows}</ul>${more(count, view)}</section>`;
        const line = (p, mid, right, act) => `<li>${urnLink(p)}<span class="nn">${nm(p)}<small>${mid}</small></span>${right}${act}</li>`;
        const vit = L.vit.slice(0, 5).map(p => { const tm = D.vitalsTiming(p, s, t); return line(p, `${esc(p.ctas)} · ${esc(p.diagnosis)}`, timingS(tm), btn('reassess', p.id, 'Done', 'ghost', 'check')); }).join('') || '<li class="nempty">No one waiting for vital signs.</li>';
        const bed = L.bed.slice(0, 5).map(p => { const b = p.workflows.bed; return line(p, `Booked by ${esc(b.bookedBy)} · ${U.t24(b.bookedAt)}`, waitB(D.bedWait(p, s, t)), btn('bed', p.id, 'Assign bed', 'green', 'bed')); }).join('') || '<li class="nempty">No one waiting for a bed.</li>';
        const proc = L.proc.slice(0, 5).map(p => { const r = p.workflows.procedure; return line(p, `${esc(r.kind)}: ${esc(r.description)}`, pill(r.status, procTone(r.status)), btn('proc', p.id, 'Update', 'ghost', 'edit')); }).join('') || '<li class="nempty">No procedures, treatments or imaging waiting.</li>';
        const longest = L.bed.length ? D.bedWait(L.bed[0], s, t) : null;
        const inProg = L.proc.filter(p => p.workflows.procedure.status === 'In Progress').length;
        return `
          <section class="hello">
            <div><h2>Reassessment Area <span class="status ${urgent ? 'bad' : 'ok'}">${urgent ? `${urgent} need${urgent > 1 ? '' : 's'} attention` : 'All on track'}</span></h2>
              <p>${L.a.length} patient${L.a.length === 1 ? '' : 's'} here now · ${L.vit.length} vital signs · ${L.bed.length} waiting for bed · ${L.proc.length} procedure / imaging</p></div>
            <button class="btn primary lg" data-act="new">${ic('plus')}<span>Add Patient</span></button>
          </section>
          <section class="needs">
            ${card('vitals', L.overdue.length || L.ctas1.length ? 'red' : 'sky', 'heart', L.vit.length, L.overdue.length ? `<span class="tred">${L.overdue.length} overdue</span> · ${L.dueSoon.length} due soon` : `${L.dueSoon.length} due soon · none overdue`, vit, 'vitals')}
            ${card('bed', L.longBed.length ? 'red' : 'amber', 'bed', L.bed.length, longest ? `Longest wait ${U.dur(longest.mins)}${L.longBed.length ? ` · <span class="tred">${L.longBed.length} over ${U.dur(s.bedWaitRedMin)}</span>` : ''}` : 'Nobody waiting', bed, 'bed')}
            ${card('procedure', 'blue', 'syringe', L.proc.length, `${inProg} in progress · ${L.proc.length - inProg} waiting`, proc, 'procedure')}
          </section>
          ${L.noWf.length ? `<section class="panel warnp"><div class="ph"><h3>${ic('door', 'tamber')}Nothing open — record the exit (${L.noWf.length})</h3><span class="hint">These patients have no need left open. Assign a bed, discharge, or add a need.</span></div>
            <div class="tw"><table><tbody>${L.noWf.map(p => `<tr><td>${urnLink(p)}</td><td class="b">${nm(p)}</td><td>${esc(p.diagnosis)}</td><td class="r nowrap">${btn('open', p.id, 'Add a need', 'ghost')} ${btn('exit', p.id, 'Exit', 'green', 'door')}</td></tr>`).join('')}</tbody></table></div></section>` : ''}
          ${shiftPanel(t)}
          <section class="panel"><div class="ph"><h3>${ic('undo', 'tsky')}Left the area — last 12 h (${exited.length})</h3></div>
            <div class="tw scroll"><table><thead><tr><th>MRN</th><th>Name</th><th>How they left</th><th>Time</th><th>By</th><th class="r"></th></tr></thead><tbody>
            ${exited.slice(0, 30).map(p => `<tr><td>${urnLink(p)}</td><td>${nm(p)}</td><td>${exitPill(p.exit)}</td><td class="mono">${U.when(p.exit.time)}</td><td>${esc(p.exit.by)}</td><td class="r">${btn('reopen', p.id, 'Undo', 'ghost', 'undo')}</td></tr>`).join('') || empty('Nobody has left in the last 12 hours.', 6)}
            </tbody></table></div></section>`;
      },
    },

    vitals: {
      head: () => head('Vital Signs Monitoring', 'Each patient is due again by their CTAS level. Take the vital signs, then press Done. Most urgent at the top.',
        searchBox('vq', 'Search MRN, name…') + selectF('vctas', 'CTAS filter', [['', 'All CTAS'], ...D.CTAS.map(c => [c, c])])),
      body() {
        const s = st(), t = now();
        const rows = UI.lists().vit.filter(p => matches(p, UI.vs.vq) && (!UI.vs.vctas || p.ctas === UI.vs.vctas));
        return `<div class="panel flush"><div class="tw"><table class="big"><thead><tr><th>MRN</th><th>Name</th><th>CTAS</th><th>Every</th><th>Last taken</th><th>Next due</th><th class="r"></th></tr></thead><tbody>
          ${rows.map(p => { const v = p.workflows.vitals, tm = D.vitalsTiming(p, s, t); return `<tr class="${tm.state === 'overdue' || tm.state === 'continuous' ? 'row-red' : tm.state === 'dueSoon' ? 'row-amber' : ''}">
            <td>${urnLink(p)}</td><td class="b">${nm(p)}<div class="hint">${esc(p.diagnosis)}</div></td><td>${ctasB(p.ctas)}</td><td class="mono">${tm.intervalMin ? tm.intervalMin + ' min' : esc(tm.label)}</td>
            <td class="mono">${v.lastReassessment ? U.when(v.lastReassessment) : 'Not yet'}<div class="hint">${v.reassessments.length} taken</div></td><td>${timingB(tm)}</td>
            <td class="r nowrap">${btn('reassess', p.id, 'Done', 'primary', 'check')} ${btn('open', p.id, '⋯', 'ghost')}</td></tr>`; }).join('') || empty(UI.vs.vq || UI.vs.vctas ? 'No patients match.' : 'No one is waiting for vital signs.', 7)}
          </tbody></table></div></div>`;
      },
    },

    bed: {
      head: () => head('Waiting for Bed', 'Who booked each bed and when, and how long the patient has waited. Assigning the bed takes the patient out of PulseED. Longest wait first.',
        searchBox('bq', 'Search MRN, name, physician…')),
      body() {
        const s = st(), t = now();
        const q = UI.vs.bq;
        const rows = UI.lists().bed.filter(p => matches(p, q) || U.key(p.workflows.bed.bookedBy).includes(U.key(q)) || U.key(p.workflows.bed.specialty).includes(U.key(q)));
        const day = t - 24 * 3600000;
        const assigned = Object.values(S.state.patients).filter(p => p.exit && p.exit.type === 'bed' && U.toMs(p.exit.time) >= day && (!q || matches(p, q)))
          .sort((a, b) => U.toMs(b.exit.time) - U.toMs(a.exit.time));
        return `<div class="panel flush"><div class="tw"><table class="big"><thead><tr><th>MRN</th><th>Name</th><th>Booked by</th><th>Booked at</th><th>Waiting</th><th>Specialty</th><th class="r"></th></tr></thead><tbody>
          ${rows.map(p => { const b = p.workflows.bed, w = D.bedWait(p, s, t); return `<tr class="${w.level === 'red' ? 'row-red' : ''}">
            <td>${urnLink(p)}</td><td class="b">${nm(p)}<div class="hint">${esc(p.ctas)} · ${esc(p.diagnosis)}</div></td><td class="b">${esc(b.bookedBy)}</td><td class="mono">${U.when(b.bookedAt)}</td><td>${waitB(w)}</td><td>${b.specialty ? pill(b.specialty, 'sky') : '<span class="hint">—</span>'}</td>
            <td class="r nowrap">${btn('bed', p.id, 'Assign bed', 'green', 'bed')} ${btn('booking', p.id, 'Edit', 'ghost', 'edit')}</td></tr>`; }).join('') || empty(q ? 'No patients match.' : 'No one is waiting for a bed.', 7)}
          </tbody></table></div></div>
          <section class="panel flush"><div class="ph pad"><h3>${ic('check', 'tgreen')}Beds assigned — last 24 h (${assigned.length})</h3><span class="hint">Booking to assignment, for follow-up and reports.</span></div>
            <div class="tw scroll"><table><thead><tr><th>MRN</th><th>Name</th><th>Booked by</th><th>Booked at</th><th>Bed assigned at</th><th>Bed</th><th>Total wait</th><th class="r"></th></tr></thead><tbody>
            ${assigned.map(p => { const b = p.workflows.bed, bookedAt = b.bookedAt || p.createdAt; return `<tr><td>${urnLink(p)}</td><td>${nm(p)}</td><td>${esc(b.bookedBy || '—')}</td><td class="mono">${U.when(bookedAt)}</td><td class="mono">${U.when(p.exit.time)}</td><td class="b">${esc(p.exit.bed)}</td><td>${b.bookedAt ? waitB({ mins: U.minsBetween(b.bookedAt, p.exit.time), level: D.waitLevel(U.minsBetween(b.bookedAt, p.exit.time), s.bedWaitAmberMin, s.bedWaitRedMin) }) : '<span class="hint">no booking</span>'}</td><td class="r">${btn('reopen', p.id, 'Undo', 'ghost', 'undo')}</td></tr>`; }).join('') || empty('No beds assigned in the last 24 hours.', 8)}
            </tbody></table></div></section>`;
      },
    },

    procedure: {
      head: () => head('Procedure / Treatment / Imaging', 'What each patient is waiting for, how long, and where it is up to. "Done" or "Cancelled" closes it.',
        searchBox('pq', 'Search MRN, name, request…') + selectF('pkind', 'Type filter', [['', 'All types'], ...D.PROC_KINDS.map(x => [x, x])])),
      body() {
        const s = st(), t = now();
        const rows = UI.lists().proc.filter(p => (matches(p, UI.vs.pq) || U.key(p.workflows.procedure.description).includes(U.key(UI.vs.pq))) && (!UI.vs.pkind || p.workflows.procedure.kind === UI.vs.pkind));
        return `<div class="panel flush"><div class="tw"><table class="big"><thead><tr><th>MRN</th><th>Name</th><th>Type</th><th>Request</th><th>Requested</th><th>Waiting</th><th>Status</th><th class="r"></th></tr></thead><tbody>
          ${rows.map(p => { const r = p.workflows.procedure; return `<tr>
            <td>${urnLink(p)}</td><td class="b">${nm(p)}<div class="hint">${esc(p.ctas)} · ${esc(p.diagnosis)}</div></td><td>${pill(r.kind, r.kind === 'Radiology Imaging' ? 'blue' : r.kind === 'Treatment' ? 'green' : 'sky')}</td><td class="b">${esc(r.description)}</td>
            <td class="mono">${U.when(r.requestTime)}</td><td>${waitB(D.procWait(p, s, t))}</td><td>${pill(r.status, procTone(r.status))}</td>
            <td class="r">${btn('proc', p.id, 'Update', 'ghost', 'edit')}</td></tr>`; }).join('') || empty(UI.vs.pq || UI.vs.pkind ? 'No patients match.' : 'Nothing waiting.', 8)}
          </tbody></table></div></div>`;
      },
    },

    patients: {
      head: () => head('All Patients in the Area', 'Everyone in the reassessment area, with what they are waiting for. Open a patient to change details, re-triage, add a need or record the exit.',
        searchBox('aq', 'Search MRN, name, complaint…')),
      body() {
        const s = st(), t = now();
        const rows = UI.lists().a.filter(p => matches(p, UI.vs.aq)).sort((a, b) => (a.ctas > b.ctas ? 1 : a.ctas < b.ctas ? -1 : U.toMs(a.createdAt) - U.toMs(b.createdAt)));
        const chip = (p, k) => {
          const w = p.workflows[k];
          if (!w.active) return '';
          if (k === 'vitals') { const tm = D.vitalsTiming(p, s, t); return `<span class="wf on t-${tm.state}" title="${esc(tm.label)}">${ic('heart')}${tm.state === 'overdue' ? 'Overdue' : 'Vitals'}</span>`; }
          if (k === 'bed') return `<span class="wf on w-${D.bedWait(p, s, t).level}" title="Booked by ${esc(w.bookedBy)}">${ic('bed')}Bed ${U.dur(D.bedWait(p, s, t).mins)}</span>`;
          return `<span class="wf on" title="${esc(w.description)}">${ic('syringe')}${esc(w.kind === 'Radiology Imaging' ? 'Imaging' : w.kind)}</span>`;
        };
        return `<div class="panel flush"><div class="tw"><table class="big"><thead><tr><th>MRN</th><th>Name</th><th>CTAS</th><th>Chief complaint</th><th>Physician</th><th>In the area</th><th>Waiting for</th><th class="r"></th></tr></thead><tbody>
          ${rows.map(p => `<tr class="${p.ctas === 'CTAS 1' ? 'row-red' : !D.activeWfs(p).length ? 'row-amber' : ''}"><td>${urnLink(p)}</td><td class="b">${nm(p)}</td><td>${ctasB(p.ctas)}</td><td>${esc(p.diagnosis)}</td>
            <td>${esc(p.physician)}</td><td class="mono">${U.dur(U.minsBetween(p.createdAt, t))}<div class="hint">since ${U.t24(p.createdAt)}</div></td>
            <td class="nowrap">${D.WF_KEYS.map(k => chip(p, k)).join(' ') || '<span class="tamber">Nothing open</span>'}</td><td class="r nowrap">${btn('open', p.id, 'Open', 'ghost', 'edit')} ${btn('exit', p.id, 'Exit', 'green', 'door')}</td></tr>`).join('') || empty('No one is in the reassessment area.', 8)}
          </tbody></table></div></div>`;
      },
    },

    analytics: {
      head: () => head('Reports', 'Last 24 hours, calculated from what was recorded. Charts show each hour against its normal range (XmR control chart), so unusual hours stand out.'),
      body() {
        const s = st(), m = D.metrics(S.state, s, now());
        const kc = (title, k, unit, desc) => `<div class="panel kpi"><p>${title}</p><h3>${k.mean != null ? k.mean + ' ' + unit : '—'}</h3><p class="mono">Median: ${k.median != null ? k.median + ' ' + unit : '—'} · n=${k.n}</p><small>${desc}</small></div>`;
        const comp = m.compliance;
        const c1 = PE.charts.xmr(m.labels, [{ name: 'Vital signs on time (%)', values: m.hourly.compliance, cls: 's1' }], { yMin: 0, yMax: 100, unit: '%', target: s.complianceTargetPct, title: 'Vital signs on time' });
        const c2 = PE.charts.xmr(m.labels, [{ name: 'Bed booked → assigned (min)', values: m.hourly.bed, cls: 's2' }], { yMin: 0, unit: 'm', title: 'Bed wait' });
        const c3 = PE.charts.xmr(m.labels, [{ name: 'Procedure / imaging time (min)', values: m.hourly.tat, cls: 's4' }], { yMin: 0, unit: 'm', title: 'Procedure / imaging time' });
        const chart = (title, icon, tone, desc, c) => `<div class="panel"><div class="ph"><h3>${ic(icon, tone)}${title}</h3>${pill(c.status.label, c.status.tone)}</div><p class="hint">${desc}</p>${c.svg}<div class="legend">${c.legend}</div></div>`;
        const ex = (act, label, tone = 'tsky') => `<button class="export" data-act="${act}">${ic('download', tone)}<span>${label}</span><small>.CSV</small></button>`;
        return `
          <section class="metrics">
            ${kc('Bed wait', m.bedWait, 'min', 'Physician booked the bed → bed assigned')}
            ${kc('Procedure / imaging time', m.procTat, 'min', 'Requested → marked Done')}
            <div class="panel kpi"><p>Vital signs on time</p><h3 class="${comp.pct != null && comp.pct < s.complianceTargetPct ? 'tred' : ''}">${comp.pct != null ? comp.pct + '%' : '—'}</h3><p class="mono">Hourly median: ${comp.median != null ? comp.median + '%' : '—'} · n=${comp.n} intervals</p><small class="${comp.pct != null && comp.pct >= s.complianceTargetPct ? 'tgreen' : ''}">Target ≥ ${s.complianceTargetPct}% · on time = within ${s.complianceGraceMin} min of due</small></div>
          </section>
          <section class="tri">
            ${chart('Vital signs on time, by hour', 'heart', 'tsky', 'Share of vital signs taken on time, by the hour they fell due.', c1)}
            ${chart('Bed wait, by hour', 'bed', 'tamber', 'Average minutes from booking to bed assigned.', c2)}
            ${chart('Procedure / imaging time, by hour', 'syringe', 'tblue', 'Average minutes from request to done.', c3)}
          </section>
          ${!D.isLeader(S.user) ? `<p class="note">${ic('lock')} Spreadsheet exports are for ED Leaders and Admins.</p>` : `<section class="panel">
            <div class="ph"><h3>${ic('download', 'tsky')}Spreadsheet exports</h3>
              <label class="check"><input type="checkbox" id="deid" ${UI.vs.deid !== false ? 'checked' : ''}> De-identify (initials instead of names)</label></div>
            <p class="hint">Exports contain patient information. Store them only in approved locations. Every export is recorded in the audit trail.</p>
            <div class="exports">
              ${ex('x-master', 'Patients')}${ex('x-vitals', 'Vital signs')}${ex('x-bed', 'Bed bookings')}${ex('x-proc', 'Procedure / imaging')}${ex('x-audit', 'Audit trail', 'tgreen')}
              <button class="export" data-act="x-backup">${ic('shield', 'tamber')}<span>Full backup (all data)</span><small>.JSON</small></button>
            </div>
          </section>`}`;
      },
      after() { const d = $('#deid'); if (d) d.onchange = () => (UI.vs.deid = d.checked); },
    },

    audit: {
      head: () => head('Audit Trail', 'Every action with date, time, user and station. Each row is chained to the one before, so any change or deletion is detectable.',
        searchBox('eq', 'Search URN, user, event, notes…') + selectF('ewf', 'Workflow filter', [['', 'Everything'], ['Vital', 'Vital signs'], ['Bed', 'Waiting for bed'], ['Procedure', 'Procedure / imaging'], ['Exit', 'Exits'], ['Patient', 'Patient details'], ['System', 'System / exports']])
        + `<button class="btn ghost" data-act="verify">${ic('shield')}<span>Verify integrity</span></button>`),
      body() {
        const q = U.key(UI.vs.eq), wf = UI.vs.ewf;
        const evs = S.state.events.filter(e => (!q || [e.urn, e.user, e.eventType, e.notes, e.workflow, e.encounterId].some(x => U.key(x).includes(q))) && (!wf || (e.workflow || '').includes(wf) || (wf === 'System' && e.user === 'System')));
        const shown = evs.slice(-500).reverse();
        return `<div class="panel flush"><div class="tw"><table class="big"><thead><tr><th>Date / time</th><th>MRN</th><th>Encounter</th><th>Area</th><th>Event</th><th>Change</th><th>User</th><th>Station</th><th>Notes</th></tr></thead><tbody>
          ${shown.map(e => `<tr><td class="mono nowrap" title="${esc(e.ts)}">${esc(U.full(e.ts))}</td><td class="mono b">${esc(e.urn)}</td><td class="mono small">${esc(e.encounterId)}</td><td>${esc(e.workflow)}</td><td class="b">${esc(e.eventType)}</td>
            <td class="mono small">${esc(e.prev || '—')} → <span class="tgreen b">${esc(e.next || '—')}</span></td><td>${esc(e.user)}<div class="hint">${esc(e.role)}</div></td><td class="small">${esc(e.device)}</td><td class="notes">${esc(e.notes)}</td></tr>`).join('') || empty('No events match.', 9)}
          </tbody></table></div>${evs.length > 500 ? `<p class="hint pad">Showing the latest 500 of ${evs.length} matching events. Export the CSV for the full log.</p>` : ''}</div>`;
      },
    },

    settings: {
      head: () => head('Settings', 'Clinical timing rules, thresholds and lists for this department. Saving requires a Charge Nurse, ED Leader or Admin. Station preferences apply to this PC only.'),
      body() { return UI.settingsForm(); },
      after() { UI.bindSettings(); },
    },
  };
  UI.VIEWS = VIEWS;

  // ------------------------------------------------------------------ toasts
  UI.toast = (msg, type = 'success', action) => {
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `<i class="dot"></i><span>${esc(msg)}</span>${action ? `<button class="btn sm ghost">${esc(action.label)}</button>` : ''}<button class="x" aria-label="Dismiss">${ic('x')}</button>`;
    const kill = () => { el.classList.add('out'); setTimeout(() => el.remove(), 250); };
    el.querySelector('.x').onclick = kill;
    if (action) el.querySelector('.btn').onclick = () => { kill(); action.fn(); };
    $('#toasts').appendChild(el);
    setTimeout(kill, type === 'error' ? 9000 : action ? 12000 : 4500);
  };

  // ------------------------------------------------------------------ modal framework
  const stack = [];
  UI.closeTopModal = viaEsc => {
    const m = stack[stack.length - 1];
    if (!m || (viaEsc && m.locked)) return;
    m.el.remove(); stack.pop();
    if (m.prevFocus && m.prevFocus.focus) m.prevFocus.focus();
  };
  UI.closeAll = () => { while (stack.length) { const m = stack.pop(); m.el.remove(); } };

  /**
   * opts: { title, icon, tone, wide, locked, body, submit:'Save', danger, onSubmit(form, data) -> Promise, onMount(el), noFooter, extraButtons }
   */
  UI.modal = opts => {
    const el = document.createElement('div');
    el.className = 'overlay' + (opts.locked ? ' lock' : ''); // lock screens fully hide patient data behind them
    el.innerHTML = `<div class="modal ${opts.wide ? 'wide' : ''} ${opts.tone || ''}" role="dialog" aria-modal="true" aria-labelledby="mt">
      <div class="mh"><h3 id="mt">${opts.icon ? ic(opts.icon) : ''}<span>${opts.title}</span></h3>${opts.locked ? '' : `<button type="button" class="x" data-close aria-label="Close">${ic('x')}</button>`}</div>
      <form class="mb" novalidate>${opts.body}<div class="merr" role="alert" hidden></div>
        ${opts.noFooter ? '' : `<div class="mf">${opts.extraButtons || ''}<span class="grow"></span>${opts.locked ? '' : '<button type="button" class="btn ghost" data-close>Cancel</button>'}<button type="submit" class="btn ${opts.danger ? 'red' : 'primary'}">${opts.submit || 'Save'}</button></div>`}
      </form></div>`;
    const m = { el, locked: !!opts.locked, prevFocus: document.activeElement };
    stack.push(m);
    $('#modalRoot').appendChild(el);
    const form = el.querySelector('form');
    el.querySelectorAll('[data-close]').forEach(b => (b.onclick = () => close()));
    const close = () => { const i = stack.indexOf(m); if (i >= 0) { stack.splice(i, 1); el.remove(); } };
    const err = el.querySelector('.merr');
    m.close = close;
    m.showError = (msg, code) => { err.hidden = false; err.innerHTML = `${ic('alert')}<span>${esc(msg)}</span>`; err.dataset.code = code || ''; err.scrollIntoView({ block: 'nearest' }); };
    form.addEventListener('submit', async e => {
      e.preventDefault();
      if (!opts.onSubmit) return close();
      const sub = form.querySelector('[type=submit]');
      err.hidden = true;
      sub.disabled = true;
      try {
        const data = Object.fromEntries(new FormData(form).entries());
        $$('input[type=checkbox]', form).forEach(c => (data[c.name] = c.checked));
        const keep = await opts.onSubmit(form, data, m);
        if (keep !== true) close();
      } catch (ex) {
        m.showError(ex.message || String(ex), ex.code);
        if (opts.onError) opts.onError(ex, form, m);
      } finally { sub.disabled = false; }
    });
    if (opts.onMount) opts.onMount(el, form, m);
    const f = el.querySelector('[autofocus]') || el.querySelector('input:not([type=hidden]):not([readonly]),select,textarea,button[type=submit]');
    if (f) setTimeout(() => f.focus(), 30);
    return m;
  };

  const field = (label, inner, hint = '', cls = '') => `<label class="f ${cls}"><span>${label}</span>${inner}${hint ? `<small>${hint}</small>` : ''}</label>`;
  const opt = (v, cur, label) => `<option value="${esc(v)}"${v === cur ? ' selected' : ''}>${esc(label || v)}</option>`;
  const sel = (name, options, cur, attrs = '') => `<select name="${name}" ${attrs}>${options.map(o => (Array.isArray(o) ? opt(o[0], cur, o[1]) : opt(o, cur))).join('')}</select>`;
  const inp = (name, val = '', attrs = '') => `<input name="${name}" value="${esc(val)}" ${attrs}>`;
  const patientCard = p => `<div class="pcard"><div><b>${nm(p)}</b> <span class="mono tsky">${esc(p.urn)}</span> ${ctasB(p.ctas)}</div><div class="hint">${[p.diagnosis, p.physician, p.team, p.encounterId ? 'Enc ' + p.encounterId : ''].filter(x => x && x !== 'Unassigned').map(esc).join(' · ')}</div></div>`;
  const fresh = id => S.state.patients[id];

  /** Run a store action and report the result. */
  async function run(type, payload, okMsg, undo) {
    const res = await S.dispatch(type, payload);
    UI.toast(okMsg, 'success', undo);
    return res;
  }
  UI.run = run;

  // ------------------------------------------------------------------ modals: sign-in / mode
  UI.modeModal = onDone => UI.modal({
    title: 'Welcome to PulseED', icon: 'logo', locked: true, submit: 'Continue',
    body: `<p>Choose how this station will be used. The two modes keep completely separate data so training records can never mix with real patients.</p>
      <div class="choice">
        <label><input type="radio" name="mode" value="demo" checked><div><b>Training / Demo</b><small>Loads synthetic patients (including the original prototype's 7) and 24 h of history so every screen can be explored.</small></div></label>
        <label><input type="radio" name="mode" value="live"><div><b>Live department use</b><small>Starts empty. For a single PC, data stays in this browser; for all workstations, connect the PatientFlow MS database in Settings.</small></div></label>
      </div>`,
    onSubmit: async (f, d) => onDone(d.mode),
  });

  UI.signInModal = (reason) => {
    if (S.isShared()) return UI.googleSignIn(reason);
    const recent = U.ls.get('pulseed:v2:recentUsers') || [];
    UI.modal({
      title: reason === 'locked' ? 'Station locked' : 'Sign in to this station', icon: 'lock', locked: true, submit: 'Sign in',
      body: `${reason === 'locked' ? '<p class="note">The station locked after inactivity to protect patient information.</p>' : ''}
        ${(window.PULSEED_SITE || {}).training ? `<p class="note">${ic('shield')}<span><b>Training version</b>: open to anyone, no account needed. Type any name and pick a role: <b>Nurse</b> for the reassessment area, <b>Charge Nurse</b> or <b>ED Leader</b> to also see reports and the audit trail. Patients here are made up and stay in this browser. <a class="link" href="quick-guide.html" target="_blank" rel="noopener">Quick guide</a></span></p>`
          : `<p class="hint">Every action is recorded in the audit trail under this name and role.${S.adapter && S.adapter.kind === 'local' ? ' In local mode this is self-declared, not a verified login — connect PatientFlow MS for real authentication.' : ''}</p>`}
        ${field('Your name (as on your badge)', inp('name', S.user ? S.user.name : recent[0] || '', 'required autocomplete="off" list="dl-names" autofocus maxlength="60"'))}
        ${field('Role', sel('role', PE.ROLES, S.user ? S.user.role : 'Nurse'))}
        ${field('Station name', inp('device', S.device.deviceName || '', 'placeholder="e.g. Reassessment Desk" maxlength="40"'), 'Shown in the audit trail. Saved on this PC.')}`,
      onSubmit: async (f, d) => {
        const name = U.norm(d.name);
        if (name.length < 3 || !/\s|\./.test(name)) throw new D.RuleError('Enter your full name or initial + surname (e.g. "J. Doe") so the audit trail identifies you.');
        S.setUser({ name, role: d.role });
        S.device.deviceName = U.norm(d.device); S.saveDevice();
        try { U.ls.set('pulseed:v2:recentUsers', U.uniq([name, ...recent]).slice(0, 12)); } catch (e) { /* ignore */ }
        UI.refresh();
        UI.toast(`Signed in as ${name} (${d.role}).`);
      },
    });
  };

  /** Shared register: Google account sign-in; name and role come from the Recipients tab on the server. */
  UI.googleSignIn = reason => {
    if (stack.some(m => m.googleSignIn)) return;
    const g = S.adapter;
    const clientId = g.config && g.config.googleClientId;
    const m = UI.modal({
      title: reason === 'locked' ? 'Station locked' : reason === 'expired' ? 'Sign in again' : 'Sign in to PulseED', icon: 'lock', locked: true, noFooter: true,
      body: `${reason === 'locked' ? '<p class="note">The station locked to protect patient information.</p>' : reason === 'expired' ? '<p class="note">Your Google sign-in expired (they last about an hour). Sign in again to continue — nothing was lost.</p>' : ''}
        <p>Sign in with the Google account the system owner added to the PulseED staff list. Your name and role come from that list and are recorded on every action.</p>
        <div id="gbtn" style="min-height:48px;display:grid;place-items:center"></div>
        <div class="merr" data-gerr ${S.error ? '' : 'hidden'}>${ic('alert')}<span>${esc(S.error || '')}</span></div>
        <p class="hint">Just want to learn or try it? <a class="link" href="${esc(location.pathname)}?training">Open the training version</a> (no account needed, synthetic patients only) · <a class="link" href="quick-guide.html" target="_blank" rel="noopener">Quick guide</a></p>`,
    });
    m.googleSignIn = true;
    const box = $('#gbtn', m.el), errBox = $('[data-gerr]', m.el);
    const showErr = msg => { errBox.hidden = false; errBox.innerHTML = `${ic('alert')}<span>${esc(msg)}</span>`; };
    if (!clientId) return showErr(S.error || 'Google Sign-In is not configured on the server yet (Settings → GOOGLE_CLIENT_ID).');
    const start = () => {
      google.accounts.id.initialize({
        client_id: clientId, auto_select: false, cancel_on_tap_outside: false, itp_support: true,
        callback: async r => {
          box.innerHTML = '<p class="hint">Checking your account…</p>';
          try { const u = await g.signIn(r.credential); S.error = null; m.close(); UI.refresh(); await S.reload(); UI.toast(`Signed in as ${u.name} (${u.role}).`); }
          catch (e) { showErr(e.message); google.accounts.id.renderButton(box, { theme: 'outline', size: 'large', shape: 'pill', text: 'continue_with' }); }
        },
      });
      // Button only: running One Tap (prompt) alongside it lets a click abort both flows, so sign-in silently fails.
      google.accounts.id.renderButton(box, { theme: 'outline', size: 'large', shape: 'pill', text: 'continue_with', width: 300 });
    };
    if (window.google && google.accounts && google.accounts.id) return start();
    const s = Object.assign(document.createElement('script'), { src: 'https://accounts.google.com/gsi/client', async: true, onload: start, onerror: () => showErr('Google Sign-In could not load. Check the internet connection, then reload the page.') });
    document.head.appendChild(s);
  };

  // ------------------------------------------------------------------ modals: add patient
  /** The three needs as big tick cards. */
  const needPick = (cur = {}) => `<div class="needpick">
      <label class="np sky"><input type="checkbox" name="wfVitals" ${cur.vitals ? 'checked' : ''}>${ic('heart')}<b>${D.WF.vitals}</b><small>Timed by CTAS</small></label>
      <label class="np amber"><input type="checkbox" name="wfBed" ${cur.bed ? 'checked' : ''}>${ic('bed')}<b>${D.WF.bed}</b><small>Physician booked a bed</small></label>
      <label class="np blue"><input type="checkbox" name="wfProc" ${cur.procedure ? 'checked' : ''}>${ic('syringe')}<b>${D.WF.procedure}</b><small>Procedure, treatment or radiology</small></label>
    </div>`;
  const bookingFields = (b = {}) => `<div class="g2">${field('Bed booked by (physician) *', inp('bookedBy', b.bookedBy || '', 'list="dl-phys" maxlength="60" autocomplete="off" placeholder="e.g. Dr A. Khan"'), 'The booking time is recorded automatically.')}
    ${field('Specialty', inp('specialty', b.specialty || '', 'list="dl-spec" maxlength="60" placeholder="Optional"'))}</div>`;
  const procFields = (r = {}) => `<div class="g3">${field('Type *', sel('kind', D.PROC_KINDS, r.kind || 'Procedure'))}
    ${field('What is needed *', inp('description', r.description || '', 'list="dl-proc" maxlength="80" autocomplete="off" placeholder="e.g. CT Head, IV antibiotics, suturing"'), '', 'span2')}</div>`;

  UI.newPatientModal = () => {
    const s = st();
    UI.modal({
      title: 'Add Patient', icon: 'plus', wide: true, submit: 'Add Patient',
      body: `
        <div class="g2">
          ${field('MRN *', inp('urn', '', 'required maxlength="24" autocomplete="off" placeholder="Copy from TrakCare" autofocus'))}
          ${field('Patient name *', inp('name', '', 'required maxlength="80" autocomplete="off"'))}
          ${field('Chief complaint *', inp('diagnosis', '', 'required maxlength="120" autocomplete="off" placeholder="e.g. Chest pain"'))}
          ${field('CTAS *', sel('ctas', [['', '— select —'], ...D.CTAS.map(c => [c, c === 'Other' ? 'Not triaged yet' : `${c}${s.ctasIntervals[c] ? ' · vitals every ' + s.ctasIntervals[c] + ' min' : c === 'CTAS 1' ? ' · continuous' : ''}`])], '', 'required'))}
        </div>
        <fieldset class="wfset"><legend>What is the patient waiting for? <small>Tick one or more</small></legend>${needPick()}</fieldset>
        <div class="sec" data-sec="wfBed" hidden>${bookingFields()}</div>
        <div class="sec" data-sec="wfProc" hidden>${procFields()}</div>
        <details class="more"><summary>More details (optional)</summary><div class="g3">
          ${field('Treating physician', inp('physician', '', 'maxlength="60" list="dl-phys" placeholder="If known"'))}
          ${field('Encounter number', inp('encounterId', '', 'maxlength="24" autocomplete="off"'))}
          ${field('ED team', sel('team', [['', '—'], ...s.teams], ''))}</div></details>`,
      onMount: (el, form) => {
        const sync = () => $$('[data-sec]', form).forEach(sx => (sx.hidden = !form.elements[sx.dataset.sec].checked));
        form.addEventListener('change', sync); sync();
      },
      onSubmit: async (f, d) => {
        const res = await run('ADMIT', {
          urn: d.urn, encounterId: d.encounterId, name: d.name, diagnosis: d.diagnosis, ctas: d.ctas, physician: d.physician, team: d.team,
          workflows: { vitals: d.wfVitals, bed: d.wfBed, procedure: d.wfProc }, bookedBy: d.bookedBy, specialty: d.specialty, kind: d.kind, description: d.description,
        }, `${U.norm(d.urn).toUpperCase()} added to the reassessment area.`);
        if (res.patient && res.patient.ctas === 'CTAS 1') UI.toast('CTAS 1: move now to a resus bed, or any free monitored ED bed if resus is full.', 'error');
      },
    });
  };

  // ------------------------------------------------------------------ modals: vital signs
  UI.reassessModal = id => {
    const p = fresh(id); if (!p) return;
    const s = st(), tm = D.vitalsTiming(p, s, now()), v = p.workflows.vitals;
    if (!v.active) { UI.toast(`${p.urn} is not on vital signs monitoring.`, 'warn'); return UI.patientModal(id); }
    const minT = Math.max(U.toMs(v.lastReassessment || v.startTime), now() - s.backdateMaxMin * 60000);
    UI.modal({
      title: `Vital signs done — ${esc(p.urn)}`, icon: 'heart', submit: 'Vital signs done',
      body: `${patientCard(p)}
        <div class="kv"><span>Every</span><b>${tm.intervalMin ? `${tm.intervalMin} min` : esc(tm.label)}</b><span>Last</span><b>${v.lastReassessment ? U.when(v.lastReassessment) : 'Not yet (since ' + U.when(v.startTime) + ')'}</b><span>Status</span><b>${timingB(tm)}</b></div>
        <p class="hint">Document the values in TrakCare as usual. This only records that they were taken and restarts the timer.</p>
        <div class="g2">${field('Time taken', `<input type="datetime-local" name="time" value="${U.localInput(now())}" min="${U.localInput(minT)}" max="${U.localInput(now())}" required>`, `Can be back-dated up to ${s.backdateMaxMin} min.`)}
        ${field('Note', inp('note', '', 'maxlength="200" placeholder="Optional"'))}</div>`,
      onSubmit: async (f, d) => {
        // Left at the current minute = "now" (with seconds), so it is never earlier than a start a few seconds ago.
        const t = d.time && d.time !== U.localInput(now()) ? new Date(d.time).toISOString() : null;
        await run('RECORD_REASSESSMENT', { id, time: t, note: d.note }, `Vital signs recorded for ${p.urn}; timer restarted.`);
      },
    });
  };

  // ------------------------------------------------------------------ modals: bed
  const bookingCard = (p, t) => {
    const b = p.workflows.bed;
    return `<div class="kv"><span>Booked by</span><b>${esc(b.bookedBy)}${b.specialty ? ' · ' + esc(b.specialty) : ''}</b><span>Booked at</span><b>${U.full(b.bookedAt)}</b><span>Waiting</span><b>${waitB(D.bedWait(p, st(), t))}</b></div>`;
  };
  /** Assign the bed: the patient leaves PulseED. */
  UI.bedModal = id => {
    const p = fresh(id); if (!p) return;
    if (p.status !== 'active') return UI.toast(`${p.urn} has already left the area.`, 'warn');
    const b = p.workflows.bed;
    UI.modal({
      title: `Assign bed — ${esc(p.urn)}`, icon: 'bed', submit: 'Assign bed', tone: 'ok',
      extraButtons: b.active ? `<button type="button" class="btn ghost" data-edit>${ic('edit')}Edit booking</button>` : '',
      body: `${patientCard(p)}${b.active ? bookingCard(p, now()) : '<p class="hint">No bed booking was recorded for this patient; the bed can still be assigned.</p>'}
        ${field('Bed *', inp('bed', '', 'required list="dl-bedsel" maxlength="40" autocomplete="off" placeholder="Start typing, e.g. Bed 12" autofocus'))}
        ${field('Note', inp('note', '', 'maxlength="200" placeholder="Optional"'))}
        <p class="hint">${ic('door')} The patient leaves PulseED: everything still open for them is closed and the assignment time is recorded.</p>`,
      onMount: (el, form, m) => { const e = $('[data-edit]', el); if (e) e.onclick = () => { m.close(); UI.bookingModal(id); }; },
      onSubmit: async (f, d) => {
        await run('EXIT', { id, type: 'bed', bed: d.bed, reason: d.note, expectedVersion: p.version }, `${p.urn}: bed ${U.norm(d.bed)} assigned. Patient has left the reassessment area.`,
          { label: 'Undo', fn: () => run('REOPEN', { id, reason: 'Undo straight after assigning the bed' }, `${p.urn} is back in the reassessment area.`).catch(e => UI.toast(e.message, 'error')) });
      },
    });
  };
  UI.bookingModal = id => {
    const p = fresh(id); if (!p) return;
    const b = p.workflows.bed;
    if (p.status !== 'active' || !b.active) return UI.toast(`${p.urn} is not waiting for a bed.`, 'warn');
    UI.modal({
      title: `Bed booking — ${esc(p.urn)}`, icon: 'edit', submit: 'Save booking',
      extraButtons: `<button type="button" class="btn ghost" data-cancel>Cancel booking</button>`,
      body: `${patientCard(p)}${bookingCard(p, now())}${bookingFields(b)}<p class="hint">The booking time stays ${U.t24(b.bookedAt)}.</p>`,
      onMount: (el, form, m) => { $('[data-cancel]', el).onclick = () => { m.close(); UI.reasonModal(`Cancel bed booking — ${esc(p.urn)}`, 'Why is the booking cancelled?', reason => run('STOP_WORKFLOW', { id, wf: 'bed', reason, expectedVersion: p.version }, `Bed booking cancelled for ${p.urn}.`)); }; },
      onSubmit: async (f, d) => { await run('UPDATE_BOOKING', { id, bookedBy: d.bookedBy, specialty: d.specialty, expectedVersion: p.version }, `Bed booking updated for ${p.urn}.`); },
    });
  };

  // ------------------------------------------------------------------ modals: procedure / treatment / imaging
  UI.procModal = id => {
    const p = fresh(id); if (!p) return;
    const r = p.workflows.procedure;
    if (!r.active) { UI.toast(`${p.urn} has nothing open for procedure / imaging.`, 'warn'); return UI.patientModal(id); }
    UI.modal({
      title: `${esc(r.kind)} — ${esc(p.urn)}`, icon: 'syringe', submit: 'Save',
      body: `${patientCard(p)}
        <div class="kv"><span>Requested</span><b>${U.when(r.requestTime)}</b><span>Waiting</span><b>${waitB(D.procWait(p, st(), now()))}</b></div>
        ${procFields(r)}
        ${field('Status', `<div class="seg big" role="radiogroup">${D.PROC_STATUS.map(x => `<label><input type="radio" name="status" value="${esc(x)}" ${x === r.status ? 'checked' : ''}><span>${esc(x)}</span></label>`).join('')}</div>`)}
        ${field('Note', inp('note', '', 'maxlength="200"'), 'Needed for Cancelled. Done or Cancelled closes it.')}`,
      onSubmit: async (f, d) => { await run('UPDATE_PROCEDURE', { id, kind: d.kind, description: d.description, status: d.status, note: d.note, expectedVersion: p.version }, `${p.urn}: ${d.status}.`); },
    });
  };

  // ------------------------------------------------------------------ modals: exit
  UI.exitModal = (id, type) => {
    const p = fresh(id); if (!p) return;
    if (p.status !== 'active') return UI.toast(`${p.urn} has already left the area.`, 'warn');
    const wfs = D.activeWfs(p);
    const def = type || (p.workflows.bed.active ? 'bed' : 'discharged');
    const opt3 = (v, icon, title, small) => `<label class="np ${v === 'bed' ? 'green' : v === 'discharged' ? 'sky' : 'grey'}"><input type="radio" name="type" value="${v}" ${v === def ? 'checked' : ''}>${ic(icon)}<b>${title}</b><small>${small}</small></label>`;
    UI.modal({
      title: `Patient leaving — ${esc(p.urn)}`, icon: 'door', submit: 'Confirm exit',
      body: `${patientCard(p)}
        <div class="needpick">${opt3('bed', 'bed', 'Bed assigned', 'Moved to an ED bed')}${opt3('discharged', 'door', 'Discharged', 'Home, DAMA, absconded, LWBS…')}${opt3('error', 'x', 'Entered in error', 'Wrong patient or duplicate')}</div>
        <div data-for="bed">${field('Bed *', inp('bed', '', 'list="dl-bedsel" maxlength="40" autocomplete="off" placeholder="Start typing, e.g. Bed 12"'))}</div>
        <div data-for="discharged">${field('Reason *', `<div class="chips">${D.DISCHARGE_REASONS.map((r, i) => `<label><input type="radio" name="dreason" value="${esc(r)}" ${i === 0 ? 'checked' : ''}><span>${esc(r)}</span></label>`).join('')}<label><input type="radio" name="dreason" value="__other"><span>Other…</span></label></div>`)}
          <div data-other hidden>${field('Type the reason *', inp('dother', '', 'maxlength="120" autocomplete="off"'))}</div></div>
        <div data-for="error">${field('What was wrong? *', inp('ereason', '', 'maxlength="200" autocomplete="off" placeholder="e.g. duplicate entry"'))}</div>
        <p class="hint">${ic('shield')} Closes ${wfs.length ? wfs.map(k => D.WF[k]).join(', ') : 'the record'} and takes the patient out of PulseED. It can be undone from “Left the area” on the dashboard.</p>`,
      onMount: (el, form) => {
        const sync = () => {
          const t = form.elements.type.value;
          $$('[data-for]', form).forEach(x => (x.hidden = x.dataset.for !== t));
          $('[data-other]', form).hidden = form.elements.dreason.value !== '__other';
        };
        form.addEventListener('change', sync); sync();
      },
      onSubmit: async (f, d) => {
        const reason = d.type === 'discharged' ? (d.dreason === '__other' ? U.norm(d.dother) : d.dreason) : d.type === 'error' ? d.ereason : '';
        await run('EXIT', { id, type: d.type, bed: d.bed, reason, expectedVersion: p.version },
          d.type === 'bed' ? `${p.urn}: bed ${U.norm(d.bed)} assigned. Patient has left the area.` : d.type === 'discharged' ? `${p.urn} discharged — ${reason}.` : `${p.urn} removed (entered in error).`,
          { label: 'Undo', fn: () => run('REOPEN', { id, reason: 'Undo straight after the exit' }, `${p.urn} is back in the reassessment area.`).catch(e => UI.toast(e.message, 'error')) });
      },
    });
  };

  UI.reopenModal = id => {
    const p = fresh(id); if (!p || !p.exit) return;
    UI.reasonModal(`Undo exit — ${esc(p.urn)} (${esc(D.exitText(p.exit))})`, 'Why is this exit being undone?',
      reason => run('REOPEN', { id, reason }, `${p.urn} is back in the reassessment area with what was open before.`));
  };

  UI.reasonModal = (title, label, fn, submit = 'Confirm') => UI.modal({
    title, icon: 'edit', submit,
    body: field(label + ' *', `<textarea name="reason" rows="3" maxlength="300" required autofocus></textarea>`),
    onSubmit: async (f, d) => { if (!U.norm(d.reason)) throw new D.RuleError('A reason is required.'); await fn(d.reason); },
  });

  // ------------------------------------------------------------------ modals: patient record
  UI.patientModal = id => {
    const p = fresh(id); if (!p) return UI.toast('Patient record no longer exists.', 'warn');
    const s = st(), t = now(), act = p.status === 'active';
    const evs = S.state.events.filter(e => e.patientId === id).slice().reverse();
    const wfCard = k => {
      const w = p.workflows[k];
      let info = '';
      if (k === 'vitals' && w.startTime) info = w.active ? `${timingB(D.vitalsTiming(p, s, t))}<div class="hint">${w.reassessments.length} taken since ${U.when(w.startTime)}</div>` : `<div class="hint">Closed ${U.when(w.endTime)} — ${esc(w.endReason)}</div>`;
      if (k === 'bed' && w.bookedAt) info = w.active ? `${waitB(D.bedWait(p, s, t))}<div class="hint">Booked by ${esc(w.bookedBy)} at ${U.t24(w.bookedAt)}${w.specialty ? ' · ' + esc(w.specialty) : ''}</div>` : `<div class="hint">${w.assignedBed ? `Bed ${esc(w.assignedBed)} assigned ${U.when(w.assignedAt)} (booked ${U.t24(w.bookedAt)} by ${esc(w.bookedBy)})` : 'Closed ' + U.when(w.endTime) + ' — ' + esc(w.endReason)}</div>`;
      if (k === 'procedure' && w.requestTime) info = w.active ? `${pill(w.status, procTone(w.status))}<div class="hint">${esc(w.kind)}: ${esc(w.description)}</div>` : `<div class="hint">${esc(w.kind)}: ${esc(w.description)} — ${esc(w.endReason || w.status)}</div>`;
      const acts = !act ? '' : w.active
        ? `${k === 'vitals' ? `<button type="button" class="btn sm primary" data-do="reassess">Done</button>` : k === 'bed' ? `<button type="button" class="btn sm green" data-do="bed">Assign bed</button><button type="button" class="btn sm ghost" data-do="booking">Edit</button>` : `<button type="button" class="btn sm ghost" data-do="proc">Update</button>`} <button type="button" class="btn sm ghost" data-stop="${k}">Close</button>`
        : `<button type="button" class="btn sm ghost" data-start="${k}">${ic('plus')}Add</button>`;
      return `<div class="wfcard ${w.active ? 'on' : ''}"><div class="wfh">${ic(k === 'vitals' ? 'heart' : k === 'bed' ? 'bed' : 'syringe')}<b>${D.WF[k]}</b><span class="grow"></span>${acts}</div>${info || '<div class="hint">Not needed</div>'}</div>`;
    };
    UI.modal({
      title: `${esc(p.urn)} — ${nm(p)}${act ? '' : ' (left the area)'}`, icon: 'users', wide: true, submit: 'Save details',
      extraButtons: act ? `<button type="button" class="btn green" data-do="exit">${ic('door')}Patient leaving</button>` : `<button type="button" class="btn ghost" data-do="reopen">${ic('undo')}Undo exit</button>`,
      body: `${act ? '' : `<div class="note">${ic('door')} Left ${U.full(p.exit.time)} — ${esc(D.exitText(p.exit))} · by ${esc(p.exit.by)}</div>`}
        <h4 class="sh">Waiting for</h4><div class="g3">${D.WF_KEYS.map(wfCard).join('')}</div>
        <fieldset ${act ? '' : 'disabled'}><div class="g3">
          ${field('Name', inp('name', p.name, 'maxlength="80" required'))}
          ${field('CTAS (re-triage)', sel('ctas', D.CTAS, p.ctas), 'Upgrade if the patient deteriorates; any free monitored bed can be used.')}
          ${field('Chief complaint', inp('diagnosis', p.diagnosis, 'maxlength="120" required'))}
          ${field('Treating physician', inp('physician', p.physician === 'Unassigned' ? '' : p.physician, 'list="dl-phys" maxlength="60" placeholder="Unassigned"'))}
          ${field('Encounter number', inp('encounterId', p.encounterId, 'maxlength="24"'))}
          ${field('Change note', inp('note', '', 'maxlength="200" placeholder="Optional, e.g. re-triaged after deterioration"'))}
        </div></fieldset>
        <details class="more"><summary>History (${evs.length})</summary>
        <div class="timeline">${evs.map(e => `<div class="tl"><span class="mono">${esc(U.full(e.ts))}</span><b>${esc(e.eventType)}</b><span>${esc(e.prev)}${e.prev || e.next ? ' → ' : ''}${esc(e.next)}</span><small>${esc(e.user)} · ${esc(e.notes)}</small></div>`).join('') || '<p class="hint">No events.</p>'}</div></details>`,
      onMount: (el, form, m) => {
        if (!act) { const sb = form.querySelector('[type=submit]'); sb.hidden = true; }
        el.addEventListener('click', e => {
          const go = e.target.closest('[data-do]'), start = e.target.closest('[data-start]'), stop = e.target.closest('[data-stop]');
          if (go) { m.close(); ({ reassess: UI.reassessModal, bed: UI.bedModal, booking: UI.bookingModal, proc: UI.procModal, exit: UI.exitModal, reopen: UI.reopenModal })[go.dataset.do](id); }
          if (start) { m.close(); UI.startWfModal(id, start.dataset.start); }
          if (stop) { m.close(); UI.reasonModal(`Close ${D.WF[stop.dataset.stop]} — ${esc(p.urn)}`, 'Why is it no longer needed?', reason => run('STOP_WORKFLOW', { id, wf: stop.dataset.stop, reason, expectedVersion: p.version }, `${D.WF[stop.dataset.stop]} closed for ${p.urn}.`)); }
        });
      },
      onSubmit: async (f, d) => {
        await run('UPDATE_DETAILS', { id, expectedVersion: p.version, note: d.note, changes: { name: d.name, ctas: d.ctas, encounterId: d.encounterId, diagnosis: d.diagnosis, physician: d.physician } },
          d.ctas !== p.ctas ? `${p.urn} re-triaged ${p.ctas} → ${d.ctas}. The list re-sorts by urgency; the patient is highlighted.` : `Details updated for ${p.urn}.`);
        if (d.ctas !== p.ctas) UI.flashPatient(id, d.ctas);
      },
    });
  };

  UI.startWfModal = (id, wf) => {
    const p = fresh(id); if (!p) return;
    const body = wf === 'vitals'
      ? `${patientCard(p)}<p>Vital signs ${st().ctasIntervals[p.ctas] === 0 || p.ctas === 'CTAS 1' ? 'continuously' : st().ctasIntervals[p.ctas] ? 'every ' + st().ctasIntervals[p.ctas] + ' min' : '(no timer for this CTAS)'} for ${esc(p.ctas)}. The first set is due one interval from now.</p>`
      : wf === 'bed' ? `${patientCard(p)}${bookingFields()}` : `${patientCard(p)}${procFields()}`;
    UI.modal({ title: `Add ${D.WF[wf]} — ${esc(p.urn)}`, icon: 'plus', submit: wf === 'bed' ? 'Book bed' : 'Add', body,
      onSubmit: async (f, d) => { await run('START_WORKFLOW', Object.assign({ id, wf, expectedVersion: p.version }, d), `${D.WF[wf]} added for ${p.urn}.`); } });
  };

  // ------------------------------------------------------------------ modal: SBAR handoff
  UI.handoffModal = () => {
    const make = notes => { const t = now(); return D.sbar(S.state, st(), t, { privacy: S.device.privacy, user: S.user && S.user.name, demo: S.device.mode === 'demo', notes, window: D.handoffWindow(shiftPattern().shifts, t, offsetAt(t)) }); };
    UI.modal({
      title: 'Shift Handover (SBAR)', icon: 'clip', wide: true, submit: 'Copy handover',
      extraButtons: `<button type="button" class="btn ghost" data-print>Print</button><button type="button" class="btn ghost" data-dl>Download .txt</button>`,
      body: `<p class="hint">Built from the live board — every count and patient listed is real. ${S.device.privacy ? 'Names are shown as initials (privacy screen is on).' : 'Turn on the privacy screen to replace names with initials.'}</p>
        ${shiftToggle(k => `data-sv="${k}"`)}
        <textarea class="sbar" readonly rows="18">${esc(make(''))}</textarea>
        ${field('Outgoing nurse notes (added to the report)', `<textarea name="notes" rows="3" maxlength="1000"></textarea>`)}`,
      onMount: (el, form) => {
        const ta = $('.sbar', el);
        form.elements.notes.oninput = () => (ta.value = make(form.elements.notes.value));
        $$('[data-sv]', el).forEach(b => (b.onclick = () => {
          S.device.shiftView = b.dataset.sv; S.saveDevice();
          $$('[data-sv]', el).forEach(x => { const on = x === b; x.classList.toggle('on', on); x.setAttribute('aria-pressed', on); });
          ta.value = make(form.elements.notes.value);
          UI.renderBody();
        }));
        $('[data-print]', el).onclick = () => { const w = window.open('', '_blank'); if (!w) return UI.toast('Pop-up blocked — allow pop-ups to print.', 'warn'); w.document.write(`<pre style="font:12px/1.45 ui-monospace,Consolas,monospace;white-space:pre-wrap">${esc(ta.value)}</pre>`); w.document.close(); w.print(); };
        $('[data-dl]', el).onclick = () => U.download(`SBAR_${U.stamp()}.txt`, ta.value, 'text/plain;charset=utf-8');
      },
      onSubmit: async f => { const ok = await U.copyText($('.sbar', f).value); UI.toast(ok ? 'Shift Handoff SBAR copied to clipboard.' : 'Copy failed — select the text and press Ctrl+C.', ok ? 'success' : 'error'); return true; },
    });
  };

  // ------------------------------------------------------------------ settings
  // Job titles offered on the Staff & Access page: [title, role, shift report, Sheet access] it starts with (the Admin can change each).
  const JOB_TITLES = [
    ['ED Director', 'ED Leader', true, 'Viewer'], ['Adult ED Unit Head', 'ED Leader', true, 'Viewer'], ['Pediatric ED Unit Head', 'ED Leader', true, 'Viewer'],
    ['ED Head Nurse', 'ED Leader', true, 'Viewer'], ['Assistant Head Nurse', 'ED Leader', true, 'Viewer'], ['Nurse Educator', 'ED Leader', false, 'None'],
    ['Quality / Patient Flow Coordinator', 'ED Leader', false, 'Viewer'], ['Charge Nurse', 'Charge Nurse', false, 'None'], ['Staff Nurse', 'Nurse', false, 'None'],
    ['ED Physician', 'Physician', false, 'None'], ['Physician Team Leader', 'Physician TL', false, 'None'], ['Bed Coordinator', 'Bed Coordinator', false, 'None'],
  ];
  const ROLE_HELP = `<b>Nurse · Physician · Bed Coordinator:</b> the station workflows (admit, reassess, beds, procedures, exits).
    <b>Physician TL:</b> the same, plus the handover PDF for each 8-hour shift.
    <b>Charge Nurse:</b> the station workflows, plus the handover PDF for each 12-hour shift, analytics, audit trail, settings and reopening exits.
    <b>ED Leader:</b> the detailed view for directors, unit heads and head nurses: all of that, handover PDFs for both shift patterns, plus Excel exports and the Google Sheet.
    <b>Admin:</b> everything, plus this Staff &amp; Access page. Give it to the leaders who should manage staff with you.`;

  const isTraining = () => !!(window.PULSEED_SITE || {}).training;

  // Training copy of Staff & Access: the same page and checks as the live one, kept in this browser.
  // Nobody is shared, emailed or given access, so leaders can practise before any real staff are added.
  const practiceStaff = {
    key: 'pulseed:v2:practiceStaff', owner: 'owner@example.org', limits: { staff: 500, sheet: 100, report: 30 },
    seed: () => [
      { name: 'You (system owner)', email: 'owner@example.org', title: 'System owner', role: 'Admin', report: true, access: 'Owner', app: true, owner: true },
      { name: 'Dr. A. Director', email: 'ed.director@example.org', title: 'ED Director', role: 'ED Leader', report: true, access: 'Viewer', app: true },
      { name: 'Dr. B. Adult Head', email: 'adult.head@example.org', title: 'Adult ED Unit Head', role: 'ED Leader', report: true, access: 'Viewer', app: true },
      { name: 'Dr. C. Peds Head', email: 'peds.head@example.org', title: 'Pediatric ED Unit Head', role: 'ED Leader', report: true, access: 'Viewer', app: true },
      { name: 'D. Head Nurse', email: 'head.nurse@example.org', title: 'ED Head Nurse', role: 'Admin', report: true, access: 'Viewer', app: true },
      { name: 'E. Charge Nurse', email: 'charge.nurse@example.org', title: 'Charge Nurse', role: 'Charge Nurse', report: false, access: 'None', app: true },
      { name: 'F. Staff Nurse', email: 'staff.nurse@example.org', title: 'Staff Nurse', role: 'Nurse', report: false, access: 'None', app: true },
    ],
    async staffList() { return { owner: this.owner, roles: PE.ROLES, staff: U.ls.get(this.key) || this.seed(), limits: this.limits, practice: true }; },
    async staffSave(list) {
      const seen = {}, L = this.limits;
      list.forEach(p => {
        if (seen[p.email]) throw new D.RuleError(`${p.email} is listed twice.`);
        seen[p.email] = true;
        if (p.email === this.owner) Object.assign(p, { owner: true, role: 'Admin', access: 'Owner', app: true });
        else if (!PE.ROLES.includes(p.role)) throw new D.RuleError(`Choose a role for ${p.email}.`);
        else if (!PE.LEADER_ROLES.includes(p.role)) p.access = 'None';
      });
      if (!seen[this.owner]) list.unshift(this.seed()[0]);
      if (list.length > L.staff) throw new D.RuleError(`The staff list is limited to ${L.staff} people.`);
      const sheet = list.filter(p => p.access !== 'None').length, rep = list.filter(p => p.report).length;
      if (sheet > L.sheet) throw new D.RuleError(`${sheet} people have Sheet access; the limit is ${L.sheet}. Set nurses to None.`);
      if (rep > L.report) throw new D.RuleError(`${rep} people get the shift report; the limit is ${L.report}. Use a Google Group address for a bigger list.`);
      U.ls.set(this.key, list);
      return Object.assign(await this.staffList(), { shared: [], revoked: [] });
    },
  };

  /** Staff & Access (Admin, live register): edits the Recipients tab and shares the register in Drive to match. */
  UI.staffModal = async () => {
    const practice = isTraining();
    if (!(S.isShared() || practice) || !S.user || S.user.role !== 'Admin') return UI.toast(practice ? 'Sign in with the Admin role to practise Staff & Access.' : 'Only an Admin signed in to the live register can manage staff.', 'warn');
    const src = practice ? practiceStaff : S.adapter;
    let data;
    try { data = await src.staffList(); } catch (e) { return UI.toast(e.message, 'error'); }
    const lim = data.limits || { staff: 500, sheet: 100, report: 30 };
    const orig = {}; data.staff.forEach(p => (orig[p.email] = p));
    const opts = (list, cur) => list.map(v => `<option${v === cur ? ' selected' : ''}>${esc(v)}</option>`).join('');
    const row = (p = { role: 'Nurse', access: 'None', app: true, report: false }) => `<tr data-row ${p.owner ? 'data-owner' : ''} data-notes="${esc(p.notes || '')}">
      <td><input data-k="name" value="${esc(p.name || '')}" maxlength="80" placeholder="e.g. A. Khan" aria-label="Name"></td>
      <td><input data-k="email" type="email" value="${esc(p.email || '')}" maxlength="120" placeholder="name@gmail.com" aria-label="Google email" ${p.owner ? 'readonly' : ''}></td>
      <td><input data-k="title" list="dl-titles" value="${esc(p.title || '')}" maxlength="60" placeholder="e.g. ED Head Nurse" aria-label="Job title"></td>
      <td>${p.owner ? '<b>Admin</b> (owner)' : `<select data-k="role" aria-label="Role">${opts(data.roles, p.role)}</select>`}</td>
      <td class="c"><input type="checkbox" data-k="report" ${p.report ? 'checked' : ''} aria-label="Gets the shift report"></td>
      <td>${p.owner ? 'Owner' : `<select data-k="access" aria-label="Sheet access" ${PE.LEADER_ROLES.includes(p.role) ? '' : 'disabled'}>${opts(['Editor', 'Viewer', 'None'], PE.LEADER_ROLES.includes(p.role) ? p.access : 'None')}</select>`}</td>
      <td class="c">${p.owner ? '✓' : `<input type="checkbox" data-k="app" ${p.app !== false ? 'checked' : ''} aria-label="Can sign in to PulseED">`}</td>
      <td class="r">${p.owner ? '' : `<button type="button" class="btn sm ghost" data-del title="Remove">${ic('x')}</button>`}</td></tr>`;
    let confirmed = false;
    UI.modal({
      title: 'Staff &amp; Access', icon: 'users', wide: true, submit: 'Save &amp; share',
      body: `${practice ? `<p class="note">${ic('shield')} <b>Practice copy (training)</b>: works exactly like the real page, but nothing is shared, emailed or given access. The emails below are examples.</p>` : ''}<p class="hint">Who can sign in to PulseED, what they can do, who gets the shift report by email, and who can open the PulseED Register in Google Drive. Each person signs in with the Google email entered here. Saving shares the register to match and removes Drive access from anyone taken off the list or set to None.</p>
        <details class="rolehelp"><summary>What each role can do</summary><p class="hint">${ROLE_HELP}</p>
          <p class="hint"><b>Sheet access</b> is for ED Leaders and Admins only; everyone else works in PulseED. <b>Shift report</b> is limited to ${lim.report} people (Gmail's daily limit); for a bigger list, enter a Google Group address as one person.</p></details>
        <datalist id="dl-titles">${JOB_TITLES.map(t => `<option value="${esc(t[0])}">`).join('')}</datalist>
        <div class="row wrap"><input type="search" data-q placeholder="Search name, email, title or role…" aria-label="Search staff" class="grow">
          <button type="button" class="btn ghost" data-add>${ic('plus')}Add person</button>
          <button type="button" class="btn ghost" data-bulk>${ic('users')}Add many (paste a list)</button></div>
        <div class="bulk" data-bulkbox hidden>
          ${field('Paste one person per line: name and Google email, separated by a comma or tab (copy two columns straight from Excel)', '<textarea data-paste rows="6" placeholder="Aisha Khan, aisha.khan@gmail.com&#10;Omar Ali&#9;omar.ali@hospital.org"></textarea>')}
          <div class="row wrap">${field('Job title for all of them', `<input data-btitle list="dl-titles" value="Staff Nurse" maxlength="60">`)}
            <button type="button" class="btn primary" data-badd>${ic('plus')}Add to the list</button><small class="hint" data-bmsg></small></div></div>
        <div class="tw staffwrap"><table class="staff"><thead><tr><th>Name (as on badge)</th><th>Google email</th><th>Job title</th><th>Role</th><th class="c">Shift report</th><th>Sheet access</th><th class="c">Can sign in</th><th></th></tr></thead>
        <tbody>${data.staff.map(row).join('')}</tbody></table></div>
        <p class="hint" data-count></p>`,
      onMount: el => {
        const body = $('tbody', el);
        const count = () => {
          const rows = $$('[data-row]', el), n = sel => rows.filter(sel).length;
          const rep = n(tr => $('[data-k="report"]', tr).checked), sh = n(tr => tr.hasAttribute('data-owner') || /Editor|Viewer/.test($('[data-k="access"]', tr).value));
          const lead = n(tr => tr.hasAttribute('data-owner') || /ED Leader|Admin/.test($('[data-k="role"]', tr).value));
          const over = (v, max) => (v > max ? ` <b class="tred">(limit ${max})</b>` : ` <span>of ${max}</span>`);
          $('[data-count]', el).innerHTML = `<b>${rows.length}</b> people${over(rows.length, lim.staff)} · ${lead} leaders / admins · ${rep} get the shift report${over(rep, lim.report)} · ${sh} with Sheet access${over(sh, lim.sheet)}`;
        };
        const touched = () => { count(); confirmed = false; };
        $('[data-add]', el).onclick = () => { body.insertAdjacentHTML('afterbegin', row()); touched(); $('tr:first-child input', body).focus(); };
        $('[data-bulk]', el).onclick = () => { const b = $('[data-bulkbox]', el); b.hidden = !b.hidden; if (!b.hidden) $('[data-paste]', el).focus(); };
        $('[data-badd]', el).onclick = () => {
          const title = U.norm($('[data-btitle]', el).value), preset = JOB_TITLES.find(t => t[0] === title) || [title, 'Nurse', false, 'None'];
          const have = new Set($$('[data-k="email"]', el).map(x => x.value.trim().toLowerCase()));
          let added = 0, skipped = 0, bad = [];
          U.lines($('[data-paste]', el).value).forEach(line => {
            const m = line.match(/[^\s,;<>"]+@[^\s,;<>"]+\.[^\s,;<>"]+/);
            if (!m) { bad.push(line); return; }
            const email = m[0].toLowerCase(), name = U.norm(line.replace(m[0], ' ').replace(/[<>"]/g, ' ').replace(/[\t,;]+/g, ' '));
            if (have.has(email)) { skipped++; return; }
            have.add(email); added++;
            body.insertAdjacentHTML('afterbegin', row({ name, email, title, role: preset[1], report: preset[2], access: preset[3], app: true }));
          });
          $('[data-paste]', el).value = bad.join('\n');
          $('[data-bmsg]', el).textContent = `Added ${added}.${skipped ? ` ${skipped} already on the list.` : ''}${bad.length ? ` ${bad.length} line(s) without an email are left in the box.` : ''} Click "Save & share" to finish.`;
          touched();
        };
        // Enter in the search or title box must not submit (and share) the whole list.
        el.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.matches('input')) e.preventDefault(); });
        $('[data-q]', el).oninput = e => {
          const q = U.key(e.target.value);
          $$('[data-row]', el).forEach(tr => { tr.hidden = !!q && !$$('input,select', tr).some(x => U.key(x.value).includes(q)); });
        };
        body.addEventListener('click', e => { const b = e.target.closest('[data-del]'); if (b) { b.closest('tr').remove(); touched(); } });
        body.addEventListener('change', e => {
          // Picking a known job title fills in its usual role, report and Sheet access.
          const t = e.target.closest('[data-k="title"]'), tr = e.target.closest('tr');
          const preset = t && JOB_TITLES.find(x => x[0] === U.norm(t.value));
          if (preset && !tr.hasAttribute('data-owner')) { $('[data-k="role"]', tr).value = preset[1]; $('[data-k="report"]', tr).checked = preset[2]; $('[data-k="access"]', tr).value = preset[3]; }
          // The Google Sheet is for ED Leaders and Admins only.
          const role = $('[data-k="role"]', tr), access = $('[data-k="access"]', tr);
          if (role && access) { const lead = PE.LEADER_ROLES.includes(role.value); access.disabled = !lead; if (!lead) access.value = 'None'; }
          touched();
        });
        count();
      },
      onSubmit: async (form, d, m) => {
        const val = (tr, k) => { const x = $(`[data-k="${k}"]`, tr); return !x ? null : x.type === 'checkbox' ? x.checked : U.norm(x.value); };
        const staff = $$('[data-row]', form).map(tr => ({ name: val(tr, 'name'), email: (val(tr, 'email') || '').toLowerCase(), title: val(tr, 'title') || '', role: val(tr, 'role') || 'Admin', report: val(tr, 'report'), access: val(tr, 'access') || 'Owner', app: tr.hasAttribute('data-owner') ? true : val(tr, 'app'), notes: tr.dataset.notes || '' }))
          .filter(p => p.name || p.email);
        staff.forEach((p, i) => {
          if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(p.email)) throw new D.RuleError(`${p.name || 'Row ' + (i + 1)}: enter the person's Google email.`);
          if (p.name.length < 2) throw new D.RuleError(`Enter a name for ${p.email}. It is recorded on every action.`);
        });
        const keep = new Set(staff.map(p => p.email));
        const removed = Object.keys(orig).filter(e => !keep.has(e));
        const cut = staff.filter(p => orig[p.email] && orig[p.email].access !== 'None' && p.access === 'None').map(p => p.email);
        if ((removed.length || cut.length) && !confirmed) {
          confirmed = true;
          m.showError(`This takes away access for ${[...removed, ...cut].join(', ')}. Click "Save & share" again to confirm.`);
          return true;
        }
        const r = await src.staffSave(staff);
        if (practice) return UI.toast(`Practice list saved: ${r.staff.length} people. This is training, so nobody was shared, emailed or given access.`, 'success');
        await S.reload();
        const notes = [...(r.shared || []), ...(r.revoked || [])];
        UI.toast(`Staff list saved: ${r.staff.length} people.${notes.length ? ' ' + notes.join(' · ') : ''}`, 'success');
      },
    });
  };

  UI.settingsForm = () => {
    const s = st(), sup = D.isSupervisor(S.user);
    const num = (name, val, min, max, label, hint) => field(label, `<input type="number" name="${name}" value="${esc(val)}" min="${min}" max="${max}" step="1" required>`, hint);
    const admin = (S.isShared() || isTraining()) && S.user && S.user.role === 'Admin';
    return `${admin ? `<section class="panel"><h3>Staff &amp; Access${isTraining() ? ' <span class="pill amber">practice</span>' : ''}</h3>
        ${isTraining() ? '<p class="note">Training copy: try adding people, roles and job titles here. Nothing is shared, emailed or given access; the real page is in the live system.</p>' : ''}
        <p class="hint">Add nurses, physicians and ED leaders (ED Director, unit heads, head nurse), set their job title and role, choose who gets the shift report, and share the PulseED Register with leaders. Paste a whole list at once for large teams. Only Admins see this; make other leaders Admin to share the work.</p>
        <div class="row"><button type="button" class="btn primary" data-act="staff">${ic('users')}Manage staff &amp; access</button></div></section>` : ''}
    <form id="setForm" class="settings" novalidate>
      ${sup ? '' : `<div class="note">${ic('lock')} Read-only — sign in as a Charge Nurse, ED Leader or Admin to change department settings.</div>`}
      <fieldset ${sup ? '' : 'disabled'}>
      <section class="panel"><h3>Department</h3><div class="g3">
        ${field('Department / site name', inp('siteName', s.siteName, 'maxlength="60" required'))}
        ${field('Default station name', inp('stationName', s.stationName, 'maxlength="40"'))}
      </div></section>
      <section class="panel"><h3>Vital signs timing (CTAS)</h3><p class="hint">CTAS 1 is always continuous observation and raises a safety alert.</p><div class="g4">
        ${['CTAS 2', 'CTAS 3', 'CTAS 4', 'CTAS 5'].map(c => num('iv_' + c.slice(-1), s.ctasIntervals[c], 1, 480, `${c} interval (min)`)).join('')}
        ${num('dueSoonMaxMin', s.dueSoonMaxMin, 1, 60, '"Due soon" max window (min)')}
        ${num('dueSoonPct', Math.round(s.dueSoonFraction * 100), 5, 90, '"Due soon" as % of interval', 'Window = smaller of the two.')}
        ${num('backdateMaxMin', s.backdateMaxMin, 0, 720, 'Max back-dating (min)')}
        ${num('complianceTargetPct', s.complianceTargetPct, 1, 100, 'Compliance target (%)')}
      </div></section>
      <section class="panel"><h3>Wait-time thresholds &amp; alerts</h3><div class="g4">
        ${num('bedWaitAmberMin', s.bedWaitAmberMin, 1, 1440, 'Bed wait amber (min)', 'From the booking time')}${num('bedWaitRedMin', s.bedWaitRedMin, 1, 1440, 'Bed wait red (min)', 'Shown as an alert')}
        ${num('procWaitAmberMin', s.procWaitAmberMin, 1, 1440, 'Procedure / imaging amber (min)')}${num('procWaitRedMin', s.procWaitRedMin, 1, 1440, 'Procedure / imaging red (min)')}
        ${num('chimeRepeatMin', s.chimeRepeatMin, 1, 30, 'Repeat overdue chime every (min)')}${num('autoLockMin', s.autoLockMin, 0, 240, 'Auto-lock after inactivity (min)', '0 = never (not recommended)')}
        ${num('exitedRetentionHours', s.exitedRetentionHours, 24, 2160, 'Keep exited patients (h)')}${num('eventRetentionHours', s.eventRetentionHours, 24, 8760, 'Keep audit events on this PC (h)')}
      </div></section>
      <section class="panel"><h3>Lists</h3><p class="hint">One entry per line. These are suggestions; staff can always type something else.</p><div class="g4">
        ${field('Physicians', `<textarea name="physicians" rows="6" placeholder="One name per line">${esc((s.physicians || []).join('\n'))}</textarea>`, 'Offered when assigning or changing a physician. Any other name can still be typed.')}
        ${field('ED teams', `<textarea name="teams" rows="6">${esc(s.teams.join('\n'))}</textarea>`)}
        ${field('Specialties', `<textarea name="specialties" rows="6">${esc(s.specialties.join('\n'))}</textarea>`)}
        ${field('Procedures / treatments / imaging', `<textarea name="procedures" rows="6">${esc(s.procedures.join('\n'))}</textarea>`)}
        ${field('Beds (offered when assigning)', `<textarea name="beds" rows="6">${esc(s.beds.join('\n'))}</textarea>`)}
      </div></section>
      <section class="panel"><h3>PatientFlow MS register (all workstations)</h3>
        <p class="hint">${S.isShared()
          ? `Connected to the shared PulseED register (Google Sheet owned by the system owner). Admins manage staff above under Staff &amp; Access; report times are in that Sheet’s Settings tab. Status: <b>${esc(S.adapter.status().label)}</b>.`
          : 'This station keeps data in this browser only. The shared, multi-workstation register is used automatically at adultpulseed.patientflowms.com (configured in <code>js/site-config.js</code>).'}</p>
      </section>
      <div class="row end"><button type="submit" class="btn primary">${ic('check')}Save department settings</button></div>
      </fieldset>
    </form>
    <section class="panel"><h3>This station</h3><div class="row wrap">
      <button class="btn ghost" data-act="rename">${ic('edit')}Rename station</button>
      <button class="btn ghost" data-act="privacy">${ic('eyeoff')}Toggle privacy screen</button>
      <button class="btn ghost" data-act="theme">${ic('moon')}Toggle night mode</button>
      <button class="btn ghost" data-act="testchime">${ic('bell')}Test alert sound</button>
    </div></section>
    <section class="panel"><h3>Data</h3><p class="hint">Mode: <b>${S.device.mode === 'demo' ? 'Training / Demo' : 'Live'}</b> · ${Object.keys(S.state.patients).length} patient records · ${S.state.events.length} audit events · storage: ${esc(S.adapter.status().label)}</p><div class="row wrap">
      ${D.isLeader(S.user) ? `<button class="btn ghost" data-act="x-backup">${ic('download')}Export full backup</button>` : ''}
      <button class="btn ghost" data-act="import">${ic('upload')}Restore backup…</button>
      <button class="btn ghost" data-act="switchmode">${ic('shield')}Switch to ${S.device.mode === 'demo' ? 'live' : 'training / demo'} mode</button>
      ${S.device.mode === 'demo' ? `<button class="btn ghost" data-act="reseed">${ic('undo')}Reset demo data</button>` : ''}
      <button class="btn red" data-act="wipe">${ic('x')}Erase all ${S.device.mode === 'demo' ? 'demo' : 'live'} data on this PC</button>
    </div></section>`;
  };

  UI.bindSettings = () => {
    const f = $('#setForm'); if (!f) return;
    f.onsubmit = async e => {
      e.preventDefault();
      const d = Object.fromEntries(new FormData(f).entries());
      try {
        const n = k => { const v = Number(d[k]); if (!Number.isFinite(v)) throw new D.RuleError(`Invalid number: ${k}`); return Math.round(v); };
        const next = U.clone(st());
        next.siteName = U.norm(d.siteName) || 'Emergency Department';
        next.stationName = U.norm(d.stationName) || 'Reassessment Area';
        ['2', '3', '4', '5'].forEach(c => { const v = n('iv_' + c); if (v < 1 || v > 480) throw new D.RuleError(`CTAS ${c} interval must be 1–480 min.`); next.ctasIntervals['CTAS ' + c] = v; });
        ['dueSoonMaxMin', 'backdateMaxMin', 'complianceTargetPct', 'bedWaitAmberMin', 'bedWaitRedMin', 'procWaitAmberMin', 'procWaitRedMin', 'chimeRepeatMin', 'autoLockMin', 'exitedRetentionHours', 'eventRetentionHours'].forEach(k => (next[k] = n(k)));
        next.physicians = U.uniq(U.lines(d.physicians));
        next.dueSoonFraction = n('dueSoonPct') / 100;
        if (next.bedWaitAmberMin >= next.bedWaitRedMin || next.procWaitAmberMin >= next.procWaitRedMin) throw new D.RuleError('Amber thresholds must be lower than red thresholds.');
        ['teams', 'specialties', 'procedures', 'beds'].forEach(k => { const l = U.uniq(U.lines(d[k])); if (!l.length) throw new D.RuleError(`The ${k} list cannot be empty.`); next[k] = l; });
        await S.saveSettings(next);
        UI._forceSettings = true; UI.refresh();
        UI.toast(S.isShared() ? 'Department settings saved for every station.' : 'Department settings saved.');
      } catch (ex) { UI.toast(ex.message, 'error'); }
    };
  };

  // ------------------------------------------------------------------ exports
  const dn = (p, deid) => (deid ? U.initials(p.name) : p.name);
  // Exports are part of the audit trail (who took patient data off the system, and when).
  const logExport = what => S.logExport(what, UI.vs.deid !== false);
  UI.exportCsv = kind => {
    const deid = UI.vs.deid !== false;
    const all = Object.values(S.state.patients);
    const f = U.full;
    const eps = key => { const out = []; all.forEach(p => { (p.pastEpisodes || []).filter(e => e.wf === key).forEach(e => out.push([p, e])); const w = p.workflows[key]; if (w && (w.startTime || w.bookedAt || w.requestTime)) out.push([p, w]); }); return out; };
    let name, csv;
    if (kind === 'x-master') { name = 'Patients'; csv = U.csv(['MRN', 'Encounter', 'Name', 'CTAS', 'ChiefComplaint', 'Physician', 'Team', 'Status', 'AddedAt', 'AddedBy', 'Exit', 'ExitReason', 'ExitTime', 'Bed', 'ExitBy', 'MinsInArea'],
      all.map(p => [p.urn, p.encounterId, dn(p, deid), p.ctas, p.diagnosis, p.physician, p.team, p.status === 'active' ? 'In the area' : 'Left', f(p.createdAt), p.createdBy, p.exit ? p.exit.label : '', p.exit ? p.exit.reason : '', p.exit ? f(p.exit.time) : '', p.exit ? p.exit.bed || '' : '', p.exit ? p.exit.by : '', U.minsBetween(p.createdAt, p.exit ? p.exit.time : now())])); }
    if (kind === 'x-vitals') { name = 'Vital_Signs'; csv = U.csv(['MRN', 'Encounter', 'Name', 'CTAS', 'StartTime', 'LastReassessment', 'ReassessmentCount', 'ReassessmentTimes', 'Active', 'EndTime', 'EndReason'], eps('vitals').map(([p, v]) => [p.urn, p.encounterId, dn(p, deid), v.ctas || p.ctas, f(v.startTime), f(v.lastReassessment), (v.reassessments || []).length, (v.reassessments || []).map(U.t24).join(' '), v.active, f(v.endTime), v.endReason])); }
    if (kind === 'x-bed') { name = 'Bed_Bookings'; csv = U.csv(['MRN', 'Encounter', 'Name', 'ChiefComplaint', 'BookedBy', 'Specialty', 'BookedAt', 'BedAssigned', 'AssignedAt', 'MinsBookedToAssigned', 'Open', 'EndReason'], eps('bed').map(([p, b]) => [p.urn, p.encounterId, dn(p, deid), p.diagnosis, b.bookedBy, b.specialty, f(b.bookedAt), b.assignedBed, f(b.assignedAt), b.assignedAt ? U.minsBetween(b.bookedAt, b.assignedAt) : '', b.active, b.endReason])); }
    if (kind === 'x-proc') { name = 'Procedure_Imaging'; csv = U.csv(['MRN', 'Encounter', 'Name', 'Type', 'Request', 'Status', 'RequestedAt', 'DoneAt', 'MinsToDone', 'Open', 'EndReason'], eps('procedure').map(([p, r]) => [p.urn, p.encounterId, dn(p, deid), r.kind, r.description, r.status, f(r.requestTime), f(r.completionTime), r.completionTime ? U.minsBetween(r.requestTime, r.completionTime) : '', r.active, r.endReason])); }
    if (kind === 'x-audit') { name = 'Event_Audit_Trail'; const pm = S.state.patients; csv = U.csv(['EventID', 'Timestamp', 'TimestampUTC', 'MRN', 'Encounter', 'Workflow', 'EventType', 'PreviousStatus', 'NewStatus', 'User', 'Role', 'Station', 'Notes', 'Checksum'], S.state.events.map(e => [e.id, f(e.ts), e.ts, e.urn, e.encounterId, e.workflow, e.eventType, e.prev, e.next, e.user, e.role, e.device, deid && pm[e.patientId] ? e.notes.split(pm[e.patientId].name).join(U.initials(pm[e.patientId].name)) : e.notes, e.hash])); }
    U.download(`PulseED_${name}_${S.device.mode === 'demo' ? 'DEMO_' : ''}${U.stamp()}.csv`, csv);
    logExport(name + '.csv');
    UI.toast(`${name.replace(/_/g, ' ')} spreadsheet downloaded.`);
  };
  UI.exportBackup = () => {
    U.download(`PulseED_Backup_${S.device.mode === 'demo' ? 'DEMO_' : ''}${U.stamp()}.json`, JSON.stringify({ app: 'PulseED', version: PE.VERSION, mode: S.device.mode, exportedAt: U.iso(Date.now()), settings: S.settings, state: S.state }, null, 1), 'application/json');
    logExport('Full backup .json');
    UI.toast('Full backup downloaded. It contains identifiable patient data — store it securely.', 'warn');
  };

  // ------------------------------------------------------------------ click dispatcher
  const needUser = fn => (...a) => { if (!S.user) { UI.signInModal(); return; } fn(...a); };
  const needLeader = fn => needUser((...a) => { if (!D.isLeader(S.user)) return UI.toast('Spreadsheet exports are for ED Leaders and Admins.', 'warn'); fn(...a); });
  const ACT = {
    nav: id => UI.go(id),
    alerttoggle: id => { UI.alertOpen = UI.alertOpen === id ? null : id; UI.renderChrome(); },
    open: needUser(UI.patientModal),
    reassess: needUser(UI.reassessModal),
    bed: needUser(UI.bedModal),
    proc: needUser(UI.procModal),
    exit: needUser(id => UI.exitModal(id)),
    reopen: needUser(UI.reopenModal),
    booking: needUser(UI.bookingModal),
    new: needUser(UI.newPatientModal),
    handoff: needUser(UI.handoffModal),
    shiftpdf: needUser(id => UI.shiftPdf(id)),
    shiftview: id => { S.device.shiftView = id === 'nursing' ? 'nursing' : 'doctor'; S.saveDevice(); UI.refresh(); },
    staff: needUser(UI.staffModal),
    privacy: () => { S.device.privacy = !S.device.privacy; S.saveDevice(); UI.refresh(); },
    sound: () => { S.device.sound = !S.device.sound; S.saveDevice(); if (S.device.sound && PE.audio) PE.audio.chime('test'); UI.renderChrome(); UI.toast(S.device.sound ? 'Audio alerts on.' : 'Audio alerts muted on this station. Visual alerts continue.', S.device.sound ? 'success' : 'warn'); },
    theme: () => { S.device.theme = S.device.theme === 'dark' ? 'light' : 'dark'; S.saveDevice(); UI.applyTheme(); UI.renderChrome(); },
    lock: () => {
      S.setUser(null);
      if (S.isShared()) { S.adapter.setToken(null); try { google.accounts.id.disableAutoSelect(); } catch (e) { /* not loaded */ } }
      UI.closeAll(); UI.refresh(); UI.signInModal('locked');
    },
    testchime: () => PE.audio && PE.audio.chime('overdue'),
    rename: () => UI.modal({ title: 'Rename station', icon: 'edit', body: field('Station name', inp('n', S.device.deviceName, 'maxlength="40" autofocus')), onSubmit: async (f, d) => { S.device.deviceName = U.norm(d.n); S.saveDevice(); UI.renderChrome(); } }),
    verify: () => {
      const r = D.verifyChain(S.state);
      r.ok ? UI.toast(`Audit trail intact — ${r.checked} events verified.`) : UI.toast(`AUDIT TRAIL ALTERED at event ${r.checked + 1} (${U.full(r.brokenAt.ts)} · ${r.brokenAt.eventType}). Inform the department lead.`, 'error');
    },
    'x-master': needLeader(UI.exportCsv), 'x-vitals': needLeader(UI.exportCsv), 'x-bed': needLeader(UI.exportCsv), 'x-proc': needLeader(UI.exportCsv), 'x-audit': needLeader(UI.exportCsv),
    'x-backup': needLeader(UI.exportBackup),
    import: needUser(() => {
      if (!D.isSupervisor(S.user)) return UI.toast('Only a Charge Nurse or Admin can restore a backup.', 'error');
      const i = Object.assign(document.createElement('input'), { type: 'file', accept: '.json,application/json' });
      i.onchange = () => {
        const file = i.files[0]; if (!file) return;
        file.text().then(txt => {
          let b; try { b = JSON.parse(txt); } catch (e) { return UI.toast('That file is not valid JSON.', 'error'); }
          if (!b || b.app !== 'PulseED') return UI.toast('That file is not a PulseED backup.', 'error');
          if (b.mode !== S.device.mode) return UI.toast(`That backup is from ${b.mode} mode; switch to ${b.mode} mode to restore it.`, 'error');
          UI.modal({ title: 'Restore backup?', icon: 'upload', danger: true, submit: 'Replace current data',
            body: `<p>Backup from <b>${esc(U.full(b.exportedAt))}</b> with ${Object.keys(b.state.patients || {}).length} patients and ${(b.state.events || []).length} events will <b>replace</b> all current ${esc(S.device.mode)} data on this PC.</p>`,
            onSubmit: async () => { await S.replaceState(b.state); UI.refresh(); UI.toast('Backup restored.'); } });
        });
      };
      i.click();
    }),
    switchmode: () => {
      const site = window.PULSEED_SITE || {};
      // On patientflowms.com the mode is chosen by the address: the plain URL is live, ?training is the training copy.
      if (site.training || site.forceLive) return UI.modal({ title: site.training ? 'Leave training' : 'Open training', icon: 'shield', submit: site.training ? 'Open live PulseED' : 'Open training',
        body: site.training ? '<p>Open the live PulseED station? Training patients stay on this PC only and never reach the live register.</p>'
          : '<p>Open the training copy of PulseED in this tab? It uses synthetic patients only and never touches the live register. You will sign in again when you come back.</p>',
        onSubmit: async () => { location.href = location.pathname + (site.training ? '' : '?training'); } });
      return UI.modal({ title: 'Switch mode', icon: 'shield', submit: 'Switch',
      body: `<p>Switch this station to <b>${S.device.mode === 'demo' ? 'Live' : 'Training / Demo'}</b> mode? The two modes have separate data; nothing is deleted.</p>`,
      onSubmit: async () => { S.device.mode = S.device.mode === 'demo' ? 'live' : 'demo'; S.saveDevice(); location.reload(); } });
    },
    reseed: () => UI.modal({ title: 'Reset demo data', icon: 'undo', submit: 'Reset', body: '<p>Replace all demo data with a fresh synthetic data set?</p>',
      onSubmit: async () => { await S.adapter.replace(PE.demo.build(S.settings).state); await S.reload(); UI.toast('Demo data reset.'); } }),
    wipe: needUser(() => {
      if (!D.isSupervisor(S.user)) return UI.toast('Only a Charge Nurse or Admin can erase data.', 'error');
      UI.modal({ title: 'Erase all data on this PC', icon: 'alert', tone: 'danger', danger: true, submit: 'Erase permanently',
        body: `<p>This permanently deletes every ${esc(S.device.mode)} patient and audit event stored in this browser. Export a backup first.</p>${field('Type ERASE to confirm', inp('c', '', 'autocomplete="off" autofocus'))}`,
        onSubmit: async (f, d) => { if (d.c !== 'ERASE') throw new D.RuleError('Type ERASE in capitals to confirm.'); await S.wipe(); UI.refresh(); UI.toast('All data on this PC erased.', 'warn'); } });
    }),
  };
  function onClick(e) {
    const el = e.target.closest('[data-act]');
    // Any click outside the alert chips closes an open alert list (a patient link inside it also opens that patient).
    if (UI.alertOpen && !e.target.closest('.achip, .apoph')) { UI.alertOpen = null; UI.renderChrome(); }
    if (!el) return;
    const fn = ACT[el.dataset.act];
    if (!fn) return;
    e.preventDefault();
    try { el.dataset.act.startsWith('x-') ? fn(el.dataset.act) : fn(el.dataset.id, el); } catch (ex) { UI.toast(ex.message, 'error'); }
  }
})(window.PulseED);
