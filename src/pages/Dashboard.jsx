import { useEffect, useState } from "react";
import { api } from "../lib/api.js";

export default function Dashboard() {
  const [stats, setStats] = useState({ veiculos: 0, contatos: 0, financiamentos: 0, naoLidos: 0 });

  useEffect(() => {
    Promise.all([
      api.getVeiculos(),
      api.getLeadsContato(),
      api.getLeadsFinanciamento(),
    ]).then(([veiculos, contatos, financiamentos]) => {
      const naoLidos = [...contatos, ...financiamentos].filter(l => !l.lido).length;
      setStats({
        veiculos: veiculos.length,
        contatos: contatos.length,
        financiamentos: financiamentos.length,
        naoLidos,
      });
    }).catch(() => {});
  }, []);

  return (
    <div>
      <div className="page-header">
        <h1>Dashboard</h1>
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="label">Veículos ativos</div>
          <div className="value">{stats.veiculos}</div>
        </div>
        <div className="stat-card">
          <div className="label">Leads de contato</div>
          <div className="value">{stats.contatos}</div>
        </div>
        <div className="stat-card">
          <div className="label">Leads financiamento</div>
          <div className="value">{stats.financiamentos}</div>
        </div>
        <div className="stat-card">
          <div className="label">Não lidos</div>
          <div className="value" style={{ color: stats.naoLidos > 0 ? "var(--danger)" : "var(--brand)" }}>
            {stats.naoLidos}
          </div>
        </div>
      </div>

      <div className="card">
        <p style={{ color: "var(--muted)", fontSize: 13 }}>
          Bem-vindo ao painel da LA Automóveis. Use o menu lateral para gerenciar o estoque e visualizar os leads recebidos.
        </p>
      </div>
    </div>
  );
}
