import { createRoot } from "react-dom/client";
import { App } from "./App";
// Style demo (mapa, suwak, nakładki) — te same pliki co w web preview i na
// landingu, żeby klatka w prezentacji była tą samą apką.
import "../../web/src/styles.css";
import "maplibre-gl/dist/maplibre-gl.css";
import "./deck.css";

createRoot(document.getElementById("root")!).render(<App />);
