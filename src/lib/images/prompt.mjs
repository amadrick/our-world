// The locked style for every place image: a soft clay still of the place as a
// space (its facade, storefront, patio, courtyard, or a signature room), cut
// out on bright white like the stills on pengzhe.ng. Never food or drink.
// Shared by `npm run images` and the admin.

export const STYLE = [
  "Pure bright white background with nothing else in the frame: no sky, no street, no neighboring buildings.",
  "Square composition: the subject is centered and fills about 80% of the width, with even white margin and a thin strip of pale sidewalk or floor beneath it with a soft, diffuse contact shadow.",
  "Camera: straight-on front elevation or a gentle three-quarter view at eye level, orthographic-like with almost no perspective distortion, like a product illustration rather than a dramatic photo.",
  "Lighting: diffuse, even studio light with soft shadows.",
  "Materials: matte clay and soft plastic, like a Blender toy model, with moderate realism in windows, plants, and textures such as brick, stucco, wood, and tile.",
  "Simplified, blocky architecture with crisp facade and signage details.",
  "Palette: muted beige, gray, warm brown, and off-white, with one restrained accent color from the venue.",
  "No people, faces, cars, or animals. No food, drinks, plates, cups, or glasses anywhere; tables and counters are bare.",
].join(" ");

const SCENE = {
  facade: "A stylized 3D clay still of a single building",
  interior:
    "A stylized 3D clay still of a single room, built as a small cutaway diorama with a floor and two walls and no signs or lettering",
};

// Food and drink words. Quoted text (sign lettering like "GOLDEN BOY PIZZA") is
// ignored, so a place's name never trips this.
const FOOD =
  /\b(food|meals?|dish(es)?|plates?|platters?|bowls?|cups?|mugs?|glass(es)? of|wine ?glass(es)?|pints?|drinks?|cocktails?|martinis?|lattes?|cappuccinos?|espressos?|burritos?|tacos?|sandwich(es)?|burgers?|smashburgers?|hot ?dogs?|croissants?|pastr(y|ies)|buns?|bread|loaf|loaves|baguettes?|cakes?|pies?|slices?|pizzas?|pasta|ravioli|raviolo|tortellini|spaghetti|noodles?|soups?|salads?|dumplings?|crabs?|oysters?|sushi|chickens?|wings|steaks?|ribs|fries|ice ?cream|scoops?|cones?|desserts?|salami|cheese|chips|totopos|roasts?|prime rib|pudding|spinach|sours?|coupes?|sparkling|bottles?|beers?|lagers?|ales?|teas?|juices?|sodas?|wines?(?!\s+(bars?|shops?))|cherr(y|ies)|fruits?|olives?|garnish(es)?|snacks?)\b/i;

/** The food or drink word a visual brief mentions, if any. */
export function foodIn(subject) {
  return subject.replace(/"[^"]*"/g, "").match(FOOD)?.[0];
}

/** Refuses any image brief that describes food or drink instead of the place itself. */
export function assertArchitecture(subject) {
  const word = foodIn(subject);
  if (word) {
    throw new Error(
      `Refusing to draw "${word}": place images show the facade or a room, never food or drink.`,
    );
  }
}

const CATEGORY_FACADE = {
  restaurant: "a neighborhood restaurant storefront",
  bar: "a neighborhood bar storefront with warm light in the windows",
  wine: "a small wine bar storefront with wooden shelves visible inside",
  coffee: "a small neighborhood café storefront",
  bakery: "a small neighborhood bakery storefront",
  dessert: "a small neighborhood shop storefront",
  activity: "a small San Francisco building",
  sight: "a San Francisco landmark building",
};

/** The place's visual brief, or a plain storefront with its name when there isn't one. */
export function placeVisual(place) {
  if (place.placeVisualSubject) {
    return { subject: place.placeVisualSubject, scene: place.placeVisualScene === "interior" ? "interior" : "facade" };
  }
  const facade = CATEGORY_FACADE[place.category] ?? "a San Francisco storefront";
  const where = place.neighborhood ? ` in San Francisco's ${place.neighborhood}` : "";
  const sign = place.name.toUpperCase().replace(/"/g, "");
  return { subject: `${facade}${where}, with a simple crisp sign that reads "${sign}"`, scene: "facade" };
}

export function buildPrompt({ subject, scene }) {
  assertArchitecture(subject);
  return `${SCENE[scene] ?? SCENE.facade}: ${subject}. ${STYLE}`;
}

export function buildPhotoPrompt({ subject, scene }) {
  assertArchitecture(subject);
  return `Turn this photo into ${(SCENE[scene] ?? SCENE.facade).replace(/^A /, "a ")}: ${subject}. Keep its recognizable shape, colors, and signage, square it up to the camera, and leave out people, cars, and any food or drink. ${STYLE}`;
}

export function buildReferencePrompt({ subject, scene }) {
  assertArchitecture(subject);
  return `Match the rendering style, camera, lighting, materials, and white background of the reference images exactly, but depict a different place. ${buildPrompt({ subject, scene })}`;
}
