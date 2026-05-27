/**
 * ChartBlock — ECharts 图表渲染器
 *
 * 接收 ContentBlock.data 渲染 ECharts 图表。
 * 支持 bar / line / pie / stacked_bar 四种图表类型。
 */
import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';

interface ChartBlockData {
  chartType?: string;
  title?: string;
  labels?: string[];
  values?: number[];
}

export function ChartBlock(data: Record<string, unknown>) {
  const { chartType = 'bar', title = '', labels = [], values = [] } = data as ChartBlockData;

  const isAxisChart = chartType === 'bar' || chartType === 'line' || chartType === 'stacked_bar';

  const option: EChartsOption = {
    title: title ? { text: title, left: 'center', textStyle: { fontSize: 14 } } : undefined,
    tooltip: { trigger: isAxisChart ? 'axis' : 'item' },
    grid: isAxisChart ? { left: '3%', right: '4%', bottom: '3%', containLabel: true } : undefined,
    xAxis: isAxisChart ? { type: 'category', data: labels } : undefined,
    yAxis: isAxisChart ? { type: 'value' } : undefined,
    series: [{
      name: title,
      type: chartType === 'stacked_bar' ? 'bar' : chartType === 'pie' ? 'pie' : 'bar',
      data: values,
      stack: chartType === 'stacked_bar' ? 'total' : undefined,
      radius: chartType === 'pie' ? ['40%', '70%'] : undefined,
      label: chartType === 'pie' ? { show: true, formatter: '{b}: {c}' } : undefined,
    }],
  };

  return <ReactECharts option={option} style={{ height: 400 }} opts={{ renderer: 'canvas' }} />;
}
