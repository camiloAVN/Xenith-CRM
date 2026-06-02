'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import type { Metadata } from 'next'

export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [formSuccess, setFormSuccess] = useState(false)
  const [formErrors, setFormErrors] = useState<Record<string, boolean>>({})
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const heroRef = useRef<HTMLElement>(null)
  const cursorRef = useRef<HTMLDivElement>(null)
  const tiltRef = useRef<HTMLDivElement>(null)

  /* --- Nav scroll --- */
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  /* --- Reveal animations --- */
  useEffect(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const watched: { el: Element; done: boolean }[] = []

    const revealEl = (el: Element) => el.classList.add('in')

    document.querySelectorAll('.reveal').forEach(el => {
      if (reduceMotion) {
        el.classList.add('in')
      } else {
        watched.push({ el, done: false })
      }
    })

    document.querySelectorAll('.pstep').forEach(el => {
      watched.push({ el, done: false })
    })

    let ticking = false
    const check = () => {
      const vh = window.innerHeight
      for (const w of watched) {
        if (w.done) continue
        const r = w.el.getBoundingClientRect()
        if (r.height === 0 && r.width === 0) continue
        if (r.top < vh * 0.88 && r.bottom > 0) {
          w.done = true
          revealEl(w.el)
        }
      }
    }
    const requestCheck = () => {
      if (ticking) return
      ticking = true
      requestAnimationFrame(() => { check(); ticking = false })
    }
    window.addEventListener('scroll', requestCheck, { passive: true })
    window.addEventListener('resize', requestCheck)
    requestAnimationFrame(check)
    setTimeout(check, 300)
    return () => {
      window.removeEventListener('scroll', requestCheck)
      window.removeEventListener('resize', requestCheck)
    }
  }, [])

  /* --- Count-up --- */
  useEffect(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const animateCount = (el: Element) => {
      const dataText = el.getAttribute('data-text')
      if (dataText) { el.textContent = dataText; return }
      const target = parseFloat(el.getAttribute('data-count') || '0')
      const dec = parseInt(el.getAttribute('data-dec') || '0', 10)
      const prefix = el.getAttribute('data-prefix') || ''
      const suffix = el.getAttribute('data-suffix') || ''
      if (reduceMotion) { el.textContent = prefix + target.toFixed(dec) + suffix; return }
      const dur = 1400
      const start = performance.now()
      const frame = (now: number) => {
        const p = Math.min((now - start) / dur, 1)
        const eased = 1 - Math.pow(1 - p, 3)
        el.textContent = prefix + (target * eased).toFixed(dec) + suffix
        if (p < 1) requestAnimationFrame(frame)
        else el.textContent = prefix + target.toFixed(dec) + suffix
      }
      requestAnimationFrame(frame)
    }

    const watched: { el: Element; done: boolean }[] = []
    document.querySelectorAll('[data-count]').forEach(el => watched.push({ el, done: false }))

    let ticking = false
    const check = () => {
      const vh = window.innerHeight
      for (const w of watched) {
        if (w.done) continue
        const r = w.el.getBoundingClientRect()
        if (r.top < vh * 0.6 && r.bottom > 0) {
          w.done = true
          animateCount(w.el)
        }
      }
    }
    const requestCheck = () => {
      if (ticking) return
      ticking = true
      requestAnimationFrame(() => { check(); ticking = false })
    }
    window.addEventListener('scroll', requestCheck, { passive: true })
    requestAnimationFrame(check)
    return () => window.removeEventListener('scroll', requestCheck)
  }, [])

  /* --- Service card glow --- */
  useEffect(() => {
    const cards = document.querySelectorAll<HTMLElement>('.scard.interactive')
    const handlers: Array<{ el: HTMLElement; fn: (e: PointerEvent) => void }> = []
    cards.forEach(card => {
      const fn = (e: PointerEvent) => {
        const r = card.getBoundingClientRect()
        card.style.setProperty('--mx', ((e.clientX - r.left) / r.width) * 100 + '%')
        card.style.setProperty('--my', ((e.clientY - r.top) / r.height) * 100 + '%')
      }
      card.addEventListener('pointermove', fn as EventListener)
      handlers.push({ el: card, fn })
    })
    return () => handlers.forEach(({ el, fn }) => el.removeEventListener('pointermove', fn as EventListener))
  }, [])

  /* --- Hero cursor + tilt --- */
  useEffect(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const hero = heroRef.current
    const cursor = cursorRef.current
    const tilt = tiltRef.current
    if (!hero || !cursor || reduceMotion) return

    const onMove = (e: PointerEvent) => {
      const r = hero.getBoundingClientRect()
      cursor.style.left = e.clientX - r.left + 'px'
      cursor.style.top = e.clientY - r.top + 'px'
      cursor.style.opacity = '1'
      if (tilt) {
        const tx = (e.clientX - r.left) / r.width - 0.5
        const ty = (e.clientY - r.top) / r.height - 0.5
        tilt.style.transform = `perspective(1000px) rotateY(${tx * 6}deg) rotateX(${-ty * 6}deg)`
      }
    }
    const onLeave = () => {
      cursor.style.opacity = '0'
      if (tilt) tilt.style.transform = ''
    }
    hero.addEventListener('pointermove', onMove as EventListener)
    hero.addEventListener('pointerleave', onLeave)
    return () => {
      hero.removeEventListener('pointermove', onMove as EventListener)
      hero.removeEventListener('pointerleave', onLeave)
    }
  }, [])

  /* --- Canvas particles --- */
  useEffect(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const canvas = canvasRef.current
    if (!canvas || reduceMotion) return

    const ctx = canvas.getContext('2d')!
    let w = 0, h = 0, dpr = 1
    let particles: { x: number; y: number; vx: number; vy: number; r: number; a: number }[] = []
    let raf = 0
    let running = true

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      const rect = canvas.getBoundingClientRect()
      w = rect.width; h = rect.height
      canvas.width = w * dpr; canvas.height = h * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const count = Math.min(70, Math.floor((w * h) / 16000))
      particles = Array.from({ length: count }, () => ({
        x: Math.random() * w, y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.25, vy: (Math.random() - 0.5) * 0.25,
        r: Math.random() * 1.6 + 0.5, a: Math.random() * 0.5 + 0.2,
      }))
    }

    const draw = () => {
      if (!running) return
      ctx.clearRect(0, 0, w, h)
      const cr = 90, cg = 160, cb = 255
      const maxD = 130
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i]
        p.x += p.vx; p.y += p.vy
        if (p.x < 0 || p.x > w) p.vx *= -1
        if (p.y < 0 || p.y > h) p.vy *= -1
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(${cr},${cg},${cb},${p.a})`
        ctx.fill()
        for (let j = i + 1; j < particles.length; j++) {
          const q = particles[j]
          const dx = p.x - q.x, dy = p.y - q.y
          const d = Math.sqrt(dx * dx + dy * dy)
          if (d < maxD) {
            ctx.beginPath()
            ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y)
            ctx.strokeStyle = `rgba(${cr},${cg},${cb},${0.10 * (1 - d / maxD)})`
            ctx.lineWidth = 1; ctx.stroke()
          }
        }
      }
      raf = requestAnimationFrame(draw)
    }

    resize()
    draw()
    const onResize = () => { cancelAnimationFrame(raf); resize(); draw() }
    window.addEventListener('resize', onResize)
    return () => {
      running = false
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
    }
  }, [])

  /* --- Contact form --- */
  const validators: Record<string, (v: string) => boolean> = {
    name: v => v.trim().length >= 2,
    email: v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()),
    type: v => v.trim() !== '',
    message: v => v.trim().length >= 5,
  }

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.currentTarget
    const errors: Record<string, boolean> = {}
    let ok = true
    ;['name', 'email', 'type', 'message'].forEach(n => {
      const input = form.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(`[name="${n}"]`)
      if (input && !validators[n]?.(input.value)) {
        errors[n] = true
        ok = false
      }
    })
    setFormErrors(errors)
    if (ok) setFormSuccess(true)
  }

  const closeMenu = () => setMenuOpen(false)

  return (
    <div className={`x-landing${menuOpen ? ' menu-open' : ''}`}>
      {/* NAV */}
      <nav className={`nav${scrolled ? ' scrolled' : ''}`} id="nav">
        <div className="wrap nav__inner">
          <a href="#top" className="nav__logo" aria-label="Xenith inicio">
            <Image src="/images/xenith-logo-new.png" alt="Xenith" width={168} height={44} priority />
          </a>
          <div className="nav__links">
            <a href="#flagship">Bar Robótico</a>
            <a href="#servicios">Servicios</a>
            <a href="#proceso">Proceso</a>
            <a href="#galeria">Galería</a>
            <a href="#nosotros">Nosotros</a>
          </div>
          <div className="nav__right">
            <Link href="/login" className="nav__login">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3"/>
              </svg>
              Iniciar sesión
            </Link>
            <a href="#contacto" className="btn btn--primary">Solicitar cotización <span className="arrow">→</span></a>
          </div>
          <button
            className="nav__toggle"
            aria-label="Menú"
            onClick={() => setMenuOpen(o => !o)}
          >
            <span />
          </button>
        </div>
      </nav>

      {/* MOBILE MENU */}
      <div className="mobile-menu" id="mobileMenu">
        <a href="#flagship" onClick={closeMenu}>Bar Robótico</a>
        <a href="#servicios" onClick={closeMenu}>Servicios</a>
        <a href="#proceso" onClick={closeMenu}>Proceso</a>
        <a href="#galeria" onClick={closeMenu}>Galería</a>
        <a href="#nosotros" onClick={closeMenu}>Nosotros</a>
        <Link href="/login" className="nav__login" style={{ marginTop: 8 }} onClick={closeMenu}>
          Iniciar sesión
        </Link>
        <a href="#contacto" className="btn btn--primary btn--lg" onClick={closeMenu}>
          Solicitar cotización <span className="arrow">→</span>
        </a>
      </div>

      {/* HERO */}
      <header className="hero" id="top" ref={heroRef}>
        <div className="hero__bg">
          <div className="hero__grid" />
          <div className="hero__glow" />
          <canvas ref={canvasRef} id="hero-particles" />
          <div className="hero__cursor" ref={cursorRef} />
        </div>
        <div className="wrap hero__inner">
          <div className="hero__copy">
            <span className="eyebrow reveal">Xenith · Engineering Studio</span>
            <h1 className="h-display reveal" data-delay="1">
              <span className="word">Ingeniería</span>{' '}
              <span className="word">que</span>{' '}
              <span className="word">se</span>{' '}
              <span className="word">vuelve</span>{' '}
              <span className="word accent-text">espectáculo.</span>
            </h1>
            <p className="lead hero__sub reveal" data-delay="2">
              Diseñamos robótica, software e inteligencia artificial que convierten eventos y
              activaciones de marca en experiencias que nadie olvida. Nuestro{' '}
              <strong style={{ color: 'var(--text)' }}>bar robótico</strong> es apenas el comienzo.
            </p>
            <div className="hero__cta reveal" data-delay="3">
              <a href="#contacto" className="btn btn--primary btn--lg">
                Solicitar cotización <span className="arrow">→</span>
              </a>
              <a href="#flagship" className="btn btn--ghost btn--lg">Ver el bar robótico</a>
            </div>
            <div className="hero__meta reveal" data-delay="4">
              <div className="item">
                <span className="n" data-count="120" data-suffix="">0</span>
                <span className="l">Cócteles / hora</span>
              </div>
              <div className="item">
                <span className="n" data-count="0.1" data-prefix="±" data-suffix="mm" data-dec="1">0</span>
                <span className="l">Precisión</span>
              </div>
              <div className="item">
                <span className="n" data-count="360" data-suffix="°">0</span>
                <span className="l">Experiencia inmersiva</span>
              </div>
            </div>
          </div>

          <div className="hero__visual reveal" data-delay="2">
            <div className="hero__ring" />
            <div className="hero__frame hud" ref={tiltRef}>
              <div className="hero__hud-label hud-tl">
                <span className="dot" />XENITH · BARTENDER UNIT
              </div>
              <div className="hero__hud-label hud-br">STATUS: ONLINE</div>
              <div className="hero__scan" />
              <div className="hero__placeholder">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
                  <rect x="3" y="8" width="18" height="12" rx="2"/>
                  <path d="M8 8V6a4 4 0 0 1 8 0v2"/>
                  <circle cx="12" cy="14" r="2"/>
                </svg>
                <span>Bar Robótico</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* MARQUEE */}
      <div className="marquee" aria-hidden="true">
        <div className="marquee__track">
          {['Robótica','Inteligencia Artificial','Software a la medida','Experiencias Interactivas','Automatización','Activaciones de Marca',
            'Robótica','Inteligencia Artificial','Software a la medida','Experiencias Interactivas','Automatización','Activaciones de Marca']
            .map((item, i) => <span key={i} className="marquee__item">{item}</span>)}
        </div>
      </div>

      {/* FLAGSHIP */}
      <section className="section flagship" id="flagship">
        <div className="wrap">
          <div className="flagship__grid">
            <div className="flagship__visual reveal">
              <div className="flagship__frame hud">
                <div className="hero__hud-label hud-tl"><span className="dot" />LIVE MIX</div>
                <div className="hero__scan" />
                <div className="hero__placeholder">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
                    <path d="M6 20v-6M6 14a3 3 0 0 1 3-3h2M18 4v8a2 2 0 0 1-2 2h-5"/>
                    <circle cx="6" cy="20" r="1.5"/>
                    <rect x="15" y="2" width="6" height="4" rx="1"/>
                  </svg>
                  <span>Brazo Robótico</span>
                </div>
              </div>
            </div>
            <div className="flagship__copy">
              <span className="eyebrow reveal">Producto estrella</span>
              <h2 className="h-section reveal" data-delay="1" style={{ marginTop: 16 }}>
                Tu bartender<br />es un robot.
              </h2>
              <p className="lead reveal" data-delay="2" style={{ marginTop: 18 }}>
                Un brazo robótico de grado industrial que prepara cócteles con precisión milimétrica
                mientras convierte cada trago en un show de movimiento, luz y tecnología. Los invitados
                piden desde una pantalla, lo ven actuar y reciben una experiencia que se vuelve el centro del evento.
              </p>
              <div className="flagship__features">
                {[
                  { title: 'Precisión milimétrica', desc: 'Servidos consistentes, dosificación exacta y cero desperdicio en cada preparación.', delay: 1,
                    icon: <path d="M12 2v4M12 18v4M2 12h4M18 12h4M5 5l3 3M16 16l3 3M19 5l-3 3M8 16l-3 3" /> },
                  { title: 'Menú por pantalla', desc: 'Los invitados eligen y personalizan su trago desde una interfaz táctil intuitiva.', delay: 2,
                    icon: <><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M9 9h6M9 13h6M9 17h3"/></> },
                  { title: 'Show en vivo', desc: 'Coreografía de movimientos, luces sincronizadas y branding personalizable.', delay: 3,
                    icon: <path d="M12 2l2.4 5.6L20 9l-4.5 3.8L17 19l-5-3-5 3 1.5-6.2L4 9l5.6-1.4z" /> },
                  { title: 'Marca + datos', desc: 'Personaliza la experiencia con tu marca y captura datos de cada interacción.', delay: 4,
                    icon: <path d="M3 12h4l2-7 4 14 2-7h6" /> },
                ].map((f, i) => (
                  <div key={i} className="feature reveal" data-delay={String(f.delay)}>
                    <div className="ico">
                      <svg viewBox="0 0 24 24">{f.icon}</svg>
                    </div>
                    <h4>{f.title}</h4>
                    <p>{f.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SERVICES */}
      <section className="section section--tight" id="servicios">
        <div className="wrap">
          <div className="section-head reveal">
            <span className="eyebrow">Qué hacemos</span>
            <h2 className="h-section">Soluciones de ingeniería,<br />de extremo a extremo.</h2>
            <p className="lead">Combinamos hardware, software e IA para resolver problemas reales y crear experiencias memorables. Empezamos en entretenimiento — pero la ingeniería no tiene límites.</p>
          </div>
          <div className="services__grid">
            {[
              { num: '/ 01', title: 'Bar Robótico', desc: 'Nuestro brazo robótico bartender: un imán de miradas que sirve, entretiene y deja a todos hablando del evento.', feature: true, delay: 1,
                icon: <><path d="M6 20v-6M6 14a3 3 0 0 1 3-3h2M18 4v8a2 2 0 0 1-2 2h-5"/><circle cx="6" cy="20" r="1.5"/><rect x="15" y="2" width="6" height="4" rx="1"/></> },
              { num: '/ 02', title: 'Experiencias Interactivas', desc: 'Instalaciones, pantallas táctiles, realidad aumentada y juegos que ponen al público en el centro.', delay: 2,
                icon: <><rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M12 17v4"/><circle cx="9" cy="10.5" r="1.5"/><circle cx="15" cy="10.5" r="1.5"/></> },
              { num: '/ 03', title: 'Software a la Medida', desc: 'Aplicaciones web, móviles y de control diseñadas alrededor de tu operación, no al revés.', delay: 3,
                icon: <path d="M8 8l-4 4 4 4M16 8l4 4-4 4M14 5l-4 14" /> },
              { num: '/ 04', title: 'Inteligencia Artificial', desc: 'Visión por computadora, modelos a medida y automatización inteligente integrada a tu producto.', delay: 1,
                icon: <><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"/></> },
              { num: '/ 05', title: 'Robótica & Automatización', desc: 'Diseñamos, programamos e integramos sistemas robóticos para entretenimiento e industria.', delay: 2,
                icon: <><rect x="5" y="9" width="14" height="10" rx="2"/><path d="M12 9V5M9 5h6M9 14h.01M15 14h.01"/></> },
              { num: '/ 06', title: 'Activaciones de Marca', desc: 'Experiencias llave en mano que hacen brillar tu marca en ferias, lanzamientos y eventos.', delay: 3,
                icon: <path d="M12 2l9 4-9 4-9-4 9-4zM3 12l9 4 9-4M3 17l9 4 9-4" /> },
            ].map((s, i) => (
              <article key={i} className={`scard${s.feature ? ' scard--feature' : ''} reveal interactive`} data-delay={String(s.delay)}>
                {s.feature && <span className="scard__flag">Estrella</span>}
                <span className="scard__num">{s.num}</span>
                <div className="scard__ico">
                  <svg viewBox="0 0 24 24">{s.icon}</svg>
                </div>
                <h3>{s.title}</h3>
                <p>{s.desc}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* PROCESS */}
      <section className="section" id="proceso">
        <div className="wrap">
          <div className="section-head reveal">
            <span className="eyebrow">Cómo trabajamos</span>
            <h2 className="h-section">De la idea al show,<br />en cuatro fases.</h2>
          </div>
          <div className="process__grid">
            {[
              { n: '/ 01', title: 'Descubrimos', desc: 'Entendemos tu visión, tu público y tus objetivos. Definimos qué hará que la experiencia sea inolvidable.', delay: 1 },
              { n: '/ 02', title: 'Diseñamos', desc: 'Concepto, ingeniería y prototipo. Combinamos hardware, software e IA en una solución a tu medida.', delay: 2 },
              { n: '/ 03', title: 'Construimos', desc: 'Desarrollo, integración y pruebas rigurosas. Iteramos hasta que cada detalle funcione perfecto.', delay: 3 },
              { n: '/ 04', title: 'Desplegamos', desc: 'Montaje, operación en sitio y soporte. Llevamos la experiencia a tu evento sin que te preocupes por nada.', delay: 4 },
            ].map((s, i) => (
              <div key={i} className="pstep reveal" data-delay={String(s.delay)}>
                <div className="pstep__n">{s.n}</div>
                <div className="pstep__dot" />
                <h3>{s.title}</h3>
                <p>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* GALLERY */}
      <section className="section section--tight" id="galeria">
        <div className="wrap">
          <div className="section-head reveal">
            <span className="eyebrow">En acción</span>
            <h2 className="h-section">Momentos que creamos.</h2>
            <p className="lead">Nuestra galería de proyectos y eventos donde la ingeniería se convierte en espectáculo.</p>
          </div>
          <div className="gallery__grid reveal">
            <div className="gitem gitem--xl">
              <div className="hero__placeholder gitem__placeholder">Evento principal</div>
              <span className="gitem__cap">Evento principal</span>
            </div>
            <div className="gitem"><div className="gitem__placeholder">Foto</div></div>
            <div className="gitem"><div className="gitem__placeholder">Foto</div></div>
            <div className="gitem gitem--w">
              <div className="gitem__placeholder">Foto panorámica</div>
              <span className="gitem__cap">Activación de marca</span>
            </div>
            <div className="gitem"><div className="gitem__placeholder">Foto</div></div>
            <div className="gitem"><div className="gitem__placeholder">Foto</div></div>
            <div className="gitem gitem--w">
              <div className="gitem__placeholder">Foto panorámica</div>
              <span className="gitem__cap">Detalle del robot</span>
            </div>
          </div>
        </div>
      </section>

      {/* ABOUT */}
      <section className="section" id="nosotros">
        <div className="wrap">
          <div className="about__grid">
            <div>
              <span className="eyebrow reveal">Sobre Xenith</span>
              <h2 className="h-section reveal" data-delay="1" style={{ marginTop: 16 }}>
                Ingenieros obsesionados<br />con el &quot;wow&quot;.
              </h2>
              <p className="lead reveal" data-delay="2" style={{ marginTop: 20 }}>
                Somos un estudio de ingeniería que une robótica, software e inteligencia artificial para
                crear cosas que antes no existían. Nacimos en el entretenimiento porque ahí la ingeniería
                se siente, se vive y se comparte — pero resolvemos cualquier reto técnico que te imagines.
              </p>
              <div className="about__values">
                {[
                  { k: '/ 01', title: 'Hecho a la medida', desc: 'Nada de plantillas. Cada proyecto se diseña desde cero para tu objetivo.', delay: 1 },
                  { k: '/ 02', title: 'Tecnología con propósito', desc: 'Usamos lo último en robótica e IA solo cuando hace mejor la experiencia.', delay: 2 },
                  { k: '/ 03', title: 'De principio a fin', desc: 'Concepto, ingeniería, operación y soporte. Un solo equipo, cero dolores de cabeza.', delay: 3 },
                ].map((v, i) => (
                  <div key={i} className="value reveal" data-delay={String(v.delay)}>
                    <span className="k">{v.k}</span>
                    <div className="v">
                      <h4>{v.title}</h4>
                      <p>{v.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="about__stats reveal" data-delay="2">
              <div className="stat">
                <div className="n" data-count="100" data-suffix="%">0</div>
                <div className="l">Soluciones a la medida</div>
              </div>
              <div className="stat">
                <div className="n" data-count="4" data-suffix="">0</div>
                <div className="l">Disciplinas integradas</div>
              </div>
              <div className="stat">
                <div className="n" data-count="24" data-suffix="/7">0</div>
                <div className="l">Soporte en sitio</div>
              </div>
              <div className="stat">
                <div className="n" data-text="∞">0</div>
                <div className="l">Ideas por construir</div>
              </div>
            </div>
          </div>

          {/* ── EQUIPO ── */}
          <div className="team__header section-head reveal" style={{ marginBottom: 0 }}>
            <span className="eyebrow">El equipo</span>
            <h2 className="h-section" style={{ marginTop: 16 }}>Las personas detrás<br />de la ingeniería.</h2>
          </div>
          <div className="team__grid">
            {[
              { slug: 'ceo', role: 'CEO', roleLabel: 'Chief Executive Officer', initial: 'C',
                tagline: 'Visionario estratégico que lidera la transformación tecnológica de Xenith.' },
              { slug: 'cto', role: 'CTO', roleLabel: 'Chief Technology Officer', initial: 'C',
                tagline: 'Arquitecto de soluciones tecnológicas que define el rumbo técnico de Xenith.' },
              { slug: 'vpe', role: 'VP Eng', roleLabel: 'VP of Engineering', initial: 'V',
                tagline: 'Líder de ingeniería que convierte la visión técnica en sistemas robustos.' },
            ].map((m, i) => (
              <div key={m.slug} className="tcard reveal" data-delay={String(i + 1)}>
                <div className="tcard__head">
                  <div className="tcard__avatar">{m.initial}</div>
                  <div className="tcard__identity">
                    <span className="tcard__role">{m.role}</span>
                    <div className="tcard__name">Nombre Apellido</div>
                    <div className="tcard__title">{m.roleLabel}</div>
                  </div>
                </div>
                <div className="tcard__body">
                  <p className="tcard__tagline">{m.tagline}</p>
                </div>
                <div className="tcard__footer">
                  <div className="tcard__socials">
                    {/* LinkedIn */}
                    <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer" className="tcard__social" aria-label="LinkedIn">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/></svg>
                    </a>
                    {/* Email */}
                    <a href="mailto:camilo.vargas@xenith.com.co" className="tcard__social" aria-label="Email">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>
                    </a>
                  </div>
                  <Link href={`/equipo/${m.slug}`} className="tcard__link">
                    Ver perfil <span>→</span>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CONTACT */}
      <section className="section" id="contacto">
        <div className="wrap contact">
          <div className="contact__card reveal">
            <aside className="contact__aside">
              <span className="eyebrow">Hablemos</span>
              <h2 className="h-section">¿Listo para sorprender?</h2>
              <p className="muted">
                Cuéntanos qué tienes en mente. Te respondemos con una propuesta a la medida —
                desde un bar robótico hasta una solución de software completa.
              </p>
              <a href="mailto:camilo.vargas@xenith.com.co" className="contact__mail">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <rect x="3" y="5" width="18" height="14" rx="2"/>
                  <path d="M3 7l9 6 9-6"/>
                </svg>
                camilo.vargas@xenith.com.co
              </a>

              {/* Team links */}
              <div className="contact__team">
                <p className="contact__team-label">Habla directamente con el equipo</p>
                <div className="contact__team-btns">
                  {[
                    { slug: 'ceo', role: 'CEO', roleLabel: 'Chief Executive Officer', initial: 'C' },
                    { slug: 'cto', role: 'CTO', roleLabel: 'Chief Technology Officer', initial: 'C' },
                    { slug: 'vpe', role: 'VP Eng', roleLabel: 'VP of Engineering', initial: 'V' },
                  ].map(m => (
                    <Link key={m.slug} href={`/equipo/${m.slug}`} className="contact__team-btn">
                      <div className="contact__team-btn-avatar">{m.initial}</div>
                      <div className="contact__team-btn-info">
                        <div className="contact__team-btn-name">Nombre Apellido</div>
                        <div className="contact__team-btn-role">{m.roleLabel}</div>
                      </div>
                      <span className="contact__team-btn-arrow">→</span>
                    </Link>
                  ))}
                </div>
              </div>
            </aside>
            <form className="contact__form" onSubmit={handleSubmit} noValidate>
              {!formSuccess ? (
                <>
                  <div className="field--row">
                    <div className={`field${formErrors.name ? ' invalid' : ''}`}>
                      <label htmlFor="f-name">Nombre</label>
                      <input id="f-name" name="name" type="text" placeholder="Tu nombre" required
                        onChange={() => setFormErrors(e => ({ ...e, name: false }))} />
                      <span className="err">Ingresa tu nombre.</span>
                    </div>
                    <div className={`field${formErrors.email ? ' invalid' : ''}`}>
                      <label htmlFor="f-email">Correo</label>
                      <input id="f-email" name="email" type="email" placeholder="tucorreo@empresa.com" required
                        onChange={() => setFormErrors(e => ({ ...e, email: false }))} />
                      <span className="err">Ingresa un correo válido.</span>
                    </div>
                  </div>
                  <div className="field--row">
                    <div className="field">
                      <label htmlFor="f-company">Empresa</label>
                      <input id="f-company" name="company" type="text" placeholder="Nombre de tu empresa" />
                    </div>
                    <div className={`field${formErrors.type ? ' invalid' : ''}`}>
                      <label htmlFor="f-type">Tipo de proyecto</label>
                      <select id="f-type" name="type" required defaultValue=""
                        onChange={() => setFormErrors(e => ({ ...e, type: false }))}>
                        <option value="" disabled>Selecciona…</option>
                        <option>Bar robótico para evento</option>
                        <option>Experiencia / activación de marca</option>
                        <option>Software a la medida</option>
                        <option>Inteligencia artificial</option>
                        <option>Robótica / automatización</option>
                        <option>Otro</option>
                      </select>
                      <span className="err">Selecciona una opción.</span>
                    </div>
                  </div>
                  <div className={`field${formErrors.message ? ' invalid' : ''}`}>
                    <label htmlFor="f-msg">Mensaje</label>
                    <textarea id="f-msg" name="message" placeholder="Cuéntanos sobre tu evento o proyecto…" required
                      onChange={() => setFormErrors(e => ({ ...e, message: false }))} />
                    <span className="err">Escribe un mensaje.</span>
                  </div>
                  <button type="submit" className="btn btn--primary btn--lg">
                    Enviar solicitud <span className="arrow">→</span>
                  </button>
                </>
              ) : (
                <div className="form-success show">
                  <div className="check">
                    <svg viewBox="0 0 24 24">
                      <path d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="h-card" style={{ fontFamily: 'var(--font-display)' }}>¡Mensaje recibido!</h3>
                    <p className="muted">Gracias por escribirnos. Te contactaremos muy pronto a tu correo.</p>
                  </div>
                </div>
              )}
            </form>
          </div>
        </div>
      </section>

      {/* CTA STRIP */}
      <section className="section section--tight ctastrip">
        <div className="wrap">
          <div className="ctastrip__inner reveal">
            <span className="eyebrow eyebrow--center">Xenith</span>
            <h2 className="h-section">El futuro se sirve aquí.</h2>
            <a href="#contacto" className="btn btn--primary btn--lg">
              Solicitar cotización <span className="arrow">→</span>
            </a>
            {/* Team mini-links */}
            <div style={{ marginTop: 32, display: 'flex', alignItems: 'center', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--text-faint)' }}>
                Conoce al equipo
              </span>
              {[
                { slug: 'ceo', label: 'CEO' },
                { slug: 'cto', label: 'CTO' },
                { slug: 'vpe', label: 'VP Engineering' },
              ].map(m => (
                <Link
                  key={m.slug}
                  href={`/equipo/${m.slug}`}
                  style={{
                    fontFamily: 'var(--font-mono)', fontSize: 12, letterSpacing: '.1em',
                    padding: '6px 14px', borderRadius: 8, border: '1px solid var(--border-2)',
                    color: 'var(--text-dim)', background: 'rgba(255,255,255,.03)',
                    transition: 'all .25s', textDecoration: 'none', display: 'inline-block',
                  }}
                >
                  {m.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="footer">
        <div className="wrap">
          <div className="footer__top">
            <div className="footer__brand">
              <Image src="/images/xenith-logo-new.png" alt="Xenith" width={168} height={44} />
              <p>Estudio de ingeniería en robótica, software e inteligencia artificial. Experiencias que la gente recuerda.</p>
            </div>
            <div className="footer__cols">
              <div className="footer__col">
                <h5>Producto</h5>
                <a href="#flagship">Bar Robótico</a>
                <a href="#servicios">Servicios</a>
                <a href="#proceso">Proceso</a>
              </div>
              <div className="footer__col">
                <h5>Empresa</h5>
                <a href="#nosotros">Nosotros</a>
                <a href="#galeria">Galería</a>
                <a href="#contacto">Contacto</a>
              </div>
              <div className="footer__col">
                <h5>Equipo</h5>
                <Link href="/equipo/ceo">CEO</Link>
                <Link href="/equipo/cto">CTO</Link>
                <Link href="/equipo/vpe">VP Engineering</Link>
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
