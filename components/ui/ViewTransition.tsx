'use client'
import { usePathname } from 'next/navigation'

export function ViewTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  return <div key={pathname} className="animate-page-in">{children}</div>
}
