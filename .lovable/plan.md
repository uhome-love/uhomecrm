# Aviso de novo lead sem nome e sem empreendimento — correção

## Causa confirmada

O aviso do William chegou como "Nome: Lead / Empreendimento: Não identificado" porque a função de distribuição monta a mensagem com dados que **nunca são devolvidos**.

- Em `distribute-lead`, o objeto do lead é montado a partir do retorno do banco: `result.lead_nome`, `result.lead_empreendimento`, `result.lead_telefone`, `result.lead_origem`.
- A função do banco `distribuir_lead_atomico` devolve apenas: `success, corretor_id, profile_id, segmento_id, empreendimento_canonico_id, janela, expira_em, pool, pool_size, recebidos_no_produto`. **Nenhum campo de nome/empreendimento.**
- Resultado: os campos chegam vazios e a mensagem cai no texto padrão "Lead" / "Não identificado".

Os dados existem no lead: os leads distribuídos nesse horário têm nome (ex.: "Bruna Passos", "Terezinha Abreu") e empreendimento canônico ("Casa Tua", "Terrace", "Flow"). Só não estavam sendo lidos.

O mesmo objeto vazio alimenta **três avisos**: WhatsApp, push (tela bloqueada) e a notificação no sino do CRM ("Você recebeu o lead Lead").

## Correção

Em `distribute-lead`, logo após confirmar a distribuição, buscar o lead no banco e usar esses dados nos três avisos:

- nome: `pipeline_leads.nome`;
- empreendimento: nome do **empreendimento canônico** quando existir (ex.: "Casa Tua" em vez de "Casa Tua - v3"), com fallback para o texto bruto `pipeline_leads.empreendimento`, e só então "Não identificado";
- telefone/origem seguem sendo usados apenas internamente (o WhatsApp continua enviando **somente nome + empreendimento**, sem PII, como definido).

Se a busca falhar, mantém os textos padrão atuais — o aviso nunca deixa de sair.

## Detalhes técnicos

- Arquivo: `supabase/functions/distribute-lead/index.ts`. Substituir o objeto `lead` montado de `result.lead_*` por um `SELECT nome, empreendimento, telefone, origem, empreendimento_canonico_id` em `pipeline_leads` (+ `empreendimentos_canonicos.nome`) antes dos blocos de `notifications.insert`, `sendWhatsApp` e `sendPush`.
- Sem migração de banco (a função do banco fica como está). Sem mudança de regra de distribuição.

## Validação

Redeploy da função e disparo de um lead de teste para o WhatsApp do Lucas conferindo que chega "Nome: <nome real>" e "Empreendimento: <empreendimento real>"; conferir também o texto do sino e do push.
