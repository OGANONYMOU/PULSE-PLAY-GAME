// Lightweight tournament page interactions (filters, progress bars)
document.addEventListener('DOMContentLoaded', () => {
  const filterButtons = document.querySelectorAll('.filter-btn');
  const cards = document.querySelectorAll('.tournament-card');

  function applyFilter(name) {
    cards.forEach(c => {
      const cat = c.dataset.category || 'all';
      c.style.display = (name === 'all' || cat === name) ? 'block' : 'none';
    });
  }

  filterButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      filterButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      applyFilter(btn.dataset.filter || 'all');
    });
  });

  // Initialize progress bars
  document.querySelectorAll('.progress-fill[data-width]').forEach(el => {
    el.style.width = el.dataset.width + '%';
  });
});
