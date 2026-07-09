## Objetivo
Permitir cadastrar um **segundo comprador (contratante)** na página de Intermediação — para casos de casal ou compra em conjunto — refletindo no contrato .docx gerado, no histórico e no fluxo de edição, sem quebrar contratos antigos com apenas um comprador.

## Comportamento
- Novo botão **"Adicionar segundo comprador"** no card "Comprador (Contratante)", no mesmo padrão já usado em "Adicionar Corretor 2" (com botão de remover).
- O segundo comprador tem os **mesmos campos** do primeiro (Tipo PF/PJ, nome/razão social, gênero, profissão, estado civil, regime de bens, CPF, RG, telefone, e-mail, endereço).
- Quando houver dois compradores, o contrato lista os dois na qualificação ("CONTRATANTE(S): FULANO..., e CICLANO...") e gera **dois blocos de assinatura** de contratante.
- O nome do arquivo e o registro no histórico passam a refletir os dois nomes (ex.: "Fulano e Ciclano").
- Editar um contrato antigo (um só comprador) continua funcionando; o segundo comprador aparece vazio/oculto.

## Alterações

### Frontend — `src/pages/IntermediacaoPage.tsx`
1. Extrair os campos do comprador para um estado estruturado reutilizável (um tipo `CompradorForm` com todos os campos) para `comprador1` e `comprador2`, mais um flag `usarComprador2`. Alternativa mínima: replicar os estados com sufixo `2`. Vou usar um objeto `CompradorForm` para manter o código enxuto.
2. Renderizar o formulário do comprador via um subcomponente/bloco reutilizável, exibido 1x (Comprador 1) e opcionalmente 2x (Comprador 2) com botão adicionar/remover.
3. Validação no `handleGerar`: se `usarComprador2` estiver ativo, exigir os campos obrigatórios do comprador 2 (nome/razão social conforme o tipo).
4. Montar o payload novo: enviar `comprador` (o primeiro, mantido para compatibilidade) **e** `compradores: [comprador1, comprador2?]`. Assim o backend novo usa o array e qualquer consumidor antigo ainda lê `comprador`.
5. `carregarIntermediacao`: ler `p.compradores` (array) quando existir; senão, cair no `p.comprador` único (compat).

### Edge function — `supabase/functions/gerar-intermediacao/index.ts`
1. Ampliar o `BodySchema`: adicionar `compradores: z.array(CompradorSchema).min(1).max(2).optional()`, mantendo `comprador` obrigatório. No handler, normalizar para uma lista `compradores = body.compradores ?? [body.comprador]`.
2. `qualificacaoContratante`: aceitar a lista e emitir a qualificação de cada comprador, separadas por "; e " (ou " e " para o último).
3. Assinaturas: gerar um bloco `CONTRATANTE:` para cada comprador da lista.
4. Nome do arquivo e `comprador_nome` do histórico: juntar os nomes (ex.: "Fulano e Ciclano").
5. Coluna `payload` já guarda o corpo inteiro, então o array fica persistido para reedição.

## Detalhes técnicos
- Sem migração de banco: a tabela `intermediacoes` guarda `comprador_nome` (texto) e `payload` (jsonb) — ambos comportam múltiplos compradores. As colunas `tipo_pessoa`/etc. do primeiro comprador seguem sendo preenchidas com o comprador 1.
- Backward compatibility garantida em duas frentes: payload envia `comprador` + `compradores`; a função lê `compradores ?? [comprador]`.
- Regime de bens do comprador 2 segue a mesma regra condicional (só quando "casado(a)").

## Fora de escopo
- Não altero o cálculo de comissão/credores nem as regras de corretores.
- Não adiciono um terceiro comprador (limite 2), salvo se você quiser mais.