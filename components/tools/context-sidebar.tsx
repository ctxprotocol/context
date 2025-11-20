"use client";

import Link from "next/link";
import { type CSSProperties, useMemo, useState } from "react";
// No router needed here; navigation handled elsewhere if needed
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInput,
  SidebarMenu,
  useSidebar,
} from "@/components/ui/sidebar";
import { useSessionTools } from "@/hooks/use-session-tools";
import { cn } from "@/lib/utils";
import { CrossIcon, LoaderIcon } from "../icons";
import { Button } from "../ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { ContextSidebarItem } from "./context-sidebar-item";

type ContextSidebarProps = {
  isOpen: boolean;
  className?: string;
  onClose?: () => void;
};

export function ContextSidebar({
  isOpen,
  className,
  onClose,
}: ContextSidebarProps) {
  const { setOpenMobile } = useSidebar();
  const { tools, loading, activeToolIds, activeTools, totalCost, toggleTool } =
    useSessionTools();
  const [searchQuery, setSearchQuery] = useState("");
  const categories = useMemo(
    () => Array.from(new Set(tools.map((tool) => tool.category || "Other"))),
    [tools]
  );
  const filteredTools = useMemo(
    () =>
      tools.filter(
        (tool) =>
          tool.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          tool.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          tool.category?.toLowerCase().includes(searchQuery.toLowerCase())
      ),
    [tools, searchQuery]
  );
  const toolsByCategory = useMemo(
    () =>
      categories.reduce(
        (acc, category) => {
          acc[category] = filteredTools.filter(
            (tool) => (tool.category || "Other") === category
          );
          return acc;
        },
        {} as Record<string, typeof tools>
      ),
    [categories, filteredTools]
  );

  return (
    <div
      className={cn(
        "relative hidden transition-[width] duration-200 ease-linear md:block",
        isOpen ? "w-[var(--sidebar-width)]" : "w-0",
        className
      )}
    >
      <div
        className={cn(
          "absolute inset-y-0 right-0 w-[var(--sidebar-width)] transition-transform duration-200 ease-linear",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        <Sidebar
          className="h-full group-data-[side=right]:border-l-0"
          collapsible="none"
          side="right"
        >
          <SidebarHeader>
            <SidebarMenu>
              <div className="flex flex-col gap-2">
                <div className="flex flex-row items-center justify-between px-2">
                  <Link
                    className="flex flex-row items-center gap-3"
                    href="/"
                    onClick={() => {
                      setOpenMobile(false);
                    }}
                  >
                    <span className="cursor-pointer rounded-md px-2 font-semibold text-lg hover:bg-muted">
                      Tools
                    </span>
                  </Link>
                  <div className="flex flex-row gap-1">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          className="h-8 p-1 md:h-fit md:p-2"
                          onClick={onClose}
                          type="button"
                          variant="ghost"
                        >
                          <CrossIcon />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent align="end" className="hidden md:block">
                        Close
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </div>
                <SidebarInput
                  className="h-8"
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search tools..."
                  value={searchQuery}
                />
              </div>
            </SidebarMenu>
          </SidebarHeader>
          <SidebarContent>
            {loading ? (
              <SidebarGroup>
                <SidebarGroupLabel>Tools</SidebarGroupLabel>
                <SidebarGroupContent>
                  <div className="flex flex-col">
                    {[44, 32, 28, 64, 52].map((item) => {
                      const skeletonStyles = {
                        "--skeleton-width": `${item}%`,
                      } as CSSProperties;
                      return (
                        <div
                          className="flex h-8 items-center gap-2 rounded-md px-2"
                          key={item}
                        >
                          <div
                            className="h-4 max-w-[var(--skeleton-width)] flex-1 rounded-md bg-sidebar-accent-foreground/10"
                            style={skeletonStyles}
                          />
                        </div>
                      );
                    })}
                  </div>
                </SidebarGroupContent>
              </SidebarGroup>
            ) : filteredTools.length === 0 ? (
              <SidebarGroup>
                <SidebarGroupContent>
                  <div
                    className={cn(
                      "flex flex-row items-center justify-center gap-2 px-2 text-sm",
                      "w-full",
                      "text-sidebar-foreground/60"
                    )}
                  >
                    {searchQuery
                      ? "No tools found."
                      : "No tools available yet."}
                  </div>
                </SidebarGroupContent>
              </SidebarGroup>
            ) : (
              categories.map((category) => {
                const categoryTools = toolsByCategory[category];
                if (categoryTools.length === 0) {
                  return null;
                }
                return (
                  <SidebarGroup key={category}>
                    <SidebarGroupLabel>{category}</SidebarGroupLabel>
                    <SidebarGroupContent>
                      <SidebarMenu>
                        {categoryTools.map((tool) => (
                          <ContextSidebarItem
                            isActive={activeToolIds.includes(tool.id)}
                            key={tool.id}
                            onToggle={toggleTool}
                            tool={tool}
                          />
                        ))}
                      </SidebarMenu>
                    </SidebarGroupContent>
                  </SidebarGroup>
                );
              })
            )}
          </SidebarContent>
          <SidebarFooter className="border-t">
            <div className="flex flex-col gap-1 px-2 py-2 text-sidebar-foreground/70 text-xs">
              <div>
                {activeTools.length}{" "}
                {activeTools.length === 1 ? "tool" : "tools"} active
              </div>
              {loading ? (
                <div className="flex items-center gap-2 text-sidebar-foreground/50">
                  <span className="animate-spin">
                    <LoaderIcon />
                  </span>
                  <span>Calculating...</span>
                </div>
              ) : (
                <div className="text-sidebar-foreground/50">
                  ${totalCost.toFixed(2)}/query
                </div>
              )}
            </div>
          </SidebarFooter>
        </Sidebar>
      </div>
    </div>
  );
}
