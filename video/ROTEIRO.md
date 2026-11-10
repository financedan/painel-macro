# Vídeo de apresentação — Painel Macro Brasil

Duração: **1 min 25 s** · 1920×1080, 30 quadros/s · H.264 + AAC · 5 capítulos

| Entrega | Onde está |
|---|---|
| Vídeo finalizado (com capítulos no arquivo) | `video/saida/painel-macro-brasil-v3.mp4` (fora do git, por ser grande) |
| Versão interativa (capítulos, atalhos clicáveis, trilha) | `site/apresentacao/` → publicada em `/apresentacao/` junto com o painel |
| Frames reais usados (3200×1800) e posições dos elementos | `site/apresentacao/frames/` (`manifesto.json`) |
| Roteiro, indicadores e justificativas | este arquivo |
| Locução cronometrada (para gravar voz) | `video/locucao.srt` |
| Trilha original (sintetizada) | `video/saida/trilha.wav` e `site/apresentacao/trilha.mp3` |
| Ferramentas para reproduzir e editar | `video/ferramentas/` (captura, trilha, renderização, capítulos) |

Todos os números do vídeo são os que o painel mostrava na captura: Ibovespa até **09/11/2026**, Focus com
coleta até 06/11/2026. Eles não estão digitados no roteiro: a apresentação lê `dados-video.json`, a cópia
exata do `dados.json` do momento em que os frames foram tirados.

---

## 1. O painel que aparece no vídeo

### Identidade visual (preservada)

| Elemento | No painel | No vídeo |
|---|---|---|
| Fundo | Foto de pôr do sol (`img/fundo.jpg`) com véu escuro, base `#0a0a0a` | A mesma foto e o mesmo véu; desfocada na abertura e no encerramento, nítida durante o painel |
| Superfícies | Vidro `rgba(212,212,212,.10)` + blur 22px, borda `rgba(229,229,229,.14)`, cantos de 24px | Cartões de texto, pílulas, legendas e janelas com os mesmos valores |
| Cores | Azul `#8fb0ff` = agora/destaque · âmbar `#f0b37a` = inflação/alerta · osso `#ededed` e cinza `#c2c2c2` = texto/histórico | A mesma associação |
| Tipografia | DM Sans e Geist | As mesmas fontes, embutidas localmente (`fontes/`) |
| Movimento | Números que contam, barras que crescem, linhas que se desenham, marcadores que deslizam | A abertura do painel aparece **gravada quadro a quadro**, com essas animações reais |

Nada foi inventado como tela: tudo o que aparece como interface é captura real do painel.

### Estrutura atual

- **Primeiro contato:** a saudação ("Como podemos te chamar?") abre antes do painel.
- **4 abas:** Visão geral, Expectativas, Agenda e Metodologia.
- **19 blocos** na visão geral, incluindo os cartões de dólar, atividade e dívida bruta.
- **Interações mostradas:** saudação com nome, troca de aba, indicador e ano do histórico do Focus, período
  do gráfico de inflação, simulador de juro real e o "?" de cada bloco.

---

## 2. Indicadores e ganchos

Cada indicador entra com um **número de impacto** (1 s, no centro da tela) e uma **frase de gancho**,
seguidos de um cartão com o número contando e um mini gráfico.

| # | Número de impacto | Frase de gancho | Por que entra |
|---|---|---|---|
| 1 | Juro real **8,77%** | "O maior do mundo entre 40 países" | Contexto internacional que surpreende, com fonte (Moneyou via Agência Brasil) |
| 2 | Inflação **4,58%** | "Estourou o teto da meta" | O ponto mais concreto do momento; o painel conta os meses fora da banda |
| 3 | Focus **+0,25 p.p.** | "Em uma semana, o mercado desistiu de cortar a Selic em 2026" | A Selic esperada para 2026 subiu de 13,50% para 13,75%, igual à de hoje |
| 4 | Ibovespa **−17,6%** | "Longe do recorde de 09/10/2026" | Dado de bolsa fácil de entender e recente |
| 5 | Volatilidade **98%** | "A bolsa está nervosa" | Oscila mais que em 98% dos pregões desde 2000 |

