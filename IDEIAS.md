# Ideias de melhorias e novidades — Painel Macro Brasil

Complementa o [RELATORIO-UX.md](RELATORIO-UX.md). Aquele relatório lista o que está **errado ou inconsistente**.
Este documento lista o que pode ser **adicionado ou melhorado**, respeitando a arquitetura atual: site estático,
robô no GitHub Actions, sem servidor e sem custo.

Legenda: **Esforço** P = poucas horas · M = 1 a 3 dias · G = uma semana ou mais.
Fontes marcadas com *(confirmar)* não puderam ser testadas daqui (a rede deste ambiente bloqueia as APIs do BC
e do IBGE); vale checar antes de implementar.

---

## Status da implementação (atualizado em 07/11/2026)

**Implementado:** as 6 melhores apostas; juro real ex-ante; juro real de mercado e inflação implícita (Tesouro IPCA+ x
Prefixado); linha do tempo da Selic e ciclo atual; IPCA do mês e acumulado no ano; IPCA por grupo (SIDRA 7060); média
de 5 núcleos; contador da meta contínua; faixa de respostas do Focus; aba **Economia** (dólar, IBC-Br, desemprego,
dívida bruta, IGP-M); Ibovespa em dólar e descontada a inflação; máxima histórica; juros dos EUA e Brent; diferencial
Brasil x EUA; agenda com navegação entre meses e exportação `.ics`; glossário com botões "?" e modo explicativo;
calculadora de rendimento; barra de navegação no rodapé do celular; tela de carregamento; CSV; prévia de link com os
números do dia; período do gráfico lembrado; leituras em Markdown e resumo automático; validação dos dados; testes
(pytest e navegador); aviso no Telegram (opcional, por segredos); versões fixas e Dependabot; publicação no Pages;
selos no README; `manual.json`; código dividido por aba; feed RSS; seção "Sobre" com como citar; Fed funds e inflação
dos EUA pelo FRED; **fonte com link em todos os blocos** (dados só de fontes oficiais: BC, IBGE, B3, Tesouro e FRED).

**Não implementado, e por quê:**

| Ideia | Motivo |
|---|---|
| Top 5 e Focus mensal do IPCA | Ficaram para depois, para não sobrecarregar a aba Expectativas |
| Divulgações do IBGE e reuniões do Fed na agenda | Sem fonte confiável de datas sem chave; o `manual.json` ganhou o campo `eventos` para cadastrar |
| Compartilhar card como imagem | Exigiria uma biblioteca externa; o painel segue sem dependências. A prévia do link já mostra os números |
| Tema claro / alto contraste | Mudaria a identidade visual, que foi mantida |
| Versão em inglês | Esforço grande; fica para uma próxima etapa |
| Boletim por e-mail e alertas para visitantes | Precisam de servidor ou serviço pago; ficaram o RSS e o Telegram do autor |
| Tirar todos os estilos inline | Feito em parte (classes para os padrões repetidos); o resto sai aos poucos |

---

## As 6 melhores apostas

Combinam muito valor para quem usa com pouco esforço, e várias reaproveitam dados que o coletor **já baixa**.

| # | Ideia | Por que vale | Esforço |
|---|---|---|---|
| 1 | **"O que mudou desde a sua última visita"** | Dá sentido ao sino de alertas (hoje ele mostra sempre "5"). Guarda no navegador os números da última visita e destaca só o que mudou. | P |
| 2 | **Bolsa x renda fixa em 10 anos** (Ibovespa x CDI acumulado) | É a comparação que todo leitor brasileiro quer ver. O Ibovespa já é coletado; falta só o CDI (SGS 12). | P–M |
| 3 | **Histórico semanal do Focus** guardado no repositório | Permite gráficos de "como a expectativa evoluiu" e responder "há quantas semanas o IPCA sobe?", pergunta que o painel faz hoje sem ter o dado. | M |
| 4 | **Expectativa do Copom reunião a reunião** | Hoje o card "O que o mercado precifica" só compara com dezembro. O Focus publica a Selic esperada **por reunião** (endpoint `ExpectativasMercadoSelic`, campo `Reuniao`, *confirmar*). | P–M |
| 5 | **Links por seção e botão Voltar funcionando** (`#expectativas`, `#agenda`) | Hoje trocar de tela não muda o endereço: o "Voltar" do navegador sai do site e não dá para mandar link direto de uma seção. | P |
| 6 | **Volatilidade calculada automaticamente** no lugar do índice do medo manual | Elimina o dado que mais fica desatualizado. A volatilidade realizada de 21 pregões sai dos fechamentos que já são coletados. O VIX brasileiro pode continuar como referência manual. | P |

