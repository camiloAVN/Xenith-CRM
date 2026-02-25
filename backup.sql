--
-- PostgreSQL database dump
--

\restrict jpy5nT2tujQiOpzPfB7W76qnG9cgD7AeI1C1KMc3VEk6ArwgJv2PReVXUwMrqXX

-- Dumped from database version 18.1 (Debian 18.1-1.pgdg13+2)
-- Dumped by pg_dump version 18.1 (Debian 18.1-1.pgdg13+2)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: Priority; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."Priority" AS ENUM (
    'LOW',
    'MEDIUM',
    'HIGH',
    'URGENT'
);


ALTER TYPE public."Priority" OWNER TO postgres;

--
-- Name: ProjectStatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."ProjectStatus" AS ENUM (
    'PROSPECT',
    'IN_PROGRESS',
    'ON_HOLD',
    'COMPLETED',
    'CANCELLED'
);


ALTER TYPE public."ProjectStatus" OWNER TO postgres;

--
-- Name: QuotationStatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."QuotationStatus" AS ENUM (
    'DRAFT',
    'SENT',
    'ACCEPTED',
    'REJECTED',
    'EXPIRED'
);


ALTER TYPE public."QuotationStatus" OWNER TO postgres;

--
-- Name: TaskStatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."TaskStatus" AS ENUM (
    'TODO',
    'IN_PROGRESS',
    'DONE'
);


ALTER TYPE public."TaskStatus" OWNER TO postgres;

--
-- Name: UserRole; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."UserRole" AS ENUM (
    'SUPERADMIN',
    'ADMIN',
    'USER'
);


ALTER TYPE public."UserRole" OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: _prisma_migrations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public._prisma_migrations (
    id character varying(36) NOT NULL,
    checksum character varying(64) NOT NULL,
    finished_at timestamp with time zone,
    migration_name character varying(255) NOT NULL,
    logs text,
    rolled_back_at timestamp with time zone,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    applied_steps_count integer DEFAULT 0 NOT NULL
);


ALTER TABLE public._prisma_migrations OWNER TO postgres;

