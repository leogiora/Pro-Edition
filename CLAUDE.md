# Pro Edition — leia antes de mexer

- Converse em português. O Leo prefere a recomendação com o motivo em uma
  linha, não uma lista de opções.
- `HANDOFF-cowork-2026-09-24.md` — contexto da última sessão (legendas com
  ElevenLabs, ajudante da timeline, testes pendentes). **Ler primeiro.**
- `README.md` — estrutura do repositório e comandos.
- `ferramentas/pro-captions/RETOMAR-pro-captions.md` — estado do Pro Captions.
- `ferramentas/auto-broll/docs/UXP_ARMADILHAS.md` — cada linha custou um
  reinício do Premiere.

Depois de qualquer mudança: `npm run verify` e `node scripts/fumaca-uxp.cjs`
(pega o erro que deixa o painel em branco). Não há hot reload: reiniciar o
Premiere para ver a mudança.
