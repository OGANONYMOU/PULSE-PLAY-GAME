// ─────────────────────────────────────────────────────────────
//  PulsePay — Client Auth Helper
//  Handles: token storage, logout, nav state, API fetch wrapper
// ─────────────────────────────────────────────────────────────

const AUTH = {
  TOKEN_KEY: 'pp_token',
  USER_KEY:  'pp_user',

  getToken()  { return localStorage.getItem(this.TOKEN_KEY); },
  getUser()   {
    try { return JSON.parse(localStorage.getItem(this.USER_KEY) || 'null'); }
    catch { return null; }
  },
  isLoggedIn(){ return !!this.getToken(); },
  isAdmin()   {
    const u = this.getUser();
    return u && (u.role === 'ADMIN' || u.role === 'MODERATOR');
  },

  signout() {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
    window.location.href = '/signin.html';
  },

  // Authenticated fetch wrapper — auto-adds Bearer token
  async apiFetch(path, options = {}) {
    const token = this.getToken();
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    };
    const res = await fetch(path, { ...options, headers });
    if (res.status === 401) {
      this.signout();
      return null;
    }
    return res;
  },

  // Update nav bar based on auth state
  updateNav() {
    const user = this.getUser();
    const signinBtn = document.querySelector('.signin-btn');
    const navEl = document.querySelector('nav');
    if (!signinBtn || !navEl) return;

    if (user) {
      signinBtn.innerHTML = `
        <div class="nav-user-menu">
          <img src="${user.profilePicture || `https://api.dicebear.com/7.x/initials/svg?seed=${user.username}`}"
               alt="${user.username}" class="nav-avatar">
          <span>${user.username}</span>
          <div class="nav-user-dropdown">
            ${AUTH.isAdmin() ? '<a href="/admin/">⚙️ Admin Panel</a>' : ''}
            <a href="#" onclick="AUTH.signout()">🚪 Sign Out</a>
          </div>
        </div>`;
      signinBtn.onclick = null;
    }
  },
};

// Inject nav-user-dropdown CSS once
(function injectStyles() {
  if (document.getElementById('auth-nav-styles')) return;
  const s = document.createElement('style');
  s.id = 'auth-nav-styles';
  s.textContent = `
    .nav-user-menu{position:relative;display:flex;align-items:center;gap:.5rem;cursor:pointer}
    .nav-avatar{width:32px;height:32px;border-radius:50%;border:2px solid var(--accent-cyan,#00d9ff);object-fit:cover}
    .nav-user-dropdown{position:absolute;top:calc(100% + 12px);right:0;background:#12121e;
      border:1px solid rgba(0,217,255,.2);border-radius:12px;min-width:170px;
      padding:.5rem 0;z-index:999;display:none;box-shadow:0 8px 32px rgba(0,0,0,.5)}
    .nav-user-menu:hover .nav-user-dropdown{display:block}
    .nav-user-dropdown a{display:block;padding:.6rem 1.2rem;color:rgba(255,255,255,.8);
      text-decoration:none;font-size:.85rem;transition:background .2s}
    .nav-user-dropdown a:hover{background:rgba(0,217,255,.1);color:#00d9ff}
  `;
  document.head.appendChild(s);
})();

// Auto-run on every page
document.addEventListener('DOMContentLoaded', () => AUTH.updateNav());
