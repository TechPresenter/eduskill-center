# EduSkill India Foundation Platform – Engineering Conventions

Pan-India skill training platform: **India → State → District → Block → Training Center → Course → Batch → Trainer → Student**.
One centralised **Super Admin + permission-based Foundation Staff** control everything. There are NO state/district/block/center admins.

## Stack
Next.js 16 (App Router, `src/`), TypeScript strict, Tailwind v4 (`src/app/globals.css` holds the theme tokens), Prisma 7 + PostgreSQL (`prisma/schema.prisma`), Zod 4, lucide-react icons, Recharts, Leaflet.

- `npm run db:local` starts a real local PostgreSQL (embedded-postgres, port 5433). `npm run db:migrate`, `npm run db:seed`.
- `npm run typecheck`, `npm run lint`, `npm run build`, `npm test` (vitest, DB-backed).

## Where things live
- `src/generated/prisma/client` – Prisma client (server). `src/generated/prisma/enums` – enums safe for client components.
- `src/lib/db.ts` – `db` (PrismaClient singleton), `Prisma`, `Decimal`.
- `src/lib/auth/session.ts` – `getSessionUser()` (memoised per request), `AuthUser`, `createSession`, cookies. `src/lib/auth/guards.ts` – `requireAdmin(permission?)`, `requireStudent()`, `requireTrainer()`, `requireUser()` for server components (they `redirect`).
- `src/lib/rbac/permissions.ts` – permission catalog (`module.action`), `hasPermission(user, key | key[])`.
- `src/lib/api/handler.ts` – `apiHandler(opts, fn)` wrapper for route handlers, `parseBody(req, schema)`, `parseQuery(req, schema)`. `src/lib/api/errors.ts` – `Errors.notFound()` etc. `src/lib/api/query.ts` – `paginationSchema`, `getPaging`, `buildOrderBy`, `paged`, date range helpers.
- `src/lib/ids.ts` – all unique ID generators (center code, student ID, trainer ID, application/admission/payment/certificate numbers). Never build IDs by hand.
- `src/lib/audit.ts` – `audit({ user, action, module, recordType, recordId, description, oldValue, newValue, ip, userAgent })`. Call it on every admin mutation.
- `src/lib/notifications` – `notify({ userId, email, mobile, event, data })` (IN_APP/EMAIL/SMS/WHATSAPP, templates overridable in admin) and `notifyStaff({ permission, title, body, path })`, which tells the Foundation that new work arrived. Email goes out over the SMTP configured in Admin → Settings → Communication; neither function ever throws, so a mail failure cannot roll back the work that triggered it (it lands as a FAILED row in Admin → Notifications → Log).
- `src/lib/settings.ts` – `getSetting(key)`, `getBranding()`, `getPublicSettings()`, `setSettings()`. All branding/config is DB-driven.
- `src/lib/storage` – `saveUpload(file, { folder, visibility, preset })` returns `{ key, url }`; files are served by `/api/files/[...key]` with access control. Private documents MUST use `visibility: "private"`.
- `src/lib/payments` – gateway abstraction (manual | razorpay).
- `src/lib/cms` – `getSection(key)`, `getSections(keys)`, `getPage(slug)`; registry in `src/lib/cms/sections.ts`.
- `src/server/*.ts` – business services (one file per module). Route handlers and server components call services; services own transactions, ID generation, status transitions, audit + notifications.
- `src/components/ui/*` – design system (Button/ButtonLink, Input/Textarea/Checkbox/RadioCards, Select, Field/FormSection/FormGrid/FormActions, Card, Badge/StatusBadge, Modal/Drawer/ConfirmDialog, Dropdown, Tabs/LinkTabs/SegmentedControl, TableWrap/THead/TH/TBody/TR/TD/EmptyRow/Pagination/DataList, Alert/EmptyState/ErrorState/Skeleton*/Spinner, StatsCard/ProgressBar/RingProgress, Avatar/Stepper/Timeline/Breadcrumbs/PageHeader/Divider/KeyValue, FileUpload/TagInput, DynamicIcon, Highlight, toast/Toaster).
- `src/lib/api-client.ts` – `api.get/post/put/patch/delete` + `ApiClientError` (has `fieldErrors`) for client components. `src/lib/utils.ts` – `cn`, `formatINR`, `formatDate`, `titleCase`, `slugify`, etc.

