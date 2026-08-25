# Pro Edition — Podcast AutoCut
## Especificação de implementação para Claude

**Repositório atual:** https://github.com/leogiora/Pro-Edition  
**Nova ferramenta:** Podcast AutoCut  
**Plataforma:** Adobe Premiere Pro + UXP  
**Objetivo:** editar automaticamente um podcast de 2 pessoas usando 2 câmeras + 2 microfones separados, sem criar uma track final V3 e mantendo tudo fácil de corrigir manualmente.

---

## 1. Resultado obrigatório

O usuário colocará na timeline:

- `V1` = câmera da Pessoa A
- `A1` = microfone da Pessoa A
- `V2` = câmera da Pessoa B
- `A2` = microfone da Pessoa B

Essas tracks são apenas defaults. A UI deve permitir escolher outras tracks.

O plugin deve detectar quem está falando, criar **os mesmos cortes nas quatro tracks** e alternar os pares com enable/disable.

### Quando Pessoa A fala

```text
V1 CAM A = ON
A1 MIC A = ON

V2 CAM B = OFF
A2 MIC B = OFF
```

### Quando Pessoa B fala

```text
V1 CAM A = OFF
A1 MIC A = OFF

V2 CAM B = ON
A2 MIC B = ON
```

### Timeline final

```text
                00:00       00:06       00:13       00:20

V2 CAM B       [ OFF ]     [ ON  ]     [ OFF ]     [ ON  ]
V1 CAM A       [ ON  ]     [ OFF ]     [ ON  ]     [ OFF ]

A2 MIC B       [ OFF ]     [ ON  ]     [ OFF ]     [ ON  ]
A1 MIC A       [ ON  ]     [ OFF ]     [ ON  ]     [ OFF ]
```

**Não criar V3.**

**Não deixar A1/A2 contínuos.**

Vídeos e áudios precisam ser cortados nos mesmos timestamps.

---

## 2. Princípio de domínio

Pessoa A e Pessoa B devem ser tratadas como bundles:

```ts
type SpeakerId = "A" | "B";

interface SpeakerBundle {
  speakerId: SpeakerId;
  videoTrackIndex: number;
  audioTrackIndex: number;
}
```

No modo padrão:

```text
Pessoa A = câmera A + áudio A
Pessoa B = câmera B + áudio B
```

Nunca permitir no resultado padrão:

```text
V1 ON + A1 OFF
V1 OFF + A1 ON
```

O vídeo e o áudio da mesma pessoa devem sempre ter o mesmo estado.

---

## 3. Fluxo do usuário

```text
1. Usuário sincroniza 2 câmeras + 2 áudios.
2. Abre Pro Edition > Podcast AutoCut.
3. Mapeia:
   Pessoa A → vídeo + áudio
   Pessoa B → vídeo + áudio
4. Clica ANALISAR.
5. Plugin detecta quem fala.
6. Plugin mostra preview das trocas.
7. Usuário clica APLICAR AUTOCUT.
8. Plugin corta V1/V2/A1/A2 nos mesmos pontos.
9. Aplica enable/disable.
10. Usuário continua corrigindo normalmente na timeline.
```

Separar obrigatoriamente:

```text
ANALISAR
```

de:

```text
APLICAR AUTOCUT
```

Não modificar a timeline durante a análise.

---

## 4. Estratégia de detecção de speaker

Como já existem dois microfones separados, **não começar por diarização**.

O problema deve ser tratado como:

```text
A1 → atividade de voz da Pessoa A
A2 → atividade de voz da Pessoa B
```

Usar principalmente:

- VAD;
- energia/RMS;
- dominância relativa;
- smoothing;
- hysteresis.

Fluxo:

```text
A1 → PCM → VAD → activity A ─┐
                              ├→ Decision Engine
A2 → PCM → VAD → activity B ─┘
                                      ↓
                             CameraDecision[]
                                      ↓
                               frame snapping
                                      ↓
                               TimelinePlan
```

---

## 5. Modelo de dados sugerido

