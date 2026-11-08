"""
trilha.py — trilha instrumental discreta da apresentação (85 s), sintetizada do zero (sem samples).

Sincronizada com o roteiro (site/apresentacao/apresentacao.js):
  0–10 s   introdução: pad entra devagar, brilho agudo leve
  10 s     o painel: entra o pulso grave
  25 s     indicadores: "ticks" de dados com as notas do acorde
  50 s     interatividade: cliques suaves nos mesmos instantes dos cliques do cursor
  70 s     encerramento: resolve no acorde inicial e some
Antes de cada capítulo, um respiro de ruído filtrado.

Rodar: python video/ferramentas/trilha.py   (gera video/saida/trilha.wav; o MP3 do site sai do montar.sh)
"""

import wave
from pathlib import Path

import numpy as np

SR = 48000
DUR = 85.0
BPM = 100
BATIDA = 60 / BPM
CAPITULOS = [10.0, 25.0, 50.0, 70.0]
CLIQUES = [51.75, 55.55, 57.6, 59.8, 63.4, 65.1, 67.2]
SAIDA = Path(__file__).resolve().parents[1] / "saida" / "trilha.wav"

rng = np.random.default_rng(7)
n = int(SR * DUR)
t = np.arange(n) / SR
L = np.zeros(n)
R = np.zeros(n)


def nota(midi):
    return 440.0 * 2 ** ((midi - 69) / 12)


def suavizar(x, corte):
    """Passa-baixa de um polo (deixa o timbre macio)."""
    a = np.exp(-2 * np.pi * corte / SR)
    y = np.empty_like(x)
    acc = 0.0
    for i in range(0, len(x), 4096):  # em blocos, com o estado carregado
        bloco = x[i:i + 4096]
        out = np.empty_like(bloco)
        for j, v in enumerate(bloco):
            acc = (1 - a) * v + a * acc
            out[j] = acc
        y[i:i + 4096] = out
    return y