## API conventions
```ts
// src/app/api/admin/centers/route.ts
export const GET = apiHandler({ permission: "centers.view" }, async ({ req }) => {
  const q = parseQuery(req, listSchema);      // Zod → 422 on failure
  return listCenters(q);                       // plain value → { success: true, data }
});
export const POST = apiHandler({ permission: "centers.create" }, async ({ req, user, ip, userAgent }) => {
  const body = await parseBody(req, createSchema);
  return createCenter(body, { user: user!, ip, userAgent });
});
// dynamic: apiHandler<{ id: string }>({...}, async ({ params }) => ...)
```
- `auth: "required"` is the default (401). Use `auth: "none"` only for public endpoints (and `rateLimit`). Students/trainers: `roles: ["STUDENT"]` / `["TRAINER"]` and ALWAYS scope queries to `user.student.id` / `user.trainer.id` – a student can only ever read their own data.
- Errors: throw `Errors.notFound("Center")`, `Errors.badRequest(msg)`, `Errors.conflict(msg)`, `Errors.forbidden()`.
- Lists: accept `paginationSchema` (`page, limit, sort, order, q`) + filters; return `paged(items, total, q)`.
- Money is `Decimal` in Prisma – convert with `toNumber()` before sending to the client or doing arithmetic; write back numbers/strings.
- Every state-changing admin action: `audit(...)`. Every workflow status change for a student/trainer: `notify(...)` and append to the relevant `*StatusHistory` table.
- Every new piece of inbound work (a registration, application, payment declaration, donation, enquiry, ticket) also calls `notifyStaff(...)` with the permission that owns that module, so Super Admins and the staff who can act on it are emailed. Adding a `NotifyEvent` means adding its `DEFAULT_TEMPLATES` entry and its `EVENT_CATEGORY` entry — the latter is `satisfies Record<NotifyEvent, …>`, so tsc catches a missing one.
- Never expose `passwordHash`, secrets, or private document URLs to unauthorised roles.

## Server components
```ts
export default async function Page({ params, searchParams }: PageProps<"/admin/centers/[id]">) {
  const user = await requireAdmin("centers.view");
  const { id } = await params;
  ...
}
```
`params`/`searchParams` are Promises (Next 16). Prefer server components + small client components for interactivity. Use `"use client"` only where needed.

## UI conventions
- Public site: navy (`bg-navy`) header/hero/footer, orange (`bg-orange`) CTAs, lavender (`bg-lavender`) alternating sections, white rounded cards (`card`, `card-hover`), `eyebrow` labels, `section-title` headings, `container-x` containers. Headings use `font-heading`.
- Admin/portals: white cards on `bg-surface`, tables via `TableWrap`, `PageHeader`, `StatsCard`. Tables must scroll horizontally on mobile; forms stack on mobile.
- Accessibility: every input has a `<Field label>`; buttons have text or `aria-label`; keyboard-navigable; visible focus.
- Use `toast.success/error` for feedback; `ConfirmDialog` before destructive actions.
- No hard-coded statistics. No fake API responses. No placeholder buttons.

## Workflows (statuses live in `prisma/schema.prisma`)
- Application: DRAFT → SUBMITTED → UNDER_REVIEW → (DOCUMENTS_REQUIRED ↔) → APPROVED → PAYMENT_PENDING → PAYMENT_COMPLETED → ADMISSION_CONFIRMED → COMPLETED; side exits WAITLISTED / REJECTED / CANCELLED. Services: `src/server/applications.ts`.
- Trainer application: SUBMITTED → UNDER_REVIEW → (DOCUMENTS_REQUIRED ↔) → SHORTLISTED → INTERVIEW → VERIFIED → APPROVED (creates Trainer + Trainer ID + user account) / REJECTED. Services: `src/server/trainers.ts`.
- Batch capacity is enforced inside a transaction with a row lock (`src/server/batches.ts` → `assertBatchHasSeat`).
- Location validation for trainers: BLOCK needs state+district+block; DISTRICT needs state+district; STATE needs state.