As frases são escolhidas pelos dados: se a Selic esperada não ficar igual à de hoje, o texto do gancho 3
muda sozinho; se o Brasil não for o 1º do ranking, o gancho 1 também muda.

---

## 3. Roteiro cena a cena

### Cena 1 — Gancho (0:00–0:10)

| Tempo | Imagem | Na tela |
|---|---|---|
| 0:00–0:05 | Pôr do sol desfocado; Selic e IPCA reais desde 2017 sendo desenhados | "BRASIL · NOVEMBRO DE 2026"; 13,75% / 4,58% / 8,77% contando |
| 0:05–0:10 | Gráfico escurece | "Juros de 13,75%. Inflação de 4,58%, acima do teto da meta." / **"Você sabe o que esses números dizem sobre o seu dinheiro?"** |

### Cena 2 — O painel (0:10–0:25)

| Tempo | Imagem | Na tela |
|---|---|---|
| 0:10–0:12,5 | Fundo fica nítido | Marca + "Dados oficiais: Banco Central, IBGE, B3 e Tesouro" |
| 0:12,3–0:14,6 | Saudação real; o nome "Daniel" é digitado e a prévia vira "Boa tarde, Daniel" | **"Ele te recebe pelo nome"** · cursor clica em *Entrar no painel* |
| 0:14,6–0:18,3 | **Abertura real gravada quadro a quadro:** os 6 números contam, as barras crescem | **"E os números ganham vida na sua frente"** |
| 0:18,2–0:20,6 | Aproximação do menu | **"4 abas: Visão geral · Expectativas · Agenda · Metodologia"** |
| 0:20,2–0:25 | Página inteira rolando | **"19 blocos de informação. Todos com fonte oficial."** (contagem animada) |

### Cena 3 — Indicadores (0:25–0:50)

| Tempo | Imagem | Número de impacto → cartão |
|---|---|---|
| 0:25–0:31,8 | Juro real ao fim de cada ano; mouse real sobre 2020 | **8,77%** → ranking de 5 países · "Mas em 2020… −2,41%" |
| 0:31,6–0:37,8 | Inflação contra a meta | **4,58%** → termômetro da banda de 1,5% a 4,5% |
| 0:37,6–0:43,8 | O que mudou no Focus | **+0,25 p.p.** → "13,50% → 13,75%: sem corte até o fim do ano" |
| 0:43,6–0:47,4 | Ibovespa por ano | **−17,6%** → distância até o recorde |
| 0:47,2–0:50 | Medo na bolsa | **98%** → percentil da volatilidade |

### Cena 4 — Interatividade (0:50–1:10)

O cursor clica nas posições reais dos botões (lidas da página na captura). A troca de aba e a linha da Selic
redesenhada são **sequências reais** gravadas quadro a quadro.

| Tempo | Ação | Na tela |
|---|---|---|
| 0:50–0:54 | Clique em **Expectativas**; a página entra | "Um clique e você está nas expectativas do mercado" |
| 0:54–0:58,5 | Clique em **Selic** (linha redesenhada) e em **2028** | "Troque o indicador. Mude o ano. Veja a aposta do mercado mudar" |
| 0:58,5–1:02 | Clique em **Desde 2017** | "Volte no tempo: 12 meses, 3 anos ou desde 2017" |
| 1:02–1:06 | O controle da Selic é arrastado: 13,75% → 10% → 7%; a postura muda de contracionista para estimulativa | "E se a Selic cair? Simule e veja o juro real mudar" |
| 1:06–1:10 | Clique no **?** do juro real; a explicação abre | "Ficou com dúvida? Toque no ? e entenda cada número" |

### Cena 5 — Encerramento (1:10–1:25)

| Tempo | Imagem | Na tela |
|---|---|---|
| 1:10–1:20,8 | Três janelas reais (Selic na história, Agenda, Metodologia) | **"Dados oficiais. Atualizados todo dia útil."** → **"Explore, compare e tire suas próprias conclusões."** |
| 1:20,8–1:25 | Fundo desfocado | Marca · `financedan.github.io/painel-macro` · "Fontes: Banco Central · IBGE · B3 · Tesouro Nacional · Dados de 09/11/2026" |

