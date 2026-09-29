# Casa Tua Canoas (/v/casa-tua-canoas) — medir visitas e preenchimentos

## Situação hoje (verificado agora)
- **Preenchimentos:** nenhum envio gravado até agora (a tabela de respostas está vazia).
- **Visitas:** a página não registra quem abre. As estatísticas gerais do site só mostram 3 visitas vindas do Facebook entre 27 e 29/09, e não dá para saber se foram nessa página.
- Motivo provável: o site com a página ainda não foi publicado em uhomesales.com, ou o botão "Ir para o site" do formulário ainda aponta para outro link. **Primeiro passo: confirmar esses dois pontos.**

## O que construir
1. **Contador de funil da página** (sem login, sem dados pessoais), gravando 4 momentos:
   - abriu a página
   - tocou no play do vídeo
   - começou o quiz (1º toque)
   - enviou o WhatsApp (já é gravado hoje)
   Cada momento fica com o `f` (formulário) e a origem do anúncio.
2. **Painel "Página Casa Tua Canoas"** dentro de Dados de Anúncios (só admin/diretor):
   - Hoje / 7 dias: aberturas → vídeo → quiz → envios, com a % de cada passo.
   - Lista dos últimos envios: horário, respostas do quiz, horário de visita escolhido, status (vinculado ao lead / aguardando / sem lead) e o nome do lead, quando houver vínculo.

## Não muda
Entrada de leads da Meta, roleta, pipeline, a página em si (só ganha o registro silencioso).

## Validação
Abrir a página no preview em 390px, tocar no vídeo, responder o quiz, enviar com telefone de teste e conferir os números e a linha no painel. Apagar os registros de teste no fim.

## Detalhes técnicos
- Nova tabela `pagina_empreendimento_eventos` (slug, evento, form_ref, utm jsonb, sessao_id aleatória, ip_hash, created_at). Grants + RLS com leitura só para admin/diretor, sem acesso anônimo.
- Gravação pela edge function pública existente `pagina-empreendimento-resposta`, com o novo modo `{tipo:"evento"}` validado por Zod: lista fixa de eventos, rate limit por ip_hash e deduplicação por sessão/evento.
- Frontend: `CasaTuaCanoasVisita.tsx`, `VideoLite.tsx` e `QuizToques.tsx` disparam o evento (fire-and-forget) e não travam a tela se ele falhar.
- Painel: novo card na seção `/dados-anuncios`, com leitura de `pagina_empreendimento_eventos` + `pagina_empreendimento_respostas`.
- 1 migration, só DDL, fora do horário de 08 a 19h se já houver 2 no dia.
