// ─────────────────────────────────────────────────────────────
//  PulsePay Admin Dashboard
// ─────────────────────────────────────────────────────────────

const API = '/api/admin';
let currentSection = 'dashboard';
let userSearchTimer;

// ── Boot ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  // Auth guard
  if (!AUTH.isLoggedIn() || !AUTH.isAdmin()) {
    window.location.href = '../signin.html';
    return;
  }

  // Show user in topbar
  const u = AUTH.getUser();
  document.getElementById('topbarUser').innerHTML = `
    <img class="topbar-avatar"
         src="${u?.profilePicture || `https://api.dicebear.com/7.x/initials/svg?seed=${u?.username}`}"
         alt="${u?.username}">
    <span>${u?.username || 'Admin'}</span>`;

  // Nav routing
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', e => {
      e.preventDefault();
      showSection(item.dataset.section);
    });
  });

  // Sidebar toggle (mobile)
  document.getElementById('sidebarToggle')?.addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
  });

  // Hash routing
  const hash = window.location.hash.slice(1) || 'dashboard';
  showSection(hash);
});

function showSection(name) {
  currentSection = name;
  window.location.hash = name;

  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  const sec = document.getElementById(`section-${name}`);
  if (sec) sec.classList.add('active');
  document.querySelector(`[data-section="${name}"]`)?.classList.add('active');
  document.getElementById('topbarTitle').textContent =
    name.charAt(0).toUpperCase() + name.slice(1);

  // Load section data
  const loaders = {
    dashboard:   loadDashboard,
    users:       () => loadUsers(1),
    tournaments: () => loadTournaments(1),
    posts:       () => loadPosts(1),
    games:       loadGames,
  };
  loaders[name]?.();
}

function adminSignOut() {
  localStorage.removeItem('pp_token');
  localStorage.removeItem('pp_user');
  window.location.href = '../signin.html';
}

// ── API Helper ────────────────────────────────────────────────
async function apiCall(path, options = {}) {
  try {
    const res = await AUTH.apiFetch(`${API}${path}`, options);
    if (!res) return null;
    const data = await res.json();
    if (!data.success) throw new Error(data.message || 'Request failed');
    return data.data;
  } catch (err) {
    toast('error', err.message || 'Request failed');
    return null;
  }
}

// ── Dashboard ─────────────────────────────────────────────────
async function loadDashboard() {
  const stats = await apiCall('/stats');
  if (!stats) return;

  const { users, tournaments, posts, games, recentSignups } = stats;

  document.getElementById('kpi-users').textContent   = users.total.toLocaleString();
  document.getElementById('kpi-users-sub').textContent = `+${users.newToday} today • ${users.banned} banned`;
  document.getElementById('kpi-tournaments').textContent = tournaments.total.toLocaleString();
  document.getElementById('kpi-tournaments-sub').textContent = `${tournaments.active} active`;
  document.getElementById('kpi-posts').textContent   = posts.total.toLocaleString();
  document.getElementById('kpi-games').textContent   = games.total.toLocaleString();

  // KPI icon colors fix
  document.querySelectorAll('.kpi-icon').forEach(el => {
    const accent = el.closest('.kpi-card').style.getPropertyValue('--accent');
    el.style.color = accent;
    el.style.background = `${accent}18`;
  });

  // Recent signups table
  const tbody = document.getElementById('recentSignupsTbody');
  if (!recentSignups?.length) {
    tbody.innerHTML = '<tr><td colspan="4" class="loading-row">No users yet</td></tr>';
    return;
  }
  tbody.innerHTML = recentSignups.map(u => `
    <tr>
      <td><div class="user-cell">
        <img class="user-avatar" src="${u.profilePicture || `https://api.dicebear.com/7.x/initials/svg?seed=${u.username}`}" alt="${u.username}">
        <div><div class="user-name">${esc(u.username)}</div></div>
      </div></td>
      <td style="color:var(--text2)">${esc(u.email)}</td>
      <td>${roleBadge(u.role)}</td>
      <td style="color:var(--text2)">${timeAgo(u.createdAt)}</td>
    </tr>`).join('');
}

// ── Users ─────────────────────────────────────────────────────
async function loadUsers(page = 1) {
  const search = document.getElementById('userSearch')?.value.trim() || '';
  const role   = document.getElementById('roleFilter')?.value || '';
  const params = new URLSearchParams({ page, limit: 20, ...(search && { search }), ...(role && { role }) });

  document.getElementById('usersTbody').innerHTML = '<tr><td colspan="7" class="loading-row">Loading...</td></tr>';

  const data = await apiCall(`/users?${params}`);
  if (!data) return;

  const tbody = document.getElementById('usersTbody');
  if (!data.users.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="loading-row">No users found</td></tr>';
    return;
  }

  tbody.innerHTML = data.users.map(u => `
    <tr>
      <td><div class="user-cell">
        <img class="user-avatar" src="${u.profilePicture || `https://api.dicebear.com/7.x/initials/svg?seed=${u.username}`}" alt="${u.username}">
        <div>
          <div class="user-name">${esc(u.username)}</div>
          <div class="user-meta">${u._count.posts}p · ${u._count.comments}c · ${u._count.tournamentParticipations}t</div>
        </div>
      </div></td>
      <td style="color:var(--text2);font-size:.78rem">${esc(u.email)}</td>
      <td>${roleBadge(u.role)}</td>
      <td>${u.isBanned
        ? `<span class="badge badge-banned">Banned</span>`
        : `<span class="badge badge-active">Active</span>`}</td>
      <td style="color:var(--text2)">${u.loginCount}</td>
      <td style="color:var(--text2);font-size:.75rem">${timeAgo(u.createdAt)}</td>
      <td><div class="actions">
        <button class="btn-action btn-view"   onclick="viewUser('${u.id}')">View</button>
        <button class="btn-action btn-role"   onclick="changeRole('${u.id}','${u.username}','${u.role}')">Role</button>
        ${u.isBanned
          ? `<button class="btn-action btn-unban" onclick="unbanUser('${u.id}','${u.username}')">Unban</button>`
          : `<button class="btn-action btn-ban"   onclick="banUser('${u.id}','${u.username}')">Ban</button>`}
        <button class="btn-action btn-delete" onclick="deleteUser('${u.id}','${u.username}')">Delete</button>
      </div></td>
    </tr>`).join('');

  renderPagination('usersPagination', data.page, data.pages, (p) => loadUsers(p));
}

function debounceUserSearch(val) {
  clearTimeout(userSearchTimer);
  userSearchTimer = setTimeout(() => loadUsers(1), 350);
}

// User actions
async function viewUser(id) {
  const u = await apiCall(`/users/${id}`);
  if (!u) return;
  openModal('User Profile', `
    <div class="user-detail">
      <div class="ud-header">
        <img class="ud-avatar" src="${u.profilePicture || `https://api.dicebear.com/7.x/initials/svg?seed=${u.username}`}">
        <div>
          <div class="ud-name">${esc(u.username)}</div>
          <div class="ud-email">${esc(u.email)}</div>
        </div>
      </div>
      <div class="ud-grid">
        <div class="ud-item"><label>Role</label><span>${roleBadge(u.role)}</span></div>
        <div class="ud-item"><label>Status</label><span>${u.isBanned ? '<span class="badge badge-banned">Banned</span>' : '<span class="badge badge-active">Active</span>'}</span></div>
        <div class="ud-item"><label>Joined</label><span>${new Date(u.createdAt).toLocaleDateString()}</span></div>
        <div class="ud-item"><label>Last Login</label><span>${u.lastLoginAt ? timeAgo(u.lastLoginAt) : 'Never'}</span></div>
        <div class="ud-item"><label>Posts</label><span>${u._count.posts}</span></div>
        <div class="ud-item"><label>Tournaments</label><span>${u._count.tournamentParticipations}</span></div>
        <div class="ud-item"><label>Login Count</label><span>${u.loginCount}</span></div>
        <div class="ud-item"><label>Auth</label><span style="font-size:.72rem;color:var(--text2)">
          ${u.googleId ? '🔵 Google ' : ''}${u.discordId ? '🟣 Discord ' : ''}${u.facebookId ? '🔷 Facebook ' : ''}${u.twitterId ? '🐦 X/Twitter' : ''}${!u.googleId && !u.discordId && !u.facebookId && !u.twitterId ? '📧 Email' : ''}
        </span></div>
      </div>
      ${u.banReason ? `<p style="margin-top:1rem;color:var(--pink)">⚠️ Ban reason: ${esc(u.banReason)}</p>` : ''}
    </div>`, null);
}

async function changeRole(id, username, currentRole) {
  openModal(`Change Role — ${username}`, `
    <p>Set role for <strong>${esc(username)}</strong>:</p>
    <label>Role</label>
    <select id="newRole">
      <option value="USER"      ${currentRole==='USER'?'selected':''}>User</option>
      <option value="MODERATOR" ${currentRole==='MODERATOR'?'selected':''}>Moderator</option>
      <option value="ADMIN"     ${currentRole==='ADMIN'?'selected':''}>Admin</option>
    </select>`,
    async () => {
      const role = document.getElementById('newRole').value;
      const res = await apiCall(`/users/${id}/role`, {
        method: 'PATCH',
        body: JSON.stringify({ role })
      });
      if (res) { toast('success', `Role updated to ${role}`); closeModal(); loadUsers(1); }
    }, 'Update Role');
}

async function banUser(id, username) {
  openModal(`Ban User — ${username}`, `
    <p>You are about to ban <strong>${esc(username)}</strong>. They will not be able to sign in.</p>
    <label>Reason (optional)</label>
    <input type="text" id="banReason" placeholder="e.g. Spam, harassment...">`,
    async () => {
      const reason = document.getElementById('banReason').value;
      const res = await apiCall(`/users/${id}/ban`, { method: 'POST', body: JSON.stringify({ reason }) });
      if (res) { toast('success', `${username} has been banned`); closeModal(); loadUsers(1); }
    }, 'Ban User', true);
}

async function unbanUser(id, username) {
  const res = await apiCall(`/users/${id}/unban`, { method: 'POST', body: '{}' });
  if (res) { toast('success', `${username} unbanned`); loadUsers(1); }
}

async function deleteUser(id, username) {
  openModal(`Delete User — ${username}`, `
    <p style="color:var(--pink)">⚠️ This is irreversible. All data for <strong>${esc(username)}</strong> will be permanently deleted.</p>`,
    async () => {
      const res = await apiCall(`/users/${id}`, { method: 'DELETE' });
      if (res !== null) { toast('success', `${username} deleted`); closeModal(); loadUsers(1); }
    }, 'Delete Permanently', true);
}

// ── Tournaments ───────────────────────────────────────────────
async function loadTournaments(page = 1) {
  const status = document.getElementById('tournamentStatusFilter')?.value || '';
  const params = new URLSearchParams({ page, limit: 20, ...(status && { status }) });
  document.getElementById('tournamentsTbody').innerHTML = '<tr><td colspan="7" class="loading-row">Loading...</td></tr>';

  const data = await apiCall(`/tournaments?${params}`);
  if (!data) return;

  const tbody = document.getElementById('tournamentsTbody');
  if (!data.tournaments.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="loading-row">No tournaments found</td></tr>';
    return;
  }

  tbody.innerHTML = data.tournaments.map(t => `
    <tr>
      <td><div class="user-name">${esc(t.name)}</div></td>
      <td style="color:var(--text2)">${esc(t.game?.name || '—')}</td>
      <td>${statusBadge(t.status)}</td>
      <td style="color:var(--green)">₦${Number(t.prizePool).toLocaleString()}</td>
      <td style="color:var(--text2)">${t._count.participants} / ${t.maxParticipants}</td>
      <td style="color:var(--text2);font-size:.75rem">${new Date(t.startDate).toLocaleDateString()}</td>
      <td><div class="actions">
        <button class="btn-action btn-status" onclick="changeTournamentStatus('${t.id}','${t.name}','${t.status}')">Status</button>
        <button class="btn-action btn-delete" onclick="deleteTournament('${t.id}','${t.name}')">Delete</button>
      </div></td>
    </tr>`).join('');

  renderPagination('tournamentsPagination', data.page, data.pages, (p) => loadTournaments(p));
}

async function changeTournamentStatus(id, name, current) {
  openModal(`Update Status — ${name}`, `
    <label>Status</label>
    <select id="tStatus">
      ${['UPCOMING','ONGOING','COMPLETED','CANCELLED'].map(s =>
        `<option value="${s}" ${s===current?'selected':''}>${s}</option>`).join('')}
    </select>`,
    async () => {
      const status = document.getElementById('tStatus').value;
      const res = await apiCall(`/tournaments/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
      if (res) { toast('success', 'Status updated'); closeModal(); loadTournaments(1); }
    }, 'Update');
}

