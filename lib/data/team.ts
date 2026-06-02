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
    roleLabel: 'Chief Technology Officer',
    name: 'Nombre Apellido',
    title: 'Chief Technology Officer',
    photo: '/images/team/cto.jpg',
    tagline: 'Arquitecto de soluciones tecnológicas que define el rumbo técnico de Xenith.',
    bio: [
      'Ingeniero de software con más de 12 años de experiencia en arquitectura de sistemas, desarrollo full-stack y liderazgo técnico. Ha diseñado y supervisado plataformas de alto rendimiento para empresas de distintos sectores.',
      'Experto en arquitecturas distribuidas, integración de sistemas embebidos y desarrollo de software para robótica. Su trabajo en Xenith abarca desde la definición de estándares de código hasta la supervisión de proyectos de I+D con hardware y software de vanguardia.',
      'Defensor del open-source y las buenas prácticas de ingeniería, constantemente evalúa y adopta las tecnologías más relevantes para mantener a Xenith en la frontera del desarrollo tecnológico.',
    ],
    skills: [
      'Arquitectura de Software',
      'Sistemas Embebidos',
      'DevOps & Cloud',
      'Robótica',
      'Full-Stack Development',
      'Ciberseguridad',
    ],
    social: [
      { icon: Linkedin, label: 'LinkedIn', href: 'https://linkedin.com' },
      { icon: Github, label: 'GitHub', href: 'https://github.com' },
      { icon: Twitter, label: 'Twitter / X', href: 'https://x.com' },
      { icon: Mail, label: 'Email', href: 'mailto:cto@xenith.com' },
    ],
    accentColor: 'cyan',
    gradientFrom: 'from-cyan-600',
    gradientTo: 'to-blue-800',
  },
  {
    slug: 'vpe',
    role: 'VP Engineering',
    roleLabel: 'VP of Engineering',
    name: 'Nombre Apellido',
    title: 'Vice President of Engineering',
    photo: '/images/team/vpe.jpg',
    tagline: 'Líder de ingeniería que convierte la visión técnica en sistemas robustos y escalables.',
    bio: [
      'Ingeniero con más de 10 años de experiencia liderando equipos de desarrollo y entregando productos de software de alta calidad. Especialista en arquitecturas modernas, CI/CD y cultura de ingeniería de excelencia.',
      'En Xenith supervisa los equipos de ingeniería de software y robótica, asegurando que cada entregable cumpla los más altos estándares de calidad, rendimiento y seguridad. Ha optimizado procesos de desarrollo que han reducido tiempos de entrega en un 40%.',
      'Apasionado por el crecimiento de los ingenieros en su equipo, crea ambientes donde la experimentación y la mejora continua son parte del ADN del equipo.',
    ],
    skills: [
      'Liderazgo de Ingeniería',
      'Arquitectura de Sistemas',
      'CI/CD & DevOps',
      'Gestión de Equipos',
      'Software de Robótica',
      'Calidad de Software',
    ],
    social: [
      { icon: Linkedin, label: 'LinkedIn', href: 'https://linkedin.com' },
      { icon: Github, label: 'GitHub', href: 'https://github.com' },
      { icon: Globe, label: 'Sitio Web', href: 'https://xenith.com.co' },
      { icon: Mail, label: 'Email', href: 'mailto:engineering@xenith.com.co' },
    ],
    accentColor: 'emerald',
    gradientFrom: 'from-emerald-600',
    gradientTo: 'to-teal-800',
  },
]

export const getTeamMember = (slug: string) =>
  teamMembers.find((m) => m.slug === slug) ?? null
