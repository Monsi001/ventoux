'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { Dumbbell, Check, Play, Pause, SkipForward, RotateCcw } from 'lucide-react'

interface ParsedExercise {
  name: string
  sets: number
  reps: string
  rest: number
  isTime: boolean
}

function parseExercises(description: string): ParsedExercise[] {
  if (!description) return []
  const parts = description.split(/[,;]\s*/).map(s => s.trim()).filter(Boolean)
  const exercises: ParsedExercise[] = []
  let globalRest = 60

  const restMatch = description.match(/\((\d+)s?\s*repos\)/i)
  if (restMatch) globalRest = parseInt(restMatch[1])

  for (const part of parts) {
    if (/^\(\d+s?\s*repos\)$/i.test(part)) continue

    const match = part.match(/^(.+?)\s+(\d+)\s*[xX×]\s*(\d+\s*[sS]?(?:\/[jJ])?)\s*(?:\(.*\))?$/)
    if (match) {
      const reps = match[3].trim()
      const isTime = /s$/i.test(reps)
      exercises.push({
        name: match[1].trim(),
        sets: parseInt(match[2]),
        reps,
        rest: globalRest,
        isTime,
      })
    } else {
      const cleaned = part.replace(/\(.*?\)/g, '').trim()
      if (cleaned.length > 2) {
        exercises.push({ name: cleaned, sets: 3, reps: '10', rest: globalRest, isTime: false })
      }
    }
  }
  return exercises
}

interface StrengthPanelProps {
  description: string
}

