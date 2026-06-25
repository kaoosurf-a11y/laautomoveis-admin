import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { login } from "../auth.js";

export default function Login() {
  const [usuario, setUsuario] = useState("");
  const [senha, setSenha]     = useState("");
  const [mostrar, setMostrar] = useState(false);
  const [erro, setErro]       = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleLogin(e) {
    e?.preventDefault();
    if (!usuario.trim() || !senha.trim()) { setErro("Preencha usuário e senha"); return; }
    setErro(""); setLoading(true);
    const r = await login(usuario, senha);
    setLoading(false);
    if (!r.ok) { setErro(r.erro || "Usuário ou senha incorretos"); return; }
    navigate(r.user.role === "agent" ? "/crm" : "/dashboard", { replace:true });
  }

  return (
    <div className="login-page">
      <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:12}}>
        <div style={{width:52,height:52,borderRadius:12,background:"linear-gradient(135deg,#C8A84B,#a88a35)",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,fontSize:17,color:"#0c0c0a",boxShadow:"0 2px 12px rgba(200,168,75,.35)"}}>LA</div>
        <div style={{textAlign:"center"}}>
          <div style={{fontSize:18,fontWeight:800,color:"var(--brand)",letterSpacing:"0.08em"}}>LA AUTOMÓVEIS</div>
          <div style={{fontSize:12,color:"var(--muted)",letterSpacing:"0.1em"}}>Multimarcas</div>
        </div>
      </div>
      <div className="login-card">
        <p className="login-titulo">Painel Administrativo</p>
        {erro && <div className="login-erro"><i className="ti ti-alert-circle" style={{fontSize:16}}/>{erro}</div>}
        <div className="form-group">
          <label className="form-label">Usuário</label>
          <input className="form-input" type="text" placeholder="seu usuário" value={usuario}
            onChange={e=>setUsuario(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleLogin()}
            autoCapitalize="none" autoCorrect="off" spellCheck={false} autoComplete="username"/>
        </div>
        <div className="form-group">
          <label className="form-label">Senha</label>
          <div style={{position:"relative"}}>
            <input className="form-input" type={mostrar?"text":"password"} placeholder="sua senha" value={senha}
              onChange={e=>setSenha(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleLogin()}
              autoComplete="current-password" style={{paddingRight:44}}/>
            <button type="button" onClick={()=>setMostrar(v=>!v)}
              style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",color:"var(--muted)",cursor:"pointer",fontSize:18,padding:4,display:"flex"}}>
              <i className={`ti ti-eye${mostrar?"-off":""}`}/>
            </button>
          </div>
        </div>
        <button className="login-btn" onClick={handleLogin} disabled={loading}>
          {loading ? <span style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8}}><span className="spinner"/>Entrando...</span> : "Entrar"}
        </button>
        <button onClick={()=>window.open("https://wa.me/5549988599357?text=Preciso+redefinir+minha+senha+do+painel","_blank")}
          style={{display:"block",width:"100%",textAlign:"center",background:"none",border:"none",color:"var(--muted)",fontSize:13,cursor:"pointer",marginTop:14,padding:6}}>
          Esqueci minha senha
        </button>
      </div>
      <p className="login-footer">© {new Date().getFullYear()} LA Automóveis · Curitibanos/SC</p>
    </div>
  );
}
