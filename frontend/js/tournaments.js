// ============================================
// TOURNAMENT PAGE JAVASCRIPT
// ============================================

// Filter Functionality
function initTournamentFilters() {
  const filterButtons = document.querySelectorAll('.filter-btn');
  const tournamentCards = document.querySelectorAll('.tournament-card');
  const resultsCount = document.getElementById('resultsCount');

  filterButtons.forEach(button => {
    button.addEventListener('click', () => {
      // Remove active class from all buttons
      filterButtons.forEach(btn => btn.classList.remove('active'));
      
      // Add active class to clicked button
      button.classList.add('active');
      
      // Get filter value
      const filterValue = button.getAttribute('data-filter');
      
      // Filter cards
      let visibleCount = 0;
      tournamentCards.forEach(card => {
        const category = card.getAttribute('data-category');
        
        if (filterValue === 'all' || category === filterValue) {
          card.style.display = 'block';
          // Animate in
          setTimeout(() => {
            card.style.opacity = '1';
            card.style.transform = 'translateY(0)';
          }, 50);
          visibleCount++;
        } else {
          card.style.opacity = '0';
          card.style.transform = 'translateY(20px)';
          setTimeout(() => {
            card.style.display = 'none';
          }, 300);
        }
      });
      
      // Update results count
      if (resultsCount) {
        resultsCount.textContent = visibleCount;
      }
      
      // Add ripple effect
      createFilterRipple(button);
    });
  });
}

// Filter Ripple Effect
function createFilterRipple(button) {
  const ripple = document.createElement('span');
  const rect = button.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height);
  
  ripple.style.cssText = `
    position: absolute;
    width: ${size}px;
    height: ${size}px;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%) scale(0);
    background: radial-gradient(circle, rgba(0, 217, 255, 0.4), transparent);
    border-radius: 50%;
    pointer-events: none;
    animation: filterRipple 0.6s ease-out;
  `;
  
  button.style.position = 'relative';
  button.style.overflow = 'hidden';
  button.appendChild(ripple);
  
  setTimeout(() => ripple.remove(), 600);
}

// Add ripple animation
const filterRippleStyle = document.createElement('style');
filterRippleStyle.textContent = `
  @keyframes filterRipple {
    to {
      transform: translate(-50%, -50%) scale(2);
      opacity: 0;
    }
  }
`;
document.head.appendChild(filterRippleStyle);

// ============================================
// TOURNAMENT CARD INTERACTIONS
// ============================================

// Add hover sound effect (optional - can be muted)
function initCardSounds() {
  const cards = document.querySelectorAll('.tournament-card');
  
  cards.forEach(card => {
    card.addEventListener('mouseenter', () => {
      // You can add a subtle sound here if desired
      // For now, just add a visual pulse
      card.style.animation = 'cardPulse 0.3s ease';
    });
    
    card.addEventListener('mouseleave', () => {
      card.style.animation = '';
    });
  });
}

// Card Pulse Animation
const cardPulseStyle = document.createElement('style');
cardPulseStyle.textContent = `
  @keyframes cardPulse {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.02); }
  }
`;
document.head.appendChild(cardPulseStyle);

// ============================================
// PROGRESS BAR ANIMATION
// ============================================

function animateProgressBars() {
  const progressFills = document.querySelectorAll('.progress-fill');
  
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const fill = entry.target;
        const targetWidth = fill.style.width;
        
        // Animate from 0 to target width
        fill.style.width = '0%';
        setTimeout(() => {
          fill.style.transition = 'width 1s ease-out';
          fill.style.width = targetWidth;
        }, 100);
        
        observer.unobserve(fill);
      }
    });
  }, { threshold: 0.5 });
  
  progressFills.forEach(fill => observer.observe(fill));
}

// ============================================
// LOAD MORE FUNCTIONALITY
// ============================================

function initLoadMore() {
  const loadMoreBtn = document.querySelector('.load-more-btn');
  
  if (loadMoreBtn) {
    loadMoreBtn.addEventListener('click', () => {
      // Add loading state
      loadMoreBtn.innerHTML = `
        <span>Loading...</span>
        <span class="load-spinner">⏳</span>
      `;
      
      loadMoreBtn.disabled = true;
      
      // Simulate loading (replace with actual API call)
      setTimeout(() => {
        // Reset button
        loadMoreBtn.innerHTML = `
          <span>Load More Tournaments</span>
          <span class="load-icon">↓</span>
        `;
        loadMoreBtn.disabled = false;
        
        // Show success message
        showNotification('More tournaments loaded!', 'success');
      }, 1500);
    });
  }
}

// ============================================
// NOTIFICATION SYSTEM
// ============================================

function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.className = `tournament-notification ${type}`;
  notification.textContent = message;
  
  notification.style.cssText = `
    position: fixed;
    bottom: 30px;
    right: 30px;
    background: ${type === 'success' ? 'linear-gradient(135deg, #00ff88, #00d9ff)' : 'linear-gradient(135deg, #9d4edd, #00d9ff)'};
    color: #0a0a0f;
    padding: 15px 25px;
    border-radius: 10px;
    font-weight: 700;
    box-shadow: 0 10px 30px rgba(0, 217, 255, 0.4);
    z-index: 10000;
    animation: notificationSlide 0.5s ease;
  `;
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.style.animation = 'notificationSlideOut 0.5s ease';
    setTimeout(() => notification.remove(), 500);
  }, 3000);
}

