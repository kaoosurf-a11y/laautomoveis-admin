import { useState, useEffect, useCallback, useRef } from "react";
import { getCRMKanban, moverLead, criarLeadCRM, agendarVisita, atualizarLeadCRM, atualizarTemperatura, atualizarResponsavel } from "../api.js";
import { getRole } from "../auth.js";

// Rótulos pro badge "Follow-up ativo" no card/modal. Pra sem_credito/vai_pensar/
// nao_achou_carro/parou_responder o rótulo é o mesmo da coluna do Kanban (o tipo
// de follow-up É o estágio, ver redesenho 2026-07) — só pos_venda_satisfacao e
// match_estoque não são estágio, por isso têm rótulo próprio aqui.
const FOLLOWUP_LABEL={
  sem_credito:"Sem crédito",
  vai_pensar:"Vai pensar",
  nao_achou_carro:"Não achou o carro",
  parou_responder:"Parou de responder",
  pos_venda_satisfacao:"Pós-venda",
  match_estoque:"Veículo compatível chegou!",
};

// Colunas do Kanban. Redesenho 2026-07: "Em contato"+"Negociando" viraram uma coluna
// só ("negociando"/"Em negociação" — eram só fases sequenciais sem gatilho). sem_credito/
// vai_pensar/nao_achou_carro/parou_responder são os "motivos pós-atendimento": arrastar
// o card pra uma delas JÁ dispara o follow-up automático correspondente no backend
// (routes/crm.js) — não tem passo separado de marcar tag.
// "fechado_perdido" removida (decisão do Felipe, 2026-07: não faz sentido pra jornada
// do cliente da loja). "bau" adicionada como novo catch-all genérico — vazia por
// padrão, o vendedor move pra lá manualmente quando fizer sentido.
const ESTAGIOS_ADMIN=[
  {key:"novo_lead",label:"Novo lead",cor:"#7ba7e0"},
  {key:"negociando",label:"Em negociação",cor:"#C8A84B"},
  {key:"sem_credito",label:"Sem crédito",cor:"#e67e22"},
  {key:"vai_pensar",label:"Vai pensar",cor:"#8E44AD"},
  {key:"nao_achou_carro",label:"Não achou o carro",cor:"#2980B9"},
  {key:"parou_responder",label:"Parou de responder",cor:"#7f8c8d"},
  {key:"fechado_ganho",label:"Venda feita",cor:"#4caf7d"},
  {key:"pos_venda",label:"Pós-venda",cor:"#6b6b66"},
  {key:"bau",label:"Baú",cor:"#6b6b66"},
];
// Vendedor 2026-07: quando o lead chega, a Lara já atendeu e qualificou — ele não
// precisa das 2 colunas iniciais separadas, só decidir o desfecho. "Novo lead" e
// "Em negociação" viram uma coluna virtual só ("Para atender"); `estagiosDb` lista
// quais valores reais de estagio caem nela (o card guarda o estagio real, não
// "para_atender" — isso é só agrupamento visual).
const ESTAGIOS_VENDEDOR=[
  {key:"para_atender",label:"Para atender",cor:"#C8A84B",estagiosDb:["novo_lead","negociando"]},
  {key:"sem_credito",label:"Sem crédito",cor:"#e67e22"},
  {key:"vai_pensar",label:"Vai pensar",cor:"#8E44AD"},
  {key:"nao_achou_carro",label:"Não achou o carro",cor:"#2980B9"},
  {key:"parou_responder",label:"Parou de responder",cor:"#7f8c8d"},
  {key:"fechado_ganho",label:"Venda feita",cor:"#4caf7d"},
  {key:"pos_venda",label:"Pós-venda",cor:"#6b6b66"},
  {key:"bau",label:"Baú",cor:"#6b6b66"},
];
function leadsDaColuna(est,kanban){
  return est.estagiosDb ? est.estagiosDb.flatMap(k=>kanban[k]||[]) : (kanban[est.key]||[]);
}
function colunaVisual(estagios,estagioReal){
  return estagios.find(e=>e.key===estagioReal || e.estagiosDb?.includes(estagioReal));
}
const AV={"DA":"#C8A84B","AL":"#7ba7e0","WO":"#4caf7d","FE":"#e05252","DI":"#8E44AD","WI":"#27AE60"};

