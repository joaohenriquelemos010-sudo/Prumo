// Anti-FOUC theme init. Runs before React so the correct theme is set on the
// very first paint. Served as a static file to satisfy the CSP (script-src 'self').
// Light is the default (the acolhedor soul of the brand); dark only appears when
// the person has explicitly chosen it via the header toggle.
(function () {
  var theme = 'light'
  try {
    var saved = localStorage.getItem('prumo.theme')
    if (saved === 'dark') theme = 'dark'
  } catch (e) {
    /* localStorage unavailable — stay on light */
  }
  document.documentElement.dataset.theme = theme
})()
