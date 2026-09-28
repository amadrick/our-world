import { flatLayers, type RoadId } from "./ink";
import type { MapTheme } from "./kit";

/**
 * (g) Paper: Ink's flat, minimal map in the palette of a hand-drawn field
 * atlas (Andy's reference, a biodiversity map of the Marañón valley): clean
 * cream paper, a muted slate-blue bay, sage parks, and fine warm grey-brown
 * linework. Palette only: no grain, stains, or old-map lettering.
 */
const LIGHT = {
  land: "#F3F0E7",
  blocks: "#EDE9DE",
  sand: "#EEE8D9",
  park: "#CDD1BD",
  wood: "#C3C8B1",
  water: "#A5B7C4",
  waterway: "#7F97A9",
  ferry: "#7F97A9",
  pier: "#EAE6DB",
  building: "#E8E4D8",
  path: "#C4BCAF",
  street: "#B2A99B",
  arterial: "#9F9687",
  freeway: "#8C8274",
  rail: "#CCC5B9",
  streetLabel: "#7A7266",
  hood: "#6A6258",
  labelHalo: "#F3F0E7",
  waterLabel: "#5C778C",
  parkLabel: "#66705A",
};

type PaperPalette = typeof LIGHT;

/** The same atlas at night: warm charcoal paper, a deep slate bay, dim sage, and pale taupe lines. */
const DARK: PaperPalette = {
  land: "#1F1E1B",
  blocks: "#23221F",
  sand: "#26241F",
  park: "#2C3228",
  wood: "#2A3026",
  water: "#26323D",
  waterway: "#3C5063",
  ferry: "#4A6276",
  pier: "#282622",
  building: "#282622",
  path: "#3D3A34",
  street: "#57524A",
  arterial: "#6E685E",
  freeway: "#857E72",
  rail: "#3A3732",
  streetLabel: "#A89F92",
  hood: "#C2BAAD",
  labelHalo: "#1F1E1B",
  waterLabel: "#8BA3B6",
  parkLabel: "#9CA78E",
};

const LINE: Record<RoadId, keyof PaperPalette> = {
  path: "path",
  service: "path",
  minor: "street",
  tertiary: "street",
  secondary: "arterial",
  primary: "arterial",
  freeway: "freeway",
};

export const paper: MapTheme<PaperPalette> = {
  id: "paper",
  label: "Paper",
  palettes: { light: LIGHT, dark: DARK },
  tint: {
    land: [0.25, 0.008],
    blocks: [0.25, 0.01],
    sand: [0.25, 0.01],
    pier: [0.25, 0.008],
    building: [0.25, 0.01],
    park: [0.15, 0.03],
    wood: [0.15, 0.03],
    water: [0.15, 0.03],
  },
  pitch: 0,
  layers: (C) => flatLayers(C, (road) => C[LINE[road]], { blocks: C.blocks, waterway: C.waterway }),
};
