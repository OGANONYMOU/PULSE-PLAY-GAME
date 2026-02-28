// ─────────────────────────────────────────────────────────────
//  PulsePay — Sign In
// ─────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {

  // ── Guard: opened as file:// instead of through server ──────
  if (window.location.protocol === 'file:') {
    showNotRunning();
    return;
  }

  // ── Already logged in — redirect ────────────────────────────
  if (typeof AUTH !== 'undefined' && AUTH.isLoggedIn()) {
    window.location.href = AUTH.isAdmin() ? '/admin/' : '/index.html';
    return;
  }

  // ── Check backend is alive + which OAuth providers exist ────
  const backendOk = await checkBackend();
  if (!backendOk) return; // showNotRunning() already called

  await initOAuthButtons();

  // ── Handle OAuth errors coming back from server ──────────────
  const qp = new URLSearchParams(window.location.search);
  const oauthError = qp.get('error');
  if (oauthError === 'not_configured') {
    const prov = qp.get('provider') || 'that provider';
    showError(`${capitalize(prov)} login is not set up yet. Use email/password instead.`);
  } else if (oauthError) {
    showError(qp.get('msg') || 'OAuth sign-in failed. Please try again.');
  }

  // ── Email / Password form ────────────────────────────────────
  const form      = document.querySelector('.signin-form');
  const submitBtn = form?.querySelector('.signin-submit-btn');

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearAlert();

    const email    = document.getElementById('email')?.value.trim();
    const password = document.getElementById('signinPassword')?.value;

    if (!email || !password) return showError('Please fill in all fields.');

    setLoading(submitBtn, true, 'Signing in...');
    try {
      const res  = await fetch('/api/auth/signin', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email, password })
      });
      const data = await res.json();

      if (!res.ok) return showError(data.message || 'Sign in failed. Check your email and password.');

      localStorage.setItem('pp_token', data.data.token);
      localStorage.setItem('pp_user',  JSON.stringify(data.data.user));

      showSuccess(`Welcome back, ${data.data.user.username}! Redirecting...`);

      const dest = (data.data.user.role === 'ADMIN' || data.data.user.role === 'MODERATOR')
        ? '/admin/'
        : '/index.html';
      setTimeout(() => { window.location.href = dest; }, 900);

    } catch (err) {
      showError('Server error. Please try again in a moment.');
      console.error('[SignIn]', err);
    } finally {
      setLoading(submitBtn, false, 'Sign In');
    }
  });
});

// ── OAuth Provider Init ───────────────────────────────────────
async function initOAuthButtons() {
  let configured = {};
  try {
    const res = await fetch('/api/auth/providers');
    const data = await res.json();
    configured = data.data || {};
  } catch {
    // If this fails, leave buttons in default disabled state
    return;
  }

  const providerMap = {
    google:   '.google-btn',
    discord:  '.discord-btn',
    facebook: '.facebook-btn',
    twitter:  '.x-btn',
  };

  Object.entries(providerMap).forEach(([provider, selector]) => {
    const btn = document.querySelector(selector);
    if (!btn) return;

    if (configured[provider]) {
      // Provider is configured — wire it up
      btn.disabled = false;
      btn.title = '';
      btn.addEventListener('click', () => {
        btn.disabled = true;
        const originalHTML = btn.innerHTML;
        btn.innerHTML = '<span style="display:inline-flex;align-items:center;gap:6px"><span class="spinner-sm"></span> Redirecting...</span>';
        // Restore if user comes back (browser back button)
        setTimeout(() => { btn.disabled = false; btn.innerHTML = originalHTML; }, 8000);
        window.location.href = `/api/auth/${provider}`;
      });
    } else {
      // Provider not configured — show tooltip, don't navigate
      btn.disabled = true;
      btn.style.opacity = '0.4';
      btn.style.cursor  = 'not-allowed';
      btn.title = `${capitalize(provider)} login not configured yet`;
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        showError(`${capitalize(provider)} login isn't set up yet. Add ${provider.toUpperCase()}_CLIENT_ID to backend/.env and restart the server.`);
      });
    }
  });
}

// ── Backend health check ──────────────────────────────────────
async function checkBackend() {
  try {
    const res = await fetch('/api/health', { signal: AbortSignal.timeout(4000) });
    return res.ok;
  } catch {
    showNotRunning();
    return false;
  }
}

function showNotRunning() {
  const container = document.querySelector('.signin-form-container');
  if (!container) return;
  clearAlert();
  const isFile = window.location.protocol === 'file:';
  const el = document.createElement('div');
  el.className = 'api-alert api-alert-error';
  el.style.cssText = 'margin-bottom:1.2rem;line-height:1.7';
  el.innerHTML = isFile
    ? `⚠️ <strong>You opened this file directly.</strong><br>
       You must start the server first:<br>
       <code style="background:rgba(0,0,0,.3);padding:2px 6px;border-radius:4px;font-size:.8rem">
         double-click start.bat (Windows)
       </code><br>
       Then open <strong>http://localhost:5000</strong> in your browser.`
    : `⚠️ <strong>Server not responding.</strong><br>
       Make sure you ran <code style="background:rgba(0,0,0,.3);padding:2px 6px;border-radius:4px;font-size:.8rem">npm run dev</code>
       and visit <strong>http://localhost:5000</strong>`;
  container.prepend(el);

  // Disable all form inputs
  document.querySelectorAll('input, button[type="submit"]').forEach(el => el.disabled = true);
}

// ── Helpers ───────────────────────────────────────────────────
function capitalize(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
function setLoading(btn, on, label) {
  if (!btn) return;
  btn.disabled = on;
  const span = btn.querySelector('span:first-child');
  if (span) span.textContent = label;
}
function showError(msg) {
  clearAlert();
  const el = document.createElement('div');
  el.className = 'api-alert api-alert-error';
  el.innerHTML = `⚠️ ${msg}`;
  document.querySelector('.signin-form-container')?.prepend(el);
}
function showSuccess(msg) {
  clearAlert();
  const el = document.createElement('div');
  el.className = 'api-alert api-alert-success';
  el.innerHTML = `✓ ${msg}`;
  document.querySelector('.signin-form-container')?.prepend(el);
}
function clearAlert() { document.querySelector('.api-alert')?.remove(); }
