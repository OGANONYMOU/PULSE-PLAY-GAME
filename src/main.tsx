import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { initWebVitals, logPerformanceStats } from './lib/metrics'
import { initResourceHints } from './lib/resourceHints'

// Initialize resource hints (preconnect, dns-prefetch)
if (typeof document !== 'undefined') {
  initResourceHints();
}

// Initialize Web Vitals tracking early
initWebVitals((metric) => {
  console.log(`📊 ${metric.name}: ${metric.value.toFixed(2)}ms [${metric.rating}]`);
});

// Development: log performance stats
if (import.meta.env.DEV) {
  window.addEventListener('load', () => {
    setTimeout(() => logPerformanceStats(), 100);
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
