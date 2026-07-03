import { useState, useEffect, useCallback, useRef } from "react";
import { getCRMKanban, moverLead, criarLeadCRM, criarFollowup } from "../api.js";
import { getRole } from "../auth.js";

// Rótulos pro badge "Follow-up ativo" no card/modal (inclui match_estoque, disparado
// pelo sistema, não por botão do vendedor).
const FOLLOWUP_LABEL={
  vai_pensar:"Vai pensar",
  pos_venda_satisfacao:"Pós-venda",
  perdido_preco:"Perdido — preço",
  perdido_sem_credito:"Perdido — sem crédito",
  perdido_nao_achou:"Perdido — não achou",
  match_estoque:"Veículo compatível chegou!",
};

// Submotivos de "Venda perdida" — cada um move pra fechado_perdido com o motivo
// certo e, exceto "Comprou em outro lugar" (perda definitiva, sem follow-up),
// dispara o follow-up de reengajamento correspondente.
const SUBMOTIVOS_PERDA=[
  {key:"perdido_preco",label:"Preço",motivo:"Preço"},
  {key:"perdido_sem_credito",label:"Sem crédito",motivo:"Sem crédito"},
  {key:"perdido_nao_achou",label:"Não achou o que procurava",motivo:"Não achou o que procurava"},
  {key:"comprou_outro",label:"Comprou em outro lugar",motivo:"Comprou em outro lugar"},
];

const ESTAGIOS=[
  {key:"novo_lead",label:"Novo lead",cor:"#7ba7e0"},
  {key:"em_contato",label:"Em contato",cor:"#C8A84B"},
  {key:"negociando",label:"Negociando",cor:"#27AE60"},
  {key:"fechado_ganho",label:"Fechado (ganho)",cor:"#4caf7d"},
  {key:"fechado_perdido",label:"Fechado (perdido)",cor:"#e05252"},
  {key:"pos_venda",label:"Pós-venda",cor:"#6b6b66"},
];
// Fechado (ganho)/(perdido) só se alcançam pelos botões "Resultado da negociação"
// (marcam motivo estruturado + disparam follow-up) — não pelo dropdown genérico.
const ESTAGIOS_DROPDOWN=ESTAGIOS.filter(e=>e.key!=="fechado_ganho"&&e.key!=="fechado_perdido");
const AV={"DA":"#C8A84B","AL":"#7ba7e0","WO":"#4caf7d","FE":"#e05252","DI":"#8E44AD","WI":"#27AE60"};

function Score({s}){const c=s>=70?"var(--danger)":s>=40?"var(--warning)":"#7ba7e0";return <span className="score-pill" style={{background:`${c}22`,color:c}}>{s}</span>;}
function Temp({t}){if(t==="quente")return <i className="ti ti-flame" style={{color:"var(--danger)",fontSize:12}}/>;if(t==="morno")return <i className="ti ti-sun" style={{color:"var(--warning)",fontSize:12}}/>;return <i className="ti ti-snowflake" style={{color:"#7ba7e0",fontSize:12}}/>;}
function Orig({o}){const m={anuncio:["#5b7bc4","Anún"],site:["#7ba7e0","Site"],organico:["#25D366","Org"]};const[c,l]=m[o]||["var(--muted)","?"];return <span className="badge" style={{background:`${c}22`,color:c,fontSize:10}}>{l}</span>;}

function LeadModal({lead,onClose,onMover,onFollowup,readOnly}){
  const[est,setEst]=useState(lead.estagio||"novo_lead");
  const[fuEnviado,setFuEnviado]=useState(null);
  const[mostrarSubmotivos,setMostrarSubmotivos]=useState(false);
  async function marcarVaiPensar(){
    try{await onFollowup(lead.id,"vai_pensar");setFuEnviado("vai_pensar");}catch{}
  }
  function marcarVendaFeita(){
    setEst("fechado_ganho");
    onMover(lead.id,"fechado_ganho");
    onFollowup(lead.id,"pos_venda_satisfacao").catch(()=>{});
  }
  function marcarVendaPerdida(sub){
    setEst("fechado_perdido");
    onMover(lead.id,"fechado_perdido",sub.motivo);
    if(sub.key!=="comprou_outro") onFollowup(lead.id,sub.key,sub.motivo).catch(()=>{});
  }
  function handleEstagio(novo){
    setEst(novo);
    onMover(lead.id,novo);
  }
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
        {(lead.followup_tipo||fuEnviado)&&
          <div className="badge badge-warning" style={{marginBottom:14,display:"inline-flex"}}>
            <i className="ti ti-bell" style={{fontSize:12}}/>&nbsp;Follow-up ativo: {FOLLOWUP_LABEL[fuEnviado||lead.followup_tipo]}
          </div>
        }
        <div className="form-group">
          <label className="form-label">Estágio atual</label>
          <div style={{fontSize:14,fontWeight:600,color:ESTAGIOS.find(e=>e.key===est)?.cor||"var(--fg)"}}>{ESTAGIOS.find(e=>e.key===est)?.label}</div>
        </div>
        {!readOnly&&(<>
        <div className="form-group">
          <label className="form-label">Resultado da negociação</label>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            <button className="btn btn-ghost" style={{padding:"6px 10px",fontSize:12}} onClick={marcarVaiPensar}>
              <i className="ti ti-hourglass" style={{fontSize:13}}/> Vai pensar
            </button>
            <button className="btn btn-ghost" style={{padding:"6px 10px",fontSize:12,color:"var(--success)",borderColor:"rgba(76,175,125,.3)"}} onClick={marcarVendaFeita}>
              <i className="ti ti-check" style={{fontSize:13}}/> Venda feita
            </button>
            <button className="btn btn-ghost" style={{padding:"6px 10px",fontSize:12,color:"var(--danger)",borderColor:"rgba(224,82,82,.3)"}} onClick={()=>setMostrarSubmotivos(s=>!s)}>
              <i className="ti ti-x" style={{fontSize:13}}/> Venda perdida
            </button>
          </div>
          {mostrarSubmotivos&&(
            <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:8,padding:8,background:"var(--surface2)",borderRadius:8}}>
              {SUBMOTIVOS_PERDA.map(sm=>(
                <button key={sm.key} className="btn btn-ghost" style={{padding:"6px 10px",fontSize:12}} onClick={()=>marcarVendaPerdida(sm)}>{sm.label}</button>
              ))}
            </div>
          )}
        </div>
        <div className="form-group">
          <label className="form-label">Mover pra outro estágio</label>
          <select className="form-input" value={est} onChange={e=>handleEstagio(e.target.value)}>
            {ESTAGIOS_DROPDOWN.map(e=><option key={e.key} value={e.key}>{e.label}</option>)}
          </select>
        </div>
        </>)}
        <button className="btn btn-ghost" onClick={onClose} style={{width:"100%"}}>Fechar</button>
      </div>
    </div>
  );
}

