# SF Recs

A wedding-week guide to San Francisco: Andy and Kirissa's recommendations for
restaurants, bars, coffee and tea, shops, and things to do, on a calm map that any guest
can use on a phone or a laptop. Tap a place to read their note and a short
write-up, then open it in Apple Maps or Google Maps with one tap.

- **Guests** flip between **List** and **Map** with one tap on the switch
  floating at the bottom of the screen, and the guide remembers their choice.
  List is a grid of place pictures; Map is a full-screen map with a pin
  per place, a slim list rail beside it on desktop, and a draggable sheet for
  the open place on phones. Filter pills (category, tags like _Brunch_ or
  _Late night_, and neighborhood) work in both. Every place has a shareable
  link (`/?place=zuni-cafe`).
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
| `OPENAI_API_KEY` | Writes place summaries and researches new places when you add them. Without it, new places get a clearly marked placeholder you can edit. |
| `OPENAI_MODEL` | Model for summaries and research. Defaults to `gpt-5-mini`. |
| `ADMIN_PASSWORD` | Password for `/admin`. Locally it defaults to `goldengate`. A deployed site keeps `/admin` locked until this is set. |
| `PLACES_FILE` | Where places are stored. Defaults to `data/places.json`. |
| `OPENAI_IMAGE_MODEL` | Image model for `npm run images`. Defaults to `gpt-image-1`. |
| `PLACE_IMAGE_GENERATION` | Set to `on` to draw place pictures (from the admin and `npm run images`). Off by default so nothing spends image budget by accident. |
| `NEXT_PUBLIC_MAP_TILES` | Set to `offline` to use locally generated map tiles (see below). |

## Adding a place

1. Go to `/admin` and sign in.
2. In the search box, either type a name ("Tartine Bakery") or paste a link from
   the **Share** button in Apple Maps or Google Maps. Links jump straight to the
   details. Pasted links are also what the guest buttons open, so guests land on
   the exact same place card.
3. Check the pin on the little map, pick a category, and tap any tags that fit.
4. **Known for** and **Image notes** fill themselves in: with an OpenAI key,
   the admin searches the web for the place's signature dish, drink, or room,
   and for what the place physically looks like (its street, terrain,
   architecture, and 2–4 most iconic details, with sources). Edit either, tap
   **Look it up** again, or type your own. Without a key, or if nothing
   reliable turns up, the field says it needs a signature.
5. Optionally add your note ("Order the morning bun").
6. Tap **Write it for me** for an AI summary (or write your own), then
   **Add to the map**. If you skip the summary, one is written when you save.

Places you add show up for guests immediately. Existing places can be edited or
removed from the list below the form.

