import { useState, useEffect } from "react";
import { getAgenda, criarAgendamento, atualizarStatusAgendamento, reagendarAgendamento, pedirReagendamentoLara, getResumoMes, getHorarios, criarHorario, removerHorario, getBloqueiosRecorrentes, criarBloqueioRecorrente, removerBloqueioRecorrente } from "../api.js";
import { api as veiculosApi } from "../lib/api.js";
import { isManager, getUser, getRole } from "../auth.js";
import { LeadPhoneChatwoot, ChatwootLink } from "../components/ChatwootLink.jsx";

const ESTAGIOS_NAO_COMPROU=[
  {key:"sem_credito",label:"Sem crédito"},
  {key:"vai_pensar",label:"Vai pensar"},
  {key:"nao_achou_carro",label:"Não achou o carro"},
  {key:"carros_baratos",label:"Carros baratos"},
  {key:"parou_responder",label:"Parou de responder"},
];

// Data local (YYYY-MM-DD) — nunca usar toISOString().split("T")[0] aqui: perto da
// meia-noite em UTC-3 o UTC já virou o dia seguinte e a data sai errada.
function dataLocalISO(d){
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

// Acha o veículo do estoque que bate com o texto livre do agendamento (ex: "Onix 2019"),
// pra linkar direto na tela de edição dele no lembrete de "Venda feita". Best-effort —
// se não achar, o lembrete ainda aparece, só sem o link direto.
function acharVeiculo(veiculos,textoLivre){
  if(!textoLivre)return null;
  const alvo=textoLivre.toLowerCase();
  return veiculos.find(v=>alvo.includes(v.modelo.toLowerCase()))||null;
}

const DIAS_SEMANA=["Domingo","Segunda","Terça","Quarta","Quinta","Sexta","Sábado"];

function HorariosModal({onClose}){
  const[horarios,setHorarios]=useState([]);
  const[loading,setLoading]=useState(true);
  const[form,setForm]=useState({dia_semana:1,hora_inicio:"18:00",hora_fim:"20:00"});
  const set=(k,v)=>setForm(f=>({...f,[k]:v}));

  function load(){getHorarios().then(h=>{setHorarios(h);setLoading(false);}).catch(()=>setLoading(false));}
  useEffect(()=>{load();},[]);

  async function add(){try{await criarHorario(form);}catch{}load();}
  async function remove(id){try{await removerHorario(id);}catch{}load();}

  return(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()}>
        <div className="modal-handle"/>
        <div className="modal-header"><h2 className="modal-title">Meus horários</h2><button onClick={onClose} style={{background:"none",border:"none",color:"var(--muted)",fontSize:22,cursor:"pointer"}}><i className="ti ti-x"/></button></div>
        <div style={{fontSize:12,color:"var(--muted)",marginBottom:12}}>Horário padrão comercial + qualquer horário extra que você queira oferecer pra agendamento de visitas.</div>
        {loading?<p style={{fontSize:13,color:"var(--muted)"}}>Carregando...</p>:(
          <div style={{marginBottom:14}}>
            {DIAS_SEMANA.map((nome,dia)=>{
              const doDia=horarios.filter(h=>h.dia_semana===dia);
              if(!doDia.length)return null;
              return(
                <div key={dia} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 0",borderBottom:"1px solid var(--border)"}}>
                  <span style={{fontSize:12,color:"var(--muted)",minWidth:70}}>{nome}</span>
                  <div style={{flex:1,display:"flex",flexWrap:"wrap",gap:6}}>
                    {doDia.map(h=>(
                      <span key={h.id} className={`badge ${h.padrao?"badge-brand":"badge-warning"}`} style={{fontSize:11,display:"inline-flex",alignItems:"center",gap:4}}>
                        {h.hora_inicio.slice(0,5)}–{h.hora_fim.slice(0,5)}
                        <i className="ti ti-x" style={{fontSize:11,cursor:"pointer"}} onClick={()=>remove(h.id)}/>
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <div className="form-label" style={{marginBottom:6}}>Adicionar horário extra</div>
        <div className="form-grid">
          <div className="form-group"><label className="form-label">Dia</label><select className="form-input" value={form.dia_semana} onChange={e=>set("dia_semana",+e.target.value)}>{DIAS_SEMANA.map((n,i)=><option key={i} value={i}>{n}</option>)}</select></div>
          <div className="form-group"><label className="form-label">Início</label><input className="form-input" type="time" value={form.hora_inicio} onChange={e=>set("hora_inicio",e.target.value)}/></div>
          <div className="form-group"><label className="form-label">Fim</label><input className="form-input" type="time" value={form.hora_fim} onChange={e=>set("hora_fim",e.target.value)}/></div>
        </div>
        <div style={{display:"flex",gap:8}}><button className="btn btn-ghost" onClick={onClose} style={{flex:1}}>Fechar</button><button className="btn btn-primary" onClick={add} style={{flex:1}}><i className="ti ti-plus"/> Adicionar</button></div>
      </div>
    </div>
  );
}

// "Ocupado" (compromisso de outro vendedor) e "Bloqueio" (almoço/recorrente) agora
// renderizam direto como bloco compacto dentro de GradeHorarios (mais abaixo) — não
// precisam mais do card full-width que tinham na lista antiga.

const DIAS_CURTO=["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];
const DIAS_UTEIS=[1,2,3,4,5];

function somaMin(horario,min){
  const[h,m]=horario.split(":").map(Number);
  const total=h*60+m+min;
  const hh=Math.floor((total/60)%24), mm=total%60;
  return `${String(hh).padStart(2,"0")}:${String(mm).padStart(2,"0")}`;
}

function BloqueioModal({onClose,onCriado}){
  const[form,setForm]=useState({data:dataLocalISO(new Date()),horario:"12:00",duracao_min:60,observacoes:"Almoço"});
  const[recorrente,setRecorrente]=useState(false);
  const[diasSemana,setDiasSemana]=useState(DIAS_UTEIS);
  const[existentes,setExistentes]=useState([]);
  const[loadingExistentes,setLoadingExistentes]=useState(true);
  const set=(k,v)=>setForm(f=>({...f,[k]:v}));

  function loadExistentes(){
    getBloqueiosRecorrentes().then(r=>{setExistentes(r);setLoadingExistentes(false);}).catch(()=>setLoadingExistentes(false));
  }
  useEffect(()=>{loadExistentes();},[]);

  function toggleDia(d){
    setDiasSemana(ds=>ds.includes(d)?ds.filter(x=>x!==d):[...ds,d].sort());
  }
  async function submit(){
    if(recorrente){
      if(!diasSemana.length)return;
      const hora_fim=somaMin(form.horario,form.duracao_min);
      try{await criarBloqueioRecorrente({dias_semana:diasSemana,hora_inicio:form.horario,hora_fim,motivo:form.observacoes});}catch{}
    }else{
      const data_hora=`${form.data}T${form.horario}:00`;
      try{await criarAgendamento({tipo:"bloqueio",data_hora,duracao_min:form.duracao_min,observacoes:form.observacoes});}catch{}
    }
    onCriado();onClose();
  }
  async function removerExistente(id){
    try{await removerBloqueioRecorrente(id);}catch{}
    loadExistentes();onCriado();
  }
  return(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()}>
        <div className="modal-handle"/>
        <div className="modal-header"><h2 className="modal-title">Bloquear horário</h2><button onClick={onClose} style={{background:"none",border:"none",color:"var(--muted)",fontSize:22,cursor:"pointer"}}><i className="ti ti-x"/></button></div>

        {!loadingExistentes&&existentes.length>0&&(
          <div style={{marginBottom:14}}>
            <div className="form-label" style={{marginBottom:6}}>Bloqueios recorrentes ativos</div>
            {existentes.map(b=>(
              <div key={b.id} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 0",borderBottom:"1px solid var(--border)"}}>
                <span className="badge badge-warning" style={{fontSize:11,display:"inline-flex",alignItems:"center",gap:4}}>
                  <i className="ti ti-repeat" style={{fontSize:11}}/> {b.hora_inicio.slice(0,5)}–{b.hora_fim.slice(0,5)}
                </span>
                <span style={{fontSize:12,color:"var(--muted)",flex:1}}>
                  {b.dias_semana.map(d=>DIAS_CURTO[d]).join(", ")} · {b.motivo}
                </span>
                <i className="ti ti-x" style={{fontSize:14,cursor:"pointer",color:"var(--muted)"}} onClick={()=>removerExistente(b.id)}/>
              </div>
            ))}
          </div>
        )}

        <label style={{display:"flex",alignItems:"center",gap:8,marginBottom:14,cursor:"pointer",fontSize:13}}>
          <input type="checkbox" checked={recorrente} onChange={e=>setRecorrente(e.target.checked)}/>
          Repetir toda semana (ex: horário de almoço)
        </label>

        {recorrente?(
          <div className="form-group">
            <label className="form-label">Dias da semana</label>
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              {DIAS_CURTO.map((n,i)=>(
                <span key={i} className={`badge ${diasSemana.includes(i)?"badge-brand":""}`} style={{cursor:"pointer",padding:"6px 10px",border:diasSemana.includes(i)?"none":"1px solid var(--border)"}} onClick={()=>toggleDia(i)}>{n}</span>
              ))}
            </div>
          </div>
        ):(
          <div className="form-group"><label className="form-label">Data</label><input className="form-input" type="date" value={form.data} onChange={e=>set("data",e.target.value)} min={dataLocalISO(new Date())}/></div>
        )}
        <div className="form-grid">
          <div className="form-group"><label className="form-label">Horário {recorrente?"de início":""}</label><input className="form-input" type="time" value={form.horario} onChange={e=>set("horario",e.target.value)}/></div>
          <div className="form-group"><label className="form-label">Duração</label><select className="form-input" value={form.duracao_min} onChange={e=>set("duracao_min",+e.target.value)}><option value={30}>30 min</option><option value={60}>1 hora</option><option value={90}>1h30</option><option value={120}>2 horas</option><option value={240}>4 horas</option></select></div>
        </div>
        <div className="form-group"><label className="form-label">Motivo</label><input className="form-input" value={form.observacoes} onChange={e=>set("observacoes",e.target.value)} placeholder="Ex: Almoço, compromisso pessoal"/></div>
        <div style={{display:"flex",gap:8}}><button className="btn btn-ghost" onClick={onClose} style={{flex:1}}>Cancelar</button><button className="btn btn-primary" onClick={submit} style={{flex:1}}><i className="ti ti-lock"/> Bloquear</button></div>
      </div>
    </div>
  );
}

const TIPOS={test_drive:{label:"Test drive",icon:"ti-car",cor:"#C8A84B"},visita_patio:{label:"Visita ao pátio",icon:"ti-building-store",cor:"#2980B9"},apresentacao:{label:"Apresentação",icon:"ti-clipboard-list",cor:"#27AE60"},reuniao_fechamento:{label:"Reunião de fechamento",icon:"ti-heart-handshake",cor:"#8E44AD"},visita_mencionada:{label:"Visita mencionada",icon:"ti-message-circle",cor:"#16A085"},lembrete_vai_pensar:{label:"Retomar contato",icon:"ti-bell",cor:"#E67E22"}};
const SBORDA={confirmado:"var(--success)",pendente:"var(--warning)",em_breve:"var(--brand)",realizado:"var(--muted)",cancelado:"var(--danger)",nao_compareceu:"#e67e22",aguardando_reagendamento_lara:"var(--brand)",intencao:"#16A085"};

function fmtH(iso){const d=new Date(iso);return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;}
function fmtHF(iso,dur){const d=new Date(iso);d.setMinutes(d.getMinutes()+dur);return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;}
function fmtDia(d){const ds=["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];return `${ds[d.getDay()]} ${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}`;}
function mesmoDia(a,b){return a.toDateString()===b.toDateString();}
function minAte(iso){return Math.round((new Date(iso)-Date.now())/60000);}
function getStatus(ag){const m=minAte(ag.data_hora);if(ag.status==="confirmado"&&m>0&&m<=30)return "em_breve";return ag.status;}

// ── Grade de horários (estilo Google Agenda) ──
// Eixo vertical de horas com os compromissos posicionados/dimensionados pelo horário
// real, em vez da lista plana de cards agrupada só em "manhã"/"tarde" que existia
// antes. 1px = 1min (GRID_PX_HORA=60), evita depender de lib de calendário externa —
// o resto do painel também é tudo componente próprio.
const GRID_H_INICIO=7, GRID_H_FIM=21, GRID_PX_HORA=60;
function minutosNoGrid(iso){
  const d=new Date(iso);
  return Math.max(0,Math.min((GRID_H_FIM-GRID_H_INICIO)*60,(d.getHours()-GRID_H_INICIO)*60+d.getMinutes()));
}
// Empacota compromissos que se sobrepõem em colunas lado a lado (mesma ideia do
// Google Agenda pra 2 reuniões no mesmo horário) — aproximação simples (1 grupo de
// colunas pro dia inteiro, não por cluster de sobreposição), suficiente pro volume
// real de agendamentos de uma revenda (poucos por dia, conflito é exceção).
function atribuirColunas(itens){
  const ordenados=[...itens].sort((a,b)=>a._ini-b._ini);
  const finalColuna=[];
  const comColuna=ordenados.map(it=>{
    let col=finalColuna.findIndex(fim=>fim<=it._ini);
    if(col===-1){col=finalColuna.length;finalColuna.push(it._fim);}
    else finalColuna[col]=it._fim;
    return {...it,_col:col};
  });
  const totalCols=finalColuna.length||1;
  return comColuna.map(it=>({...it,_totalCols:totalCols}));
}

function GradeHorarios({doDia,onAbrirAg}){
  const alturaGrid=(GRID_H_FIM-GRID_H_INICIO)*GRID_PX_HORA;
  const horas=Array.from({length:GRID_H_FIM-GRID_H_INICIO+1},(_,i)=>GRID_H_INICIO+i);
  const itens=atribuirColunas(doDia.filter(ag=>ag.status!=="cancelado").map(ag=>({
    ag,
    _ini:minutosNoGrid(ag.data_hora),
    _fim:minutosNoGrid(ag.data_hora)+((ag.duracao_min||30)*(GRID_PX_HORA/60)),
  })));
  const agora=new Date();
  const linhaAgoraTop=mesmoDia(agora,new Date())?( (agora.getHours()-GRID_H_INICIO)*60+agora.getMinutes() ):null;
  return(
    <div className="time-grid-wrap">
      <div className="time-grid" style={{height:alturaGrid}}>
        {horas.map(h=>(
          <div key={h} className="time-grid-row" style={{top:(h-GRID_H_INICIO)*GRID_PX_HORA}}>
            <span className="time-grid-label">{String(h).padStart(2,"0")}:00</span>
          </div>
        ))}
        <div className="time-grid-content">
          {linhaAgoraTop!==null&&linhaAgoraTop>=0&&linhaAgoraTop<=alturaGrid&&
            <div className="time-grid-now" style={{top:linhaAgoraTop}}/>}
          {itens.map(({ag,_ini,_fim,_col,_totalCols})=>{
            const altura=Math.max(_fim-_ini,22);
            const largura=`calc((100% - 8px) / ${_totalCols})`;
            const esquerda=`calc(${_col} * (100% - 8px) / ${_totalCols} + 8px)`;
            if(ag.ocupado){
              return <div key={ag.id} className="time-grid-block ocupado" style={{top:_ini,height:altura,left:esquerda,width:largura}} title="Ocupado">Ocupado</div>;
            }
            if(ag.tipo==="bloqueio"){
              return <div key={ag.id} className="time-grid-block bloqueio" style={{top:_ini,height:altura,left:esquerda,width:largura}} title={ag.observacoes||"Bloqueado"}>
                <i className={`ti ${ag.recorrente?"ti-repeat":"ti-lock"}`} style={{fontSize:11}}/> {ag.observacoes||"Bloqueado"}
              </div>;
            }
            const tipo=TIPOS[ag.tipo]||{icon:"ti-calendar",cor:"var(--muted)"};
            const status=getStatus(ag);
            return(
              <button key={ag.id} className="time-grid-block ag" onClick={()=>onAbrirAg(ag)}
                style={{top:_ini,height:altura,left:esquerda,width:largura,borderLeftColor:SBORDA[status]||tipo.cor,background:`${tipo.cor}1c`}}>
                <span className="time-grid-block-hora">{fmtH(ag.data_hora)}</span>
                <span className="time-grid-block-nome"><i className={`ti ${tipo.icon}`}/> {ag.cliente_nome}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function AgendaCard({ag,onStatus,onReagendar,onReagendarLara,onVendaFeita,readOnly}){
  const status=getStatus(ag);
  const tipo=TIPOS[ag.tipo]||{label:ag.tipo,icon:"ti-calendar",cor:"var(--muted)"};
  const min=minAte(ag.data_hora);
  const[escolhendoReagendar,setEscolhendoReagendar]=useState(false);
  const[reagendando,setReagendando]=useState(false);
  const[escolhendoMotivo,setEscolhendoMotivo]=useState(false);
  // Veículo vendido (2026-07-31, auditoria dashboard): "Comprou" fechava a venda sem
  // nunca pedir qual veículo — era o principal caminho real de fechamento (mais usado
  // que o dropdown do CRM) e por isso o motivo de 100% das vendas reais estarem sem
  // veiculo_vendido_id/valor, zerando o ticket médio do Dashboard. Backend
  // (estagioLead.js) auto-preenche crm_leads.valor a partir do preço de tabela quando
  // recebe esse id — opcional, "Confirmar sem vincular" ainda fecha a venda normalmente.
  const[escolhendoVeiculoVenda,setEscolhendoVeiculoVenda]=useState(false);
  const[veiculosEstoque,setVeiculosEstoque]=useState(null);
  const[veiculoVendaId,setVeiculoVendaId]=useState("");
  const[pedidoLaraEnviado,setPedidoLaraEnviado]=useState(false);
  const iso=new Date(ag.data_hora);
  const[novaData,setNovaData]=useState(dataLocalISO(iso));
  const[novoHorario,setNovoHorario]=useState(`${String(iso.getHours()).padStart(2,"0")}:${String(iso.getMinutes()).padStart(2,"0")}`);
  const[erroReagendar,setErroReagendar]=useState("");
  const[foraHorarioReagendar,setForaHorarioReagendar]=useState(false);
  const[confirmarForaHorario,setConfirmarForaHorario]=useState(false);
  async function confirmarReagendar(){
    setErroReagendar("");
    try{
      await onReagendar(ag.id,`${novaData}T${novoHorario}:00`,confirmarForaHorario);
      setReagendando(false);setForaHorarioReagendar(false);setConfirmarForaHorario(false);
    }catch(e){
      if(e.body?.fora_horario){setForaHorarioReagendar(true);setErroReagendar(e.message);}
      else setErroReagendar(e.message||"Erro ao reagendar. Tente de novo.");
    }
  }
  function pedirLara(){
    onReagendarLara(ag.id);
    setEscolhendoReagendar(false);
    setPedidoLaraEnviado(true);
  }
  function confirmarNaoComprou(estagio){
    onStatus(ag.id,"realizado_nao_comprou",estagio);
    setEscolhendoMotivo(false);
  }
  function abrirEscolhaVeiculoVenda(){
    setEscolhendoVeiculoVenda(true);
    if(!veiculosEstoque)veiculosApi.getVeiculos().then(setVeiculosEstoque).catch(()=>setVeiculosEstoque([]));
  }
  function confirmarComprou(){
    onStatus(ag.id,"realizado_comprou",undefined,veiculoVendaId||undefined);
    setEscolhendoVeiculoVenda(false);
    onVendaFeita(ag);
  }
  return(
    <div className={`agenda-card ${status}`} style={{borderLeftColor:SBORDA[status]}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
        <span style={{fontSize:16,fontWeight:700,color:"var(--fg)"}}>
          {fmtH(ag.data_hora)} — {fmtHF(ag.data_hora,ag.duracao_min)}
          {status==="em_breve"&&<span style={{fontSize:11,color:"var(--brand)",marginLeft:8}}><i className="ti ti-alert-triangle"/> EM {min} MIN</span>}
        </span>
        <div style={{width:28,height:28,borderRadius:"50%",background:"var(--brand-soft)",color:"var(--brand)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700}}>{ag.vendedor_iniciais}</div>
      </div>
      <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap",marginBottom:8}}>
        <span className="tone" style={{fontSize:11,padding:"3px 10px",borderRadius:99,background:`${tipo.cor}22`,color:tipo.cor,display:"inline-block"}}><i className={`ti ${tipo.icon}`}/> {tipo.label}</span>
        {/* 2026-07-28: quem agendou — vendedor no painel vs Lara/Larissa durante a
            conversa de WhatsApp (agenda.origem, ver backend). */}
        {ag.origem==="ia"?(
          <span style={{fontSize:11,color:"var(--muted)",display:"inline-flex",alignItems:"center",gap:3}}><i className="ti ti-robot" style={{fontSize:12}}/> Agendado pela IA no WhatsApp</span>
        ):ag.origem==="manual"&&ag.vendedor_nome?(
          <span style={{fontSize:11,color:"var(--muted)"}}>Agendado por {ag.vendedor_nome}</span>
        ):null}
      </div>
      <div style={{fontSize:15,fontWeight:600,color:"var(--fg)",marginBottom:2}}>{ag.cliente_nome}</div>
      <div style={{fontSize:13,color:"var(--muted)",marginBottom:8}}>{ag.veiculo}</div>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:ag.observacoes?8:10,flexWrap:"wrap"}}>
        <span style={{fontSize:13,color:"var(--muted)",whiteSpace:"nowrap"}}><i className="ti ti-device-mobile"/> {ag.cliente_tel}</span>
        {ag.lead_id?(
          <LeadPhoneChatwoot
            lead={{id:ag.lead_id,telefone:ag.cliente_tel,chatwoot_conv_id:ag.chatwoot_conv_id,chatwoot_inbox_id:ag.chatwoot_inbox_id}}
            style={{padding:"4px 10px"}}
          >
            Chatwoot
          </LeadPhoneChatwoot>
        ):ag.chatwoot_conv_id?(
          <ChatwootLink conv_id={ag.chatwoot_conv_id} inbox_id={ag.chatwoot_inbox_id} style={{padding:"4px 10px"}}>Chatwoot</ChatwootLink>
        ):null}
      </div>
      {ag.observacoes&&<div style={{fontSize:12,color:"var(--muted)",fontStyle:"italic",marginBottom:10,padding:"6px 8px",background:"var(--surface2)",borderRadius:6}}>{ag.observacoes}</div>}
      {status==="aguardando_reagendamento_lara"&&!pedidoLaraEnviado&&<div style={{fontSize:12,color:"var(--brand)",marginBottom:10,padding:"6px 8px",background:"var(--surface2)",borderRadius:6}}><i className="ti ti-robot"/> Aguardando a Lara remarcar com o cliente pelo WhatsApp...</div>}
      {pedidoLaraEnviado&&<div style={{fontSize:12,color:"var(--brand)",marginBottom:10,padding:"6px 8px",background:"var(--surface2)",borderRadius:6}}><i className="ti ti-robot"/> Pedido enviado! A Lara vai negociar um novo horário com o cliente.</div>}
      {escolhendoReagendar&&(
        <div style={{marginBottom:10,padding:"8px",background:"var(--surface2)",borderRadius:6}}>
          <div style={{fontSize:12,color:"var(--muted)",marginBottom:6}}>Como reagendar?</div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            <button className="btn btn-ghost" style={{fontSize:12,padding:"6px 10px"}} onClick={()=>{setReagendando(true);setEscolhendoReagendar(false);}}><i className="ti ti-calendar-time"/> Escolher novo horário agora</button>
            <button className="btn btn-ghost" style={{fontSize:12,padding:"6px 10px"}} onClick={pedirLara}><i className="ti ti-robot"/> Pedir pra Lara reagendar com o cliente</button>
            <button className="btn btn-ghost" style={{fontSize:12,padding:"6px 10px"}} onClick={()=>setEscolhendoReagendar(false)}>Cancelar</button>
          </div>
        </div>
      )}
      {reagendando&&(
        <div style={{marginBottom:10,padding:"8px",background:"var(--surface2)",borderRadius:6}}>
          <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
            <input className="form-input" type="date" style={{marginBottom:0,fontSize:12,flex:1,minWidth:120}} value={novaData} onChange={e=>{setNovaData(e.target.value);setForaHorarioReagendar(false);setConfirmarForaHorario(false);}}/>
            <input className="form-input" type="time" style={{marginBottom:0,fontSize:12,flex:1,minWidth:90}} value={novoHorario} onChange={e=>{setNovoHorario(e.target.value);setForaHorarioReagendar(false);setConfirmarForaHorario(false);}}/>
            <button className="btn btn-primary" style={{fontSize:12,padding:"6px 10px"}} onClick={confirmarReagendar} disabled={foraHorarioReagendar&&!confirmarForaHorario}>Confirmar</button>
            <button className="btn btn-ghost" style={{fontSize:12,padding:"6px 10px"}} onClick={()=>{setReagendando(false);setErroReagendar("");setForaHorarioReagendar(false);}}>Cancelar</button>
          </div>
          {erroReagendar&&<div style={{color:foraHorarioReagendar?"var(--warning)":"var(--danger)",fontSize:12,marginTop:8}}><i className="ti ti-alert-triangle" style={{fontSize:13}}/> {erroReagendar}</div>}
          {foraHorarioReagendar&&<label style={{display:"flex",alignItems:"flex-start",gap:6,marginTop:6,fontSize:12,color:"var(--fg)",cursor:"pointer"}}>
            <input type="checkbox" checked={confirmarForaHorario} onChange={e=>setConfirmarForaHorario(e.target.checked)} style={{marginTop:2}}/>
            Reagendar mesmo assim, fora do horário padrão
          </label>}
        </div>
      )}
      {escolhendoMotivo&&(
        <div style={{marginBottom:10,padding:"8px",background:"var(--surface2)",borderRadius:6}}>
          <div style={{fontSize:12,color:"var(--muted)",marginBottom:6}}>Qual o motivo real?</div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            {ESTAGIOS_NAO_COMPROU.map(e=>(
              <button key={e.key} className="btn btn-ghost" style={{fontSize:12,padding:"6px 10px"}} onClick={()=>confirmarNaoComprou(e.key)}>{e.label}</button>
            ))}
            <button className="btn btn-ghost" style={{fontSize:12,padding:"6px 10px"}} onClick={()=>setEscolhendoMotivo(false)}>Cancelar</button>
          </div>
        </div>
      )}
      {escolhendoVeiculoVenda&&(
        <div style={{marginBottom:10,padding:"8px",background:"var(--surface2)",borderRadius:6}}>
          <div style={{fontSize:12,color:"var(--muted)",marginBottom:6}}>Qual veículo do estoque foi vendido? (opcional, mas ajuda a fechar o histórico certo)</div>
          {veiculosEstoque===null?(
            <div style={{fontSize:12,color:"var(--muted)"}}><span className="spinner" style={{marginRight:6}}/>Carregando estoque...</div>
          ):(
            <select className="form-input" style={{marginBottom:6,fontSize:12}} value={veiculoVendaId} onChange={e=>setVeiculoVendaId(e.target.value)}>
              <option value="">— não vincular a um veículo específico —</option>
              {veiculosEstoque.map(v=><option key={v.id} value={v.id}>{v.marca} {v.modelo} {v.ano}</option>)}
            </select>
          )}
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            <button className="btn btn-primary" style={{fontSize:12,padding:"6px 10px"}} onClick={confirmarComprou}>Confirmar venda</button>
            <button className="btn btn-ghost" style={{fontSize:12,padding:"6px 10px"}} onClick={()=>{setEscolhendoVeiculoVenda(false);setVeiculoVendaId("");}}>Cancelar</button>
          </div>
        </div>
      )}
      {!readOnly&&<div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
        {ag.status==="pendente"&&<button className="btn btn-ghost" style={{fontSize:12,padding:"6px 12px",color:"var(--success)",borderColor:"var(--success-line)"}} onClick={()=>onStatus(ag.id,"confirmado")}><i className="ti ti-check"/> Confirmar</button>}
        {(ag.status==="confirmado"||ag.status==="pendente")&&<button className="btn btn-danger" style={{fontSize:12,padding:"6px 12px"}} onClick={()=>onStatus(ag.id,"cancelado")}><i className="ti ti-x"/> Cancelar</button>}
        {ag.status==="confirmado"&&new Date(ag.data_hora)<new Date()&&!reagendando&&!escolhendoMotivo&&!escolhendoReagendar&&!escolhendoVeiculoVenda&&<>
          <button className="btn btn-ghost" style={{fontSize:12,padding:"6px 12px"}} onClick={()=>setEscolhendoReagendar(true)}><i className="ti ti-calendar-time"/> Reagendar</button>
          <button className="btn btn-ghost" style={{fontSize:12,padding:"6px 12px",color:"var(--success)",borderColor:"var(--success-line)"}} onClick={abrirEscolhaVeiculoVenda}><i className="ti ti-check"/> Veio e comprou</button>
          <button className="btn btn-ghost" style={{fontSize:12,padding:"6px 12px",color:"var(--warning)",borderColor:"rgba(230,126,34,.3)"}} onClick={()=>setEscolhendoMotivo(true)}><i className="ti ti-mood-sad"/> Veio e não comprou</button>
          {/* 2026-07-15: "não veio" (no-show) tinha o MESMO status de "cancelado" (cancelamento
              prévio) — impossível medir taxa de comparecimento porque os dois casos ficavam
              indistinguíveis no banco. Status próprio agora (nao_compareceu), sem mover o
              estágio do lead automaticamente (mesmo comportamento que cancelado já tinha —
              o vendedor decide separado o que fazer com o lead). */}
          <button className="btn btn-danger" style={{fontSize:12,padding:"6px 12px"}} onClick={()=>onStatus(ag.id,"nao_compareceu")}><i className="ti ti-user-x"/> Não veio</button>
        </>}
      </div>}
    </div>
  );
}

function NovoModal({onClose,onCriado,dataInicial}){
  const user=getUser();
  // 2026-07-28: antes o dropdown de vendedor era uma lista fixa de 3 nomes (só loja 1)
  // e mandava vendedor_nome pro backend — que só lê vendedor_id (agenda.js:304), então
  // pra loja 2 (Guilherme/Matheus/Daniel) o vendedor nem aparecia na lista, e mesmo pra
  // loja 1 o agendamento criado por um gerente/admin ficava sem vendedor_id de verdade.
  // Agora busca a lista real de vendedores (mesma rota já loja-scoped que Equipe/
  // Disparador usam) e manda o id.
  const[vendedores,setVendedores]=useState([]);
  useEffect(()=>{if(isManager())veiculosApi.getUsers().then(u=>setVendedores((u||[]).filter(x=>x.role==="vendedor"))).catch(()=>{});},[]);
  const[form,setForm]=useState({cliente_nome:"",cliente_tel:"",veiculo:"",tipo:"test_drive",data:dataInicial||dataLocalISO(new Date()),horario:"09:00",duracao_min:45,vendedor_id:isManager()?"":user?.id,observacoes:""});
  const set=(k,v)=>setForm(f=>({...f,[k]:v}));
  function slots(){const d=new Date(form.data+"T12:00:00");const dow=d.getDay();if(dow===0)return[];const fim=dow===6?12:18;const s=[];for(let h=8;h<fim;h++){s.push(`${String(h).padStart(2,"0")}:00`);s.push(`${String(h).padStart(2,"0")}:30`);}return s;}
  const[erro,setErro]=useState("");
  const[foraHorario,setForaHorario]=useState(false);
  const[confirmarMesmoAssim,setConfirmarMesmoAssim]=useState(false);
  const[salvando,setSalvando]=useState(false);
  async function submit(){
    if(!form.cliente_nome||!form.veiculo)return;
    setErro("");setSalvando(true);
    const data_hora=`${form.data}T${form.horario}:00`;
    try{
      await criarAgendamento({...form,data_hora,ignorar_horario:confirmarMesmoAssim});
      onCriado();onClose();
    }catch(e){
      // fora_horario (409): almoço/fora do expediente — mostra o motivo real e oferece
      // "agendar mesmo assim" em vez de falhar calado (comportamento antigo engolia
      // qualquer erro e fechava o modal como se tivesse dado certo).
      if(e.body?.fora_horario){setForaHorario(true);setErro(e.message);}
      else setErro(e.message||"Erro ao criar agendamento. Tente de novo.");
    }
    setSalvando(false);
  }
  return(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()}>
        <div className="modal-handle"/>
        <div className="modal-header"><h2 className="modal-title">Novo agendamento</h2><button onClick={onClose} style={{background:"none",border:"none",color:"var(--muted)",fontSize:22,cursor:"pointer"}}><i className="ti ti-x"/></button></div>
        <div className="form-group"><label className="form-label">Cliente *</label><input className="form-input" value={form.cliente_nome} onChange={e=>set("cliente_nome",e.target.value)} placeholder="Nome do cliente"/></div>
        <div className="form-group"><label className="form-label">Telefone</label><input className="form-input" value={form.cliente_tel} onChange={e=>set("cliente_tel",e.target.value)} placeholder="49999999999"/></div>
        <div className="form-group"><label className="form-label">Veículo *</label><input className="form-input" value={form.veiculo} onChange={e=>set("veiculo",e.target.value)} placeholder="Ex: HB20 2022"/></div>
        <div className="form-grid">
          <div className="form-group"><label className="form-label">Tipo</label><select className="form-input" value={form.tipo} onChange={e=>set("tipo",e.target.value)}>{Object.entries(TIPOS).filter(([k])=>k!=="lembrete_vai_pensar").map(([k,v])=><option key={k} value={k}>{v.label}</option>)}</select></div>
          <div className="form-group"><label className="form-label">Duração</label><select className="form-input" value={form.duracao_min} onChange={e=>set("duracao_min",+e.target.value)}><option value={30}>30 min</option><option value={45}>45 min</option><option value={60}>1 hora</option><option value={90}>1h30</option></select></div>
          <div className="form-group"><label className="form-label">Data</label><input className="form-input" type="date" value={form.data} onChange={e=>{set("data",e.target.value);setForaHorario(false);setConfirmarMesmoAssim(false);}} min={dataLocalISO(new Date())}/></div>
          <div className="form-group"><label className="form-label">Horário</label><select className="form-input" value={form.horario} onChange={e=>{set("horario",e.target.value);setForaHorario(false);setConfirmarMesmoAssim(false);}}>{slots().map(s=><option key={s} value={s}>{s}</option>)}</select></div>
        </div>
        {isManager()&&<div className="form-group"><label className="form-label">Vendedor</label><select className="form-input" value={form.vendedor_id} onChange={e=>set("vendedor_id",e.target.value?Number(e.target.value):"")}><option value="">Selecionar...</option>{vendedores.map(v=><option key={v.id} value={v.id}>{v.nome}</option>)}</select></div>}
        <div className="form-group"><label className="form-label">Observações</label><textarea className="form-input" value={form.observacoes} onChange={e=>set("observacoes",e.target.value)} rows={2} style={{resize:"vertical"}}/></div>
        {erro&&<div style={{color:foraHorario?"var(--warning)":"var(--danger)",fontSize:13,marginBottom:12,padding:"10px 12px",background:foraHorario?"var(--warning-soft)":"var(--danger-soft)",borderRadius:8}}>
          <i className="ti ti-alert-triangle" style={{fontSize:14}}/> {erro}
        </div>}
        {foraHorario&&<div className="form-group form-check">
          <input type="checkbox" id="confirmar_fora_horario" checked={confirmarMesmoAssim} onChange={e=>setConfirmarMesmoAssim(e.target.checked)}/>
          <label htmlFor="confirmar_fora_horario">Agendar mesmo assim, fora do horário padrão (o vendedor está liberando esse horário)</label>
        </div>}
        <div style={{display:"flex",gap:8,marginTop:foraHorario?12:0}}>
          <button className="btn btn-ghost" onClick={onClose} style={{flex:1}}>Cancelar</button>
          <button className="btn btn-primary" onClick={submit} disabled={salvando||(foraHorario&&!confirmarMesmoAssim)} style={{flex:1}}>
            {salvando?<span className="spinner"/>:<><i className="ti ti-calendar-plus"/> Agendar</>}
          </button>
        </div>
      </div>
    </div>
  );
}

const MESES=["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const DIAS_LONGOS=["Domingo","Segunda-feira","Terça-feira","Quarta-feira","Quinta-feira","Sexta-feira","Sábado"];
// 2026-10-19 (Felipe, modelo da agenda por cadeiras): semana começa na segunda e o
// domingo (loja fechada) fica no fim, como no modelo que ele mandou.
const DOW_SEG=["seg","ter","qua","qui","sex","sáb","dom"];

// Cor de cada vendedor (é dado, não interface: mesma regra das cores de estágio).
const VEND_CORES=["#C8A84B","#2980B9","#27AE60","#8E44AD","#E67E22","#16A085","#C0392B","#D35400"];
const SEM_VEND_COR="#8a8a84";
function corDoVendedor(id,ordem){
  if(!id)return SEM_VEND_COR;
  const i=ordem.indexOf(id);
  return VEND_CORES[(i<0?0:i)%VEND_CORES.length];
}

const SITUACAO={
  confirmado:{label:"Confirmado",badge:"badge-success"},
  pendente:{label:"Pendente",badge:"badge-warning"},
  em_breve:{label:"Em breve",badge:"badge-brand"},
  intencao:{label:"Intenção",badge:"badge-brand"},
  aguardando_reagendamento_lara:{label:"Lara remarcando",badge:"badge-brand"},
  realizado:{label:"Realizado",badge:"badge-muted"},
  realizado_comprou:{label:"Comprou",badge:"badge-success"},
  realizado_nao_comprou:{label:"Não comprou",badge:"badge-muted"},
  nao_compareceu:{label:"Não veio",badge:"badge-danger"},
  cancelado:{label:"Cancelado",badge:"badge-danger"},
};
const ehCompromisso=ag=>ag.tipo!=="bloqueio"&&!ag.ocupado;

function CalendarioMes({mesAtual,onMudarMes,resumo,diaSel,onAbrirDia,ocultos,vendedores,ordemVend}){
  const ano=mesAtual.getFullYear(), mes=mesAtual.getMonth();
  const totalDias=new Date(ano,mes+1,0).getDate();
  const offsetInicial=(new Date(ano,mes,1).getDay()+6)%7;
  const hoje=new Date(); hoje.setHours(0,0,0,0);
  const porDia={};
  resumo.forEach(r=>{porDia[r.data]=r;});
  const iso=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  const celulas=[];
  for(let i=0;i<offsetInicial;i++) celulas.push(null);
  for(let dia=1;dia<=totalDias;dia++) celulas.push(new Date(ano,mes,dia));
  while(celulas.length%7) celulas.push(null);
  // contagem do dia respeitando os vendedores desligados
  const contar=r=>{
    if(!r)return {total:0,vends:[]};
    if(!r.por_vendedor)return {total:r.total,vends:[]};
    const vends=r.por_vendedor.filter(v=>!ocultos.has(v.vendedor_id||0));
    return {total:vends.reduce((s,v)=>s+v.total,0),vends};
  };
  const maxDia=Math.max(1,...resumo.map(r=>contar(r).total));
  const totalMes=resumo.reduce((s,r)=>s+contar(r).total,0);
  return(
    <div className="agm-grade">
      <div className="agm-dows">{DOW_SEG.map(n=><div key={n} className="agm-dow">{n}</div>)}</div>
      <div className="agm-dias">
        {celulas.map((d,i)=>{
          if(!d) return <div key={i} className="agm-vazio"/>;
          const {total,vends}=contar(porDia[iso(d)]);
          const dow=d.getDay();
          const passado=d<hoje;
          const isHoje=mesmoDia(d,hoje);
          const isSel=mesmoDia(d,diaSel);
          const rotulo=total>0?(total===1?"agendado":"agendados"):dow===0?"fechado":passado?"":"livre";
          // tom do dia cresce com o movimento (dia cheio salta aos olhos, igual o modelo)
          const tom=total>0?Math.round(10+22*(total/maxDia)):0;
          return(
            <button key={i} type="button" onClick={()=>onAbrirDia(d)}
              className={`agm-dia${dow===0?" fechado":""}${passado?" passado":""}${isHoje?" hoje":""}${isSel?" sel":""}${total>0?" cheio":""}`}
              style={tom?{"--tom":`${tom}%`}:undefined}
              aria-label={`${DIAS_LONGOS[dow]} ${d.getDate()}: ${total} ${total===1?"agendamento":"agendamentos"}`}>
              <div className="agm-dia-topo">
                <div className="agm-dia-data"><span className="agm-dia-dow">{DOW_SEG[(dow+6)%7]}</span><span className="agm-dia-num">{d.getDate()}</span></div>
                <div className="agm-dia-qtd">{total>0&&<strong>{total}</strong>}<span>{rotulo}</span></div>
              </div>
              {dow===6&&<span className="agm-dia-tag">até 12h</span>}
              {vends.length>0&&<div className="agm-dia-vends">
                {vends.slice(0,3).map(v=>(
                  <span key={v.vendedor_id||0} className="agm-dia-vend" title={`${v.vendedor_nome}: ${v.total}`}>
                    <i style={{background:corDoVendedor(v.vendedor_id,ordemVend)}}/><span className="agm-dia-vend-nome">{(v.vendedor_nome||"").split(" ")[0]}</span> {v.total}
                  </span>
                ))}
                {vends.length>3&&<span className="agm-dia-vend">+{vends.length-3}</span>}
              </div>}
            </button>
          );
        })}
      </div>
      <div className="agm-rodape">
        <span><strong>{totalMes}</strong> {totalMes===1?"agendamento":"agendamentos"} em {MESES[mes].toLowerCase()}{vendedores.length>0&&ocultos.size>0?" nos vendedores ligados":""}</span>
        <span className="agm-rodape-dica">Toque no dia para ver os agendamentos e o interesse de cada cliente</span>
      </div>
    </div>
  );
}

// Janela do dia (2026-10-19, modelo "Leads do dia" que o Felipe mandou): por vendedor,
// dentro dele por tipo, uma linha por cliente com horário, interesse, situação e resumo.
function DiaModal({dia,ags,loading,erro,ocultos,ordemVend,readOnly,onClose,onAbrir,onAgendar,onVerHorarios}){
  const visiveis=ags.filter(ag=>mesmoDia(new Date(ag.data_hora),dia)&&!ocultos.has(ag.vendedor_id||0));
  const compromissos=visiveis.filter(ag=>ehCompromisso(ag)&&ag.status!=="cancelado");
  const cancelados=visiveis.filter(ag=>ehCompromisso(ag)&&ag.status==="cancelado");
  const bloqueios=visiveis.filter(ag=>!ehCompromisso(ag));
  const grupos=[];
  compromissos.forEach(ag=>{
    const k=ag.vendedor_id||0;
    let g=grupos.find(x=>x.k===k);
    if(!g){g={k,nome:ag.vendedor_nome||"Sem vendedor",cor:corDoVendedor(ag.vendedor_id,ordemVend),tipos:[]};grupos.push(g);}
    let t=g.tipos.find(x=>x.tipo===ag.tipo);
    if(!t){t={tipo:ag.tipo,itens:[]};g.tipos.push(t);}
    t.itens.push(ag);
  });
  grupos.sort((a,b)=>(a.k===0)-(b.k===0)||a.nome.localeCompare(b.nome));
  const hoje=new Date();hoje.setHours(0,0,0,0);
  const podeAgendar=!readOnly&&dia>=hoje&&dia.getDay()!==0;
  const titulo=`${DIAS_LONGOS[dia.getDay()]}, ${dia.getDate()} de ${MESES[dia.getMonth()].toLowerCase()}`;
  return(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-lg agd-modal" onClick={e=>e.stopPropagation()}>
        <div className="modal-handle"/>
        <div className="agd-topo">
          <div style={{minWidth:0}}>
            <div className="agd-sobre">Agendamentos do dia</div>
            <h2 className="agd-titulo">{titulo}</h2>
            <div className="agd-sub">{loading?"Carregando...":`${compromissos.length} ${compromissos.length===1?"agendado":"agendados"} · por vendedor e tipo`}</div>
          </div>
          <div className="agd-topo-acoes">
            <button className="btn btn-ghost btn-sm" onClick={onVerHorarios}><i className="ti ti-clock"/> Ver horários</button>
            {podeAgendar&&<button className="btn btn-primary btn-sm" onClick={onAgendar}><i className="ti ti-plus"/> Agendar</button>}
            <button className="modal-x" aria-label="Fechar" title="Fechar (Esc)" onClick={onClose}><i className="ti ti-x"/></button>
          </div>
        </div>
        <div className="agd-corpo">
          {erro&&<div className="empty-state"><i className="ti ti-alert-triangle"/><p>{erro}</p></div>}
          {!erro&&loading&&<div className="empty-state"><i className="ti ti-loader" style={{animation:"spin 1s linear infinite"}}/><p>Carregando...</p></div>}
          {!erro&&!loading&&compromissos.length===0&&<div className="empty-state"><i className="ti ti-calendar-off"/><p>{dia.getDay()===0?"Domingo a loja fica fechada.":"Nenhum agendamento neste dia."}</p></div>}
          {!erro&&!loading&&grupos.map(g=>(
            <section key={g.k} className="agd-vend">
              <h3 className="agd-vend-nome"><i style={{background:g.cor}}/>{g.nome}<span className="agd-cont">{g.tipos.reduce((s,t)=>s+t.itens.length,0)}</span></h3>
              {g.tipos.map(t=>{
                const tipo=TIPOS[t.tipo]||{label:t.tipo,icon:"ti-calendar",cor:"#8a8a84"};
                return(
                  <div key={t.tipo} className="agd-tipo">
                    <div className="agd-tipo-nome"><i className={`ti ${tipo.icon}`} style={{color:tipo.cor}}/> {tipo.label}<span className="agd-cont">{t.itens.length}</span></div>
                    <div className="agd-tabela">
                      <div className="agd-linha agd-cab"><span>Horário</span><span>Cliente</span><span>Interesse</span><span>Situação</span><span>Resumo</span><span/></div>
                      {t.itens.map(ag=>{
                        const st=SITUACAO[getStatus(ag)]||{label:ag.status,badge:"badge-muted"};
                        return(
                          <div key={ag.id} className="agd-linha">
                            <span className="agd-hora">{fmtH(ag.data_hora)}–{fmtHF(ag.data_hora,ag.duracao_min||30)}</span>
                            <span className="agd-cli"><strong>{ag.cliente_nome||"Sem nome"}</strong>{ag.cliente_tel&&<small>{ag.cliente_tel}</small>}</span>
                            <span className="agd-int">{ag.veiculo?<><i className="ti ti-car"/> {ag.veiculo}</>:<em>Sem veículo definido</em>}</span>
                            <span><span className={`badge ${st.badge}`}>{st.label}</span></span>
                            <span className="agd-res">
                              {ag.observacoes?<span className="agd-obs">{ag.observacoes}</span>:<em>Sem observação</em>}
                              <small>{ag.origem==="ia"?<><i className="ti ti-robot"/> Agendado pela IA</>:ag.origem==="manual"?<><i className="ti ti-user"/> Agendado no painel</>:null}{ag.lead_estagio?` · ${ag.lead_estagio.replace(/_/g," ")}`:""}</small>
                            </span>
                            <span className="agd-acoes">
                              <button className="btn btn-ghost btn-sm" onClick={()=>onAbrir(ag)}><i className="ti ti-list-details"/> Abrir</button>
                              {ag.lead_id?(
                                <LeadPhoneChatwoot lead={{id:ag.lead_id,telefone:ag.cliente_tel,chatwoot_conv_id:ag.chatwoot_conv_id,chatwoot_inbox_id:ag.chatwoot_inbox_id}} style={{padding:"4px 10px"}}>Chatwoot</LeadPhoneChatwoot>
                              ):ag.chatwoot_conv_id?(
                                <ChatwootLink conv_id={ag.chatwoot_conv_id} inbox_id={ag.chatwoot_inbox_id} style={{padding:"4px 10px"}}>Chatwoot</ChatwootLink>
                              ):null}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </section>
          ))}
          {!erro&&!loading&&(bloqueios.length>0||cancelados.length>0)&&(
            <section className="agd-extra">
              {bloqueios.length>0&&<div><span className="agd-extra-tit"><i className="ti ti-lock"/> Horários bloqueados</span>
                {bloqueios.map(b=><span key={b.id} className="agd-extra-item">{fmtH(b.data_hora)}–{fmtHF(b.data_hora,b.duracao_min||30)} {b.ocupado?"Ocupado":(b.observacoes||"Bloqueado")}{b.vendedor_nome?` · ${b.vendedor_nome.split(" ")[0]}`:""}</span>)}
              </div>}
              {cancelados.length>0&&<div><span className="agd-extra-tit"><i className="ti ti-x"/> Cancelados</span>
                {cancelados.map(c=><button key={c.id} className="agd-extra-item agd-extra-link" onClick={()=>onAbrir(c)}>{fmtH(c.data_hora)} {c.cliente_nome||"Sem nome"}</button>)}
              </div>}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Agenda(){
  const readOnly=getRole()==="gerente";
  const ehVendedor=getRole()==="vendedor";
  const[ags,setAgs]=useState([]);
  const[diaSel,setDiaSel]=useState(new Date());
  const[loading,setLoading]=useState(true);
  const[novoModal,setNovoModal]=useState(false);
  const[novoData,setNovoData]=useState(null);
  const[bloqueioModal,setBloqueioModal]=useState(false);
  const[horariosModal,setHorariosModal]=useState(false);
  const[erro,setErro]=useState(null);
  const[veiculos,setVeiculos]=useState([]);
  const[vendaFeitaAviso,setVendaFeitaAviso]=useState(null);
  const[visao,setVisao]=useState("mes");
  const[mesAtual,setMesAtual]=useState(()=>{const d=new Date();d.setDate(1);return d;});
  const[resumoMes,setResumoMes]=useState([]);
  const[diaAberto,setDiaAberto]=useState(false);
  const[ocultos,setOcultos]=useState(()=>new Set());
  // Bloco clicado na grade de horários (ou "Abrir" na janela do dia) abre o card
  // completo (com as ações de confirmar/reagendar/etc) num modal.
  const[agAberto,setAgAberto]=useState(null);

  function load(){
    setLoading(true);setErro(null);
    const data=dataLocalISO(diaSel);
    getAgenda(data).then(a=>{setAgs(a);setLoading(false);})
      .catch(()=>{setErro("Erro ao carregar dados. Tente novamente.");setLoading(false);});
  }
  function loadMes(){
    getResumoMes(mesAtual.getFullYear(),mesAtual.getMonth()+1).then(setResumoMes).catch(()=>setResumoMes([]));
  }
  useEffect(()=>{load();},[diaSel]);
  useEffect(()=>{veiculosApi.getVeiculos().then(setVeiculos).catch(()=>{});},[]);
  useEffect(()=>{if(visao==="mes")loadMes();},[visao,mesAtual]);

  function mudarMes(delta){
    setMesAtual(m=>{const n=new Date(m);n.setMonth(n.getMonth()+delta);return n;});
  }
  function irHoje(){
    const h=new Date();setDiaSel(h);setVisao("dia");
  }
  function mudarDia(delta){
    setDiaSel(d=>{const n=new Date(d);n.setDate(n.getDate()+delta);return n;});
  }
  function abrirDia(d){setDiaSel(d);setDiaAberto(true);}

  // Vendedores do mês (para ligar/desligar), em ordem fixa por nome: a cor de cada um
  // não muda quando outro sai ou entra.
  const vendedores=[];
  resumoMes.forEach(r=>(r.por_vendedor||[]).forEach(v=>{
    if(!vendedores.some(x=>(x.vendedor_id||0)===(v.vendedor_id||0)))vendedores.push(v);
  }));
  vendedores.sort((a,b)=>(!a.vendedor_id)-(!b.vendedor_id)||a.vendedor_nome.localeCompare(b.vendedor_nome));
  const ordemVend=vendedores.filter(v=>v.vendedor_id).map(v=>v.vendedor_id);
  const mostrarToggles=!ehVendedor&&vendedores.length>1;
  function alternarVend(k){setOcultos(s=>{const n=new Set(s);n.has(k)?n.delete(k):n.add(k);return n;});}

  const dias=Array.from({length:7},(_,i)=>{const d=new Date();d.setDate(d.getDate()-3+i);return d;});
  const hoje=new Date();
  const doDia=ags.filter(ag=>mesmoDia(new Date(ag.data_hora),diaSel));
  // Busca sempre no array atual (não guarda cópia própria) — assim o modal reflete
  // na hora qualquer mudança de status/reagendamento feita nele mesmo.
  const agAbertoAtual=agAberto?doDia.find(a=>a.id===agAberto):null;

  async function handleStatus(id,status,estagio,veiculo_vendido_id){try{await atualizarStatusAgendamento(id,status,estagio,veiculo_vendido_id);}catch{}setAgs(a=>a.map(ag=>ag.id===id?{...ag,status}:ag));if(visao==="mes")loadMes();}
  // 2026-07-28: antes engolia qualquer erro (catch{} vazio) e recarregava como se
  // tivesse funcionado — agora deixa o erro subir pro AgendaCard tratar (mostrar o
  // motivo real e oferecer "mesmo assim" quando for fora de horário).
  async function handleReagendar(id,data_hora,ignorar_horario){await reagendarAgendamento(id,data_hora,ignorar_horario);load();if(visao==="mes")loadMes();}
  async function handleReagendarLara(id){try{await pedirReagendamentoLara(id);}catch{}setAgs(a=>a.map(ag=>ag.id===id?{...ag,status:"aguardando_reagendamento_lara"}:ag));}
  function handleVendaFeita(ag){setVendaFeitaAviso({ag,veiculo:acharVeiculo(veiculos,ag.veiculo)});setAgAberto(null);}
  function criado(){load();if(visao==="mes")loadMes();}

  return(
    <div className="agm">
      <div className="agm-cab">
        <div className="agm-cab-tit">
          <div className="agm-sobre">Loja · seg a sex 8h às 18h · sáb 8h às 12h</div>
          <h1 className="page-title"><i className="ti ti-calendar-event"/> Agenda</h1>
        </div>
        <div className="seg agm-visoes" role="tablist" aria-label="Visão da agenda">
          <button className={`seg-btn${visao==="dia"?" active":""}`} onClick={irHoje}><i className="ti ti-calendar-event"/> Hoje</button>
          <button className={`seg-btn${visao==="semana"?" active":""}`} onClick={()=>setVisao("semana")}><i className="ti ti-calendar-week"/> Semana</button>
          <button className={`seg-btn${visao==="mes"?" active":""}`} onClick={()=>setVisao("mes")}><i className="ti ti-calendar"/> Mês</button>
        </div>
        {/* 2026-07-28: sempre com rótulo — curto no mobile, completo no desktop. */}
        {!readOnly&&<div className="agenda-hdr-actions agm-cab-acoes">
          <button className="btn btn-ghost agenda-hdr-btn" onClick={()=>setHorariosModal(true)}><i className="ti ti-clock"/> <span className="xs-inline">Horários</span><span className="sm-inline">Meus horários</span></button>
          <button className="btn btn-ghost agenda-hdr-btn" onClick={()=>setBloqueioModal(true)}><i className="ti ti-lock"/> <span className="xs-inline">Bloquear</span><span className="sm-inline">Bloquear horário</span></button>
          <button className="btn btn-primary agenda-hdr-btn" onClick={()=>{setNovoData(null);setNovoModal(true);}}><i className="ti ti-plus"/> Agendar</button>
        </div>}
      </div>

      {visao==="mes"&&(
        <div className="agm-card">
          <div className="agm-card-topo">
            <div className="agm-nav">
              <button className="btn btn-ghost btn-icon" aria-label="Mês anterior" onClick={()=>mudarMes(-1)}><i className="ti ti-chevron-left"/></button>
              <button className="btn btn-ghost btn-icon" aria-label="Próximo mês" onClick={()=>mudarMes(1)}><i className="ti ti-chevron-right"/></button>
              <div>
                <div className="agm-sobre">Agenda da loja</div>
                <div className="agm-mes">{MESES[mesAtual.getMonth()].toLowerCase()} de {mesAtual.getFullYear()}</div>
              </div>
            </div>
            <div className="agm-legenda">
              <span><i className="agm-leg agm-leg-livre"/> livre</span>
              <span><i className="agm-leg agm-leg-cheio"/> com agendamento</span>
              <span><i className="agm-leg agm-leg-fechado"/> fechado</span>
            </div>
          </div>
          {mostrarToggles&&(
            <div className="agm-vends">
              <span className="agm-vends-tit">Vendedores</span>
              {vendedores.map(v=>{
                const k=v.vendedor_id||0;
                const ligado=!ocultos.has(k);
                return(
                  <button key={k} type="button" role="switch" aria-checked={ligado} className={`agm-vend${ligado?" on":""}`} onClick={()=>alternarVend(k)}>
                    <i className="agm-vend-cor" style={{background:corDoVendedor(v.vendedor_id,ordemVend)}}/>
                    {v.vendedor_nome}
                    <span className="agm-switch"/>
                  </button>
                );
              })}
            </div>
          )}
          <CalendarioMes mesAtual={mesAtual} onMudarMes={mudarMes} resumo={resumoMes} diaSel={diaSel} onAbrirDia={abrirDia} ocultos={ocultos} vendedores={vendedores} ordemVend={ordemVend}/>
        </div>
      )}

      {visao!=="mes"&&<>
        {visao==="semana"?(
          <div className="dias-nav">
            {dias.map((d,i)=>{const isHoje=mesmoDia(d,hoje);const isSel=mesmoDia(d,diaSel);const ns=["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];return(<button key={i} className={`dia-btn ${isHoje?"hoje":""} ${isSel?"selected":""}`} onClick={()=>setDiaSel(d)}><span className="dia-num">{d.getDate()}</span><span className="dia-nome">{ns[d.getDay()]}</span></button>);})}
          </div>
        ):(
          <div className="agm-dia-nav">
            <button className="btn btn-ghost btn-icon" aria-label="Dia anterior" onClick={()=>mudarDia(-1)}><i className="ti ti-chevron-left"/></button>
            <strong>{DIAS_LONGOS[diaSel.getDay()]}, {diaSel.getDate()} de {MESES[diaSel.getMonth()].toLowerCase()}</strong>
            <button className="btn btn-ghost btn-icon" aria-label="Próximo dia" onClick={()=>mudarDia(1)}><i className="ti ti-chevron-right"/></button>
            {!mesmoDia(diaSel,hoje)&&<button className="btn btn-ghost btn-sm" onClick={()=>setDiaSel(new Date())}>Hoje</button>}
          </div>
        )}
        <div style={{fontSize:13,color:"var(--muted)",marginBottom:16}}>{fmtDia(diaSel)} · {doDia.filter(a=>a.status!=="cancelado"&&ehCompromisso(a)).length} agendamentos</div>
        {erro&&<div className="empty-state"><i className="ti ti-alert-triangle"/><p>{erro}</p></div>}
        {!erro&&loading&&<div className="empty-state"><i className="ti ti-loader" style={{animation:"spin 1s linear infinite"}}/><p>Carregando...</p></div>}
        {!erro&&!loading&&doDia.length===0&&<div className="empty-state"><i className="ti ti-calendar-off"/><p>Nenhum agendamento para {fmtDia(diaSel)}</p></div>}
        {/* 2026-07-28: grade de horários no desktop; no celular lista vertical com o card completo. */}
        {!erro&&!loading&&doDia.length>0&&<div className="d-desktop"><GradeHorarios doDia={doDia} onAbrirAg={ag=>setAgAberto(ag.id)}/></div>}
        {!erro&&!loading&&<div className="d-mobile">
          {doDia.filter(ag=>ag.status!=="cancelado"&&ehCompromisso(ag)).map(ag=>(
            <AgendaCard key={ag.id} ag={ag} onStatus={handleStatus} onReagendar={handleReagendar} onReagendarLara={handleReagendarLara} onVendaFeita={handleVendaFeita} readOnly={readOnly}/>
          ))}
        </div>}
      </>}

      {diaAberto&&visao==="mes"&&(
        <DiaModal dia={diaSel} ags={ags} loading={loading} erro={erro} ocultos={ocultos} ordemVend={ordemVend} readOnly={readOnly}
          onClose={()=>setDiaAberto(false)}
          onAbrir={ag=>setAgAberto(ag.id)}
          onAgendar={()=>{setNovoData(dataLocalISO(diaSel));setNovoModal(true);}}
          onVerHorarios={()=>{setDiaAberto(false);setVisao("dia");}}/>
      )}
      {!readOnly&&novoModal&&<NovoModal dataInicial={novoData} onClose={()=>setNovoModal(false)} onCriado={criado}/>}
      {!readOnly&&bloqueioModal&&<BloqueioModal onClose={()=>setBloqueioModal(false)} onCriado={criado}/>}
      {!readOnly&&horariosModal&&<HorariosModal onClose={()=>setHorariosModal(false)}/>}
      {agAbertoAtual&&(
        <div className="modal-overlay" onClick={()=>setAgAberto(null)}>
          <div className="modal" onClick={e=>e.stopPropagation()} style={{maxWidth:440}}>
            <div className="modal-handle"/>
            <div className="modal-header"><h2 className="modal-title">Compromisso</h2><button className="modal-x" aria-label="Fechar" title="Fechar (Esc)" onClick={()=>setAgAberto(null)}><i className="ti ti-x"/></button></div>
            <AgendaCard ag={agAbertoAtual} onStatus={handleStatus} onReagendar={handleReagendar} onReagendarLara={handleReagendarLara} onVendaFeita={handleVendaFeita} readOnly={readOnly}/>
          </div>
        </div>
      )}
      {vendaFeitaAviso&&(
        <div className="modal-overlay" onClick={()=>setVendaFeitaAviso(null)}>
          <div className="modal" onClick={e=>e.stopPropagation()} style={{maxWidth:420}}>
            <div className="modal-handle"/>
            <div className="modal-header"><h2 className="modal-title"><i className="ti ti-check" style={{color:"var(--success)"}}/> Venda registrada!</h2><button className="modal-x" aria-label="Fechar" title="Fechar (Esc)" onClick={()=>setVendaFeitaAviso(null)}><i className="ti ti-x"/></button></div>
            <p style={{fontSize:14,color:"var(--fg)",marginBottom:16}}>
              Não esqueça de remover o anúncio do <strong>{vendaFeitaAviso.veiculo?`${vendaFeitaAviso.veiculo.marca} ${vendaFeitaAviso.veiculo.modelo}`:vendaFeitaAviso.ag.veiculo}</strong> do site e dos portais.
            </p>
            <div style={{display:"flex",gap:8}}>
              <button className="btn btn-ghost" onClick={()=>setVendaFeitaAviso(null)} style={{flex:1}}>Fechar</button>
              <a className="btn btn-primary" style={{flex:1,textAlign:"center"}} href={vendaFeitaAviso.veiculo?`/veiculos?editar=${vendaFeitaAviso.veiculo.id}`:"/veiculos"}>
                <i className="ti ti-car"/> Ir para Veículos
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
