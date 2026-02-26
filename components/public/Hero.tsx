'use client'

import dynamic from 'next/dynamic'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { ArrowRight, Sparkles, Zap, Target, ChevronDown } from 'lucide-react'

// DotLottieReact soporta tanto .lottie como .json — solo cambia la extensión en HERO_ANIM_SRC
const DotLottieReact = dynamic(
  () => import('@lottiefiles/dotlottie-react').then((m) => m.DotLottieReact),
  { ssr: false, loading: () => null }
)

// ─── Ruta de la animación — cambia la extensión a .json si usas ese formato ──
const HERO_ANIM_SRC = '/animations/animation-3.json'

// ─── Variantes de animación ──────────────────────────────────────────────────
const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1]

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 32 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.65, delay, ease: EASE },
})

const features = [
  {
    icon: Zap,
    title: 'Desarrollo Ágil',
    description: 'Metodologías modernas para entrega rápida y eficiente',
  },
  {
    icon: Target,
    title: 'Soluciones Personalizadas',
    description: 'Adaptadas a las necesidades específicas de tu negocio',
  },
  {
    icon: Sparkles,
    title: 'Tecnología de Punta',
    description: 'Herramientas y frameworks más avanzados del mercado',
  },
]

export function Hero() {
  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden bg-black">

      {/* ── Lottie Background ─────────────────────────────────────────────── */}
      <div className="absolute inset-0 z-0 overflow-hidden">
        {/* Wrapper cover: centra y escala la animación para cubrir toda la sección
            sin deformarse, igual que object-fit: cover en imágenes/videos.
            Funciona con cualquier relación de aspecto 16:9. */}
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
          style={{
            width: 'max(100%, 177.78vh)',
            height: 'max(100%, 56.25vw)',
          }}
        >
          <DotLottieReact
            src={HERO_ANIM_SRC}
            loop
            autoplay
            style={{ width: '100%', height: '100%' }}
          />
        </div>

        {/* Overlay oscuro para legibilidad del texto */}
        <div className="absolute inset-0 bg-black/55" />

        {/* Viñeta lateral suave */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_50%,transparent_40%,rgba(0,0,0,0.6)_100%)]" />

        {/* Degradado inferior: funde el hero con la sección siguiente */}
        <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-gray-950 to-transparent" />
      </div>

      {/* ── Grid overlay sutil ───────────────────────────────────────────────── */}
      <div
        className="absolute inset-0 z-0 pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(rgba(139,92,246,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(139,92,246,0.04) 1px, transparent 1px)',
          backgroundSize: '64px 64px',
        }}
      />

      {/* ── Contenido ─────────────────────────────────────────────────────────── */}
      <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-28 flex flex-col items-center text-center">

        {/* Heading principal */}
        <motion.h1
          {...fadeUp(0.12)}
          className="text-4xl sm:text-6xl lg:text-6xl font-black leading-[0.88] tracking-tight mb-7"
        >
          <span className="text-white">Transformamos</span>
          <br />
          <span className="text-white">Ideas en </span>
          <br />
          <span className="text-5xl lg:text-7xl font-bold text-blue-400 animate-glow">Realidad</span>
        </motion.h1>

        {/* Descripción */}
        <motion.p
          {...fadeUp(0.22)}
          className="text-md sm:text-xl text-gray-400 max-w-2xl leading-relaxed mb-12"
        >
          Soluciones innovadoras en ingeniería y desarrollo de software
          para impulsar tu negocio al futuro. Experiencia, tecnología de punta y
          resultados garantizados.
        </motion.p>

        {/* CTAs */}
        <motion.div
          {...fadeUp(0.32)}
          className="flex flex-col sm:flex-row gap-4 justify-center"
        >
          <Link href="/contacto">
            <Button size="lg" variant="primary" className="hover-glow group">
              Comenzar Proyecto
              <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Button>
          </Link>
          <Link href="/soluciones">
            <Button size="lg" variant="outline">
              Ver Soluciones
            </Button>
          </Link>
        </motion.div>

        {/* Feature cards */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.55, ease: EASE }}
          className="mt-24 grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-4xl"
        >
          {features.map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.65 + index * 0.1, ease: EASE }}
              className="group relative p-6 rounded-2xl border border-white/8 bg-white/4 backdrop-blur-md hover:border-violet-500/50 hover:bg-white/7 transition-all duration-300"
            >
              {/* Glow en hover */}
              <div className="absolute inset-0 rounded-2xl bg-violet-500/0 group-hover:bg-violet-500/5 transition-colors duration-300 pointer-events-none" />

              <div className="w-10 h-10 rounded-xl bg-violet-500/15 flex items-center justify-center mb-4 mx-auto group-hover:bg-violet-500/25 transition-colors duration-300">
                <feature.icon className="w-5 h-5 text-violet-400" />
              </div>
              <h3 className="text-sm font-semibold text-gray-200 mb-2">
                {feature.title}
              </h3>
              <p className="text-xs text-gray-500 leading-relaxed">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </motion.div>
      </div>

      {/* ── Scroll indicator ──────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.6, duration: 0.8 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-1"
      >
        <span className="text-[10px] uppercase tracking-[0.2em] text-gray-600">Scroll</span>
        <motion.div
          animate={{ y: [0, 7, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        >
          <ChevronDown className="w-5 h-5 text-gray-600" />
        </motion.div>
      </motion.div>
    </section>
  )
}