```ts
interface AudioFrame {
  startMs: number;
  endMs: number;
  rms: number;
  speechProbability: number;
}

interface CameraDecision {
  startMs: number;
  endMs: number;
  activeSpeaker: "A" | "B";
  confidence: number;
  reason:
    | "speech-a"
    | "speech-b"
    | "dominant-a"
    | "dominant-b"
    | "hold-current"
    | "silence"
    | "overlap";
}

interface TimelineSegment {
  startFrame: number;
  endFrame: number;
  speaker: "A" | "B";

  states: {
    videoA: boolean;
    audioA: boolean;
    videoB: boolean;
    audioB: boolean;
  };
}
```

Exemplo:

```ts
{
  startFrame: 0,
  endFrame: 150,
  speaker: "A",
  states: {
    videoA: true,
    audioA: true,
    videoB: false,
    audioB: false
  }
}
```

---

## 6. Frame accuracy

Análise pode trabalhar em milissegundos.

A decisão final precisa ser convertida para frames da sequência.

```text
áudio → ms
decisão → ms
snap → frame
Premiere layer → TickTime
```

Criar:

```ts
function msToNearestFrame(ms: number, fps: number): number;
```

Nunca criar cut entre frames.

---

## 7. Regras de decisão do MVP

### Só A fala

```text
A speech = true
B speech = false

→ A
```

### Só B fala

```text
A speech = false
B speech = true

→ B
```

### Ninguém fala

No MVP:

```text
→ manter último speaker ativo
```

Isso evita cuts inúteis durante pequenas pausas.

### Os dois falam

No MVP:

```text
→ manter speaker atual
```

Se o outro microfone ficar claramente dominante durante tempo suficiente, pode haver troca.

Não alternar freneticamente em crosstalk.

---

## 8. Bleed entre microfones

Não assumir que A2 ficará totalmente silencioso quando A falar.

Exemplo:

```text
A1 = -12 dB
A2 = -31 dB
```

Mesmo que VAD detecte voz nos dois:

```text
A é dominante.
```

Portanto usar:

```text
speech probability
+
energia
+
diferença relativa entre canais
```

e não apenas threshold binário.

---

## 9. Anti-flicker

O plugin não pode trocar de câmera por:

- respiração;
- “aham” muito curto;
- risada curta;
- vazamento;
- sílaba isolada.

Criar config centralizada:

```ts
interface AutoCutConfig {
  minimumShotDurationMs: number;
  minimumSpeechDurationMs: number;
  switchHoldMs: number;
  silenceMergeMs: number;

  dominanceDb: number;
  dominanceHoldMs: number;

  preRollMs: number;
  postRollMs: number;
}
```

Defaults iniciais apenas para desenvolvimento:

```ts
{
  minimumShotDurationMs: 1200,
  minimumSpeechDurationMs: 250,
  switchHoldMs: 300,
  silenceMergeMs: 500,
  dominanceDb: 8,
  dominanceHoldMs: 350,
  preRollMs: 80,
  postRollMs: 120
}
```

Esses números devem ficar em config e serão calibrados depois.

---

## 10. Reaction shots

**Não implementar no MVP.**

MVP:

```text
speaker ativo
=
vídeo ativo + áudio ativo da mesma pessoa
```

No futuro poderemos permitir:

```text
vídeo = Pessoa B
áudio = Pessoa A
```

para reaction shots.

Por enquanto não expor isso na UI.

---

# INTEGRAÇÃO COM O PRO EDITION

## 11. Arquitetura atual observada

O repositório atual possui um shell que unifica as ferramentas.

Arquivos relevantes:

```text
Pro-Edition/
├─ manifest.json
├─ package.json
├─ src/
│  ├─ shell.ts
│  └─ ui/
│     ├─ main.ts
│     ├─ seletor.html
│     └─ seletor.css
└─ tests/
```

`src/shell.ts` atualmente possui:

```ts
export type Ferramenta = "seletor" | "broll" | "captions";
```

Alterar para:

```ts
export type Ferramenta =
  | "seletor"
  | "broll"
  | "captions"
  | "autocut";
```