function NovoModal({onClose,onCriado}){
  const[form,setForm]=useState({nome:"",telefone:"",veiculo_interesse:"",origem:"organico"});
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
            <option value="organico">Orgânico</option><option value="site">Site</option><option value="anuncio">Anúncio</option>
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
  const readOnly=getRole()==="manager";
  const[kanban,setKanban]=useState({});
  const[loading,setLoading]=useState(true);
  const[busca,setBusca]=useState("");
  const[leadSel,setLeadSel]=useState(null);
  const[novoModal,setNovoModal]=useState(false);
  const[isMobile,setIsMobile]=useState(window.innerWidth<768);
  const[erro,setErro]=useState(null);
  const boardRef=useRef(null);

  useEffect(()=>{const fn=()=>setIsMobile(window.innerWidth<768);window.addEventListener("resize",fn);return()=>window.removeEventListener("resize",fn);},[]);
  // Sempre abre no início do board (coluna "Novo lead") — sem isso o scroll horizontal
  // podia ficar parado numa posição do carregamento anterior e dar a impressão de que
  // colunas diferentes aparecem pra cada pessoa, quando é só a posição do scroll.
  useEffect(()=>{if(boardRef.current)boardRef.current.scrollLeft=0;},[loading]);
  const load=useCallback((silent)=>{
    if(!silent) setLoading(true);
    setErro(null);
    getCRMKanban().then(k=>{setKanban(k);setLoading(false);})
      .catch(()=>{setErro("Erro ao carregar dados. Tente novamente.");setLoading(false);});
  },[]);
  useEffect(()=>{load();},[load]);

  // silent=true nos refreshes pós-ação: evita desmontar a página (e fechar o modal
  // aberto) toda vez que mover um card ou criar um follow-up — antes voltava pro
  // spinner de tela cheia a cada clique.
  async function handleMover(id,est,motivo){try{await moverLead(id,est,motivo);}catch{}load(true);}
  async function handleFollowup(id,tipo,motivo){await criarFollowup(id,tipo,motivo);load(true);}

  const todos=ESTAGIOS.flatMap(e=>(kanban[e.key]||[]).map(l=>({...l,estagio:e.key})));
  const filtrados=todos.filter(l=>!busca||l.nome.toLowerCase().includes(busca.toLowerCase())||l.veiculo_interesse.toLowerCase().includes(busca.toLowerCase()));

  if(erro)return <div className="empty-state"><i className="ti ti-alert-triangle"/><p>{erro}</p></div>;
  if(loading)return <div className="empty-state"><i className="ti ti-loader" style={{animation:"spin 1s linear infinite"}}/><p>Carregando...</p></div>;

  return(
    <div>
      <div className="page-header">
        <h1 className="page-title"><i className="ti ti-target"/> CRM Pipeline</h1>
        {!readOnly&&<button className="btn btn-primary" onClick={()=>setNovoModal(true)}><i className="ti ti-plus" style={{fontSize:16}}/> Novo lead</button>}
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
                  {lead.followup_tipo&&<div style={{fontSize:10,color:"var(--warning)",marginTop:4}}><i className="ti ti-bell" style={{fontSize:11}}/> {FOLLOWUP_LABEL[lead.followup_tipo]}</div>}
                </div>
                <div className="av" style={{background:`${AV[lead.vendedor_iniciais]||"#C8A84B"}22`,color:AV[lead.vendedor_iniciais]||"#C8A84B",fontSize:10}}>{lead.vendedor_iniciais}</div>
              </div>
            );
          })}
        </div>
      ):(
        <div className="kanban-board" ref={boardRef}>
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
                      {lead.followup_tipo&&<div style={{fontSize:10,color:"var(--warning)",marginBottom:4}}><i className="ti ti-bell" style={{fontSize:11}}/> {FOLLOWUP_LABEL[lead.followup_tipo]}</div>}
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

      {leadSel&&<LeadModal lead={leadSel} onClose={()=>setLeadSel(null)} onMover={(id,est,motivo)=>{handleMover(id,est,motivo);setLeadSel(null);}} onFollowup={handleFollowup} readOnly={readOnly}/>}
      {!readOnly&&novoModal&&<NovoModal onClose={()=>setNovoModal(false)} onCriado={()=>{load();setNovoModal(false);}}/>}
    </div>
  );
}
