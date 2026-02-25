import { ContactForm } from '@/components/forms/ContactForm'
import { Card } from '@/components/ui/Card'
import { Metadata } from 'next'
import { Mail, Phone, MapPin, Clock } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Contacto - XENITH',
  description: 'Contáctanos para discutir tu proyecto. Estamos listos para ayudarte a transformar tus ideas en realidad.',
}

export default function ContactoPage() {
  const contactInfo = [
    {
      icon: Mail,
      title: 'Email',
      value: 'contacto@xenith.com',
      link: 'mailto:contacto@xenith.com',
    },
    {
      icon: Phone,
      title: 'Teléfono',
      value: '+52 (123) 456-7890',
      link: 'tel:+521234567890',
    },
    {
      icon: MapPin,
      title: 'Ubicación',
      value: 'Bogota, Colombia',
      link: null,
    },
    {
      icon: Clock,
      title: 'Horario',
      value: 'Lun - Vie: 9:00 - 18:00',
      link: null,
    },
  ]

  return (
    <div className="min-h-screen py-20">
      {/* Header */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-16">
        <div className="text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Contáctanos
          </h1>
          <p className="text-xl text-gray-400 max-w-3xl mx-auto">
            ¿Tienes un proyecto en mente? Estamos aquí para ayudarte.
            Completa el formulario y nos pondremos en contacto contigo pronto.
          </p>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Contact Information */}
          <div className="lg:col-span-1 space-y-6">
            <Card variant="glass">
              <h2 className="text-2xl font-bold mb-6">
                Información de <span className="text-gradient">Contacto</span>
              </h2>

              <div className="space-y-6">
                {contactInfo.map((info, index) => (
                  <div key={index} className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-lg bg-violet-500/10 flex items-center justify-center flex-shrink-0">
                      <info.icon className="w-5 h-5 text-violet-400" />
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-gray-400 mb-1">
                        {info.title}
                      </h3>
                      {info.link ? (
                        <a
                          href={info.link}
                          className="text-gray-200 hover:text-violet-400 transition-colors"
                        >
                          {info.value}
                        </a>
                      ) : (
                        <p className="text-gray-200">{info.value}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Additional Info Card */}
            <Card variant="gradient" className="border-violet-500/20">
              <h3 className="text-lg font-bold mb-3">¿Por qué elegirnos?</h3>
              <ul className="space-y-2 text-sm text-gray-300">
                <li className="flex items-start">
                  <span className="w-1.5 h-1.5 bg-violet-400 rounded-full mr-2 mt-1.5 flex-shrink-0" />
                  <span>Respuesta en menos de 24 horas</span>
                </li>
                <li className="flex items-start">
                  <span className="w-1.5 h-1.5 bg-violet-400 rounded-full mr-2 mt-1.5 flex-shrink-0" />
                  <span>Consultoría inicial gratuita</span>
                </li>
                <li className="flex items-start">
                  <span className="w-1.5 h-1.5 bg-violet-400 rounded-full mr-2 mt-1.5 flex-shrink-0" />
                  <span>Cotización sin compromiso</span>
                </li>
                <li className="flex items-start">
                  <span className="w-1.5 h-1.5 bg-violet-400 rounded-full mr-2 mt-1.5 flex-shrink-0" />
                  <span>Equipo experto y certificado</span>
                </li>
              </ul>
            </Card>
          </div>

          {/* Contact Form */}
          <div className="lg:col-span-2">
            <Card variant="glass">
              <h2 className="text-2xl font-bold mb-6">
                Envíanos un <span className="text-gradient">Mensaje</span>
              </h2>
              <ContactForm />
            </Card>
          </div>
        </div>
      </div>

      {/* FAQ Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Preguntas <span className="text-gradient">Frecuentes</span>
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[
            {
              q: '¿Cuánto tiempo toma un proyecto típico?',
              a: 'Depende del alcance, pero la mayoría de proyectos se completan en 2-6 meses.',
            },
            {
              q: '¿Ofrecen soporte post-implementación?',
              a: 'Sí, ofrecemos planes de mantenimiento y soporte continuo para todos nuestros proyectos.',
            },
            {
              q: '¿Trabajan con empresas de cualquier tamaño?',
              a: 'Sí, desde startups hasta grandes corporaciones. Adaptamos nuestras soluciones a cada cliente.',
            },
            {
              q: '¿Cómo se maneja la confidencialidad?',
              a: 'Firmamos acuerdos de confidencialidad (NDA) antes de discutir detalles de tu proyecto.',
            },
          ].map((faq, index) => (
            <Card key={index} variant="glass" className="p-6">
              <h3 className="text-lg font-semibold text-gray-200 mb-2">
                {faq.q}
              </h3>
              <p className="text-gray-400 text-sm">{faq.a}</p>
            </Card>
          ))}
        </div>
      </section>
    </div>
  )
}
