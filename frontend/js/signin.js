// Frontend sign-in logic: calls backend API endpoints
document.addEventListener('DOMContentLoaded', () => {
  // Form submission to backend
  const form = document.querySelector('.signin-form');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('email')?.value || '';
      const password = document.getElementById('signinPassword')?.value || '';
      if (!email || !password) {
        alert('Please enter your email and password');
        return;
      }

      try {
        const res = await fetch('/api/auth/signin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });

        const json = await res.json();
        if (!res.ok) throw new Error(json?.message || 'Sign-in failed');

        // store token and redirect
        if (json?.data?.token) localStorage.setItem('auth_token', json.data.token);
        localStorage.setItem('userEmail', email);
        alert('Signed in successfully');
        window.location.href = 'community.html';
      } catch (err) {
        alert(err.message || 'Sign-in error');
      }
    });
  }

  // Add simple password toggle for sign-in password field
  function addSigninPasswordToggle() {
    const input = document.getElementById('signinPassword');
    if (!input) return;
    const wrapper = input.closest('.input-wrapper');
    if (!wrapper) return;
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'password-toggle';
    toggle.title = 'Show password';
    toggle.style.cssText = 'margin-left:8px; background:transparent; border:none; color:var(--text-secondary); cursor:pointer;';
    toggle.innerHTML = '👁️';
    toggle.addEventListener('click', () => {
      if (input.type === 'password') {
        input.type = 'text';
        toggle.title = 'Hide password';
      } else {
        input.type = 'password';
        toggle.title = 'Show password';
      }
    });
    wrapper.appendChild(toggle);
  }

  addSigninPasswordToggle();

  // Social/OAuth buttons now redirect to backend OAuth endpoints
  const socialButtons = document.querySelectorAll('.social-btn');
  socialButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      if (btn.classList.contains('google-btn')) window.location.href = '/api/auth/google';
      else if (btn.classList.contains('discord-btn')) window.location.href = '/api/auth/discord';
      else if (btn.classList.contains('facebook-btn')) window.location.href = '/api/auth/facebook';
      else if (btn.classList.contains('x-btn')) window.location.href = '/api/auth/twitter';
    });
  });
});
