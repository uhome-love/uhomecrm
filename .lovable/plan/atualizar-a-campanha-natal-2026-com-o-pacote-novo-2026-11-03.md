# Atualizar a Campanha Natal 2026 com o pacote novo

Comparei o pacote enviado com o que já está no CRM. Quase tudo já está construído. O que mudou de fato:

## O que muda

1. **Preço do Casa Tua Porto Alegre:** de "R$ 610 mil" para **"R$ 659 mil"** no cartão do empreendimento, no texto de abordagem e na legenda do disparo.
2. **Destaque da semana 23–29/11:** nova faixa "Black Natal Uhome · fim de semana de fechamento 28 e 29/11" na linha do tempo das semanas (só aparece nessa semana; as outras ficam sem destaque).
3. **Materiais (38 arquivos):** o pacote traz versões novas de hoje (cards, disparos, fotos, Instagram, molduras e os 2 encartes). Vou substituir os arquivos atuais pelos novos, com os mesmos nomes, sem mexer na lista nem nas seções.

## O que NÃO muda

- Mantenho o nome **"Campanha Natal 2026"** e o início em **01/11** (o pacote ainda diz "Natal Chave de Ouro" e 02/11, mas você já tinha mudado isso).
- Decoração, metas, corrida, placar, mural e enfeites continuam iguais — os elementos do pacote são os mesmos que já estão no CRM.
- Nenhuma regra, conta ou permissão do CRM.

## Conferência

- Abrir a página Campanha Natal com a sua conta, ver o preço novo e conferir que os 38 materiais abrem com a versão nova.
- Conferir no celular.

## Detalhes técnicos

- `src/natal/central/conteudo.ts`: preço 659 mil (3 campos) e campo opcional `destaque` nas semanas, exibido na linha do tempo.
- Reenviar os 38 arquivos de `materiais_para_subir` ao armazenamento privado `campanha-natal` com upsert por nome; `natal_materiais` só atualiza a data.
