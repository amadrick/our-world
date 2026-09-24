# SF Recs

A wedding-week guide to San Francisco: Andy and Kirissa's recommendations for
restaurants, bars, coffee, activities, and sights, on a calm map that any guest
can use on a phone or a laptop. Tap a place to read their note and a short
write-up, then open it in Apple Maps or Google Maps with one tap.

- **Guests** get a full-screen map with a pin per place, filter pills
  (category, tags like _Brunch_ or _Late night_, and neighborhood), a draggable
  bottom sheet on phones, and a side panel on desktop. Every place has a
  shareable link (`/?place=zuni-cafe`).
- **Andy and Kirissa** add places at `/admin`: search by name or paste a Maps
  link, pick a category, add a note, and save. An AI summary is written once,
  when the place is added, so guests never wait on it.

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
| `OPENAI_IMAGE_MODEL` | Image model for `npm run images`. Defaults to `gpt-image-1`. |
| `NEXT_PUBLIC_MAP_TILES` | Set to `offline` to use locally generated map tiles (see below). |

## Adding a place

1. Go to `/admin` and sign in.
2. In the search box, either type a name ("Tartine Bakery") or paste a link from
   the **Share** button in Apple Maps or Google Maps. Links jump straight to the
   details. Pasted links are also what the guest buttons open, so guests land on
   the exact same place card.
3. Check the pin on the little map, pick a category, and tap any tags that fit.
4. **Known for** fills itself in: with an OpenAI key, the admin searches the web
   for the place's signature dish, drink, or room and shows a one-line reason
   under it. Edit it, tap **Look it up** again, or type your own. Without a
   key, or if nothing reliable turns up, the field says it needs a signature.
5. Optionally add your note ("Order the morning bun").
6. Tap **Write it for me** for an AI summary (or write your own), then
   **Add to the map**. If you skip the summary, one is written when you save.

Places you add show up for guests immediately. Existing places can be edited or
removed from the list below the form.

