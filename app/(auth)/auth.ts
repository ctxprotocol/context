import NextAuth, { type DefaultSession } from "next-auth";
import type { DefaultJWT } from "next-auth/jwt";
import Credentials from "next-auth/providers/credentials";
// CORRECTED IMPORT: Import the specific function from queries.ts
import { findOrCreateUserByPrivyDid } from "@/lib/db/queries";
import { verifyPrivyToken } from "@/lib/privy";
import { authConfig } from "./auth.config";

export type UserType = "guest" | "regular";

declare module "next-auth" {
  interface Session extends DefaultSession {
    user: {
      id: string;
      type: UserType;
      isDeveloper: boolean;
    } & DefaultSession["user"];
  }

  // biome-ignore lint/nursery/useConsistentTypeDefinitions: "Required"
  interface User {
    id?: string;
    email?: string | null;
    type: UserType;
    isDeveloper?: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    id: string;
    type: UserType;
    isDeveloper: boolean;
  }
}

export const {
  handlers: { GET, POST },
  auth,
  signIn,
  signOut,
} = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        // We will pass the Privy token here
        token: { label: "Privy Token", type: "text" },
      },
      async authorize(credentials) {
        const authToken = credentials?.token as string | undefined;

        if (!authToken) {
          console.error("Authorization failed: No token provided");
          return null; // No token provided
        }

        // Verify the token using our utility
        const verifiedPayload = await verifyPrivyToken(authToken);

        if (!verifiedPayload) {
          console.error("Authorization failed: Token verification failed");
          return null; // Token is invalid
        }

        const privyDid = verifiedPayload.userId;

        if (!privyDid) {
          console.error("Authorization failed: No Privy DID in token payload");
          return null; // No privy DID in token
        }

        // Fetch full user data from Privy to get email and other info
        const { getPrivyUser } = await import("@/lib/privy");
        const privyUser = await getPrivyUser(privyDid);
        const email = privyUser?.email?.address;

        try {
          // Use the dedicated function from queries.ts. This is clean and follows the pattern.
          const dbUser = await findOrCreateUserByPrivyDid(privyDid, email);

          if (!dbUser) {
            return null;
          }

          // Return a user object that next-auth can use for the session
          return {
            id: dbUser.id,
            email: dbUser.email,
            type: "regular", // Assign a default user type
            isDeveloper: dbUser.isDeveloper,
          };
        } catch (error) {
          console.error("Database error during authorize:", error);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.type = user.type;
        token.isDeveloper = user.isDeveloper ?? false;
      }

      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.type = token.type;
        session.user.isDeveloper = token.isDeveloper;
      }

      return session;
    },
  },
});
