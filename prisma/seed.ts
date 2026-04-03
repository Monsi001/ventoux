import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  // Créer un utilisateur de démo
  const demoPwd = process.env.DEMO_PASSWORD || 'ventoux2026'
  const password = await bcrypt.hash(demoPwd, 12)

  const user = await prisma.user.upsert({
    where: { email: 'demo@ventoux.app' },
    update: { role: 'ADMIN', emailVerified: true },
    create: {
      email: 'demo@ventoux.app',
      password,
      name: 'Demo Rider',
      role: 'ADMIN',
      emailVerified: true,
      height: 178,
      weight: 70,
      ftp: 250,
    },
  })

  // Course objectif
  await prisma.race.upsert({
    where: { id: 'race-ventoux-2026' },
    update: {},
    create: {
      id: 'race-ventoux-2026',
      userId: user.id,
      name: 'GF du Mont Ventoux',
      date: new Date('2026-06-06'),
      distance: 173,
      elevation: 3660,
      location: 'Bédoin, Vaucluse',
      targetLevel: 'FINISH',
      notes: 'Objectif principal de la saison — montée par Bédoin',
    },
  })

  console.log(`✅ User: ${user.email}`)
  console.log(`✅ Race: GF Mont Ventoux 2026`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
