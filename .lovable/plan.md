# Mostrar anúncio e respostas do formulário quando um lead antigo volta pelo Meta

## O problema (confirmado no Artur Costa)
Quando o lead entra pela primeira vez, a linha do tempo mostra o anúncio e as respostas do formulário. Quando um lead que já existe preenche um formulário novo (caso do Artur, hoje às 22:27), o registro "🔄 Novo interesse via Meta Ads" mostra só o nome da campanha. Nesse caminho, o anúncio e as respostas são recebidos, mas não são salvos no registro.

## O que muda
1. O registro "Novo interesse via Meta Ads" passa a mostrar, igual ao primeiro registro:
   - Campanha
   - Anúncio clicado
   - Respostas do formulário (pergunta e resposta)
2. A ficha do lead passa a mostrar o anúncio novo, e não o antigo. Hoje o Artur ainda aparece com o anúncio de agosto, "Ad 1 - Imagem GPT".
3. Correção retroativa só para o Artur: o registro de hoje ganha o anúncio e as respostas, se a Meta ainda devolver esses dados pelo número do lead. Se não devolver, eu te aviso.

## O que não muda
Corretor, etapa, roleta, avisos e conversões para a Meta continuam como estão.

## Como vou validar
Mando um lead de teste com um telefone que já existe, confiro o registro na linha do tempo e no preview, e depois apago o teste.

## Detalhes técnicos
- `receive-meta-lead/index.ts`: há 2 inserts de "Novo interesse" (linhas ~760 e ~1096). Vou trocar a `descricao` deles para usar os mesmos `entradaParts` (Campanha, Anúncio com prioridade para a mensagem do formulário) e o mesmo `formRespostasTexto` do insert de entrada (~1203). Vou extrair uma função auxiliar e reaproveitar nos 3 lugares.
- Vou incluir `anuncio` (e `formulario`, quando vier) no `updatePayload` dos 2 caminhos de reentrada, preenchendo só quando o valor recebido não for vazio.
- Backfill do Artur (e0eb4e18…): vou buscar o leadgen 28527013243632409 na Graph API e atualizar só aquela atividade.
- Não mexo em distribuição, CAPI nem schema. Exceção pontual da regra "não alterar receive-meta-lead": só o texto do registro e o campo anuncio.
