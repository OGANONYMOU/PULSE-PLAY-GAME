// ============================================
// MODERN 3D ENHANCED JAVASCRIPT
// ============================================

// ============================================
// THEME TOGGLE (Dark/Light Mode)
// ============================================
function initThemeToggle() {
  const themeToggle = document.getElementById('themeToggle');
  const body = document.body;
  
  // Check saved theme preference or system preference
  const savedTheme = localStorage.getItem('theme') || 'dark';
  const systemPrefersDark = globalThis.matchMedia('(prefers-color-scheme: dark)').matches;
  const isDarkPreferred = systemPrefersDark ? 'dark' : 'light';
  const initialTheme = localStorage.getItem('theme') ? savedTheme : isDarkPreferred;
  
  // Apply initial theme
  if (initialTheme === 'light') {
    body.classList.add('light-mode');
    if (themeToggle) themeToggle.textContent = '🌙';
  } else {
    body.classList.remove('light-mode');
    if (themeToggle) themeToggle.textContent = '☀️';
  }
  
  localStorage.setItem('theme', initialTheme);
  
  // Toggle theme on button click
  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      body.classList.toggle('light-mode');
      const isLightMode = body.classList.contains('light-mode');
      themeToggle.textContent = isLightMode ? '🌙' : '☀️';
      localStorage.setItem('theme', isLightMode ? 'light' : 'dark');
      
      // Add rotation animation
      themeToggle.style.transform = 'rotate(20deg)';
      setTimeout(() => {
        themeToggle.style.transform = 'rotate(0deg)';
      }, 300);
    });
  }
}

document.addEventListener('DOMContentLoaded', initThemeToggle);

// Menu toggle functionality
const menuToggle = document.getElementById('menuToggle');
const nav = document.querySelector('nav');
const body = document.body;

// Toggle menu on click
if (menuToggle && nav) {
  menuToggle.addEventListener('click', () => {
    nav.classList.toggle('active');
    menuToggle.classList.toggle('open');
    body.classList.toggle('menu-open');
  });

  // Keyboard accessibility
  menuToggle.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      menuToggle.click();
    }
  });

  // Close menu when clicking on a nav link
  const navLinksItems = document.querySelectorAll('.nav-links a');
  navLinksItems.forEach(link => {
    link.addEventListener('click', () => {
      nav.classList.remove('active');
      menuToggle.classList.remove('open');
      body.classList.remove('menu-open');
    });
  });

  // Close menu when clicking outside
  document.addEventListener('click', (e) => {
    const isClickInsideNav = nav.contains(e.target);
    const isClickOnToggle = menuToggle.contains(e.target);
    
    if (nav.classList.contains('active') && !isClickInsideNav && !isClickOnToggle) {
      nav.classList.remove('active');
      menuToggle.classList.remove('open');
      body.classList.remove('menu-open');
    }
  });

  // Close menu with Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && nav.classList.contains('active')) {
      nav.classList.remove('active');
      menuToggle.classList.remove('open');
      body.classList.remove('menu-open');
    }
  });
}

// ============================================
// 3D PARTICLE SYSTEM
// ============================================
function createParticles() {
  const particlesContainer = document.getElementById('particles');
  if (!particlesContainer) return;

  const particleCount = 50;
  
  for (let i = 0; i < particleCount; i++) {
    const particle = document.createElement('div');
    particle.className = 'particle';
    
    // Random positioning
    const x = Math.random() * 100;
    const y = Math.random() * 100;
    const size = Math.random() * 3 + 1;
    const duration = Math.random() * 20 + 10;
    const delay = Math.random() * 5;
    
    particle.style.cssText = `
      position: absolute;
      left: ${x}%;
      top: ${y}%;
      width: ${size}px;
      height: ${size}px;
      background: radial-gradient(circle, rgba(0, 217, 255, 0.8), rgba(157, 78, 221, 0.8));
      border-radius: 50%;
      animation: particleFloat ${duration}s infinite ease-in-out;
      animation-delay: ${delay}s;
      box-shadow: 0 0 10px rgba(0, 217, 255, 0.5);
    `;
    
    particlesContainer.appendChild(particle);
  }
}

// Add particle animation to CSS dynamically
const particleStyle = document.createElement('style');
particleStyle.textContent = `
  @keyframes particleFloat {
    0%, 100% {
      transform: translate(0, 0) scale(1);
      opacity: 0.3;
    }
    25% {
      transform: translate(30px, -30px) scale(1.2);
      opacity: 0.6;
    }
    50% {
      transform: translate(-20px, 20px) scale(0.8);
      opacity: 0.4;
    }
    75% {
      transform: translate(40px, -10px) scale(1.1);
      opacity: 0.7;
    }
  }
`;
document.head.appendChild(particleStyle);

