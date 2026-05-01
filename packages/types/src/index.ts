import type { MemberColor, Weekday } from '@pact/design-tokens';

export type { MemberColor, Weekday };

export type ISOWeek = `${number}-W${number}`; // e.g. "2026-W17"
export type ISODate = string;                 // YYYY-MM-DD
export type Timestamp = number;               // ms since epoch

export interface Member {
  id: string;
  name: string;
  initials: string;
  color: MemberColor;
  joinedAt: Timestamp;
}

export type ModuleKey = 'workout' | 'nutrition' | 'meds' | 'mental' | 'weight';

export interface MemberOptIn {
  memberId: string;
  modules: Record<ModuleKey, boolean>;
}

export interface Group {
  id: string;
  name: string;          // "The Hayes Pact"
  inviteCode: string;    // "HAYES-7K2"
  createdAt: Timestamp;
  memberIds: string[];   // 2–6
  optIns: MemberOptIn[];
  currentWeek: ISOWeek;
}

export type GoalKey =
  | 'get-stronger'
  | 'build-endurance'
  | 'hit-protein'
  | 'med-adherence'
  | 'mental-practice'
  | 'body-comp';

export interface PactCommitment {
  workoutsPerWeek?: number;          // "5 workouts each"
  proteinGramsDaily?: number;        // "180g protein daily"
  medsPerDay?: number;               // "7 meds taken each"
  practicesPerWeek?: number;         // "3 practices weekly"
}

export interface WeeklyPact {
  id: string;
  groupId: string;
  week: ISOWeek;
  signedAt: Timestamp;
  commitments: PactCommitment;
  memberIds: string[]; // who signed
}

export type ExerciseTag = 'push' | 'pull' | 'legs' | 'cardio' | 'rest' | 'crew';

export interface ExerciseSet {
  reps: number;
  weight: number;       // lb
  rpe?: number;
  loggedAt?: Timestamp;
}

export interface Exercise {
  id: string;
  name: string;          // "Bench Press"
  sets: ExerciseSet[];
  notes?: string;
}

export interface WorkoutSession {
  id: string;
  memberId: string;
  groupId: string;
  date: ISODate;
  title: string;         // "Push Day · Bench"
  tag: ExerciseTag;
  durationMin?: number;
  exercises: Exercise[];
}

/**
 * Shape returned by the report_workout tool when AI parses a photo or
 * description. Sets are flattened — convert to ExerciseSet on save.
 */
export interface WorkoutParseExercise {
  name: string;
  sets: Array<{ reps: number; weight: number; rpe?: number }>;
  notes?: string;
}

export interface WorkoutParseResult {
  title: string;
  tag: ExerciseTag;
  durationMin?: number;
  exercises: WorkoutParseExercise[];
  /** Low end of estimated calories burned. Optional. */
  caloriesBurnedLow?: number;
  /** High end of estimated calories burned. Optional. */
  caloriesBurnedHigh?: number;
  notes?: string;
}

export interface Macros {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export interface MealItem {
  name: string;
  portion?: string;      // "1 cup"
  grams?: number;
  macros?: Partial<Macros>;
}

/**
 * Shape returned by the /api/vision/meal endpoint. Macros are flattened on
 * each item to match what the model emits via the report_meal tool. Convert
 * to MealItem when persisting to Firestore.
 */
export interface MealParseItem {
  name: string;
  portion?: string;
  grams?: number;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export interface MealParseResult {
  items: MealParseItem[];
  totals: Macros;
  /** Low end of the AI's calorie estimate band for this meal. Optional. */
  caloriesLow?: number;
  /** High end of the AI's calorie estimate band for this meal. Optional. */
  caloriesHigh?: number;
  notes?: string;
}

export interface MealLog {
  id: string;
  memberId: string;
  groupId: string;
  loggedAt: Timestamp;
  photoUrl?: string;
  storagePath?: string;  // gs://-style path so we can revoke or move later
  items: MealParseItem[];
  totals: Macros;
  caloriesLow?: number;
  caloriesHigh?: number;
  notes?: string;
  description?: string;  // user-typed text when source === 'description'
  source: 'vision' | 'description' | 'manual';
  edited: boolean;       // true if user corrected vision output
}

export interface InventoryItem {
  id: string;
  groupId: string;
  name: string;
  quantity: number;
  unit?: string;            // "ea", "lb", "oz", "gal", "pack"
  estCost?: number;
  source?: 'receipt' | 'manual';
  receiptId?: string;       // groups items added in the same receipt scan
  addedBy?: string;         // uid
  addedAt?: Timestamp;
  updatedAt: Timestamp;
}

/** Shape returned by the report_receipt tool — flat per-line. */
export interface ReceiptParseItem {
  name: string;
  quantity: number;
  unit: string;
  estCost?: number;
}

export interface ReceiptParseResult {
  items: ReceiptParseItem[];
  store?: string;
  subtotal?: number;
  total?: number;
  notes?: string;
}

export interface ShoppingItem {
  id: string;
  groupId: string;
  listId: string;
  name: string;
  quantity: number;
  unit?: string;
  estCost?: number;
  source: 'manual' | 'recipe' | 'inventory-low';
  bought: boolean;
}

export interface ShoppingList {
  id: string;
  groupId: string;
  name: string;          // "Sunday Shop"
  shopperId: string;
  items: ShoppingItem[];
  completedAt?: Timestamp;
}

export interface MedSchedule {
  id: string;
  memberId: string;
  groupId: string;
  name: string;
  doseTimes: string[];   // ["08:00", "20:00"]
}

export interface MedAdherenceTick {
  scheduleId: string;
  date: ISODate;
  doseIndex: number;
  takenAt?: Timestamp;
}

export type MentalPractice = 'journal' | 'read' | 'meditate';

export interface PracticeTick {
  memberId: string;
  groupId: string;
  date: ISODate;
  practice: MentalPractice;
  takenAt: Timestamp;
}

export interface WeightLog {
  id: string;
  memberId: string;
  groupId: string;
  date: ISODate;            // YYYY-MM-DD local
  loggedAt: Timestamp;
  weightLb: number;
  bodyFatPct?: number;
  notes?: string;
  photoUrl?: string;
  storagePath?: string;     // gs:// path to the progress photo, owner-only readable
}

export type FeedItemKind = 'pr' | 'streak' | 'meal' | 'note';
export type Reaction = 'thumbs' | 'fire' | 'flex' | 'heart';

export interface FeedItem {
  id: string;
  groupId: string;
  authorId: string;
  kind: FeedItemKind;
  createdAt: Timestamp;
  body: string;
  payload?: Record<string, unknown>; // shape depends on `kind`
  reactions: Record<Reaction, string[]>; // memberIds who reacted
}

export interface WeekSnapshot {
  id: string;
  groupId: string;
  week: ISOWeek;
  weightDeltaLb?: number;
  workoutsCompleted: number;
  medAdherencePct: number;
  proteinHits: number;
  notes?: string;
}
