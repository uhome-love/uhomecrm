# Homi na ficha do lead · velocidade e formato

Só servidor do Homi + o quadro "Sugestão do Homi" da ficha. Sem migration, sem mudar o que é gravado no lead.

## 1. Homi mais rápido (todas as ações do homi-assistant)
- Trocar o modelo `google/gemini-2.5-flash` pelo mesmo do homi-chat (`google/gemini-3.6-flash`, já usado e respondendo em 1–3,5 s). Escolha: é a opção mais rápida e já comprovada no próprio CRM; desligar o raciocínio no modelo antigo continua lento por causa do prompt grande.
- Limite de saída: 600 tokens na sugestão da ficha; 1.200 nas demais ações (script de ligação e mensagem precisam de mais texto). Se preferir 600 em tudo, ajusto.
- Registro na `homi_ia_uso` continua igual; muda só a versão do prompt para comparar antes/depois.

## 2. Ação própria `sugestao_ficha`
- Formato fixo e curto:
  - `## Próximo passo` — 1 frase.
  - `## 💬 Mensagem` — até 3 linhas, terminando com convite para visita com duas opções de dia.
- Não recebe o "FORMATO COMPLETO" e pula a busca de materiais.
- Na ficha, o quadro passa a pedir `sugestao_ficha` no lugar de `custom`.

## 3. Prompt sem dados velhos
- Remover os blocos "📊 DADOS REAIS DE PERFORMANCE" de cada produto (Total de leads, Lead→Visita, No-show, Conversão pós-visita) e o comparativo entre produtos.
- Trocar o fluxo antigo pelas 10 etapas atuais: Novo Lead, Sem Contato, Qualificação, Aquecimento, Visita, Pós-Visita, Documentação, Proposta, Contrato, Ganho — com a orientação por etapa reaproveitada das regras atuais (ex.: "Atendimento" vira Qualificação/Aquecimento).
- Método Uhome, scripts e posicionamentos de produto ficam intactos.

## 4. Na ficha
- Se a sugestão passar de 10 s, cancelar a espera e mostrar "O Homi está demorando. Tentar de novo" (o botão refaz o pedido). Visual atual mantido.

## Teste
- Abrir a sugestão em Leonardo Prado, Leandro da Nóbrega e Maria Rosa; enviar latência, tokens (entrada/saída/raciocínio) e a resposta de cada um, lidos na `homi_ia_uso`.
- No painel completo do Homi de um lead: "Mensagem WhatsApp" e "Script de ligação", com tempo medido.
- Conferir no computador e no celular; forçar demora para ver a mensagem de 10 s. Nada é salvo nos leads.
- Meta: 90% abaixo de 5 s.

## Detalhes técnicos
- Arquivos: `supabase/functions/homi-assistant/index.ts` e `src/components/pipeline/drawer/HomiSugestaoRecolhida.tsx`.
- `max_tokens` no corpo enviado ao gateway; `AbortController` de 10 s no fetch da ficha, distinguindo timeout de erro.
- Nova `case "sugestao_ficha"` no switch, fora das listas que acrescentam formato; materiais só quando `acao !== "sugestao_ficha"`.
