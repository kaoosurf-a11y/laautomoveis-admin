---
version: alpha
name: Painel LA Automóveis
description: Painel interno de atendimento e vendas da LA Automóveis, usado no celular pelos vendedores e no computador pelos gerentes; visual no estilo do iPhone (iOS), leve, com tema escuro (padrão) e tema claro, e um único dourado de destaque.
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

O visual vem do site da LA: fundo quase preto para a informação saltar, e um único dourado de marca. Este arquivo descreve o painel **como ele é hoje**, com os valores reais de `src/index.css`. Em 04/10/2026, a pedido do Felipe, o visual foi refeito no estilo do iPhone e ganhou tema claro (ver seção "Temas"). O site público usa outra fonte e outro amarelo (ver a skill `design-system-catalogo`); não misturar os dois sistemas.

## Temas

Dois temas, trocados pelo atributo `data-theme` no `<html>` (`src/theme.js`, escolha guardada no aparelho em `la_tema`). **Escuro é o padrão**; o claro é opção de cada usuário (botão de sol/lua no topo do celular, na lateral do computador e na tela de login).

| Token | Escuro | Claro | Uso |
|---|---|---|---|
| `--bg` | `#0c0c0a` | `#f2f2f7` | fundo da página e da lateral |
| `--surface` | `#161614` | `#ffffff` | cards, modal |
| `--surface2` | `#1e1e1c` | `#ebebf0` | inputs, área das colunas do kanban |
| `--fill` | branco 7% | cinza 12% | botão secundário, aba inativa |
| `--fg` / `--muted` | `#f0ede6` / `#8a8a84` | `#1c1c1e` / `#66666b` | texto |
| `--brand` | `#C8A84B` | `#8a6500` | dourado **como texto/ícone** (no claro escurece pra dar contraste) |
| `--brand-fill` + `--on-brand` | `#C8A84B` + `#0c0c0a` | `#C8A84B` + `#1c1c1e` | dourado **como preenchimento** (botão primário, aba ativa) |
| `--danger` `--success` `--warning` `--alert` `--info` | tons claros | tons escuros | estado; cada um tem par `-soft` (fundo) e alguns `-line` (borda) |

Regras: tela nenhuma escreve cor em hex para texto ou fundo de interface; usa o token. As cores de **categoria** (estágio do kanban, origem, vendedor) continuam em hex nas telas porque são dado, e o `index.css` as escurece sozinho no tema claro (regra `.badge/.score-pill/.av/.cal-chip/.tone`). Elemento novo com cor de categoria como texto leva a classe `tone`.

## Colors

- **Ground `#0c0c0a`:** fundo da página inteira no tema escuro (valores do claro na tabela acima).
- **Surface `#161614` e Surface2 `#1e1e1c`:** camadas de profundidade. Surface para cards, sidebar e topbar; surface2 para o que se toca ou preenche (inputs, botão ghost, chips, trilho das barras).
- **Ink `#f0ede6`:** texto principal. 16,75:1 no fundo.
- **Muted `#8a8a84`:** texto secundário. Foi clareado de `#6b6b66` em 24/09/2026 porque estava em 3,65:1 (abaixo do mínimo AA de 4,5:1). Não escurecer de novo.
- **Signal `#C8A84B` (dourado):** tem um trabalho só: **o que o usuário pode fazer ou o que está ativo**. Botão primário, item ativo do menu, aba ativa, contorno de foco. Número de métrica e preço usam a cor do texto (`--fg`), não dourado. Não usar como cor de categoria nem de enfeite.
- **Danger, Success, Warning:** só para estado (erro, ok, atenção). Nunca como cor de marca ou de decoração.
- **Lacuna conhecida:** `danger` sobre `surface2` dá 4,37:1, um pouco abaixo de 4,5:1. Em texto pequeno sobre surface2, preferir um fundo `surface`.

## Typography

Fonte do sistema (SF/Segoe), sem webfont: carrega na hora no celular e não custa nada. Escala em uso, do mais frequente ao menos: 11, 13, 10, 12, 14, 16, 20, 24 px. Pesos 400 a 800. Títulos de página 24px/700 (28px no computador) com espaçamento negativo e ícone dourado; número de métrica 26px/700 na cor do texto, com algarismos tabulares; corpo 13 a 14px; apoio 11 a 12px. Rótulo de formulário 12px sem caixa alta. Inputs sempre 16px.

Rótulos em CAIXA ALTA com espaçamento (`.nav-section`, `.metric-label`, `.sec-label`) já existem e ficam como estão. **Rótulo novo não usa caixa alta**, para o padrão não se espalhar.

## Layout

- **Desktop (≥1024px):** sidebar fixa de 220px à esquerda; conteúdo à direita. **Abaixo de 1024px:** topbar de 56px, menu lateral em gaveta de 260px e barra de navegação inferior de 64px.
- **Pontos de quebra usados:** 414, 480, 500, 600, 640, 768 e 1024px. Antes de criar outro, reaproveitar um.
- **Grade de métricas:** 2 colunas no celular, 3 a partir de 600px, 6 a partir de 1024px.
- **Modal:** sobe do rodapé no celular (com alça) e centraliza a partir de 768px, largura máxima 520px.
- **Kanban:** colunas de 230px com rolagem horizontal e encaixe.

