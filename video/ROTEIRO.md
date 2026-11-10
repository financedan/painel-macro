# Vídeo de apresentação — Painel Macro Brasil

Duração: **1 min 25 s** · 1920×1080, 30 quadros/s · H.264 + AAC · 5 capítulos

| Entrega | Onde está |
|---|---|
| Vídeo finalizado (com capítulos no arquivo) | `video/saida/painel-macro-brasil.mp4` |
| Versão interativa (capítulos, atalhos clicáveis, trilha) | `site/apresentacao/` → publicada em `/apresentacao/` junto com o painel |
| Frames reais usados (3200×1800) e posições dos elementos | `site/apresentacao/frames/` (`manifesto.json`) |
| Roteiro, indicadores e justificativas | este arquivo |
| Locução cronometrada (para gravar voz) | `video/locucao.srt` |
| Trilha original (sintetizada) | `video/saida/trilha.wav` e `site/apresentacao/trilha.mp3` |
| Ferramentas para reproduzir e editar | `video/ferramentas/` (captura, trilha, renderização, capítulos) |

Todos os números do vídeo são os que o painel mostrava na captura (dados de **06/11/2026**; Focus com
coleta até 30/10/2026). Eles não estão digitados no roteiro: a apresentação lê `dados-video.json`, a cópia
exata do `dados.json` do momento em que os frames foram tirados.

---

## 1. Análise do painel

### Identidade visual (preservada no vídeo)

| Elemento | No painel | No vídeo |
|---|---|---|
| Fundo | Foto de pôr do sol (`img/fundo.jpg`) com véu escuro, base `#0a0a0a` | A mesma foto e o mesmo véu; desfocada na abertura e no encerramento, nítida durante o painel |
| Superfícies | Vidro `rgba(212,212,212,.10)` + blur 22px, borda `rgba(229,229,229,.14)`, cantos de 24px | Cartões de texto, pílulas, legendas e janelas com os mesmos valores |
| Cores | Azul `#8fb0ff` = agora/destaque · âmbar `#f0b37a` = inflação/alerta · osso `#ededed` e cinza `#c2c2c2` = texto/histórico | Mesma associação: Selic em osso, IPCA em âmbar, juro real em azul, rótulos em âmbar como no painel |
| Tipografia | DM Sans (texto e números, peso 500, `letter-spacing −0,035em`) e Geist (títulos de bloco) | As mesmas fontes, embutidas localmente (`fontes/`) |
| Movimento | Cartões entram subindo, com desfoque saindo (`pm-rise`); linhas são desenhadas (`pm-draw`) | Todo texto entra com a mesma curva; os gráficos da abertura são desenhados do mesmo jeito |
| Marca | Ícone de sol nascente em círculo de vidro + "Painel Macro Brasil" | O mesmo ícone e nome na abertura e no encerramento |
| Foco | Contorno branco (`:focus-visible`) | Destaques com anel branco e o resto levemente escurecido |

Nada foi inventado como tela: tudo o que aparece como interface é captura real do painel. Os elementos
adicionados (cartões de texto, legendas, cursor e destaques) usam só os componentes acima.

### Estrutura e interações reais encontradas

- **5 abas** com endereço próprio: Visão geral, Expectativas, Economia, Agenda, Metodologia.
- **12 blocos** na visão geral, cada um com a linha "Fonte:" e link.
- Interações: troca de aba; seletor de período do gráfico de inflação (12 meses, 3 anos, desde 2017);
  seletor de indicador e ano no histórico do Focus; bolsa x CDI em reais, sem a inflação ou em dólar;
  passar o mouse nas barras de juro real; modo explicativo; calculadora; simulador; agenda com meses e
  exportação `.ics`; downloads em CSV.

---

## 2. Indicadores escolhidos e por quê

| # | Indicador (no vídeo) | Valor na captura | Por que entra |
|---|---|---|---|
| 1 | Selic, IPCA 12 meses e juro real (abertura) | 13,75% · 4,58% · 8,77% | Os três números que resumem a política monetária; a relação entre eles é a pergunta que o vídeo faz |
| 2 | Juro real ao fim de cada ano | 8,77% hoje; −2,41% em 2020; Brasil 1º de 40 países | Mostra contexto histórico e uma comparação internacional que costuma surpreender, com fonte |
| 3 | Inflação contra a meta | 4,58%, acima do teto de 4,5% | Ponto mais concreto do momento; o contador da meta contínua é um recurso exclusivo do painel |
| 4 | Expectativas (Focus): o que mudou na semana | Selic esperada para 2027: 11,75% → 12,50% | Movimento grande em uma semana; mostra que o painel acompanha a mudança, não só o nível |
| 5 | Ibovespa: distância da máxima histórica | −19,4% da máxima de 09/10/2026 | Dado de bolsa fácil de entender e recente |
| 6 | Volatilidade | 53,9%, maior que em 98% dos pregões desde 2000 | Comparação com o próprio histórico, sem limite inventado; desperta curiosidade |
| 7 | Bolsa x CDI em 10 anos (interatividade) | R$ 100 → 261 (Ibovespa) e 237 (CDI) | Melhor exemplo de comparação com troca de modo (reais, sem a inflação, dólar) |

