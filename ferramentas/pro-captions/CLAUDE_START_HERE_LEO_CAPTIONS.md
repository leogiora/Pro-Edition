# LÉO CAPTIONS — CLAUDE START HERE
## Especificação funcional + técnica para o plugin de legendas do Adobe Premiere

**Versão:** 0.1  
**Data:** 10/08/2026  
**Status:** especificação inicial para começar o desenvolvimento  
**Idioma do produto:** PT-BR  
**Nome provisório:** Léo Captions  

---

# 0. INSTRUÇÃO DIRETA PARA O CLAUDE

Você deve usar este arquivo como **fonte principal de verdade** para iniciar o projeto.

O objetivo não é criar um gerador genérico de legendas. O objetivo é criar um plugin de Premiere que reproduza um **padrão editorial específico**, economizando o trabalho manual de:

- corrigir a transcrição automática;
- corrigir nomes importantes;
- converter linguagem formal em linguagem coloquial;
- identificar preços;
- isolar preços em blocos próprios;
- formatar valores monetários;
- dividir as legendas em blocos naturais;
- manter absolutamente todas as legendas em **uma única linha**;
- alinhar as trocas de legenda com a fala e, quando fizer sentido, com os cortes do vídeo;
- aplicar automaticamente apenas dois estilos visuais: **NORMAL** e **PREÇO**.

## Como começar

1. **Não construa o produto inteiro de uma vez.**
2. Comece pela **FASE 0 — Technical Spike** descrita neste documento.
3. Valide no Premiere real quais APIs UXP estão disponíveis para:
   - sequência ativa;
   - tracks;
   - clips/cortes;
   - transcript;
   - word timings;
   - inserção de MOGRT;
   - alteração de parâmetros expostos de MOGRT;
   - alteração da duração do item inserido.
4. Não invente API inexistente.
5. Se a API pública não permitir alguma etapa diretamente, crie uma abstração/fallback e documente a limitação.
6. O core de texto, regras, preços e segmentação deve ser independente do Premiere e possuir testes automatizados.
7. Não acople o projeto a um fornecedor específico de IA/ASR neste primeiro momento.
8. A interface precisa nascer desde o início com arquitetura responsiva e acabamento profissional.

---

# 1. OBJETIVO DO PRODUTO

Criar um **painel UXP para Adobe Premiere** que analise a sequência atual e gere legendas seguindo automaticamente o padrão editorial definido neste documento.

Fluxo desejado:

```text
SEQUÊNCIA EDITADA
        ↓
ÁUDIO / TRANSCRIÇÃO / WORD TIMINGS
        ↓
CORREÇÃO DE TERMOS CRÍTICOS
        ↓
NORMALIZAÇÃO PT-BR COLOQUIAL
        ↓
CORREÇÃO GRAMATICAL
        ↓
DETECÇÃO DE PREÇOS
        ↓
PONTUAÇÃO
        ↓
SEGMENTAÇÃO EM BLOCOS DE 1 LINHA
        ↓
HARMONIZAÇÃO COM FALA + CORTES
        ↓
STYLE NORMAL 96 / STYLE PREÇO 150
        ↓
LEGENDA INSERIDA NA TIMELINE
```

O plugin deve priorizar:

1. fidelidade à fala;
2. legibilidade;
3. naturalidade;
4. sincronização;
5. consistência visual;
6. redução máxima de correção manual.

---

# 2. REGRAS NÃO NEGOCIÁVEIS

Estas regras são **hard constraints**.

## 2.1. Sempre uma linha

**Nunca gerar legenda em duas linhas.**

Se uma frase não couber visualmente em uma linha:

- dividir em dois ou mais blocos;
- cada bloco continua tendo apenas uma linha;
- nunca reduzir automaticamente o tamanho da fonte para “fazer caber”;
- respeitar o sentido da frase;
- respeitar a fala;
- evitar quebras sintáticas ruins.

```text
ERRADO

VOCÊ PRECISA ENTENDER
O QUE TÁ ACONTECENDO


CORRETO

VOCÊ PRECISA ENTENDER

O QUE TÁ ACONTECENDO
```

---

## 2.2. Existem somente dois estilos

### STYLE_NORMAL

- tamanho: **96**
- uma linha;
- texto comum;
- restante da aparência visual será definido no recurso visual/MOGRT final.

### STYLE_PRICE

- tamanho: **150**
- uma linha;
- exclusivo para preço;
- preço sempre isolado em seu próprio bloco.

Não criar automaticamente estilos para CTA, porcentagem, palavras fortes, nomes etc.

---

## 2.3. Preço sempre sozinho

Todo preço deve ocupar um bloco exclusivo.

```text
CORRETO

HOJE A CONSULTA CUSTA

197 REAIS
```

```text
ERRADO

HOJE A CONSULTA CUSTA 197 REAIS
```

Se houver dois preços:

```text
FALA:
"de mil por cento e noventa e sete"

BLOCOS:

DE
STYLE_NORMAL / 96

1.000 REAIS
STYLE_PRICE / 150

POR
STYLE_NORMAL / 96

197 REAIS
STYLE_PRICE / 150
```

Mesmo que isso eventualmente produza um bloco curto como `DE` ou `POR`, o preço continua isolado.

---

# 3. REGRA DE PREÇOS

## 3.1. O valor não é fixo

Exemplos frequentes:

- 1.000
- 197

Mas o sistema deve aceitar qualquer valor monetário inteiro.

---

## 3.2. Sempre escrever “REAIS”

Mesmo que a pessoa **não fale a palavra “reais”**, se o número for semanticamente um preço, a legenda deve acrescentar:

```text
REAIS
```

Não usar `R$`.

Exemplos:

```text
FALA:
"por cento e noventa e sete"

SE O CONTEXTO CONFIRMAR PREÇO:

197 REAIS
```

```text
FALA:
"isso custa mil"

1.000 REAIS
```

---

## 3.3. Separador brasileiro de milhar

Para valores `>= 1000`, usar ponto como separador de milhar.

```text
1000    → 1.000 REAIS
1500    → 1.500 REAIS
1997    → 1.997 REAIS
2500    → 2.500 REAIS
10000   → 10.000 REAIS
25000   → 25.000 REAIS
100000  → 100.000 REAIS
```

Valores abaixo de mil:

```text
197 → 197 REAIS
500 → 500 REAIS
997 → 997 REAIS
```

---

## 3.4. Não transformar qualquer número em preço

A classificação monetária precisa acontecer **antes** da formatação.

```text
FALA:
"mais de mil homens"

CORRETO:
MAIS DE 1.000 HOMENS
STYLE_NORMAL / 96

ERRADO:
1.000 REAIS
```

Contextos que podem indicar preço:

- custa;
- custava;
- valor;
- preço;
- investimento;
- pagar;
- paga;
- pagava;
- pagamento;
- por apenas;
- de X por Y;
- reais;
- consulta custa;
- tratamento custa;
- sair por;
- fica por.

Esta lista serve como sinal contextual, não como única verdade.

---

## 3.5. Centavos

**Ainda não definido pelo produto.**

Na V1:

- suportar prioritariamente valores inteiros em reais;
- se houver valor com centavos e não houver regra validada, marcar para revisão;
- não inventar uma convenção.

---

# 4. VOCABULÁRIO PROTEGIDO

Existem termos que não podem depender apenas da transcrição automática do Premiere.

## 4.1. Androclinic

Forma canônica:

```text
Androclinic
```

Na renderização em caixa alta:

```text
ANDROCLINIC
```

O Premiere pode gerar coisas como:

- andro clínica;
- andro clinic;
- android clinic;
- palavras sem nenhuma semelhança;
- outra frase completamente diferente.

**Não confiar somente em fuzzy matching textual.**

---

## 4.2. Cristiano Estivalet

Forma canônica:

```text
Cristiano Estivalet
```

Renderização:

```text
CRISTIANO ESTIVALET
```

Construções esperadas incluem:

```text
Meu nome é Cristiano Estivalet
Eu sou o doutor Cristiano Estivalet
Sou o doutor Cristiano Estivalet
Eu sou o Cristiano Estivalet
Sou o Cristiano Estivalet
Eu sou o Cristiano
Meu nome é Cristiano
```

Exemplo real de erro já observado:

```text
ÁUDIO:
"Meu nome é Cristiano Estivalet"

PREMIERE:
"Meu nome | é Cristiano | Equivalente"
```

O sistema deve ser capaz de recuperar:

```text
MEU NOME É CRISTIANO ESTIVALET
```

quando o áudio confirmar isso.

---

# 5. NÃO CORRIGIR NOMES CRÍTICOS SOMENTE POR TEXTO PARECIDO

Este é um requisito arquitetural importante.

Os erros do Premiere podem ser **muito distantes foneticamente e textualmente** do termo verdadeiro.

Portanto:

```text
transcript Premiere
      ↓
não é fonte absoluta de verdade
```

Para termos críticos:

```text
ÁUDIO
  +
CONTEXTO
  +
VOCABULÁRIO PROTEGIDO / HINTS
  +
TRANSCRIÇÃO EXISTENTE
  ↓
DECISÃO
```

## Regra

Se houver:

- baixa confiança;
- construção contextual forte;
- trecho suspeito;
- provável apresentação pessoal;
- provável menção à marca;

o sistema deve ter capacidade de **reanalisar o trecho de áudio** usando um segundo mecanismo de reconhecimento.

Exemplos de gatilhos contextuais:

```text
"meu nome é..."
"eu sou o doutor..."
"sou o doutor..."
"eu sou o..."
"aqui na..."
"na Androclinic..."
```

## Importante

Não substituir texto por `ANDROCLINIC` ou `CRISTIANO ESTIVALET` sem evidência suficiente.

Quando a confiança continuar baixa:

```text
⚠ REVISAR
```

O produto deve preferir uma revisão manual rápida a inventar uma palavra.

---

# 6. ARQUITETURA DE TRANSCRIÇÃO

Não acoplar o projeto inteiro à transcrição nativa do Premiere.

Criar uma interface:

```ts
interface TranscriptionProvider {
  transcribe(input: TranscriptionInput): Promise<TranscriptResult>;
}
```

Formato conceitual:

```ts
type WordToken = {
  id: string;
  text: string;
  startMs: number;
  endMs: number;
  confidence?: number;
  source: "premiere" | "secondary-asr";
};

type TranscriptResult = {
  words: WordToken[];
  rawText: string;
  language: "pt-BR";
};
```

Implementações:

```text
PremiereTranscriptProvider
SecondaryAudioTranscriptionProvider
```

## PremiereTranscriptProvider

Primeiro provider do MVP.

Responsabilidades:

- verificar se o clip possui transcript;
- exportar/ler transcript disponível;
- converter para modelo interno;
- preservar timing por palavra sempre que a estrutura retornada permitir.

## SecondaryAudioTranscriptionProvider

Criar a interface e a arquitetura desde já, mas **não escolher fornecedor sem necessidade**.

Função:

