import { useEffect, useRef } from 'react';
import * as echarts from 'echarts';
import type { EChartsOption } from 'echarts';

interface Props {
  option: EChartsOption;
  height: number;
  /** SVG renders crisply in PDF/print; canvas is faster for the live preview. */
  renderer?: 'canvas' | 'svg';
  className?: string;
  /** Called with the entry's name when a legend entry is clicked. */
  onLegendToggle?: (name: string) => void;
}

export function Chart({ option, height, renderer = 'canvas', className, onLegendToggle }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const chart = useRef<echarts.ECharts>();
  const legendToggle = useRef(onLegendToggle);
  legendToggle.current = onLegendToggle;

  useEffect(() => {
    if (!el.current) return;
    chart.current = echarts.init(el.current, undefined, { renderer });
    chart.current.on('legendselectchanged', (e) => legendToggle.current?.((e as { name: string }).name));
    const ro = new ResizeObserver(() => chart.current?.resize());
    ro.observe(el.current);
    return () => {
      ro.disconnect();
      chart.current?.dispose();
    };
  }, [renderer]);

  useEffect(() => {
    chart.current?.setOption(option, { notMerge: true });
  }, [option]);

  return <div ref={el} className={className} style={{ width: '100%', height }} />;
}
