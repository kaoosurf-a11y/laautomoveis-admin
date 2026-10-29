import { useState, useEffect } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { getUser, logout, isManager, isOwner, estaVendoComo, getDono, voltarParaMim, atualizarUsuario, sincronizarFoto } from "../auth.js";
import { getAgenda, enviarMinhaFoto, removerMinhaFoto } from "../api.js";
import { getTema, alternarTema } from "../theme.js";
import BaixarApp from "./BaixarApp.jsx";
import Avisos from "./Avisos.jsx";
import PrimeiraVez from "./PrimeiraVez.jsx";
import { sincronizarAvisos, desligarAvisosDoAparelho } from "../lib/avisos.js";

export default function Layout({ children }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [agendaHoje, setAgendaHoje] = useState(0);
  const [notif, setNotif] = useState(null);
  const [notifDismissed, setNotifDismissed] = useState(false);
  const [perfilModal, setPerfilModal] = useState(false);
  // Foto de perfil: re-renderiza quando a foto muda (o usuário fica guardado na sessão, não em estado).
  const [, setFotoVersao] = useState(0);
  useEffect(() => { sincronizarFoto().then(u => { if (u) setFotoVersao(v => v + 1); }); }, []);
  const [tema, setTema] = useState(getTema);
  const navigate = useNavigate();
  const user = getUser();

  const ehMeu = ag => user?.role !== "vendedor" || ag.vendedor_id === user?.id;
  useEffect(() => {
    const data = new Date().toISOString().split("T")[0];
    getAgenda(data).then(ags => {
      const CONCLUIDOS = ["cancelado","realizado","realizado_comprou","realizado_nao_comprou"];
      // "bloqueio" é horário pessoal do vendedor (almoço, indisponibilidade) — mesma
      // exclusão já aplicada no filtro de notificação abaixo, só que faltava aqui,
      // inflando esse número com compromissos que não são de cliente nenhum.
      // 19/10: vendedor agora vê a agenda da loja inteira; o número e o aviso continuam só dos dele.
      const ativos = ags.filter(a => !CONCLUIDOS.includes(a.status) && a.tipo !== "bloqueio" && !a.ocupado && ehMeu(a));
      setAgendaHoje(ativos.length);
    }).catch(() => {});

    const check = () => {
      if (notifDismissed) return;
      getAgenda(new Date().toISOString().split("T")[0]).then(ags => {
        const agora = Date.now();
        const em30 = agora + 30*60*1000;
        const prox = ags.filter(ag => {
          const t = new Date(ag.data_hora).getTime();
          return t > agora && t <= em30 && ag.status === "confirmado" && TIPOS_NOTIF[ag.tipo] && ehMeu(ag);
        });
        if (prox.length > 0) setNotif(prox[0]);
      }).catch(() => {});
    };
    check();
    const iv = setInterval(check, 60000);
    return () => clearInterval(iv);
  }, [notifDismissed]);

  // Sair desliga os avisos deste aparelho antes (outra pessoa que logar no mesmo celular não recebe os seus).
  async function handleLogout() { await desligarAvisosDoAparelho(); logout(); navigate("/login"); }
  // Avisos do app: liga o aparelho a quem está logado e, ao tocar num aviso com o painel aberto, vai pra tela dele.
  useEffect(() => { sincronizarAvisos(); }, []);
  useEffect(() => {
    const abrir = e => { try { const u = new URL(e.detail); navigate((u.pathname.replace(/^\/admin/, "") || "/") + u.search); } catch {} };
    window.addEventListener("la-abrir", abrir);
    return () => window.removeEventListener("la-abrir", abrir);
  }, [navigate]);
  // "Ver como": só um olho ao lado do sol (Felipe 28/10: a tela fica igual à do usuário). Clicar volta pro dono.
  const vendoComo = estaVendoComo();
  function handleVoltar() { if (voltarParaMim()) window.location.href = "/equipe"; }

  const navItems = [
    ...(isManager() ? [{ to:"/dashboard", icon:"ti-layout-dashboard", label:"Dashboard", section:"VISÃO GERAL" }] : []),
    // Resultado mensal (2026-10-07): leads, vendas e verba mês a mês, por loja. Só admin_master.
    ...(isOwner() ? [{ to:"/mensal", icon:"ti-report-analytics", label:"Resultado mensal", section:null }] : []),
    // Mapa do site (2026-10-29): mapa de calor dos dois sites. Só admin_master.
    ...(isOwner() ? [{ to:"/site", icon:"ti-flame", label:"Mapa do site", section:null }] : []),
    { to:"/rotina",    icon:"ti-list-check",    label:"Rotina do dia", section:"COMERCIAL" },
    { to:"/crm",       icon:"ti-target",        label:"CRM Pipeline", section:null },
    { to:"/followups", icon:"ti-clock",          label:"Follow-ups",   section:null },
    { to:"/agenda",    icon:"ti-calendar-event", label:"Agenda",       badge:agendaHoje||null, section:null },
    { to:"/veiculos",  icon:"ti-car",            label:"Veículos",     section:"ESTOQUE" },
    // Disparador (2026-07-16): contatos AINDA na campanha de reativação, antes de
    // validação — aba separada de Clientes por pedido explícito (fases diferentes
    // da jornada, mesmo par de permissão).
    ...(isManager() ? [{ to:"/campanha", icon:"ti-speakerphone", label:"Promoções", section:"ADMIN" }] : []),
    ...(isManager() ? [{ to:"/disparador", icon:"ti-send", label:"Disparador", section:"ADMIN" }] : []),
    // Status (2026-07-18, removida do menu 2026-07-19): Status/Stories automático da
    // Lara no WhatsApp — pausada e removida da navegação após incidente real de
    // instabilidade de conexão (loop de conflito Baileys, ver memória do projeto).
    // Código da página (Status.jsx) e rota mantidos no repositório, só não navegáveis.
    // Clientes (2026-07-16): clientes validados (compraram ou confirmados manualmente
    // da campanha de reativação) — visão distinta do CRM Pipeline (funil de leads
    // ativos). 2026-07-20: restrito a admin_master por pedido explícito (Felipe só,
    // por ora) — gerente perdeu acesso.
    ...(isOwner() ? [{ to:"/clientes", icon:"ti-users-group", label:"Clientes", section:"ADMIN" }] : []),
    ...(isOwner() ? [{ to:"/equipe", icon:"ti-users", label:"Equipe", section:"ADMIN" }] : []),
    ...(isOwner() ? [{ to:"/lojas", icon:"ti-building-store", label:"Lojas", section:"ADMIN" }] : []),
    // Envios (2026-09-24): central de envios proativos, somente leitura, so admin_master (decisao do Felipe).
    ...(isOwner() ? [{ to:"/envios", icon:"ti-calendar-time", label:"Envios", section:"ADMIN" }] : []),
    // Contatos perdidos: 2026-07-20 restrito a admin_master (mesmo motivo de Clientes acima).
    ...(isOwner() ? [{ to:"/contatos-perdidos", icon:"ti-alert-triangle", label:"Contatos perdidos", section:null }] : []),
  ];

  const sections = [];
  let cur = null;
  navItems.forEach(item => {
    if (item.section && item.section !== cur) { cur = item.section; sections.push({ type:"section", label:item.section }); }
    sections.push({ type:"item", ...item });
  });

  const bottomItems = [
    { to:"/rotina",    icon:"ti-list-check",       label:"Rotina"    },
    { to:"/crm",       icon:"ti-target",          label:"CRM"       },
    { to:"/followups", icon:"ti-clock",            label:"Follow-up" },
    { to:"/agenda",    icon:"ti-calendar-event",   label:"Agenda"    },
    // Rotina do dia (29/10) entrou na frente; a barra só tem 5 lugares: gerente e admin trocam Veículos pelo Dash.
    ...(isManager() ? [{ to:"/dashboard", icon:"ti-layout-dashboard", label:"Dash" }] : [{ to:"/veiculos", icon:"ti-car", label:"Veículos" }]),
  ];

  const fmtH = iso => { const d=new Date(iso); return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`; };
  const minAte = iso => Math.round((new Date(iso)-Date.now())/60000);

  // Só agendamentos reais de cliente disparam a notificação — "bloqueio" é horário
  // pessoal do vendedor (almoço, indisponibilidade) e nunca deve aparecer aqui.
  const TIPOS_NOTIF = {
    test_drive:        { label: "Test drive",         icon: "ti-car" },
    visita_patio:       { label: "Visita ao pátio",     icon: "ti-building-store" },
    apresentacao:       { label: "Apresentação",        icon: "ti-clipboard-list" },
    reuniao_fechamento: { label: "Reunião de fechamento", icon: "ti-heart-handshake" },
  };

  return (
    <div className="app-layout">
      {/* Overlay sidebar mobile */}
      <div className={`sidebar-overlay ${menuOpen?"show":""}`} onClick={() => setMenuOpen(false)}/>

      {/* Sidebar */}
      <aside className={`sidebar ${menuOpen?"open":""}`}>
        <div className="sidebar-header">
          {/* 2026-10-18 (Felipe): clicar na logo leva à tela inicial do perfil ("/" já
              redireciona: painel para gerente/admin, CRM para vendedor). */}
          <div className="logo-wrap" role="link" tabIndex={0} title="Tela inicial" style={{cursor:"pointer"}}
            onClick={() => { setMenuOpen(false); navigate("/"); }}
            onKeyDown={e => { if (e.key === "Enter") { setMenuOpen(false); navigate("/"); } }}>
            <img className="logo-badge logo-img" src="/logo-la.png?v=2" alt="LA"/>
            <div><div className="logo-name">LA AUTOMÓVEIS</div><div className="logo-sub">Multimarcas</div></div>
          </div>
        </div>
        <nav className="sidebar-nav">
          {sections.map((s,i) => s.type==="section"
            ? <div key={i} className="nav-section">{s.label}</div>
            : <NavLink key={s.to} to={s.to} className={({isActive})=>`nav-item ${isActive?"active":""}`} onClick={() => setMenuOpen(false)}>
                <i className={`ti ${s.icon}`}/><span>{s.label}</span>
                {s.badge ? <span className="nav-badge">{s.badge}</span> : null}
              </NavLink>
          )}
        </nav>
        <div className="sidebar-footer">
          <Avisos onAbrir={() => setMenuOpen(false)}/>
          <BaixarApp onAbrir={() => setMenuOpen(false)}/>
          <div className="tema-linha">
            <button type="button" className="nav-item tema-item" onClick={() => setTema(alternarTema())}>
              <i className={`ti ti-${tema==="light"?"moon":"sun"}`}/><span>{tema==="light"?"Tema escuro":"Tema claro"}</span>
            </button>
            {vendoComo && <button type="button" className="icon-btn vercomo-olho" aria-label="Voltar para o meu painel" onClick={handleVoltar}><i className="ti ti-eye"/></button>}
          </div>
          <div className="user-info" onClick={() => setPerfilModal(true)} style={{cursor:"pointer"}}>
            <div className="avatar">{user?.foto_url?<img src={user.foto_url} alt=""/>:(user?.iniciais||"??")}</div>
            <div style={{flex:1,minWidth:0}}>
              <div className="user-name">{user?.nome}</div>
              <div className="user-role">{user?.role==="admin_master"?"Proprietário":user?.role==="gerente"?"Gerente":"Vendedor"}</div>
            </div>
            <button className="icon-btn" title="Sair" aria-label="Sair" onClick={e=>{e.stopPropagation();handleLogout();}}>
              <i className="ti ti-logout"/>
            </button>
          </div>
        </div>
      </aside>

      {/* Topbar mobile */}
      <header className="topbar-mobile">
        <div style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer"}} role="link" title="Tela inicial" onClick={() => navigate("/")}>
          <img className="logo-badge logo-img" style={{width:32,height:32}} src="/logo-la.png?v=2" alt="LA"/>
          <span style={{fontSize:15,fontWeight:700,color:"var(--fg)",letterSpacing:"0.03em"}}>LA AUTOMÓVEIS</span>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:4}}>
          {vendoComo && <button type="button" className="icon-btn vercomo-olho" aria-label="Voltar para o meu painel" onClick={handleVoltar}><i className="ti ti-eye"/></button>}
          <button className="icon-btn" title={tema==="light"?"Usar tema escuro":"Usar tema claro"} aria-label={tema==="light"?"Usar tema escuro":"Usar tema claro"} onClick={() => setTema(alternarTema())}>
            <i className={`ti ti-${tema==="light"?"moon":"sun"}`}/>
          </button>
          <button className="icon-btn" title="Meu perfil" aria-label="Meu perfil" onClick={() => setPerfilModal(true)}>
            {user?.foto_url?<img className="topbar-foto" src={user.foto_url} alt=""/>:<i className="ti ti-user-circle"/>}
          </button>
          <button className="menu-btn" onClick={() => setMenuOpen(o=>!o)}>
            <i className={`ti ti-${menuOpen?"x":"menu-2"}`}/>
          </button>
        </div>
      </header>

      {/* Conteúdo */}
      <main className="main-content">
        <Avisos tipo="faixa"/>
        {children}
      </main>

      {/* Notificação — aparece ACIMA do bottom nav no mobile, no topo no desktop */}
      {notif && !notifDismissed && (
        <div className="notif-banner">
          <div className="notif-icon"><i className="ti ti-calendar-event"/></div>
          <div className="notif-body">
            <div className="notif-title"><i className={`ti ${TIPOS_NOTIF[notif.tipo]?.icon || "ti-alert-triangle"}`}/> {TIPOS_NOTIF[notif.tipo]?.label || "Agendamento"} em {minAte(notif.data_hora)} min!</div>
            <div className="notif-sub">
              {notif.cliente_nome}{notif.veiculo ? ` · ${notif.veiculo}` : ""}
              {notif.lead_estagio === "negociando" && <span className="badge" style={{marginLeft:6,fontSize:10,background:"var(--brand-soft)",color:"var(--brand)"}}>Em negociação</span>}
            </div>
          </div>
          <div className="notif-hora">{fmtH(notif.data_hora)}</div>
          <button className="notif-close" onClick={() => { setNotifDismissed(true); setNotif(null); }}>×</button>
        </div>
      )}

      {/* Bottom nav mobile */}
      <nav className="bottom-nav">
        {bottomItems.slice(0,5).map(b => (
          <NavLink key={b.to} to={b.to} className={({isActive}) => `bnav-btn ${isActive?"active":""}`}>
            <i className={`ti ${b.icon}`}/><span>{b.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Modal Perfil / Trocar senha */}
      <PrimeiraVez/>
      {perfilModal && <PerfilModal user={user} onClose={() => setPerfilModal(false)} onLogout={handleLogout} onFoto={() => setFotoVersao(v => v + 1)}/>}
    </div>
  );
}

function PerfilModal({ user, onClose, onLogout, onFoto }) {
  const [enviandoFoto, setEnviandoFoto] = useState(false);
  const [msgFoto, setMsgFoto] = useState(null);
  async function escolherFoto(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setMsgFoto(null); setEnviandoFoto(true);
    try { const { foto_url } = await enviarMinhaFoto(file); atualizarUsuario({ foto_url }); onFoto(); setMsgFoto({ tipo: "ok", texto: "Foto atualizada." }); }
    catch (err) { setMsgFoto({ tipo: "erro", texto: err.message }); }
    setEnviandoFoto(false);
  }
  async function tirarFoto() {
    setMsgFoto(null); setEnviandoFoto(true);
    try { await removerMinhaFoto(); atualizarUsuario({ foto_url: null }); onFoto(); }
    catch (err) { setMsgFoto({ tipo: "erro", texto: err.message }); }
    setEnviandoFoto(false);
  }
  const [senhaAtual, setSenhaAtual] = useState("");
  const [senhaNova, setSenhaNova] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null);
  const [mostrar, setMostrar] = useState(false);

  async function trocarSenha() {
    setMsg(null);
    if (!senhaAtual || !senhaNova || !confirmar) { setMsg({tipo:"erro",texto:"Preencha todos os campos."}); return; }
    if (senhaNova !== confirmar) { setMsg({tipo:"erro",texto:"Nova senha e confirmação não coincidem."}); return; }
    if (senhaNova.length < 6) { setMsg({tipo:"erro",texto:"Nova senha deve ter ao menos 6 caracteres."}); return; }
    setLoading(true);
    try {
      const API = import.meta.env.VITE_API_URL || "https://api.laautomoveis.com.br";
      const res = await fetch(`${API}/api/admin/trocar-senha`, {
        method:"POST",
        headers:{"Content-Type":"application/json","Authorization":`Bearer ${localStorage.getItem("la_token")}`},
        body: JSON.stringify({ senha_atual: senhaAtual, senha_nova: senhaNova }),
      });
      if (res.ok) {
        setMsg({tipo:"ok",texto:"Senha alterada com sucesso!"});
        setSenhaAtual(""); setSenhaNova(""); setConfirmar("");
      } else {
        const d = await res.json().catch(() => ({}));
        setMsg({tipo:"erro",texto:d.error||"Senha atual incorreta."});
      }
    } catch {
      setMsg({tipo:"erro",texto:"Erro de conexão. Tente novamente."});
    }
    setLoading(false);
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{maxWidth:400}} onClick={e=>e.stopPropagation()}>
        <div className="modal-handle"/>
        <div className="modal-header">
          <h2 className="modal-title">Meu perfil</h2>
          <button className="icon-btn" aria-label="Fechar" onClick={onClose}><i className="ti ti-x"/></button>
        </div>

        {/* Info do usuário */}
        <div style={{display:"flex",alignItems:"center",gap:14,padding:"14px 0 20px",borderBottom:"1px solid var(--border)",marginBottom:20}}>
          {/* 2026-10-18 (Felipe): foto escolhida da galeria (no celular, accept="image/*" abre galeria ou câmera). */}
          <label className="perfil-foto" title="Escolher foto da galeria">
            {user?.foto_url?<img src={user.foto_url} alt=""/>:<span>{user?.iniciais}</span>}
            <i className="ti ti-camera perfil-foto-cam"/>
            <input type="file" accept="image/*" onChange={escolherFoto} disabled={enviandoFoto} hidden/>
          </label>
          <div style={{minWidth:0}}>
            <div style={{fontSize:16,fontWeight:700,color:"var(--fg)"}}>{user?.nome}</div>
            <div style={{fontSize:13,color:"var(--muted)",marginTop:2}}>@{user?.usuario}</div>
            <div style={{fontSize:12,color:"var(--brand)",marginTop:2}}>{user?.role==="admin_master"?"Proprietário":user?.role==="gerente"?"Gerente":"Vendedor"}</div>
            <div className="perfil-foto-acoes">
              <label className="btn btn-ghost btn-sm" style={{opacity:enviandoFoto?.6:1}}>
                {enviandoFoto?<span className="spinner"/>:<i className="ti ti-photo"/>} {user?.foto_url?"Trocar foto":"Escolher foto"}
                <input type="file" accept="image/*" onChange={escolherFoto} disabled={enviandoFoto} hidden/>
              </label>
              {user?.foto_url&&<button type="button" className="btn btn-ghost btn-sm" onClick={tirarFoto} disabled={enviandoFoto}>Remover foto</button>}
            </div>
            {msgFoto&&<div style={{fontSize:12,marginTop:6,color:msgFoto.tipo==="erro"?"var(--danger)":"var(--success)"}}>{msgFoto.texto}</div>}
          </div>
        </div>

        {/* Trocar senha */}
        <div style={{fontSize:13,fontWeight:600,color:"var(--muted)",marginBottom:14,textTransform:"uppercase",letterSpacing:"0.07em"}}>Trocar senha</div>

        <div className="form-group">
          <label className="form-label">Senha atual</label>
          <div style={{position:"relative"}}>
            <input className="form-input" type={mostrar?"text":"password"} value={senhaAtual} onChange={e=>setSenhaAtual(e.target.value)} placeholder="Senha atual" style={{paddingRight:44}}/>
            <button type="button" onClick={()=>setMostrar(v=>!v)} style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",color:"var(--muted)",cursor:"pointer",fontSize:18,display:"flex"}}>
              <i className={`ti ti-eye${mostrar?"-off":""}`}/>
            </button>
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Nova senha</label>
          <input className="form-input" type={mostrar?"text":"password"} value={senhaNova} onChange={e=>setSenhaNova(e.target.value)} placeholder="Mínimo 6 caracteres"/>
        </div>
        <div className="form-group">
          <label className="form-label">Confirmar nova senha</label>
          <input className="form-input" type={mostrar?"text":"password"} value={confirmar} onChange={e=>setConfirmar(e.target.value)} placeholder="Repita a nova senha" onKeyDown={e=>e.key==="Enter"&&trocarSenha()}/>
        </div>

        {msg && (
          <div style={{padding:"10px 12px",borderRadius:8,marginBottom:14,fontSize:13,
            background: msg.tipo==="ok"?"var(--success-soft)":"var(--danger-soft)",
            color: msg.tipo==="ok"?"var(--success)":"var(--danger)",
            border:`1px solid ${msg.tipo==="ok"?"var(--success-line)":"var(--danger-line)"}`}}>
            <i className={`ti ti-${msg.tipo==="ok"?"check":"alert-circle"}`} style={{marginRight:6}}/>
            {msg.texto}
          </div>
        )}

        <button className="btn btn-primary" onClick={trocarSenha} disabled={loading} style={{width:"100%",marginBottom:10}}>
          {loading ? <span className="spinner"/> : <><i className="ti ti-lock"/> Alterar senha</>}
        </button>

        <button className="btn btn-danger" onClick={onLogout} style={{width:"100%"}}>
          <i className="ti ti-logout"/> Sair da conta
        </button>
      </div>
    </div>
  );
}
