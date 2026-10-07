import { useState, useEffect } from "react";
import { getResultadoMensal } from "../api.js";

// Tela "Resultado mensal" (2026-10-07, Felipe: "faz o painel mensal"), só admin_master.
// Um mês por vez nos cards e o histórico na tabela, por loja ou somando as duas.
// Venda = veículo removido do estoque como "Venda feita" (tabela veiculos_saidas).
// Verba é a cadastrada hoje no Dashboard, repetida em todos os meses (não há histórico).
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const nomeMes = (ym) => `${MESES[Number(ym.slice(5)) - 1]}/${ym.slice(2, 4)}`;
const num = (n) => Number(n || 0).toLocaleString("pt-BR");
const brl = (n) => `R$ ${Math.round(Number(n || 0)).toLocaleString("pt-BR")}`;
// Nos cards o valor cheio não cabe (6 por linha no computador, 2 no celular): abrevia.
const brlCurto = (n) => {
  const v = Number(n || 0);
  if (v >= 1e6) return `${(v / 1e6).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} mi`;
  if (v >= 1e4) return `${Math.round(v / 1e3).toLocaleString("pt-BR")} mil`;
  return Math.round(v).toLocaleString("pt-BR");
};
const pct = (a, b) => (b > 0 ? `${Math.round((a / b) * 100)}%` : "—");
const div = (a, b) => (b > 0 ? brl(a / b) : "—");
// Custo de IA é pequeno (reais por dia): mostra com centavos.
const brl2 = (n) => `R$ ${Number(n || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const CAMPOS = ["leads", "leads_anuncio", "fora_horario", "passados_vendedor", "vendas", "valor_vendido",
  "vendas_valor_real", "vendas_com_lead", "vendas_com_vendedor", "verba", "ia_custo", "ia_tokens", "ia_chamadas"];

// Junta as linhas (mês x loja) em uma por mês, pra loja escolhida ou somando todas.
function porMes(linhas, loja) {
  const mapa = new Map();
  for (const l of linhas) {
    if (loja !== "todas" && String(l.loja_id) !== loja) continue;
    const m = mapa.get(l.mes) || { mes: l.mes };
    for (const c of CAMPOS) m[c] = (m[c] || 0) + Number(l[c] || 0);
    mapa.set(l.mes, m);
  }
  return [...mapa.values()].filter(m => m.leads > 0 || m.vendas > 0);
}

export default function Mensal() {
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState(null);
  const [loja, setLoja] = useState("todas");
  const [mesSel, setMesSel] = useState(null);

  useEffect(() => {
    getResultadoMensal().then(setDados).catch(() => setErro("Erro ao carregar o resultado mensal. Tente novamente."));
  }, []);

  if (erro) return <div className="empty-state"><i className="ti ti-alert-triangle" /><p>{erro}</p></div>;
  if (!dados) return <div className="empty-state"><i className="ti ti-loader" style={{ animation: "spin 1s linear infinite" }} /><p>Carregando...</p></div>;

  const lojas = [...new Map(dados.linhas.map(l => [String(l.loja_id), l.loja])).entries()];
  const meses = porMes(dados.linhas, loja);
  // Abre no último mês fechado: o mês em andamento ainda tem poucas vendas registradas.
  const padrao = meses.find(m => m.mes !== dados.mes_atual) || meses[0];
  const m = meses.find(x => x.mes === mesSel) || padrao;

  if (!m) return <div className="empty-state"><i className="ti ti-report-analytics" /><p>Ainda não há leads nem vendas para mostrar.</p></div>;
  const emAndamento = m.mes === dados.mes_atual;
  // Consumo de IA (07/10): medido por loja; o que não tem loja definida entra só em "Todas".
  const iaMes = (dados.ia || []).find(x => x.mes === m.mes);
  const iaCusto = m.ia_custo + (loja === "todas" ? Number(iaMes?.ia_sem_loja || 0) : 0);
  const iaDias = Number(iaMes?.ia_dias || 0);

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title"><i className="ti ti-report-analytics" /> Resultado mensal</h1>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
        <div className="seg">
          <button className={`seg-btn ${loja === "todas" ? "active" : ""}`} onClick={() => setLoja("todas")}>Todas</button>
          {lojas.map(([id, nome]) => (
            <button key={id} className={`seg-btn ${loja === id ? "active" : ""}`} onClick={() => setLoja(id)}>{nome}</button>
          ))}
        </div>
        <div className="seg">
          {[...meses].reverse().map(x => (
            <button key={x.mes} className={`seg-btn ${x.mes === m.mes ? "active" : ""}`} onClick={() => setMesSel(x.mes)}>{nomeMes(x.mes)}</button>
          ))}
        </div>
      </div>

      {emAndamento && (
        <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 12 }}>
          Mês em andamento: os números ainda vão subir e a verba conta o mês inteiro.
        </p>
      )}

      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-label">Leads novos</div>
          <div className="metric-value">{num(m.leads)}</div>
          <div className="metric-delta">{num(m.leads_anuncio)} de anúncio</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Com a loja fechada</div>
          <div className="metric-value">{pct(m.fora_horario, m.leads)}</div>
          <div className="metric-delta">{num(m.fora_horario)} atendidos pela IA</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Vendas</div>
          <div className="metric-value">{num(m.vendas)}</div>
          <div className="metric-delta">{num(m.vendas_com_lead)} com lead apontado</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Valor vendido (R$)</div>
          <div className="metric-value">{brlCurto(m.valor_vendido)}</div>
          <div className="metric-delta">
            {m.vendas === 0 ? "sem vendas no mês"
              : m.vendas_valor_real === m.vendas ? "valor real das vendas"
              : `${num(m.vendas - m.vendas_valor_real)} a preço anunciado`}
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Verba de anúncios</div>
          <div className="metric-value">{brl(m.verba)}</div>
          <div className="metric-delta">{div(m.verba, m.leads_anuncio)} por lead</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Anúncio por venda</div>
          <div className="metric-value">{div(m.verba, m.vendas)}</div>
          <div className="metric-delta">{pct(m.vendas, m.leads)} de conversão</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 18 }}>
        <div className="card-head">
          <div className="card-title"><i className="ti ti-robot" /> Custo da IA</div>
          <span className="badge badge-muted" style={{ fontSize: 11 }}>visível só para o proprietário</span>
        </div>
        {iaDias === 0 ? (
          <p style={{ fontSize: 13, color: "var(--muted)" }}>Sem medição neste mês. O consumo de IA passou a ser medido em 04/10/2026.</p>
        ) : (
          <>
            <div className="metrics-grid cols-3">
              <div className="metric-card">
                <div className="metric-label">Gasto medido</div>
                <div className="metric-value">{brl2(iaCusto)}</div>
                <div className="metric-delta">em {iaDias} {iaDias === 1 ? "dia" : "dias"}, desde {iaMes.ia_desde}</div>
              </div>
              <div className="metric-card">
                <div className="metric-label">Ritmo para 30 dias</div>
                <div className="metric-value">{brl((iaCusto / iaDias) * 30)}</div>
                <div className="metric-delta">{brl2(iaCusto / iaDias)} por dia</div>
              </div>
              <div className="metric-card">
                <div className="metric-label">Uso</div>
                <div className="metric-value">{(m.ia_tokens / 1e6).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi</div>
                <div className="metric-delta">tokens, {num(m.ia_chamadas)} chamadas</div>
              </div>
            </div>
            <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 12, lineHeight: 1.5 }}>
              Estimativa pelo consumo real de cada resposta e pela tabela de preços da OpenAI em dólar. Confira com a fatura.
            </p>
          </>
        )}
      </div>

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Mês</th><th>Leads</th><th>Anúncio</th><th>Loja fechada</th>
                <th>Vendas</th><th>Vendido</th><th>Ticket</th><th>Verba</th><th>Por venda</th><th>Conversão</th>
              </tr>
            </thead>
            <tbody>
              {meses.map(x => (
                <tr key={x.mes} onClick={() => setMesSel(x.mes)} style={{ cursor: "pointer", fontVariantNumeric: "tabular-nums" }}>
                  <td style={{ fontWeight: 600, whiteSpace: "nowrap" }}>
                    {nomeMes(x.mes)}{x.mes === dados.mes_atual && <span className="badge badge-muted" style={{ marginLeft: 8, fontSize: 11 }}>em andamento</span>}
                  </td>
                  <td>{num(x.leads)}</td>
                  <td>{num(x.leads_anuncio)}</td>
                  <td>{num(x.fora_horario)} <span style={{ color: "var(--muted)" }}>({pct(x.fora_horario, x.leads)})</span></td>
                  <td style={{ fontWeight: 600 }}>{num(x.vendas)}</td>
                  <td style={{ whiteSpace: "nowrap" }}>{brl(x.valor_vendido)}</td>
                  <td style={{ whiteSpace: "nowrap" }}>{div(x.valor_vendido, x.vendas)}</td>
                  <td style={{ whiteSpace: "nowrap" }}>{brl(x.verba)}</td>
                  <td style={{ whiteSpace: "nowrap" }}>{div(x.verba, x.vendas)}</td>
                  <td>{pct(x.vendas, x.leads)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 12, lineHeight: 1.5 }}>
        Venda é todo veículo removido do estoque como "Venda feita". Até setembro as vendas vieram do histórico do estoque:
        valem pelo preço anunciado e pela loja que cadastrou o veículo. A verba é a cadastrada hoje no Dashboard, repetida em todos os meses.
      </p>
    </div>
  );
}
