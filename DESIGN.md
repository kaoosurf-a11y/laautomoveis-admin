---
version: alpha
name: Painel LA Automóveis
description: Painel interno de atendimento e vendas da LA Automóveis, usado no celular pelos vendedores e no computador pelos gerentes; escuro, denso e direto, com um único dourado de destaque.
colors:
  ground: "#0c0c0a"      # fundo da página
  surface: "#161614"     # cards, sidebar, topbar
  surface2: "#1e1e1c"    # inputs, botão ghost, chips, trilhos de barra
  ink: "#f0ede6"         # texto principal (16,75:1 no fundo)
  muted: "#8a8a84"       # texto secundário (5,64:1 no fundo, 4,81:1 na surface2)
  signal: "#C8A84B"      # dourado da marca: ação, item ativo, número de destaque
  signal-deep: "#a88a35" # par do degradê do botão primário
  danger: "#e05252"
  success: "#4caf7d"
  warning: "#e6a817"
  line: "rgba(255,255,255,0.07)"  # borda de card e divisória
typography:
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'SF Pro Display', sans-serif"
    fontSize: 13px
    fontWeight: 400
  page-title:
    fontSize: 20px
    fontWeight: 700
  metric-value:
    fontSize: 24px
    fontWeight: 800
  small:
    fontSize: 11px
  form-input:
    fontSize: 16px   # 16px de propósito: abaixo disso o iPhone dá zoom ao focar
rounded:
  sm: 6px       # blocos da grade de horários
  md: 10px      # cards menores, inputs
  lg: 14px      # cards principais, modais no desktop 18px
  pill: 99px    # badges, abas, chips
spacing:
  card: 16px
  page-gap: 18px
components:
  button-primary:
    backgroundColor: "{colors.signal}"
    textColor: "{colors.ground}"
    rounded: 9px
    padding: 10px 16px
    minHeight: 44px
---

## Overview

Painel de uso diário de vendedores, gerentes e do dono da LA Automóveis (duas lojas, Curitibanos e Campos Novos). A maior parte do uso é no celular, com uma mão e com pressa: por isso os alvos de toque têm 44px, o menu de baixo aparece abaixo de 1024px e a informação é densa, sem espaço decorativo.

O visual vem do site da LA: fundo quase preto para a informação saltar, e um único dourado de marca. Este arquivo descreve o painel **como ele é hoje**, com os valores reais de `src/index.css`. Ele não propõe redesenho. O site público usa outra fonte e outro amarelo (ver a skill `design-system-catalogo`); não misturar os dois sistemas.

## Colors

- **Ground `#0c0c0a`:** fundo da página inteira. Não existe modo claro no painel (mesma linha do site, que o Felipe prefere escuro).
- **Surface `#161614` e Surface2 `#1e1e1c`:** camadas de profundidade. Surface para cards, sidebar e topbar; surface2 para o que se toca ou preenche (inputs, botão ghost, chips, trilho das barras).
- **Ink `#f0ede6`:** texto principal. 16,75:1 no fundo.
- **Muted `#8a8a84`:** texto secundário. Foi clareado de `#6b6b66` em 24/09/2026 porque estava em 3,65:1 (abaixo do mínimo AA de 4,5:1). Não escurecer de novo.
- **Signal `#C8A84B` (dourado):** tem um trabalho só: **o que o usuário pode fazer ou o que está ativo**. Botão primário, item ativo do menu, aba ativa, número de destaque das métricas, contorno de foco. Não usar como cor de categoria nem de enfeite.
- **Danger, Success, Warning:** só para estado (erro, ok, atenção). Nunca como cor de marca ou de decoração.
- **Lacuna conhecida:** `danger` sobre `surface2` dá 4,37:1, um pouco abaixo de 4,5:1. Em texto pequeno sobre surface2, preferir um fundo `surface`.

## Typography

Fonte do sistema (SF/Segoe), sem webfont: carrega na hora no celular e não custa nada. Escala em uso, do mais frequente ao menos: 11, 13, 10, 12, 14, 16, 20, 24 px. Pesos 400 a 800. Títulos de página 20px/700 com ícone dourado de 22px; número de métrica 24px/800 em dourado; corpo 13px; apoio 11px. Inputs sempre 16px.