function Score({s}){const c=s>=70?"var(--danger)":s>=40?"var(--warning)":"#7ba7e0";return <span className="score-pill" style={{background:`${c}22`,color:c}}>{s}</span>;}
function Temp({t}){if(t==="quente")return <i className="ti ti-flame" style={{color:"var(--danger)",fontSize:12}}/>;if(t==="morno")return <i className="ti ti-sun" style={{color:"var(--warning)",fontSize:12}}/>;return <i className="ti ti-snowflake" style={{color:"#7ba7e0",fontSize:12}}/>;}
function Orig({o}){const m={anuncio:["#5b7bc4","Anún"],site:["#7ba7e0","Site"],organico:["#25D366","Org"],presencial:["#C8A84B","Loja"]};const[c,l]=m[o]||["var(--muted)","?"];return <span className="badge" style={{background:`${c}22`,color:c,fontSize:10}}>{l}</span>;}
// Badge de responsável (IA/Humano/Pausado) — grava só em crm_leads.responsavel_atual,
// pra fins de indicador visual. Não controla de fato quem responde no WhatsApp (isso
// é la_leads.human_takeover_at, lido só pelo n8n) — ver aviso no seletor do modal.
const RESP_INFO={ia:["#25D366","IA"],humano:["#7ba7e0","Humano"],pausado:["#e05252","Pausado"]};
function Resp({r}){const[c,l]=RESP_INFO[r]||RESP_INFO.ia;return <span className="badge" style={{background:`${c}22`,color:c,fontSize:9}}>{l}</span>;}
// Tempo desde a última mudança no lead — proxy pro "tempo no estágio atual" (não existe
// histórico granular de transição por estágio ainda, ver achado da Fase 1).
function tempoDesde(iso){
  if(!iso)return "";
  const ms=Date.now()-new Date(iso).getTime();
  const h=ms/3600000;
  if(h<1)return `${Math.max(1,Math.round(ms/60000))}min`;
  if(h<24)return `${Math.round(h)}h`;
  return `${Math.round(h/24)}d`;
}
function followupAtrasado(lead){return lead.followup_tipo&&lead.followup_horario&&new Date(lead.followup_horario)<new Date();}
// Lead presencial sem WhatsApp: o follow-up é criado normalmente (routes/crm.js não
// depende de telefone), mas ninguém consegue contatar automaticamente — sinaliza pro
// vendedor que esse acompanhamento precisa ser manual/presencial, não vai sair sozinho.
function followupSemContato(lead){return lead.followup_tipo&&!lead.telefone;}

