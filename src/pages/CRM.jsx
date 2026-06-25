import { useState, useEffect, useCallback } from "react";
import { getCRMKanban, moverLead, criarLeadCRM } from "../api.js";
import { isManager } from "../auth.js";

const ESTAGIOS=[
  {key:"novo_lead",label:"Novo lead",cor:"#7ba7e0"},{key:"em_contato",label:"Em contato",cor:"#C8A84B"},
  {key:"apresentacao",label:"Apresentação",cor:"#e6a817"},{key:"visita_agendada",label:"Visita agendada",cor:"#8E44AD"},
  {key:"proposta",label:"Proposta",cor:"#2980B9"},{key:"credito_analise",label:"Crédito análise",cor:"#e67e22"},
  {key:"negociando",label:"Negociando",cor:"#27AE60"},{key:"fechado",label:"Fechado",cor:"#4caf7d"},
  {key:"pos_venda",label:"Pós-venda",cor:"#6b6b66"},
];
const AV={"DA":"#C8A84B","AL":"#7ba7e0","WO":"#4caf7d","FE":"#e05252","DI":"#8E44AD","WI":"#27AE60"};

function Score({s}){const c=s>=70?"var(--danger)":s>=40?"var(--warning)":"#7ba7e0";return <span className="score-pill" style={{background:`${c}22`,color:c}}>{s}</span>;}
function Temp({t}){if(t==="quente")return <i className="ti ti-flame" style={{color:"var(--danger)",fontSize:12}}/>;if(t==="morno")return <i className="ti ti-sun" style={{color:"var(--warning)",fontSize:12}}/>;return <i className="ti ti-snowflake" style={{color:"#7ba7e0",fontSize:12}}/>;}
function Orig({o}){const m={whatsapp:["#25D366","WA"],site:["#7ba7e0","Site"],indicacao:["#C8A84B","Ind"],facebook:["#5b7bc4","FB"]};const[c,l]=m[o]||["var(--muted)","?"];return <span className="badge" style={{background:`${c}22`,color:c,fontSize:10}}>{l}</span>;}

function LeadModal({lead,onClose,onMover}){
  const[est,setEst]=useState(lead.estagio||"novo_lead");
  return(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()}>
        <div className="modal-handle"/>
        <div className="modal-header">
          <h2 className="modal-title">{lead.nome}</h2>
          <button onClick={onClose} style={{background:"none",border:"none",color:"var(--muted)",fontSize:22,cursor:"pointer"}}><i className="ti ti-x"/></button>
        </div>
        <div style={{marginBottom:14}}>
          <div style={{fontSize:13,color:"var(--muted)",marginBottom:4}}>Veículo de interesse</div>
          <div style={{fontSize:15,fontWeight:600,color:"var(--fg)"}}>{lead.veiculo_interesse}</div>
          {lead.valor&&<div style={{fontSize:14,color:"var(--brand)",fontWeight:700}}>R$ {Number(lead.valor).toLocaleString("pt-BR")}</div>}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
          <div style={{background:"var(--surface2)",borderRadius:8,padding:"10px 12px"}}>
            <div style={{fontSize:10,color:"var(--muted)",marginBottom:2}}>SCORE</div>
            <div style={{fontSize:20,fontWeight:700,color:lead.score>=70?"var(--danger)":lead.score>=40?"var(--warning)":"#7ba7e0"}}>{lead.score}</div>
          </div>
          <div style={{background:"var(--surface2)",borderRadius:8,padding:"10px 12px"}}>
            <div style={{fontSize:10,color:"var(--muted)",marginBottom:2}}>TEMPERATURA</div>
            <div style={{fontSize:13,fontWeight:600,color:"var(--fg)",display:"flex",alignItems:"center",gap:4}}><Temp t={lead.temperatura}/>{lead.temperatura}</div>
          </div>
        </div>
        {lead.telefone&&<div style={{marginBottom:14}}><a href={`https://wa.me/55${lead.telefone.replace(/\D/g,"")}`} target="_blank" rel="noopener noreferrer" className="btn-wa"><i className="ti ti-brand-whatsapp"/>{lead.telefone}</a></div>}
        <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:16}}>
          {lead.troca&&<span className="badge badge-warning"><i className="ti ti-arrows-exchange" style={{fontSize:12}}/>Tem troca</span>}
          {lead.financiamento&&<span className="badge badge-brand"><i className="ti ti-credit-card" style={{fontSize:12}}/>Financiamento</span>}
          {lead.origem&&<Orig o={lead.origem}/>}
        </div>
        <div className="form-group">
          <label className="form-label">Mover para estágio</label>
          <select className="form-input" value={est} onChange={e=>{setEst(e.target.value);onMover(lead.id,e.target.value);}}>
            {ESTAGIOS.map(e=><option key={e.key} value={e.key}>{e.label}</option>)}
          </select>
        </div>
        <button className="btn btn-ghost" onClick={onClose} style={{width:"100%"}}>Fechar</button>
      </div>
    </div>
  );
}