Rótulos em CAIXA ALTA com espaçamento (`.nav-section`, `.metric-label`, `.sec-label`) já existem e ficam como estão. **Rótulo novo não usa caixa alta**, para o padrão não se espalhar.

## Layout

- **Desktop (≥1024px):** sidebar fixa de 220px à esquerda; conteúdo à direita. **Abaixo de 1024px:** topbar de 56px, menu lateral em gaveta de 260px e barra de navegação inferior de 64px.
- **Pontos de quebra usados:** 414, 480, 500, 600, 640, 768 e 1024px. Antes de criar outro, reaproveitar um.
- **Grade de métricas:** 2 colunas no celular, 3 a partir de 600px, 6 a partir de 1024px.
- **Modal:** sobe do rodapé no celular (com alça) e centraliza a partir de 768px, largura máxima 520px.
- **Kanban:** colunas de 230px com rolagem horizontal e encaixe.

## Elevation & Depth

Profundidade vem da troca de fundo (ground → surface → surface2) e de uma borda de 1px `line`, e não de sombra. Sombra só onde algo realmente flutua: gaveta do menu, modal e aviso de agendamento. O botão primário e a aba ativa hoje têm degradê dourado e brilho leve; é o que existe e fica, mas **não aplicar degradê nem brilho colorido em elementos novos**.

## Shapes

`--radius-sm` 6px, `--radius` 10px, `--radius-lg` 14px, botões 9px, **pill 99px** para badges, abas e chips. Regra: pílula = filtro ou estado; canto de 10 a 14px = conteúdo (card, input, modal).

## Components

Reusar as classes existentes, sem criar variação nova dentro de uma página.

- **Botões:** `.btn` com `.btn-primary`, `.btn-ghost`, `.btn-danger`, `.btn-icon`, `.btn-sm`. Altura mínima 44px.
- **Card e métrica:** `.card`, `.metric-card` (`.metric-label`, `.metric-value`, `.metric-delta`).
- **Formulário:** `.form-group`, `.form-label`, `.form-input`, `.form-grid`.
- **Estado:** `.badge` com `-brand`, `-success`, `-warning`, `-danger`, `-muted`; `.score-pill`; `.empty-state`; `.spinner`.
- **Navegação:** `.nav-item` (ativo com fundo dourado a 12%), `.tab-btn`, `.bottom-nav`.
- **Kanban e listas:** `.kanban-*`, `.fu-kanban-*`, `.crm-list-*`, `.veiculo-card-*`.
- **Ícones:** **só Tabler** (`<i className="ti ti-nome"/>`), carregados por CDN em `index.html`. Nomes já em uso: `ti-car`, `ti-building-store`, `ti-clipboard-list`, `ti-heart-handshake`, `ti-message-circle`, `ti-calendar`, `ti-alert-triangle`, `ti-device-mobile`, `ti-robot`, `ti-sun`, `ti-link`. `lucide-react` está instalado mas não é usado; não introduzir.

## Do's and Don'ts

- **Do** adicionar o token aqui e em `:root` antes de uma página usá-lo. Nunca inventar cor, raio ou tamanho solto dentro de um arquivo de página.
- **Do** garantir contraste mínimo de 4,5:1 em qualquer texto e alvos de toque de 44px.
- **Do** mostrar erro de carga com mensagem clara (como a tela Envios faz), e não dado de exemplo no lugar.
- **Don't change sem pedir ao Felipe:** o fundo `#0c0c0a`, o dourado `#C8A84B` e o modo único escuro (identidade atual do painel).
- **Don't use:** emoji como ícone; degradê ou brilho colorido novos; faixa colorida só na lateral do card; efeito de vidro (blur) sem sobreposição real; segunda cor de destaque; rótulo novo em caixa alta com espaçamento; seta `→` colada em botão; textos "A · B · C" como enfeite.
- **Pendências herdadas (não são regra):** faixas laterais coloridas em `index.css` (linhas ~313 e 468), sombras douradas e blur do overlay da sidebar. Só mexer com pedido explícito, junto de uma tela específica.

## Como conferir

Antes de commitar uma tela nova ou alterada:

```bash
node ~/.claude/skills/avoid-ai-design/scripts/detect.mjs src
```

Zero P0/P1 novos além das pendências herdadas acima. O scanner não avalia peso visual nem ritmo: para isso, olhar a tela.