function LeadModal({lead,onClose,onMover,onAtualizado,readOnly,estagios}){
  const[est,setEst]=useState(lead.estagio||"novo_lead"); // sempre o valor REAL de estagio
  const[agendando,setAgendando]=useState(false);
  const[agendado,setAgendado]=useState(false);
  const colAtual=colunaVisual(estagios,est);
  // Veículo associado ao lead — editável (ex: caso Santos, veio pelo anúncio do Gol
  // mas fechou em outro carro). Corrige o campo real (crm_leads.veiculo_interesse),
  // então reflete em todo lugar que lê esse campo (card do Kanban, relatório do
  // Dashboard, agendamento de visita) — não é só um ajuste de exibição.
  const[veiculoAtual,setVeiculoAtual]=useState(lead.veiculo_interesse||"");
  const[editandoVeiculo,setEditandoVeiculo]=useState(false);
  const[veiculoInput,setVeiculoInput]=useState(veiculoAtual);
  const[salvandoVeiculo,setSalvandoVeiculo]=useState(false);
  async function salvarVeiculo(){
    const v=veiculoInput.trim();
    if(!v){setVeiculoInput(veiculoAtual);setEditandoVeiculo(false);return;}
    if(v===veiculoAtual){setEditandoVeiculo(false);return;}
    setSalvandoVeiculo(true);
    try{
      await atualizarLeadCRM(lead.id,{veiculo_interesse:v});
      setVeiculoAtual(v);
      setEditandoVeiculo(false);
      onAtualizado?.();
    }catch{
      alert("Erro ao atualizar o veículo. Tente novamente.");
    }
    setSalvandoVeiculo(false);
  }
  const[temperaturaAtual,setTemperaturaAtual]=useState(lead.temperatura||"frio");
  const[salvandoTemp,setSalvandoTemp]=useState(false);
  async function mudarTemperatura(v){
    if(v===temperaturaAtual)return;
    setSalvandoTemp(true);
    try{await atualizarTemperatura(lead.id,v);setTemperaturaAtual(v);onAtualizado?.();}
    catch{alert("Erro ao atualizar temperatura. Tente novamente.");}
    setSalvandoTemp(false);
  }
  const[responsavelAtual,setResponsavelAtual]=useState(lead.responsavel_atual||"ia");
  const[salvandoResp,setSalvandoResp]=useState(false);
  async function mudarResponsavel(v){
    if(v===responsavelAtual)return;
    setSalvandoResp(true);
    try{await atualizarResponsavel(lead.id,v);setResponsavelAtual(v);onAtualizado?.();}
    catch{alert("Erro ao atualizar responsável. Tente novamente.");}
    setSalvandoResp(false);
  }
  async function handleAgendar(){
    if(!confirm(`A Lara vai iniciar uma conversa no WhatsApp com ${lead.nome} pra marcar a visita. Confirma?`))return;
    setAgendando(true);
    try{await agendarVisita(lead.id);setAgendado(true);}catch{alert("Erro ao iniciar agendamento. Tente de novo.");}
    setAgendando(false);
  }
  function handleEstagio(novoKey){
    const alvo=estagios.find(e=>e.key===novoKey);
    // Coluna virtual ("Para atender"): manda pro último estagio real do grupo
    // (negociando) — o vendedor já deve ter conversado se está movendo de volta.
    const real=alvo?.estagiosDb ? alvo.estagiosDb[alvo.estagiosDb.length-1] : novoKey;
    setEst(real);
    onMover(lead.id,real);
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
          <div style={{fontSize:13,color:"var(--muted)",marginBottom:4}}>Veículo</div>
          {editandoVeiculo?(
            <div style={{display:"flex",gap:6}}>
              <input
                className="form-input" style={{marginBottom:0}} autoFocus
                value={veiculoInput} onChange={e=>setVeiculoInput(e.target.value)}
                onKeyDown={e=>{if(e.key==="Enter")salvarVeiculo();if(e.key==="Escape"){setVeiculoInput(veiculoAtual);setEditandoVeiculo(false);}}}
              />
              <button className="btn btn-primary" style={{padding:"6px 12px"}} onClick={salvarVeiculo} disabled={salvandoVeiculo}>
                {salvandoVeiculo?<span className="spinner"/>:<i className="ti ti-check"/>}
              </button>
              <button className="btn btn-ghost" style={{padding:"6px 12px"}} onClick={()=>{setVeiculoInput(veiculoAtual);setEditandoVeiculo(false);}}>
                <i className="ti ti-x"/>
              </button>
            </div>
          ):(
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <div style={{fontSize:15,fontWeight:600,color:"var(--fg)"}}>{veiculoAtual}</div>
              {!readOnly&&
                <button onClick={()=>{setVeiculoInput(veiculoAtual);setEditandoVeiculo(true);}} title="Trocar veículo"
                  style={{background:"none",border:"none",color:"var(--muted)",cursor:"pointer",fontSize:14,display:"flex"}}>
                  <i className="ti ti-pencil"/>
                </button>
              }
            </div>
          )}
          {lead.valor&&<div style={{fontSize:14,color:"var(--brand)",fontWeight:700}}>R$ {Number(lead.valor).toLocaleString("pt-BR")}</div>}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
          <div style={{background:"var(--surface2)",borderRadius:8,padding:"10px 12px"}}>
            <div style={{fontSize:10,color:"var(--muted)",marginBottom:2}}>SCORE</div>
            <div style={{fontSize:20,fontWeight:700,color:lead.score>=70?"var(--danger)":lead.score>=40?"var(--warning)":"#7ba7e0"}}>{lead.score}</div>
          </div>
          <div style={{background:"var(--surface2)",borderRadius:8,padding:"10px 12px"}}>
            <div style={{fontSize:10,color:"var(--muted)",marginBottom:2}}>TEMPERATURA</div>
            {readOnly?(
              <div style={{fontSize:13,fontWeight:600,color:"var(--fg)",display:"flex",alignItems:"center",gap:4}}><Temp t={temperaturaAtual}/>{temperaturaAtual}</div>
            ):(
              <select className="form-input" style={{marginBottom:0,fontSize:13,padding:"4px 8px"}} value={temperaturaAtual} disabled={salvandoTemp} onChange={e=>mudarTemperatura(e.target.value)}>
                <option value="quente">Quente</option><option value="morno">Morno</option><option value="frio">Frio</option>
              </select>
            )}
          </div>
        </div>
        {!readOnly&&
          <div className="form-group">
            <label className="form-label">
              Responsável atual
              <i className="ti ti-info-circle" style={{fontSize:12,marginLeft:4,color:"var(--muted)"}}
                 title="Isso só atualiza o indicador no CRM. Não pausa a IA de verdade no WhatsApp — quem controla isso é a transferência real pro atendimento humano."/>
            </label>
            <select className="form-input" value={responsavelAtual} disabled={salvandoResp} onChange={e=>mudarResponsavel(e.target.value)}>
              <option value="ia">IA</option><option value="humano">Humano</option><option value="pausado">Pausado</option>
            </select>
          </div>
        }
        {lead.telefone&&<div style={{marginBottom:14}}><a href={lead.chatwoot_conv_id?`https://chat.laautomoveis.com.br/app/accounts/1/conversations/${lead.chatwoot_conv_id}`:`https://wa.me/55${lead.telefone.replace(/\D/g,"")}`} target="_blank" rel="noopener noreferrer" className="btn-wa"><i className="ti ti-brand-whatsapp"/>{lead.telefone}</a></div>}
        <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:16}}>
          {lead.troca&&<span className="badge badge-warning"><i className="ti ti-arrows-exchange" style={{fontSize:12}}/>Tem troca</span>}
          {lead.financiamento&&<span className="badge badge-brand"><i className="ti ti-credit-card" style={{fontSize:12}}/>Financiamento</span>}
          {lead.origem&&<Orig o={lead.origem}/>}
        </div>
        {lead.followup_tipo&&
          <div style={{marginBottom:14,display:"flex",gap:6,flexWrap:"wrap"}}>
            <div className="badge badge-warning" style={{display:"inline-flex"}}>
              <i className="ti ti-bell" style={{fontSize:12}}/>&nbsp;Follow-up ativo: {FOLLOWUP_LABEL[lead.followup_tipo]}
            </div>
            {followupSemContato(lead)&&
              <div className="badge" style={{display:"inline-flex",background:"var(--danger)22",color:"var(--danger)"}} title="Sem telefone cadastrado — esse follow-up não sai automático, precisa ser feito manualmente">
                <i className="ti ti-phone-off" style={{fontSize:12}}/>&nbsp;Sem contato
              </div>
            }
          </div>
        }
        {!readOnly&&lead.vendedor_id&&(
          <div style={{marginBottom:14}}>
            {agendado?(
              <span className="badge badge-success" style={{display:"inline-flex"}}><i className="ti ti-check" style={{fontSize:12}}/>&nbsp;Lara vai iniciar o agendamento</span>
            ):(
              <button className="btn btn-ghost" style={{width:"100%"}} onClick={handleAgendar} disabled={agendando}>
                {agendando?<span className="spinner"/>:<><i className="ti ti-calendar-plus"/> Agendar visita (Lara conduz pelo WhatsApp)</>}
              </button>
            )}
          </div>
        )}
        <div className="form-group">
          <label className="form-label">Estágio {readOnly?"":"— arraste o card no board pra mudar, ou selecione aqui"}</label>
          {readOnly?(
            <div style={{fontSize:14,fontWeight:600,color:colAtual?.cor||"var(--fg)"}}>{colAtual?.label}</div>
          ):(<>
            <select className="form-input" value={colAtual?.key||est} onChange={e=>handleEstagio(e.target.value)}>
              {estagios.map(e=><option key={e.key} value={e.key}>{e.label}</option>)}
            </select>
          </>)}
        </div>
        <button className="btn btn-ghost" onClick={onClose} style={{width:"100%"}}>Fechar</button>
      </div>
    </div>
  );
}