- reanalisar trechos problemáticos diretamente do áudio;
- aceitar phrase hints / hotwords quando o mecanismo suportar;
- aumentar chance de reconhecer:
  - Androclinic;
  - Cristiano Estivalet.

A integração concreta pode ser:

- ASR local;
- serviço externo;
- outra solução compatível.

Essa escolha será feita posteriormente.

---

# 7. PIPELINE DE TEXTO

A ordem é importante.

```text
1. ingestRawTranscript()
2. reconcileTranscriptionSources()
3. protectCriticalTerms()
4. normalizeColloquialLanguage()
5. correctGrammar()
6. detectAndNormalizePrices()
7. applyPunctuation()
8. segmentIntoCaptionBlocks()
9. alignBlocksToSpeech()
10. harmonizeWithCuts()
11. validateOneLineWidth()
12. renderToPremiere()
```

Nunca renderizar antes da validação final.

---

# 8. LINGUAGEM COLOQUIAL

O texto não deve ser “formalizado” automaticamente.

As legendas devem manter uma escrita natural, próxima da fala utilizada nos vídeos.

## Regras aprovadas

```text
para        → pra
para isso   → pra isso
para um     → pra um
para uma    → pra uma
para você   → pra você
para vocês  → pra vocês
para ele    → pra ele
para ela    → pra ela

para o      → pro
para os     → pros

estava      → tava
estavam     → tavam

está        → tá
estão       → tão

estou       → tô
```

Exemplos:

```text
"para o paciente"
→ "pro paciente"

"para você entender"
→ "pra você entender"

"você está vendo isso"
→ "você tá vendo isso"

"eu estava conversando"
→ "eu tava conversando"

"eu estou falando sério"
→ "eu tô falando sério"
```

## Não aplicar automaticamente reduções agressivas

Não transformar sem uma regra explícita:

```text
você   → cê
estamos → tamo
vamos  → vamo
```

Manter também expressões naturais como:

```text
né
tá bom
tá vendo
```

Evitar “corrigir”:

```text
vou te falar
```

para:

```text
vou lhe falar
```

---

# 9. REGRA DOS PORQUÊS

Aplicar corretamente as quatro formas.

## porque

Explicação/resposta:

```text
Isso acontece porque a testosterona caiu.
```

## por que

Pergunta ou sentido de “por qual motivo”:

```text
Você sabe por que isso acontece?
```

## por quê

No final da oração:

```text
Isso acontece por quê?
```

## porquê

Substantivo:

```text
Eu vou te explicar o porquê.
```

A correção deve considerar a frase completa antes da segmentação.

---

# 10. DIFERENCIAR “É” DE “E”

A transcrição pode confundir os dois.

Não confiar somente na saída acústica.

## “É”

Verbo ser:

```text
Meu nome é Cristiano Estivalet.
Isso é importante.
Ele é médico.
O problema é outro.
É por isso que...
```

## “E”

Conjunção:

```text
Saúde e qualidade de vida.
Você e sua esposa.
Testosterona e circulação.
Ele chegou e conversou comigo.
```

Exemplo:

```text
PREMIERE:
"Meu nome e Cristiano"

CORREÇÃO:
"Meu nome é Cristiano"
```

Essa correção deve acontecer antes da divisão final em blocos.

---

# 11. PONTUAÇÃO

A pontuação acompanha **o sentido da fala**, não a divisão técnica de clips de legenda.

## 11.1. Vírgula

Usar vírgula quando realmente fizer sentido, mas evitar vírgula “pendurada” na fronteira de dois blocos.

```text
EVITAR

BLOCO 1:
SE VOCÊ CONTINUAR ASSIM,

BLOCO 2:
O PROBLEMA PODE PIORAR
```

Preferir:

```text
BLOCO 1:
SE VOCÊ CONTINUAR ASSIM

BLOCO 2:
O PROBLEMA PODE PIORAR
```

Se a construção inteira estiver no mesmo bloco, a vírgula pode aparecer normalmente:

```text
SE VOCÊ CONTINUAR ASSIM, O PROBLEMA PIORA
```

desde que caiba em uma única linha.

Nunca começar o próximo bloco com vírgula.

---

## 11.2. Ponto final

Usar ponto quando a ideia realmente terminar.

Não colocar ponto automaticamente no fim de cada bloco.

---

## 11.3. Interrogação/exclamação

Devem acompanhar a oração correta.

```text
CORRETO:

VOCÊ SABE POR QUE

ISSO ACONTECE?
```

Evitar colocar `?` em um bloco cuja pergunta ainda continua no próximo.

---

# 12. SEGMENTAÇÃO INTELIGENTE

A segmentação não pode usar apenas “X caracteres”.

Ela deve trabalhar com **palavras + timings + sintaxe + largura visual + cortes**.

## Hard constraints

1. uma linha;
2. preço isolado;
3. não cortar palavra;
4. não mostrar palavra antes de ela ser falada;
5. não manter legenda depois que a fala correspondente terminou de forma perceptível;
6. não quebrar expressões importantes sem necessidade;
7. evitar blocos órfãos muito curtos quando houver alternativa;
8. nunca transformar preço em texto normal;
9. nunca misturar preço com texto normal.

---

## Candidate breakpoints

Criar candidatos de quebra em:

- final de oração;
- pausa natural;
- vírgula;
- conjunções, se semanticamente aceitável;
- mudança de ideia;
- antes/depois de preço;
- próximo a corte da track de referência;
- ponto em que a largura máxima da linha será excedida.

---

## Scoring sugerido

Não precisa usar exatamente estes valores, mas a arquitetura deve permitir pesos configuráveis.

