# Ventoux Training

## Ports (les ports par défaut sont occupés par suivi_objectif)
- **App** : `3002` (au lieu de 3000)
- **PostgreSQL** : `5433` (au lieu de 5432)

## Lancement
```bash
docker compose up -d
```

## Base de données
- **Hébergée sur Railway** (prod + dev partagent la même DB)
- `DATABASE_URL` dans `.env` pointe sur Railway, pas sur le Postgres local
- Conséquence : toute migration touche directement la prod → toujours valider avant de lancer `prisma migrate` ou `db push`
- Pour un changement de schéma : créer la migration SQL manuellement et la faire valider avant exécution

## Credentials demo
- Email : `demo@ventoux.app`
- Mot de passe : `ventoux2026`

## MyWhoosh Workouts
- 731 workouts importés depuis le cache local MyWhoosh
- Import : `npm run db:import-mywhoosh`
- Les séances vélo indoor sont sélectionnées automatiquement dans le catalogue (lib/workout-matcher.ts)
- Les séances de renfo sont générées par l'IA (lib/claude.ts)
- Prisma singleton dans `lib/db.ts`

## Règles UI
- Toujours pointer les erreurs constatées AVANT de corriger, attendre validation
- Les jours de la semaine s'affichent en français (LUN, MAR, MER, JEU, VEN, SAM, DIM)
- Les séances prévues doivent être triées par jour (lundi → dimanche)

## Git workflow
- Créer une branche pour chaque nouvelle feature importante (`feat/nom-feature`)
- Merger dans `main` une fois terminé et testé
- **Ne JAMAIS pousser (`git push`) sans confirmation explicite de l'utilisateur**
