"use client";

import { useLogin, usePrivy } from "@privy-io/react-auth";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

function PrivyLoginComponent() {
  const router = useRouter();
  // 👇 Get the getAccessToken method from the usePrivy hook
  const { getAccessToken } = usePrivy();

  const { login } = useLogin({
    onComplete: async ({ user }) => {
      console.log("Privy login complete", user);
      // This function now primarily handles post-Privy-login actions

      // Get the auth token from Privy
      try {
        // 👇 Use the getAccessToken method from the hook, not the window
        const token = await getAccessToken();
        if (!token) {
          throw new Error("Could not get Privy access token");
        }

        // Use the token to sign in with our custom next-auth credentials provider
        const result = await signIn("credentials", {
          token,
          redirect: false,
        });

        if (result?.error) {
          toast.error("Could not sign you in. Please try again.");
          return;
        }

        toast.success("Successfully signed in!");
        router.refresh(); // Refresh to update server components with new session
        router.push("/"); // Redirect to the main chat page
      } catch (error) {
        console.error("Sign-in process failed:", error);
        toast.error("An error occurred during sign in.");
      }
    },
    onError: (error) => {
      // "exited_auth_flow" is not a real error - it just means the user closed the modal
      if (error === "exited_auth_flow") {
        return;
      }
      console.error("Privy login error:", error);
      toast.error("Failed to log in with Privy.");
    },
  });

  return <Button onClick={login}>Login with Wallet</Button>;
}

export default function Page() {
  return (
    <div className="flex h-dvh w-screen items-start justify-center bg-background pt-12 md:items-center md:pt-0">
      <div className="flex w-full max-w-md flex-col gap-12 overflow-hidden rounded-2xl">
        <div className="flex flex-col items-center justify-center gap-2 px-4 text-center sm:px-16">
          <h3 className="font-semibold text-xl dark:text-zinc-50">Sign In</h3>
          <p className="text-gray-500 text-sm dark:text-zinc-400">
            Sign in to get started
          </p>
        </div>
        <div className="flex flex-col items-center px-4 pb-16 sm:px-16">
          <PrivyLoginComponent />
          <p className="mt-4 text-center text-gray-600 text-sm dark:text-zinc-400">
            Login is handled securely by Privy.
          </p>
        </div>
      </div>
    </div>
  );
}
