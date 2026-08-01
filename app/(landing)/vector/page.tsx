'use client'

import { useCallback, useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import './vector.css'

/** Lanzamiento: 1 de septiembre de 2026, medianoche hora de Colombia (UTC-5). */
const LAUNCH_DATE = new Date('2026-09-01T00:00:00-05:00')

interface TimeLeft {
  days: number
  hours: number
  minutes: number
  seconds: number
}

function getTimeLeft(): TimeLeft | null {
  const diff = LAUNCH_DATE.getTime() - Date.now()
  if (diff <= 0) return null
  return {
    days: Math.floor(diff / 86_400_000),
    hours: Math.floor((diff / 3_600_000) % 24),
    minutes: Math.floor((diff / 60_000) % 60),
    seconds: Math.floor((diff / 1000) % 60),
  }
}

const MODULES = [
  { t: 'Inventario + RFID', d: 'Cada equipo etiquetado y localizado. Entradas y salidas en segundos, sin planillas.' },
  { t: 'CRM', d: 'Contactos, leads y seguimiento comercial en un solo lugar.' },
  { t: 'Cotizaciones y facturas', d: 'Arma una cotización desde tu inventario real y expórtala en PDF.' },
  { t: 'Proyectos', d: 'Cada evento como un proyecto, con su equipo, fechas y presupuesto.' },
  { t: 'Calendario', d: 'Agenda de eventos y montajes, con la disponibilidad real de tus equipos.' },
  { t: 'Tareas Kanban', d: 'Reparte el trabajo del montaje y sigue el avance en un tablero.' },
  { t: 'Checklists', d: 'Listas de carga y verificación para que no se quede nada en bodega.' },
  { t: 'Reportes y analítica', d: 'Qué equipo rinde, qué cliente deja más y dónde se va el tiempo.' },
  { t: 'Catálogo de servicios', d: 'Tus servicios estandarizados y listos para cotizar.' },
  { t: 'Paquetes', d: 'Combos de equipo y servicio que se cotizan con un clic.' },
  { t: 'Terceros', d: 'Proveedores y subcontratistas, con su historial y sus costos.' },
  { t: 'Plantillas', d: 'Correos y PDF con tu marca, sin rearmarlos cada vez.' },
]

const PLANS = [
  { name: 'Starter', for: 'Empiezas', d: 'Lo esencial para ordenar inventario y clientes desde el primer día.' },
  { name: 'Business', for: 'Ya operas', d: 'Suma proyectos, calendario y cotizaciones para un equipo completo.' },
  { name: 'Audiovisual Pro', for: 'Productoras AV', d: 'El paquete pensado para audiovisuales: RFID, paquetes y reportes.', featured: true },
  { name: 'Wedding Suite', for: 'Bodas y social', d: 'Flujos y plantillas para quienes viven de eventos sociales.' },
  { name: 'Enterprise', for: 'Multi-sede', d: 'Varias sedes, permisos finos y acompañamiento dedicado.' },
]

export default function VectorPage() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [timeLeft, setTimeLeft] = useState<TimeLeft | null>(null)

  const [formSuccess, setFormSuccess] = useState(false)
  const [formErrors, setFormErrors] = useState<Record<string, boolean>>({})
  const [formSending, setFormSending] = useState(false)
  const [formApiError, setFormApiError] = useState('')

  const closeMenu = useCallback(() => setMenuOpen(false), [])

  /* Nav scroll */
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  /* Cuenta regresiva. Solo arranca tras montar para no romper la hidratación:
     el servidor y el cliente nunca calcularían el mismo segundo. */
  useEffect(() => {
    setMounted(true)
    setTimeLeft(getTimeLeft())
    const timer = setInterval(() => setTimeLeft(getTimeLeft()), 1000)
    return () => clearInterval(timer)
  }, [])

  /* Reveal on scroll */
  useEffect(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const els = Array.from(document.querySelectorAll('.reveal'))

    if (reduceMotion) {
      els.forEach((el) => el.classList.add('in'))
      return
    }

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('in')
            io.unobserve(entry.target)
          }
        })
      },
      { rootMargin: '0px 0px -12% 0px' }
    )

    els.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.currentTarget

    const getValue = (name: string) =>
      (form.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[name="${name}"]`)?.value ?? '').trim()

    const errors: Record<string, boolean> = {}
    if (getValue('name').length < 2) errors.name = true
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(getValue('email'))) errors.email = true
    setFormErrors(errors)
    if (Object.keys(errors).length) return

    setFormSending(true)
    setFormApiError('')
    try {
      const res = await fetch('/api/cotizacion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: getValue('name'),
          email: getValue('email'),
          phone: getValue('phone') || undefined,
          company: getValue('company') || undefined,
          message: getValue('message') || undefined,
          source: 'VECTOR',
        }),
      })
      if (res.ok) {
        setFormSuccess(true)
      } else {
        const body = await res.json().catch(() => null)
        setFormApiError(body?.error || 'No se pudo enviar. Intenta de nuevo.')
      }
    } catch {
      setFormApiError('Error de red. Intenta de nuevo.')
    } finally {
      setFormSending(false)
    }
  }

  const countCells = [
    { n: timeLeft?.days, l: 'Días' },
    { n: timeLeft?.hours, l: 'Horas' },
    { n: timeLeft?.minutes, l: 'Minutos' },
    { n: timeLeft?.seconds, l: 'Segundos' },
  ]

  return (
    <div className={`x-landing${menuOpen ? ' menu-open' : ''}`}>
      {/* NAV */}
      <nav className={`nav${scrolled ? ' scrolled' : ''}`}>
        <div className="wrap nav__inner">
          <Link href="/inicio" className="nav__logo" aria-label="Xenith inicio">
            <Image src="/images/logo.png" alt="Xenith" width={168} height={44} priority />
          </Link>
          <div className="nav__links">
            <a href="#problema">Por qué</a>
            <a href="#rfid">RFID</a>
            <a href="#modulos">Módulos</a>
            <a href="#planes">Planes</a>
          </div>
          <div className="nav__right">
            <Link href="/inicio" className="nav__login">
              ← Xenith
            </Link>
            <a href="#acceso" className="btn btn--primary">
              Acceso anticipado <span className="arrow">→</span>
            </a>
          </div>
          <button className="nav__toggle" aria-label="Menú" onClick={() => setMenuOpen((o) => !o)}>
            <span />
          </button>
        </div>
      </nav>

      {/* MOBILE MENU */}
      <div className="mobile-menu">
        <a href="#problema" onClick={closeMenu}>Por qué</a>
        <a href="#rfid" onClick={closeMenu}>RFID</a>
        <a href="#modulos" onClick={closeMenu}>Módulos</a>
        <a href="#planes" onClick={closeMenu}>Planes</a>
        <Link href="/inicio" className="nav__login" style={{ marginTop: 8 }} onClick={closeMenu}>
          ← Volver a Xenith
        </Link>
        <a href="#acceso" className="btn btn--primary btn--lg" onClick={closeMenu}>
          Acceso anticipado <span className="arrow">→</span>
        </a>
      </div>

      {/* HERO + COUNTDOWN */}
      <header className="vec-hero">
        <div className="vec-hero__bg" />
        <div className="vec-hero__grid" />
        <div className="wrap vec-hero__inner">
          <span className="vec-badge">
            <span className="vec-badge__dot" />
            En desarrollo · Lanza el 1 de septiembre
          </span>

          <h1 className="vec-wordmark">VECTOR</h1>
          <p className="vec-hero__tagline">
            El sistema operativo de las empresas audiovisuales
          </p>
          <p className="vec-hero__lead">
            Inventario, CRM, cotizaciones, proyectos y calendario en una sola plataforma.
            Y algo que nadie más te da: <strong style={{ color: 'var(--text)' }}>lectores RFID</strong> para
            que tu bodega se cuente sola.
          </p>

          <div className="vec-hero__cta">
            <a href="#acceso" className="btn btn--primary btn--lg">
              Reservar acceso anticipado <span className="arrow">→</span>
            </a>
            <a href="#modulos" className="btn btn--ghost btn--lg">
              Ver qué incluye
            </a>
          </div>

          {/* Cuenta regresiva */}
          <div className="vec-count">
            <p className="vec-count__label">
              {timeLeft ? 'Lanzamiento en' : 'Lanzamiento'}
            </p>

            {mounted && !timeLeft ? (
              <p className="vec-count__live">Ya está disponible</p>
            ) : (
              <div className="vec-count__grid">
                {countCells.map((c) => (
                  <div key={c.l} className="vec-count__cell">
                    {/* Antes de montar mostramos '--': el servidor no puede
                        conocer el segundo actual sin romper la hidratación. */}
                    <div className="vec-count__n">
                      {mounted && c.n !== undefined ? String(c.n).padStart(2, '0') : '--'}
                    </div>
                    <div className="vec-count__l">{c.l}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* PROBLEMA */}
      <section className="section" id="problema">
        <div className="wrap">
          <div className="section-head reveal" style={{ marginInline: 'auto', textAlign: 'center' }}>
            <span className="eyebrow eyebrow--center">El problema</span>
            <h2 className="h-section">Tu bodega no cabe en una hoja de cálculo</h2>
            <p className="lead" style={{ marginInline: 'auto' }}>
              Si alquilas equipo audiovisual, cada evento es una carrera contra el inventario.
              Vector existe para que dejes de correr.
            </p>
          </div>

          <div className="vec-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
            <div className="vec-pain vec-pain--bad reveal">
              <h4>Hoy</h4>
              <ul>
                {[
                  'Inventario en Excel que nadie actualiza a tiempo',
                  'Equipos que se pierden entre montaje y devolución',
                  'Cotizar toma horas porque hay que confirmar qué hay libre',
                  'Nadie sabe qué equipo rinde y cuál solo ocupa bodega',
                  'El historial del cliente vive en el WhatsApp de alguien',
                ].map((t) => (
                  <li key={t}>
                    <svg viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12" /></svg>
                    {t}
                  </li>
                ))}
              </ul>
            </div>

            <div className="vec-pain vec-pain--good reveal" data-delay="1">
              <h4>Con Vector</h4>
              <ul>
                {[
                  'Inventario que se actualiza solo al pasar el lector RFID',
                  'Cada equipo con su ubicación, estado y responsable',
                  'Cotizaciones armadas desde el stock realmente disponible',
                  'Reportes de rotación, ingresos y rentabilidad por equipo',
                  'Cliente, evento e historial en la misma ficha',
                ].map((t) => (
                  <li key={t}>
                    <svg viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5" /></svg>
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* RFID — el diferenciador */}
      <section className="section" id="rfid">
        <div className="wrap">
          <div className="section-head reveal" style={{ marginInline: 'auto', textAlign: 'center' }}>
            <span className="eyebrow eyebrow--center">Nuestro diferencial</span>
            <h2 className="h-section">Software y hardware, de la misma casa</h2>
            <p className="lead" style={{ marginInline: 'auto' }}>
              Los demás te venden un CRM y te dejan el inventario a mano. Nosotros te entregamos
              también los equipos RFID y los dejamos funcionando con Vector desde el primer día.
            </p>
          </div>

          <div className="vec-grid vec-grid--3">
            <div className="vec-hw reveal">
              <div className="vec-hw__ico">
                <svg viewBox="0 0 24 24">
                  <path d="M4 7h9l5 4v6h-5M4 7v10h5M9 17a2 2 0 1 0 4 0 2 2 0 0 0-4 0Z" />
                </svg>
              </div>
              <h3>Lectores de mano</h3>
              <p>
                Pistolas RFID para inventariar caja por caja sin abrirlas. Pasas el lector por el
                rack y sabes qué falta en segundos, no en horas.
              </p>
            </div>

            <div className="vec-hw reveal" data-delay="1">
              <div className="vec-hw__ico">
                <svg viewBox="0 0 24 24">
                  <path d="M12 20V10M8.5 6.5a5 5 0 0 1 7 0M5.5 3.5a9 9 0 0 1 13 0M12 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" />
                </svg>
              </div>
              <h3>Antenas de portal</h3>
              <p>
                Instaladas en la puerta de bodega. Todo lo que sale queda registrado automáticamente,
                y lo que vuelve también. Sin que nadie tenga que anotar nada.
              </p>
            </div>

            <div className="vec-hw reveal" data-delay="2">
              <div className="vec-hw__ico">
                <svg viewBox="0 0 24 24">
                  <path d="M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8Z" />
                  <path d="M7 12h.01M11 12h3M11 15h6" />
                </svg>
              </div>
              <h3>Tags para cada equipo</h3>
              <p>
                Etiquetas resistentes para cables, cases, luces y consolas. Una vez etiquetado,
                el equipo nunca vuelve a ser invisible para tu sistema.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CÓMO FUNCIONA */}
      <section className="section section--tight">
        <div className="wrap">
          <div className="section-head reveal" style={{ marginInline: 'auto', textAlign: 'center' }}>
            <span className="eyebrow eyebrow--center">Cómo funciona</span>
            <h2 className="h-section">Cuatro pasos y tu bodega se cuenta sola</h2>
          </div>

          <div className="vec-grid">
            {[
              { n: '01', t: 'Etiquetamos', d: 'Ponemos un tag RFID a cada equipo y lo damos de alta en Vector con su ficha.' },
              { n: '02', t: 'Escaneas', d: 'Pasas el lector o cruzas el portal. El movimiento queda registrado sin escribir nada.' },
              { n: '03', t: 'Cotizas', d: 'Armas la propuesta desde el equipo que de verdad está libre esa fecha.' },
              { n: '04', t: 'Analizas', d: 'Ves qué se alquila, qué se queda quieto y cuánto deja cada evento.' },
            ].map((s, i) => (
              <div key={s.n} className="vec-step reveal" data-delay={String(i)}>
                <div className="vec-step__n">{s.n}</div>
                <h4>{s.t}</h4>
                <p>{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* MÓDULOS */}
      <section className="section" id="modulos">
        <div className="wrap">
          <div className="section-head reveal" style={{ marginInline: 'auto', textAlign: 'center' }}>
            <span className="eyebrow eyebrow--center">Módulos</span>
            <h2 className="h-section">Todo lo que tu operación necesita</h2>
            <p className="lead" style={{ marginInline: 'auto' }}>
              Activa solo los módulos que uses. Vector crece contigo, no al revés.
            </p>
          </div>

          <div className="vec-grid">
            {MODULES.map((m, i) => (
              <div key={m.t} className="feature reveal" data-delay={String(i % 5)}>
                <h4>{m.t}</h4>
                <p>{m.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PLANES */}
      <section className="section section--tight" id="planes">
        <div className="wrap">
          <div className="section-head reveal" style={{ marginInline: 'auto', textAlign: 'center' }}>
            <span className="eyebrow eyebrow--center">Planes</span>
            <h2 className="h-section">Un plan para cada tamaño</h2>
            <p className="lead" style={{ marginInline: 'auto' }}>
              Los precios se anuncian el día del lanzamiento. Quien reserve acceso anticipado
              los conocerá primero.
            </p>
          </div>

          <div className="vec-grid">
            {PLANS.map((p, i) => (
              <div
                key={p.name}
                className={`vec-plan reveal${p.featured ? ' vec-plan--featured' : ''}`}
                data-delay={String(i % 5)}
              >
                <div className="vec-plan__name">{p.name}</div>
                <div className="vec-plan__for">{p.for}</div>
                <p>{p.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ACCESO ANTICIPADO */}
      <section className="section" id="acceso">
        <div className="wrap">
          <div className="vec-cta reveal">
            <span className="eyebrow eyebrow--center">Acceso anticipado</span>
            <h2 className="h-section" style={{ marginTop: 16 }}>
              Sé de los primeros en usar Vector
            </h2>
            <p className="lead" style={{ marginInline: 'auto', marginTop: 16 }}>
              Déjanos tus datos y te avisamos apenas abramos. Los primeros en la lista
              entran a la beta y conocen los precios antes que nadie.
            </p>

            {!formSuccess ? (
              <form className="vec-form" onSubmit={handleSubmit} noValidate>
                <div className="field--row">
                  <div className={`field${formErrors.name ? ' invalid' : ''}`}>
                    <label htmlFor="v-name">Nombre</label>
                    <input
                      id="v-name"
                      name="name"
                      type="text"
                      placeholder="Tu nombre"
                      onChange={() => setFormErrors((e) => ({ ...e, name: false }))}
                    />
                    <span className="err">Ingresa tu nombre.</span>
                  </div>
                  <div className={`field${formErrors.email ? ' invalid' : ''}`}>
                    <label htmlFor="v-email">Correo</label>
                    <input
                      id="v-email"
                      name="email"
                      type="email"
                      placeholder="tucorreo@empresa.com"
                      onChange={() => setFormErrors((e) => ({ ...e, email: false }))}
                    />
                    <span className="err">Ingresa un correo válido.</span>
                  </div>
                </div>

                <div className="field--row">
                  <div className="field">
                    <label htmlFor="v-phone">Teléfono</label>
                    <input id="v-phone" name="phone" type="tel" placeholder="+57 300 123 4567" />
                  </div>
                  <div className="field">
                    <label htmlFor="v-company">Empresa</label>
                    <input id="v-company" name="company" type="text" placeholder="Nombre de tu empresa" />
                  </div>
                </div>

                <div className="field">
                  <label htmlFor="v-msg">¿Qué necesitas resolver?</label>
                  <textarea
                    id="v-msg"
                    name="message"
                    placeholder="Cuántos equipos manejas, cuántos eventos al mes…"
                  />
                </div>

                {formApiError && (
                  <p style={{ color: '#ff7a86', fontSize: 13, margin: '0 0 4px' }}>{formApiError}</p>
                )}

                <button
                  type="submit"
                  className="btn btn--primary btn--lg"
                  disabled={formSending}
                  style={{ width: '100%', justifyContent: 'center', opacity: formSending ? 0.7 : 1 }}
                >
                  {formSending ? 'Enviando…' : <>Reservar mi lugar <span className="arrow">→</span></>}
                </button>

                <p className="vec-form__note">
                  Sin compromiso. Te escribimos solo para avisarte del lanzamiento.
                </p>
              </form>
            ) : (
              <div className="form-success show" style={{ maxWidth: 540, margin: '30px auto 0' }}>
                <div className="check">
                  <svg viewBox="0 0 24 24">
                    <path d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <h3 className="h-card" style={{ fontFamily: 'var(--font-display)' }}>
                    ¡Quedaste en la lista!
                  </h3>
                  <p className="muted">
                    Te escribiremos a tu correo apenas Vector esté disponible.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="footer">
        <div className="wrap">
          <div className="footer__top">
            <div className="footer__brand">
              <Image src="/images/logo.png" alt="Xenith" width={168} height={44} />
              <p>
                Vector es el producto de software de Xenith para empresas audiovisuales.
                Inventario con RFID, CRM y operación en una sola plataforma.
              </p>
            </div>
            <div className="footer__cols">
              <div className="footer__col">
                <h5>Vector</h5>
                <a href="#problema">Por qué Vector</a>
                <a href="#rfid">Hardware RFID</a>
                <a href="#modulos">Módulos</a>
                <a href="#planes">Planes</a>
              </div>
              <div className="footer__col">
                <h5>Xenith</h5>
                <Link href="/inicio">Inicio</Link>
                <Link href="/inicio#servicios">Servicios</Link>
                <Link href="/inicio#contacto">Contacto</Link>
              </div>
              <div className="footer__col">
                <h5>Contacto</h5>
                <a href="mailto:camilo.vargas@xenith.com.co">camilo.vargas@xenith.com.co</a>
              </div>
            </div>
          </div>
          <div className="footer__bottom">
            <span>© 2026 Xenith. Todos los derechos reservados.</span>
            <span>Bogotá · Colombia</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
