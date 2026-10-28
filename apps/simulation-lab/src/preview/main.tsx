import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { cssVariables } from "../style/channel.ts";
import { App } from "./App.tsx";
import "./sokosoko.css";
import "./styles.css";

// The page shares the video's design tokens: inject the design system's tokens as CSS custom properties.
for (const [name, value] of Object.entries(cssVariables())) document.documentElement.style.setProperty(name, value);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
