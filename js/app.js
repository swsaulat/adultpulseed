/* PulseED — bootstrap, alert engine, audio, auto-lock. */
(function (PE) {
  'use strict';
  const U = PE.util, D = PE.domain, S = PE.store, UI = PE.ui;

  // ------------------------------------------------------------------ audio (one shared context; unlocked on first interaction)
  PE.audio = {
    ctx: null, blocked: false,
    unlock() {
      try {
        if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        if (this.ctx.state === 'suspended') this.ctx.resume();
        this.blocked = false;
      } catch (e) { this.ctx = null; }
    },
    chime(kind) {
      if (!this.ctx) this.unlock();
      const c = this.ctx;
      if (!c || c.state !== 'running') { this.blocked = true; return false; }
      // critical = CTAS 1 · overdue = vital signs overdue · wait = long bed / procedure wait · due = vital signs due soon (soft)
      const tones = kind === 'critical' ? [880, 660, 880, 660] : kind === 'test' ? [660] : kind === 'wait' ? [440, 554.37, 440] : kind === 'due' ? [523.25] : [587.33, 880];
      const vol = kind === 'due' ? 0.1 : 0.18;
      tones.forEach((f, i) => {
        const t = c.currentTime + i * 0.28, o = c.createOscillator(), g = c.createGain();
        o.type = 'sine'; o.frequency.setValueAtTime(f, t);
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
        o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + 0.27);
      });
      return true;
    },
  };
  // Redraw only after the click has finished, so the first tap on a button (which also unlocks sound) is not lost.
  ['pointerdown', 'keydown'].forEach(ev => window.addEventListener(ev, e => {
    const was = PE.audio.blocked; PE.audio.unlock(); if (!was) return;
    if (e.type === 'pointerdown') window.addEventListener('pointerup', () => setTimeout(UI.renderChrome, 0), { once: true }); else setTimeout(UI.renderChrome, 0);
  }, { passive: true }));

  // ------------------------------------------------------------------ leader election: one tab per PC logs system events and purges
  let leader = !(navigator.locks && navigator.locks.request);
  if (!leader) navigator.locks.request('pulseed-leader', () => { leader = true; return new Promise(() => {}); });

  // ------------------------------------------------------------------ alert engine
  // Each alert type keeps its own memory of what it has already sounded for and when it last sounded,
  // so a busy minute of one type never swallows another. At most one sound every 20 s, highest priority first.
  const heard = { critical: new Set(), overdue: new Set(), wait: new Set(), due: new Set() };
  const lastOf = { critical: 0, overdue: 0, wait: 0, due: 0 };
  function alerts() {
    if (!S.user && S.device.mode) { /* keep evaluating so the chime still sounds on a locked screen */ }
    const L = UI.lists(), s = S.settings, t = Date.now();
    const keys = {
      critical: L.ctas1.map(p => p.id),                                                        // CTAS 1 in the area
      overdue: L.overdue.map(p => p.id),                                                       // vital signs overdue
      wait: L.longBed.map(p => 'b' + p.id).concat(L.longProc.map(p => 'p' + p.id), L.longPlace.map(p => 'a' + p.id)), // bed / order / placement past the red limit
      due: L.dueSoon.map(p => p.id + '@' + D.vitalsTiming(p, s, t).due)                        // vital signs due soon (once per due time)
        .concat(L.cnrDue.map(p => 'c' + p.id + '@' + p.cnr.at)),                                 // CNR: time to call the patient again (once per call)
    };
    const repeat = { critical: (s.chimeRepeatMin || 2) * 60000, overdue: (s.chimeRepeatMin || 2) * 60000, wait: (s.longWaitRepeatMin || 15) * 60000, due: Infinity };
    // Forget what is no longer alerting, so it sounds again if it comes back.
    Object.keys(keys).forEach(k => { const now = new Set(keys[k]); heard[k].forEach(x => { if (!now.has(x)) heard[k].delete(x); }); });
    if (!S.device.sound) { Object.keys(keys).forEach(k => keys[k].forEach(x => heard[k].add(x))); return runSystem(L, t); }
    const shared = U.ls.get('pulseed:v2:lastChime', 0); // another tab on this PC
    if (t - shared < 20000) return runSystem(L, t);
    const kind = ['critical', 'overdue', 'wait', 'due'].find(k => keys[k].length && (keys[k].some(x => !heard[k].has(x)) || t - lastOf[k] >= repeat[k]));
    if (kind && PE.audio.chime(kind)) {
      lastOf[kind] = t; keys[kind].forEach(x => heard[kind].add(x));
      try { U.ls.set('pulseed:v2:lastChime', t); } catch (e) { /* ignore */ }
    }
    runSystem(L, t);
  }
  function runSystem(L, t) {
    if (leader && L.overdue.length && !S.isShared()) { // the shared register logs overdue events itself (server watchdog)
      L.overdue.forEach(p => {
        const tm = D.vitalsTiming(p, S.settings, t);
        if (!S.state.events.some(e => e.id === `ovd-${p.id}-${tm.due}`)) S.dispatchSystem('SYSTEM_OVERDUE', { id: p.id });
      });
    }
  }
  S.dispatchSystem = async (type, payload) => {
    try {
      await S.adapter.commit(fresh => {
        const r = D.apply(fresh, { type, payload }, Object.assign(S.ctx(), { user: { name: 'System', role: 'System' } }));
        return r.events.length ? r : null;
      });
    } catch (e) { /* system logging must never interrupt clinical use */ }
  };

  // ------------------------------------------------------------------ auto-lock
  let lastInput = Date.now();
  ['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach(ev => window.addEventListener(ev, () => (lastInput = Date.now()), { passive: true }));
  function autoLock() {
    const m = S.settings.autoLockMin;
    if (!m || !S.user) return;
    if (Date.now() - lastInput > m * 60000) {
      S.setUser(null);
      if (S.isShared()) S.adapter.setToken(null);
      UI.closeAll(); UI.refresh(); UI.signInModal('locked');
    }
  }

  // ------------------------------------------------------------------ boot
  async function start(mode) {
    await S.init(mode);
    // Training data is built around "now". If nobody has used it for 6 hours its clocks are stale (patients "29 h overdue"),
    // so it is rebuilt fresh; anyone actively practising keeps their own entries.
    const lastUse = mode === 'demo' ? Math.max(0, ...S.state.events.map(e => Date.parse(e.ts) || 0)) : 0;
    const stale = mode === 'demo' && Object.keys(S.state.patients).length && (Date.now() - lastUse > 6 * 3600000 || S.state.schema !== D.emptyState().schema); // old format after an upgrade: rebuild too
    if (mode === 'demo' && (!Object.keys(S.state.patients).length || stale)) {
      await S.adapter.replace(PE.demo.build(S.settings).state);
      await S.reload();
      if (stale) setTimeout(() => UI.toast('Training data refreshed to the current time.', 'success'), 800);
    }
    UI.applyTheme();
    const h = (location.hash || '').slice(1);
    UI.go(UI.VIEWS[h] ? h : 'dashboard');
    UI.renderDatalists();
    S.on(() => { UI.renderChrome(); UI.renderBody(); });
    if (!S.user) UI.signInModal();

    const clock = document.getElementById('clock');
    const tickClock = () => { const n = Date.now(); clock.textContent = `${U.dateLabel(n)} ${U.t24(n)}:${String(new Date(n).getSeconds()).padStart(2, '0')}`; };
    tickClock(); setInterval(tickClock, 1000);
    setInterval(() => { UI.renderChrome(); UI.renderBody(); }, 15000);
    setInterval(() => { alerts(); autoLock(); }, 5000);
    setTimeout(alerts, 1500);
    PE.alerts = alerts; // for the alert tests
    setInterval(() => leader && S.purge(), 30 * 60000);
    if (leader) S.purge();
  }

  window.addEventListener('DOMContentLoaded', () => {
    UI.mount();
    UI.applyTheme();
    const site = window.PULSEED_SITE || {};
    if (site.training) start('demo');
    else if (site.forceLive) start('live');
    else if (S.device.mode) start(S.device.mode);
    else UI.modeModal(mode => start(mode));
  });

  window.addEventListener('error', e => { try { UI.toast('Unexpected error: ' + e.message + ' — please report it. Your data is unaffected.', 'error'); } catch (x) { /* ignore */ } });
  window.addEventListener('unhandledrejection', e => { try { UI.toast((e.reason && e.reason.message) || 'Action failed.', 'error'); } catch (x) { /* ignore */ } });
})(window.PulseED);
