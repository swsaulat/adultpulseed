/* PulseED Reassessment Area Management System — domain model: workflow rules, state transitions, timing and metrics.
 * Pure functions only (no DOM, no storage) so every rule can be unit-tested in tests/tests.html.
 *
 * The model is deliberately small. A patient waits in the reassessment area for one or more of three things, all at once if needed:
 *   Vital signs monitoring · a bed · one or more orders (procedure / treatment / radiology imaging).
 * The bed has two steps: a bed is ASSIGNED (the patient stays in the area, waiting to be moved), then the patient is PLACED on it.
 * The patient leaves PulseED when placed on a bed, when discharged (with the reason: home, DAMA, absconded, LWBS, …)
 * or when the entry was a mistake. Nothing is tracked after that: the patient's care continues in the hospital system.
 * Notes have a type; "CNR" (called, not around) flags the patient on the dashboard so staff call again before the next vital signs. */
(function (PE) {
  'use strict';
  const U = PE.util;
  const D = (PE.domain = {});

  D.WF = { vitals: 'Vital Signs Monitoring', bed: 'Waiting for Bed', procedure: 'Procedure / Treatment / Imaging' };
  D.WF_SHORT = { vitals: 'Vitals', bed: 'Bed', procedure: 'Procedure / Imaging' };
  D.WF_KEYS = ['vitals', 'bed', 'procedure'];
  D.CTAS = ['CTAS 1', 'CTAS 2', 'CTAS 3', 'CTAS 4', 'CTAS 5', 'Other'];
  D.PROC_KINDS = ['Procedure', 'Treatment', 'Radiology Imaging'];
  D.PROC_STATUS = ['Waiting', 'In Progress', 'Done', 'Cancelled'];
  D.PROC_TERMINAL = ['Done', 'Cancelled', 'Closed at exit'];
  D.EXIT_TYPES = { bed: 'Placed on bed', discharged: 'Discharged', error: 'Entered in error' };
  /** Note types. CNR = called, not around: the patient was called (e.g. for vital signs) but was not in the waiting area. */
  /** Vital signs not taken because the patient is away for a known reason (not CNR): shown on the dashboard until the patient is back. */
  D.AWAY_REASONS = ['Sent to clinic', 'Gone for procedure / imaging', 'Other'];
  /** Why an order is waiting (noted beside Start / Done / Cancel). */
  D.DELAY_REASONS = ['Blood test result', 'Contrast', 'Consent', 'Other'];
  D.NOTE_TYPES = { cnr: 'CNR — called, not around', away: 'Away from the area', nursing: 'Nursing note', refused: 'Patient refused', escalated: 'Escalated to physician',
    medication: 'Medication given', pain: 'Pain reassessed', family: 'Family / social', other: 'Other' };
  /** Quick picks for the discharge reason. Staff can also type any other reason. */
  D.DISCHARGE_REASONS = ['Discharged home', 'DAMA', 'Absconded', 'LWBS', 'Transferred'];
  D.EXIT_NEEDS_REASON = ['discharged', 'error'];

  class RuleError extends Error { constructor(msg, code) { super(msg); this.code = code || 'RULE'; } }
  D.RuleError = RuleError;
  const fail = (msg, code) => { throw new RuleError(msg, code); };

  D.emptyState = () => ({ schema: 4, rev: 0, patients: {}, events: [], chainAnchor: '0000000000000000', updatedAt: null });

  D.isSupervisor = user => !!user && PE.SUPERVISOR_ROLES.includes(user.role);
  D.isLeader = user => !!user && PE.LEADER_ROLES.includes(user.role);
  D.activePatients = state => Object.values(state.patients).filter(p => p.status === 'active');
  /** When the patient left PulseED. */
  D.leftAt = p => (p.exit ? p.exit.time : null);
  D.activeWfs = p => D.WF_KEYS.filter(k => p.workflows[k] && p.workflows[k].active);
  const isOpen = it => !D.PROC_TERMINAL.includes(it.status);
  D.isOpenOrder = isOpen;
  /** Orders (procedure / treatment / imaging) still waiting or in progress. */
  D.openOrders = p => ((p.workflows.procedure && p.workflows.procedure.items) || []).filter(isOpen);
  D.orderText = it => `${it.kind}: ${it.description}`;
  /** "Discharged — DAMA", "Placed on bed — Bed 12". */
  D.exitText = x => (!x ? '' : x.type === 'bed' ? `Placed on bed — ${x.bed}` : x.type === 'discharged' ? `Discharged — ${x.reason}` : `Entered in error — ${x.reason}`);

  /**
   * Records saved by earlier versions are read in the current shape so nothing is lost or shown wrongly:
   * v1/v2 (the detailed version: ED beds, front areas, bed allocation) → v3 (one procedure, bed assigned = left)
   * → v4 (several orders, two-step bed, notes and CNR). Idempotent: an up-to-date record is returned unchanged.
   * Order ids are derived from the patient id, so every station and the server upgrade a record to the same ids.
   */
  D.upgradePatient = p => {
    if (!p || !p.workflows || p.schemaV === 4) return p;
    if (p.schemaV !== 3) upgradeV3(p);
    const oldProc = (p.pastEpisodes || []).filter(e => e.wf === 'procedure');
    const ordersFrom = r => {
      const items = [];
      oldProc.concat(r && r.requestTime ? [r] : []).forEach(e => {
        if (!e.requestTime) return;
        items.push({ id: `${p.id}:o${items.length + 1}`, kind: e.kind || 'Procedure', description: e.description || e.plannedProcedure || '—', status: e.status || 'Waiting', requestTime: e.requestTime,
          startedAt: null, completionTime: e.completionTime || null, endTime: e.endTime || null, endReason: e.endReason || null, by: '' });
      });
      return { active: !!(r && r.active) && items.some(isOpen), startTime: items.length ? items[0].requestTime : null, items, endTime: (r && r.endTime) || null, endReason: (r && r.endReason) || null };
    };
    const wfV4 = w => {
      if (!w) return;
      if (w.procedure && !Array.isArray(w.procedure.items)) w.procedure = ordersFrom(w.procedure);
      const b = w.bed;
      if (b && !('placedAt' in b)) { b.placedAt = b.assignedAt || null; b.assignedBy = b.assignedBy || null; }
    };
    if (p.exit && p.exit.snapshot) { if (p.schemaV !== 3) upgradeV3({ workflows: p.exit.snapshot }); wfV4(p.exit.snapshot); }
    wfV4(p.workflows);
    if (oldProc.length) p.pastEpisodes = p.pastEpisodes.filter(e => e.wf !== 'procedure');
    p.notes = p.notes || [];
    p.cnr = p.cnr || null;
    p.schemaV = 4;
    return p;
  };
  function upgradeV3(p) {
    const b = p.workflows.bed || {}, r = p.workflows.procedure || {};
    if (!('bookedAt' in b)) {
      p.workflows.bed = { active: !!b.active, bookedAt: b.addedTime || null, bookedBy: b.addedTime ? (b.bookedBy || 'Not recorded') : null, specialty: b.intendedSpecialty || '',
        assignedBed: b.physicallyPlaced ? b.allocatedBed : null, assignedAt: b.physicallyPlaced ? b.placementTime : null, endTime: b.endTime || null, endReason: b.endReason || null };
    }
    if (!('kind' in r)) {
      const st = { Awaiting: 'Waiting', Ready: 'Waiting', Deferred: 'Waiting', 'In Progress': 'In Progress', Done: 'Done', Cancelled: 'Cancelled' }[r.status] || r.status || null;
      p.workflows.procedure = { active: !!r.active, kind: r.requestTime ? 'Procedure' : null, description: r.plannedProcedure || null, status: st,
        requestTime: r.requestTime || null, completionTime: r.completionTime || null, endTime: r.endTime || null, endReason: r.endReason || null };
    }
    const old = { placed: ['bed', ''], direct: ['bed', 'Sent directly to ward / unit'], discharged: ['discharged', 'Discharged home'], lwbs: ['discharged', 'LWBS'],
      dama: ['discharged', 'DAMA'], transferred: ['discharged', 'Transferred'], deceased: ['discharged', 'Deceased'], error: ['error', ''] };
    if (p.exit && old[p.exit.type]) {
      const [type, why] = old[p.exit.type];
      p.exit = Object.assign({}, p.exit, { type, label: D.EXIT_TYPES[type], reason: type === 'bed' ? p.exit.reason || '' : p.exit.reason || why, bed: type === 'bed' ? p.exit.bed || (p.ed && p.ed.bed) || '' : null });
    }
    if (p.status === 'inED') p.status = 'exited'; // was on an ED bed: in this system that means the bed was assigned
    delete p.front; delete p.ed; delete p.release;
  }

  // ------------------------------------------------------------------ timing

  /** Reassessment timing for the vitals workflow. */
  D.vitalsTiming = (p, settings, now = Date.now()) => {
    const v = p.workflows.vitals;
    if (!v || !v.active) return { state: 'inactive', rank: 9 };
    const iv = settings.ctasIntervals[p.ctas];
    if (p.ctas === 'CTAS 1' || iv === 0) return { state: 'continuous', rank: 0, label: 'Continuous' };
    if (!(iv > 0)) return { state: 'noTarget', rank: 5, label: 'No target — set CTAS' };
    const base = U.toMs(v.lastReassessment || v.startTime);
    const due = base + iv * 60000;
    const diff = due - now;
    const soonWin = Math.min(settings.dueSoonMaxMin, iv * settings.dueSoonFraction) * 60000;
    if (diff < 0) {
      const late = Math.floor(-diff / 60000);
      return { state: 'overdue', rank: 1, due, intervalMin: iv, overdueMin: late, label: `${U.t24(due)} · overdue ${late < 1 ? '<1m' : U.dur(late)}` };
    }
    const left = Math.ceil(diff / 60000);
    if (diff <= soonWin) return { state: 'dueSoon', rank: 2, due, intervalMin: iv, minsToDue: left, label: `${U.t24(due)} · in ${left}m` };
    return { state: 'ok', rank: 3, due, intervalMin: iv, minsToDue: left, label: `${U.t24(due)} · in ${U.dur(left)}` };
  };

  D.waitLevel = (mins, amber, red) => (mins >= red ? 'red' : mins >= amber ? 'amber' : 'ok');
  /** Time since the physician booked the bed (until the bed was assigned). */
  D.bedWait = (p, s, now = Date.now()) => {
    const b = p.workflows.bed; const m = U.minsBetween(b.bookedAt, b.assignedAt || now);
    return { mins: m, level: D.waitLevel(m, s.bedWaitAmberMin, s.bedWaitRedMin) };
  };
  /** Bed assigned but the patient not yet moved onto it: time since the assignment. */
  D.placeWait = (p, s, now = Date.now()) => {
    const b = p.workflows.bed; const m = U.minsBetween(b.assignedAt, b.placedAt || now);
    return { mins: m, level: D.waitLevel(m, s.placeWaitAmberMin || 20, s.placeWaitRedMin || 45) };
  };
  /** One order: requested → done (or now). */
  D.orderWait = (it, s, now = Date.now()) => {
    const m = U.minsBetween(it.requestTime, it.completionTime || now);
    return { mins: m, level: D.waitLevel(m, s.procWaitAmberMin, s.procWaitRedMin) };
  };
  /** The patient's longest-waiting open order. */
  D.procWait = (p, s, now = Date.now()) => {
    const open = D.openOrders(p);
    const m = open.reduce((x, it) => Math.max(x, U.minsBetween(it.requestTime, now)), 0);
    return { mins: m, level: D.waitLevel(m, s.procWaitAmberMin, s.procWaitRedMin), n: open.length };
  };
  /** CNR: when the patient was last called and not found, and when to call again. */
  D.cnrInfo = (p, s, now = Date.now()) => {
    const c = p.cnr; if (!c) return null;
    const recallAt = U.toMs(c.at) + (s.cnrRecallMin || 10) * 60000;
    return { count: c.count, since: c.since, at: c.at, by: c.by, recallAt, due: now >= recallAt, mins: U.minsBetween(c.at, now) };
  };

  /** Most urgent first: CTAS 1, overdue (longest first), due soon, then by due time. */
  D.byVitalsUrgency = (s, now) => (a, b) => {
    const ta = D.vitalsTiming(a, s, now), tb = D.vitalsTiming(b, s, now);
    if (ta.rank !== tb.rank) return ta.rank - tb.rank;
    if (ta.state === 'overdue') return tb.overdueMin - ta.overdueMin;
    return (ta.due || 0) - (tb.due || 0);
  };

  // ------------------------------------------------------------------ factories

  const newVitals = (now, active) => ({ active, startTime: active ? U.iso(now) : null, lastReassessment: null, reassessments: [], endTime: null, endReason: null });
  const newBed = (now, active, bk = {}) => ({
    active, bookedAt: active ? U.iso(now) : null, bookedBy: active ? bk.bookedBy : null, consultant: active ? bk.consultant : null, specialty: active ? bk.specialty || '' : null,
    assignedBed: null, assignedAt: null, assignedBy: null, placedAt: null, endTime: null, endReason: null,
  });
  const newProc = () => ({ active: false, startTime: null, items: [], endTime: null, endReason: null });

  // ------------------------------------------------------------------ validation helpers

  const URN_RE = /^[A-Za-z0-9][A-Za-z0-9\-\/.]{2,23}$/;
  function validDetails(d, state, selfId) {
    const out = {};
    if ('urn' in d) {
      out.urn = U.norm(d.urn).toUpperCase();
      if (!URN_RE.test(out.urn)) fail('MRN must be 3–24 letters, digits, "-", "/" or "." — copy it exactly from TrakCare.');
      const dup = D.activePatients(state).find(p => p.id !== selfId && U.key(p.urn) === U.key(out.urn));
      if (dup) fail(`MRN ${out.urn} is already in the reassessment area (${dup.name}). Open the existing record instead of adding it twice.`, 'DUPLICATE');
    }
    if ('encounterId' in d && d.encounterId != null) {
      out.encounterId = U.norm(d.encounterId).toUpperCase();
      if (out.encounterId && !URN_RE.test(out.encounterId)) fail('Encounter number contains invalid characters.');
    }
    if ('name' in d) { out.name = U.norm(d.name); if (out.name.length < 2) fail('Patient name is required.'); }
    if ('diagnosis' in d) { out.diagnosis = U.norm(d.diagnosis); if (!out.diagnosis) fail('Chief complaint is required.'); }
    if ('ctas' in d) { out.ctas = d.ctas; if (!D.CTAS.includes(out.ctas)) fail('Select a CTAS level.'); }
    if ('team' in d) out.team = U.norm(d.team);
    if ('physician' in d) out.physician = U.norm(d.physician) || 'Unassigned';
    return out;
  }
  function validBooking(d) {
    const bookedBy = U.norm(d.bookedBy);
    if (!bookedBy) fail('Enter the physician who booked the bed.');
    const consultant = U.norm(d.consultant);
    if (!consultant) fail('Enter the consultant who approved the bed (the case was discussed with them).');
    const specialty = U.norm(d.specialty);
    if (specialty.length > 60) fail('Keep the specialty under 60 characters.');
    return { bookedBy, consultant, specialty };
  }
  function validProc(d) {
    const kind = d.kind;
    if (!D.PROC_KINDS.includes(kind)) fail('Choose Procedure, Treatment or Radiology Imaging.');
    const description = U.norm(d.description);
    if (!description) fail(`Say which ${kind.toLowerCase()} is needed.`);
    return { kind, description };
  }
  /** One or more orders: payload.orders = [{kind, description}], or a single kind + description. Blank rows are ignored. */
  function validOrders(d) {
    const list = Array.isArray(d.orders) ? d.orders.filter(o => o && U.norm(o.description)) : [{ kind: d.kind, description: d.description }];
    if (!list.length) fail('Add at least one procedure, treatment or imaging request.');
    if (list.length > 12) fail('Add up to 12 orders at a time.');
    const out = list.map(validProc);
    const seen = new Set();
    out.forEach(o => { const k = U.key(o.kind + '|' + o.description); if (seen.has(k)) fail(`${o.kind}: ${o.description} is listed twice.`); seen.add(k); });
    return out;
  }
  const bookingText = b => `${b.bookedBy}${b.consultant ? ', approved by ' + b.consultant : ''}${b.specialty ? ' · ' + b.specialty : ''}`;
  D.bookingText = bookingText;
  const startNote = (k, p, s) => (k === 'bed' ? `Bed booked by ${bookingText(p.workflows.bed)}`
    : `Interval: ${intervalText(p.ctas, s)}`);

  // ------------------------------------------------------------------ reducer

  /**
   * Apply one action to the freshest state. Returns { state, events, patient }.
   * ctx = { user:{name, role}, device, now(ms), settings }
   * Throws RuleError when a rule blocks the action (nothing is changed).
   */
  D.apply = function (state0, action, ctx) {
    const state = U.clone(state0);
    const now = ctx.now;
    const s = ctx.settings;
    const user = ctx.user;
    if (!user || !user.name) fail('Sign in to the station before making changes.', 'AUTH');
    const events = [];
    const ev = (p, workflow, eventType, prev, next, notes, id) => events.push({
      id: id || U.uuid(), ts: U.iso(now), patientId: p ? p.id : null, urn: p ? p.urn : '', encounterId: p ? p.encounterId : '',
      workflow, eventType, prev: prev == null ? '' : String(prev), next: next == null ? '' : String(next),
      user: user.name, role: user.role, device: ctx.device || '', notes: notes || '',
    });
    const a = action.payload || {};
    const get = () => {
      const p = D.upgradePatient(state.patients[a.id]);
      if (!p) fail('Patient record not found — it may have been removed on another station.', 'NOT_FOUND');
      if (a.expectedVersion != null && p.version !== a.expectedVersion && action.type !== 'RECORD_REASSESSMENT')
        fail(`${p.urn} was changed by ${p.updatedBy || 'another user'} at ${U.t24(p.updatedAt)} while you were editing. Re-open it to see the latest details.`, 'CONFLICT');
      return p;
    };
    const getActive = () => { const p = get(); if (p.status !== 'active') fail(`${p.urn} has already left the reassessment area (${D.exitText(p.exit)}).`, 'EXITED'); return p; };
    const touch = p => { p.version = (p.version || 0) + 1; p.updatedAt = U.iso(now); p.updatedBy = user.name; };
    const archive = (p, key) => { (p.pastEpisodes = p.pastEpisodes || []).push(Object.assign({ wf: key, ctas: p.ctas }, U.clone(p.workflows[key]))); };
    /** Adds orders to the patient's procedure / treatment / imaging list (opening it if nothing was open). */
    const addOrders = (p, orders) => {
      const r = p.workflows.procedure;
      orders.forEach(o => {
        if (D.openOrders(p).some(x => U.key(x.kind + '|' + x.description) === U.key(o.kind + '|' + o.description))) fail(`${p.urn} already has ${o.kind}: ${o.description} open.`, 'DUPLICATE');
      });
      if (!r.active) Object.assign(r, { active: true, startTime: U.iso(now), endTime: null, endReason: null });
      orders.forEach(o => {
        const it = { id: `${p.id}:o${r.items.length + 1}`, kind: o.kind, description: o.description, status: 'Waiting', requestTime: U.iso(now), startedAt: null, completionTime: null, endTime: null, endReason: null, by: user.name };
        r.items.push(it);
        ev(p, D.WF.procedure, 'Order Added', 'None', 'Waiting', D.orderText(it));
      });
    };
    /** The patient turned up again after a CNR. */
    const cnrFound = p => { if (!p.cnr) return ''; const n = p.cnr.count; p.cnr = null; return ` Found after CNR ×${n}.`; };
    /** Back from a known absence (clinic, procedure, …). */
    const awayBack = p => { if (!p.away) return ''; const w = p.away.reason; p.away = null; return ` Back (was: ${w}).`; };

    let p = null;
    switch (action.type) {
      case 'ADMIT': {
        const det = validDetails({ urn: a.urn, encounterId: a.encounterId || '', name: a.name, diagnosis: a.diagnosis, ctas: a.ctas, team: a.team || '', physician: a.physician }, state, null);
        const wf = a.workflows || {};
        if (!wf.vitals && !wf.bed && !wf.procedure) fail('Tick at least one need: vital signs, bed, or procedure / imaging.');
        const bk = wf.bed ? validBooking(a) : {};
        const orders = wf.procedure ? validOrders(a) : [];
        p = Object.assign({ id: a.id || U.uuid(), schemaV: 4, status: 'active', exit: null, createdAt: U.iso(now), createdBy: user.name, version: 0, pastEpisodes: [], notes: [], cnr: null, away: null }, det);
        p.workflows = { vitals: newVitals(now, !!wf.vitals), bed: newBed(now, !!wf.bed, bk), procedure: newProc() };
        touch(p);
        state.patients[p.id] = p;
        const names = D.WF_KEYS.filter(k => wf[k]).map(k => D.WF[k]);
        ev(p, names.join(', '), 'Patient Registered', 'None', 'Active', `${p.name} · ${p.ctas} · ${p.diagnosis}. Needs: ${names.join(', ')}.`);
        D.activeWfs(p).forEach(k => ev(p, D.WF[k], k === 'bed' ? 'Bed Booked' : 'Episode Started', 'None', 'Active', startNote(k, p, s)));
        if (orders.length) addOrders(p, orders);
        if (p.ctas === 'CTAS 1') ev(p, D.WF.vitals, 'Safety Alert', '', 'CTAS 1 in reassessment area', 'CTAS 1 patients need a resus bed, or any free monitored ED bed if resus is full, and continuous observation.');
        break;
      }

      case 'UPDATE_DETAILS': {
        p = getActive();
        const det = validDetails(a.changes || {}, state, p.id);
        const changed = Object.keys(det).filter(k => det[k] !== p[k]);
        if (!changed.length) fail('No changes to save.', 'NOCHANGE');
        changed.forEach(k => {
          const label = { urn: 'MRN', encounterId: 'Encounter', name: 'Name', diagnosis: 'Chief complaint', ctas: 'CTAS', team: 'Team', physician: 'Physician' }[k];
          ev(p, k === 'ctas' ? D.WF.vitals : 'Patient Details', k === 'ctas' ? 'Re-triaged' : `${label} Updated`, p[k], det[k], a.note || '');
          p[k] = det[k];
        });
        touch(p);
        break;
      }

      case 'RECORD_REASSESSMENT': {
        p = getActive();
        const v = p.workflows.vitals;
        if (!v.active) fail(`${p.urn} is not on vital signs monitoring.`);
        let t = a.time ? U.toMs(a.time) : now;
        if (isNaN(t)) fail('Invalid reassessment time.');
        if (t > now + 60000) fail('Reassessment time cannot be in the future.');
        if (t < now - s.backdateMaxMin * 60000) fail(`Reassessments can only be back-dated up to ${s.backdateMaxMin} minutes.`);
        const floor = U.toMs(v.lastReassessment || v.startTime);
        // The time box has no seconds: a time in the same minute as the floor means "right after it", not before.
        if (t < floor && Math.floor(t / 60000) === Math.floor(floor / 60000)) t = Math.min(floor + 1000, now);
        if (t < floor) fail(`Time must be after the ${v.lastReassessment ? 'previous reassessment' : 'start of monitoring'} (${U.t24(floor)}).`);
        const before = D.vitalsTiming(p, s, t);
        const note = U.norm(a.note);
        const noteType = a.noteType && a.noteType !== 'cnr' && a.noteType !== 'away' && D.NOTE_TYPES[a.noteType] ? a.noteType : 'nursing';
        v.reassessments.push(U.iso(t));
        v.lastReassessment = U.iso(t);
        const found = cnrFound(p) + awayBack(p);
        if (note) p.notes.push({ id: `${p.id}:n${p.notes.length + 1}`, at: U.iso(now), by: user.name, type: noteType, text: note });
        touch(p);
        const after = D.vitalsTiming(p, s, now);
        ev(p, D.WF.vitals, 'Reassessment Recorded',
          before.state === 'overdue' ? `Overdue ${U.dur(before.overdueMin)}` : before.label || 'Due',
          after.due ? `Next due ${U.t24(after.due)}` : after.label,
          `Vital signs taken ${U.t24(t)}${t < now - 60000 ? ' (back-dated)' : ''}.${found}${note ? ` ${D.NOTE_TYPES[noteType]}: ${note}` : ''}`);
        break;
      }

      case 'ADD_NOTE': {
        p = getActive();
        const type = a.type;
        if (!D.NOTE_TYPES[type]) fail('Choose the type of note.');
        if (type === 'away') fail('Record where the patient went with "Other — away" in the vital signs form.');
        const text = U.norm(a.text);
        if (type !== 'cnr' && !text) fail('Write the note.');
        if (text.length > 500) fail('Keep the note under 500 characters.');
        const t = U.iso(now);
        p.notes.push({ id: `${p.id}:n${p.notes.length + 1}`, at: t, by: user.name, type, text });
        if (type === 'cnr') {
          const c = p.cnr;
          p.cnr = { since: c ? c.since : t, at: t, count: (c ? c.count : 0) + 1, by: user.name };
          p.away = null; // called and not found: no longer where we thought
          ev(p, 'Notes', 'Called, Not Around (CNR)', c ? `CNR ×${c.count}` : 'In the area', `CNR ×${p.cnr.count}`,
            `Called at ${U.t24(now)}; not in the waiting area. Call again by ${U.t24(now + (s.cnrRecallMin || 10) * 60000)}.${text ? ' ' + text : ''}`);
        } else ev(p, 'Notes', 'Note Added', '', D.NOTE_TYPES[type], text);
        touch(p);
        break;
      }

      case 'RECORD_AWAY': {
        // Vital signs not taken: the patient is away for a known reason (sent to clinic, gone for a procedure, other).
        p = getActive();
        const reason = a.reason;
        if (!D.AWAY_REASONS.includes(reason)) fail('Choose where the patient is: sent to clinic, gone for procedure / imaging, or other.');
        const note = U.norm(a.note);
        if (reason === 'Other' && !note) fail('Write where the patient is or why the vital signs were not taken.');
        if (note.length > 300) fail('Keep the comment under 300 characters.');
        const t = U.iso(now), was = p.cnr ? ` Was CNR ×${p.cnr.count}.` : '';
        p.cnr = null;
        p.away = { reason, note, at: t, by: user.name };
        p.notes.push({ id: `${p.id}:n${p.notes.length + 1}`, at: t, by: user.name, type: 'away', text: reason + (note ? ': ' + note : '') });
        ev(p, 'Notes', 'Away from the Area', 'In the area', reason, `Vital signs not taken.${note ? ' ' + note : ''}${was}`);
        touch(p);
        break;
      }

      case 'CLEAR_CNR': {
        // The patient is back: clears a CNR and/or an "away".
        p = getActive();
        if (!p.cnr && !p.away) fail(`${p.urn} is not marked CNR or away.`, 'NOCHANGE');
        const was = [p.cnr ? `CNR ×${p.cnr.count}` : '', p.away ? 'Away: ' + p.away.reason : ''].filter(Boolean).join(' · ');
        p.cnr = null; p.away = null;
        ev(p, 'Notes', was.startsWith('CNR') ? 'Patient Found' : 'Patient Back', was, 'In the area', U.norm(a.note) || 'Patient is back in the waiting area.');
        touch(p);
        break;
      }

      case 'ASSIGN_BED': {
        // Step 1 of 2: a bed is chosen. The patient stays in the area until placed on it (EXIT type "bed").
        p = getActive();
        const bed = U.norm(a.bed);
        if (!bed) fail('Choose the bed to assign.');
        let b = p.workflows.bed;
        if (!b.active) {
          const bk = validBooking(a);
          if (b.bookedAt) archive(p, 'bed');
          p.workflows.bed = b = newBed(now, true, bk);
          ev(p, D.WF.bed, 'Bed Booked', 'None', 'Active', startNote('bed', p, s));
        }
        if (U.key(b.assignedBed) === U.key(bed)) fail(`${bed} is already assigned to ${p.urn}.`, 'NOCHANGE');
        const taken = D.activePatients(state).find(x => x.id !== p.id && x.workflows.bed.active && U.key(x.workflows.bed.assignedBed) === U.key(bed));
        if (taken) fail(`${bed} is already assigned to ${taken.urn}, who has not been placed yet. Choose another bed, or change ${taken.urn}'s bed first.`, 'BED_TAKEN');
        const prev = b.assignedBed, note = U.norm(a.note);
        if (!prev) b.assignedAt = U.iso(now);
        b.assignedBed = bed; b.assignedBy = user.name;
        touch(p);
        ev(p, D.WF.bed, prev ? 'Bed Changed' : 'Bed Assigned', prev || 'Waiting for bed', bed,
          (prev ? 'Patient still waiting to be placed.' : `Booked by ${b.bookedBy} at ${U.t24(b.bookedAt)}; assigned after ${U.dur(D.bedWait(p, s, now).mins)}. Waiting to be placed on the bed.`) + (note ? ' ' + note : ''));
        break;
      }

      case 'UNASSIGN_BED': {
        p = getActive();
        const b = p.workflows.bed;
        if (!b.active || !b.assignedBed) fail(`${p.urn} has no bed assigned.`);
        const reason = U.norm(a.reason); if (!reason) fail('Give a reason for cancelling the bed assignment.');
        ev(p, D.WF.bed, 'Bed Assignment Cancelled', b.assignedBed, 'Waiting for bed', reason + ' Bed wait continues from the booking time.');
        Object.assign(b, { assignedBed: null, assignedAt: null, assignedBy: null });
        touch(p);
        break;
      }

      case 'UPDATE_BOOKING': {
        p = getActive();
        const b = p.workflows.bed;
        if (!b.active) fail(`${p.urn} is not waiting for a bed.`);
        const bk = validBooking(a);
        if (bk.bookedBy === b.bookedBy && bk.consultant === (b.consultant || '') && bk.specialty === (b.specialty || '')) fail('No changes to save.', 'NOCHANGE');
        ev(p, D.WF.bed, 'Booking Updated', bookingText(b), bookingText(bk), 'Booking time unchanged.');
        Object.assign(b, bk);
        touch(p);
        break;
      }

      case 'UPDATE_PROCEDURE': {
        // One order of the patient's list. itemId may be left out when only one order is open.
        p = getActive();
        const r = p.workflows.procedure, open = D.openOrders(p);
        const it = a.itemId ? r.items.find(x => x.id === a.itemId) : open.length === 1 ? open[0] : null;
        if (!it) fail(!open.length ? `${p.urn} has no open procedure / treatment / imaging.` : a.itemId ? 'That order was not found — it may have been changed on another station.' : 'Choose which order to update.', a.itemId ? 'NOT_FOUND' : 'RULE');
        if (!isOpen(it)) fail(`${D.orderText(it)} is already ${it.status.toLowerCase()}.`, 'NOCHANGE');
        const f = validProc({ kind: a.kind || it.kind, description: a.description || it.description });
        const status = a.status || it.status;
        if (!D.PROC_STATUS.includes(status)) fail('Select a status.');
        const note = U.norm(a.note);
        if (status === 'Cancelled' && !note) fail('Give the reason for cancelling.');
        const changes = [];
        if (f.kind !== it.kind || f.description !== it.description) changes.push(['Request Changed', D.orderText(it), `${f.kind}: ${f.description}`]);
        if (status !== it.status) changes.push(['Status Updated', it.status, status]);
        if (!changes.length) fail('No changes to save.', 'NOCHANGE');
        const was = D.orderText(it);
        if (status !== it.status) it.delay = null; // a new status settles the delay
        Object.assign(it, f, { status });
        const t = U.iso(now);
        if (status === 'In Progress' && !it.startedAt) it.startedAt = t;
        if (status === 'Done') Object.assign(it, { completionTime: t, endTime: t, endReason: 'Done' });
        if (status === 'Cancelled') Object.assign(it, { endTime: t, endReason: 'Cancelled: ' + note });
        const found = status === 'In Progress' || status === 'Done' ? cnrFound(p) : '';
        changes.forEach(c => ev(p, D.WF.procedure, c[0], c[1], c[2], `${c[0] === 'Status Updated' ? was + '. ' : ''}${note}${found}`.trim()));
        if (!D.openOrders(p).length) Object.assign(r, { active: false, endTime: t, endReason: 'All orders closed' });
        touch(p);
        break;
      }

      case 'ORDER_DELAY': {
        // Why an order is waiting: blood test result, contrast, consent, other. reason '' = delay resolved.
        p = getActive();
        const open = D.openOrders(p);
        const it = a.itemId ? p.workflows.procedure.items.find(x => x.id === a.itemId) : open.length === 1 ? open[0] : null;
        if (!it) fail(a.itemId ? 'That order was not found — it may have been changed on another station.' : open.length ? 'Choose which order is delayed.' : `${p.urn} has no open order.`, a.itemId ? 'NOT_FOUND' : 'RULE');
        if (!isOpen(it)) fail(`${D.orderText(it)} is already ${it.status.toLowerCase()}.`, 'NOCHANGE');
        const reason = a.reason || '';
        const note = U.norm(a.note);
        if (reason && !D.DELAY_REASONS.includes(reason)) fail('Choose the reason: blood test result, contrast, consent or other.');
        if (reason === 'Other' && !note) fail('Write the reason for the delay.');
        if (note.length > 300) fail('Keep the comment under 300 characters.');
        if (!reason && !it.delay) fail('No delay recorded for this order.', 'NOCHANGE');
        const prev = it.delay ? it.delay.reason : 'No delay';
        it.delay = reason ? { reason, note, at: U.iso(now), by: user.name } : null;
        ev(p, D.WF.procedure, reason ? 'Order Delayed' : 'Delay Resolved', prev, reason || 'Resolved', `${D.orderText(it)}.${note ? ' ' + note : ''}`);
        touch(p);
        break;
      }

      case 'ADD_ORDER': {
        p = getActive();
        addOrders(p, validOrders(a));
        touch(p);
        break;
      }

      case 'START_WORKFLOW': {
        p = getActive();
        const k = a.wf;
        if (!D.WF[k]) fail('Unknown need.');
        if (k === 'procedure') { addOrders(p, validOrders(a)); touch(p); break; } // the order list keeps its own history
        if (p.workflows[k].active) fail(`${p.urn} already has ${D.WF[k]} open.`);
        const prevStarted = p.workflows[k].startTime || p.workflows[k].bookedAt;
        if (prevStarted) archive(p, k);
        if (k === 'vitals') p.workflows.vitals = newVitals(now, true);
        if (k === 'bed') p.workflows.bed = newBed(now, true, validBooking(a));
        ev(p, D.WF[k], k === 'bed' ? 'Bed Booked' : 'Episode Started', 'None', 'Active', startNote(k, p, s));
        touch(p);
        break;
      }

      case 'STOP_WORKFLOW': {
        p = getActive();
        const k = a.wf, w = p.workflows[k];
        if (!w || !w.active) fail('That need is not open.');
        const reason = U.norm(a.reason); if (!reason) fail('Give a reason for closing it.');
        const t = U.iso(now);
        w.active = false; w.endTime = t; w.endReason = reason;
        if (k === 'procedure') D.openOrders(p).forEach(it => Object.assign(it, { status: 'Cancelled', endTime: t, endReason: 'Cancelled: ' + reason, delay: null }));
        ev(p, D.WF[k], k === 'bed' ? 'Bed Booking Cancelled' : k === 'procedure' ? 'All Orders Cancelled' : 'Episode Ended', 'Active', 'Ended', reason);
        touch(p);
        break;
      }

      case 'EXIT': {
        p = getActive();
        const type = a.type;
        if (!D.EXIT_TYPES[type]) fail('Choose Placed on bed, Discharged or Entered in error.');
        const reason = U.norm(a.reason);
        if (type === 'discharged' && !reason) fail('Choose or type the discharge reason (e.g. Discharged home, DAMA, Absconded, LWBS).');
        if (type === 'error' && !reason) fail('Say what was wrong with the entry.');
        const b = p.workflows.bed;
        const bed = type === 'bed' ? U.norm(a.bed) || (b.active && b.assignedBed) || '' : null;
        if (type === 'bed' && !bed) fail('Enter the bed the patient was placed on.');
        const snapshot = U.clone(p.workflows);
        const closed = D.activeWfs(p);
        const t = U.iso(now);
        const label = D.EXIT_TYPES[type];
        const v = p.workflows.vitals, r = p.workflows.procedure;
        const assigned = b.active && b.assignedBed ? { bed: b.assignedBed, at: b.assignedAt } : null;
        if (v.active) Object.assign(v, { active: false, endTime: t, endReason: label });
        if (b.active) {
          Object.assign(b, { active: false, endTime: t, endReason: label });
          if (type === 'bed') { if (!b.assignedAt) Object.assign(b, { assignedAt: t, assignedBy: user.name }); Object.assign(b, { assignedBed: bed, placedAt: t }); }
        }
        if (r.active) { D.openOrders(p).forEach(it => Object.assign(it, { status: 'Closed at exit', endTime: t, endReason: label, delay: null })); Object.assign(r, { active: false, endTime: t, endReason: label }); }
        p.cnr = null; p.away = null;
        p.status = 'exited';
        p.exit = { type, label, time: t, bed, reason, by: user.name, closedWorkflows: closed, snapshot };
        touch(p);
        const bedNote = type !== 'bed' || !b.bookedAt ? ''
          : `Bed booked by ${b.bookedBy} at ${U.t24(b.bookedAt)}; ${assigned ? `${assigned.bed} assigned ${U.t24(assigned.at)} (after ${U.dur(U.minsBetween(b.bookedAt, assigned.at))}); placed ${U.dur(U.minsBetween(assigned.at, t))} after assignment` : `placed ${U.dur(D.bedWait(p, s, now).mins)} after booking`}${assigned && U.key(assigned.bed) !== U.key(bed) ? ` (on ${bed} instead of ${assigned.bed})` : ''}. `;
        ev(p, 'Exit', type === 'bed' ? 'Placed on Bed' : type === 'discharged' ? 'Discharged' : 'Entered in Error', 'In reassessment area', D.exitText(p.exit),
          `${bedNote}Closed: ${closed.map(k => D.WF[k]).join(', ') || 'nothing open'}.${type === 'bed' && reason ? ' Note: ' + reason : ''}`);
        break;
      }

      case 'REOPEN': {
        p = get();
        const last = p.exit;
        if (p.status === 'active' || !last) fail('Patient is already in the reassessment area.');
        const ownRecent = last.by === user.name && now - U.toMs(last.time) < 10 * 60000;
        if (!ownRecent && !D.isSupervisor(user)) fail('Only a Charge Nurse, ED Leader or Admin can undo an exit made by someone else or more than 10 minutes ago.', 'FORBIDDEN');
        const reason = U.norm(a.reason); if (!reason) fail('Give a reason for undoing the exit.');
        const dup = D.activePatients(state).find(x => x.id !== p.id && U.key(x.urn) === U.key(p.urn));
        if (dup) fail(`MRN ${p.urn} has been added again since; use that record.`, 'DUPLICATE');
        p.workflows = last.snapshot;
        p.status = 'active'; p.exit = null;
        touch(p);
        ev(p, 'Exit', 'Exit Undone', D.exitText(last), 'In reassessment area', `${reason}. Restored: ${D.activeWfs(p).map(k => D.WF[k]).join(', ') || 'none'}. Timers continue from their original times.`);
        break;
      }

      case 'SYSTEM_OVERDUE': {
        // Logged once per overdue interval; the deterministic id makes it idempotent across stations and the server.
        p = state.patients[a.id];
        if (!p || p.status !== 'active') return { state: state0, events: [], patient: null };
        const t = D.vitalsTiming(p, s, now);
        if (t.state !== 'overdue') return { state: state0, events: [], patient: null };
        const id = `ovd-${p.id}-${t.due}`;
        if (state.events.some(e => e.id === id)) return { state: state0, events: [], patient: null };
        ev(p, D.WF.vitals, 'Reassessment Overdue', 'Active', 'Overdue', `Due ${U.t24(t.due)} (${p.ctas}, every ${t.intervalMin} min). Alert raised on ${ctx.device || 'station'}.`, id);
        events[events.length - 1].user = 'System';
        events[events.length - 1].role = 'System';
        break;
      }

      default:
        fail('Unknown action ' + action.type);
    }

    D.appendEvents(state, events);
    state.rev = (state.rev || 0) + 1;
    state.updatedAt = U.iso(now);
    return { state, events, patient: p ? state.patients[p.id] : null };
  };

  function intervalText(ctas, s) {
    const iv = s.ctasIntervals[ctas];
    return ctas === 'CTAS 1' || iv === 0 ? 'continuous' : iv > 0 ? `every ${iv} min (${ctas})` : 'no target set';
  }

  // ------------------------------------------------------------------ audit chain

  const eventBody = e => [e.id, e.ts, e.patientId, e.urn, e.encounterId, e.workflow, e.eventType, e.prev, e.next, e.user, e.role, e.device, e.notes].join('|');
  D.appendEvents = (state, events) => {
    let prev = state.events.length ? state.events[state.events.length - 1].hash : state.chainAnchor;
    events.forEach(e => { e.prevHash = prev; e.hash = U.hash(prev + '|' + eventBody(e)); prev = e.hash; state.events.push(e); });
  };
  /** Returns { ok, checked, brokenAt } — detects any edited, inserted or deleted audit row. */
  D.verifyChain = state => {
    let prev = state.chainAnchor;
    for (let i = 0; i < state.events.length; i++) {
      const e = state.events[i];
      if (e.prevHash !== prev || e.hash !== U.hash(prev + '|' + eventBody(e))) return { ok: false, checked: i, brokenAt: e };
      prev = e.hash;
    }
    return { ok: true, checked: state.events.length };
  };

  /** Drop exited patients and events past retention. Keeps the chain verifiable by moving the anchor. */
  D.purge = (state0, s, now) => {
    const state = U.clone(state0);
    let changed = false;
    Object.values(state.patients).forEach(p => {
      if (p.status === 'exited' && now - U.toMs(D.leftAt(p)) > s.exitedRetentionHours * 3600000) { delete state.patients[p.id]; changed = true; }
    });
    const cutoff = now - s.eventRetentionHours * 3600000;
    let n = 0; while (n < state.events.length && U.toMs(state.events[n].ts) < cutoff) n++;
    if (n) { state.chainAnchor = state.events[n - 1].hash; state.events = state.events.slice(n); changed = true; }
    return changed ? state : null;
  };

  // ------------------------------------------------------------------ metrics (computed from real data)

  function episodes(state, key) {
    const out = [];
    Object.values(state.patients).forEach(p => {
      (p.pastEpisodes || []).filter(e => e.wf === key).forEach(e => out.push({ p, e, ctas: e.ctas }));
      const w = p.workflows[key];
      if (w && (w.startTime || w.bookedAt)) out.push({ p, e: w, ctas: p.ctas });
    });
    return out;
  }
  /** Every order (procedure / treatment / imaging) of every patient. */
  const allOrders = state => Object.values(state.patients).reduce((out, p) => out.concat((p.workflows.procedure && p.workflows.procedure.items) || []), []);
  /** Assigned → placed, for beds assigned ahead of the move (a bed assigned and placed at once is not a wait). */
  const placeMins = e => { const a = U.toMs(e.assignedAt), b = U.toMs(e.placedAt); return !isNaN(a) && !isNaN(b) && b > a ? (b - a) / 60000 : null; };
  /** Reassessments that fell due between from and to, and how many were done on time. */
  function compliance(state, s, inWin, now, onDue) {
    let due = 0, onTime = 0;
    const grace = s.complianceGraceMin * 60000;
    episodes(state, 'vitals').forEach(({ e, ctas }) => {
      const iv = s.ctasIntervals[ctas];
      if (!(iv > 0)) return;
      const times = [U.toMs(e.startTime), ...(e.reassessments || []).map(U.toMs)].sort((x, y) => x - y);
      const stop = e.endTime ? U.toMs(e.endTime) : now;
      times.forEach((t, i) => {
        const d = t + iv * 60000;
        if (d > stop || d > now || !inWin(d)) return; // only intervals that actually fell due during the episode
        const ok = i + 1 < times.length && times[i + 1] <= d + grace;
        due++; if (ok) onTime++;
        if (onDue) onDue(d, ok);
      });
    });
    return { n: due, pct: due ? U.round((onTime / due) * 100) : null };
  }

  D.metrics = (state, s, now = Date.now(), hours = 24) => {
    const from = now - hours * 3600000;
    const startHour = new Date(now); startHour.setMinutes(0, 0, 0);
    const firstBucket = startHour.getTime() - (hours - 1) * 3600000;
    const bucketOf = ms => Math.floor((ms - firstBucket) / 3600000);
    const labels = Array.from({ length: hours }, (_, i) => U.t24(firstBucket + i * 3600000));
    const series = () => Array.from({ length: hours }, () => []);
    const bed = [], tat = [];
    const bedH = series(), tatH = series(), compH = series();
    const put = (h, ms, v) => { const b = bucketOf(ms); if (b >= 0 && b < hours) h[b].push(v); };
    episodes(state, 'bed').forEach(({ e }) => {
      const at = U.toMs(e.assignedAt);
      if (!isNaN(at) && at >= from) { const m = (at - U.toMs(e.bookedAt)) / 60000; bed.push(m); put(bedH, at, m); }
    });
    const place = [];
    episodes(state, 'bed').forEach(({ e }) => { const m = placeMins(e); if (m != null && U.toMs(e.placedAt) >= from) place.push(m); });
    allOrders(state).forEach(e => {
      const ct = U.toMs(e.completionTime);
      if (e.status === 'Done' && !isNaN(ct) && ct >= from) { const m = (ct - U.toMs(e.requestTime)) / 60000; tat.push(m); put(tatH, ct, m); }
    });
    const comp = compliance(state, s, ms => ms >= from, now, (d, ok) => put(compH, d, ok ? 100 : 0));
    const avgSeries = h => h.map(a => (a.length ? U.round(U.mean(a), 1) : null));
    const kpi = a => ({ n: a.length, mean: U.round(U.mean(a)), median: U.round(U.median(a)) });
    return {
      labels, hours,
      bedWait: kpi(bed), procTat: kpi(tat), placeWait: kpi(place),
      compliance: { n: comp.n, pct: comp.pct, median: U.round(U.median(compH.filter(x => x.length).map(U.mean))) },
      hourly: { bed: avgSeries(bedH), tat: avgSeries(tatH), compliance: avgSeries(compH) },
    };
  };

  // ------------------------------------------------------------------ shifts

  /**
   * The shift containing `ms`. shifts = [[ 'HH:mm', name ], ...]; offsetMin = minutes east of UTC at the site.
   * A shift runs from its start up to (not including) the next start, across midnight when needed.
   */
  D.shiftAt = (shifts, ms, offsetMin) => {
    const list = shifts.map(x => ({ t: x[0], name: x[1] || '', m: Number(x[0].slice(0, 2)) * 60 + Number(x[0].slice(3)) })).sort((a, b) => a.m - b.m);
    const mins = Math.floor(ms / 60000) + offsetMin, day = ((mins % 1440) + 1440) % 1440;
    let i = list.length - 1; // before the first start of the day = still the last shift of yesterday
    list.forEach((x, k) => { if (x.m <= day) i = k; });
    const cur = list[i], next = list[(i + 1) % list.length];
    const from = (mins - ((day - cur.m + 1440) % 1440) - offsetMin) * 60000;
    return { name: cur.name, label: `${cur.t}–${next.t}`, from, to: from + ((next.m - cur.m + 1440) % 1440 || 1440) * 60000 };
  };
  D.shiftTitle = w => `${w.name ? w.name + ' shift' : 'Shift'} ${w.label}`;

  /** What happened from `from` up to (not including) `to`; later events belong to the next shift. */
  D.shiftStats = (state, s, from, to, now = Date.now()) => {
    const end = Math.min(to, now), inWin = ms => !isNaN(ms) && ms >= from && ms < end;
    const all = Object.values(state.patients);
    const exited = all.filter(p => p.exit && inWin(U.toMs(p.exit.time)));
    const real = exited.filter(p => p.exit.type !== 'error');
    const discharged = real.filter(p => p.exit.type === 'discharged');
    const reasons = {};
    discharged.forEach(p => { reasons[p.exit.reason] = (reasons[p.exit.reason] || 0) + 1; });
    const bed = [], tat = [];
    episodes(state, 'bed').forEach(({ e }) => { const at = U.toMs(e.assignedAt); if (inWin(at)) bed.push((at - U.toMs(e.bookedAt)) / 60000); });
    const place = [];
    episodes(state, 'bed').forEach(({ e }) => { const m = placeMins(e); if (m != null && inWin(U.toMs(e.placedAt))) place.push(m); });
    allOrders(state).forEach(e => { const ct = U.toMs(e.completionTime); if (e.status === 'Done' && inWin(ct)) tat.push((ct - U.toMs(e.requestTime)) / 60000); });
    const cnr = all.reduce((n, p) => n + (p.notes || []).filter(x => x.type === 'cnr' && inWin(U.toMs(x.at))).length, 0);
    const kpi = a => ({ n: a.length, mean: U.round(U.mean(a)), median: U.round(U.median(a)) });
    const left = discharged.filter(p => /^(dama|absconded|lwbs)$/i.test(p.exit.reason)).length;
    return {
      registered: all.filter(p => inWin(U.toMs(p.createdAt))).length,
      exited: real.length, bedAssigned: real.filter(p => p.exit.type === 'bed').length, discharged: discharged.length,
      leftEarly: left, leftEarlyPct: real.length ? Math.round(left / real.length * 100) : 0,
      reasons: Object.keys(reasons).sort((a, b) => reasons[b] - reasons[a]).map(k => ({ label: k, n: reasons[k] })),
      bedWait: kpi(bed), procTat: kpi(tat), placeWait: kpi(place), cnrCalls: cnr,
      compliance: compliance(state, s, inWin, now),
    };
  };

  /** Period the handoff summarises. In the first hour after a changeover the outgoing shift is the one being handed over. */
  D.handoffWindow = (shifts, now, offsetMin) => {
    const cur = D.shiftAt(shifts, now, offsetMin);
    if (now - cur.from >= 3600000) return { from: cur.from, to: now, title: `${D.shiftTitle(cur)}, so far` };
    const prev = D.shiftAt(shifts, cur.from - 1, offsetMin);
    return { from: prev.from, to: now, title: `${D.shiftTitle(prev)}, and since` };
  };

  /** Individuals (XmR) control limits. Signals: a point outside the limits, or 8 consecutive points on one side of the mean. */
  D.xmr = values => {
    const pts = values.map((v, i) => [i, v]).filter(x => x[1] != null);
    if (pts.length < 6) return { enough: false, n: pts.length };
    const xs = pts.map(x => x[1]);
    const mean = U.mean(xs);
    const mrs = xs.slice(1).map((x, i) => Math.abs(x - xs[i]));
    const mr = U.mean(mrs) || 0;
    const ucl = mean + 2.66 * mr, lcl = Math.max(0, mean - 2.66 * mr);
    const outside = pts.filter(x => x[1] > ucl + 1e-9 || x[1] < lcl - 1e-9).map(x => x[0]);
    let run = 0, side = 0, shift = false;
    xs.forEach(x => { const sd = x > mean ? 1 : x < mean ? -1 : 0; if (sd && sd === side) run++; else { side = sd; run = sd ? 1 : 0; } if (run >= 8) shift = true; });
    return { enough: true, n: pts.length, mean, ucl, lcl, outside, shift, signal: outside.length > 0 || shift };
  };

  // ------------------------------------------------------------------ handover (SBAR) — built from live data only

  /**
   * The handover as structured data: the same content feeds the on-screen cards, the .txt, the Excel file and the PDF.
   * sections = [{ key: 'S'|'B'|'A'|'R', title, tone, facts: [[label, value, tone?]], groups: [{ title, tone, cols, rows: [{ cells, line }] }], items }]
   */
  D.handover = (state, s, now, opts = {}) => {
    const show = p => (opts.privacy ? `${p.urn} (${U.initials(p.name)})` : `${p.urn} ${p.name}`);
    const act = D.activePatients(state);
    const vit = act.filter(p => p.workflows.vitals.active);
    const bedAll = act.filter(p => p.workflows.bed.active);
    const bed = bedAll.filter(p => !p.workflows.bed.assignedBed).sort((a, b) => D.bedWait(b, s, now).mins - D.bedWait(a, s, now).mins);
    const toPlace = bedAll.filter(p => p.workflows.bed.assignedBed).sort((a, b) => D.placeWait(b, s, now).mins - D.placeWait(a, s, now).mins);
    const proc = act.filter(p => p.workflows.procedure.active);
    const orders = proc.reduce((o, p) => o.concat(D.openOrders(p).map(it => ({ p, it, w: D.orderWait(it, s, now) }))), []).sort((a, b) => b.w.mins - a.w.mins);
    const overdue = vit.filter(p => D.vitalsTiming(p, s, now).state === 'overdue').sort(D.byVitalsUrgency(s, now));
    const ctas1 = act.filter(p => p.ctas === 'CTAS 1');
    const cnr = act.filter(p => p.cnr), away = act.filter(p => p.away);
    const ctasMix = D.CTAS.map(c => [c, act.filter(p => p.ctas === c).length]).filter(x => x[1]).map(x => `${x[0]}: ${x[1]}`).join(', ') || 'none';
    const longBed = bed.filter(p => D.bedWait(p, s, now).level !== 'ok');
    const longPlace = toPlace.filter(p => D.placeWait(p, s, now).level !== 'ok');
    const longProc = proc.filter(p => D.procWait(p, s, now).level !== 'ok');
    const delayed = orders.filter(x => x.it.delay);
    const noWf = act.filter(p => !D.activeWfs(p).length);
    const win = opts.window || { from: now - 12 * 3600000, to: now, title: 'last 12 h' };
    const st = D.shiftStats(state, s, win.from, win.to + 1, now);
    const med = k => (k.median == null ? '—' : `${k.median} min (n=${k.n})`);
    const row = (cells, line) => ({ cells, line });
    const S = { key: 'S', title: 'Situation', tone: 'sky', facts: [
      ['Patients in the reassessment area', `${act.length} (${ctasMix})`],
      ['Vital signs monitoring', vit.length], ['Waiting for bed', `${bedAll.length} (${toPlace.length} assigned, to move)`],
      ['Procedure / treatment / imaging', `${proc.length} patients · ${orders.length} open orders`],
      ['OVERDUE vital signs', overdue.length, overdue.length ? 'red' : 'green'],
      ['CTAS 1 in the area', ctas1.length, ctas1.length ? 'red' : 'green'],
      ['CNR (called, not around)', cnr.length, cnr.length ? 'amber' : ''], ['Away (clinic, procedure, other)', away.length, away.length ? 'amber' : '']],
    groups: [
      { title: 'Vital signs overdue', tone: 'red', cols: ['Patient', 'CTAS', 'Due · overdue by'], rows: overdue.map(p => { const t = D.vitalsTiming(p, s, now); return row([show(p), p.ctas, t.label], `${show(p)} ${p.ctas} — ${t.label}`); }) },
      { title: 'CTAS 1 in the area', tone: 'red', cols: ['Patient', 'Chief complaint', 'In the area'], rows: ctas1.map(p => row([show(p), p.diagnosis, U.dur(U.minsBetween(p.createdAt, now))], `${show(p)} — ${p.diagnosis}`)) },
      { title: 'Not in the waiting area (CNR / away)', tone: 'amber', cols: ['Patient', 'Status', 'Since', 'By'], rows: cnr.map(p => { const c = D.cnrInfo(p, s, now); return row([show(p), `CNR ×${c.count}`, U.t24(c.at), c.by], `${show(p)} — CNR: called ${c.count}×, last ${U.t24(c.at)}`); })
        .concat(away.map(p => row([show(p), 'Away: ' + p.away.reason + (p.away.note ? ' — ' + p.away.note : ''), U.t24(p.away.at), p.away.by], `${show(p)} — away: ${p.away.reason}${p.away.note ? ' (' + p.away.note + ')' : ''} since ${U.t24(p.away.at)}`))) },
    ] };
    const B = { key: 'B', title: `Background (${win.title})`, tone: 'blue', facts: [
      ['Added to the area', st.registered],
      ['Left the area', `${st.exited} (placed on bed ${st.bedAssigned}, discharged ${st.discharged})`],
      ['Discharge reasons', st.reasons.length ? st.reasons.map(r => `${r.label} ${r.n}`).join(', ') : '—'],
      ['DAMA / absconded / LWBS', `${st.leftEarly} (${st.leftEarlyPct}%)`, st.leftEarlyPct >= 5 ? 'red' : ''],
      ['Bed wait, booked → assigned (median)', med(st.bedWait)], ['Bed assigned → placed (median)', med(st.placeWait)],
      ['Order requested → done (median)', med(st.procTat)],
      ['Vital signs on time', st.compliance.pct == null ? '—' : `${st.compliance.pct}% (n=${st.compliance.n})`, st.compliance.pct != null && st.compliance.pct < s.complianceTargetPct ? 'red' : 'green'],
      ['CNR calls', st.cnrCalls]], groups: [] };
    const A = { key: 'A', title: 'Assessment', tone: 'amber', facts: [], groups: [
      { title: 'Waiting for a bed', tone: 'amber', cols: ['Patient', 'Booked by', 'Consultant', 'Specialty', 'Booked at', 'Waiting'],
        rows: bed.map(p => { const b = p.workflows.bed, w = D.bedWait(p, s, now); return row([show(p), b.bookedBy, b.consultant || '—', b.specialty || '—', U.t24(b.bookedAt), U.dur(w.mins)],
          `${show(p)} — booked by ${b.bookedBy} at ${U.t24(b.bookedAt)}${b.consultant ? ', consultant ' + b.consultant : ''}${b.specialty ? ' (' + b.specialty + ')' : ''}, waiting ${U.dur(w.mins)}`); }) },
      { title: 'Bed assigned — to move', tone: 'green', cols: ['Patient', 'Bed', 'Assigned at', 'Since assigned'],
        rows: toPlace.map(p => { const b = p.workflows.bed; return row([show(p), b.assignedBed, U.t24(b.assignedAt), U.dur(D.placeWait(p, s, now).mins)], `${show(p)} — ${b.assignedBed}, assigned ${U.t24(b.assignedAt)} (${U.dur(D.placeWait(p, s, now).mins)} ago)`); }) },
      { title: 'Open orders (procedure / treatment / imaging)', tone: 'blue', cols: ['Patient', 'Order', 'Status', 'Waiting', 'Delay'],
        rows: orders.map(x => { const d = x.it.delay ? x.it.delay.reason + (x.it.delay.note ? ': ' + x.it.delay.note : '') : ''; return row([show(x.p), D.orderText(x.it), x.it.status, U.dur(x.w.mins), d || '—'], `${show(x.p)} — ${D.orderText(x.it)} (${x.it.status}, ${U.dur(x.w.mins)})${d ? ' · delay: ' + d : ''}`); }) },
      { title: 'Nothing open — record the exit', tone: 'grey', cols: ['Patient'], rows: noWf.map(p => row([show(p)], show(p))) },
    ] };
    const recs = [];
    if (ctas1.length) recs.push('Move CTAS 1 patient(s) now to a resus bed, or any free monitored ED bed if resus is full; escalate to the ED physician in charge.');
    if (overdue.length) recs.push(`Take vital signs for the ${overdue.length} overdue patient(s) first, longest overdue at top.`);
    if (cnr.length) recs.push(`Call again the ${cnr.length} CNR patient(s); escalate if still not found.`);
    if (away.length) recs.push(`Check on the ${away.length} patient(s) away from the area and take vital signs when back.`);
    if (longBed.length) recs.push(`Escalate the ${longBed.length} long bed wait(s) to the bed coordinator.`);
    if (longPlace.length) recs.push(`Move the ${longPlace.length} patient(s) whose bed is assigned but who are not yet placed.`);
    if (longProc.length || delayed.length) recs.push(`Chase the delayed orders (${longProc.length} long wait, ${delayed.length} with a delay reason).`);
    if (noWf.length) recs.push('Record the exit for patients with nothing open.');
    if (!recs.length) recs.push('No outstanding safety actions. Continue routine vital signs schedule.');
    const R = { key: 'R', title: 'Recommendation', tone: 'green', facts: [], groups: [], items: recs };
    return { title: `PulseED Reassessment Area Handover — ${s.siteName}`, site: s.siteName, generated: U.full(now), by: opts.user || '—', demo: !!opts.demo, window: win.title,
      sections: [S, B, A, R], notes: opts.notes || '' };
  };

  /** The handover as plain text: clearly separated parts, easy to read, paste or print. */
  D.handoverText = h => {
    const W = 72, bar = c => c.repeat(W), L = [];
    L.push(bar('='), ` PULSEED REASSESSMENT AREA HANDOVER (SBAR) — ${h.site}`, ` Generated: ${h.generated} by ${h.by}${h.demo ? '   [TRAINING DATA]' : ''}`, bar('='));
    h.sections.forEach(sec => {
      L.push('', bar('-'), ` [${sec.key}] ${sec.title.replace(/^[^(]+/, m => m.toUpperCase())}`, bar('-'));
      sec.facts.forEach(([k, v]) => L.push(`  • ${k}: ${v}`));
      sec.groups.forEach(g => {
        if (!g.rows.length) return;
        L.push('', `  ▸ ${g.title} (${g.rows.length})`);
        g.rows.forEach(r => L.push(`      - ${r.line}`));
      });
      (sec.items || []).forEach((t, n) => L.push(`  ${n + 1}. ${t}`));
    });
    if (h.notes) L.push('', bar('-'), ' NOTES FROM OUTGOING NURSE', bar('-'), h.notes);
    L.push('', bar('='), ' END OF HANDOVER', bar('='));
    return L.join('\n');
  };
  D.sbar = (state, s, now, opts = {}) => D.handoverText(D.handover(state, s, now, opts));
})(window.PulseED);
