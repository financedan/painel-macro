#!/usr/bin/env bash
# montar.sh — refaz a apresentação inteira: frames reais, trilha e vídeo.
# Rodar da raiz do repositório:  bash video/ferramentas/montar.sh
# Requer: python3 com numpy, node com playwright (Chromium) e ffmpeg.
set -euo pipefail
cd "$(dirname "$0")/../.."

PORTA=8765
python3 -m http.server "$PORTA" --directory site >/dev/null 2>&1 &
SERVIDOR=$!
trap 'kill $SERVIDOR 2>/dev/null || true' EXIT
sleep 1

echo "1/3 Capturando os frames reais do painel"
PAINEL_URL="http://localhost:$PORTA/" node video/ferramentas/capturar.js

echo "2/3 Gerando a trilha"
python3 video/ferramentas/trilha.py
ffmpeg -hide_banner -loglevel error -y -i video/saida/trilha.wav -c:a libmp3lame -b:a 160k site/apresentacao/trilha.mp3

echo "3/3 Renderizando o vídeo (1920x1080, 30 quadros/s)"
node video/ferramentas/renderizar.js
ffmpeg -hide_banner -loglevel error -y -ss 82.5 -i video/saida/painel-macro-brasil.mp4 -frames:v 1 -q:v 2 video/saida/capa.jpg

echo "Pronto: video/saida/painel-macro-brasil.mp4 e site/apresentacao/"
