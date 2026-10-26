# Todo lead fica vermelho antes de estagnar (auditoria das cores)

## Regra combinada
- **Verde:** atualizado
- **Amarelo:** atenção
- **Vermelho:** desatualizado, vai estagnar. É o último aviso antes de estagnar.
- **Estagnado:** só depois de passar pelo vermelho

## O que a auditoria encontrou (dias sem atualização)
| Etapa | Verde | Amarelo | Vermelho | Estagna |
|---|---|---|---|---|
| Sem Contato | até 2 | 3–4 | 5–15 | depois de 15 (ok) |
| Qualificação | até 7 | 8–14 | 15–21 | depois de 21 (ok) |
| **Aquecimento** | até 15 | 16–21 | **nunca** | depois de 21 (**erro**) |

No Aquecimento, o lead pula do amarelo direto para estagnado, e o corretor não recebe o aviso vermelho. Hoje são 8 leads em Aquecimento no amarelo, que vão estagnar sem ficar vermelhos. Também há 45 que já passaram de 21 dias.

## O que muda
1. **Aquecimento:** verde até 15 dias, amarelo de 16 a 18, vermelho de 19 a 21, estagna depois de 21. O prazo total para estagnar continua o mesmo.
2. A mesma régua vale em todos os lugares: cartão do Pipeline, pílulas do topo, avisos no sino e no celular, Bolsão e painéis. Assim nenhuma tela mostra uma cor diferente da outra.
3. **Proteção para o futuro:** adicionar um teste automático que confere que toda etapa que estagna passa pelo vermelho antes. Se alguém mudar um prazo errado, o teste avisa.
4. As outras etapas e o prazo de estagnação não mudam. Lead com prazo extra concedido continua sem estagnar até a data combinada.

## Validação
- Testes automáticos com leads de 10, 17, 20 e 22 dias em Aquecimento (verde, amarelo, vermelho, estagnado) e com as outras etapas, para garantir que nada mudou nelas.
- Conferir no preview que os leads de Aquecimento entre 19 e 21 dias aparecem vermelhos e recebem o aviso, sem alterar nenhum lead real.

## Detalhes técnicos
- `src/lib/leadSaude.ts` e a função do banco `lead_saude_status` (as duas versões) passam a calcular o vermelho a partir de um limite próprio: amarelo vai até o menor valor entre `prazo*2` e `estagna-3`, e vermelho vai até `estagna`. Aquecimento fica em 15/18/21; Sem Contato e Qualificação continuam com o mesmo resultado.
- Uma migration só altera essas funções (fora do horário de pico, conforme a regra de migrations). Revisar quem consome a função (avisos, `get_pipeline_estagnacao`, Bolsão) para confirmar que todos usam essa mesma régua.
- Novo `leadSaude.test.ts` com a invariante "vermelho antes de estagnar" para cada etapa.
