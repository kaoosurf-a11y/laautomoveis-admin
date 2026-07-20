import { useState, useEffect } from "react";
import { api } from "../lib/api.js";

const ROLE_LABEL = { admin_master:"Proprietário", gerente:"Gerente", vendedor:"Vendedor" };
const CORES=["#C8A84B","#e05252","#8E44AD","#2980B9","#27AE60","#e6a817"];

export default function Equipe(){
  const[equipe,setEquipe]=useState([]);
  const[loading,setLoading]=useState(true);
  const[erro,setErro]=useState(null);

  useEffect(()=>{
    api.getUsers().then(u=>{setEquipe(u);setLoading(false);})
      .catch(()=>{setErro("Erro ao carregar equipe. Tente novamente.");setLoading(false);});
  },[]);

  if(erro)return <div className="empty-state"><i className="ti ti-alert-triangle"/><p>{erro}</p></div>;
  if(loading)return <div className="empty-state"><i className="ti ti-loader" style={{animation:"spin 1s linear infinite"}}/><p>Carregando...</p></div>;

  return(
    <div>
      <div className="page-header"><h1 className="page-title"><i className="ti ti-users"/> Equipe</h1></div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:12}}>
        {equipe.map((m,i)=>(
          <div key={m.usuario} className="card" style={{display:"flex",alignItems:"center",gap:14}}>
            <div style={{width:46,height:46,borderRadius:"50%",background:`${CORES[i%CORES.length]}22`,color:CORES[i%CORES.length],display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,fontWeight:800,flexShrink:0}}>{m.iniciais}</div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:15,fontWeight:700,color:"var(--fg)"}}>{m.nome}</div>
              <div style={{fontSize:12,color:"var(--muted)"}}>{ROLE_LABEL[m.role]||m.role}</div>
              <div style={{fontSize:11,color:"var(--muted)",marginTop:2}}>@{m.usuario}</div>
            </div>
            <span className="badge badge-success" style={{fontSize:10}}>Ativo</span>
          </div>
        ))}
      </div>
      <div className="card" style={{marginTop:20}}>
        <div className="card-title"><i className="ti ti-key"/> Credenciais</div>
        <div style={{background:"var(--surface2)",borderRadius:8,padding:"12px 14px",fontSize:13,color:"var(--muted)"}}>
          <div>Senha padrão: <code style={{color:"var(--brand)",background:"rgba(200,168,75,.1)",padding:"2px 8px",borderRadius:4}}>LA@2025</code></div>
          <div style={{marginTop:6}}>URL: <code style={{color:"var(--brand)"}}>admin.laautomoveis.com.br/admin</code></div>
        </div>
      </div>
    </div>
  );
}
