import { useState, useEffect } from "react";
import { getFollowups, marcarFollowupEnviado, marcarFollowupRespondeu } from "../api.js";

const TIPO_LABEL={
  inatividade:"Sem retorno",indecisao:"Pensando",
  enviado_site:"Mandado pro site",negociacao_parada:"Negociação parada",
};

export default function FollowUps(){
  const[data,setData]=useState({hoje:[],vencidos:[]});
  const[aba,setAba]=useState("hoje");
  const[loading,setLoading]=useState(true);
  const[erro,setErro]=useState(null);

  useEffect(()=>{
    getFollowups().then(d=>{setData(d);setLoading(false);})
      .catch(()=>{setErro("Erro ao carregar dados. Tente novamente.");setLoading(false);});
  },[]);

  const upd=(id,changes)=>setData(d=>({
    hoje:d.hoje.map(f=>f.id===id?{...f,...changes}:f),
    vencidos:d.vencidos.map(f=>f.id===id?{...f,...changes}:f),
  }));

  async function marcarEnviado(id){try{await marcarFollowupEnviado(id);}catch{}upd(id,{enviado:true});}
  async function marcarRespondeu(id){try{await marcarFollowupRespondeu(id);}catch{}upd(id,{respondeu:true});}

  const lista=aba==="hoje"?data.hoje:data.vencidos;
  const resumo={hoje:data.hoje?.length||0,pendentes:data.hoje?.filter(f=>!f.enviado)?.length||0,responderam:data.hoje?.filter(f=>f.respondeu)?.length||0};

  if(erro)return <div className="empty-state"><i className="ti ti-alert-triangle"/><p>{erro}</p></div>;
  if(loading)return <div className="empty-state"><i className="ti ti-loader" style={{animation:"spin 1s linear infinite"}}/><p>Carregando...</p></div>;

  return(
    <div>
      <div className="page-header"><h1 className="page-title"><i className="ti ti-clock"/> Follow-ups</h1></div>
      <div className="metrics-grid" style={{marginBottom:20}}>
        <div className="metric-card"><div className="metric-label"><i className="ti ti-calendar"/>Hoje</div><div className="metric-value">{resumo.hoje}</div><div className="metric-delta">agendados</div></div>
        <div className="metric-card"><div className="metric-label"><i className="ti ti-send"/>Pendentes</div><div className="metric-value" style={{color:"var(--warning)"}}>{resumo.pendentes}</div><div className="metric-delta">não enviados</div></div>
        <div className="metric-card"><div className="metric-label"><i className="ti ti-message-check"/>Responderam</div><div className="metric-value" style={{color:"var(--success)"}}>{resumo.responderam}</div><div className="metric-delta">hoje</div></div>
      </div>
      <div className="tabs-wrap">
        <button className={`tab-btn ${aba==="hoje"?"active":""}`} onClick={()=>setAba("hoje")}>Agenda de hoje ({data.hoje?.length||0})</button>
        <button className={`tab-btn ${aba==="vencidos"?"active":""}`} onClick={()=>setAba("vencidos")} style={{color:data.vencidos?.length>0?"var(--danger)":undefined}}>
          Vencidos {data.vencidos?.length>0&&<span style={{background:"var(--danger)",color:"white",borderRadius:"50%",width:16,height:16,display:"inline-flex",alignItems:"center",justifyContent:"center",fontSize:10,marginLeft:4}}>{data.vencidos.length}</span>}
        </button>
      </div>
      <div className="card">
        {lista?.length===0&&<div className="empty-state"><i className="ti ti-check"/><p>Nenhum follow-up {aba==="hoje"?"hoje":"vencido"}</p></div>}
        {lista?.map(f=>(
          <div key={f.id} className="fu-item" style={{borderLeft:aba==="vencidos"?"3px solid var(--danger)":"none",paddingLeft:aba==="vencidos"?10:0}}>
            <span style={{fontSize:12,color:"var(--muted)",minWidth:80,flexShrink:0}}>{f.horario}</span>
            <div className="av" style={{background:"rgba(200,168,75,.15)",color:"var(--brand)",flexShrink:0,fontSize:10}}>{f.vendedor_iniciais}</div>
            <div className="fu-info">
              <div className="fu-nome">{f.cliente_nome}</div>
              <div className="fu-sub">{f.veiculo} · <span style={{color:"var(--brand)"}}>{TIPO_LABEL[f.tipo]||f.tipo}</span></div>
              {f.motivo&&<div style={{fontSize:11,color:"var(--muted)",marginTop:2}}>{f.motivo}</div>}
            </div>
            <div className="fu-actions">
              {f.telefone&&<a href={`https://wa.me/55${f.telefone.replace(/\D/g,"")}`} target="_blank" rel="noopener noreferrer" className="btn-wa"><i className="ti ti-brand-whatsapp" style={{fontSize:16}}/></a>}
              {!f.enviado?<button className="btn btn-ghost" style={{padding:"5px 10px",fontSize:12}} onClick={()=>marcarEnviado(f.id)}><i className="ti ti-send" style={{fontSize:14}}/> Enviado</button>
                :<span className="badge badge-brand" style={{fontSize:11}}><i className="ti ti-check" style={{fontSize:12}}/> Enviado</span>}
              {f.enviado&&!f.respondeu&&<button className="btn btn-ghost" style={{padding:"5px 10px",fontSize:12}} onClick={()=>marcarRespondeu(f.id)}>Respondeu</button>}
              {f.respondeu&&<span className="badge badge-success" style={{fontSize:11}}><i className="ti ti-check" style={{fontSize:12}}/> Respondeu</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
