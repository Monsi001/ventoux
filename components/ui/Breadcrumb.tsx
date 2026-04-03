'use client'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { ChevronRight, Home } from 'lucide-react'

const LABELS: Record<string, string> = {
  dashboard: 'Tableau de bord',
  plan: 'Plan',
  activities: 'Activités',
  races: 'Courses',
  profile: 'Profil',
  chat: 'Coach IA',
}

export function Breadcrumb() {
  const pathname = usePathname()
  const segments = pathname.split('/').filter(Boolean)

  if (segments.length === 0) return null

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm text-stone-500">
      <Link href="/dashboard" className="hover:text-stone-300 transition-colors">
        <Home size={14} />
      </Link>
      {segments.map((segment, i) => {
        const href = '/' + segments.slice(0, i + 1).join('/')
        const label = LABELS[segment] || segment.charAt(0).toUpperCase() + segment.slice(1)
        const isLast = i === segments.length - 1

        return (
          <span key={href} className="flex items-center gap-1.5">
            <ChevronRight size={12} className="text-stone-700" />
            {isLast ? (
              <span className="text-stone-300 font-medium">{label}</span>
            ) : (
              <Link href={href} className="hover:text-stone-300 transition-colors">
                {label}
              </Link>
            )}
          </span>
        )
      })}
    </nav>
  )
}
