import { DEFAULT_EXPORT_SETTINGS, type ExportSettings } from "./exportController";

const KEY = "excali-free:preferences";

export interface Preferences {
  exportSettings: ExportSettings;
  /** display name of the chosen export folder; the handle itself lives in IndexedDB */
  exportDirectoryName: string | null;
  viewBackgroundColor: string;
  theme: "light" | "dark";
  gridSize: number | null;
  snapToObjects: boolean;
}

export const DEFAULT_PREFERENCES: Preferences = {
  exportSettings: DEFAULT_EXPORT_SETTINGS,
  exportDirectoryName: null,
  viewBackgroundColor: "#ffffff",
  theme: "light",
  gridSize: null,
  snapToObjects: true,
};

export const loadPreferences = (): Preferences => {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_PREFERENCES;
    const parsed = JSON.parse(raw) as Partial<Preferences>;
    return {
      ...DEFAULT_PREFERENCES,
      ...parsed,
      exportSettings: { ...DEFAULT_EXPORT_SETTINGS, ...(parsed.exportSettings ?? {}) },
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
};

export const savePreferences = (prefs: Preferences) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    // preferences are a convenience; a full quota shouldn't break the app
  }
};
