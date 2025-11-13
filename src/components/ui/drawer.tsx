"use client";
import * as React from "react";
import { cn } from "../../lib/utils";

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children?: React.ReactNode;
  side?: "right" | "left";
}

export function Drawer({ open, onClose, title, children, side = "right" }: DrawerProps) {
  return (
    <div className={cn("fixed inset-0 z-50", open ? "" : "pointer-events-none")}> 
      {/* Backdrop */}
      <div
        className={cn(
          "absolute inset-0 bg-black/40 transition-opacity",
          open ? "opacity-100" : "opacity-0"
        )}
        onClick={onClose}
      />
      {/* Panel */}
      <div
        className={cn(
          "absolute top-0 h-full w-[380px] max-w-[85vw] bg-white shadow-xl border-l border-zinc-200 dark:bg-zinc-900",
          side === "right" ? "right-0" : "left-0",
          open ? "translate-x-0" : side === "right" ? "translate-x-full" : "-translate-x-full",
          "transition-transform"
        )}
      >
        <div className="flex items-center justify-between p-4 border-b border-zinc-200">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button
            className="rounded-md p-2 text-zinc-700 hover:bg-zinc-100"
            onClick={onClose}
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>
        <div className="p-4 overflow-y-auto max-h-[calc(100vh-64px)]">{children}</div>
      </div>
    </div>
  );
}