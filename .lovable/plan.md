# Casa Tua Canoas (/v/casa-tua-canoas) — Logo, galeria e fase 2 (vínculo + aviso ao corretor)

## Situação hoje (verificado)
- O topo mostra um logo desenhado à mão ("U" num círculo + "Home."), não o oficial.
- A galeria já desliza no dedo (celular), mas não tem nenhum sinal visual de que dá para deslizar, e no computador só dá com trackpad.
- Ao confirmar o WhatsApp, a resposta é **só salva**. Hoje **não** existe vínculo com o lead do pipeline nem aviso ao corretor (era a "fase 2", deixada de fora de propósito na fase 1).

## 1. Logo oficial
- Usar o SVG enviado (`uhome-logo-azul.svg`, azul #4969FF) no topo, com ~28px de altura, mantendo o "Casa Tua · Canoas" ao lado.

## 2. Galeria deslizável
- Manter o deslizar no dedo e adicionar:
  - bolinhas indicadoras embaixo (qual foto está visível);
  - setas laterais discretas (aparecem só em telas maiores);
  - um card da próxima foto "espiando" na borda (já existe, mantido).
- Tocar na foto abre em tela cheia, com deslizar entre elas (opcional, veja pergunta abaixo — se não quiser, fica de fora).

## 3. Fase 2 — vincular ao lead e avisar o corretor
Fluxo ao tocar em "Reservar meu horário":

```text
salva resposta (como hoje)
   -> procura lead no pipeline pelo telefone (mesma normalização do CRM)
      achou lead ativo com corretor -> vincula + registra no lead + avisa corretor
      não achou ainda               -> fica "pendente" e tenta de novo depois
```

- **Tempo de chegada:** a pessoa cai na página segundos depois de enviar o formulário da Meta; o lead pode ainda não ter entrado no pipeline. Por isso, além de tentar na hora, uma rotina a cada 5 min tenta vincular respostas pendentes das últimas 24h (depois disso marca "sem_lead").
- **Qual lead:** o mais recente, não arquivado, com esse telefone. Se houver mais de um, prefere o do Casa Tua Canoas.
- **O que aparece no lead (tudo no Lead Detail):** uma anotação fixa tipo
  "Preencheu a página do Casa Tua Canoas: Família com filhos · O quanto antes · Pátio/espaço · Quer visitar: Sábado de manhã".
- **Aviso ao corretor:** popup + sininho (mesmo tipo de aviso usado quando o lead responde SIM ao reengajamento): "🏠 {nome} quer visitar o Casa Tua — Sábado de manhã". Se o lead ainda não tiver corretor (Fila CEO/roleta), a anotação fica no lead e o aviso sai quando ele for vinculado — sem alterar distribuição.
- **Não muda:** etapa, corretor, roleta, captação da Meta, dados do lead além da anotação. Nada de lead é mostrado na página pública (ela continua só recebendo "ok").

## 4. Validação ao vivo
- Lead de teste com telefone de teste no pipeline, atribuído a um corretor de teste.
- Enviar a página com esse número: conferir vínculo na resposta, anotação no lead, popup/sininho do corretor.
- Testar também "lead chega depois" (enviar antes de criar o lead de teste) e número sem lead. Apagar registros de teste no fim.

## Detalhes técnicos
- Frontend: `src/pages/public/CasaTuaCanoasVisita.tsx` (troca `Logo`), `src/components/landing-casatua-canoas/GaleriaSnap.tsx` (dots via IntersectionObserver/scroll, setas `scrollBy`), logo em `src/assets/uhome-logo-azul.svg` (SVG pequeno, fica no repositório).
- Função `pagina-empreendimento-resposta`: após o insert, chama rotina de vínculo (best-effort, erros vão para `ops_events`, nunca falha a resposta ao visitante).
- Rotina de vínculo compartilhada em `supabase/functions/_shared/vincularRespostaPagina.ts`: busca `pipeline_leads` por `telefone_normalizado`, grava `lead_id` + `status='vinculado'` em `pagina_empreendimento_respostas`, insere `pipeline_anotacoes` (fixada) e `notifications` (tipo `pagina_empreendimento`, `dados.pipeline_lead_id`). Idempotente via status.
- Nova função `pagina-empreendimento-vincular` (cron 5 min, autenticada por segredo de cron, como os crons atuais) processa `status='pendente'` < 24h; > 24h vira `sem_lead`.
- Migration (1, só DDL): índice em `pagina_empreendimento_respostas(status, created_at)` + agendamento pg_cron. Fora do horário 08-19h BRT se já houver 2 migrations no dia.
- Conferir no código antes de gravar que `pipeline_leads.corretor_id` é o mesmo id usado em `notifications.user_id` (padrão do aviso de reengajamento).