async function deleteTournament(id, name) {
  openModal(`Delete Tournament`, `
    <p style="color:var(--pink)">Delete <strong>${esc(name)}</strong>? All participants will be removed.</p>`,
    async () => {
      const res = await apiCall(`/tournaments/${id}`, { method: 'DELETE' });
      if (res !== null) { toast('success', 'Tournament deleted'); closeModal(); loadTournaments(1); }
    }, 'Delete', true);
}

// ── Posts ─────────────────────────────────────────────────────
async function loadPosts(page = 1) {
  const hidden = document.getElementById('postFilter')?.value;
  const params = new URLSearchParams({ page, limit: 20, ...(hidden !== '' && hidden !== undefined && { hidden }) });
  document.getElementById('postsTbody').innerHTML = '<tr><td colspan="7" class="loading-row">Loading...</td></tr>';

  const data = await apiCall(`/posts?${params}`);
  if (!data) return;

  const tbody = document.getElementById('postsTbody');
  if (!data.posts.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="loading-row">No posts found</td></tr>';
    return;
  }

  tbody.innerHTML = data.posts.map(p => `
    <tr>
      <td><div class="user-cell">
        <img class="user-avatar" src="${p.user?.profilePicture || `https://api.dicebear.com/7.x/initials/svg?seed=${p.user?.username}`}">
        <div class="user-name">${esc(p.user?.username || '?')}</div>
      </div></td>
      <td><div class="content-cell">${esc(p.content)}</div></td>
      <td><span class="badge badge-user" style="text-transform:capitalize">${p.category}</span></td>
      <td style="color:var(--text2)">🔥 ${p.likes}</td>
      <td>${p.isHidden
        ? '<span class="badge badge-hidden">Hidden</span>'
        : p.isPinned
          ? '<span class="badge badge-pinned">📌 Pinned</span>'
          : '<span class="badge badge-visible">Visible</span>'}</td>
      <td style="color:var(--text2);font-size:.75rem">${timeAgo(p.createdAt)}</td>
      <td><div class="actions">
        ${p.isHidden
          ? `<button class="btn-action btn-unhide" onclick="unhidePost('${p.id}')">Restore</button>`
          : `<button class="btn-action btn-hide"   onclick="hidePost('${p.id}')">Hide</button>`}
        ${!p.isPinned && !p.isHidden ? `<button class="btn-action btn-pin" onclick="pinPost('${p.id}')">Pin</button>` : ''}
        <button class="btn-action btn-delete" onclick="deletePost('${p.id}')">Delete</button>
      </div></td>
    </tr>`).join('');

  renderPagination('postsPagination', data.page, data.pages, (p) => loadPosts(p));
}

async function hidePost(id) {
  const res = await apiCall(`/posts/${id}/hide`, { method: 'PATCH', body: '{}' });
  if (res) { toast('success', 'Post hidden'); loadPosts(1); }
}
async function unhidePost(id) {
  const res = await apiCall(`/posts/${id}/unhide`, { method: 'PATCH', body: '{}' });
  if (res) { toast('success', 'Post restored'); loadPosts(1); }
}
async function pinPost(id) {
  const res = await apiCall(`/posts/${id}/pin`, { method: 'PATCH', body: '{}' });
  if (res) { toast('success', 'Post pinned'); loadPosts(1); }
}
async function deletePost(id) {
  openModal('Delete Post', '<p style="color:var(--pink)">Delete this post and all its comments?</p>',
    async () => {
      const res = await apiCall(`/posts/${id}`, { method: 'DELETE' });
      if (res !== null) { toast('success', 'Post deleted'); closeModal(); loadPosts(1); }
    }, 'Delete', true);
}

// ── Games ─────────────────────────────────────────────────────
async function loadGames() {
  const data = await apiCall('/games');
  if (!data) return;

  const tbody = document.getElementById('gamesTbody');
  if (!data.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="loading-row">No games found</td></tr>';
    return;
  }

  tbody.innerHTML = data.map(g => `
    <tr>
      <td><div class="user-cell">
        ${g.icon ? `<img class="user-avatar" src="${g.icon}" alt="${g.name}">` : '<div class="user-avatar" style="display:flex;align-items:center;justify-content:center;font-size:1rem">🎮</div>'}
        <div class="user-name">${esc(g.name)}</div>
      </div></td>
      <td><span class="badge badge-user">${esc(g.category)}</span></td>
      <td style="color:var(--text2)">${g.players.toLocaleString()}</td>
      <td style="color:var(--cyan)">${g._count.tournaments}</td>
      <td style="color:var(--text2)">⭐ ${g.rating.toFixed(1)}</td>
      <td>${g.isActive ? '<span class="badge badge-active">Active</span>' : '<span class="badge badge-banned">Inactive</span>'}</td>
    </tr>`).join('');
}

// ── Modal ─────────────────────────────────────────────────────
function openModal(title, body, onConfirm, confirmLabel = 'Confirm', isDanger = false) {
  document.getElementById('modalTitle').textContent = title;
  document.getElementById('modalBody').innerHTML = body;
  const footer = document.getElementById('modalFooter');
  footer.innerHTML = `<button class="btn-secondary" onclick="closeModal()">Cancel</button>`;
  if (onConfirm) {
    const btn = document.createElement('button');
    btn.className = isDanger ? 'btn-danger' : 'btn-primary';
    btn.textContent = confirmLabel;
    btn.onclick = onConfirm;
    footer.appendChild(btn);
  }
  document.getElementById('modalOverlay').classList.add('open');
}
function closeModal() { document.getElementById('modalOverlay').classList.remove('open'); }
// Prevent modal close on content click
document.getElementById('modal')?.addEventListener('click', e => e.stopPropagation());

// ── Pagination ────────────────────────────────────────────────
function renderPagination(containerId, current, total, onPage) {
  const el = document.getElementById(containerId);
  if (!el || total <= 1) { if(el) el.innerHTML=''; return; }

  let html = `<button class="page-btn" ${current===1?'disabled':''} onclick="(${onPage})(${current-1})">‹</button>`;
  for (let i = 1; i <= total; i++) {
    if (total > 7 && i > 2 && i < total-1 && Math.abs(i-current) > 1) {
      if (i === 3 || i === total-2) html += `<span style="color:var(--text2);padding:0 .3rem">…</span>`;
      continue;
    }
    html += `<button class="page-btn ${i===current?'active':''}" onclick="(${onPage})(${i})">${i}</button>`;
  }
  html += `<button class="page-btn" ${current===total?'disabled':''} onclick="(${onPage})(${current+1})">›</button>`;
  el.innerHTML = html;
}

// ── Toast ─────────────────────────────────────────────────────
function toast(type, msg) {
  const icons = { success: '✓', error: '⚠', info: 'ℹ' };
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.innerHTML = `<span>${icons[type] || '•'}</span> ${esc(msg)}`;
  document.getElementById('toastContainer').prepend(el);
  setTimeout(() => el.remove(), 3200);
}

// ── Utils ─────────────────────────────────────────────────────
function esc(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function timeAgo(dateStr) {
  const d = new Date(dateStr);
  const s = Math.floor((Date.now() - d) / 1000);
  if (s < 60)  return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s/60)}m ago`;
  if (s < 86400) return `${Math.floor(s/3600)}h ago`;
  if (s < 2592000) return `${Math.floor(s/86400)}d ago`;
  return d.toLocaleDateString();
}

function roleBadge(role) {
  const map = { ADMIN:'badge-admin', MODERATOR:'badge-mod', USER:'badge-user' };
  return `<span class="badge ${map[role]||'badge-user'}">${role}</span>`;
}

function statusBadge(status) {
  const map = { UPCOMING:'badge-upcoming', ONGOING:'badge-ongoing', COMPLETED:'badge-completed', CANCELLED:'badge-cancelled' };
  return `<span class="badge ${map[status]||'badge-user'}">${status}</span>`;
}
