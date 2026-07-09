# PDN — Reformulação completa (ponta a ponta)

Objetivo: transformar o PDN numa ferramenta de gestão simples, rápida e confiável para o gestor controlar visitas realizadas, negociação, contrato, ganhos e caídos — sem depender de planilha do Google e **sem alterar o pipeline do corretor**. O gestor gerencia internamente e, quando quiser, avisa o corretor para atualizar o pipeline.

## Diagnóstico (auditoria concluída)

1. **Negócios "voltando" para etapas anteriores** — duas causas confirmadas:
   - **Etapas legadas nas linhas manuais.** Linhas antigas guardam `situacao` como `assinado`, `gerado`, `visita`, `caiu` (formato antigo). O código atual só reconhece `visita_realizada / em_negociacao / contrato / ganho` e joga todo o resto em "Em Negociação". Por isso "José Lauro", "Naiana" (assinado) e "Guilherme" (gerado) de Março aparecem hoje em Negociação.
   - **Lead duplicado no pipeline.** "jose lauro da Rosa" existe 2x: um em *Venda* (assinado 03/03) e outro criado em 08/07 em *Proposta*. O segundo o faz aparecer em Negociação.
2. **Negócios "vazando" entre meses.** Negócios *Em Negociação/Contrato* aparecem em TODOS os meses (não há recorte por mês para etapas vivas), então o estado atual contamina meses passados.
3. **Não dá para mudar etapa.** Hoje uma linha do pipeline só pode ir para "Caídos". Não há como o gestor mover Visita → Negociação internamente.
4. **Apagar/atualizar falhando.** Combinação do bug de mapeamento (a linha "reaparece" no grupo errado) e ausência de reforço de estado após a ação.

## O que será construído

### 1. Etapas editáveis pelo gestor (sem afetar o corretor)
- Nova coluna `grupo_override` em `pdn_entries` (overlay). Para negócios do pipeline, a etapa efetiva no PDN passa a ser: `caiu → Caídos`, senão `grupo_override` (se o gestor definiu), senão a etapa natural do pipeline.
- Kanban: arrastar qualquer card entre colunas passa a gravar `grupo_override` (hoje só funciona para Caídos e manuais). Nada é escrito no pipeline/negócio.
- Planilha e Drawer: seletor de etapa por linha (Visita Realizada / Em Negociação / Contrato / Ganho / Caídos).
- Um selo discreto "ajustado pelo gestor" quando a etapa do PDN difere da etapa real do pipeline, com opção "Voltar à etapa do pipeline" (limpa o override).

### 2. Comunicar o corretor (interno + botão "Avisar corretor")
- Botão **"Avisar corretor"** no Drawer e na linha, abrindo um campo de recado curto (pré-preenchido com a etapa correta, ex.: "Atualize o pipeline: mover para Em Negociação").
- Cria uma **notificação no app** para o corretor (via função `criar_notificacao`, já existente e SECURITY DEFINER), categoria própria `pdn_atualizacao`, com nome do cliente e etapa sugerida.
- Registra `corretor_avisado_em` na linha para mostrar "Avisado em dd/MM" e evitar reenvios acidentais.

### 3. Congelar meses passados
- Meses anteriores mostram **o histórico daquele mês**: Ganhos (por data de assinatura no mês), Caídos, linhas manuais do mês e linhas com override registrado no mês.
- Negócios em aberto (Em Negociação / Contrato / Visita Realizada vindos ao vivo do pipeline) aparecem **apenas no mês corrente**. Isso elimina o vazamento entre meses.

### 4. Correção do mapeamento de etapas + saneamento de dados
- Normalizador robusto `situacao → grupo` cobrindo os códigos legados: `visita→Visita Realizada`, `proposta→Em Negociação`, `gerado/em_confeccao/contrato_gerado→Contrato`, `assinado/venda/vendido→Ganho`, `caiu/perdido→Caídos`.
- Migração de dados: converter as `situacao` legadas das linhas manuais para as chaves canônicas (mantém o negócio no grupo certo). Sem tocar em pipeline/negócios.

### 5. Corrigir apagar/atualizar
- Garantir recarregamento consistente após excluir/ocultar/editar.
- Linha manual → exclui de vez; linha do pipeline → oculta do PDN (não afeta o corretor), já restaurável na seção "Removidos".
- Validação ponta a ponta no preview (criar, editar, mover, avisar, apagar).

### 6. Relatório de duplicados (você decide)
- Card "Possíveis duplicados" listando o mesmo cliente/corretor presente em mais de uma etapa de negócio no pipeline (ex.: José Lauro em Venda e Proposta), apenas informativo. Nada é apagado automaticamente no pipeline.

## Detalhes técnicos

- **Migração** (`pdn_entries`): adicionar `grupo_override text`, `corretor_avisado_em timestamptz`, `corretor_avisado_etapa text`. Sem mudança de RLS (escrita continua do dono; leitura do dono/admin). GRANTs já existentes.
- **Dados**: `UPDATE` normalizando `situacao` legada (via ferramenta de dados, não migração de schema).
- **`src/hooks/usePdn.ts`**: expor `corretorAuthId` em `PdnRow`; normalizador de grupo; grupo efetivo com `grupo_override`; recorte por mês para etapas vivas; ações `mudarEtapa(row, grupo)`, `limparEtapaOverride(row)`, `avisarCorretor(row, mensagem)`; `duplicados` (memo) para o relatório.
- **`PdnKanban.tsx`**: drag entre colunas grava override para linhas do pipeline; contadores mantidos.
- **`PdnCardDrawer.tsx`**: seletor de etapa, selo "ajustado", botão "Avisar corretor" + campo de recado, indicador "Avisado em…".
- **`PdnGestor.tsx`**: seletor de etapa por linha na planilha, ação "Avisar corretor", card de duplicados, ajuste dos textos.
- **Notificação**: `supabase.rpc('criar_notificacao', {...})` para `corretorAuthId`.

## Fora de escopo
- Não altera pipeline, negócios, nem etapas do corretor.
- Não apaga leads duplicados automaticamente (só lista).
- Aviso por WhatsApp (ficou só no app, conforme escolhido).

## Validação
- Preview: mover etapas no Kanban e planilha; confirmar que o pipeline do corretor não muda; enviar aviso e verificar a notificação; alternar meses e confirmar congelamento; criar/editar/apagar linha manual; conferir que José Lauro/Naiana/Guilherme voltam aos grupos corretos e o card de duplicados lista o José Lauro.
