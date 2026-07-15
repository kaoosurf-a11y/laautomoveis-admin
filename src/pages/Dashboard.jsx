import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getDashboard, getMetricasDashboard } from "../api.js";
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

function TabOportunidades({ data }) {
  const { resumo, funil, vendedores, canais } = data;
  const metrics = [
    { icon:"ti-target",        label:"Total leads",  value:resumo.total_leads,           delta:`+${resumo.total_leads_delta} este mês`,  up:true },
    { icon:"ti-check",         label:"Vendas",       value:resumo.vendas,                delta:`meta: ${resumo.meta_vendas}`,             up:resumo.vendas>=resumo.meta_vendas },
    { icon:"ti-percent",       label:"Conversão",    value:`${resumo.conversao}%`,       delta:`+${resumo.conversao_delta}% vs mês`,      up:true },
    { icon:"ti-x",             label:"Perdidas",     value:resumo.perdidas,              delta:"leads perdidos",                          up:false },
    { icon:"ti-clock",         label:"Resp. média",  value:fmtMin(resumo.resp_media_min),delta:"até o vendedor responder",                up:resumo.resp_media_min!==null && resumo.resp_media_min<=10 },
    { icon:"ti-currency-real", label:"Ticket médio", value:fmtR(resumo.ticket_medio),    delta:`receita: ${fmtR(resumo.receita_total)}`,   up:true },
  ];
  return (
    <>
      <div className="metrics-grid" style={{marginBottom:20}}>
        {metrics.map((m,i)=>(
          <div key={i} className="metric-card">
            <div className="metric-label"><i className={`ti ${m.icon}`}/>{m.label}</div>
            <div className="metric-value">{m.value}</div>
            <div className={`metric-delta ${m.up?"up":"down"}`}>{m.delta}</div>
          </div>
        ))}
      </div>

      {/* Funil */}
      <div className="card" style={{marginBottom:12}}>
        <div className="card-title"><i className="ti ti-filter"/> Funil de vendas</div>
        {funil.map((f,i)=>(
          <div key={i} className="funnel-step">
            <div className="funnel-label">{f.estagio}</div>
            <div className="funnel-track"><div className="funnel-bar" style={{width:`${f.pct}%`}}/></div>
            <div className="funnel-num">{f.total}</div>
            <div className="funnel-pct">{f.pct}%</div>
          </div>
        ))}
      </div>

      {/* Por vendedor — 2026-07-15: barra agora é relativa ao maior total_leads do grupo
          (antes usava "/40" fixo, sem nenhuma base real — com poucos leads/vendedor toda
          barra ficava vazia; com muitos, estourava). Ganhou taxa_conversao (%) também. */}
      <div className="card" style={{marginBottom:12}}>
        <div className="card-title"><i className="ti ti-users"/> Por vendedor</div>
        {vendedores.map((v,i)=>{
          const maxLeads = Math.max(...vendedores.map(x=>x.total_leads), 1);
          return (
          <div key={i} style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
            <div className="av" style={{background:`${AV_CORES[i]}22`,color:AV_CORES[i]}}>{v.iniciais}</div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                <span style={{fontSize:13,color:"var(--fg)"}}>{v.nome}</span>
                <span style={{fontSize:12,color:"var(--muted)"}}>{v.vendas} vendas · {v.taxa_conversao}%</span>
              </div>
              <div className="funnel-track"><div className="funnel-bar" style={{width:`${Math.round(v.total_leads/maxLeads*100)}%`,background:AV_CORES[i]}}/></div>
            </div>
            <div style={{fontSize:12,color:"var(--muted)",minWidth:24}}>{v.total_leads}</div>
          </div>
          );
        })}
      </div>

      {/* Canais — alinhado com tags Chatwoot: whatsapp | site | indicacao | facebook */}
      <div className="card">
        <div className="card-title"><i className="ti ti-chart-pie"/> Leads por canal</div>
        {canais.map((c,i)=>{
          const total = canais.reduce((a,x)=>a+x.total,0);
          return (
            <div key={i} style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
              <div style={{width:10,height:10,borderRadius:"50%",background:c.cor,flexShrink:0}}/>
              <div style={{flex:1,fontSize:13,color:"var(--fg)"}}>{c.nome}</div>
              <div className="funnel-track" style={{flex:2}}>
                <div className="funnel-bar" style={{width:`${Math.round(c.total/total*100)}%`,background:c.cor}}/>
              </div>
              <div style={{fontSize:12,color:"var(--muted)",minWidth:52,textAlign:"right"}}>{c.total} leads</div>
            </div>
          );
        })}

        {/* Últimas oportunidades */}
        {data.ultimas_oportunidades?.length > 0 && (
          <div style={{marginTop:16,borderTop:"1px solid var(--border)",paddingTop:12}}>
            <div style={{fontSize:12,color:"var(--muted)",marginBottom:8,fontWeight:600,letterSpacing:1}}>ÚLTIMAS OPORTUNIDADES</div>
            {data.ultimas_oportunidades.map((o,i)=>(
              <div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 0",borderBottom:"1px solid var(--border)"}}>
                <span style={{fontSize:10,background:"var(--card-bg)",border:"1px solid var(--border)",borderRadius:4,padding:"2px 6px",color:"var(--muted)",textTransform:"uppercase"}}>{o.canal}</span>
                <span style={{flex:1,fontSize:13,color:"var(--fg)",fontWeight:500}}>{o.nome}</span>
                <span style={{fontSize:12,color:"var(--muted)"}}>— {o.veiculo}</span>
                <span style={{fontSize:11,padding:"2px 8px",borderRadius:12,background:"#C8A84B22",color:"#C8A84B",fontWeight:600}}>{o.estagio}</span>
                <div className="av" style={{width:28,height:28,fontSize:11,background:`${AV_CORES[0]}22`,color:AV_CORES[0]}}>{o.vendedor_iniciais}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function TabJornada({ data }) {
  const { jornada, agente_ia, followups_hoje } = data;
  const TIPO_LABEL = {
    sem_credito:"Sem crédito", vai_pensar:"Vai pensar",
    nao_achou_carro:"Não achou o carro", parou_responder:"Parou de responder",
    pos_venda_satisfacao:"Pós-venda", match_estoque:"Veículo compatível chegou!",
  };
  return (
    <>
      {/* Ciclo médio — 2026-07-15 (auditoria): removido o timeline etapa-a-etapa (1º
          contato→Interesse→Proposta→Negociação→Fechamento) que existia aqui, dependia de
          visita_em/proposta_em quase nunca preenchidos (1 e 0 de 59 leads) — 3 das 5
          etapas sempre "sem dados". O funil de referência na aba Métricas cobre essa
          jornada com dado real (Agenda). Mantido só o ciclo médio total, que não depende
          desses campos. */}
      <div className="card" style={{marginBottom:12}}>
        <div className="card-title"><i className="ti ti-route"/> Ciclo médio de venda</div>
        <div style={{fontSize:13,color:"var(--muted)"}}>
          {jornada.ciclo_medio_dias!=null?<span>Do 1º contato até fechar: <strong style={{color:"#C8A84B",fontSize:16}}>{jornada.ciclo_medio_dias} dias</strong></span>:"sem dados ainda (nenhuma venda fechada completa no período)"}
        </div>
        {jornada.ciclo_medio_dias!=null&&(
          <div style={{marginTop:10,height:4,background:"var(--border)",borderRadius:4}}>
            <div style={{height:"100%",width:`${Math.min(jornada.ciclo_medio_dias/10*100,100)}%`,background:"#C8A84B",borderRadius:4}}/>
          </div>
        )}
        <div style={{fontSize:11,color:"var(--muted)",marginTop:10}}>Jornada etapa-a-etapa (agendamento, comparecimento, fechamento) está na aba Métricas → Funil de referência.</div>
      </div>

      {/* Agente IA — 2026-07-15 (auditoria): "LEADS QUALIF." removido, sempre mostrava 0
          (qualificado_ia nunca é escrito por nenhum processo real do sistema hoje). */}
      <div style={{marginBottom:8,fontSize:11,color:"var(--muted)",fontWeight:700,letterSpacing:1.5}}>AGENTE IA</div>
      <div className="metrics-grid" style={{marginBottom:12}}>
        {[
          { label:"LEADS QUENTES",  value:agente_ia.leads_quentes,  sub:"temperatura" },
          { label:"SCORE QUENTE",   value:agente_ia.score_quente,   sub:"≥60 pts" },
          { label:"MORNOS",         value:agente_ia.mornos_reat,    sub:"nutrição" },
          { label:"TAXA RESPOSTA",  value:agente_ia.taxa_resposta!==null?`${agente_ia.taxa_resposta}%`:"sem dados", sub:"follow-ups respondidos" },
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

      {/* Follow-ups hoje */}
      <div className="card">
        <div className="card-title"><i className="ti ti-clock-check"/> Follow-ups hoje</div>
        {followups_hoje.length === 0 && <p style={{color:"var(--muted)",fontSize:13}}>Nenhum follow-up hoje.</p>}
        {followups_hoje.map((f,i)=>(
          <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:"1px solid var(--border)"}}>
            <span style={{fontSize:12,color:"var(--muted)",minWidth:42,fontFamily:"monospace"}}>{f.horario}</span>
            <span style={{fontSize:11,padding:"2px 6px",borderRadius:4,background:"#C8A84B33",color:"#C8A84B",fontWeight:700}}>
              {TIPO_LABEL[f.tipo]||f.tipo}
            </span>
            <span style={{flex:1,fontSize:13,color:"var(--fg)",fontWeight:500}}>{f.cliente_nome}</span>
            <span style={{fontSize:12,color:"var(--muted)"}}>— {f.motivo}</span>
            <div className="av" style={{width:28,height:28,fontSize:11,background:`${AV_CORES[0]}22`,color:AV_CORES[0]}}>{f.vendedor_iniciais}</div>
          </div>
        ))}
      </div>

      {/* Gráfico leads 7 dias */}
      {data.leads_7dias && (
        <div className="card" style={{marginTop:12}}>
          <div className="card-title"><i className="ti ti-chart-bar"/> Leads últimos 7 dias</div>
          <div style={{display:"flex",alignItems:"flex-end",gap:8,height:90,padding:"0 4px"}}>
            {data.leads_7dias.map((d,i)=>{
              const max = Math.max(...data.leads_7dias.map(x=>x.total));
              return (
                <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
                  <span style={{fontSize:11,color:"var(--fg)",fontWeight:600}}>{d.total}</span>
                  <div style={{width:"100%",height:`${Math.round(d.total/max*70)}px`,background:"#C8A84B",borderRadius:"4px 4px 0 0",minHeight:4}}/>
                  <span style={{fontSize:10,color:"var(--muted)"}}>{d.dia}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Motivos de perda */}
      {data.motivos_perda?.length > 0 && (
        <div className="card" style={{marginTop:12}}>
          <div className="card-title" style={{color:"#e07b7b"}}><i className="ti ti-alert-circle"/> Motivos de perda</div>
          {data.motivos_perda.map((m,i)=>{
            const max = Math.max(...data.motivos_perda.map(x=>x.total));
            return (
              <div key={i} style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
                <div style={{flex:1,fontSize:13,color:"var(--fg)"}}>{m.motivo}</div>
                <div style={{flex:2,height:6,background:"var(--border)",borderRadius:4}}>
                  <div style={{height:"100%",width:`${Math.round(m.total/max*100)}%`,background:"#e07b7b",borderRadius:4}}/>
                </div>
                <div style={{fontSize:12,color:"var(--muted)",minWidth:16,textAlign:"right"}}>{m.total}</div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

function TabEstoque({ data }) {
  const { estoque } = data;
  const metricsCores = { ok:"var(--fg)", alerta:"#e07b7b" };
  return (
    <>
      {/* KPIs estoque */}
      <div className="metrics-grid" style={{marginBottom:12}}>
        <div className="metric-card">
          <div className="metric-label"><i className="ti ti-car"/> No Pátio</div>
          <div className="metric-value">{estoque.no_patio}</div>
          <div className="metric-delta up">+{estoque.novos_patio} novos</div>
        </div>
        <div className="metric-card">
          <div className="metric-label"><i className="ti ti-clock"/> Tempo Médio</div>
          <div className="metric-value" style={{color:estoque.tempo_medio_dias>estoque.meta_dias?"#e07b7b":"var(--fg)"}}>{estoque.tempo_medio_dias!=null?`${estoque.tempo_medio_dias}d`:"sem dados"}</div>
          <div className="metric-delta" style={{color:"var(--muted)"}}>meta: {estoque.meta_dias}d</div>
        </div>
        <div className="metric-card">
          <div className="metric-label"><i className="ti ti-alert-triangle"/> Parados +30d</div>
          <div className="metric-value" style={{color:"#e07b7b"}}>{estoque.parados_30d} ⚠</div>
          <div className="metric-delta down">atenção!</div>
        </div>
      </div>

      {/* Parados — atenção */}
      <div className="card" style={{marginBottom:12,border:"1px solid #e07b7b44"}}>
        <div className="card-title" style={{color:"#e07b7b"}}><i className="ti ti-alert-circle"/> Parados — atenção</div>
        {estoque.parados_lista.length===0&&<p style={{color:"var(--muted)",fontSize:13}}>Nenhum veículo parado há mais de 30 dias.</p>}
        {estoque.parados_lista.map((v,i)=>(
          <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"7px 0",borderBottom:"1px solid var(--border)"}}>
            <span style={{flex:1,fontSize:13,color:"var(--fg)"}}>{v.nome}</span>
            <span style={{fontSize:11,padding:"2px 7px",borderRadius:10,fontWeight:700,background:"#e07b7b22",color:"#e07b7b"}}>{v.dias}d</span>
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
                <div style={{height:"100%",width:`${Math.round(m.total/max*100)}%`,background:"#C8A84B",borderRadius:4}}/>
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
          <i className="ti ti-alert-triangle" style={{color:"#C8A84B",fontSize:18,marginTop:1}}/>
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

  const { funil, iaVsHumano, tempoPorEstagio, semResposta, temperatura, followups, funilReferencia, resumoFunil } = metricas;
  const maxFunil = Math.max(...funil.map(f=>Number(f.total)), 1);
  const totalTemp = temperatura.reduce((s,t)=>s+Number(t.total),0) || 1;
  // Funil de referência (leads->contatados->agendaram->compareceram->fecharam), cada
  // etapa desenhada como % do total de leads (barra decrescente), igual convenção do
  // "Funil completo" logo abaixo.
  const ETAPAS_FUNIL_REF = funilReferencia ? [
    { label:"Leads gerados",    ...funilReferencia.leads },
    { label:"Contatados",       ...funilReferencia.contatados },
    { label:"Agendaram visita", ...funilReferencia.agendaram },
    { label:"Compareceram",     ...funilReferencia.compareceram },
    { label:"Fecharam venda",   ...funilReferencia.fecharam },
  ] : [];

  return (
    <>
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
          <div className="metric-label"><i className="ti ti-clock-check"/> Follow-ups cumpridos</div>
          <div className="metric-value">{followups.pct}%</div>
          <div className="metric-delta" style={{color:"var(--muted)"}}>{followups.cumpridos} de {followups.total}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label"><i className="ti ti-alert-triangle"/> Sem resposta {semResposta.horasParametro}h+</div>
          <div className="metric-value" style={{color:semResposta.leads.length>0?"#e07b7b":undefined}}>{semResposta.leads.length}</div>
          <div className="metric-delta" style={{color:"var(--muted)"}}>leads parados</div>
        </div>
      </div>

      {funilReferencia && <div className="metrics-grid" style={{marginBottom:12}}>
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

      {resumoFunil && <div className="card" style={{marginBottom:12,overflowX:"auto"}}>
        <div className="card-title"><i className="ti ti-table"/> Resumo por etapa</div>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:13,marginBottom:12}}>
          <thead>
            <tr style={{borderBottom:"1px solid var(--border)"}}>
              <th style={{textAlign:"left",padding:"6px 8px",color:"var(--muted)",fontWeight:600}}>Etapa</th>
              <th style={{textAlign:"right",padding:"6px 8px",color:"var(--muted)",fontWeight:600}}>Total</th>
            </tr>
          </thead>
          <tbody>
            {resumoFunil.map((r,i)=>(
              <tr key={i} style={{borderBottom:i<resumoFunil.length-1?"1px solid var(--border)":"none"}}>
                <td style={{padding:"6px 8px",color:"var(--fg)"}}>{r.etapa}</td>
                <td style={{padding:"6px 8px",textAlign:"right",color:"var(--fg)",fontWeight:600}}>{r.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
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
          <div>
            <div style={{fontSize:11,color:"var(--muted)"}}>Fechamento por follow-up</div>
            <div style={{fontSize:18,fontWeight:700,color:"var(--fg)"}}>{funilReferencia.fechamentoPorFollowup.pct}%</div>
            <div style={{fontSize:11,color:"var(--muted)"}}>{funilReferencia.fechamentoPorFollowup.comFollowup} de {funilReferencia.fechamentoPorFollowup.totalFechadas} vendas</div>
          </div>
        </div>
      </div>}

      <div className="card" style={{marginBottom:12}}>
        <div className="card-title"><i className="ti ti-filter"/> Funil completo (estagio_funil)</div>
        {funil.map((f,i)=>(
          <div key={i} style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
            <div style={{minWidth:110,fontSize:13,color:"var(--fg)"}}>{f.estagio}</div>
            <div className="funnel-track" style={{flex:1}}><div className="funnel-bar" style={{width:`${Math.round(f.total/maxFunil*100)}%`}}/></div>
            <div style={{fontSize:12,color:"var(--muted)",minWidth:24,textAlign:"right"}}>{f.total}</div>
          </div>
        ))}
      </div>

      <div className="card" style={{marginBottom:12}}>
        <div className="card-title"><i className="ti ti-alert-octagon"/> Gargalo — tempo parado no estágio atual</div>
        {tempoPorEstagio.gargaloAtual?.length===0&&<p style={{color:"var(--muted)",fontSize:13}}>Sem dados suficientes.</p>}
        {tempoPorEstagio.gargaloAtual?.map((g,i)=>(
          <div key={i} style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
            <div style={{minWidth:110,fontSize:13,color:"var(--fg)"}}>{g.estagio}</div>
            <div style={{fontSize:12,color:"var(--muted)"}}>{g.total} leads</div>
            <div style={{flex:1}}/>
            <div style={{fontSize:13,fontWeight:600,color:Number(g.media_horas_parado)>72?"#e07b7b":"var(--fg)"}}>{Math.round(g.media_horas_parado)}h em média</div>
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

/* ─── componente principal ─── */
export default function Dashboard() {
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [periodo, setPeriodo] = useState("mes");
  const [aba, setAba]       = useState("oportunidades");
  const [notif, setNotif]   = useState(null);
  const [erro, setErro]     = useState(null);
  const [metricas, setMetricas] = useState(null);
  const [loadingMetricas, setLoadingMetricas] = useState(false);
  const [erroMetricas, setErroMetricas] = useState(null);
  const user = getUser();
  const navigate = useNavigate();

  useEffect(() => {
    setLoading(true);
    setErro(null);
    getDashboard(periodo).then(d => {
      setData(d);
      setLoading(false);
      // notificação de lead quente (mock: primeiro lead score>=80)
      if (d?.ultimas_oportunidades) {
        const q = d.ultimas_oportunidades.find(o => o.score >= 80);
        if (q) setNotif(q);
      }
    }).catch(() => {
      setErro("Erro ao carregar dados. Tente novamente.");
      setLoading(false);
    });
  }, [periodo]);

  const roleLabel = { owner:"Administrador", manager:"Gerente", agent:"Vendedor" }[user?.role] || "";
  const podeVerMetricas = user?.role==="owner"||user?.role==="manager";

  // 2026-07-15: aba Métricas ganhou o filtro de período (7 dias/Este mês/Trimestre) — antes
  // essa aba sempre mostrava "todo o histórico" e nem reagia ao clicar no seletor lá em
  // cima, o que confundia (o filtro parecia não fazer nada). metricasPeriodo guarda de qual
  // período veio o dado em cache, pra saber quando precisa buscar de novo.
  const [metricasPeriodo, setMetricasPeriodo] = useState(null);
  function carregarMetricas(p){
    setLoadingMetricas(true);setErroMetricas(null);
    getMetricasDashboard(p).then(d=>{setMetricas(d);setMetricasPeriodo(p);setLoadingMetricas(false);})
      .catch(()=>{setErroMetricas("Erro ao carregar métricas. Tente novamente.");setLoadingMetricas(false);});
  }
  function abrirMetricas(){
    setAba("metricas");
    if(loadingMetricas || (metricas && metricasPeriodo===periodo))return;
    carregarMetricas(periodo);
  }
  // Se o período mudar enquanto a aba Métricas já está aberta, refaz a busca na hora (sem
  // isso, trocar de "Este mês" pra "7 dias" com a aba já aberta não atualizava nada).
  useEffect(() => {
    if (aba === "metricas" && metricasPeriodo !== null && metricasPeriodo !== periodo) {
      carregarMetricas(periodo);
    }
  }, [periodo, aba]);

  if (erro) return (
    <div className="empty-state">
      <i className="ti ti-alert-triangle"/>
      <p>{erro}</p>
    </div>
  );
  if (loading) return (
    <div className="empty-state">
      <i className="ti ti-loader" style={{animation:"spin 1s linear infinite"}}/>
      <p>Carregando...</p>
    </div>
  );
  if (!data) return null;

  const ABAS = [
    { id:"oportunidades", label:"Oportunidades" },
    { id:"jornada",       label:"Jornada" },
    { id:"estoque",       label:"Estoque" },
    ...(podeVerMetricas?[{ id:"metricas", label:"Métricas" }]:[]),
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title"><i className="ti ti-layout-dashboard"/> Dashboard</h1>
          {roleLabel && <span style={{fontSize:12,color:"var(--muted)",marginLeft:2}}>· {roleLabel}</span>}
        </div>
        {/* Poucos botões, usados com frequência — maiores e mais confortáveis de tocar
            (2026-07-13: antes rolava horizontal; agora sempre cabem numa linha, ver
            .page-header{flex-wrap:wrap} — em telas estreitas esse grupo desce pra
            baixo do título em vez de espremer, e mesmo na própria linha cabe folgado). */}
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          {[{k:"semana",l:"7 dias"},{k:"mes",l:"Este mês"},{k:"trimestre",l:"Trimestre"}].map(p=>(
            <button key={p.k} className={`btn ${periodo===p.k?"btn-primary":"btn-ghost"}`}
              style={{padding:"10px 16px",fontSize:14,fontWeight:600}} onClick={()=>setPeriodo(p.k)}>
              {p.l}
            </button>
          ))}
        </div>
      </div>

      {/* Notificação lead quente — 2026-07-15 (auditoria mobile): banner e botões agora
          quebram linha em telas estreitas em vez de espremer texto+2 botões numa linha só;
          os dois botões ganharam alvo de toque real (44px). */}
      {notif && (
        <div style={{display:"flex",alignItems:"center",gap:12,padding:"10px 14px",background:"#C8A84B18",border:"1px solid #C8A84B55",borderRadius:10,marginBottom:14,flexWrap:"wrap"}}>
          <div style={{width:10,height:10,borderRadius:"50%",background:"#e07b7b",animation:"pulse 1.5s infinite",flexShrink:0}}/>
          <div style={{flex:"1 1 200px",fontSize:13,minWidth:0}}>
            <strong style={{color:"#C8A84B"}}>Lead quente!</strong> {notif.nome} ({notif.score}pts) · {notif.veiculo} · Atribuído a {notif.vendedor}
          </div>
          <div style={{display:"flex",gap:6,alignItems:"center",marginLeft:"auto"}}>
            {/* 2026-07-15 (auditoria): botão não tinha onClick nenhum, não fazia nada ao
                clicar. Leva pro CRM Pipeline (a busca por nome ali já acha o lead rápido —
                não existe hoje um jeito de abrir um lead específico direto por URL). */}
            <button onClick={()=>navigate("/crm")} style={{fontSize:12,padding:"0 14px",minHeight:44,background:"#C8A84B",color:"#000",border:"none",borderRadius:6,cursor:"pointer",fontWeight:700}}>
              Ver lead →
            </button>
            <button onClick={()=>setNotif(null)} aria-label="Fechar" style={{background:"none",border:"none",cursor:"pointer",color:"var(--muted)",fontSize:18,width:44,height:44,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>×</button>
          </div>
        </div>
      )}

      {/* Tabs — 4 opções, precisam caber lado a lado sem rolar mesmo em telas
          estreitas (2026-07-13): compactas de propósito (padding/fonte menores que
          o filtro de período acima, que é usado com mais frequência).
          2026-07-15 (auditoria mobile): flex:1 pra dividir a largura igualmente entre as 4
          (antes cada uma só ocupava o tamanho do próprio texto) e altura de toque real
          via .tab-pill (44px) — clicar/tocar numa aba errada por engano era fácil antes. */}
      <div style={{marginBottom:16,paddingBottom:12,borderBottom:"1px solid var(--border)"}}>
        <div style={{display:"flex",gap:4,flexWrap:"nowrap"}}>
          {ABAS.map(a=>(
            <button key={a.id} className="tab-pill" onClick={()=>a.id==="metricas"?abrirMetricas():setAba(a.id)}
              style={{padding:"0 6px",fontSize:11,fontWeight:aba===a.id?700:500,
                color:aba===a.id?"#0c0c0a":"var(--muted)",
                background:aba===a.id?"#C8A84B":"transparent",
                border:"none",borderRadius:99,cursor:"pointer",
                boxShadow:aba===a.id?"0 2px 10px rgba(200,168,75,.35)":"none",
                transition:"all .2s",whiteSpace:"nowrap",flex:"1 1 0",minWidth:0,
                overflow:"hidden",textOverflow:"ellipsis"}}>
              {a.label}
            </button>
          ))}
        </div>
      </div>

      {aba==="oportunidades" && <TabOportunidades data={data}/>}
      {aba==="jornada"       && <TabJornada data={data}/>}
      {aba==="estoque"       && <TabEstoque data={data}/>}
      {aba==="metricas"      && <TabMetricas metricas={metricas} loading={loadingMetricas} erro={erroMetricas}/>}
    </div>
  );
}
