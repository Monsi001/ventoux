'use client'
import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import {
  Mountain, LayoutDashboard, CalendarDays, Activity,
  Trophy, User, LogOut, Menu, X, Zap
} from 'lucide-react'

const NAV_ITEMS = [
  { href: '/dashboard',   label: 'Tableau de bord', icon: LayoutDashboard },
  { href: '/plan',        label: 'Mon plan',         icon: CalendarDays },
  { href: '/activities',  label: 'Activités',        icon: Activity },
  { href: '/races',       label: 'Courses',          icon: Trophy },
  { href: '/profile',     label: 'Profil',           icon: User },
]

export default function NavBar({ user }: { user: { name: string; email: string } }) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <nav className="sticky top-0 z-50 border-b border-white/[0.06] backdrop-blur-xl bg-stone-950/80">
      <div className="container mx-auto px-4 max-w-6xl">
        <div className="flex items-center justify-between h-14">
          {/* Logo */}
          <Link href="/dashboard" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-lg bg-ventoux-gradient flex items-center justify-center shadow-ventoux-sm group-hover:shadow-ventoux transition-shadow">
              <Mountain size={16} className="text-white" strokeWidth={2} />
            </div>
            <span className="font-display font-bold text-lg tracking-widest uppercase text-summit-light hidden sm:block">
              Ventoux
            </span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-1">
            {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
              const active = pathname === href || pathname.startsWith(href + '/')
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all duration-200 ${
                    active
                      ? 'bg-ventoux-500/15 text-ventoux-400 font-medium'
                      : 'text-stone-400 hover:text-summit-light hover:bg-white/[0.05]'
                  }`}
                >
                  <Icon size={15} strokeWidth={active ? 2 : 1.5} />
                  {label}
                </Link>
              )
            })}
          </div>

          {/* User + logout */}
          <div className="hidden md:flex items-center gap-3">
            <div className="text-right">
              <p className="text-summit-light text-sm font-medium leading-tight">{user.name}</p>
              <p className="text-stone-600 text-xs">{user.email}</p>
            </div>
            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="btn-ghost p-2"
              title="Déconnexion"
            >
              <LogOut size={16} />
            </button>
          </div>

          {/* Mobile burger */}
          <button
            className="md:hidden btn-ghost p-2"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-white/[0.06] bg-stone-950/95 backdrop-blur-xl">
          <div className="container mx-auto px-4 py-3 space-y-1">
            {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
              const active = pathname === href
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-all ${
                    active
                      ? 'bg-ventoux-500/15 text-ventoux-400'
                      : 'text-stone-400 hover:text-summit-light hover:bg-white/[0.05]'
                  }`}
                >
                  <Icon size={18} strokeWidth={active ? 2 : 1.5} />
                  {label}
                </Link>
              )
            })}
            <div className="pt-3 border-t border-white/[0.06]">
              <button
                onClick={() => signOut({ callbackUrl: '/login' })}
                className="flex items-center gap-3 px-3 py-3 text-stone-500 hover:text-red-400 w-full transition-colors"
              >
                <LogOut size={18} />
                Déconnexion
              </button>
            </div>
          </div>
        </div>
      )}
    </nav>
  )
}
