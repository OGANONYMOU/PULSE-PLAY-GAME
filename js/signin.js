// Sign In Form Handler
const signinForm = document.querySelector('.signin-form');

signinForm.addEventListener('submit', (e) => {
  e.preventDefault(); // Prevent actual form submission
  
  const email = document.getElementById('email').value;
  const staySignedIn = document.getElementById('staySignedIn').checked;
  
  // For now, just log the values (you'll connect to backend later)
  console.log('Email:', email);
  console.log('Stay Signed In:', staySignedIn);
  
  // Show success message (temporary)
  alert('Sign in successful! (This is just frontend for now)');
  
  // Redirect to home page
  window.location.href = 'index.html';
});

// Social button handlers (for now just show alerts)
const socialBtns = document.querySelectorAll('.social-btn');

socialBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const platform = btn.textContent.trim().split('Continue with ')[1];
    alert(`${platform} sign-in will be implemented later!`);
  });
});
