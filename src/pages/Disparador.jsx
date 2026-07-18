import { useState, useEffect, useCallback } from "react";
import { getDisparador } from "../api.js";

// Tela "Disparador" (2026-07-16, ajustada 2026-07-19, só owner/manager) — contatos
// AINDA na campanha de reativação (campanha_reativacao_clientes), antes de qualquer
// validação. Universo separado de "Clientes" (que só tem quem já foi confirmado) —
// aba própria por pedido explícito do usuário, mesmo sendo fases da mesma jornada.
// Um contato só "sai" daqui quando o vendedor valida manualmente e cria o lead no
// CRM (checkbox em CRM.jsx NovoModal); a linha aqui continua existindo pra rastreio.
//
// 2026-07-19: simplificado pra 3 abas de status (o resto vira badge no card) e
// reorganizado em SEÇÕES por vendedor (não colunas lado a lado — ver explicação
// no README da tela / mensagem do commit: cards são densos demais pra caber em 3
// colunas estreitas sem espremer o preview de mensagem e os badges). Cada seção
// busca sua própria página de contatos (parâmetro "vendedor" já existia no backend)
// pra não deixar um vendedor "roubar" a paginação combinada do outro.
const FILTROS = [
  { key: "todos", label: "Todos" },
  { key: "aguardando", label: "Aguardando envio" },
  { key: "invalido", label: "Inválido" },
];

const PERIODOS = [
  { key: "todos", label: "Todos" },
  { key: "hoje", label: "Hoje" },
  { key: "semana", label: "Esta semana" },
  { key: "mes", label: "Este mês" },
  { key: "ano", label: "Este ano" },
  { key: "personalizado", label: "Personalizado" },
];

const STATUS_INFO = {
  confirmado: ["#4caf7d", "Confirmado"],
  invalido: ["#e05252", "Inválido"],
  sem_resposta: ["#8d6e63", "Sem resposta"],
};

const VENDEDORES = [
  { key: "alex", label: "Alex", instance: "vendedor-alex" },
  { key: "wolni", label: "Wolni", instance: "vendedor-wolni" },
  { key: "dariana", label: "Dariana", instance: "vendedor-dariana" },
];