`data/places.json` holds Andy and Kirissa's list: 94 places (restaurants, bars,
cafés, shops, and a few outdoor places) geocoded against OpenStreetMap and
Overture Maps, each with a short neutral summary, a
researched `signatureSubject` (what it's known for), a `signatureRationale`
(why, and according to whom), and `placeResearch` (what it looks like, with
sources). `data/places.md` is the readable version of all of it, one section
per place. Notes are left empty for them to write in their own words from
`/admin`, and no place is marked **Top pick** yet (that filter appears once
one is).

## Place images

Each of the original 72 places has a square picture of the place itself, drawn
from Andy's prompt: a grainy, hazy, slightly dreamlike take on a Kodak 35mm
photo of the real facade or room, "a visually heightened memory of the actual
restaurant." The files are `public/places/<id>-<hash>.webp` (960×960). The 22
places added on September 25 have no picture yet, while Andy chooses between
this style and a one-color risograph style; until then, a place without one
shows a sand tile with its category glyph (and "Picture coming soon" at full
size).

**The prompt is Andy's, verbatim.** It lives in
`src/lib/images/kodak-place-prompt.md`. The only edits are filling in
`[RESTAURANT NAME]` with the place's name and `[CITY]` with San Francisco
(`src/lib/images/prompt.mjs`); change the picture's style by editing that file,
not the code. After it, separated by a `---` line, comes a block of reference
notes from the place's research, so the picture is of this place and not a
generic storefront. The street address is left out, because image models paint
it onto walls:

```text
Reference notes for this place:
- Neighborhood and street: …
- Terrain and setting: …
- Architecture: …
- Unique architectural notes: …
- Most iconic physical characteristics: …; …; …
- Most recognizable view: the facade
```

**Never food.** The reference notes are checked before anything is rendered:
notes that mention food or drink are refused (`src/lib/images/food-guard.mjs`),
research drops any sentence that does, the admin warns while you type, and
saving such notes fails. Sign lettering in quotes is exempt, so "GOLDEN BOY
PIZZA" on a sign is fine.

Rendering stays gated: nothing is drawn unless `PLACE_IMAGE_GENERATION=on` and
`OPENAI_API_KEY` are set.

```bash
npm run images                          # draw every place that has no image yet
npm run images -- tartine-bakery        # redraw one place
npm run images -- --all                 # redraw everything
npm run images -- --print zuni          # show the full prompt as it would be sent
npm run images -- --all --out prompts/  # write every full prompt to prompts/<id>.txt
npm run images -- zuni --photo zuni.jpg # also send your own photo of the place as a reference
npm run images -- zuni --import art.png # attach an image made elsewhere (no key needed)
npm run images -- --all --import-dir art/  # attach art/<id>.png for each place
```

### The research pipeline

Adding a place in `/admin` runs the whole routine:

1. **Identity:** the search or pasted Maps link resolves the name, address,
   and coordinates.
2. **Research:** `POST /api/admin/research` asks OpenAI, with web search, for
   the signature, a one-line rationale, and the place research: street
   context, terrain, architecture, anything one of a kind, the 2–4 most iconic
   physical details, whether the facade or the interior is more recognizable,
   sources, and what couldn't be verified (`src/lib/ai/place-research.mjs`).
   If web search isn't available, it uses the model's own knowledge and flags
   the result. With no key it returns "needs a signature".
3. **Save:** the place is stored with `signatureSubject`,
   `signatureRationale`, and `placeResearch`, all editable in the form.
4. **Image:** with `PLACE_IMAGE_GENERATION=on`, the admin calls
   `POST /api/admin/places/<id>/image` right after saving a new place, or one
   whose name, address, or image notes changed. It sends Andy's prompt plus
   the reference notes and returns 422 if the notes describe food. The render
   runs after the save because it takes up to a minute, so the place appears
   at once and its picture a moment later.

The same steps run in batch from the command line, which is how to backfill
once a key is in `.env.local`:

```bash
npm run research                        # research every place missing a signature or research
npm run research -- toronado            # redo one place
npm run research -- --images            # ...and draw their pictures (gated as above)
npm run research -- --all               # re-research everything (then: npm run images -- --all)
npm run research -- --dry-run zuni      # see what it finds without saving
npm run places:md                       # then refresh data/places.md
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

Both also rewrite `data/places.md`.

## How it's built

- **Next.js 16** (App Router) with TypeScript, Tailwind CSS v4, and
  [shadcn/ui](https://ui.shadcn.com) components.
- **Design:** solid, contained surfaces with big, tactile controls, in the
  spirit of Airbnb (see "Design system" below). One typeface,
  [Inter](https://rsms.me/inter/) Variable (self-hosted in `public/fonts`),
  with Inter's square punctuation and quotes (`ss07`, `ss08`). Icons are
  [Feather](https://feathericons.com) (`react-feather`), plus a few
  Feather-style glyphs Feather lacks (`src/components/icons/feather-extras.tsx`),
  including the Golden Gate on the "All" tab.
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
src/components/explorer/*   map, pins, filters, list, detail, sheet, List | Map switch
src/components/admin/*      admin sign-in, form, and place list
src/config/site.ts          title and copy shown to guests
```

## Design system

The guest guide is built from solid white surfaces on one warm canvas (the
same `#F5F4F1` as the map's land), with a single ink color (`#222`) for text,
the primary action, and selection. Every piece of content sits in a bounded
surface: the list header band, listing pictures, the map rail, the phone sheet,
the details panel, and the sticky action bar. Tokens live in
`src/app/globals.css`.

| Token | Values | Used for |
| --- | --- | --- |
| Type (`text-*`) | sm 14/20, base 16/24, lg 20/26, xl 28/32, 2xl 40/44 | Meta and chips; body and buttons; panel titles; place and phone page titles; the desktop page title |
| Weight (`font-*`) | normal 425, medium 550, semibold 650 | Body; chips and labels; titles and buttons |
| Radius (`rounded-*`) | sm 8, md 12, lg 16, xl 20, 2xl 24, full | Inner bits; thumbnails and menu rows; buttons and highlight tiles; listing pictures; panels, sheets, and the details card; chips, switch, pins, icon buttons |
| Spacing | 4px grid (mostly 8, 12, 16, 24, 32) | Section rhythm is 24px with hairline dividers |
| Elevation (`shadow-*`) | `card`, `float`, `raised`, `pin`, `bar` | Resting cards; floating controls; the rail, sheet, and popovers; map markers; the sticky phone action bar |
| Color | `ink` #222, `muted-foreground` #6A6A6A, `border` #DDD, `hairline` #EBEBEB, `canvas` #F5F4F1, `surface` #FFF | |

Controls:
- **Buttons** (`src/components/ui/button.tsx`): solid ink for the primary
  action, a crisp 1px ink outline for the secondary one. 48px by default and
  56px (`size="lg"`) for the place actions, with a 16px radius. Every control
  sinks slightly when pressed (`pressable`) and shows a 2px ink focus ring
  (`focus-ring`).
- **Category row:** a glyph over each label, underlined in ink when selected,
  like Airbnb's category bar. **Chips** below it (neighborhood and tags, each
  with an icon) are 44px pills with a 1px outline that invert to ink when on.
  Both rows scroll sideways on narrow screens, fading only on the side with more
  to see, with chevron buttons for mouse users (`scroll-row.tsx`).
- **Listing cards:** the square picture on top (20px radius, a hairline inner
  edge so white-backed pictures still read as tiles), then the name in
  semibold and two muted lines: what it's known for, and category ·
  neighborhood. A top pick gets a white badge on the picture.
- **List | Map switch:** a 56px ink capsule floating bottom center, with a
  white thumb that slides to the selected mode (arrow keys work). On desktop
  map mode it centers over the map, beside the rail. It steps aside on phones
  while a place is open, where the action bar takes its spot.
- **Map pins:** price-pill-style markers. Zoomed out past the city they are
  small ink dots; at city zoom, a white capsule with the category glyph; up
  close, the glyph plus the name. Hovered and selected pins always show the
  name; the selected one inverts to ink.
- **Place details:** category and neighborhood, then the name, then "Open in
  Apple Maps" (solid, full width) above "Open in Google Maps" (outline). Below
  that, sections divided by hairlines: a "Known for" highlight with the tags as
  icon pills, the hosts' note, the write-up, and the address with a copy
  button. On phones the picture stacks above the details card and both map
  buttons sit in a sticky bottom bar; in the map sheet the name rides in the
  sheet's header and the buttons stay pinned at its foot, so a peeking sheet
  reads like a listing card.

Accessibility:
- `prefers-reduced-motion` removes the press, hover-zoom, thumb-slide, and
  sheet animations.
- `prefers-contrast: more` darkens muted text, borders, and hairlines.
- Surfaces are opaque, so there is nothing to lose under
  `prefers-reduced-transparency`.

The admin keeps its Liquid Glass chrome over the image mosaic (`glass`,
`glass-thick`, `glass-fill`, and friends in `globals.css`), with solid
fallbacks under `prefers-reduced-transparency` and in browsers without
`backdrop-filter`.

## Scripts

| Command | |
| --- | --- |
| `npm run dev` | Dev server on port 4617 |
| `npm run build` / `npm start` | Production build and server (port 4617) |
| `npm run lint` / `npm run typecheck` | ESLint and TypeScript |
| `npm test` | Unit tests (Maps link parsing, filters, prompt, research) |
| `npm run research` | Research what places are known for and look like (see The research pipeline) |
| `npm run signatures:apply` / `:export` | Sync the signature review sheet (see Reviewing signatures) |
| `npm run places:md` | Rewrite `data/places.md` from `data/places.json` |
| `npm run images` | Generate or import place pictures (see Place images) |
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
