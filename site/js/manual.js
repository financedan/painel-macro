/*
 * manual.js — dados que NÃO têm fonte automática.
 * Tudo o que vem do Banco Central e do Ibovespa é atualizado pelo robô (dados.json).
 * O que está aqui você atualiza à mão quando mudar.
 */
window.MANUAL = {
  autor: { nome: 'Daniel', nomeCompleto: 'Daniel Prado', iniciais: 'DP' },

  // Reuniões do Copom: 1º dia e dia da decisão (AAAA-MM-DD).
  // A ata é calculada sozinha (terça seguinte) e o Focus sai toda segunda.
  // Quando o BC divulgar o calendário de 2027, acrescente as reuniões aqui.
  copom: [
    { inicio: '2026-09-16', decisao: '2026-09-17' },
    { inicio: '2026-11-03', decisao: '2026-11-04' },
    { inicio: '2026-12-08', decisao: '2026-12-09', nota: 'última de 2026' },
  ],

  // Feriados nacionais (sem pregão e sem Focus na segunda).
  feriados: [
    ['2026-11-02', 'Finados', 'Mercado fechado'],
    ['2026-11-15', 'Proclamação da República', 'Domingo'],
    ['2026-11-20', 'Dia da Consciência Negra', 'Mercado fechado'],
    ['2026-12-25', 'Natal', 'Mercado fechado'],
    ['2027-01-01', 'Confraternização Universal', 'Mercado fechado'],
  ],

  // Índice do medo (S&P/B3 Ibovespa VIX): não tem API gratuita, atualize à mão.
  medo: {
    leituras: [['2/out', 32.77], ['5/out', 23.68], ['17/out', 40.67], ['21/out', 42.42], ['22/out', 45.27], ['26/out', 26.11]],
    recorde: { valor: 45.27, data: '22/10' },
    ultimoDado: '26/10/2026, 14h40 (durante o pregão)',
    comentario: 'O medo caiu cerca de 40% no dia em que a bolsa despencou: a incerteza da eleição acabou. Para analistas, o risco agora é fiscal.',
    fonte: 'valores citados pela imprensa até 26/10/2026',
  },

  // Sua leitura da semana: escreva depois de ler o Focus de segunda.
  // Enquanto o texto estiver vazio, o painel mostra um aviso no lugar.
  leitura: {
    data: '',
    texto: '',
  },
};
