# Auto B-roll para Adobe Premiere Pro

Plugin UXP que lê a transcrição da sequência já editada, encontra B-rolls
relacionados numa pasta local e os insere na timeline — sem revisão manual.

**100% local e offline.** O `manifest.json` não pede permissão de rede, então o
sandbox do UXP impede qualquer requisição. Não há API de IA, assinatura por uso
ou servidor: a transcrição vem do próprio Premiere e o casamento é aritmética de
texto rodando na máquina.

---

## O que ele faz

Um clique em **Analisar e inserir**:

```
lista a pasta de B-rolls (disco, sem seletor de arquivos)
  → lê os clipes de V1 e a transcrição de cada mídia
  → remapeia para o tempo da sequência e descarta o que foi cortado fora
  → agrupa em frases (marcação `eos` do Premiere + pausa > 1,5s)
  → casa com os conceitos da biblioteca
  → planeja: âncora na palavra, duração, diversidade, sem repetir
  → insere em V2, apara, escala para preencher, remove o áudio
```

Três `Ctrl+Z` desfazem tudo, independente da quantidade de B-rolls.

### Como o casamento funciona

Os **nomes dos arquivos são as etiquetas semânticas**. Uma biblioteca de 260
arquivos com 32 conceitos distintos (`Viagra (12).mp4`, `Falhou na cama (3).mp4`)
transforma o problema em texto contra texto — sem visão computacional, sem
modelo, sem addon nativo.

Três mecanismos, cada um adicionado por caso medido:

| | O que resolve |
|---|---|
| **Raiz por prefixo comum** | `frustração` ↔ `frustrado` |
| **Peso por raridade** | impede que `homem`, presente em vários conceitos, case com tudo |
| **Sinônimos** | `disfunção erétil` → `Viagra`, `telemedicina` → `Teleconsulta` |

Toda sugestão carrega o motivo, e toda recusa também.

---

## Instalação

Requer **Premiere Pro 26.2+** e Node 24+.

```bash
npm install
npm run build
```

Depois, uma vez, **como administrador**:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\install-link.ps1
```

Isso cria um symlink de `Common Files\Adobe\UXP\Plugins\External` para este
repositório — o Premiere varre essa pasta na inicialização.

Pré-requisito: `C:\Program Files\Common Files\Adobe\UXP\Developer\settings.json`
precisa conter `{"developer": true}`. É o que `uxp devtools enable` grava
(`npm i -g @adobe/uxp-devtools-cli`).

Reinicie o Premiere e abra `Janela > UXP Plugins > Auto B-roll`.

> **Não há hot reload.** Qualquer alteração exige reiniciar o Premiere.

---

## Desenvolvimento

```bash
npm run verify   # tipos + testes + build — é o gate
npm test         # 96 testes, sem framework
npm run check    # tsc --noEmit, estrito
npm run build    # esbuild → dist/
```

Quatro dependências de desenvolvimento no total. Sem Jest, sem ts-node, sem
webpack: o Node 24 executa TypeScript nativo, então o runner de testes é o do
próprio Node.

Toda a lógica de decisão é pura e testável sem abrir o Premiere:

```
src/domain.ts       tempo, escala, timecode, caminho, config
src/mp4.ts          resolução lida do cabeçalho do arquivo
src/transcript.ts   reconstrução do corte final + frases
src/match.ts        conceitos, sinônimos, casamento
src/plano.ts        regras de colocação
src/analise.ts      pipeline que junta tudo
src/premiere.ts     único ponto que fala com a API do Premiere
```

O log de cada análise fica em
`%APPDATA%\Adobe\UXP\PluginsStorage\PPRO\26\External\com.leogi.autobroll\PluginData\ultimo-log.json`.
Ler esse arquivo é mais confiável que captura de tela.

---

## Documentação

Ler nesta ordem antes de mexer em qualquer coisa:

| Documento | Por quê |
|---|---|
| [`docs/UXP_ARMADILHAS.md`](docs/UXP_ARMADILHAS.md) | Limitações do UXP descobertas errando dentro do Premiere. Cada linha custou pelo menos um reinício. |
| [`docs/BUILD_STATUS.md`](docs/BUILD_STATUS.md) | Estado atual, pendências e próximo passo. |
| [`docs/DECISIONS.md`](docs/DECISIONS.md) | D-001 a D-015, com o porquê de cada escolha — inclusive as que falharam. |
| [`docs/API_PROOFS.md`](docs/API_PROOFS.md) | O que foi provado na API real, com resultado medido. |

`CLAUDE.md` na raiz é a especificação original do produto.

---

## Pendências conhecidas

1. **Undo único não alcançado** — são três transações. O item de áudio e o clipe
   em V2 só existem depois do overwrite ser aplicado, o que impede montar tudo
   numa `CompoundAction`.
2. **`createSetEndAction` não foi provada isoladamente** — é o que apara a duração.
3. **Dicionário de sinônimos vive no código** (`src/match.ts`); deveria ser um
   arquivo editável.
4. **Sem aprendizado** — o plugin não sabe quais B-rolls foram mantidos ou
   apagados. É o próximo passo.
5. **Cenários difíceis não testados**: nested, multicam, `speed != 1`, mídia
   offline.
6. **ESLint não instalado** — redução deliberada de escopo, ver D-008.

---

## Próximo passo

**Aprender com o que o usuário apaga.** O plugin guarda o plano que inseriu; na
análise seguinte lê V2 e compara. B-roll que sobreviveu foi acerto, o que sumiu
foi erro — e com isso ajusta o peso de cada par conceito-palavra. Sem modelo,
sem nuvem, só contagem. O editor "treina" o plugin editando normalmente.
