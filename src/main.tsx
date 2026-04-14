import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { initWebVitals, logPerformanceStats } from './lib/metrics';
import { initResourceHints } from './lib/resourceHints';

// Preconnect to critical external domains
if (typeof document !== 'undefined') {
  initResourceHints();
}

// Track Core Web Vitals — console-only, no /api/ calls
initWebVitals((metric) => {
  if (import.meta.env.DEV) {
    console.log(`📊 ${metric.name}: ${metric.value.toFixed(1)} [${metric.rating}]`);
  }
});

// Dev-only performance summary
if (import.meta.env.DEV) {
  logPerformanceStats();
}

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('#root element not found in index.html');

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
);