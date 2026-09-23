# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Xenith CRM — a Next.js 16 application for managing clients, projects, and quotations (cotizaciones) for Xenith. The app has two faces: a public marketing site and a protected CRM dashboard. On top of the CRM there is a **contribution points system** that measures how much each person contributes to a project and derives their share of the earnings (see "Sistema de puntos de aporte").

## ⚠️ Lee esto antes de tocar nada

1. **`DATABASE_URL` apunta a PRODUCCIÓN**, no a Docker. Es un Prisma Postgres remoto (`db.prisma.io`) con datos reales del equipo. `prisma migrate deploy`, `db:seed` y cualquier script que escriba afectan la base real. **Pide aprobación explícita antes de aplicar una migración.** El `docker-compose.yml` existe pero no se está usando.
2. **`RESEND_API_KEY` es real y el dominio `xenith.com.co` está verificado.** Cualquier código que cree/acepte/rechace tareas envía correos de verdad a Nicolás, David y Camilo. En scripts de prueba, **neutraliza la clave antes de cualquier import** (ver "Verificación").
3. **Despliegue automático:** un push a `main` dispara el deploy en Vercel. `npm run build` aplica las migraciones antes de compilar, así que subir una migración la aplica en producción.
4. **El rol `prisma_migration` tiene MUY pocas conexiones.** Cada `npx tsx` contra producción, cada `prisma migrate` y cada `prisma studio` consume una, y tardan minutos en liberarse. Si se agotan:
   - los scripts locales fallan con `FATAL: too many connections for role "prisma_migration"`;
   - **y el deploy de Vercel se cae en el build**, aunque no haya migraciones pendientes.
   **La app en runtime también pega contra ese rol.** Desde el 21-sep-2026 `lib/db/prisma.ts` la blinda: añade `connection_limit=1&pool_timeout=20&connect_timeout=10` a la URL (en serverless la concurrencia se resuelve con más instancias, no con más conexiones por instancia), cachea el cliente en `globalThis` **también en producción** y reintenta 3 veces las consultas que fallan por saturación (`P2024`, `P1001`, `too many connections`). Las rutas de tareas/votos devuelven **503 con `retryable: true`** en ese caso y el cliente reintenta solo (`lib/utils/fetch-retry.ts`). El arreglo de fondo sigue pendiente: una URL de **Prisma Accelerate** (`prisma+postgres://`) para runtime, dejando la directa solo para migraciones.
   Por eso el build pasa por `scripts/migrate-deploy.mjs`, que reintenta 4 veces cada 20 s **solo** ante ese error (cualquier otro error de migración sigue tumbando el build a propósito). Aun así: agrupa las verificaciones en UN script en vez de correr diez seguidos, y si el deploy falló por esto, espera unos minutos y vuelve a desplegar.

## Commands

```bash
# Desarrollo
npm run dev          # localhost:3000
npm run build        # prisma generate + scripts/migrate-deploy.mjs + next build
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
BOT_API_TOKEN                   # token del bot de Telegram para /api/v1/bot/*
```

**`BOT_API_TOKEN`:** el mismo valor vive en `.env`, en Vercel y en la credencial "Xenith Bot" de n8n. Sin él la ruta responde 401 siempre.

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
- `Task` — tareas estilo Jira **más** las dos capas de puntos (ver abajo). `sprintId` nulo = backlog; `carriedOverCount` cuenta los arrastres.
- `Sprint` — caja de tiempo de 2 semanas (`PLANNED` → `ACTIVE` → `CLOSED`). Solo UNO activo por proyecto.
- `SprintCapacity` — tope de puntos por persona y sprint. `@@unique([sprintId, userId])`.
- `TaskComment`, `TaskAttachment` (POST → 501), `TaskHistory` (audit log).
- `ProjectMember` — proyecto ↔ usuario con `ProjectRole`.
- `TaskPointVote` — voto de valoración. `@@unique([taskId, userId])`.
- `TaskCompletionApproval` — aprobación/rechazo de un jefe. `@@unique([taskId, userId, round])`.
- `PointLedgerEntry` — **ledger append-only** de puntos por proyecto.
- `Payout` + `PayoutShare` — **liquidación congelada**: la foto del reparto el día que entró la plata. Inmutable.
- `ContributionSettings` — parámetros; `projectId = null` es la fila global (`id = 'global'`).
- `Quotation` + `QuotationItem` — auto-numeradas `QT-YYYY-NNNN`.
- `Earning` — dinero por proyecto (`COMPANY_INCOME`, `DEDUCTION`, `USER_EARNING`).
- `ContactRequest` — leads del formulario público.

**Enums:** `TaskStatus` (TODO, IN_PROGRESS, REVIEW, DONE, BLOCKED), `TaskValuationStatus` (VOTING, EXTENDED, VALUED), `TaskCompletionStatus` (PENDING, SUBMITTED, ACCEPTED), `SprintStatus` (PLANNED, ACTIVE, CLOSED), `PointLedgerType` (TASK_ACCEPTED, TASK_REVERTED, SEED, ADJUSTMENT), `ProjectRole`, `Priority`, `ProjectStatus`, `QuotationStatus`, `UserRole`, `EarningType`, `LeadSource`, `LeadStatus`.

