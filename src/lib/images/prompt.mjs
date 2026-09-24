// The locked style for every place image, so all stills read as one series:
// a soft clay product-illustration of what the place is known for (a dish, a
// drink, or a room), cut out on bright white like the stills on pengzhe.ng.
// Shared by `npm run images` and the admin's add flow.

export const STYLE = [
  "Pure bright white background with nothing else in the frame.",
  "Square composition: the subject is centered and fills about three quarters of the frame, with even white margin and a soft, diffuse contact shadow beneath it.",
  "Camera: front or gentle three-quarter view from slightly above, orthographic-like with almost no perspective distortion, like a product illustration rather than a dramatic photo.",
  "Lighting: diffuse, even studio light with soft shadows.",
  "Materials: matte clay and soft plastic, like a Blender toy model, with simplified, slightly chunky forms and moderate realism in texture (crumb, char, glaze, foam, wood grain).",
  "Palette: warm, gently muted natural colors, with the subject's own colors as the accent.",
  "No people, hands, or faces. No text, lettering, logos, or brand marks.",
].join(" ");

const SCENE = {
  object: "shown on its own as a single product-illustration subject",
  room: "built as a small cutaway diorama (a floor and one or two walls) shown on its own",
};

const CATEGORY_ITEM = {
  restaurant: "the house specialty dish",
  bar: "the house cocktail",
  wine: "a glass of wine with a bottle",
  coffee: "the house coffee drink",
  bakery: "the signature pastry",
  dessert: "the signature scoop of ice cream",
  activity: "a small keepsake object",
  sight: "a small model of the landmark",
};

/**
 * What to draw when there's no hand-written hint: the researched signature
 * subject if there is one, otherwise something generic for the category.
 */
export function fallbackHint(place) {
  const item = place.signatureSubject || CATEGORY_ITEM[place.category] || "the house specialty";
  return { visual: `${item}, the signature of ${place.name} in San Francisco`, scene: "object" };
}

function subject({ visual, scene }) {
  return `${visual}, ${SCENE[scene] ?? SCENE.object}`;
}

export function buildPrompt(hint) {
  return `A stylized 3D clay still of ${subject(hint)}. ${STYLE}`;
}

export function buildReferencePrompt(hint) {
  return `Match the rendering style, camera, lighting, materials, and white background of the reference images exactly, but depict a different subject: ${subject(hint)}. ${STYLE}`;
}

export function buildPhotoPrompt(hint) {
  return `Turn this photo into a stylized 3D clay still of ${subject(hint)}. Keep its recognizable shapes and colors and leave out people. ${STYLE}`;
}
