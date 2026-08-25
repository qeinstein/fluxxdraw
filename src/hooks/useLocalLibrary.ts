import { useState, useEffect } from 'react';

export interface LocalLibraryItem {
  id: string;
  name: string;
  elements: any[]; 
  preview?: string;
}

const LOCAL_LIBRARY_KEY = "fluxxdraw:local_library";

export const useLocalLibrary = () => {
  const [localItems, setLocalItems] = useState<LocalLibraryItem[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(LOCAL_LIBRARY_KEY);
      if (stored) setLocalItems(JSON.parse(stored));
    } catch (e) {
      console.error("Failed to parse local library", e);
    }
  }, []);

  const saveLocalItem = (item: LocalLibraryItem) => {
    setLocalItems(prev => {
      if (prev.find(p => p.id === item.id)) return prev;
      const next = [item, ...prev];
      localStorage.setItem(LOCAL_LIBRARY_KEY, JSON.stringify(next));
      return next;
    });
  };

  const removeLocalItem = (id: string) => {
    setLocalItems(prev => {
      const next = prev.filter(p => p.id !== id);
      localStorage.setItem(LOCAL_LIBRARY_KEY, JSON.stringify(next));
      return next;
    });
  };

  return { localItems, saveLocalItem, removeLocalItem };
};
