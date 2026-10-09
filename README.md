# Portfolio Builder (prototype)

Browser tool for preparing client portfolios across pension plans (AVD), DVAG portfolios / funds and precious metals.
It has a live preview with a time slider, three return scenarios, an inflation toggle, templates, and PDF + PowerPoint export (native, editable charts).
Languages: DE / EN / PT, with UI language and report language chosen separately.

**Household budget:** monthly net income and expenses, shown as the first page of the preview, PDF and PowerPoint. It includes the free amount, the proposed savings and the remaining reserve; the page can be switched off per client.

**Client folders:** "Open client folder" (Edge/Chrome) opens a local or OneDrive-synced folder.
- The portfolio is stored as `portfolio.json` in that folder and loads automatically next time.
- PowerPoint exports are saved straight into the folder.
- A folder without `portfolio.json` starts a clean client, named after the folder; nothing is carried over from the previous client.

**Output settings:**
- Choose which charts appear (development curve, allocation, composition, scenario comparison).
- The allocation can be a donut or bars.
- Choose the **displayed scenario**: all figures and the curve use it, labelled with its average return. Optionally, the other scenarios are drawn as lines.
- The settings apply to the preview, PDF and PowerPoint alike.

**Advisor profiles:** save contact details once and pick a default. "+ New client" starts the next client with that advisor and the same output settings.

**Client documents:** open a client folder or upload files or folders (drag & drop works too).
- Supported formats: images, PDF, Word (.docx), Excel (.xlsx/.xls/.csv), PowerPoint (.pptx) and text.
- Each document is previewed, and the tool suggests the values it recognises: net salary, rent, utilities, insurance, loans, child benefit, date of birth, children…
- **Apply** fills the household budget and client data. In tables, rows of the same category are summed; from payslips only the net pay is taken.
- Images and scanned PDFs: "Text erkennen (OCR)" runs locally (tesseract.js). Only the language model is downloaded once from a CDN.
- **Client data template (Excel)**: download, fill in, and drop it back in; it is imported exactly, in any language.
- A demo folder with fictional documents is in `demo/Kundenordner_Anna_Beispiel` (regenerate with `npx vite-node scripts/make-demo-folder.ts`).

Everything runs locally in the browser. No client data leaves the machine; state is kept in the browser and in "Save portfolio" files.

## Run

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # engine + template import tests
npm run build      # type-check + production build (static files in dist/)
```

- `http://localhost:5173/?report` shows the PDF layout on screen (to check templates without printing).
- `npx vite-node scripts/sample-exports.ts <out-dir>` writes sample PPTX files (DE/EN/PT × 3 templates).

## Deployment (Netlify)

The app is a static site: Netlify only serves the files, and all calculations, exports and document reading run in each advisor's browser. Client data never reaches the server, and any number of advisors can use it at the same time.

1. Netlify → *Add new site* → *Import an existing project* → GitHub → allow access to `dazmoo12/portfolio-builder`. The build settings come from `netlify.toml`.
2. *Site configuration → Environment variables*: set `SITE_USER` and `SITE_PASSWORD`. The edge function `netlify/edge-functions/password.ts` protects the whole site, including deploy previews. Without these variables the site stays locked.
3. Deploy. Every push to `main` deploys automatically.

Use the Git connection, not a drag-and-drop deploy: drag-and-drop deploys don't run edge functions, so the site would be public. Search engines are blocked (`robots.txt`, `X-Robots-Tag`).

Per-browser data: advisor profiles, custom templates and the last open client are stored in the browser of each advisor. Templates can be shared as template files.

## Architecture

