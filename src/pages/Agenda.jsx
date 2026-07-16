import { useState, useEffect } from "react";
import { getAgenda, criarAgendamento, atualizarStatusAgendamento, reagendarAgendamento, pedirReagendamentoLara, getResumoMes, getHorarios, criarHorario, removerHorario, getBloqueiosRecorrentes, criarBloqueioRecorrente, removerBloqueioRecorrente } from "../api.js";
import { api as veiculosApi } from "../lib/api.js";
import { isManager, getUser, getRole } from "../auth.js";

const ESTAGIOS_NAO_COMPROU=[
  {key:"sem_credito",label:"Sem crédito"},
  {key:"vai_pensar",label:"Vai pensar"},
  {key:"nao_achou_carro",label:"Não achou o carro"},
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

const TIPOS={test_drive:{label:"Test drive",icon:"🚗",cor:"#C8A84B"},visita_patio:{label:"Visita ao pátio",icon:"🏢",cor:"#2980B9"},apresentacao:{label:"Apresentação",icon:"📋",cor:"#27AE60"},reuniao_fechamento:{label:"Reunião de fechamento",icon:"🤝",cor:"#8E44AD"}};
const SBORDA={confirmado:"var(--success)",pendente:"var(--warning)",em_breve:"var(--brand)",realizado:"var(--muted)",cancelado:"var(--danger)",nao_compareceu:"#e67e22",aguardando_reagendamento_lara:"var(--brand)"};

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
            const tipo=TIPOS[ag.tipo]||{icon:"📅",cor:"var(--muted)"};
            const status=getStatus(ag);
            return(
              <button key={ag.id} className="time-grid-block ag" onClick={()=>onAbrirAg(ag)}
                style={{top:_ini,height:altura,left:esquerda,width:largura,borderLeftColor:SBORDA[status]||tipo.cor,background:`${tipo.cor}1c`}}>
                <span className="time-grid-block-hora">{fmtH(ag.data_hora)}</span>
                <span className="time-grid-block-nome">{tipo.icon} {ag.cliente_nome}</span>
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
  const tipo=TIPOS[ag.tipo]||{label:ag.tipo,icon:"📅",cor:"var(--muted)"};
  const min=minAte(ag.data_hora);
  const[escolhendoReagendar,setEscolhendoReagendar]=useState(false);
  const[reagendando,setReagendando]=useState(false);
  const[escolhendoMotivo,setEscolhendoMotivo]=useState(false);
  const[pedidoLaraEnviado,setPedidoLaraEnviado]=useState(false);
  const iso=new Date(ag.data_hora);
  const[novaData,setNovaData]=useState(dataLocalISO(iso));
  const[novoHorario,setNovoHorario]=useState(`${String(iso.getHours()).padStart(2,"0")}:${String(iso.getMinutes()).padStart(2,"0")}`);
  function confirmarReagendar(){
    onReagendar(ag.id,`${novaData}T${novoHorario}:00`);
    setReagendando(false);
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
  function confirmarComprou(){
    onStatus(ag.id,"realizado_comprou");
    onVendaFeita(ag);
  }
  return(
    <div className={`agenda-card ${status}`} style={{borderLeftColor:SBORDA[status]}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
        <span style={{fontSize:16,fontWeight:700,color:"var(--fg)"}}>
          {fmtH(ag.data_hora)} — {fmtHF(ag.data_hora,ag.duracao_min)}
          {status==="em_breve"&&<span style={{fontSize:11,color:"var(--brand)",marginLeft:8}}>⚠️ EM {min} MIN</span>}
        </span>
        <div style={{width:28,height:28,borderRadius:"50%",background:"rgba(200,168,75,.15)",color:"var(--brand)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700}}>{ag.vendedor_iniciais}</div>
      </div>
      <span style={{fontSize:11,padding:"3px 10px",borderRadius:99,background:`${tipo.cor}22`,color:tipo.cor,display:"inline-block",marginBottom:8}}>{tipo.icon} {tipo.label}</span>
      <div style={{fontSize:15,fontWeight:600,color:"var(--fg)",marginBottom:2}}>{ag.cliente_nome}</div>
      <div style={{fontSize:13,color:"var(--muted)",marginBottom:8}}>{ag.veiculo}</div>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:ag.observacoes?8:10}}>
        <span style={{fontSize:13,color:"var(--muted)",whiteSpace:"nowrap"}}>📱 {ag.cliente_tel}</span>
        <a href={`https://wa.me/55${ag.cliente_tel}`} target="_blank" rel="noopener noreferrer" className="btn-wa" style={{padding:"4px 10px"}}><i className="ti ti-brand-whatsapp" style={{fontSize:14}}/> WA</a>
      </div>
      {ag.observacoes&&<div style={{fontSize:12,color:"var(--muted)",fontStyle:"italic",marginBottom:10,padding:"6px 8px",background:"var(--surface2)",borderRadius:6}}>{ag.observacoes}</div>}
      {status==="aguardando_reagendamento_lara"&&!pedidoLaraEnviado&&<div style={{fontSize:12,color:"var(--brand)",marginBottom:10,padding:"6px 8px",background:"var(--surface2)",borderRadius:6}}>🤖 Aguardando a Lara remarcar com o cliente pelo WhatsApp...</div>}
      {pedidoLaraEnviado&&<div style={{fontSize:12,color:"var(--brand)",marginBottom:10,padding:"6px 8px",background:"var(--surface2)",borderRadius:6}}>🤖 Pedido enviado! A Lara vai negociar um novo horário com o cliente.</div>}
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
        <div style={{display:"flex",gap:6,alignItems:"center",marginBottom:10,padding:"8px",background:"var(--surface2)",borderRadius:6,flexWrap:"wrap"}}>
          <input className="form-input" type="date" style={{marginBottom:0,fontSize:12,flex:1,minWidth:120}} value={novaData} onChange={e=>setNovaData(e.target.value)}/>
          <input className="form-input" type="time" style={{marginBottom:0,fontSize:12,flex:1,minWidth:90}} value={novoHorario} onChange={e=>setNovoHorario(e.target.value)}/>
          <button className="btn btn-primary" style={{fontSize:12,padding:"6px 10px"}} onClick={confirmarReagendar}>Confirmar</button>
          <button className="btn btn-ghost" style={{fontSize:12,padding:"6px 10px"}} onClick={()=>setReagendando(false)}>Cancelar</button>
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
      {!readOnly&&<div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
        {ag.status==="pendente"&&<button className="btn btn-ghost" style={{fontSize:12,padding:"6px 12px",color:"var(--success)",borderColor:"rgba(76,175,125,.3)"}} onClick={()=>onStatus(ag.id,"confirmado")}><i className="ti ti-check"/> Confirmar</button>}
        {(ag.status==="confirmado"||ag.status==="pendente")&&<button className="btn btn-danger" style={{fontSize:12,padding:"6px 12px"}} onClick={()=>onStatus(ag.id,"cancelado")}><i className="ti ti-x"/> Cancelar</button>}
        {ag.status==="confirmado"&&new Date(ag.data_hora)<new Date()&&!reagendando&&!escolhendoMotivo&&!escolhendoReagendar&&<>
          <button className="btn btn-ghost" style={{fontSize:12,padding:"6px 12px"}} onClick={()=>setEscolhendoReagendar(true)}><i className="ti ti-calendar-time"/> Reagendar</button>
          <button className="btn btn-ghost" style={{fontSize:12,padding:"6px 12px",color:"var(--success)",borderColor:"rgba(76,175,125,.3)"}} onClick={confirmarComprou}><i className="ti ti-check"/> Veio e comprou</button>
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

function NovoModal({onClose,onCriado}){
  const user=getUser();
  const[form,setForm]=useState({cliente_nome:"",cliente_tel:"",veiculo:"",tipo:"test_drive",data:dataLocalISO(new Date()),horario:"09:00",duracao_min:45,vendedor_nome:isManager()?"":user?.nome,observacoes:""});
  const set=(k,v)=>setForm(f=>({...f,[k]:v}));
  function slots(){const d=new Date(form.data+"T12:00:00");const dow=d.getDay();if(dow===0)return[];const fim=dow===6?12:18;const s=[];for(let h=8;h<fim;h++){s.push(`${String(h).padStart(2,"0")}:00`);s.push(`${String(h).padStart(2,"0")}:30`);}return s;}
  async function submit(){if(!form.cliente_nome||!form.veiculo)return;const data_hora=`${form.data}T${form.horario}:00`;try{await criarAgendamento({...form,data_hora});}catch{}onCriado();onClose();}
  return(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()}>
        <div className="modal-handle"/>
        <div className="modal-header"><h2 className="modal-title">Novo agendamento</h2><button onClick={onClose} style={{background:"none",border:"none",color:"var(--muted)",fontSize:22,cursor:"pointer"}}><i className="ti ti-x"/></button></div>
        <div className="form-group"><label className="form-label">Cliente *</label><input className="form-input" value={form.cliente_nome} onChange={e=>set("cliente_nome",e.target.value)} placeholder="Nome do cliente"/></div>
        <div className="form-group"><label className="form-label">Telefone</label><input className="form-input" value={form.cliente_tel} onChange={e=>set("cliente_tel",e.target.value)} placeholder="49999999999"/></div>
        <div className="form-group"><label className="form-label">Veículo *</label><input className="form-input" value={form.veiculo} onChange={e=>set("veiculo",e.target.value)} placeholder="Ex: HB20 2022"/></div>
        <div className="form-grid">
          <div className="form-group"><label className="form-label">Tipo</label><select className="form-input" value={form.tipo} onChange={e=>set("tipo",e.target.value)}>{Object.entries(TIPOS).map(([k,v])=><option key={k} value={k}>{v.icon} {v.label}</option>)}</select></div>
          <div className="form-group"><label className="form-label">Duração</label><select className="form-input" value={form.duracao_min} onChange={e=>set("duracao_min",+e.target.value)}><option value={30}>30 min</option><option value={45}>45 min</option><option value={60}>1 hora</option><option value={90}>1h30</option></select></div>
          <div className="form-group"><label className="form-label">Data</label><input className="form-input" type="date" value={form.data} onChange={e=>set("data",e.target.value)} min={dataLocalISO(new Date())}/></div>
          <div className="form-group"><label className="form-label">Horário</label><select className="form-input" value={form.horario} onChange={e=>set("horario",e.target.value)}>{slots().map(s=><option key={s} value={s}>{s}</option>)}</select></div>
        </div>
        {isManager()&&<div className="form-group"><label className="form-label">Vendedor</label><select className="form-input" value={form.vendedor_nome} onChange={e=>set("vendedor_nome",e.target.value)}><option value="">Selecionar...</option>{["Dariana","Alex","Wolni"].map(n=><option key={n} value={n}>{n}</option>)}</select></div>}
        <div className="form-group"><label className="form-label">Observações</label><textarea className="form-input" value={form.observacoes} onChange={e=>set("observacoes",e.target.value)} rows={2} style={{resize:"vertical"}}/></div>
        <div style={{display:"flex",gap:8}}><button className="btn btn-ghost" onClick={onClose} style={{flex:1}}>Cancelar</button><button className="btn btn-primary" onClick={submit} style={{flex:1}}><i className="ti ti-calendar-plus"/> Agendar</button></div>
      </div>
    </div>
  );
}

const MESES=["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const DIAS_SEMANA_CURTO=["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];

function CalendarioMes({mesAtual,onMudarMes,resumo,diaSel,onSelecionarDia}){
  const ano=mesAtual.getFullYear(), mes=mesAtual.getMonth();
  const primeiroDia=new Date(ano,mes,1);
  const totalDias=new Date(ano,mes+1,0).getDate();
  const offsetInicial=primeiroDia.getDay();
  const hoje=new Date();
  // Prévia por dia (não só contagem) — mostra "09:00 João" dentro da célula, igual
  // o Google Agenda, em vez de só um número que obriga clicar pra saber o que tem.
  const previaPorDia={};
  resumo.forEach(r=>{previaPorDia[r.data]={total:r.total,eventos:r.eventos||[]};});
  const iso=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;

  const celulas=[];
  for(let i=0;i<offsetInicial;i++) celulas.push(null);
  for(let dia=1;dia<=totalDias;dia++) celulas.push(new Date(ano,mes,dia));

  return(
    <div className="cal-mes-wrap">
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
        <button className="btn btn-ghost" style={{padding:"6px 10px"}} onClick={()=>onMudarMes(-1)}><i className="ti ti-chevron-left"/></button>
        <span style={{fontSize:15,fontWeight:700,color:"var(--fg)"}}>{MESES[mes]} {ano}</span>
        <button className="btn btn-ghost" style={{padding:"6px 10px"}} onClick={()=>onMudarMes(1)}><i className="ti ti-chevron-right"/></button>
      </div>
      <div className="cal-grid" style={{marginBottom:4}}>
        {DIAS_SEMANA_CURTO.map(n=><div key={n} className="cal-dow"><span className="xs-inline">{n[0]}</span><span className="sm-inline">{n}</span></div>)}
      </div>
      <div className="cal-grid">
        {celulas.map((d,i)=>{
          if(!d) return <div key={i}/>;
          const{total=0,eventos=[]}=previaPorDia[iso(d)]||{};
          const isHoje=mesmoDia(d,hoje);
          const isSel=mesmoDia(d,diaSel);
          const sobrando=total-eventos.length;
          return(
            <button key={i} className="cal-cel cal-cel-mes" onClick={()=>onSelecionarDia(d)} style={{
              border:isSel?"2px solid var(--brand)":isHoje?"1px solid var(--brand)":"1px solid var(--border)",
              background:isSel?"rgba(200,168,75,.12)":"var(--surface2)",
            }}>
              <span className="cal-cel-num" style={{fontWeight:isHoje?700:500}}>{d.getDate()}</span>
              <div className="cal-cel-chips">
                {eventos.map(ev=>{
                  const tipo=TIPOS[ev.tipo]||{icon:"📅",cor:"var(--muted)"};
                  return <span key={ev.id} className="cal-chip" style={{background:`${tipo.cor}22`,color:tipo.cor}}>{ev.hora} {ev.cliente_nome||"—"}</span>;
                })}
                {sobrando>0&&<span className="cal-chip cal-chip-mais">+{sobrando} mais</span>}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function Agenda(){
  const readOnly=getRole()==="manager";
  const[ags,setAgs]=useState([]);
  const[diaSel,setDiaSel]=useState(new Date());
  const[loading,setLoading]=useState(true);
  const[novoModal,setNovoModal]=useState(false);
  const[bloqueioModal,setBloqueioModal]=useState(false);
  const[horariosModal,setHorariosModal]=useState(false);
  const[erro,setErro]=useState(null);
  const[veiculos,setVeiculos]=useState([]);
  const[vendaFeitaAviso,setVendaFeitaAviso]=useState(null);
  const[visao,setVisao]=useState("semana");
  const[mesAtual,setMesAtual]=useState(()=>{const d=new Date();d.setDate(1);return d;});
  const[resumoMes,setResumoMes]=useState([]);
  // Bloco clicado na grade de horários abre o card completo (com as ações de
  // confirmar/reagendar/etc) num modal — o bloco em si fica compacto, só
  // horário+nome, igual o Google Agenda; o detalhe rico continua sendo o mesmo
  // AgendaCard de sempre, só que sob demanda em vez de sempre visível.
  const[agAberto,setAgAberto]=useState(null);

  function load(){
    setLoading(true);setErro(null);
    const data=dataLocalISO(diaSel);
    getAgenda(data).then(a=>{setAgs(a);setLoading(false);})
      .catch(()=>{setErro("Erro ao carregar dados. Tente novamente.");setLoading(false);});
  }
  useEffect(()=>{load();},[diaSel]);
  useEffect(()=>{veiculosApi.getVeiculos().then(setVeiculos).catch(()=>{});},[]);
  useEffect(()=>{
    if(visao!=="mes")return;
    getResumoMes(mesAtual.getFullYear(),mesAtual.getMonth()+1).then(setResumoMes).catch(()=>setResumoMes([]));
  },[visao,mesAtual]);

  function mudarMes(delta){
    setMesAtual(m=>{const n=new Date(m);n.setMonth(n.getMonth()+delta);return n;});
  }

  const dias=Array.from({length:7},(_,i)=>{const d=new Date();d.setDate(d.getDate()-3+i);return d;});
  const hoje=new Date();
  const doDia=ags.filter(ag=>mesmoDia(new Date(ag.data_hora),diaSel));
  // Busca sempre no array atual (não guarda cópia própria) — assim o modal reflete
  // na hora qualquer mudança de status/reagendamento feita nele mesmo.
  const agAbertoAtual=agAberto?doDia.find(a=>a.id===agAberto):null;

  async function handleStatus(id,status,estagio){try{await atualizarStatusAgendamento(id,status,estagio);}catch{}setAgs(a=>a.map(ag=>ag.id===id?{...ag,status}:ag));}
  async function handleReagendar(id,data_hora){try{await reagendarAgendamento(id,data_hora);}catch{}load();}
  async function handleReagendarLara(id){try{await pedirReagendamentoLara(id);}catch{}setAgs(a=>a.map(ag=>ag.id===id?{...ag,status:"aguardando_reagendamento_lara"}:ag));}
  function handleVendaFeita(ag){setVendaFeitaAviso({ag,veiculo:acharVeiculo(veiculos,ag.veiculo)});setAgAberto(null);}

  return(
    <div>
      <div className="page-header">
        <h1 className="page-title"><i className="ti ti-calendar-event"/> Agenda</h1>
        {!readOnly&&<div className="agenda-hdr-actions">
          <button className="btn btn-ghost agenda-hdr-btn" onClick={()=>setHorariosModal(true)}><i className="ti ti-clock"/> <span className="sm-inline">Meus horários</span></button>
          <button className="btn btn-ghost agenda-hdr-btn" onClick={()=>setBloqueioModal(true)}><i className="ti ti-lock"/> <span className="sm-inline">Bloquear horário</span></button>
          <button className="btn btn-primary agenda-hdr-btn" onClick={()=>setNovoModal(true)}><i className="ti ti-plus"/> <span className="sm-inline">Agendar</span></button>
        </div>}
      </div>
      <div className="agenda-visao-toggle">
        <button className={`btn agenda-visao-btn ${visao==="semana"?"btn-primary":"btn-ghost"}`} style={{fontSize:12,padding:"6px 12px"}} onClick={()=>setVisao("semana")}><i className="ti ti-calendar-week"/> Semana</button>
        <button className={`btn agenda-visao-btn ${visao==="mes"?"btn-primary":"btn-ghost"}`} style={{fontSize:12,padding:"6px 12px"}} onClick={()=>setVisao("mes")}><i className="ti ti-calendar"/> Mês</button>
      </div>
      {visao==="semana"?(
        <div className="dias-nav">
          {dias.map((d,i)=>{const isHoje=mesmoDia(d,hoje);const isSel=mesmoDia(d,diaSel);const ns=["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];return(<button key={i} className={`dia-btn ${isHoje?"hoje":""} ${isSel?"selected":""}`} onClick={()=>setDiaSel(d)}><span className="dia-num">{d.getDate()}</span><span className="dia-nome">{ns[d.getDay()]}</span></button>);})}
        </div>
      ):(
        <CalendarioMes mesAtual={mesAtual} onMudarMes={mudarMes} resumo={resumoMes} diaSel={diaSel} onSelecionarDia={setDiaSel}/>
      )}
      <div style={{fontSize:13,color:"var(--muted)",marginBottom:16}}>{fmtDia(diaSel)} · {doDia.filter(a=>a.status!=="cancelado"&&a.tipo!=="bloqueio"&&!a.ocupado).length} agendamentos</div>
      {erro&&<div className="empty-state"><i className="ti ti-alert-triangle"/><p>{erro}</p></div>}
      {!erro&&loading&&<div className="empty-state"><i className="ti ti-loader" style={{animation:"spin 1s linear infinite"}}/><p>Carregando...</p></div>}
      {!erro&&!loading&&doDia.length===0&&<div className="empty-state"><i className="ti ti-calendar-off"/><p>Nenhum agendamento para {fmtDia(diaSel)}</p></div>}
      {!erro&&!loading&&doDia.length>0&&<GradeHorarios doDia={doDia} onAbrirAg={ag=>setAgAberto(ag.id)}/>}
      {!readOnly&&novoModal&&<NovoModal onClose={()=>setNovoModal(false)} onCriado={()=>load()}/>}
      {!readOnly&&bloqueioModal&&<BloqueioModal onClose={()=>setBloqueioModal(false)} onCriado={()=>load()}/>}
      {!readOnly&&horariosModal&&<HorariosModal onClose={()=>setHorariosModal(false)}/>}
      {agAbertoAtual&&(
        <div className="modal-overlay" onClick={()=>setAgAberto(null)}>
          <div className="modal" onClick={e=>e.stopPropagation()} style={{maxWidth:440}}>
            <div className="modal-handle"/>
            <div className="modal-header"><h2 className="modal-title">Compromisso</h2><button onClick={()=>setAgAberto(null)} style={{background:"none",border:"none",color:"var(--muted)",fontSize:22,cursor:"pointer"}}><i className="ti ti-x"/></button></div>
            <AgendaCard ag={agAbertoAtual} onStatus={handleStatus} onReagendar={handleReagendar} onReagendarLara={handleReagendarLara} onVendaFeita={handleVendaFeita} readOnly={readOnly}/>
          </div>
        </div>
      )}
      {vendaFeitaAviso&&(
        <div className="modal-overlay" onClick={()=>setVendaFeitaAviso(null)}>
          <div className="modal" onClick={e=>e.stopPropagation()} style={{maxWidth:420}}>
            <div className="modal-handle"/>
            <div className="modal-header"><h2 className="modal-title"><i className="ti ti-check" style={{color:"var(--success)"}}/> Venda registrada!</h2></div>
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
