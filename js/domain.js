/* PulseED Reassessment Area Management System — domain model: workflow rules, state transitions, timing and metrics.
 * Pure functions only (no DOM, no storage) so every rule can be unit-tested in tests/tests.html.
 *
 * The model is deliberately small. A patient waits in the reassessment area for one or more of three things:
 *   Vital signs monitoring · a bed · a procedure / treatment / radiology imaging.
 * The patient leaves PulseED when a bed is assigned, when discharged (with the reason: home, DAMA, absconded, LWBS, …)
 * or when the entry was a mistake. Nothing is tracked after that: the patient's care continues in the hospital system. */
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
  D.PROC_TERMINAL = ['Done', 'Cancelled'];
  D.EXIT_TYPES = { bed: 'Bed assigned', discharged: 'Discharged', error: 'Entered in error' };
  /** Quick picks for the discharge reason. Staff can also type any other reason. */
  D.DISCHARGE_REASONS = ['Discharged home', 'DAMA', 'Absconded', 'LWBS', 'Transferred'];
  D.EXIT_NEEDS_REASON = ['discharged', 'error'];

  class RuleError extends Error { constructor(msg, code) { super(msg); this.code = code || 'RULE'; } }
  D.RuleError = RuleError;
  const fail = (msg, code) => { throw new RuleError(msg, code); };

  D.emptyState = () => ({ schema: 3, rev: 0, patients: {}, events: [], chainAnchor: '0000000000000000', updatedAt: null });

  D.isSupervisor = user => !!user && PE.SUPERVISOR_ROLES.includes(user.role);
  D.isLeader = user => !!user && PE.LEADER_ROLES.includes(user.role);
  D.activePatients = state => Object.values(state.patients).filter(p => p.status === 'active');
  /** When the patient left PulseED. */
  D.leftAt = p => (p.exit ? p.exit.time : null);
  D.activeWfs = p => D.WF_KEYS.filter(k => p.workflows[k] && p.workflows[k].active);
  /** "Discharged — DAMA", "Bed assigned — Bed 12". */
  D.exitText = x => (!x ? '' : x.type === 'bed' ? `Bed assigned — ${x.bed}` : x.type === 'discharged' ? `Discharged — ${x.reason}` : `Entered in error — ${x.reason}`);

  /**
   * Records saved by the earlier, detailed version (ED beds, front areas, bed allocation, consent) are read in the
   * new shape so nothing is lost or shown wrongly. Idempotent: an up-to-date record is returned unchanged.
   */
  D.upgradePatient = p => {
    if (!p || !p.workflows || p.schemaV === 3) return p;
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
    p.schemaV = 3;
    return p;
  };

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
  D.procWait = (p, s, now = Date.now()) => {
    const r = p.workflows.procedure; const m = U.minsBetween(r.requestTime, r.completionTime || now);
    return { mins: m, level: D.waitLevel(m, s.procWaitAmberMin, s.procWaitRedMin) };
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
    active, bookedAt: active ? U.iso(now) : null, bookedBy: active ? bk.bookedBy : null, specialty: active ? bk.specialty || '' : null,
    assignedBed: null, assignedAt: null, endTime: null, endReason: null,
  });
  const newProc = (now, active, d = {}) => ({
    active, kind: active ? d.kind : null, description: active ? d.description : null,
    status: active ? 'Waiting' : null, requestTime: active ? U.iso(now) : null, completionTime: null, endTime: null, endReason: null,
  });

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
    return { bookedBy, specialty: U.norm(d.specialty) };
  }
  function validProc(d) {
    const kind = d.kind;
    if (!D.PROC_KINDS.includes(kind)) fail('Choose Procedure, Treatment or Radiology Imaging.');
    const description = U.norm(d.description);
    if (!description) fail(`Say which ${kind.toLowerCase()} is needed.`);
    return { kind, description };
  }
  const startNote = (k, p, s) => (k === 'bed' ? `Bed booked by ${p.workflows.bed.bookedBy}${p.workflows.bed.specialty ? ' · ' + p.workflows.bed.specialty : ''}`
    : k === 'procedure' ? `${p.workflows.procedure.kind}: ${p.workflows.procedure.description}` : `Interval: ${intervalText(p.ctas, s)}`);

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
      const p = state.patients[a.id];
      if (!p) fail('Patient record not found — it may have been removed on another station.', 'NOT_FOUND');
      if (a.expectedVersion != null && p.version !== a.expectedVersion && action.type !== 'RECORD_REASSESSMENT')
        fail(`${p.urn} was changed by ${p.updatedBy || 'another user'} at ${U.t24(p.updatedAt)} while you were editing. Re-open it to see the latest details.`, 'CONFLICT');
      return p;
    };
    const getActive = () => { const p = get(); if (p.status !== 'active') fail(`${p.urn} has already left the reassessment area (${D.exitText(p.exit)}).`, 'EXITED'); return p; };
    const touch = p => { p.version = (p.version || 0) + 1; p.updatedAt = U.iso(now); p.updatedBy = user.name; };
    const archive = (p, key) => { (p.pastEpisodes = p.pastEpisodes || []).push(Object.assign({ wf: key, ctas: p.ctas }, U.clone(p.workflows[key]))); };

    let p = null;
    switch (action.type) {
      case 'ADMIT': {
        const det = validDetails({ urn: a.urn, encounterId: a.encounterId || '', name: a.name, diagnosis: a.diagnosis, ctas: a.ctas, team: a.team || '', physician: a.physician }, state, null);
        const wf = a.workflows || {};
        if (!wf.vitals && !wf.bed && !wf.procedure) fail('Tick at least one need: vital signs, bed, or procedure / imaging.');
        const bk = wf.bed ? validBooking(a) : {};
        const proc = wf.procedure ? validProc(a) : {};
        p = Object.assign({ id: a.id || U.uuid(), schemaV: 3, status: 'active', exit: null, createdAt: U.iso(now), createdBy: user.name, version: 0, pastEpisodes: [] }, det);
        p.workflows = { vitals: newVitals(now, !!wf.vitals), bed: newBed(now, !!wf.bed, bk), procedure: newProc(now, !!wf.procedure, proc) };
        touch(p);
        state.patients[p.id] = p;
        const names = D.activeWfs(p).map(k => D.WF[k]);
        ev(p, names.join(', '), 'Patient Registered', 'None', 'Active', `${p.name} · ${p.ctas} · ${p.diagnosis}. Needs: ${names.join(', ')}.`);
        D.activeWfs(p).forEach(k => ev(p, D.WF[k], k === 'bed' ? 'Bed Booked' : 'Episode Started', 'None', 'Active', startNote(k, p, s)));
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
        v.reassessments.push(U.iso(t));
        v.lastReassessment = U.iso(t);
        touch(p);
        const after = D.vitalsTiming(p, s, now);
        ev(p, D.WF.vitals, 'Reassessment Recorded',
          before.state === 'overdue' ? `Overdue ${U.dur(before.overdueMin)}` : before.label || 'Due',
          after.due ? `Next due ${U.t24(after.due)}` : after.label,
          `Vital signs taken ${U.t24(t)}${t < now - 60000 ? ' (back-dated)' : ''}.${a.note ? ' ' + U.norm(a.note) : ''}`);
        break;
      }

      case 'UPDATE_BOOKING': {
        p = getActive();
        const b = p.workflows.bed;
        if (!b.active) fail(`${p.urn} is not waiting for a bed.`);
        const bk = validBooking(a);
        if (bk.bookedBy === b.bookedBy && bk.specialty === (b.specialty || '')) fail('No changes to save.', 'NOCHANGE');
        ev(p, D.WF.bed, 'Booking Updated', `${b.bookedBy}${b.specialty ? ' · ' + b.specialty : ''}`, `${bk.bookedBy}${bk.specialty ? ' · ' + bk.specialty : ''}`, 'Booking time unchanged.');
        Object.assign(b, bk);
        touch(p);
        break;
      }

      case 'UPDATE_PROCEDURE': {
        p = getActive();
        const r = p.workflows.procedure;
        if (!r.active) fail(`${p.urn} has no open procedure / treatment / imaging.`);
        const f = validProc({ kind: a.kind || r.kind, description: a.description || r.description });
        const status = a.status || r.status;
        if (!D.PROC_STATUS.includes(status)) fail('Select a status.');
        const note = U.norm(a.note);
        if (status === 'Cancelled' && !note) fail('Give the reason for cancelling.');
        const changes = [];
        if (f.kind !== r.kind || f.description !== r.description) changes.push(['Request Changed', `${r.kind}: ${r.description}`, `${f.kind}: ${f.description}`]);
        if (status !== r.status) changes.push(['Status Updated', r.status, status]);
        if (!changes.length) fail('No changes to save.', 'NOCHANGE');
        changes.forEach(c => ev(p, D.WF.procedure, c[0], c[1], c[2], note));
        Object.assign(r, f, { status });
        if (status === 'Done') { r.completionTime = U.iso(now); r.active = false; r.endTime = U.iso(now); r.endReason = 'Done'; }
        if (status === 'Cancelled') { r.active = false; r.endTime = U.iso(now); r.endReason = 'Cancelled: ' + note; }
        touch(p);
        break;
      }

      case 'START_WORKFLOW': {
        p = getActive();
        const k = a.wf;
        if (!D.WF[k]) fail('Unknown need.');
        if (p.workflows[k].active) fail(`${p.urn} already has ${D.WF[k]} open.`);
        const prevStarted = p.workflows[k].startTime || p.workflows[k].bookedAt || p.workflows[k].requestTime;
        if (prevStarted) archive(p, k);
        if (k === 'vitals') p.workflows.vitals = newVitals(now, true);
        if (k === 'bed') p.workflows.bed = newBed(now, true, validBooking(a));
        if (k === 'procedure') p.workflows.procedure = newProc(now, true, validProc(a));
        ev(p, D.WF[k], k === 'bed' ? 'Bed Booked' : 'Episode Started', 'None', 'Active', startNote(k, p, s));
        touch(p);
        break;
      }

      case 'STOP_WORKFLOW': {
        p = getActive();
        const k = a.wf, w = p.workflows[k];
        if (!w || !w.active) fail('That need is not open.');
        const reason = U.norm(a.reason); if (!reason) fail('Give a reason for closing it.');
        w.active = false; w.endTime = U.iso(now); w.endReason = reason;
        if (k === 'procedure') w.status = 'Cancelled';
        ev(p, D.WF[k], k === 'bed' ? 'Bed Booking Cancelled' : 'Episode Ended', 'Active', 'Ended', reason);
        touch(p);
        break;
      }

      case 'EXIT': {
        p = getActive();
        const type = a.type;
        if (!D.EXIT_TYPES[type]) fail('Choose Bed assigned, Discharged or Entered in error.');
        const reason = U.norm(a.reason);
        if (type === 'discharged' && !reason) fail('Choose or type the discharge reason (e.g. Discharged home, DAMA, Absconded, LWBS).');
        if (type === 'error' && !reason) fail('Say what was wrong with the entry.');
        const bed = type === 'bed' ? U.norm(a.bed) : null;
        if (type === 'bed' && !bed) fail('Enter the bed the patient was assigned to.');
        const snapshot = U.clone(p.workflows);
        const closed = D.activeWfs(p);
        const t = U.iso(now);
        const label = D.EXIT_TYPES[type];
        const v = p.workflows.vitals, b = p.workflows.bed, r = p.workflows.procedure;
        if (v.active) Object.assign(v, { active: false, endTime: t, endReason: label });
        if (b.active) {
          Object.assign(b, { active: false, endTime: t, endReason: label });
          if (type === 'bed') Object.assign(b, { assignedBed: bed, assignedAt: t });
        }
        if (r.active) Object.assign(r, { active: false, endTime: t, endReason: label, status: r.status === 'Done' ? 'Done' : 'Closed at exit' });
        p.status = 'exited';
        p.exit = { type, label, time: t, bed, reason, by: user.name, closedWorkflows: closed, snapshot };
        touch(p);
        ev(p, 'Exit', type === 'bed' ? 'Bed Assigned' : type === 'discharged' ? 'Discharged' : 'Entered in Error', 'In reassessment area', D.exitText(p.exit),
          `${type === 'bed' && b.bookedAt ? `Bed booked by ${b.bookedBy} at ${U.t24(b.bookedAt)}; assigned after ${U.dur(D.bedWait(p, s, now).mins)}. ` : ''}Closed: ${closed.map(k => D.WF[k]).join(', ') || 'nothing open'}.${type === 'bed' && reason ? ' Note: ' + reason : ''}`);
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
      if (w && (w.startTime || w.bookedAt || w.requestTime)) out.push({ p, e: w, ctas: p.ctas });
    });
    return out;
  }
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
    episodes(state, 'procedure').forEach(({ e }) => {
      const ct = U.toMs(e.completionTime);
      if (e.status === 'Done' && !isNaN(ct) && ct >= from) { const m = (ct - U.toMs(e.requestTime)) / 60000; tat.push(m); put(tatH, ct, m); }
    });
    const comp = compliance(state, s, ms => ms >= from, now, (d, ok) => put(compH, d, ok ? 100 : 0));
    const avgSeries = h => h.map(a => (a.length ? U.round(U.mean(a), 1) : null));
    const kpi = a => ({ n: a.length, mean: U.round(U.mean(a)), median: U.round(U.median(a)) });
    return {
      labels, hours,
      bedWait: kpi(bed), procTat: kpi(tat),
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
    episodes(state, 'procedure').forEach(({ e }) => { const ct = U.toMs(e.completionTime); if (e.status === 'Done' && inWin(ct)) tat.push((ct - U.toMs(e.requestTime)) / 60000); });
    const kpi = a => ({ n: a.length, mean: U.round(U.mean(a)), median: U.round(U.median(a)) });
    const left = discharged.filter(p => /^(dama|absconded|lwbs)$/i.test(p.exit.reason)).length;
    return {
      registered: all.filter(p => inWin(U.toMs(p.createdAt))).length,
      exited: real.length, bedAssigned: real.filter(p => p.exit.type === 'bed').length, discharged: discharged.length,
      leftEarly: left, leftEarlyPct: real.length ? Math.round(left / real.length * 100) : 0,
      reasons: Object.keys(reasons).sort((a, b) => reasons[b] - reasons[a]).map(k => ({ label: k, n: reasons[k] })),
      bedWait: kpi(bed), procTat: kpi(tat),
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

  D.sbar = (state, s, now, opts = {}) => {
    const show = p => (opts.privacy ? `${p.urn} (${U.initials(p.name)})` : `${p.urn} ${p.name}`);
    const act = D.activePatients(state);
    const vit = act.filter(p => p.workflows.vitals.active);
    const bed = act.filter(p => p.workflows.bed.active).sort((a, b) => D.bedWait(b, s, now).mins - D.bedWait(a, s, now).mins);
    const proc = act.filter(p => p.workflows.procedure.active);
    const overdue = vit.filter(p => D.vitalsTiming(p, s, now).state === 'overdue').sort(D.byVitalsUrgency(s, now));
    const ctas1 = act.filter(p => p.ctas === 'CTAS 1');
    const ctasMix = D.CTAS.map(c => [c, act.filter(p => p.ctas === c).length]).filter(x => x[1]).map(x => `${x[0]}: ${x[1]}`).join(', ') || 'none';
    const longBed = bed.filter(p => D.bedWait(p, s, now).level !== 'ok');
    const longProc = proc.filter(p => D.procWait(p, s, now).level !== 'ok');
    const noWf = act.filter(p => !D.activeWfs(p).length);
    const win = opts.window || { from: now - 12 * 3600000, to: now, title: 'last 12 h' };
    const st = D.shiftStats(state, s, win.from, win.to + 1, now);
    const L = [];
    L.push(`=== PULSEED REASSESSMENT AREA HANDOVER (SBAR) — ${s.siteName} ===`);
    L.push(`Generated: ${U.full(now)} by ${opts.user || '—'}${opts.demo ? '   [TRAINING DATA]' : ''}`, '');
    L.push('[S] SITUATION');
    L.push(`- Patients in the reassessment area: ${act.length} (${ctasMix})`);
    L.push(`- Vital signs: ${vit.length} | Waiting for bed: ${bed.length} | Procedure / treatment / imaging: ${proc.length}`);
    L.push(`- OVERDUE vital signs: ${overdue.length}`);
    overdue.forEach(p => L.push(`    • ${show(p)} ${p.ctas} — ${D.vitalsTiming(p, s, now).label}`));
    if (ctas1.length) { L.push(`- CTAS 1 IN REASSESSMENT AREA: ${ctas1.length}`); ctas1.forEach(p => L.push(`    • ${show(p)} — ${p.diagnosis}`)); }
    L.push('', `[B] BACKGROUND (${win.title})`);
    L.push(`- Left the area: ${st.exited} (bed assigned ${st.bedAssigned}, discharged ${st.discharged}${st.reasons.length ? ': ' + st.reasons.map(r => `${r.label} ${r.n}`).join(', ') : ''})`);
    L.push(`- Bed wait from booking to assignment: median ${st.bedWait.median ?? '—'} min (n=${st.bedWait.n}) | Procedure / imaging done: median ${st.procTat.median ?? '—'} min (n=${st.procTat.n}) | Vital signs on time: ${st.compliance.pct ?? '—'}% (n=${st.compliance.n})`);
    L.push('', '[A] ASSESSMENT');
    L.push(`- Waiting for bed: ${bed.length}`);
    bed.slice(0, 12).forEach(p => { const b = p.workflows.bed; L.push(`    • ${show(p)} — booked by ${b.bookedBy} at ${U.t24(b.bookedAt)}${b.specialty ? ' (' + b.specialty + ')' : ''}, waiting ${U.dur(D.bedWait(p, s, now).mins)}`); });
    if (longProc.length) { L.push(`- Procedures / imaging waiting over ${s.procWaitAmberMin} min: ${longProc.length}`); longProc.forEach(p => L.push(`    • ${show(p)} — ${p.workflows.procedure.kind}: ${p.workflows.procedure.description} (${p.workflows.procedure.status})`)); }
    if (noWf.length) { L.push(`- In the area with nothing open (record an exit): ${noWf.length}`); noWf.forEach(p => L.push(`    • ${show(p)}`)); }
    L.push('', '[R] RECOMMENDATION');
    let n = 1;
    if (ctas1.length) L.push(`${n++}. Move CTAS 1 patient(s) now to a resus bed, or any free monitored ED bed if resus is full; escalate to the ED physician in charge.`);
    if (overdue.length) L.push(`${n++}. Take vital signs for the ${overdue.length} overdue patient(s) first, longest overdue at top.`);
    if (longBed.length) L.push(`${n++}. Escalate the ${longBed.length} long bed wait(s) to the bed coordinator.`);
    if (longProc.length) L.push(`${n++}. Chase the ${longProc.length} delayed procedure / imaging request(s).`);
    if (noWf.length) L.push(`${n++}. Record the exit for patients with nothing open.`);
    if (n === 1) L.push('1. No outstanding safety actions. Continue routine vital signs schedule.');
    if (opts.notes) L.push('', '[NOTES FROM OUTGOING NURSE]', opts.notes);
    L.push('', '=== END OF REPORT ===');
    return L.join('\n');
  };
})(window.PulseED);