**Parámetros vigentes** (fila `global` de `ContributionSettings`): `minPoints = 1`, `maxPoints = 21`, `disagreementDelta = 2` (peldaños), `sprintLengthDays = 14`, `defaultCapacityPoints = 13`, `carryoverPenalty = 0.2`, `reworkPenalty = 0.25`, `penaltyFloorRatio = 0.5`, `founderRatio = 0.15`, `poolRatio = 0.6`, `maxIndividualShare = 0.45`. Los `@default` del schema ya coinciden. `penaltyPerDay` queda solo para leer el histórico.

**La capa de la empresa NO se guarda**: es el resto (`1 − founderRatio − poolRatio`), y así las tres suman exactamente el neto sin poder desincronizarse.

`EXTENDED` está en el enum pero **no se usa**: la extensión automática de la ventana se descartó por decisión del dueño.

---

## Sistema de puntos de aporte

Mide cuánto aporta cada persona a un proyecto y con eso calcula su porcentaje del pozo repartible.

### Roles

| Rol | Quién es | Puede |
|---|---|---|
| **Dueño** | `UserRole.SUPERADMIN` | Crear proyectos, nombrar jefes, asignar puntos a mano, editar parámetros |
| **Jefe de proyecto** | `ProjectMember` con rol `PROJECT_MANAGER` o `ADMIN` | **Editar, borrar y mover fechas**; aceptar o rechazar cumplimientos; resolver revaluaciones; manejar sprints |
| **Miembro** | cualquier `ProjectMember` | **Crear tareas** (con su primera fecha), ejecutar las suyas, votar el valor de las ajenas y comentar |

Ser jefe es un **permiso encima de ser miembro**, no un rol paralelo: un jefe también recibe tareas y gana puntos. Por eso un equipo de 3 jefes y nadie más funciona sin lógica especial.

**Quién toca qué en una tarea** (decisión del equipo, 20-sep-2026): el trabajo lo levanta quien lo ve, pero nadie se corre su propio plazo.

| Acción | Quién |
|---|---|
| Crear tarea, asignarla y ponerle su **primera** fecha | cualquier miembro (`canCreateTasks`) |
| Cambiar título, descripción, prioridad, estimado o tags | cualquier miembro (`MEMBER_EDITABLE_FIELDS`, 21-sep-2026) |
| Cambiar **fecha**, asignado o sprint | **solo jefes** (`canManageTasks`) |
| Borrar | solo jefes |
| Mover la tarjeta `TODO → IN_PROGRESS` y anotar horas | el asignado (`ASSIGNEE_EDITABLE_FIELDS`: status, actualHours, order) |
| Votar el valor | todo el equipo **menos el asignado** |
| Comentar | todos |
| Aceptar o rechazar el cumplimiento | los firmantes (ver `getApprovalRequirement`) |

Que el asignado no pueda mover su fecha es lo que sostiene el vencimiento: si pudiera correrla, pasarse no costaría nada. Para contar avances están los comentarios, que sí son de todos.

Dos detalles que hay que respetar:
- `Project.assignedTo` **cuenta como jefe** aunque no tenga fila en `ProjectMember` (proyectos creados antes de esa tabla se quedarían sin ningún jefe).
- El **dueño NO entra en el quórum de aprobación** por ser dueño: `getProjectLeadIds()` devuelve solo jefes reales. Si lo incluyera, ninguna tarea podría aceptarse sin su firma en proyectos donde ni participa.

### Quién firma una tarea (`getApprovalRequirement`)

Devuelve `{ mode, userIds }` y el modo cambia la regla:

| Caso | Modo | Firman |
|---|---|---|
| 3 jefes, tarea de uno de ellos | `all` | los otros 2 |
| 2 jefes, tarea de un miembro | `all` | los 2 |
| 2 jefes, tarea de un jefe | `all` | solo el otro jefe |
| **1 jefe, tarea de ese mismo jefe** | **`any`** | **cualquier miembro del equipo, basta UNA firma** |
| proyecto de una sola persona | `any` | el dueño (respaldo) |