---

## 12. Criar o AutoCut como ferramenta irmã

A arquitetura atual importa Auto B-roll e Pro Captions como módulos standalone com:

```text
HTML
CSS
mount()
```

Seguir o mesmo padrão.

Estrutura recomendada:

```text
workspace/
├─ Pro-Edition/
├─ auto-broll-premiere/
├─ Pro-Captions/
└─ Podcast-AutoCut/
```

No novo projeto:

```text
Podcast-AutoCut/
├─ src/
│  ├─ domain/
│  │  ├─ types.ts
│  │  ├─ decision-engine.ts
│  │  ├─ smoothing.ts
│  │  ├─ frame-snap.ts
│  │  └─ timeline-plan.ts
│  ├─ audio/
│  │  ├─ provider.ts
│  │  └─ fixture-provider.ts
│  ├─ premiere/
│  │  ├─ sequence-reader.ts
│  │  ├─ timeline-validator.ts
│  │  ├─ timeline-mutator.ts
│  │  └─ actions.ts
│  └─ ui/
│     ├─ index.html
│     ├─ styles.css
│     └─ mount.ts
├─ tests/
└─ DEV_NOTES.md
```

---

## 13. Alterações em `Pro-Edition/src/ui/main.ts`

Adicionar imports equivalentes aos módulos existentes:

```ts
import htmlAutocutBruto
  from "../../../Podcast-AutoCut/src/ui/index.html";

import cssAutocut
  from "../../../Podcast-AutoCut/src/ui/styles.css";

import { mount as mountAutocut }
  from "../../../Podcast-AutoCut/src/ui/mount.ts";
```

Adicionar ao mapa de nomes:

```ts
const NOME = {
  seletor: "Pro Edition",
  broll: "Auto B-roll",
  captions: "Pro Captions",
  autocut: "Podcast AutoCut",
};
```

Adicionar ao registro:

```ts
autocut: {
  html: extrairCorpo(htmlAutocutBruto),
  css: cssAutocut,
  montar: mountAutocut
}
```

No seletor:

```ts
ligarAcao(
  root.querySelector<HTMLElement>("#cardAutocut")!,
  () => mostrar("autocut")
);
```

---

## 14. Card no hall

Adicionar um card em:

```text
src/ui/seletor.html
```

Nome:

```text
Podcast AutoCut
```

Descrição:

```text
Corte automático de podcasts por quem está falando.
```

ID:

```text
cardAutocut
```

Preservar o design atual da Pro Edition.

---

## 15. UI do Podcast AutoCut

Wireframe:

```text
┌──────────────────────────────────┐
│ Podcast AutoCut                  │
│ Corte por quem está falando      │
├──────────────────────────────────┤
│ PESSOA A                         │
│ Câmera   [ V1 ▼ ]                │
│ Áudio    [ A1 ▼ ]                │
│                                  │
│ PESSOA B                         │
│ Câmera   [ V2 ▼ ]                │
│ Áudio    [ A2 ▼ ]                │
├──────────────────────────────────┤
│ [ ANALISAR PODCAST ]             │
├──────────────────────────────────┤
│ ✓ 2 câmeras encontradas          │
│ ✓ 2 áudios encontrados           │
│ ✓ 37 trocas detectadas           │
├──────────────────────────────────┤
│ [ VER PRÉVIA ]                   │
│ [ APLICAR AUTOCUT ]              │
└──────────────────────────────────┘
```

Configurações avançadas recolhidas:

```text
Sensibilidade
Duração mínima de plano
Tempo mínimo de fala
Pre-roll
Post-roll
Silêncio
Overlap
```

A UI precisa funcionar a partir de 320 px de largura, sem scroll horizontal.

---

# PREMIERE / UXP

## 16. Enable/disable oficialmente suportado

Na API pública atual do Premiere UXP existem:

```text
VideoClipTrackItem.createSetDisabledAction(disabled)
AudioClipTrackItem.createSetDisabledAction(disabled)
```

Eles permitem ativar/desativar TrackItems de vídeo e áudio.

