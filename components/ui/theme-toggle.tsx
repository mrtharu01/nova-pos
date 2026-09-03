"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme, ThemeMode } from "@/components/providers/ThemeProvider";
import { cn } from "@/lib/utils";

const OPTIONS: { value: ThemeMode; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { theme, setTheme } = useTheme();

  if (compact) {
    const current = OPTIONS.find((option) => option.value === theme) ?? OPTIONS[2];
    const Icon = current.icon;
    const next: ThemeMode = theme === "light" ? "dark" : theme === "dark" ? "system" : "light";
    return (
      <button
        type="button"
        onClick={() => setTheme(next)}
        className="inline-flex h-10 w-10 items-center justify-center rounded-[12px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        aria-label={`Theme: ${current.label}. Click to switch.`}
        title={`Theme: ${current.label}`}
      >
        <Icon className="h-4 w-4" />
      </button>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-2 rounded-[20px] bg-muted p-1.5">
      {OPTIONS.map((option) => {
        const Icon = option.icon;
        const active = theme === option.value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => setTheme(option.value)}
            className={cn(
              "flex min-h-12 items-center justify-center gap-2 rounded-[14px] px-3 text-sm font-semibold transition-all",
              active
                ? "bg-background text-foreground shadow-sm ring-1 ring-border"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="h-4 w-4" />
            <span className="hidden sm:inline">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
