# Oferta Ativa — filtro de inativados e descartes recentes (campanha Casa Tua)

## O que está acontecendo hoje (verificado no banco)

A criação de campanha da Base Única já é rígida demais: `preview_campanha_da_base_v2` e `criar_campanha_da_base_v2` excluem **qualquer** pessoa que exista em `pipeline_leads` — ativo, descartado, inativado ou arquivado — mais quem está em fila de Oferta Ativa. Não existe hoje nenhuma opção de escolher o que eliminar; é tudo ou nada.

Para o Casa Tua (6.197 registros com telefone na base):

```text
Inéditos (nunca entraram no CRM) ................ 3.825
Já no pipeline .................................. 2.372
  · com lead ativo em alguma etapa .............. 541
  · só descarte/caiu ............................ 1.831
      – descartados há mais de 90 dias ...........  362
      – idem, fora de fila de OA .................  353
```

Ou seja: hoje a campanha só consegue chegar aos 3.825 inéditos, e não há como puxar os descartes antigos que você quer trabalhar.

## Regra que passa a valer

Público elegível de uma campanha = leads da base que:

1. têm telefone (ou e-mail, conforme o filtro),
2. **não** têm lead ativo no pipeline (qualquer etapa fora de descarte/caiu) — sempre bloqueado,
3. **não** foram inativados (descarte definitivo / arquivamento permanente) — sempre bloqueado,
4. **não** foram descartados nos últimos N dias (padrão 90) — configurável no assistente,
5. não estão em fila de Oferta Ativa em andamento, opt-out ou produto extinto.

Descarte reengajável mais antigo que a janela volta a ser público legítimo de Oferta Ativa.

Data do descarte: última mudança para etapa de descarte/caiu em `pipeline_historico` (cobre 96% dos casos), com fallback para `created_at` do lead. `updated_at`/`ultima_acao_at` não servem — foram tocados em massa e marcam todo mundo como "recente".

## Fases

### Fase 1 — Banco (1 migração, só funções)

- `preview_campanha_da_base_v2` e `criar_campanha_da_base_v2` passam a aceitar no filtro:
  - `incluir_descartados` (bool, padrão `true`)
  - `descarte_min_dias` (int, padrão `90`)
- Nova CTE de classificação por telefone (8 dígitos) e e-mail: `tem_ativo`, `tem_inativado` (tipo_descarte `definitivo` ou arquivado permanente), `descartado_em`.
- Exclusão sempre: ativo, inativado, fila de OA, opt-out, produto extinto.
- Exclusão condicional: descarte com menos de `descarte_min_dias`; e, se `incluir_descartados = false`, todo descarte.
- Preview passa a devolver a higiene detalhada: `removidos_ativos`, `removidos_inativados`, `removidos_descarte_recente`, `removidos_oa`, além de `total` e `bruto`.

### Fase 2 — Assistente de campanha (frontend)

No passo "Público" do `CriarCampanhaDialog`:

```text
Higiene do público (sempre aplicada)
  ✔ Sem leads ativos no pipeline     ✔ Sem inativados     ✔ Sem quem já está em fila de OA

[✓] Incluir leads descartados
     Só descartados há mais de [ 90 ] dias        (30 / 60 / 90 / 180 / 365 / personalizado)

3.825 inéditos + 353 descartes antigos = 4.178 elegíveis
Removidos: 541 ativos · 1.478 descartes recentes/inativados · 9 já em Oferta Ativa
```

- Rodapé e card de resumo passam a exibir a quebra da higiene.
- Mesmos controles no filtro da página Base Única, para a contagem exibida bater com a da campanha.

### Fase 3 — Validação ao vivo

Criar a campanha real do Casa Tua com `incluir_descartados = true` e 90 dias, conferir por SQL que nenhum lead liberado tem lead ativo ou inativado no pipeline nem descarte com menos de 90 dias, e validar a tela do corretor.

## Detalhes técnicos

- Arquivos: migração das duas funções `*_da_base_v2`; `src/hooks/useBaseLeads.ts` (tipos `BaseLeadsFiltro` + retorno do preview); `src/components/leads-base/CriarCampanhaDialog.tsx` (passo Público e rodapé); filtros do `BaseLeadsExplorer`.
- Sem tabela nova, sem mudança no Mutirão ao vivo, sem alteração no cooldown por lead nem em `oferta_ativa_leads`.
- Compatibilidade: filtros salvos sem os novos campos assumem `incluir_descartados = true` e 90 dias.

## Decisões assumidas (avise se for diferente)

- "Inativado" = descarte definitivo/arquivamento permanente — nunca volta para Oferta Ativa.
- Descarte reengajável com mais de 90 dias é público válido; o Mutirão de sexta continua com o seu próprio fluxo, sem mudança.
