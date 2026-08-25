import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { store } from "../store";
import {
  PROVIDERS,
  SERVICES,
  byCategory,
  type Provider,
  type ServicePreset,
} from "../presets/catalog";
import { NODE_HEIGHT, NODE_WIDTH, glyphPreview, placeService } from "../presets/build";
import { renderElements } from "../render/renderScene";
import { useIsMobile } from "../hooks/useMediaQuery";
import type { Glyph } from "../presets/catalog";

/**
 * The cloud service catalog, as a picker.
 *
 * Picking a service drops it at the middle of the viewport rather than asking
 * the user to drag: it works the same under a mouse and a thumb, and the node
 * lands selected so it can be moved straight away.
 */
export const ServiceLibraryPanel = ({ onClose }: { onClose: () => void }) => {
  const [provider, setProvider] = useState<Provider>("aws");
  const [query, setQuery] = useState("");
  const isMobile = useIsMobile();

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

    const centreX = rect ? rect.width / (2 * zoom) - scrollX : 0;
    const centreY = rect ? rect.height / (2 * zoom) - scrollY : 0;
    placeService(preset, centreX - NODE_WIDTH / 2, centreY - NODE_HEIGHT / 2);
    // the node lands selected, so get out of the way and let it be moved
    onClose();
  };

  return (
    <div className="service-panel" style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div className="service-bar" style={{ padding: "0 16px 16px" }}>
        <div className="choice service-tabs" style={{ marginBottom: 12 }}>
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
          /* a 68-item catalog is faster to type into than to scroll, but
             autofocus on a phone would cover the list with a keyboard */
          autoFocus={!isMobile}
        />
      </div>

      <div className="service-body" style={{ flex: 1, overflowY: "auto", padding: "0 16px 16px" }}>
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

      <footer style={{ padding: "16px", borderTop: "1px solid var(--line)" }}>
        <span className="hint">
          Placed services are ordinary components — connect, resize and edit them like
          anything else.
        </span>
      </footer>
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
        <GlyphPreview glyph={preset.glyph} accent={PROVIDERS[preset.provider].accent} />
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

const PREVIEW_SIZE = 26;

/**
 * Draws a service's glyph with the same renderer the canvas uses, so the
 * picker shows the actual hand-drawn mark rather than a stand-in.
 */
const GlyphPreview = ({ glyph, accent }: { glyph: Glyph; accent: string }) => {
  const ref = useRef<HTMLCanvasElement>(null);

  useLayoutEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = PREVIEW_SIZE * dpr;
    canvas.height = PREVIEW_SIZE * dpr;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const { elements, size } = glyphPreview(glyph, accent);
    const scale = (PREVIEW_SIZE / size) * dpr;
    ctx.save();
    ctx.scale(scale, scale);
    renderElements(ctx, elements, {
      scrollX: 0,
      scrollY: 0,
      zoom: 1,
      scale: dpr,
      files: {},
      exporting: true,
    });
    ctx.restore();
  }, [glyph, accent]);

  return (
    <canvas
      ref={ref}
      className="service-glyph"
      style={{ width: PREVIEW_SIZE, height: PREVIEW_SIZE }}
      aria-hidden="true"
    />
  );
};
