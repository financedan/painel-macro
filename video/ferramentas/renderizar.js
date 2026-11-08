/*
 * renderizar.js — gera o MP4 da apresentação, quadro a quadro, a partir de site/apresentacao/.
 *
 * Rodar (da raiz do repositório):  node video/ferramentas/renderizar.js
 * Opções por variável de ambiente: FPS=30  INICIO=0  FIM=85  SAIDA=video/saida/painel-macro-brasil.mp4
 *
 * Como funciona: sobe um servidor local para a pasta site/, abre apresentacao/?render=1 em 1920x1080,
 * chama apresentacao.render(t) para cada quadro e envia a imagem direto para o ffmpeg (sem gravar milhares
 * de PNGs no disco). O ffmpeg junta a trilha (video/saida/trilha.wav) e os capítulos (capitulos.txt).
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { chromium } = require('playwright');

const RAIZ = path.join(__dirname, '..', '..');
const SITE = path.join(RAIZ, 'site');
const FPS = Number(process.env.FPS || 30);
const INICIO = Number(process.env.INICIO || 0);
const FIM = Number(process.env.FIM || 85);
const SAIDA = path.resolve(RAIZ, process.env.SAIDA || 'video/saida/painel-macro-brasil.mp4');
const TRILHA = path.join(RAIZ, 'video', 'saida', 'trilha.wav');
const CAPITULOS = path.join(__dirname, 'capitulos.txt');
const TIPOS = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.png': 'image/png', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg' };

const servidor = () => new Promise((ok) => {
  const s = http.createServer((req, res) => {
    let nome = decodeURIComponent(req.url.split('?')[0]);
    if (nome.endsWith('/')) nome += 'index.html';
    const arq = path.join(SITE, nome);
    if (!arq.startsWith(SITE) || !fs.existsSync(arq)) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': TIPOS[path.extname(arq)] || 'application/octet-stream' });
    fs.createReadStream(arq).pipe(res);
  });
  s.listen(0, () => ok(s));
});

(async () => {
  fs.mkdirSync(path.dirname(SAIDA), { recursive: true });
  const srv = await servidor();
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const erros = [];
  p.on('pageerror', (e) => erros.push(e.message));
  await p.goto('http://localhost:' + srv.address().port + '/apresentacao/?render=1', { waitUntil: 'networkidle' });
  await p.evaluate(() => window.apresentacao.pronto);
  if (erros.length) throw new Error(erros.join('\n'));

  const comAudio = fs.existsSync(TRILHA) && INICIO === 0;
  const args = ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'image2pipe', '-framerate', String(FPS), '-i', '-'];
  if (comAudio) args.push('-i', TRILHA, '-i', CAPITULOS, '-map', '0:v', '-map', '1:a', '-map_chapters', '2', '-c:a', 'aac', '-b:a', '192k', '-shortest');
  args.push('-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-movflags', '+faststart',
    '-metadata', 'title=Painel Macro Brasil', '-metadata', 'comment=Apresentação do Painel Macro Brasil com frames reais do painel', SAIDA);
  const ff = spawn('ffmpeg', args, { stdio: ['pipe', 'inherit', 'inherit'] });
  const fim = new Promise((ok, erro) => ff.on('close', (c) => (c === 0 ? ok() : erro(new Error('ffmpeg saiu com ' + c)))));

  const total = Math.round((FIM - INICIO) * FPS);
  const t0 = Date.now();
  for (let i = 0; i < total; i++) {
    const t = INICIO + i / FPS;
    await p.evaluate((t) => window.apresentacao.render(t), t);
    const img = await p.screenshot({ type: 'png' });
    if (!ff.stdin.write(img)) await new Promise((ok) => ff.stdin.once('drain', ok));
    if (i % 150 === 0) process.stdout.write('  ' + t.toFixed(1) + ' s (' + Math.round((Date.now() - t0) / 1000) + ' s de render)\n');
  }
  ff.stdin.end();
  await fim;
  await b.close();
  srv.close();
  console.log('Vídeo: ' + SAIDA + ' (' + total + ' quadros, ' + Math.round((Date.now() - t0) / 1000) + ' s)');
})().catch((e) => { console.error(e); process.exit(1); });
