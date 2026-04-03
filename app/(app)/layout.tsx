import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import NavBar from '@/components/ui/NavBar'
import { ToastProvider } from '@/components/ui/Toast'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

  return (
    <div className="flex flex-col min-h-screen">
      <NavBar user={{ name: session.user?.name || '', email: session.user?.email || '' }} />
      <main className="flex-1 container mx-auto px-4 py-6 max-w-7xl">
        <ToastProvider>
          {children}
        </ToastProvider>
      </main>
    </div>
  )
}
