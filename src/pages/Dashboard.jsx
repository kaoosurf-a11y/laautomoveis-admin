import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getDashboard, getMetricasDashboard, updateInvestimentoAnuncios, updateMetaVendas } from "../api.js";
import { getUser } from "../auth.js";

/* ─── helpers ─── */
const fmtR = v => `R$ ${Number(v).toLocaleString("pt-BR")}`;
// 2026-07-15: "Resp. média" passou a medir tempo até a 1ª resposta REAL do vendedor
// (antes media a Lara, quase instantânea, e o valor virava minutos gigantes quando havia
// gaps noturnos — sem sentido mostrar "904.9min", precisa escalar pra horas).
const fmtMin = v => {
  if (v === null || v === undefined) return "sem dados";
  const n = Number(v);
  if (n < 60) return `${Math.round(n * 10) / 10}min`;
  const h = Math.floor(n / 60);
  const m = Math.round(n % 60);
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
};
const AV_CORES = ["#C8A84B","#7ba7e0","#4caf7d","#e07b7b","#a07be0"];

/* ─── sub‑componentes ─── */

const LOJA_NOME = { 1:"Curitibanos", 2:"Campos Novos" };
const comSinal = n => (n > 0 ? `+${n}` : `${n}`);
const tomDelta = n => (n > 0 ? "up" : n < 0 ? "down" : "");

// Linha de ajuste de UMA loja (investimento em anúncios + meta de vendas). 2026-10-05:
// antes eram dois cards com um campo cada, que em "Todas" mostravam e gravavam só a
// primeira loja (campo "3041" com a conta usando 6082; campo "6" com a meta somando 12).
function AjusteLoja({ loja, mostrarNome, onSaved }) {
  const [inv, setInv] = useState(String(loja.investimento_mensal ?? 0));
  const [meta, setMeta] = useState(String(loja.meta_vendas_mes ?? 0));
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    setInv(String(loja.investimento_mensal ?? 0));
    setMeta(String(loja.meta_vendas_mes ?? 0));
  }, [loja.id, loja.investimento_mensal, loja.meta_vendas_mes]);

  async function salvar() {
    const nInv = Number(String(inv).replace(",", "."));
    const nMeta = Number(meta);
    if (!Number.isFinite(nInv) || nInv < 0) { setMsg("Investimento inválido"); return; }
    if (!Number.isInteger(nMeta) || nMeta < 0) { setMsg("Meta precisa ser número inteiro"); return; }
    setSaving(true); setMsg(null);
    try {
      if (nInv !== Number(loja.investimento_mensal)) await updateInvestimentoAnuncios(nInv, loja.id);
      if (nMeta !== Number(loja.meta_vendas_mes)) await updateMetaVendas(nMeta, loja.id);
      setMsg("Salvo");
      onSaved?.();
    } catch {
      setMsg("Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="ajuste-loja">
      {mostrarNome && <div className="ajuste-loja-nome">{LOJA_NOME[loja.id] || loja.nome}</div>}
      <div className="ajuste-loja-campos">
        <label>
          <span className="form-label">Investimento em anúncios por mês (R$)</span>
          <input className="form-input" type="number" inputMode="decimal" min="0" step="1"
            value={inv} onChange={e=>setInv(e.target.value)}/>
        </label>
        <label>
          <span className="form-label">Meta de vendas por mês</span>
          <input className="form-input" type="number" inputMode="numeric" min="0" step="1"
            value={meta} onChange={e=>setMeta(e.target.value)}/>
        </label>
        <button className="btn btn-primary" disabled={saving} onClick={salvar}>
          {saving ? "Salvando..." : "Salvar"}
        </button>
      </div>
      {msg && <div className="metric-delta" role="status">{msg}</div>}
    </div>
  );
}

function Anuncios({ midia, onSaved }) {
  const [ajustando, setAjustando] = useState(false);
  if (!midia) return null;
  // Backend novo manda `lojas` sempre; o antigo só em "Todas" (gerente vinha sem).
  const lojas = midia.lojas?.length ? midia.lojas
    : (midia.loja_id ? [{ id: midia.loja_id, investimento_mensal: midia.investimento_mensal, meta_vendas_mes: midia.meta_vendas_mes }] : []);
  const bm = midia.benchmark || { referencia: 38, min: 25, max: 55 };
  const cpl = midia.cpl;
  const faixa = `${fmtR(bm.min)} a ${fmtR(bm.max)}`;
  const cplLeitura = cpl == null ? { t:"sem leads no período", c:"" }
    : cpl < bm.min ? { t:`abaixo da faixa do setor (${faixa})`, c:"up" }
    : cpl > bm.max ? { t:`acima da faixa do setor (${faixa})`, c:"down" }
    : { t:`dentro da faixa do setor (${faixa})`, c:"" };

  return (
    <div className="card">
      <div className="card-head">
        <div className="card-title"><i className="ti ti-ad"/> Anúncios</div>
        {lojas.length > 0 && (
          <button className="btn btn-ghost btn-sm" aria-expanded={ajustando} onClick={()=>setAjustando(a=>!a)}>
            <i className={`ti ${ajustando?"ti-chevron-up":"ti-adjustments-horizontal"}`}/> Metas e investimento
          </button>
        )}
      </div>
      <div className="metrics-grid cols-3">
        <div className="metric-card">
          <div className="metric-label"><i className="ti ti-coin"/> Custo por lead</div>
          <div className="metric-value">{cpl==null?"sem dados":fmtR(cpl)}</div>
          <div className={`metric-delta ${cplLeitura.c}`}>{cplLeitura.t}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label"><i className="ti ti-calendar-stats"/> Gasto</div>
          <div className="metric-value">{fmtR(midia.investimento_periodo)}</div>
          <div className="metric-delta">no período do filtro</div>
        </div>
        <div className="metric-card">
          <div className="metric-label"><i className="ti ti-cash"/> Verba mensal</div>
          <div className="metric-value">{fmtR(Math.round(midia.investimento_mensal))}</div>
          <div className="metric-delta">{lojas.length > 1 ? `soma das ${lojas.length} lojas` : "anúncios, mês cheio"}</div>
        </div>
      </div>
      {ajustando && (
        <div className="ajuste-lojas">
          {lojas.map(l => <AjusteLoja key={l.id} loja={l} mostrarNome={lojas.length > 1} onSaved={onSaved}/>)}
        </div>
      )}
    </div>
  );
}

// Funil enviado pra Meta (Conversions API), uma linha por loja — cada loja tem o próprio
// Pixel, os números nunca se somam. Qualificado = nome completo + CPF + nascimento
// (Felipe 06/10/2026). Backend antigo não manda `meta_capi`: o card some.
function FunilMeta({ lojas }) {
  if (!lojas?.length) return null;
  return (
    <div className="card">
      <div className="card-head">
        <div className="card-title"><i className="ti ti-brand-meta"/> Conversões enviadas à Meta</div>
      </div>
      {/* 2026-10-07: uma loja ao lado da outra (cada uma no seu bloco, números separados). */}
      <div className="meta-lojas">
      {lojas.map((l) => (
        <div key={l.loja_id}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8,fontSize:13,fontWeight:600}}>
            {l.cidade || l.nome}
            <span className={`badge ${l.ativo?"badge-success":"badge-muted"}`}>{l.ativo?"Ligada":"Desligada"}</span>
            {l.erros > 0 && <span className="badge badge-danger">{l.erros} com erro</span>}
          </div>
          <div className="metrics-grid cols-3">
            <div className="metric-card">
              <div className="metric-label"><i className="ti ti-user-plus"/> Leads novos</div>
              <div className="metric-value">{l.leads}</div>
              <div className="metric-delta">entregues à Meta</div>
            </div>
            <div className="metric-card">
              <div className="metric-label"><i className="ti ti-user-check"/> Qualificados</div>
              <div className="metric-value">{l.qualificados}</div>
              <div className="metric-delta">{l.custo_por_qualificado==null?"nome completo, CPF e nascimento":`${fmtR(l.custo_por_qualificado)} por qualificado`}</div>
            </div>
            <div className="metric-card">
              <div className="metric-label"><i className="ti ti-car"/> Vendas</div>
              <div className="metric-value">{l.vendas}</div>
              <div className={`metric-delta ${l.vendas_sem_valor>0?"down":""}`}>{l.vendas_sem_valor>0?`${l.vendas_sem_valor} sem valor preenchido`:l.vendas>0?"com valor informado":"no período do filtro"}</div>
            </div>
          </div>
        </div>
      ))}
      </div>
    </div>
  );
}

