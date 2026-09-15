# Shagoon Seating Chair

Astro website and internal invoice-management application for Shagoon Seating
Chair, a furniture business specializing in chairs, sofas, tables, and related
seating products.

This repository contains two connected application areas:

1. A public marketing website for customers.
2. A protected administration area for creating and managing invoices.

> Last updated: September 15, 2026.

## Application overview

```text
Public visitor
  -> /, /about, /portfolio, /contact

Administrator
  -> /login
  -> signed HttpOnly session cookie
  -> /bills
  -> create, search, view, edit, delete, and export invoices
  -> Astro API routes
  -> Cloudflare D1 REST API
```

The project uses Astro server output. It is not a fully static website because
authentication and billing API routes execute on the server.

## Technology stack

| Area | Technology |
|---|---|
| Framework | Astro 5 |
| Language | Astro, TypeScript, JavaScript |
| Runtime adapter | `@astrojs/cloudflare` |
| Database | Cloudflare D1 accessed through the Cloudflare REST API |
| Authentication | Signed HMAC session cookie |
| Spreadsheet export | `xlsx` |
| PDF generation | `html2pdf.js` |
| Date picker | jQuery UI loaded from a CDN on create/edit pages |
| Styling | Page-scoped CSS and shared CSS variables |

## Repository structure

