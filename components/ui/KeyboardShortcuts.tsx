'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { X } from 'lucide-react'

const SHORTCUTS = [
  { keys: 'g d', label: 'Tableau de bord', href: '/dashboard' },
  { keys: 'g p', label: 'Plan', href: '/plan' },
  { keys: 'g a', label: 'Activités', href: '/activities' },
  { keys: 'g r', label: 'Courses', href: '/races' },
  { keys: 'g s', label: 'Profil', href: '/profile' },
]

export function KeyboardShortcuts() {
  const router = useRouter()
  const [showHelp, setShowHelp] = useState(false)
  const [buffer, setBuffer] = useState('')

  useEffect(() => {
    let timeout: NodeJS.Timeout

    function handleKeyDown(e: KeyboardEvent) {
      // Ignorer si focus dans un input/textarea
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

      if (e.key === '?') {
        e.preventDefault()
        setShowHelp(prev => !prev)
        return
      }

      if (e.key === 'Escape') {
        setShowHelp(false)
        setBuffer('')
        return
      }

      const newBuffer = buffer + e.key
      setBuffer(newBuffer)

      // Check shortcuts
      const match = SHORTCUTS.find(s => s.keys.replace(' ', '') === newBuffer)
      if (match) {
        router.push(match.href)
        setBuffer('')
        return
      }

      // Reset buffer after 500ms
      clearTimeout(timeout)
      timeout = setTimeout(() => setBuffer(''), 500)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      clearTimeout(timeout)
    }
  }, [buffer, router])

  if (!showHelp) return null

  return (
    <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-center justify-center" onClick={() => setShowHelp(false)}>
      <div className="card p-6 max-w-sm w-full mx-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-lg font-bold text-summit-light">Raccourcis clavier</h3>
          <button onClick={() => setShowHelp(false)} className="text-stone-500 hover:text-stone-300 p-1">
            <X size={16} />
          </button>
        </div>
        <div className="space-y-2">
          {SHORTCUTS.map(s => (
            <div key={s.keys} className="flex items-center justify-between text-sm">
              <span className="text-stone-400">{s.label}</span>
              <kbd className="px-2 py-0.5 rounded bg-white/[0.06] text-stone-300 font-mono text-xs">{s.keys}</kbd>
            </div>
          ))}
          <div className="flex items-center justify-between text-sm border-t border-white/[0.06] pt-2 mt-2">
            <span className="text-stone-400">Aide</span>
            <kbd className="px-2 py-0.5 rounded bg-white/[0.06] text-stone-300 font-mono text-xs">?</kbd>
          </div>
        </div>
      </div>
    </div>
  )
}
