# Filtro de período na página Relatórios (/raio-x)

Hoje as duas abas de `/raio-x` têm filtros de período diferentes e desalinhados:

- **Raio-X do Time**: seletor próprio com apenas "Mês atual / Mês passado / Este ano", com cálculo de datas duplicado dentro da própria página (não usa a régua oficial).
- **Raio-X do Corretor**: usa a régua oficial `periodoFiltro` (Mês atual, Mês passado, 30/60/90 dias, Ano, Personalizado), com o período na URL.

Nenhuma das duas tem "Semana atual" nem "Semana anterior", e "Mês atual" hoje significa o mês de calendário inteiro (até o último dia), não o acumulado até hoje.

## O que muda

Um único filtro de período, igual nas duas abas, com estas opções:

1. **Semana atual** — segunda-feira até hoje (BRT)
2. **Semana anterior** — segunda a domingo da semana passada
3. **Mês (acumulado)** — dia 1º até hoje — **padrão**
4. **Personalizado** — datas de início e fim escolhidas (fim incluído)

As opções extras que já existem na aba do Corretor (Mês passado, 30/60/90 dias, Ano) continuam disponíveis, listadas depois das quatro principais, para não perder relatório que já é usado. Se preferir só as quatro, é só dizer.

Outros ajustes:

- O período passa a valer para as **duas abas ao mesmo tempo** e fica na URL (`?periodo=`, `?de=`, `?ate=`), então o link continua compartilhável e o PDF sai no mesmo recorte.
- O rótulo do período aparece no cabeçalho e no PDF (ex.: "Semana atual · 18/08 a 24/08/2026").
- A comparação "vs. período anterior" acompanha automaticamente: semana atual compara com a semana anterior, mês acumulado compara com os mesmos dias do mês passado.

## Detalhes técnicos

- `src/lib/periodoFiltro.ts`: adicionar `semana` e `semana_passada` a `PeriodoOpt`, `PERIODO_OPCOES` e `calcJanela` (semana começa na segunda, BRT, via `hojeBRT`/`addDias`). Alterar `mes` para acumulado (`start` = 1º do mês, `end` = hoje + 1 dia, mantendo o padrão end-exclusivo) e ajustar o rótulo para "Mês (acumulado)". Em `calcJanelaAnterior`, tratar `semana`/`semana_passada` como janela imediatamente anterior de mesmo tamanho (regra que já existe para 30/60/90) — o mês acumulado já é truncado corretamente pela lógica atual.
- `src/pages/Relatorios.tsx`: subir o estado do período para o container das abas (lendo/gravando na URL, mesmo contrato de `RaioXCorretorPage`) e renderizar um seletor único acima das abas.
- `src/pages/RelatorioGeral.tsx`: remover o `PeriodoOpt`/`calcPeriodo`/`PERIODO_LABEL` locais e passar a receber a janela por props, usando `calcJanela` e `labelOpcao`/`labelJanela` da régua compartilhada. `useRelatorioGeral` já recebe `{ start, end }`, então nada muda no acesso a dados.
- `src/pages/RaioXCorretorPage.tsx`: reaproveitar o período vindo do container em vez de manter o próprio seletor duplicado; `useEstadoDaUrl` continua sendo a fonte para o modo impressão (`/raio-x-corretor/imprimir`), que segue funcionando isolado.
- Sem migrations, sem mudança de RPC, view, RLS ou regra de negócio — é só camada de filtro e apresentação.

## Validação

Abrir `/raio-x` no preview e conferir, nas duas abas: padrão em "Mês (acumulado)", troca para Semana atual / Semana anterior / Personalizado atualizando números e rótulo, período preservado ao trocar de aba e ao recarregar a página, e PDF do corretor saindo com o mesmo recorte.
