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
  const [storageReady, setStorageReady] = useState(false);

  useEffect(() => {
    const stored = getStoredSession();

    if (stored) {
      try {
        setSessionState(normalizeSession(JSON.parse(stored)));
      } catch {
        removeStoredSession();
      }
    }

    setStorageReady(true);
  }, []);

  useEffect(() => {
    if (!storageReady) {
      return;
    }

    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } catch {
      // Storage can be unavailable in restricted browser contexts.
    }
  }, [storageReady, session]);

  useEffect(() => {
    function handleStorage(event: StorageEvent) {
      if (event.key !== STORAGE_KEY || !event.newValue) {
        return;
      }

      try {
        setSessionState(normalizeSession(JSON.parse(event.newValue)));
      } catch {
        removeStoredSession();
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
    removeStoredSession();
    setSessionState(emptySession);
  }, []);

  return {
    hydrated: true,
    resetSession,
    session,
    setSession,
    updateSession,
  };
}

function getStoredSession(): string | null {
  try {
    return (
      window.localStorage.getItem(STORAGE_KEY) ??
      window.localStorage.getItem(LEGACY_STORAGE_KEY)
    );
  } catch {
    return null;
  }
}

function removeStoredSession() {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
    window.localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    // Ignore storage cleanup failures in restricted browser contexts.
  }
}
