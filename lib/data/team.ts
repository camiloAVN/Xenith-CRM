import { Github, Linkedin, Twitter, Globe, Mail } from 'lucide-react'

export interface TeamMember {
  slug: string
  role: string
  roleLabel: string
  name: string
  title: string
  photo: string
  tagline: string
  bio: string[]
  skills: string[]
  social: {
    icon: typeof Linkedin
    label: string
    href: string
  }[]
  accentColor: string
  gradientFrom: string
  gradientTo: string
}

export const teamMembers: TeamMember[] = [
  {
    slug: 'ceo',
    role: 'CEO',
    roleLabel: 'Chief Executive Officer',
    name: 'Camilo Andres Vargas',
    title: 'Chief Executive Officer',
    photo: '/images/team/camilo_vargas.jpg',
    tagline: 'Lider de transformación tecnológica de Xenith',
    bio: [
      'Ingeniero Mecatrónico y desarrollador Full Stack, con experiencia en el diseño e implementación de soluciones tecnológicas que integran software, electrónica, automatización e inteligencia artificial.',
      'He participado en el desarrollo de proyectos de ingeniería, innovación tecnológica y transformación digital, combinando conocimientos de programación, diseño de sistemas y gestión de proyectos para crear soluciones eficientes y orientadas a resultados.',
      'Actualmente soy fundador de Xenith, donde lidero el desarrollo de soluciones personalizadas para empresas y emprendedores, abarcando desde aplicaciones web y móviles hasta sistemas inteligentes basados en IA, con un enfoque práctico, innovador y centrado en las necesidades del cliente.',
    ],
    skills: [
      'Liderazgo de Equipos',
      'Transformación Digital',
      'Innovación',
      'Gestión de Proyectos',
      'Business Development',
    ],
    social: [
      { icon: Linkedin, label: 'LinkedIn', href: 'https://www.linkedin.com/in/camilo-andres-vargas-ni%C3%B1o-b3a57a1b9/' },
      { icon: Mail, label: 'Email', href: 'mailto:camilo.vargas@xenith.com.co' },
    ],
    accentColor: 'violet',
    gradientFrom: 'from-violet-600',
    gradientTo: 'to-purple-800',
  },
  {
    slug: 'cto',
    role: 'CTO',
    roleLabel: 'VP of Robotics & Hardware / Marketing Technologist',
    name: 'David Rengifo',
    title: 'Chief Technology Officer',
    photo: '/images/team/david_rengifo.png',
    tagline: 'Arquitecto de soluciones tecnológicas que define el rumbo técnico de Xenith.',
    bio: [
      'Ingeniero mecatrónico con enfoque en el diseño y desarrollo de soluciones robóticas, sistemas de automatización y manufactura digital. Mi trabajo combina liderazgo técnico con ejecución práctica, transformando ideas en productos físicos funcionales con impacto real en entornos industriales y comerciales.',
      'Especializado en robótica aplicada, integración de hardware y sistemas mecatrónicos, desarrollo soluciones que conectan diseño, electrónica y control para crear sistemas eficientes, escalables y orientados a la innovación. Creo en una ingeniería aplicada que no solo resuelve problemas, sino que redefine cómo interactúan las personas con la tecnología.',
      'Como Marketing Technologist, integro la visión técnica con estrategia digital para posicionar proyectos tecnológicos de forma clara, atractiva y orientada a mercado, conectando ingeniería con narrativa y crecimiento de producto.',
      'Mi enfoque es construir tecnología que funcione en el mundo real, combinando precisión ingenieril con creatividad para generar soluciones que tengan impacto tangible.'
    ],
    skills: [
      'Robótica aplicada y sistemas mecatrónicos',
      'Diseño e integración de hardware',
      'Automatización y manufactura digital',
      'Desarrollo de productos tecnológicos',
      'Marketing tecnológico y posicionamiento de proyectos',
      'Prototipado rápido e innovación aplicada',
    ],
    social: [
      { icon: Linkedin, label: 'LinkedIn', href: 'https://www.linkedin.com/in/david-alfonso-rengifo-b663bb258/' },
      { icon: Mail, label: 'Email', href: 'mailto:david.reginfo@xenith.com.co' },
    ],
    accentColor: 'cyan',
    gradientFrom: 'from-cyan-600',
    gradientTo: 'to-blue-800',
  },
  {
    slug: 'vpe',
    role: 'VP Engineering',
    roleLabel: 'VP of Engineering & Software Systems',
    name: 'Nicolas Ramirez',
    title: 'Vice President of Engineering',
    photo: '/images/team/nicolas_ramirez.png',
    tagline: 'Líder de ingeniería que convierte la visión técnica en sistemas robustos y escalables.',
    bio: [
      'Ingeniero mecatrónico con experiencia amplia en el desarrollo de soluciones inteligentes y sistemas robóticos avanzados. Mi enfoque combina liderazgo técnico con ejecución hands-on, permitiendo transformar visiones innovadoras en productos funcionales que desafían los límites de lo convencional.',
      'Especializado en inteligencia artificial, machine learning y computer vision, trabajo en la arquitectura y desarrollo de sistemas que aprenden, se adaptan y generan impacto real. Creo en la innovación disruptiva: no buscamos simplemente mejorar lo existente, sino reimaginar lo que es posible en el entretenimiento y experiencias interactivas.',
      'Mi rol abarca desde la concepción técnica de proyectos hasta su implementación, asegurando que cada solución no solo sea tecnológicamente sólida, sino escalable y centrada en el usuario final. Soy un puente entre la visión estratégica y la realidad técnica, combinando rigor ingenieril con pensamiento creativo.',
      'Creo que la mejor tecnología es aquella que funciona tan bien que el usuario nunca se da cuenta que está ahí. Mi objetivo es crear sistemas que generan momentos memorables.'
    ],
    skills: [
      'Machine Learning & Computer Vision',
      'Arquitectura de Sistemas Inteligentes',
      'Sistemas Robóticos & Automatización',
      'Liderazgo & Gestión Técnica de Equipos',
      'Innovación & Prototipado Rápido',
    ],
    social: [
      { icon: Linkedin, label: 'LinkedIn', href: 'https://www.linkedin.com/in/nicolas-ramirezs/' },
      { icon: Globe, label: 'Sitio Web', href: 'https://xenith.com.co' },
      { icon: Mail, label: 'Email', href: 'mailto:nicolas.ramirez@xenith.com.co' },
    ],
    accentColor: 'emerald',
    gradientFrom: 'from-emerald-600',
    gradientTo: 'to-teal-800',
  },
]

export const getTeamMember = (slug: string) =>
  teamMembers.find((m) => m.slug === slug) ?? null
