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
src/xml-ler.ts     XML exportado do Premiere -> Sequencia (puro, testado)
src/pausas.ts      Auto Pausas sobre a Sequencia (regra de src/pausas.ts da raiz)
```

### Auto Pausas

Entra o XML que o Premiere exporta da sequência separada (ou as brutas
soltas, cada uma vira um clipe com 3 s de respiro). Para cada arquivo da V1:
ffmpeg tira o WAV, `wav.ts` mede o nível por janela de 20 ms, o ElevenLabs
transcreve (guardado pela assinatura). A regra do painel decide os cortes; o
espaço entre vídeos fica; cada pedaço herda escala/posição/espelho do clipe;
crossfade de 2 quadros onde dois pedaços se encostam. A fala já sai no tempo
da sequência nova, então a legenda vem junto sem transcrever de novo.

Teste com dado real (áudio da variação 1, já limpo pelo Leo): 58,5 s → 57,3 s,
11 cortes, 174 de 174 palavras presentes.

### Auto B-roll

Entra o XML da sequência (já sem pausas). A fala vem da transcrição de cada
arquivo da V1 (a mesma que o Auto Pausas pagou) levada ao tempo da sequência
(`src/sequencia.ts`). O núcleo é o do painel (`analisarPalavras`, `planejar`,
`semSobrepor`), com o aprendizado que o painel juntou — lido da pasta
`PluginData` mais recente (Premiere 25/26, Pro Edition ou Auto B-roll):
`aprendizado.json`, `ligacoes.json`, `sinonimos.json`, `intensidade.json`,
`config.json` (pasta da biblioteca). Só leitura: o **Aprender** (ver o que o Leo
manteve ou apagou) continua no painel até ser portado.

A biblioteca é sondada pelo ffprobe uma vez (cache `biblioteca.json` na pasta
do programa). B-roll entra na V2 cobrindo a tela, sem áudio; o que já está na
V2 fica e nada entra por cima.

Dado real (variação 1, biblioteca de 251 arquivos, aprendizado do Leo): 6
B-rolls — Frustrado, Hormônio em "hormônio", Doutor em "Eu sou médico",
Consulta médica em "A consulta aqui" — e 9 recusas com motivo.

### Acabamento

Variação = trecho contínuo da V1 (o espaço de ≥ 1 s entre vídeos separa).
B-roll que passa do fim do doutor é aparado; o que começa num espaço sai.
Split (opcional): a geometria do painel (`src/autosplit.ts`,
`calcularEnquadramento`) com o perfil empacotado (`src/autosplit-perfil.json`)
e os ajustes que o Leo ensinou (`autosplit-perfil-override.json` do PluginData)
→ escala, posição e Cortar (topo + feather 5%) no XML. O "subir o doutor" do
painel só vale para bruta em pé e ficou de fora (as brutas do Andro são
deitadas). Trilha (opcional): a música do começo, repetindo se for curta,
cortada no fim de cada variação, no volume escolhido (padrão −20 dB).

**Crop/flop do doutor largado na cadeira** é decisão de olho: continua manual.
Automatizar pede ver o quadro (modelo de visão), fase futura.

**Limite:** o XML de saída leva a V1/A1 como o leitor entendeu (sem Lumetri).
Se o Premiere perder a cor, copiar só a V2 da sequência importada para a
sequência original (mesmo tempo, cola no 00:00 com a V2 alvo).

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
| 2 | Auto Pausas: XML exportado do Premiere (ou brutas) → XML sem pausas + legenda | feito (2026-09-24), falta rodar com a chave |
| 3 | Auto B-roll: XML → B-roll pela fala na V2, com o aprendizado do painel | feito (2026-09-24); o Aprender ainda é do painel |
| 4 | Acabamento: Split, trilha por variação, B-roll e trilha terminando com o doutor | feito (2026-09-24); crop/flop do doutor fica manual |
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