def envelope(m, ataque, soltura):
    e = np.ones(m)
    a = min(int(ataque * SR), m // 2)
    s = min(int(soltura * SR), m // 2)
    if a:
        e[:a] = np.sin(np.linspace(0, np.pi / 2, a)) ** 2
    if s:
        e[-s:] *= np.cos(np.linspace(0, np.pi / 2, s)) ** 2
    return e


def somar(ini, sinal_l, sinal_r=None):
    i0 = int(ini * SR)
    if i0 >= n:
        return
    m = min(len(sinal_l), n - i0)
    L[i0:i0 + m] += sinal_l[:m]
    R[i0:i0 + m] += (sinal_r if sinal_r is not None else sinal_l)[:m]


# ---------- pad: Am9 · Fmaj7 · Cmaj7 · G6, dois compassos cada
ACORDES = [[57, 60, 64, 67, 71], [53, 57, 60, 64, 69], [48, 55, 59, 64, 67], [55, 59, 62, 64, 67]]
COMPASSO = 4 * BATIDA
seg = 2 * COMPASSO
inicio = 0.0
k = 0
while inicio < DUR:
    acorde = ACORDES[k % len(ACORDES)]
    if inicio >= 80.4:
        acorde = ACORDES[0]  # resolve no acorde inicial
    dur = min(seg + 1.6, DUR - inicio)
    m = int(dur * SR)
    tt = np.arange(m) / SR
    pl, pr = np.zeros(m), np.zeros(m)
    for f0 in map(nota, acorde):
        for h in range(1, 6):
            amp = 1 / h ** 1.6
            fase = rng.uniform(0, 2 * np.pi)
            pl += amp * np.sin(2 * np.pi * f0 * h * 0.9986 * tt + fase)
            pr += amp * np.sin(2 * np.pi * f0 * h * 1.0014 * tt + fase + 0.3)
    env = envelope(m, 1.4, 1.6) * 0.028
    somar(inicio, pl * env, pr * env)
    inicio += seg
    k += 1

# mais aberto depois da introdução, fecha no fim
L = suavizar(L, 2200)
R = suavizar(R, 2200)
geral = np.interp(t, [0, 3.5, 9.5, 11, 80, DUR], [0.0, 0.55, 0.6, 0.85, 0.85, 0.0])
L *= geral
R *= geral

# ---------- pulso grave nas batidas (a partir do painel)
pulso_env = np.interp(t, [0, 10, 11, 24.5, 25, 69.5, 70.5, 80, 83], [0, 0, 0.6, 0.6, 1, 1, 0.55, 0.4, 0])
b = 10.0
while b < 83:
    acorde = ACORDES[int(b // seg) % len(ACORDES)]
    f = nota(acorde[0] - 24)
    m = int(0.5 * SR)
    tt = np.arange(m) / SR
    s = np.sin(2 * np.pi * f * tt) * np.exp(-tt * 7) * 0.16 * np.interp(b, t, pulso_env)
    somar(b, s)
    b += BATIDA

# ---------- ticks de dados (notas do acorde, oitava acima), nos indicadores e na interatividade
tick_env = np.interp(t, [0, 25, 26, 49.5, 50, 69.5, 70.5, DUR], [0, 0, 1, 1, 0.75, 0.75, 0, 0])
b = 25.0
i = 0
while b < 70.5:
    acorde = ACORDES[int(b // seg) % len(ACORDES)]
    f = nota(acorde[i % len(acorde)] + 12)
    m = int(0.22 * SR)
    tt = np.arange(m) / SR
    s = np.sin(2 * np.pi * f * tt) * np.exp(-tt * 22) * 0.05 * np.interp(b, t, tick_env)
    pan = 0.5 + 0.35 * np.sin(i * 1.7)
    somar(b, s * (1 - pan) * 2, s * pan * 2)
    b += BATIDA / 2
    i += 1

# ---------- brilho agudo na introdução e no fim
for ini, fim in ((0.6, 9.6), (80.6, 84.6)):
    m = int((fim - ini) * SR)
    tt = np.arange(m) / SR
    s = (np.sin(2 * np.pi * nota(88) * tt) + 0.6 * np.sin(2 * np.pi * nota(95) * tt)) * envelope(m, 2.5, 3.0) * 0.006
    somar(ini, s * np.sin(2 * np.pi * 0.21 * tt) ** 2, s * np.cos(2 * np.pi * 0.21 * tt) ** 2)

# ---------- respiro (ruído filtrado subindo) antes de cada capítulo + toque grave na entrada
for c in CAPITULOS:
    m = int(1.4 * SR)
    ruido = suavizar(rng.standard_normal(m), 900) * 3
    sobe = np.linspace(0, 1, m) ** 2.2
    sobe[-int(0.08 * SR):] *= np.linspace(1, 0, int(0.08 * SR))
    somar(c - 1.4, ruido * sobe * 0.05, ruido[::-1].copy() * sobe * 0.05)
    mm = int(1.2 * SR)
    tt = np.arange(mm) / SR
    grave = np.sin(2 * np.pi * (nota(33) * (1 + 0.6 * np.exp(-tt * 9))) * tt) * np.exp(-tt * 3.2) * 0.2
    somar(c, grave)

# ---------- cliques de interface (mesmos instantes dos cliques do cursor)
for c in CLIQUES:
    m = int(0.06 * SR)
    tt = np.arange(m) / SR
    s = (np.sin(2 * np.pi * 2400 * tt) * 0.5 + rng.standard_normal(m) * 0.3) * np.exp(-tt * 140) * 0.09
    somar(c, s)

# ---------- mixagem: discreta, sem estourar
mix = np.stack([L, R], axis=1)
pico = np.max(np.abs(mix))
mix = mix / pico * 0.6  # pico em −4,4 dBFS (≈ −21 LUFS): trilha de fundo
fade = np.ones(n)
fade[-int(2.5 * SR):] = np.linspace(1, 0, int(2.5 * SR)) ** 1.5
mix *= fade[:, None]

SAIDA.parent.mkdir(parents=True, exist_ok=True)
with wave.open(str(SAIDA), "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes((np.clip(mix, -1, 1) * 32767).astype("<i2").tobytes())
print(f"trilha: {SAIDA} ({DUR:.0f} s, {SR} Hz)")