```text
.
|-- public/                         Static images and browser assets
|-- src/
|   |-- components/
|   |   |-- Navigation.astro       Public-site navigation
|   |   `-- Footer.astro           Public-site footer
|   |-- config/
|   |   |-- auth.js                Auth API paths and redirect paths
|   |   `-- database.ts            D1 client, schema types, and initialization
|   |-- data/
|   |   |-- homeData.json          Home-page content
|   |   |-- aboutData.json         About-page content
|   |   |-- portfolioData.json     Portfolio content
|   |   |-- productsData.json      Product content
|   |   `-- contactData.json       Contact-page content
|   |-- layouts/
|   |   `-- Layout.astro           Shared HTML, SEO metadata, and design tokens
|   |-- lib/
|   |   |-- auth/session.ts        Session creation and verification
|   |   `-- billing/calculations.ts Server-authoritative invoice calculations
|   |-- pages/
|   |   |-- index.astro            Public home page
|   |   |-- about.astro            Public company page
|   |   |-- portfolio.astro        Public product portfolio
|   |   |-- contact.astro          Public contact page
|   |   |-- login.astro            Administrator PIN login
|   |   |-- bills.astro            Invoice list and management dashboard
|   |   |-- bills/
|   |   |   |-- new.astro          Create-invoice form
|   |   |   `-- edit/[id].astro    Edit-invoice form
|   |   |-- invoice/
|   |   |   `-- [id].astro         Printable invoice and PDF view
|   |   `-- api/                    Server API routes
|   |-- types/
|   |   `-- contact.ts             Contact-related types
|   `-- middleware.ts              Billing page and API authorization
|-- .env.example                   Safe environment-variable template
|-- astro.config.mjs               Astro Cloudflare server configuration
|-- package.json                   Dependencies and scripts
`-- tsconfig.json                  Strict Astro TypeScript configuration
```

## Routes

### Public pages

| Route | Purpose |
|---|---|
| `/` | Home page with business and product content |
| `/about` | Company story, values, and manufacturing information |
| `/portfolio` | Filterable furniture portfolio |
| `/contact` | Contact information, location, FAQs, and inquiries |
| `/login` | Administrator PIN login |

The public navigation intentionally does not expose billing-management links.

### Protected administration pages

| Route | Purpose |
|---|---|
| `/bills` | Search, filter, paginate, export, view, edit, and delete invoices |
| `/bills/new` | Create an invoice |
| `/bills/edit/[id]` | Edit an existing invoice |
| `/invoice/[id]` | Render and download an invoice |

Astro middleware protects `/bills`, `/bills/**`, `/invoice`, and
`/invoice/**`. Unauthenticated page requests redirect to `/login`.

### Authentication APIs

| Method and route | Purpose |
|---|---|
| `POST /api/auth/login` | Validate a six-digit PIN and create a session |
| `POST /api/auth/logout` | Delete the session cookie |
| `GET /api/auth/session` | Report whether the current session is valid |

### Billing APIs

| Method and route | Purpose |
|---|---|
| `GET /api/bills` | Return paginated bill summaries |
| `POST /api/bills` | Create a bill and its items |
| `GET /api/bills/[id]` | Return a complete bill with items |
| `PUT /api/bills/[id]` | Update a bill and replace its items |
| `DELETE /api/bills/[id]` | Delete a bill and its items |
| `GET /api/bills/export` | Download matching bills as an Excel workbook |
| `GET /api/customers/search?q=...` | Find recent details for prior customers |
| `GET /api/debug/db` | Test the D1 connection; protected by middleware |

All billing, customer, export, and debug APIs require an authenticated admin
session.

## Authentication design

Authentication is implemented in `src/lib/auth/session.ts`,
`src/pages/api/auth/`, and `src/middleware.ts`.

### Login flow

1. The browser sends the entered PIN to `POST /api/auth/login`.
2. The server reads `ADMIN_PIN` from a local environment variable or a
   Cloudflare runtime binding.
3. The PIN comparison occurs only on the server.
4. A successful login creates an HMAC-signed session token.
5. The token is stored in an `HttpOnly`, `SameSite=Strict` cookie.
6. The session expires after eight hours.
7. Middleware validates the cookie before protected pages or APIs execute.

The PIN and session token are not stored in browser `localStorage`.

### Authentication configuration

The following values are mandatory:

```dotenv
ADMIN_PIN=your_six_digit_pin
SESSION_SECRET=generate_a_long_random_secret
```

`SESSION_SECRET` should be a cryptographically random value with at least 32
bytes of entropy. Never reuse the administrator PIN as the session secret.

For local development, Astro loads these values from `.env.local` and
environment-specific local files. On Cloudflare, configure them as encrypted
Worker or Pages secrets.

If either value is unavailable, authentication returns HTTP `503` with a
configuration message instead of accepting an insecure default.

## Billing workflow

### Invoice list

`src/pages/bills.astro` provides:

- Search by bill number, internal ID, customer name, or phone number.
- Start-date and end-date filtering.
- Pagination with up to 50 summaries per request.
- Manual refresh.
- Links to view and edit an invoice.
- Delete confirmation and optimistic list removal.
- Excel export using the active search and date filters.
- Responsive controls and mobile-friendly action targets.

The list API intentionally returns summaries instead of complete invoice
records. A summary includes:

- Internal bill ID.
- Bill number.
- Customer name and phone.
- Invoice date.
- Total amount.
- Payment method and status.
- Item count.
- Creation and update timestamps.

Full addresses, bank details, notes, terms, and item records are fetched only
when a user opens an invoice.

### Creating an invoice

`src/pages/bills/new.astro` collects:

- Bill, invoice, challan, and purchase-order information.
- Customer name, code, phone, email, address, and GST number.
- Up to 15 invoice items.
- CGST, SGST, IGST, and discount percentages.
- Payment method, status, and payment terms.
- Bank details.
- Notes and terms and conditions.

Customer autocomplete searches previous bills after at least three characters.
The most recent bill for each matching customer name supplies the suggestion's
contact and GST details.

### Editing an invoice

`src/pages/bills/edit/[id].astro`:

1. Fetches the complete invoice.
2. Populates the create-style form.
3. Allows item addition and removal up to the 15-item limit.
4. Recalculates displayed totals.
5. Sends the updated bill to `PUT /api/bills/[id]`.
6. Invalidates cached bill summaries.
7. Redirects to `/bills`.

### Viewing and exporting an invoice

`src/pages/invoice/[id].astro` always fetches the current complete invoice from
the server. It renders:

- Company and customer information.
- Invoice, challan, P.O., dispatch, vendor, and HSN data.
- Item rows and tax totals.
- Amount in words using the Indian lakh/crore numbering system.
- Bank details and terms.
- GST, PAN, and signature information.

PDF generation uses `html2pdf.js`. Excel export is produced on the server with
the `xlsx` package.

## Invoice calculation rules

Shared server calculations live in `src/lib/billing/calculations.ts`.

```text
item total       = unit price x numeric quantity
subtotal         = sum of item totals
CGST amount      = subtotal x CGST percentage / 100
SGST amount      = subtotal x SGST percentage / 100
IGST amount      = subtotal x IGST percentage / 100
discount amount  = subtotal x discount percentage / 100
total tax        = CGST + SGST + IGST
invoice total    = subtotal + total tax - discount
```

Important invariants:

- At least one item is required.
- A maximum of 15 items is supported.
- Unit price and numeric quantity must be greater than zero.
- Tax and discount percentages must be between 0 and 100.
- Currency results are rounded to two decimal places.
- The server recalculates every financial total and does not trust totals sent
  by the browser.

Quantity is currently stored as text so values such as `2`, `1 PC`, or
`5 units` are allowed. Calculations use the first numeric value found in the
text. Any future quantity changes must preserve or deliberately migrate this
behavior.

## Bill-list caching

The list uses stale-while-revalidate caching to combine fast rendering with
fresh data.

### Browser behavior

- Bill summaries are cached in `sessionStorage`, not persistent
  `localStorage`.
- Every page/filter combination has a separate cache key.
- A cached summary page is displayed immediately.
- The browser always revalidates it against the API in the background.
- An active request is aborted when a newer filter or page request starts.
- Data revalidates when the tab regains focus or becomes visible.
- Visible tabs revalidate every 30 seconds.
- Revalidation events are throttled to avoid duplicate rapid requests.
- Create, edit, delete, and logout operations invalidate all summary caches.

### Server behavior

`GET /api/bills` returns an `ETag` derived from:

- Matching record count.
- Latest matching `updated_at` timestamp.
- Page and limit.
- Current search and filter parameters.

The browser sends `If-None-Match` during revalidation. If data has not changed,
the server returns `304 Not Modified` without resending the bill list.

Responses use:

```http
Cache-Control: private, no-cache
Vary: Cookie
```

Do not replace this design with a fixed "cache is valid for N minutes" rule.
That can hide changes made in another browser or by another administrator.

## Database architecture

The D1 REST client and schema initialization are in
`src/config/database.ts`.

Required database environment variables:

```dotenv
CLOUDFLARE_ACCOUNT_ID=your_account_id
CLOUDFLARE_D1_DATABASE_ID=your_database_id
CLOUDFLARE_API_TOKEN=your_api_token
```

No credential has a source-code fallback. Missing values cause database
initialization to fail explicitly.

### `bills`

Stores:

- Invoice identifiers and dates.
- Challan, purchase-order, dispatch, vendor, and HSN information.
- Customer contact, address, and GST information.
- Subtotal, tax percentages and amounts, discount, and final total.
- Payment method, payment status, and payment terms.
- Bank details.
- Notes and terms and conditions.
- Creation and update timestamps.

Allowed payment methods:

```text
cash
card
upi
bank_transfer
cheque
dd
```

Allowed database payment statuses:

```text
paid
pending
partial
```

The current create/edit UI exposes `paid` and `pending`.

### `bill_items`

Stores:

- Parent bill ID.
- Sequence number.
- Product name and description.
- Product category and HSN code.
- Unit price.
- Text quantity.
- Total price.
- Unit label.

Items reference `bills.id` and are intended to be deleted with their parent
bill.

### `company_info`

Stores company name, address, contact details, GST, PAN, state code, and logo
URL. Some invoice-view company values are still hardcoded, so this table is not
yet the only company-information source.

### Indexes

Initialization creates indexes for common bill and item lookups, including
customer name, customer code, invoice date, payment status, customer GST,
bill-item parent ID, and item HSN code.

## Environment setup

### Prerequisites

- Node.js supported by the installed Astro version.
- npm.
- A Cloudflare account.
- A Cloudflare D1 database.
- A Cloudflare API token with the minimum required D1 permissions.

### Install

```powershell
git clone <repository-url>
Set-Location shagoonchair
npm install
```

### Configure local environment

```powershell
Copy-Item .env.example .env.local
```

Replace every placeholder in `.env.local`. Never commit `.env.local`,
`.env.development.local`, `.env.production`, or any populated environment file.

Generate a session secret with PowerShell:

```powershell
$bytes = New-Object byte[] 32
[Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
[Convert]::ToHexString($bytes).ToLowerInvariant()
```

### Run locally

```powershell
npm run dev
```

The default development URL is `http://localhost:4321`.

### Production build

```powershell
npm run build
```

### Preview

```powershell
npm run preview
```

## npm scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Start the Astro development server |
| `npm run build` | Generate the Cloudflare server build in `dist/` |
| `npm run preview` | Preview the production build |
| `npm run astro -- <command>` | Run an Astro CLI command |

Do not document or invoke scripts that are not present in `package.json`.

## Deployment

Deploy to Cloudflare Workers or Cloudflare Pages with server-side Astro
support. A generic static host is not sufficient for the authentication and API
routes.

Configure these production secrets and variables:

```text
ADMIN_PIN
SESSION_SECRET
CLOUDFLARE_ACCOUNT_ID
CLOUDFLARE_D1_DATABASE_ID
CLOUDFLARE_API_TOKEN
```

Deployment checklist:

1. Use a production-specific admin PIN.
2. Generate a unique production session secret.
3. Use a least-privilege Cloudflare API token.
4. Confirm no secrets exist in tracked files or build logs.
5. Build the application.
6. Confirm unauthenticated `/bills` requests redirect to `/login`.
7. Confirm unauthenticated billing API requests return `401`.
8. Confirm login, create, view, edit, delete, PDF, and Excel flows.
9. Rotate any credential that was previously committed or shared.

## Design system

Shared public-site design values:

| Token | Value |
|---|---|
| Primary | `#2c3e50` |
| Secondary | `#8b4513` |
| Accent | `#e67e22` |
| Typography | Inter |

Development expectations:

- Maintain a mobile-first responsive layout.
- Use semantic HTML and accessible labels.
- Keep interactive touch targets at least 44 by 44 pixels on mobile.
- Reuse Astro components where possible.
- Preserve the established furniture-focused visual language.
- Keep animations purposeful and avoid blocking interaction.

## Security invariants

Future changes must preserve the following:

- Never put the admin PIN in browser JavaScript.
- Never use localStorage as proof of authentication.
- Protect both UI routes and API routes.
- Keep the session cookie `HttpOnly` and `SameSite=Strict`.
- Never add fallback credentials to source code.
- Never commit populated environment files.
- Treat customer names, addresses, item descriptions, and terms as untrusted
  input.
- Prefer `textContent` or Astro escaping over `innerHTML`.
- If HTML output is unavoidable, escape or sanitize every dynamic value.
- Recalculate invoice totals on the server.
- Clear billing caches during logout.
- Do not log credentials, full request bodies, or unnecessary customer data.

## Development guide

### Adding or changing a bill field

A bill field may affect multiple surfaces. Check all of them:

1. `Bill` interface in `src/config/database.ts`.
2. D1 `bills` table schema and migrations.
3. Create form.
4. Create-page payload construction.
5. `POST /api/bills`.
6. Edit form population.
7. Edit-page payload construction.
8. `PUT /api/bills/[id]` update allowlist.
9. Invoice rendering.
10. Excel export, if the field should be exported.
11. Search or list summaries, if the field should appear there.

Do not update only the form. A field is complete only when storage, validation,
editing, and display behavior agree.

### Changing financial calculations

Make the primary change in `src/lib/billing/calculations.ts`. Keep browser
calculations for immediate feedback, but ensure the server remains
authoritative. Cover rounding, empty items, invalid percentages, quantity
parsing, and maximum item count.

### Changing authentication

Review all three layers:

1. `src/lib/auth/session.ts`
2. `src/pages/api/auth/`
3. `src/middleware.ts`

Do not protect only the page. Attackers can call API routes directly.

### Changing bill-list data

If the list response shape changes:

- Update the summary query in `GET /api/bills`.
- Update `createTableRow()` in `src/pages/bills.astro`.
- Ensure the ETag changes when the visible result can change.
- Preserve query-specific cache keys.
- Invalidate cache after every mutation.

## Known limitations and technical debt

These are known areas for future improvement:

- The D1 client uses the Cloudflare REST API instead of a native D1 runtime
  binding.
- The custom database `batch()` executes sequential requests and is not a true
  atomic transaction.
- Updating invoice items deletes previous items before inserting replacements.
  A transaction should protect this operation.
- Create and edit pages contain large duplicated form and script sections that
  should become shared components and TypeScript modules.
- jQuery and jQuery UI are loaded from external CDNs for date selection.
- PDF generation depends on browser-side HTML capture and may need refinement
  for invoices with unusually long content.
- `src/pages/invoice.astro` is an empty legacy route; the active route is
  `/invoice/[id]`.
- Company information exists both in code and in `company_info`.
- Automated unit and end-to-end test suites have not yet been established.
- Financial values use JavaScript numbers. A future accounting-focused version
  should consider integer paise or a decimal library.

## Troubleshooting

### Login returns 503

Confirm both variables are defined and non-empty:

```text
ADMIN_PIN
SESSION_SECRET
```

Local values belong in `.env.local` or `.env.development.local`. Cloudflare
deployment values must be configured as runtime secrets.

### Login returns 401

- Enter exactly six digits.
- Confirm the entered value matches `ADMIN_PIN`.
- Restart the development server after changing environment files.

### Billing API returns 401

The session is missing or expired. Log in again. Sessions expire after eight
hours.

### Database requests fail

Check:

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_D1_DATABASE_ID`
- `CLOUDFLARE_API_TOKEN`
- API-token D1 permissions
- D1 database availability

Do not disable TLS certificate verification in production.

### Bill list appears briefly old

This is expected stale-while-revalidate behavior: cached summaries render
immediately, then the API confirms or replaces them. If the network request
fails, the cached list remains visible rather than showing an empty screen.

## Guidance for AI coding assistants

Use this README as the project-level context, then inspect the relevant source
before editing because code remains the final source of truth.

When working in this repository:

1. Preserve the split between the public website and protected billing area.
2. Never expose or invent credentials.
3. Do not weaken middleware or API authorization.
4. Search for all create, edit, view, export, and database uses before changing
   a bill field.
5. Reuse `src/lib/billing/calculations.ts` for server financial logic.
6. Preserve stale-while-revalidate and ETag semantics when changing the list.
7. Escape database-controlled content before inserting it into HTML.
8. Keep mobile behavior and accessibility intact.
9. Do not revert unrelated working-tree changes.
10. Run the existing production build after implementation changes.

Useful starting points:

| Task | Start with |
|---|---|
| Public design/content | `src/pages/*.astro`, `src/data/*.json` |
| Navigation/footer | `src/components/` |
| Login/session issue | `src/lib/auth/session.ts`, `src/pages/api/auth/`, `src/middleware.ts` |
| Bill list/search/cache | `src/pages/bills.astro`, `src/pages/api/bills/index.ts` |
| Create invoice | `src/pages/bills/new.astro`, `POST /api/bills` |
| Edit invoice | `src/pages/bills/edit/[id].astro`, `PUT /api/bills/[id]` |
| Invoice/PDF display | `src/pages/invoice/[id].astro` |
| Database/schema | `src/config/database.ts` |
| Totals/tax logic | `src/lib/billing/calculations.ts` |

## License and ownership

This repository contains business-specific branding, customer workflows, and
invoice templates for Shagoon Seating Chair. Confirm licensing and distribution
requirements with the repository owner before publishing or reusing business
assets.