**El caso `any` existía como bug**: con un solo jefe que se autoasignaba, la lista de aprobadores quedaba vacía, `tryFinalizeAcceptance()` se rendía y la tarea se quedaba en SUBMITTED sin acreditar nunca los puntos —la tarjeta decía que no hacía falta revisión, pero el ledger nunca recibía el asiento—. Ahora el trabajo del jefe único sí cuenta, pero lo tiene que dar por bueno alguien más: **nadie firma su propia tarea**, eso sigue intacto.

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
Firman los que toca  → DONE · ACCEPTED · asiento en el ledger · correo al asignado
Un firmante rechaza  → IN_PROGRESS · PENDING · completionRound++ · −25 % al aceptar
Se reabre aceptada   → IN_PROGRESS · asiento negativo TASK_REVERTED
```

**La aceptación exige DOS condiciones independientes:** las firmas que pida el modo (`all` = todas; `any` = una) en la ronda actual **y** valoración cerrada. Por eso `tryFinalizeAcceptance()` se dispara **desde dos lados** — al registrarse la última aprobación y al cerrarse la votación. Sin eso, una tarea terminada y aprobada en 2 horas se acreditaría con el mínimo del rango antes de que el equipo alcance a votar.

### Votación

- Vota todo el equipo **menos el asignado**.
- **Escala Fibonacci 1-2-3-5-8-13-21** (`lib/services/point-scale.ts`), con **anclas** fijas por peldaño (qué significa un 5 en tiempo real de trabajo). Las anclas se muestran al votar y en el correo: una escala sin anclas se infla sola.
- **Cierra por lo que ocurra primero:** se alcanza el quórum → cierra de inmediato; o vence el plazo (24h configurables). El quórum son **2 votos** (`minVotes`), o **1** si el equipo es de dos y solo hay un votante posible — no espera a que opine todo el mundo (decisión del dueño, 21-sep-2026: con 4 personas, un voto que no llegaba dejaba tareas colgadas semanas). El barrido perezoso también cierra las que ya tienen quórum aunque su plazo siga vivo, así que las que quedaron colgadas se liquidan solas al abrir el tablero.
- Valor = **mediana pegada al peldaño más cercano** (`snapToScale`). Los empates **bajan**: entre 8 y 13 se acredita 8, que es la dirección que no premia inflar. El ledger solo guarda valores de la escala.
- Quórum efectivo = `min(minVotes, votantes elegibles)`. Sin él, un equipo de 2 nunca alcanzaría `minVotes = 2`.
- **Sin quórum pero con votos → se usa igual su mediana**, marcada `reachedQuorum: false`. Castigar al asignado porque un compañero no votó es cobrarle algo que no está en sus manos. Solo con CERO votos cae al mínimo de la escala (1).
- `needsDiscussion` si los votos quedan a **2 peldaños o más** (`disagreementDelta` se mide en pasos de la escala, no en puntos: entre 13 y 21 hay 8 puntos y un solo paso). Es **informativo**, no bloquea.
- `isEpic` cuando el valor queda en el tope (21): la tarjeta pide partirla y el sistema **no deja meterla a un sprint**.
- Un voto por persona, corregible mientras la ventana siga abierta. **No hay reapertura.**
- Los votos individuales se revelan **al cerrar**; durante la votación solo se ve el conteo, para no anclar a quien falta.

### Sprints

- Sprint de **2 semanas**; solo uno `ACTIVE` por proyecto. `sprintId` nulo = **backlog**.
- **Capacidad por persona y sprint: 21** (el tope de la escala — nadie se compromete a más de una tarea máxima). `sprintService.assertCanCommit()` bloquea asignar por encima del tope: es el freno contra acumular tareas para ganar más.
- Una tarea valorada en **21 (épica) no entra a un sprint**: hay que partirla.
- Al **cerrar** un sprint, lo no aceptado se arrastra al sprint destino (o al backlog) con `carriedOverCount + 1`. **El arrastre ya no descuenta**: quedó solo como dato.
- **La tarea puede nacer sin asignado** (backlog estimado): el equipo la valora y se reparte en la planeación. `CreateTaskSchema` ya no exige `assignedTo` ni `dueDate`.

### Fecha límite: pasarse cuesta el valor completo

La regla es **una sola y es dura** (decisión del equipo, 18-sep-2026): pasarse de `dueDate` sin entregar cuesta **el valor entero de la tarea**.

- **Vence a las 12:00 m (Bogotá) del día marcado** (22-sep-2026). Todo cálculo de fecha límite pasa por `lib/utils/due-date.ts` (`parseDueDate`, `dueDeadline`, `isPastDue`, `formatDueDate`, `dueDateKey`); nunca `new Date(task.dueDate)` suelto. Motivo: `new Date('2026-09-23')` es medianoche UTC = el 22 a las 7 pm en Bogotá, y las tareas salían vencidas (y mostradas) un día antes. El día de la tarea es la fecha UTC de lo guardado, así que las filas viejas (00:00Z) y las nuevas (17:00Z) funcionan igual sin migrar datos.
- Al vencer se escribe **un** asiento `TASK_OVERDUE` de `−pointsValue` y la tarea queda marcada con `overdueChargedAt` para no cobrarlo dos veces. `taskOverdueService.chargeOverdue()` corre en el **barrido perezoso** (al abrir el tablero) y en el cron.
- **El saldo puede quedar negativo.** Con saldo negativo la persona no cobra nada del reparto: queda en 0, nunca en deuda (`splitPool` solo mira saldos positivos, y `getProjectContributions` suma solo los positivos para el total — si sumara los negativos, los porcentajes de todos saldrían mal).
- **Entregar detiene el reloj:** en `SUBMITTED` no se cobra; la demora de los jefes en revisar no le cuesta puntos a quien ya entregó.
- Si después se entrega y se acepta, se acredita el **valor vigente** (sin descuentos). Vencerse y luego entregar con el mismo valor deja neto **0**; si la revaluación subió el valor, queda a favor.
- **Los descuentos por arrastre (20 %) y por rechazo (25 %) se retiraron**, junto con `penaltyPerDay` y el piso del 50 %: el equipo prefirió una sola regla fuerte a tres porcentajes. Las columnas `lateAccruedDays` / `lateClockStartedAt` siguen en `Task` solo para leer el histórico.

### Revaluación (la salida honesta)

El asignado puede avisar **antes** de que el reloj le cobre: botón en el panel de la tarea.

- `revaluationRequestedAt` **pausa el vencimiento**: mientras esté pedida no se cobra aunque la fecha pase.
- Sale correo a los jefes (`revaluationRequested`).
- Un jefe la resuelve con **fecha nueva** y, si el equipo lo ve distinto, **reabre la votación** (`reopenVoting`): se borran los votos viejos y se abre una ventana nueva. Fecha nueva = `overdueChargedAt` vuelve a null, así que la tarea puede volver a vencer con su valor nuevo.
- Es el único camino por el que una votación se reabre.

### Ledger, capas y reparto

```
neto        = COMPANY_INCOME − |DEDUCTION|        (misma fórmula que /api/ganancias)
disponible  = neto − lo ya liquidado (suma de Payout.netAmount)

