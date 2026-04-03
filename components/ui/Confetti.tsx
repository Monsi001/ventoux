'use client'
import { useEffect, useState } from 'react'

const COLORS = ['#FF6B35', '#6B9EFF', '#4ECCA3', '#F7C948', '#FF5252', '#C45EFF', '#FF9F45']

export function Confetti({ trigger }: { trigger: boolean }) {
  const [particles, setParticles] = useState<{ id: number; x: number; color: string; delay: number; rotation: number }[]>([])

  useEffect(() => {
    if (!trigger) return
    const newParticles = Array.from({ length: 30 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      delay: Math.random() * 0.5,
      rotation: Math.random() * 360,
    }))
    setParticles(newParticles)
    const timer = setTimeout(() => setParticles([]), 2500)
    return () => clearTimeout(timer)
  }, [trigger])

  if (particles.length === 0) return null

  return (
    <div className="fixed inset-0 pointer-events-none z-[100]">
      {particles.map(p => (
        <div
          key={p.id}
          className="absolute w-2 h-2 rounded-sm"
          style={{
            left: `${p.x}%`,
            top: '-10px',
            backgroundColor: p.color,
            animation: `confettiFall 2s ease-in forwards`,
            animationDelay: `${p.delay}s`,
            transform: `rotate(${p.rotation}deg)`,
          }}
        />
      ))}
    </div>
  )
}
