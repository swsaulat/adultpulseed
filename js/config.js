/* PulseED Reassessment Area Management System — default configuration. Every value here can be changed per site in Settings. */
(function (PE) {
  'use strict';

  PE.VERSION = '3.0.0';
  PE.PRODUCT = 'PulseED Reassessment Area Management System';

  PE.DEFAULT_SETTINGS = {
    schema: 3,
    siteName: 'Emergency Department',
    stationName: 'Reassessment Area',

    // Reassessment interval (minutes) per CTAS level, per CTAS guideline. 0 = continuous observation.
    ctasIntervals: { 'CTAS 1': 0, 'CTAS 2': 15, 'CTAS 3': 30, 'CTAS 4': 60, 'CTAS 5': 120 },
    // "Due soon" window = min(dueSoonMaxMin, interval × dueSoonFraction) so a 15-min CTAS 2 is not "due soon" 2/3 of the time.
    dueSoonMaxMin: 10,
    dueSoonFraction: 0.34,
    complianceGraceMin: 1,
    complianceTargetPct: 90,
    backdateMaxMin: 120,

    bedWaitAmberMin: 60,
    bedWaitRedMin: 120,
    procWaitAmberMin: 60,
    procWaitRedMin: 120,

    chimeRepeatMin: 2,
    longWaitRepeatMin: 15, // waiting for bed / procedure past its red limit: reminder sound every 15 min
    autoLockMin: 15,
    exitedRetentionHours: 72,
    eventRetentionHours: 168,

    teams: ['Team A', 'Team B', 'Team C'],
    // Offered when assigning or changing a patient's physician; any other name can also be typed.
    physicians: [],
    specialties: ['Cardiology', 'Emergency Medicine', 'General Surgery', 'Internal Medicine', 'Neurology', 'Obstetrics & Gynaecology',
      'Orthopaedics', 'Paediatrics', 'Plastic Surgery / Minor Care', 'Psychiatry', 'Respiratory', 'Trauma Surgery', 'Urology'],
    // Suggestions for Procedure / Treatment / Radiology Imaging requests; anything else can be typed.
    procedures: ['CT Head / Brain', 'CT Abdomen / Pelvis', 'CT Coronary Angiogram', 'CT Pulmonary Angiogram', 'Portable Chest X-Ray',
      'X-Ray Limb', 'Abdominal Ultrasound', 'FAST Ultrasound', 'MRI', 'ECG', 'Lumbar Puncture', 'Wound Repair / Suturing',
      'Tendon Repair & Suturing', 'Fracture Reduction', 'Procedural Sedation', 'IV Electrolyte Panel & Rehydration', 'Blood Transfusion'],
    // Suggestions when a bed is assigned (the 49 Adult ED beds); any other bed can be typed.
    beds: [
      'Trauma Bay / Bed 1 (Code Bed)', 'Trauma Bay / Bed 2', 'Trauma Bay / Bed 3', 'Trauma Bay / Bed 57 (NPR)', 'Trauma Bay / Bed 58 (NPR)',
      'Critical Care Unit / Bed 4', 'Critical Care Unit / Bed 5', 'Critical Care Unit / Bed 6', 'Critical Care Unit / Bed 7',
      'Critical Care Unit / Bed 8', 'Critical Care Unit / Bed 9', 'Critical Care Unit / Bed 10', 'Critical Care Unit / Bed 11',
      'Fast Track / Bed 12', 'Fast Track / Bed 13', 'Fast Track / Bed 14', 'Fast Track / Bed 15', 'Fast Track / Bed 16', 'Fast Track / Bed 17',
      'Fast Track / Bed 18', 'Fast Track / Bed 19', 'Fast Track / Bed 20', 'Fast Track / Bed 33 (NPR)', 'Fast Track / Bed 34 (NPR)',
      'Adult Care / Bed 21', 'Adult Care / Bed 22', 'Adult Care / Bed 23', 'Adult Care / Bed 24', 'Adult Care / Bed 25', 'Adult Care / Bed 26A',
      'Adult Care / Bed 26B (Treatment Area)', 'Adult Care / Bed 27 (Single Room)', 'Adult Care / Bed 28 (Single Room)', 'Adult Care / Bed 29 (Psych Room)',
      'Adult Care / Bed 30 (Treatment Area)', 'Adult Care / Bed 31',
      'Procedure Room / Bed 32',
      'RAZ / Bed 35', 'RAZ / Bed 36', 'RAZ / Bed 37', 'RAZ / Bed 38',
      'CDU / Bed 79 (Isolation)', 'CDU / Bed 80 (Isolation)', 'CDU / Bed 81 (Isolation)', 'CDU / Bed 82 (Isolation)',
      'CDU / Bed 83 (Isolation)', 'CDU / Bed 84 (Isolation)', 'CDU / Bed 85 (Isolation)', 'CDU / Bed 86 (Isolation)'],

    // Shared multi-workstation backend. "local" keeps data in this browser only (single station / training).
    backend: { mode: 'local', supabaseUrl: '', supabaseAnonKey: '', facilityId: '' },
  };

  // [start, name] of each shift. Doctors' 8-hour shifts set the emailed reports; nursing's 12-hour shifts are a view.
  PE.SHIFT_PATTERNS = {
    doctor: { label: 'Doctors', hours: 8, shifts: [['06:00', 'Morning'], ['14:00', 'Evening'], ['22:00', 'Night']] },
    nursing: { label: 'Nursing', hours: 12, shifts: [['07:00', 'Day'], ['19:00', 'Night']] },
  };

  // ED Leader = directors, unit heads, head nurses: the detailed view (analytics, audit, exports) and settings.
  // Admin = the same plus Staff & Access. Physician TL = physician team leader. Everyone else uses the station workflows.
  PE.ROLES = ['Nurse', 'Charge Nurse', 'Physician', 'Physician TL', 'Bed Coordinator', 'ED Leader', 'Admin'];
  // Who can export the handover PDF for each shift pattern.
  PE.SHIFT_EXPORT_ROLES = { nursing: ['Charge Nurse', 'ED Leader', 'Admin'], doctor: ['Physician TL', 'ED Leader', 'Admin'] };
  PE.SUPERVISOR_ROLES = ['Charge Nurse', 'ED Leader', 'Admin'];
  // Spreadsheets (Excel exports, the Google Sheet register) are for these roles only.
  PE.LEADER_ROLES = ['ED Leader', 'Admin'];
})(window.PulseED);
