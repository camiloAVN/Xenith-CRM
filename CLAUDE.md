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
- `app/api/` — Legacy REST API routes: `clients`, `projects`, `quotations`, `users`, `auth`. All protected by `auth()`.
- `app/api/v1/` — New versioned API for the task management module (see below). Do **not** modify the old `/api/projects/*` routes.
- `app/page.tsx` — Root redirects to `/inicio`.

### Authentication (`auth.ts`)

NextAuth.js v5 (Auth.js) with the Credentials provider. JWT session strategy (8h session, 24h absolute max). Rate limiting on login attempts via `lib/security/rate-limiter.ts`. Constant-time bcrypt comparison to prevent timing attacks. Auth state is also mirrored in Zustand (`store/authStore.ts`) for client-side access. Three roles: `SUPERADMIN`, `ADMIN`, `USER`.

**Important:** `session.user` only contains `id`, `email`, `name`, `image` — role is NOT in the session JWT. To check a user's role in an API route, query Prisma directly: `prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } })`.

### Data Layer

Prisma ORM with PostgreSQL. The singleton client lives in `lib/db/prisma.ts`. Core models:
- `User` — auth + role-based access
- `Client` — CRM contacts
- `Project` — linked to Client + assigned User (líder), has `Task[]` and `ProjectMember[]`
- `Task` — full Jira-style tasks with status, priority, assignee, reporter, hours, order, tags
- `TaskComment` — threaded comments per task
- `TaskAttachment` — file attachment metadata (upload UI not yet implemented; POST returns 501)
- `TaskHistory` — automatic audit log for status/assignee/dueDate/priority changes
- `ProjectMember` — many-to-many project ↔ user with role (ADMIN, PROJECT_MANAGER, DEVELOPER, VIEWER)
- `Quotation` — linked to Client + optional Project, has `QuotationItem[]`. Auto-numbered as `QT-YYYY-NNNN`.
- Auth tables (`Account`, `Session`, `VerificationToken`) managed by Auth.js via PrismaAdapter.

**Enums:** `TaskStatus` (TODO, IN_PROGRESS, REVIEW, DONE, BLOCKED), `ProjectRole` (ADMIN, PROJECT_MANAGER, DEVELOPER, VIEWER), `Priority` (LOW, MEDIUM, HIGH, URGENT), `ProjectStatus`, `QuotationStatus`, `UserRole`.

### Clean Architecture (Task Module)

The task management module uses a layered architecture to keep business logic out of route handlers:

- `lib/dto/task.dto.ts` — Zod schemas: `CreateTaskSchema`, `UpdateTaskSchema`, `TaskFiltersSchema`, `ReorderTasksSchema`, `CreateCommentSchema`, `UpdateCommentSchema`
- `lib/dto/project.dto.ts` — `ProjectProgressDTO` interface
- `lib/repositories/task.repository.ts` — DB access: `findMany`, `findById`, `create`, `update`, `delete`, `reorder` (Prisma transaction), `getKanbanBoard`
- `lib/repositories/project.repository.ts` — `getProgress` (aggregates task counts + hours)
- `lib/services/task.service.ts` — Business logic: creates `TaskHistory` entries automatically on status/assignee/dueDate/priority changes
- `lib/services/project.service.ts` — `closeProject` validates no pending tasks before setting status to COMPLETED
- `lib/services/notification.service.ts` — Stub; interface defined, delivery not yet implemented

### API v1 — Task Management

All routes under `app/api/v1/projects/`. Pattern: check `auth()` → validate with DTO schema → call service/repository → return JSON.

```
GET/POST   /api/v1/projects
GET/PUT/DELETE /api/v1/projects/[id]          # PUT with status=COMPLETED calls closeProject() with validation
GET        /api/v1/projects/[id]/progress
GET/POST   /api/v1/projects/[id]/tasks        # GET ?view=kanban returns grouped object; supports filters
PUT        /api/v1/projects/[id]/tasks/reorder
GET/PUT/DELETE /api/v1/projects/[id]/tasks/[taskId]
GET/POST   /api/v1/projects/[id]/tasks/[taskId]/comments
PUT/DELETE /api/v1/projects/[id]/tasks/[taskId]/comments/[commentId]  # owner-only
GET        /api/v1/projects/[id]/tasks/[taskId]/history
GET/POST   /api/v1/projects/[id]/tasks/[taskId]/attachments            # POST → 501
GET/POST   /api/v1/projects/[id]/members
PUT/DELETE /api/v1/projects/[id]/members/[userId]                      # ADMIN/SUPERADMIN only
```

