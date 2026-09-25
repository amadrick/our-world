// Place images show the place, never food or drink. This guard checks the
// place-specific notes that go into an image prompt (not Andy's prompt itself,
// which names food only to rule it out). Safe to import in the browser.

// Quoted text (sign lettering like "GOLDEN BOY PIZZA") is ignored, so a
// place's name on its sign never trips this.
const FOOD =
  /\b(food|meals?|dish(es)?|plates?|platters?|bowls?|cups?|mugs?|glass(es)? of|wine ?glass(es)?|pints?|drinks?|cocktails?|martinis?|lattes?|cappuccinos?|espressos?|burritos?|tacos?|sandwich(es)?|burgers?|smashburgers?|hot ?dogs?|croissants?|pastr(y|ies)|buns?|bread|loaf|loaves|baguettes?|cakes?|pies?|slices?|pizzas?|pasta|ravioli|raviolo|tortellini|spaghetti|noodles?|soups?|salads?|dumplings?|crabs?|oysters?|sushi|chickens?|wings|steaks?|ribs|fries|ice ?cream|scoops?|cones?|desserts?|salami|cheese|chips|totopos|roasts?|prime rib|pudding|spinach|sours?|coupes?|sparkling|bottles?|beers?|lagers?|ales?|teas?|juices?|sodas?|wines?(?!\s+(bars?|shops?))|cherr(y|ies)|fruits?|olives?|garnish(es)?|snacks?)\b/i;

/** The food or drink word some text mentions, if any. */
export function foodIn(text) {
  return text.replace(/"[^"]*"/g, "").match(FOOD)?.[0];
}

/** Refuses place notes that describe food or drink instead of the place itself. */
export function assertNoFood(text) {
  const word = foodIn(text);
  if (word) {
    throw new Error(
      `Refusing to draw "${word}": place images show the building or a room, never food or drink.`,
    );
  }
}

/** Every research field that reaches the image prompt, joined for the guard. */
export function researchText(research) {
  if (!research) return "";
  return [
    research.street,
    research.terrain,
    research.architecture,
    research.unique,
    ...(research.iconic ?? []),
    research.viewNote,
  ]
    .filter(Boolean)
    .join("\n");
}
