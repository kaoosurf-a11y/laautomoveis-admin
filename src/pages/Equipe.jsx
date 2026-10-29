import { useState, useEffect } from "react";
import { api } from "../lib/api.js";
import { getUser, verComo } from "../auth.js";
import { alertDialog } from "../components/Dialog.jsx";
import UsoDoApp from "../components/UsoDoApp.jsx";

const CORES=["#C8A84B","#e05252","#8E44AD","#2980B9","#27AE60","#e6a817"];
const GRUPOS=[{role:"admin_master",titulo:"Proprietários"},{role:"gerente",titulo:"Gerentes"},{role:"vendedor",titulo:"Vendedores"}];

// 2026-10-29 (Felipe): situação dos avisos do app de cada pessoa. Verde = ativou e o celular
// aceitou aviso nas últimas 24h; amarelo = ativou, sem aviso recente; vermelho = não ativou.
function hora(d){return new Date(d).toLocaleString("pt-BR",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"});}
function situacaoAvisos(a){
  if(!a)return{cor:"var(--danger)",fundo:"var(--danger-soft)",titulo:"Não ativou os avisos",linha:"Precisa entrar no app e tocar em Ativar avisos"};
  const aparelhos=[...new Set(a.aparelhos)].join(", ");
  const recente=a.ultimo_ok_em&&Date.now()-new Date(a.ultimo_ok_em)<24*3600e3;
  return{
    cor:recente?"var(--success)":"var(--warning)",fundo:recente?"var(--success-soft)":"var(--warning-soft)",
    titulo:`Avisos ativos · ${aparelhos}`,
    linha:a.ultimo_ok_em?`Último aviso recebido ${hora(a.ultimo_ok_em)}`:`Ativou ${hora(a.ativou_em)} · ainda sem aviso`,
  };
}

export default function Equipe(){
  const[equipe,setEquipe]=useState([]);
  const[loading,setLoading]=useState(true);
  const[erro,setErro]=useState(null);
  // LA V1 20260810 (achado em auditoria): a senha padrão compartilhada ficava em texto
  // puro, sempre visível, na tela — mesmo essa página sendo só do Proprietário, deixar
  // uma credencial em claro por padrão é má prática (print de tela, alguém olhando por
  // cima do ombro, etc.). Mascarada por padrão agora, com o mesmo padrão "olho" já usado
  // no modal de trocar senha (Layout.jsx).
  const[mostrarSenha,setMostrarSenha]=useState(false);
  // "Ver como": só o dono, e só para gerente/vendedor (o servidor confere de novo).
  const eu=getUser();
  const[abrindo,setAbrindo]=useState(null);
  async function abrirComo(m){
    setAbrindo(m.id);
    const r=await verComo(m.id);
    if(!r.ok){setAbrindo(null);alertDialog(r.erro);return;}
    window.location.href="/";
  }

  const[avisos,setAvisos]=useState(null);
  const[testando,setTestando]=useState(null);
  function carregarAvisos(){api.getAvisosStatus().then(setAvisos).catch(()=>setAvisos(null));}
  async function testar(m){
    setTestando(m.id);
    const r=await api.testarAvisos(m.id).catch(()=>null);
    setTestando(null);
    carregarAvisos();
    alertDialog(r?.ok?`Teste enviado pra ${m.nome.split(" ")[0]} (${r.aparelhos} aparelho${r.aparelhos>1?"s":""}).`:`Não chegou em nenhum aparelho de ${m.nome.split(" ")[0]}. Peça pra entrar no app e ativar os avisos de novo.`);
  }

  useEffect(()=>{
    carregarAvisos();
    api.getUsers().then(u=>{setEquipe(u);setLoading(false);})
      .catch(()=>{setErro("Erro ao carregar equipe. Tente novamente.");setLoading(false);});
  },[]);

  if(erro)return <div className="empty-state"><i className="ti ti-alert-triangle"/><p>{erro}</p></div>;
  if(loading)return <div className="empty-state"><i className="ti ti-loader" style={{animation:"spin 1s linear infinite"}}/><p>Carregando...</p></div>;

  return(
    <div>
      <div className="page-header"><h1 className="page-title"><i className="ti ti-users"/> Equipe</h1></div>
      {GRUPOS.map(g=>{
        const pessoas=equipe.filter(m=>m.role===g.role);
        if(!pessoas.length)return null;
        return(
          <div key={g.role}>
            <div className="sec-label">{g.titulo} ({pessoas.length})</div>
            <div className="equipe-grid">
              {pessoas.map(m=>{
                const cor=CORES[equipe.indexOf(m)%CORES.length];
                return(
                <div key={m.usuario} className="card equipe-card">
                  <div className="equipe-top">
                    <div className="equipe-av tone" style={{background:`${cor}22`,color:cor}}>{m.iniciais}</div>
                    <div style={{flex:1,minWidth:0}}>
                      <div className="equipe-nome">{m.nome}</div>
                      <div className="equipe-sub">@{m.usuario}</div>
                    </div>
                    <span className="equipe-status">Ativo</span>
                  </div>
                  {avisos&&(()=>{const st=situacaoAvisos(avisos[m.id]);return(
                    <div style={{display:"flex",alignItems:"center",gap:10,background:st.fundo,borderRadius:8,padding:"8px 10px"}}>
                      <i className={`ti ti-${avisos[m.id]?"bell-ringing":"bell-off"}`} style={{color:st.cor,fontSize:18,flexShrink:0}}/>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:12,fontWeight:600,color:st.cor}}>{st.titulo}</div>
                        <div style={{fontSize:11,color:"var(--muted)",marginTop:1}}>{st.linha}</div>
                      </div>
                      {eu?.role==="admin_master"&&avisos[m.id]&&
                        <button className="btn btn-ghost btn-sm" onClick={()=>testar(m)} disabled={testando!=null} style={{flexShrink:0}}>
                          <i className={`ti ti-${testando===m.id?"loader":"send"}`} style={testando===m.id?{animation:"spin 1s linear infinite"}:undefined}/> Testar
                        </button>}
                    </div>);})()}
                  {eu?.role==="admin_master"&&m.role!=="admin_master"&&
                    <button className="btn btn-ghost btn-sm" style={{width:"100%"}} onClick={()=>abrirComo(m)} disabled={abrindo!=null}>
                      <i className={`ti ti-${abrindo===m.id?"loader":"eye"}`} style={abrindo===m.id?{animation:"spin 1s linear infinite"}:undefined}/> Ver como {m.nome.split(" ")[0]}
                    </button>}
                </div>
                );
              })}
            </div>
          </div>
        );
      })}
      {eu?.role==="admin_master"&&<UsoDoApp/>}
      <div className="card" style={{marginTop:20}}>
        <div className="card-title"><i className="ti ti-key"/> Credenciais</div>
        <div style={{background:"var(--surface2)",borderRadius:8,padding:"12px 14px",fontSize:13,color:"var(--muted)"}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            Senha padrão:
            <code style={{color:"var(--brand)",background:"var(--brand-soft)",padding:"2px 8px",borderRadius:4,letterSpacing:mostrarSenha?"normal":2}}>
              {mostrarSenha?"LA@2025":"••••••••"}
            </code>
            <button type="button" onClick={()=>setMostrarSenha(v=>!v)} style={{background:"none",border:"none",color:"var(--muted)",cursor:"pointer",fontSize:15,padding:2,display:"flex",alignItems:"center"}} title={mostrarSenha?"Ocultar":"Mostrar"}>
              <i className={`ti ti-eye${mostrarSenha?"-off":""}`}/>
            </button>
          </div>
          <div style={{marginTop:6}}>URL: <code style={{color:"var(--brand)"}}>app.laautomoveis.com.br</code></div>
        </div>
      </div>
    </div>
  );
}
