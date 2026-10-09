// Generates sample PowerPoint files for all languages/templates (dev check):
//   npx vite-node scripts/sample-exports.ts
import { buildViewModel } from '../src/charts/model';
import { catalog } from '../src/catalog';
import { project } from '../src/engine/projection';
import type { Lang } from '../src/engine/types';
import { writeFileSync } from 'node:fs';
import { buildHouseholdView } from '../src/charts/household';
import { exportPptx, pptxFileName } from '../src/export/pptx';
import { defaultState } from '../src/state';
import { builtInThemes } from '../src/templates/themes';

const s = defaultState();
const projection = project(s.input, catalog);
const cases: [Lang, number][] = [['de', 0], ['en', 1], ['pt', 2]];
process.chdir(process.argv[2] ?? '.');
for (const [lang, ti] of cases) {
  // PT deck: all charts, other scenarios as lines, allocation as bars
  const output =
    lang === 'pt'
      ? { ...s.output, showRange: true, allocationStyle: 'bar' as const, charts: { development: true, allocation: true, scenarios: true, composition: true } }
      : s.output;
  const vm = buildViewModel(s.input, projection, builtInThemes[ti], lang, s.yearIndex, false, output);
  const blob = await exportPptx(vm, s.advisor, buildHouseholdView(s, vm));
  writeFileSync(pptxFileName(vm), Buffer.from(await blob.arrayBuffer()));
  console.log('written', lang, builtInThemes[ti].name);
}
