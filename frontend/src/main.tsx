import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
// Self-hosted Poppins (no Google Fonts request): works offline in the Android shell and avoids third-party tracking.
import "@fontsource/poppins/400.css";
import "@fontsource/poppins/500.css";
import "@fontsource/poppins/600.css";
import "@fontsource/poppins/700.css";
import "./styles/index.css";

/** Application bootstrap: mounts <App/> into #root. */
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
