"use client";

import {
  AlertTriangleIcon,
  DollarSignIcon,
  ShieldCheckIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const navItems = [
  {
    href: "/admin/disputes",
    label: "Disputes",
    icon: AlertTriangleIcon,
  },
  {
    href: "/admin/tools",
    label: "Tool Verification",
    icon: ShieldCheckIcon,
  },
  {
    href: "/admin/earnings",
    label: "Platform Earnings",
    icon: DollarSignIcon,
  },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-2 border-b pb-4">
      {navItems.map((item) => {
        const isActive = pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link href={item.href} key={item.href}>
            <Button
              className={cn(
                "gap-2",
                isActive && "bg-primary text-primary-foreground"
              )}
              size="sm"
              variant={isActive ? "default" : "outline"}
            >
              <Icon className="size-4" />
              {item.label}
            </Button>
          </Link>
        );
      })}
    </nav>
  );
}
