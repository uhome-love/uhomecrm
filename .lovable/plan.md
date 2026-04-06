

# Plano de Correção Completa: Vitrines, Radar e Imóveis

## Diagnóstico dos Problemas

### PROBLEMA CRITICO 1: Duas bases de dados para vitrines
O RadarImoveisTab (tab Radar no modal do lead) cria vitrines usando `supabaseSite` (projeto Supabase EXTERNO: `huigglwvvzuwwyqvpmec`), enquanto todo o resto do sistema (VitrinePage, MinhasVitrines, vitrine-public edge function) lê da base de dados do CRM (`hunbxqzhvuemgntklyzb`).

**Resultado**: Vitrines criadas pelo Radar nunca aparecem em "Minhas Vitrines", e o link gerado aponta para dados que nao existem na base correta. O link simplesmente nao funciona.

**Arquivos afetados**: `RadarImoveisTab.tsx` linhas 1123-1159 e 1225-1253 usam `supabaseSite.from("vitrines")` ao inves de `supabase.from("vitrines")`.

### PROBLEMA CRITICO 2: Vitrines dependem 100% da API Jetimob
A edge function `vitrine-public` busca cada imovel via API Jetimob com timeout de 8s. Se a API estiver lenta ou fora, a vitrine fica em branco. A tabela `properties` do CRM ja tem todos os dados necessarios mas nao e usada como fonte primaria.

### PROBLEMA 3: Radar usa Typesense que pode falhar
O RadarImoveisTab usa `useTypesenseSearch` como fonte primaria. Quando o Typesense falha, tenta fallback via Supabase direto, mas a logica de fallback pode retornar zero resultados se os filtros nao baterem.

### PROBLEMA 4: Campos incompativeis entre vitrines
ImoveisPage cria vitrines com `imovel_ids` (codigos de imovel como "97325-UH"), mas RadarImoveisTab cria com `imovel_codigos` (campo que nao existe na tabela `vitrines` do CRM). Sao campos diferentes em bancos diferentes.

### PROBLEMA 5: ImoveisPage — Filtros podem gerar queries vazias
Quando a busca PostgREST retorna erro, o componente exibe ErrorState mas nao oferece recovery automatico. Filtros complexos combinados podem gerar queries que o Supabase nao processa.

---

## Plano de Correção

### Etapa 1: Unificar criacao de vitrines (CRITICO)

**Arquivo**: `src/components/pipeline/RadarImoveisTab.tsx`

- Remover importacao de `supabaseSite`
- Substituir todas as chamadas `supabaseSite.from("vitrines").insert(...)` por `supabase.from("vitrines").insert(...)`
- Ajustar o schema: usar `imovel_ids` (nao `imovel_codigos`), `mensagem_corretor` (nao `mensagem`), `created_by: user.id`, `lead_nome`, `tipo: "property_selection"`
- Mesmo ajuste na funcao `onCriarVitrine` passada ao RadarFullscreenModal

**Arquivo**: `src/components/pipeline/radar/RadarFullscreenModal.tsx`
- Nenhuma alteracao necessaria (ja recebe `onCriarVitrine` como prop)

### Etapa 2: vitrine-public — Usar properties como fonte primaria

**Arquivo**: `supabase/functions/vitrine-public/index.ts`

- Antes de chamar Jetimob, tentar buscar os imoveis na tabela `properties` por codigo
- So chamar Jetimob para codigos que NAO foram encontrados em `properties`
- Isso elimina a dependencia da API externa e acelera o carregamento

```
// Pseudocodigo
const { data: dbProperties } = await supabase
  .from("properties")
  .select("codigo, titulo, bairro, cidade, dormitorios, suites, vagas, area_privativa, valor_venda, fotos, fotos_full, empreendimento, latitude, longitude")
  .in("codigo", ids)
  .eq("ativo", true);

// Mapear os encontrados, so buscar no Jetimob os que faltam
const foundCodes = new Set(dbProperties.map(p => p.codigo));
const missingIds = ids.filter(id => !foundCodes.has(id));
// Jetimob so para missingIds
```

### Etapa 3: Radar — Tornar busca resiliente

**Arquivo**: `src/components/pipeline/RadarImoveisTab.tsx`

- Na funcao `searchTypesense`: adicionar try/catch robusto com fallback imediato para `searchSupabaseFallback`
- Na funcao `searchSupabaseFallback`: melhorar a query para nao retornar vazio quando sem filtros (remover filtros restritivos quando nao ha bairro nem empreendimento)
- Garantir que `handleSearch` sempre retorna ao menos os resultados do catalogo MeDay quando tudo mais falha

### Etapa 4: ImoveisPage — Robustez na busca

**Arquivo**: `src/pages/ImoveisPage.tsx` e `src/hooks/useImoveisSearch.ts`

- Adicionar retry automatico (1 tentativa) quando PostgREST retorna erro
- Quando ErrorState aparece, incluir botao "Limpar filtros e tentar novamente" que reseta tudo
- Garantir que filtros combinados nao gerem queries invalidas (validar antes de enviar)

### Etapa 5: Validacao de dados na vitrine

**Arquivo**: `src/pages/VitrinePage.tsx`

- Ja tem sanitizacao robusta e ErrorBoundary com fallback — esta bem implementado
- Adicionar log quando `imoveis` retorna vazio para diagnostico
- Adicionar retry automatico apos 3s quando a vitrine carrega com 0 imoveis (pode ser race condition da API)

---

## Resumo de Arquivos a Editar

| Arquivo | Acao |
|---------|------|
| `src/components/pipeline/RadarImoveisTab.tsx` | Trocar `supabaseSite` por `supabase`, ajustar schema da vitrine, melhorar fallback de busca |
| `supabase/functions/vitrine-public/index.ts` | Buscar imoveis em `properties` ANTES do Jetimob |
| `src/hooks/useImoveisSearch.ts` | Adicionar retry automatico e validacao de filtros |
| `src/pages/ImoveisPage.tsx` | Botao de recovery com reset de filtros |
| `src/pages/VitrinePage.tsx` | Retry quando 0 imoveis |

## Resultado Esperado

- Vitrines criadas pelo Radar aparecem em "Minhas Vitrines" e abrem corretamente
- Vitrines carregam instantaneamente via tabela `properties` (sem depender de API externa)
- Radar sempre retorna resultados mesmo quando Typesense falha
- Pagina de Imoveis se recupera automaticamente de erros
- Zero telas em branco ou erros silenciosos