function NovoModal({onClose,onCriado}){
  // Default "presencial": o botão "Novo lead" existe justamente pro vendedor cadastrar
  // quem chega na loja — o telefone pode não existir ainda, sem WhatsApp coletado.
  const[form,setForm]=useState({nome:"",telefone:"",veiculo_interesse:"",origem:"presencial"});
  const[loading,setLoading]=useState(false);
  const[erro,setErro]=useState(null);
  const set=(k,v)=>setForm(f=>({...f,[k]:v}));
  async function submit(){
    if(!form.nome||!form.veiculo_interesse)return;
    setLoading(true);setErro(null);
    try{await criarLeadCRM(form);onCriado();onClose();}
    catch{setErro("Erro ao criar lead. Tente novamente.");}
    setLoading(false);
  }
  return(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()}>
        <div className="modal-handle"/>
        <div className="modal-header">
          <h2 className="modal-title">Novo lead</h2>
          <button onClick={onClose} style={{background:"none",border:"none",color:"var(--muted)",fontSize:22,cursor:"pointer"}}><i className="ti ti-x"/></button>
        </div>
        <div className="form-group"><label className="form-label">Nome *</label><input className="form-input" value={form.nome} onChange={e=>set("nome",e.target.value)} placeholder="Nome do cliente"/></div>
        <div className="form-group"><label className="form-label">Telefone (opcional)</label><input className="form-input" value={form.telefone} onChange={e=>set("telefone",e.target.value)} placeholder="(49) 9 9999-9999 — deixe em branco se não tiver ainda"/></div>
        <div className="form-group"><label className="form-label">Veículo *</label><input className="form-input" value={form.veiculo_interesse} onChange={e=>set("veiculo_interesse",e.target.value)} placeholder="Ex: HB20 2022"/></div>
        <div className="form-group"><label className="form-label">Origem</label>
          <select className="form-input" value={form.origem} onChange={e=>set("origem",e.target.value)}>
            <option value="presencial">Presencial (loja)</option>
            <option value="organico">Orgânico</option><option value="site">Site</option><option value="anuncio">Anúncio</option>
          </select>
        </div>
        {erro&&<div style={{color:"var(--danger)",fontSize:13,marginBottom:10}}>{erro}</div>}
        <div style={{display:"flex",gap:8}}>
          <button className="btn btn-ghost" onClick={onClose} style={{flex:1}}>Cancelar</button>
          <button className="btn btn-primary" onClick={submit} disabled={loading} style={{flex:1}}>{loading?<span className="spinner"/>:"Adicionar"}</button>
        </div>
      </div>
    </div>
  );
}

