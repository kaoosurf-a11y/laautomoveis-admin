import { useEffect, useRef, useState } from "react";

// 2026-10-18 leveza no celular: diz se o elemento já apareceu na tela (e fica true
// depois disso). Usado nas fotos dos cards do Kanban e dos Follow-ups: o loading="lazy"
// do navegador baixa tudo num raio de até ~2500 px no 4G (dezenas de fotos ao abrir a
// tela). Um observador só pra todos os cards, em vez de um por card.
let observador = null;
const avisos = new Map();
function observar(el, avisar) {
  if (typeof IntersectionObserver === "undefined") { avisar(); return () => {}; }
  if (!observador) {
    observador = new IntersectionObserver(entradas => {
      for (const e of entradas) {
        if (!e.isIntersecting) continue;
        const f = avisos.get(e.target);
        avisos.delete(e.target);
        observador.unobserve(e.target);
        if (f) f();
      }
    }, { rootMargin: "200px" });
  }
  avisos.set(el, avisar);
  observador.observe(el);
  return () => { avisos.delete(el); observador.unobserve(el); };
}

export function useVisivel() {
  const ref = useRef(null);
  const [visivel, setVisivel] = useState(false);
  // Sem lista de dependências: se a foto só chegar num recarregamento, o círculo vazio
  // aparece depois e ainda precisa ser observado.
  useEffect(() => {
    if (visivel || !ref.current) return;
    return observar(ref.current, () => setVisivel(true));
  });
  return [ref, visivel];
}
