# EzeeVote Online Voting System

EzeeVote is now structured as a full Next.js App Router project using TypeScript and TailwindCSS.

The old static frontend based on `frontend/index.html`, `frontend/app.js`, and `frontend/styles.css` is no longer part of the active application. The active UI now lives in the root Next.js app.

## Current structure

```text
Online-Voting-System/
|- app/
|- components/
|- lib/
|- .env.example
|- .env.local.example
|- next.config.ts
|- tailwind.config.ts
|- tsconfig.json
|- package.json
`- README.md
```

## Run the project

```bash
npm install
npm run dev
```

## Firebase environment variables

Use `.env.local` for your local Next.js environment. Start from `.env.local.example`.

```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_firebase_app_id
JWT_SECRET=your_server_side_jwt_secret
FIREBASE_ADMIN_PROJECT_ID=your-project-id
FIREBASE_ADMIN_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project-id.iam.gserviceaccount.com
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

## Notes

- HTML is now represented by React components and App Router pages.
- CSS is now handled through TailwindCSS and `app/globals.css`.
- The current landing/dashboard UI is in `app/page.tsx` with reusable components under `components/`.
- The dashboard subscribes to Firestore document `dashboard/public`.
- Voting is enforced server-side through `app/api/vote/route.ts`.
- Cross-device one-vote-per-user uses Firestore `votes` documents keyed by `{electionId}_{userId}`.
- Every accepted vote writes an `auditLogs` document.

## Firestore document shape

Create a document at `dashboard/public` with this shape:

```ts
{
  election: {
    id: "lok-sabha-2026",
    title: "National Election 2026",
    status: "active", // draft | active | closed
    allowVoting: true
  },
  updatedAt: "2026-03-10T21:00:00.000Z",
  stats: [{ label: "Total Voters", value: "248,920", change: "+4.2% verified", tone: "primary" }],
  candidates: [
    {
      id: "cand-1",
      name: "Narendra Modi",
      party: "Bharatiya Janata Party",
      percentage: 38,
      votes: 76534,
      image: "/assets/Leaders/modi.jpg",
      symbol: "/assets/party-symbols/bjp.png"
    }
  ],
  adminTasks: [
    { title: "Manage Elections", description: "Create and manage election cycles.", status: "12 active boards" }
  ],
  liveFeed: [{ region: "North District", turnout: 84, ballots: 42318 }]
}
```

## Firestore collections added in Phase 1

- `dashboard/public`: public dashboard state and active election metadata
- `votes/{electionId}_{userId}`: one persistent vote record per user per election
- `auditLogs/{autoId}`: append-only vote activity log

## Rules

Deploy [firestore.rules](/c:/Users/Main/Desktop/Online-Voting-System/firestore.rules) so:

- authenticated users can read the dashboard
- vote writes are server-only
- audit logs are server-only