export default function CRM(){
  const role=getRole();
  const readOnly=role==="manager";
  // Vendedor vê "Para atender" fundido; owner/manager continuam com o funil completo.
  const estagios=role==="agent"?ESTAGIOS_VENDEDOR:ESTAGIOS_ADMIN;
  const[kanban,setKanban]=useState({});
  const[loading,setLoading]=useState(true);
  const[busca,setBusca]=useState("");
  const[leadSel,setLeadSel]=useState(null);
  const[novoModal,setNovoModal]=useState(false);
  const[isMobile,setIsMobile]=useState(window.innerWidth<768);
  const[erro,setErro]=useState(null);
  const[colunaSobre,setColunaSobre]=useState(null);
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
  // aberto) toda vez que mover um card — antes voltava pro spinner de tela cheia
  // a cada clique. O follow-up automático (estágio-motivo) roda no backend, então
  // um PATCH de estágio já basta pra tudo — arrastar ou usar o dropdown têm o
  // mesmo efeito.
  async function handleMover(id,est,motivo){try{await moverLead(id,est,motivo);}catch{}load(true);}

  const todos=estagios.flatMap(e=>leadsDaColuna(e,kanban));
  const filtrados=todos.filter(l=>!busca||l.nome.toLowerCase().includes(busca.toLowerCase())||l.veiculo_interesse.toLowerCase().includes(busca.toLowerCase()));

  function onCardDragStart(e,lead){
    e.dataTransfer.setData("text/plain",String(lead.id));
    e.dataTransfer.effectAllowed="move";
  }
  function onColDragOver(e,estKey){
    e.preventDefault();
    if(colunaSobre!==estKey)setColunaSobre(estKey);
  }
  function onColDrop(e,estKey){
    e.preventDefault();
    setColunaSobre(null);
    const leadId=e.dataTransfer.getData("text/plain");
    if(!leadId)return;
    // Coluna virtual ("Para atender", vendedor) não é um estagio real — arrastar de
    // volta pra ela manda pro último estagio do grupo (negociando).
    const alvo=estagios.find(e=>e.key===estKey);
    const realKey=alvo?.estagiosDb ? alvo.estagiosDb[alvo.estagiosDb.length-1] : estKey;
    handleMover(leadId,realKey);
  }

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
      <div style={{fontSize:13,color:"var(--muted)",marginBottom:12}}>{todos.length} leads · {filtrados.length} exibidos{!readOnly&&!isMobile&&" · arraste o card pra mudar o estágio"}</div>

      {isMobile?(
        <div className="crm-list">
          {filtrados.length===0&&<div className="empty-state"><i className="ti ti-inbox"/><p>Nenhum lead</p></div>}
          {filtrados.map(lead=>{
            const est=colunaVisual(estagios,lead.estagio);
            return(
              <div key={lead.id} className="crm-list-item" style={{borderLeft:`3px solid ${est?.cor||"var(--border)"}`}} onClick={()=>setLeadSel(lead)}>
                <div style={{flex:1,minWidth:0}}>
                  <div className="crm-list-nome">{lead.nome}</div>
                  <div className="crm-list-sub">{lead.veiculo_interesse} · {est?.label}</div>
                  <div style={{display:"flex",gap:6,marginTop:4,alignItems:"center"}}><Temp t={lead.temperatura}/><Score s={lead.score}/>{lead.origem&&<Orig o={lead.origem}/>}<Resp r={lead.responsavel_atual}/></div>
                  {lead.followup_tipo&&
                    <div style={{fontSize:10,color:followupAtrasado(lead)?"var(--danger)":"var(--warning)",marginTop:4,display:"flex",alignItems:"center",gap:3}}>
                      <i className="ti ti-bell" style={{fontSize:11}}/> {FOLLOWUP_LABEL[lead.followup_tipo]}
                      {followupAtrasado(lead)&&<span style={{width:6,height:6,borderRadius:"50%",background:"var(--danger)",display:"inline-block"}}/>}
                      {followupSemContato(lead)&&<i className="ti ti-phone-off" style={{fontSize:11,color:"var(--danger)"}} title="Sem telefone — follow-up manual"/>}
                    </div>
                  }
                </div>
                <div className="av" style={{background:`${AV[lead.vendedor_iniciais]||"#C8A84B"}22`,color:AV[lead.vendedor_iniciais]||"#C8A84B",fontSize:10}}>{lead.vendedor_iniciais}</div>
              </div>
            );
          })}
        </div>
      ):(
        <div className="kanban-board" ref={boardRef}>
          {estagios.map(est=>{
            const leads=leadsDaColuna(est,kanban).filter(l=>!busca||l.nome.toLowerCase().includes(busca.toLowerCase())||l.veiculo_interesse.toLowerCase().includes(busca.toLowerCase()));
            return(
              <div key={est.key} className="kanban-col">
                <div className="kanban-col-header" style={{border:`3px solid ${est.cor}`,borderBottom:"none"}}>
                  <span className="kanban-col-title">{est.label}</span>
                  <span className="kanban-col-count">{leads.length}</span>
                </div>
                <div
                  className="kanban-cards"
                  style={{
                    border:`3px solid ${est.cor}`,borderTop:"none",
                    ...(colunaSobre===est.key?{outline:`2px dashed ${est.cor}`,outlineOffset:-2}:{}),
                  }}
                  onDragOver={readOnly?undefined:e=>onColDragOver(e,est.key)}
                  onDragLeave={readOnly?undefined:()=>setColunaSobre(null)}
                  onDrop={readOnly?undefined:e=>onColDrop(e,est.key)}
                >
                  {leads.length===0&&<div style={{textAlign:"center",color:"var(--muted)",fontSize:12,padding:"12px 0"}}>—</div>}
                  {leads.map(lead=>(
                    <div
                      key={lead.id}
                      className="kanban-card"
                      draggable={!readOnly}
                      onDragStart={readOnly?undefined:e=>onCardDragStart(e,lead)}
                      onClick={()=>setLeadSel(lead)}
                      style={{cursor:readOnly?"pointer":"grab"}}
                    >
                      <div className="kanban-card-nome">{lead.nome}</div>
                      <div className="kanban-card-veiculo">{lead.veiculo_interesse}</div>
                      {lead.followup_tipo&&
                        <div style={{fontSize:10,color:followupAtrasado(lead)?"var(--danger)":"var(--warning)",marginBottom:4,display:"flex",alignItems:"center",gap:3}}>
                          <i className="ti ti-bell" style={{fontSize:11}}/> {FOLLOWUP_LABEL[lead.followup_tipo]}
                          {followupAtrasado(lead)&&<span style={{width:6,height:6,borderRadius:"50%",background:"var(--danger)",display:"inline-block"}} title="Follow-up atrasado"/>}
                          {followupSemContato(lead)&&<i className="ti ti-phone-off" style={{fontSize:11,color:"var(--danger)"}} title="Sem telefone — follow-up manual"/>}
                        </div>
                      }
                      <div style={{display:"flex",gap:4,alignItems:"center",marginBottom:4}}>
                        <Resp r={lead.responsavel_atual}/>
                        <span style={{fontSize:9,color:"var(--muted)"}}><i className="ti ti-clock" style={{fontSize:10}}/> {tempoDesde(lead.atualizado_em)}</span>
                      </div>
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

      {leadSel&&<LeadModal lead={leadSel} onClose={()=>setLeadSel(null)} onMover={(id,est,motivo)=>{handleMover(id,est,motivo);setLeadSel(null);}} onAtualizado={()=>load(true)} readOnly={readOnly} estagios={estagios}/>}
      {!readOnly&&novoModal&&<NovoModal onClose={()=>setNovoModal(false)} onCriado={()=>{load();setNovoModal(false);}}/>}
    </div>
  );
}
