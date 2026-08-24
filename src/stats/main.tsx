import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./stats.css";
import { Dashboard } from "./Dashboard";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Dashboard />
  </StrictMode>,
);
