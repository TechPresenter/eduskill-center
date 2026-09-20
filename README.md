# EduSkill India Foundation – Digital Education & Skill Training Platform

A production-ready, Pan-India platform for **training center management, student admission, volunteer trainers, courses, batches, payments, scholarships, attendance, certificates and administration**, controlled by one centralised **EduSkill India Foundation Super Admin** with permission-based Foundation Staff.

Hierarchy: **India → State → District → Block → Training Center → Course → Batch → Trainer → Student**.
There are no state, district, block or center administrators: every approval and operational control sits with the Foundation.

## Stack

| Layer | Technology |
| --- | --- |
| Framework | Next.js 16 (App Router, React 19, TypeScript strict) |
| Styling | Tailwind CSS v4 with brand tokens (navy `#12357A`, orange `#E8520A`, lavender `#E8EAF6`) |
| Database | PostgreSQL 17 via Prisma 7 (`prisma/schema.prisma`, 60+ normalised tables) |
| Auth | bcrypt password hashing, httpOnly session cookies stored server-side, login history, lockout after 5 failures |
| Authorisation | Role-based access control with granular `module.action` permissions (roles + per-staff grants), enforced in every API route and server page |
| Files | Storage abstraction (local disk or S3-compatible) with private, access-controlled document serving |
| Communication | Email (SMTP), SMS (MSG91 / webhook), WhatsApp (Meta Cloud API / webhook), in-app notifications, admin-editable templates |
| Payments | Gateway abstraction: manual/offline verification or Razorpay (orders, checkout signature and webhook verification) |
| Documents | PDF certificates with verification QR, receipts/invoices, CSV/Excel/PDF report exports |
| Maps | Leaflet + marker clustering for the Pan-India training center map |
| AI assistant | Optional bilingual (Hindi/English) chat assistant on the public website. It answers from a cached snapshot of live platform data (courses, fees, training centers, admission steps, contact details) instead of inventing figures, streams its replies, and can read them aloud through the visitor's own browser voice. Greeting, quick questions, model and the per-visitor hourly limit are edited in **Admin → Settings → AI Assistant**; the widget hides itself entirely when `OPENAI_API_KEY` is not set. |
| Tests | Vitest (DB-backed workflow tests against an isolated `_test` database) |

## Quick start (local development)

```bash
npm install                # installs deps and generates the Prisma client
cp .env.example .env       # edit if needed (defaults work for local dev)
npm run db:local           # starts a real PostgreSQL 17 server on port 5433 (embedded, data in ./.data/pg)
# in a second terminal:
npm run db:migrate         # applies migrations (first run creates the schema)
npm run db:seed            # reference data + platform defaults + clearly marked DEMO data
npm run dev                # http://localhost:3000
```

If you already have PostgreSQL, skip `db:local` and point `DATABASE_URL` at your server.

### Demo accounts (created by `npm run db:seed`)

| Role | Login | Password |
| --- | --- | --- |
| Super Admin | `superadmin@eduskillindia.org` (set via `SEED_SUPER_ADMIN_*`) | `SuperAdmin@123` — local only, see below |
| Admissions Staff | `admissions@demo.eduskill.local` | `Demo@1234` |
| Finance Staff | `finance@demo.eduskill.local` | `Demo@1234` |
| Content Staff | `content@demo.eduskill.local` | `Demo@1234` |
| Volunteer Trainer (block level) | `trainer.kolkata@demo.eduskill.local` | `Demo@1234` |
| Student (admitted, ongoing batch) | `student1@demo.eduskill.local` | `Demo@1234` |
| Student (completed course + certificate) | `student10@demo.eduskill.local` | `Demo@1234` |

All demo accounts use the `*.demo.eduskill.local` domain. Seed without demo data for production: `SEED_DEMO=false npm run db:seed`.

The seed contains real reference data (36 States/UTs, 764 districts) and **demo** blocks, centers, courses, students, trainers, applications, payments, attendance and one certificate so every screen and workflow can be exercised immediately. Demo success stories are labelled "Demo Story".

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` / `npm run build` / `npm run start` | Next.js dev server / production build / production server |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm test` | Vitest workflow tests (creates/uses `<db>_test`) |
| `npm run db:local` | Start embedded local PostgreSQL (dev only) |
| `npm run db:migrate` / `db:deploy` | Create & apply migrations (dev) / apply migrations (production) |
| `npm run db:seed` | Seed (idempotent) |
| `npm run db:studio` | Prisma Studio |
| `npm run brand:assets` | Regenerate default icons / OG image from the SVG mark |

## Environment variables

See `.env.example`. Key settings:

- `DATABASE_URL` – PostgreSQL connection string.
- `AUTH_SECRET` – long random secret (sessions, upload tokens).
- `APP_URL` – public URL (used in emails, certificate QR codes, sitemap).
- `STORAGE_DRIVER=local|s3` (+ `STORAGE_LOCAL_DIR` or `S3_*`).
- `SMTP_*` – email delivery (can also be configured from Admin → Settings → Communication).
- `PAYMENT_GATEWAY=manual|razorpay`, `RAZORPAY_*` (can also be configured from Admin → Settings → Payments).
- `OPENAI_API_KEY` – **optional**, server-only. Enables the AI assistant on the public website; leave it empty and the assistant hides itself. Never prefix it with `NEXT_PUBLIC_`. Changing it needs a restart, not a rebuild; everything else about the assistant lives in Admin → Settings → AI Assistant.

Almost everything else (branding/logos, contact, ID formats, admissions switches, gateway, SMS/WhatsApp providers, certificate signatory, SEO) is editable at runtime from **Admin → Settings**; no redeploy required.

## Application map

