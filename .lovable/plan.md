# Corrida de Natal do gerente: recolhida e sem repetir a saudação

## O que muda
1. **Recolhida por padrão** (igual ao CEO): no painel do gerente aparece só uma faixa fina e clara (fundo branco, borda dourada fina), não um bloco azul:
   `🎄 Corrida de Natal · Equipe Bruno · R$ 0 de R$ 10 mi (0%)  [mini barra dourada]  [Ver detalhes ▾]`
2. **Ao apertar "Ver detalhes"** abre tudo que existe hoje: placar da equipe vs R$ 10 mi, outras equipes, prêmio das diárias no Rosa, 6 números, "Meu time na missão", Prêmio surpresa e Atenção hoje. Botão "Recolher" fecha.
3. **Fim da repetição visual:** o quadro aberto deixa de usar o fundo azul-noite com Homi (que já está na saudação). Passa a ter fundo claro com detalhes dourados (título, barra e chave dourada). Assim a saudação fica como o único bloco azul.

## O que não muda
Números, regras, saudação, painéis CEO/diretora/corretor.

## Detalhes técnicos
- `src/natal/CorridaNatalEquipe.tsx`: adicionar prop `recolhivel` com `useState`, faixa resumida e troca de `natal-noite` + Homi por cartão claro com `natal-borda-ouro`.
- `src/pages/GerenteCockpit.tsx`: `<CorridaNatalEquipe recolhivel />`.
- Validação: abrir o painel do gerente, conferir a faixa recolhida, abrir e recolher.
