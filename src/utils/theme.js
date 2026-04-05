export const APPEARANCE_MODE_SYSTEM = "system";
export const APPEARANCE_MODE_LIGHT = "light";
export const APPEARANCE_MODE_DARK = "dark";

export const APPEARANCE_MODE_OPTIONS = [
  APPEARANCE_MODE_SYSTEM,
  APPEARANCE_MODE_LIGHT,
  APPEARANCE_MODE_DARK,
];

export const APPEARANCE_MODE_LABELS = {
  [APPEARANCE_MODE_SYSTEM]: "System",
  [APPEARANCE_MODE_LIGHT]: "Light",
  [APPEARANCE_MODE_DARK]: "Dark",
};

const darkTheme = {
  scheme: APPEARANCE_MODE_DARK,
  background: "#0b0b0b",
  surface: "rgba(255,255,255,0.06)",
  surfaceStrong: "rgba(255,255,255,0.08)",
  surfaceElevated: "rgba(15,20,31,0.95)",
  border: "rgba(255,255,255,0.16)",
  borderStrong: "rgba(255,255,255,0.2)",
  textPrimary: "#f4f7ff",
  textSecondary: "rgba(255,255,255,0.75)",
  textMuted: "rgba(255,255,255,0.52)",
  placeholder: "rgba(255,255,255,0.45)",
  accentText: "#b4c7ff",
  selectedBackground: "rgba(146,173,255,0.2)",
  selectedBorder: "rgba(185,203,255,0.7)",
  selectedText: "#dfe9ff",
  dangerSurface: "rgba(128,31,31,0.32)",
  dangerBorder: "rgba(255,130,130,0.5)",
  dangerText: "#ffd6d6",
  subtleDangerSurface: "rgba(128,25,25,0.18)",
  subtleDangerBorder: "rgba(255,120,120,0.55)",
  subtleDangerText: "#ffc7c7",
  hintSurface: "rgba(12,15,24,0.9)",
  hintBorder: "rgba(255,255,255,0.14)",
  errorSurface: "rgba(37,16,20,0.94)",
  errorBorder: "rgba(255,153,153,0.38)",
  errorText: "#ffd2d2",
  inputSurface: "rgba(255,255,255,0.03)",
  inputBorder: "#2c2c2c",
  separator: "#2f2f2f",
  loadingSurface: "rgba(15,19,28,0.9)",
  loadingBorder: "rgba(255,255,255,0.15)",
  loadingSpinner: "#d3ddff",
  loadingText: "#e9edff",
  bubbleLabel: "#ffffff",
  selectedBubbleStroke: "#ffffff",
  selectedBubbleFill: "rgba(255,255,255,0.26)",
  fabText: "#ffffff",
};

const lightTheme = {
  scheme: APPEARANCE_MODE_LIGHT,
  background: "#f3f6fb",
  surface: "rgba(20,32,52,0.05)",
  surfaceStrong: "rgba(20,32,52,0.08)",
  surfaceElevated: "rgba(255,255,255,0.98)",
  border: "rgba(20,32,52,0.16)",
  borderStrong: "rgba(20,32,52,0.24)",
  textPrimary: "#132238",
  textSecondary: "rgba(19,34,56,0.8)",
  textMuted: "rgba(19,34,56,0.58)",
  placeholder: "rgba(19,34,56,0.45)",
  accentText: "#3d5fa6",
  selectedBackground: "rgba(88,123,214,0.16)",
  selectedBorder: "rgba(65,97,180,0.62)",
  selectedText: "#2f4a8b",
  dangerSurface: "rgba(197,50,50,0.13)",
  dangerBorder: "rgba(184,39,39,0.5)",
  dangerText: "#8a2121",
  subtleDangerSurface: "rgba(197,50,50,0.1)",
  subtleDangerBorder: "rgba(184,39,39,0.45)",
  subtleDangerText: "#8a2121",
  hintSurface: "rgba(255,255,255,0.97)",
  hintBorder: "rgba(20,32,52,0.14)",
  errorSurface: "rgba(255,245,245,0.98)",
  errorBorder: "rgba(184,39,39,0.28)",
  errorText: "#8a2121",
  inputSurface: "rgba(20,32,52,0.03)",
  inputBorder: "rgba(20,32,52,0.18)",
  separator: "rgba(20,32,52,0.24)",
  loadingSurface: "rgba(255,255,255,0.98)",
  loadingBorder: "rgba(20,32,52,0.16)",
  loadingSpinner: "#3d5fa6",
  loadingText: "#233a66",
  bubbleLabel: "#0e1b2f",
  selectedBubbleStroke: "#24447f",
  selectedBubbleFill: "rgba(72,110,194,0.2)",
  fabText: "#132238",
};

export const getThemeForScheme = (scheme) => (scheme === APPEARANCE_MODE_LIGHT ? lightTheme : darkTheme);

export const isValidAppearanceMode = (mode) => APPEARANCE_MODE_OPTIONS.includes(mode);