Ficaram de fora do roteiro, mas aparecem nos frames de apoio: Tesouro IPCA+ e inflação implícita, IPCA
por grupo, núcleos, agenda e calendário do Copom. Entraram menos por exigir explicação mais longa.

---

## 3. Roteiro cena a cena

Legenda: **Imagem** = frame real usado · **Câmera** = movimento sobre o frame · **Na tela** = texto
sobreposto · **Locução** = texto opcional para voz (em `locucao.srt`).

### Cena 1 — Introdução (0:00–0:10)

| Tempo | Imagem e câmera | Na tela | Locução |
|---|---|---|---|
| 0:00–0:05 | Pôr do sol do painel, desfocado. As séries reais de Selic (osso) e IPCA 12 meses (âmbar) desde 2017 são desenhadas | "BRASIL · NOVEMBRO DE 2026"; 13,75% / 4,58% / 8,77% contando até o valor, com os rótulos do painel | Selic em 13,75%. Inflação de 4,58% em 12 meses. |
| 0:05–0:10 | Gráfico escurece | "Selic em 13,75%. Inflação de 4,58% em 12 meses, acima do teto da meta." / **"O que os números dizem sobre o Brasil agora?"** | O que esses números dizem sobre o Brasil agora? |

### Cena 2 — O painel (0:10–0:25)

| Tempo | Imagem e câmera | Na tela | Locução |
|---|---|---|---|
| 0:10–0:12,8 | Fundo fica nítido | Ícone + "Painel Macro Brasil"; pílula "Dados do Banco Central, IBGE, B3, Tesouro e Fed" | O Painel Macro Brasil reúne juros, inflação, expectativas e bolsa em um só lugar, com dados oficiais. |
| 0:12,5–0:17 | `visao-topo` entra como janela e abre em tela cheia; aproximação dos cartões | Destaque nos 6 cartões · "Os números do dia: Selic, IPCA, juro real, Focus e Ibovespa" | Na visão geral, os números do dia. |
| 0:17–0:20,5 | Aproximação do menu | Destaque nas abas · "5 abas: Visão geral · Expectativas · Economia · Agenda · Metodologia" | São cinco abas, da visão geral à metodologia. |
| 0:20,5–0:25 | `visao-pagina` (página inteira) rolando de cima a baixo | "12 blocos na visão geral. Cada um mostra de onde vêm os dados." · atalho *Abrir a visão geral* | E cada bloco mostra de onde vêm os dados. |

### Cena 3 — Indicadores (0:25–0:50)

| Tempo | Imagem e câmera | Na tela | Locução |
|---|---|---|---|
| 0:25–0:29,5 | `visao-barras`, aproximação lenta | Destaque na barra de hoje · cartão **JURO REAL 8,77%**: "Selic de 13,75% descontada a inflação de 4,58% em 12 meses. No ranking de 40 países, o Brasil está em 1º." Fonte: BCB · IBGE · Moneyou via Agência Brasil | O juro real… está em 8,77%. No ranking de 40 países, o Brasil é o primeiro. |
| 0:29,5–0:31,8 | Troca para `visao-barras-2020` (mouse real sobre a barra de 2020) | Cartão **EM 2020 −2,41%** | Em 2020, ele chegou a ficar negativo. |
| 0:31,6–0:37,8 | `visao-inflacao` | Destaque no último ponto e no contador · cartão **INFLAÇÃO 4,58%** + meta contínua. Fonte: IBGE via BCB · Decreto 12.079/2024 | A inflação de 12 meses está em 4,58%, acima do teto da meta. |
| 0:37,6–0:43,8 | `exp-mudancas` | Destaque em "Selic 2027 11,75% → 12,50%" · cartão **EXPECTATIVAS · FOCUS 12,50%**. Fonte: BCB · Boletim Focus | Em uma semana, o mercado elevou a Selic esperada para o fim de 2027… |
| 0:43,6–0:47,4 | `visao-ibov` | Destaque na frase da máxima histórica · cartão **BOLSA −19,4%**. Fonte: B3 | O Ibovespa está 19,4% abaixo da máxima histórica, de outubro. |
| 0:47,2–0:50 | `visao-medo` com aproximação | Destaque em "Muito elevada" · cartão **VOLATILIDADE 53,9%**: "Maior que em 98% dos pregões desde 2000." | E a volatilidade está maior que em 98% dos pregões desde 2000. |

