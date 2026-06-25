import { useState, useEffect } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { getUser, logout, isManager, isOwner } from "../auth.js";
import { getAgenda } from "../api.js";

export default function Layout({ children }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [agendaHoje, setAgendaHoje] = useState(0);
  const [notif, setNotif] = useState(null);
  const navigate = useNavigate();
  const user = getUser();

  useEffect(() => {
    const data = new Date().toISOString().split("T")[0];
    getAgenda(data).then(ags => {
      const ativos = ags.filter(a => a.status !== "cancelado" && a.status !== "realizado");
      setAgendaHoje(ativos.length);
    }).catch(() => {});
    const check = () => {
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
  }, []);

  function handleLogout() { logout(); navigate("/login"); }

  const navItems = [
    ...(isManager() ? [{ to:"/dashboard", icon:"ti-layout-dashboard", label:"Dashboard", section:"VISÃO GERAL" }] : []),
    { to:"/crm",       icon:"ti-target",        label:"CRM Pipeline", section:"COMERCIAL" },
    { to:"/followups", icon:"ti-clock",          label:"Follow-ups",   section:null },
    { to:"/agenda",    icon:"ti-calendar-event", label:"Agenda",       badge:agendaHoje||null, section:null },
    { to:"/veiculos",  icon:"ti-car",            label:"Veículos",     section:"ESTOQUE" },
    { to:"/leads",     icon:"ti-message-circle", label:"Leads do site",section:"FORMULÁRIOS" },
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

  return (
    <div className="app-layout">
      {notif && (
        <div className="notif-banner">
          <div className="notif-icon"><i className="ti ti-calendar-event"/></div>
          <div className="notif-body">
            <div className="notif-title">Test drive em {Math.round((new Date(notif.data_hora)-Date.now())/60000)} minutos!</div>
            <div className="notif-sub">{notif.cliente_nome} · {notif.veiculo}</div>
          </div>
          <div className="notif-hora">{fmtH(notif.data_hora)}</div>
          <button className="notif-close" onClick={()=>setNotif(null)}>×</button>
        </div>
      )}
      <div className={`sidebar-overlay ${menuOpen?"show":""}`} onClick={()=>setMenuOpen(false)}/>
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
            : <NavLink key={s.to} to={s.to} className={({isActive})=>`nav-item ${isActive?"active":""}`} onClick={()=>setMenuOpen(false)}>
                <i className={`ti ${s.icon}`}/><span>{s.label}</span>
                {s.badge ? <span className="nav-badge">{s.badge}</span> : null}
              </NavLink>
          )}
        </nav>
        <div className="sidebar-footer">
          <div className="user-info">
            <div className="avatar">{user?.iniciais||"??"}</div>
            <div style={{flex:1,minWidth:0}}>
              <div className="user-name">{user?.nome}</div>
              <div className="user-role">{user?.role==="owner"?"Proprietário":user?.role==="manager"?"Gerente":"Vendedor"}</div>
            </div>
            <button onClick={handleLogout} style={{background:"none",border:"none",color:"var(--muted)",cursor:"pointer",fontSize:18}}>
              <i className="ti ti-logout"/>
            </button>
          </div>
        </div>
      </aside>
      <header className="topbar-mobile">
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <div className="logo-badge" style={{width:30,height:30,fontSize:11}}>LA</div>
          <span style={{fontSize:13,fontWeight:700,color:"var(--brand)",letterSpacing:"0.06em"}}>LA AUTOMÓVEIS</span>
        </div>
        <button className="menu-btn" onClick={()=>setMenuOpen(o=>!o)}>
          <i className={`ti ti-${menuOpen?"x":"menu-2"}`}/>
        </button>
      </header>
      <main className="main-content">{children}</main>
      <nav className="bottom-nav">
        {bottomItems.slice(0,5).map(b=>(
          <NavLink key={b.to} to={b.to} className={({isActive})=>`bnav-btn ${isActive?"active":""}`}>
            <i className={`ti ${b.icon}`}/><span>{b.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
