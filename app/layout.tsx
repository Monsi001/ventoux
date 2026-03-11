import type { Metadata, Viewport } from 'next'
import { Barlow_Condensed, DM_Sans, JetBrains_Mono } from 'next/font/google'
import { SessionProvider } from './providers'
import './globals.css'

const barlowCondensed = Barlow_Condensed({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-barlow-condensed',
  display: 'swap',
})

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm-sans',
  display: 'swap',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Ventoux Training',
  description: "Préparez la Gran Fondo du Mont Ventoux avec un plan d'entraînement adaptatif alimenté par l'IA",
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Ventoux',
  },
}

export const viewport: Viewport = {
  themeColor: '#FF6B35',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="fr"
      className={`${barlowCondensed.variable} ${dmSans.variable} ${jetbrainsMono.variable}`}
    >
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </head>
      <body className="bg-stone-950 text-summit-light font-body antialiased">
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  )
}