### Camada de estímulo

- **Faixa de cotações** no rodapé (0:13–1:10), estilo terminal, com indicadores reais do painel e o capítulo atual.
- **Números de impacto** com flash, **cartões animados** (número contando + mini gráfico).
- **Varredura de vidro** entre as cenas, zoom de entrada em cada tomada e zoom rápido em cada clique.
- **Destaques em sequência** nos números, nas abas e nos controles.

### Som

Trilha original sintetizada (`video/ferramentas/trilha.py`), 120 bpm, cerca de −17 LUFS, com impactos nos
capítulos e nos números de impacto, "swoosh" em cada varredura e cliques nos mesmos instantes do cursor
(inclusive o *Entrar no painel* da saudação e o arrastar do simulador). Nenhum sample ou música de terceiros.

---

## 4. Vídeo × versão interativa

| | Vídeo (MP4) | Versão interativa (`/apresentacao/`) |
|---|---|---|
| Formato | Arquivo linear, para redes sociais, apresentações e e-mail | Página web que se comporta como vídeo |
| Navegação | Capítulos embutidos no arquivo | Linha do tempo com 5 capítulos clicáveis, teclado (espaço, ← →, 1 a 5) |
| Clique | Não tem | Atalhos que abrem o bloco no painel e, no fim, **Abrir o painel** e **Ver as fontes** |
| Som | Trilha embutida | A mesma trilha, ligada pelo botão "Ativar trilha" |

As duas saem **do mesmo arquivo** (`site/apresentacao/apresentacao.js`).

---

## 5. Narração

A narração não foi gravada (não há voz sintética de qualidade em português neste ambiente). O vídeo funciona
sem voz; a locução está pronta em `video/locucao.srt` para gravar por cima:

```bash
ffmpeg -i video/saida/painel-macro-brasil-v3.mp4 -i voz.wav -filter_complex "[0:a]volume=0.5[m];[m][1:a]amix=inputs=2:duration=first[a]" -map 0:v -map "[a]" -map_chapters 0 -c:v copy -c:a aac video/saida/painel-macro-brasil-com-voz.mp4
```

---

## 6. Como reproduzir ou editar

Pré-requisitos: Python 3 com `numpy`, Node com `playwright` (Chromium) e `ffmpeg`.

```bash
bash video/ferramentas/montar.sh
```

O script serve a pasta `site/`, captura os frames reais (`capturar.js`), gera a trilha (`trilha.py`) e
renderiza o MP4 com trilha e capítulos (`renderizar.js`).

- **Textos, tempos e câmera:** função `roteiro()` em `site/apresentacao/apresentacao.js`.
- **Animações reais do painel:** o `capturar.js` desacelera 10x as animações de CSS e o relógio do
  JavaScript durante as sequências, para gravar cada etapa da contagem e do crescimento dos gráficos.
- **Pré-visualizar um trecho:** `INICIO=25 FIM=50 SAIDA=video/saida/trecho.mp4 node video/ferramentas/renderizar.js`.

### Frames capturados

- **Saudação e abertura:** `boasvindas`, `boasvindas-dig`, `boasvindas-nome`, sequência `abertura-0…13`.
- **Visão geral:** `visao-topo`, `visao-pagina`, `visao-barras`, `visao-barras-2020`, `visao-ajuda`,
  `visao-inflacao`, `visao-inflacao-desde`, `visao-ibov`, `visao-economia`, `visao-medo`, `sim-a`, `sim-b`, `sim-c`.
- **Sequências reais:** `nav-exp-0…8` (troca de aba) e `hist-selic-0…7` (linha redesenhada).
- **Expectativas:** `exp-topo`, `exp-mudancas`, `exp-hist-ipca`, `exp-hist-selic`, `exp-hist-selic-2028`,
  `exp-tesouro`, `exp-contexto`, `exp-grupos`.
- **Outras abas:** `agenda`, `agenda-dez`, `met-topo`, `met-referencias`.
