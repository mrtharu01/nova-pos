"use client";

import * as React from "react";

import {
  ThemeToggle,
} from "@/components/ui/theme-toggle";


export function Topbar({
  title,
}: {
  title: string;
}) {
  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b bg-background/80 px-4 backdrop-blur-md sm:px-6">

      <h1 className="min-w-0 truncate text-xl font-semibold tracking-tight">
        {title}
      </h1>


      <div className="shrink-0">
        <ThemeToggle compact />
      </div>

    </header>
  );
}
