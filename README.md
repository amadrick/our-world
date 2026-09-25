# SF Recs

A wedding-week guide to San Francisco: Andy and Kirissa's recommendations for
restaurants, bars, coffee and tea, shops, museums, and things to do, on a calm map that any guest
can use on a phone or a laptop. Tap a place to read their note and a short
write-up, then open it in Apple Maps or Google Maps with one tap.

- **Guests** flip between **List** and **Map** with one tap on the switch
  floating at the bottom of the screen, and the guide remembers their choice.
  List is a grid of place pictures; Map is a full-screen map with a pin
  per place, a slim list rail beside it on desktop, and a draggable sheet for
  the open place on phones. A category row (the food and drink sections, then
  _Shops_, _Museums_, and _Parks_), a neighborhood picker, and six
  pills (_Andy's favorites_, _Dinner_, _Lunch_, _Late night_, _Brunch_,
  _Views_) work in both.
  Every place has a shareable link (`/?place=zuni-cafe`).
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

`data/places.json` holds Andy and Kirissa's list: 93 places (restaurants, bars,
cafés, shops, two museums, and two parks) geocoded against OpenStreetMap and
Overture Maps, each with a short neutral summary, a
researched `signatureSubject` (what it's known for), a `signatureRationale`
(why, and according to whom), and `placeResearch` (what it looks like, with
sources). `data/places.md` is the readable version of all of it, one section
per place. Pill tags come from each place's current hours, menus, and sources:
_Late night_ means posted hours that run past 11pm (to 11:30pm or later) on at
least two nights a week, and _Views_ means a view the sources call out. Notes
are left empty for them to write in their own words from `/admin`. 45 places
are **Andy's picks** (`andyFavorite`): they get an "Andy's pick" badge, a star
on their pin, and the _Andy's favorites_ pill at the start of the pill row.
Where Andy named a dish or drink, it is what the place shows as Known for.

## Place images

Every place has a square picture of the place itself, drawn from Andy's prompt:
a grainy, hazy, slightly dreamlike take on a Kodak 35mm photo of the real facade
or room, "a visually heightened memory of the actual restaurant." The files are
`public/places/<id>-<hash>.webp` (960×960). A place without one (say, one just
added in `/admin` while rendering is off) shows a sand tile with its category
glyph (and "Picture coming soon" at full size).

**The prompt is Andy's, verbatim.** It lives in
`src/lib/images/kodak-place-prompt.md`. The only edits are filling in
`[RESTAURANT NAME]` with the place's name and `[CITY]` with San Francisco
(`src/lib/images/prompt.mjs`); change the picture's style by editing that file,
not the code. After it, separated by a `---` line, comes a block of reference
notes from the place's research, so the picture is of this place and not a
generic storefront. The street address and house numbers are left out, because
image models paint them onto walls. Models also like to letter "SAN FRANCISCO"
under the name on a sign, so look over each new picture and redraw it if one
does:

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
npm run images -- --colors              # resample every place's page color
```

Saving a picture also samples its **page color** (`imageColor`), the
background its detail page sits on: the photo's biggest color outside the
film's amber cast (a green awning, a pink facade, blue tile), normalized to a
dark shade that keeps white text above 10:1 (`src/lib/images/palette.mjs`).
It's stored with the place, so pages render in it from the first paint.

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
- **Design:** Liquid Glass and color, after Apple Music's album pages (see
  "Design system" below), in light and dark. One typeface,
  [Inter](https://rsms.me/inter/) Variable (self-hosted in `public/fonts`),
  with Inter's square punctuation and quotes (`ss07`, `ss08`). Icons are
  [Feather](https://feathericons.com) (`react-feather`), plus a few
  Feather-style glyphs Feather lacks (`src/components/icons/feather-extras.tsx`),
  including the Golden Gate on the "All" tab.
- **Map:** [MapLibre GL](https://maplibre.org) on free
  [OpenFreeMap](https://openfreemap.org) tiles, so no account or key is needed,
  styled by one of three designed basemaps (`src/lib/map/themes/`, see Map
  below). Map labels use Inter and Newsreader files from `public/fonts`
  through MapLibre's `font-faces`. Map code sits behind a small `MapProvider`
  interface (`src/lib/map/types.ts`) so Apple MapKit JS can be added later.
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

Photos and color first, with as few containers as possible. Content sits on a
warm canvas (`#F5F4F1`, near-black in dark mode; the map's land is a slightly warmer cream)
or directly on a place's color; the controls that float over it are glass.
One ink color (`#222`, `#F2F2F3` in dark) carries text, the primary action,
and selection. Tokens live in `src/app/globals.css`; dark mode follows the
system (`prefers-color-scheme`), map included.

| Token | Values | Used for |
| --- | --- | --- |
| Type (`text-*`) | sm 14/20, base 16/24, lg 20/26, xl 28/32, 2xl 40/44 | Meta and chips; body and buttons; panel titles; place and phone page titles; the desktop page title |
| Weight (`font-*`) | normal 425, medium 550, semibold 650 | Body; chips and labels; titles and buttons |
| Radius (`rounded-*`) | sm 8, md 12, lg 16, xl 20, 2xl 24, full | Inner bits; thumbnails and menu rows; buttons; listing pictures; panels and sheets; chips, switch, pins, round buttons |
| Glass | `glass` (+ `-thick`, `-fill`), `glass-bar`, `glass-media`, `glass-tinted`, `tinted-sheet` | Switch, map rail and controls, menus; pills; the sticky filter bars; controls over photos; controls on a place's color; the phone map sheet |
| Color | `ink`, `on-ink`, `muted-foreground`, `hover`, `canvas`, `surface`, `photo`, each place's `imageColor` | |

- **Place details:** everything sits right on the place's sampled color,
  with no card: Andy's pick, the name, category and neighborhood, a bright
  Apple Maps pill beside a glass Google Maps pill, what it's known for, the
  tags, the note, the write-up, and the address.
  - Phones (Apple Music style): the photo runs edge to edge under the status
    bar and the round smoked-glass back, share, and map buttons, and only its
    last stretch melts into the color, through a short, light progressive blur
    (a few stacked `backdrop-filter` layers) with the color gathering over it.
  - Wider screens: a rounded square photo on the left with a soft, low halo of
    its own colors (drawn from a tiny thumbnail), and everything else beside
    it on the right; both start at the top under the buttons, centered as one
    unit. The List | Map switch floats at the bottom over a plain fade of the
    page color, and the page ends with room to clear it.
  - The phone map sheet and the desktop map rail: the photo on top, edge to
    edge, its last 30% softening through the same light progressive blur as
    it fades into the place's color; then the name with Andy's
    pick, the Apple Maps and Google Maps pills right under it, and the rest.
    Opening staggers them in (see Motion).
  - Stepping between places: on phones, swipe the map sheet or the place page
    left or right for the next or previous place, in the list's current
    order; on the map, that pin opens and the camera glides to it. On wider
    screens, the arrow keys and the small glass chevrons beside Share do the
    same.
- **List:** a faint glow behind the title in the colors of Andy's picks'
  photos (pale on the light page, deep on the dark one), easing out well
  before the first row of cards. The category row and glass pills sit on it;
  the bar turns to glass once cards scroll under it. Cards are the square picture, name, and two
  muted lines, with a smoked-glass "Andy's pick" badge.
- **List | Map switch:** a glass capsule floating bottom center with an ink
  thumb that slides to the selected mode (arrow keys work).
- **Map:** three basemap directions, each in light and dark, switchable with a
  hidden `?map=` parameter (remembered for the session) for comparing them:
  - `a` **Golden hour film** (the default): warm cream land, a deep teal bay
    that pales in the shallows over a sandy shore, sage and olive parks with a
    fine film grain, terracotta and ochre arterials, soft building footprints,
    and the Golden Gate Bridge in International Orange.
  - `b` **Editorial cartography**: a printed city map. Paper land and clear
    water with engraved water lines along the coast, hairline streets,
    neighborhood names in the Newsreader serif as the hero labels, districts
    in spaced capitals, water and parks in italic, no points of interest.
  - `c` **Dimensional city**: the hills shaded from the USGS elevation model in
    warm western light, buildings extruded in sandstone tones with rounded
    corners, a slight tilt when the map frames a neighborhood or a place, and
    the landmarks and hills marked by name.

  Basemap labels never sit under a pin or its name: each pin has an invisible
  collision footprint the map places before its own labels. There's a glass
  rail on desktop, glass zoom buttons, and a glass filter bar on phones. Each pin is
  the place's own photo (a ~2 KB thumbnail, fetched only once it's shown) in
  a ring of its page color, so the map, the list, and the page share color;
  up close the name sits beside it in a pill of the same color, and Andy's
  picks carry a star. Across the city, pins are dots of that color. Where
  photos would pile up (Valencia, Mission Street) the rest step down to dots
  (`src/lib/map/pin-layout.ts`). The open place's pin grows with a white ring,
  and the whole basemap crossfades to a faint wash of its color (a deep one in
  dark mode) at the same lightness, so labels read the same. In dark mode pin
  colors are lifted and outlined so they don't sink into the land.