sobre lo disponible:
  fundador  = disponible × founderRatio   (15 %)
  pozo      = disponible × poolRatio      (60 %)
  empresa   = el resto                    (25 %) + lo que sobre por el tope

% de un miembro = sus puntos en el ledger ÷ total del ledger del proyecto
reparto         = pozo × %, con tope de maxIndividualShare (45 %) por persona
```

**El tope individual** recorta a quien pase del 45 % del pozo y redistribuye el excedente entre los demás en proporción a sus puntos; se repite porque redistribuir puede empujar a otro contra el tope. Si ya nadie puede recibirlo, el sobrante se queda en la reserva de la empresa: nunca se evapora ni descuadra la suma.

**La capa del fundador** va al `SUPERADMIN` activo más antiguo, aparte de lo que le toque por sus propios puntos. Es explícitamente temporal (baja a 0 cuando haya salarios); por eso es un parámetro y no una regla del código.

### Liquidaciones (congelar el reparto)

El porcentaje de aporte es **vivo**: cambia con cada tarea aceptada. Un pago no puede serlo, así que al liquidar se fotografían puntos y porcentajes de ese día en `Payout` + `PayoutShare`, y la fila **no se vuelve a calcular nunca**. La siguiente liquidación usa el ledger actualizado.

- Solo el **dueño** liquida (`payoutService.create`). Sin `amount` reparte todo lo disponible; con él, solo esa parte (un anticipo).
- Cada liquidación escribe un `Earning` de tipo `USER_EARNING` por persona — más otro para el retorno del fundador — que es lo que ya lee el módulo de ganancias. Todo en una transacción.
- `payoutService.preview()` hace el MISMO cálculo sin escribir: es lo que muestra la pantalla antes de confirmar.
- Quien entra después no diluye lo ya repartido, y quien se va conserva lo que ya cobró.

El ledger es **append-only**. Eso resuelve dos casos de golpe:
- **Tarea reabierta** → asiento negativo `TASK_REVERTED`; el original no se borra.
- **Miembro que sale** → `PointLedgerEntry` apunta a `User`, no a `ProjectMember`, así que conserva su saldo congelado y los porcentajes de los demás **no** suben solos.

El dueño puede crear asientos `ADJUSTMENT` a mano (positivos o negativos) desde la ventana de aportes. Para corregir se agrega el opuesto, nunca se borra.

### Mapa de archivos

```
lib/auth/permissions.ts                       Roles: getProjectPermissions, getProjectLeadIds, getProjectMemberIds
lib/services/task-lifecycle.ts                Máquina de estados: guardas puras + elegibilidad de votantes/aprobadores
lib/services/point-scale.ts                   Escala Fibonacci, anclas, snapToScale, pasos de desacuerdo
lib/services/task-valuation.service.ts        Mediana, quórum, castVote, settleTask (idempotente)
lib/services/task-completion.service.ts       Aprobación/rechazo, aceptación, ledger, reopen
lib/services/task-penalty.ts                  Vencimiento: shouldChargeOverdue, buildPenaltyPreview
lib/services/task-overdue.service.ts          Cobro del vencimiento y revaluación (pedir/resolver)
lib/services/sprint.service.ts                Sprints: crear, arrancar, cerrar con arrastre, capacidad, velocidad
lib/services/profit-split.ts                  Capas del neto y tope individual (cálculo puro)
lib/services/payout.service.ts                Liquidaciones: preview, create (congela), list
lib/services/contribution.service.ts          %, reparto en vivo, ajustes manuales
lib/services/contribution-metrics.service.ts  Serie mensual, mejor mes, tendencia
lib/services/contribution-settings.service.ts Parámetros: override de proyecto → global → defaults
lib/services/notification.service.ts          Los 8 correos (Resend)
lib/email/shell.ts                            Marco HTML compartido
lib/email/task-templates.ts                   Plantillas del sistema de puntos
lib/utils/chart-palette.ts                    Paleta categórica VALIDADA para daltonismo
components/projects/TaskVoting.tsx            Botonera Fibonacci con anclas, quórum, cuenta regresiva
components/projects/TaskApproval.tsx          Aceptar/rechazar, quién firmó, reabrir
components/projects/TaskPenalty.tsx           Fecha límite, cobro del vencimiento y botón de revaluación
components/projects/SprintBar.tsx             Sprint activo, capacidad por persona, arrancar/cerrar, alcance del tablero
components/projects/TaskPointsBadge.tsx       Chip de puntos, compartido por las 3 vistas
components/projects/ContributionShare.tsx     Panel de reparto en la página del proyecto
components/projects/PointAdjustments.tsx      Asignación manual (solo dueño)
components/projects/PayoutPanel.tsx           Capas del dinero, simulación y liquidaciones congeladas
components/charts/                            MemberPointsChart, MonthlyPointsChart, MemberTrendCard
app/(dashboard)/dashboard/proyectos/[id]/aportes/   Ventana de gráficos y métricas
```

### Invariantes que se rompen fácil

1. **El % y las métricas salen del ledger, nunca de las tareas.** Calcularlos desde `Task` pierde las reversiones y borra a quien salió del equipo.
1b. **Una `Payout` no se recalcula jamás.** Es la foto de un pago; si hay que corregir, se hace otra liquidación (o un ajuste de puntos), nunca se edita la vieja.
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
POST            /api/v1/projects/[id]/tasks/[taskId]/revaluation  # pedir (asignado) o resolver (jefe)
GET/POST        /api/v1/projects/[id]/tasks/[taskId]/comments
PUT/DELETE      /api/v1/projects/[id]/tasks/[taskId]/comments/[commentId]   # owner-only
GET             /api/v1/projects/[id]/tasks/[taskId]/history
GET/POST        /api/v1/projects/[id]/tasks/[taskId]/attachments            # POST → 501
GET/POST        /api/v1/projects/[id]/sprints                    # lista + activo + capacidades · POST solo jefes
GET/PUT         /api/v1/projects/[id]/sprints/[sprintId]         # PUT edita el sprint O ajusta capacidad ({userId, points})
POST            /api/v1/projects/[id]/sprints/[sprintId]/start
POST            /api/v1/projects/[id]/sprints/[sprintId]/close   # arrastra lo no aceptado
GET             /api/v1/projects/[id]/sprints/velocity
GET/POST        /api/v1/projects/[id]/payouts                    # liquidaciones + simulación · POST solo dueño
GET             /api/v1/projects/[id]/contributions              # %, reparto, pendientes
GET             /api/v1/projects/[id]/contributions/metrics      # serie mensual, tendencia
GET/POST        /api/v1/projects/[id]/contributions/adjustments  # POST solo dueño
GET/POST        /api/v1/cron/close-voting                        # Bearer CRON_SECRET · cierra votaciones Y cobra vencimientos
GET             /api/v1/bot/pendientes                           # Bearer BOT_API_TOKEN
```

