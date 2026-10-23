# Pipeline: um número só de leads ativos, e testes de parceria

## Por que aparecem 27 e 17 para a Larissa
Os dois números contam grupos diferentes:

| Onde ela está | Quantos | Entra no "27 leads" do topo? | Entra nas bolinhas de cor? |
|---|---|---|---|
| Etapas do quadro de Leads (Sem Contato 5, Qualificação 7, Aquecimento 2, Visita 1) | 15 | Sim | Sim |
| Etapa comercial, que aparece na aba Negócios | 2 | Sim | Sim |
| **Ganho, vendas já fechadas** | **10** | **Sim** | Não |
| **Total** | | **27** | **17** (16 verdes, 0 amarelos, 1 vermelho) |

O topo soma até as vendas já fechadas (Ganho), que não são pipeline ativo. As bolinhas só contam quem está em andamento. Por isso não batem.

## Fonte única: "pipeline ativo"
**Pipeline ativo** = clientes em andamento, de Novo Lead até Contrato, sem Ganho, Descarte e arquivados. Os estagnados contam, porque continuam na carteira até irem para o Bolsão.

- **Topo:** passa a mostrar **"17 ativos"**. Ao passar o mouse, mostra a divisão: "15 em Leads · 2 em Negócios".
- **Bolinhas de cor:** continuam iguais. A soma verde + amarelo + vermelho + estagnado passa a ser sempre igual ao número do topo.
- **Ganhos:** continuam só no botão "Ganhos". O aviso "10 em Ganho, veja no filtro Ganhos" continua.
- **Mesma regra em todas as visões:** Leads, Negócios, Empresa, Meus leads, e com filtro de corretor ou de gestor. Tudo calculado de um lugar só, para nunca mais divergir.
- **Fora do escopo agora:** não mexo nas contagens de outros painéis, como Minha Rotina, painel do gerente ou CEO. Se você quiser, faço uma conferência deles depois.

## Testes de parceria (com cliente de teste, apagado no final)
1. **Visita com parceria, confirmando:** criar a visita com "Visita em parceria?" ligada e escolher o Matheus. Conferir que aparece a pergunta de confirmação. Clicar em "Sim", e a parceria é gravada. A contagem fica 0,5 para cada um.
2. **Visita com parceria, voltando atrás:** ligar a parceria, clicar em "Voltar" na pergunta e desligar a parceria. Conferir que nenhuma parceria é gravada e a visita conta 1 inteira.
3. **Selo nos três lugares:** com a parceria do teste 1, conferir o selo "Parceria … + Matheus" no cartão do cliente, no cartão do negócio e no histórico de visitas (agenda e dentro do cliente). Depois apagar o cliente, as visitas e a parceria do teste e conferir que as contagens reais da Larissa (2,5) e do Matheus (1,5) não mudaram.

## Detalhes técnicos
- **Causa:**
  - Em `PipelineKanban.tsx`, o topo usa `filteredLeads.length`, que inclui leads com `stage_tipo` terminal (Ganho).
  - As bolinhas usam `clientStatusCounts`, que pula o terminal e soma os estagnados à parte.
- **Correção:**
  - Criar o seletor puro `contarPipelineAtivo(leads, stageTypeById)` em `src/lib/pipelineAtivo.ts`. Ele retorna `{ total, leads, negocios, saude:{verde, ambar, vermelho, estagnado} }` e exclui terminal, descarte e arquivado, usando `leadSaude`.
  - O topo (`filteredLeadsCount`) e as bolinhas passam a ler esse seletor.
  - Teste unitário: total = soma das cores; Ganho não conta.
- Os testes de parceria rodam no preview com Playwright e uma conta real de corretor, gravando apenas no lead fictício, que é apagado no final por SQL.