function NovoModal({onClose,onCriado}){
  const[form,setForm]=useState({nome:"",telefone:"",veiculo_interesse:"",origem:"whatsapp"});
  const[loading,setLoading]=useState(false);
  const set=(k,v)=>setForm(f=>({...f,[k]:v}));
  async function submit(){if(!form.nome||!form.veiculo_interesse)return;setLoading(true);try{await criarLeadCRM(form);onCriado();}catch{}setLoading(false);onClose();}
  return(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()}>
        <div className="modal-handle"/>
        <div className="modal-header">
          <h2 className="modal-title">Novo lead</h2>
          <button onClick={onClose} style={{background:"none",border:"none",color:"var(--muted)",fontSize:22,cursor:"pointer"}}><i className="ti ti-x"/></button>
        </div>
        <div className="form-group"><label className="form-label">Nome *</label><input className="form-input" value={form.nome} onChange={e=>set("nome",e.target.value)} placeholder="Nome do cliente"/></div>
        <div className="form-group"><label className="form-label">Telefone</label><input className="form-input" value={form.telefone} onChange={e=>set("telefone",e.target.value)} placeholder="(49) 9 9999-9999"/></div>
        <div className="form-group"><label className="form-label">Veículo *</label><input className="form-input" value={form.veiculo_interesse} onChange={e=>set("veiculo_interesse",e.target.value)} placeholder="Ex: HB20 2022"/></div>
        <div className="form-group"><label className="form-label">Origem</label>
          <select className="form-input" value={form.origem} onChange={e=>set("origem",e.target.value)}>
            <option value="whatsapp">WhatsApp</option><option value="site">Site</option>
            <option value="indicacao">Indicação</option><option value="facebook">Facebook</option><option value="direto">Direto na loja</option>
          </select>
        </div>
        <div style={{display:"flex",gap:8}}>
          <button className="btn btn-ghost" onClick={onClose} style={{flex:1}}>Cancelar</button>
          <button className="btn btn-primary" onClick={submit} disabled={loading} style={{flex:1}}>{loading?<span className="spinner"/>:"Adicionar"}</button>
        </div>
      </div>
    </div>
  );
}

