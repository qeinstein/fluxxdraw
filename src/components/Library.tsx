import { useMemo, useState } from "react";
import { useLibraryList, fetchLibraryContent } from "../hooks/useLibrary";
import { useLocalLibrary } from "../hooks/useLocalLibrary";
import { IconClose } from "./icons";
import { store } from "../store";
import { nanoid } from "nanoid";

/** Keywords that boost a library to the top of browse results. */
const PRIORITY_KEYWORDS = [
  "system design", "architecture", "aws", "gcp", "azure", "cloud",
  "kubernetes", "docker", "database", "server", "network", "api",
  "microservice", "infrastructure", "devops", "ci/cd", "uml",
  "deployment", "component", "data flow", "sequence", "flowchart",
  "software", "platform", "stack", "hashicorp", "terraform",
];

const isPriority = (name: string, desc: string) => {
  const hay = `${name} ${desc}`.toLowerCase();
  return PRIORITY_KEYWORDS.some((kw) => hay.includes(kw));
};

export const Library = ({ onClose }: { onClose: () => void }) => {
  const [tab, setTab] = useState<"my-library" | "browse">("my-library");
  const [query, setQuery] = useState("");

  const { libraries, loading, error } = useLibraryList();
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const { localItems, saveLocalItem, removeLocalItem } = useLocalLibrary();

  /** Filtered + sorted browse list: priority items first, then alphabetical. */
  const filteredLibraries = useMemo(() => {
    const term = query.trim().toLowerCase();
    const filtered = term
      ? libraries.filter(
          (l) =>
            l.name.toLowerCase().includes(term) ||
            l.description?.toLowerCase().includes(term),
        )
      : libraries;

    return [...filtered].sort((a, b) => {
      const ap = isPriority(a.name, a.description) ? 0 : 1;
      const bp = isPriority(b.name, b.description) ? 0 : 1;
      if (ap !== bp) return ap - bp;
      return a.name.localeCompare(b.name);
    });
  }, [libraries, query]);

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  const handleInstallLibrary = async (id: string, name: string, previewUrl: string) => {
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
        saveLocalItem({ id, name, preview: previewUrl, elements: items });
        setTab("my-library");
      }
    } catch (err) {
      console.error("Library install failed:", err);
    } finally {
      setDownloadingId(null);
    }
  };

  const handlePlaceItems = (items: any[]) => {
    if (!items.length) return;
    const minX = Math.min(...items.map((el: any) => el.x ?? 0));
    const minY = Math.min(...items.map((el: any) => el.y ?? 0));
    const maxX = Math.max(...items.map((el: any) => (el.x ?? 0) + (el.width ?? 0)));
    const maxY = Math.max(...items.map((el: any) => (el.y ?? 0) + (el.height ?? 0)));
    const w = maxX - minX;
    const h = maxY - minY;

    const { scrollX, scrollY, zoom } = store.appState;
    const container = document.querySelector(".canvas-container");
    const rect = container?.getBoundingClientRect();
    const cx = rect ? rect.width / (2 * zoom) - scrollX : 0;
    const cy = rect ? rect.height / (2 * zoom) - scrollY : 0;

    const idMap = new Map<string, string>();
    items.forEach((el) => idMap.set(el.id, nanoid()));

    const placed = items.map((el: any) => ({
      ...el,
      id: idMap.get(el.id)!,
      groupIds: el.groupIds?.map((g: string) => idMap.get(g) || g) || [],
      boundElements: el.boundElements?.map((b: any) => ({ ...b, id: idMap.get(b.id) || b.id })) || [],
      x: (el.x ?? 0) - minX + cx - w / 2,
      y: (el.y ?? 0) - minY + cy - h / 2,
    }));

    store.mutate(() => {
      store.addElements(...placed);
      store.appState = { ...store.appState, selectedIds: placed.map((e: any) => e.id) };
    });
  };

  const onDragStart = (e: React.DragEvent, items: any[]) => {
    e.dataTransfer.setData("application/vnd.fluxxdraw.library+json", JSON.stringify(items));
    e.dataTransfer.effectAllowed = "copy";
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <aside className="library-sidebar">
      {/* Header with tabs */}
      <header className="library-header">
        <div className="library-tabs">
          <button
            className={`library-tab ${tab === "my-library" ? "active" : ""}`}
            onClick={() => setTab("my-library")}
          >
            Your library
          </button>
          <button
            className={`library-tab ${tab === "browse" ? "active" : ""}`}
            onClick={() => setTab("browse")}
          >
            Browse
          </button>
        </div>
        <button className="library-close" aria-label="Close library" onClick={onClose}>
          <IconClose />
        </button>
      </header>

      {/* Search — visible in Browse tab */}
      {tab === "browse" && (
        <div className="library-search">
          <input
            type="search"
            placeholder="Search libraries…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
        </div>
      )}

      {/* Content */}
      <div className="library-content">
        {/* ---- MY LIBRARY ---- */}
        {tab === "my-library" && (
          <>
            {localItems.length === 0 && (
              <div className="library-empty">
                <p>Your library is empty.</p>
                <p style={{ fontSize: 12, color: "var(--fg-subtle)" }}>
                  Browse the community collection and add components here.
                </p>
                <button className="library-cta" onClick={() => setTab("browse")}>
                  Browse libraries
                </button>
              </div>
            )}

            {localItems.length > 0 && (
              <div className="library-grid">
                {localItems.map((lib) => (
                  <div
                    key={lib.id}
                    className="library-item"
                    draggable
                    onDragStart={(e) => onDragStart(e, lib.elements)}
                    onClick={() => handlePlaceItems(lib.elements)}
                    title={`Click to place "${lib.name}" · Drag to position`}
                  >
                    {lib.preview ? (
                      <div
                        className="library-item-content preview-bg"
                        style={{ backgroundImage: `url(${lib.preview})` }}
                      />
                    ) : (
                      <div className="library-item-content text-only">{lib.name}</div>
                    )}
                    <span className="library-item-label">{lib.name}</span>
                    <button
                      className="library-item-delete"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeLocalItem(lib.id);
                      }}
                      title="Remove"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ---- BROWSE ---- */}
        {tab === "browse" && (
          <div className="library-browse-list">
            {loading && (
              <div className="library-status">
                <div className="library-spinner" />
                Loading community libraries…
              </div>
            )}
            {error && (
              <div className="library-status danger">Could not load libraries.</div>
            )}

            {!loading &&
              !error &&
              filteredLibraries.map((lib) => {
                const installed = localItems.some((l) => l.id === lib.id);
                const previewUrl = `https://raw.githubusercontent.com/excalidraw/excalidraw-libraries/main/libraries/${lib.preview}`;
                const priority = isPriority(lib.name, lib.description);

                return (
                  <div key={lib.id} className={`library-browse-card${priority ? " priority" : ""}`}>
                    <div
                      className="library-browse-preview"
                      style={{ backgroundImage: `url(${previewUrl})` }}
                    />
                    <div className="library-browse-info">
                      <strong>{lib.name}</strong>
                      {lib.description && (
                        <span className="library-browse-desc">
                          {lib.description.length > 80
                            ? lib.description.slice(0, 80) + "…"
                            : lib.description}
                        </span>
                      )}
                    </div>
                    <button
                      className={`library-action-btn${installed ? " installed" : ""}`}
                      onClick={() =>
                        handleInstallLibrary(lib.id, lib.name, previewUrl)
                      }
                      disabled={downloadingId === lib.id || installed}
                    >
                      {installed
                        ? "✓ Added"
                        : downloadingId === lib.id
                          ? "Adding…"
                          : "Add to FluxxDraw"}
                    </button>
                  </div>
                );
              })}

            {!loading && !error && filteredLibraries.length === 0 && (
              <div className="library-status">No libraries match "{query}"</div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
};
