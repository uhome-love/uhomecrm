# Deixar o template `casatuacanoas_espaco` pronto para o Reengajamento

## Situação
- Template novo: **casatuacanoas_espaco** (Português BR), com imagem no topo, texto com o nome do cliente e dois botões ("Sim, quero informacoes" / "Nao, obrigado"). Foi enviado para análise da Meta.
- A Central de Reengajamento só mostra templates **aprovados**. Enquanto a Meta analisa, ele não aparece para seleção. Isso depende da Meta, não do CRM.
- O rótulo de produto já funciona: nomes com "canoas" são marcados como **Casa Tua Canoas**, então quem responder "Sim" vai com o produto certo.
- Quem já tem corretor continua com o mesmo corretor e o corretor recebe o aviso (pop-up + sininho), como combinado antes.

## O que vou fazer
1. Consultar a Meta e confirmar o nome exato, o idioma e o status atual (em análise, aprovado ou rejeitado), e que o template tem imagem no cabeçalho.
2. Subir a arte "O apartamento ficou pequeno?" como JPG otimizado (menos de ~300 KB) na mesma pasta de imagens de campanha usada nos outros disparos.
3. Vincular a arte ao template: quando ele for selecionado no Disparo manual, a imagem entra sozinha.
4. Validar ao vivo na Central de Reengajamento → Disparo manual. Se já estiver aprovado: selecionar, conferir a imagem no preview e o produto Casa Tua Canoas. Se ainda estiver em análise: confirmar que tudo está pronto e que ele aparece com a arte assim que a Meta aprovar. **Sem disparar nada.**

## Observação sobre o texto
O texto do template diz "150 a 170 m²", mas a arte diz "a partir de 157 m²". Não impede a aprovação, mas o cliente vê as duas informações. Se quiser, ajuste antes de a Meta aprovar.

## Detalhes técnicos
- Upload no bucket público `campaign-images`, arquivo `reengajamento/casatuacanoas-espaco.jpg`, convertido e comprimido localmente antes do upload.
- `src/components/central-nutricao/DisparoCustomizadoCard.tsx`: nova entrada em `TEMPLATE_HEADER_IMAGES` para `casatuacanoas_espaco`.
- Sem migration, sem alteração de edge function, sem mudança no motor de disparo. `reengajamentoEmpreendimento.ts` não muda.
