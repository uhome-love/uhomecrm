# HOMI CEO com a mesma inteligência do corretor + correção do bairro do Casa Tua

## O que está acontecendo (verificado)

1. **Modos diferentes, cérebros diferentes.** O HOMI do corretor roda na função `homi-chat`, que usa o cérebro RAG (`_shared/homi-brain.ts`: Método Uhome, imóveis, Academia) e ferramentas reais (buscar imóvel, fila de execução, visitas). O HOMI CEO roda em `uhome-ia-core`, que **não** importa o cérebro nem tem ferramentas — ele responde a partir de uma lista de empreendimentos escrita à mão dentro do prompt.

2. **O bairro errado vem dessa lista escrita à mão.** Em `uhome-ia-core/index.ts` está literalmente `"Casa Tua" / "Las Casas" → bairro: "Teresópolis"`. Por isso o CEO recebeu Teresópolis com bairros próximos Cristal/Medianeira. Não existe hoje nenhum registro de imóvel do Casa Tua no banco com bairro preenchido, então a única fonte é esse texto do prompt — e ele está errado. O correto é **Alto Petrópolis**.

## O que será feito

### Fase 1 — Corrigir o dado (rápido, hoje)
- Trocar o bairro do Casa Tua para **Alto Petrópolis** no prompt do `uhome-ia-core`, com bairros próximos coerentes (Passo d'Areia, Jardim Itu, Vila Ipiranga, Higienópolis).
- Revisar as demais linhas dessa lista contra os empreendimentos canônicos e sinalizar as que não temos como confirmar, em vez de inventar bairro.
- Regra nova no prompt: quando não houver certeza sobre localização/preço, o HOMI diz que vai confirmar em vez de chutar.

### Fase 2 — CEO com o mesmo cérebro do corretor
- Fazer `uhome-ia-core` importar `_shared/homi-brain.ts`, igual ao `homi-chat`: o CEO passa a consultar Método Uhome, base de imóveis e Academia por busca vetorial, em vez de depender da memória do prompt.
- Manter a personalidade e o foco por papel (CEO/gestor olha funil, VGV, time; corretor olha atendimento), mudando só a camada de conhecimento — a fonte de verdade passa a ser o banco.
- Manter o estilo de resposta curto já aprovado (resumo em 1 frase + bullets, "Aprofundar" sob demanda).

### Fase 3 — Fechar a lacuna estrutural
- Cadastrar bairro/região dos empreendimentos canônicos como campo de dado (não como texto de prompt), para que qualquer HOMI leia do mesmo lugar.
- Reindexar o cérebro após a correção, para que as respostas antigas em cache/vetor não repitam Teresópolis.

## Detalhes técnicos

- `supabase/functions/uhome-ia-core/index.ts`: correção do bloco de empreendimentos e import do brain compartilhado (`retrieveContext`) antes da montagem do prompt.
- `supabase/functions/_shared/homi-brain.ts`: sem mudança de contrato; apenas passa a ser consumido pelos dois modos.
- Nova coluna de localização em `empreendimentos_canonicos` (bairro, região) + backfill dos empreendimentos ativos, com GRANT/RLS seguindo o padrão do projeto.
- Reindexação via `homi-reindex` ao final.

## Validação
- Perguntar ao HOMI CEO "onde fica o Casa Tua?" e conferir Alto Petrópolis.
- Fazer a mesma pergunta no modo corretor e confirmar resposta idêntica.
- Conferir que o CEO continua respondendo funil/VGV normalmente e em formato curto.

Sugestão: aprovar a Fase 1 isolada primeiro (correção do bairro, baixo risco) e validar ao vivo antes de encostar na unificação do cérebro.
