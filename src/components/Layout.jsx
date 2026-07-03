import { useState, useEffect } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { getUser, logout, isManager, isOwner } from "../auth.js";
import { getAgenda } from "../api.js";

export default function Layout({ children }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [agendaHoje, setAgendaHoje] = useState(0);
  const [notif, setNotif] = useState(null);
  const [notifDismissed, setNotifDismissed] = useState(false);
  const [perfilModal, setPerfilModal] = useState(false);
  const navigate = useNavigate();
  const user = getUser();

  useEffect(() => {
    const data = new Date().toISOString().split("T")[0];
    getAgenda(data).then(ags => {
      const ativos = ags.filter(a => a.status !== "cancelado" && a.status !== "realizado");
      setAgendaHoje(ativos.length);
    }).catch(() => {});

    const check = () => {
      if (notifDismissed) return;
      getAgenda(new Date().toISOString().split("T")[0]).then(ags => {
        const agora = Date.now();
        const em30 = agora + 30*60*1000;
        const prox = ags.filter(ag => {
          const t = new Date(ag.data_hora).getTime();
          return t > agora && t <= em30 && ag.status === "confirmado";
        });
        if (prox.length > 0) setNotif(prox[0]);
      }).catch(() => {});
    };
    check();
    const iv = setInterval(check, 60000);
    return () => clearInterval(iv);
  }, [notifDismissed]);

  function handleLogout() { logout(); navigate("/login"); }

  const navItems = [
    ...(isManager() ? [{ to:"/dashboard", icon:"ti-layout-dashboard", label:"Dashboard", section:"VISÃO GERAL" }] : []),
    { to:"/crm",       icon:"ti-target",        label:"CRM Pipeline", section:"COMERCIAL" },
    { to:"/followups", icon:"ti-clock",          label:"Follow-ups",   section:null },
    { to:"/agenda",    icon:"ti-calendar-event", label:"Agenda",       badge:agendaHoje||null, section:null },
    { to:"/veiculos",  icon:"ti-car",            label:"Veículos",     section:"ESTOQUE" },
    ...(isOwner() ? [{ to:"/equipe", icon:"ti-users", label:"Equipe", section:"ADMIN" }] : []),
  ];

  const sections = [];
  let cur = null;
  navItems.forEach(item => {
    if (item.section && item.section !== cur) { cur = item.section; sections.push({ type:"section", label:item.section }); }
    sections.push({ type:"item", ...item });
  });

  const bottomItems = [
    { to:"/crm",       icon:"ti-target",          label:"CRM"       },
    { to:"/followups", icon:"ti-clock",            label:"Follow-up" },
    { to:"/agenda",    icon:"ti-calendar-event",   label:"Agenda"    },
    { to:"/veiculos",  icon:"ti-car",              label:"Veículos"  },
    ...(isManager() ? [{ to:"/dashboard", icon:"ti-layout-dashboard", label:"Dash" }] : []),
  ];

  const fmtH = iso => { const d=new Date(iso); return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`; };
  const minAte = iso => Math.round((new Date(iso)-Date.now())/60000);

  return (
    <div className="app-layout">
      {/* Overlay sidebar mobile */}
      <div className={`sidebar-overlay ${menuOpen?"show":""}`} onClick={() => setMenuOpen(false)}/>

      {/* Sidebar */}
      <aside className={`sidebar ${menuOpen?"open":""}`}>
        <div className="sidebar-header">
          <div className="logo-wrap">
            <div className="logo-badge">LA</div>
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
          <div className="user-info" onClick={() => setPerfilModal(true)} style={{cursor:"pointer"}}>
            <div className="avatar">{user?.iniciais||"??"}</div>
            <div style={{flex:1,minWidth:0}}>
              <div className="user-name">{user?.nome}</div>
              <div className="user-role">{user?.role==="owner"?"Proprietário":user?.role==="manager"?"Gerente":"Vendedor"}</div>
            </div>
            <button onClick={e=>{e.stopPropagation();handleLogout();}} style={{background:"none",border:"none",color:"var(--muted)",cursor:"pointer",fontSize:20,padding:6,display:"flex",alignItems:"center"}}>
              <i className="ti ti-logout"/>
            </button>
          </div>
        </div>
      </aside>

      {/* Topbar mobile */}
      <header className="topbar-mobile">
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div className="logo-badge" style={{width:32,height:32,fontSize:12}}>LA</div>
          <span style={{fontSize:14,fontWeight:700,color:"var(--brand)",letterSpacing:"0.06em"}}>LA AUTOMÓVEIS</span>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:4}}>
          <button onClick={() => setPerfilModal(true)} style={{background:"none",border:"none",color:"var(--muted)",cursor:"pointer",fontSize:22,padding:6,display:"flex",alignItems:"center"}}>
            <i className="ti ti-user-circle"/>
          </button>
          <button className="menu-btn" onClick={() => setMenuOpen(o=>!o)}>
            <i className={`ti ti-${menuOpen?"x":"menu-2"}`}/>
          </button>
        </div>
      </header>

      {/* Conteúdo */}
      <main className="main-content">{children}</main>

      {/* Notificação — aparece ACIMA do bottom nav no mobile, no topo no desktop */}
      {notif && !notifDismissed && (
        <div className="notif-banner">
          <div className="notif-icon"><i className="ti ti-calendar-event"/></div>
          <div className="notif-body">
            <div className="notif-title">⚠️ Test drive em {minAte(notif.data_hora)} min!</div>
            <div className="notif-sub">{notif.cliente_nome} · {notif.veiculo}</div>
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
      {perfilModal && <PerfilModal user={user} onClose={() => setPerfilModal(false)} onLogout={handleLogout}/>}
    </div>
  );
}

function PerfilModal({ user, onClose, onLogout }) {
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
          <button onClick={onClose} style={{background:"none",border:"none",color:"var(--muted)",fontSize:24,cursor:"pointer"}}><i className="ti ti-x"/></button>
        </div>

        {/* Info do usuário */}
        <div style={{display:"flex",alignItems:"center",gap:14,padding:"14px 0 20px",borderBottom:"1px solid var(--border)",marginBottom:20}}>
          <div style={{width:52,height:52,borderRadius:"50%",background:"rgba(200,168,75,.15)",color:"var(--brand)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,fontWeight:800,flexShrink:0}}>
            {user?.iniciais}
          </div>
          <div>
            <div style={{fontSize:16,fontWeight:700,color:"var(--fg)"}}>{user?.nome}</div>
            <div style={{fontSize:13,color:"var(--muted)",marginTop:2}}>@{user?.usuario}</div>
            <div style={{fontSize:12,color:"var(--brand)",marginTop:2}}>{user?.role==="owner"?"Proprietário":user?.role==="manager"?"Gerente":"Vendedor"}</div>
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
            background: msg.tipo==="ok"?"rgba(76,175,125,.12)":"rgba(224,82,82,.12)",
            color: msg.tipo==="ok"?"var(--success)":"var(--danger)",
            border:`1px solid ${msg.tipo==="ok"?"rgba(76,175,125,.3)":"rgba(224,82,82,.3)"}`}}>
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
