import { useState } from "react";
import { useLibraryList, fetchLibraryContent } from "../hooks/useLibrary";
import { IconClose } from "./icons";
import { store } from "../store";

export const LibrarySidebar = ({ onClose }: { onClose: () => void }) => {
  const { libraries, loading, error, reload } = useLibraryList();
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const handleAddLibrary = async (id: string) => {
    try {
      setDownloadingId(id);
      const content = await fetchLibraryContent(id);
      const parsed = typeof content === "string" ? JSON.parse(content) : content;
      const elements = parsed.libraryItems || parsed.library;
      if (elements && Array.isArray(elements)) {
        const items = elements.flatMap((item: any) => {
          if (Array.isArray(item)) return item;
          if (item.elements) return item.elements;
          return [item];
        });
        
        const minX = Math.min(...items.map((el: any) => el.x));
        const minY = Math.min(...items.map((el: any) => el.y));
        
        const { scrollX, scrollY, zoom } = store.appState;
        const container = document.querySelector(".canvas-container");
        const rect = container?.getBoundingClientRect();
        const centreX = rect ? rect.width / (2 * zoom) - scrollX : 0;
        const centreY = rect ? rect.height / (2 * zoom) - scrollY : 0;

        const adjustedElements = items.map((el: any) => ({
          ...el,
          x: el.x - minX + centreX - 100,
          y: el.y - minY + centreY - 100,
        })) as any;

        store.mutate(() => {
          store.addElements(adjustedElements);
          store.appState = { ...store.appState, selectedIds: adjustedElements.map((el: any) => el.id) };
        });
        
        onClose();
      } else {
        alert("Invalid library format");
      }
    } catch (err) {
      console.error(err);
      alert("Failed to load library");
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <aside className="menu-popover" style={{ top: 14, right: 60, left: "auto", width: 320, maxHeight: "calc(100vh - 28px)" }}>
      <header className="menu-sidebar-head">
        <div>
          <strong>Library</strong>
          <span>Browse and add community libraries</span>
        </div>
        <button className="menu-sidebar-close" aria-label="Close" onClick={onClose}>
          <IconClose />
        </button>
      </header>

      <div className="menu-sidebar-content" style={{ padding: 12, display: "flex", flexDirection: "column", gap: 16 }}>
        {loading && <div style={{ textAlign: "center", color: "var(--fg-subtle)" }}>Loading libraries...</div>}
        {error && (
          <div style={{ color: "var(--danger)", display: "flex", flexDirection: "column", gap: 12, alignItems: "center", padding: "20px 0" }}>
            <span>Failed to load libraries: {error.message}</span>
            <button onClick={reload} style={{ padding: "6px 12px", background: "var(--surface-overlay)", border: "1px solid var(--line)", borderRadius: 4 }}>
              Try again
            </button>
          </div>
        )}
        
        {!loading && !error && libraries.map((lib) => (
          <div key={lib.id} style={{ display: "flex", flexDirection: "column", gap: 8, padding: 12, background: "var(--surface-sunken)", borderRadius: "var(--radius-md)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <strong style={{ fontSize: 13, lineHeight: 1.2 }}>{lib.name}</strong>
                <span style={{ fontSize: 11, color: "var(--fg-subtle)", lineHeight: 1.3 }}>{lib.description}</span>
                {lib.authors && lib.authors.length > 0 && (
                  <span style={{ fontSize: 10, color: "var(--fg-muted)" }}>
                    By {lib.authors.map(a => a.name).join(", ")}
                  </span>
                )}
              </div>
            </div>
            
            <div style={{ 
              width: "100%", 
              height: 120, 
              background: "#fff", 
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--line)",
              backgroundImage: `url(https://raw.githubusercontent.com/excalidraw/excalidraw-libraries/main/libraries/${lib.preview})`,
              backgroundSize: "contain",
              backgroundPosition: "center",
              backgroundRepeat: "no-repeat"
            }} />
            
            <button 
              style={{ width: "100%", padding: "8px", background: "var(--accent)", color: "var(--surface)" }}
              onClick={() => handleAddLibrary(lib.id)}
              disabled={downloadingId === lib.id}
            >
              {downloadingId === lib.id ? "Adding..." : "Add to Canvas"}
            </button>
          </div>
        ))}
      </div>
    </aside>
  );
};
