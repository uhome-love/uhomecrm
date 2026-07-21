## O que muda

Na Fila CEO, aba **Novos**, trocar a "PRÉVIA POR SEGMENTO" (S1/S3/S4) por uma listagem **agrupada por Empreendimento (produto)** — Casa Tua, Lake Baikal, Flow, etc. — com **um lead por linha** (nome + empreendimento + origem) e um **botão "Repassar" em cada linha** para atribuição manual imediata a um corretor. O restante do modal (aba Reengajamento, escolha de destino Roleta/Oferta Ativa, botão "Disparar N leads") continua igual.

Escopo: apenas o arquivo `src/components/pipeline/FilaCeoDispatchModal.tsx` + 1 componente novo pra picker de corretor.

## Nova UI (aba Novos)

```text
PRÉVIA POR EMPREENDIMENTO

▼ Casa Tua                                            2 leads
  • João Silva      · Site               [Repassar]
  • Maria Souza     · Meta Ads           [Repassar]

▼ Lake Baikal                                         2 leads
  • Pedro Alves     · Meta Ads           [Repassar]
  • Ana Costa       · ImóvelWeb          [Repassar]

▼ Flow                                                1 lead
  • Carlos Dias     · Meta Ads           [Repassar]

▼ Sem empreendimento identificado                     N leads
  • ...
```

Grupos ordenados por: (1) empreendimento canônico ativo em ordem alfabética, (2) "Sem empreendimento" por último. Cada grupo é um card colapsável (default aberto), com contagem à direita.

Cada linha mostra: nome do lead · badge origem (se houver) · botão "Repassar" (ícone + label, `size="sm"`, `variant="outline"`).

## Fluxo "Repassar" manual

Clicar em "Repassar" abre um **CorretorPickerDialog** (novo, leve) sobre o modal:

- Lista corretores ativos (`team_members` where `status='ativo'`), busca por nome.
- Ao confirmar: `UPDATE pipeline_leads SET corretor_id=?, aceite_status='aceito', aceito_em=now(), motivo_pendencia=null WHERE id=?` — mesmo padrão usado hoje pela política de "atribuição manual" (já existente no memory: `manual-attribution-policy`, seta lead como aceito, bypassa roleta).
- Registra em `audit_log` (`modulo='roleta'`, `acao='fila_ceo_repasse_manual'`).
- Toast de sucesso, refetch da lista do modal e invalidação de `pending-leads` / `ceo-dashboard`.

Sem RPC nova — usar update direto igual `PipelineTransferDialog` já faz.

## Dados

Fonte por lead: usa `empreendimento_canonico_id` (resolvido pelo trigger existente) → nome via `empreendimentos_canonicos`. Fallback pro texto bruto `empreendimento` quando canônico ainda não resolveu. Quando nenhum dos dois, cai em "Sem empreendimento identificado".

Ajuste no `SELECT` do `pipeline_leads` já existente: adicionar `empreendimento_canonico_id`. Fetch adicional único de `empreendimentos_canonicos (id, nome)` para mapear nomes.

Lógica antiga de `resolveSegmentoNome` / `SEGMENTO_COLORS` / `preview por segmento` é removida da aba Novos (deixa de ser usada). `unidentifiedCount` continua existindo (agora = leads sem empreendimento identificado) e alimenta o mesmo checkbox "Incluir leads sem segmento" (rótulo passa a "Incluir leads sem empreendimento").

## Melhorias aproveitadas

1. Contagem por grupo já visível (`N leads`), evitando o antigo "Casa Tua (2)".
2. Botão "Repassar" ganha ícone `UserPlus` e fica desabilitado durante submit.
3. Card do grupo tem borda esquerda colorida discreta (indigo/primary) só pra separação visual — sem cor por segmento.
4. Se o lead já tem `motivo_pendencia` (empreendimento pausado), badge pequeno `⏸️ Pausado` na linha, pra CEO saber por que caiu ali.
5. Log de auditoria explícito em cada repasse (rastreável).

## Fora do escopo

- Aba Reengajamento (mantida como está).
- Bloco "Disparar novos leads para onde?" (roleta/oferta ativa) e botão em massa (mantidos).
- Nenhuma migration nova.

## Arquivos

- `src/components/pipeline/FilaCeoDispatchModal.tsx` — reescreve `TabsContent value="novos"` + `useMemo preview` + `SELECT`.
- `src/components/pipeline/FilaCeoRepassarDialog.tsx` — novo, ~120 linhas, dialog picker de corretor.

## Validação

Ao final: abrir a Fila CEO em preview, conferir agrupamento por empreendimento, testar "Repassar" com um lead de teste (lead → corretor alvo), verificar audit_log e sumiço da linha da fila. Roleta em massa continua funcionando (regressão check no botão "Disparar N leads").