### Cena 4 — Interatividade (0:50–1:10)

O cursor clica nas posições reais dos botões (lidas da página na captura). As telas depois de cada clique
são as telas reais do painel; a entrada da aba Expectativas e o redesenho da linha da Selic são
**sequências reais** gravadas quadro a quadro (as animações do painel rodaram 10x mais devagar só para a
captura e voltam à velocidade normal no vídeo).

| Tempo | Imagem | Ação | Na tela |
|---|---|---|---|
| 0:50–0:54 | `visao-topo` → `nav-exp-0…8` → `exp-topo` | Clique em **Expectativas**; a página entra | "Navegue pelas abas" |
| 0:54–0:58,5 | `exp-hist-ipca` → `hist-selic-0…7` → `exp-hist-selic` → `exp-hist-selic-2028` | Clique em **Selic** (linha redesenhada) e em **2028** | "Escolha o indicador e o ano" |
| 0:58,5–1:02 | `visao-inflacao` → `visao-inflacao-desde` | Clique em **Desde 2017** | "Mude o período: 12 meses, 3 anos ou desde 2017" |
| 1:02–1:06 | `visao-comp-reais` → `-inflacao` → `-dolar` | Cliques em **Descontada a inflação** e **Em dólar** | "Compare bolsa e CDI em reais, sem a inflação ou em dólar" |
| 1:06–1:10 | `visao-topo` → `visao-explicativo` | Clique em **Modo explicativo**; destaque na linha "Fonte:" | "Modo explicativo: o que cada bloco mostra e de onde vêm os dados" |

### Cena 5 — Encerramento (1:10–1:25)

| Tempo | Imagem e câmera | Na tela |
|---|---|---|
| 1:10–1:20,8 | Três janelas reais flutuando (Economia, Agenda, Metodologia) sobre o pôr do sol desfocado | **"Os dados estão disponíveis."** → **"Explore os indicadores, compare períodos e tire suas próprias conclusões."** |
| 1:20,8–1:25 | Fundo desfocado | Ícone + "Painel Macro Brasil" · `financedan.github.io/painel-macro` · "Fontes: Banco Central · IBGE · B3 · Tesouro Nacional · FRED · Dados de 06/11/2026". Na versão interativa: botões **Abrir o painel** e **Ver as fontes** |

### Camada de estímulo (versão 2)

Mesmo roteiro, mesmos tempos e mesmas funções, com mais estímulo visual, sempre com os componentes do painel:
- **Faixa de cotações** no rodapé (0:13–1:10), estilo terminal, com 13 indicadores reais do painel
  (Selic, IPCA, juro real, Focus, Ibovespa, dólar, IBC-Br, desocupação, dívida, Tesouro IPCA+, inflação
  implícita, Fed funds) e o capítulo atual fixo à esquerda.
- **Números de impacto** de 1 s antes de cada indicador: 8,77%, 4,58%, +0,75 p.p., −19,4% e 98%.
- **Cartões animados:** o número conta até o valor e cada um traz um mini gráfico (ranking de 5 países,
  termômetro da meta, de/para do Focus, distância da máxima, percentil da volatilidade).
- **Varredura de vidro** entre as cenas e um zoom de entrada em cada tomada.
- **Destaques em sequência** nos 6 cartões e nas 5 abas; zoom rápido em cada clique do cursor;
  contagem dos 12 blocos durante a rolagem.
- O encerramento ficou igual, com um clarão discreto na entrada da marca.

### Som

Trilha original sintetizada para o vídeo (`video/ferramentas/trilha.py`), 120 bpm, cerca de −17 LUFS:
- **0:00–0:10:** pad e arpejo crescendo, com toques nos números e uma subida até o painel.
- **0:10–1:10:** batida (bumbo, chimbal, palmas a partir dos indicadores) e baixo em colcheias.
- **Sincronias:**
  - impactos nos capítulos e nos números de impacto;
  - "swoosh" acompanhando cada varredura;
  - cliques nos mesmos instantes do cursor.
- **1:10–1:21:** a batida sai para os textos finais respirarem.
- **1:20,9:** impacto na marca e acorde final.

