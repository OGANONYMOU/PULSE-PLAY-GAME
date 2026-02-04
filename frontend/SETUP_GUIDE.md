# PulsePay Frontend - Setup & Development Guide

## 🚀 Quick Start

### Prerequisites
- Python 3.x (for local server) - [Download](https://www.python.org/downloads/)
- A modern web browser (Chrome, Firefox, Edge, Safari)
- Code editor (VS Code recommended)

### Installation

1. **Navigate to frontend directory:**
   ```bash
   cd frontend
   ```

2. **Start the development server:**
   ```bash
   python -m http.server 8000
   ```
   Or on Windows:
   ```bash
   python -m http.server 8000
   ```

3. **Open in browser:**
   Visit `http://localhost:8000` in your web browser

## 📦 Dependencies

All external dependencies are loaded via **CDN (Content Delivery Network)**, so no npm install is required!

### Included Libraries:

| Library | Purpose | Version | CDN |
|---------|---------|---------|-----|
| **AOS (Animate on Scroll)** | Scroll animations | 2.3.4 | cdnjs.cloudflare.com |
| **Vanilla Tilt** | 3D card tilt effects | 1.8.1 | cdn.jsdelivr.net |
| **Google Fonts** | Orbitron & Space Mono fonts | Latest | fonts.googleapis.com |
| **Font Awesome** | Icons (signin page) | 6.5.0 | cdnjs.cloudflare.com |

## 📁 Project Structure

```
frontend/
├── index.html              # Home page
├── games.html             # Games listing page
├── tournaments.html       # Tournaments page
├── community.html         # Community page
├── about.html            # About page
├── signin.html           # Sign in page
├── css/
│   ├── style.css         # Global styles
│   ├── games.css         # Games page styles
│   ├── signin.css        # Sign in page styles
│   └── tournaments.css    # Tournaments page styles
├── js/
│   ├── main.js           # Main script (all pages)
│   ├── games.js          # Games page script
│   ├── tournaments.js    # Tournaments page script
│   └── signin.js         # Sign in page script
└── package.json          # Project metadata
```

## 🎨 Features

### 3D Visual Effects
- **Vanilla Tilt**: Card hover 3D tilt effect
- **AOS Animations**: Scroll-triggered animations
- **Particle Background**: Animated background particles
- **Glitch Text Effect**: Animated hero text

### Responsive Design
- Mobile-first approach
- Hamburger menu for mobile devices
- Touch-friendly navigation

### Interactive Elements
- Smooth page transitions
- Real-time menu toggle
- Dynamic animations on scroll

## 🛠️ Development

### Editing Styles
- Edit CSS files in the `css/` folder
- Changes take effect immediately (hard refresh may be needed)
- Main styles are in `css/style.css`
- Page-specific styles in `css/[page].css`

### Editing JavaScript
- Main functionality in `js/main.js`
- Page-specific scripts in `js/[page].js`
- AOS is initialized automatically
- Vanilla Tilt is auto-initialized for `[data-tilt]` elements

### Adding New Features
1. Create new HTML elements with proper semantic markup
2. Style using CSS (BEM methodology recommended)
3. Add interactivity with vanilla JavaScript
4. Use `data-aos` attributes for scroll animations
5. Use `data-tilt` attribute for 3D card effects

## 🔗 CDN Dependencies in HTML

Each HTML file includes:

```html
<!-- AOS CSS -->
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/aos/2.3.4/aos.css" />

<!-- At the bottom of body -->
<!-- AOS JS -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/aos/2.3.4/aos.js"></script>

<!-- Vanilla Tilt JS -->
<script src="https://cdn.jsdelivr.net/npm/vanilla-tilt@1.8.1/dist/vanilla-tilt.min.js"></script>
```

## 🌐 Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## 📝 Best Practices

1. **Always use semantic HTML** (nav, main, section, article, footer)
2. **Mobile-first CSS** - Design for mobile first, then add desktop styles
3. **Accessibility** - Use proper ARIA labels and alt text
4. **Performance** - Minimize images, use modern formats (WebP)
5. **Naming** - Use BEM methodology for CSS classes

## 🐛 Troubleshooting

### Styles not updating?
- Hard refresh browser: `Ctrl+Shift+R` (Windows/Linux) or `Cmd+Shift+R` (Mac)
- Clear browser cache

### 3D Tilt not working?
- Ensure `data-tilt` attribute is on the card element
- Check browser console for errors

### Animations not showing?
- Verify AOS script is loaded
- Check `data-aos` attributes on elements
- Ensure elements are in viewport

### Local server won't start?
- Verify Python is installed: `python --version`
- Try alternative port: `python -m http.server 3000`
- Check if port 8000 is already in use

## 📚 Resources

- [AOS Documentation](https://michalsnik.github.io/aos/)
- [Vanilla Tilt Documentation](https://micku7zu.github.io/vanilla-tilt.js/)
- [MDN Web Docs](https://developer.mozilla.org/)
- [CSS-Tricks](https://css-tricks.com/)

## 💡 Tips for Editing

### To initialize AOS after dynamically adding elements:
```javascript
AOS.refresh();
```

### To enable Tilt on new card elements:
```javascript
const newCards = document.querySelectorAll('[data-tilt]');
newCards.forEach(card => {
  new VanillaTilt.init(card);
});
```

### To add scroll animations to new elements:
Add the `data-aos` attribute:
```html
<div data-aos="fade-up" data-aos-delay="100">
  Content here
</div>
```

## 📞 Support

For issues or questions, check:
1. Browser console for errors (F12)
2. Network tab to ensure CDN resources load
3. HTML validation at [W3C Validator](https://validator.w3.org/)

---

**Happy Editing!** 🎮✨