---

## 1. Informação nova para quem usa

### Juros
- **Juro real ex-ante (olhando para frente).** O "juro real hoje" mistura a Selic de hoje com a inflação dos
  **últimos** 12 meses (ex-post). Analistas e o próprio BC usam o juro real com a inflação **esperada** nos
  próximos 12 meses. O Focus publica `ExpectativasMercadoInflacao12Meses` *(confirmar)*. Mostrar os dois lado a
  lado e explicar a diferença na Metodologia. **M**
- **Juro real de mercado (NTN-B / Tesouro IPCA+).** É a taxa real que o mercado paga de fato. Os preços e taxas
  diários estão nos dados abertos do Tesouro Transparente (CSV público, *confirmar URL*). Também dá para calcular a
  **inflação implícita** (prefixado − IPCA+) e compará-la com o Focus. **M**
- **Linha do tempo da Selic com cada decisão do Copom.** Gráfico em degraus desde 2017, marcando cortes, altas e
  manutenções. Os dados diários da Selic **já estão** no coletor; hoje só o último valor é usado. **P**
- **Ciclos de juros.** "Este ciclo de cortes começou em mar/2026 e já cortou 1,25 p.p.", calculado a partir da
  série. **P**

### Inflação
- **IPCA do mês**, não só o de 12 meses (SGS 433), com o "acumulado no ano". **P**
- **Inflação por grupo** (alimentos, transportes, habitação…), pela API SIDRA do IBGE, tabela 7060 *(confirmar)*.
  Mostra o que puxou a inflação. **M**
- **Núcleos de inflação** (tiram itens voláteis), que o BC acompanha de perto e estão no SGS *(confirmar códigos)*. **M**
- **Contador da meta contínua.** Com a meta contínua, o descumprimento acontece quando o IPCA fica fora da banda
  por 6 meses seguidos. Um contador "X meses seguidos acima do teto" é simples e muito informativo. **P**

### Expectativas (Focus)
- **Incerteza das projeções.** A API do Focus traz `Minimo`, `Maximo`, `DesvioPadrao` e `numeroRespondentes`.
  Mostrar a faixa ao redor da mediana revela quando o mercado está dividido. **P** (é só pedir mais colunas no `$select`)
- **Top 5** (as instituições que mais acertam), endpoints `Top5` do Focus *(confirmar)*. **P–M**
- **Focus mensal do IPCA** para os próximos meses. **M**

### Atividade, emprego, câmbio e contas públicas
Hoje o painel fala de juros e inflação, mas o Focus já mostra PIB e câmbio sem o dado realizado para comparar.

| Indicador | Fonte (SGS) | Esforço |
|---|---|---|
| Dólar (PTAX venda) | SGS 1 | P |
| IBC-Br (prévia mensal do PIB) | SGS 24363 / 24364 (com ajuste sazonal) | P |
| Desemprego (PNAD Contínua) | SGS 24369 | P |
| Dívida bruta do governo (% do PIB) | SGS 13762 | P |
| IGP-M (reajuste de aluguel) | SGS 189 | P |

Uma 5ª aba, **"Economia real"**, organizaria isso sem poluir a visão geral.

### Bolsa
- **Ibovespa x CDI** (ver "melhores apostas").
- **Ibovespa em dólar** e **Ibovespa descontada a inflação**, com dados que já existem mais a PTAX. **P**
- **Distância da máxima histórica**, além da de 12 meses. **P**

### Mundo
- Automatizar o card "Brasil no mundo": juros e inflação dos EUA (FRED, que exige chave gratuita) ou taxa do Tesouro
  americano de 10 anos e petróleo via yfinance (`^TNX`, `BZ=F`). **M**
- **Diferencial de juros Brasil x EUA**, que ajuda a explicar o câmbio. **M**

### Agenda
- Incluir **divulgações do IBGE** (IPCA, PIB, PNAD), **reuniões do Fed** e **comunicados/atas** com link. O IBGE tem
  API de calendário *(confirmar)*; o resto pode ficar no `manual.js`. **M**
- **Navegar entre meses** e exportar para o Google Agenda/Outlook (arquivo `.ics`, gerado pelo próprio coletor). **M**

