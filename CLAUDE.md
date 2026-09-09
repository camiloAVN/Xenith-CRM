# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Xenith CRM — a Next.js 16 application for managing clients, projects, and quotations (cotizaciones) for Xenith. The app has two faces: a public marketing site and a protected CRM dashboard. On top of the CRM there is a **contribution points system** that measures how much each person contributes to a project and derives their share of the earnings (see "Sistema de puntos de aporte").

## ⚠️ Lee esto antes de tocar nada

1. **`DATABASE_URL` apunta a PRODUCCIÓN**, no a Docker. Es un Prisma Postgres remoto (`db.prisma.io`) con datos reales del equipo. `prisma migrate deploy`, `db:seed` y cualquier script que escriba afectan la base real. **Pide aprobación explícita antes de aplicar una migración.** El `docker-compose.yml` existe pero no se está usando.
2. **`RESEND_API_KEY` es real y el dominio `xenith.com.co` está verificado.** Cualquier código que cree/acepte/rechace tareas envía correos de verdad a Nicolás, David y Camilo. En scripts de prueba, **neutraliza la clave antes de cualquier import** (ver "Verificación").
3. **Despliegue automático:** un push a `main` dispara el deploy en Vercel. `npm run build` corre `prisma migrate deploy` antes de compilar, así que subir una migración la aplica en producción.

## Commands

```bash
# Desarrollo
npm run dev          # localhost:3000
npm run build        # prisma generate + prisma migrate deploy + next build
npm run lint         # ESLint

# Base de datos (¡es producción!)
npx prisma migrate status       # ver si hay migraciones pendientes
npx prisma migrate deploy       # aplicar pendientes — REQUIERE APROBACIÓN
npx prisma generate             # regenerar el cliente tras editar el schema
npx prisma studio               # GUI

# Cron del sistema de puntos (no está programado, ver más abajo)
npm run cron:tick               # cierra ventanas de votación vencidas
```

**Estado del lint:** hay 46 problemas preexistentes (16 errores en `lib/pdf/*` y otros, 30 warnings). Si tu cambio no los mueve de 46, no introdujiste ninguno nuevo. No los arregles salvo que te lo pidan.

## Verificación (no hay framework de tests)

No hay Jest/Vitest y no conviene agregarlos sin pedirlo. El patrón que ha funcionado es un script temporal en la raíz:

```ts
// verify-tmp.ts  — SIEMPRE estas 2 líneas primero, antes de cualquier import
process.env.RESEND_API_KEY = ''
delete process.env.RESEND_API_KEY

import { prisma } from './lib/db/prisma'
// ...crea un proyecto '__TMP_X__', ejercita los servicios, compara resultados
// y BORRA todo en un finally (pointLedgerEntry.deleteMany + project.delete;
// las tareas, votos y aprobaciones caen por cascada).
```

Se corre con `npx tsx verify-tmp.ts` y se borra al terminar. Después conviene confirmar que no quedaron residuos (`task.count()`, `pointLedgerEntry.count()`, proyectos con prefijo `__TMP`). El único proyecto real hoy es **"oaxis"** — no lo toques.

Notas: los scripts `tsx` sueltos **no cargan `.env`** salvo lo que Prisma lee para su datasource; si necesitas una variable, léela del archivo a mano. Y `tsx` no admite top-level `await`: envuelve todo en `async function main()`.

## Environment Setup

Copia `.env.example` a `.env`. Variables que importan:

```
DATABASE_URL / DIRECT_URL       # Prisma Postgres remoto (producción)
AUTH_SECRET, NEXTAUTH_URL, NEXT_PUBLIC_APP_URL
ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_SETUP_KEY   # /api/auth/register-admin
RESEND_API_KEY                  # real; dominio xenith.com.co verificado
RESEND_FROM_EMAIL               # vacío en Vercel → cae al default del código
CRON_SECRET                     # generado; el cron no está programado
```

**Remitente de correo:** `RESEND_FROM_EMAIL` está declarada pero **vacía** en Vercel, así que el código cae a `Xenith <contacto@xenith.com.co>` (el mismo default de `/api/cotizacion`). Funciona porque el dominio completo está verificado. Ojo: `app/api/contact/route.ts` tiene hardcodeado `onboarding@resend.dev`, que **solo entrega al dueño de la cuenta** — es deuda preexistente, no la copies.

