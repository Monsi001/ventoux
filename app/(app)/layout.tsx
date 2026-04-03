import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import NavBar from '@/components/ui/NavBar'
import { BottomNav } from '@/components/ui/BottomNav'
import { ToastProvider } from '@/components/ui/Toast'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { KeyboardShortcuts } from '@/components/ui/KeyboardShortcuts'
import { ViewTransition } from '@/components/ui/ViewTransition'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

  return (
    <div className="flex flex-col min-h-screen">
      <NavBar user={{ name: session.user?.name || '', email: session.user?.email || '' }} />
      <main id="main-content" className="flex-1 container mx-auto px-4 py-6 max-w-7xl pb-20 md:pb-0">
        <ToastProvider>
          <div className="mb-4">
            <Breadcrumb />
          </div>
          <ViewTransition>{children}</ViewTransition>
        </ToastProvider>
      </main>
      <BottomNav />
      <KeyboardShortcuts />
    </div>
  )
}