**`/api/v1/bot/pendientes`** es lo único que el bot de Telegram ve de esta app: solo lectura, sin sesión, con `Authorization: Bearer $BOT_API_TOKEN`. Devuelve por usuario activo sus tareas asignadas, las que le toca valorar, las que le toca aprobar y las que están en revisión; con `?since=ISO` agrega `novedades` (asignada, votar, aprobar, rechazada, aceptada) para los avisos cada 15 min. Con `?email=` responde solo por esa persona. `since` se recorta a 2 días para que un bot caído no dispare una avalancha. No liquida votaciones ni manda correos.

**Las lecturas de tareas vienen decoradas** con `penalty` (calculado en el servidor) para que Kanban, lista, Gantt y el panel muestren el mismo número que se acredita al aceptar.

### State Management

Zustand en `store/`: `authStore` (persistido), `clientStore`, `projectStore`, `quotationStore`, `uiStore`. Hooks en `hooks/` (`useClients`, `useProjects`, `useQuotations`, `useAuth`, `usePermissions`).

El módulo de tareas **no usa Zustand**: el estado vive en `proyectos/[id]/page.tsx` con `useState`/`useCallback`. Tras crear, editar o borrar una tarea, la página llama `loadTasks()` para reconciliar con el servidor (la respuesta cruda no trae la penalización ni el orden definitivo).

### Validation

Zod en `lib/validations/` (entidades legadas) y `lib/dto/` (tareas). Formularios con React Hook Form + `@hookform/resolvers/zod`.

`CreateTaskSchema` exige `assignedTo` y `dueDate`. `UpdateTaskFieldsSchema` permite omitirlos pero **no vaciarlos**. `MEMBER_EDITABLE_FIELDS` es la definición que puede editar cualquier miembro (título, descripción, prioridad, estimado, tags) y `ASSIGNEE_EDITABLE_FIELDS` lo que además puede tocar el asignado (status, horas, orden).

### PDF Generation

`lib/pdf/generator.ts` + `lib/pdf/templates/quotation.tsx` con `@react-pdf/renderer`. Endpoint: `GET /api/quotations/[id]/pdf`.

### UI Components

Librería propia en `components/ui/` (Button, Card, Input, Select, Textarea, Modal, Badge, Alert, Spinner, Table). Tailwind v4. `cn()` desde `lib/utils/cn.ts`. **No hay componente Checkbox** — los checkboxes son `<input type="checkbox">` con clases.

Organización: `ui/` (primitivos), `forms/`, `layout/`, `dashboard/`, `public/`, `projects/` (tareas y puntos), `charts/` (gráficos).

**No hay librería de gráficos y no hay que agregarla.** Gantt, donut de progreso y los gráficos de aportes son SVG/CSS a mano.

