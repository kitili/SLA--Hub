"use client";

import { useEffect, useState } from "react";
import type { School } from "@/types/database";

const STORAGE_KEY = "kitchen:selectedCampus";

/**
 * Shared "which campus am I working in" choice across the Kitchen
 * procurement/compliance/survey-entry pages -- persisted in localStorage so
 * it survives a real page navigation (these are separate routes, not tabs
 * within one client component), not just component state.
 */
export function useSelectedKitchenCampus(
  schools: School[],
  fallbackId: string,
): [string, (id: string) => void] {
  const [schoolId, setSchoolIdState] = useState(fallbackId);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored && schools.some((s) => s.id === stored)) {
      setSchoolIdState(stored);
    }
    // Only run once, on mount -- schools/fallbackId can safely change on
    // subsequent renders (e.g. server refetch) without re-triggering this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function setSchoolId(id: string) {
    setSchoolIdState(id);
    window.localStorage.setItem(STORAGE_KEY, id);
  }

  return [schoolId, setSchoolId];
}
