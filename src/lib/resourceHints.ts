/**
 * PERFORMANCE: Pre-load critical resources for faster page loads
 * Add to index.html or use dynamically
 */

export function injectResourceHints(): void {
  const links = document.head.querySelectorAll('link');
  
  // Check if hints already exist
  const hasPreload = Array.from(links).some(l => l.rel === 'preload');
  if (hasPreload) return;

  const hints = [
    // Preload critical fonts
    {
      rel: 'preload',
      href: 'https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;700;900&family=Space+Mono:wght@400;700&display=swap',
      as: 'style',
    },
    // Preload critical pages (by route)
    // {
    //   rel: 'prefetch',
    //   href: '/index.html',
    //   as: 'document',
    // },
  ];

  for (const hint of hints) {
    const link = document.createElement('link');
    link.rel = hint.rel;
    if (hint.href) link.href = hint.href;
    if (hint.as) link.as = hint.as;
    if (link.rel === 'preload') {
      link.crossOrigin = 'anonymous';
    }
    document.head.appendChild(link);
  }
}

/**
 * PERFORMANCE: Defer non-critical CSS
 * Move heavy CSS files to load after first paint
 */
export function deferNonCriticalCSS(): void {
  const links = document.querySelectorAll('link[rel="stylesheet"]');
  
  for (const link of links) {
    // Skip if already deferred or critical
    if (link.hasAttribute('data-critical')) continue;
    
    // Load in background
    const media = link.getAttribute('media') || 'all';
    link.setAttribute('media', 'print');
    link.addEventListener('load', () => {
      link.setAttribute('media', media);
    }, { once: true });
    link.addEventListener('error', () => {
      link.setAttribute('media', media);
    }, { once: true });
  }
}

/**
 * PERFORMANCE: Prefetch DNS for external domains
 */
export function prefetchDNS(domains: string[]): void {
  for (const domain of domains) {
    const link = document.createElement('link');
    link.rel = 'dns-prefetch';
    link.href = `https://${domain}`;
    document.head.appendChild(link);
  }
}

/**
 * PERFORMANCE: Preconnect to critical domains
 */
export function preconnect(origins: string[]): void {
  for (const origin of origins) {
    const link = document.createElement('link');
    link.rel = 'preconnect';
    link.href = origin;
    link.crossOrigin = 'anonymous';
    document.head.appendChild(link);
  }
}

/**
 * Configuration for this app
 */
export const PERFORMANCE_CONFIG = {
  // Critical domains to preconnect
  criticalDomains: [
    'https://fonts.googleapis.com',
    'https://fonts.gstatic.com',
    // Add your Supabase instance
    // process.env.VITE_SUPABASE_URL || '',
  ],
  
  // Domains for DNS prefetch only (lighter than preconnect)
  dnsPrefetchDomains: [
    'cdn.jsdelivr.net',
    'unpkg.com',
  ],

  // Routes to prefetch on idle
  idlePrefetchRoutes: [
    '/games',
    '/tournaments',
  ],
};

/**
 * Initialize all resource hints for performance
 */
export function initResourceHints(): void {
  if (!('requestIdleCallback' in window)) {
    // Polyfill: use setTimeout if requestIdleCallback unavailable
    (window as any).requestIdleCallback = (cb: () => void) => setTimeout(cb, 1000);
  }

  // Preconnect to critical domains
  preconnect(PERFORMANCE_CONFIG.criticalDomains.filter(Boolean));

  // DNS prefetch for non-critical domains
  prefetchDNS(PERFORMANCE_CONFIG.dnsPrefetchDomains);

  // Defer non-critical CSS on idle
  requestIdleCallback(() => {
    deferNonCriticalCSS();
  }, { timeout: 3000 });
}