```text
fim de frase                  + alta prioridade
pausa natural                 + alta prioridade
corte de vídeo próximo        + alta prioridade
limite de largura             + hard constraint
antes/depois de preço         + hard constraint
quebra sintática natural      + prioridade média

separar artigo + substantivo  - penalidade
separar pronome + verbo       - penalidade
bloco normal de 1 palavra     - penalidade
pontuação pendurada           - penalidade
timing artificial             - penalidade forte
2 linhas                      - proibido
preço misturado               - proibido
```

Usar algoritmo determinístico quando possível.

Uma implementação possível é dynamic programming / shortest path / best-score segmentation sobre os índices de palavras.

---

# 13. LARGURA VISUAL — NÃO USAR SÓ CONTAGEM DE CARACTERES

A legenda precisa caber em uma única linha.

A largura deve idealmente ser estimada com base em:

- fonte;
- font size;
- texto;
- largura da sequência;
- safe area configurável.

Sugestão de configuração:

```ts
maxCaptionWidthRatio: 0.86
```

Isso significa no máximo ~86% da largura do frame.

**Este valor é configurável e deve ser ajustável posteriormente.**

Se não houver métrica de fonte confiável no ambiente UXP:

1. criar uma abstração `TextWidthEstimator`;
2. tentar medição real quando possível;
3. usar heurística como fallback;
4. manter testes separados.

Nunca “resolver” overflow diminuindo 96 ou 150 automaticamente.

---

# 14. SINCRONIZAÇÃO COM A FALA

A unidade preferencial de timing é a palavra.

Cada bloco deve receber:

```ts
type CaptionBlock = {
  id: string;
  text: string;
  startMs: number;
  endMs: number;
  style: "normal" | "price";
  confidence: number;
  needsReview: boolean;
};
```

O início deve acompanhar a primeira palavra do bloco.

O fim deve acompanhar a última palavra do bloco, respeitando uma pequena margem visual apenas se necessário.

A margem deve ser configurável e não pode fazer a legenda “antecipar” palavras.

---

# 15. HARMONIZAÇÃO COM CORTES

Um diferencial central do produto é fazer as legendas conversarem com os cortes da edição.

O plugin deve ler os cuts de uma **track de referência**.

Default provisório:

```text
V1
```

Mas a interface deve permitir escolher a track.

## Regra

Se houver um corte próximo de uma quebra natural da fala:

- preferir quebrar a legenda no corte;
- usar o final/início de palavra mais próximo;
- não alterar o texto de forma errada apenas para encaixar;
- não antecipar legenda;
- não quebrar uma unidade linguística forte só por causa do corte.

Conceito:

```text
FALA:
──────── palavra palavra | palavra palavra ────────
                         ↑
                       CUT

Se houver ponto de quebra natural próximo:
→ usar esse corte como boundary visual.
```

Criar configuração:

```ts
cutSnapToleranceFrames
```

Não fixar um valor definitivo sem teste real.

Usar inicialmente um default conservador e deixar centralizado em config.

---

# 16. PREÇOS E CORTES

Preço é hard boundary.

Exemplo:

```text
"essa consulta que era mil hoje tá por cento e noventa e sete"
```

Possível resultado:

```text
ESSA CONSULTA QUE ERA
NORMAL / 96

1.000 REAIS
PRICE / 150

HOJE TÁ POR
NORMAL / 96

197 REAIS
PRICE / 150
```

O timing de cada preço deve acompanhar especificamente o momento em que o valor é falado.

---

# 17. RENDERIZAÇÃO NO PREMIERE

Criar uma abstração:

```ts
interface CaptionRenderer {
  render(blocks: CaptionBlock[], context: RenderContext): Promise<RenderResult>;
}
```

Implementações previstas:

```text
MogrtRenderer
NativeCaptionRenderer (fallback/experimental)
```

## Estratégia preferida

Para o acabamento visual e o controle de style, **MOGRT é a estratégia preferida**, desde que o spike confirme todos os controles necessários.

A API pública atual do Premiere UXP possui métodos no `SequenceEditor` para inserir MOGRT por library/path.

Não assumir além do que for validado.

### Recurso visual

Como o usuário quer “já vender com o padrão”, a versão de produção deve conseguir carregar um recurso visual padrão automaticamente.

Durante desenvolvimento:

- permitir selecionar MOGRT local;
- manter path/config separado;
- depois empacotar/instalar o recurso final da forma tecnicamente correta.

## Parâmetros desejados no MOGRT

Idealmente expor:

```text
Texto
Tamanho
```

e, se necessário:

```text
posição
cor
stroke
shadow
```

Porém o MVP só precisa alterar programaticamente aquilo que for necessário para produzir:

```text
NORMAL = tamanho 96
PRICE  = tamanho 150
```

O restante da aparência pode vir fixo no template.

---

# 18. INFORMAÇÕES VISUAIS AINDA PENDENTES

Não bloquear o desenvolvimento por isso.

Ainda precisam ser definidos depois:

- fonte exata;
- peso;
- stroke;
- shadow;
- cor;
- posição Y;
- tracking;
- aparência final do MOGRT;
- safe width final.

Criar tudo com tokens/config para não exigir refatoração.

---

# 19. PRESET DEFAULT

Criar um preset interno chamado provisoriamente:

```text
Padrão
```

Config conceitual:

```json
{
  "id": "default",
  "name": "Padrão",
  "language": "pt-BR",
  "uppercase": true,
  "maxLines": 1,

  "normalStyle": {
    "fontSize": 96
  },

  "priceStyle": {
    "fontSize": 150,
    "isolated": true,
    "suffix": "REAIS",
    "currencySymbol": false,
    "thousandsSeparator": "."
  },

  "protectedTerms": [
    "Androclinic",
    "Cristiano Estivalet"
  ],

  "colloquial": {
    "enabled": true
  },

  "cuts": {
    "enabled": true,
    "referenceTrack": "V1"
  }
}
```

