import { SolutionsGrid } from '@/components/public/SolutionsGrid'
import { ServicesCarousel } from '@/components/public/ServicesCarousel'
import { Button } from '@/components/ui/Button'
import { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Soluciones - XENITH',
  description: 'Descubre nuestras soluciones en ingeniería robótica, desarrollo de software, IoT, cloud computing y más.',
}

export default function SolucionesPage() {
  return (
    <div className="min-h-screen py-20">
      {/* Header */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-16">
        <div className="text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Nuestras <span className="text-gradient">Soluciones</span>
          </h1>
          <p className="text-xl text-gray-400 max-w-3xl mx-auto">
            Ofrecemos soluciones tecnológicas integrales adaptadas a las necesidades
            de tu negocio. Desde robótica industrial hasta desarrollo de software avanzado.
          </p>
        </div>
      </section>

      {/* Solutions Grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-20">
        <SolutionsGrid />
      </section>

      {/* Services Carousel */}
      <section className="border-t border-gray-800">
        <ServicesCarousel />
      </section>

      {/* CTA Section */}
      <section className="border-t border-gray-800 py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            ¿Listo para Comenzar tu Proyecto?
          </h2>
          <p className="text-gray-400 mb-8 max-w-2xl mx-auto">
            Contáctanos hoy y descubre cómo podemos ayudarte a transformar
            tus ideas en soluciones tecnológicas reales.
          </p>
          <Link href="/contacto">
            <Button size="lg" variant="primary" className="hover-glow group">
              Solicitar Cotización
              <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Process Section */}
      <section className="border-t border-gray-800 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Nuestro <span className="text-gradient">Proceso</span>
            </h2>
            <p className="text-gray-400 max-w-2xl mx-auto">
              Un enfoque estructurado para garantizar el éxito de cada proyecto
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {[
              {
                step: '01',
                title: 'Análisis',
                description: 'Evaluamos tus necesidades y objetivos de negocio',
              },
              {
                step: '02',
                title: 'Diseño',
                description: 'Creamos una solución personalizada y escalable',
              },
              {
                step: '03',
                title: 'Desarrollo',
                description: 'Implementamos con metodologías ágiles y modernas',
              },
              {
                step: '04',
                title: 'Soporte',
                description: 'Mantenimiento y mejora continua del sistema',
              },
            ].map((phase, index) => (
              <div key={index} className="relative">
                {index < 3 && (
                  <div className="hidden md:block absolute top-12 left-1/2 w-full h-0.5 bg-gradient-to-r from-violet-500 to-transparent" />
                )}
                <div className="glass p-6 rounded-xl text-center relative z-10">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center mx-auto mb-4 text-2xl font-bold">
                    {phase.step}
                  </div>
                  <h3 className="text-lg font-bold text-gray-200 mb-2">
                    {phase.title}
                  </h3>
                  <p className="text-sm text-gray-400">{phase.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
