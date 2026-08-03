# HOMI A2 — Plano operacional de deploy controlado (somente leitura, nada executado)

## Fatos confirmados

- O código da A2 já está no arquivo `supabase/functions/homi-chat/index.ts` do projeto (bloco `montarQueryBusca` presente entre a declaração de `lastUserMsg` e a chamada de `searchKnowledge`).
- `lastUserMsg` continua declarado exatamente como antes e segue disponível para os usos posteriores.
- A chamada `searchKnowledge(supabase, ragQuery, { limit: 10, threshold: 0.3, empreendimento: null })` mantém parâmetros idênticos: só o 1º argumento muda.
- `supabase/config.toml` não tem bloco `[functions.homi-chat]` — a função usa a configuração padrão da plataforma; nenhuma migration ou secret está envolvida nesta mudança.
- Nenhum outro arquivo do projeto foi tocado nesta etapa.

## Pontos não confirmados

- **Se a função já está publicada no ambiente usado pelo CRM: não confirmado.** Não tenho, em modo leitura, como comparar o bytecode publicado com o commit `93549fd`. O que é conhecido do funcionamento da plataforma: nesta stack, mudanças de backend (Edge Functions) são publicadas automaticamente pela Lovable ao serem gravadas, ao contrário do frontend, que só vai ao ar ao clicar em Publish. Ou seja, o cenário mais provável é que a A2 **já esteja no ar**, mas isso não está comprovado nesta sessão.
- Commit SHA `93549fdac...` e `49f71fce...`: não verificáveis por mim (o estado do git é gerenciado pela plataforma; não executo comandos git). Trato-os como referência sua.
- Se o deploy automático ocorreu, o "deploy controlado" abaixo vale como **procedimento de re-deploy/validação**, não como primeira publicação.

## Plano

### 1. Mecanismo mais restrito de publicação (só `homi-chat`)

Duas coisas distintas, que não se confundem:

| Ação | O que publica | Afeta o quê |
|---|---|---|
| Botão **Publish** do Lovable | Somente o **frontend** (site/preview → produção) | Nenhuma Edge Function, nenhum banco |
| **Deploy de Edge Function** | Somente o código Deno da(s) função(ões) nomeada(s) | Nenhum arquivo de frontend, nenhuma migration |

Para esta etapa, o instrumento correto é o deploy de Edge Function com **lista explícita de uma única função**: `["homi-chat"]`. Ele não toca frontend, não roda SQL, não altera secrets e não republica nenhuma outra função. **Não** clicar em Publish nesta etapa — o frontend não mudou.

### 2. Verificações imediatamente anteriores ao deploy

1. Confirmar que o diff do commit `93549fd` contém **um único arquivo**: `supabase/functions/homi-chat/index.ts`.
2. Confirmar que dentro do arquivo o diff cobre **apenas** o bloco da query RAG (nada em prompt, modelo, tools, CORS ou auth).
3. Confirmar que `supabase/config.toml` está inalterado.
4. Confirmar que não há migration nova em `supabase/migrations/`.
5. Confirmar `deno check` verde e os 12 casos estáticos 12/12 (já realizado).
6. Registrar `49f71fce` como ponto de rollback.
7. Janela: fora do pico de uso do time (regra do projeto para mexer em produção com o time ativo).

### 3. Sequência do deploy controlado (a executar só após sua autorização)

1. Rodar as 7 verificações do item 2.
2. Disparar o deploy da função única `homi-chat`.
3. Aguardar retorno de sucesso do deploy.
4. Fazer 1 chamada de fumaça autenticada (item 4) e ler o log da função no mesmo minuto.
5. Se o log não tiver erro novo, seguir para a bateria dos 12 casos.
6. Se qualquer passo falhar, ir direto ao rollback (item 6).

### 4. Testes de fumaça pós-deploy