### Project Detail Page (`/dashboard/proyectos/[id]`)

Página cliente con tres vistas conmutables. Todo sale de `/api/v1/`.

**Cargar tareas NO puede prender el spinner de página.** La página tiene dos efectos separados: uno carga el proyecto (spinner de página) y otro las tareas al cambiar filtros o alcance de sprint (overlay sobre el tablero). Unirlos hacía que cambiar de sprint desmontara todo el árbol, y al remontarse `SprintBar` perdía su `scopeInitialized` y devolvía el tablero al sprint activo: seleccionabas un sprint y volvía solo al de siempre.

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

## Agente de Telegram (reto anual del equipo)

Bot **@Xenith26_bot** en un grupo de Telegram con Camilo, Nicolás y David ("Potro"). **No vive en esta app**: corre en n8n sobre Railway, con su propia base de datos. Esta app Next.js sigue en Vercel y no se ha tocado.

### Qué hace

Reto personal de un año (**17-sep-2026 → 17-sep-2027**). Cada uno tiene metas personales (Camilo 8, Nicolás 6, David 5) y hay 5 grupales. Quien incumpla paga `1.000.000 COP ÷ (sus metas personales + 5 grupales)` por cada meta incumplida; quien termine con más puntos se salva de pagar **una** meta.

- **Evidencia:** foto/video en el grupo → el bot pregunta a qué meta es → cuánto suma → tarjeta con ✅/❌. Basta **un** voto de otro (el primero decide, nadie vota lo suyo): aprobada = 5 pts; sin votos en 48 h se auto-aprueba con 2 pts. Los puntos son solo motivación; lo que cuenta al final es la demostración física.
- **Tipos de meta:** `ACUMULATIVA` (suma), `NIVEL` (último valor contra línea base; `direccion` SUBE/BAJA), `HITO` (sí/no con prueba final), `HABITO` (semanas con N días; entrenar: 45 de 52 = 85 %), `ABSTINENCIA` (pruebas en una ventana). La meta de dejar la marihuana se llama **"Maria"** en todo texto del bot — nunca escribir la palabra real.
- **Grupales:** 30 dominadas, salsa y curso de comunicación = `GRUPAL_INDIVIDUAL` (cada uno la cumple); 200k seguidores de Instagram y 3 ventas en cada línea (oaxis, GA-IA, EDGE, Vector) = `GRUPAL_COLECTIVA`.
- **Programado:** cada 15 min (auto-aprobación, borradores olvidados, recordatorios), 12/15/18/21 h (quién no ha subido evidencia hoy; miércoles 12 h pregunta por la meta más abandonada), domingo 19 h (resumen semanal). Los avisos del reto no salen antes del 17-sep-2026.
- **Recordatorios personales:** el aviso sale **15 min ANTES** del evento (`recordatorio_anticipo_min`, o `avisar_antes_min` por recordatorio); si falta menos que eso, sale de una. Tras el aviso anticipado, el siguiente es la **hora exacta** y de ahí insiste cada 3 h fuera de 22–7 h, botón ✅ Hecho. Se crean hablándole normal al bot por privado (lo resuelve el agente de IA) o se consultan con `/recordatorios`.
- **Vida en el grupo:** el bot se mete en las conversaciones **de vez en cuando** (`fn_grupo_puede_opinar`: cooldown de 40 min + tope de 8 al día + 18 % de probabilidad). Siempre contesta si lo mencionan (`@Xenith26_bot`, "bot") o si le responden a él. En modo grupo no tiene herramientas ni memoria, responde UNA línea y puede contestar `NADA` para quedarse callado — un bot que responde todo deja de ser gracioso en dos días.
- **Arengas:** los reclamos de 12/3/6/9 los **escribe la IA** con el brief que arma SQL (quién no ha subido, cuántos días lleva cada uno, día del reto). SQL le pega las menciones para que el tag de Telegram funcione sí o sí, y si la IA falla o está topada sale el texto de respaldo: nunca se deja de joder.
- **Personalidad:** el bot habla como colombiano callejero y mamagallista —grosero y burlón, pero con la pereza y el incumplimiento, nunca con la persona— y **responde corto** (1–2 frases). Vive en el prompt de `fn_agente_preparar`; los textos de plantilla (listas, tarjetas) siguen siendo neutros y legibles.

### Chat privado: agente de IA + tareas de Xenith

Por privado el bot es asistente personal de cada quien. Tres capacidades y nada más: recordatorios (crear/ver/cambiar/cancelar), sus tareas del CRM de Xenith y su avance del reto.