export default function CRM(){
  const[kanban,setKanban]=useState({});
  const[loading,setLoading]=useState(true);
  const[busca,setBusca]=useState("");
  const[leadSel,setLeadSel]=useState(null);
  const[novoModal,setNovoModal]=useState(false);
  const[isMobile,setIsMobile]=useState(window.innerWidth<768);

  useEffect(()=>{const fn=()=>setIsMobile(window.innerWidth<768);window.addEventListener("resize",fn);return()=>window.removeEventListener("resize",fn);},[]);
  const load=useCallback(()=>{setLoading(true);getCRMKanban().then(k=>{setKanban(k);setLoading(false);});},[]);
  useEffect(()=>{load();},[load]);

  async function handleMover(id,est){try{await moverLead(id,est);}catch{}load();}

  const todos=ESTAGIOS.flatMap(e=>(kanban[e.key]||[]).map(l=>({...l,estagio:e.key})));
  const filtrados=todos.filter(l=>!busca||l.nome.toLowerCase().includes(busca.toLowerCase())||l.veiculo_interesse.toLowerCase().includes(busca.toLowerCase()));

  if(loading)return <div className="empty-state"><i className="ti ti-loader" style={{animation:"spin 1s linear infinite"}}/><p>Carregando...</p></div>;

  return(
    <div>
      <div className="page-header">
        <h1 className="page-title"><i className="ti ti-target"/> CRM Pipeline</h1>
        <button className="btn btn-primary" onClick={()=>setNovoModal(true)}><i className="ti ti-plus" style={{fontSize:16}}/> Novo lead</button>
      </div>
      <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap"}}>
        <input className="form-input" style={{maxWidth:220,marginBottom:0,fontSize:13,padding:"7px 12px"}} placeholder="Buscar..." value={busca} onChange={e=>setBusca(e.target.value)}/>
      </div>
      <div style={{fontSize:13,color:"var(--muted)",marginBottom:12}}>{todos.length} leads · {filtrados.length} exibidos</div>

      {isMobile?(
        <div className="crm-list">
          {filtrados.length===0&&<div className="empty-state"><i className="ti ti-inbox"/><p>Nenhum lead</p></div>}
          {filtrados.map(lead=>{
            const est=ESTAGIOS.find(e=>e.key===lead.estagio);
            return(
              <div key={lead.id} className="crm-list-item" style={{borderLeft:`3px solid ${est?.cor||"var(--border)"}`}} onClick={()=>setLeadSel(lead)}>
                <div style={{flex:1,minWidth:0}}>
                  <div className="crm-list-nome">{lead.nome}</div>
                  <div className="crm-list-sub">{lead.veiculo_interesse} · {est?.label}</div>
                  <div style={{display:"flex",gap:6,marginTop:4,alignItems:"center"}}><Temp t={lead.temperatura}/><Score s={lead.score}/>{lead.origem&&<Orig o={lead.origem}/>}</div>
                </div>
                <div className="av" style={{background:`${AV[lead.vendedor_iniciais]||"#C8A84B"}22`,color:AV[lead.vendedor_iniciais]||"#C8A84B",fontSize:10}}>{lead.vendedor_iniciais}</div>
              </div>
            );
          })}
        </div>
      ):(
        <div className="kanban-board">
          {ESTAGIOS.map(est=>{
            const leads=(kanban[est.key]||[]).filter(l=>!busca||l.nome.toLowerCase().includes(busca.toLowerCase())||l.veiculo_interesse.toLowerCase().includes(busca.toLowerCase()));
            return(
              <div key={est.key} className="kanban-col">
                <div className="kanban-col-header" style={{borderTop:`2px solid ${est.cor}`}}>
                  <span className="kanban-col-title">{est.label}</span>
                  <span className="kanban-col-count">{leads.length}</span>
                </div>
                <div className="kanban-cards">
                  {leads.length===0&&<div style={{textAlign:"center",color:"var(--muted)",fontSize:12,padding:"12px 0"}}>—</div>}
                  {leads.map(lead=>(
                    <div key={lead.id} className="kanban-card" onClick={()=>setLeadSel({...lead,estagio:est.key})}>
                      <div className="kanban-card-nome">{lead.nome}</div>
                      <div className="kanban-card-veiculo">{lead.veiculo_interesse}</div>
                      <div className="kanban-card-footer">
                        <div style={{display:"flex",gap:4,alignItems:"center"}}><Temp t={lead.temperatura}/>{lead.origem&&<Orig o={lead.origem}/>}</div>
                        <div style={{display:"flex",gap:6,alignItems:"center"}}>
                          <Score s={lead.score}/>
                          <div className="av" style={{width:24,height:24,fontSize:9,background:`${AV[lead.vendedor_iniciais]||"#C8A84B"}22`,color:AV[lead.vendedor_iniciais]||"#C8A84B"}}>{lead.vendedor_iniciais}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {leadSel&&<LeadModal lead={leadSel} onClose={()=>setLeadSel(null)} onMover={(id,est)=>{handleMover(id,est);setLeadSel(null);}}/>}
      {novoModal&&<NovoModal onClose={()=>setNovoModal(false)} onCriado={()=>{load();setNovoModal(false);}}/>}
    </div>
  );
}
