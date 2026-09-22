"use client";

import * as React from "react";

/*
 * Recent searches, kept only in this browser. Every storage access is wrapped: private windows,
 * blocked site data and some WebViews throw on localStorage, and search must keep working there.
 */

const KEY = "esk.search.recent";
const MAX = 6;
const EVENT = "esk:search-recent";
const EMPTY: string[] = [];

let cachedRaw: string | null = null;
let cachedList: string[] = EMPTY;

function read(): string[] {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(KEY);
  } catch {
    return EMPTY;
  }
  if (raw === cachedRaw) return cachedList;
  cachedRaw = raw;
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    cachedList = Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string").slice(0, MAX) : EMPTY;
  } catch {
    cachedList = EMPTY;
  }
  return cachedList;
}

function write(list: string[]) {
  try {
    if (list.length === 0) window.localStorage.removeItem(KEY);
    else window.localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
  } catch {
    // Storage unavailable: recents simply are not remembered.
  }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

export function addRecentSearch(query: string) {
  const q = query.replace(/\s+/g, " ").trim();
  if (q.length < 2) return;
  const next = [q, ...read().filter((r) => r.toLowerCase() !== q.toLowerCase())];
  write(next);
}

export function removeRecentSearch(query: string) {
  write(read().filter((r) => r !== query));
}

export function clearRecentSearches() {
  write([]);
}

/** The visitor's recent searches, newest first. Empty on the server and before hydration. */
export function useRecentSearches(): string[] {
  return React.useSyncExternalStore(subscribe, read, () => EMPTY);
}
