import React from "react";
import { cn } from "../../lib/utils";

export function AdminSubTab({ active, label, onClick, icon: Icon }: any) {
  return (
    <button
      onClick={onClick}
      data-active={active}
      className={cn(
        "px-4 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-widest transition-all shrink-0 flex items-center justify-center gap-1.5",
        active
          ? "btn-active-highlight"
          : "text-text-muted hover:text-text-main hover:bg-bg",
      )}
    >
      {Icon && <Icon size={12} className={cn("transition-colors", active ? "text-primary" : "text-text-muted/70")} />}
      <span>{label}</span>
    </button>
  );
}
