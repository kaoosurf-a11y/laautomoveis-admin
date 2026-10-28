import { getUser } from "./auth.js";

// 2026-10-28 (Felipe: "quero instantâneo"): guarda na memória da aba a última resposta de
// CRM, Follow-up e Veículos. Ao voltar pra tela, mostra na hora o que já tinha e atualiza
// por baixo. Fica só na memória (some ao recarregar ou fechar); nada de lead gravado no
// aparelho. A chave inclui o usuário, então "Ver como" e troca de login nunca misturam.
const M = new Map();
const dono = () => { const u = getUser(); return u ? `${u.id}|${u.role}|${u.loja_id ?? ""}` : ""; };

export function lembrado(chave) {
  const d = M.get(chave);
  return d && d.dono === dono() ? d.valor : undefined;
}
export function lembrar(chave, promessa) {
  const quem = dono();
  return promessa.then(v => { if (v !== undefined) M.set(chave, { dono: quem, valor: v }); return v; });
}
export function esquecerTudo() { M.clear(); }
