# GEMINI.md

This file provides instructional context about the project for Gemini.

## Project Overview

This is a Next.js 14 project called "Chat SDK". It's an AI chatbot template that uses the Vercel AI SDK to build powerful chatbot applications.

The project is built with the following key technologies:

*   **Framework:** Next.js 14 (with App Router)
*   **AI:** Vercel AI SDK, with support for xAI, OpenAI, and other model providers.
*   **UI:** shadcn/ui, Tailwind CSS, and Radix UI.
*   **Database:** Neon Serverless Postgres with Drizzle ORM.
*   **File Storage:** Vercel Blob.
*   **Authentication:** Auth.js.
*   **Smart Contract/Wallet Integration:** Wagmi and Viem.
*   **Testing:** Playwright for end-to-end testing and `tsx` for unit testing.

The application structure is based on the Next.js App Router, with top-level directories for `app`, `components`, `lib`, `hooks`, etc.

## Building and Running

### Environment Variables

Before running the project, you need to set up the necessary environment variables. Create a `.env.local` file in the root of the project and add the following variables:

```
# From drizzle.config.ts
POSTGRES_URL=your_postgres_connection_string

# From README.md (for non-Vercel deployments)
AI_GATEWAY_API_KEY=your_ai_gateway_api_key

# Other potential variables based on Auth.js, etc.
# Check the documentation for the specific providers you use.
```

### Key Commands

The following commands are essential for working with this project. They are defined in the `scripts` section of `package.json`.

*   **Install dependencies:**
    ```bash
    pnpm install
    ```
*   **Run the development server:**
    ```bash
    pnpm dev
    ```
    The application will be available at `http://localhost:3000`.

*   **Run database migrations:**
    ```bash
    pnpm db:migrate
    ```

*   **Build the project for production:**
    ```bash
    pnpm build
    ```

*   **Start the production server:**
    ```bash
    pnpm start
    ```

*   **Run tests:**
    ```bash
    pnpm test
    ```
    This command runs both unit tests and Playwright E2E tests.

*   **Lint and format the code:**
    *   `pnpm lint` (check for issues)
    *   `pnpm format` (fix issues)

## Development Conventions

*   **Styling:** The project uses Tailwind CSS with shadcn/ui components. Utility classes should be used for styling whenever possible.
*   **Components:** Reusable UI components are located in the `components` directory.
*   **Database:** Drizzle ORM is used for database access. The schema is defined in `lib/db/schema.ts`, and migrations are stored in `lib/db/migrations`. Use the `pnpm db:generate` command to create new migrations after schema changes.
*   **Authentication:** Authentication is handled by Auth.js. Configuration can be found in the `app/(auth)` directory.
*   **State Management:** The project uses a combination of React state, context, and SWR/React Query for data fetching and caching.
*   **Testing:** Unit tests are located in `tests/unit` and E2E tests are in `tests/e2e`. New features should be accompanied by corresponding tests.