- Pills with nothing to show in the current section are dimmed, and if a
  section comes up empty for pills already on, the empty state offers the
  matches in other sections instead of a dead end.
- While a picture loads its tile is a neutral grey (on a detail page, the
  place's color), so dark film photos don't flash in from white.

- **Place colors** (`src/lib/images/palette.mjs`): each photo's own color,
  looking past the film's amber cast, made livelier in OKLCH. The hue stays;
  chroma comes from the color's most vivid pixels, times `1 + VIVIDNESS` (0.2,
  the one knob), within a floor (so a muddy photo still gets a real color) and
  a cap (no neon), at the lightest shade white text keeps AA on.
  `npm run images -- --colors` resamples every place after a change.

## Motion

Named with Emil Kowalski's animation vocabulary
(`.cursor/skills/animation-vocabulary`). Only transform and opacity animate,
except the 420ms color transition between places.

- Opening a place in the map sheet or rail: a scale in and fade in on the
  photo (640ms) and a stagger of enters (rise and fade) for the name, the
  actions, and each row (520ms each, 110ms in, 55ms apart), on a soft
  ease-out (`cubic-bezier(0.22, 1, 0.36, 1)`).
- Switching places: a crossfade of the photo (420ms) and a quicker re-stagger
  (360ms, 35ms apart). Closing the sheet slides it out and fades it (240ms).
