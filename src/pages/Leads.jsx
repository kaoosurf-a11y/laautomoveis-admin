import { useState, useEffect } from "react";
import { getLeads, marcarLido } from "../api.js";

export default function Leads(){
  const[data,setData]=useState({contato:[],financiamento:[]});
  const[aba,setAba]=useState("contato");
  const[loading,setLoading]=useState(true);

  useEffect(()=>{getLeads().then(d=>{setData(d);setLoading(false);});},[]);

  async function handleLido(id,tipo){
    try{await marcarLido(id,tipo);}catch{}
    setData(d=>({...d,[tipo]:d[tipo].map(l=>l.id===id?{...l,lido:true}:l)}));
  }

  const lista=aba==="contato"?data.contato||[]:data.financiamento||[];
  const naolidos=lista.filter(l=>!l.lido).length;

  if(loading)return <div className="empty-state"><i className="ti ti-loader" style={{animation:"spin 1s linear infinite"}}/><p>Carregando...</p></div>;

  return(
    <div>
      <div className="page-header">
        <h1 className="page-title"><i className="ti ti-message-circle"/> Leads do site</h1>
        {naolidos>0&&<span className="badge badge-danger">{naolidos} não lidos</span>}
      </div>
      <div className="tabs-wrap">
        <button className={`tab-btn ${aba==="contato"?"active":""}`} onClick={()=>setAba("contato")}>Contato ({data.contato?.length||0})</button>
        <button className={`tab-btn ${aba==="financiamento"?"active":""}`} onClick={()=>setAba("financiamento")}>Financiamento ({data.financiamento?.length||0})</button>
      </div>
      <div className="card" style={{padding:0,overflow:"hidden"}}>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Nome</th><th>Telefone</th><th>Email</th><th>Mensagem</th><th>Data</th><th>Ação</th></tr></thead>
            <tbody>
              {lista.map(l=>(
                <tr key={l.id} style={{opacity:l.lido?.6:1}}>
                  <td style={{fontWeight:l.lido?400:600,color:"var(--fg)"}}>{l.nome}</td>
                  <td>{l.telefone&&<a href={`https://wa.me/55${l.telefone.replace(/\D/g,"")}`} target="_blank" rel="noopener noreferrer" className="btn-wa" style={{display:"inline-flex"}}><i className="ti ti-brand-whatsapp"/>{l.telefone}</a>}</td>
                  <td style={{color:"var(--muted)",fontSize:12}}>{l.email||"—"}</td>
                  <td style={{maxWidth:200,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",color:"var(--muted)",fontSize:12}}>{l.mensagem}</td>
                  <td style={{color:"var(--muted)",fontSize:12,whiteSpace:"nowrap"}}>{new Date(l.created_at).toLocaleString("pt-BR")}</td>
                  <td>{l.lido?<span className="badge badge-muted">Lido</span>:<button className="btn btn-ghost" style={{fontSize:12,padding:"4px 10px"}} onClick={()=>handleLido(l.id,aba)}>Marcar lido</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {lista.length===0&&<div className="empty-state"><i className="ti ti-inbox"/><p>Nenhum lead ainda</p></div>}
        </div>
      </div>
    </div>
  );
}
