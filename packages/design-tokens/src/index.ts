export const colors = {
  ink: '#0a0a0a',
  inkSoft: '#14130f',
  inkCard: '#1a1916',
  inkLine: 'rgba(255,255,255,0.08)',
  inkLineStrong: 'rgba(255,255,255,0.16)',

  paper: '#f5f3ee',
  paperCard: '#ffffff',
  paperLine: 'rgba(10,10,10,0.08)',
  paperLineStrong: 'rgba(10,10,10,0.16)',

  lime: '#daff3f',
  limeDeep: '#b8dd1f',
  coral: '#ff6b4a',
  coralDeep: '#e54a2a',
  sky: '#7cd4ff',
  plum: '#c58cff',

  textOnDark: '#f5f3ee',
  textOnDarkMute: 'rgba(245,243,238,0.55)',
  textOnDarkFaint: 'rgba(245,243,238,0.35)',

  textOnLight: '#14130f',
  textOnLightMute: 'rgba(20,19,15,0.55)',
  textOnLightFaint: 'rgba(20,19,15,0.35)',
} as const;

export const memberPalette = [
  '#daff3f', // lime
  '#ff6b4a', // coral
  '#7cd4ff', // sky
  '#c58cff', // plum
  '#ffe066', // mustard
  '#a4f5b5', // mint
] as const;

export const radii = {
  pill: 9999,
  card: 22,
  tile: 14,
  chip: 8,
} as const;

export const fonts = {
  display: "'Inter Tight', system-ui, sans-serif",
  ui: "'Inter', system-ui, sans-serif",
  mono: "'JetBrains Mono', ui-monospace, monospace",
} as const;

export const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
export type Weekday = (typeof weekdays)[number];

export type ColorToken = keyof typeof colors;
export type MemberColor = (typeof memberPalette)[number];
