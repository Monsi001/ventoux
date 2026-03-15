// Secteurs cyclistes — centrés autour de Toulouse et des Pyrénées
// Chaque secteur = une zone avec des boucles de différentes distances

export interface Sector {
  id: string
  name: string
  region: string
  lat: number
  lng: number
  description: string
  terrain: 'flat' | 'hilly' | 'mountain'
  windExposure: 'low' | 'medium' | 'high'
  nearestStation: string
  trainFromToulouse?: string
  distanceFromToulouse?: number  // km
  routes: SectorRoute[]
}

export interface SectorRoute {
  name: string
  distance: number  // km
  elevation: number // D+
  duration: number  // minutes estimées
  waypoints: [number, number][]  // [lat, lng]
  description: string
  suitable: string[] // session types
}

export const SECTORS: Sector[] = [
  // ─── Autour de Toulouse (direct vélo) ────────────────────────────────────────
  {
    id: 'coteaux-toulouse',
    name: 'Coteaux toulousains',
    region: 'Haute-Garonne',
    lat: 43.570,
    lng: 1.500,
    description: 'Collines douces au sud-est de Toulouse. Accès direct à vélo.',
    terrain: 'hilly',
    windExposure: 'medium',
    nearestStation: 'Toulouse Matabiau',
    distanceFromToulouse: 0,
    routes: [
      {
        name: 'Boucle Castanet — Vigoulet — Lacroix-Falgarde',
        distance: 35,
        elevation: 350,
        duration: 80,
        waypoints: [
          [43.518, 1.495],   // Castanet-Tolosan
          [43.490, 1.475],   // Vigoulet-Auzil
          [43.480, 1.430],   // Lacroix-Falgarde
          [43.508, 1.448],   // Clermont-le-Fort
          [43.518, 1.495],   // Retour
        ],
        description: 'Vallonné, petites routes tranquilles, vue Pyrénées par beau temps.',
        suitable: ['ENDURANCE', 'TEMPO', 'RECOVERY'],
      },
      {
        name: 'Boucle Lauragais — Nailloux',
        distance: 65,
        elevation: 600,
        duration: 150,
        waypoints: [
          [43.518, 1.495],   // Castanet
          [43.420, 1.620],   // Nailloux
          [43.380, 1.700],   // Villefranche-de-Lauragais
          [43.450, 1.550],   // Baziège
          [43.518, 1.495],   // Retour
        ],
        description: 'Lauragais vallonné, routes de crêtes entre blé et tournesols.',
        suitable: ['ENDURANCE', 'TEMPO', 'SWEET_SPOT', 'LONG_RIDE'],
      },
    ],
  },
  {
    id: 'bouconne-save',
    name: 'Forêt de Bouconne — Vallée de la Save',
    region: 'Haute-Garonne / Gers',
    lat: 43.640,
    lng: 1.190,
    description: 'Ouest de Toulouse, plat à vallonné. Bouconne et campagne gersoise.',
    terrain: 'hilly',
    windExposure: 'medium',
    nearestStation: 'Toulouse Matabiau',
    distanceFromToulouse: 15,
    routes: [
      {
        name: 'Boucle Bouconne — L\'Isle-Jourdain',
        distance: 55,
        elevation: 400,
        duration: 130,
        waypoints: [
          [43.638, 1.240],   // Pibrac
          [43.650, 1.140],   // Forêt de Bouconne
          [43.613, 1.080],   // L'Isle-Jourdain
          [43.640, 1.160],   // Retour
          [43.638, 1.240],   // Pibrac
        ],
        description: 'Campagne gersoise, routes calmes, quelques faux-plats.',
        suitable: ['ENDURANCE', 'TEMPO', 'RECOVERY'],
      },
    ],
  },

  // ─── Comminges / Piémont pyrénéen (45min-1h TER) ────────────────────────────
  {
    id: 'comminges',
    name: 'Comminges — Saint-Bertrand',
    region: 'Haute-Garonne',
    lat: 43.030,
    lng: 0.570,
    description: 'Piémont pyrénéen, cols 2e cat, vallées profondes. Magnifique.',
    terrain: 'mountain',
    windExposure: 'low',
    nearestStation: 'Montréjeau (TER)',
    trainFromToulouse: '1h15 TER',
    distanceFromToulouse: 100,
    routes: [
      {
        name: 'Col de Menté + Col de Portet d\'Aspet',
        distance: 85,
        elevation: 2200,
        duration: 240,
        waypoints: [
          [43.030, 0.570],   // Saint-Bertrand
          [42.920, 0.695],   // Col de Menté
          [42.955, 0.740],   // Col de Portet d'Aspet
          [43.020, 0.650],   // Aspet
          [43.030, 0.570],   // Retour
        ],
        description: 'Deux cols mythiques du Tour de France. Étape de montagne complète.',
        suitable: ['THRESHOLD', 'VO2MAX', 'LONG_RIDE', 'RACE_SIM'],
      },
      {
        name: 'Vallée de la Garonne — Saint-Bertrand',
        distance: 50,
        elevation: 600,
        duration: 130,
        waypoints: [
          [43.085, 0.580],   // Montréjeau
          [43.030, 0.570],   // Saint-Bertrand
          [42.990, 0.600],   // Valcabrère
          [43.050, 0.530],   // Retour vallée
          [43.085, 0.580],   // Montréjeau
        ],
        description: 'Boucle vallonnée, cathédrale et patrimoine, routes peu fréquentées.',
        suitable: ['ENDURANCE', 'TEMPO', 'SWEET_SPOT'],
      },
    ],
  },

  // ─── Ariège (1h TER) ────────────────────────────────────────────────────────
  {
    id: 'ariege',
    name: 'Ariège — Foix / Ax-les-Thermes',
    region: 'Ariège',
    lat: 42.960,
    lng: 1.605,
    description: 'Vallées encaissées, cols d\'altitude. Sauvage et peu fréquenté.',
    terrain: 'mountain',
    windExposure: 'low',
    nearestStation: 'Foix (TER) ou Ax-les-Thermes (TER)',
    trainFromToulouse: '1h TER jusqu\'à Foix, 1h45 jusqu\'à Ax',
    distanceFromToulouse: 85,
    routes: [
      {
        name: 'Col de Port + Col de Lers',
        distance: 90,
        elevation: 2400,
        duration: 270,
        waypoints: [
          [42.960, 1.605],   // Foix
          [42.895, 1.460],   // Col de Port (1249m)
          [42.830, 1.410],   // Aulus-les-Bains
          [42.860, 1.520],   // Col de Lers (1517m)
          [42.920, 1.580],   // Retour Massat
          [42.960, 1.605],   // Foix
        ],
        description: 'Enchaînement de cols ariégeois. Routes désertes, paysages grandioses.',
        suitable: ['THRESHOLD', 'VO2MAX', 'LONG_RIDE', 'RACE_SIM'],
      },
      {
        name: 'Boucle vallée de l\'Ariège',
        distance: 45,
        elevation: 500,
        duration: 110,
        waypoints: [
          [42.960, 1.605],   // Foix
          [42.905, 1.620],   // Tarascon
          [42.870, 1.610],   // Niaux
          [42.930, 1.640],   // Retour
          [42.960, 1.605],   // Foix
        ],
        description: 'Vallée de l\'Ariège, vallonné accessible. Grottes et châteaux.',
        suitable: ['ENDURANCE', 'TEMPO', 'RECOVERY'],
      },
      {
        name: 'Plateau de Beille depuis Ax',
        distance: 50,
        elevation: 1800,
        duration: 180,
        waypoints: [
          [42.720, 1.838],   // Ax-les-Thermes
          [42.730, 1.780],   // Les Cabannes
          [42.710, 1.690],   // Plateau de Beille (1790m)
          [42.730, 1.780],   // Retour
          [42.720, 1.838],   // Ax
        ],
        description: 'Montée mythique du Tour. 16km à 7.9%. Altitude.',
        suitable: ['THRESHOLD', 'VO2MAX', 'RACE_SIM'],
      },
    ],
  },

  // ─── Luchon / Peyresourde (train + vélo) ────────────────────────────────────
  {
    id: 'luchon',
    name: 'Luchon — Peyresourde — Superbagnères',
    region: 'Haute-Garonne',
    lat: 42.790,
    lng: 0.590,
    description: 'La reine des Pyrénées. Cols HC et paysages alpins.',
    terrain: 'mountain',
    windExposure: 'low',
    nearestStation: 'Montréjeau (TER) puis 35km',
    trainFromToulouse: '1h15 TER + 35km vélo ou navette',
    distanceFromToulouse: 140,
    routes: [
      {
        name: 'Col de Peyresourde',
        distance: 60,
        elevation: 1600,
        duration: 180,
        waypoints: [
          [42.790, 0.590],   // Luchon
          [42.795, 0.510],   // Bagnères-de-Luchon centre
          [42.822, 0.455],   // Col de Peyresourde (1569m)
          [42.810, 0.500],   // Retour
          [42.790, 0.590],   // Luchon
        ],
        description: 'Col du Tour de France. 13.2km à 7.0%. Vue panoramique au sommet.',
        suitable: ['THRESHOLD', 'VO2MAX', 'LONG_RIDE', 'RACE_SIM'],
      },
      {
        name: 'Superbagnères',
        distance: 38,
        elevation: 1200,
        duration: 120,
        waypoints: [
          [42.790, 0.590],   // Luchon
          [42.770, 0.580],   // Montauban-de-Luchon
          [42.750, 0.570],   // Superbagnères (1800m)
          [42.790, 0.590],   // Retour
        ],
        description: '18km à 6.6%. Route fermée au trafic l\'été. Panorama Maladeta.',
        suitable: ['THRESHOLD', 'SWEET_SPOT', 'LONG_RIDE'],
      },
    ],
  },

  // ─── Tourmalet / Luz (TER + vélo) ───────────────────────────────────────────
  {
    id: 'tourmalet',
    name: 'Col du Tourmalet',
    region: 'Hautes-Pyrénées',
    lat: 42.870,
    lng: 0.145,
    description: 'Le plus haut col routier des Pyrénées. Mythique.',
    terrain: 'mountain',
    windExposure: 'high',
    nearestStation: 'Tarbes (TER)',
    trainFromToulouse: '1h45 TER + 40km vélo',
    distanceFromToulouse: 190,
    routes: [
      {
        name: 'Tourmalet par Luz-Saint-Sauveur',
        distance: 55,
        elevation: 1700,
        duration: 190,
        waypoints: [
          [42.870, -0.005],  // Luz-Saint-Sauveur
          [42.870, 0.050],   // Barèges
          [42.880, 0.145],   // Sommet Tourmalet (2115m)
          [42.870, 0.050],   // Retour
          [42.870, -0.005],  // Luz
        ],
        description: '17km à 7.4% depuis Luz. Col HC, 2115m. Géant des Pyrénées.',
        suitable: ['THRESHOLD', 'VO2MAX', 'RACE_SIM'],
      },
      {
        name: 'Boucle Luz — Gavarnie',
        distance: 45,
        elevation: 800,
        duration: 130,
        waypoints: [
          [42.870, -0.005],  // Luz
          [42.780, -0.010],  // Gèdre
          [42.735, 0.005],   // Gavarnie
          [42.780, -0.010],  // Retour
          [42.870, -0.005],  // Luz
        ],
        description: 'Route vers le cirque de Gavarnie. Montée régulière, paysage exceptionnel.',
        suitable: ['ENDURANCE', 'TEMPO', 'SWEET_SPOT', 'LONG_RIDE'],
      },
    ],
  },

  // ─── Montagne Noire (accessible vélo depuis Toulouse) ───────────────────────
  {
    id: 'montagne-noire',
    name: 'Montagne Noire',
    region: 'Tarn / Aude',
    lat: 43.420,
    lng: 2.250,
    description: 'Massif au sud-est de Toulouse. Belles routes forestières, dénivelé modéré.',
    terrain: 'hilly',
    windExposure: 'low',
    nearestStation: 'Castelnaudary (TER) ou Revel (car)',
    trainFromToulouse: '45min TER Castelnaudary',
    distanceFromToulouse: 60,
    routes: [
      {
        name: 'Pic de Nore depuis Mazamet',
        distance: 60,
        elevation: 1100,
        duration: 170,
        waypoints: [
          [43.490, 2.375],   // Mazamet
          [43.430, 2.460],   // Pradelles-Cabardès
          [43.420, 2.465],   // Pic de Nore (1211m)
          [43.450, 2.410],   // Retour
          [43.490, 2.375],   // Mazamet
        ],
        description: 'Point culminant de la Montagne Noire. Routes forestières calmes.',
        suitable: ['TEMPO', 'THRESHOLD', 'SWEET_SPOT', 'LONG_RIDE'],
      },
      {
        name: 'Boucle Revel — Bassin de Saint-Ferréol',
        distance: 40,
        elevation: 500,
        duration: 110,
        waypoints: [
          [43.458, 1.860],   // Revel
          [43.430, 2.000],   // Saint-Ferréol
          [43.400, 2.050],   // Sorèze
          [43.440, 1.940],   // Retour
          [43.458, 1.860],   // Revel
        ],
        description: 'Canal du Midi, lac de Saint-Ferréol, routes vallonnées.',
        suitable: ['ENDURANCE', 'TEMPO', 'RECOVERY'],
      },
    ],
  },

  // ─── Gers (plat/vallonné) ───────────────────────────────────────────────────
  {
    id: 'gers',
    name: 'Gers — Auch / Gimont',
    region: 'Gers',
    lat: 43.646,
    lng: 0.585,
    description: 'Campagne gasconne vallonnée. Routes de crêtes, peu de trafic.',
    terrain: 'hilly',
    windExposure: 'medium',
    nearestStation: 'Auch (car SNCF) ou L\'Isle-Jourdain',
    trainFromToulouse: '50min TER L\'Isle-Jourdain',
    distanceFromToulouse: 50,
    routes: [
      {
        name: 'Boucle gasconne — Gimont / Mauvezin',
        distance: 70,
        elevation: 700,
        duration: 170,
        waypoints: [
          [43.625, 0.875],   // Gimont
          [43.580, 0.720],   // Mauvezin
          [43.550, 0.800],   // Cologne
          [43.600, 0.900],   // Retour
          [43.625, 0.875],   // Gimont
        ],
        description: 'Routes de crêtes gasconnes, faux-plats, vue Pyrénées.',
        suitable: ['ENDURANCE', 'TEMPO', 'SWEET_SPOT', 'LONG_RIDE'],
      },
    ],
  },

  // ─── Ventoux (week-end long) ────────────────────────────────────────────────
  {
    id: 'ventoux-bedoin',
    name: 'Mont Ventoux — Bédoin',
    region: 'Vaucluse',
    lat: 44.126,
    lng: 5.181,
    description: 'Le Géant de Provence. Week-end long depuis Toulouse.',
    terrain: 'mountain',
    windExposure: 'high',
    nearestStation: 'Avignon TGV puis TER Carpentras',
    trainFromToulouse: '3h30 TGV + TER (week-end)',
    distanceFromToulouse: 400,
    routes: [
      {
        name: 'Bédoin — Ventoux sommet',
        distance: 52,
        elevation: 1600,
        duration: 180,
        waypoints: [
          [44.126, 5.181],
          [44.152, 5.224],
          [44.167, 5.260],
          [44.174, 5.279],
          [44.162, 5.245],
          [44.126, 5.181],
        ],
        description: 'Ascension mythique. 21km à 7.5%. L\'objectif final.',
        suitable: ['THRESHOLD', 'VO2MAX', 'LONG_RIDE', 'RACE_SIM'],
      },
      {
        name: 'Gorges de la Nesque',
        distance: 65,
        elevation: 900,
        duration: 180,
        waypoints: [
          [44.126, 5.181],
          [44.075, 5.232],
          [44.055, 5.305],
          [44.026, 5.404],
          [44.075, 5.322],
          [44.126, 5.181],
        ],
        description: 'Gorges spectaculaires, panoramique, peu de trafic.',
        suitable: ['ENDURANCE', 'TEMPO', 'SWEET_SPOT', 'LONG_RIDE'],
      },
    ],
  },
]

export function findSuitableSectors(sessionType: string, targetDuration?: number): Sector[] {
  return SECTORS.filter(sector =>
    sector.routes.some(r => {
      const matchesType = r.suitable.includes(sessionType)
      const matchesDuration = !targetDuration || Math.abs(r.duration - targetDuration) < 60
      return matchesType && matchesDuration
    })
  )
}

export function findBestRoute(sector: Sector, sessionType: string, targetDuration?: number): SectorRoute | null {
  const candidates = sector.routes.filter(r => r.suitable.includes(sessionType))
  if (candidates.length === 0) return sector.routes[0] || null
  if (!targetDuration) return candidates[0]
  return candidates.sort((a, b) =>
    Math.abs(a.duration - targetDuration) - Math.abs(b.duration - targetDuration)
  )[0]
}
