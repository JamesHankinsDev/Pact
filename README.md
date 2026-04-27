# Pact

A community fitness platform for small groups (2–6 people: households, training partners, roommates). One shared dashboard for workouts, nutrition, meds/supplements, mental practices, weight, and a group feed.

## Stack

- **Web** — Next.js 15 (App Router) + Tailwind CSS v4 — `apps/web`
- **Mobile** — Expo / React Native — `apps/mobile` *(coming in phase 2)*
- **Auth + DB** — Firebase Auth + Firestore
- **Hosting** — Vercel (web)

## Layout

```
pact/
├── apps/
│   └── web/             Next.js 15 — desktop dashboard, onboarding, planning hub
├── packages/
│   ├── design-tokens/   colors, typography, spacing, radii (single source of truth)
│   └── types/           shared domain types (Group, Member, Pact, Workout, Meal, ...)
├── pnpm-workspace.yaml
└── tsconfig.base.json
```

## Getting started

```bash
pnpm install
cp apps/web/.env.local.example apps/web/.env.local   # fill in Firebase config
pnpm dev
```

The web app boots at http://localhost:3000.

## Design source

The design hand-off (FitForge / Pact) lives outside the repo. Authoritative files:
- `design_files/README.md` — tokens, type scale, screens
- `design_files/styles.css` — canonical CSS tokens
- `design_files/primitives.jsx` — Avatar, Icon, TabBar, Card, Chip, etc.
- `design_files/screens-*.jsx` — mobile, desktop, onboarding + planning hub

The values in `packages/design-tokens` are derived from those.
