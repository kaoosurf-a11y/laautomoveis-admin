import { useState } from "react";
import { ligarLead } from "../api.js";
import { alertDialog, confirmDialog } from "./Dialog.jsx";

// 2026-11-06 (Felipe): o vendedor ve so os 4 ultimos numeros do cliente. Pra ligar, o numero vem do backend
// na hora do toque (POST /api/crm/leads/:id/ligar), que registra quem ligou e quando, e abre o discador.
// Mostra o botao so quando o lead tem telefone de verdade (mascarado ****1234 ou completo); contato @lid nao.
export function temTelefone(tel) {
  const s = String(tel || "");
  if (/^\*{4}\d{4}$/.test(s)) return true;
  const d = s.replace(/\D/g, "");
  return d.length >= 10 && d.length <= 13;
}

// 2026-11-17 (Felipe): no PC nao tem discador, o tel: nao abria nada e o vendedor ficava sem o numero.
// No PC (mouse, sem toque) mostra o numero numa janela com botao de copiar. No celular segue abrindo o discador.
function ehPC() {
  try { return window.matchMedia("(pointer: fine)").matches && !window.matchMedia("(pointer: coarse)").matches; } catch { return false; }
}
function formatarTel(e164) {
  let d = String(e164 || "").replace(/\D/g, "");
  if (d.startsWith("55") && d.length >= 12) d = d.slice(2);
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return d;
}
async function mostrarNumeroPC(e164) {
  const num = formatarTel(e164);
  const copiar = await confirmDialog(num, { title: "Número do cliente", icon: "phone", grande: true, danger: false, confirmLabel: "Copiar número", cancelLabel: "Fechar" });
  if (!copiar) return;
  try { await navigator.clipboard.writeText(num.replace(/\D/g, "")); } catch { /* sem permissao: o numero ja esta na tela */ }
}

export default function BotaoLigar({ leadId, telefone, origem, className = "btn btn-ghost btn-sm", onLigou, children }) {
  const [abrindo, setAbrindo] = useState(false);
  if (!leadId || !temTelefone(telefone)) return null;
  async function ligar(e) {
    e?.preventDefault?.(); e?.stopPropagation?.();
    if (abrindo) return;
    setAbrindo(true);
    try {
      const r = await ligarLead(leadId, origem);
      onLigou?.();
      if (r?.discar) {
        if (ehPC()) await mostrarNumeroPC(r.discar);
        else window.location.href = `tel:${r.discar}`;
      }
    } catch (err) {
      await alertDialog(String(err?.message || "").includes("403") ? "Esse lead não é seu." : "Não foi possível ligar agora. Tente de novo.");
    }
    setAbrindo(false);
  }
  return (
    <button type="button" className={className} onClick={ligar} disabled={abrindo} title="Ligar pro cliente (fica registrado)">
      {abrindo ? <span className="spinner" /> : <i className="ti ti-phone" />}{children ?? "Ligar"}
    </button>
  );
}