function fmtData(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function CardContato({ c, aberto, onToggle }) {
  const retido = c.vendedor_atribuido === "dariana" && c.instancia_status !== "open";
  const aguardando = c.status === "validando-numero" && !c.ultimo_envio;
  const [corStatus, labelStatus] = STATUS_INFO[c.status] || ["#7ba7e0", aguardando ? "Aguardando envio" : `Enviado (${c.tentativas}/3)`];
  const cor = retido ? "#C8A84B" : corStatus;
  return (
    <div className="card" style={{ borderLeft: `3px solid ${cor}`, padding: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--fg)" }}>{c.nome}</div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
            {c.telefone || "sem telefone"} {(c.cidade || c.estado) && `· ${[c.cidade, c.estado].filter(Boolean).join("/")}`}
          </div>
        </div>
        <span className="badge" style={{ background: `${cor}22`, color: cor, fontSize: 11 }}>{retido ? "Retido (Dariana desconectada)" : labelStatus}</span>
      </div>

      {aguardando && !retido && (
        <div style={{ fontSize: 12, color: "var(--brand)", marginTop: 8, display: "flex", alignItems: "center", gap: 5 }}>
          <i className="ti ti-clock" style={{ fontSize: 13 }} />
          {c.estimativa_envio ? <>Previsão de envio: <b>{c.estimativa_envio}</b> <span style={{ color: "var(--muted)", fontWeight: 400 }}>(estimativa, não garantido)</span></> : "Sem estimativa disponível"}
        </div>
      )}
      {!aguardando && (
        <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 8 }}>
          {c.tentativas} tentativa(s) · Último envio: {fmtData(c.ultimo_envio)} · Próxima: {fmtData(c.proxima_tentativa)}
        </div>
      )}

      <div style={{ marginTop: 10, background: "var(--surface2)", borderRadius: 8, padding: "8px 10px" }}>
        <div style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase", marginBottom: 4 }}>
          {c.mensagem_ja_enviada ? "Última mensagem enviada" : "Prévia da próxima mensagem"}
        </div>
        <div style={{ fontSize: 13, color: "var(--fg)" }}>{c.mensagem || "—"}</div>
      </div>
      {c.historico && c.historico.length > 1 && (
        <button className="btn btn-ghost" style={{ padding: "3px 8px", fontSize: 11, marginTop: 8 }} onClick={onToggle}>
          {aberto ? "Ocultar" : "Ver"} histórico completo ({c.historico.length})
        </button>
      )}
      {aberto && (
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
          {c.historico.map((h, i) => (
            <div key={i} style={{ fontSize: 12, padding: "6px 10px", borderRadius: 8, background: h.role === "assistant" ? "var(--surface2)" : "rgba(200,168,75,.12)" }}>
              <span style={{ color: "var(--muted)", fontSize: 10 }}>{h.role === "assistant" ? c.vendedor_nome_exibicao : "Cliente"} · {fmtData(h.timestamp)}</span>
              <div style={{ color: "var(--fg)", marginTop: 2 }}>{h.content}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Disparador() {
  const [porVendedor, setPorVendedor] = useState({});
  const [resumo, setResumo] = useState([]);
  const [instancias, setInstancias] = useState({});
  const [filtro, setFiltro] = useState("todos");
  const [busca, setBusca] = useState("");
  const [quando, setQuando] = useState("previsto_enviado");
  const [periodo, setPeriodo] = useState("todos");
  const [desde, setDesde] = useState("");
  const [ate, setAte] = useState("");
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(null);
  const [expandido, setExpandido] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    const base = { limit: 50 };
    if (filtro !== "todos") base.filtro = filtro;
    if (busca.trim()) base.busca = busca.trim();
    if (periodo !== "todos") {
      base.quando = quando;
      base.periodo = periodo;
      if (periodo === "personalizado" && desde) { base.desde = desde; base.ate = ate || desde; }
    }
    Promise.all(VENDEDORES.map(v => getDisparador({ ...base, vendedor: v.key })))
      .then(results => {
        const next = {};
        VENDEDORES.forEach((v, i) => { next[v.key] = results[i]; });
        setPorVendedor(next);
        setResumo(results[0]?.resumo || []);
        setInstancias(results[0]?.instancias || {});
        setLoading(false);
      })
      .catch(() => { setErro("Erro ao carregar dados. Tente novamente."); setLoading(false); });
  }, [filtro, busca, quando, periodo, desde, ate]);

  useEffect(() => { load(); }, [load]);

  const totalGeral = resumo.reduce((s, r) => s + r.total, 0);
  const totalRetido = resumo.filter(r => r.vendedor_atribuido === "dariana").reduce((s, r) => s + r.total, 0);

  if (erro) return <div className="empty-state"><i className="ti ti-alert-triangle" /><p>{erro}</p></div>;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title"><i className="ti ti-send" /> Disparador ({totalGeral})</h1>
      </div>

      {/* Aviso importante: disparo usa o número PESSOAL de cada vendedor (instância
      Evolution própria), não o número da Lara — diferente do atendimento normal. */}
      <div className="card" style={{ marginBottom: 16, borderLeft: "3px solid var(--brand)", display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ fontSize: 13, color: "var(--fg)" }}>
          <i className="ti ti-info-circle" style={{ color: "var(--brand)" }} /> Esse disparo sai pelo WhatsApp <b>pessoal de cada vendedor</b> (Alex e Wolni), não pelo número da Lara — instâncias separadas da que atende o dia a dia.
        </div>
        {totalRetido > 0 && (
          <div>
            <span className="badge" style={{ background: "#C8A84B22", color: "#C8A84B", fontSize: 11 }}>{totalRetido} contatos retidos até Dariana reconectar</span>
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
        {FILTROS.map(f => (
          <button key={f.key} className={`tab-btn ${filtro === f.key ? "active" : ""}`} onClick={() => setFiltro(f.key)}>{f.label}</button>
        ))}
      </div>

      <input className="form-input" style={{ marginBottom: 14, maxWidth: 320 }} placeholder="Buscar por nome ou telefone..." value={busca} onChange={e => setBusca(e.target.value)} />

      {/* Filtro de período — combinável com o filtro de status acima, não substitui. */}
      <div className="card" style={{ marginBottom: 16, padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>Filtrar data de:</span>
            <select className="form-input" style={{ marginBottom: 0, width: "auto", padding: "5px 8px", fontSize: 12 }} value={quando} onChange={e => setQuando(e.target.value)}>
              <option value="previsto_enviado">Previsão/envio</option>
              <option value="entrada">Entrada na campanha</option>
            </select>
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {PERIODOS.map(p => (
              <button key={p.key} className={`tab-btn ${periodo === p.key ? "active" : ""}`} style={{ padding: "5px 10px", fontSize: 12 }} onClick={() => setPeriodo(p.key)}>{p.label}</button>
            ))}
          </div>
        </div>
        {periodo === "personalizado" && (
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <input type="date" className="form-input" style={{ marginBottom: 0, width: "auto" }} value={desde} onChange={e => setDesde(e.target.value)} />
            <span style={{ color: "var(--muted)", fontSize: 12 }}>até</span>
            <input type="date" className="form-input" style={{ marginBottom: 0, width: "auto" }} value={ate} onChange={e => setAte(e.target.value)} />
          </div>
        )}
        {quando === "entrada" && (
          <div style={{ fontSize: 11, color: "var(--warning)" }}>
            <i className="ti ti-alert-triangle" /> Todos os 3.763 contatos entraram no mesmo dia (importação em lote) — esse filtro só fica útil quando novos contatos forem adicionados em datas diferentes.
          </div>
        )}
      </div>

      {loading && <div className="empty-state"><i className="ti ti-loader" style={{ animation: "spin 1s linear infinite" }} /><p>Carregando...</p></div>}

      {!loading && VENDEDORES.map(v => {
        const info = porVendedor[v.key] || { contatos: [], total: 0 };
        const conectado = instancias[v.instance] === "open";
        return (
          <div key={v.key} style={{ marginBottom: 26 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: conectado ? "#4caf7d" : "#e05252", display: "inline-block" }} />
              <span style={{ fontSize: 15, fontWeight: 700, color: "var(--fg)" }}>{v.label}</span>
              <span className="badge" style={{ background: "var(--surface2)", color: "var(--muted)", fontSize: 11 }}>{info.total} contato{info.total === 1 ? "" : "s"}</span>
              {!conectado && <span style={{ fontSize: 11, color: "#e05252" }}>desconectado</span>}
            </div>

            {info.contatos.length === 0 && <div className="empty-state" style={{ padding: 16 }}><i className="ti ti-send" style={{ fontSize: 20 }} /><p>Nenhum contato nesse filtro.</p></div>}

            {info.contatos.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {info.total > info.contatos.length && (
                  <div style={{ fontSize: 12, color: "var(--muted)" }}>Mostrando {info.contatos.length} de {info.total} — use a busca ou os filtros pra refinar.</div>
                )}
                {info.contatos.map(c => (
                  <CardContato key={c.id} c={c} aberto={expandido === c.id} onToggle={() => setExpandido(expandido === c.id ? null : c.id)} />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