// Initialize particles on page load
document.addEventListener('DOMContentLoaded', createParticles);

// ============================================
// 3D TILT EFFECT FOR CARDS
// ============================================
function init3DTilt() {
  const cards = document.querySelectorAll('[data-tilt]');
  
  cards.forEach(card => {
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      
      const rotateX = ((y - centerY) / centerY) * 10;
      const rotateY = ((centerX - x) / centerX) * 10;
      
      card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.05, 1.05, 1.05)`;
    });
    
    card.addEventListener('mouseleave', () => {
      card.style.transform = 'perspective(1000px) rotateX(0) rotateY(0) scale3d(1, 1, 1)';
    });
  });
}

// Initialize 3D tilt on page load
document.addEventListener('DOMContentLoaded', init3DTilt);

// ============================================
// SMOOTH SCROLL WITH PARALLAX
// ============================================
let lastScrollTop = 0;

window.addEventListener('scroll', () => {
  const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
  
  // Parallax effect for floating cubes
  const cubes = document.querySelectorAll('.floating-cube');
  cubes.forEach((cube, index) => {
    const speed = 0.5 + (index * 0.2);
    const yPos = scrollTop * speed;
    cube.style.transform = `translate3d(0, ${yPos}px, 0)`;
  });
  
  // Navbar background on scroll
  const navbar = document.querySelector('.navbar');
  if (navbar) {
    if (scrollTop > 50) {
      navbar.style.background = 'rgba(26, 26, 36, 0.95)';
      navbar.style.boxShadow = '0 4px 30px rgba(0, 0, 0, 0.7)';
    } else {
      navbar.style.background = 'rgba(26, 26, 36, 0.8)';
      navbar.style.boxShadow = '0 4px 30px rgba(0, 0, 0, 0.5)';
    }
  }
  
  lastScrollTop = scrollTop;
});

// ============================================
// INTERSECTION OBSERVER FOR ANIMATIONS
// ============================================
function initScrollAnimations() {
  const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -100px 0px'
  };
  
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = '1';
        entry.target.style.transform = 'translateY(0)';
      }
    });
  }, observerOptions);
  
  // Observe elements with animation classes
  const animatedElements = document.querySelectorAll('.stat-card, .card-3d, .featured-text, .featured-visual');
  animatedElements.forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(50px)';
    el.style.transition = 'opacity 0.8s ease, transform 0.8s ease';
    observer.observe(el);
  });
}

// Initialize scroll animations on page load
document.addEventListener('DOMContentLoaded', initScrollAnimations);

// ============================================
// CURSOR TRAIL EFFECT (OPTIONAL - DESKTOP ONLY)
// ============================================
function initCursorTrail() {
  if (window.innerWidth < 768) return; // Skip on mobile
  
  const trail = [];
  const trailLength = 20;
  
  document.addEventListener('mousemove', (e) => {
    // Create trail element
    const dot = document.createElement('div');
    dot.style.cssText = `
      position: fixed;
      left: ${e.clientX}px;
      top: ${e.clientY}px;
      width: 4px;
      height: 4px;
      background: radial-gradient(circle, rgba(0, 217, 255, 0.6), rgba(157, 78, 221, 0.6));
      border-radius: 50%;
      pointer-events: none;
      z-index: 9999;
      animation: cursorFade 0.6s ease-out forwards;
    `;
    
    document.body.appendChild(dot);
    trail.push(dot);
    
    // Remove old trail elements
    if (trail.length > trailLength) {
      const oldDot = trail.shift();
      oldDot.remove();
    }
  });
  
  // Add fade animation
  const cursorStyle = document.createElement('style');
  cursorStyle.textContent = `
    @keyframes cursorFade {
      to {
        opacity: 0;
        transform: scale(0);
      }
    }
  `;
  document.head.appendChild(cursorStyle);
}

// Initialize cursor trail on page load (desktop only)
document.addEventListener('DOMContentLoaded', initCursorTrail);

// ============================================
// NUMBER COUNTER ANIMATION FOR STATS
// ============================================
function animateCounter(element, target, duration = 2000) {
  const start = 0;
  const increment = target / (duration / 16);
  let current = start;
  
  const timer = setInterval(() => {
    current += increment;
    if (current >= target) {
      element.textContent = target + (element.textContent.includes('+') ? '+' : '');
      clearInterval(timer);
    } else {
      element.textContent = Math.floor(current) + (element.textContent.includes('+') ? '+' : '');
    }
  }, 16);
}

function initCounterAnimations() {
  const statNumbers = document.querySelectorAll('.stat-number');
  
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting && !entry.target.classList.contains('counted')) {
        entry.target.classList.add('counted');
        const text = entry.target.textContent;
        const numberStr = text.replaceAll(/\D/g, '');
        const number = Number.parseInt(numberStr, 10);
        
        if (number) {
          entry.target.textContent = '0';
          setTimeout(() => {
            animateCounter(entry.target, number);
          }, 300);
        }
      }
    });
  }, { threshold: 0.5 });
  
  statNumbers.forEach(stat => observer.observe(stat));
}

// Initialize counter animations on page load
document.addEventListener('DOMContentLoaded', initCounterAnimations);

// ============================================
// BUTTON RIPPLE EFFECT
// ============================================
function createRipple(event) {
  const button = event.currentTarget;
  const ripple = document.createElement('span');
  const rect = button.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height);
  const x = event.clientX - rect.left - size / 2;
  const y = event.clientY - rect.top - size / 2;
  
  ripple.style.cssText = `
    position: absolute;
    width: ${size}px;
    height: ${size}px;
    left: ${x}px;
    top: ${y}px;
    background: radial-gradient(circle, rgba(255, 255, 255, 0.4), transparent);
    border-radius: 50%;
    transform: scale(0);
    animation: rippleEffect 0.6s ease-out;
    pointer-events: none;
  `;
  
  button.style.position = 'relative';
  button.style.overflow = 'hidden';
  button.appendChild(ripple);
  
  setTimeout(() => ripple.remove(), 600);
}

// Add ripple effect to buttons
const rippleStyle = document.createElement('style');
rippleStyle.textContent = `
  @keyframes rippleEffect {
    to {
      transform: scale(4);
      opacity: 0;
    }
  }
`;
document.head.appendChild(rippleStyle);

document.addEventListener('DOMContentLoaded', () => {
  const buttons = document.querySelectorAll('.cta, .cta-3d, .card-btn, .signin-btn');
  buttons.forEach(button => {
    button.addEventListener('click', createRipple);
  });
});

// ============================================
// PERFORMANCE OPTIMIZATION
// ============================================
// Debounce function for scroll events
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Apply debounce to scroll handler
const optimizedScroll = debounce(() => {
  // Scroll logic here if needed
}, 10);

window.addEventListener('scroll', optimizedScroll);

// ============================================
// AOS INITIALIZATION (Animate On Scroll)
// ============================================
document.addEventListener('DOMContentLoaded', () => {
  if (typeof AOS !== 'undefined') {
    AOS.init({
      duration: 800,
      easing: 'ease-in-out',
      once: true,
      offset: 100,
      disable: window.innerWidth < 768
    });
  }
});

// ============================================
// VANILLA TILT INITIALIZATION
// ============================================
document.addEventListener('DOMContentLoaded', () => {
  const tiltElements = document.querySelectorAll('[data-tilt]');
  
  if (typeof VanillaTilt !== 'undefined') {
    tiltElements.forEach(element => {
      VanillaTilt.init(element, {
        max: 25,
        speed: 400,
        scale: 1.05,
        glare: true,
        'max-glare': 0.3
      });
    });
  }
});

// Small helpers: handle broken logo images and set progress widths from data attributes
document.addEventListener('DOMContentLoaded', () => {
  // Hide logos that fail to load (replaces inline onerror attributes)
  document.querySelectorAll('img.logo-img').forEach(img => {
    img.addEventListener('error', () => { img.style.display = 'none'; });
  });

  // Initialize .progress-fill widths from data-width attributes (tournaments)
  document.querySelectorAll('.progress-fill[data-width]').forEach(el => {
    const v = el.dataset.width;
    if (v) el.style.width = v + '%';
  });
});

console.log('🎮 PulsePay 3D Enhanced - Loaded Successfully!');

// Community composer handlers
document.addEventListener('DOMContentLoaded', () => {
  const submit = document.getElementById('submitPost');
  const cancel = document.getElementById('cancelPost');
  const textarea = document.getElementById('newPostContent');
  const posts = document.getElementById('posts');

  if (cancel) cancel.addEventListener('click', () => {
    if (textarea) textarea.value = '';
  });

  if (submit && textarea && posts) {
    submit.addEventListener('click', () => {
      const content = textarea.value.trim();
      if (!content) return alert('Please write something before posting');

      const article = document.createElement('article');
      article.className = 'post-card';
      article.innerHTML = `<h3>Community Post</h3><p>${content.replaceAll('\n','<br/>')}</p>`;
      posts.insertBefore(article, posts.firstChild);
      textarea.value = '';
    });
  }
});