export default function StrengthPanel({ description }: StrengthPanelProps) {
  const exercises = parseExercises(description)
  const [currentExIdx, setCurrentExIdx] = useState(0)
  const [currentSet, setCurrentSet] = useState(1)
  const [phase, setPhase] = useState<'idle' | 'work' | 'rest'>('idle')
  const [timeLeft, setTimeLeft] = useState(0)
  const [isRunning, setIsRunning] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const currentEx = exercises[currentExIdx]
  const totalExercises = exercises.length

  const playBeep = useCallback(() => {
    try {
      if (!audioRef.current) {
        audioRef.current = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbsGBAIjFYp+Pqt2BEMS91')
      }
      audioRef.current.currentTime = 0
      audioRef.current.play().catch(() => {})
    } catch {}
  }, [])

  useEffect(() => {
    if (isRunning && timeLeft > 0) {
      intervalRef.current = setInterval(() => {
        setTimeLeft(t => {
          if (t <= 1) { playBeep(); return 0 }
          if (t === 4) playBeep()
          return t - 1
        })
      }, 1000)
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [isRunning, timeLeft, playBeep])

  useEffect(() => {
    if (timeLeft === 0 && isRunning) {
      setIsRunning(false)
      if (phase === 'work') {
        if (currentEx) {
          setPhase('rest')
          setTimeLeft(currentEx.rest)
          setIsRunning(true)
        }
      } else if (phase === 'rest') {
        if (currentEx && currentSet < currentEx.sets) {
          setCurrentSet(s => s + 1)
          setPhase('work')
          if (currentEx.isTime) {
            setTimeLeft(parseInt(currentEx.reps))
            setIsRunning(true)
          }
        } else if (currentExIdx < totalExercises - 1) {
          setCurrentExIdx(i => i + 1)
          setCurrentSet(1)
          setPhase('work')
          const nextEx = exercises[currentExIdx + 1]
          if (nextEx?.isTime) {
            setTimeLeft(parseInt(nextEx.reps))
            setIsRunning(true)
          }
        } else {
          setPhase('idle')
        }
      }
    }
  }, [timeLeft, isRunning, phase, currentEx, currentSet, currentExIdx, totalExercises, exercises])

  const startWork = () => {
    if (!currentEx) return
    setPhase('work')
    if (currentEx.isTime) {
      setTimeLeft(parseInt(currentEx.reps))
      setIsRunning(true)
    }
  }

  const skipToNext = () => {
    setIsRunning(false)
    if (currentEx && currentSet < currentEx.sets) {
      setCurrentSet(s => s + 1)
      setPhase('idle')
    } else if (currentExIdx < totalExercises - 1) {
      setCurrentExIdx(i => i + 1)
      setCurrentSet(1)
      setPhase('idle')
    }
  }

  const resetTimer = () => {
    setIsRunning(false)
    setCurrentExIdx(0)
    setCurrentSet(1)
    setPhase('idle')
    setTimeLeft(0)
  }

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`

  if (exercises.length === 0) {
    return (
      <div className="rounded-xl bg-purple-500/5 border border-purple-500/15 p-4">
        <p className="text-sm text-purple-300/70">{description}</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl bg-purple-500/5 border border-purple-500/15 overflow-hidden">
      <div className="px-4 py-3 flex items-center justify-between border-b border-purple-500/10">
        <div className="flex items-center gap-2">
          <Dumbbell size={14} className="text-purple-400" />
          <span className="text-sm font-semibold text-purple-300">Renforcement</span>
        </div>
        <button onClick={resetTimer} className="text-stone-600 hover:text-stone-400 transition-colors p-1">
          <RotateCcw size={12} />
        </button>
      </div>

      <div className="p-4 space-y-3">
        {/* Exercise list */}
        <div className="space-y-1">
          {exercises.map((ex, i) => {
            const isActive = i === currentExIdx
            const isDone = i < currentExIdx
            return (
              <div
                key={i}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all ${
                  isActive ? 'bg-purple-500/10 ring-1 ring-purple-500/20 text-purple-200' :
                  isDone ? 'text-stone-600 line-through' : 'text-stone-500'
                }`}
              >
                <span className="w-5 text-center text-xs">
                  {isDone ? <Check size={12} className="text-green-500" /> : `${i + 1}`}
                </span>
                <span className="flex-1 font-medium">{ex.name}</span>
                <span className="text-xs opacity-60">{ex.sets}×{ex.reps}</span>
                {isActive && phase !== 'idle' && (
                  <span className="text-xs text-purple-400">
                    {currentSet}/{ex.sets}
                  </span>
                )}
              </div>
            )
          })}
        </div>

        {/* Timer */}
        {currentEx && (
          <div className="border-t border-purple-500/10 pt-4">
            <div className="text-center mb-3">
              <p className="font-semibold text-purple-200">{currentEx.name}</p>
              <p className="text-xs text-stone-500 mt-0.5">
                Set {currentSet}/{currentEx.sets} · {currentEx.reps} {currentEx.isTime ? '' : 'reps'}
              </p>
            </div>

            {((phase === 'work' && currentEx.isTime) || phase === 'rest') && (
              <div className="text-center mb-4">
                <div className={`inline-flex items-center justify-center w-24 h-24 rounded-full border-2 ${
                  phase === 'rest' ? 'border-green-500/30 text-green-300' : 'border-purple-500/30 text-purple-200'
                }`}>
                  <div>
                    <div className="text-3xl font-mono font-bold">{formatTime(timeLeft)}</div>
                    <div className="text-[10px] uppercase opacity-50">{phase === 'rest' ? 'Repos' : 'Go'}</div>
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center justify-center gap-2 flex-wrap">
              {phase === 'idle' && (
                <button onClick={startWork} className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-purple-500/20 text-purple-300 text-sm font-medium hover:bg-purple-500/30 transition-colors">
                  <Play size={14} /> Go
                </button>
              )}
              {phase !== 'idle' && currentEx.isTime && (
                <button onClick={() => setIsRunning(!isRunning)} className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white/[0.05] text-stone-300 text-sm hover:bg-white/[0.08] transition-colors">
                  {isRunning ? <Pause size={14} /> : <Play size={14} />}
                  {isRunning ? 'Pause' : 'Reprendre'}
                </button>
              )}
              {phase === 'work' && !currentEx.isTime && (
                <button
                  onClick={() => { setPhase('rest'); setTimeLeft(currentEx.rest); setIsRunning(true) }}
                  className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-green-500/15 text-green-300 text-sm font-medium hover:bg-green-500/25 transition-colors"
                >
                  <Check size={14} /> Fait — Repos {currentEx.rest}s
                </button>
              )}
              {phase === 'rest' && (
                <button onClick={() => { setIsRunning(false); setTimeLeft(0) }} className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white/[0.05] text-stone-300 text-sm hover:bg-white/[0.08] transition-colors">
                  <SkipForward size={14} /> Skip
                </button>
              )}
              {(currentExIdx < totalExercises - 1 || currentSet < (currentEx?.sets || 0)) && (
                <button onClick={skipToNext} className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white/[0.03] text-stone-500 text-sm hover:bg-white/[0.06] hover:text-stone-300 transition-colors">
                  <SkipForward size={14} /> Suivant
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
