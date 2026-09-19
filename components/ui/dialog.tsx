"use client";

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  hideCloseButton?: boolean;
}

export function Dialog({
  isOpen,
  onClose,
  title,
  description,
  children,
  className,
  hideCloseButton = false,
}: DialogProps) {
  // Prevent body scroll when open
  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm"
            onClick={onClose}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-2 sm:p-6">
            <motion.div
              initial={{ opacity: 0, scale: 0.98, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: 10 }}
              transition={{ duration: 0.2, type: "spring", bounce: 0, damping: 25 }}
              className={cn(
                "flex max-h-[calc(100dvh-1rem)] min-h-0 w-full max-w-lg flex-col overflow-hidden rounded-[28px] border bg-card p-4 shadow-2xl sm:max-h-[calc(100dvh-3rem)] sm:rounded-[32px] sm:p-6 lg:p-8",
                className
              )}
              onClick={(e) => e.stopPropagation()}
            >
              {(title || !hideCloseButton) && (
                <div className="mb-4 flex min-w-0 shrink-0 items-start justify-between gap-4 sm:mb-6">
                  <div className="min-w-0">
                    {title && <h2 className="text-xl font-semibold tracking-tight">{title}</h2>}
                    {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
                  </div>
                  {!hideCloseButton && (
                    <button
                      onClick={onClose}
                      className="rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  )}
                </div>
              )}
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
                {children}
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
