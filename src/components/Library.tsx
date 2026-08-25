import { useMemo, useState } from "react";
import { useLibraryList, fetchLibraryContent } from "../hooks/useLibrary";
import { useLocalLibrary } from "../hooks/useLocalLibrary";
import { IconClose } from "./icons";
import { ServiceLibraryPanel } from "./ServiceLibrary";
import { IconLockOpen, IconLockClosed } from "./icons";

/** Keywords that boost a library to the top of browse results. */
const PRIORITY_KEYWORDS = [
  "system design", "architecture", "aws", "gcp", "azure", "cloud",
  "kubernetes", "docker", "database", "server", "network", "api",
  "microservice", "infrastructure", "devops", "ci/cd", "uml",
  "deployment", "component", "data flow", "sequence", "flowchart",
  "software", "platform", "stack", "hashicorp", "terraform",
];

const isPriority = (name: string, desc: string | undefined | null) => {
  const hay = `${name} ${desc || ""}`.toLowerCase();
  return PRIORITY_KEYWORDS.some((kw) => hay.includes(kw));
};

const getLibraryItems = (payload: unknown): any[][] => {
  let value: unknown = payload;
  if (typeof value === "string") value = JSON.parse(value);
  if (value && typeof value === "object" && "content" in value) {
    value = (value as { content: unknown }).content;
    if (typeof value === "string") value = JSON.parse(value);
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    value = record.libraryItems ?? record.library ?? record.items ?? value;
  }
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (Array.isArray(item)) return item;
      if (item && typeof item === "object" && Array.isArray((item as { elements?: unknown }).elements)) {
        return (item as { elements: any[] }).elements;
      }
      return item && typeof item === "object" && "type" in item ? [item] : [];
    })
    .filter((elements) => elements.length > 0);
};

