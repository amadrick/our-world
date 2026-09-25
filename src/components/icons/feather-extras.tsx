import { forwardRef, type SVGAttributes } from "react";

interface IconProps extends SVGAttributes<SVGElement> {
  color?: string;
  size?: string | number;
}

// Feather has no dining, drinks, or museum glyphs; these follow its grid (24px, 2px round strokes).
function featherIcon(name: string, paths: string[]) {
  const Icon = forwardRef<SVGSVGElement, IconProps>(
    ({ color = "currentColor", size = 24, ...rest }, ref) => (
      <svg
        ref={ref}
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        {...rest}
      >
        {paths.map((d) => (
          <path key={d} d={d} />
        ))}
      </svg>
    ),
  );
  Icon.displayName = name;
  return Icon;
}

export const Utensils = featherIcon("Utensils", [
  "M5 2v5a3 3 0 0 0 6 0V2",
  "M8 2v5",
  "M8 10v12",
  "M19 22V2a4 4 0 0 0-4 4v6h4",
]);

export const Cocktail = featherIcon("Cocktail", ["M4 3h16l-8 9z", "M12 12v8", "M8 21h8"]);

export const WineGlass = featherIcon("WineGlass", ["M8 2h8v5a4 4 0 0 1-8 0z", "M12 11v10", "M8 21h8"]);

export const Bread = featherIcon("Bread", [
  "M6 10.5A3.5 3.5 0 0 1 8 4h8a3.5 3.5 0 0 1 2 6.5V19a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2z",
]);

export const Bridge = featherIcon("Bridge", [
  "M2 17h20",
  "M7 21V4",
  "M17 21V4",
  "M7 5q5 9 10 0",
  "M2 12q3.5-2 5-7",
  "M17 5q1.5 5 5 7",
]);

export const Museum = featherIcon("Museum", [
  "M12 2 3 7h18z",
  "M6 11v7",
  "M10 11v7",
  "M14 11v7",
  "M18 11v7",
  "M3 22h18",
]);

export const IceCream = featherIcon("IceCream", [
  "M17 9.5a5 5 0 1 0-10 0",
  "M6 9.5h12",
  "M7.5 9.5 12 21l4.5-11.5",
]);
