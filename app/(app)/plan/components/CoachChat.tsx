'use client'
import { useState } from 'react'
import { Mountain, X, Loader2, MessageCircle, Send } from 'lucide-react'
import type { TrainingPlan } from '@/types'
import { invalidateCache } from '@/lib/fetch-cache'

interface CoachChatProps {
  plan: TrainingPlan
  onPlanUpdate: (weeks: any) => void
  fullPage?: boolean
}

export default function CoachChat({ plan, onPlanUpdate, fullPage = false }: CoachChatProps) {
  const [chatOpen, setChatOpen] = useState(false)
  const [chatMsg, setChatMsg] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [chatHistory, setChatHistory] = useState<{ role: 'user' | 'coach'; text: string }[]>([])

  async function sendCoachMessage() {
    if (!chatMsg.trim() || !plan) return
    const msg = chatMsg.trim()
    setChatMsg('')
    setChatHistory(h => [...h, { role: 'user', text: msg }])
    setChatLoading(true)

    try {
      const res = await fetch('/api/plan/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId: plan.id, message: msg }),
      })
      const data = await res.json()
      if (res.ok && data.weeks) {
        onPlanUpdate(data.weeks)
        setChatHistory(h => [...h, { role: 'coach', text: data.reply }])
        invalidateCache('/api/init')
      } else {
        setChatHistory(h => [...h, { role: 'coach', text: data.error || 'Erreur, réessaie.' }])
      }
    } catch {
      setChatHistory(h => [...h, { role: 'coach', text: 'Erreur réseau.' }])
    } finally {
      setChatLoading(false)
    }
  }

  const chatContent = (
    <>
      <div className={fullPage ? 'flex-1 overflow-y-auto p-4 space-y-3' : 'h-[280px] overflow-y-auto p-4 space-y-3'}>
        {chatHistory.length === 0 && (
          <div className={`text-center ${fullPage ? 'py-12' : 'py-6'}`}>
            <div className={`w-12 h-12 rounded-2xl bg-ventoux-gradient flex items-center justify-center mx-auto mb-4 ${fullPage ? 'w-16 h-16' : ''}`}>
              <Mountain className={fullPage ? 'w-8 h-8 text-white' : 'w-6 h-6 text-white'} />
            </div>
            <h3 className={`font-display font-bold text-summit-light mb-2 ${fullPage ? 'text-xl' : 'text-sm'}`}>Coach Ventoux</h3>
            <p className={`text-stone-500 mb-4 ${fullPage ? 'text-sm' : 'text-sm'}`}>Comment tu te sens aujourd'hui ?</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {['Je suis malade', 'Pas le temps', 'En pleine forme', "J'ai des courbatures"].map(q => (
                <button
                  key={q}
                  onClick={() => setChatMsg(q)}
                  className={`rounded-full bg-white/[0.05] border border-white/[0.08] text-stone-400 hover:text-ventoux-400 hover:border-ventoux-500/30 transition-all ${
                    fullPage ? 'text-sm px-4 py-2' : 'text-xs px-3 py-1.5'
                  }`}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}
        {chatHistory.map((m: { role: string; text: string }, i: number) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] px-3 py-2 rounded-xl ${fullPage ? 'text-sm' : 'text-sm'} ${
              m.role === 'user'
                ? 'bg-ventoux-500/20 text-ventoux-200 rounded-br-sm'
                : 'bg-white/[0.05] text-stone-300 rounded-bl-sm'
            }`}>
              {m.text}
            </div>
          </div>
        ))}
        {chatLoading && (
          <div className="flex justify-start">
            <div className="px-3 py-2 rounded-xl bg-white/[0.05] text-stone-500 text-sm">
              <Loader2 size={14} className="animate-spin inline mr-1.5" />
              Le coach réfléchit…
            </div>
          </div>
        )}
      </div>

      <form
        onSubmit={e => { e.preventDefault(); sendCoachMessage(); }}
        className={`flex items-center gap-2 border-t border-white/[0.06] ${fullPage ? 'px-4 py-4' : 'px-3 py-3'}`}
      >
        <input
          type="text"
          value={chatMsg}
          onChange={e => setChatMsg(e.target.value)}
          placeholder="Dis quelque chose au coach…"
          className={`flex-1 bg-white/[0.05] border border-white/[0.08] rounded-xl text-summit-light placeholder:text-stone-600 focus:outline-none focus:border-ventoux-500/40 ${
            fullPage ? 'px-4 py-3 text-sm' : 'px-3 py-2 text-sm'
          }`}
          disabled={chatLoading}
        />
        <button
          type="submit"
          disabled={chatLoading || !chatMsg.trim()}
          className={`rounded-xl bg-ventoux-gradient text-white disabled:opacity-30 transition-opacity ${fullPage ? 'p-3' : 'p-2'}`}
        >
          <Send size={fullPage ? 16 : 14} />
        </button>
      </form>
    </>
  )

  if (fullPage) {
    return (
      <div className="flex flex-col bg-white/[0.02] rounded-2xl border border-white/[0.06] overflow-hidden" style={{ minHeight: '60vh' }}>
        {chatContent}
      </div>
    )
  }

  return (
    <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-3">
      {chatOpen && (
        <div className="w-[340px] max-w-[calc(100vw-2rem)] bg-stone-950 border border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden animate-in">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06] bg-white/[0.02]">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-ventoux-gradient flex items-center justify-center">
                <Mountain className="w-4 h-4 text-white" />
              </div>
              <span className="text-sm font-medium text-summit-light">Coach Ventoux</span>
            </div>
            <button onClick={() => setChatOpen(false)} className="text-stone-500 hover:text-stone-300 transition-colors">
              <X size={16} />
            </button>
          </div>
          {chatContent}
        </div>
      )}

      <button
        onClick={() => setChatOpen((o: boolean) => !o)}
        className={`w-12 h-12 rounded-full shadow-lg flex items-center justify-center transition-all ${
          chatOpen
            ? 'bg-stone-800 text-stone-400'
            : 'bg-ventoux-gradient text-white shadow-ventoux hover:scale-105'
        }`}
      >
        {chatOpen ? <X size={20} /> : <MessageCircle size={20} />}
      </button>
    </div>
  )
}
