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

### Fase 4 — Inteligência por região (zonas de Porto Alegre)
Hoje a coluna `regiao` da tabela de imóveis está **100% vazia** (25.133 imóveis ativos, 550 bairros distintos, nenhuma região preenchida). Por isso o HOMI não entende "me vê opções na zona norte".

O que será feito:
- Criar um mapa canônico bairro → zona (Norte, Centro/Central, Leste, Sul, mais Extremo Sul e Ilhas quando fizer sentido), cobrindo os bairros oficiais de Porto Alegre e as grafias que aparecem na nossa base.
- Preencher a coluna `regiao` de todos os imóveis a partir desse mapa, e manter o preenchimento automático para imóveis novos que entram pela sincronização.
- Ensinar o HOMI a entender zona: ao pedir "zona norte", ele busca por todos os bairros daquela zona; ao mostrar um imóvel, ele diz bairro e zona.
- Reconhecer sinônimos comuns ("norte", "zona norte", "região norte", "zona central", "centro").
- Bairros de cidades vizinhas (Canoas, Viamão, Alvorada, Gravataí, Cachoeirinha) ficam fora das zonas de POA e são tratados como "Região Metropolitana", para não poluir a busca.

Referência das zonas (será revisada com você antes do backfill):
- **Norte**: Passo d'Areia, São João, Higienópolis, Boa Vista, Cristo Redentor, Jardim Itu, Jardim Lindóia, Sarandi, Rubem Berta, Vila Ipiranga, São Sebastião, Alto Petrópolis, Jardim Floresta, Costa e Silva, Parque Santa Fé...
- **Central**: Centro Histórico, Independência, Bom Fim, Rio Branco, Moinhos de Vento, Auxiliadora, Mont'Serrat, Petrópolis, Santana, Santa Cecília, Farroupilha, Cidade Baixa, Menino Deus, Praia de Belas, Azenha, Floresta, São Geraldo, Navegantes, Humaitá...
- **Leste**: Partenon, Jardim Botânico, Santo Antônio, Vila Jardim, Bom Jesus, Chácara das Pedras, Três Figueiras, Boa Vista do Sul, Jardim Carvalho, Agronomia, Lomba do Pinheiro, Mário Quintana, Protásio Alves...
- **Sul**: Cristal, Camaquã, Cavalhada, Tristeza, Vila Assunção, Vila Nova, Nonoai, Teresópolis, Medianeira, Glória, Ipanema, Pedra Redonda, Espírito Santo, Guarujá, Serraria, Hípica, Belém Novo, Lami, Restinga, Lageado, Ponta Grossa.

Observação: **Teresópolis é bairro da zona sul** — o erro do Casa Tua foi ele ter sido rotulado com esse bairro; Alto Petrópolis fica na zona norte.

### Detalhe técnico da Fase 4
- Nova tabela `bairros_zonas` (bairro normalizado, zona, cidade) com GRANT + RLS de leitura para usuários autenticados, e função de normalização (sem acento, minúsculo) para casar as grafias da base.
- Backfill de `properties.regiao` via essa tabela + trigger para novos registros.
- `homi-tools.ts`: parâmetro `zona` no `buscar_imovel`, resolvendo para lista de bairros; o card do imóvel passa a exibir a zona.
- Indexação da tabela de zonas no cérebro para o HOMI responder perguntas de localização mesmo fora da busca.

## Validação
- Perguntar ao HOMI CEO "onde fica o Casa Tua?" e conferir Alto Petrópolis.
- Fazer a mesma pergunta no modo corretor e confirmar resposta idêntica.
- Pedir "me vê opções na zona norte" e conferir que só voltam bairros da zona norte.
- Pedir "3 dorms na zona sul até 800 mil" e validar bairro + zona nos cards.
- Conferir que o CEO continua respondendo funil/VGV normalmente e em formato curto.

Sugestão de ordem: Fase 1 (correção do bairro, baixo risco) → Fase 4 (zonas, maior ganho para o corretor) → Fases 2 e 3 (unificação do cérebro), validando ao vivo a cada etapa.