**Cron:** `vercel.json` **no** declara `crons`. Se quitó porque el plan Hobby de Vercel solo admite una corrida diaria. El endpoint `/api/v1/cron/close-voting` y `npm run cron:tick` siguen funcionando; reactivarlo es agregar la clave `crons` o apuntar un cron de Railway al script. Mientras tanto el cierre perezoso cubre la operación (ver abajo).

## Architecture

### Route Groups (Next.js App Router)

- `app/(public)/` — Páginas públicas: `/inicio`, `/soluciones`, `/contacto`, `/equipo`. Layout propio con `Navbar` + `Footer`.
- `app/(landing)/` — Landings independientes: `/inicio`, `/vector`.
- `app/(auth)/` — `/login`. Layout mínimo.
- `app/(dashboard)/dashboard/` — CRM protegido. Layout con `Sidebar` + `DashboardHeader`. Sub-rutas: `clientes`, `proyectos`, `cotizaciones`, `usuarios`, `ganancias`, `leads`, `perfil`. Cada entidad tiene `page.tsx` (lista), `nuevo/page.tsx`, `[id]/page.tsx`, `[id]/editar/page.tsx`.
- `app/api/` — API REST legada: `clients`, `projects`, `quotations`, `users`, `auth`, `ganancias`, `leads`, `profile`, `contact`, `cotizacion`.
- `app/api/v1/` — API versionada del módulo de tareas y puntos.
- `app/page.tsx` — redirige a `/inicio`.

**Sobre `/api/projects/*` (legada):** es la que usa el formulario de proyectos (`hooks/useProjects.ts`), así que **sí se toca** cuando cambia algo de proyectos — hoy lleva el guard de `canCreateProjects` y el helper `buildMemberRecords`. Lo que no hay que hacer es meterle lógica de tareas: eso vive en `/api/v1/`.

### Authentication (`auth.ts`)

NextAuth.js v5 (Auth.js), provider Credentials. Sesión JWT (8h, máx. 24h). Rate limiting en `lib/security/rate-limiter.ts`. Comparación bcrypt de tiempo constante. El estado se espeja en Zustand (`store/authStore.ts`).

**Importante:** `session.user` solo trae `id`, `email`, `name`, `image` — **el rol NO viaja en el JWT**. En el servidor, usa `lib/auth/permissions.ts`. En el cliente, `hooks/usePermissions.ts` (lee `/api/profile`).

Existe una inconsistencia preexistente: `/api/users/*` comprueba el superadmin **por email** (`SUPERADMIN_EMAIL`), mientras el resto lo hace **por rol** (`role === 'SUPERADMIN'`). Hoy coinciden. No unificar sin cuidado: un error ahí bloquea el acceso de administración.

### Data Layer

Prisma ORM + PostgreSQL. Cliente singleton en `lib/db/prisma.ts`.

- `User` — auth + rol global + `canCreateProjects` (permiso que solo otorga el dueño). Los usuarios **no se borran**, se desactivan (`isActive = false`).
- `Client` — contactos. `Project.clientId` es **nullable**: proyectos y clientes son módulos independientes.
- `Project` — cliente opcional + `assignedTo` (obligatorio en la BD; hoy se deriva del primer jefe). Tiene `Task[]`, `ProjectMember[]`, `PointLedgerEntry[]`, `Earning[]`.
- `Task` — tareas estilo Jira **más** las dos capas de puntos (ver abajo).
- `TaskComment`, `TaskAttachment` (POST → 501), `TaskHistory` (audit log).
- `ProjectMember` — proyecto ↔ usuario con `ProjectRole`.
- `TaskPointVote` — voto de valoración. `@@unique([taskId, userId])`.
- `TaskCompletionApproval` — aprobación/rechazo de un jefe. `@@unique([taskId, userId, round])`.
- `PointLedgerEntry` — **ledger append-only** de puntos por proyecto.
- `ContributionSettings` — parámetros; `projectId = null` es la fila global (`id = 'global'`).
- `Quotation` + `QuotationItem` — auto-numeradas `QT-YYYY-NNNN`.
- `Earning` — dinero por proyecto (`COMPANY_INCOME`, `DEDUCTION`, `USER_EARNING`).
- `ContactRequest` — leads del formulario público.

