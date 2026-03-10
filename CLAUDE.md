# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Sci-Fi Studio is a web app for creating sci-fi storybooks and short videos using GenAI (Gemini and Claude).

## Build Commands

```bash
npm run dev      # Start development server
npm run build    # Production build
npm run preview  # Preview production build
```

## Deployment

Production is deployed to Firebase Hosting at: https://sci-fi-studio.web.app/

```bash
# Deploy frontend
npm run build && npx firebase deploy --only hosting

# Deploy Cloud Functions
cd functions && npm run build && npx firebase deploy --only functions
```

## Architecture

- **Frontend**: React 18 + TypeScript + Ant Design
- **Backend**: Firebase (Firestore, Authentication with Google Sign-In, Hosting)
- **Build Tool**: Vite
- **AI Integration**: Gemini API, Claude API (Anthropic)

### Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── layout/          # App shell, navigation (AppLayout.tsx)
│   └── common/          # Buttons, cards, modals
├── pages/               # Route-level components
│   ├── Home/            # Project list
│   ├── StoryEditor/     # Story creation
│   └── VideoEditor/     # Video creation
├── services/            # External service integrations
│   ├── firebase.ts      # Firebase config & initialization
│   ├── auth.ts          # Authentication (Google Sign-In)
│   ├── firestore.ts     # Firestore CRUD operations
│   ├── gemini.ts        # Gemini API client
│   └── claude.ts        # Claude API client
├── hooks/               # Custom React hooks
│   └── useAuth.ts       # Auth state hook
├── contexts/            # React contexts
│   └── AuthContext.tsx  # Auth provider
├── types/               # TypeScript type definitions
├── utils/               # Helper functions
├── App.tsx              # Root component with routing
├── main.tsx             # Entry point
└── index.css            # Global styles
```

## Environment Variables

Create a `.env.local` file with:

```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_GEMINI_API_KEY=
VITE_CLAUDE_API_KEY=
```
