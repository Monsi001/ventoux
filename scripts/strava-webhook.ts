/**
 * Script pour gérer l'abonnement webhook Strava
 *
 * Usage:
 *   npm run strava:webhook:create   — Créer l'abonnement
 *   npm run strava:webhook:view     — Voir l'abonnement actuel
 *   npm run strava:webhook:delete   — Supprimer l'abonnement
 */

import 'dotenv/config'

const STRAVA_API = 'https://www.strava.com/api/v3'
const action = process.argv[2] || 'view'

const CLIENT_ID = process.env.STRAVA_CLIENT_ID
const CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET
const VERIFY_TOKEN = process.env.STRAVA_WEBHOOK_VERIFY_TOKEN
const CALLBACK_URL = `${process.env.NEXTAUTH_URL}/api/strava/webhook`

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('❌ STRAVA_CLIENT_ID et STRAVA_CLIENT_SECRET requis dans .env')
  process.exit(1)
}

async function createSubscription() {
  if (!VERIFY_TOKEN) {
    console.error('❌ STRAVA_WEBHOOK_VERIFY_TOKEN requis dans .env')
    process.exit(1)
  }

  console.log(`📡 Création du webhook Strava...`)
  console.log(`   Callback: ${CALLBACK_URL}`)

  const res = await fetch(`${STRAVA_API}/push_subscriptions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      callback_url: CALLBACK_URL,
      verify_token: VERIFY_TOKEN,
    }),
  })

  const data = await res.json()
  if (res.ok) {
    console.log(`✅ Webhook créé ! Subscription ID: ${data.id}`)
  } else {
    console.error('❌ Erreur:', data)
  }
}

async function viewSubscription() {
  const res = await fetch(
    `${STRAVA_API}/push_subscriptions?client_id=${CLIENT_ID}&client_secret=${CLIENT_SECRET}`
  )
  const data = await res.json()

  if (Array.isArray(data) && data.length > 0) {
    console.log('📡 Abonnement webhook actif:')
    for (const sub of data) {
      console.log(`   ID: ${sub.id}`)
      console.log(`   Callback: ${sub.callback_url}`)
      console.log(`   Créé le: ${new Date(sub.created_at).toLocaleString('fr-FR')}`)
    }
  } else {
    console.log('⚠️  Aucun abonnement webhook actif')
  }
}

async function deleteSubscription() {
  // D'abord récupérer l'ID
  const res = await fetch(
    `${STRAVA_API}/push_subscriptions?client_id=${CLIENT_ID}&client_secret=${CLIENT_SECRET}`
  )
  const subs = await res.json()

  if (!Array.isArray(subs) || subs.length === 0) {
    console.log('⚠️  Aucun abonnement à supprimer')
    return
  }

  for (const sub of subs) {
    const delRes = await fetch(`${STRAVA_API}/push_subscriptions/${sub.id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
      }),
    })

    if (delRes.ok || delRes.status === 204) {
      console.log(`✅ Abonnement ${sub.id} supprimé`)
    } else {
      const err = await delRes.text()
      console.error(`❌ Erreur suppression ${sub.id}:`, err)
    }
  }
}

switch (action) {
  case 'create':
    createSubscription()
    break
  case 'view':
    viewSubscription()
    break
  case 'delete':
    deleteSubscription()
    break
  default:
    console.log('Usage: tsx scripts/strava-webhook.ts [create|view|delete]')
}
