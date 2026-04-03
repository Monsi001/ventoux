'use client'
import { useEffect, useRef, useState } from 'react'

interface AnimatedNumberProps {
  value: number
  duration?: number
  suffix?: string
  prefix?: string
}

export function AnimatedNumber({ value, duration = 600, suffix = '', prefix = '' }: AnimatedNumberProps) {
  const [display, setDisplay] = useState(0)
  const ref = useRef<number | null>(null)
  const startTime = useRef(0)
  const startValue = useRef(0)

  useEffect(() => {
    startValue.current = display
    startTime.current = performance.now()

    function animate(now: number) {
      const elapsed = now - startTime.current
      const progress = Math.min(elapsed / duration, 1)
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      const current = Math.round(startValue.current + (value - startValue.current) * eased)
      setDisplay(current)

      if (progress < 1) {
        ref.current = requestAnimationFrame(animate)
      }
    }

    ref.current = requestAnimationFrame(animate)
    return () => { if (ref.current) cancelAnimationFrame(ref.current) }
  }, [value, duration])

  return <>{prefix}{display}{suffix}</>
}
