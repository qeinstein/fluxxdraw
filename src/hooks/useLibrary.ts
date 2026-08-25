import { useState, useEffect } from 'react';
const API_BASE = "/api/libraries";

export interface Library {
  id: string;
  name: string;
  description: string;
  authors: any[];
  source: string;
  preview: string;
  created: string;
  updated: string;
  version: number;
}

export const useLibraryList = () => {
  const [libraries, setLibraries] = useState<Library[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchLibraries = async () => {
      try {
        const response = await fetch(API_BASE);
        if (!response.ok) throw new Error(`Library request failed (${response.status})`);
        const rows = await response.json();
        setLibraries(rows as Library[]);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };
    fetchLibraries();
  }, []);

  return { libraries, loading, error };
};

export const fetchLibraryContent = async (id: string): Promise<unknown> => {
  const response = await fetch(`${API_BASE}/${encodeURIComponent(id)}/content`);
  if (!response.ok) {
    throw new Error(
      response.status === 404
        ? "This library is unavailable"
        : `Library request failed (${response.status})`,
    );
  }
  return response.json();
};