---

## 2. Experiência e interface

- **Glossário e botões "?"** em cada card: o que é Selic, juro neutro, Focus, banda da meta. O projeto tem perfil
  didático, e isso amplia muito o público. **P–M**
- **Modo "explique para mim":** um interruptor que troca as legendas técnicas por frases simples
  ("o juro está alto: crédito caro, renda fixa rende bem"). **M**
- **Calculadora "Quanto rende meu dinheiro":** R$ X em poupança, Tesouro Selic e CDB 100% do CDI, já descontando
  IR e inflação. É a aplicação prática do juro real e o recurso mais compartilhável. **M**
- **Navegação de celular no rodapé** (substituindo os dois menus duplicados). **P**
- **Esqueleto de carregamento** (cards cinza pulsando) enquanto o `dados.json` chega, em vez de tela vazia. **P**
- **Compartilhar um card como imagem** (gerar PNG do SVG) e **baixar os dados em CSV**. **M**
- **Prévia de link com os números do dia:** o robô gera um `og-image.png` ("Selic 13,75% · IPCA 4,58%") e reescreve
  a `meta description`. Assim o link no WhatsApp/LinkedIn já mostra os números. **M**
- **Tema claro / alto contraste** para leitura no sol ou em projetor. **M**
- **Lembrar a última aba e o período do gráfico** escolhido (localStorage). **P**
- **Leitura da semana mais fácil de escrever:** um arquivo Markdown por semana (`leituras/2026-11-09.md`) em vez de
  texto dentro do JS, com **arquivo das leituras anteriores**. Enquanto não houver leitura nova, mostrar um
  **resumo automático** montado a partir dos números ("Nesta semana o mercado elevou a Selic esperada para 2027 de
  11,75% para 12,50%…"). **M**

---

## 3. Confiabilidade e bastidores

- **Validar o `dados.json` antes do commit:** checar campos obrigatórios, faixas plausíveis (Selic entre 0 e 30,
  Ibovespa > 0) e datas recentes. Se falhar, não publica e avisa. **P**
- **Testes automáticos:** `pytest` com respostas gravadas das APIs para o `coletar.py`, e um teste com Playwright
  que abre o site e verifica que nenhum card quebrou. Rodar em todo pull request. **M**
- **Aviso quando o robô falhar:** mensagem no Telegram ou e-mail a partir do próprio GitHub Actions (com a chave do
  bot guardada nos *secrets* do repositório). **P**
- **Fixar versões** no `requirements.txt` e ativar o Dependabot para atualizar com segurança. **P**
- **Publicação automática** com um workflow do GitHub Pages que publica a pasta `site/`. **P**
- **Selo de status no README** ("última atualização: há 2 h"). **P**
- **`manual.js` → `manual.json`**, editável direto pelo GitHub (sem risco de quebrar o JavaScript com uma vírgula),
  com um teste que acusa reuniões do Copom fora de quarta-feira e calendário acabando. **P**
- **Organizar o código:** separar o `painel.js` (587 linhas) por seção e trocar os estilos inline do `index.html`
  por classes. Toda nova seção fica mais rápida de criar e mais consistente. **G** (fazer aos poucos)

---

## 4. Alcance

- **Feed RSS / boletim por e-mail** com o resumo semanal (o robô gera o `feed.xml`). **P–M**
- **Alertas opt-in no Telegram:** "O Copom decidiu", "O Focus de IPCA passou do teto". **M**
- **Página "Sobre"** com o autor, o propósito e como citar o painel. **P**
- **Versão em inglês** para estrangeiros que acompanham o Brasil. **G**

---

## Sugestão de ordem

1. **Antes de tudo:** corrigir o "plano rápido" do RELATORIO-UX.md (datas do Copom, card desatualizado,
   leitura vazia, calendário de 2027).
2. **Base:** validação do JSON, versões fixas, aviso de falha, links por seção, navegação no rodapé do celular.
3. **Conteúdo com dados já coletados:** linha do tempo da Selic, volatilidade automática, IPCA do mês,
   "o que mudou desde sua visita", faixa de incerteza do Focus.
4. **Novas fontes:** CDI (bolsa x renda fixa e calculadora de rendimento), Focus por reunião, histórico do Focus,
   juro real ex-ante.
5. **Expansão:** aba "Economia real", NTN-B e inflação implícita, agenda ampliada, compartilhamento e alertas.
