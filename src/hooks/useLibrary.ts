import { useState, useEffect } from 'react';
import { neon } from '@neondatabase/serverless';

const DATABASE_URL = "postgresql://neondb_owner:npg_E6ulRbwKfhV1@ep-twilight-bar-axgybo21-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require";
const sql = neon(DATABASE_URL);

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
  const rows = await sql`SELECT content FROM libraries WHERE id = ${id}`;
  if (rows.length === 0) throw new Error("Library not found");
  return rows[0].content;
};