### State Management

Zustand stores in `store/`:
- `authStore.ts` — persisted client-side user state (mirrors NextAuth session)
- `clientStore.ts`, `projectStore.ts`, `quotationStore.ts` — entity caches
- `uiStore.ts` — UI state (modals, loading, etc.)

Custom hooks in `hooks/` (`useClients`, `useProjects`, `useQuotations`, `useAuth`) wrap API calls and sync data into the Zustand stores. The task module does **not** use Zustand — state is managed locally in `proyectos/[id]/page.tsx` with `useState`/`useCallback`.

### Validation

All form and API input is validated with Zod schemas in `lib/validations/` (legacy entities) and `lib/dto/` (task module). Forms use React Hook Form with `@hookform/resolvers/zod`.

### PDF Generation

Quotations can be exported as PDFs. `lib/pdf/generator.ts` + `lib/pdf/templates/quotation.tsx` use `@react-pdf/renderer`. The PDF endpoint is `GET /api/quotations/[id]/pdf`.

### UI Components

Custom component library in `components/ui/` (Button, Card, Input, Select, Textarea, Modal, Badge, Alert, Spinner, Table). Styled with Tailwind CSS v4. Use `cn()` from `lib/utils/cn.ts` (clsx + tailwind-merge) for conditional class names.

Components are organized by layer:
- `components/ui/` — primitive building blocks
- `components/forms/` — form wrappers (ClientForm, ProjectForm, QuotationForm, LoginForm, ContactForm)
- `components/layout/` — structural components (Navbar, Footer, Sidebar, DashboardHeader)
- `components/dashboard/` — dashboard-specific widgets (StatsCard, tables, QuickActions, RecentActivity)
- `components/public/` — public-site sections (Hero, SolutionsGrid, ImageMosaic)
- `components/projects/` — task management UI (see below)

### Project Detail Page (`/dashboard/proyectos/[id]`)

Fully client-side page with three switchable views. All data is fetched from `/api/v1/`.

**Components in `components/projects/`:**
- `KanbanBoard.tsx` — DnD with `@dnd-kit/core` + `@dnd-kit/sortable`. Desktop: horizontal scroll with fade indicators + arrow buttons. Mobile: column tab selector + single full-width column. Calls `PUT /api/v1/.../tasks/reorder` on drag end.
- `KanbanColumn.tsx` — Droppable column; accepts `fullWidth` prop for mobile view.
- `TaskCard.tsx` — Sortable card with priority badge, assignee avatar, due date (red if overdue), hours progress bar, tags.
- `TaskDetailPanel.tsx` — Slide-in panel from the right. Inline title editing, all task fields, tabs for Comments and History. Auto-saves each field change to `PUT /api/v1/.../tasks/[taskId]`.
- `TaskComments.tsx` — Threaded comments; edit/delete own comments. Ctrl+Enter to submit.
- `TaskHistory.tsx` — Audit log display; icons per field type, relative timestamps.
- `TaskFilters.tsx` — Collapsible filter panel. Always-visible: search input + "Filtros" toggle + active filter chips. Expanded: status multi-select, priority multi-select, assignee dropdown, date range.
- `ListView.tsx` — Sortable table view; click row opens TaskDetailPanel.
- `GanttView.tsx` — Two-panel layout: fixed HTML label column (sticky) + scrollable SVG timeline. Auto-scrolls to today on mount. Vertical scroll is synchronized between panels.
- `ProjectProgress.tsx` — Donut chart + stacked bar + hours ratio.

**Layout rule:** The dashboard `layout.tsx` has `min-w-0 overflow-x-hidden` on the main content wrapper — this is required to prevent Kanban/Gantt from creating a page-level horizontal scrollbar. Do not remove it.

**User assignment:** Task assignee dropdowns always fetch the full `/api/users` list, not just project members. The project form field `assignedTo` is labelled "Líder del Proyecto".

### API Pattern

Every API route handler:
1. Calls `const session = await auth()` and returns 401 if no session.
2. Parses/validates body with the corresponding Zod schema.
3. Calls the appropriate service or repository (for `/api/v1/`) or Prisma directly (for legacy `/api/`).
4. Returns `NextResponse.json(...)` with appropriate status codes.
