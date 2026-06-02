'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Image from 'next/image'
import { ChevronLeft, ChevronRight, ImageIcon } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

interface Service {
  title: string
  src: string
  tag: string
}

const services: Service[] = [
  {
    title: 'Bar Robotizado',
    src: '/images/servicios/bar-robotizado-2.jpeg',
    tag: 'Robótica',
  },
  {
    title: 'Sistema de Conteo de Personas con IA',
    src: '/images/servicios/conteo-personas-2.jpeg',
    tag: 'Inteligencia Artificial',
  },
  {
    title: 'Sistema de Control de Inventarios y CRM',
    src: '/images/servicios/inventarios-crm.jpeg',
    tag: 'Software a Medida',
  },
  {
    title: 'Automatización Industrial',
    src: '/images/servicios/automatizacion-industrial.jpeg',
    tag: 'Automatización',
  },
]

export function ServicesCarousel() {
  const [current, setCurrent] = useState(0)
  const [prev, setPrev] = useState<number | null>(null)
  const [direction, setDirection] = useState<'next' | 'prev'>('next')
  const [animating, setAnimating] = useState(false)
  const [errorImages, setErrorImages] = useState<Set<number>>(new Set())
  const [paused, setPaused] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const goTo = useCallback(
    (index: number, dir: 'next' | 'prev') => {
      if (animating) return
      setDirection(dir)
      setPrev(current)
      setCurrent(index)
      setAnimating(true)
    },
    [animating, current]
  )

  const next = useCallback(() => {
    goTo((current + 1) % services.length, 'next')
  }, [current, goTo])

  const prev_ = useCallback(() => {
    goTo((current - 1 + services.length) % services.length, 'prev')
  }, [current, goTo])

  // Auto-play
  useEffect(() => {
    if (paused) return
    timerRef.current = setTimeout(next, 5000)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [current, paused, next])

  // Clear prev after transition ends
  useEffect(() => {
    if (!animating) return
    const t = setTimeout(() => {
      setPrev(null)
      setAnimating(false)
    }, 600)
    return () => clearTimeout(t)
  }, [animating])

  const slideOut = direction === 'next' ? '-translate-x-full' : 'translate-x-full'

  return (
    <section className="py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Servicios <span className="text-gradient">Insignia</span>
          </h2>
          <p className="text-gray-400 max-w-2xl mx-auto">
            Las soluciones más avanzadas que hemos desarrollado para nuestros clientes
          </p>
        </div>

        {/* Carousel */}
        <div
          className="relative rounded-2xl overflow-hidden"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
        >
          {/* Aspect ratio wrapper */}
          <div className="relative w-full" style={{ aspectRatio: '16/7' }}>

            {/* Slides */}
            {services.map((service, i) => {
              const isActive = i === current
              const isPrev = i === prev

              if (!isActive && !isPrev) return null

              return (
                <div
                  key={i}
                  className={cn(
                    'absolute inset-0 transition-transform duration-[600ms] ease-in-out will-change-transform',
                    isActive && animating && `translate-x-0 animate-none`,
                    isActive && !animating && 'translate-x-0',
                    isPrev && animating && slideOut,
                    isPrev && !animating && 'translate-x-0',
                  )}
                  style={
                    isActive && animating
                      ? { animation: `slideIn${direction === 'next' ? 'Right' : 'Left'} 600ms ease-in-out forwards` }
                      : undefined
                  }
                >
                  {/* Background: image or fallback */}
                  {errorImages.has(i) ? (
                    <div className="absolute inset-0 bg-gradient-to-br from-gray-800 via-gray-900 to-gray-800 flex flex-col items-center justify-center gap-4">
                      <div className="relative">
                        <div className="absolute inset-0 bg-violet-500/20 blur-2xl rounded-full" />
                        <ImageIcon className="w-16 h-16 text-gray-600 relative z-10" />
                      </div>
                      <span className="text-gray-500 text-sm font-medium">{service.title}</span>
                    </div>
                  ) : (
                    <Image
                      src={service.src}
                      alt={service.title}
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 100vw, 1280px"
                      priority={i === 0}
                      onError={() => setErrorImages((s) => new Set(s).add(i))}
                    />
                  )}

                  {/* Dark gradient overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/10" />

                  {/* Slide content */}
                  <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-10">
                    <span className="inline-block text-xs font-semibold uppercase tracking-widest text-violet-400 bg-violet-500/10 border border-violet-500/20 px-3 py-1 rounded-full mb-3">
                      {service.tag}
                    </span>
                    <h3 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white leading-tight max-w-2xl">
                      {service.title}
                    </h3>
                  </div>
                </div>
              )
            })}

            {/* Arrow: prev */}
            <button
              onClick={prev_}
              aria-label="Anterior"
              className={cn(
                'absolute left-4 top-1/2 -translate-y-1/2 z-20',
                'w-10 h-10 sm:w-12 sm:h-12 rounded-full',
                'bg-black/40 hover:bg-black/70 backdrop-blur-sm',
                'border border-white/10 hover:border-white/30',
                'flex items-center justify-center',
                'text-white transition-all duration-200',
                'hover:scale-110 active:scale-95'
              )}
            >
              <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>

            {/* Arrow: next */}
            <button
              onClick={next}
              aria-label="Siguiente"
              className={cn(
                'absolute right-4 top-1/2 -translate-y-1/2 z-20',
                'w-10 h-10 sm:w-12 sm:h-12 rounded-full',
                'bg-black/40 hover:bg-black/70 backdrop-blur-sm',
                'border border-white/10 hover:border-white/30',
                'flex items-center justify-center',
                'text-white transition-all duration-200',
                'hover:scale-110 active:scale-95'
              )}
            >
              <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>

            {/* Progress bar */}
            {!paused && (
              <div className="absolute top-0 left-0 right-0 h-0.5 z-20 bg-white/10">
                <div
                  key={`${current}-progress`}
                  className="h-full bg-violet-500 origin-left"
                  style={{ animation: 'progressBar 5s linear forwards' }}
                />
              </div>
            )}
          </div>

          {/* Dots + counter */}
          <div className="flex items-center justify-between px-4 sm:px-6 py-4 bg-gray-900/80 backdrop-blur-sm border-t border-gray-800">
            {/* Dots */}
            <div className="flex items-center gap-2">
              {services.map((_, i) => (
                <button
                  key={i}
                  onClick={() => goTo(i, i > current ? 'next' : 'prev')}
                  aria-label={`Ir al servicio ${i + 1}`}
                  className={cn(
                    'rounded-full transition-all duration-300',
                    i === current
                      ? 'w-6 h-2 bg-violet-500'
                      : 'w-2 h-2 bg-gray-600 hover:bg-gray-400'
                  )}
                />
              ))}
            </div>

            {/* Counter */}
            <span className="text-xs text-gray-500 font-mono tabular-nums">
              {String(current + 1).padStart(2, '0')} / {String(services.length).padStart(2, '0')}
            </span>
          </div>
        </div>

        {/* Bottom accent */}
        <div className="mt-12 flex justify-center">
          <div className="h-1 w-32 bg-gradient-to-r from-transparent via-violet-500 to-transparent rounded-full" />
        </div>
      </div>

      {/* Keyframe animations via style tag */}
      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to   { transform: translateX(0); }
        }
        @keyframes slideInLeft {
          from { transform: translateX(-100%); }
          to   { transform: translateX(0); }
        }
        @keyframes progressBar {
          from { transform: scaleX(0); }
          to   { transform: scaleX(1); }
        }
      `}</style>
    </section>
  )
}
