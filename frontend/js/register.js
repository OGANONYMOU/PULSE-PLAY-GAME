// ─────────────────────────────────────────────────────────────
//  PulsePay — Register
// ─────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {

  // ── Guard: opened as file:// instead of through server ──────
  if (window.location.protocol === 'file:') {
    showNotRunning();
    return;
  }

  // ── Check backend is alive ───────────────────────────────────
  const backendOk = await checkBackend();
  if (!backendOk) return;

  await initOAuthButtons();

  // ── Password strength meter ──────────────────────────────────
  const pwInput      = document.getElementById('password');
  const strengthBar  = document.getElementById('strengthBar');
  const strengthText = document.getElementById('strengthText');

  if (pwInput && strengthBar) {
    pwInput.addEventListener('input', () => {
      const { score, label, color } = getPasswordStrength(pwInput.value);
      strengthBar.style.width           = `${score}%`;
      strengthBar.style.backgroundColor = color;
      if (strengthText) {
        strengthText.textContent = pwInput.value ? label : '';
        strengthText.style.color = color;
      }
    });
  }

  // ── Registration form ────────────────────────────────────────
  const form      = document.getElementById('registerForm');
  const submitBtn = form?.querySelector('.signin-submit-btn');

  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearAlert();

    const firstName  = document.getElementById('firstName')?.value.trim();
    const lastName   = document.getElementById('lastName')?.value.trim();
    const username   = document.getElementById('username')?.value.trim();
    const email      = document.getElementById('email')?.value.trim();
    const phone      = document.getElementById('phone')?.value.trim();
    const password   = document.getElementById('password')?.value;
    const confirmPw  = document.getElementById('confirmPassword')?.value;
    const terms      = document.getElementById('terms')?.checked;

    // Validate
    if (!username || !email || !password || !confirmPw) {
      return showError('Please fill in all required fields.');
    }
    if (username.length < 3) {
      return showError('Username must be at least 3 characters.');
    }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      return showError('Username can only contain letters, numbers, and underscores.');
    }
    if (password.length < 8) {
      return showError('Password must be at least 8 characters.');
    }
    if (password !== confirmPw) {
      document.getElementById('confirmPassword')?.focus();
      return showError('Passwords do not match.');
    }
    if (!terms) {
      return showError('You must agree to the Terms of Service.');
    }

    setLoading(submitBtn, true, 'Creating account...');

    try {
      const res  = await fetch('/api/auth/register', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ firstName, lastName, username, email, phone, password })
      });
      const data = await res.json();

      if (!res.ok) {
        return showError(data.message || 'Registration failed. Please try again.');
      }

      localStorage.setItem('pp_token', data.data.token);
      localStorage.setItem('pp_user',  JSON.stringify(data.data.user));

      showSuccess(`Welcome to PulsePay, ${username}! Redirecting...`);
      setTimeout(() => { window.location.href = '/index.html'; }, 1400);

    } catch (err) {
      showError('Server error. Please try again.');
      console.error('[Register]', err);
    } finally {
      setLoading(submitBtn, false, 'Create Account');
    }
  });
});

// ── OAuth buttons ─────────────────────────────────────────────
async function initOAuthButtons() {
  let configured = {};
  try {
    const res  = await fetch('/api/auth/providers');
    const data = await res.json();
    configured = data.data || {};
  } catch { return; }

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
      btn.disabled = false;
      btn.title = '';
      btn.addEventListener('click', () => {
        btn.disabled = true;
        window.location.href = `/api/auth/${provider}`;
      });
    } else {
      btn.disabled = true;
      btn.style.opacity = '0.4';
      btn.style.cursor  = 'not-allowed';
      btn.title = `${capitalize(provider)} not configured`;
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        showError(`${capitalize(provider)} login isn't set up yet. Add the credentials to backend/.env`);
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
  const isFile = window.location.protocol === 'file:';
  const el = document.createElement('div');
  el.className = 'api-alert api-alert-error';
  el.style.cssText = 'margin-bottom:1.2rem;line-height:1.7';
  el.innerHTML = isFile
    ? `⚠️ <strong>You opened this file directly.</strong><br>
       Double-click <strong>start.bat</strong> to start the server,<br>
       then open <strong>http://localhost:5000</strong> in your browser.`
    : `⚠️ <strong>Server not responding.</strong><br>
       Run <code style="background:rgba(0,0,0,.3);padding:2px 6px;border-radius:4px">npm run dev</code>
       then visit <strong>http://localhost:5000</strong>`;
  container.prepend(el);
  document.querySelectorAll('input, button[type="submit"]').forEach(el => el.disabled = true);
}

// ── Password strength ─────────────────────────────────────────
function getPasswordStrength(pw) {
  let score = 0;
  if (pw.length >= 8)           score += 25;
  if (pw.length >= 12)          score += 15;
  if (/[A-Z]/.test(pw))        score += 20;
  if (/[0-9]/.test(pw))        score += 20;
  if (/[^A-Za-z0-9]/.test(pw)) score += 20;

  if (score <= 25) return { score: 25,  label: 'Weak',   color: '#ff006e' };
  if (score <= 50) return { score: 50,  label: 'Fair',   color: '#ff9500' };
  if (score <= 75) return { score: 75,  label: 'Good',   color: '#00d9ff' };
  return            { score: 100, label: 'Strong', color: '#00ff88' };
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
