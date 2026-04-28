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

## Firebase setup

In the Firebase console:

- **Authentication** → enable Google, Email/Password (with the "Email link (passwordless sign-in)" toggle on), and Phone.
- **Auth → Settings → Authorized domains** → confirm `localhost` is listed; add your Vercel domain when you deploy.
- **Phone testing numbers** (recommended for dev) — add a fake number + code under Auth → Sign-in method → Phone.
- **Firestore** → create a database in production mode.

Then deploy the rules from this repo. With the Firebase CLI installed (`npm i -g firebase-tools && firebase login`):

```bash
firebase use --add                      # select your Firebase project
firebase deploy --only firestore:rules  # pushes firestore.rules
firebase deploy --only storage          # pushes storage.rules (after Storage is enabled in console)
```

Web SDK config goes in `apps/web/.env.local` (see `.env.local.example`).

### Meal-photo cleanup (24h auto-delete)

Meal photos go to `mealPhotos/{uid}/{mealId}.{ext}` so a Cloud Storage lifecycle
rule can target them precisely. The macros are persisted in Firestore; the
photo itself is just an input to the macro extraction and gets garbage-collected
after 24h. Apply the rule once with the `gcloud` CLI:

```bash
gcloud auth login
gcloud config set project pact-c4537                   # or your project ID
gcloud storage buckets update gs://<your-bucket-name> \
  --lifecycle-file=lifecycle.json
```

Bucket name is whatever you put in `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
(usually `<project-id>.firebasestorage.app` for newer projects, or
`<project-id>.appspot.com` for older ones). Verify it stuck:

```bash
gcloud storage buckets describe gs://<your-bucket-name> --format=json | jq .lifecycle_config
```

Lifecycle rules run at least once per day, so an object may live a few hours
past 24h before deletion — that's within the spec.

## Design source

The design hand-off (FitForge / Pact) lives outside the repo. Authoritative files:
- `design_files/README.md` — tokens, type scale, screens
- `design_files/styles.css` — canonical CSS tokens
- `design_files/primitives.jsx` — Avatar, Icon, TabBar, Card, Chip, etc.
- `design_files/screens-*.jsx` — mobile, desktop, onboarding + planning hub

The values in `packages/design-tokens` are derived from those.
