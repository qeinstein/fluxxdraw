import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { installFontFaces } from "./fonts";

// Register the drawing fonts before React mounts, so the first measurement
// pass has them available rather than sizing text against a fallback.
installFontFaces();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