export const Library = ({ onClose, docked, onDockToggle }: { onClose: () => void, docked?: boolean, onDockToggle?: () => void }) => {
  const { localItems, recentItems, saveLocalItem, removeLocalItem, trackUsage } =
    useLocalLibrary();
  
  const [tab, setTab] = useState<"my-library" | "built-in" | "browse">(
    localItems.length === 0 ? "built-in" : "my-library"
  );
  const [query, setQuery] = useState("");

  const { libraries, loading, error } = useLibraryList();
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [installError, setInstallError] = useState<string | null>(null);

  /** Filtered + sorted browse list: priority items first, then alphabetical. */
  const filteredLibraries = useMemo(() => {
    const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const filtered = terms.length
      ? libraries.filter((l) => {
          const hay = `${l.name} ${l.description || ""}`.toLowerCase();
          return terms.every((t) => hay.includes(t));
        })
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

  const handleInstallLibrary = async (
    id: string,
    name: string,
    previewUrl: string,
  ) => {
    try {
      setDownloadingId(id);
      setInstallError(null);
      const libraryItems = getLibraryItems(await fetchLibraryContent(id));
      if (libraryItems.length === 0) throw new Error("This library contains no compatible components.");
      libraryItems.forEach((elements, index) => {
        saveLocalItem({
          id: libraryItems.length === 1 ? id : `${id}:${index}`,
          name: libraryItems.length === 1 ? name : `${name} ${index + 1}`,
          preview: previewUrl,
          elements,
        });
      });
      setTab("my-library");
    } catch (err) {
      console.error("Library install failed:", err);
      setInstallError(err instanceof Error ? err.message : "Could not install this library.");
    } finally {
      setDownloadingId(null);
    }
  };

  const queuePlacement = (items: any[], libraryId: string) => {
    window.dispatchEvent(new CustomEvent("fluxxdraw:place-library", { detail: items }));
    trackUsage(libraryId);
  };

  const onDragStart = (e: React.DragEvent, items: any[]) => {
    e.dataTransfer.setData(
      "application/vnd.fluxxdraw.library+json",
      JSON.stringify(items),
    );
    e.dataTransfer.effectAllowed = "copy";
  };

  // ---------------------------------------------------------------------------
  // Recently-used section (top 6 most recent)
  // ---------------------------------------------------------------------------
  const recentUsed = recentItems
    .filter((i) => (i.lastUsed ?? 0) > 0)
    .slice(0, 6);

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
            className={`library-tab ${tab === "built-in" ? "active" : ""}`}
            onClick={() => setTab("built-in")}
          >
            Built-in
          </button>
          <button
            className={`library-tab ${tab === "browse" ? "active" : ""}`}
            onClick={() => setTab("browse")}
          >
            Browse
          </button>
        </div>
        <div className="library-header-actions">
          {onDockToggle && (
            <button
              type="button"
              className={`library-close ${docked ? "active" : ""}`}
              onClick={onDockToggle}
              title={docked ? "Undock sidebar" : "Dock sidebar"}
            >
              {docked ? <IconLockClosed /> : <IconLockOpen />}
            </button>
          )}
          <button type="button" className="library-close" onClick={onClose} title="Close library">
            <IconClose />
          </button>
        </div>
      </header>

      {/* Search — visible in Browse tab */}
      {tab === "browse" && (
        <div className="library-search">
          <input
            type="search"
            placeholder="Search libraries…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.preventDefault();
            }}
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
                <button
                  className="library-cta"
                  onClick={() => setTab("browse")}
                >
                  Browse libraries
                </button>
              </div>
            )}

            {localItems.length > 0 && (
              <>
                {/* Recently used */}
                {recentUsed.length > 0 && (
                  <div className="library-section">
                    <h4 className="library-section-title">Recently used</h4>
                    <div className="library-grid">
                      {recentUsed.map((lib) => (
                        <div
                          key={`recent-${lib.id}`}
                          className="library-item"
                          draggable
                          onDragStart={(e) => onDragStart(e, lib.elements)}
                          onClick={() => queuePlacement(lib.elements, lib.id)}
                          title={`Click to place "${lib.name}" · Drag to position`}
                        >
                          {lib.preview ? (
                            <div
                              className="library-item-content preview-bg"
                              style={{
                                backgroundImage: `url(${lib.preview})`,
                              }}
                            />
                          ) : (
                            <div className="library-item-content text-only">
                              {lib.name}
                            </div>
                          )}
                          <span className="library-item-label">
                            {lib.name}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* All installed */}
                <div className="library-section">
                  <h4 className="library-section-title">All components</h4>
                  <div className="library-grid">
                    {localItems.map((lib) => (
                      <div
                        key={lib.id}
                        className="library-item"
                        draggable
                        onDragStart={(e) => onDragStart(e, lib.elements)}
                        onClick={() => queuePlacement(lib.elements, lib.id)}
                        title={`Click to place "${lib.name}" · Drag to position`}
                      >
                        {lib.preview ? (
                          <div
                            className="library-item-content preview-bg"
                            style={{
                              backgroundImage: `url(${lib.preview})`,
                            }}
                          />
                        ) : (
                          <div className="library-item-content text-only">
                            {lib.name}
                          </div>
                        )}
                        <span className="library-item-label">
                          {lib.name}
                        </span>
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
                </div>
              </>
            )}
          </>
        )}

        {/* ---- BROWSE ---- */}
        {tab === "built-in" && <ServiceLibraryPanel onClose={onClose} />}

        {tab === "browse" && (
          <div className="library-browse-list">
            {loading && (
              <div className="library-status">
                <div className="library-spinner" />
                Loading community libraries…
              </div>
            )}
            {error && (
              <div className="library-status danger">
                Could not load libraries.
              </div>
            )}

            {installError && (
              <div className="library-status danger">{installError}</div>
            )}

            {!loading &&
              !error &&
              filteredLibraries.map((lib) => {
                const installed = localItems.some((l) => l.id === lib.id);
                const previewUrl = `https://raw.githubusercontent.com/excalidraw/excalidraw-libraries/main/libraries/${lib.preview}`;
                const priority = isPriority(lib.name, lib.description);

                return (
                  <div
                    key={lib.id}
                    className={`library-browse-card${priority ? " priority" : ""}`}
                  >
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
                      type="button"
                      className={`library-action-btn${installed ? " installed" : ""}`}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        void handleInstallLibrary(lib.id, lib.name, previewUrl);
                      }}
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
              <div className="library-status">
                No libraries match "{query}"
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
};
