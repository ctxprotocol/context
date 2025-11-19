// lib/privy.ts
import { PrivyClient } from "@privy-io/server-auth";
import "server-only";

const privyAppId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
const privyAppSecret = process.env.PRIVY_APP_SECRET;

if (!privyAppId || !privyAppSecret) {
  throw new Error(
    "Missing required environment variables: NEXT_PUBLIC_PRIVY_APP_ID and PRIVY_APP_SECRET"
  );
}

const privy = new PrivyClient(privyAppId, privyAppSecret);

export async function verifyPrivyToken(token: string) {
  try {
    const claims = await privy.verifyAuthToken(token);
    return claims;
  } catch (error) {
    console.error("Token verification failed:", error);
    // Log more details about the error
    if (error instanceof Error) {
      console.error("Error name:", error.name);
      console.error("Error message:", error.message);
    }
    return null;
  }
}

export async function getPrivyUser(userId: string) {
  try {
    const user = await privy.getUser(userId);
    return user;
  } catch (error) {
    console.error("Failed to fetch Privy user:", error);
    if (error instanceof Error) {
      console.error("Error name:", error.name);
      console.error("Error message:", error.message);
    }
    return null;
  }
}