A arquitetura deve aceitar novos presets futuramente, mas **não precisa criar uma UI complexa de presets na V1**.

---

# 20. INTERFACE — REQUISITO DE QUALIDADE

A interface não pode parecer um painel técnico improvisado.

Ela deve parecer um produto comercial acabado.

## Direção visual

- dark UI;
- integração visual com Premiere;
- limpa;
- moderna;
- hierarquia forte;
- espaços bem trabalhados;
- cantos e bordas discretos;
- estados hover/pressed/disabled;
- carregamentos claros;
- mensagens de erro úteis;
- sem excesso de informação na tela principal.

Preferir componentes Spectrum/UXP quando forem adequados, complementados por CSS próprio.

---

# 21. INTERFACE RESPONSIVA

Painéis do Premiere podem mudar muito de largura.

A UI deve funcionar bem em painel:

```text
estreito
médio
largo
```

## Requisitos

- sem scroll horizontal;
- botões não podem ser cortados;
- textos devem truncar quando necessário;
- cards devem se reorganizar;
- layout deve usar CSS Grid/Flex;
- evitar dimensões rígidas;
- usar `minmax()`, `%`, `clamp()` quando suportado;
- testar redimensionamento ao vivo.

### Breakpoints conceituais

```text
< 340 px       compact
340–520 px     padrão
> 520 px       expandido
```

Não tratar esses números como dogma; validar no UXP.

---

# 22. ESTRUTURA DA TELA PRINCIPAL

Wireframe conceitual:

```text
┌────────────────────────────────────┐
│ LÉO CAPTIONS                 ● OK  │
│ Sequência: Reel_Andro_015           │
├────────────────────────────────────┤
│ PADRÃO                              │
│ Normal 96  •  Preço 150  •  1 linha│
├────────────────────────────────────┤
│ Track de cortes                    │
│ [ V1 ▾ ]                           │
├────────────────────────────────────┤
│                                    │
│      [ ✦ GERAR LEGENDAS ]          │
│                                    │
├────────────────────────────────────┤
│ Status                             │
│ ✓ Transcript encontrado            │
│ ✓ 18 cortes detectados             │
│ ⚠ 2 trechos precisam revisão       │
├────────────────────────────────────┤
│ Revisões                           │
│ [ Ver 2 avisos ]                   │
└────────────────────────────────────┘
```

---

# 23. ESTADOS DA INTERFACE

Criar no mínimo:

## Idle

```text
Pronto para analisar
```

## Reading timeline

```text
Lendo sequência...
```

## Transcribing

```text
Analisando fala...
```

## Processing

```text
Organizando legendas...
```

## Rendering

```text
Criando legendas no Premiere...
```

## Success

```text
Legendas geradas
```

## Warning

```text
2 trechos precisam de revisão
```

## Error

Mostrar:

- o que aconteceu;
- etapa;
- ação possível;
- detalhe técnico expansível.

Não exibir stack trace cru como UX principal.

---

# 24. FILA DE REVISÃO

Quando o sistema não tiver confiança:

mostrar item revisável.

Exemplo:

```text
00:04.320 – 00:06.100

Detectado:
MEU NOME É CRISTIANO EQUIVALENTE

Sugestão:
MEU NOME É CRISTIANO ESTIVALET

[ Usar sugestão ] [ Manter ] [ Editar ]
```

Se um segundo ASR confirmar com confiança alta, a correção pode acontecer automaticamente.

---

# 25. NÃO USAR IA PARA “REESCREVER” A FALA

Princípio importante:

O plugin deve editar **legenda**, não conteúdo.

Não resumir a fala.

Não adicionar ideias.

Não trocar termos por sinônimos arbitrariamente.

Alterações permitidas:

- correção de ASR;
- grafia;
- termos protegidos;
- regras coloquiais aprovadas;
- `é/e`;
- porquês;
- pontuação;
- representação numérica;
- inclusão de `REAIS` quando o contexto confirmar preço;
- segmentação.

---

# 26. ORDEM DE PRIORIDADE EM CASO DE CONFLITO

```text
1. NÃO INVENTAR FALA
2. TERMOS PROTEGIDOS CONFIRMADOS PELO ÁUDIO
3. PREÇO ISOLADO
4. UMA LINHA
5. TIMING DA FALA
6. SENTIDO DA FRASE
7. HARMONIZAÇÃO COM CORTES
8. PONTUAÇÃO
9. ESTÉTICA
```

O corte nunca pode justificar mostrar uma palavra antes de ela ser falada.

---

# 27. MODELO DE DADOS SUGERIDO

```ts
type StyleType = "normal" | "price";

type WordToken = {
  id: string;
  raw: string;
  normalized: string;
  startMs: number;
  endMs: number;
  confidence?: number;
  source: "premiere" | "secondary-asr";
};

type CaptionBlock = {
  id: string;
  words: WordToken[];
  text: string;
  style: StyleType;
  startMs: number;
  endMs: number;
  confidence: number;
  needsReview: boolean;
  reviewReasons: string[];
};

type CutPoint = {
  timeMs: number;
  trackIndex: number;
};

type AnalysisResult = {
  sequenceName: string;
  words: WordToken[];
  cuts: CutPoint[];
  blocks: CaptionBlock[];
  warnings: ReviewItem[];
};
```

---

# 28. ESTRUTURA DE PASTAS SUGERIDA

