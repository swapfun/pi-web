"use client";

import { useSyncExternalStore } from "react";

export const INTERFACE_SCALE_DEFAULT = 1;
export const INTERFACE_SCALE_MIN = 0.85;
export const INTERFACE_SCALE_MAX = 1.3;
export const INTERFACE_SCALE_STEP = 0.05;
export const INTERFACE_SCALE_STORAGE_KEY = "pi-interface-scale";

let scale: number | null = null;
const listeners = new Set<() => void>();

export function clampInterfaceScale(value: unknown): number {
  if (value === null || value === undefined || value === "") return INTERFACE_SCALE_DEFAULT;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return INTERFACE_SCALE_DEFAULT;
  const stepped = Math.round(parsed / INTERFACE_SCALE_STEP) * INTERFACE_SCALE_STEP;
  return Math.max(INTERFACE_SCALE_MIN, Math.min(INTERFACE_SCALE_MAX, Number(stepped.toFixed(2))));
}

function applyScale(value: number): void {
  document.documentElement.style.setProperty("--non-chat-ui-scale", String(value));
}

function getSnapshot(): number {
  if (typeof window === "undefined") return INTERFACE_SCALE_DEFAULT;
  if (scale === null) {
    try {
      scale = clampInterfaceScale(window.localStorage.getItem(INTERFACE_SCALE_STORAGE_KEY));
    } catch {
      scale = INTERFACE_SCALE_DEFAULT;
    }
    applyScale(scale);
  }
  return scale;
}

function notify(): void {
  listeners.forEach((listener) => listener());
}

function onStorage(event: StorageEvent): void {
  if (event.key !== null && event.key !== INTERFACE_SCALE_STORAGE_KEY) return;
  let next = INTERFACE_SCALE_DEFAULT;
  try {
    next = clampInterfaceScale(window.localStorage.getItem(INTERFACE_SCALE_STORAGE_KEY));
  } catch {
    // Keep the current tab usable when storage is blocked.
  }
  if (next === getSnapshot()) return;
  scale = next;
  applyScale(next);
  notify();
}

function subscribe(listener: () => void): () => void {
  if (listeners.size === 0) window.addEventListener("storage", onStorage);
  listeners.add(listener);
  getSnapshot();
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener("storage", onStorage);
  };
}

export function setInterfaceScale(value: number): void {
  const next = clampInterfaceScale(value);
  if (next === getSnapshot()) return;
  scale = next;
  applyScale(next);
  try {
    if (next === INTERFACE_SCALE_DEFAULT) window.localStorage.removeItem(INTERFACE_SCALE_STORAGE_KEY);
    else window.localStorage.setItem(INTERFACE_SCALE_STORAGE_KEY, String(next));
  } catch {
    // Apply in memory even when browser persistence is unavailable.
  }
  notify();
}

export function useInterfaceScale() {
  const value = useSyncExternalStore(subscribe, getSnapshot, () => INTERFACE_SCALE_DEFAULT);
  return { value, setValue: setInterfaceScale };
}
