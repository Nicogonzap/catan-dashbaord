import type { Metadata } from 'next'
import './globals.css'
import Navbar from '@/components/Navbar'
import { getAnosDisponibles } from '@/lib/queries'

export const metadata: Metadata = {
  title: 'Catán Dashboard',
  description: 'Estadísticas del grupo de Catán',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const years = await getAnosDisponibles()

  return (
    <html lang="es">
      <body className="antialiased min-h-screen">
        <Navbar years={years} />
        <main className="max-w-7xl mx-auto px-4 py-6">{children}</main>
      </body>
    </html>
  )
}
