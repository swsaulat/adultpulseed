/* PulseED (Adult ED contract) — deployment configuration.
 * apiUrl = the contract's own Apps Script web app (PulseED Adult ED Register), never the PatientFlow MS product register.
 * Leave apiUrl empty for local / training use (data stays in this browser). */
window.PULSEED_SITE = {
  backend: { mode: 'google', apiUrl: '' },
  forceLive: false,
};
// ?training opens Training / Demo mode: synthetic patients kept in this browser only, never the live register.
window.PULSEED_SITE.training = /[?&]training(=|&|$)/.test(location.search);
// Live only on the contract's own address; anywhere else (localhost, file preview) the training/demo option stays available.
if (location.hostname === 'adultpulseed.patientflowms.com' && window.PULSEED_SITE.backend.apiUrl && !window.PULSEED_SITE.training) window.PULSEED_SITE.forceLive = true;
