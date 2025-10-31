// Menu toggle functionality
const menuToggle = document.getElementById('menuToggle');
const nav = document.querySelector('nav');
const body = document.body;

// Toggle menu on click
menuToggle.addEventListener('click', () => {
  nav.classList.toggle('active');
  menuToggle.classList.toggle('open');
  body.classList.toggle('menu-open'); // prevents background scrolling
});

// Keyboard accessibility - Open/close menu with Enter or Spacebar
menuToggle.addEventListener('keypress', (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault(); // Prevents page from scrolling when spacebar is pressed
    menuToggle.click(); // Trigger the click event
  }
});

// Close menu when clicking on a nav link (good UX for mobile)
const navLinksItems = document.querySelectorAll('.nav-links a');
navLinksItems.forEach(link => {
  link.addEventListener('click', () => {
    nav.classList.remove('active');
    menuToggle.classList.remove('open');
    body.classList.remove('menu-open');
  });
});

// Close menu when clicking outside of it (modern UX pattern)
document.addEventListener('click', (e) => {
  const isClickInsideNav = nav.contains(e.target);
  const isClickOnToggle = menuToggle.contains(e.target);
  
  // Only close if menu is open AND click was outside both nav and toggle button
  if (nav.classList.contains('active') && !isClickInsideNav && !isClickOnToggle) {
    nav.classList.remove('active');
    menuToggle.classList.remove('open');
    body.classList.remove('menu-open');
  }
});

// Close menu with Escape key (accessibility & UX best practice)
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && nav.classList.contains('active')) {
    nav.classList.remove('active');
    menuToggle.classList.remove('open');
    body.classList.remove('menu-open');
  }
});