`data/places.json` holds Andy and Kirissa's list: 75 places geocoded against
OpenStreetMap and Overture Maps, each with a short neutral summary, a
researched `signatureSubject` (what it's known for), and a
`signatureRationale` (why, and according to whom). Notes are left empty for
them to write in their own words from `/admin`, and no place is marked
**Top pick** yet (that filter appears once one is).

## Place images

**Paused.** Place images are off while Andy and Kirissa choose a new visual
direction, so no images ship with the seed. The guide shows a quiet glass tile
with each place's monogram and category icon, and place details open without
a hero image.

The pipeline code is still here (`src/lib/images/`, `npm run images`), but
every render refuses unless `PLACE_IMAGE_GENERATION=on` is set, and the admin
doesn't draw anything on save. `npm run images -- <id> --import art.png` still
attaches an image made elsewhere.

### The signature pipeline

Adding a place in `/admin` runs the whole routine:

1. **Identity:** the search or pasted Maps link resolves the name, address,
   and coordinates.
2. **Research:** `POST /api/admin/signature` asks OpenAI, with web search, for
   the signature, a one-line rationale, and a drawable description
   (`src/lib/ai/signature-research.mjs`). If web search isn't available, it
   uses the model's own knowledge and flags the result. With no key it
   returns "needs a signature".
3. **Save:** the place is stored with `signatureSubject` and
   `signatureRationale`.
4. **Image (paused):** with `PLACE_IMAGE_GENERATION=on`, the admin calls
   `POST /api/admin/places/<id>/image` right after saving to draw an image
   from the signature. It's off until a new visual direction is chosen.

The same steps run in batch from the command line, which is how to backfill
once a key is in `.env.local`:

```bash
npm run signatures                      # research every place missing a signature
npm run signatures -- toronado          # redo one place
npm run signatures -- --all             # re-research everything (then: npm run images -- --all)
npm run signatures -- --dry-run zuni    # see what it finds without saving
```

### Reviewing signatures

`data/signatures.json` is the review sheet for the seed. Each place has its
subject, a one-line rationale, research confidence (`high`, `med`, or
`unreviewed`), sources, and an `approved` flag. Edit subjects or rationales
there, set `approved`, then:

```bash
npm run signatures:apply            # copy edits into data/places.json, list what changed
npm run signatures:export           # refresh the sheet after adding places in /admin
```

## How it's built

- **Next.js 16** (App Router) with TypeScript, Tailwind CSS v4, and
  [shadcn/ui](https://ui.shadcn.com) components.
- **Design:** Liquid Glass chrome over calm content, following Apple's
  [Liquid Glass](https://developer.apple.com/documentation/technologyoverviews/liquid-glass)
  and [Materials](https://developer.apple.com/design/human-interface-guidelines/materials)
  guidance (see "Liquid Glass" below). One typeface, [Inter](https://rsms.me/inter/)
  Variable (self-hosted in `public/fonts`), at weight 425 with Inter's square
  punctuation and quotes (`ss07`, `ss08`), and a four-step type scale (13, 16,
  20, 28px) defined in `src/app/globals.css`. Icons are
  [Feather](https://feathericons.com) (`react-feather`), plus a few Feather-style
  glyphs for categories Feather lacks (`src/components/icons/feather-extras.tsx`).
- **Map:** [MapLibre GL](https://maplibre.org) with "Paper", a calm custom
  style (`src/lib/map/style.ts`), on free
  [OpenFreeMap](https://openfreemap.org) tiles, so no account or key is needed.
  Map labels use the same Inter file through MapLibre's `font-faces`. Map code
  sits behind a small `MapProvider` interface (`src/lib/map/types.ts`) so Apple
  MapKit JS can be added later.
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

## Liquid Glass

Glass is the functional layer: the side panel, bottom sheet, filter pills, map
controls, buttons, popovers, dialogs, and admin chrome. It floats over the
content layer (the map, place illustrations, and the admin's blurred mosaic)
and is never applied to content itself. The primitive is a set of CSS classes in
`src/app/globals.css`, driven by variables:

| Token | Default | Role |
| --- | --- | --- |
| `--glass-blur` / `--glass-saturation` / `--glass-brightness` | 22px / 190% / 1.06 | Backdrop blur that lets color through and lifts luminosity |
| `--glass-tint` | white 50% | Regular: text-heavy chrome (panel, sheet, pills, popovers) |
| `--glass-tint-thick` | white 78% | Expanded sheet, dialogs, admin cards |
| `--glass-tint-clear` | white 14% | Clear: controls over rich media (the back button on a place image) |
| `--glass-tint-ink` | near-black 86% | The one prominent action or selection |
| `--glass-rim`, `--glass-sheen`, `--glass-glow` | | Lit edge, gradient bevel, and specular highlight |
| `--glass-edge`, `--glass-shadow` | | 0.5px outline and soft diffuse lift |

Classes: `glass` (regular), plus `glass-thick`, `glass-clear`, and `glass-ink`
modifiers; `glass-interactive` for controls that brighten and press in;
`glass-fill` for controls resting on glass (glass isn't stacked on glass); and
`scroll-edge` for sticky bars that blur content scrolling beneath them.

What follows Apple's guidance:
- The sheet floats inset at partial heights and goes edge to edge, and more
  opaque, when fully expanded.
- Corners are concentric with their containers.
- Map controls are grouped into shared capsules.
- Color stays out of the chrome so the content can tint it.

In Chromium, small controls also get an SVG edge-refraction filter
(`src/components/ui/glass-refraction.tsx`); other browsers keep the frosted
look.

Accessibility fallbacks:
- `prefers-reduced-transparency` swaps every surface for a solid, blur-free
  equivalent (so does a browser without `backdrop-filter`).
- `prefers-contrast: more` strengthens tints and edges.
- `prefers-reduced-motion` removes the press and sheet-morph animations.

## Scripts

| Command | |
| --- | --- |
| `npm run dev` | Dev server on port 4617 |
| `npm run build` / `npm start` | Production build and server (port 4617) |
| `npm run lint` / `npm run typecheck` | ESLint and TypeScript |
| `npm test` | Unit tests (Maps link parsing, filters) |
| `npm run signatures` | Research what places are known for (see The signature pipeline) |
| `npm run signatures:apply` / `:export` | Sync the signature review sheet (see Reviewing signatures) |
| `npm run images` | Generate or import place illustrations (see Place images) |
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
