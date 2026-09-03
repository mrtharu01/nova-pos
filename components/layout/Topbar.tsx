"use client";

import * as React from "react";
import { Search, Bell } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "@/components/ui/theme-toggle";

export function Topbar({ title }: { title: string }) {
  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b bg-background/80 px-4 backdrop-blur-md sm:px-6">
      <h1 className="text-xl font-semibold tracking-tight">{title}</h1>

      <div className="flex items-center gap-2 md:gap-4">
        <div className="relative hidden w-64 md:block">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search products, orders..."
            className="h-10 border-transparent bg-muted/50 pl-9 focus-visible:border-primary focus-visible:bg-transparent"
          />
        </div>
        <ThemeToggle compact />
        <button
          type="button"
          className="relative rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5" />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-destructive" />
        </button>
      </div>
    </header>
  );
}
