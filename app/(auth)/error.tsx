'use client'
export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
      <h2 className="text-xl font-semibold text-summit-light">Une erreur est survenue</h2>
      <p className="text-stone-400 text-sm">{error.message}</p>
      <button onClick={reset} className="btn-primary px-6 py-2">Réessayer</button>
    </div>
  )
}