**Enums:** `TaskStatus` (TODO, IN_PROGRESS, REVIEW, DONE, BLOCKED), `TaskValuationStatus` (VOTING, EXTENDED, VALUED), `TaskCompletionStatus` (PENDING, SUBMITTED, ACCEPTED), `PointLedgerType` (TASK_ACCEPTED, TASK_REVERTED, SEED, ADJUSTMENT), `ProjectRole`, `Priority`, `ProjectStatus`, `QuotationStatus`, `UserRole`, `EarningType`, `LeadSource`, `LeadStatus`.

`EXTENDED` está en el enum pero **no se usa**: la extensión automática de la ventana se descartó por decisión del dueño.

---

## Sistema de puntos de aporte

Mide cuánto aporta cada persona a un proyecto y con eso calcula su porcentaje del pozo repartible.

### Roles

| Rol | Quién es | Puede |
|---|---|---|
| **Dueño** | `UserRole.SUPERADMIN` | Crear proyectos, nombrar jefes, asignar puntos a mano, editar parámetros |
| **Jefe de proyecto** | `ProjectMember` con rol `PROJECT_MANAGER` o `ADMIN` | Crear/asignar tareas, aceptar o rechazar cumplimientos |
| **Miembro** | cualquier `ProjectMember` | Ejecutar sus tareas y votar el valor de las ajenas |

Ser jefe es un **permiso encima de ser miembro**, no un rol paralelo: un jefe también recibe tareas y gana puntos. Por eso un equipo de 3 jefes y nadie más funciona sin lógica especial.

Dos detalles que hay que respetar:
- `Project.assignedTo` **cuenta como jefe** aunque no tenga fila en `ProjectMember` (proyectos creados antes de esa tabla se quedarían sin ningún jefe).
- El **dueño NO entra en el quórum de aprobación** por ser dueño: `getProjectLeadIds()` devuelve solo jefes reales. Si lo incluyera, ninguna tarea podría aceptarse sin su firma en proyectos donde ni participa. La excepción es el respaldo: si no queda ningún aprobador posible (un solo jefe que se autoasigna), firma el dueño.

`User.canCreateProjects` (default `false`) permite delegar la creación de proyectos en un ADMIN; solo el dueño lo otorga, desde `/dashboard/usuarios`.

### Las dos capas de la tarjeta

Sobre la misma `Task` conviven:

1. **Flujo Kanban** — `Task.status`. Es el tablero de siempre.
2. **Puntos** — `valuationStatus` (VOTING → VALUED) y `completionStatus` (PENDING → SUBMITTED → ACCEPTED).

**Mover una tarjeta a DONE no acredita puntos.** El crédito ocurre solo al llegar a `ACCEPTED`.

### Ciclo completo

```
Jefe crea la tarea   → status TODO · VOTING (ventana abierta) · reloj de retraso arranca
Asignado arranca     → IN_PROGRESS         (único movimiento manual permitido a un no-jefe)
Votación cierra      → VALUED + pointsValue (mediana)
Asignado termina     → REVIEW · SUBMITTED · reloj de retraso SE PAUSA · correo a los jefes
Jefes aceptan        → DONE · ACCEPTED · asiento en el ledger · correo al asignado
Un jefe rechaza      → IN_PROGRESS · PENDING · completionRound++ · reloj REANUDA
Se reabre aceptada   → IN_PROGRESS · asiento negativo TASK_REVERTED
```

**La aceptación exige DOS condiciones independientes:** todas las aprobaciones de la ronda actual **y** valoración cerrada. Por eso `tryFinalizeAcceptance()` se dispara **desde dos lados** — al registrarse la última aprobación y al cerrarse la votación. Sin eso, una tarea terminada y aprobada en 2 horas se acreditaría con el mínimo del rango antes de que el equipo alcance a votar.

### Votación

- Vota todo el equipo **menos el asignado**.
- **Cierra por lo que ocurra primero:** votan todos los elegibles → cierra de inmediato; o vence el plazo (24h configurables).
- Valor = **mediana sin redondear** (con 2 votos puede dar 4.5).
- Quórum efectivo = `min(minVotes, votantes elegibles)`. Sin él, un equipo de 2 nunca alcanzaría `minVotes = 2`.
- Sin quórum al vencer → `minPoints` (2).
- `needsDiscussion` si `max - min >= disagreementDelta`. Es **informativo**, no bloquea.
- Un voto por persona, corregible mientras la ventana siga abierta. **No hay reapertura.**
- Los votos individuales se revelan **al cerrar**; durante la votación solo se ve el conteo, para no anclar a quien falta.

