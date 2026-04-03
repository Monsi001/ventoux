'use client'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { LayoutDashboard, CalendarDays, Activity, Trophy, User } from 'lucide-react'

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Board', icon: LayoutDashboard },
  { href: '/plan', label: 'Plan', icon: CalendarDays },
  { href: '/activities', label: 'Activités', icon: Activity },
  { href: '/races', label: 'Courses', icon: Trophy },
  { href: '/profile', label: 'Profil', icon: User },
]

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-white/[0.06] backdrop-blur-xl bg-stone-950/90" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
      <div className="flex items-center justify-around h-14">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center gap-0.5 px-3 py-1.5 transition-colors ${
                active ? 'text-ventoux-400' : 'text-stone-500'
              }`}
            >
              <Icon size={20} strokeWidth={active ? 2 : 1.5} />
              <span className="text-[10px] font-medium">{label}</span>
              {active && <div className="w-1 h-1 rounded-full bg-ventoux-400" />}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
