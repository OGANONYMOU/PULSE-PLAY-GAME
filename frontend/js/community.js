// ============================================
// COMMUNITY PAGE JAVASCRIPT
// ============================================

document.addEventListener('DOMContentLoaded', () => {

  // ---- Tag selector for composer ----
  const tagBtns = document.querySelectorAll('.tag-btn');
  let selectedTag = 'general';

  tagBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tagBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedTag = btn.dataset.tag;
    });
  });

  // ---- Post composer ----
  const submitBtn = document.getElementById('submitPost');
  const cancelBtn = document.getElementById('cancelPost');
  const textarea = document.getElementById('newPostContent');
  const postsContainer = document.getElementById('posts');

  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      if (textarea) textarea.value = '';
    });
  }

  if (submitBtn && textarea && postsContainer) {
    submitBtn.addEventListener('click', () => {
      const content = textarea.value.trim();
      if (!content) {
        textarea.style.borderColor = 'rgba(255, 0, 110, 0.5)';
        textarea.focus();
        setTimeout(() => { textarea.style.borderColor = ''; }, 1500);
        return;
      }

      const tagLabels = {
        general: { label: '💬 General', cls: 'general' },
        tournament: { label: '🏆 Tournament', cls: 'tournament' },
        tips: { label: '💡 Tips', cls: 'tips' },
        clips: { label: '🎬 Clips', cls: 'general' }
      };

      const tag = tagLabels[selectedTag] || tagLabels.general;
      const avatars = ['😎', '🎯', '⚡', '🔥', '💎', '🚀'];
      const avatar = avatars[Math.floor(Math.random() * avatars.length)];

      const article = document.createElement('article');
      article.className = 'post-card';
      article.dataset.tag = selectedTag;
      article.innerHTML = `
        <div class="post-header">
          <div class="post-avatar">${avatar}</div>
          <div class="post-meta">
            <span class="post-author">You</span>
            <span class="post-time">Just now</span>
          </div>
          <span class="post-tag ${tag.cls}">${tag.label}</span>
        </div>
        <p class="post-body">${content.replace(/\n/g, '<br>')}</p>
        <div class="post-footer">
          <button class="post-react-btn" data-type="like">
            <span class="react-icon">🔥</span> <span class="react-count">0</span>
          </button>
          <button class="post-react-btn" data-type="comment">
            <span class="react-icon">💬</span> <span class="react-count">0</span>
          </button>
          <button class="post-react-btn" data-type="share">
            <span class="react-icon">📤</span> Share
          </button>
        </div>
      `;

      // Animate in
      article.style.opacity = '0';
      article.style.transform = 'translateY(-10px)';
      postsContainer.insertBefore(article, postsContainer.firstChild);

      requestAnimationFrame(() => {
        article.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
        article.style.opacity = '1';
        article.style.transform = 'translateY(0)';
      });

      textarea.value = '';

      // Attach reactions to new card
      attachReactions(article);
    });
  }

  // ---- Feed filtering ----
  const feedFilters = document.querySelectorAll('.feed-filter');

  feedFilters.forEach(btn => {
    btn.addEventListener('click', () => {
      feedFilters.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const filter = btn.dataset.filter;
      const posts = postsContainer ? postsContainer.querySelectorAll('.post-card') : [];

      posts.forEach(post => {
        if (filter === 'all' || post.dataset.tag === filter) {
          post.style.display = '';
        } else {
          post.style.display = 'none';
        }
      });
    });
  });

  // ---- Reaction buttons ----
  function attachReactions(scope) {
    const reactBtns = (scope || document).querySelectorAll('.post-react-btn[data-type="like"]');
    reactBtns.forEach(btn => {
      if (btn._hasReact) return;
      btn._hasReact = true;
      btn.addEventListener('click', () => {
        const countEl = btn.querySelector('.react-count');
        if (btn.classList.contains('reacted')) {
          btn.classList.remove('reacted');
          if (countEl) countEl.textContent = Math.max(0, parseInt(countEl.textContent, 10) - 1);
        } else {
          btn.classList.add('reacted');
          if (countEl) countEl.textContent = parseInt(countEl.textContent, 10) + 1;
        }
      });
    });
  }

  attachReactions();

  // ---- Simulate online count ----
  const onlineEl = document.getElementById('onlineCount');
  if (onlineEl) {
    setInterval(() => {
      const base = 1247;
      const variance = Math.floor(Math.random() * 80) - 40;
      onlineEl.textContent = (base + variance).toLocaleString();
    }, 8000);
  }

});
