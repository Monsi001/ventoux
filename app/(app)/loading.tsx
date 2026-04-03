export default function Loading() {
  return (
    <div className="animate-pulse space-y-6 p-6">
      <div className="h-8 bg-white/[0.05] rounded-lg w-48" />
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-24 bg-white/[0.05] rounded-xl" />
        ))}
      </div>
      <div className="h-64 bg-white/[0.05] rounded-xl" />
    </div>
  )
}
