import { notFound } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowLeft, ExternalLink } from 'lucide-react'
import { getTeamMember, teamMembers } from '@/lib/data/team'
import type { Metadata } from 'next'

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateStaticParams() {
  return teamMembers.map((m) => ({ slug: m.slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const member = getTeamMember(slug)
  if (!member) return {}
  return {
    title: `${member.name} — ${member.roleLabel} | XENITH`,
    description: member.tagline,
  }
}

const cardGradient: Record<string, string> = {
  violet: 'from-violet-950 via-gray-900 to-gray-950',
  cyan:   'from-cyan-950 via-gray-900 to-gray-950',
  emerald:'from-emerald-950 via-gray-900 to-gray-950',
}
const accentGlow: Record<string, string> = {
  violet: 'shadow-[0_0_60px_rgba(139,92,246,0.18)]',
  cyan:   'shadow-[0_0_60px_rgba(6,182,212,0.18)]',
  emerald:'shadow-[0_0_60px_rgba(16,185,129,0.18)]',
}
const accentBorder: Record<string, string> = {
  violet: 'border-violet-500/30',
  cyan:   'border-cyan-500/30',
  emerald:'border-emerald-500/30',
}
const accentText: Record<string, string> = {
  violet: 'text-violet-400',
  cyan:   'text-cyan-400',
  emerald:'text-emerald-400',
}
const accentBg: Record<string, string> = {
  violet: 'bg-violet-500/10 border-violet-500/20 text-violet-300',
  cyan:   'bg-cyan-500/10 border-cyan-500/20 text-cyan-300',
  emerald:'bg-emerald-500/10 border-emerald-500/20 text-emerald-300',
}
const accentBtn: Record<string, string> = {
  violet: 'bg-violet-600 hover:bg-violet-500 shadow-[0_0_24px_rgba(139,92,246,0.35)] hover:shadow-[0_0_32px_rgba(139,92,246,0.55)]',
  cyan:   'bg-cyan-600 hover:bg-cyan-500 shadow-[0_0_24px_rgba(6,182,212,0.35)] hover:shadow-[0_0_32px_rgba(6,182,212,0.55)]',
  emerald:'bg-emerald-600 hover:bg-emerald-500 shadow-[0_0_24px_rgba(16,185,129,0.35)] hover:shadow-[0_0_32px_rgba(16,185,129,0.55)]',
}
const accentRing: Record<string, string> = {
  violet: 'ring-violet-500/50',
  cyan:   'ring-cyan-500/50',
  emerald:'ring-emerald-500/50',
}
const accentLine: Record<string, string> = {
  violet: 'bg-gradient-to-r from-violet-500 to-purple-500',
  cyan:   'bg-gradient-to-r from-cyan-500 to-blue-500',
  emerald:'bg-gradient-to-r from-emerald-500 to-teal-500',
}
const accentDot: Record<string, string> = {
  violet: 'bg-violet-400',
  cyan:   'bg-cyan-400',
  emerald:'bg-emerald-400',
}

export default async function TeamMemberPage({ params }: Props) {
  const { slug } = await params
  const member = getTeamMember(slug)
  if (!member) notFound()

  const c = member.accentColor

  return (
    <div className="min-h-screen pb-24">

      {/* Back */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-28">
        <Link
          href="/inicio#nosotros"
          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-200 transition-colors group mb-10"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          Volver al equipo
        </Link>
      </div>

      {/* ── BUSINESS CARD ─────────────────────────────────────────────────────── */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className={`relative rounded-3xl border ${accentBorder[c]} ${accentGlow[c]} bg-gradient-to-br ${cardGradient[c]} overflow-hidden`}>

          {/* Corner decoration — top-right */}
          <div className="absolute top-0 right-0 w-64 h-64 opacity-[0.06] pointer-events-none">
            <svg viewBox="0 0 200 200" fill="none">
              <circle cx="200" cy="0" r="160" stroke="white" strokeWidth="1"/>
              <circle cx="200" cy="0" r="100" stroke="white" strokeWidth="1"/>
              <circle cx="200" cy="0" r="50" stroke="white" strokeWidth="1"/>
            </svg>
          </div>
          {/* Corner brackets (business card feel) */}
          <span className="absolute top-5 left-5 w-7 h-7 border-t-2 border-l-2 border-white/10 rounded-tl-lg pointer-events-none" />
          <span className="absolute bottom-5 right-5 w-7 h-7 border-b-2 border-r-2 border-white/10 rounded-br-lg pointer-events-none" />

          <div className="relative z-10 flex flex-col sm:flex-row items-center sm:items-start gap-8 sm:gap-10 p-8 sm:p-12">

            {/* Photo */}
            <div className="flex-shrink-0">
              <div className={`relative w-32 h-32 sm:w-40 sm:h-40 rounded-2xl ring-4 ring-offset-4 ring-offset-gray-950 overflow-hidden ${accentRing[c]}`}>
                <Image
                  src={member.photo}
                  alt={member.name}
                  fill
                  className="object-cover"
                  sizes="(max-width: 640px) 128px, 160px"
                />
                {/* Initial fallback */}
                <div className="absolute inset-0 flex items-center justify-center bg-gray-800/80 text-4xl font-bold text-gray-400 -z-10 select-none">
                  {member.name.charAt(0)}
                </div>
              </div>
            </div>

            {/* Identity */}
            <div className="flex-1 min-w-0 text-center sm:text-left">
              <span className={`inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.18em] px-3 py-1.5 rounded-full border mb-4 ${accentBg[c]}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${accentDot[c]}`} />
                {member.roleLabel}
              </span>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white tracking-tight mb-1">
                {member.name}
              </h1>
              <p className={`text-base font-medium mb-1 ${accentText[c]}`}>
                {member.role} &middot; XENITH
              </p>
              <p className="text-sm text-gray-500 font-mono tracking-widest mb-5 uppercase">
                xenith.com.co
              </p>

              {/* Divider */}
              <div className={`w-12 h-0.5 rounded-full mb-5 mx-auto sm:mx-0 ${accentLine[c]}`} />

              <p className="text-gray-300 text-base leading-relaxed max-w-xl mb-7">
                {member.tagline}
              </p>

              {/* Social links */}
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                {member.social.map((s) => (
                  <a
                    key={s.label}
                    href={s.href}
                    target={s.href.startsWith('http') ? '_blank' : undefined}
                    rel={s.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border border-white/10 bg-white/5 text-gray-300 hover:text-white hover:border-white/25 hover:bg-white/10 transition-all duration-200 backdrop-blur-sm"
                  >
                    <s.icon className="w-4 h-4" />
                    {s.label}
                    {s.href.startsWith('http') && <ExternalLink className="w-3 h-3 opacity-40" />}
                  </a>
                ))}
              </div>
            </div>

            {/* XENITH brand mark — right edge on large screens */}
            <div className="hidden lg:flex flex-col items-end justify-between self-stretch">
              <Image
                src="/images/xenith-logo.png"
                alt="XENITH"
                width={90}
                height={24}
                className="opacity-30 invert"
              />
              <p className="text-[10px] font-mono text-gray-600 uppercase tracking-[0.2em] rotate-90 origin-bottom-right mb-4 mr-1 translate-y-2 whitespace-nowrap">
                Engineering Studio
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Body ─────────────────────────────────────────────────────────────── */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 mt-10">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* Bio */}
          <div className="lg:col-span-2 space-y-6">
            <div className={`rounded-2xl border ${accentBorder[c]} bg-gray-900/50 p-6 sm:p-8`}>
              <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-3">
                <span className={`w-1 h-5 rounded-full inline-block ${accentLine[c]}`} />
                Perfil Profesional
              </h2>
              <div className="space-y-4">
                {member.bio.map((p, i) => (
                  <p key={i} className="text-gray-300 leading-relaxed text-[15px]">{p}</p>
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">

            {/* Skills */}
            <div className={`rounded-2xl border ${accentBorder[c]} bg-gray-900/50 p-6`}>
              <h2 className="text-base font-bold text-white mb-4">Especialidades</h2>
              <div className="flex flex-wrap gap-2">
                {member.skills.map((skill) => (
                  <span key={skill} className={`text-xs font-medium px-3 py-1.5 rounded-full border ${accentBg[c]}`}>
                    {skill}
                  </span>
                ))}
              </div>
            </div>

            {/* Connect */}
            <div className={`rounded-2xl border ${accentBorder[c]} bg-gray-900/50 p-6`}>
              <h2 className="text-base font-bold text-white mb-2">¿Quieres conectar?</h2>
              <p className="text-sm text-gray-400 mb-5 leading-relaxed">
                Envíanos un mensaje y nuestro equipo te pondrá en contacto.
              </p>
              <Link
                href="/inicio#contacto"
                className={`inline-flex w-full items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all duration-200 ${accentBtn[c]}`}
              >
                Contactar a Xenith
              </Link>
            </div>

            {/* Other team members */}
            <div className={`rounded-2xl border ${accentBorder[c]} bg-gray-900/50 p-6`}>
              <h2 className="text-base font-bold text-white mb-4">Conoce al equipo</h2>
              <div className="space-y-3">
                {teamMembers
                  .filter((m) => m.slug !== member.slug)
                  .map((m) => (
                    <Link key={m.slug} href={`/equipo/${m.slug}`} className="flex items-center gap-3 group">
                      <div className="w-10 h-10 rounded-xl overflow-hidden bg-gray-800 flex-shrink-0 relative">
                        <Image src={m.photo} alt={m.name} fill className="object-cover" sizes="40px" />
                        <div className="absolute inset-0 flex items-center justify-center text-sm font-bold text-gray-500 -z-10">
                          {m.name.charAt(0)}
                        </div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-gray-200 group-hover:text-white truncate transition-colors">
                          {m.name}
                        </p>
                        <p className="text-xs text-gray-500">{m.roleLabel}</p>
                      </div>
                      <ExternalLink className="w-3.5 h-3.5 text-gray-600 group-hover:text-gray-400 flex-shrink-0 transition-colors" />
                    </Link>
                  ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