## Transactions
Inside `db.$transaction(async (tx) => …)` the client is ONE connection: never `Promise.all` queries on `tx` – run them sequentially. `Promise.all` is fine on `db` (pooled).

## Mobile-first / Android-app layer
The same app serves desktop and a native-feeling Android experience. Phones get an app shell; `lg+` keeps the desktop layout.

- **Portal shell** (`src/components/portal/`): `PortalShell` composes `MobileHeader` (sticky app bar: back arrow on deep pages, page title, bell + unread badge, avatar/account sheet, hamburger), a full-height LEFT drawer listing every nav destination plus Logout, and `BottomNav` (max 5 items, orange active state, `pb-safe`). Page components must NEVER render their own header, hamburger, menu or title bar — set the app-bar title via `PageHeader` (`mobileTitle`, `backHref`, `mobileActions`, `hideMobileTitle`), which renders `SetMobileHeader` from `header-context.tsx`.
- **Bottom nav targets** live in `src/components/{student,trainer,admin}/nav.ts`. A `NavItem` with `action: "menu"` opens the drawer instead of navigating. Every href must resolve to a real page.
- **Tables → cards**: `TableWrap` (client, `src/components/ui/table-wrap.tsx`) turns rows into labelled cards below `md`; `TD` takes `label` / `mobile="full"|"actions"|"hidden"`. Use `ResponsiveTable` when rows have checkboxes or inline inputs.
- **Overlays**: `BottomSheet` (sheet on phones → dialog/drawer at `sm+`), `ResponsiveSheet`, `ActionSheet`, `Fab`, `StickyActionBar`, `WizardShell`/`WizardProgress`. All trap focus, lock scroll, close on Escape.
- **CSS utilities** (`globals.css`): `pb-safe`, `pt-safe`, `pb-safe-nav`, `touch-target`, `tap-highlight-none`, `hscroll`, `snap-row`, `table-cards`.
- **Rules**: 44px minimum touch targets, 16px inputs (Android must not zoom), no text under 12px, no horizontal page scroll except deliberate `hscroll` rows, animations ≤300ms with `motion-reduce:animate-none`.

### Server/client boundary gotchas
- `src/components/ui/table.tsx` must stay a SERVER module: server pages pass `hrefFor` (a function) to `Pagination`. Only the client part lives in `table-wrap.tsx`. Adding `"use client"` to table.tsx breaks every admin list page with "Functions cannot be passed directly to Client Components".
- Nav modules that export lucide icon components (`*/nav.ts`) need `"use client"`, otherwise the server layout passes function objects into the client shell and every portal page 500s.
- Any `overflow-x: auto` wrapper needs `position: relative`, or `sr-only` (absolutely positioned) descendants escape it and stretch `document.scrollWidth`.
- A CSS animation with `fill-mode: both` (`animate-page`) leaves the computed transform as an identity `matrix(...)`, not `none` — still a containing block, so `position: fixed` children (Fab, StickyActionBar) anchor to the wrapper and scroll away. `PageTransition` drops the class from an effect via `getAnimations()`; `onAnimationEnd` alone misses it, because the animation ends before hydration.

### Verifying responsive work
`npx tsx scripts/screenshot.ts <baseUrl> <route…> [--full]` captures 360/390/412/768/1024/1280/1440/1920 screenshots into `.data/shots`, reports horizontal overflow and names the offending elements. `SHOT_WIDTHS=360,390` limits viewports; `SHOT_COOKIE="esk_session=<token>"` reaches portal routes. `npx tsx scripts/smoke.ts <baseUrl>` checks all 94 routes across the four roles plus role isolation.

### Local environment
Dev needs two processes: `npm run db:local` (embedded PostgreSQL on :5433) and `npm run dev`. Drive F: is small — the Turbopack dev cache once reached 6.6 GB and filled the disk, so `experimental.turbopackFileSystemCacheForDev` is off in `next.config.ts`; delete `.next/dev` if space runs low. `npm run db:reset` (scripts/db-reset-dev.ts) truncates and reseeds the LOCAL database; `prisma migrate reset` refuses to run unattended.
