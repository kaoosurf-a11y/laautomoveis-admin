import { useState, useEffect } from "react";
import { getDashboard } from "../api.js";
import { getUser } from "../auth.js";

/* ─── helpers ─── */
const fmtR = v => `R$ ${Number(v).toLocaleString("pt-BR")}`;
const AV_CORES = ["#C8A84B","#7ba7e0","#4caf7d","#e07b7b","#a07be0"];

/* ─── sub‑componentes ─── */

function TabOportunidades({ data }) {
  const { resumo, funil, vendedores, canais } = data;
  const metrics = [
    { icon:"ti-target",        label:"Total leads",  value:resumo.total_leads,           delta:`+${resumo.total_leads_delta} este mês`,  up:true },
    { icon:"ti-check",         label:"Vendas",       value:resumo.vendas,                delta:`meta: ${resumo.meta_vendas}`,             up:resumo.vendas>=resumo.meta_vendas },
    { icon:"ti-percent",       label:"Conversão",    value:`${resumo.conversao}%`,       delta:`+${resumo.conversao_delta}% vs mês`,      up:true },
    { icon:"ti-x",             label:"Perdidas",     value:resumo.perdidas,              delta:"leads perdidos",                          up:false },
    { icon:"ti-clock",         label:"Resp. média",  value:`${resumo.resp_media_min}min`,delta:"tempo de resposta",                       up:resumo.resp_media_min<=5 },
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

      {/* Por vendedor */}
      <div className="card" style={{marginBottom:12}}>
        <div className="card-title"><i className="ti ti-users"/> Por vendedor</div>
        {vendedores.map((v,i)=>(
          <div key={i} style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
            <div className="av" style={{background:`${AV_CORES[i]}22`,color:AV_CORES[i]}}>{v.iniciais}</div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                <span style={{fontSize:13,color:"var(--fg)"}}>{v.nome}</span>
                <span style={{fontSize:12,color:"var(--muted)"}}>{v.vendas} vendas</span>
              </div>
              <div className="funnel-track"><div className="funnel-bar" style={{width:`${Math.round(v.total_leads/40*100)}%`,background:AV_CORES[i]}}/></div>
            </div>
            <div style={{fontSize:12,color:"var(--muted)",minWidth:24}}>{v.total_leads}</div>
          </div>
        ))}
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
      {/* Timeline jornada */}
      <div className="card" style={{marginBottom:12}}>
        <div className="card-title"><i className="ti ti-route"/> Jornada do cliente</div>
        <div style={{overflowX:"auto",paddingBottom:8}}>
          <div style={{display:"flex",alignItems:"center",gap:0,minWidth:"max-content"}}>
            {jornada.etapas.map((e,i)=>(
              <div key={i} style={{display:"flex",alignItems:"center"}}>
                <div style={{background:"var(--card-bg)",border:"1px solid var(--border)",borderRadius:10,padding:"12px 16px",textAlign:"center",minWidth:90}}>
                  <div style={{fontSize:22,marginBottom:4}}>{e.icone}</div>
                  <div style={{fontSize:12,color:"var(--fg)",fontWeight:500}}>{e.nome}</div>
                  <div style={{fontSize:13,color:"#C8A84B",fontWeight:700,marginTop:2}}>{e.tempo}</div>
                </div>
                {i < jornada.etapas.length-1 && (
                  <div style={{color:"var(--muted)",fontSize:16,padding:"0 4px"}}>→</div>
                )}
              </div>
            ))}
          </div>
        </div>
        <div style={{marginTop:14,fontSize:13,color:"var(--muted)"}}>
          Ciclo médio total: <strong style={{color:"#C8A84B"}}>{jornada.ciclo_medio_dias} dias</strong>
        </div>
        {/* barra de progresso do ciclo */}
        <div style={{marginTop:6,height:4,background:"var(--border)",borderRadius:4}}>
          <div style={{height:"100%",width:`${Math.min(jornada.ciclo_medio_dias/10*100,100)}%`,background:"#C8A84B",borderRadius:4}}/>
        </div>
      </div>

      {/* Agente IA */}
      <div style={{marginBottom:8,fontSize:11,color:"var(--muted)",fontWeight:700,letterSpacing:1.5}}>AGENTE IA</div>
      <div className="metrics-grid" style={{marginBottom:12}}>
        {[
          { label:"LEADS QUALIF.",  value:agente_ia.leads_qualif,  sub:`quentes: ${agente_ia.leads_quentes}` },
          { label:"TEMPO QUALIF.",  value:`${agente_ia.tempo_qualif_min}min`, sub:"1 eficiente" },
          { label:"SCORE QUENTE",   value:agente_ia.score_quente,   sub:"≥60 pts" },
          { label:"MORNOS REAT.",   value:agente_ia.mornos_reat,    sub:"nutrição" },
          { label:"TAXA RESPOSTA",  value:`${agente_ia.taxa_resposta}%`, sub:"responderam" },
          { label:"HANDOFFS",       value:agente_ia.handoffs,       sub:"para vendedor" },
          { label:"FOLLOW-UPS",     value:agente_ia.followups,      sub:"enviados" },
          { label:"NPS MÉDIO",      value:agente_ia.nps_medio,      sub:"promotores" },
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
          <div className="metric-value" style={{color:estoque.tempo_medio_dias>estoque.meta_dias?"#e07b7b":"var(--fg)"}}>{estoque.tempo_medio_dias}d</div>
          <div className="metric-delta" style={{color:"var(--muted)"}}>meta: {estoque.meta_dias}d</div>
        </div>
        <div className="metric-card">
          <div className="metric-label"><i className="ti ti-eye"/> Views Hoje</div>
          <div className="metric-value">{estoque.views_hoje}</div>
          <div className="metric-delta up">+{estoque.views_delta}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label"><i className="ti ti-alert-triangle"/> Parados +30d</div>
          <div className="metric-value" style={{color:"#e07b7b"}}>{estoque.parados_30d} ⚠</div>
          <div className="metric-delta down">atenção!</div>
        </div>
      </div>

      {/* Mais visualizados */}
      <div className="card" style={{marginBottom:12}}>
        <div className="card-title"><i className="ti ti-star"/> Mais visualizados</div>
        {estoque.mais_visualizados.map((v,i)=>(
          <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"7px 0",borderBottom:"1px solid var(--border)"}}>
            <span style={{fontSize:12,color:"var(--muted)",minWidth:18}}>{i+1}.</span>
            <span style={{flex:1,fontSize:13,color:"var(--fg)"}}>{v.nome}</span>
            <span style={{fontSize:12,color:"var(--muted)"}}>{v.views} views</span>
            <span style={{
              fontSize:11,padding:"2px 7px",borderRadius:10,fontWeight:700,
              background: v.dias<=10?"#4caf7d22":v.dias<=20?"#C8A84B22":"#e07b7b22",
              color:       v.dias<=10?"#4caf7d"  :v.dias<=20?"#C8A84B"  :"#e07b7b",
            }}>{v.dias}d</span>
          </div>
        ))}
      </div>

      {/* Parados — atenção */}
      <div className="card" style={{marginBottom:12,border:"1px solid #e07b7b44"}}>
        <div className="card-title" style={{color:"#e07b7b"}}><i className="ti ti-alert-circle"/> Parados — atenção</div>
        {estoque.parados_lista.map((v,i)=>(
          <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"7px 0",borderBottom:"1px solid var(--border)"}}>
            <span style={{flex:1,fontSize:13,color:"var(--fg)"}}>{v.nome}</span>
            <span style={{fontSize:12,color:"var(--muted)"}}>{v.views} views</span>
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

      {/* Sugestão IA */}
      {estoque.sugestao_ia && (
        <div style={{padding:"12px 14px",background:"var(--card-bg)",border:"1px solid var(--border)",borderRadius:10,display:"flex",gap:10,alignItems:"flex-start"}}>
          <i className="ti ti-robot" style={{color:"#C8A84B",fontSize:18,marginTop:1}}/>
          <div style={{fontSize:13,color:"var(--muted)",lineHeight:1.5}}>
            <strong style={{color:"var(--fg)"}}>Sugestão da IA:</strong> {estoque.sugestao_ia}
          </div>
        </div>
      )}
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
  const user = getUser();

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
    { id:"oportunidades", label:"🎯 Oportunidades" },
    { id:"jornada",       label:"🗺️ Jornada" },
    { id:"estoque",       label:"🚗 Estoque" },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title"><i className="ti ti-layout-dashboard"/> Dashboard</h1>
          {roleLabel && <span style={{fontSize:12,color:"var(--muted)",marginLeft:2}}>· {roleLabel}</span>}
        </div>
        <div style={{display:"flex",gap:6}}>
          {[{k:"semana",l:"7 dias"},{k:"mes",l:"Este mês"},{k:"trimestre",l:"Trimestre"}].map(p=>(
            <button key={p.k} className={`btn ${periodo===p.k?"btn-primary":"btn-ghost"}`}
              style={{padding:"6px 12px",fontSize:12}} onClick={()=>setPeriodo(p.k)}>
              {p.l}
            </button>
          ))}
        </div>
      </div>

      {/* Notificação lead quente */}
      {notif && (
        <div style={{display:"flex",alignItems:"center",gap:12,padding:"10px 14px",background:"#C8A84B18",border:"1px solid #C8A84B55",borderRadius:10,marginBottom:14}}>
          <div style={{width:10,height:10,borderRadius:"50%",background:"#e07b7b",animation:"pulse 1.5s infinite"}}/>
          <div style={{flex:1,fontSize:13}}>
            <strong style={{color:"#C8A84B"}}>Lead quente!</strong> {notif.nome} ({notif.score}pts) · {notif.veiculo} · Atribuído a {notif.vendedor}
          </div>
          <button style={{fontSize:12,padding:"4px 12px",background:"#C8A84B",color:"#000",border:"none",borderRadius:6,cursor:"pointer",fontWeight:700}}>
            Ver lead →
          </button>
          <button onClick={()=>setNotif(null)} style={{background:"none",border:"none",cursor:"pointer",color:"var(--muted)",fontSize:16}}>×</button>
        </div>
      )}

      {/* Tabs */}
      <div style={{display:"flex",gap:0,marginBottom:16,borderBottom:"1px solid var(--border)"}}>
        {ABAS.map(a=>(
          <button key={a.id} onClick={()=>setAba(a.id)}
            style={{padding:"8px 16px",fontSize:13,fontWeight:aba===a.id?700:400,
              color:aba===a.id?"#C8A84B":"var(--muted)",
              background:"none",border:"none",cursor:"pointer",
              borderBottom:aba===a.id?"2px solid #C8A84B":"2px solid transparent",
              transition:"all .2s"}}>
            {a.label}
          </button>
        ))}
      </div>

      {aba==="oportunidades" && <TabOportunidades data={data}/>}
      {aba==="jornada"       && <TabJornada data={data}/>}
      {aba==="estoque"       && <TabEstoque data={data}/>}
    </div>
  );
}
