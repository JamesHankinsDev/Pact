// Mock data used during scaffolding — replaced with Firestore reads when
// auth + currentGroupId are wired into the mobile app (next chunk).

export const PACT_MEMBERS = [
  { id: 'jm', name: 'James',  initials: 'J', color: '#daff3f' },
  { id: 'sa', name: 'Sara',   initials: 'S', color: '#ff6b4a' },
  { id: 'mk', name: 'Marcus', initials: 'M', color: '#7cd4ff' },
  { id: 'el', name: 'Elena',  initials: 'E', color: '#c58cff' },
  { id: 'th', name: 'Theo',   initials: 'T', color: '#ffe066' },
  { id: 'ay', name: 'Ayo',    initials: 'A', color: '#a4f5b5' },
] as const;

export type MockMember = (typeof PACT_MEMBERS)[number];
