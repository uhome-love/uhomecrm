# Teste do aviso de novo lead + campanha "cadastre seu celular"

Duas coisas: (1) mandar um aviso de teste para o seu WhatsApp (51 99259-7097) usando o template aprovado; (2) se chegar, avisar os corretores — por notificação que aparece na tela bloqueada do celular — para cadastrarem o número nas configurações.

## Parte 1 — Teste no seu WhatsApp

- Disparo do tipo `novo_lead` para 5551992597097 via a função de aviso (canal Meta, template `novo_leaduhome`), com dados de teste (nome + empreendimento).
- Confirmação do resultado: canal usado (`meta` ou `meta_text`) e registro de sucesso no painel de saúde.
- Você confirma no celular se a mensagem chegou antes de seguir para a Parte 2.

## Parte 2 — Aviso para os corretores cadastrarem o celular

Só executa depois da sua confirmação de que o teste chegou.

1. **Quem recebe:** corretores ativos cujo `profiles.telefone` está vazio ou inválido (menos de 10 dígitos).
2. **Push na tela bloqueada:** envio via a função de push já existente, com título "Cadastre seu WhatsApp" e texto curto explicando que sem o número o corretor não recebe o aviso de novo lead. Ao tocar, abre direto a tela de Configurações no campo de telefone.
3. **Notificação no sino do CRM:** mesma mensagem gravada em `notifications` (categoria própria), para quem não tiver push ativo.
4. **Faixa no topo do app:** banner discreto e dispensável, exibido só para quem está sem telefone, com botão "Cadastrar agora" → Configurações.

## Detalhes técnicos

- Parte 1: chamada direta à edge function `whatsapp-notificacao` com `{ telefone, tipo: "novo_lead", dados }`; leitura de `ops_events` para confirmar canal.
- Parte 2:
  - Consulta em `profiles` (corretores ativos, telefone nulo/curto) para montar a lista.
  - Push pela função `send-push` para as `push_subscriptions` desses usuários; `dados.url = "/configuracoes?secao=perfil#telefone"`.
  - Inserção em `notifications` com dedupe (não repetir para quem já recebeu nos últimos 7 dias).
  - Banner: novo componente leve em `src/components/notifications/`, montado no `AppLayout` junto dos banners atuais; some sozinho quando o telefone é preenchido.
- Sem migration e sem mudança no fluxo de distribuição de leads.

## Validação

- Print/confirmação do WhatsApp recebido no seu número.
- Lista de corretores sem telefone antes e depois do envio.
- Teste ao vivo no preview: banner aparece para conta sem telefone e desaparece ao salvar o número.