Atenção:

```ts
disabled = true  // OFF
disabled = false // ON
```

Criar helper:

```ts
function createSetEnabledAction(item, enabled: boolean) {
  return item.createSetDisabledAction(!enabled);
}
```

Não espalhar inversões booleanas pelo código.

---

## 17. Maior risco técnico: split/razor

Não assumir a existência de:

```ts
item.split()
item.razor()
```

A documentação pública UXP atual expõe recursos como:

```text
createCloneTrackItemAction
createSetStartAction
createSetEndAction
createSetInPointAction
createSetOutPointAction
createInsertProjectItemAction
createOverwriteItemAction
```

mas o método ideal para reproduzir um `Add Edit` precisa ser validado no Premiere real.

**Este é o primeiro technical spike do projeto.**

---

## 18. Estratégia de split a testar primeiro

### Opção A — clone + trim

Dado:

```text
0────────────────────────30
```

com cortes:

```text
10
20
```

produzir:

```text
0────10
      10────20
             20────30
```

através de:

- clone;
- start/end;
- in/out.

Testar obrigatoriamente:

- vídeo;
- áudio;
- source in diferente de zero;
- clip previamente trimado;
- offset;
- frame accuracy.

Não colocar em produção antes de provar que o sync continua correto.

### Opção B — reconstruir segmentos

Se clone+trim não for confiável, testar criação dos segmentos a partir do ProjectItem com:

```text
SequenceEditor.createInsertProjectItemAction
SequenceEditor.createOverwriteItemAction
```

sem deslocar clips vizinhos.

---

## 19. Não usar como estratégia principal

Evitar no início:

```text
QE DOM
CEP
ExtendScript legado
IDs mágicos de menu
simulação de teclado
```

Se UXP público for insuficiente, documentar isso em `DEV_NOTES.md` e então avaliar Hybrid Plugin/helper nativo.

Não esconder workaround não documentado.

---

## 20. Transactions / Action API

Todas as mutações precisam seguir corretamente a Action API do UXP.

Estrutura conceitual:

```text
Project.lockedAccess
→ Project.executeTransaction
→ Actions / CompoundAction
```

Não fazer `await` dentro do callback síncrono da transaction.

Objetivo ideal:

```text
1 execução do AutoCut
≈ 1 Undo
```

Validar na prática com timelines grandes.

---

## 21. Pipeline seguro de aplicação

```text
ANALYZE
↓
TimelinePlan puro
↓
VALIDATE
↓
Build action plan
↓
Transaction
↓
Apply
↓
Re-read timeline
↓
Verify
```

Nunca calcular VAD enquanto já está destruindo/recriando clips.

---

## 22. Invariantes pós-aplicação

Para todo segmento:

```ts
videoA === audioA;
videoB === audioB;

videoA !== videoB;
audioA !== audioB;
```

E todos devem possuir os mesmos boundaries.

Criar verificador automático pós-apply.

---

# AUDIO ENGINE

## 23. Não acoplar ao acesso de PCM

Não assumir que UXP entrega PCM bruto de forma adequada.

Criar:

```ts
interface AudioAnalysisProvider {
  analyze(input: AudioAnalysisInput): Promise<AudioAnalysisResult>;
}
```

Providers possíveis:

```text
FixtureProvider
LocalHelperProvider
HybridNativeProvider
ExternalServiceProvider
```

---

## 24. Implementar FixtureProvider primeiro

Antes do VAD real, usar um plano artificial:

```ts
[
  { startMs: 0, endMs: 10000, activeSpeaker: "A" },
  { startMs: 10000, endMs: 20000, activeSpeaker: "B" },
  { startMs: 20000, endMs: 30000, activeSpeaker: "A" }
]
```

Isso permite provar:

```text
CUT
+
VIDEO ON/OFF
+
AUDIO ON/OFF
```

sem depender ainda da extração de áudio.

---

# FASES DE DESENVOLVIMENTO

## 25. Fase 0 — Integração visual

Entregar:

