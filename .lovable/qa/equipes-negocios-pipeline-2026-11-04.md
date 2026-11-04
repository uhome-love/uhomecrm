# Equipes — negócios alinhados ao Pipeline

Autorização: Lucas aprovou corrigir o quadro Negócios das Equipes após a comparação 20 versus 21.

## Alteração restrita
- `get_pipeline_equipes_overview`: somente `neg_corretor` passa a ler `v_negocios_pipeline`, etapas documentacao/proposta/contrato, com o mesmo escopo de `team_members` ativos.
- Ganho continua separado da carteira em andamento; SQL de ganhos, saúde, tarefas, metas e permissões não foi alterado.
- Migration DDL aplicada fora do expediente: `0065_equipes_negocios_fonte_pipeline.sql`.
- Nenhuma escrita em cliente, negócio, visita ou venda.

## Antes/depois — resposta real e tela autenticada CEO
| Indicador | Antes | Depois |
|---|---:|---:|
| Negócios da empresa | 20 | 21 |
| Equipe Gabriel Vieira | 8 | 9 |
| William Ferreira | 0 | 1 |
| Equipe Junior Padilha | 5 | 5 |
| Equipe Bruno Schuler | 7 | 7 |
| VGV pipeline ativo | 7.324.058 | 7.324.058 |
| VGV assinado novembro | 0 | 0 |
| Leads no resumo | 1.780 | 1.780 |
| Em dia / atenção / desatualizado / estagnado | 1.514 / 178 / 48 / 40 | idênticos |
| Atrasados | 545 | 545 |

A comparação recursiva das respostas completas encontrou somente as três mudanças de `negocios` acima. Chris já estava no Pipeline em Proposta, sem ficha complementar; não foi criada ficha nem alterado o cliente.

Fonte canônica: Documentação 11 (2.214.550), Proposta 10 (5.109.508), Contrato 0, Ganho 122 (67.802.526,29). Ganho/VGV assinado permanecem separados e inalterados.

## Validações
- Browser com sessão do CEO: abriu Pipeline/Equipes, expandiu Gabriel, abriu Negócios; retorno HTTP 200, sem pageerrors.
- Celular 390×844: clicou Documentação, Proposta, Contrato e Ganho; totais 11/10/0/122; sem overflow horizontal da página. Capturas em `/tmp/browser/equipes-negocios/`.
- Testes: 19 passaram (14 integração SQL + 3 helper + 2 compatibilidade do nome Proposta).
- Integração executa a view e RPC de produção em PostgreSQL isolado, sem usar credenciais da conexão gerenciada: etapas sem ficha, exclusões, Ganho separado, ficha antiga, escopo, reconciliação 21, VGV assinado e acesso admin/diretor versus gerente/corretor.
- Fingerprints antes/depois: `pipeline_leads` 13.219, b9f229994ac96b58ec3553781aa56d5a; `negocios` 409, e13abbb5ca5f3ad64c295becdaabbf7f — iguais.
- SQL aplicado igual ao preparado; diff restrito a CTE e variável obsoleta. Último sinal build OK.

Não é uma validação de todas as telas das fases N2–N4, nem de sessões de outros papéis ao vivo. Nenhum ato operacional foi executado em cliente real. Não houve publicação.