Não precisa seguir literalmente, mas separar domínio de integração.

```text
leo-captions/
│
├─ manifest.json
├─ index.html
├─ package.json
│
├─ src/
│  ├─ app/
│  │  ├─ bootstrap.js
│  │  └─ state.js
│  │
│  ├─ premiere/
│  │  ├─ premiereClient.js
│  │  ├─ sequenceReader.js
│  │  ├─ transcriptReader.js
│  │  ├─ cutReader.js
│  │  └─ mogrtRenderer.js
│  │
│  ├─ transcription/
│  │  ├─ provider.js
│  │  ├─ premiereProvider.js
│  │  └─ secondaryProvider.js
│  │
│  ├─ language/
│  │  ├─ protectedTerms.js
│  │  ├─ colloquial.js
│  │  ├─ grammar.js
│  │  ├─ punctuation.js
│  │  └─ prices.js
│  │
│  ├─ segmentation/
│  │  ├─ candidates.js
│  │  ├─ scoring.js
│  │  ├─ segmenter.js
│  │  ├─ cutSnap.js
│  │  └─ widthEstimator.js
│  │
│  ├─ config/
│  │  └─ defaultPreset.js
│  │
│  └─ ui/
│     ├─ panel.js
│     ├─ review.js
│     ├─ components/
│     └─ styles.css
│
├─ tests/
│  ├─ prices.test.js
│  ├─ colloquial.test.js
│  ├─ grammar.test.js
│  ├─ protectedTerms.test.js
│  ├─ punctuation.test.js
│  └─ segmentation.test.js
│
└─ README.md
```

Se TypeScript for usado, adapte extensões.

Não adicionar uma ferramenta de build complexa sem necessidade.

---

# 29. FASE 0 — TECHNICAL SPIKE

**Claude deve começar aqui.**

Criar um plugin mínimo carregável no Premiere.

## Spike A — UXP funcionando

Resultado esperado:

- plugin aparece em `Window > UXP Plugins`;
- painel abre;
- mostra versão do host;
- mostra projeto;
- mostra sequência ativa.

---

## Spike B — Ler timeline

Conseguir listar:

- tracks de vídeo;
- clips de uma track;
- start/end;
- pontos de corte.

Mostrar no painel/log:

```text
V1
00:00:00.000 – 00:00:02.840
00:00:02.840 – 00:00:05.160
...
```

---

## Spike C — Transcript

Verificar:

- se o clip tem transcript;
- exportar transcript para JSON;
- inspecionar estrutura real;
- verificar se possui timing por palavra;
- documentar formato.

Criar uma fixture anonimizada para os testes.

---

## Spike D — MOGRT

Validar:

- inserir MOGRT por path;
- descobrir o item retornado;
- listar componentes/parâmetros;
- alterar o parâmetro de texto;
- alterar o parâmetro de tamanho, se estiver exposto;
- ajustar in/out/duração;
- inserir múltiplos blocos.

Se tamanho não puder ser alterado de forma confiável:

- testar dois MOGRTs separados:
  - normal 96;
  - price 150.

---

## Spike E — UI responsiva

Criar protótipo do painel com:

- header;
- sequence card;
- track selector;
- botão principal;
- status;
- warnings.

Testar manualmente pelo menos 3 larguras.

---

# 30. FASE 1 — CORE PURO DE TEXTO

Antes de integrar tudo à timeline:

construir e testar:

1. `formatBRLInteger`
2. `detectPriceSpan`
3. `normalizeColloquial`
4. `correctEAccent`
5. `correctPorques`
6. `normalizeProtectedTerms`
7. `segmentWords`
8. `removeDanglingCommaAtBlockBoundary`

Essas funções não devem depender de Premiere.

---

# 31. FASE 2 — SEGMENTAÇÃO

Entrada:

```text
WordToken[]
CutPoint[]
PresetConfig
```

Saída:

```text
CaptionBlock[]
```

Primeiro fazer funcionar sem cuts.

Depois adicionar cut snapping.

Depois adicionar width estimator.

---

# 32. FASE 3 — INTEGRAÇÃO COM PREMIERE

Fluxo:

```text
active sequence
→ read transcript
→ read cuts
→ core processing
→ preview blocks
→ render
```

Deve existir opção de apagar/recriar apenas os itens gerados pelo plugin sem destruir outros gráficos da timeline.

Para isso, considerar:

- track dedicada;
- naming/tagging dos itens;
- metadado ou convenção segura.

Não apagar conteúdo do usuário por heurística frágil.

---

# 33. FASE 4 — SEGUNDO ASR

Somente depois da base estar sólida.

Objetivos:

- reanalisar áudio em trechos;
- detectar Androclinic;
- detectar Cristiano Estivalet;
- corrigir erros grandes do Premiere;
- manter word timing;
- gerar confidence;
- alimentar fila de revisão.

Criar provider desacoplado.

---

# 34. FASE 5 — ACABAMENTO E DISTRIBUIÇÃO

- recurso visual final;
- preset default;
- packaging;
- onboarding;
- logs amigáveis;
- armazenamento de settings;
- testes Windows/macOS;
- validação de versões do Premiere.

---

# 35. TESTES DE ACEITAÇÃO — TEXTO

## Caso 1 — Nome completo

Áudio:

```text
Meu nome é Cristiano Estivalet
```

Texto canônico esperado:

```text
MEU NOME É CRISTIANO ESTIVALET
```

Se não couber em uma linha, segmentar sem alterar o nome.

Exemplo aceitável:

```text
MEU NOME É

CRISTIANO ESTIVALET
```