--
-- Name: accounts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.accounts (
    "userId" text NOT NULL,
    type text NOT NULL,
    provider text NOT NULL,
    "providerAccountId" text NOT NULL,
    refresh_token text,
    access_token text,
    expires_at integer,
    token_type text,
    scope text,
    id_token text,
    session_state text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.accounts OWNER TO postgres;

--
-- Name: clients; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.clients (
    id text NOT NULL,
    name text NOT NULL,
    company text,
    email text NOT NULL,
    phone text,
    address text,
    city text,
    country text,
    "taxId" text,
    notes text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.clients OWNER TO postgres;

--
-- Name: projects; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.projects (
    id text NOT NULL,
    title text NOT NULL,
    description text NOT NULL,
    status public."ProjectStatus" DEFAULT 'PROSPECT'::public."ProjectStatus" NOT NULL,
    "clientId" text NOT NULL,
    "assignedTo" text NOT NULL,
    "startDate" timestamp(3) without time zone,
    "endDate" timestamp(3) without time zone,
    budget numeric(10,2),
    priority public."Priority" DEFAULT 'MEDIUM'::public."Priority" NOT NULL,
    tags text[] DEFAULT ARRAY[]::text[],
    notes text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.projects OWNER TO postgres;

--
-- Name: quotation_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.quotation_items (
    id text NOT NULL,
    "quotationId" text NOT NULL,
    description text NOT NULL,
    quantity integer NOT NULL,
    "unitPrice" numeric(10,2) NOT NULL,
    total numeric(10,2) NOT NULL,
    "order" integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.quotation_items OWNER TO postgres;

--
-- Name: quotations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.quotations (
    id text NOT NULL,
    "quotationNumber" text NOT NULL,
    title text NOT NULL,
    description text,
    "clientId" text NOT NULL,
    "projectId" text,
    "createdBy" text NOT NULL,
    status public."QuotationStatus" DEFAULT 'DRAFT'::public."QuotationStatus" NOT NULL,
    "validUntil" timestamp(3) without time zone NOT NULL,
    subtotal numeric(10,2) NOT NULL,
    tax numeric(10,2) NOT NULL,
    discount numeric(10,2) DEFAULT 0 NOT NULL,
    total numeric(10,2) NOT NULL,
    notes text,
    terms text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.quotations OWNER TO postgres;

--
-- Name: sessions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.sessions (
    "userId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    expires timestamp(3) without time zone NOT NULL,
    "sessionToken" text NOT NULL
);


ALTER TABLE public.sessions OWNER TO postgres;

--
-- Name: tasks; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tasks (
    id text NOT NULL,
    "projectId" text NOT NULL,
    title text NOT NULL,
    description text,
    status public."TaskStatus" DEFAULT 'TODO'::public."TaskStatus" NOT NULL,
    "dueDate" timestamp(3) without time zone,
    completed boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.tasks OWNER TO postgres;

--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id text NOT NULL,
    email text NOT NULL,
    "emailVerified" timestamp(3) without time zone,
    name text,
    image text,
    password text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    role public."UserRole" DEFAULT 'USER'::public."UserRole" NOT NULL
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Name: verification_tokens; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.verification_tokens (
    identifier text NOT NULL,
    token text NOT NULL,
    expires timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.verification_tokens OWNER TO postgres;

--
-- Data for Name: _prisma_migrations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) FROM stdin;
d160317a-1859-4328-8251-ac81ea488588	b257045624207a60fa93f815dd5c242dda42be98dba985c30b870f7d692d1fa5	2026-01-14 22:00:32.795212+00	20260114220032_init	\N	\N	2026-01-14 22:00:32.772223+00	1
c0c12482-e81a-4ba5-b68d-4c217a73708f	336f556aee1b5b9bf8ccf932eb772cf89d1dfdb8213709729eee07602f557c2b	2026-01-15 03:41:21.538063+00	20260115034121_migrate_to_authjs	\N	\N	2026-01-15 03:41:21.521815+00	1
37ccaebd-2e5f-411d-a979-39dc2a7000f7	94b9f0b42ba5376135c8163a9465958dc541356911696230f4f1a72fdcef283f	2026-01-16 02:38:41.733945+00	20260116023841_add_user_roles	\N	\N	2026-01-16 02:38:41.715144+00	1
\.


--
-- Data for Name: accounts; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.accounts ("userId", type, provider, "providerAccountId", refresh_token, access_token, expires_at, token_type, scope, id_token, session_state, "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: clients; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.clients (id, name, company, email, phone, address, city, country, "taxId", notes, "createdAt", "updatedAt") FROM stdin;
cmkg00eir0000cmrnilqh3sf2	andrei	corferias	andrei@corferias.com	31332255328	calle 22a no 8361	Bogota	CO			2026-01-15 22:05:34.467	2026-01-15 22:05:34.467
cmkgaxwf50001cedhzwzghbmx	Juan Pérez	Empresa Demo S.A.	cliente@ejemplo.com	+52 123 456 7890	\N	Ciudad de México	México	\N	Cliente de demostración para pruebas	2026-01-16 03:11:33.474	2026-01-16 03:11:33.474
\.


--
-- Data for Name: projects; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.projects (id, title, description, status, "clientId", "assignedTo", "startDate", "endDate", budget, priority, tags, notes, "createdAt", "updatedAt") FROM stdin;
cmkg0byv0000dcmrncl5choz3	dsfwwww	wretwertwertwrettt	IN_PROGRESS	cmkg00eir0000cmrnilqh3sf2	cmkgaxwe30000cedhjzqvquvv	2026-01-16 00:00:00	2026-01-30 00:00:00	10000000.00	MEDIUM	{}	\N	2026-01-15 22:14:34.043	2026-01-16 03:11:33.447
cmkgaxwfi0003cedho856f4vc	Sistema de Automatización Industrial	Desarrollo de sistema de automatización para línea de producción	IN_PROGRESS	cmkgaxwf50001cedhzwzghbmx	cmkgaxwe30000cedhjzqvquvv	2026-01-01 00:00:00	2026-06-30 00:00:00	150000.00	HIGH	{automatización,robótica,IoT}	Proyecto prioritario para Q1 2026	2026-01-16 03:11:33.487	2026-01-16 03:11:33.487
\.


--
-- Data for Name: quotation_items; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.quotation_items (id, "quotationId", description, quantity, "unitPrice", total, "order", "createdAt", "updatedAt") FROM stdin;
cmkg0cpqs000ecmrn08hawj0h	cmkg05h4r0006cmrnvur2du5y	bar robotizado con automatizaciones especiales 	1	10000000.00	10000000.00	0	2026-01-15 22:15:08.884	2026-01-15 22:15:08.884
\.


--
-- Data for Name: quotations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.quotations (id, "quotationNumber", title, description, "clientId", "projectId", "createdBy", status, "validUntil", subtotal, tax, discount, total, notes, terms, "createdAt", "updatedAt") FROM stdin;
cmkg05h4r0006cmrnvur2du5y	QT-2026-0001	corferias robart	\N	cmkg00eir0000cmrnilqh3sf2	cmkg0byv0000dcmrncl5choz3	cmkgaxwe30000cedhjzqvquvv	DRAFT	2026-02-13 00:00:00	10000000.00	1600000.00	0.00	11600000.00	sistema mecatrónico para crear bebidas de diferentes tipos	el pago se debe realizar por transferencias maximo hasta un mes despues de la entrega 	2026-01-15 22:09:31.131	2026-01-16 03:11:33.458
\.


--
-- Data for Name: sessions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.sessions ("userId", "createdAt", "updatedAt", expires, "sessionToken") FROM stdin;
\.


--
-- Data for Name: tasks; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.tasks (id, "projectId", title, description, status, "dueDate", completed, "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (id, email, "emailVerified", name, image, password, "createdAt", "updatedAt", "isActive", role) FROM stdin;
cmkgaxwe30000cedhjzqvquvv	camilo.vargas@xenith.com.co	\N	Camilo Vargas	\N	$2b$12$AXxrYq6tCGcFAkpumKy/Q.dEyF92cCzvcbo1fEMQxGkPRv31BIQzu	2026-01-16 03:11:33.435	2026-01-16 03:11:33.435	t	SUPERADMIN
cmkgbj4xn000013mxdw7xzepa	nicolas.ramirez@xenith.com.co	\N	nicolas ramirez	\N	$2b$12$mVXt1U0D1lzgPigtexVaUuwC.kp4S.cYH76G/TACVnwnvqiCa6MwC	2026-01-16 03:28:04.284	2026-01-16 03:28:04.284	t	USER
\.


--
-- Data for Name: verification_tokens; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.verification_tokens (identifier, token, expires) FROM stdin;
\.


--
-- Name: _prisma_migrations _prisma_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public._prisma_migrations
    ADD CONSTRAINT _prisma_migrations_pkey PRIMARY KEY (id);


--
-- Name: accounts accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT accounts_pkey PRIMARY KEY (provider, "providerAccountId");


--
-- Name: clients clients_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_pkey PRIMARY KEY (id);


--
-- Name: projects projects_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_pkey PRIMARY KEY (id);


--
-- Name: quotation_items quotation_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.quotation_items
    ADD CONSTRAINT quotation_items_pkey PRIMARY KEY (id);


--
-- Name: quotations quotations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.quotations
    ADD CONSTRAINT quotations_pkey PRIMARY KEY (id);


--
-- Name: tasks tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: verification_tokens verification_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.verification_tokens
    ADD CONSTRAINT verification_tokens_pkey PRIMARY KEY (identifier, token);


--
-- Name: clients_email_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX clients_email_key ON public.clients USING btree (email);


--
-- Name: projects_assignedTo_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "projects_assignedTo_idx" ON public.projects USING btree ("assignedTo");


--
-- Name: projects_clientId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "projects_clientId_idx" ON public.projects USING btree ("clientId");


--
-- Name: projects_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX projects_status_idx ON public.projects USING btree (status);


--
-- Name: quotation_items_quotationId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "quotation_items_quotationId_idx" ON public.quotation_items USING btree ("quotationId");


--
-- Name: quotations_clientId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "quotations_clientId_idx" ON public.quotations USING btree ("clientId");


--
-- Name: quotations_createdBy_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "quotations_createdBy_idx" ON public.quotations USING btree ("createdBy");


--
-- Name: quotations_projectId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "quotations_projectId_idx" ON public.quotations USING btree ("projectId");


--
-- Name: quotations_quotationNumber_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "quotations_quotationNumber_key" ON public.quotations USING btree ("quotationNumber");


--
-- Name: sessions_sessionToken_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "sessions_sessionToken_key" ON public.sessions USING btree ("sessionToken");


--
-- Name: tasks_projectId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "tasks_projectId_idx" ON public.tasks USING btree ("projectId");


--
-- Name: users_email_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX users_email_key ON public.users USING btree (email);


--
-- Name: accounts accounts_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT "accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: projects projects_assignedTo_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT "projects_assignedTo_fkey" FOREIGN KEY ("assignedTo") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: projects projects_clientId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT "projects_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES public.clients(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: quotation_items quotation_items_quotationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.quotation_items
    ADD CONSTRAINT "quotation_items_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES public.quotations(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: quotations quotations_clientId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.quotations
    ADD CONSTRAINT "quotations_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES public.clients(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: quotations quotations_createdBy_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.quotations
    ADD CONSTRAINT "quotations_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: quotations quotations_projectId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.quotations
    ADD CONSTRAINT "quotations_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES public.projects(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: sessions sessions_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: tasks tasks_projectId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT "tasks_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES public.projects(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict jpy5nT2tujQiOpzPfB7W76qnG9cgD7AeI1C1KMc3VEk6ArwgJv2PReVXUwMrqXX

