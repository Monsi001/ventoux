'use client'
import { Check, ChevronRight, Bike, Sun } from 'lucide-react'
import type { TrainingSession } from '@/types'

const TYPE_BG: Record<string, string> = {
  ENDURANCE: 'bg-blue-500/10 border-blue-500/20 text-blue-300',
  TEMPO: 'bg-amber-500/10 border-amber-500/20 text-amber-300',
  THRESHOLD: 'bg-orange-500/10 border-orange-500/20 text-orange-300',
  VO2MAX: 'bg-red-500/10 border-red-500/20 text-red-300',
  SWEET_SPOT: 'bg-yellow-500/10 border-yellow-500/20 text-yellow-300',
  RECOVERY: 'bg-green-500/10 border-green-500/20 text-green-300',
  LONG_RIDE: 'bg-indigo-500/10 border-indigo-500/20 text-indigo-300',
  RACE_SIM: 'bg-ventoux-500/10 border-ventoux-500/20 text-ventoux-300',
  STRENGTH: 'bg-purple-500/10 border-purple-500/20 text-purple-300',
  REST: 'bg-stone-800/50 border-stone-700/30 text-stone-500',
  VIRTUAL_RIDE: 'bg-cyan-500/10 border-cyan-500/20 text-cyan-300',
}

const TYPE_LABELS: Record<string, string> = {
  ENDURANCE: 'Endurance', TEMPO: 'Tempo', THRESHOLD: 'Seuil',
  VO2MAX: 'VO2max', SWEET_SPOT: 'Sweet Spot', RECOVERY: 'Récup',
  LONG_RIDE: 'Sortie longue', RACE_SIM: 'Simul. Course', STRENGTH: 'Renfo',
  REST: 'Repos', VIRTUAL_RIDE: 'Virtuel',
}

const TYPE_ICONS: Record<string, string> = {
  ENDURANCE: '🚴', TEMPO: '⚡', THRESHOLD: '🔥', VO2MAX: '💥',
  SWEET_SPOT: '🎯', RECOVERY: '🌿', LONG_RIDE: '🏔️', RACE_SIM: '🏁',
  STRENGTH: '💪', REST: '😴', VIRTUAL_RIDE: '🖥️',
}

const ZONE_COLORS: Record<number, string> = {
  1: '#6B9EFF', 2: '#4ECCA3', 3: '#F7C948', 4: '#FF9F45',
  5: '#FF5252', 6: '#C45EFF', 7: '#FF2D9A',
}

interface SessionCardProps {
  session: TrainingSession
  onClick: () => void
  done: boolean
  compact: boolean
  draggable?: boolean
}

export default function SessionCard({ session, onClick, done, compact, draggable: isDraggable }: SessionCardProps) {
  const styles = TYPE_BG[session.type] || 'bg-stone-800/50 border-stone-700/30 text-stone-400'

  if (compact) {
    return (
      <button
        onClick={onClick}
        draggable={isDraggable}
        onDragStart={(e) => {
          e.dataTransfer.setData('sessionId', session.id)
          e.dataTransfer.effectAllowed = 'move'
        }}
        className={`w-full text-left px-2 py-2 rounded-lg border text-[11px] leading-snug transition-all hover:brightness-125 ${isDraggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'} ${styles} ${done ? 'opacity-40' : ''}`}
      >
        <div className="flex items-center gap-1">
          {done && <Check size={9} className="text-green-400" />}
          <span className="font-semibold truncate">{TYPE_LABELS[session.type] || session.type}</span>
          {session.type !== 'STRENGTH' && session.type !== 'REST' && (
            session.indoor
              ? <Bike size={8} className="text-cyan-400/50 flex-shrink-0" />
              : <Sun size={8} className="text-amber-400/50 flex-shrink-0" />
          )}
        </div>
        <div className="opacity-60 mt-0.5">{session.duration}min</div>
        {session.indoor && session.mywhooshWorkoutName && (
          <div className="mt-1 text-cyan-400/60 truncate flex items-center gap-0.5 text-[9px]">
            <Bike size={7} />
            <span className="truncate">{session.mywhooshWorkoutName}</span>
          </div>
        )}
      </button>
    )
  }

  // Full mobile card
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-3 rounded-xl border transition-all hover:brightness-110 cursor-pointer ${styles} ${done ? 'opacity-40' : ''}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-base">{TYPE_ICONS[session.type] || '🚴'}</span>
          <div className="min-w-0">
            <p className="font-semibold text-sm truncate">{session.name || TYPE_LABELS[session.type]}</p>
            <div className="flex items-center gap-2 text-xs opacity-60 mt-0.5">
              <span>{session.duration}min</span>
              {session.tssTarget ? <span>TSS {session.tssTarget}</span> : null}
              <span className="font-mono" style={{ color: ZONE_COLORS[session.intensityZone] || '#666' }}>Z{session.intensityZone}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {session.type !== 'STRENGTH' && session.type !== 'REST' && (
            session.indoor
              ? <Bike size={13} className="text-cyan-400/50" />
              : <Sun size={13} className="text-amber-400/50" />
          )}
          {done && <Check size={14} className="text-green-400" />}
          <ChevronRight size={14} className="text-stone-600" />
        </div>
      </div>
      {session.indoor && session.mywhooshWorkoutName && (
        <p className="text-cyan-400/50 text-xs mt-1.5 truncate pl-7">{session.mywhooshWorkoutName}</p>
      )}
    </button>
  )
}
