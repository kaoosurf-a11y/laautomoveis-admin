import { useState, useEffect, useCallback } from "react";
import { authHeaders, getUser } from "../auth.js";

// Central de envios (2026-09-24) — SOMENTE LEITURA. Mostra, por celular de agente (Lara = Curitibanos,
// Larissa = Campos Novos), o que os follow-ups de coluna enviaram hoje contra o limite do dia, quantas
// vagas ja estao liberadas, a fila dos proximos envios e por que algo foi bloqueado.
// Alterar limite, horario e pausa e' so do administrador (PUT /api/envio/config, sem tela por enquanto).
// Permissoes vem do backend: admin_master ve as duas lojas, gerente a propria, vendedor so os proprios leads.

const API = import.meta.env.VITE_API_URL || "https://api.laautomoveis.com.br";

async function getCentral(lojaId) {
  const q = lojaId ? `?loja_id=${lojaId}` : "";
  const res = await fetch(`${API}/api/envio/central${q}`, { headers: authHeaders() });
  if (!res.ok) {
    let body = null; try { body = await res.json(); } catch {}
    const e = new Error(body?.error || String(res.status)); e.status = res.status; throw e;
  }
  return res.json();
}

const COLUNAS = {
  fecha_mes: "Fecha mês", parou_responder: "Parou de responder", vai_pensar: "Vai pensar",
  nao_achou_carro: "Não achou o carro", sem_credito: "Sem crédito", feirao: "Feirão",
  match_estoque: "Chegou carro do interesse", pos_venda_satisfacao: "Pós-venda",
  recuperacao_conversa_quente: "Conversa quente", nao_qualificado: "Não qualificado",
};
const MOTIVOS = {
  fora_do_horario_comercial: "Fora do horário de envio",
  pausado_pela_gestao: "Pausado pela gestão",
  limite_diario_colunas_loja: "Limite do dia atingido",
  ritmo_distribuido_colunas: "Aguardando a próxima vaga do dia",
  limite_por_lead_3dias: "Lead recebeu mensagem há menos de 72 h",
  limite_semanal_fecha_mes: "Limite semanal do Fecha mês",
  phone_ou_lead_id_ausente: "Lead sem telefone válido",
  phone_invalido: "Telefone inválido",
  espacamento_minimo_global: "Espaçamento mínimo entre envios",
  limite_diario_global: "Teto diário geral",
};
const rotuloColuna = (c) => COLUNAS[c] || c || "—";
const rotuloMotivo = (m) => MOTIVOS[m] || m || "—";

const SP = "America/Sao_Paulo";
const fmtHora = (iso) => (iso ? new Date(iso).toLocaleTimeString("pt-BR", { timeZone: SP, hour: "2-digit", minute: "2-digit" }) : "—");
// followup_mensagens.agendado_para e' horario de Brasilia gravado sem fuso; o JSON chega como "...Z" mas ja e o relogio local.
const fmtAgendado = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", { timeZone: "UTC", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
};
const fmtHHMM = (t) => (t ? String(t).slice(0, 5) : "—");

function Metrica({ rotulo, valor, sub, cor }) {
  return (
    <div className="card" style={{ padding: 14, flex: "1 1 150px", minWidth: 150 }}>
      <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: ".04em" }}>{rotulo}</div>
      <div style={{ fontSize: 26, fontWeight: 700, color: cor || "var(--fg)", marginTop: 4, lineHeight: 1.1 }}>{valor}</div>
      {sub && <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function Situacao({ dados }) {
  const pausado = dados.config?.pausado;
  const dentro = dados.agora?.dentro_da_janela;
  let cor = "var(--success)", texto = "Enviando dentro do horário";
  if (pausado) { cor = "var(--danger)"; texto = "Pausado pela gestão"; }
  else if (!dentro) { cor = "var(--warning)"; texto = "Fora do horário de envio"; }
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 700, color: "var(--fg)" }}>
      <span style={{ width: 9, height: 9, borderRadius: "50%", background: cor, display: "inline-block" }} />
      {texto}
    </span>
  );
}

