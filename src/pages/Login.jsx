import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { login } from "../auth.js";
import { getTema, alternarTema } from "../theme.js";
import BaixarApp from "../components/BaixarApp.jsx";

export default function Login() {
  const [usuario,  setUsuario]  = useState("");
  const [senha,    setSenha]    = useState("");
  const [mostrar,  setMostrar]  = useState(false);
  // 2026-10-29 (Felipe: "entra antes de clicar em manter conectado"): o Enter/"Ir" do teclado
  // entrava com a caixa desmarcada. Agora já vem marcada (lembra a última escolha) e o Enter no
  // e-mail só passa pra senha.
  const [manter,   setManter]   = useState(() => { try { return localStorage.getItem("la_manter") !== "0"; } catch { return true; } });
  const senhaRef = useRef(null);
  const [erro,     setErro]     = useState("");
  const [loading,  setLoading]  = useState(false);
  const [tema,     setTema]     = useState(getTema);
  const navigate = useNavigate();

  async function handleLogin(e) {
    e?.preventDefault();
    if (!usuario.trim() || !senha.trim()) { setErro("Preencha e-mail e senha"); return; }
    setErro(""); setLoading(true);
    try { localStorage.setItem("la_manter", manter ? "1" : "0"); } catch {}
    const r = await login(usuario, senha, manter);
    setLoading(false);
    if (!r.ok) { setErro(r.erro || "E-mail ou senha incorretos"); return; }
    navigate(r.user.role === "vendedor" ? "/crm" : "/dashboard", { replace:true });
  }

  return (
    <div className="login-page">
      <button type="button" className="icon-btn login-tema" title={tema==="light"?"Usar tema escuro":"Usar tema claro"} aria-label={tema==="light"?"Usar tema escuro":"Usar tema claro"} onClick={()=>setTema(alternarTema())}>
        <i className={`ti ti-${tema==="light"?"moon":"sun"}`}/>
      </button>
      {/* logo */}
      <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:12}}>
        <img src="/logo-la-larga.png?v=2" alt="LA Multimarcas" width="180" height="85" style={{display:"block"}}/>
        <div style={{textAlign:"center"}}>
          <div style={{fontSize:20,fontWeight:700,color:"var(--fg)",letterSpacing:"0.03em",lineHeight:1.1}}>
            LA AUTOMÓVEIS
          </div>
          <div style={{fontSize:12,color:"var(--muted)",marginTop:4}}>
            CRM · Multimarcas
          </div>
        </div>
      </div>

      {/* card */}
      <div className="login-card">
        <p className="login-titulo">Painel Administrativo</p>

        {erro && (
          <div className="login-erro">
            <i className="ti ti-alert-circle" style={{fontSize:16}}/>{erro}
          </div>
        )}

        {/* e-mail */}
        <div className="form-group">
          <label className="form-label">E-mail</label>
          <input className="form-input" type="email" placeholder="seu e-mail" value={usuario}
            onChange={e=>setUsuario(e.target.value)} onKeyDown={e=>{ if (e.key==="Enter") { e.preventDefault(); senhaRef.current?.focus(); } }} enterKeyHint="next"
            autoCapitalize="none" autoCorrect="off" spellCheck={false} autoComplete="username"/>
        </div>

        {/* senha */}
        <div className="form-group">
          <label className="form-label">Senha</label>
          <div style={{position:"relative"}}>
            <input ref={senhaRef} className="form-input" type={mostrar?"text":"password"} placeholder="sua senha" value={senha}
              onChange={e=>setSenha(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleLogin()}
              autoComplete="current-password" enterKeyHint="go" style={{paddingRight:52}}/>
            {/* olho: mostra ou esconde a senha digitada */}
            <button type="button" onClick={()=>setMostrar(v=>!v)}
              aria-label={mostrar?"Esconder senha":"Mostrar senha"} title={mostrar?"Esconder senha":"Mostrar senha"}
              style={{position:"absolute",right:4,top:"50%",transform:"translateY(-50%)",width:44,height:44,
                background:"none",border:"none",color:mostrar?"var(--brand)":"var(--muted)",cursor:"pointer",fontSize:22,
                padding:0,display:"flex",alignItems:"center",justifyContent:"center",borderRadius:12}}>
              <i className={mostrar?"ti ti-eye-off":"ti ti-eye"}/>
            </button>
          </div>
        </div>

        {/* manter conectado: a linha toda é o botão */}
        <button type="button" role="checkbox" aria-checked={manter} onClick={()=>setManter(v=>!v)}
          style={{display:"flex",alignItems:"center",gap:10,margin:"0 0 12px",padding:"8px 0",width:"100%",
            background:"none",border:"none",cursor:"pointer",fontFamily:"inherit",textAlign:"left",
            WebkitTapHighlightColor:"transparent"}}>
          <span style={{
            width:22,height:22,borderRadius:"50%",flexShrink:0,
            border:`2px solid ${manter?"var(--brand-fill)":"var(--muted)"}`,
            background:manter?"var(--brand-fill)":"transparent",
            display:"flex",alignItems:"center",justifyContent:"center",
            transition:"all .15s",
          }}>
            {manter && <i className="ti ti-check" style={{fontSize:13,color:"var(--on-brand)",fontWeight:900}}/>}
          </span>
          <span style={{fontSize:13,color:manter?"var(--fg)":"var(--muted)",userSelect:"none"}}>Manter conectado</span>
        </button>

        {/* botão entrar */}
        <button className="login-btn" onClick={handleLogin} disabled={loading}>
          {loading
            ? <span style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
                <span className="spinner"/>Entrando...
              </span>
            : "Entrar"
          }
        </button>

        {/* esqueci senha */}
        <button onClick={()=>window.open("https://wa.me/5549988589357?text=Preciso+redefinir+minha+senha+do+painel","_blank")}
          style={{display:"block",width:"100%",textAlign:"center",background:"none",border:"none",
            color:"var(--muted)",fontSize:13,cursor:"pointer",marginTop:14,padding:6}}>
          Esqueci minha senha
        </button>
      </div>

      <BaixarApp tipo="login"/>

      <p className="login-footer">© {new Date().getFullYear()} LA Automóveis · Curitibanos/SC</p>
    </div>
  );
}
