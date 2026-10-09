"use client";

import { LangProvider } from "@/lib/i18n";
import { PlannerProvider } from "@/lib/store";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <LangProvider>
      <PlannerProvider>{children}</PlannerProvider>
    </LangProvider>
  );
}
