import { useState, useEffect } from "react";
import { getClientesValidados } from "../api.js";

// Tela "Clientes" (2026-07-16, só owner/manager) — clientes validados: quem já
// comprou (origem_validacao='compra', marcado sozinho ao entrar em fechado_ganho)
// ou quem o vendedor confirmou manualmente como cliente antigo real da campanha de
// reativação (origem_validacao='campanha_reativacao', ver checkbox em CRM.jsx
// NovoModal). Distinta do CRM Pipeline normal (leads ativos no funil) — aqui é o
// histórico de "gente que a gente já validou que é cliente de verdade".
const ORIGEM_INFO = {
  compra: ["#4caf7d", "Comprou"],
  campanha_reativacao: ["#C8A84B", "Reativação"],
};

function fmtData(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

export default function Clientes() {
  const [dados, setDados] = useState([]);
  const [busca, setBusca] = useState("");
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(null);

  useEffect(() => {
    getClientesValidados().then(d => { setDados(d); setLoading(false); })
      .catch(() => { setErro("Erro ao carregar dados. Tente novamente."); setLoading(false); });
  }, []);

  const filtrados = dados.filter(c => {
    const q = busca.trim().toLowerCase();
    if (!q) return true;
    return (c.nome || "").toLowerCase().includes(q) || (c.telefone || "").includes(q);
  });

  if (erro) return <div className="empty-state"><i className="ti ti-alert-triangle" /><p>{erro}</p></div>;
  if (loading) return <div className="empty-state"><i className="ti ti-loader" style={{ animation: "spin 1s linear infinite" }} /><p>Carregando...</p></div>;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title"><i className="ti ti-users-group" /> Clientes ({dados.length})</h1>
      </div>
      <input className="form-input" style={{ marginBottom: 16, maxWidth: 320 }} placeholder="Buscar por nome ou telefone..." value={busca} onChange={e => setBusca(e.target.value)} />

      {filtrados.length === 0 && <div className="empty-state"><i className="ti ti-users-group" /><p>Nenhum cliente validado ainda.</p></div>}

      {filtrados.length > 0 && (
        <div className="card d-desktop" style={{ padding: 0, overflow: "hidden" }}>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Nome</th><th>Telefone</th><th>Veículo</th><th>Origem</th><th>Vendedor</th><th>Validado em</th><th></th></tr></thead>
              <tbody>
                {filtrados.map(c => {
                  const [cor, label] = ORIGEM_INFO[c.origem_validacao] || ["var(--muted)", c.origem_validacao];
                  return (
                    <tr key={c.id}>
                      <td style={{ fontWeight: 600, color: "var(--fg)" }}>{c.nome}</td>
                      <td style={{ color: "var(--muted)" }}>{c.telefone || "—"}</td>
                      <td style={{ color: "var(--muted)" }}>{c.veiculo_interesse || "—"}</td>
                      <td><span className="badge" style={{ background: `${cor}22`, color: cor, fontSize: 11 }}>{label}</span></td>
                      <td style={{ color: "var(--muted)" }}>{c.vendedor_nome || "—"}</td>
                      <td style={{ color: "var(--muted)" }}>{fmtData(c.validado_em)}</td>
                      <td>{c.chatwoot_conv_id && <a href={`https://chat.laautomoveis.com.br/app/accounts/1/conversations/${c.chatwoot_conv_id}`} target="_blank" rel="noopener noreferrer" className="btn-chatwoot"><i className="ti ti-message-2" /></a>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MOBILE: cards */}
      <div className="d-mobile" style={{ gap: 12 }}>
        {filtrados.map(c => {
          const [cor, label] = ORIGEM_INFO[c.origem_validacao] || ["var(--muted)", c.origem_validacao];
          return (
            <div key={c.id} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "var(--fg)" }}>{c.nome}</div>
                  <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{c.telefone || "sem telefone"} · {c.veiculo_interesse || "sem veículo"}</div>
                  <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{c.vendedor_nome || "sem vendedor"} · {fmtData(c.validado_em)}</div>
                </div>
                <span className="badge" style={{ background: `${cor}22`, color: cor, fontSize: 11, flexShrink: 0 }}>{label}</span>
              </div>
              {c.chatwoot_conv_id && (
                <a href={`https://chat.laautomoveis.com.br/app/accounts/1/conversations/${c.chatwoot_conv_id}`} target="_blank" rel="noopener noreferrer" className="btn-chatwoot" style={{ marginTop: 10, display: "inline-flex" }}>
                  <i className="ti ti-message-2" /> Chatwoot
                </a>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