- **Un solo llamado al modelo por mensaje.** `fn_agente_preparar` arma el body (system + memoria corta + 6 herramientas), n8n lo manda a `api.anthropic.com/v1/messages` y `fn_agente_responder` ejecuta la herramienta elegida y arma la respuesta **con plantillas SQL**. No hay bucle de agente ni segunda llamada: el modelo elige la acción, el texto lo pone la base.
- **Modelo `claude-haiku-4-5`** ($1 / $5 por millón de tokens). ~US$0,002 por mensaje.
- **Límites (todos en `config`, editables sin tocar código):** `ia_mensajes_dia` 25 por persona, `ia_tope_mes_usd` 3 sumando a los tres (al llegar la IA se apaga sola hasta el mes siguiente), `ia_max_tokens` 350, `ia_max_caracteres` 600, memoria de 30 min / 4 turnos (`chat_ia`, se purga a los 2 días). Cada llamada queda en `uso_ia` con tokens y costo; `/uso` lo muestra.
- **Los comandos no cuestan:** `/tareas`, `/equipo`, `/recordatorios`, `/uso`, `/metas`, `/avance`. Si se piden en el grupo, la respuesta sale por privado.
- **Consultar a otro sí se puede; que se lo manden solo, no.** Cualquiera puede preguntar «¿David ya terminó?» o pedir `/equipo`: el modelo solo puede NOMBRAR a alguien del equipo y el correo lo resuelve la tabla `participantes` (`ver_tareas_xenith` con `persona`). Lo que nunca se mezcla es lo que el bot **manda por iniciativa propia** —resumen de las 7 am y avisos cada 15 min—: eso siempre es solo lo tuyo, cruzado por `xenith_email`.
- **Tope de gasto real:** el de la consola de Anthropic. El de `config` es el freno del bot.

### Arquitectura

```
Telegram ──webhook──► n8n "Reto · Entrada Telegram" ──► select fn_procesar_update($1::jsonb)
                      n8n "Reto · Programados"      ──► fn_tick() / fn_recordar_evidencias() / fn_resumen_semanal()
                                                        fn_xenith_resumen() 7 am · fn_xenith_novedades() cada 15 min 7–21 h
                                  │ devuelven [{metodo, params}]
                                  ▼
                      n8n "Reto · Ejecutar acciones" ──► Switch por `metodo`
                                  ├── '__agente' ──► "Reto · Agente IA"     (Anthropic → fn_agente_responder)
                                  ├── '__tareas' ──► "Reto · Tareas Xenith" (GET /api/v1/bot/pendientes → fn_xenith_tareas_de)
                                  └── resto      ──► POST api.telegram.org/bot$TELEGRAM_BOT_TOKEN/<metodo>
```

Los dos sub-workflows terminan devolviendo sus acciones a "Ejecutar acciones", así que **todo mensaje sale por un solo sitio**. Un `metodo` que empiece por `__` nunca llega a Telegram.

**Toda la lógica vive en funciones SQL** de la base `reto`; n8n solo transporta. Así se prueba con `begin; … rollback;` sin tocar Telegram. La conversación con el usuario no guarda estado aparte: el id de la evidencia viaja en el `callback_data` de los botones y como `#E<id>` en el texto de las preguntas del bot (la respuesta con una cifra se enlaza leyendo `reply_to_message.text`).

Fuente versionada en `agente/`:
- `agente/sql/01-schema.sql` — tablas, enums y vistas (`v_avance`, `v_puntos`, `v_penitencia`, `v_evidencias_hoy`).
- `agente/sql/02-seed.sql` — config, participantes y metas. **Está en `.gitignore`** (metas personales); ya está cargado.
- `agente/sql/03-logic.sql` — funciones del reto (evidencias, votos, programados). Idempotente: editar aquí y reaplicar.
- `agente/sql/04-agente.sql` — agente de IA y tareas de Xenith: tablas `uso_ia` / `chat_ia`, límites, formato de fechas en español, `fn_agente_*`, `fn_xenith_*`. También idempotente.
- `agente/n8n/*.json` — los 5 workflows con placeholders `__PG_ID__`, `__TG_ID__`, `__SUB_ID__`, `__AGENTE_ID__`, `__TAREAS_ID__`, `__XENITH_CRED_ID__`, `__ANTHROPIC_CRED_ID__`.

### Infraestructura (Railway, proyecto `xenith-agente`)

| Qué | Dato |
|---|---|
| Proyecto | id `bd9c4989-ef22-4208-be25-f6c280786660`, workspace "My Projects", plan Hobby |
| n8n | https://n8n-production-2b81f.up.railway.app — imagen oficial `docker.n8n.io/n8nio/n8n:latest` (v2.38.7), BD interna en la base `railway` |
| Postgres | Oficial (PG 18), **sin proxy público**: solo red privada. Bases `railway` (n8n) y `reto` (bot) |
| Rol del bot | `reto_app`: solo DML sobre la base `reto`. Credencial n8n "Postgres Reto" `KLQoUaKtzVtI9hU4` |
| Telegram | Credencial n8n "Telegram Reto" `NuTDWsAno013RCvO` (la usa el trigger). El envío usa `$env.TELEGRAM_BOT_TOKEN` (variable de Railway) porque la credencial de Telegram no sirve en el nodo HTTP; por eso `N8N_BLOCK_ENV_ACCESS_IN_NODE=false` |
| Workflows | Ejecutar acciones `NIPKvsHaslvT0sav` · Entrada Telegram `Z5R6HXcFOPqRerMo` · Programados `fZ1hUMmlzbkQmbvN` · Agente IA `aGzxzwuigVCxXOtJ` · Tareas Xenith `38RZPspXGkX97H5K` (los 5 activos) |
| Credenciales HTTP | "Anthropic" `OAJycSISZNjnvTsr` (header `x-api-key`, solo api.anthropic.com) · "Xenith Bot" `Vys8WfXYcRO5zTd5` (header `Authorization: Bearer $BOT_API_TOKEN`, solo xenith.com.co). Se editan en la UI de n8n; la API key de Anthropic **nunca** se guarda en el repo |
| API key de n8n | En `N8NTOKEN.txt` en la raíz (gitignored). Header `X-N8N-API-KEY` |

