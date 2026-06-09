import { useEffect, useState } from "react";
import { CheckCheck, MessageSquare, Calculator } from "lucide-react";
import { api } from "../lib/api.js";

export default function Leads() {
  const [tab, setTab] = useState("contato");
  const [contatos, setContatos] = useState([]);
  const [financiamentos, setFinanciamentos] = useState([]);

  async function load() {
    const [c, f] = await Promise.all([
      api.getLeadsContato().catch(() => []),
      api.getLeadsFinanciamento().catch(() => []),
    ]);
    setContatos(c);
    setFinanciamentos(f);
  }

  useEffect(() => { load(); }, []);

  async function marcarLido(tipo, id) {
    if (tipo === "contato") {
      await api.marcarLidoContato(id);
      setContatos(l => l.map(x => x.id === id ? { ...x, lido: true } : x));
    } else {
      await api.marcarLidoFinanciamento(id);
      setFinanciamentos(l => l.map(x => x.id === id ? { ...x, lido: true } : x));
    }
  }

  const fmt = d => new Date(d).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  const brl = n => n ? Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }) : "—";

  const naoLidosContato = contatos.filter(c => !c.lido).length;
  const naoLidosFinanc = financiamentos.filter(c => !c.lido).length;

  return (
    <div>
      <div className="page-header">
        <h1>Leads</h1>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        <button
          className={`btn ${tab === "contato" ? "btn-primary" : "btn-ghost"}`}
          onClick={() => setTab("contato")}
        >
          <MessageSquare size={14} />
          Contato
          {naoLidosContato > 0 && (
            <span style={{ background: "var(--danger)", color: "#fff", borderRadius: 99, padding: "1px 6px", fontSize: 11 }}>
              {naoLidosContato}
            </span>
          )}
        </button>
        <button
          className={`btn ${tab === "financiamento" ? "btn-primary" : "btn-ghost"}`}
          onClick={() => setTab("financiamento")}
        >
          <Calculator size={14} />
          Financiamento
          {naoLidosFinanc > 0 && (
            <span style={{ background: "var(--danger)", color: "#fff", borderRadius: 99, padding: "1px 6px", fontSize: 11 }}>
              {naoLidosFinanc}
            </span>
          )}
        </button>
      </div>

      {tab === "contato" && (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          {contatos.length === 0 ? (
            <div className="empty">Nenhum lead de contato.</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Telefone</th>
                  <th>E-mail</th>
                  <th>Mensagem</th>
                  <th>Data</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {contatos.map(c => (
                  <tr key={c.id} style={{ opacity: c.lido ? 0.6 : 1 }}>
                    <td style={{ fontWeight: 600 }}>{c.nome}</td>
                    <td>
                      <a href={`https://wa.me/55${c.telefone.replace(/\D/g, "")}`} target="_blank" style={{ color: "var(--brand)" }}>
                        {c.telefone}
                      </a>
                    </td>
                    <td>{c.email || "—"}</td>
                    <td style={{ maxWidth: 200, color: "var(--muted)" }}>
                      <span style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                        {c.mensagem || "—"}
                      </span>
                    </td>
                    <td style={{ color: "var(--muted)", fontSize: 12, whiteSpace: "nowrap" }}>{fmt(c.criado_em)}</td>
                    <td>
                      {c.lido
                        ? <span className="badge badge-green">Lido</span>
                        : <span className="badge badge-yellow">Novo</span>
                      }
                    </td>
                    <td>
                      {!c.lido && (
                        <button className="btn btn-ghost btn-sm" onClick={() => marcarLido("contato", c.id)} title="Marcar como lido">
                          <CheckCheck size={13} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === "financiamento" && (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          {financiamentos.length === 0 ? (
            <div className="empty">Nenhum lead de financiamento.</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Telefone</th>
                  <th>Veículo</th>
                  <th>Valor</th>
                  <th>Entrada</th>
                  <th>Parcelas</th>
                  <th>Data</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {financiamentos.map(f => (
                  <tr key={f.id} style={{ opacity: f.lido ? 0.6 : 1 }}>
                    <td style={{ fontWeight: 600 }}>{f.nome}</td>
                    <td>
                      <a href={`https://wa.me/55${f.telefone.replace(/\D/g, "")}`} target="_blank" style={{ color: "var(--brand)" }}>
                        {f.telefone}
                      </a>
                    </td>
                    <td>{f.veiculo_interesse || "—"}</td>
                    <td>{brl(f.valor_veiculo)}</td>
                    <td>{brl(f.entrada)}</td>
                    <td>{f.parcelas ? `${f.parcelas}x` : "—"}</td>
                    <td style={{ color: "var(--muted)", fontSize: 12, whiteSpace: "nowrap" }}>{fmt(f.criado_em)}</td>
                    <td>
                      {f.lido
                        ? <span className="badge badge-green">Lido</span>
                        : <span className="badge badge-yellow">Novo</span>
                      }
                    </td>
                    <td>
                      {!f.lido && (
                        <button className="btn btn-ghost btn-sm" onClick={() => marcarLido("financiamento", f.id)} title="Marcar como lido">
                          <CheckCheck size={13} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
