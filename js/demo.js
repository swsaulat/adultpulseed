/* PulseED Reassessment Area — training data. Built by replaying real actions through the rules engine, so training
 * exercises the same rules, audit trail and reports as live use. Names are made up. */
(function (PE) {
  'use strict';
  const U = PE.util, D = PE.domain;

  function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  const STAFF = [['Nurse J. Doe', 'Nurse'], ['Nurse K. Malik', 'Nurse'], ['CN R. Alvarez', 'Charge Nurse'], ['Bed Coord R. Smith', 'Bed Coordinator'], ['Dr A. Thorne', 'Physician']];
  const FIRST = ['Alex', 'Sam', 'Jordan', 'Taylor', 'Casey', 'Riley', 'Morgan', 'Jamie', 'Avery', 'Quinn', 'Rowan', 'Skyler', 'Reese', 'Dakota', 'Emerson', 'Harper'];
  const LAST = ['Demo', 'Sample', 'Testcase', 'Training', 'Example', 'Mock', 'Placeholder'];
  const DX = ['Chest pain', 'Abdominal pain', 'Fall — hip pain', 'Shortness of breath', 'Headache', 'Fever', 'Laceration forearm', 'Back pain', 'Syncope', 'Allergic reaction', 'Ankle injury', 'Vomiting', 'Palpitations', 'Dizziness'];
  const PHYS = ['Dr Aris Thorne', 'Dr Elena Vance', 'Dr Mark Roberts', 'Dr Sara Haddad'];
  const KIND = [['Radiology Imaging', 'CT Head / Brain'], ['Radiology Imaging', 'Portable Chest X-Ray'], ['Radiology Imaging', 'Abdominal Ultrasound'], ['Treatment', 'IV antibiotics'],
    ['Treatment', 'IV fluids & electrolytes'], ['Procedure', 'Wound Repair / Suturing'], ['Procedure', 'Fracture Reduction'], ['Radiology Imaging', 'X-Ray Limb']];
  const REASONS = ['Discharged home', 'Discharged home', 'Discharged home', 'Discharged home', 'DAMA', 'LWBS', 'Absconded', 'Transferred'];

  PE.demo = {
    build(settings, now = Date.now()) {
      const r = rng(20261109);
      const pick = a => a[Math.floor(r() * a.length)];
      const between = (a, b) => a + r() * (b - a);
      const M = 60000;
      const acts = []; // { t, type, payload, who }
      const add = (t, type, payload, who) => acts.push({ t: Math.round(t), type, payload, who: who || pick(STAFF) });

      // ---------- 24 h of history (patients who have left) so reports have real data
      for (let i = 0; i < 90; i++) {
        const id = U.uuid();
        const t0 = now - between(26 * 60, 3 * 60) * M;
        const hour = new Date(t0).getHours();
        const surge = hour >= 10 && hour <= 20 ? 1.35 : 1; // daytime crowding lengthens waits
        const ctas = pick(['CTAS 2', 'CTAS 3', 'CTAS 3', 'CTAS 3', 'CTAS 4', 'CTAS 4', 'CTAS 5']);
        const wf = { vitals: r() < 0.85, bed: r() < 0.55, procedure: r() < 0.4 };
        if (!wf.vitals && !wf.bed && !wf.procedure) wf.vitals = true;
        const k = pick(KIND), k2 = r() < 0.3 ? pick(KIND.filter(x => x[1] !== k[1])) : null;
        let end = t0 + between(45, 200) * surge * M;
        add(t0, 'ADMIT', {
          id, urn: 'D-' + (30000 + i), name: `${pick(FIRST)} ${pick(LAST)}`, ctas, diagnosis: pick(DX), physician: pick(PHYS), team: pick(settings.teams),
          workflows: wf, bookedBy: pick(PHYS), specialty: r() < 0.6 ? pick(settings.specialties) : '',
          orders: [{ kind: k[0], description: k[1] }].concat(k2 ? [{ kind: k2[0], description: k2[1] }] : []),
        }, STAFF[0]);
        if (wf.procedure) {
          (k2 ? [1, 2] : [1]).forEach(n => {
            const go = t0 + between(8, 25) * M, done = go + between(15, 50) * surge * M;
            add(go, 'UPDATE_PROCEDURE', { id, itemId: id + ':o' + n, status: 'In Progress' });
            if (done < end - 2 * M) add(done, 'UPDATE_PROCEDURE', { id, itemId: id + ':o' + n, status: 'Done' });
          });
        }
        if (r() < 0.12) add(t0 + between(10, 40) * M, 'ADD_NOTE', { id, type: 'cnr', text: '' });
        if (wf.vitals) {
          const iv = settings.ctasIntervals[ctas];
          for (let t = t0 + iv * between(0.6, 1.2) * M; t < end - M; t += iv * between(0.65, r() < 0.12 ? 1.6 : 1.05) * M) add(t, 'RECORD_REASSESSMENT', { id });
        }
        const hb = settings.beds[i % settings.beds.length]; // one bed per patient at a time, as on the floor
        if (wf.bed && i < settings.beds.length) add(end - between(5, 40) * M, 'ASSIGN_BED', { id, bed: hb }, STAFF[3]); // the rest are placed straight away
        add(end, 'EXIT', wf.bed ? { id, type: 'bed', bed: hb } : { id, type: 'discharged', reason: pick(REASONS) }, STAFF[1]);
      }

      // ---------- in the reassessment area now
      const P = (urn, enc, name, ctas, diagnosis, physician) => ({ id: U.uuid(), urn, encounterId: enc, name, ctas, diagnosis, physician, team: '' });
      const admit = (p, min, wf, extra = {}) => add(now - min * M, 'ADMIT', Object.assign({}, p, { workflows: wf }, extra), STAFF[0]);
      const book = (p, min, by, spec) => add(now - min * M, 'START_WORKFLOW', { id: p.id, wf: 'bed', bookedBy: by, specialty: spec || '' }, STAFF[4]);
      const vit = (p, ...mins) => mins.forEach(m => add(now - m * M, 'RECORD_REASSESSMENT', { id: p.id }));
      const ord = (p, n, min, status) => add(now - min * M, 'UPDATE_PROCEDURE', { id: p.id, itemId: p.id + ':o' + n, status });
      const assign = (p, min, bed) => add(now - min * M, 'ASSIGN_BED', { id: p.id, bed }, STAFF[2]);
      const cnr = (p, min, text) => add(now - min * M, 'ADD_NOTE', { id: p.id, type: 'cnr', text: text || '' }, STAFF[1]);
      const note = (p, min, type, text) => add(now - min * M, 'ADD_NOTE', { id: p.id, type, text }, STAFF[0]);

      const a1 = P('P-40921', 'ENC-88392', 'Sarah Jenkins', 'CTAS 2', 'Acute chest pain', 'Dr Aris Thorne');
      admit(a1, 50, { vitals: true, procedure: true }, { kind: 'Radiology Imaging', description: 'CT Coronary Angiogram' });
      vit(a1, 33, 20); book(a1, 25, 'Dr Aris Thorne', 'Cardiology');
      ord(a1, 1, 30, 'In Progress');

      const a2 = P('P-40912', 'ENC-88311', "Michael O'Neill", 'CTAS 3', 'Severe abdominal pain', 'Dr Elena Vance');
      admit(a2, 60, { vitals: true, procedure: true }, { kind: 'Radiology Imaging', description: 'Abdominal Ultrasound' });
      vit(a2, 30); cnr(a2, 26, 'Called in the waiting area and at the toilets.'); cnr(a2, 14);

      const a3 = P('P-40935', 'ENC-88402', 'Emily Chen', 'CTAS 1', 'Polytrauma / MVC', 'Dr Mark Roberts');
      admit(a3, 12, { vitals: true, bed: true }, { bookedBy: 'Dr Mark Roberts', specialty: 'Trauma Surgery' });
      assign(a3, 4, 'Trauma Bay / Bed 2');

      const a4 = P('P-40954', 'ENC-88510', 'David Ross', 'CTAS 4', 'Laceration hand', 'Dr Aris Thorne');
      admit(a4, 40, { procedure: true }, { kind: 'Procedure', description: 'Wound Repair / Suturing' });

      const a5 = P('P-40978', 'ENC-88621', 'Aisha Patel', 'CTAS 3', 'Suspected renal colic', 'Dr Elena Vance');
      admit(a5, 45, { vitals: true, bed: true }, { bookedBy: 'Dr Elena Vance', specialty: 'Urology' });
      vit(a5, 28);

      const a6 = P('P-40989', 'ENC-88730', 'Robert Taylor', 'CTAS 2', 'Shortness of breath', 'Dr Mark Roberts');
      admit(a6, 35, { vitals: true, procedure: true }, { orders: [{ kind: 'Radiology Imaging', description: 'Portable Chest X-Ray' }, { kind: 'Treatment', description: 'Salbutamol nebuliser' }] });
      vit(a6, 30); ord(a6, 1, 20, 'In Progress'); ord(a6, 2, 28, 'Done');

      const a7 = P('P-40995', 'ENC-88812', 'Maria Garcia', 'CTAS 3', 'Vomiting & dehydration', 'Dr Sara Haddad');
      admit(a7, 140, { vitals: true, bed: true, procedure: true }, { bookedBy: 'Dr Sara Haddad', specialty: 'Internal Medicine', orders: [{ kind: 'Treatment', description: 'IV fluids & electrolytes' }, { kind: 'Radiology Imaging', description: 'Abdominal Ultrasound' }, { kind: 'Treatment', description: 'IV antiemetic' }] });
      vit(a7, 110, 80, 48, 16); ord(a7, 1, 120, 'In Progress'); ord(a7, 3, 125, 'Done');
      note(a7, 47, 'medication', 'Ondansetron 4 mg IV given; nausea settling.');

      const a8 = P('P-41003', '', 'Jordan Sample', 'CTAS 3', 'Fall — suspected hip fracture', 'Dr Aris Thorne');
      admit(a8, 155, { vitals: true, procedure: true }, { kind: 'Radiology Imaging', description: 'X-Ray Limb' });
      vit(a8, 120, 88, 57); ord(a8, 1, 100, 'Done');
      note(a8, 90, 'pain', 'Pain 7/10 → 4/10 after analgesia.');
      book(a8, 70, 'Dr Aris Thorne', 'Orthopaedics'); assign(a8, 22, 'Adult Care / Bed 23');

      const a9 = P('P-41011', '', 'Casey Example', 'CTAS 2', 'Head injury on anticoagulant', 'Dr Elena Vance');
      admit(a9, 22, { vitals: true, procedure: true }, { kind: 'Radiology Imaging', description: 'CT Head / Brain' });
      vit(a9, 12); note(a9, 10, 'escalated', 'GCS 15, new vomiting; Dr Vance informed.');

      const a10 = P('P-41020', '', 'Riley Testcase', 'CTAS 4', 'Ankle injury', 'Dr Sara Haddad');
      admit(a10, 95, { procedure: true }, { kind: 'Radiology Imaging', description: 'X-Ray Limb' });
      ord(a10, 1, 15, 'Done'); // nothing left open: shows "record the exit"

      const a11 = P('P-41030', '', 'Harper Demo', 'CTAS 3', 'Pneumonia', 'Dr Mark Roberts');
      admit(a11, 210, { vitals: true, bed: true, procedure: true }, { bookedBy: 'Dr Mark Roberts', specialty: 'Internal Medicine', kind: 'Treatment', description: 'IV antibiotics' });
      vit(a11, 180, 150, 121, 90, 61, 30); ord(a11, 1, 170, 'Done');
      assign(a11, 52, 'Adult Care / Bed 25'); // assigned 52 min ago, still not moved: shows the "not placed" alert

      const a12 = P('P-41042', '', 'Morgan Arrival', 'CTAS 4', 'Sore throat and fever', 'Unassigned');
      admit(a12, 6, { vitals: true }); cnr(a12, 3);

      acts.sort((x, y) => x.t - y.t);
      let st = D.emptyState(), skipped = 0;
      acts.forEach(a => {
        const ctx = { user: { name: a.who[0], role: a.who[1] }, device: 'Demo Station', now: a.t, settings };
        try { st = D.apply(st, { type: a.type, payload: a.payload }, ctx).state; } catch (e) { skipped++; }
      });
      // Overdue alerts the system would have logged.
      D.activePatients(st).forEach(p => { st = D.apply(st, { type: 'SYSTEM_OVERDUE', payload: { id: p.id } }, { user: { name: 'System', role: 'System' }, device: 'Demo Station', now, settings }).state; });
      st.demo = true;
      return { state: st, skipped };
    },
  };
})(window.PulseED);
