// Anti-FOUC theme init. Runs before React so the correct theme is set on the
// very first paint. Served as a static file to satisfy the CSP (script-src 'self').
// Order of truth: the person's saved choice → the OS preference → light.
// Light stays the brand default; dark keeps the acolhedor soul, never a cold black.
(function () {
  var theme = null
  try {
    var saved = localStorage.getItem('prumo.theme')
    if (saved === 'dark' || saved === 'light') theme = saved
  } catch (e) {
    /* localStorage unavailable — fall through to the OS preference */
  }
  if (!theme) {
    // No explicit choice yet: follow the system. <meta name="color-scheme">
    // already promises we support both, so honouring it is the honest default.
    theme =
      window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
  }
  document.documentElement.dataset.theme = theme
})()