function TabOportunidades({ data, periodo, onMidiaSaved, onAbrirCrm }) {
  const { resumo, vendedores, canais, midia } = data;
  const ehMes = periodo === "mes";
  const metaMes = resumo.meta_vendas_mes ?? midia?.meta_vendas_mes ?? null;
  const pctMeta = ehMes && metaMes > 0 ? Math.min(Math.round(resumo.vendas / metaMes * 100), 100) : null;
  // Ticket médio: só existe com valor preenchido na venda. Sem nenhum, não mostra "R$ 0".
  const comValor = Number(resumo.vendas_com_valor || 0);
  const semValor = resumo.vendas > 0 && comValor === 0;
  const metrics = [
    { icon:"ti-target",        label:"Total leads",  value:resumo.total_leads,
      delta:`${comSinal(resumo.total_leads_delta)} vs período anterior`, tom:tomDelta(resumo.total_leads_delta) },
    { icon:"ti-check",         label:"Vendas",       value:resumo.vendas,
      delta: ehMes && metaMes != null ? `meta do mês: ${metaMes} · saída do estoque` : "saídas do estoque no período",
      tom: ehMes && metaMes > 0 && resumo.vendas >= metaMes ? "up" : "", pct:pctMeta },
    { icon:"ti-percent",       label:"Conversão",    value:`${resumo.conversao}%`,
      delta:`${comSinal(resumo.conversao_delta)} pontos vs anterior`, tom:tomDelta(resumo.conversao_delta) },
    { icon:"ti-x",             label:"Perdidas",     value:resumo.perdidas,              delta:"perdidas no período", tom:"" },
    { icon:"ti-clock",         label:"Resp. média",  value:fmtMin(resumo.resp_media_min),delta:"até o vendedor responder", tom:"",
      title:"Tempo entre o lead ser atribuído e a primeira resposta do vendedor. Conta o relógio corrido, inclusive noite e fim de semana." },
    { icon:"ti-currency-real", label:"Ticket médio", value:resumo.vendas === 0 || semValor || resumo.ticket_medio == null ? "—" : fmtR(resumo.ticket_medio),
      delta: resumo.vendas === 0 ? "nenhuma saída no período"
        : semValor ? "sem valor de venda preenchido"
        : comValor < resumo.vendas ? `${comValor} de ${resumo.vendas} com valor`
        : `receita: ${fmtR(resumo.receita_total)}`, tom:"" },
  ];
  const lojasNoRanking = [...new Set(vendedores.map(v => v.loja_id).filter(Boolean))].sort((a, b) => a - b);
  const maxLeads = Math.max(...vendedores.map(x=>x.total_leads), 1);
  const totalCanais = canais.reduce((a,x)=>a+x.total,0) || 1;
  const linhaVendedor = (v,i) => {
    const cor = AV_CORES[i % AV_CORES.length];
    return (
      <div key={`${v.nome}-${i}`} className="rank-row">
        <div className="av" style={{background:`${cor}22`,color:cor}}>{v.iniciais}</div>
        <div style={{flex:1,minWidth:0}}>
          <div className="rank-top">
            <span className="rank-nome">{v.nome}</span>
            <span className="rank-num"><strong>{v.vendas}</strong> {v.vendas===1?"venda":"vendas"}, {v.total_leads} {v.total_leads===1?"lead":"leads"}</span>
          </div>
          <div className="funnel-track"><div className="funnel-bar" style={{width:`${Math.round(v.total_leads/maxLeads*100)}%`}}/></div>
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="metrics-grid">
        {metrics.map((m,i)=>(
          <div key={i} className="metric-card" title={m.title}>
            <div className="metric-label"><i className={`ti ${m.icon}`}/>{m.label}</div>
            <div className="metric-value">{m.value}</div>
            <div className={`metric-delta ${m.tom}`}>{m.delta}</div>
            {m.pct != null && <div className="meter" role="progressbar" aria-valuenow={m.pct} aria-valuemin={0} aria-valuemax={100} aria-label="Progresso da meta do mês"><span style={{width:`${m.pct}%`}}/></div>}
          </div>
        ))}
      </div>

      <div className={`dash-meio${(data.meta_capi?.length || 0) > 1 ? " varias-lojas" : ""}`}>
        <Anuncios midia={midia} onSaved={onMidiaSaved}/>
        <FunilMeta lojas={data.meta_capi}/>
      </div>

      <div className="dash-grid">
        {/* Por vendedor — barra relativa ao maior total de leads do grupo. Em "Todas" a
            lista vem separada por loja (2026-10-05): as equipes não se misturam. */}
        <div className="card">
          <div className="card-title"><i className="ti ti-users"/> Por vendedor</div>
          {vendedores.length===0 && <p className="vazio">Nenhum vendedor nesta loja.</p>}
          {lojasNoRanking.length > 1
            ? lojasNoRanking.map(lid => (
                <div key={lid} className="rank-grupo">
                  <div className="rank-loja">{LOJA_NOME[lid] || `Loja ${lid}`}</div>
                  {vendedores.filter(v => v.loja_id === lid).map(linhaVendedor)}
                </div>
              ))
            : vendedores.map(linhaVendedor)}
        </div>

        {/* "Funil de vendas" saiu daqui (2026-10-05): tinha só duas linhas e contava venda
            pelo lead CRIADO no período, então discordava do card "Vendas" (que conta a
            venda FECHADA no período). O funil completo fica na aba Métricas. */}
        <div className="card dash-canais">
          <div className="card-title"><i className="ti ti-chart-pie"/> Leads por canal</div>
          {canais.length===0 && <p className="vazio">Nenhum lead no período.</p>}
          {canais.map((c,i)=>(
            <div key={i} className="funnel-step">
              <div style={{width:10,height:10,borderRadius:"50%",background:c.cor,flexShrink:0}}/>
              <div className="funnel-label">{c.nome}</div>
              <div className="funnel-track"><div className="funnel-bar" style={{width:`${Math.round(c.total/totalCanais*100)}%`,background:c.cor}}/></div>
              <div className="funnel-num">{c.total}</div>
              <div className="funnel-pct">{Math.round(c.total/totalCanais*100)}%</div>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <div className="card-title"><i className="ti ti-flame"/> Leads mais quentes em aberto</div>
          <button className="btn btn-ghost btn-sm" onClick={onAbrirCrm}>Abrir CRM</button>
        </div>
        {!data.ultimas_oportunidades?.length && <p className="vazio">Nenhum lead em aberto.</p>}
        <div className="lista-grade">
          {data.ultimas_oportunidades?.map((o,i)=>(
            <div key={i} className="lista-row">
              <div style={{flex:1,minWidth:0}}>
                <div className="lista-nome">{o.nome}</div>
                <div className="lista-sub">{[o.veiculo, o.vendedor, o.loja].filter(Boolean).join(", ") || "sem veículo informado"}</div>
              </div>
              <span className="badge badge-muted">{o.estagio}</span>
              <span className="badge badge-brand">{o.score}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function TabJornada({ data }) {
  const { jornada, agente_ia, followups_hoje } = data;
  const TIPO_LABEL = {
    sem_credito:"Sem crédito", vai_pensar:"Vai pensar",
    nao_achou_carro:"Não achou o carro", carros_baratos:"Carros baratos", parou_responder:"Parou de responder",
    pos_venda_satisfacao:"Pós-venda", match_estoque:"Veículo compatível chegou!",
    match_carro_barato:"Carro barato chegou!",
  };
  return (
    <>
      {/* Ciclo médio — 2026-07-15 (auditoria): removido o timeline etapa-a-etapa (1º
          contato→Interesse→Proposta→Negociação→Fechamento) que existia aqui, dependia de
          visita_em/proposta_em quase nunca preenchidos (1 e 0 de 59 leads) — 3 das 5
          etapas sempre "sem dados". O funil de referência na aba Métricas cobre essa
          jornada com dado real (Agenda). Mantido só o ciclo médio total, que não depende
          desses campos. */}
      {/* Agente IA — 2026-07-15 (auditoria): "LEADS QUALIF." removido, sempre mostrava 0
          (qualificado_ia nunca é escrito por nenhum processo real do sistema hoje). */}
      <div className="sec-label">Agente IA</div>
      <div className="metrics-grid jornada-ia" style={{marginBottom:12}}>
        {[
          { label:"LEADS QUENTES",  value:agente_ia.leads_quentes,  sub:"temperatura" },
          { label:"SCORE QUENTE",   value:agente_ia.score_quente,   sub:"≥60 pts" },
          { label:"MORNOS",         value:agente_ia.mornos_reat,    sub:"nutrição" },
          { label:"HANDOFFS",       value:agente_ia.handoffs,       sub:"para vendedor" },
          { label:"FOLLOW-UPS",     value:agente_ia.followups,      sub:"enviados" },
        ].map((m,i)=>(
          <div key={i} className="metric-card">
            <div className="metric-label" style={{fontSize:10}}>{m.label}</div>
            <div className="metric-value">{m.value}</div>
            <div className="metric-delta" style={{color:"var(--muted)"}}>{m.sub}</div>
          </div>
        ))}
      </div>

      <div className="dash-jornada">
        <div className="jornada-lado">
          <div className="card">
            <div className="card-title"><i className="ti ti-route"/> Ciclo médio de venda</div>
            <div className="jornada-ciclo-num">
              {jornada.ciclo_medio_dias!=null ? <>{jornada.ciclo_medio_dias}<span> dias</span></> : "—"}
            </div>
            <div className="metric-delta">
              {jornada.ciclo_medio_dias!=null ? "do 1º contato até fechar" : "nenhuma venda fechada completa no período"}
            </div>
          </div>

          <div className="card">
            <div className="card-title"><i className="ti ti-clock-check"/> Follow-ups hoje</div>
            {followups_hoje.length === 0 && <p className="vazio">Nenhum follow-up hoje.</p>}
            {followups_hoje.map((f,i)=>(
              <div key={i} className="fu-linha">
                <span className="fu-hora">{f.horario}</span>
                <span className="fu-tipo">{TIPO_LABEL[f.tipo]||f.tipo}</span>
                <span className="fu-nome">{f.cliente_nome}</span>
                <div className="av" style={{width:28,height:28,fontSize:11,background:`${AV_CORES[0]}22`,color:AV_CORES[0]}}>{f.vendedor_iniciais}</div>
              </div>
            ))}
          </div>

          {data.motivos_perda?.length > 0 && (
            <div className="card">
              <div className="card-title" style={{color:"var(--alert)"}}><i className="ti ti-alert-circle"/> Motivos de perda</div>
              {data.motivos_perda.map((m,i)=>{
                const max = Math.max(...data.motivos_perda.map(x=>x.total));
                return (
                  <div key={i} className="perda-linha">
                    <div className="perda-nome">{m.motivo}</div>
                    <div className="perda-track"><div style={{width:`${Math.round(m.total/max*100)}%`}}/></div>
                    <div className="perda-num">{m.total}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {data.leads_7dias && (
          <div className="card jornada-chart">
            <div className="card-title"><i className="ti ti-chart-bar"/> Leads últimos 7 dias</div>
            <div className="dias-chart">
              {data.leads_7dias.map((d,i)=>{
                const max = Math.max(...data.leads_7dias.map(x=>x.total), 1);
                const pct = Math.max(6, Math.round(d.total/max*100));
                return (
                  <div key={i} className="dias-col">
                    <span className="dias-num">{d.total}</span>
                    <div className="dias-track"><div className="dias-bar" style={{height:`${pct}%`}}/></div>
                    <span className="dias-dia">{d.dia}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function TabEstoque({ data }) {
  const { estoque } = data;
  const metricsCores = { ok:"var(--fg)", alerta:"var(--alert)" };
  return (
    <>
      {/* KPIs estoque */}
      <div className="metrics-grid cols-3" style={{marginBottom:12}}>
        <div className="metric-card">
          <div className="metric-label"><i className="ti ti-car"/> No Pátio</div>
          <div className="metric-value">{estoque.no_patio}</div>
          <div className="metric-delta">{estoque.novos_patio} novos em 7 dias</div>
        </div>
        <div className="metric-card">
          <div className="metric-label"><i className="ti ti-clock"/> Tempo Médio</div>
          <div className="metric-value" style={{color:estoque.tempo_medio_dias>estoque.meta_dias?"var(--alert)":"var(--fg)"}}>{estoque.tempo_medio_dias!=null?`${estoque.tempo_medio_dias}d`:"sem dados"}</div>
          <div className="metric-delta" style={{color:"var(--muted)"}}>meta: {estoque.meta_dias}d</div>
        </div>
        <div className="metric-card">
          <div className="metric-label"><i className="ti ti-alert-triangle"/> Parados +30d</div>
          <div className="metric-value" style={{color:estoque.parados_30d>0?"var(--alert)":undefined}}>{estoque.parados_30d}</div>
          <div className="metric-delta">há mais de 30 dias no pátio</div>
        </div>
      </div>

      {/* Parados — atenção */}
      <div className="card" style={{marginBottom:12,border:"1px solid var(--danger-line)"}}>
        <div className="card-title" style={{color:"var(--alert)"}}><i className="ti ti-alert-circle"/> Parados — atenção</div>
        {estoque.parados_lista.length===0&&<p style={{color:"var(--muted)",fontSize:13}}>Nenhum veículo parado há mais de 30 dias.</p>}
        {estoque.parados_lista.map((v,i)=>(
          <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"7px 0",borderBottom:"1px solid var(--border)"}}>
            <span style={{flex:1,fontSize:13,color:"var(--fg)"}}>{v.nome}</span>
            <span style={{fontSize:11,padding:"2px 7px",borderRadius:10,fontWeight:700,background:"var(--danger-soft)",color:"var(--alert)"}}>{v.dias}d</span>
          </div>
        ))}
      </div>

      {/* Estoque por marca */}
      <div className="card" style={{marginBottom:12}}>
        <div className="card-title"><i className="ti ti-chart-bar"/> Estoque por marca</div>
        {estoque.por_marca.map((m,i)=>{
          const max = Math.max(...estoque.por_marca.map(x=>x.total));
          return (
            <div key={i} style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
              <div style={{minWidth:80,fontSize:13,color:"var(--fg)"}}>{m.marca}</div>
              <div style={{flex:1,height:8,background:"var(--border)",borderRadius:4}}>
                <div style={{height:"100%",width:`${Math.round(m.total/max*100)}%`,background:"var(--brand-fill)",borderRadius:4}}/>
              </div>
              <div style={{fontSize:12,color:"var(--muted)",minWidth:16,textAlign:"right"}}>{m.total}</div>
            </div>
          );
        })}
      </div>

      {/* 2026-07-15 (auditoria): renomeado de "Sugestão da IA" — é um alerta gerado por
          regra fixa (veículo mais parado há +30d), nenhum modelo de IA gera esse texto,
          chamar de "IA" seria enganoso. */}
      {estoque.alerta_estoque_parado && (
        <div style={{padding:"12px 14px",background:"var(--card-bg)",border:"1px solid var(--border)",borderRadius:10,display:"flex",gap:10,alignItems:"flex-start"}}>
          <i className="ti ti-alert-triangle" style={{color:"var(--brand)",fontSize:18,marginTop:1}}/>
          <div style={{fontSize:13,color:"var(--muted)",lineHeight:1.5}}>
            <strong style={{color:"var(--fg)"}}>Alerta de estoque parado:</strong> {estoque.alerta_estoque_parado}
          </div>
        </div>
      )}
    </>
  );
}

const TEMP_CORES = { quente:"#e07b7b", morno:"#C8A84B", frio:"#7ba7e0" };

// Consome GET /api/metrics/dashboard (Fase 4) — só owner/manager (o backend já bloqueia
// agent com 403). Carregado à parte do resto do Dashboard porque é uma rota separada
// e mais pesada (8 sub-queries) — só busca quando essa aba é aberta.
function TabMetricas({ metricas, loading, erro }) {
  if (erro) return <div className="empty-state"><i className="ti ti-alert-triangle"/><p>{erro}</p></div>;
  if (loading || !metricas) return <div className="empty-state"><i className="ti ti-loader" style={{animation:"spin 1s linear infinite"}}/><p>Carregando métricas...</p></div>;

  const { iaVsHumano, tempoPorEstagio, semResposta, temperatura, followups, funilReferencia } = metricas;
  const totalTemp = temperatura.reduce((s,t)=>s+Number(t.total),0) || 1;
  // Funil de referência (leads->contatados->agendaram->compareceram->fecharam), cada
  // etapa desenhada como % do total de leads (barra decrescente). 2026-07-23 (auditoria):
  // esse é o único funil na aba Métricas agora — "Funil completo (estagio_funil)" foi
  // removido por ser idêntico ao "Funil de vendas" da aba Oportunidades (mesmo GROUP BY
  // estagio, só formatação diferente); "Resumo por etapa" também removido por repetir os
  // mesmos números deste funil numa tabela. Fonte única de verdade pra distribuição por
  // estágio do Kanban = aba Oportunidades; fonte única pra funil de conversão real
  // (lead->contato->agendamento->comparecimento->fechamento) = este aqui.
  const ETAPAS_FUNIL_REF = funilReferencia ? [
    { label:"Leads gerados",    ...funilReferencia.leads },
    { label:"Contatados",       ...funilReferencia.contatados },
    { label:"Agendaram visita", ...funilReferencia.agendaram },
    { label:"Compareceram",     ...funilReferencia.compareceram },
    { label:"Fecharam venda",   ...funilReferencia.fecharam },
  ] : [];

  return (
    <>
      {/* 2026-10-07: as duas fileiras de cards ficam numa grade só (o bloco de dentro usa
          display:contents), pra não sobrar coluna vazia à direita. */}
      <div className="metrics-grid" style={{marginBottom:12}}>
        <div className="metric-card">
          <div className="metric-label"><i className="ti ti-robot"/> Só IA resolveu</div>
          <div className="metric-value">{iaVsHumano.soIaPct}%</div>
          <div className="metric-delta" style={{color:"var(--muted)"}}>{iaVsHumano.soIa} de {iaVsHumano.soIa+iaVsHumano.precisouHumano}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label"><i className="ti ti-user"/> Precisou humano</div>
          <div className="metric-value">{iaVsHumano.precisouHumanoPct}%</div>
          <div className="metric-delta" style={{color:"var(--muted)"}}>{iaVsHumano.precisouHumano} leads</div>
        </div>
        <div className="metric-card">
          {/* 2026-07-31 (auditoria de dashboard): rótulo antigo "cumpridos" media
          respondeu=true (cliente respondeu ao follow-up), não "follow-up foi enviado
          com sucesso" — nome ajustado pra bater com o que o número realmente mostra,
          sem mudar o cálculo em si. */}
          <div className="metric-label"><i className="ti ti-clock-check"/> Follow-ups respondidos</div>
          <div className="metric-value">{followups.pct}%</div>
          <div className="metric-delta" style={{color:"var(--muted)"}}>{followups.cumpridos} de {followups.total} respondeu</div>
        </div>
        <div className="metric-card">
          <div className="metric-label"><i className="ti ti-alert-triangle"/> Sem resposta {semResposta.horasParametro}h+</div>
          {/* 2026-08-10 (bug real, achado ao vivo — Felipe): a lista `leads` vem cortada em
              LIMIT 50 no backend (proteção de payload); usar `.length` dela como contagem
              fazia o card mostrar sempre "50" com mais de 50 parados, mascarando a
              diferença real entre "Todas"/"Curitibanos"/"Campos Novos" — parecia que o
              filtro de loja não tinha efeito nessa métrica. `total` vem de uma contagem
              separada, sem LIMIT. */}
          <div className="metric-value" style={{color:semResposta.total>0?"var(--alert)":undefined}}>{semResposta.total}</div>
          <div className="metric-delta" style={{color:"var(--muted)"}}>leads parados</div>
        </div>

      {funilReferencia && <div style={{display:"contents"}}>
        <div className="metric-card">
          <div className="metric-label"><i className="ti ti-bolt"/> Contatado em até 5min</div>
          <div className="metric-value">{funilReferencia.contatados5min.pct}%</div>
          <div className="metric-delta" style={{color:"var(--muted)"}}>{funilReferencia.contatados5min.total} de {funilReferencia.contatados.total} contatados</div>
        </div>
        <div className="metric-card">
          <div className="metric-label"><i className="ti ti-calendar-check"/> Comparecimento</div>
          <div className="metric-value">{funilReferencia.comparecimento.pct}%</div>
          <div className="metric-delta" style={{color:"var(--muted)"}}>{funilReferencia.comparecimento.compareceram} de {funilReferencia.comparecimento.resolvidos} visitas</div>
        </div>
        <div className="metric-card">
          <div className="metric-label"><i className="ti ti-repeat"/> Fechamento por follow-up</div>
          <div className="metric-value">{funilReferencia.fechamentoPorFollowup.pct}%</div>
          <div className="metric-delta" style={{color:"var(--muted)"}}>{funilReferencia.fechamentoPorFollowup.comFollowup} de {funilReferencia.fechamentoPorFollowup.totalFechadas} vendas</div>
        </div>
      </div>}
      </div>

      {funilReferencia && <div className="card" style={{marginBottom:12}}>
        <div className="card-title"><i className="ti ti-filter"/> Funil de referência (lead → venda)</div>
        {ETAPAS_FUNIL_REF.map((e,i)=>(
          <div key={i} style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
            <div style={{minWidth:120,fontSize:13,color:"var(--fg)"}}>{e.label}</div>
            <div className="funnel-track" style={{flex:1}}><div className="funnel-bar" style={{width:`${e.pct}%`}}/></div>
            <div style={{fontSize:12,color:"var(--muted)",minWidth:70,textAlign:"right"}}>{e.total} · {e.pct}%</div>
          </div>
        ))}
        <div style={{fontSize:11,color:"var(--muted)",marginTop:4}}>% sobre o total de leads gerados no período · "Agendaram"/"Compareceram" usam compromissos reais da Agenda, não o card "Agendados" do Kanban.</div>
      </div>}

      {/* 2026-07-23 (auditoria): "Resumo por etapa" (tabela) removida daqui — repetia os
          mesmos números do funil de referência acima, só em formato de tabela. As taxas
          etapa-a-etapa abaixo são informação nova (não estão nas barras acima), por isso
          continuam. 2026-08-01: "Fechamento por follow-up" removido daqui também — não é
          uma taxa etapa-a-etapa, é o mesmo card que já aparece no grid de cima
          (funilReferencia.fechamentoPorFollowup), duplicado sem motivo. */}
      {funilReferencia && <div className="card" style={{marginBottom:12,overflowX:"auto"}}>
        <div className="card-title"><i className="ti ti-percentage"/> Taxas de conversão por etapa</div>
        {/* Taxas etapa-a-etapa (não % do total) — respondem "qual etapa específica está
            vazando", diferente das barras acima que mostram a perda acumulada. */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:10}}>
          <div>
            <div style={{fontSize:11,color:"var(--muted)"}}>% Agendou (de contatados)</div>
            <div style={{fontSize:18,fontWeight:700,color:"var(--fg)"}}>{funilReferencia.agendaram.pctEtapaAnterior}%</div>
          </div>
          <div>
            <div style={{fontSize:11,color:"var(--muted)"}}>% Compareceu (de agendou)</div>
            <div style={{fontSize:18,fontWeight:700,color:"var(--fg)"}}>{funilReferencia.compareceram.pctEtapaAnterior}%</div>
          </div>
          <div>
            <div style={{fontSize:11,color:"var(--muted)"}}>% Fechou (de compareceu)</div>
            <div style={{fontSize:18,fontWeight:700,color:"var(--fg)"}}>{funilReferencia.fecharam.pctEtapaAnterior}%</div>
          </div>
        </div>
      </div>}

      {/* 2026-08-04: qualidade de atendimento (pedido do usuário) — tempo de resposta da
          IA e silêncio pós-handoff aparecem pra admin_master+gerente igual o resto dessa
          aba; falhas técnicas é reforçado no backend pra só admin_master (o campo nem
          vem na resposta pra gerente), aqui a checagem em cima disso é só reforço de UI. */}
      {metricas.qualidade && (
        <div className="metrics-grid" style={{marginBottom:12}}>
          <div className="metric-card">
            <div className="metric-label"><i className="ti ti-bolt"/> Resp. média da IA</div>
            <div className="metric-value">{metricas.qualidade.tempoRespostaIaSeg!=null?`${metricas.qualidade.tempoRespostaIaSeg}s`:"sem dados"}</div>
            <div className="metric-delta" style={{color:"var(--muted)"}}>até a 1ª resposta da Lara</div>
          </div>
          <div className="metric-card">
            <div className="metric-label"><i className="ti ti-message-off"/> Silêncio pós-handoff</div>
            <div className="metric-value" style={{color:metricas.qualidade.silencioPosHandoff.pct>20?"var(--alert)":undefined}}>{metricas.qualidade.silencioPosHandoff.pct}%</div>
            <div className="metric-delta" style={{color:"var(--muted)"}}>{metricas.qualidade.silencioPosHandoff.semResposta} de {metricas.qualidade.silencioPosHandoff.total} sem 1ª resposta do vendedor</div>
          </div>
          {metricas.qualidade.falhaTecnica && (
            <div className="metric-card">
              <div className="metric-label"><i className="ti ti-alert-triangle"/> Falhas técnicas</div>
              <div className="metric-value" style={{color:metricas.qualidade.falhaTecnica.total>0?"var(--alert)":undefined}}>{metricas.qualidade.falhaTecnica.total}</div>
              <div className="metric-delta" style={{color:"var(--muted)"}}>neste período</div>
            </div>
          )}
        </div>
      )}
      {metricas.qualidade?.falhaTecnica?.recentes?.length > 0 && (
        <div className="card" style={{marginBottom:12,overflowX:"auto"}}>
          <div className="card-title" style={{color:"var(--alert)"}}><i className="ti ti-alert-octagon"/> Falhas técnicas recentes</div>
          {metricas.qualidade.falhaTecnica.recentes.map((f,i)=>(
            <div key={i} style={{padding:"8px 0",borderBottom:"1px solid var(--border)"}}>
              <div style={{display:"flex",justifyContent:"space-between",gap:10,fontSize:12,color:"var(--muted)"}}>
                <span>{f.phone} · {f.agente||"—"}</span>
                <span>{new Date(f.created_at).toLocaleString("pt-BR")}</span>
              </div>
              {f.texto_cliente && <div style={{fontSize:13,color:"var(--fg)",marginTop:2}}>"{f.texto_cliente}"</div>}
            </div>
          ))}
        </div>
      )}

      <div className="card" style={{marginBottom:12}}>
        <div className="card-title"><i className="ti ti-alert-octagon"/> Gargalo — tempo parado no estágio atual</div>
        {tempoPorEstagio.gargaloAtual?.length===0&&<p style={{color:"var(--muted)",fontSize:13}}>Sem dados suficientes.</p>}
        {tempoPorEstagio.gargaloAtual?.map((g,i)=>(
          <div key={i} style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
            <div style={{minWidth:110,fontSize:13,color:"var(--fg)"}}>{g.estagio}</div>
            <div style={{fontSize:12,color:"var(--muted)"}}>{g.total} leads</div>
            <div style={{flex:1}}/>
            <div style={{fontSize:13,fontWeight:600,color:Number(g.media_horas_parado)>72?"var(--alert)":"var(--fg)"}}>{Math.round(g.media_horas_parado)}h em média</div>
          </div>
        ))}
        <div style={{fontSize:11,color:"var(--muted)",marginTop:8}}>Até negociação: {tempoPorEstagio.ate_negociacao_horas??"—"}h · Negociação até fechar: {tempoPorEstagio.negociacao_ate_fechar_horas??"—"}h</div>
      </div>

      {/* 2026-07-15 (auditoria): "Ranking por vendedor" e "Por origem" removidos daqui —
          eram duplicatas de "Por vendedor" (aba Oportunidades) e "Leads por canal" (idem),
          calculadas sem filtro de período (sempre todo o histórico) enquanto a outra
          versão respeita 7d/mês/trimestre — podiam mostrar números diferentes pro mesmo
          vendedor dependendo da aba. Ver Oportunidades pra esses dois. */}
      <div className="card">
        <div className="card-title"><i className="ti ti-temperature"/> Temperatura</div>
        {temperatura.map((t,i)=>(
          <div key={i} style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
            <div style={{width:10,height:10,borderRadius:"50%",background:TEMP_CORES[t.temperatura]||"var(--muted)",flexShrink:0}}/>
            <div style={{flex:1,fontSize:13,color:"var(--fg)",textTransform:"capitalize"}}>{t.temperatura}</div>
            <div style={{fontSize:12,color:"var(--muted)"}}>{t.total} ({Math.round(t.total/totalTemp*100)}%)</div>
          </div>
        ))}
      </div>
    </>
  );
}

// LA V1 20260809 (bug real, achado ao vivo — caso Diana): colar uma data no campo
// nativo <input type="date"> pode corromper o ano (ex: colar "05/08/2026" e o widget
// gravar "0002" no lugar de "2026" — o input HTML aceita ano de 1 a 4 dígitos, então
// "0002" é tecnicamente válido pro navegador, mas sem sentido pro filtro). Sem
// validação, esse valor corrompido entrava direto no estado, disparava a busca com
// uma data absurda, e a troca pra tela de "Carregando..." (que substitui a página
// inteira, ver `if (loading) return` mais abaixo) parecia "a página voltar pro
// início". Rejeita silenciosamente qualquer ano fora de uma faixa razoável antes de
// aceitar o valor — o campo simplesmente ignora o paste corrompido, sem quebrar nada.
function anoRazoavel(isoDate) {
  if (!isoDate) return true; // campo vazio (limpar) sempre é válido
  const ano = Number(isoDate.slice(0, 4));
  return ano >= 2000 && ano <= new Date().getFullYear() + 1;
}

// LA V1 20260809 (fix 3, mesmo caso Diana/Felipe -- 2 rodadas de tentativa de consertar
// o <input type="date"> nativo não resolveram: primeiro corrompia o ano no paste ("0002"),
// depois passou a simplesmente ignorar/ficar vazio. O comportamento de paste em inputs de
// data nativos é inconsistente entre navegadores por natureza -- em vez de continuar
// remendando caso a caso, os campos De/Até deixam de ser <input type="date"> e viram texto
// livre no formato DD/MM/AAAA, com parsing 100% nosso (digitar OU colar passam pela MESMA
// lógica, sem depender do navegador interpretar nada). Aceita separador /, -, . e também
// AAAA-MM-DD (ISO, caso alguém cole de outro sistema).
function parseDataColada(texto) {
  if (!texto) return null;
  const t = texto.trim();
  let m = t.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/); // DD/MM/AAAA, DD-MM-AAAA, DD.MM.AAAA
  if (m) {
    const [, d, mo, y] = m;
    return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/); // AAAA-MM-DD (ISO)
  if (m) {
    const [, y, mo, d] = m;
    return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return null;
}
function isoParaBr(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

/* ─── componente principal ─── */
export default function Dashboard() {
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [periodo, setPeriodo] = useState("mes");
  const [lojaFiltro, setLojaFiltro] = useState(null); // null=Todas | 1 | 2 (só admin_master)
  const [aba, setAba]       = useState("oportunidades");
  const [erro, setErro]     = useState(null);
  const [metricas, setMetricas] = useState(null);
  const [loadingMetricas, setLoadingMetricas] = useState(false);
  const [erroMetricas, setErroMetricas] = useState(null);
  const user = getUser();
  const navigate = useNavigate();

  // 2026-07-15: período "personalizado" — usuário escolhe dia/mês/ano exatos (dois campos
  // de data) em vez de só os 3 presets fixos. customDesde/customAte só importam quando
  // periodo==="personalizado"; chaveDesde/chaveAte formam uma "assinatura" do período atual
  // (preset OU intervalo customizado) pra saber quando precisa refazer a busca.
  const [customDesde, setCustomDesde] = useState("");
  const [customAte, setCustomAte]     = useState("");
  // LA V1 20260809: texto livre exibido nos campos (DD/MM/AAAA) — fonte separada do
  // valor ISO (customDesde/customAte) porque o usuário pode estar no meio de digitar
  // uma data incompleta; só vira ISO real (e só então aplica o filtro) quando o texto
  // bate com um formato de data completo e válido (ver parseDataColada).
  const [desdeTexto, setDesdeTexto] = useState(()=>isoParaBr(customDesde));
  const [ateTexto, setAteTexto]     = useState(()=>isoParaBr(customAte));
  const [seletorAberto, setSeletorAberto] = useState(false);
  const chavePeriodo = periodo==="personalizado" ? `personalizado:${customDesde}:${customAte}` : periodo;
  const chaveLoja = lojaFiltro ?? "todas";
  const isAdminMaster = user?.role === "admin_master";

  useEffect(() => {
    if (periodo==="personalizado" && !customDesde) return; // aguarda o usuário aplicar
    setLoading(true);
    setErro(null);
    getDashboard(periodo, customDesde, customAte, lojaFiltro).then(d => {
      setData(d);
      setLoading(false);
    }).catch(() => {
      setErro("Erro ao carregar dados. Tente novamente.");
      setLoading(false);
    });
  }, [chavePeriodo, chaveLoja]);

  const roleLabel = { admin_master:"Administrador", gerente:"Gerente", vendedor:"Vendedor" }[user?.role] || "";
  const podeVerMetricas = user?.role==="admin_master"||user?.role==="gerente";

  // 2026-07-15: aba Métricas ganhou o filtro de período (7 dias/Este mês/Trimestre/
  // Personalizado) — antes essa aba sempre mostrava "todo o histórico" e nem reagia ao
  // clicar no seletor lá em cima, o que confundia (o filtro parecia não fazer nada).
  // metricasPeriodo guarda a "assinatura" (chavePeriodo) de qual período veio o dado em
  // cache, pra saber quando precisa buscar de novo.
  const [metricasPeriodo, setMetricasPeriodo] = useState(null);
  function carregarMetricas(){
    setLoadingMetricas(true);setErroMetricas(null);
    getMetricasDashboard(periodo,24,customDesde,customAte,lojaFiltro).then(d=>{setMetricas(d);setMetricasPeriodo(`${chavePeriodo}|${chaveLoja}`);setLoadingMetricas(false);})
      .catch(()=>{setErroMetricas("Erro ao carregar métricas. Tente novamente.");setLoadingMetricas(false);});
  }
  function recarregarDashboard(){
    setLoading(true); setErro(null);
    getDashboard(periodo, customDesde, customAte, lojaFiltro).then(d => {
      setData(d); setLoading(false);
    }).catch(() => { setErro("Erro ao carregar dados. Tente novamente."); setLoading(false); });
  }
  function abrirMetricas(){
    setAba("metricas");
    if(loadingMetricas || (metricas && metricasPeriodo===`${chavePeriodo}|${chaveLoja}`))return;
    carregarMetricas();
  }
  // Se o período mudar enquanto a aba Métricas já está aberta, refaz a busca na hora (sem
  // isso, trocar de "Este mês" pra "7 dias" com a aba já aberta não atualizava nada).
  useEffect(() => {
    if (aba === "metricas" && metricasPeriodo !== null && metricasPeriodo !== `${chavePeriodo}|${chaveLoja}`) {
      if (periodo==="personalizado" && !customDesde) return;
      carregarMetricas();
    }
  }, [chavePeriodo, chaveLoja, aba]);

  // Aplica o intervalo customizado — só dispara a busca quando o usuário confirma (não a
  // cada tecla/clique nos campos de data), e fecha o seletor.
  function aplicarPersonalizado(){
    if(!customDesde) return;
    setPeriodo("personalizado");
    setSeletorAberto(false);
  }

  if (erro && !data) return (
    <div className="empty-state">
      <i className="ti ti-alert-triangle"/>
      <p>{erro}</p>
    </div>
  );
  // LA V1 20260810 (bug real, achado ao vivo — Felipe, "os números da segunda data
  // somem quando digito"): antes, QUALQUER refetch (trocar loja, clicar preset, ou
  // completar o período personalizado) caía nesse `if(loading)` e substituía a página
  // inteira por "Carregando..." — inclusive o painel De/Até que o usuário acabara de
  // preencher, que estava logo ali na tela até o instante anterior. Parecia que os
  // números digitados tinham "sumido", quando na verdade era a página inteira trocando
  // de conteúdo. Agora só bloqueia a tela inteira na primeira carga (ainda sem `data`);
  // com dado em cache, o conteúdo antigo continua visível (indicador discreto abaixo,
  // ver `filter-chip-row`) até o novo período chegar.
  if (loading && !data) return (
    <div className="empty-state">
      <i className="ti ti-loader" style={{animation:"spin 1s linear infinite"}}/>
      <p>Carregando...</p>
    </div>
  );
  if (!data) return null;

  // Loja do recorte: admin escolhe no filtro; gerente vê sempre a própria (o servidor
  // já restringe, aqui é só o texto).
  const lojaEscopo = isAdminMaster
    ? (lojaFiltro ? LOJA_NOME[lojaFiltro] : "todas as lojas")
    : (LOJA_NOME[user?.loja_id] || "");
  const diaMes = iso => { const [, m, d] = iso.split("-"); return `${d}/${m}`; };

  const ABAS = [
    { id:"oportunidades", label:"Oportunidades" },
    { id:"jornada",       label:"Jornada" },
    { id:"estoque",       label:"Estoque" },
    ...(podeVerMetricas?[{ id:"metricas", label:"Métricas" }]:[]),
  ];

  return (
    <div>
      <div className="page-header">
        <div style={{display:"flex",alignItems:"baseline",gap:10,flexWrap:"wrap"}}>
          <h1 className="page-title"><i className="ti ti-layout-dashboard"/> Dashboard</h1>
          {roleLabel && <span style={{fontSize:12,color:"var(--muted)",marginLeft:2}}>{roleLabel}</span>}
          {/* Refetch em segundo plano (ver comentário no `if(loading && !data)` acima) —
              indicador discreto de que o filtro foi aplicado e está atualizando, sem
              esconder a tela inteira. */}
          {loading && <span style={{fontSize:12,color:"var(--muted)",marginLeft:8}}><i className="ti ti-loader" style={{animation:"spin 1s linear infinite"}}/> atualizando...</span>}
        </div>
        {/* Filtros (2026-10-05): período e loja viraram controle segmentado (.seg), pra
            não se confundirem com as abas de conteúdo logo abaixo — antes eram três
            fileiras de botões dourados iguais. "Trimestre" virou "90 dias", que é o que
            o filtro sempre fez (90 dias corridos, não o trimestre do calendário). */}
        {/* 2026-10-07 (Felipe: menos espaço em branco): loja e período na mesma linha do
            título; as abas descem pra linha do recorte. Só mudou a posição dos controles. */}
        <div className="dash-filtros">
        {isAdminMaster && (
          <div className="seg" role="group" aria-label="Loja">
            {[{id:null,l:"Todas as lojas"},{id:1,l:"Curitibanos"},{id:2,l:"Campos Novos"}].map(o=>(
              <button key={String(o.id)} type="button" className={`seg-btn ${lojaFiltro===o.id?"active":""}`} aria-pressed={lojaFiltro===o.id}
                onClick={()=>setLojaFiltro(o.id)}>
                {o.l}
              </button>
            ))}
          </div>
        )}
        <div className="seg" role="group" aria-label="Período">
          {[{k:"hoje",l:"Hoje"},{k:"semana",l:"7 dias"},{k:"mes",l:"Este mês"},{k:"vendedor",l:"Fecha dia 5"},{k:"trimestre",l:"90 dias"}].map(p=>(
            <button key={p.k} type="button" className={`seg-btn ${periodo===p.k?"active":""}`} aria-pressed={periodo===p.k}
              onClick={()=>{setPeriodo(p.k);setSeletorAberto(false);}}>
              {p.l}
            </button>
          ))}
          <button type="button" className={`seg-btn ${periodo==="personalizado"?"active":""}`} aria-pressed={periodo==="personalizado"}
            aria-expanded={seletorAberto} onClick={()=>setSeletorAberto(s=>!s)}>
            <i className="ti ti-calendar"/> Datas
          </button>
        </div>
        </div>
      </div>

      {seletorAberto && (
        <div style={{display:"flex",gap:10,alignItems:"flex-end",flexWrap:"wrap",padding:"14px",background:"var(--surface)",border:"1px solid var(--border)",borderRadius:10,marginBottom:16}}>
          <div style={{flex:"1 1 140px",minWidth:140}}>
            <label style={{display:"block",fontSize:11,color:"var(--muted)",marginBottom:4}}>De</label>
            <input type="text" inputMode="numeric" autoComplete="off" placeholder="DD/MM/AAAA"
              className="form-input" style={{marginBottom:0,fontSize:14,padding:"9px 12px"}}
              value={desdeTexto}
              onChange={e=>{
                const texto = e.target.value;
                setDesdeTexto(texto);
                const iso = parseDataColada(texto);
                if (iso && anoRazoavel(iso)) {
                  setCustomDesde(iso);
                  // LA V1 20260809 (mesma pendência da Diana, achado real: o auto-apply de
                  // 2026-07-23 só existia no campo "Até" -- se ela preenchesse "Até" PRIMEIRO
                  // e "De" depois (ordem invertida, comum quando já tinha um intervalo anterior
                  // e só ajusta o início), o clique em "De" nunca aplicava sozinho). Espelha a
                  // mesma regra do campo "Até": aplica assim que os dois lados estiverem
                  // preenchidos com data válida completa, não importa qual veio primeiro.
                  if (iso && customAte) { setPeriodo("personalizado"); setSeletorAberto(false); }
                }
              }}/>
          </div>
          <div style={{flex:"1 1 140px",minWidth:140}}>
            <label style={{display:"block",fontSize:11,color:"var(--muted)",marginBottom:4}}>Até</label>
            <input type="text" inputMode="numeric" autoComplete="off" placeholder="DD/MM/AAAA"
              className="form-input" style={{marginBottom:0,fontSize:14,padding:"9px 12px"}}
              value={ateTexto}
              onChange={e=>{
                const texto = e.target.value;
                setAteTexto(texto);
                const iso = parseDataColada(texto);
                if (iso && anoRazoavel(iso)) {
                  setCustomAte(iso);
                  // 2026-07-23 (pendência real, Diana): os outros botões de período aplicam
                  // direto no clique — "Personalizado" exigia abrir o painel E clicar em
                  // "Aplicar" à parte, um passo a mais que confundia. Assim que "De" já
                  // estava preenchido e o usuário completa "Até" com uma data válida, aplica
                  // na hora, sem esperar um clique extra — "Aplicar" continua existindo pra
                  // quem só preenche "De" (período em aberto até hoje).
                  if (customDesde && iso) { setPeriodo("personalizado"); setSeletorAberto(false); }
                }
              }}/>
          </div>
          <button className="btn btn-primary" style={{minHeight:44}} disabled={!customDesde} onClick={aplicarPersonalizado}>
            <i className="ti ti-check"/> Aplicar
          </button>
          <button className="btn btn-ghost" style={{minHeight:44}} onClick={()=>setSeletorAberto(false)}>Cancelar</button>
          <div style={{flexBasis:"100%",fontSize:11,color:"var(--muted)"}}>O mês do vendedor vai do dia 6 até o dia 5. O botão Fecha dia 5 puxa o ciclo aberto. Pra outro intervalo, preencha De e Até (ex.: 06/09 até 05/10).</div>
        </div>
      )}

      {/* Tabs (2026-07-27: unificado com .tab-btn/.tabs-wrap — mesmo componente visual
          usado em Follow-ups/Disparador). Antes forçava largura igual entre as 4 e
          cortava "Oportunidades" com "...": agora cada aba tem a largura do próprio
          texto e a faixa rola horizontalmente se não couber, sem nunca truncar. */}
      <div className="dash-bar">
        <div className="tabs-wrap">
          {ABAS.map(a=>(
            <button key={a.id} className={`tab-btn ${aba===a.id?"active":""}`}
              onClick={()=>a.id==="metricas"?abrirMetricas():setAba(a.id)}>
              {a.label}
            </button>
          ))}
        </div>
        {/* Diz exatamente o recorte que os números abaixo cobrem e com o que comparam. */}
        {data.periodo?.desde && (
          <div className="dash-escopo">
            {diaMes(data.periodo.desde)===diaMes(data.periodo.ate) ? diaMes(data.periodo.desde) : `${diaMes(data.periodo.desde)} a ${diaMes(data.periodo.ate)}`}
            {data.periodo.fecha_em ? ` (mês do vendedor, fecha ${diaMes(data.periodo.fecha_em)})` : ""}
            {lojaEscopo ? `, ${lojaEscopo}` : ""}
            {aba==="oportunidades" && data.periodo.anterior_desde ? `. Comparado com ${diaMes(data.periodo.anterior_desde)} a ${diaMes(data.periodo.anterior_ate)}.` : ""}
          </div>
        )}
      </div>


      {aba==="oportunidades" && <TabOportunidades data={data} periodo={periodo} onMidiaSaved={recarregarDashboard} onAbrirCrm={()=>navigate("/crm")}/>}
      {aba==="jornada"       && <TabJornada data={data}/>}
      {aba==="estoque"       && <TabEstoque data={data}/>}
      {aba==="metricas"      && <TabMetricas metricas={metricas} loading={loadingMetricas} erro={erroMetricas}/>}
    </div>
  );
}
