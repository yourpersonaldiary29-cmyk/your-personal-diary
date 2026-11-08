/**
 * Measures the chart's box and returns the SVG drawing width for it (see chartWidthFor), so
 * charts are drawn at their real size on phones. Without ResizeObserver (tests, very old
 * engines) the fixed CHART_WIDTH drawing is used, scaled by CSS as before.
 */
import { useLayoutEffect, useRef, useState } from 'react';
import { CHART_WIDTH, chartWidthFor } from './chart-utils';

function contentWidth(el: HTMLElement): number {
  const style = getComputedStyle(el);
  return el.clientWidth - (parseFloat(style.paddingLeft) || 0) - (parseFloat(style.paddingRight) || 0);
}

export function useChartWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(CHART_WIDTH);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const measure = () => setWidth(chartWidthFor(contentWidth(el)));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { ref, width };
}
