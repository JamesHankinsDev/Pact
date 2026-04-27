// Mock data used during scaffolding — replaced with Firestore reads once auth/data lands.

export const PACT_MEMBERS = [
  { id: 'jm', name: 'James',  initials: 'J', color: '#daff3f' },
  { id: 'sa', name: 'Sara',   initials: 'S', color: '#ff6b4a' },
  { id: 'mk', name: 'Marcus', initials: 'M', color: '#7cd4ff' },
  { id: 'el', name: 'Elena',  initials: 'E', color: '#c58cff' },
  { id: 'th', name: 'Theo',   initials: 'T', color: '#ffe066' },
  { id: 'ay', name: 'Ayo',    initials: 'A', color: '#a4f5b5' },
] as const;

export type MockMember = (typeof PACT_MEMBERS)[number];

export const SAMPLE_CONTACTS: Array<{
  id: string;
  name: string;
  sub: string;
  color: string;
}> = [
  { id: 'sa', name: 'Sara Hayes',  sub: 'Spouse · same household', color: '#ff6b4a' },
  { id: 'mk', name: 'Marcus Lin',  sub: 'Lifting partner',          color: '#7cd4ff' },
  { id: 'el', name: 'Elena Park',  sub: 'On Pact already',           color: '#c58cff' },
];

export type GoalOption = {
  id: 'lift' | 'run' | 'protein' | 'meds' | 'mind' | 'weight';
  title: string;
  sub: string;
  icon: 'dumbbell' | 'run' | 'bowl' | 'pill' | 'book' | 'weight';
  color: string;
};

export const GOAL_OPTIONS: GoalOption[] = [
  { id: 'lift',    title: 'Get stronger',    sub: 'Lift 3–5×/wk',        icon: 'dumbbell', color: '#daff3f' },
  { id: 'run',     title: 'Build endurance', sub: 'Run, ride, row',       icon: 'run',      color: '#7cd4ff' },
  { id: 'protein', title: 'Hit protein',     sub: 'Track macros',         icon: 'bowl',     color: '#ff6b4a' },
  { id: 'meds',    title: 'Med adherence',   sub: 'GLP-1, supplements',   icon: 'pill',     color: '#c58cff' },
  { id: 'mind',    title: 'Mental practice', sub: 'Journal, read, breathe', icon: 'book',   color: '#ffe066' },
  { id: 'weight',  title: 'Body comp',       sub: 'Weight, measurements', icon: 'weight',   color: '#a4f5b5' },
];
