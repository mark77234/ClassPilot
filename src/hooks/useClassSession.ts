"use client";

import { useCallback, useEffect, useState } from "react";
import {
  LEGACY_STORAGE_KEY,
  STORAGE_KEY,
  createEmptySession,
  normalizeSession,
  withSessionUpdate,
} from "@/lib/classpilot";
import type { ClassSession } from "@/types/classpilot";

type SessionUpdater = ClassSession | ((session: ClassSession) => ClassSession);

export function useClassSession() {
  const [session, setSessionState] = useState<ClassSession>(() =>
    createEmptySession(),
  );
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored =
      window.localStorage.getItem(STORAGE_KEY) ??
      window.localStorage.getItem(LEGACY_STORAGE_KEY);

    if (stored) {
      try {
        setSessionState(normalizeSession(JSON.parse(stored)));
      } catch {
        window.localStorage.removeItem(STORAGE_KEY);
        window.localStorage.removeItem(LEGACY_STORAGE_KEY);
      }
    }

    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  }, [hydrated, session]);

  useEffect(() => {
    function handleStorage(event: StorageEvent) {
      if (event.key !== STORAGE_KEY || !event.newValue) {
        return;
      }

      try {
        setSessionState(normalizeSession(JSON.parse(event.newValue)));
      } catch {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    }

    window.addEventListener("storage", handleStorage);

    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const setSession = useCallback((updater: SessionUpdater) => {
    setSessionState((current) =>
      typeof updater === "function"
        ? (updater as (session: ClassSession) => ClassSession)(current)
        : updater,
    );
  }, []);

  const updateSession = useCallback((changes: Partial<ClassSession>) => {
    setSessionState((current) => withSessionUpdate(current, changes));
  }, []);

  const resetSession = useCallback(() => {
    const emptySession = createEmptySession();
    window.localStorage.removeItem(STORAGE_KEY);
    window.localStorage.removeItem(LEGACY_STORAGE_KEY);
    setSessionState(emptySession);
  }, []);

  return {
    hydrated,
    resetSession,
    session,
    setSession,
    updateSession,
  };
}
