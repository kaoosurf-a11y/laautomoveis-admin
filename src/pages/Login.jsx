import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { login } from "../auth.js";

export default function Login() {
  const [usuario,  setUsuario]  = useState("");
  const [senha,    setSenha]    = useState("");
  const [mostrar,  setMostrar]  = useState(false);
  const [manter,   setManter]   = useState(false);
  const [erro,     setErro]     = useState("");
  const [loading,  setLoading]  = useState(false);
  const navigate = useNavigate();

  async function handleLogin(e) {
    e?.preventDefault();
    if (!usuario.trim() || !senha.trim()) { setErro("Preencha usuário e senha"); return; }
    setErro(""); setLoading(true);
    const r = await login(usuario, senha, manter);
    setLoading(false);
    if (!r.ok) { setErro(r.erro || "Usuário ou senha incorretos"); return; }
    navigate(r.user.role === "agent" ? "/crm" : "/dashboard", { replace:true });
  }

  return (
    <div className="login-page">
      {/* logo */}
      <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:12}}>
        <div style={{
          width:58,height:58,borderRadius:14,
          background:"linear-gradient(135deg,#C8A84B,#a88a35)",
          display:"flex",alignItems:"center",justifyContent:"center",
          fontWeight:900,fontSize:19,color:"#0c0c0a",
          boxShadow:"0 2px 16px rgba(200,168,75,.4)",letterSpacing:1,
        }}>LA</div>
        <div style={{textAlign:"center"}}>
          <div style={{fontSize:19,fontWeight:900,color:"var(--brand)",letterSpacing:"0.08em",lineHeight:1.1}}>
            LA AUTOMÓVEIS
          </div>
          <div style={{fontSize:11,color:"var(--muted)",letterSpacing:"0.18em",marginTop:2}}>
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

        {/* usuário */}
        <div className="form-group">
          <label className="form-label">Usuário</label>
          <input className="form-input" type="text" placeholder="seu usuário" value={usuario}
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
            width:20,height:20,borderRadius:5,flexShrink:0,cursor:"pointer",
            border:`2px solid ${manter?"#C8A84B":"var(--border)"}`,
            background:manter?"#C8A84B":"transparent",
            display:"flex",alignItems:"center",justifyContent:"center",
            transition:"all .15s",
          }}>
            {manter && <i className="ti ti-check" style={{fontSize:13,color:"#0c0c0a",fontWeight:900}}/>}
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
        <button onClick={()=>window.open("https://wa.me/5549988599357?text=Preciso+redefinir+minha+senha+do+painel","_blank")}
          style={{display:"block",width:"100%",textAlign:"center",background:"none",border:"none",
            color:"var(--muted)",fontSize:13,cursor:"pointer",marginTop:14,padding:6}}>
          Esqueci minha senha
        </button>
      </div>

      <p className="login-footer">© {new Date().getFullYear()} LA Automóveis · Curitibanos/SC</p>
    </div>
  );
}
