import { Routes, Route, Navigate } from "react-router-dom";
import { isLoggedIn, isManager } from "./auth.js";
import Layout from "./components/Layout.jsx";
import Login from "./pages/Login.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import CRM from "./pages/CRM.jsx";
import FollowUps from "./pages/FollowUps.jsx";
import Agenda from "./pages/Agenda.jsx";
import
cat > /opt/la-admin/src/index.css << 'EOF'
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent}
:root{
  --bg:#0c0c0a;--surface:#161614;--surface2:#1e1e1c;--border:rgba(255,255,255,0.07);
  --brand:#C8A84B;--brand2:#a88a35;--danger:#e05252;--success:#4caf7d;--warning:#e6a817;
  --fg:#f0ede6;--muted:#6b6b66;--radius:10px;--radius-sm:6px;--radius-lg:14px;
  --font:-apple-system,BlinkMacSystemFont,"Segoe UI","SF Pro Display",sans-serif;
}
html{font-family:var(--font);background:var(--bg);color:var(--fg);font-size:16px;-webkit-font-smoothing:antialiased}
body{min-height:100dvh}
::-webkit-scrollbar{width:4px;height:4px}
::-webkit-scrollbar-thumb{background:var(--border);border-radius:99px}
.app-layout{display:flex;min-height:100dvh}
.main-content{flex:1;min-width:0;padding:20px 20px 80px}
@media(min-width:1024px){.main-content{margin-left:220px;padding:24px 32px 40px}}
.sidebar{position:fixed;left:0;top:0;height:100dvh;width:220px;background:var(--surface);border-right:1px solid var(--border);display:flex;flex-direction:column;z-index:200;transform:translateX(-100%);transition:transform .25s ease;overflow-y:auto}
.sidebar.open{transform:translateX(0);box-shadow:4px 0 20px rgba(0,0,0,.4)}
@media(min-width:1024px){.sidebar{transform:translateX(0)!important;box-shadow:none}}
.sidebar-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:199}
.sidebar-overlay.show{display:block}
.sidebar-header{padding:20px 16px 14px;border-bottom:1px solid var(--border)}
.logo-wrap{display:flex;align-items:center;gap:10px}
.logo-badge{width:36px;height:36px;border-radius:9px;flex-shrink:0;background:linear-gradient(135deg,#C8A84B,#a88a35);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:13px;color:#0c0c0a;box-shadow:0 2px 8px rgba(200,168,75,.3)}
.logo-name{font-size:13px;font-weight:700;color:var(--fg);letter-spacing:.06em}
.logo-sub{font-size:10px;color:var(--muted);letter-spacing:.1em}
.sidebar-nav{flex:1;padding:12px 8px}
.nav-section{font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.1em;font-weight:600;padding:14px 8px 4px}
.nav-item{display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:8px;cursor:pointer;color:var(--muted);font-size:13px;font-weight:500;transition:background .15s,color .15s;text-decoration:none;min-height:36px}
.nav-item:hover{background:var(--surface2);color:var(--fg)}
.nav-item.active{background:rgba(200,168,75,.12);color:var(--brand)}
.nav-item i{font-size:17px;flex-shrink:0}
.nav-badge{margin-left:auto;background:var(--brand);color:#0c0c0a;font-size:10px;font-weight:700;min-width:18px;height:18px;border-radius:99px;display:flex;align-items:center;justify-content:center;padding:0 4px}
.sidebar-footer{padding:12px 8px;border-top:1px solid var(--border)}
.user-info{display:flex;align-items:center;gap:10px;padding:8px}
.avatar{width:32px;height:32px;border-radius:50%;background:rgba(200,168,75,.15);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:var(--brand);flex-shrink:0}
.user-name{font-size:13px;font-weight:600;color:var(--fg);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.user-role{font-size:10px;color:var(--muted)}
.topbar-mobile{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;background:var(--surface);border-bottom:1px solid var(--border);position:sticky;top:0;z-index:100}
@media(min-width:1024px){.topbar-mobile{display:none}}
.menu-btn{background:none;border:none;color:var(--fg);cursor:pointer;padding:4px;font-size:22px;display:flex}
.bottom-nav{display:none;position:fixed;bottom:0;left:0;right:0;background:var(--surface);border-top:1px solid var(--border);padding-bottom:max(8px,env(safe-area-inset-bottom));z-index:50}
@media(max-width:1023px){.bottom-nav{display:flex}}
.bnav-btn{flex:1;display:flex;flex-direction:column;align-items:center;gap:2px;padding:8px 4px 6px;font-size:10px;color:var(--muted);background:none;border:none;cursor:pointer;min-height:52px;text-decoration:none}
.bnav-btn i{font-size:22px}
.bnav-btn.active{color:var(--brand)}
.card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-lg);padding:16px}
.card-title{font-size:13px;font-weight:600;color:var(--muted);margin-bottom:14px;display:flex;align-items:center;gap:6px}
.card-title i{font-size:16px}
.metrics-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:8px}
@media(min-width:480px){.metrics-grid{grid-template-columns:repeat(3,1fr)}}
@media(min-width:1024px){.metrics-grid{grid-template-columns:repeat(6,1fr)}}
.metric-card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-lg);padding:12px 10px 10px;min-width:0;overflow:hidden}
.metric-label{font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px;display:flex;align-items:center;gap:4px}
.metric-label i{font-size:12px}
.metric-value{font-size:22px;font-weight:700;color:var(--brand);line-height:1;white-space:nowrap}
.metric-delta{font-size:10px;color:var(--muted);margin-top:4px}
.metric-delta.up{color:var(--success)}.metric-delta.down{color:var(--danger)}
.page-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;flex-wrap:wrap;gap:10px}
.page-title{font-size:20px;font-weight:700;color:var(--fg);display:flex;align-items:center;gap:8px}
.page-title i{font-size:22px;color:var(--brand)}
.btn{display:inline-flex;align-items:center;gap:6px;padding:8px 14px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;border:none;transition:opacity .15s,transform .1s;min-height:36px;white-space:nowrap;text-decoration:none}
.btn:active{transform:scale(.98)}
.btn-primary{background:linear-gradient(135deg,#C8A84B,#a88a35);color:#0c0c0a;box-shadow:0 2px 8px rgba(200,168,75,.25)}
.btn-primary:hover{opacity:.9}
.btn-ghost{background:var(--surface2);color:var(--fg);border:1px solid var(--border)}
.btn-ghost:hover{background:rgba(255,255,255,.05)}
.btn-danger{background:rgba(224,82,82,.15);color:var(--danger);border:1px solid rgba(224,82,82,.2)}
.btn-icon{padding:6px;min-height:32px;min-width:32px;justify-content:center}
.form-group{margin-bottom:14px}
.form-label{display:block;font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.07em;font-weight:500;margin-bottom:5px}
.form-input{width:100%;padding:10px 12px;background:var(--surface2);border:1px solid var(--border);border-radius:8px;color:var(--fg);font-size:16px;outline:none;transition:border-color .15s;-webkit-appearance:none}
.form-input:focus{border-color:var(--brand);box-shadow:0 0 0 2px rgba(200,168,75,.1)}
.form-grid{display:grid;grid-template-columns:1fr;gap:12px}
@media(min-width:480px){.form-grid{grid-template-columns:1fr 1fr}}
.table-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch}
table{width:100%;border-collapse:collapse;font-size:13px}
th{text-align:left;font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.07em;padding:10px 12px;border-bottom:1px solid var(--border);white-space:nowrap}
td{padding:12px;border-bottom:1px solid var(--border);color:var(--fg);vertical-align:middle}
tr:last-child td{border-bottom:none}
tr:hover td{background:rgba(255,255,255,.02)}
.badge{display:inline-flex;align-items:center;gap:4px;font-size:11px;padding:3px 9px;border-radius:99px;font-weight:500;white-space:nowrap}
.badge-brand{background:rgba(200,168,75,.15);color:var(--brand)}
.badge-success{background:rgba(76,175,125,.15);color:var(--success)}
.badge-danger{background:rgba(224,82,82,.15);color:var(--danger)}
.badge-warning{background:rgba(230,168,23,.15);color:var(--warning)}
.badge-muted{background:rgba(107,107,102,.15);color:var(--muted)}
.av{width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;flex-shrink:0}
.kanban-board{display:flex;gap:12px;overflow-x:auto;padding-bottom:12px;-webkit-overflow-scrolling:touch}
.kanban-col{flex-shrink:0;width:240px}
.kanban-col-header{display:flex;align-items:center;justify-content:space-between;padding:10px 12px;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius) var(--radius) 0 0;border-bottom:none}
.kanban-col-title{font-size:12px;font-weight:600;color:var(--fg)}
.kanban-col-count{font-size:11px;color:var(--muted);background:var(--surface2);padding:1px 7px;border-radius:99px}
.kanban-cards{background:var(--surface2);border:1px solid var(--border);border-radius:0 0 var(--radius) var(--radius);padding:8px;min-height:80px;display:flex;flex-direction:column;gap:8px}
.kanban-card{background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:10px;cursor:pointer;transition:border-color .15s}
.kanban-card:hover{border-color:rgba(200,168,75,.3)}
.kanban-card-nome{font-size:13px;font-weight:600;color:var(--fg);margin-bottom:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.kanban-card-veiculo{font-size:11px;color:var(--muted);margin-bottom:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.kanban-card-footer{display:flex;align-items:center;justify-content:space-between}
.score-pill{font-size:10px;font-weight:700;padding:2px 7px;border-radius:99px}
.crm-list{display:flex;flex-direction:column;gap:8px}
.crm-list-item{background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:12px;display:flex;align-items:center;gap:10px;cursor:pointer}
.crm-list-nome{font-size:13px;font-weight:600;color:var(--fg);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.crm-list-sub{font-size:11px;color:var(--muted);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.fu-item{display:flex;align-items:center;gap:10px;padding:12px 0;border-bottom:1px solid var(--border);flex-wrap:wrap}
.fu-item:last-child{border-bottom:none}
.fu-info{flex:1;min-width:0}
.fu-nome{font-size:13px;font-weight:600;color:var(--fg);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.fu-sub{font-size:11px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.fu-actions{display:flex;gap:6px;flex-shrink:0}
.agenda-card{background:var(--surface);border-radius:12px;padding:14px;margin-bottom:10px;border-left:3px solid var(--border)}
.agenda-card.confirmado{border-color:var(--success)}
.agenda-card.pendente{border-color:var(--warning)}
.agenda-card.em_breve{border-color:var(--brand);animation:pulse-border 2s ease-in-out infinite}
.agenda-card.realizado{border-color:var(--muted);opacity:.7}
.agenda-card.cancelado{border-color:var(--danger);opacity:.6}
@keyframes pulse-border{0%,100%{box-shadow:0 0 0 0 rgba(200,168,75,.3)}50%{box-shadow:0 0 0 4px rgba(200,168,75,0)}}
.notif-banner{position:fixed;top:12px;left:12px;right:12px;z-index:500;background:var(--surface);border:1px solid var(--brand);border-left:4px solid var(--brand);border-radius:10px;padding:10px 12px;display:flex;align-items:center;gap:10px;box-shadow:0 4px 20px rgba(0,0,0,.5);animation:slideDown .25s ease;max-width:440px;margin:0 auto}
@keyframes slideDown{from{transform:translateY(-10px);opacity:0}to{transform:translateY(0);opacity:1}}
.notif-icon{width:36px;height:36px;background:rgba(200,168,75,.15);border-radius:8px;display:flex;align-items:center;justify-content:center;color:var(--brand);font-size:18px;flex-shrink:0}
.notif-body{flex:1;min-width:0}
.notif-title{font-size:13px;font-weight:700;color:var(--fg);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.notif-sub{font-size:11px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.notif-hora{font-size:17px;font-weight:700;color:var(--brand);flex-shrink:0;white-space:nowrap}
.notif-close{background:none;border:none;color:var(--muted);font-size:18px;cursor:pointer;padding:4px;flex-shrink:0}
.funnel-step{display:flex;align-items:center;gap:10px;margin-bottom:10px}
.funnel-label{font-size:12px;color:var(--fg);flex:1.5;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.funnel-track{flex:2;background:var(--surface2);border-radius:99px;height:6px;overflow:hidden;min-width:60px}
.funnel-bar{height:6px;border-radius:99px;background:var(--brand);transition:width .4s}
.funnel-num{font-size:12px;font-weight:600;color:var(--fg);min-width:24px;text-align:right}
.funnel-pct{font-size:11px;color:var(--muted);min-width:36px;text-align:right}
.veiculo-card{display:flex;gap:12px;padding:12px;background:var(--surface);border:1px solid var(--border);border-radius:12px;margin-bottom:8px;align-items:flex-start}
.veiculo-foto{width:80px;height:60px;object-fit:cover;border-radius:8px;flex-shrink:0;background:var(--surface2)}
.veiculo-info{flex:1;min-width:0}
.veiculo-nome{font-size:13px;font-weight:600;color:var(--fg);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.veiculo-preco{font-size:15px;font-weight:700;color:var(--brand);margin:2px 0}
.veiculo-sub{font-size:11px;color:var(--muted)}
.modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:300;display:flex;align-items:flex-end;justify-content:center}
@media(min-width:768px){.modal-overlay{align-items:center}}
.modal{background:var(--surface);border-radius:20px 20px 0 0;padding:20px 16px;padding-bottom:calc(20px + env(safe-area-inset-bottom));width:100%;max-height:92dvh;overflow-y:auto;-webkit-overflow-scrolling:touch}
@media(min-width:768px){.modal{border-radius:16px;max-width:480px;padding:24px}}
.modal-handle{width:40px;height:4px;background:var(--border);border-radius:2px;margin:0 auto 16px}
@media(min-width:768px){.modal-handle{display:none}}
.modal-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:20px}
.modal-title{font-size:16px;font-weight:700;color:var(--fg)}
.login-page{min-height:100dvh;background:var(--bg);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px 20px;gap:28px}
.login-card{width:100%;max-width:380px;background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:28px 24px;box-shadow:0 8px 32px rgba(0,0,0,.4)}
.login-titulo{font-size:15px;font-weight:600;color:var(--fg);text-align:center;margin-bottom:20px}
.login-btn{width:100%;padding:13px;background:linear-gradient(135deg,#C8A84B,#a88a35);color:#0c0c0a;font-weight:700;font-size:15px;border:none;border-radius:8px;cursor:pointer;margin-top:4px;box-shadow:0 2px 8px rgba(200,168,75,.3);transition:opacity .15s;min-height:48px}
.login-btn:hover{opacity:.9}.login-btn:disabled{opacity:.7;cursor:not-allowed}
.login-footer{font-size:12px;color:var(--muted);text-align:center}
.login-erro{display:flex;align-items:center;gap:8px;background:rgba(224,82,82,.10);border:1px solid rgba(224,82,82,.25);border-radius:8px;padding:10px 12px;margin-bottom:16px;font-size:13px;color:#ff8888}
.sec-label{font-size:11px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.07em;margin:20px 0 10px}
.tabs-wrap{display:flex;border-bottom:1px solid var(--border);margin-bottom:16px;overflow-x:auto;scrollbar-width:none;-webkit-overflow-scrolling:touch}
.tabs-wrap::-webkit-scrollbar{display:none}
.tab-btn{padding:10px 16px;font-size:13px;font-weight:500;cursor:pointer;color:var(--muted);background:none;border:none;border-bottom:2px solid transparent;margin-bottom:-1px;white-space:nowrap;min-height:44px;transition:color .15s}
.tab-btn.active{color:var(--brand);border-bottom-color:var(--brand)}
.spinner{width:16px;height:16px;border:2px solid rgba(0,0,0,.2);border-top-color:#0c0c0a;border-radius:50%;animation:spin .6s linear infinite;display:inline-block}
@keyframes spin{to{transform:rotate(360deg)}}
.btn-wa{color:#25D366;font-size:13px;font-weight:600;display:flex;align-items:center;gap:4px;background:rgba(37,211,102,.08);border:1px solid rgba(37,211,102,.2);padding:5px 10px;border-radius:8px;cursor:pointer;text-decoration:none;white-space:nowrap;min-height:32px}
.empty-state{text-align:center;padding:40px 20px;color:var(--muted)}
.empty-state i{font-size:40px;margin-bottom:10px;display:block}
.empty-state p{font-size:14px}
.foto-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:8px}
@media(min-width:480px){.foto-grid{grid-template-columns:repeat(3,1fr)}}
@media(min-width:768px){.foto-grid{grid-template-columns:repeat(4,1fr)}}
.foto-slot{aspect-ratio:4/3;border-radius:10px;border:1.5px dashed var(--border);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;cursor:pointer;font-size:11px;color:var(--muted);transition:border-color .15s;position:relative;overflow:hidden;min-height:70px}
.foto-slot.capa{border-color:rgba(200,168,75,.4);background:rgba(200,168,75,.04)}
.foto-slot.filled img{width:100%;height:100%;object-fit:cover;position:absolute;inset:0;border-radius:8px}
.foto-slot-check{position:absolute;top:4px;right:4px;background:var(--success);color:white;border-radius:50%;width:16px;height:16px;display:flex;align-items:center;justify-content:center;font-size:10px}
.dias-nav{display:flex;align-items:center;gap:8px;margin-bottom:16px}
.dia-btn{flex:1;padding:8px 4px;text-align:center;border-radius:8px;cursor:pointer;border:1px solid var(--border);background:none;color:var(--muted);font-size:12px;transition:all .15s;min-height:52px}
.dia-btn.hoje{border-color:var(--brand);color:var(--brand);background:rgba(200,168,75,.08);font-weight:600}
.dia-btn.selected{background:var(--brand);color:#0c0c0a;border-color:var(--brand);font-weight:700}
.dia-num{font-size:18px;font-weight:700;display:block}
.dia-nome{font-size:10px;display:block}
.d-mobile{display:flex;flex-direction:column}
.d-desktop{display:none}
@media(min-width:768px){.d-mobile{display:none}.d-desktop{display:block}}
*{max-width:100%}
img{max-width:100%}