| Area | URL | Notes |
| --- | --- | --- |
| Public website | `/`, `/about`, `/programs`, `/courses`, `/training-centers/[state]/[district]/[center]`, `/become-a-trainer`, `/scholarship`, `/success-stories`, `/contact`, `/verify-certificate/[no]`, `/blog`, `/events`, `/gallery`, `/faq`, `/donate`, legal pages | All content managed from Admin → CMS |
| Auth | `/login`, `/register`, `/forgot-password`, `/reset-password` | Single login for students, trainers and staff |
| Student portal | `/student/*` | Profile → find center → apply → documents → payment → admission → training → certificate |
| Trainer portal | `/trainer/*` | Assignments, batches, attendance, coursework, assessments, materials |
| Foundation admin | `/admin/*` | Dashboard, locations, centers, courses, batches, students, applications, admissions, payments, scholarships, attendance, progress, certificates, trainers, reports, CMS, notifications, staff, roles, settings, audit logs |
| REST API | `/api/auth`, `/api/public/*`, `/api/student/*`, `/api/trainer/*`, `/api/admin/*`, `/api/files/*`, `/api/webhooks/razorpay` | JSON envelope `{ success, data | error }`, Zod validation, pagination, filtering, sorting, rate limiting |

## Mobile experience (Android-app style)

The platform is one responsive web app, designed mobile-first. On phones it behaves like a native Android education app; from `lg` (1024px) up it is the full desktop application. There is no separate mobile codebase — same routes, APIs, database and business logic.

| Phone (< lg) | Desktop (lg+) |
| --- | --- |
| Sticky app bar: back arrow on detail pages, page title, notification bell with unread badge, profile avatar, hamburger | Fixed navy sidebar + top bar |
| Hamburger opens a full-height left navigation drawer with every destination for the role plus Logout | Sidebar always visible |
| Fixed 5-item bottom navigation with orange active state, respecting the Android gesture inset | No bottom navigation |
| Lists render as cards; filters open in a bottom sheet; row actions open an action sheet | Data tables with inline filters |
| Primary actions pinned in a sticky bottom bar; long forms become step-by-step wizards | Inline action rows and single-page forms |

Built-in rules: 44px minimum touch targets, 16px form text so Android never zooms, no horizontal page scrolling, safe-area padding, animations capped at 300ms and disabled under `prefers-reduced-motion`.

### Installable PWA / Android wrapper

- Web manifest with standard and maskable icons, app shortcuts and install screenshots; `viewport-fit=cover` plus safe-area handling for edge-to-edge Android displays.
- Service worker (`public/sw.js`, production only): static assets cache-first, public pages and public read-only APIs network-first, portal pages never cached with an offline fallback at `/~offline`, and every cache purged on logout. Authenticated APIs and private documents are never stored.
- An install prompt appears on supported browsers and is dismissible for two weeks.
- The architecture supports wrapping in an Android WebView, Trusted Web Activity or Capacitor without redesigning the frontend.

### Checking responsiveness

```bash
npx tsx scripts/smoke.ts http://localhost:3000            # all routes across the four roles + role isolation
npx tsx scripts/screenshot.ts http://localhost:3000 / /courses --full
SHOT_WIDTHS=360,390 SHOT_COOKIE="esk_session=<token>" npx tsx scripts/screenshot.ts http://localhost:3000 /student/dashboard
```

`screenshot.ts` captures 360/390/412/768/1024/1280/1440/1920 into `.data/shots`, flags horizontal overflow and names the element causing it.

## Architecture

```
prisma/                schema, migrations, seed (+ seed-data: locations, content, demo)
src/app/               routes: (site) public, (auth), student, trainer, admin, api
src/server/            business services (transactions, ID generation, status machines, audit, notifications)
src/lib/               db, auth, rbac, api helpers, ids, settings, storage, notifications, payments, cms, validation
src/components/        ui kit, portal shell, site/admin/student/trainer components
tests/                 vitest workflow tests
```

Key guarantees implemented in the services:

- **Unique, permanent IDs** – center codes (`ESK-WB-KOL-0001`, prefix/format configurable), Student IDs, Trainer IDs, application/admission/payment/receipt/certificate numbers are produced by an atomic database sequence and protected by unique constraints.
- **Batch capacity** – seat reservation happens inside a transaction with a row lock, so concurrent approvals can never overbook a batch.
- **Status machines** – applications and trainer applications only move along allowed transitions; every change is recorded in a history table and triggers notifications.
- **Private documents** – uploads are validated (type, size, magic bytes), stored privately and served only to the owner or permitted staff.
- **Audit log** – every administrative mutation records who, what, old/new values, IP and time.
- **Certificates** – issued only when attendance and assessment thresholds are met (or explicitly forced), with a public verification page and QR code.

## Production deployment

1. Provision PostgreSQL (e.g. managed Postgres) and object storage (S3-compatible) if desired.
2. Set environment variables (`.env.example`), especially `DATABASE_URL`, `AUTH_SECRET`, `APP_URL`, storage and SMTP.
3. `npm ci && npm run build`
4. `npm run db:deploy` then `SEED_DEMO=false npm run db:seed` (creates permissions, roles, the Super Admin, reference locations and default content).
5. `npm run start` behind a reverse proxy with HTTPS. Run it as a long-lived Node process (PM2/systemd/container).
6. Log in as the Super Admin, change the password, upload logos, configure contact details, payment gateway and communication providers from **Admin → Settings**, then add training centers, courses and staff.

Backups: schedule regular PostgreSQL dumps (`pg_dump`) and back up the storage directory/bucket. Rate limiting, session revocation and login history are built in; put the app behind HTTPS and keep `AUTH_SECRET` private.
