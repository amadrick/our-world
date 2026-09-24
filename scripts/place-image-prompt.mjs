// The locked style for every place image, so all renders read as one series:
// a soft clay / matte-plastic miniature of the venue on a plain warm plate,
// inspired by the 3D clay dioramas on pengzhe.ng.

export const IMAGE_BACKGROUND = "#F2EFEA";

export const STYLE = [
  `The model sits isolated and centered on a plain warm off-white background (${IMAGE_BACKGROUND}) on a small rounded slab of sidewalk, with a soft contact shadow.`,
  "Style: soft 3D clay and matte plastic toy model, like a Blender render with soft global illumination and gentle ambient occlusion; rounded, simplified, slightly chunky geometry; warm muted pastel colors with one or two richer accents; soft late-morning daylight from the upper left.",
  "Camera: three-quarter view from slightly above; the whole model is visible and fills about two thirds of the frame, with generous empty margin on every side.",
  "No people, no faces, no cars. No readable text, letters, numbers or logos anywhere; any signs are blank shapes.",
  "Not photorealistic, no outlines, no scenery or sky behind the model.",
].join(" ");

const CATEGORY_SUBJECT = {
  restaurant: "a cozy neighborhood restaurant storefront",
  bar: "a neighborhood bar storefront with warm light inside",
  wine: "a small wine bar with shelves of bottles",
  coffee: "a small neighborhood coffee shop",
  bakery: "a small neighborhood bakery with pastries in the window",
  dessert: "a small ice cream and dessert shop",
  activity: "a favorite San Francisco spot",
  sight: "a San Francisco landmark",
};

/** What to draw when there's no hand-written hint for a place. */
export function fallbackSubject(place) {
  const subject = CATEGORY_SUBJECT[place.category] ?? "a San Francisco storefront";
  return place.neighborhood ? `${subject} in San Francisco's ${place.neighborhood}` : subject;
}

// Place names are left out on purpose: image models tend to letter them onto signs.
export function buildPrompt(subject) {
  return `A single miniature 3D clay diorama of ${subject}. ${STYLE}`;
}

export function buildPhotoPrompt(subject) {
  return `Turn this photo into a single miniature 3D clay diorama of the venue: ${subject}. Keep its recognizable shape, colors and details, fix the perspective, and leave out people and cars. ${STYLE}`;
}
