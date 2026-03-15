import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'

const prisma = new PrismaClient()

const WORKOUTS_DIR = process.env.MYWHOOSH_WORKOUTS_DIR ||
  'D:/WpSystem/S-1-5-21-3881068752-1464916384-1450323328-1001/AppData/Local/Packages/MyWhooshTechnologyService.MyWhoosh_eps1123pz0kt0/LocalCache/Local/MyWhoosh/Saved/PersistentDownloadDir/DefaultCache/Cycling/Workouts'

// Map category folder names to clean names
function parseCategoryFolder(folderName: string): { name: string; id: number } | null {
  const match = folderName.match(/^(.+)_Category_(\d+)$/)
  if (!match) return null
  return { name: match[1], id: parseInt(match[2]) }
}

async function importWorkouts() {
  const categoriesDir = path.join(WORKOUTS_DIR, 'Categories')

  if (!fs.existsSync(categoriesDir)) {
    console.error(`Directory not found: ${categoriesDir}`)
    process.exit(1)
  }

  const categories = fs.readdirSync(categoriesDir, { withFileTypes: true })
    .filter(d => d.isDirectory())

  let total = 0
  let imported = 0
  let skipped = 0
  let errors = 0

  for (const cat of categories) {
    const parsed = parseCategoryFolder(cat.name)
    if (!parsed) {
      console.warn(`Skipping unrecognized folder: ${cat.name}`)
      continue
    }

    const catPath = path.join(categoriesDir, cat.name)
    const files = fs.readdirSync(catPath).filter(f => f.endsWith('.json'))

    console.log(`\n📂 ${parsed.name} (${files.length} workouts)`)

    for (const file of files) {
      total++
      try {
        const filePath = path.join(catPath, file)
        const raw = fs.readFileSync(filePath, 'utf-8')
        const workout = JSON.parse(raw)

        // Check if already imported
        const existing = await prisma.mywhooshWorkout.findUnique({
          where: { mywhooshId: workout.ID }
        })

        if (existing) {
          skipped++
          continue
        }

        await prisma.mywhooshWorkout.create({
          data: {
            mywhooshId: workout.ID,
            name: workout.Name || file.replace('.json', ''),
            description: workout.Description || null,
            categoryId: parsed.id,
            categoryName: parsed.name,
            duration: workout.Time || 0,
            tss: workout.TSS || null,
            intensityFactor: workout.IF || null,
            kj: workout.KJ || null,
            stepCount: workout.StepCount || 0,
            steps: workout.WorkoutstepsTMap || [],
            authorName: workout.AuthorName || null,
            isRecovery: workout.IsRecovery === true,
          }
        })

        imported++
      } catch (e) {
        errors++
        console.error(`  ❌ Error importing ${file}:`, (e as Error).message)
      }
    }
  }

  console.log(`\n✅ Import complete:`)
  console.log(`   Total files: ${total}`)
  console.log(`   Imported: ${imported}`)
  console.log(`   Skipped (already exists): ${skipped}`)
  console.log(`   Errors: ${errors}`)
}

importWorkouts()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