Ambos STYLE_NORMAL / 96.

---

## Caso 2 — Premiere completamente errado

Áudio:

```text
Meu nome é Cristiano Estivalet
```

Premiere:

```text
Meu nome é Cristiano Equivalente
```

Com confirmação do áudio/segundo ASR:

```text
MEU NOME É CRISTIANO ESTIVALET
```

---

## Caso 3 — Marca

Áudio:

```text
Aqui na Androclinic
```

Esperado:

```text
AQUI NA ANDROCLINIC
```

---

## Caso 4 — Preço sem falar “reais”

Áudio:

```text
Hoje tá por cento e noventa e sete
```

Contexto monetário confirmado.

Blocos:

```text
HOJE TÁ POR
NORMAL 96

197 REAIS
PRICE 150
```

---

## Caso 5 — Dois preços

Áudio:

```text
De mil por cento e noventa e sete
```

Esperado:

```text
DE
NORMAL 96

1.000 REAIS
PRICE 150

POR
NORMAL 96

197 REAIS
PRICE 150
```

---

## Caso 6 — Milhar

Entrada monetária:

```text
mil novecentos e noventa e sete
```

Esperado:

```text
1.997 REAIS
```

---

## Caso 7 — Número que não é preço

Áudio:

```text
Mais de mil homens
```

Esperado:

```text
MAIS DE 1.000 HOMENS
NORMAL 96
```

Nunca:

```text
1.000 REAIS
```

---

## Caso 8 — Coloquial

Entrada:

```text
Para você entender, eu estava falando para o paciente.
```

Normalização:

```text
PRA VOCÊ ENTENDER, EU TAVA FALANDO PRO PACIENTE.
```

A segmentação depois decide os blocos.

---

## Caso 9 — É/E

Entrada ASR:

```text
Meu nome e Cristiano
```

Contexto:

```text
apresentação pessoal
```

Esperado:

```text
MEU NOME É CRISTIANO
```

---

## Caso 10 — Por que

```text
Você sabe porque isso acontece
```

Se for pergunta:

```text
VOCÊ SABE POR QUE ISSO ACONTECE?
```

---

## Caso 11 — Porque

```text
Isso acontece por que o hormônio caiu
```

Se for explicação:

```text
ISSO ACONTECE PORQUE O HORMÔNIO CAIU
```

---

## Caso 12 — Vírgula na quebra

Frase:

```text
Se você continuar assim, o problema pode piorar.
```

Se houver quebra após `assim`:

```text
SE VOCÊ CONTINUAR ASSIM

O PROBLEMA PODE PIORAR
```

Não:

```text
SE VOCÊ CONTINUAR ASSIM,

O PROBLEMA PODE PIORAR
```

---

## Caso 13 — Uma linha obrigatória

Nenhum bloco final pode conter:

```text
\n
```

A validação final deve falhar se um bloco possuir quebra de linha.

---

# 36. TESTES DE ACEITAÇÃO — TIMELINE

1. Legenda inicia na palavra correta.
2. Legenda não aparece antes da fala.
3. Legenda termina junto à unidade falada.
4. Se houver cut próximo de uma quebra natural, a troca ocorre harmoniosamente no cut.
5. Se o cut estiver no meio de uma unidade de fala indivisível, não destruir o sentido apenas para encaixar.
6. Preço aparece exatamente no trecho em que o preço é dito.
7. PRICE sempre sozinho.
8. NORMAL sempre 96.
9. PRICE sempre 150.
10. Nenhum bloco em 2 linhas.

---

# 37. TESTES DE ACEITAÇÃO — UI

Em painel estreito:

- botão principal continua totalmente visível;
- nenhuma informação cria scroll horizontal;
- status continua legível.

Em painel médio:

- cards com espaçamento confortável;
- revisão acessível sem poluir a tela.

Em painel largo:

- usar o espaço adicional de forma elegante;
- não apenas esticar componentes indefinidamente.

Estados:

- loading;
- success;
- warning;
- error;
- disabled.

---

# 38. LOGGING

Criar logger com níveis:

```text
debug
info
warn
error
```

Em produção, logs técnicos detalhados ficam em área expansível.

Nunca deixar `console.log` espalhado pelo domínio.

---

# 39. SEGURANÇA DOS DADOS

Se no futuro um Secondary ASR enviar áudio para serviço externo:

- isso deve ser explícito na configuração;
- o provider deve ser isolado;
- não fazer upload invisível;
- não persistir áudio desnecessariamente;
- não colocar chaves secretas hardcoded no plugin.

---

# 40. PERFORMANCE

Evitar:

- reprocessar a sequência inteira para cada ajuste de UI;
- múltiplas chamadas UXP repetidas sem necessidade;
- renderizar item a item com refresh de UI caro quando houver forma de agrupar operações;
- chamadas de rede para regras determinísticas simples.

Separar:

```text
ANALYSIS
RENDER
```

para permitir prévia e debug.

---

# 41. DECISÕES QUE JÁ ESTÃO FECHADAS

Não perguntar novamente:

```text
✓ Português BR
✓ 1 linha somente
✓ Normal = 96
✓ Preço = 150
✓ Preço sozinho
✓ Preço usa "REAIS"
✓ Não usa "R$"
✓ Milhar usa "."
✓ Androclinic protegido
✓ Cristiano Estivalet protegido
✓ "Meu nome é Cristiano Estivalet" é variação importante
✓ Linguagem coloquial
✓ "para" → "pra"
✓ "para o" → "pro"
✓ "estava" → "tava"
✓ "está" → "tá"
✓ regra correta dos porquês
✓ diferenciar É / E por contexto
✓ vírgula não deve ficar pendurada entre blocos
✓ alinhamento deve considerar cortes
✓ interface responsiva
✓ interface bonita/comercial/bem trabalhada
```

