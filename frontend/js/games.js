// ============================================
// GAMES PAGE JAVASCRIPT
// ============================================

// Search and Filter Functionality
function initGameFilters() {
  const searchInput = document.getElementById('gameSearch');
  const filterButtons = document.querySelectorAll('.game-filter-btn');
  const gameCards = document.querySelectorAll('.game-card');
  
  if (!searchInput) return;
  
  // Search functionality
  searchInput.addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase();
    let visibleCount = 0;
    
    gameCards.forEach(card => {
      const gameName = card.querySelector('.game-name')?.textContent.toLowerCase() || '';
      const gameDesc = card.querySelector('p')?.textContent.toLowerCase() || '';
      
      if (gameName.includes(searchTerm) || gameDesc.includes(searchTerm)) {
        card.style.display = 'block';
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
    
    // Show "no results" message if needed
    showNoResultsMessage(visibleCount);
  });
  
  // Filter button functionality
  filterButtons.forEach(button => {
    button.addEventListener('click', (clickEvent) => {
      applyGameFilter(clickEvent, button);
    });
  });
}

function applyGameFilter(clickEvent, button) {
  const gameCards = document.querySelectorAll('.game-card');
  const filterButtons = document.querySelectorAll('.filter-btn');
  
  filterButtons.forEach(btn => btn.classList.remove('active'));
  button.classList.add('active');
  
  const filterValue = button.dataset.filter;
  let visibleCount = 0;
  
  gameCards.forEach(card => {
    const gameCategory = card.dataset.category;
    const shouldShow = filterValue === 'all' || gameCategory === filterValue;
    
    if (shouldShow) {
      card.style.display = 'block';
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
  
  showNoResultsMessage(visibleCount);
  createFilterRipple(button, clickEvent);
}

function showNoResultsMessage(count) {
  let noResultsMsg = document.getElementById('noResults');
  
  if (count === 0) {
    if (!noResultsMsg) {
      noResultsMsg = document.createElement('div');
      noResultsMsg.id = 'noResults';
      noResultsMsg.style.cssText = `
        grid-column: 1 / -1;
        padding: 60px 20px;
        text-align: center;
        color: var(--text-secondary);
        font-size: 1.2rem;
      `;
      document.querySelector('.game-list')?.appendChild(noResultsMsg);
    }
    noResultsMsg.textContent = '❌ No games found. Try adjusting your search or filter.';
  } else if (noResultsMsg) {
    noResultsMsg.remove();
  }
}

// Game Card Click Handler
function initGameCardInteraction() {
  // Only make explicit buttons interactive; avoid treating entire card as a clickable area
  const actionButtons = document.querySelectorAll('.game-card .game-btn');

  actionButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const card = btn.closest('.game-card');
      const gameName = card?.querySelector('.game-name')?.textContent || 'Game';
      console.log(`🎮 Action clicked for: ${gameName}`);

      if (card) {
        // Visual press animation scoped to the card
        card.style.animation = 'none';
        setTimeout(() => {
          card.style.animation = 'cardClick 0.3s ease forwards';
        }, 10);
      }
    });
  });
  
  // Add animation
  const style = document.createElement('style');
  style.textContent = `
    @keyframes cardClick {
      0% { transform: scale(1); }
      50% { transform: scale(0.98); }
      100% { transform: scale(1); }
    }
  `;
  document.head.appendChild(style);
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  initGameFilters();
  initGameCardInteraction();
  console.log('🎮 Games Page Loaded!');
});

// ============================================
// RIPPLE EFFECT FOR BUTTONS
// ============================================
function createFilterRipple(button, clickEvent) {
  const ripple = document.createElement('span');
  const rect = button.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height);
  const x = (clickEvent?.clientX ?? size / 2) - rect.left - size / 2;
  const y = (clickEvent?.clientY ?? size / 2) - rect.top - size / 2;
  
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
