import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { login } from "../auth.js";
import { getTema, alternarTema } from "../theme.js";

export default function Login() {
  const [usuario,  setUsuario]  = useState("");
  const [senha,    setSenha]    = useState("");
  const [mostrar,  setMostrar]  = useState(false);
  const [manter,   setManter]   = useState(false);
  const [erro,     setErro]     = useState("");
  const [loading,  setLoading]  = useState(false);
  const [tema,     setTema]     = useState(getTema);
  const navigate = useNavigate();

  async function handleLogin(e) {
    e?.preventDefault();
    if (!usuario.trim() || !senha.trim()) { setErro("Preencha e-mail e senha"); return; }
    setErro(""); setLoading(true);
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
        <div style={{
          width:60,height:60,borderRadius:16,
          background:"var(--brand-fill)",
          display:"flex",alignItems:"center",justifyContent:"center",
          fontWeight:700,fontSize:20,color:"var(--on-brand)",letterSpacing:.5,
        }}>LA</div>
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
            onChange={e=>setUsuario(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleLogin()}
            autoCapitalize="none" autoCorrect="off" spellCheck={false} autoComplete="username"/>
        </div>

        {/* senha */}
        <div className="form-group">
          <label className="form-label">Senha</label>
          <div style={{position:"relative"}}>
            <input className="form-input" type={mostrar?"text":"password"} placeholder="sua senha" value={senha}
              onChange={e=>setSenha(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleLogin()}
              autoComplete="current-password" style={{paddingRight:44}}/>
            <button type="button" onClick={()=>setMostrar(v=>!v)}
              style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",
                background:"none",border:"none",color:"var(--muted)",cursor:"pointer",fontSize:18,padding:4,display:"flex"}}>
              <i className={`ti ti-eye${mostrar?"-off":""}`}/>
            </button>
          </div>
        </div>

        {/* manter conectado */}
        <div style={{display:"flex",alignItems:"center",gap:10,margin:"4px 0 16px"}}>
          <div onClick={()=>setManter(v=>!v)} style={{
            width:22,height:22,borderRadius:"50%",flexShrink:0,cursor:"pointer",
            border:`2px solid ${manter?"var(--brand-fill)":"var(--muted)"}`,
            background:manter?"var(--brand-fill)":"transparent",
            display:"flex",alignItems:"center",justifyContent:"center",
            transition:"all .15s",
          }}>
            {manter && <i className="ti ti-check" style={{fontSize:13,color:"var(--on-brand)",fontWeight:900}}/>}
          </div>
          <span onClick={()=>setManter(v=>!v)}
            style={{fontSize:13,color:"var(--muted)",cursor:"pointer",userSelect:"none"}}>
            Manter conectado
          </span>
        </div>

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

      <p className="login-footer">© {new Date().getFullYear()} LA Automóveis · Curitibanos/SC</p>
    </div>
  );
}