```text
✓ projeto Podcast-AutoCut criado
✓ card no Pro Edition
✓ navegação Pro Edition / Podcast AutoCut
✓ UI responsiva
✓ build/testes sem quebrar B-roll e Captions
```

Nenhuma alteração destrutiva na timeline.

---

## 26. Fase 1 — Technical spike da timeline

Criar botão DEV:

```text
APLICAR PLANO DE TESTE
```

Plano:

```text
0–10 A
10–20 B
20–30 A
```

Com 4 clips contínuos de 30 s, o resultado precisa ser:

```text
V2  OFF | ON  | OFF
V1  ON  | OFF | ON

A2  OFF | ON  | OFF
A1  ON  | OFF | ON
```

Definition of Done:

```text
✓ lê sequência ativa
✓ encontra tracks
✓ lê TrackItems
✓ cria cuts nas quatro tracks
✓ boundaries idênticos
✓ enable/disable funciona
✓ source sync preservado
✓ Undo testado
```

**Não começar VAD real antes disso funcionar.**

---

## 27. Fase 2 — Core de decisão

Implementar com testes Node:

- activity windows;
- dominance;
- silence hold;
- overlap hold;
- minimum speech;
- minimum shot;
- hysteresis;
- merge adjacent;
- pre/post-roll;
- frame snapping.

Sem Premiere.

---

## 28. Fase 3 — Preview

Adicionar:

```text
ANALISAR
```

e mostrar:

```text
00:00–00:05  A
00:05–00:11  B
00:11–00:18  A
```

Só depois permitir:

```text
APLICAR
```

---

## 29. Fase 4 — VAD real

Investigar acesso de áudio.

Se UXP não oferecer PCM de maneira adequada:

avaliar provider externo/local/hybrid.

Como o core já depende apenas de `AudioAnalysisProvider`, essa decisão não deve exigir refatoração.

---

## 30. Fase 5 — calibração

Testar com:

- muito bleed;
- pouco bleed;
- volumes diferentes;
- risadas;
- interrupções;
- silêncio;
- frases rápidas;
- “aham”;
- pessoas falando juntas;
- podcasts de 30 min, 1 h e 2 h.

---

# TESTES

## 31. Testes de decisão

### A fala, B não

```text
→ A
```

### B fala, A não

```text
→ B
```

### A fala, 300 ms silêncio, A continua

```text
→ A sem cut
```

### A fala e B diz “aham” por 200 ms

```text
→ continuar A
```

### Ambos falam por 400 ms

```text
→ hold current
```

### B fica claramente dominante por tempo suficiente

```text
→ B
```

---

## 32. Teste de mutation essencial

Entrada:

```text
V1 cam-a
V2 cam-b
A1 mic-a
A2 mic-b

todos 0–30 s
```

Plano:

```text
0–10 A
10–20 B
20–30 A
```

Esperado:

```text
V2 [OFF][ ON][OFF]
V1 [ ON][OFF][ ON]

A2 [OFF][ ON][OFF]
A1 [ ON][OFF][ ON]
```

Não criar V3.

---

# REPOSITÓRIO PRO EDITION

## 33. Alterações esperadas

```text
Pro-Edition/
├─ package.json
├─ manifest.json
├─ src/
│  ├─ shell.ts
│  └─ ui/
│     ├─ main.ts
│     ├─ seletor.html
│     └─ seletor.css
└─ tests/
```

Não colocar toda a lógica do AutoCut em `main.ts`.

O shell apenas navega e monta ferramentas.

---

## 34. Manifest

O manifest atual do Pro Edition declara:

```json
"minVersion": "25.0.0"
```

Porém `createSetDisabledAction` para Audio/Video TrackItems está documentado desde Premiere 25.6.

Recomendação:

```json
"minVersion": "25.6.0"
```

se os demais módulos atuais estiverem compatíveis.

Caso contrário, implementar runtime gate explícito.

---

## 35. package.json

Atualizar a descrição da suíte para incluir:

```text
Podcast AutoCut
```

Preservar:

```text
npm run check
npm test
npm run build
npm run verify
```

---

