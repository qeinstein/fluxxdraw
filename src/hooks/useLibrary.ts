import { useState, useEffect } from 'react';
import { neon } from '@neondatabase/serverless';

const DATABASE_URL = import.meta.env.VITE_DATABASE_URL as string | undefined;
const sql = DATABASE_URL ? neon(DATABASE_URL) : null;

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
    if (!sql) {
      setError(new Error("Database not configured"));
      setLoading(false);
      return;
    }
    const fetchLibraries = async () => {
      try {
        const rows = await sql`
          SELECT id, name, description, authors, source, preview, created, updated, version
          FROM libraries
          ORDER BY name ASC
        `;
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

export const fetchLibraryContent = async (id: string) => {
  if (!sql) throw new Error("Database not configured");
  const rows = await sql`SELECT content FROM libraries WHERE id = ${id}`;
  if (rows.length === 0) throw new Error("Library not found");
  return rows[0].content;
};
