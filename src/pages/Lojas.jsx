import { useState, useEffect } from "react";
import { api } from "../lib/api.js";

const STATUS_LABEL = { ativa: "Ativa", vencida: "Vencida", cancelada: "Cancelada" };
const STATUS_BADGE = { ativa: "badge-success", vencida: "badge-danger", cancelada: "badge-warning" };

function Contagem({ dias }) {
  if (dias === null || dias === undefined) {
    return <span style={{ color: "var(--muted)" }}>Sem data definida</span>;
  }
  if (dias < 0) {
    return <span style={{ color: "var(--danger)", fontWeight: 700 }}>Venceu há {Math.abs(dias)} {Math.abs(dias) === 1 ? "dia" : "dias"}</span>;
  }
  if (dias === 0) {
    return <span style={{ color: "var(--danger)", fontWeight: 700 }}>Vence hoje</span>;
  }
  const cor = dias <= 5 ? "var(--danger)" : dias <= 15 ? "var(--warning)" : "var(--success)";
  return <span style={{ color: cor, fontWeight: 700 }}>{dias} {dias === 1 ? "dia restante" : "dias restantes"}</span>;
}

function LojaCard({ loja, onSalvar }) {
  const [dataVencimento, setDataVencimento] = useState(loja.data_vencimento ? loja.data_vencimento.slice(0, 10) : "");
  const [statusAssinatura, setStatusAssinatura] = useState(loja.status_assinatura);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState(null);

  const alterado = dataVencimento !== (loja.data_vencimento ? loja.data_vencimento.slice(0, 10) : "") || statusAssinatura !== loja.status_assinatura;

  async function salvar() {
    setSalvando(true); setErro(null);
    try {
      await onSalvar(loja.id, { data_vencimento: dataVencimento || null, status_assinatura: statusAssinatura });
    } catch (e) {
      setErro(e.message || "Erro ao salvar");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "var(--fg)" }}>{loja.nome}</div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{loja.cidade} · {loja.nome_agente}</div>
        </div>
        <span className={`badge ${STATUS_BADGE[loja.status_assinatura] || ""}`} style={{ fontSize: 11 }}>
          {STATUS_LABEL[loja.status_assinatura] || loja.status_assinatura}
        </span>
      </div>

      <div style={{ background: "var(--surface2)", borderRadius: 8, padding: "10px 14px", fontSize: 14 }}>
        <Contagem dias={loja.dias_restantes} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div>
          <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 4 }}>Vencimento</label>
          <input
            type="date"
            value={dataVencimento}
            onChange={(e) => setDataVencimento(e.target.value)}
            className="form-input"
            style={{ width: "100%" }}
          />
        </div>
        <div>
          <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 4 }}>Status</label>
          <select
            value={statusAssinatura}
            onChange={(e) => setStatusAssinatura(e.target.value)}
            className="form-input"
            style={{ width: "100%" }}
          >
            <option value="ativa">Ativa</option>
            <option value="vencida">Vencida</option>
            <option value="cancelada">Cancelada</option>
          </select>
        </div>
      </div>

      {erro && <div style={{ fontSize: 12, color: "var(--danger)" }}>{erro}</div>}

      <button
        className="btn btn-primary"
        disabled={!alterado || salvando}
        onClick={salvar}
        style={{ alignSelf: "flex-start" }}
      >
        {salvando ? "Salvando..." : "Salvar"}
      </button>
    </div>
  );
}

export default function Lojas() {
  const [lojas, setLojas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(null);

  function carregar() {
    setLoading(true);
    api.getLojas().then((l) => { setLojas(l); setLoading(false); })
      .catch(() => { setErro("Erro ao carregar lojas. Tente novamente."); setLoading(false); });
  }

  useEffect(() => { carregar(); }, []);

  async function salvar(id, data) {
    const atualizada = await api.atualizarLoja(id, data);
    setLojas((prev) => prev.map((l) => (l.id === id ? { ...l, ...atualizada, dias_restantes: calcularDias(atualizada.data_vencimento) } : l)));
  }

  function calcularDias(dataVencimento) {
    if (!dataVencimento) return null;
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    const venc = new Date(dataVencimento);
    return Math.round((venc - hoje) / 86400000);
  }

  if (erro) return <div className="empty-state"><i className="ti ti-alert-triangle" /><p>{erro}</p></div>;
  if (loading) return <div className="empty-state"><i className="ti ti-loader" style={{ animation: "spin 1s linear infinite" }} /><p>Carregando...</p></div>;

  return (
    <div>
      <div className="page-header"><h1 className="page-title"><i className="ti ti-building-store" /> Lojas</h1></div>
      <p style={{ fontSize: 13, color: "var(--muted)", marginTop: -8, marginBottom: 16 }}>
        Vencimento e status atualizados manualmente por enquanto — a integração com a Kiwify ainda não está conectada.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(320px,1fr))", gap: 12 }}>
        {lojas.map((loja) => (
          <LojaCard key={loja.id} loja={loja} onSalvar={salvar} />
        ))}
      </div>
    </div>
  );
}
