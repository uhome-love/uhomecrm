# Oferta Ativa na ligação + Mutirão no celular (mockup aprovado)

Feito em 3 partes, cada uma validada antes da próxima. Só no celular; computador igual. Botões de resultado, regras, pontuação e gravações continuam exatamente as mesmas de hoje.

## Parte A — Bolsão (Estagnados / Descartados)
- Cliente em tela cheia: topo com "‹ Sair", pílula "Estagnados · Lake Eyre" e quantos restam.
- Iniciais grandes, nome, telefone, chips (empreendimento, "entrou em").
- Botões redondos grandes: Ligar e WhatsApp.
- Barra presa embaixo (acima da barra de atalhos): "Aproveitar" grande verde; "Não atendeu" e "Sem interesse" lado a lado.

## Parte B — Listas
- Some a troca de abas "Lead / Script / Resultado". Fica uma tela só: cliente no centro, botões redondos (Ligar, WhatsApp, Roteiro), tempo de ligação visível quando ligando, com "Encerrar".
- "Roteiro" abre por baixo o script e as objeções que já existem.
- Barra presa embaixo com os resultados que já existem hoje (Aproveitado, Agendar visita, Não atendeu, Sem interesse, Descarte definitivo) — tocando, abre a mesma confirmação de hoje (com motivo obrigatório quando já é obrigatório).
- Pular e Finalizar sessão continuam no topo.

## Parte C — Mutirão Ao Vivo
- Placar em faixa no topo (tentativas, aproveitados, visitas, pontos) e a posição no ranking.
- Cliente em tela cheia com Ligar/WhatsApp; resultados presos embaixo mostrando os pontos (visita +30, aproveitado +5), usando as mesmas ações de hoje.
- Ranking, metas, feed e histórico continuam acessíveis numa aba abaixo.

## Validação
iPhone 393px, conta de corretor, com cliente de teste: Bolsão (puxar, Aproveitar, Não atendeu, Sem interesse, Sair), Listas (ligar, roteiro, cada resultado abre a confirmação e cancelar), Mutirão só se houver sessão ativa (senão, só visual). Apagar o cliente de teste no fim. Conferir computador igual.

## Detalhes técnicos
- A: novo `bolsao/BolsaoClienteMobile.tsx`; `BolsaoDiscador` escolhe por `useIsMobile()` e passa `aproveitar`/`registrar`/`busy`.
- B: novo `oferta-ativa/mobile/DialingMobileView.tsx` recebendo `lead`, `callActive`, `callTimer` e os handlers existentes (`handleAction`, `handleOpenResultPopup`, `handlePopupResult`, `handleWhatsAppDuringCall`, skip); `ToolsColumn` vai num Drawer "Roteiro". Substitui só o bloco `isMobile ? ...` de `DialingModeWithScript.tsx` (1403 linhas — nada de lógica movida nesta fase; se tocar, extrair o mínimo).
- C: `LeadCard`/`CorretorScreen` ganham layout mobile via `useIsMobile()`, reaproveitando os mesmos callbacks; painéis laterais viram Tabs abaixo.
- Barras fixas com `bottom: calc(barra de atalhos + safe-area)`; tokens semânticos. Sem banco.