### Penalización por retraso

- −0.2 puntos por **día completo** vencido (`floor`), configurable.
- El reloj **se pausa al marcar terminada** (no al aceptar): la demora de los jefes en revisar no le cuesta puntos al trabajador. **Reanuda desde el rechazo.**
- Piso: nunca baja del 50 % del valor.
- Se guarda como acumulador (`lateAccruedDays`) + marca del tramo abierto (`lateClockStartedAt`, null = pausado). El total es la suma de ambos, recortando siempre contra `dueDate`.
- **Al aceptar se congela** en `effectivePoints`. `buildPenaltyPreview()` no recalcula una tarea `ACCEPTED`: si lo hiciera, una tarea cobrada en marzo mostraría otro valor en diciembre.
- Sin `dueDate` no hay penalización. Una tarea creada ya vencida no acumula retroactivo: el reloj arranca al crearla.

### Ledger y porcentajes

```
% de un miembro = sus puntos en el ledger ÷ total del ledger del proyecto
reparto         = pozo × %
pozo            = COMPANY_INCOME − |DEDUCTION|   (misma fórmula que /api/ganancias)
```

El ledger es **append-only**. Eso resuelve dos casos de golpe:
- **Tarea reabierta** → asiento negativo `TASK_REVERTED`; el original no se borra.
- **Miembro que sale** → `PointLedgerEntry` apunta a `User`, no a `ProjectMember`, así que conserva su saldo congelado y los porcentajes de los demás **no** suben solos.

El dueño puede crear asientos `ADJUSTMENT` a mano (positivos o negativos) desde la ventana de aportes. Para corregir se agrega el opuesto, nunca se borra.

### Mapa de archivos

```
lib/auth/permissions.ts                       Roles: getProjectPermissions, getProjectLeadIds, getProjectMemberIds
lib/services/task-lifecycle.ts                Máquina de estados: guardas puras + elegibilidad de votantes/aprobadores
lib/services/task-valuation.service.ts        Mediana, quórum, castVote, settleTask (idempotente)
lib/services/task-completion.service.ts       Aprobación/rechazo, aceptación, ledger, reopen
lib/services/task-penalty.ts                  Reloj de retraso, penalización, buildPenaltyPreview
lib/services/contribution.service.ts          %, reparto, ajustes manuales
lib/services/contribution-metrics.service.ts  Serie mensual, mejor mes, tendencia
lib/services/contribution-settings.service.ts Parámetros: override de proyecto → global → defaults
lib/services/notification.service.ts          Los 5 correos (Resend)
lib/email/shell.ts                            Marco HTML compartido
lib/email/task-templates.ts                   Plantillas del sistema de puntos
lib/utils/chart-palette.ts                    Paleta categórica VALIDADA para daltonismo
components/projects/TaskVoting.tsx            Botonera 2–10, quórum, cuenta regresiva
components/projects/TaskApproval.tsx          Aceptar/rechazar, quién firmó, reabrir
components/projects/TaskPenalty.tsx           Franja de retraso (solo si hay retraso real)
components/projects/TaskPointsBadge.tsx       Chip de puntos, compartido por las 3 vistas
components/projects/ContributionShare.tsx     Panel de reparto en la página del proyecto
components/projects/PointAdjustments.tsx      Asignación manual (solo dueño)
components/charts/                            MemberPointsChart, MonthlyPointsChart, MemberTrendCard
app/(dashboard)/dashboard/proyectos/[id]/aportes/   Ventana de gráficos y métricas
```

### Invariantes que se rompen fácil