# RISCOS

## 36. Riscos principais

1. **Split de TrackItem**
   - precisa ser provado com API pública.

2. **PCM**
   - pode exigir helper/hybrid.

3. **Undo**
   - muitos cortes/actions precisam ser testados.

4. **Performance**
   - 1–2 h de podcast podem gerar centenas de cuts.

5. **Audio pop**
   - alternar A1/A2 pode gerar mudança de noise floor.
   - crossfade pode virar melhoria futura.

6. **Clips previamente editados**
   - MVP pode exigir clips contínuos e sincronizados.

---

# REQUISITOS FECHADOS

## 37. Não perguntar novamente

```text
✓ Adobe Premiere
✓ UXP
✓ integração com Pro Edition
✓ 2 pessoas no MVP
✓ 2 câmeras
✓ 2 microfones
✓ câmeras e áudios já sincronizados
✓ câmera + áudio da pessoa formam um par
✓ V1/V2/A1/A2 são cortados
✓ todos os cuts nos mesmos timestamps
✓ speaker A → par A ON, par B OFF
✓ speaker B → par B ON, par A OFF
✓ NÃO criar V3
✓ áudios NÃO ficam contínuos
✓ resultado precisa ser fácil de corrigir manualmente
✓ silêncio mantém speaker anterior inicialmente
✓ overlap mantém speaker atual inicialmente
✓ reaction shot não é MVP
```

---

# PRIMEIRA ENTREGA DO CLAUDE

## 38. Faça isto antes do VAD

Primeira entrega:

```text
1. Criar Podcast-AutoCut
2. Integrar card ao Pro Edition
3. UI responsiva com seleção V/A para A e B
4. Ler sequência e tracks
5. Timeline validator
6. FixtureProvider
7. Gerar plano artificial A/B/A
8. Aplicar cuts nas quatro tracks
9. Aplicar ON/OFF nos quatro TrackItems
10. Verificar boundaries
11. Testar Undo
12. Criar testes
13. Criar DEV_NOTES.md
```

Se o item 8 não puder ser feito com API pública de forma estável:

**parar, documentar exatamente a limitação e apresentar as alternativas antes de usar QE/CEP/ExtendScript.**

---

# DEV_NOTES.md

Registrar sempre:

```text
Premiere version:
UXP version:
OS:
API:
Teste:
Resultado:
Undo:
Performance:
Bug:
Workaround:
Fonte oficial:
```

Principal checkpoint:

```text
SPLIT STRATEGY CONFIRMED = YES/NO
```

---

# REFERÊNCIAS OFICIAIS

Premiere UXP:

https://developer.adobe.com/premiere-pro/uxp/

Premiere DOM:

https://developer.adobe.com/premiere-pro/uxp/ppro-reference/

VideoClipTrackItem:

https://developer.adobe.com/premiere-pro/uxp/ppro-reference/classes/videocliptrackitem

AudioClipTrackItem:

https://developer.adobe.com/premiere-pro/uxp/ppro-reference/classes/audiocliptrackitem

SequenceEditor:

https://developer.adobe.com/premiere-pro/uxp/ppro-reference/classes/sequenceeditor

Samples oficiais:

https://github.com/AdobeDocs/uxp-premiere-pro-samples

Projeto atual:

https://github.com/leogiora/Pro-Edition

---

# INSTRUÇÃO FINAL AO CLAUDE

Não comece tentando fazer o AutoCut completo.

Comece provando o fluxo mais arriscado:

```text
TimelinePlan artificial
        ↓
cortar V1
cortar V2
cortar A1
cortar A2
        ↓
aplicar ON/OFF
        ↓
manter sync
        ↓
Undo
```

Quando isso estiver comprovado, implementar o motor de speaker detection.

A ordem é:

```text
1. integração
2. timeline reader
3. fixture plan
4. split/mutation
5. enable/disable
6. validação
7. preview
8. VAD
9. calibração
10. melhorias
```

O maior risco inicial é o **split confiável via API UXP pública**, não a detecção de speaker.

Resolva isso primeiro.
