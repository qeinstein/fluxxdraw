import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Analytics } from "@vercel/analytics/react";
import "./index.css";
import App from "./App.tsx";
import { installFontFaces } from "./fonts";

// Register the drawing fonts before React mounts, so the first measurement
// pass has them available rather than sizing text against a fallback.
installFontFaces();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
    {/*
      * Aggregate traffic only: page views, referrers, country, device class.
      * Cookieless, no identifiers, nothing about what anyone draws — the
      * drawings never leave the machine, and that isn't going to change for
      * the sake of a chart. Figures live in the Vercel dashboard, which is the
      * only place they can live without a server of our own.
      */}
    <Analytics />
  </StrictMode>,
);
