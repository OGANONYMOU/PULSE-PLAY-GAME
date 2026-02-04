// Registration form helper: password strength and validation


function calculatePasswordStrength(password) {
  let strength = 0;
  if (password.length >= 8) strength++;
  if (password.length >= 12) strength++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++;
  if (/\d/.test(password)) strength++;
  if (/[^a-zA-Z\d]/.test(password)) strength++;
  return strength;
}

function updatePasswordStrengthDisplay(strength, strengthBar, strengthText) {
  const widthPercent = (strength / 5) * 100;
  if (strengthBar) strengthBar.style.width = widthPercent + '%';

  const strengthConfig = {
    weak: { color: '#ff006e', text: '⚠️ Weak password' },
    fair: { color: '#ffa500', text: '⚡ Fair password' },
    good: { color: '#00d9ff', text: '✓ Good password' },
    strong: { color: '#00ff00', text: '✓✓ Strong password' }
  };

  let config;
  if (strength <= 2) {
    config = strengthConfig.weak;
  } else if (strength === 3) {
    config = strengthConfig.fair;
  } else if (strength === 4) {
    config = strengthConfig.good;
  } else {
    config = strengthConfig.strong;
  }

  if (strengthBar) strengthBar.style.backgroundColor = config.color;
  if (strengthText) strengthText.textContent = config.text;
}

// Social buttons will redirect to backend OAuth endpoints

document.addEventListener('DOMContentLoaded', () => {
  const passwordInput = document.getElementById('password');
  const strengthBar = document.getElementById('strengthBar');
  const strengthText = document.getElementById('strengthText');
  const registerForm = document.getElementById('registerForm');

  if (passwordInput) {
    passwordInput.addEventListener('input', function() {
      const strength = calculatePasswordStrength(this.value);
      updatePasswordStrengthDisplay(strength, strengthBar, strengthText);
    });
  }

  if (registerForm) {
    registerForm.addEventListener('submit', async function(e) {
      e.preventDefault();
      const password = document.getElementById('password').value;
      const confirmPassword = document.getElementById('confirmPassword').value;
      const username = document.getElementById('username').value;
      const firstName = document.getElementById('firstName').value;
      const lastName = document.getElementById('lastName')?.value || '';
      const email = document.getElementById('email').value;
      const phone = document.getElementById('phone')?.value || '';

      if (username.length < 3) {
        alert('Username must be at least 3 characters long');
        return;
      }

      if (password !== confirmPassword) {
        alert('Passwords do not match');
        return;
      }

      if (calculatePasswordStrength(password) < 3) {
        alert('Password is too weak. Please use uppercase, lowercase, numbers, and special characters');
        return;
      }

      try {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, firstName, lastName, email, phone, password })
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.message || 'Registration failed');

        alert('Account created successfully! Redirecting to sign in page...');
        setTimeout(() => { globalThis.location.href = 'signin.html'; }, 900);
      } catch (err) {
        alert(err.message || 'Registration error');
      }
    });
  }

  // Social/OAuth buttons now redirect to backend OAuth endpoints
  document.querySelectorAll('.social-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      if (btn.classList.contains('google-btn')) window.location.href = '/api/auth/google';
      else if (btn.classList.contains('discord-btn')) window.location.href = '/api/auth/discord';
      else if (btn.classList.contains('facebook-btn')) window.location.href = '/api/auth/facebook';
      else if (btn.classList.contains('x-btn')) window.location.href = '/api/auth/twitter';
    });
  });

  // Add password visibility toggles for register form
  function addPasswordToggle(inputId) {
    const input = document.getElementById(inputId);
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

  addPasswordToggle('password');
  addPasswordToggle('confirmPassword');
});
