/**
 * PERFORMANCE: Web Vitals & Performance Monitoring
 * Tracks: LCP, FID, CLS, TTFB
 * Sends metrics to analytics
 */

export interface WebVitals {
  name: string;
  value: number;
  delta: number;
  id: string;
  rating: 'good' | 'needs-improvement' | 'poor';
}

/**
 * Initialize Web Vitals tracking
 * Automatically measures and reports Core Web Vitals
 */
export function initWebVitals(onMetric?: (metric: WebVitals) => void): void {
  // Largest Contentful Paint
  if ('PerformanceObserver' in window) {
    try {
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1] as any;
        const metric: WebVitals = {
          name: 'LCP',
          value: lastEntry.renderTime || lastEntry.loadTime,
          delta: 0,
          id: `${Date.now()}`,
          rating: lastEntry.renderTime < 2500 ? 'good' : lastEntry.renderTime < 4000 ? 'needs-improvement' : 'poor',
        };
        if (onMetric) onMetric(metric);
        
        // Report to analytics
        if (navigator.sendBeacon) {
          navigator.sendBeacon('/api/metrics', JSON.stringify(metric));
        }
      });
      lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
    } catch (e) {
      console.debug('LCP tracking unavailable');
    }

    // Cumulative Layout Shift
    try {
      const clsObserver = new PerformanceObserver((list) => {
        let cls = 0;
        for (const entry of list.getEntries()) {
          if (!(entry as any).hadRecentInput) {
            cls += (entry as any).value;
          }
        }
        const metric: WebVitals = {
          name: 'CLS',
          value: cls,
          delta: 0,
          id: `${Date.now()}`,
          rating: cls < 0.1 ? 'good' : cls < 0.25 ? 'needs-improvement' : 'poor',
        };
        if (onMetric) onMetric(metric);
      });
      clsObserver.observe({ entryTypes: ['layout-shift'] });
    } catch (e) {
      console.debug('CLS tracking unavailable');
    }

    // First Input Delay / Interaction to Next Paint
    try {
      const fidObserver = new PerformanceObserver((list) => {
        const firstInput = list.getEntries()[0] as any;
        const metric: WebVitals = {
          name: 'FID',
          value: firstInput.processingDuration,
          delta: 0,
          id: `${Date.now()}`,
          rating: firstInput.processingDuration < 100 ? 'good' : firstInput.processingDuration < 300 ? 'needs-improvement' : 'poor',
        };
        if (onMetric) onMetric(metric);
      });
      fidObserver.observe({ entryTypes: ['first-input'] });
    } catch (e) {
      console.debug('FID tracking unavailable (might be new INP metric)');
    }
  }

  // TTFB (Time to First Byte)
  if ('performance' in window) {
    window.addEventListener('load', () => {
      const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      if (nav) {
        const ttfb = nav.responseStart - nav.fetchStart;
        const metric: WebVitals = {
          name: 'TTFB',
          value: ttfb,
          delta: 0,
          id: `${Date.now()}`,
          rating: ttfb < 600 ? 'good' : ttfb < 1200 ? 'needs-improvement' : 'poor',
        };
        if (onMetric) onMetric(metric);

        console.log('⚡ Core Web Vitals:', {
          TTFB: `${ttfb.toFixed(0)}ms`,
          'Page Load': `${nav.loadEventEnd - nav.fetchStart}ms`,
          'DOM Content Loaded': `${nav.domContentLoadedEventEnd - nav.fetchStart}ms`,
        });
      }
    });
  }
}

/**
 * Report performance metrics to analytics endpoint
 */
export function reportMetric(metric: WebVitals): void {
  // Example: Send to your analytics service
  const data = {
    name: metric.name,
    value: metric.value,
    rating: metric.rating,
    timestamp: new Date().toISOString(),
    url: typeof window !== 'undefined' ? window.location.href : '',
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
  };

  // Beacon API for reliable delivery (even on page unload)
  if (navigator.sendBeacon) {
    navigator.sendBeacon('/api/metrics', JSON.stringify(data));
  } else {
    // Fallback: Regular fetch
    fetch('/api/metrics', {
      method: 'POST',
      body: JSON.stringify(data),
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
    }).catch(console.debug);
  }
}

/**
 * Measure custom performance marks
 * Usage:
 * ```tsx
 * markStart('api-call');
 * await fetch(url);
 * markEnd('api-call');
 * ```
 */
export function markStart(label: string): void {
  if ('performance' in window && performance.mark) {
    performance.mark(`${label}-start`);
  }
}

export function markEnd(label: string): number {
  if ('performance' in window && performance.mark && performance.measure) {
    performance.mark(`${label}-end`);
    const measure = performance.measure(label, `${label}-start`, `${label}-end`);
    console.log(`⏱️ ${label}: ${measure.duration.toFixed(2)}ms`);
    return measure.duration;
  }
  return 0;
}

/**
 * Measure function execution time
 * Usage: await withTiming('operation-name', asyncFunction)
 */
export async function withTiming<T>(label: string, fn: () => Promise<T>): Promise<T> {
  markStart(label);
  try {
    const result = await fn();
    markEnd(label);
    return result;
  } catch (error) {
    markEnd(label);
    throw error;
  }
}

/**
 * Get current memory usage (Chrome/Edge only)
 */
export function getMemoryUsage(): { usedJSHeapSize: number; jsHeapSizeLimit: number; percentage: string } | null {
  if ('memory' in performance) {
    const mem = (performance as any).memory;
    return {
      usedJSHeapSize: Math.round(mem.usedJSHeapSize / 1048576), // Convert to MB
      jsHeapSizeLimit: Math.round(mem.jsHeapSizeLimit / 1048576),
      percentage: ((mem.usedJSHeapSize / mem.jsHeapSizeLimit) * 100).toFixed(1),
    };
  }
  return null;
}

/**
 * Log performance stats to console (development)
 */
export function logPerformanceStats(): void {
  const isDev = typeof import.meta !== 'undefined' && import.meta.env?.DEV;
  if (!isDev) return;

  console.group('📊 Performance Stats');

  // Navigation timing
  if ('performance' in window) {
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    if (nav) {
      console.table({
        'DNS Lookup': `${(nav.domainLookupEnd - nav.domainLookupStart).toFixed(0)}ms`,
        'TCP Connection': `${(nav.connectEnd - nav.connectStart).toFixed(0)}ms`,
        'TTFB': `${(nav.responseStart - nav.fetchStart).toFixed(0)}ms`,
        'Download': `${(nav.responseEnd - nav.responseStart).toFixed(0)}ms`,
        'DOM Parse': `${(nav.domInteractive - (nav as any).domLoading).toFixed(0)}ms`,
        'DOM Content Loaded': `${(nav.domContentLoadedEventEnd - nav.fetchStart).toFixed(0)}ms`,
        'Total Load': `${(nav.loadEventEnd - nav.fetchStart).toFixed(0)}ms`,
      });
    }

    // Resource timing
    const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    const resourcesByType: Record<string, number> = {};
    for (const r of resources) {
      const type = r.initiatorType;
      resourcesByType[type] = (resourcesByType[type] || 0) + 1;
    }
    console.log('Resources by type:', resourcesByType);
  }

  // Memory
  const mem = getMemoryUsage();
  if (mem) {
    console.log(`Memory: ${mem.usedJSHeapSize}MB / ${mem.jsHeapSizeLimit}MB (${mem.percentage}%)`);
  }

  console.groupEnd();
}
