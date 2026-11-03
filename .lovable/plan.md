# Missão de Natal do corretor recolhida + campanha desde 01/11

## O que muda
1. **Minha Rotina do corretor:** a "Minha Missão de Natal" passa a ficar recolhida numa faixa clara (igual CEO e gerente), mostrando "R$ X de R$ meta (%)" e uma barrinha dourada. Botão "Ver detalhes" abre tudo; "Recolher" fecha. A janela de definir meta continua disponível pelo botão dentro do quadro.
2. **Contagem da campanha:** todos os números da Missão de Natal (corretor, gerente, CEO/diretora e Placar de Natal da TV) passam a contar de **01/11 até 18/12**, para todos.

A decoração continua aparecendo como hoje. Feriado de Finados e outras regras não mudam.

## Detalhes técnicos
- `src/natal/config.ts`: `CAMPANHA_INICIO = "2026-11-01"` (usado por useMissaoNatal, MissaoNatalEmpresa, CorridaNatalEquipe).
- `src/natal/MissaoNatalCard.tsx`: prop `recolhivel` com estado `aberto`, mesmo padrão de `CorridaNatalEquipe`; `CorretorDashboard.tsx` passa `recolhivel`.
- Placar TV: nova migration recriando a RPC do placar com `DATE '2026-11-01'` no lugar de `'2026-11-02'` (só DDL, fora do horário comercial — agora 22h57).
- Ajustar teste em `config.test.ts` se necessário; rodar testes de `src/natal/`.
- Conferir na tela a faixa recolhida da Minha Rotina, abrindo e fechando, sem salvar meta.
