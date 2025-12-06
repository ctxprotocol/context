"use client";

import { motion } from "framer-motion";
import { ArrowRight, Coins, Terminal, Wallet, Zap } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { useSidebar } from "@/components/ui/sidebar";
import { useContextSidebar } from "@/hooks/use-context-sidebar";

export function OnboardingHero() {
  const { setOpen: setAppSidebarOpen } = useSidebar();
  const { open: openContextSidebar } = useContextSidebar();
  const hasOpenedSidebars = useRef(false);

  // Open both sidebars on mount for new/logged out users
  // This helps them discover the connect wallet button and available tools
  useEffect(() => {
    if (hasOpenedSidebars.current) {
      return;
    }
    hasOpenedSidebars.current = true;

    // Small delay to let the intro animation start first
    const timer = setTimeout(() => {
      setAppSidebarOpen(true);
      openContextSidebar();
    }, 300);

    return () => clearTimeout(timer);
  }, [setAppSidebarOpen, openContextSidebar]);

  return (
    <div className="mx-auto flex h-full max-w-3xl flex-col justify-center px-4 md:px-8">
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
        initial={{ opacity: 0, y: 20 }}
        transition={{ duration: 0.5 }}
      >
        {/* Brand Pill */}
        <div className="mx-auto mb-6 flex w-fit items-center gap-2 rounded-full border border-border bg-background/50 px-3 py-1 font-medium text-foreground text-xs backdrop-blur-sm">
          <span className="relative flex size-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
          </span>
          Protocol Live on Base
        </div>

        {/* Headline */}
        <h1 className="mb-4 bg-gradient-to-b from-foreground via-foreground/80 to-muted-foreground bg-clip-text font-bold text-4xl text-transparent tracking-tighter md:text-6xl">
          The Marketplace for <br />
          AI Context.
        </h1>

        <p className="mx-auto mb-12 max-w-xl text-lg text-muted-foreground">
          Agents write code to buy the data LLMs lack. Users pay per response.
          Developers monetize every run.
        </p>

        {/* The 3-Step Flow Cards */}
        <div className="mb-12 grid grid-cols-1 gap-4 md:grid-cols-3">
          <StepCard
            delay={0.1}
            description="Sign in to create your embedded smart wallet instantly."
            icon={<Wallet className="size-5 text-blue-500" />}
            title="1. Connect"
          />
          <StepCard
            delay={0.2}
            description="Add USDC on Base. We sponsor the gas fees."
            icon={<Coins className="size-5 text-amber-500" />}
            title="2. Fund"
          />
          <StepCard
            delay={0.3}
            description="Ask anything. The agent buys the data it needs."
            icon={<Zap className="size-5 text-emerald-500" />}
            title="3. Auto Mode"
          />
        </div>

        {/* Developer Footer */}
        <motion.div
          animate={{ opacity: 1 }}
          className="flex flex-col items-center gap-4 border-border border-t pt-8"
          initial={{ opacity: 0 }}
          transition={{ delay: 0.5 }}
        >
          <p className="text-muted-foreground text-sm">Are you a developer?</p>
          <div className="flex gap-3">
            <Link
              className="flex items-center gap-2 rounded-md bg-secondary px-3 py-1.5 font-medium text-secondary-foreground text-xs transition-colors hover:bg-secondary/80"
              href="/contribute"
            >
              <Terminal className="size-3" />
              List a Tool
            </Link>
            <Link
              className="flex items-center gap-2 rounded-md bg-secondary px-3 py-1.5 font-medium text-secondary-foreground text-xs transition-colors hover:bg-secondary/80"
              href="https://github.com/ctxprotocol/sdk"
              target="_blank"
            >
              <ArrowRight className="size-3" />
              Get the SDK
            </Link>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}

function StepCard({
  icon,
  title,
  description,
  delay,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  delay: number;
}) {
  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      className="group relative overflow-hidden rounded-xl border border-border bg-card p-4 text-left shadow-sm transition-all hover:border-ring/20 hover:shadow-md"
      initial={{ opacity: 0, y: 10 }}
      transition={{ delay, duration: 0.5 }}
    >
      <div className="mb-2 flex size-8 items-center justify-center rounded-lg bg-muted">
        {icon}
      </div>
      <h3 className="mb-1 font-semibold text-card-foreground text-sm">
        {title}
      </h3>
      <p className="text-muted-foreground text-xs leading-relaxed">
        {description}
      </p>
    </motion.div>
  );
}
