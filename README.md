# SF Recs

A wedding-week guide to San Francisco: Andy's favorite restaurants, bars, coffee,
activities, and sights on an elegant map that any guest can use on a phone or a
laptop. Tap a place to read Andy's note and a short write-up, then open it in
Apple Maps or Google Maps with one tap.

- **Guests** get a full-screen map with color-coded pins, filter pills
  (category, tags like _Brunch_ or _Late night_, and neighborhood), a draggable
  bottom sheet on phones, and a side panel on desktop. Every place has a
  shareable link (`/?place=zuni-cafe`).
- **Andy** adds places at `/admin`: search by name or paste a Maps link, pick a
  category, add a note, and save. An AI summary is written once, when the place
  is added, so guests never wait on it.

## Run it locally

Requires Node.js 20.9 or newer.

```bash
npm install
npm run dev
```

Open http://localhost:4617 for the guide and http://localhost:4617/admin to add
places. The app works without any setup. Add keys whenever you're ready (next
section).

## Settings

Copy `.env.example` to `.env.local` and fill in what you need, then restart
`npm run dev`.

| Variable | What it does |
| --- | --- |
| `OPENAI_API_KEY` | Writes place summaries when you add a place. Without it, new places get a clearly marked placeholder you can edit. |
| `OPENAI_MODEL` | Model for summaries. Defaults to `gpt-5-mini`. |
| `ADMIN_PASSWORD` | Password for `/admin`. Locally it defaults to `goldengate`. A deployed site keeps `/admin` locked until this is set. |
| `PLACES_FILE` | Where places are stored. Defaults to `data/places.json`. |
| `NEXT_PUBLIC_MAP_TILES` | Set to `offline` to use locally generated map tiles (see below). |

## Adding a place

1. Go to `/admin` and sign in.
2. In the search box, either type a name ("Tartine Bakery") or paste a link from
   the **Share** button in Apple Maps or Google Maps. Links jump straight to the
   details. Pasted links are also what the guest buttons open, so guests land on
   the exact same place card.
3. Check the pin on the little map, pick a category, and tap any tags that fit.
4. Optionally add your note ("Order the morning bun").
5. Tap **Write it for me** for an AI summary (or write your own), then
   **Add to the map**. If you skip the summary, one is written when you save.

Places you add show up for guests immediately. Existing places can be edited or
removed from the list below the form.

The 18 starter places in `data/places.json` include short practical notes and a
few **Andy's pick** tags as a starting point. Edit or remove them from `/admin`
so the notes are in your own words.

## How it's built

- **Next.js 16** (App Router) with TypeScript, Tailwind CSS v4, and
  [shadcn/ui](https://ui.shadcn.com) components.
- **Map:** [MapLibre GL](https://maplibre.org) with a custom, muted,
  Apple Maps–inspired style (`src/lib/map/style.ts`) on free
  [OpenFreeMap](https://openfreemap.org) tiles, so no account or key is needed.
  Map code sits behind a small `MapProvider` interface (`src/lib/map/types.ts`)
  so Apple MapKit JS can be added later.
- **Data:** a JSON file behind a `PlaceStore` interface (`src/lib/storage`), so
  it can be swapped for hosted storage when the site is deployed.
- **Place search:** [Photon](https://photon.komoot.io) with a
  [Nominatim](https://nominatim.org) fallback (both OpenStreetMap, no key).
  Apple and Google Maps links are parsed locally (`src/lib/geo/maps-links.ts`),
  and short links (`maps.app.goo.gl`, `maps.apple/p/…`) are expanded
  server-side. Neighborhoods come from SF Planning boundaries when the geocoder
  doesn't supply one.
- **Summaries:** OpenAI Chat Completions (`src/lib/ai/summary.ts`), called once
  per place from the admin.

```
data/places.json            the places guests see
src/app/page.tsx            guest map
src/app/admin/page.tsx      add / edit places
src/app/api/admin/*         admin API (session, lookup, summary, places)
src/components/explorer/*   map, pins, filters, list, detail, bottom sheet
src/components/admin/*      admin sign-in, form, and place list
src/config/site.ts          title and copy shown to guests
```

## Scripts

| Command | |
| --- | --- |
| `npm run dev` | Dev server on port 4617 |
| `npm run build` / `npm start` | Production build and server (port 4617) |
| `npm run lint` / `npm run typecheck` | ESLint and TypeScript |
| `npm test` | Unit tests (Maps link parsing, filters) |
| `npm run tiles:offline` | Download an offline copy of the SF basemap (see below) |

## Offline map tiles

If your network blocks `tiles.openfreemap.org` (some offices and cloud sandboxes
do), run `npm run tiles:offline`. It builds a ~22 MB copy of the San Francisco
basemap in `public/offline-tiles/` from the public
[Protomaps](https://protomaps.com) OpenStreetMap build, converted to the same
schema so the map looks the same. Then set `NEXT_PUBLIC_MAP_TILES=offline` in
`.env.local`.

## Deploying (later)

The app runs on Vercel as-is for guests. Adding places needs writable storage,
which Vercel's filesystem isn't, so the deploy step swaps `JsonPlaceStore` for a
hosted store (for example Vercel KV or Postgres) behind the same `PlaceStore`
interface. Set `ADMIN_PASSWORD` and `OPENAI_API_KEY` in the Vercel project.
