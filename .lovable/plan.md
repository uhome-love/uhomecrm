# Onda A — números confiáveis e erros de leitura

## Aprovação solicitada
Este plano cobre somente os quatro pontos da Onda A. Os desenhos estão no PDF **Onda A — desenhos para aprovação**, com três páginas. Números, nomes e roteiros dos desenhos são exemplos, não dados atuais.

**Nenhuma alteração nas páginas ou nos dados do CRM foi feita.** Construção somente depois de Lucas aprovar o desenho e este plano. Execução em etapas pequenas, validando uma antes de avançar à seguinte.

## Identidade preservada
- Manter o azul atual **#4969FF**, a fonte **Inter**, os componentes e as cores de saúde existentes.
- Não redesenhar o menu, o topo geral, os cartões dos clientes nem a temática de Natal nesta onda.
- Corrigir leitura, contexto e erros; não acrescentar animações ou comemorações. As demais ondas continuam separadas.

## A1 — Pipeline: reconciliar título, resumo e saúde
**Desenho: página 1.** O mesmo conjunto de clientes deve produzir o mesmo total. Quando dois indicadores tiverem escopos diferentes por intenção, essa diferença deve ficar explícita, não ser ocultada forçando números iguais.

### Diagnóstico já disponível
A auditoria registrou **947 no título, 1.739 no resumo e 1.737 na saúde**. Esses valores não foram recontados nesta preparação e nenhum é assumido como correto.

O título usa a lista filtrada do Pipeline, enquanto a visão Equipes usa um resumo próprio da empresa. As pílulas também usam uma lista anterior a alguns filtros. Portanto, compartilhar a regra não garante compartilhar o conjunto de clientes.

### Trabalho após aprovação
1. Reproduzir cada total, registrando conta, aba, filtros e horário de leitura.
2. Conferir conjuntos de IDs, duplicidades, paginação, escopo de equipes e exclusões; não apenas somar os números visíveis.
3. Corrigir divergências que existam no **mesmo escopo**. Fazer título/resumo/saúde acompanhar o contexto da aba; quando Equipes for uma visão global, identificar claramente “Empresa”.
4. Preservar a regra vigente: Ganhos/Descarte fora do ativo; estagnados conforme a régua existente. Negócios são parte do ativo, não um segundo total para somar novamente.
5. Preservar a distinção entre saúde por toque e indicadores de tarefa. Não trocar essas réguas só para fazer os números coincidirem.

**Aceite:** conjuntos iguais dão totais iguais; a decomposição do mesmo conjunto fecha; filtros deixam seu contexto claro; nenhum cliente é movido, reatribuído ou reativado; VGV e demais indicadores não mudam por esta correção.

**Limite:** se o confronto identificar uma mudança de regra comercial ou exigir alteração da função de resumo no servidor, apresentar o diagnóstico e o ajuste exato antes de aplicar. Não fazer migração ou mudança de permissões por suposição.

## A2 — Aviso do telefone: usar a leitura autorizada
**Desenho: página 2, esquerda.** Quem já tem telefone não vê aviso; quem não tem continua com o acesso ao próprio cadastro.

### Evidência e proposta
A auditoria registrou repetidamente uma leitura negada do telefone do perfil. A faixa do telefone consulta diretamente esse campo, enquanto a página de Configurações já usa a leitura protegida do próprio perfil.

- Reutilizar o caminho autorizado existente para o próprio usuário, sem liberar telefones de outras pessoas.
- Não confundir carregamento ou falha de leitura com telefone vazio.
- Manter o aviso apenas para telefone realmente ausente/incompleto, sem preencher nem salvar nada automaticamente.
- Não reintroduzir o aviso geral de ativação de push que Lucas pediu para retirar.

**Aceite:** leitura autorizada funciona na conta testada; desaparece o erro recorrente desta consulta; aviso não aparece para perfil completo; acesso ao próprio cadastro funciona sem salvar alterações. Cobrir ausência, número válido e falha de leitura com teste isolado.

## A3 — Roteiros da Oferta Ativa: carregar os títulos existentes
**Desenho: página 2, direita.** Corrigir o seletor existente, sem criar uma nova biblioteca nem reescrever os roteiros.

### Evidência e proposta
Foi registrada falha na consulta dos roteiros. A consulta do seletor pede `nome`, mas a gestão dos mesmos roteiros utiliza `titulo`.

