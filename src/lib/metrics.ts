/**
 * Web Vitals & Performance Monitoring
 * NOTE: Beacon calls to /api/metrics are disabled — no API backend exists.
 * Metrics are logged to console in dev mode only.
 */

export interface WebVitals {
  name: string;
  value: number;
  delta: number;
  id: string;
  rating: 'good' | 'needs-improvement' | 'poor';
}

function isDev(): boolean {
  return typeof import.meta !== 'undefined' && !!import.meta.env?.DEV;
}

function rateMetric(name: string, value: number): 'good' | 'needs-improvement' | 'poor' {
  if (name === 'LCP') return value < 2500 ? 'good' : value < 4000 ? 'needs-improvement' : 'poor';
  if (name === 'CLS') return value < 0.1 ? 'good' : value < 0.25 ? 'needs-improvement' : 'poor';
  if (name === 'FID' || name === 'INP') return value < 100 ? 'good' : value < 300 ? 'needs-improvement' : 'poor';
  if (name === 'TTFB') return value < 600 ? 'good' : value < 1200 ? 'needs-improvement' : 'poor';
  return 'good';
}

export function initWebVitals(onMetric?: (metric: WebVitals) => void): void {
  if (typeof window === 'undefined' || !('PerformanceObserver' in window)) return;

  const observe = (entryTypes: string[], handler: (entries: PerformanceEntryList) => void) => {
    try {
      const obs = new PerformanceObserver((list) => handler(list.getEntries()));
      obs.observe({ entryTypes });
    } catch {
      // Silently skip unsupported entry types
    }
  };

  // LCP
  observe(['largest-contentful-paint'], (entries) => {
    const last = entries[entries.length - 1] as PerformanceEntry & { renderTime?: number; loadTime?: number };
    const value = last.renderTime || last.loadTime || 0;
    const metric: WebVitals = { name: 'LCP', value, delta: 0, id: `${Date.now()}`, rating: rateMetric('LCP', value) };
    if (onMetric) onMetric(metric);
  });

  // CLS
  observe(['layout-shift'], (entries) => {
    let cls = 0;
    for (const e of entries) {
      if (!(e as PerformanceEntry & { hadRecentInput?: boolean }).hadRecentInput) {
        cls += (e as PerformanceEntry & { value?: number }).value ?? 0;
      }
    }
    const metric: WebVitals = { name: 'CLS', value: cls, delta: 0, id: `${Date.now()}`, rating: rateMetric('CLS', cls) };
    if (onMetric) onMetric(metric);
  });

  // FID / INP
  observe(['first-input', 'event'], (entries) => {
    const first = entries[0] as PerformanceEntry & { processingDuration?: number; processingStart?: number; startTime?: number };
    const value = first.processingDuration ?? (first.processingStart != null && first.startTime != null ? first.processingStart - first.startTime : 0);
    const metric: WebVitals = { name: 'FID', value, delta: 0, id: `${Date.now()}`, rating: rateMetric('FID', value) };
    if (onMetric) onMetric(metric);
  });

  // TTFB
  if ('performance' in window) {
    window.addEventListener('load', () => {
      const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
      if (!nav) return;
      const ttfb = nav.responseStart - nav.fetchStart;
      const metric: WebVitals = { name: 'TTFB', value: ttfb, delta: 0, id: `${Date.now()}`, rating: rateMetric('TTFB', ttfb) };
      if (onMetric) onMetric(metric);
    }, { once: true });
  }
}

export function logPerformanceStats(): void {
  if (!isDev() || typeof window === 'undefined') return;

  window.addEventListener('load', () => {
    setTimeout(() => {
      const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
      if (!nav) return;
      console.group('📊 PulsePay Performance');
      console.table({
        TTFB:               `${(nav.responseStart - nav.fetchStart).toFixed(0)}ms`,
        'DOM Interactive':  `${(nav.domInteractive - nav.fetchStart).toFixed(0)}ms`,
        'Total Load':       `${(nav.loadEventEnd - nav.fetchStart).toFixed(0)}ms`,
      });
      console.groupEnd();
    }, 200);
  }, { once: true });
}

// No-op stubs — kept for API compatibility
export function reportMetric(_metric: WebVitals): void {}
export function markStart(_label: string): void {}
export function markEnd(_label: string): number { return 0; }
export async function withTiming<T>(_label: string, fn: () => Promise<T>): Promise<T> { return fn(); }
export function getMemoryUsage(): null { return null; }