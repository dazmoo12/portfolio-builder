// PowerPoint export with native (editable) Office charts. Built from the same
// ViewModel as the preview, styled with the selected template.

import PptxGenJS from 'pptxgenjs';
import type { HouseholdView } from '../charts/household';
import type { ViewModel } from '../charts/model';
import { SCENARIOS } from '../engine/types';
import type { Advisor } from '../state';
import { onColor } from '../templates/themes';

const hex = (c: string) => c.replace('#', '').toUpperCase();

export async function exportPptx(vm: ViewModel, advisor: Advisor, household?: HouseholdView): Promise<Blob> {
  const { t, fmt, input, theme } = vm;
  const c = theme.colors;
  const H = theme.fonts.heading;
  const B = theme.fonts.body;
  const k = vm.kpi;
  const charts = vm.output.charts;
  const showRange = vm.output.showRange;
  const scenarioNote = t('scenarioNote', { scenario: t(vm.scenario), rate: fmt.pct(vm.avgReturn) });
  const positionsTable = () => [
    [t('product'), t('monthly'), t('oneOff'), `${t('value')} ${vm.year}`].map((text) => ({
      text,
      options: { bold: true, color: hex(onColor(c.primary)), fill: { color: hex(c.primary) } },
    })),
    ...vm.positions.map((p) => [
      { text: p.name },
      { text: fmt.eur(p.monthly), options: { align: 'right' as const } },
      { text: fmt.eur(p.oneOff), options: { align: 'right' as const } },
      { text: fmt.eur(p.value), options: { align: 'right' as const, bold: true } },
    ]),
  ];

  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE'; // 13.33 x 7.5 in
  pptx.title = `${t('reportTitle')} ${input.client.name}`;
  pptx.author = advisor.name;
  pptx.theme = { headFontFace: H, bodyFontFace: B };

  const footerText = `${advisor.office} · ${advisor.name} · ${advisor.phone} · ${advisor.email}`;
  pptx.defineSlideMaster({
    title: 'CONTENT',
    background: { color: hex(c.background) },
    objects: [
      { rect: { x: 0.6, y: 0.45, w: 0.5, h: 0.05, fill: { color: hex(c.accent) } } },
      { line: { x: 0.6, y: 6.85, w: 12.13, h: 0, line: { color: 'D5DAE1', width: 0.75 } } },
      { text: { text: footerText, options: { x: 0.6, y: 6.9, w: 10, h: 0.35, fontFace: B, fontSize: 9, color: hex(c.muted) } } },
      ...(theme.logo ? [{ image: { data: theme.logo, x: 11.43, y: 0.3, w: 1.3, h: 0.6, sizing: { type: 'contain' as const, w: 1.3, h: 0.6 } } }] : []),
    ],
    slideNumber: { x: 12.3, y: 6.9, w: 0.5, h: 0.35, fontFace: B, fontSize: 9, color: hex(c.muted) },
  });

  const title = (slide: PptxGenJS.Slide, kicker: string, text: string) => {
    slide.addText(kicker.toUpperCase(), { x: 1.2, y: 0.32, w: 9, h: 0.3, fontFace: B, fontSize: 10, color: hex(c.muted), charSpacing: 3, bold: true });
    slide.addText(text, { x: 0.6, y: 0.65, w: 10.5, h: 0.7, fontFace: H, fontSize: 28, color: hex(c.text), bold: true });
  };
  const disclaimer = (slide: PptxGenJS.Slide, y = 6.25) =>
    slide.addText(t('disclaimer'), { x: 0.6, y, w: 12.13, h: 0.55, fontFace: B, fontSize: 7, color: hex(c.muted), valign: 'top' });

  const chartFont = { catAxisLabelFontFace: B, valAxisLabelFontFace: B, legendFontFace: B, dataLabelFontFace: B };
  const valFmt = '#,##0 "€"';

  // 1 · Title slide
  {
    const s = pptx.addSlide();
    s.background = { color: hex(c.primary) };
    const on = hex(onColor(c.primary));
    if (theme.logo) s.addImage({ data: theme.logo, x: 0.8, y: 0.6, w: 1.8, h: 0.8, sizing: { type: 'contain', w: 1.8, h: 0.8 } });
    s.addShape(pptx.ShapeType.rect, { x: 0.8, y: 2.45, w: 0.6, h: 0.06, fill: { color: hex(c.accent) } });
    s.addText(t('reportKicker').toUpperCase(), { x: 0.8, y: 2.6, w: 10, h: 0.4, fontFace: B, fontSize: 12, color: hex(c.accent), charSpacing: 3, bold: true });
    s.addText(`${t('reportTitle')} ${input.client.name}`, { x: 0.8, y: 3.0, w: 11.5, h: 1.1, fontFace: H, fontSize: 40, color: on, bold: true });
    s.addText(
      `${t('reportStart')} ${input.startYear}  ·  ${t('reportDuration')} ${input.horizonYears} ${t('reportYears')}  ·  ${t('reportMonthly')} ${fmt.eur(input.totalMonthly)}  ·  ${t('reportOneOff')} ${fmt.eur(input.totalOneOff)}`,
      { x: 0.8, y: 4.15, w: 11.5, h: 0.5, fontFace: B, fontSize: 14, color: on },
    );
    s.addText([{ text: `${t('reportContact')}: `, options: { bold: true } }, { text: `${advisor.name} · ${advisor.office}` }], {
      x: 0.8, y: 6.4, w: 11.5, h: 0.4, fontFace: B, fontSize: 12, color: on,
    });
  }

  // 1b · Household budget (optional)
  if (household) {
    const s = pptx.addSlide({ masterName: 'CONTENT' });
    const h = household.summary;
    title(s, t('reportKicker'), t('householdTitle'));
    const tiles: [string, number, boolean][] = [
      [t('kpiIncome'), h.income, false],
      [t('kpiExpenses'), h.expenses, false],
      [t('kpiSurplus'), h.surplus, false],
      [t('kpiProposed'), h.proposed, true],
    ];
    tiles.forEach(([label, v, hero], i) => {
      const x = 0.6 + i * 3.08;
      s.addShape(pptx.ShapeType.rect, { x, y: 1.5, w: 2.9, h: 1.05, fill: { color: hex(hero ? c.primary : c.surface) } });
      const col = hex(hero ? onColor(c.primary) : c.text);
      s.addText(label.toUpperCase(), { x: x + 0.15, y: 1.55, w: 2.6, h: 0.35, fontFace: B, fontSize: 9, bold: true, charSpacing: 1.5, color: hero ? hex(c.accent2) : hex(c.muted) });
      s.addText(fmt.eur(v), { x: x + 0.15, y: 1.88, w: 2.6, h: 0.55, fontFace: H, fontSize: 22, bold: true, color: col });
    });
    s.addText(`${t('savingsQuota')} ${fmt.pct(h.savingsQuota)}  ·  ${t('kpiReserve')} ${fmt.eur(h.reserve)}`, {
      x: 9.84, y: 2.6, w: 2.9, h: 0.3, fontFace: B, fontSize: 10, color: hex(c.muted),
    });

    // income split as one stacked bar
    s.addText(t('chartBudgetSplit'), { x: 0.6, y: 2.95, w: 8, h: 0.35, fontFace: H, fontSize: 14, bold: true, color: hex(c.text) });
    s.addChart(
      pptx.ChartType.bar,
      household.split.map((p) => ({ name: p.label, labels: [''], values: [Math.round(p.amount)] })),
      {
        x: 0.6, y: 3.25, w: 12.13, h: 0.95, barDir: 'bar', barGrouping: 'stacked', barGapWidthPct: 10,
        chartColors: household.split.map((p) => hex(p.color)),
        valAxisHidden: true, catAxisHidden: true, valGridLine: { style: 'none' },
        showValue: true, dataLabelFormatCode: valFmt, dataLabelFontSize: 10, dataLabelColor: hex(c.text),
        showLegend: true, legendPos: 'r', legendFontSize: 10, legendColor: hex(c.text),
        ...chartFont,
      },
    );

    // expenses by category + income table
    s.addText(t('chartExpenses'), { x: 0.6, y: 4.3, w: 7, h: 0.35, fontFace: H, fontSize: 14, bold: true, color: hex(c.text) });
    const exp = [...household.expenses].reverse(); // horizontal bars list bottom-up
    s.addChart(
      pptx.ChartType.bar,
      [{ name: t('expenses'), labels: exp.map((e) => e.label), values: exp.map((e) => Math.round(e.amount)) }],
      {
        x: 0.6, y: 4.6, w: 7.4, h: 2.2, barDir: 'bar', chartColors: [hex(c.primary)],
        valAxisHidden: true, valGridLine: { style: 'none' }, catAxisLabelFontSize: 9, catAxisLabelColor: hex(c.text),
        showValue: true, dataLabelFormatCode: valFmt, dataLabelFontSize: 9, dataLabelColor: hex(c.text), dataLabelPosition: 'outEnd',
        showLegend: false,
        ...chartFont,
      },
    );
    s.addText(t('income'), { x: 8.4, y: 4.3, w: 4.3, h: 0.35, fontFace: H, fontSize: 14, bold: true, color: hex(c.text) });
    s.addTable(
      [
        ...household.income.map((l) => [{ text: l.label }, { text: fmt.eur(l.amount), options: { align: 'right' as const } }]),
        [
          { text: t('kpiIncome'), options: { bold: true } },
          { text: fmt.eur(h.income), options: { bold: true, align: 'right' as const } },
        ],
      ],
      { x: 8.4, y: 4.7, w: 4.33, colW: [2.83, 1.5], fontFace: B, fontSize: 10, color: hex(c.text), border: { type: 'solid', color: 'E3E7EC', pt: 0.5 }, rowH: 0.3 },
    );
    s.addText(t('householdNote'), { x: 8.4, y: 6.45, w: 4.33, h: 0.3, fontFace: B, fontSize: 8, color: hex(c.muted) });
  }

  // 2 · Overview: KPIs + allocation doughnut
  {
    const s = pptx.addSlide({ masterName: 'CONTENT' });
    title(s, t('reportKicker'), `${t('previewTitle')} ${vm.year} · ${t('ageAt')} ${vm.ageAtYear}`);
    s.addShape(pptx.ShapeType.roundRect, { x: 0.6, y: 1.55, w: 5.6, h: 1.9, fill: { color: hex(c.primary) }, rectRadius: 0.08 });
    const on = hex(onColor(c.primary));
    s.addText(t('kpiValue').toUpperCase(), { x: 0.9, y: 1.7, w: 5, h: 0.35, fontFace: B, fontSize: 10, color: hex(c.accent2), bold: true, charSpacing: 2 });
    s.addText(fmt.eur(k.value), { x: 0.9, y: 2.05, w: 5, h: 0.8, fontFace: H, fontSize: 36, color: on, bold: true });
    s.addText(
      showRange
        ? `${t('reportScenarioRange')}: ${fmt.eur(k.pessimistic)} – ${fmt.eur(k.optimistic)}`
        : scenarioNote,
      { x: 0.9, y: 2.85, w: 5.2, h: 0.4, fontFace: B, fontSize: 11, color: on },
    );
    const tiles: [string, number, string][] = [
      [t('kpiPaidIn'), k.paidIn, '9DB8D9'],
      [t('kpiSubsidy'), k.subsidy, hex(c.accent)],
      [t('kpiGains'), k.gains, hex(c.primary)],
    ];
    tiles.forEach(([label, v, col], i) => {
      const y = 3.7 + i * 0.85;
      s.addShape(pptx.ShapeType.rect, { x: 0.6, y, w: 5.6, h: 0.72, fill: { color: hex(c.surface) } });
      s.addShape(pptx.ShapeType.ellipse, { x: 0.8, y: y + 0.21, w: 0.3, h: 0.3, fill: { color: col } });
      s.addText(label, { x: 1.25, y, w: 2.6, h: 0.72, fontFace: B, fontSize: 13, color: hex(c.text), valign: 'middle' });
      s.addText(fmt.eur(v), { x: 3.6, y, w: 1.8, h: 0.72, fontFace: H, fontSize: 16, bold: true, color: hex(c.text), align: 'right', valign: 'middle' });
      s.addText(k.value > 0 ? fmt.pct(v / k.value) : '–', { x: 5.4, y, w: 0.7, h: 0.72, fontFace: B, fontSize: 10, color: hex(c.muted), align: 'right', valign: 'middle' });
    });
    if (charts.allocation) {
      s.addText(`${t('chartAllocation')} ${vm.year}`, { x: 6.7, y: 1.5, w: 6, h: 0.4, fontFace: H, fontSize: 16, bold: true, color: hex(c.text) });
      if (vm.output.allocationStyle === 'bar') {
        const rev = [...vm.positions].reverse(); // horizontal bars list bottom-up
        s.addChart(
          pptx.ChartType.bar,
          [{ name: t('chartAllocation'), labels: rev.map((p) => p.name), values: rev.map((p) => Math.max(0, Math.round(p.value))) }],
          {
            x: 6.7, y: 1.9, w: 6, h: 4.3, barDir: 'bar', chartColors: rev.map((p) => hex(p.color)),
            valAxisHidden: true, valGridLine: { style: 'none' }, catAxisLabelFontSize: 11, catAxisLabelColor: hex(c.text),
            showValue: true, dataLabelFormatCode: valFmt, dataLabelFontSize: 10, dataLabelColor: hex(c.text), dataLabelPosition: 'outEnd',
            showLegend: false,
            ...chartFont,
          },
        );
      } else {
        s.addChart(
          pptx.ChartType.doughnut,
          [{ name: t('chartAllocation'), labels: vm.positions.map((p) => p.name), values: vm.positions.map((p) => Math.max(0, Math.round(p.value))) }],
          {
            x: 6.7, y: 1.9, w: 6, h: 4.3, holeSize: 55,
            chartColors: vm.positions.map((p) => hex(p.color)),
            showLegend: true, legendPos: 'r', legendFontSize: 11, legendColor: hex(c.text),
            showPercent: true, showValue: false, dataLabelColor: 'FFFFFF', dataLabelFontSize: 10,
            ...chartFont,
          },
        );
      }
    } else {
      // no chart: list the products instead
      s.addText(t('reportPositions'), { x: 6.7, y: 1.5, w: 6, h: 0.4, fontFace: H, fontSize: 16, bold: true, color: hex(c.text) });
      s.addTable(positionsTable(), {
        x: 6.7, y: 1.95, w: 6.03, colW: [2.63, 1.1, 1.1, 1.2], fontFace: B, fontSize: 10, color: hex(c.text),
        border: { type: 'solid', color: 'E3E7EC', pt: 0.5 }, rowH: 0.36, valign: 'middle',
      });
    }
  }

  // 3 · Development: stacked area per product for the displayed scenario,
  //     optionally combined with lines for the other scenarios' totals
  if (charts.development) {
    const s = pptx.addSlide({ masterName: 'CONTENT' });
    title(s, scenarioNote, `${t('chartDevelopment')} ${input.startYear}–${input.startYear + input.horizonYears}`);
    const labels = vm.years.map(String);
    const others = showRange ? SCENARIOS.filter((sc) => sc !== vm.scenario) : [];
    const combo: PptxGenJS.IChartMulti[] = [
      {
        type: pptx.ChartType.area,
        data: vm.development.positions.map((p) => ({ name: p.name, labels, values: p.values.map(Math.round) })),
        options: { barGrouping: 'stacked', chartColors: vm.development.positions.map((p) => hex(p.color)) },
      },
    ];
    // one line entry per scenario, because the dash style is set per chart type entry
    for (const sc of others)
      combo.push({
        type: pptx.ChartType.line,
        data: [{ name: t('totalScenario', { scenario: t(sc) }), labels, values: vm.development.totals[sc].map(Math.round) }],
        options: { chartColors: [hex(c.primary)], lineSize: 2, lineDataSymbol: 'none', lineDash: sc === 'optimistic' ? 'dash' : 'sysDot' },
      });
    // for combo charts pptxgenjs takes the options from the 3rd argument when the 2nd is empty
    s.addChart(
      combo,
      undefined as unknown as [],
      {
        x: 0.6, y: 1.5, w: 12.13, h: 4.6,
        showLegend: true, legendPos: 'b', legendFontSize: 11, legendColor: hex(c.text),
        valAxisLabelFormatCode: valFmt, valAxisLabelFontSize: 10, catAxisLabelFontSize: 10,
        valAxisLabelColor: hex(c.muted), catAxisLabelColor: hex(c.muted),
        valGridLine: { color: 'EEF0F3', size: 0.5 }, catAxisLabelFrequency: String(Math.max(1, Math.round(labels.length / 12))),
        ...chartFont,
      },
    );
    disclaimer(s);
  }

  // 4 · Scenarios: lines over time + bars at selected year
  if (charts.scenarios) {
    const s = pptx.addSlide({ masterName: 'CONTENT' });
    title(s, t('chartScenarios'), t('chartScenarios'));
    const labels = vm.years.map(String);
    const d = vm.development;
    s.addChart(
      pptx.ChartType.line,
      [
        { name: t('optimistic'), labels, values: d.totals.optimistic.map(Math.round) },
        { name: t('neutral'), labels, values: d.totals.neutral.map(Math.round) },
        { name: t('pessimistic'), labels, values: d.totals.pessimistic.map(Math.round) },
        { name: t('paidInLine'), labels, values: d.paidIn.map(Math.round) },
      ],
      {
        x: 0.6, y: 1.5, w: 7.6, h: 4.6, lineSize: 2, lineDataSymbol: 'none',
        chartColors: [hex(c.accent), hex(c.primary), '9DB8D9', hex(c.muted)],
        showLegend: true, legendPos: 'b', legendFontSize: 11, legendColor: hex(c.text),
        valAxisLabelFormatCode: valFmt, valAxisLabelFontSize: 10, catAxisLabelFontSize: 10,
        valAxisLabelColor: hex(c.muted), catAxisLabelColor: hex(c.muted),
        valGridLine: { color: 'EEF0F3', size: 0.5 }, catAxisLabelFrequency: String(Math.max(1, Math.round(labels.length / 8))),
        ...chartFont,
      },
    );
    s.addText(`${t('value')} ${vm.year}`, { x: 8.6, y: 1.5, w: 4.1, h: 0.4, fontFace: H, fontSize: 16, bold: true, color: hex(c.text) });
    s.addChart(
      pptx.ChartType.bar,
      [{ name: String(vm.year), labels: [t('pessimistic'), t('neutral'), t('optimistic')], values: [k.pessimistic, k.neutral, k.optimistic].map(Math.round) }],
      {
        x: 8.6, y: 1.9, w: 4.1, h: 4.2, barDir: 'col',
        chartColors: ['9DB8D9', hex(c.primary), hex(c.accent)], // one colour per bar
        showValue: true, dataLabelFormatCode: valFmt, dataLabelFontSize: 10, dataLabelColor: hex(c.text), dataLabelPosition: 'outEnd',
        valAxisHidden: true, valGridLine: { style: 'none' }, catAxisLabelColor: hex(c.text), catAxisLabelFontSize: 11,
        showLegend: false,
        ...chartFont,
      },
    );
    disclaimer(s);
  }

  // 5 · Composition per product + table
  if (charts.composition) {
    const s = pptx.addSlide({ masterName: 'CONTENT' });
    title(s, t('chartComposition'), `${t('chartComposition')} ${vm.year}`);
    // horizontal bar charts list categories bottom-up, so reverse to keep the table order
    const rev = [...vm.positions].reverse();
    const labels = rev.map((p) => p.name);
    s.addChart(
      pptx.ChartType.bar,
      [
        { name: t('kpiPaidIn'), labels, values: rev.map((p) => Math.round(p.paidIn)) },
        { name: t('kpiSubsidy'), labels, values: rev.map((p) => Math.round(p.subsidy)) },
        { name: t('kpiGains'), labels, values: rev.map((p) => Math.round(p.gains)) },
      ],
      {
        x: 0.6, y: 1.5, w: 6.4, h: 4.6, barDir: 'bar', barGrouping: 'stacked',
        chartColors: ['9DB8D9', hex(c.accent), hex(c.primary)],
        showLegend: true, legendPos: 'b', legendFontSize: 11, legendColor: hex(c.text),
        // values are listed in the table next to the chart, so the value axis stays hidden
        valAxisHidden: true, valGridLine: { style: 'none' }, catAxisLabelFontSize: 10, catAxisLabelColor: hex(c.text),
        ...chartFont,
      },
    );
    const head = [t('product'), t('monthly'), t('oneOff'), `${t('value')} ${vm.year}`].map((text) => ({
      text,
      options: { bold: true, color: hex(onColor(c.primary)), fill: { color: hex(c.primary) } },
    }));
    const rows = vm.positions.map((p) => [
      { text: p.name },
      { text: fmt.eur(p.monthly), options: { align: 'right' as const } },
      { text: fmt.eur(p.oneOff), options: { align: 'right' as const } },
      { text: fmt.eur(p.value), options: { align: 'right' as const, bold: true } },
    ]);
    s.addTable([head, ...rows], {
      x: 7.3, y: 1.5, w: 5.43, colW: [2.33, 1, 1, 1.1], fontFace: B, fontSize: 10, color: hex(c.text),
      border: { type: 'solid', color: 'E3E7EC', pt: 0.5 }, rowH: 0.36, valign: 'middle',
    });
    disclaimer(s);
  }

  // 6 · Assumptions, AVD notes, disclaimer
  {
    const s = pptx.addSlide({ masterName: 'CONTENT' });
    title(s, t('reportAssumptions'), t('reportAssumptions'));
    const head = [t('product'), t('pessimistic'), t('neutral'), t('optimistic'), t('costs')].map((text) => ({
      text,
      options: { bold: true, color: hex(onColor(c.primary)), fill: { color: hex(c.primary) } },
    }));
    const seen = new Set<string>();
    const rows = vm.positions
      .filter((p) => !seen.has(p.product.id) && seen.add(p.product.id))
      .map((p) => [
        { text: p.name },
        { text: fmt.pct(p.product.returns.pessimistic) },
        { text: fmt.pct(p.product.returns.neutral) },
        { text: fmt.pct(p.product.returns.optimistic) },
        {
          text:
            p.product.kind === 'metal'
              ? `${t('entryFee')} ${fmt.pct(p.product.entryFee ?? 0)} · ${t('annualFee')} ${fmt.pct(p.product.annualFee ?? 0)} · ${t('exitFee')} ${fmt.pct(p.product.exitFee ?? 0)}`
              : '–',
        },
      ]);
    s.addTable([head, ...rows], {
      x: 0.6, y: 1.5, w: 12.13, colW: [3.8, 1.3, 1.3, 1.3, 4.43], fontFace: B, fontSize: 10, color: hex(c.text),
      border: { type: 'solid', color: 'E3E7EC', pt: 0.5 }, rowH: 0.34, valign: 'middle',
    });
    let y = 1.6 + (rows.length + 1) * 0.36 + 0.3;
    if (vm.real) {
      s.addText(t('reportRealNote', { inflation: fmt.pct(input.inflation) }), { x: 0.6, y, w: 12.13, h: 0.35, fontFace: B, fontSize: 11, color: hex(c.text) });
      y += 0.45;
    }
    if (vm.hasAvd) {
      s.addText(
        [
          { text: t('reportAvdTitle'), options: { bold: true, breakLine: true, fontFace: H, fontSize: 14 } },
          { text: t('reportAvdText'), options: { fontSize: 11 } },
        ],
        { x: 0.6, y, w: 12.13, h: 1.0, fontFace: B, color: hex(c.text), valign: 'top', fill: { color: hex(c.surface) }, inset: 0.15 },
      );
      y += 1.15;
    }
    s.addText(t('disclaimer'), { x: 0.6, y: Math.max(y, 5.4), w: 12.13, h: 1.2, fontFace: B, fontSize: 9, color: hex(c.muted), valign: 'top' });
  }

  return (await pptx.write({ outputType: 'blob' })) as Blob;
}

export function pptxFileName(vm: ViewModel) {
  const safe = vm.input.client.name.replace(/[^\p{L}\p{N}-]+/gu, '_');
  return `Portfolio_${safe}_${vm.lang.toUpperCase()}.pptx`;
}
