import { useState, useEffect, useCallback } from 'react';

export interface LocalLibraryItem {
  id: string;
  name: string;
  elements: any[];
  preview?: string;
  /** Timestamp of last use (click or drag placement). */
  lastUsed?: number;
  /** How many times this item has been placed on the canvas. */
  useCount?: number;
}

const LOCAL_LIBRARY_KEY = "fluxxdraw:local_library";

const load = (): LocalLibraryItem[] => {
  try {
    const stored = localStorage.getItem(LOCAL_LIBRARY_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

const persist = (items: LocalLibraryItem[]) => {
  localStorage.setItem(LOCAL_LIBRARY_KEY, JSON.stringify(items));
};

export const useLocalLibrary = () => {
  const [localItems, setLocalItems] = useState<LocalLibraryItem[]>(load);

  // Sync state on storage events (other tabs)
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === LOCAL_LIBRARY_KEY) setLocalItems(load());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const saveLocalItem = useCallback((item: LocalLibraryItem) => {
    setLocalItems(prev => {
      if (prev.find(p => p.id === item.id)) return prev;
      const next = [{ ...item, lastUsed: Date.now(), useCount: 0 }, ...prev];
      persist(next);
      return next;
    });
  }, []);

  const removeLocalItem = useCallback((id: string) => {
    setLocalItems(prev => {
      const next = prev.filter(p => p.id !== id);
      persist(next);
      return next;
    });
  }, []);

  /** Bump usage stats when an item is placed on the canvas. */
  const trackUsage = useCallback((id: string) => {
    setLocalItems(prev => {
      const next = prev.map(p =>
        p.id === id
          ? { ...p, lastUsed: Date.now(), useCount: (p.useCount ?? 0) + 1 }
          : p,
      );
      persist(next);
      return next;
    });
  }, []);

  /** Items sorted by most-recently-used first. */
  const recentItems = [...localItems].sort(
    (a, b) => (b.lastUsed ?? 0) - (a.lastUsed ?? 0),
  );

  /** Items sorted by most-frequently-used first. */
  const frequentItems = [...localItems].sort(
    (a, b) => (b.useCount ?? 0) - (a.useCount ?? 0),
  );

  return {
    localItems,
    recentItems,
    frequentItems,
    saveLocalItem,
    removeLocalItem,
    trackUsage,
  };
};
