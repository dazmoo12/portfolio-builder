# Changelog

All changes to the Portfolio Builder, newest first. Live site: https://personal-investment-plan.netlify.app (deploys automatically from `main`).

## 2026-11-25 – Saved clients, subsidy split, grown-up children, payout from 65

**Saved clients**
- Every client with a name is saved automatically in the browser. "+ New client" no longer loses the previous client.
- New left-panel section "Gespeicherte Kunden": open or delete earlier clients (newest first, search from 7 clients on).
- Starting a new client while the current one has data but no name asks for confirmation first, because unnamed clients are not saved.
- Saved only in that advisor's browser; "Save portfolio" and client folders remain the way to share a client.

**Government subsidy split between adults and children**
- The subsidy figure shows adults (base allowance incl. starter bonus) and children (child bonus) separately.
- A line "Förderung je Person" lists each adult's base allowance and child bonus.
- Shown in the preview, the PDF and the PowerPoint.

**Grown-up children**
- A further adult can be marked as "Kind von" (child of) the client or another adult.
- Until the grown-up child turns 25, that parent's AVD gets the child bonus, while the grown-up child keeps its own AVD with base allowance and starter bonus.

**Money journey: payout from 65**
- New setting "Auszahlung ab Alter" (65 to 70, default 65).
- Payouts start at that age even if the contract runs longer; contributions after it are left out, and a note under the chart says so.
- Previously the payout started at the end of the contract, e.g. at 67.
- Age labels on the chart are now multiples of 5, plus the payout age.

**Phones and tablets**
- On screens up to tablet portrait width, the tool works as six pages to go through: Kunde → Haushalt → Portfolio → Ergebnis → Einstellungen → Export.
- The pages are listed at the top, with Back and Next at the bottom. Laptops keep the side-by-side layout.
- Phone charts get a one-line, swipeable legend and fewer labels, so nothing overlaps; the product table can be swiped sideways.
- Tablets show the three key figures side by side.
- Phones and tablets cannot open a client folder, because their browsers don't allow websites to read and write folders.
- There, documents (including a saved `portfolio.json`) are picked one by one with "Dateien hochladen", also straight from the OneDrive app. A hint in the tool explains this, and the "Ordner hochladen" button is hidden.

## 2026-11-18 – Money journey and children per parent

**Money journey (Geldreise)**
- New chart showing the saving phase and the payout phase together, as in the example from the team:
  - saving phase stacked by own contributions, government subsidy and growth;
  - value at payout start, lump sum, remaining capital until the end age, and the monthly payouts;
  - figures below: paid in, lump sum, monthly payouts in total, total paid out.
- New left-panel section "Geldreise (Auszahlphase)":
  - journey for an AVD (per person) or for the whole portfolio;
  - lump sum at payout start (default 30 %, at most 30 %), return in the payout phase (default 4 %), payouts until age (default 85).
- Calculation rules:
  - payouts start when the contract term ends, at 65 at the earliest (the capital waits unchanged until then); a warning appears if they would start after 70;
  - the monthly amount is set at the start and recalculated every 3 years, using up the capital by the end age (with a constant assumed return the amounts stay level);
  - amounts before tax, no costs in the payout phase; no ETF comparison line.
- Shown in the live preview, as its own PDF page and as a native PowerPoint slide; can be switched off under "Ausgabe & Diagramme".

**Children per parent**
- Each child is assigned individually to the parent receiving its child bonus (previously one setting for all children).
- Saved portfolios convert automatically.

## 2026-11-17 – Editable assumptions and costs

- Return assumptions (pessimistic / neutral / optimistic) editable per product in the left panel, with a reset to the standard values.
- New "Kosten" section, all values editable:
  - Ausgabeaufschlag funds and DVAG portfolios 4 %, deducted from each payment;
  - Ausgabeaufschlag AVD 1 %, on own contributions only (not on the subsidy);
  - Geiger gold: markup 8.0 %, storage 1.0 % p.a., buyback discount 0.7 %; silver: markup 10.6 %, storage 1.31 % p.a., no buyback discount (from the internal cost sheet);
  - brokerage account fee 36 € p.a., once per client depot, split across the fund products by payments.
- Returns are stated after the funds' running costs (option A); the output says so.
- Values are saved with each portfolio, carry over to new clients and can be shared as a file.
- Costs in euros per product in the preview table; cost terms per product in PDF and PowerPoint.
- Effect: projections are lower than before; new AVD figures are slightly below the earlier offer PDFs, which were made without the 1 %.

## 2026-11-06 – Several adults, child birth dates, start and term per product, birth date search

- Any number of further adults (partner, grown-up children), each with name and date of birth or age; each AVD is assigned to one person.
- Children with date of birth, or birth year if the date is unknown.
- Start (month and year) and term per product in the portfolio list instead of one start and duration for everything; "apply to all products" link. After its term a contract's value stays unchanged; the output notes this.
- Automatic date-of-birth search when a client folder is opened or files are uploaded: ID files first (OCR, machine-readable zone with check digits), then documents, then other images; a date is only entered when it can be assigned clearly, existing dates are never overwritten.
- Saved portfolios from older versions are converted automatically.

## 2026-11-06 – Second adult, date of birth, product selection, one language switch

- Language switch changes interface and document together; the export section can still set a different document language.
- Second adult with own AVD subsidy and starter bonus; a child counts for one parent only.
- Date of birth for the adults: the age is calculated and locked, and decides the starter bonus and the payout-age check.
- Product selection via chart legends and chips: figures, charts and exports cover the shown products; PDF and PowerPoint state which products are left out.

## 2026-10-09 – Netlify deployment

- Deployment from GitHub to Netlify with a password gate (edge function, `SITE_USER` / `SITE_PASSWORD`), search engines blocked.

## 2026-10-09 – Prototype

- Calculation engine with AVD subsidy rules (verified against existing offers), three scenarios, inflation toggle.
- Live preview with time slider; household budget page; selectable charts and scenario.
- Exports: PDF (A4 print layout) and PowerPoint with native, editable charts; DE / EN / PT.
- Templates (built-in, logo or PowerPoint master upload), advisor profiles, client folders with `portfolio.json`, document import with value recognition and OCR, Excel client-data template.