Regras: conta autorizada sua (ou de teste), **perguntas sintéticas**, nenhum nome/telefone/e-mail de lead real, nenhuma pergunta que acione ferramenta de escrita (nada de "cria tarefa", "move o lead", "dispara follow-up"). Só perguntas de conhecimento — que é exatamente o caminho que a A2 altera.

Sequência em uma thread nova, contexto anterior fixo: *"Como respondo quando o cliente acha caro no Casa Tua?"*

| # | Pergunta | Esperado |
|---|---|---|
| 1 | E no Casa Tua? | usa contexto anterior |
| 2 | E para investir? | usa contexto anterior |
| 3 | Por áudio? | usa contexto anterior |
| 4 | No VIVID, quais diferenciais? | só a pergunta atual |
| 5 | Preço do Lake Baikal? | só a pergunta atual |
| 6 | Explique o método SPIN. | só a pergunta atual |
| 7 | E se ele disser que é caro? | usa contexto anterior |
| 8 | Agora me mostra o funil da semana. | só a pergunta atual |
| 9 | Isso funciona? | usa contexto anterior |
| 10 | (thread nova, 1ª msg) E no Casa Tua? | só a pergunta atual |
| 11 | E como eu conduzo a conversa quando ele diz que vai pensar melhor? | só a pergunta atual (>60 chars) |
| 12 | Qual o valor do condomínio? | só a pergunta atual |

Critério prático de leitura: nos casos 1, 2, 3, 7 e 9 a resposta deve continuar o assunto do turno anterior; nos demais, não deve arrastar o assunto antigo.

### 5. Sucesso, observação e gatilhos de rollback

**Sucesso:** deploy OK; 12/12 coerentes; nenhum erro novo no log de `homi-chat`; latência percebida igual à de antes.

**Observação:** 24 h, com checagem do log da função em T+15 min, T+2 h e T+24 h.

**Rollback imediato se qualquer um ocorrer:**
- erro de deploy ou erro de runtime novo em `homi-chat`;
- qualquer resposta 500 numa pergunta que antes funcionava;
- 2 ou mais dos 12 casos com comportamento oposto ao esperado;
- reclamação do time de que o HOMI passou a "misturar assuntos";
- aumento visível de latência das respostas.

### 6. Rollback

Restaurar `supabase/functions/homi-chat/index.ts` à versão de `49f71fce` (ou substituir manualmente o bloco novo pelas 11 linhas originais) e **fazer novo deploy apenas de `homi-chat`**. Sim: o rollback exige um novo deploy da função anterior — não existe "despublicar". Não há migration, reindexação, secret nem estado a desfazer; a mudança é puramente de leitura. Frontend e banco ficam intocados. Tempo estimado: minutos.

## Riscos

| Risco | Gravidade | Mitigação |
|---|---|---|
| A2 já estar publicada sem validação | Média | rodar os 12 casos de fumaça mesmo antes de qualquer deploy — valida o que está no ar hoje |
| Re-deploy derrubar a função por segundos | Baixa | janela fora do pico |
| Falso positivo de continuação (pergunta nova curta iniciada por "e/ou/mas") | Baixa | contexto entra rotulado, truncado em 200 chars e depois da pergunta atual |
| Deploy arrastar outra função por engano | Baixa | lista explícita de uma função só |

## Decisões pendentes / dependem de você

1. **Autorizar ou não o deploy** — nada será executado sem sua ordem explícita.
2. **Confirmar se quer que eu antes verifique o que está publicado hoje** (uma chamada de leitura ao `homi-chat` com pergunta sintética, sem dados de lead) para resolver o ponto "não confirmado".
3. **Janela de horário** do deploy.
4. **Conta a usar nos testes** (sua ou conta de teste).
5. Commits `93549fd` / `49f71fce`: só você consegue confirmar no repositório `uhome-love/uhomecrm` — não tenho acesso ao git.

Aguardando sua autorização. Nada será alterado até lá.