// Notification Animations
const notificationStyle = document.createElement('style');
notificationStyle.textContent = `
  @keyframes notificationSlide {
    from {
      transform: translateX(400px);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
  
  @keyframes notificationSlideOut {
    from {
      transform: translateX(0);
      opacity: 1;
    }
    to {
      transform: translateX(400px);
      opacity: 0;
    }
  }
`;
document.head.appendChild(notificationStyle);

// ============================================
// TOURNAMENT ACTION BUTTONS
// ============================================

function initActionButtons() {
  const actionButtons = document.querySelectorAll('.tournament-action-btn');
  
  actionButtons.forEach(button => {
    button.addEventListener('click', (e) => {
      e.stopPropagation();
      
      const buttonText = button.querySelector('span').textContent;
      
      if (buttonText.includes('Join') || buttonText.includes('Register')) {
        showNotification('Registration opened! Please sign in to continue.', 'info');
        // Redirect to sign in after delay
        setTimeout(() => {
          window.location.href = 'signin.html';
        }, 2000);
      } else if (buttonText.includes('View')) {
        showNotification('Loading tournament details...', 'info');
        // Here you would typically navigate to tournament details page
      }
      
      // Add button click animation
      button.style.transform = 'scale(0.95)';
      setTimeout(() => {
        button.style.transform = '';
      }, 100);
    });
  });
}

// ============================================
// LIVE BADGE PULSE
// ============================================

function initLiveBadges() {
  const liveBadges = document.querySelectorAll('.tournament-badge.live');
  
  liveBadges.forEach(badge => {
    // Add extra pulse effect
    setInterval(() => {
      badge.style.transform = 'scale(1.1)';
      setTimeout(() => {
        badge.style.transform = 'scale(1)';
      }, 200);
    }, 2000);
  });
}

// ============================================
// SCROLL ANIMATIONS
// ============================================

function initScrollAnimations() {
  const animatedElements = document.querySelectorAll('.tournament-stat-card, .tournament-card');
  
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = '1';
        entry.target.style.transform = 'translateY(0)';
      }
    });
  }, { threshold: 0.1 });
  
  animatedElements.forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(30px)';
    el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
    observer.observe(el);
  });
}

// ============================================
// TOURNAMENT SEARCH (Optional Enhancement)
// ============================================

function initTournamentSearch() {
  // You can add a search bar functionality here
  // This would filter tournaments based on name or game
  console.log('Search functionality can be added here');
}

// ============================================
// STATS COUNTER ANIMATION
// ============================================

function animateStatsCounters() {
  const statNumbers = document.querySelectorAll('.tournament-stat-card .stat-number');
  
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting && !entry.target.classList.contains('counted')) {
        entry.target.classList.add('counted');
        const text = entry.target.textContent;
        const number = parseInt(text.replace(/[^0-9]/g, ''));
        
        if (number) {
          let current = 0;
          const increment = number / 50;
          const timer = setInterval(() => {
            current += increment;
            if (current >= number) {
              entry.target.textContent = text;
              clearInterval(timer);
            } else {
              entry.target.textContent = Math.floor(current) + text.replace(/[0-9]/g, '');
            }
          }, 30);
        }
      }
    });
  }, { threshold: 0.5 });
  
  statNumbers.forEach(stat => observer.observe(stat));
}

// ============================================
// KEYBOARD NAVIGATION
// ============================================

function initKeyboardNavigation() {
  const cards = document.querySelectorAll('.tournament-card');
  let currentIndex = -1;
  
  document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      
      if (e.key === 'ArrowDown') {
        currentIndex = (currentIndex + 1) % cards.length;
      } else {
        currentIndex = (currentIndex - 1 + cards.length) % cards.length;
      }
      
      cards[currentIndex].scrollIntoView({ behavior: 'smooth', block: 'center' });
      cards[currentIndex].focus();
    }
  });
  
  // Make cards focusable
  cards.forEach(card => {
    card.setAttribute('tabindex', '0');
  });
}

// ============================================
// INITIALIZE ALL FEATURES
// ============================================

document.addEventListener('DOMContentLoaded', () => {
  console.log('🏆 Tournament Page Loaded!');
  
  // Initialize all features
  initTournamentFilters();
  initCardSounds();
  animateProgressBars();
  initLoadMore();
  initActionButtons();
  initLiveBadges();
  initScrollAnimations();
  animateStatsCounters();
  initKeyboardNavigation();
  
  // Add smooth scroll behavior
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      e.preventDefault();
      const target = document.querySelector(this.getAttribute('href'));
      if (target) {
        target.scrollIntoView({ behavior: 'smooth' });
      }
    });
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

// Optimize scroll events
window.addEventListener('scroll', debounce(() => {
  // Add any scroll-based animations here
}, 10));

console.log('🎮 Tournament features initialized successfully!');