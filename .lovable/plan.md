# Raio-X da Adriana Kaiser não abre para o Junior Padilha

## O que já conferi (só leitura, nada alterado)

- A Adriana está certa no cadastro: perfil ativo, equipe do Junior ativa (1 vínculo só), papel de corretora. O Junior tem papel de gestor.
- As permissões deixam qualquer usuário logado ver perfis e equipes. Então ela deveria aparecer na lista dele.
- No banco não aparece nenhum erro nem consulta cancelada por demora.
- **O que destoa:** a Adriana tem o maior volume de dados da equipe, mais ou menos o dobro dos outros:

| Corretor | Leads | Atividades | Tarefas | Mudanças de etapa |
|---|---|---|---|---|
| Adriana Kaiser | 544 | 4.541 | 4.768 | 2.345 |
| Douglas Costa | 499 | 2.492 | 2.946 | 2.576 |
| Junior Padilha | 347 | 2.893 | 2.194 | 1.201 |

**Suspeita mais forte (ainda não confirmada):** com esse volume, uma parte da carga do Raio-X falha ou demora demais. Aí a tela mostra "Não consegui carregar o raio-x desse corretor." Nos dados não deu para provar isso. Por isso, o primeiro passo é reproduzir na tela.

## O que vou fazer

1. **Reproduzir como o Junior:** entrar no preview com a conta dele (você aprova esse acesso), abrir Relatórios → Raio-X do Corretor e escolher a Adriana. Vou anotar a mensagem que aparece e qual parte da carga falha.
2. **Corrigir a causa encontrada.** Se for o volume, a correção esperada é:
   - buscar atividades e tarefas só no período que aparece no relatório, e não o ano inteiro de uma vez;
   - fazer a busca em blocos menores e uma de cada vez, para não estourar o limite.
   Se a causa for outra (permissão ou a Adriana faltando na lista), corrijo aquele ponto específico.
3. **Mostrar o motivo real** quando o relatório falhar, em vez da mensagem genérica.
4. **Validar ao vivo:** abrir a Adriana como Junior e conferir que os números aparecem. Abrir também 2 outros corretores dele e o Raio-X do Time, para garantir que nada quebrou. Nenhum dado é alterado.

## O que NÃO muda

- Equipes, papéis, leads, roleta e regras de cálculo do relatório (VGV, visitas, presença).

## Detalhes técnicos

- `src/hooks/useRaioXCorretor.ts`: `fetchAll` dispara 6 páginas em paralelo (`LOTE = 6`) em 11 consultas paralelas. A janela `de` cobre de 12 meses atrás até o início do ano (evolução), então `pipeline_atividades`/`pipeline_tarefas` puxam milhares de linhas. Ajuste previsto: restringir atividades/tarefas a `janela ∪ janelaAnterior` (a evolução anual usa leads/visitas/vendas) ou trocar por contagem agregada; reduzir LOTE para essas tabelas.
- `src/pages/RaioXCorretorPage.tsx`: exibir `error.message` no estado de erro.
- Sem migration, sem mudança de RLS.