- Swiping: the content follows the finger, the photo at 0.55x for parallax,
  locked to one axis so it never fights scrolling or the sheet drag. Past the
  ends it rubber-bands. Let go past 22% of the width, or with a flick faster
  than 0.4 px/ms, and it flings out (170ms) while the next place slides in
  from that side (a direction-aware transition); otherwise it springs back
  (340ms). The neighbors' photos are fetched ahead, so none arrives empty.

Accessibility:
- Text on glass and on page colors is checked for contrast: white text and
  its 70% tint keep AA on every page color, and on the dark map's lifted pins.
- `prefers-reduced-transparency` (and browsers without `backdrop-filter`) get
  solid surfaces in place of glass, and a place's photo fades into its color
  without the blur.
- `prefers-contrast: more` thickens glass and darkens muted text, borders,
  and hairlines, in light and dark.
- `prefers-reduced-motion` removes the press, hover-zoom, thumb-slide, and
  sheet animations; entrances become a short fade, and swipes settle
  instantly with no parallax.

## Scripts

| Command | |
| --- | --- |
| `npm run dev` | Dev server on port 4617 |
| `npm run build` / `npm start` | Production build and server (port 4617) |
| `npm run lint` / `npm run typecheck` | ESLint and TypeScript |
| `npm test` | Unit tests (Maps link parsing, filters, data, prompt, page colors, research, map styles, swipe) |
| `npm run research` | Research what places are known for and look like (see The research pipeline) |
| `npm run signatures:apply` / `:export` | Sync the signature review sheet (see Reviewing signatures) |
| `npm run places:md` | Rewrite `data/places.md` from `data/places.json` |
| `npm run images` | Generate or import place pictures (see Place images) |
| `npm run tiles:offline` | Download an offline copy of the SF basemap (see below) |
| `npm run terrain:offline` | Rebuild the hillshade elevation tiles (see below) |

## Offline map tiles

If your network blocks `tiles.openfreemap.org` (some offices and cloud sandboxes
do), run `npm run tiles:offline`. It builds a ~22 MB copy of the San Francisco
basemap in `public/offline-tiles/` from the public
[Protomaps](https://protomaps.com) OpenStreetMap build, converted to the same
schema so the map looks the same. Then set `NEXT_PUBLIC_MAP_TILES=offline` in
`.env.local`.

The dimensional basemap's hills come from `public/offline-terrain/` (1.5 MB,
checked in), which `npm run terrain:offline` builds from the
[USGS 3DEP](https://www.usgs.gov/3d-elevation-program) 1 arc-second elevation
model. Without it, that basemap simply skips the hillshade.

## Deploying (later)

The app runs on Vercel as-is for guests. Adding places needs writable storage,
which Vercel's filesystem isn't, so the deploy step swaps `JsonPlaceStore` for a
hosted store (for example Vercel KV or Postgres) behind the same `PlaceStore`
interface. Set `ADMIN_PASSWORD` and `OPENAI_API_KEY` in the Vercel project.
