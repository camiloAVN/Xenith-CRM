'use client'

import { motion } from 'framer-motion'
import {
  Cpu,
  Code,
  Smartphone,
  Cloud,
  Database,
  Zap,
  Globe,
  Bot,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card'

const solutions = [
  {
    icon: Bot,
    title: 'Robótica Industrial',
    description: 'Sistemas robóticos avanzados para automatización de procesos industriales',
    features: [
      'Brazos robóticos colaborativos',
      'Sistemas de visión artificial',
      'Control y monitoreo en tiempo real',
      'Integración con sistemas existentes',
    ],
  },
  {
    icon: Cpu,
    title: 'IoT y Sistemas Embebidos',
    description: 'Dispositivos inteligentes conectados para el Internet de las Cosas',
    features: [
      'Desarrollo de firmware',
      'Sensores y actuadores',
      'Conectividad inalámbrica',
      'Análisis de datos en tiempo real',
    ],
  },
  {
    icon: Code,
    title: 'Aplicaciones Web',
    description: 'Plataformas web modernas, escalables y de alto rendimiento',
    features: [
      'Desarrollo Full-Stack',
      'Arquitectura Serverless',
      'Progressive Web Apps',
      'Dashboards administrativos',
    ],
  },
  {
    icon: Smartphone,
    title: 'Aplicaciones Móviles',
    description: 'Apps nativas y multiplataforma para iOS y Android',
    features: [
      'React Native / Flutter',
      'UI/UX personalizado',
      'Integración con APIs',
      'Notificaciones push',
    ],
  },
  {
    icon: Cloud,
    title: 'Soluciones Cloud',
    description: 'Infraestructura en la nube escalable y segura',
    features: [
      'AWS / Azure / Google Cloud',
      'Microservicios',
      'CI/CD Pipelines',
      'Monitoreo y alertas',
    ],
  },
  {
    icon: Database,
    title: 'Big Data & Analytics',
    description: 'Procesamiento y análisis de grandes volúmenes de datos',
    features: [
      'Data Warehousing',
      'Machine Learning',
      'Visualización de datos',
      'Predicciones y tendencias',
    ],
  },
  {
    icon: Database,
    title: 'Sistema de Inventario',
    description: 'Control total de activos e inventarios mediante tecnología RFID y software a medida',
    features: [
      'Instalación de antenas RFID',
      'Tags personalizados por activo',
      'Sistema en tiempo real de inventario',
      'Gestión de clientes',
    ],
  },
  {
    icon: Zap,
    title: 'Automatización de Procesos',
    description: 'RPA y automatización de flujos de trabajo empresariales',
    features: [
      'Robotic Process Automation',
      'Integración de sistemas',
      'Optimización de procesos',
      'Reducción de costos operativos',
    ],
  },
  {
    icon: Globe,
    title: 'Consultoría Digital',
    description: 'Asesoramiento estratégico para transformación digital',
    features: [
      'Evaluación tecnológica',
      'Roadmap de implementación',
      'Capacitación de equipos',
      'Soporte continuo',
    ],
  },
]

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
}

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
}

export function SolutionsGrid() {
  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
    >
      {solutions.map((solution, index) => (
        <motion.div key={index} variants={item}>
          <Card variant="glass" className="h-full hover:border-violet-500/40 transition-all duration-200 group">
            <CardHeader>
              <div className="w-12 h-12 rounded-lg bg-violet-500/10 flex items-center justify-center mb-4 group-hover:bg-violet-500/20 transition-colors">
                <solution.icon className="w-6 h-6 text-violet-400" />
              </div>
              <CardTitle className="group-hover:text-violet-400 transition-colors">
                {solution.title}
              </CardTitle>
              <CardDescription>{solution.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {solution.features.map((feature, i) => (
                  <li key={i} className="text-sm text-gray-400 flex items-start">
                    <span className="w-1.5 h-1.5 bg-violet-500 rounded-full mr-2 mt-1.5 flex-shrink-0" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </motion.div>
  )
}
