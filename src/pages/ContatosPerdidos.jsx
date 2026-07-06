import { useState, useEffect } from "react";
import { getContatosNaoProcessados, resolverContato } from "../api.js";

function fmtDataHora(iso){
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR",{day:"2-digit",month:"2-digit"}) + " às " + d.toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"});
}
function haQuanto(iso){
  const min = Math.round((Date.now() - new Date(iso).getTime())/60000);
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min/60);
  if (h < 24) return `há ${h}h`;
  return `há ${Math.floor(h/24)}d`;
}

export default function ContatosPerdidos(){
  const[lista,setLista]=useState([]);
  const[loading,setLoading]=useState(true);
  const[erro,setErro]=useState(null);

  function load(){
    setLoading(true);setErro(null);
    getContatosNaoProcessados().then(d=>{setLista(d);setLoading(false);})
      .catch(()=>{setErro("Erro ao carregar dados. Tente novamente.");setLoading(false);});
  }
  useEffect(()=>{load();},[]);

  async function resolver(id){
    try{await resolverContato(id);}catch{return;}
    setLista(l=>l.filter(c=>c.id!==id));
  }

  if(erro)return <div className="empty-state"><i className="ti ti-alert-triangle"/><p>{erro}</p></div>;
  if(loading)return <div className="empty-state"><i className="ti ti-loader" style={{animation:"spin 1s linear infinite"}}/><p>Carregando...</p></div>;

  return(
    <div>
      <div className="page-header">
        <h1 className="page-title"><i className="ti ti-alert-triangle"/> Contatos não processados</h1>
        <button className="btn btn-ghost" onClick={load}><i className="ti ti-refresh"/> Atualizar</button>
      </div>
      <div style={{fontSize:13,color:"var(--muted)",marginBottom:16}}>
        Mensagens que chegaram pelo WhatsApp mas, por algum motivo, nunca foram processadas pela Lara (RECEPTOR/PROCESSADOR).
        Capturadas por uma camada de segurança independente — se aparecer algo aqui, provavelmente precisa de resposta manual.
      </div>
      <div className="card">
        {lista.length===0&&<div className="empty-state"><i className="ti ti-check"/><p>Nenhum contato perdido — tudo processado normalmente</p></div>}
        {lista.map(c=>(
          <div key={c.id} className="fu-item" style={{borderLeft:"3px solid var(--danger)",paddingLeft:10}}>
            <div className="av" style={{background:"rgba(224,82,82,.15)",color:"var(--danger)",flexShrink:0,fontSize:10}}>
              <i className="ti ti-alert-circle" style={{fontSize:16}}/>
            </div>
            <div className="fu-info">
              <div className="fu-nome">{c.nome_whatsapp || "Sem nome"} · {c.telefone}</div>
              <div className="fu-sub">{c.mensagem_recebida || "(sem texto — mídia ou tipo não capturado)"}</div>
              <div style={{fontSize:11,color:"var(--muted)",marginTop:2}}>
                Recebido em {fmtDataHora(c.timestamp_recebimento)} · {haQuanto(c.timestamp_recebimento)}
              </div>
            </div>
            <div className="fu-actions" style={{display:"flex",gap:6,alignItems:"center"}}>
              {c.telefone&&<a href={`https://wa.me/55${c.telefone.replace(/\D/g,"")}`} target="_blank" rel="noopener noreferrer" className="btn-wa"><i className="ti ti-brand-whatsapp" style={{fontSize:16}}/> Responder</a>}
              <button className="btn btn-ghost" style={{fontSize:12,padding:"6px 10px"}} onClick={()=>resolver(c.id)} title="Já tratei esse caso, parar de alertar"><i className="ti ti-check" style={{fontSize:14}}/> Marcar resolvido</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
