import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
// Ícones Tabler recortados (só os usados), servidos com o painel. Ícone novo: scripts/icones.py
import "./assets/icones/tabler-recorte.css";
import "./index.css";
import { getTema, aplicarTema } from "./theme.js";
import { instalarModalGuard } from "./lib/modalGuard.js";
import { ouvirInstalacao } from "./lib/instalarApp.js";
import { registrarServiceWorker } from "./lib/avisos.js";
import { iniciarUso } from "./lib/uso.js";

aplicarTema(getTema());
instalarModalGuard();
ouvirInstalacao();
registrarServiceWorker();
iniciarUso();

ReactDOM.createRoot(document.getElementById("root")).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
);