### Cómo operar

```bash
# SQL en la base del reto (bloques railway-postgres / railway-n8n en ~/.ssh/config)
ssh railway-postgres 'psql -U postgres -d reto'
ssh railway-postgres 'psql -U postgres -d reto -q' < agente/sql/03-logic.sql   # reaplicar lógica

# CLI de Railway: `railway add` no acepta --project; correr desde un dir enlazado
# (railway link --project xenith-agente en una carpeta temporal, NO en este repo)
```

- **`railway login` no funciona con `!` desde Claude Code**: usar `railway login --browserless` en segundo plano y pasarle el enlace al usuario.
- **API de n8n:** `POST /workflows/{id}/activate` exige `Content-Type: application/json` con body `{}`; los sub-workflows se publican **antes** que los que los llaman.
- **Parámetros del nodo Postgres (v2.6):** usar `queryReplacement: "={{ [ $json ] }}"` — un arreglo evita que n8n parta el JSON por comas. Probado con comillas, `$$` y `;`.
- **Borrar o desactivar workflows y relajar opciones de seguridad** lo bloqueó el clasificador de permisos: pedir al usuario que lo haga en la UI.
- **Nunca dejar activo un workflow de prueba con Webhook** que llame a `fn_procesar_update`: permitiría falsificar updates de Telegram (registrarse como otro, votar).

### Pendientes del agente

- **Borrar los datos de prueba antes del 17-sep-2026** (hoy hay 2 evidencias y 1 voto de prueba): `delete from votos_evidencia; delete from evidencias;` (sin tocar participantes ni `grupo_chat_id`).
- Nicolás aún no se ha registrado en el bot (`/soy`).
- **Falta la API key de Anthropic** en la credencial "Anthropic" de n8n (hoy tiene un placeholder): sin ella el agente responde "no pude pensar ahora mismo". Los comandos siguen funcionando.
- **Cada uno debe abrir el chat privado con @Xenith26_bot y darle Iniciar**, o los avisos y recordatorios por privado no le llegan (Telegram no deja escribir primero).
- El cron de cierre de votaciones de Xenith (ver "Cron" arriba) puede dispararlo n8n con un Schedule + HTTP a `/api/v1/cron/close-voting` con `Bearer CRON_SECRET`. Aún no se hizo.
- Cierre del año: veredicto por meta (`veredictos_finales`) y cálculo final de la penitencia con la exoneración por puntos.

## Hacia Scrum (decidido con el equipo el 16-sep-2026)

Propuesta completa: artefacto "Sistema de aporte Xenith" (`https://claude.ai/artifact/RR2VhxLMY5dsBh7Uemd9zG`). Lo acordado:

- **Reparto del neto de cada proyecto: 25 % empresa · 15 % fundador · 60 % pozo por puntos.** Hoy el código reparte el 100 % por puntos (`contribution.service`): eso cambia en la Fase 3.
- **Tope individual del 45 %** del pozo de un proyecto.
- Sprint de **2 semanas**, capacidad de **8–13 puntos por persona**, descuento de **20 %** al arrastrar y **25 %** por cada rechazo (piso 50 %).
- **Estimar antes de asignar**: la tarea nace sin dueño, el equipo la valora y se asigna en la planeación. Hoy `CreateTaskSchema` exige `assignedTo`; cambia en la Fase 2.

| Fase | Qué | Estado |
|---|---|---|
| 1 | Escala Fibonacci, anclas, redondeo, aviso de épica | **hecha** (sin migración) |
| 2 | Sprints, capacidad, arrastre/retrabajo, estimar antes de asignar, velocidad | **hecha** (migración `20260916150000_fase2_sprints` aplicada el 16-sep-2026) |
| 3 | Capas del dinero, liquidación congelada por ingreso, tope del 45 % | **hecha** (migración `20260916180000_fase3_reparto` aplicada el 16-sep-2026) |

La penalización de −0,2 por día **ya no se aplica**: la reemplazaron los descuentos por arrastre y retrabajo.

Lo que falta de la Fase 2, si se quiere pulir: gráfico de velocidad en la ventana de aportes, avisos de sprint por Telegram (apertura, mitad, cierre) y checklist de "terminado" (DoD) en la tarjeta.

## Pendientes conocidos

- **Los correos nunca se han probado en vivo.** Toda la verificación corrió con `RESEND_API_KEY` neutralizada. Falta una prueba real: crear una tarea, votar, marcar terminada y aceptar, confirmando que llegan los 4 avisos.
- **Cron sin programar** (ver arriba). Sin él, el correo de "votación cerrada" solo sale cuando alguien abre el tablero.
- `TaskAttachment` existe en el schema pero el POST devuelve 501: no hay subida de archivos.
- `app/api/contact/route.ts` envía desde `onboarding@resend.dev`, que solo entrega al dueño de la cuenta.
- La inconsistencia email vs. rol para detectar al superadmin (ver Authentication).