- **Densidade no computador (07/10/2026, pedido do Felipe: menos espaço em branco):** a partir de 1024px o conteúdo tem margem de 16/24px, título de página 22px, botão 36px, controle segmentado 30px, aba 32px, campo 36px, item do menu 34px e card com 14/16px de respiro. Abaixo de 1024px nada muda: toque continua com 44px. Tudo fica no bloco "Compactação" no fim do `index.css`.
- **Filtros na linha do título:** no Dashboard, loja e período ficam ao lado do título e as abas dividem a linha com o texto do recorte; no CRM, busca, loja e contador ficam ao lado do título. Tela nova segue o mesmo: nada de linha só para um filtro.
- **Grade de métricas no computador:** `.metrics-grid` distribui os cards pela largura toda (`auto-fit`, mínimo 150px), sem coluna vazia à direita. Rótulo comprido quebra em duas linhas, não corta.

## Elevation & Depth

Profundidade vem da troca de fundo (ground → surface → surface2) e de uma borda fina de 1px, e não de sombra. Sombra (`--float`) só onde algo realmente flutua: gaveta do menu, modal e aviso de agendamento. Barra do topo e menu de baixo no celular são translúcidos com desfoque, porque o conteúdo rola por baixo deles. **Sem degradê e sem brilho colorido**: botão primário e aba ativa são dourado chapado.

## Shapes

`--radius-sm` 6px, `--radius` 12px, `--radius-lg` 16px, botões 12px (`--radius-btn`), modal 20 a 22px, **pill 99px** para badges, abas e chips. Regra: pílula = filtro ou estado; canto de 10 a 14px = conteúdo (card, input, modal).

## Components

Reusar as classes existentes, sem criar variação nova dentro de uma página.

- **Botões:** `.btn` com `.btn-primary`, `.btn-ghost`, `.btn-danger`, `.btn-icon`, `.btn-sm`. Altura mínima 44px.
- **Filtro de recorte:** `.seg` com `.seg-btn` (controle segmentado, ativo em dourado chapado). É para o que muda o recorte dos dados da tela (período, loja). Aba de conteúdo continua `.tab-btn`; não usar `.btn` como filtro. Criado em 05/10/2026 no Dashboard, onde período, loja e abas eram três fileiras de botões dourados iguais.
- **Dashboard:** `.dash-grid` (2 colunas a partir de 1024px), `.card-head` (título do card com ação à direita), `.metrics-grid.cols-3`, `.meter` (progresso fino), `.rank-*`, `.lista-*`, `.ajuste-loja*`. Meta e investimento são editados por loja, uma linha por loja; em "Todas" os números são a soma e isso vem escrito.
- **Card e métrica:** `.card`, `.metric-card` (`.metric-label`, `.metric-value`, `.metric-delta`).
- **Formulário:** `.form-group`, `.form-label`, `.form-input`, `.form-grid`.
- **Estado:** `.badge` com `-brand`, `-success`, `-warning`, `-danger`, `-muted`; `.score-pill`; `.empty-state`; `.spinner`.
- **Navegação:** `.nav-item` (ativo com fundo dourado a 12%), `.tab-btn`, `.bottom-nav`.
- **Kanban (padrão Kommo, 07/10/2026, prévia aprovada pelo Felipe):** a coluna não tem caixa: título em caixa alta com uma linha fina de 3px **na cor do estágio** (a cor continua, pedido do Felipe) e os cards direto no fundo. À direita do título, quantidade e soma em reais. Card (`.kc`): inicial do cliente com selo de origem (`CANAL`), nome pequeno e data de entrada, **carro de interesse em destaque**, preço e etiquetas de contorno fino (`.kc-tag`; só VIP e Quente têm cor), rodapé com quem atende, vendedor, tempo e follow-up com bolinha (verde em dia, vermelha atrasado). O preço vem de `crm_leads.valor` ou é casado na tela com o estoque (`precoDoLead`); nada é gravado. Foto do cliente: não existe guardada; quando existir, entra no lugar da inicial.
- **Kanban e listas:** `.kanban-*`, `.fu-kanban-*`, `.crm-list-*`, `.veiculo-card-*`.
- **Ícones:** **só Tabler** (`<i className="ti ti-nome"/>`), carregados por CDN em `index.html`. Nomes já em uso: `ti-car`, `ti-building-store`, `ti-clipboard-list`, `ti-heart-handshake`, `ti-message-circle`, `ti-calendar`, `ti-alert-triangle`, `ti-device-mobile`, `ti-robot`, `ti-sun`, `ti-link`. `lucide-react` está instalado mas não é usado; não introduzir.

## Do's and Don'ts

- **Do** adicionar o token aqui e em `:root` antes de uma página usá-lo. Nunca inventar cor, raio ou tamanho solto dentro de um arquivo de página.
- **Do** garantir contraste mínimo de 4,5:1 em qualquer texto e alvos de toque de 44px.
- **Do** mostrar erro de carga com mensagem clara (como a tela Envios faz), e não dado de exemplo no lugar.
- **Don't change sem pedir ao Felipe:** o dourado `#C8A84B` e o escuro como tema padrão.
- **Don't use:** emoji como ícone; degradê ou brilho colorido novos; faixa colorida só na lateral do card; efeito de vidro (blur) sem sobreposição real; segunda cor de destaque; rótulo novo em caixa alta com espaçamento; seta `→` colada em botão; textos "A · B · C" como enfeite.
- **Pendências herdadas (não são regra):** faixas laterais coloridas em `index.css` (linhas ~313 e 468), sombras douradas e blur do overlay da sidebar. Só mexer com pedido explícito, junto de uma tela específica.

## Como conferir

Antes de commitar uma tela nova ou alterada:

```bash
node ~/.claude/skills/avoid-ai-design/scripts/detect.mjs src
```

Zero P0/P1 novos além das pendências herdadas acima. O scanner não avalia peso visual nem ritmo: para isso, olhar a tela.
