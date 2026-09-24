# Pro Edition — o programa

O Pro Edition fora do Premiere. Um programa com janela (Electron) que faz o
trabalho pesado e entrega ao Premiere o que ele abre pronto:

- **legendas** em `.srt` (texto e preços em arquivos separados, como no painel);
- **sequências** em XML do Final Cut Pro 7 (`Arquivo > Importar` no Premiere):
  cortes, B-roll, split, trilha, fim de cada variação.

O Premiere fica para revisar e exportar. Não há API da timeline fora dele: o
XML é a ponte (`src/xml.ts`).

## Abrir

Atalho **Pro Edition** na área de trabalho (criado por `scripts/atalho.ps1`).
Pelo terminal: `npm start` dentro de `app/`.

Primeira vez numa máquina: `npm run preparar` na raiz (instala e baixa o
Electron). O ffmpeg precisa estar no PATH (`winget install ffmpeg`).

## Como é feito

```
src/main.ts        processo principal: janela, diálogos, ipc
src/preload.ts     ponte: a tela só enxerga window.pro (src/api.ts)
src/ui/            a tela (HTML/CSS/TS, mesma família visual do painel)
src/motor/         ffmpeg/ffprobe, ElevenLabs, configurações (Node)
src/xml.ts         Sequencia -> XML do Premiere (puro, testado)
```

O núcleo de cada ferramenta **não é copiado**: o programa importa direto de
`ferramentas/pro-captions/src`, `ferramentas/auto-broll/src` e `src/` da raiz.
Só a ponta muda (ffmpeg no lugar do export do Premiere, XML no lugar da API).

Conferir a tela sem abrir na mão: `PRO_EDITION_PRINT=saida.png` tira um
retrato da janela e fecha. Passar um arquivo na linha de comando abre ele na
Legenda (é o "Abrir com" do Windows).

## Fases

| Fase | O quê | Estado |
|---|---|---|
| 0 | Prova do XML no Premiere (`scripts/prova-xml.ts`) | **esperando o Leo importar** |
| 1 | Programa + Legendas (arrasta vídeo/áudio → revisa → `.srt`) | feito (2026-09-24) |
| 2 | Auto Pausas: brutas → sequência sem pausas (zoom 90, enquadramento) | a fazer |
| 3 | Auto B-roll: B-roll pela fala, na V2 | a fazer |
| 4 | Auto Split, trilha e fim de cada variação, crop/flop | a fazer |
| 5 | Podcast AutoCut (2 câmeras, 2 microfones) | a fazer |
| 6 | Instalador `.exe` (Leo e Felipe) com ffmpeg junto | a fazer |

### Fase 0 — o que a prova precisa mostrar

`node scripts/prova-xml.ts` gera `prova/PROVA-Pro-Edition.xml` com arquivos
reais (bruta C1639, B-roll "Consulta médica (1)", trilha "The Horror Piano").
Importar no Premiere 2025 e conferir:

1. sequência 1080×1920, 25 fps, 8,7 s, sem pedir para localizar mídia;
2. V1: 3 clipes do C1639 com Escala 90;
3. 2º clipe da V1 com Posição 810/960 — se vier outro número, o
   `deslocamento` em `xml.ts` usa a convenção errada (meia largura?);
4. 3º clipe espelhado (filtro Flop do FCP);
5. V2: B-roll com Escala 150 e Cortar Superior 50%;
6. V3: clipe desativado;
7. A1 vinculado ao V1, com crossfade nos cortes;
8. A2: trilha a −12 dB.

Referência de como o Premiere escreve o mesmo formato: exportar a sequência
"Reels" do Andro 19.09 por `Arquivo > Exportar > Final Cut Pro XML` para
`prova/reels.xml`.

**Limite conhecido:** Lumetri não viaja no XML do FCP. O Leo aplica a cor
depois (um preset em todos os clipes da V1, ou camada de ajuste).

### Como a timeline real é (Andro 19.09, lido do .prproj)

- sequência "Reels" 1080×1920, 25 fps; ~24 variações em fila, ~60 s cada, com
  ~10 s de intervalo;
- V1: 723 pedaços das 4 brutas (3840×2160, 25 fps, HEVC), todos com Escala 90
  e Lumetri; 176 com Posição x deslocada (0,6185 = +128 px) — enquadramento;
- A1: o áudio tratado no Adobe Podcast (esv2), recolocado em 24 trechos, com
  crossfade "Constant Power" nos cortes;
- legendas em trilha de legenda própria; sem B-roll e sem trilha neste projeto.
