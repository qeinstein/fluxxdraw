import { useMemo, useRef, useState } from "react";
import { store } from "../store";
import { IconClose } from "./icons";
import {
  PROVIDERS,
  SERVICES,
  byCategory,
  type Provider,
  type ServicePreset,
} from "../presets/catalog";
import { NODE_HEIGHT, NODE_WIDTH, placeService } from "../presets/build";

/**
 * The cloud service catalog, as a picker.
 *
 * Picking a service drops it at the middle of the viewport rather than asking
 * the user to drag: it works the same under a mouse and a thumb, and the node
 * lands selected so it can be moved straight away.
 */
export const ServiceLibrary = ({ onClose }: { onClose: () => void }) => {
  const [provider, setProvider] = useState<Provider>("aws");
  const [query, setQuery] = useState("");
  /** each pick offsets a little, so a run of them doesn't stack in one spot */
  const placed = useRef(0);

  const results = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return null;
    return SERVICES.filter(
      (s) =>
        s.name.toLowerCase().includes(term) ||
        s.category.toLowerCase().includes(term) ||
        PROVIDERS[s.provider].name.toLowerCase().includes(term) ||
        s.id.includes(term),
    );
  }, [query]);

  const place = (preset: ServicePreset) => {
    const container = document.querySelector(".canvas-container");
    const rect = container?.getBoundingClientRect();
    const { scrollX, scrollY, zoom } = store.appState;

    // stagger repeated picks down and to the right
    const step = (placed.current % 6) * 28;
    placed.current += 1;

    const centreX = rect ? rect.width / (2 * zoom) - scrollX : 0;
    const centreY = rect ? rect.height / (2 * zoom) - scrollY : 0;
    placeService(preset, centreX - NODE_WIDTH / 2 + step, centreY - NODE_HEIGHT / 2 + step);
  };

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog wide" onClick={(event) => event.stopPropagation()}>
        <header>
          <h2>Cloud services</h2>
          <button className="icon-button" aria-label="Close" onClick={onClose}>
            <IconClose />
          </button>
        </header>

        <div className="service-bar">
          <div className="choice service-tabs">
            {(Object.keys(PROVIDERS) as Provider[]).map((id) => (
              <button
                key={id}
                className={provider === id && !results ? "active" : ""}
                onClick={() => {
                  setProvider(id);
                  setQuery("");
                }}
              >
                {PROVIDERS[id].name}
              </button>
            ))}
          </div>
          <input
            type="search"
            className="service-search"
            placeholder="Search all providers…"
            aria-label="Search services"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>

        <div className="dialog-body service-body">
          {results ? (
            results.length ? (
              <ServiceGrid items={results} onPick={place} showProvider />
            ) : (
              <p className="hint">Nothing matches “{query.trim()}”.</p>
            )
          ) : (
            byCategory(provider).map((group) => (
              <section key={group.category} className="service-group">
                <h3>{group.category}</h3>
                <ServiceGrid items={group.items} onPick={place} />
              </section>
            ))
          )}
        </div>

        <footer>
          <span className="hint">
            Placed services are ordinary components — connect, resize and edit them like
            anything else. They travel inside the file.
          </span>
        </footer>
      </div>
    </div>
  );
};

const ServiceGrid = ({
  items,
  onPick,
  showProvider,
}: {
  items: ServicePreset[];
  onPick: (preset: ServicePreset) => void;
  showProvider?: boolean;
}) => (
  <div className="service-grid">
    {items.map((preset) => (
      <button
        key={preset.id}
        className="service-chip"
        onClick={() => onPick(preset)}
        title={`Add ${preset.name}`}
      >
        <span className="service-dot" style={{ background: PROVIDERS[preset.provider].accent }} />
        <span className="service-name">{preset.name}</span>
        {/* grouped view already has a category heading above it */}
        {showProvider && (
          <span className="hint">
            {PROVIDERS[preset.provider].name} · {preset.category}
          </span>
        )}
      </button>
    ))}
  </div>
);
