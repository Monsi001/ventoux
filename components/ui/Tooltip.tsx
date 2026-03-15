'use client'
import { useState } from 'react'
import { HelpCircle } from 'lucide-react'

// Glossaire cyclisme
const GLOSSARY: Record<string, { label: string; description: string }> = {
  FTP: {
    label: 'FTP',
    description: 'Functional Threshold Power — Puissance maximale soutenable sur 1h. Base de calcul de toutes les zones d\'entraînement.',
  },
  CTL: {
    label: 'CTL (Fitness)',
    description: 'Chronic Training Load — Charge chronique d\'entraînement. Moyenne pondérée du TSS sur 42 jours. Reflète votre forme physique globale.',
  },
  ATL: {
    label: 'ATL (Fatigue)',
    description: 'Acute Training Load — Charge aiguë d\'entraînement. Moyenne pondérée du TSS sur 7 jours. Reflète votre fatigue récente.',
  },
  TSB: {
    label: 'TSB (Forme)',
    description: 'Training Stress Balance — CTL moins ATL. Positif = frais et reposé. Négatif = fatigué. Idéal le jour de course : +5 à +25.',
  },
  TSS: {
    label: 'TSS',
    description: 'Training Stress Score — Mesure la charge d\'une séance. Combine durée et intensité. 100 TSS ≈ 1h à FTP.',
  },
  IF: {
    label: 'IF',
    description: 'Intensity Factor — Ratio NP/FTP. IF 0.75 = endurance. IF 0.88 = sweet spot. IF 1.0 = seuil.',
  },
  NP: {
    label: 'NP',
    description: 'Normalized Power — Puissance normalisée tenant compte des variations. Plus représentatif de l\'effort réel que la puissance moyenne.',
  },
  Z1: {
    label: 'Zone 1 (Récupération)',
    description: 'Moins de 55% FTP. Récupération active, pédalage facile.',
  },
  Z2: {
    label: 'Zone 2 (Endurance)',
    description: '55-75% FTP. Base aérobie, vous pouvez discuter. La zone la plus importante pour progresser.',
  },
  Z3: {
    label: 'Zone 3 (Tempo)',
    description: '75-90% FTP. Effort soutenu mais gérable. Sweet spot entre 85-93%.',
  },
  Z4: {
    label: 'Zone 4 (Seuil)',
    description: '90-105% FTP. Effort au seuil, difficile à tenir plus de 30-60min.',
  },
  Z5: {
    label: 'Zone 5 (VO2max)',
    description: '105-120% FTP. Intervalles courts et intenses, développe la capacité aérobie maximale.',
  },
  Z6: {
    label: 'Zone 6 (Anaérobie)',
    description: '120-150% FTP. Efforts explosifs de 30s à 3min.',
  },
  Z7: {
    label: 'Zone 7 (Sprint)',
    description: 'Plus de 150% FTP. Sprints de quelques secondes, puissance neuromusculaire.',
  },
  SWEET_SPOT: {
    label: 'Sweet Spot',
    description: '85-93% FTP. Zone optimale entre volume et intensité. Meilleur ratio progression/fatigue.',
  },
  PMC: {
    label: 'PMC',
    description: 'Performance Management Chart — Graphique CTL/ATL/TSB qui visualise forme, fatigue et fraîcheur.',
  },
  W_KG: {
    label: 'W/kg',
    description: 'Watts par kilo — Ratio puissance/poids. Déterminant en montagne. 4+ W/kg = très bon niveau amateur.',
  },
}

// Tooltip inline pour un terme
export function Term({ term, children }: { term: string; children?: React.ReactNode }) {
  const [show, setShow] = useState(false)
  const entry = GLOSSARY[term]
  if (!entry) return <span>{children || term}</span>

  return (
    <span className="relative inline-block">
      <span
        className="border-b border-dotted border-stone-600 cursor-help"
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onClick={() => setShow(!show)}
      >
        {children || entry.label}
      </span>
      {show && (
        <span className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 rounded-xl bg-stone-800 border border-stone-700 shadow-xl text-xs text-stone-300 leading-relaxed">
          <span className="font-semibold text-summit-light block mb-1">{entry.label}</span>
          {entry.description}
          <span className="absolute top-full left-1/2 -translate-x-1/2 -mt-px border-4 border-transparent border-t-stone-700" />
        </span>
      )}
    </span>
  )
}

// Bouton glossaire complet
export function GlossaryButton() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="btn-ghost flex items-center gap-1.5 text-xs text-stone-500 hover:text-stone-300"
      >
        <HelpCircle size={14} />
        Glossaire
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)}>
          <div className="card w-full max-w-lg mx-4 p-6 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-display text-lg font-bold text-summit-light uppercase">Glossaire cyclisme</h3>
              <button onClick={() => setOpen(false)} className="btn-ghost p-1.5 text-stone-500">✕</button>
            </div>

            <div className="space-y-4">
              {Object.entries(GLOSSARY).map(([key, { label, description }]) => (
                <div key={key} className="flex gap-3">
                  <span className="font-mono text-xs text-ventoux-400 w-20 flex-shrink-0 pt-0.5">{key}</span>
                  <div>
                    <p className="text-sm font-medium text-summit-light">{label}</p>
                    <p className="text-xs text-stone-400 leading-relaxed">{description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
