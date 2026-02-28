// ─────────────────────────────────────────────────────────────
//  PulsePay — Main JS (runs on every page)
// ─────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {

  // ── Theme ──────────────────────────────────────────────────
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme === 'light') document.body.classList.add('light-mode');

  const themeToggle = document.getElementById('themeToggle');
  themeToggle?.addEventListener('click', () => {
    document.body.classList.toggle('light-mode');
    const isLight = document.body.classList.contains('light-mode');
    localStorage.setItem('theme', isLight ? 'light' : 'dark');
    themeToggle.textContent = isLight ? '🌙' : '☀️';
  });

  // ── Mobile nav ─────────────────────────────────────────────
  const menuToggle = document.getElementById('menuToggle');
  const navLinks   = document.querySelector('.nav-links');
  menuToggle?.addEventListener('click', () => {
    navLinks?.classList.toggle('open');
    menuToggle.classList.toggle('active');
  });

  // ── Logo error fallback ────────────────────────────────────
  document.querySelectorAll('.logo-img').forEach(img => {
    img.addEventListener('error', () => img.style.display = 'none');
  });

  // ── Highlight current nav link ─────────────────────────────
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-links a').forEach(a => {
    const href = a.getAttribute('href') || '';
    if (href === currentPage || (currentPage === '' && href === 'index.html')) {
      a.classList.add('active');
    }
  });

  // ── If opened as file://, show server-not-running warning ──
  if (window.location.protocol === 'file:') {
    injectFileProtocolBanner();
  }
});

function injectFileProtocolBanner() {
  // Only show on main pages, not in admin
  if (window.location.pathname.includes('/admin/')) return;

  const banner = document.createElement('div');
  banner.id = 'server-warning-banner';
  banner.innerHTML = `
    <strong>⚠️ Server not running.</strong>
    Double-click <strong>start.bat</strong> then open
    <a href="http://localhost:5000" style="color:#00d9ff">http://localhost:5000</a>
  `;
  Object.assign(banner.style, {
    position:   'fixed',
    top:        '0',
    left:       '0',
    right:      '0',
    background: 'rgba(255,0,110,0.9)',
    color:      '#fff',
    padding:    '10px 20px',
    textAlign:  'center',
    fontFamily: "'Space Mono', monospace",
    fontSize:   '0.85rem',
    zIndex:     '99999',
    backdropFilter: 'blur(8px)',
  });
  document.body.prepend(banner);
}
