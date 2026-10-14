# Campanha Meta Connect JW - v4 — preparar CRM e roleta

## O que encontrei (verificado)
- **Connect JW já existe no CRM**, no grupo **S2 - Investimento**, mas está **inativo** (não aparece como ativo no Foco Corretores).
- A regra da roleta do Connect JW já existe e está **ligada** no S2.
- Já tem vários nomes reconhecidos (Connect JW, Connect Joao Wallig, v1, v2, IG...), mas **não tem "Connect JW - v4"**.
- O formulário **"Uhome - Connect JW - Video - Visita"** ainda não está cadastrado no CRM.

## O que vai ser feito
1. **Ativar o Connect JW** (continua em S2 - Investimento). Passa a aparecer ativo no Foco Corretores para alocar corretores.
2. **Adicionar nomes**: "Connect JW - v4" e "Uhome - Connect JW - Video - Visita", para o lead entrar como Connect JW.
3. **Ligar o formulário**: busco o código do formulário na Meta e cadastro no CRM, igual Open Bosque/Skyglass (lead entra como Connect JW, com anúncio clicado e respostas no histórico).
4. Não mexo em outros produtos, conversões nem distribuição. Sem corretor alocado, os leads vão para a Fila do CEO.

## Validação
- Conferir no Foco Corretores que o Connect JW aparece ativo em S2.
- Conferir via consulta que nomes, regra da roleta e formulário estão ligados.
- Opcional: lead de teste da Meta (apago depois).

## Preciso de você
- Quais corretores atendem Connect JW (ou você aloca no Foco Corretores).

## Detalhes técnicos
- run_sql (sem migration): `update empreendimentos_canonicos set ativo=true where id='fa06971e-…'`; inserts em `empreendimento_aliases` (tipos campanha/empreendimento_texto/formulario).
- Graph API `leadgen_forms` da Page → nova linha em `META_FORM_ID_MAP` (`receive-meta-lead/index.ts` e `src/lib/metaFormIdMap.ts`) + deploy de `receive-meta-lead`.
