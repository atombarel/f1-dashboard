# F1 RaceView — analyse F1 100 % Cloudflare

Chaque session de F1 depuis 2023 : classement, temps au tour, course tour par tour, stratégies pneus,
direction de course, météo, **télémétrie comparée** (vitesse, gaz, frein, rapport, delta, carte de domination
par mini-secteur) et **replay** des courses.

Un seul Worker Cloudflare sert le site (assets statiques) et l'API `/api/*`.

## Architecture

```
                         ┌────────────── Cloudflare ──────────────────────────────────────┐
 visiteur ──► Worker ──► │ /api/*  Hono ─► Cache API (edge) ─► D1 (calendrier, états)       │
     ▲          │        │                                 └─► R2 (bundles gzip immuables)  │
     │          └─────── │ assets statiques (SPA, /assets/* immutable)                       │
     │                   │                                                                  │
     │                   │ Cron */10 min ─► Workflow « ingest session » (étapes + retries)  │
     │                   │                      │                                           │
     │                   │                      ▼                                           │
     │                   │          Durable Object « UpstreamGate » (1 file globale,        │
     │                   │          2 voies de priorité, ≤ 3 req/s, backoff sur 429)        │
     │                   └──────────────────────┼───────────────────────────────────────────┘
     │                                          ▼
     └──── jamais d'appel direct ─────   OpenF1 · Jolpica-F1 · MultiViewer
```

**Pourquoi c'est fiable**

- Les visiteurs ne touchent **jamais** les APIs externes : tout est servi depuis D1/R2.
- Chaque session est ingérée **une fois** (~10 requêtes + 2 par pilote pour la télémétrie), 40 min après le
  drapeau, puis une **2ᵉ passe** le lendemain pour les décisions des commissaires.
- Le Workflow découpe l'ingestion en étapes rejouables : une erreur ne relance que la requête fautive.
- Le Durable Object sérialise *toutes* les requêtes vers OpenF1 (limite 3 req/s, ~30/min), coalesce les doublons,
  et fait passer ce qu'un visiteur attend avant le backfill.
- Le classement officiel (Jolpica) est croisé avec OpenF1 : grille, statut d'abandon, points, et repli complet si
  OpenF1 n'a pas encore le résultat.

**Pourquoi c'est rapide**

- Les bundles de session, la télémétrie et le replay sont stockés **gzippés** dans R2 et envoyés tels quels
  (`encodeBody: 'manual'`), derrière des URLs versionnées par hash (`?v=…`) → `Cache-Control: immutable`.
- La télémétrie est encodée en delta (≈ 45 % plus léger que du JSON brut).
- Les endpoints issus de D1 sont mis en cache à l'edge (TTL court pendant un week-end de course, ETag/304).
- SPA découpée par route et par onglet, préchargement au survol des liens.

## Développement

```bash
npm install
cp .dev.vars.example .dev.vars       # ADMIN_TOKEN pour les endpoints /api/admin
npm run db:migrate:local
npm run dev                           # http://localhost:5173 — Worker, D1, R2, DO et Workflows en local

# amorcer les données locales
curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" localhost:5173/api/admin/sync/2026
curl localhost:5173/api/sessions/11388   # la 1re visite d'une session terminée lance son ingestion
```

`npm test` (normalisation sur de vraies données du GP de Singapour 2026), `npm run typecheck`, `npm run build`.

## Déploiement

La base D1 (`f1-api-cache-db`, reprise de la v1) est déjà déclarée et la CI crée le bucket R2 si besoin. Une seule fois :

```bash
npx wrangler login
npx wrangler secret put ADMIN_TOKEN       # optionnel : sans lui les endpoints /api/admin restent fermés
```

Ensuite chaque push sur `main` lance `.github/workflows/ci.yml` : typecheck, tests, build, migrations D1, déploiement.
Secrets GitHub nécessaires : `CLOUDFLARE_API_TOKEN` (droits Workers, D1, R2, Workflows) et `CLOUDFLARE_ACCOUNT_ID`.

Le site est servi sur **https://f1raceview.com** (l'ancien domaine `f1-api.edge-mega.com` reste branché ; routes `custom_domain` dans `wrangler.jsonc`, nécessaires aussi
pour le Cache API qui ne fonctionne pas sur `*.workers.dev`). La CI supprime l'ancien Worker
`f1-api-cache-production` qui possédait ce domaine. L'ancien projet Pages `f1-session-laps` peut être supprimé.

Chaque PR est aussi déployée en preview sur le Worker `f1-dashboard-preview` (`*.workers.dev`, env `preview` de
`wrangler.jsonc`) : mêmes D1 et R2 que la prod, donc de vraies données, mais ni cron ni endpoints admin ; le rate
limiter et les Workflows d'ingestion restent ceux du Worker de prod. L'URL est dans le résumé du job CI.

Exploitation : le secret GitHub `ADMIN_TOKEN` est poussé dans le Worker à chaque déploiement ; le workflow manuel
**Ops** (onglet Actions) affiche l'état d'ingestion et les dernières instances de Workflow.

Le cron remplit automatiquement l'historique (une saison de calendrier par passage, 3 jobs en parallèle max).

Pour accélérer le rattrapage de la télémétrie, `npm run backfill:local` fait tourner le Worker sur sa machine (env
`backfill` de `wrangler.jsonc`) contre la D1 et le R2 de prod, avec son propre rate limiter et ses propres workflows :
OpenF1 voit une autre IP, donc un autre quota. Il ne prend que des jobs de télémétrie (4 en parallèle), réservés dans
D1 comme ceux de la prod, donc jamais en double ; un job interrompu est repris par n'importe qui au bout de 2 h.
Il faut `wrangler login` et l'`ADMIN_TOKEN` de `.dev.vars` ; le script empêche la mise en veille.

## API

| Endpoint | Cache |
|---|---|
| `GET /api/home` | 30 s en week-end de course, sinon 5 min |
| `GET /api/seasons/:year` · `/api/meetings/:key` | idem |
| `GET /api/sessions/:key` → pointeurs versionnés | court |
| `GET /api/sessions/:key/bundle?v=` | immutable |
| `GET /api/sessions/:key/telemetry/:driver?v=` | immutable |
| `GET /api/sessions/:key/replay?v=` | immutable |
| `GET /api/circuits/:circuit/:year` | 1 jour |
| `GET /api/standings/:year` | 5 min (saison en cours) |
| `POST /api/admin/{sync/:year, ingest/:key, standings/:year, tick}` · `GET /api/admin/status` | `Bearer ADMIN_TOKEN` |

## Sources

[OpenF1](https://openf1.org) (tours, pneus, télémétrie, positions…), [Jolpica-F1](https://github.com/jolpica/jolpica-f1)
(classements officiels, championnats), [MultiViewer](https://multiviewer.app) (tracés des circuits).
Projet non officiel, sans lien avec Formula One Management.
