# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Xenith CRM — a Next.js 16 application for managing clients, projects, and quotations (cotizaciones) for Xenith. The app has two faces: a public marketing site and a protected CRM dashboard.

## Commands

```bash
# Development
npm run dev          # Start dev server at localhost:3000
npm run build        # Production build
npm run lint         # ESLint

# Database
docker compose up -d            # Start PostgreSQL (required before running the app)
docker compose down             # Stop PostgreSQL
npx prisma migrate dev          # Run pending migrations + regenerate client
npx prisma studio               # Open Prisma GUI
npm run db:seed                 # Seed the database (runs prisma/seed.ts via tsx)
```

No test framework is configured in this project.

## Environment Setup

Copy `.env.example` to `.env`. For local dev the Docker defaults work out of the box:

```
DATABASE_URL="postgresql://xenith:xenith123@localhost:5432/xenith_db"
AUTH_SECRET="<generate with: openssl rand -base64 32>"
NEXTAUTH_URL="http://localhost:3000"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_SETUP_KEY   # used by /api/auth/register-admin
```

## Architecture

### Route Groups (Next.js App Router)

- `app/(public)/` — Public marketing pages: `/inicio`, `/soluciones`, `/contacto`. Has its own layout with `Navbar` and `Footer`.
- `app/(auth)/` — Unauthenticated routes: `/login`. Minimal layout.
- `app/(dashboard)/dashboard/` — Protected CRM. Layout wraps every page with `Sidebar` + `DashboardHeader`. Sub-routes: `clientes`, `proyectos`, `cotizaciones`, `usuarios`. Each entity has `page.tsx` (list), `nuevo/page.tsx` (create), `[id]/page.tsx` (detail), `[id]/editar/page.tsx` (edit).
- `app/api/` — REST API routes grouped by entity: `clients`, `projects`, `quotations`, `users`, `auth`. All protected by checking `auth()` from NextAuth at the top of each handler.
- `app/page.tsx` — Root redirects to `/inicio`.

### Authentication (`auth.ts`)

NextAuth.js v5 (Auth.js) with the Credentials provider. JWT session strategy (8h session, 24h absolute max). Rate limiting on login attempts via `lib/security/rate-limiter.ts`. Constant-time bcrypt comparison to prevent timing attacks. Auth state is also mirrored in Zustand (`store/authStore.ts`) for client-side access. Three roles: `SUPERADMIN`, `ADMIN`, `USER`.

### Data Layer

Prisma ORM with PostgreSQL. The singleton client lives in `lib/db/prisma.ts`. Core models:
- `User` — auth + role-based access
- `Client` — CRM contacts
- `Project` — linked to Client + assigned User, has `Task[]` sub-items
- `Quotation` — linked to Client + optional Project, has `QuotationItem[]`. Auto-numbered as `QT-YYYY-NNNN`.
- Auth tables (`Account`, `Session`, `VerificationToken`) managed by Auth.js via PrismaAdapter.

### State Management

Zustand stores in `store/`:
- `authStore.ts` — persisted client-side user state (mirrors NextAuth session)
- `clientStore.ts`, `projectStore.ts`, `quotationStore.ts` — entity caches
- `uiStore.ts` — UI state (modals, loading, etc.)

Custom hooks in `hooks/` (`useClients`, `useProjects`, `useQuotations`, `useAuth`) wrap API calls and sync data into the Zustand stores.

### Validation

All form and API input is validated with Zod schemas in `lib/validations/`. Forms use React Hook Form with `@hookform/resolvers/zod`. The same schemas are used client-side (forms) and server-side (API routes).

### PDF Generation

Quotations can be exported as PDFs. `lib/pdf/generator.ts` + `lib/pdf/templates/quotation.tsx` use `@react-pdf/renderer`. The PDF endpoint is `GET /api/quotations/[id]/pdf`.

### UI Components

Custom component library in `components/ui/` (Button, Card, Input, Select, Textarea, Modal, Badge, Alert, Spinner, Table). Styled with Tailwind CSS v4. Use `cn()` from `lib/utils/cn.ts` (clsx + tailwind-merge) for conditional class names.

Components are organized by layer:
- `components/ui/` — primitive building blocks
- `components/forms/` — form wrappers for each entity (ClientForm, ProjectForm, QuotationForm, LoginForm, ContactForm)
- `components/layout/` — structural components (Navbar, Footer, Sidebar, DashboardHeader)
- `components/dashboard/` — dashboard-specific widgets (StatsCard, tables, QuickActions, RecentActivity)
- `components/public/` — public-site sections (Hero, SolutionsGrid, ImageMosaic)

### API Pattern

Every API route handler:
1. Calls `const session = await auth()` and returns 401 if no session.
2. Parses/validates body with the corresponding Zod schema.
3. Uses Prisma to query PostgreSQL.
4. Returns `NextResponse.json(...)` with appropriate status codes.