1. **El % y las métricas salen del ledger, nunca de las tareas.** Calcularlos desde `Task` pierde las reversiones y borra a quien salió del equipo.
2. **Nunca borres un asiento del ledger.** Escribe el opuesto.
3. **`settleTask()` sin `{ force: true }` solo liquida ventanas YA vencidas.** La ruta de votos la llama preventivamente en cada lectura; sin esa guarda, la primera consulta cerraría toda votación abierta. `force` es exclusivo del cierre anticipado cuando ya votaron todos.
4. **Las notificaciones son fire-and-forget** (`void notificationService.x(...)`) y atrapan sus propios errores. Notificar nunca puede tumbar la operación.
5. **La regla de estados hay que validarla también en `reorderTasks`.** Si no, arrastrar la tarjeta en el Kanban se la salta.
6. **`KanbanBoard` sincroniza con el padre con "ajuste durante el render"**, no con `useEffect` (el linter marca las cascadas de render), y **se salta la sincronía mientras hay un arrastre**. Al soltar avisa al padre con `onColumnsChange` para que no pise el movimiento.
7. **La paleta de gráficos está validada; no la cambies sin revalidar.** La combinación intuitiva de Tailwind (violet-500 + blue-500) falla: ΔE 1.3 en deuteranopía. Hay un validador en la skill `dataviz`.
8. **Los meses de las métricas se agrupan en hora de Bogotá**, no UTC, o los asientos de fin de mes se corren.
9. La tendencia de rendimiento se mide **desde el primer aporte de la persona**, no desde el inicio del proyecto; con menos de 6 meses sale "sin historial". Si no, todo recién llegado aparecería como "subiendo".
10. Hay **ciclos de importación** entre `task.service` ↔ `task-valuation.service` ↔ `task-completion.service` (todos usan `TaskPermissionError`, exportado desde `task.service`). Están rotos con `await import(...)` dinámico en dos puntos. Si agregas un import estático nuevo entre esos módulos, revisa que no cierre el ciclo.

---

### API v1

Patrón: `auth()` → permisos (`lib/auth/permissions.ts`) → validar con DTO → servicio → `NextResponse.json`. Los errores de regla de negocio son `TaskPermissionError` (exportado desde `task.service.ts`) → 403.

```
GET/POST        /api/v1/projects                       # POST exige canCreateProjects
GET/PUT/DELETE  /api/v1/projects/[id]                  # GET devuelve { ...project, permissions }
GET             /api/v1/projects/[id]/progress
GET/POST        /api/v1/projects/[id]/members          # rol de jefe: solo el dueño
PUT/DELETE      /api/v1/projects/[id]/members/[userId]
GET/POST        /api/v1/projects/[id]/tasks            # ?view=kanban · POST solo jefes
PUT             /api/v1/projects/[id]/tasks/reorder    # valida la regla de estados
GET/PUT/DELETE  /api/v1/projects/[id]/tasks/[taskId]   # DELETE bloqueado si ya fue aceptada
POST            /api/v1/projects/[id]/tasks/[taskId]/submit      # el asignado marca terminada
GET/POST        /api/v1/projects/[id]/tasks/[taskId]/votes       # estado / votar
GET/POST        /api/v1/projects/[id]/tasks/[taskId]/approvals   # estado / aprobar-rechazar
POST            /api/v1/projects/[id]/tasks/[taskId]/reopen      # revierte los puntos
GET/POST        /api/v1/projects/[id]/tasks/[taskId]/comments
PUT/DELETE      /api/v1/projects/[id]/tasks/[taskId]/comments/[commentId]   # owner-only
GET             /api/v1/projects/[id]/tasks/[taskId]/history
GET/POST        /api/v1/projects/[id]/tasks/[taskId]/attachments            # POST → 501
GET             /api/v1/projects/[id]/contributions              # %, reparto, pendientes
GET             /api/v1/projects/[id]/contributions/metrics      # serie mensual, tendencia
GET/POST        /api/v1/projects/[id]/contributions/adjustments  # POST solo dueño
GET/POST        /api/v1/cron/close-voting                        # Bearer CRON_SECRET
```

**Las lecturas de tareas vienen decoradas** con `penalty` (calculado en el servidor) para que Kanban, lista, Gantt y el panel muestren el mismo número que se acredita al aceptar.

### State Management

Zustand en `store/`: `authStore` (persistido), `clientStore`, `projectStore`, `quotationStore`, `uiStore`. Hooks en `hooks/` (`useClients`, `useProjects`, `useQuotations`, `useAuth`, `usePermissions`).

El módulo de tareas **no usa Zustand**: el estado vive en `proyectos/[id]/page.tsx` con `useState`/`useCallback`. Tras crear, editar o borrar una tarea, la página llama `loadTasks()` para reconciliar con el servidor (la respuesta cruda no trae la penalización ni el orden definitivo).

### Validation

