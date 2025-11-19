# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is Chat SDK - a Next.js-based AI chatbot application using the Vercel AI SDK. It provides multi-modal chat capabilities with document creation, real-time streaming, and artifact generation.

## Key Architecture

### Tech Stack
- **Next.js 15** with App Router, React Server Components, and Server Actions
- **AI SDK 5.0** for unified LLM interactions (supports xAI/Grok, OpenAI, Anthropic, etc.)
- **PostgreSQL** via Drizzle ORM for data persistence
- **NextAuth** for authentication with Privy integration
- **Tailwind CSS v4** with shadcn/ui component primitives
- **Radix UI** for accessible UI components

### Application Structure

**Authentication Flow**
- Uses Privy for Wallet-based authentication via next-auth
- Credentials provider with Privy token verification
- Dual auth modes: guest (unauthenticated) and regular (wallet-connected)
- Protected routes: `/chat/:id*` requires authentication
- Auto-redirect: authenticated users going to `/login` or `/register` redirect to `/`

**Chat System**
- Two model variants: `chat-model` (Grok Vision) and `chat-model-reasoning` (Grok Reasoning)
- V2 message schema using parts: `Message_v2` table stores structured parts and attachments
- Deprecated: v1 schema with `Message` table for backward compatibility
- Real-time streaming with Server-Sent Events via `/api/chat/[id]/stream`
- Chat visibility: `public` or `private`

**Artifact System**
- Generates code, text, sheets, and images as chat artifacts
- Document-based system in `Document` table with kind: text|code|image|sheet
- Suggestion system for collaborative editing
- Client/server architecture in `artifacts/` directory

**Database Schema** (Drizzle ORM)
- `User`: users with email/password or privyDid
- `Chat`: chat sessions with visibility and lastContext tracking
- `Message_v2`: messages with parts and attachments
- `Message`: deprecated old message format
- `Vote_v2`: upvotes/downvotes on messages
- `Document`: artifact documents with composite PK (id, createdAt)
- `Suggestion`: collaborative editing suggestions
- `Stream`: active stream tracking

## Development Commands

**Setup & Running**
```bash
pnpm install
pnpm db:migrate          # Setup database or apply migrations
pnpm dev                 # Start dev server with Turbopack
pnpm build              # Build for production (runs migrations)
pnpm start              # Start production server
```

**Database**
```bash
pnpm db:generate        # Generate migration files from schema changes
pnpm db:migrate         # Run pending migrations
pnpm db:studio          # Open Drizzle Studio UI
pnpm db:push            # Push schema changes without migrations
pnpm db:pull            # Pull schema from database
pnpm db:check           # Check for schema drift
pnpm db:up              # Apply only up migrations
```

**Code Quality**
```bash
pnpm lint               # Run ultracite linter/formater (project uses ultracite instead of biome directly)
pnpm format             # Auto-fix linting/formatting issues
```

**Testing**
```bash
pnpm test               # Run all Playwright tests (sets PLAYWRIGHT=True)
```

## Critical Implementation Details

**Authentication Middleware** (middleware.ts)
- `/ping` endpoint returns "pong" for Playwright test startup
- `/api/auth/*` routes bypass auth checks
- `/chat/:id*` requires authentication (redirects to `/login`)
- `/login` and `/register` redirect authenticated users to `/`

**Message Format Migration**
- Legacy format: `message` table with `content` field
- Current format: `Message_v2` table with `parts` and `attachments`
- Old `Vote` table references deprecated `Message` table
- New `Vote_v2` references `Message_v2`

**Model Configuration**
- Default models defined in `lib/ai/models.ts`
- Uses AI Gateway via `@ai-sdk/gateway` for unified provider access
- On non-Vercel deployments, requires `AI_GATEWAY_API_KEY`
- Model selection stored in cookie: `chat-model`

**Stream Response Protocol**
- Uses Server-Sent Events for real-time streaming
- Multiple data stream types: textDelta, imageDelta, codeDelta, sheetDelta
- Artifact metadata: title, kind, clear, finish signals
- Usage tracking via `usage` data part

**Component Architecture**
- `/components/elements/` - Reusable message UI components
- `/components/ui/` - shadcn/ui primitive components
- `/artifacts/` - Client/server artifact implementations
- `/lib/ai/tools/` - AI tool definitions (weather, document operations)

**Testing Strategy**
- Playwright for E2E tests in `/tests/e2e/`
- Route/API tests in `/tests/routes/`
- Global timeout: 240 seconds
- Two test projects: `e2e` and `routes`
- Web server starts automatically with `pnpm dev` for tests