# 🚵 Ventoux Training

PWA de préparation cycliste alimentée par l'IA — conçue pour la **Gran Fondo du Mont Ventoux** et toute autre course.

## Stack

| Couche | Techno |
|--------|--------|
| Frontend | Next.js 15 (App Router) + React 19 |
| Styling | Tailwind CSS (design system custom Ventoux) |
| Auth | NextAuth.js (email + password) |
| ORM | Prisma + PostgreSQL |
| IA | Claude API (Anthropic) |
| PWA | next-pwa |
| Déploiement | Docker → Railway |

---

## 🚀 Démarrage rapide (Docker)

### 1. Prérequis

- Docker + Docker Compose
- Node.js 20+ (pour les commandes Prisma)

### 2. Configuration

```bash
cp .env.example .env
```

Éditez `.env` et remplissez :
- `NEXTAUTH_SECRET` → `openssl rand -base64 32`
- `ANTHROPIC_API_KEY` → [console.anthropic.com](https://console.anthropic.com)
- `STRAVA_CLIENT_ID` + `STRAVA_CLIENT_SECRET` → [strava.com/settings/api](https://www.strava.com/settings/api)
- `OPENWEATHER_API_KEY` → [openweathermap.org/api](https://openweathermap.org/api) (gratuit)

### 3. Lancer

```bash
docker compose up --build
```

L'app tourne sur **http://localhost:3000**

### 4. Migrations & seed

```bash
# Dans un autre terminal
docker compose exec app npx prisma migrate dev --name init
docker compose exec app npm run db:seed
```

Compte démo : `demo@ventoux.app` / `ventoux2026`

---

## 🏗️ Développement local (sans Docker)

```bash
# Install
npm install

# Base de données PostgreSQL locale
# Adapter DATABASE_URL dans .env

# Migrations
npx prisma migrate dev --name init
npx prisma generate

# Seed
npm run db:seed

# Dev server
npm run dev
```

---

## 📱 Configuration Strava

1. Aller sur [strava.com/settings/api](https://www.strava.com/settings/api)
2. Créer une application
3. **Authorization Callback Domain** : `localhost` (dev) ou votre domaine Railway (prod)
4. Copier Client ID et Client Secret dans `.env`

---

## 🚂 Déploiement Railway

```bash
# Pousser sur GitHub, puis Railway détecte le Dockerfile automatiquement

# Variables d'environnement à configurer dans Railway :
DATABASE_URL=          # Railway PostgreSQL plugin
NEXTAUTH_URL=          # https://votre-app.railway.app
NEXTAUTH_SECRET=       # openssl rand -base64 32
ANTHROPIC_API_KEY=     # votre clé
STRAVA_CLIENT_ID=
STRAVA_CLIENT_SECRET=
OPENWEATHER_API_KEY=
```

---

## 🧠 Fonctionnalités IA

### Génération du plan
Claude analyse :
- Votre profil (FTP, poids, objectif)
- Les 60 dernières activités (TSS, puissance, type)
- Vos disponibilités hebdomadaires
- Le temps jusqu'à la course

Et génère un plan structuré en phases (**Base → Build → Peak → Taper**) avec :
- Séances détaillées (type, durée, description, zone, TSS cible)
- Séances de renforcement musculaire
- Sorties extérieures vs home trainer
- Notes de coaching personnalisées

### Métriques calculées
- **TSS** (Training Stress Score) depuis NP/FTP
- **NP** (Normalized Power) depuis données brutes GPX/FIT
- **CTL/ATL/TSB** (Performance Management Chart)
- **Estimation temps Ventoux** depuis FTP + poids

---

## 📂 Structure du projet

```
ventoux-training/
├── app/
│   ├── (auth)/login|register     # Pages authentification
│   ├── (app)/dashboard|plan|activities|races|profile  # App principale
│   └── api/                      # API routes Next.js
├── components/ui/                # Composants partagés
├── lib/
│   ├── claude.ts                 # Intégration Claude API
│   ├── strava.ts                 # Strava OAuth + API
│   ├── training.ts               # Calculs TSS/PMC/zones
│   ├── parsers.ts                # Parsers GPX/FIT
│   └── weather.ts                # OpenWeatherMap
├── prisma/schema.prisma          # Modèle de données
├── types/index.ts                # Types TypeScript
└── docker-compose.yml
```

---

## 🔧 Roadmap

- [ ] Ajustement automatique du plan après chaque activité
- [ ] Intégration météo dans la suggestion des créneaux
- [ ] Chat coach (Claude) dans l'interface
- [ ] Export PDF du plan d'entraînement
- [ ] Notifications push (séance du jour)
- [ ] Segments Strava personnalisés (cols locaux)
- [ ] Comparaison avec d'autres athlètes Ventoux
