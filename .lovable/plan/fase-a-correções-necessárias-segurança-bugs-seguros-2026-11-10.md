# Fase A — Correções necessárias (segurança + bugs seguros)

Primeiro bloco da auditoria. Não há tela nova, por isso não há desenho: são travas invisíveis e correções de erro. Cada passo é validado antes do próximo.

## Bloco 1 — Fechar os acessos abertos da Lia (crítico)

| Acesso | Quem usa hoje | Como fica |
|---|---|---|
| Acompanhamentos da Lia | rotina automática | aceita só a rotina automática; os comandos de teste ("enviar agora", "só este telefone") passam a exigir CEO/diretora logada |
| Preparar reengajamento | botão no painel da Lia | exige usuário logado com papel CEO/diretora |
| Disparar fila de reengajamento | rotina automática | aceita só a rotina automática |
| Chat da Lia (IA paga) | WhatsApp da Lia, Laboratório, página de teste | aceita só chamadas internas ou CEO/diretora logada |

Validação: chamar cada acesso sem login (tem que recusar), com login de CEO (tem que funcionar) e conferir que as rotinas automáticas continuam rodando nos registros. Nenhuma mensagem é enviada a cliente durante o teste; o piloto da Lia continua desligado.

## Bloco 2 — Entradas de leads e RH (sem nunca derrubar lead)

- **WhatsApp:** se a chave de assinatura estiver ausente, recusa e avisa a operação, em vez de aceitar tudo.
- **ImovelWeb (via Make):** passa a conferir uma senha. Para não perder lead, entra primeiro em **modo aviso** (aceita e registra quem chegou sem senha); só depois de você colocar a senha no Make eu ligo o bloqueio.
- **Quiz:** limite de tamanho, telefone válido obrigatório e limite de envios por telefone (mesmo modelo das páginas de empreendimento).
- **Formulário de vaga (RH):** o candidato só pode atualizar a própria ficha com um código que recebe ao começar; ninguém sobrescreve ficha alheia sabendo só o telefone.

## Bloco 3 — Bugs seguros do dia a dia

1. Teclas 1–5 e P da Oferta Ativa só funcionam com a aba dela aberta.
2. Tarefas: quando falhar, mostra "Não foi possível carregar" com "Tentar de novo" (computador e celular), nunca "sem tarefas".
3. Busca global: botão no celular; negócio abre o lead certo no Pipeline; visita abre a visita; erro aparece como erro; resposta atrasada não substitui a atual; texto do campo diz o que realmente busca.
4. HOMI limpa a conversa quando outro usuário entra no mesmo aparelho.
5. Academia só mostra "Certificado emitido" depois de gravar de verdade.

Validação: computador (1280px) e celular (390px), com cliente de teste e Cancelar, apagando os dados no fim.

## Fora desta fase (próximos planos, com desenho)

Números/fonte única dos rankings, 1:1, PDN e painel da diretora; alertas com ação; botão "+" do celular; HOMI entendendo a tela; cores do design system; limpeza de arquivos sem uso; novo exame de segurança completo.

## Detalhes técnicos

- Bloco 1: `requireCronAuth` (`x-cron-secret`/service role) em `lia-followup` (cron) e `lia-reengajar-dispatch`; `requireAuth` + checagem de papel admin/diretor em `lia-reengajar-arm` e nos ramos manuais do `lia-followup`; `lia-chat` aceita service role (chamadas de `lia-whatsapp`/`lia-laboratorio`, que passam a mandar o header) ou JWT admin/diretor (`LiaTeste`). Conferir antes nos `cron.job` quais headers as rotinas enviam.
- Bloco 2: `whatsapp-webhook` retorna 503 + `ops_events` sem `appSecret`; `receive-imovelweb-lead` com secret `IMOVELWEB_WEBHOOK_SECRET` em modo log-only até confirmação; quiz com validação de schema e throttle por telefone/IP; RH com token assinado devolvido na criação e exigido em update/finalize.
- Bloco 3: listener de teclado condicionado à aba ativa do shell; `isError`/`refetch` em `TarefasCorretor`; `GlobalSearch` com token de requisição, tratamento de `error` e destinos `/pipeline-leads?lead=` e `/agenda-visitas?visita=`; reset do estado do `HomiContext` na troca de `user.id`; checagem de erro em `useAcademia`.
- Sem migração de banco nos blocos 1 e 3; bloco 2 pode precisar de uma tabela simples de limite de envio (fora do horário de pico, conforme a regra de 2 migrações/dia).
