import { useState, useEffect } from "react";

// LA V1 20260810 (achado em auditoria, pedido do Felipe "deixar visual mais moderno"):
// substitui window.alert()/window.confirm() nativos (28 usos espalhados em CRM.jsx,
// FollowUps.jsx, Veiculos.jsx, ChatwootLink.jsx) por um modal próprio, reaproveitando o
// MESMO padrão visual que já existia só pra "excluir veículo" (Veiculos.jsx tinha seu
// próprio modal de confirmação inline — ícone + título + mensagem + botões Cancelar/
// Confirmar). Generalizado aqui pra qualquer alerta/confirmação do painel inteiro:
// window.confirm()/alert() abrem um diálogo do NAVEGADOR (não do app), com aparência e
// posição diferentes em cada iOS/Android/desktop, sem nada do visual dourado/escuro do
// resto do painel — no celular em particular costumam ficar pequenos e mal posicionados.
//
// API imperativa (mantém os call-sites quase idênticos ao alert()/confirm() original,
// só trocando por await): `await confirmDialog("mensagem", {opts})` retorna
// true/false; `await alertDialog("mensagem", {opts})` resolve quando o usuário fecha.
// Um único <DialogHost/> fica montado na raiz do app (ver App.jsx) — funciona em
// qualquer página sem precisar de Provider/Context, só um "endereço" (_open) que o
// host registra ao montar.
let _open = null;

function DialogModal({ cfg, onDone }) {
  const { type, title, message, danger, confirmLabel, cancelLabel } = cfg;
  const isConfirm = type === "confirm";
  const icon = isConfirm ? (danger ? "ti-alert-triangle" : "ti-help-circle") : "ti-alert-circle";
  const iconColor = !isConfirm || danger ? "var(--danger)" : "var(--brand)";
  return (
    <div className="modal-overlay" onClick={() => isConfirm && onDone(false)}>
      <div className="modal" style={{ maxWidth: 360 }} onClick={e => e.stopPropagation()}>
        <div className="modal-handle" />
        <div style={{ textAlign: "center", padding: "10px 0 20px" }}>
          <i className={`ti ${icon}`} style={{ fontSize: 52, color: iconColor, marginBottom: 12, display: "block" }} />
          {title && <h2 style={{ fontSize: 17, fontWeight: 700, color: "var(--fg)", marginBottom: 8 }}>{title}</h2>}
          <p style={{ fontSize: 14, color: "var(--muted)", lineHeight: 1.5, whiteSpace: "pre-line" }}>{message}</p>
        </div>
        {isConfirm ? (
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => onDone(false)}>{cancelLabel || "Cancelar"}</button>
            <button
              className={danger ? "btn" : "btn btn-primary"}
              style={{ flex: 1, ...(danger ? { background: "var(--danger)", color: "#fff" } : null) }}
              onClick={() => onDone(true)}
            >
              {confirmLabel || "Confirmar"}
            </button>
          </div>
        ) : (
          <button className="btn btn-primary" style={{ width: "100%" }} onClick={() => onDone()}>OK</button>
        )}
      </div>
    </div>
  );
}

export default function DialogHost() {
  const [cfg, setCfg] = useState(null);
  useEffect(() => {
    _open = setCfg;
    return () => { _open = null; };
  }, []);
  if (!cfg) return null;
  return <DialogModal cfg={cfg} onDone={(result) => { cfg.resolve(result); setCfg(null); }} />;
}

// Fallback pro nativo se por algum motivo o host ainda não montou (não deveria
// acontecer em uso normal — DialogHost é montado na raiz do App antes de qualquer
// rota renderizar) — melhor um confirm() feio do que travar a ação do usuário.
export function confirmDialog(message, opts = {}) {
  return new Promise(resolve => {
    if (!_open) { resolve(window.confirm(message)); return; }
    _open({ type: "confirm", message, danger: true, ...opts, resolve });
  });
}
export function alertDialog(message, opts = {}) {
  return new Promise(resolve => {
    if (!_open) { window.alert(message); resolve(); return; }
    _open({ type: "alert", message, ...opts, resolve: () => resolve() });
  });
}
