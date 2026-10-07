/** Curated accents: readable colors for each appearance and darker solid buttons. */
export const accentColors = [
  { id: "forest", name: "Forest", light: [63, 111, 90], dark: [116, 186, 143], solid: [36, 84, 63] },
  { id: "teal", name: "Teal", light: [13, 128, 118], dark: [66, 197, 182], solid: [15, 103, 95] },
  { id: "blue", name: "Blue", light: [53, 111, 212], dark: [116, 163, 255], solid: [38, 87, 173] },
  { id: "violet", name: "Violet", light: [128, 92, 201], dark: [177, 152, 242], solid: [105, 67, 174] },
  { id: "rose", name: "Rose", light: [193, 78, 113], dark: [236, 140, 173], solid: [163, 48, 84] },
  { id: "orange", name: "Orange", light: [176, 80, 22], dark: [242, 161, 101], solid: [150, 62, 18] },
  { id: "amber", name: "Amber", light: [151, 106, 14], dark: [230, 192, 97], solid: [125, 85, 9] },
  { id: "graphite", name: "Graphite", light: [91, 104, 123], dark: [166, 181, 203], solid: [67, 79, 99] }
] as const;

export type AccentColor = (typeof accentColors)[number]["id"];
export const defaultAccentColor: AccentColor = "forest";

export function isAccentColor(value: unknown): value is AccentColor {
  return typeof value === "string" && accentColors.some((color) => color.id === value);
}
