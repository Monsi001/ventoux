'use client'
import { useState, useEffect } from 'react'
import { format, differenceInDays } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Trophy, Plus, Mountain, Pencil, Trash2, Loader2, X, Check } from 'lucide-react'
import type { Race, RaceTargetLevel } from '@/types'

const TARGET_OPTIONS: { value: RaceTargetLevel; label: string; color: string }[] = [
  { value: 'FINISH',  label: 'Terminer',   color: 'text-green-400' },
  { value: 'TOP_25',  label: 'Top 25%',    color: 'text-blue-400' },
  { value: 'TOP_10',  label: 'Top 10%',    color: 'text-amber-400' },
  { value: 'PODIUM',  label: 'Podium',     color: 'text-ventoux-400' },
]

const EMPTY_FORM = {
  name: '', date: '', distance: '', elevation: '',
  location: '', targetLevel: 'FINISH' as RaceTargetLevel, notes: '',
}

export default function RacesPage() {
  const [races, setRaces] = useState<Race[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [error, setError] = useState('')

  useEffect(() => { loadRaces() }, [])

  async function loadRaces() {
    const res = await fetch('/api/races')
    const data = await res.json()
    setRaces(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  function openAdd() {
    // Pré-remplir avec GF Mont Ventoux si pas de course
    if (races.length === 0) {
      setForm({ ...EMPTY_FORM, name: 'GF du Mont Ventoux', date: '2026-06-06', distance: '173', elevation: '3660', location: 'Bédoin, Vaucluse', targetLevel: 'FINISH', notes: '' })
    } else {
      setForm(EMPTY_FORM)
    }
    setEditId(null)
    setShowForm(true)
  }

  function openEdit(race: Race) {
    setForm({
      name: race.name,
      date: race.date.split('T')[0],
      distance: String(race.distance),
      elevation: String(race.elevation),
      location: race.location || '',
      targetLevel: race.targetLevel,
      notes: race.notes || '',
    })
    setEditId(race.id)
    setShowForm(true)
  }

  async function handleSave() {
    if (!form.name || !form.date || !form.distance || !form.elevation) {
      setError('Champs obligatoires manquants')
      return
    }

    setSaving(true)
    setError('')

    const url = editId ? `/api/races/${editId}` : '/api/races'
    const method = editId ? 'PUT' : 'POST'

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })

    if (res.ok) {
      setShowForm(false)
      loadRaces()
    } else {
      const data = await res.json()
      setError(data.error || 'Erreur de sauvegarde')
    }
    setSaving(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('Supprimer cette course ? Le plan associé sera aussi supprimé.')) return
    await fetch(`/api/races/${id}`, { method: 'DELETE' })
    setRaces(prev => prev.filter(r => r.id !== id))
  }

  return (
    <div className="space-y-6 animate-in">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold text-summit-light uppercase tracking-wide">Courses</h1>
          <p className="text-stone-500 mt-0.5 text-sm">Gérez vos objectifs de course</p>
        </div>
        <button onClick={openAdd} className="btn-primary flex items-center gap-2">
          <Plus size={15} /> Ajouter une course
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="card p-6 border-ventoux-500/20 animate-in">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-display text-lg font-semibold text-summit-light uppercase tracking-wide">
              {editId ? 'Modifier la course' : 'Nouvelle course'}
            </h2>
            <button onClick={() => setShowForm(false)} className="btn-ghost p-1.5"><X size={18} /></button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="label">Nom de la course *</label>
              <input className="input" placeholder="GF du Mont Ventoux" value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
            </div>
            <div>
              <label className="label">Date *</label>
              <input type="date" className="input" value={form.date}
                min={new Date().toISOString().split('T')[0]}
                onChange={e => setForm(p => ({ ...p, date: e.target.value }))} />
            </div>
            <div>
              <label className="label">Lieu</label>
              <input className="input" placeholder="Bédoin, Vaucluse" value={form.location}
                onChange={e => setForm(p => ({ ...p, location: e.target.value }))} />
            </div>
            <div>
              <label className="label">Distance (km) *</label>
              <input type="number" className="input" placeholder="173" value={form.distance}
                onChange={e => setForm(p => ({ ...p, distance: e.target.value }))} />
            </div>
            <div>
              <label className="label">Dénivelé positif (m) *</label>
              <input type="number" className="input" placeholder="3660" value={form.elevation}
                onChange={e => setForm(p => ({ ...p, elevation: e.target.value }))} />
            </div>
            <div className="col-span-2">
              <label className="label">Objectif</label>
              <div className="grid grid-cols-4 gap-2">
                {TARGET_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setForm(p => ({ ...p, targetLevel: opt.value }))}
                    className={`py-2.5 rounded-xl text-sm font-medium border transition-all ${
                      form.targetLevel === opt.value
                        ? 'bg-ventoux-500/15 border-ventoux-500/40 text-ventoux-300'
                        : 'border-white/[0.06] text-stone-500 hover:text-stone-300 hover:border-white/[0.12]'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="col-span-2">
              <label className="label">Notes</label>
              <textarea className="input h-20 resize-none" placeholder="Informations complémentaires…"
                value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
            </div>
          </div>

          {error && <p className="text-red-400 text-sm mt-3">{error}</p>}

          <div className="flex gap-3 mt-5">
            <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-2">
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
              {editId ? 'Mettre à jour' : 'Créer la course'}
            </button>
            <button onClick={() => setShowForm(false)} className="btn-secondary">Annuler</button>
          </div>
        </div>
      )}

      {/* Liste */}
      {loading ? (
        <div className="space-y-4">{[...Array(2)].map((_, i) => <div key={i} className="skeleton h-32 rounded-2xl" />)}</div>
      ) : races.length === 0 && !showForm ? (
        <div className="card p-16 text-center">
          <Trophy size={48} className="mx-auto text-stone-700 mb-4" />
          <h2 className="font-display text-xl font-semibold text-summit-light mb-2 uppercase">Aucune course</h2>
          <p className="text-stone-500 mb-6">Ajoutez votre premier objectif pour commencer à générer votre plan.</p>
          <button onClick={openAdd} className="btn-primary mx-auto">
            Ajouter la GF Mont Ventoux
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {races.map(race => {
            const daysUntil = differenceInDays(new Date(race.date), new Date())
            const target = TARGET_OPTIONS.find(t => t.value === race.targetLevel)

            return (
              <div key={race.id} className="card card-hover p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-ventoux-gradient flex items-center justify-center flex-shrink-0 shadow-ventoux-sm">
                      <Mountain size={22} className="text-white" strokeWidth={1.5} />
                    </div>
                    <div>
                      <h3 className="font-display text-lg font-semibold text-summit-light uppercase tracking-wide">
                        {race.name}
                      </h3>
                      {race.location && <p className="text-stone-500 text-sm">{race.location}</p>}
                      <div className="flex items-center gap-4 mt-3 flex-wrap">
                        <Pill label={format(new Date(race.date), 'd MMMM yyyy', { locale: fr })} />
                        <Pill label={`${race.distance} km`} />
                        <Pill label={`${race.elevation} m D+`} />
                        {target && <span className={`text-xs font-medium ${target.color}`}>{target.label}</span>}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="text-right mr-2">
                      <p className="font-display text-2xl md:text-3xl font-bold text-summit-light">
                        {daysUntil > 0 ? `J-${daysUntil}` : daysUntil === 0 ? "Aujourd'hui !" : 'Terminée'}
                      </p>
                      <p className="text-stone-600 text-xs uppercase tracking-widest">
                        {daysUntil > 0 ? `${Math.floor(daysUntil / 7)} semaines` : 'Passée'}
                      </p>
                    </div>
                    <button onClick={() => openEdit(race)} className="btn-ghost p-2"><Pencil size={15} /></button>
                    <button onClick={() => handleDelete(race.id)} className="btn-ghost p-2 hover:text-red-400"><Trash2 size={15} /></button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function Pill({ label }: { label: string }) {
  return <span className="text-xs bg-white/[0.05] text-stone-400 px-2.5 py-1 rounded-lg">{label}</span>
}
