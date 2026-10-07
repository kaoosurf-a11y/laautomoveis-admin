import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import "./index.css";
import { getTema, aplicarTema } from "./theme.js";
import { instalarModalGuard } from "./lib/modalGuard.js";

aplicarTema(getTema());
instalarModalGuard();

ReactDOM.createRoot(document.getElementById("root")).render(
  <BrowserRouter basename="/admin">
    <App />
  </BrowserRouter>
);
