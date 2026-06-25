import { useState, useEffect } from "react";
import { getDashboard } from "../api.js";

export default function Dashboard() {
  const [data, setData]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [periodo, setPeriodo] = useState("mes");

  useEffect(() => { setLoading(true); getDashboard(periodo).then(d=>{setData(d);setLoading(false);}); }, [periodo]);

  if (loading) return <div className="empty-state"><i className="ti ti-loader" style={{animation:"spin 1s linear infinite"}}/><p>Carregando...</p></div>;
  if (!data) return null;
  const {resumo,funil,vendedores,canais} = data;
  const fmtR = v => `R$ ${Number(v).toLocaleString("pt-BR")}`;
  const metrics = [
    {icon:"ti-target",       label:"Total leads",  value:resumo.total_leads,          delta:`+${resumo.total_leads_delta} este mês`, up:true},
    {icon:"ti-check",        label:"Vendas",       value:resumo.vendas,               delta:`meta: ${resumo.meta_vendas}`,           up:resumo.vendas>=resumo.meta_vendas},
    {icon:"ti-percent",      label:"Conversão",    value:`${resumo.conversao}%`,      delta:`+${resumo.conversao_delta}% vs mês`,    up:true},
    {icon:"ti-x",            label:"Perdidas",     value:resumo.perdidas,             delta:"leads perdidos",                        up:false},
    {icon:"ti-clock",        label:"Resp. média",  value:`${resumo.resp_media_min}min`,delta:"tempo de resposta",                   up:resumo.resp_media_min<=5},
    {icon:"ti-currency-real",label:"Ticket médio", value:fmtR(resumo.ticket_medio),   delta:`receita: ${fmtR(resumo.receita_total)}`,up:true},
  ];
  const avCores=["#C8A84B","#7ba7e0","#4caf7d"];

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title"><i className="ti ti-layout-dashboard"/> Dashboard</h1>
        <div style={{display:"flex",gap:6}}>
          {["semana","mes","trimestre"].map(p=>(
            <button key={p} className={`btn ${periodo===p?"btn-primary":"btn-ghost"}`} style={{padding:"6px 12px",fontSize:12}} onClick={()=>setPeriodo(p)}>
              {p==="semana"?"7 dias":p==="mes"?"Este mês":"Trimestre"}
            </button>
          ))}
        </div>
      </div>
      <div className="metrics-grid" style={{marginBottom:20}}>
        {metrics.map((m,i)=>(
          <div key={i} className="metric-card">
            <div className="metric-label"><i className={`ti ${m.icon}`}/>{m.label}</div>
            <div className="metric-value">{m.value}</div>
            <div className={`metric-delta ${m.up?"up":"down"}`}>{m.delta}</div>
          </div>
        ))}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr",gap:12,marginBottom:12}}>
        <div className="card">
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
        <div className="card">
          <div className="card-title"><i className="ti ti-users"/> Por vendedor</div>
          {vendedores.map((v,i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
              <div className="av" style={{background:`${avCores[i]}22`,color:avCores[i]}}>{v.iniciais}</div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                  <span style={{fontSize:13,color:"var(--fg)"}}>{v.nome}</span>
                  <span style={{fontSize:12,color:"var(--muted)"}}>{v.vendas} vendas</span>
                </div>
                <div className="funnel-track"><div className="funnel-bar" style={{width:`${Math.round(v.total_leads/40*100)}%`,background:avCores[i]}}/></div>
              </div>
              <div style={{fontSize:12,color:"var(--muted)",minWidth:24}}>{v.total_leads}</div>
            </div>
          ))}
        </div>
        <div className="card">
          <div className="card-title"><i className="ti ti-chart-pie"/> Canais de origem</div>
          {canais.map((c,i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
              <div style={{width:10,height:10,borderRadius:"50%",background:c.cor,flexShrink:0}}/>
              <div style={{flex:1,fontSize:13,color:"var(--fg)"}}>{c.nome}</div>
              <div className="funnel-track" style={{flex:2}}>
                <div className="funnel-bar" style={{width:`${Math.round(c.total/canais.reduce((a,x)=>a+x.total,0)*100)}%`,background:c.cor}}/>
              </div>
              <div style={{fontSize:12,color:"var(--muted)",minWidth:20}}>{c.total}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
