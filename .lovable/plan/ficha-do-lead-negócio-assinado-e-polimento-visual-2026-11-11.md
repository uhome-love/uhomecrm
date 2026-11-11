# Ficha do lead · negócio assinado e polimento visual

Sem migration e sem mudar o que é gravado. Cores, emojis e destaques da linha do tempo continuam como aprovados.

## 1. Investigação: "Em andamento" no Eraldo

**O dado está certo; o card é que lê errado.**
- O negócio ativo do Eraldo está em fase **ganho**, assinatura **10/11/2026**, VGV **R$ 1,1 mi**. Ele **entra no VGV assinado de novembro**. Hoje o sistema grava "ganho" (os nomes antigos "vendido"/"assinado" são lidos como "ganho"). Há 128 vendas ativas em "ganho", nenhuma em "vendido", e 6 assinadas em novembro.
- Ele também tem 2 negócios antigos **arquivados** (rascunhos anteriores, fora das contas). Não aparecem na ficha.
- Causa: o card Negócio escreve "Em andamento" fixo sempre que o lead tem negócio, sem olhar a fase.
- **Outros leads em Ganho com negócio fora de ganho ou sem data de assinatura: nenhum.** Nada a corrigir nos dados.

## 2. Ganho: um card só
- O card Situação em Ganho mostra: "Venda assinada em 10 nov · R$ 1,1 mi", o link "Abrir negócio" e o botão "🔄 Reativar lead".
- Em Ganho, o card Negócio separado sai. Nas outras etapas ele continua igual ("Em andamento").
- Resumo em Ganho: sai a linha "Orçamento".

## 3. Campo de registro
- Chips mais compactos (32 px de altura, texto 12 px), com o "Registrar" na mesma linha, à direita.
- Se não couber, o botão vira só o ícone de enviar (com o nome "Registrar" para leitor de tela) e continua na mesma linha. Os chips podem quebrar; o botão nunca desce sozinho.

## 4. "Visita remarcada" em Atendimento
- O item "📅 Visita remarcada · 10 nov, 10:00 → 11 nov, 11:00" passa a aparecer em "Atendimento", com o mesmo visual de "Visita agendada" (emoji e cor).
- O selo "remarcada" no agendamento original continua.

## 5. Polimento
- Dinheiro no mesmo formato curto em toda a ficha: "R$ 1,1 mi" / "R$ 735 mil" (card Negócio, Situação, Resumo e linha do tempo).
- Mudança de etapa: se o texto da caixa for igual à frase automática do item logo abaixo, no mesmo minuto (ex.: "Contrato atualizado · Avulso · Em vistoria"), a caixa fica só com o chip "De Proposta para Contrato".
- Cards da coluna da esquerda: mesmo espaço interno, mesmo estilo de rótulo (pequeno, maiúsculo, cinza) e o mesmo espaço entre eles.

## Testes
- Eraldo: um card só com valor e "Abrir negócio", sem Orçamento, "Registrar" na linha dos chips, "Visita remarcada" em Atendimento.
- Um lead em Contrato: card Negócio continua "Em andamento".
- Leonardo Prado: sem mudança.
- 1280 px, 1440 px, escuro e celular 390 px. Nada é salvo.

## Detalhes técnicos
- `PipelineLeadDetail.tsx`: não renderizar a seção Negócio quando `stageTipoAtual === "venda"`; valor via `valorCurto` (`timelineNarrativa.ts`); `etapaFinalInfo` de Ganho recebe `valor` e `onAbrirNegocio` (aba "negocio").
- `DrawerAgora.tsx`: o card Situação aceita valor + link "Abrir negócio" além da ação; padronizar `p-5`, rótulo `text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground` e o mesmo em `ResumoLeadLateral.tsx` e na seção Negócio.
- `ResumoLeadLateral.tsx`: nova prop `etapaGanho` esconde a linha Orçamento.
- `RegistroRapido.tsx`: linha `flex items-end` com o grupo de chips `flex-1 flex-wrap` e o botão `shrink-0`; chips `h-8 text-[12px]`; o botão troca para ícone `Send` via container query/ResizeObserver quando a largura disponível é pequena.
- `LeadHistoricoTab.tsx`: evento `data_alterada` entra na categoria de atendimento (hoje é "system") e usa o estilo 📅 azul; dedupe da observação da etapa quando é igual à descrição do item vizinho com |Δt| ≤ 60 s.