function BarraDia({ enviados, liberadas, limite }) {
  const pct = (n) => (limite > 0 ? Math.min(100, Math.round((n / limite) * 100)) : 0);
  return (
    <div>
      <div style={{ position: "relative", height: 10, borderRadius: 99, background: "var(--surface2)", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, width: `${pct(liberadas)}%`, background: "rgba(200,168,75,.25)" }} />
        <div style={{ position: "absolute", inset: 0, width: `${pct(enviados)}%`, background: "var(--brand)" }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--muted)", marginTop: 6, flexWrap: "wrap", gap: 8 }}>
        <span><b style={{ color: "var(--brand)" }}>{enviados}</b> enviados</span>
        <span>{liberadas} vagas liberadas até agora</span>
        <span>limite do dia: {limite}</span>
      </div>
    </div>
  );
}

function Tabela({ colunas, linhas, vazio }) {
  if (!linhas.length) return <div className="empty-state" style={{ padding: 20 }}><i className="ti ti-check" /><p>{vazio}</p></div>;
  return (
    <div className="table-wrap">
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr>{colunas.map((c) => <th key={c} style={{ textAlign: "left", padding: "8px 10px", color: "var(--muted)", fontSize: 11, fontWeight: 600, textTransform: "uppercase", borderBottom: "1px solid var(--border)", whiteSpace: "nowrap" }}>{c}</th>)}</tr>
        </thead>
        <tbody>
          {linhas.map((l, i) => (
            <tr key={i}>{l.map((cel, j) => <td key={j} style={{ padding: "9px 10px", borderBottom: "1px solid var(--border)", verticalAlign: "top" }}>{cel}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Envios() {
  const user = getUser() || {};
  const ehAdmin = user.role === "admin_master";
  const [lojaId, setLojaId] = useState(null);
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);

  const carregar = useCallback((id) => {
    setCarregando(true); setErro(null);
    getCentral(id)
      .then((d) => setDados(d))
      .catch((e) => setErro(e.status === 403 ? "Sem permissão para ver esta tela." : "Não foi possível carregar os envios agora."))
      .finally(() => setCarregando(false));
  }, []);

  useEffect(() => { carregar(lojaId); }, [lojaId, carregar]);
  // Atualiza sozinho a cada 2 min, so com a aba visivel (consulta leve).
  useEffect(() => {
    const t = setInterval(() => { if (document.visibilityState === "visible") carregar(lojaId); }, 120000);
    return () => clearInterval(t);
  }, [lojaId, carregar]);

  if (erro && !dados) return <div className="empty-state"><i className="ti ti-alert-triangle" /><p>{erro}</p></div>;
  if (!dados) return <div className="empty-state"><i className="ti ti-loader" style={{ animation: "spin 1s linear infinite" }} /><p>Carregando envios...</p></div>;

  const cfg = dados.config || {};
  const soMeus = dados.papel === "vendedor";
  const totalFila = (dados.fila_por_coluna || []).reduce((s, c) => s + c.n, 0);

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title"><i className="ti ti-calendar-time" /> Envios</h1>
        <button className="btn btn-ghost btn-sm" onClick={() => carregar(lojaId)} disabled={carregando}>
          <i className="ti ti-refresh" style={carregando ? { animation: "spin 1s linear infinite" } : undefined} /> Atualizar
        </button>
      </div>

      {ehAdmin && dados.lojas?.length > 1 && (
        <div className="tabs-wrap">
          {dados.lojas.map((l) => (
            <button key={l.id} className={`tab-btn ${l.id === dados.loja?.id ? "active" : ""}`} onClick={() => setLojaId(l.id)}>
              {l.nome_agente || l.nome} · {l.nome.replace("LA Automóveis", "").trim() || "Curitibanos"}
            </button>
          ))}
        </div>
      )}

      <div className="card" style={{ marginBottom: 14, padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <div>
            <Situacao dados={dados} />
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 6 }}>
              Celular da {dados.loja?.nome_agente || "agente"}. Agora são {dados.agora?.hora}.
              {" "}Follow-ups de coluna saem até <b>{fmtHHMM(cfg.janela_fim_semana)}</b> (seg–sex) e <b>{fmtHHMM(cfg.janela_fim_sabado)}</b> (sáb), nunca no domingo.
            </div>
          </div>
          <span className="badge badge-muted"><i className="ti ti-lock" /> Somente leitura</span>
        </div>
        {soMeus && (
          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 10 }}>
            <i className="ti ti-info-circle" /> Você vê a fila e os envios apenas dos seus leads. Os números do topo são da loja toda.
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
        <Metrica rotulo="Follow-ups hoje" valor={`${dados.hoje.colunas_enviadas}/${dados.hoje.colunas_limite}`} sub="colunas, por celular de agente" cor="var(--brand)" />
        <Metrica rotulo="Vagas liberadas" valor={dados.hoje.colunas_liberadas_agora} sub="distribuídas ao longo do dia" />
        <Metrica rotulo="Conversa quente hoje" valor={dados.hoje.recuperacao_enviadas} sub="recuperação, limite próprio" />
        <Metrica rotulo="Na fila" valor={totalFila} sub={soMeus ? "dos seus leads" : "mensagens agendadas"} />
      </div>

      <div className="card" style={{ marginBottom: 14, padding: 16 }}>
        <div className="card-title"><i className="ti ti-chart-bar" /> Limite do dia</div>
        <BarraDia enviados={dados.hoje.colunas_enviadas} liberadas={dados.hoje.colunas_liberadas_agora} limite={dados.hoje.colunas_limite} />
      </div>

      {dados.fila_por_coluna?.length > 0 && (
        <div className="card" style={{ marginBottom: 14, padding: 16 }}>
          <div className="card-title"><i className="ti ti-columns-3" /> Fila por coluna</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {dados.fila_por_coluna.map((c) => (
              <span key={c.coluna} className="badge badge-brand" style={{ fontSize: 12 }}>{rotuloColuna(c.coluna)} · {c.n}</span>
            ))}
          </div>
        </div>
      )}

      <div className="card" style={{ marginBottom: 14, padding: 16 }}>
        <div className="card-title"><i className="ti ti-clock" /> Próximas mensagens {dados.fila.length > 0 && <span style={{ fontWeight: 400 }}>(as {dados.fila.length} primeiras)</span>}</div>
        <Tabela
          colunas={["Lead", "Coluna", "Msg", "Vendedor", "Texto", "Agendada"]}
          linhas={dados.fila.map((f) => [
            f.nome || "—", rotuloColuna(f.coluna), `${f.sequencia}ª`, f.vendedor || "—",
            <span style={{ color: "var(--muted)" }}>{(f.conteudo || "").length > 90 ? f.conteudo.slice(0, 90) + "…" : f.conteudo}</span>,
            fmtAgendado(f.agendado_para),
          ])}
          vazio="Nenhuma mensagem agendada."
        />
        <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 8 }}>
          O horário agendado é o mais cedo possível. O envio real segue o limite e o ritmo do dia. Se o lead responder, a mensagem deixa de sair e o vendedor continua a conversa.
        </div>
      </div>

      <div className="card" style={{ marginBottom: 14, padding: 16 }}>
        <div className="card-title"><i className="ti ti-send" /> Enviados hoje</div>
        <Tabela
          colunas={["Hora", "Lead", "Coluna", "Vendedor"]}
          linhas={dados.enviados_hoje.map((e) => [fmtHora(e.enviado_em), e.nome || "—", rotuloColuna(e.coluna), e.vendedor || "—"])}
          vazio="Nada enviado hoje ainda."
        />
      </div>

      {dados.bloqueios && (
        <div className="card" style={{ padding: 16 }}>
          <div className="card-title"><i className="ti ti-hand-stop" /> Por que algo não saiu (últimas 24 h)</div>
          {dados.bloqueios.por_motivo.length === 0
            ? <div style={{ fontSize: 13, color: "var(--muted)" }}>Nenhum bloqueio registrado.</div>
            : (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
                {dados.bloqueios.por_motivo.map((m) => (
                  <span key={m.motivo} className="badge badge-warning" style={{ fontSize: 12 }}>{rotuloMotivo(m.motivo)} · {m.n}</span>
                ))}
              </div>
            )}
          {dados.bloqueios.recentes.length > 0 && (
            <Tabela
              colunas={["Hora", "Origem", "Coluna", "Resultado"]}
              linhas={dados.bloqueios.recentes.map((r) => [
                fmtHora(r.criado_em), r.workflow || "—", rotuloColuna(r.coluna),
                r.liberado ? <span className="badge badge-success">Liberado</span> : <span className="badge badge-warning">{rotuloMotivo(r.motivo)}</span>,
              ])}
              vazio=""
            />
          )}
        </div>
      )}
    </div>
  );
}