- Confirmar o contrato atual e corrigir a seleção/ordenação para o campo existente; manter os IDs dos roteiros.
- Conferir os consumidores desse seletor no fluxo de campanha da Base Única e da Oferta Ativa; incluir outros somente se usarem a mesma consulta defeituosa.
- Distinguir falha de carregamento de lista realmente vazia. Não exibir “nenhum roteiro” quando a leitura falhar.
- Manter os textos, vínculos, permissões, campanhas e regras de ligação atuais.

**Aceite:** os títulos da lista coincidem com os roteiros já cadastrados; a opção selecionada conserva o mesmo ID; abre/seleciona/cancela sem criar campanha, reservar lead, registrar ligação ou disparar mensagem; desaparece a falha dessa consulta.

## A4 — Página não encontrada: endereço, aba e conteúdo coerentes
**Desenho: página 3.** Reaproveitar a página em português já existente. Não substituir o sistema de abas nem apagar contexto.

### Diagnóstico e proposta
A captura da auditoria apontou divergência entre o endereço inexistente e os títulos de páginas comuns. O CRM mantém abas abertas e já possui uma página não encontrada em português; por isso, a captura isolada não prova a causa.

1. Reproduzir em sessão nova e com abas existentes, inspecionando **somente o conteúdo visível**.
2. Se necessário, corrigir a sincronização de endereço/aba/aviso para que a página antiga não pareça ser o destino inexistente.
3. Mostrar “Página não encontrada” de modo coerente no contexto ativo, sem consumir indevidamente novas abas ou alterar o limite atual.
4. Conferir “Voltar para o início”, voltar/avançar do navegador e troca de abas; manter o início autorizado para cada perfil.

**Aceite:** endereço desconhecido mostra a página correta; endereço válido continua abrindo seu conteúdo; busca e abas continuam acessíveis; retornar não apaga abas ou sessão. Se o comportamento atual já estiver correto, registrar a validação e não alterar código desnecessariamente.

## Validação e segurança — em cada etapa
- Registrar evidências antes/depois no mesmo escopo e distinguir mudança de dados ao vivo de regressão.
- Testes pequenos de lógica para as regras tocadas; não testar textos, estilos ou capturas como regras de negócio.
- Revisar o diff e validar ao vivo as ações citadas, em sessão autenticada, antes de declarar a etapa pronta.
- Desktop em 1280, tamanho próximo ao usado por Lucas e 1920; verificação de claro/escuro e ausência de regressão no celular para elementos compartilhados.
- CEO, gerente e corretor nas ações a que já têm acesso; não ampliar permissões para viabilizar testes.
- Dados reais somente para leitura. Janelas de edição sempre **Cancelar**. Se alguma gravação for indispensável, usar registro de teste identificado e obter aprovação específica antes.
- Não publicar, disparar campanhas, chamar números nem testar reservas reais.
- Validar também que Pipeline, Roleta, Vendas, Financeiro e tarefas continuam abrindo e que seus indicadores não foram modificados por esta onda.

## Detalhes técnicos
- Pipeline: `src/lib/pipelineAtivo.ts`, `PipelineKanban.tsx`, `PipelineHeader.tsx`, `useEquipesView.ts`, `equipes/EscritorioKpiHeader.tsx`; comparar a resposta de `get_pipeline_equipes_overview` em leitura, sem substituí-la por dados do cliente.
- Telefone: `TelefoneFaltandoBanner.tsx`, usando `get_my_profile_full`, já adotada por Configurações. Cliente oficial existente; sem wrapper de rede novo.
- Roteiros: `useBaseLeads.ts` / `useTemplatesOA`, consumidores e `TemplateManager.tsx`; confirmar `titulo` no contrato antes da alteração.
- Navegação: `AppLayout.tsx`, `TabContext`, `pageRegistry.ts`, `TabBar.tsx` e `PaginaNaoEncontrada.tsx`; correção mínima conforme reprodução, sem reestruturar todas as rotas.
- Nenhuma migração, alteração de acesso, edição de cadastro ou mudança de regra comercial está autorizada por este plano. Se houver necessidade, separar o ajuste para nova aprovação e respeitar a janela de migrações do projeto.

## Entrega após aprovação
Relatar cada etapa como **validada**, **sem alteração necessária** ou **aguardando aprovação específica**, com os números/ações efetivamente conferidos. Não declarar a Onda A concluída apenas porque a verificação de código passou.