Nenhum sample ou música de terceiros.

---

## 4. Vídeo × versão interativa

| | Vídeo (MP4) | Versão interativa (`/apresentacao/`) |
|---|---|---|
| Formato | Arquivo linear, para redes sociais, apresentações e e-mail | Página web que se comporta como vídeo |
| Navegação | Capítulos embutidos no arquivo (aparecem em players como VLC, QuickTime e alguns sites) | Linha do tempo com os 5 capítulos clicáveis, arrastar para avançar, teclado (espaço, ← →, 1 a 5) |
| Clique | Não tem | Atalhos em cada cena que abrem o bloco correspondente no painel (`#visao`, `#expectativas`, `#metodologia`) e, no fim, **Abrir o painel** e **Ver as fontes** |
| Som | Trilha embutida | A mesma trilha, ligada pelo botão "Ativar trilha" (navegadores bloqueiam som automático) |
| Atualização | Fixo | Fixo nos dados da captura, para combinar com os frames |

As duas saem **do mesmo arquivo** (`site/apresentacao/apresentacao.js`). Cada quadro é calculado a partir
do tempo, então o vídeo é a própria apresentação renderizada quadro a quadro. Alterar o roteiro ali muda
as duas versões.

**Por que não colocar interatividade dentro do MP4:** o MP4 não aceita botões clicáveis de forma
confiável fora de plataformas específicas. Por isso a interatividade ficou na versão web, que fica no
mesmo endereço do painel e abre direto no bloco certo.

---

## 5. Narração

A narração **não foi gravada**. Neste ambiente não há síntese de voz de qualidade em português; a única
opção seria uma voz robótica, que comprometeria o tom profissional. O vídeo funciona sem voz: os textos na
tela carregam a mensagem. A locução está pronta e cronometrada em `video/locucao.srt`, para gravar uma voz
humana por cima, num editor de vídeo ou com o ffmpeg:

```bash
ffmpeg -i video/saida/painel-macro-brasil.mp4 -i voz.wav -filter_complex "[0:a]volume=0.5[m];[m][1:a]amix=inputs=2:duration=first[a]" -map 0:v -map "[a]" -map_chapters 0 -c:v copy -c:a aac video/saida/painel-macro-brasil-com-voz.mp4
```

---

## 6. Como reproduzir ou editar

Pré-requisitos: Python 3 com `numpy`, Node com `playwright` (Chromium) e `ffmpeg`.

```bash
bash video/ferramentas/montar.sh
```

O script faz, em ordem:
1. serve a pasta `site/`;
2. captura os frames reais (`capturar.js`);
3. gera a trilha (`trilha.py`) e o MP3 do site;
4. renderiza o MP4 com trilha e capítulos (`renderizar.js`).

Para editar:
- **Textos, tempos e câmera:** função `roteiro()` em `site/apresentacao/apresentacao.js`. Cada cena está
  comentada com o seu intervalo.
- **Cores e tipografia:** `site/apresentacao/apresentacao.css`, com os mesmos tokens do painel.
- **Dados mais recentes:** rode o coletor do painel e depois o `montar.sh`. Frames, números e vídeo são
  refeitos juntos.
- **Pré-visualizar um trecho:** abra `/apresentacao/` no navegador e use os capítulos, ou renderize só o
  trecho: `INICIO=25 FIM=50 SAIDA=video/saida/trecho.mp4 node video/ferramentas/renderizar.js` (sem trilha).

### Frames capturados

Todos de `site/apresentacao/frames/`, em 3200×1800 (tela de 1600×900 com densidade 2):
- **Visão geral:** `visao-topo`, `visao-pagina` (página inteira), `visao-barras`, `visao-barras-2020`,
  `visao-inflacao`, `visao-inflacao-desde`, `visao-ibov`, `visao-comp-reais`, `visao-comp-inflacao`,
  `visao-comp-dolar`, `visao-medo`, `visao-explicativo`.
- **Sequências reais:** `nav-exp-0…8` (troca de aba) e `hist-selic-0…7` (linha redesenhada).
- **Expectativas:** `exp-topo`, `exp-mudancas`, `exp-hist-ipca`, `exp-hist-selic`, `exp-hist-selic-2028`,
  `exp-tesouro`.
- **Outras abas:** `eco-topo`, `eco-grupos`, `eco-mundo`, `agenda`, `agenda-dez`, `met-topo`,
  `met-referencias`.

Os não usados no corte final ficam como material de apoio para outras versões, por exemplo um corte
vertical para redes sociais.