| Layer | Folder | Notes |
|---|---|---|
| Calculation engine | `src/engine/` | Pure functions, no UI. AVD subsidy rules in `avd.ts`, projection in `projection.ts`, household budget in `household.ts`. Verified against the existing AVD offers (Philipp 543,108 €, Marny 12,343 €). |
| Product catalogue | `src/catalog/products.json`, `presets.json` | Data only. Returns per scenario, costs, minimum amounts, sources. |
| View model | `src/charts/model.ts` | Turns a projection into display numbers for the selected year (nominal or real). Shared by preview, PDF and PPTX. |
| Charts | `src/charts/options.ts` | ECharts options for preview + PDF. |
| Templates | `src/templates/` | Theme = colours, fonts, logo. Built-ins + custom (logo upload, PPTX/POTX master upload, JSON import/export). |
| Documents | `src/documents/` | Readers per file type (pdf.js, mammoth, SheetJS, slide XML, tesseract OCR), value recognition (`extract.ts`, keyword lists per category), Excel template, apply/auto-import. |
| Client folder | `src/folder/` | File System Access API: open folder, read/write `portfolio.json`, list files, save exports. |
| Exports | `src/export/` | `Report.tsx` (A4 print layout → "Save as PDF"), `pptx.ts` (PptxGenJS, native charts). |
| i18n | `src/i18n/` | `en.ts` is the reference dictionary; TypeScript enforces that every language has every key. |

### Calculation conventions
- Yearly compounding. One-off amounts and the AVD starter bonus are invested at the start. Monthly contributions and subsidies of a year are added at year end. This matches the existing offer PDFs.
- Funds: returns are after ongoing costs. An optional `entryFee` (front load) is deducted from each contribution.
- Metals: purchase markup on each contribution, storage fee p.a. on the value, buyback discount on the final value.
- AVD:
  - 50 % on the first 360 €, 25 % up to 1,800 € (max 540 €/year).
  - Child bonus 1:1 up to 300 € per child under 25.
  - Starter bonus 200 € under 25.
  - Own contribution capped at 6,840 €/year.
- No taxes (see disclaimer). "Real" mode deflates all values by the inflation rate.

## How to extend

**Add a product:** add an entry to `src/catalog/products.json` (`kind`: `avd` | `fund` | `metal`, `group` decides where it appears in the picker). No code change needed.

**Add a risk-profile preset:** add an entry to `src/catalog/presets.json`.

**Add a template:** either in the app (Design & templates → upload logo / PPTX, adjust colours, "Download template file"), or as code in `src/templates/themes.ts`. Chart series colours should be checked for colour-vision safety.

**Add a language:** create `src/i18n/xx.ts` implementing `Dict`, add the product names (`name.xx`, `description.xx`) in the catalogue, and register it in `src/i18n/index.ts` and the `Lang` type.

## Open points (to confirm with Product / Compliance)

- **Scenario returns** in `products.json` are marked `ASSUMPTION`, except AVD neutral 7 % (from the offers). They need sign-off.
- **Fund front loads (Ausgabeaufschlag)** are currently 0 %.
- **Geiger costs** were read from the market-comparison one-pager (gold 8.0 / 0.7 / 1.0 %, silver 10.6 / 0 / 1.31 %). Please confirm.
- **Preset mixes** (AVD / portfolio / metals shares per risk profile) are suggestions.
- **Corporate fonts** (e.g. "DVAG Type" from the PPTX master) only render where they are installed.

## Backlog

1. **Client data:**
   - Extend the keyword lists in `src/documents/extract.ts` with the wording of your real documents.
   - Legacy .doc/.ppt files cannot be read in the browser (convert to .docx/.pptx).
   - Microsoft Graph / OneDrive picker for cloud folders without local sync (needs an Azure AD app registration by IT).
   - CRM (Salesforce) import to pre-fill client and existing-contract data, plus a "switch existing Riester rate" case.
2. **Server-side PDF** (headless browser) for one-click downloads instead of the print dialog.
3. **Shared template library** (server storage instead of browser storage), with admin-maintained catalogue and assumptions and an audit log of which assumption version an export used.
4. **AVD payout phase:** lump sum 30 %, annuity / payout-plan illustration.
5. **Taxes:** Abgeltungsteuer, Teilfreistellung, deferred taxation of AVD payouts.
6. **Monte Carlo fan chart** as an alternative to the three fixed scenarios.
7. **Real product data:** live fund prices, gold price, KIDs.
