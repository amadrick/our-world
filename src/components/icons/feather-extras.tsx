import { forwardRef, type SVGAttributes } from "react";

interface IconProps extends SVGAttributes<SVGElement> {
  color?: string;
  size?: string | number;
}

// Feather has no dining or drinks glyphs; these follow its grid (24px, 2px round strokes).
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