Zod en `lib/validations/` (entidades legadas) y `lib/dto/` (tareas). Formularios con React Hook Form + `@hookform/resolvers/zod`.

`CreateTaskSchema` exige `assignedTo` y `dueDate`. `UpdateTaskFieldsSchema` permite omitirlos pero **no vaciarlos**. `ASSIGNEE_EDITABLE_FIELDS` lista lo que puede tocar el asignado sin ser jefe.

### PDF Generation

`lib/pdf/generator.ts` + `lib/pdf/templates/quotation.tsx` con `@react-pdf/renderer`. Endpoint: `GET /api/quotations/[id]/pdf`.

### UI Components

Librería propia en `components/ui/` (Button, Card, Input, Select, Textarea, Modal, Badge, Alert, Spinner, Table). Tailwind v4. `cn()` desde `lib/utils/cn.ts`. **No hay componente Checkbox** — los checkboxes son `<input type="checkbox">` con clases.

Organización: `ui/` (primitivos), `forms/`, `layout/`, `dashboard/`, `public/`, `projects/` (tareas y puntos), `charts/` (gráficos).

**No hay librería de gráficos y no hay que agregarla.** Gantt, donut de progreso y los gráficos de aportes son SVG/CSS a mano.

### Project Detail Page (`/dashboard/proyectos/[id]`)

Página cliente con tres vistas conmutables. Todo sale de `/api/v1/`.

- `KanbanBoard.tsx` — DnD con `@dnd-kit`. Escritorio: scroll horizontal con indicadores. Móvil: selector de columna + columna única. Al soltar llama `reorder` y **revierte en pantalla si el servidor rechaza**.
- `KanbanColumn.tsx` — columna droppable; `fullWidth` para móvil. El botón "+" solo se pasa a la columna TODO.
- `TaskCard.tsx` — prioridad, chip de puntos, avatar, fecha (roja si vencida), barra de horas, tags.
- `TaskDetailPanel.tsx` — panel lateral. Votación, penalización, aprobación, campos, comentarios e historial. Autoguarda cada campo y **avisa si el servidor rechaza**.
- `TaskComments.tsx`, `TaskHistory.tsx`, `TaskFilters.tsx`, `ListView.tsx` (columna "Puntos" ordenable), `GanttView.tsx` (`LABEL_W = 250` para que quepa el chip), `ProjectProgress.tsx`, `ContributionShare.tsx`.

**Layout rule:** el `layout.tsx` del dashboard tiene `min-w-0 overflow-x-hidden` en el contenedor principal — necesario para que Kanban/Gantt no generen scroll horizontal de página. No lo quites.

**Asignado de una tarea:** el desplegable lista el **equipo del proyecto** (miembros + jefes), no todos los usuarios: el backend exige que el asignado sea miembro.

**Jefes de proyecto:** el formulario tiene **un solo selector múltiple** (`leaderIds`). `Project.assignedTo` sigue existiendo porque la columna es obligatoria, pero **se deriva del primer jefe marcado** (input oculto + `setValue`). No se puede guardar un proyecto sin al menos un jefe.

**Estados:** toda tarea nace en `TODO`. Quien no es jefe solo puede moverla de `TODO` a `IN_PROGRESS`. El resto lo mueve el flujo.

### API Pattern

Cada handler:
1. `const session = await auth()` → 401 si no hay sesión.
2. Comprueba permisos con `lib/auth/permissions.ts` → 403.
3. Valida el body con el schema Zod correspondiente → 400.
4. Llama al servicio (en `/api/v1/`) o a Prisma directo (en `/api/` legada).
5. `NextResponse.json(...)` con el código adecuado.

## Pendientes conocidos

- **Los correos nunca se han probado en vivo.** Toda la verificación corrió con `RESEND_API_KEY` neutralizada. Falta una prueba real: crear una tarea, votar, marcar terminada y aceptar, confirmando que llegan los 4 avisos.
- **Cron sin programar** (ver arriba). Sin él, el correo de "votación cerrada" solo sale cuando alguien abre el tablero.
- `TaskAttachment` existe en el schema pero el POST devuelve 501: no hay subida de archivos.
- `app/api/contact/route.ts` envía desde `onboarding@resend.dev`, que solo entrega al dueño de la cuenta.
- La inconsistencia email vs. rol para detectar al superadmin (ver Authentication).