---

# 42. DECISÕES QUE AINDA NÃO ESTÃO FECHADAS

Não inventar como requisito definitivo:

```text
? fonte final
? stroke
? shadow
? cor do texto
? posição Y
? safe width exata
? tolerance exata para snap em cuts
? provider ASR secundário
? processamento local vs cloud
? formato para centavos
? nome comercial definitivo do plugin
```

Criar abstrações/config para isso.

---

# 43. REQUISITO DE CÓDIGO

Prioridades:

1. código legível;
2. módulos pequenos;
3. regras testáveis;
4. nomes claros;
5. dependências mínimas;
6. nenhum “magic number” importante espalhado;
7. config centralizada;
8. erros tratados;
9. comentários apenas quando agregarem contexto;
10. sem arquitetura exagerada.

---

# 44. README DE DESENVOLVIMENTO

O Claude deve manter um `README.md` com:

- versão mínima do Premiere testada;
- versão do UXP Developer Tool;
- como carregar o plugin;
- como executar testes;
- limitações atuais;
- APIs Adobe usadas;
- como configurar MOGRT;
- próximos passos.

---

# 45. PRIMEIRA ENTREGA ESPERADA DO CLAUDE

A primeira entrega NÃO precisa gerar a legenda final perfeita.

Ela deve conter:

```text
1. Plugin UXP carregando no Premiere
2. UI responsiva inicial
3. sequência ativa detectada
4. tracks listadas
5. cortes da V1 listados
6. teste de exportação/leitura de transcript
7. relatório do formato real do transcript
8. teste de inserção de MOGRT
9. teste de leitura/alteração de parâmetros do MOGRT
10. core inicial com testes para preço + coloquial + É/E
```

Depois dessa entrega, avançar para segmentação e renderização final.

---

# 46. REFERÊNCIAS OFICIAIS ADOBE VERIFICADAS NA CRIAÇÃO DESTA SPEC

Use sempre documentação oficial e confirme novamente durante o desenvolvimento, porque APIs podem mudar.

## UXP for Premiere

https://developer.adobe.com/premiere-pro/uxp/

## Building your first UXP plugin

https://developer.adobe.com/premiere-pro/uxp/plugins/

A documentação oficial indica Premiere 25.6+ para o fluxo UXP atual e uso do UXP Developer Tool.

## Premiere API

https://developer.adobe.com/premiere-pro/uxp/ppro-reference/

Acesso ao DOM:

```js
const app = require("premierepro");
```

## Transcript

https://developer.adobe.com/premiere-pro/uxp/ppro-reference/classes/transcript

Na documentação verificada em agosto/2026 existem, entre outros:

- `Transcript.exportToJSON`
- `Transcript.importFromJSON`
- `Transcript.createImportTextSegmentsAction`
- `Transcript.hasTranscript` (desde 26.3)
- `Transcript.querySupportedLanguages` (desde 26.3)

Validar a estrutura real do JSON no host.

## SequenceEditor

https://developer.adobe.com/premiere-pro/uxp/ppro-reference/classes/sequenceeditor

Na documentação verificada existem:

- `SequenceEditor.getEditor`
- `SequenceEditor.insertMogrtFromLibrary`
- `SequenceEditor.insertMogrtFromPath`
- operações de insert/overwrite/remove.

## ComponentParam

https://developer.adobe.com/premiere-pro/uxp/ppro-reference/classes/componentparam

A API permite trabalhar com valores de parâmetros compatíveis como:

- number;
- string;
- boolean;
- PointF;
- Color;

e possui `createSetValueAction`.

Isso NÃO significa automaticamente que todo parâmetro desejado de qualquer MOGRT estará exposto: validar no spike.

## Starters and samples

https://developer.adobe.com/premiere-pro/uxp/resources/starters-samples/

Começar preferencialmente a partir de sample/starter oficial.

## Changelog

https://developer.adobe.com/premiere-pro/uxp/changelog/

Consultar antes de adicionar workarounds.

---

# 47. DEFINIÇÃO DE PRONTO DO MVP

O MVP estará pronto quando o usuário puder:

1. editar/cortar o vídeo normalmente;
2. abrir o painel;
3. escolher a track de cortes;
4. clicar em `GERAR LEGENDAS`;
5. receber legendas sincronizadas;
6. receber somente uma linha por bloco;
7. ter texto normal em 96;
8. ter todos os preços isolados em 150;
9. ver `1.000 REAIS` e `197 REAIS` no padrão correto;
10. ter Androclinic e Cristiano Estivalet corretamente protegidos;
11. receber linguagem coloquial aprovada;
12. receber `é/e` e porquês corrigidos;
13. não receber vírgulas estranhas entre blocos;
14. ter as quebras harmonizadas com os cortes quando fizer sentido;
15. revisar rapidamente apenas os trechos de baixa confiança.

---

# 48. ÚLTIMA INSTRUÇÃO AO CLAUDE

Não trate esta ferramenta como “auto caption comum”.

O valor do produto está no **padrão editorial codificado**.

O resultado ideal deve parecer que um editor humano aplicou as regras manualmente:

```text
fala correta
+
texto natural
+
timing preciso
+
quebra boa
+
corte harmonizado
+
visual consistente
```

Comece pela **FASE 0**, valide as APIs no Premiere real e mantenha um arquivo `DEV_NOTES.md` registrando cada capacidade confirmada, limitação encontrada e decisão tomada.
