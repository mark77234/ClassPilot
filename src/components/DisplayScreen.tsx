"use client";

import { useEffect, useState } from "react";
import { StageView } from "@/components/StageView";
import { STORAGE_KEY, createEmptySession } from "@/lib/classpilot";
import type { ClassSession } from "@/types/classpilot";

export function DisplayScreen() {
  const [session, setSession] = useState<ClassSession>(() =>
    createEmptySession(),
  );

  useEffect(() => {
    function loadSession() {
      const stored = window.localStorage.getItem(STORAGE_KEY);

      if (!stored) {
        return;
      }

      try {
        setSession(JSON.parse(stored) as ClassSession);
      } catch {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    }

    loadSession();

    function handleStorage(event: StorageEvent) {
      if (event.key === STORAGE_KEY) {
        loadSession();
      }
    }

    window.addEventListener("storage", handleStorage);

    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  return (
    <main className="display-shell">
      <StageView session={session} />
    </main>
  );
}
