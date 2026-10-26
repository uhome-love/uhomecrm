# Confirmar venda: espaço não abre o cliente + aceitar variação da intermediação

## 1. Barra de espaço abrindo o cliente
**Causa confirmada:** no quadro de Negócios, o cartão do cliente abre os detalhes quando se aperta Enter ou Espaço. O pop-up "Confirmar venda" fica "dentro" desse cartão, então cada espaço digitado no pop-up (ex.: "Apto Rua...") chega ao cartão e abre o cliente. O cartão do quadro de Leads já ignora isso; o de Negócios não.

**Correção:** o cartão de Negócios só reage ao Enter/Espaço quando o foco está nele mesmo, nunca quando a pessoa está digitando num campo ou pop-up. Clique no cartão continua abrindo normalmente. Conferir também os outros cartões que têm o mesmo atalho (Painel da diretora, RH, Tarefas de hoje, Caminhos) e aplicar a mesma proteção.

## 2. Venda travando por diferença com a intermediação
**Situação confirmada:**
- Nome do empreendimento diferente da intermediação **já não bloqueia** (só mostra aviso e grava no histórico).
- O que bloqueia hoje é a **unidade**: se a unidade digitada não for exatamente igual à da intermediação (ex.: "Avulso RE/MAX" x "apto 302"), o botão "Confirmar venda" fica desligado e o sistema também recusa ao salvar.

**Correção (para imóvel avulso/revenda poder variar):**
- Unidade diferente da intermediação passa a ser **aviso amarelo**, não bloqueio — igual ao empreendimento.
- Ao confirmar, a diferença (empreendimento e/ou unidade) fica registrada no histórico da venda.
- Continua obrigatório: empreendimento escolhido, unidade preenchida, VGV, data de assinatura, intermediação do mesmo cliente e comprovante do ato.

## Validação
- Cliente de teste: digitar com espaços no pop-up de venda dentro do quadro de Negócios sem abrir o cliente.
- Confirmar venda de teste com imóvel avulso e unidade/nome diferentes da intermediação → vira Ganho com aviso no histórico. Apagar o teste e conferir que total de vendas/VGV não mudou.

## Detalhes técnicos
- `NegociosBoardInline.tsx` (~linha 533): adicionar `if (e.target !== e.currentTarget) return;` no onKeyDown (mesmo padrão de `CardMinimal.tsx`); idem nos demais `role="button"` com atalho de espaço.
- `ConfirmarVendaForm.tsx`: tirar `unidadeDiferente` da condição de bloqueio e do botão; trocar a mensagem vermelha por aviso amarelo.
- Migration (1): em `validar_venda_completa`, remover o RAISE "A unidade deve corresponder à intermediação anexada."; em `confirmar_venda`, registrar em `negocios_atividades` (tipo `divergencia_unidade`) quando a unidade diferir. Demais travas iguais.
