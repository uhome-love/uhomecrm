# Coleção Prime na Campanha de Natal

## O que você recebeu
O arquivo tem 11 peças, cada uma em 2 tamanhos (22 imagens):
capa da coleção, Square Garden, Yofi, Gama, Seen Menino Deus, Seen Três Figueiras, Seen Boa Vista, Nilo Square, Arte Cidade Nilo, Casa Moinhos e Zayt.
- Feed (1080x1350)
- Stories (1080x1920)

## O que vai aparecer para os corretores
Na página Campanha de Natal, aba de peças, um bloco novo **"Coleção Prime"**:
- Capa da coleção em destaque no topo.
- Grade com os 10 empreendimentos, cada cartão com a miniatura e um seletor **Feed | Stories**.
- Botões já existentes: **Baixar** e **Compartilhar** (no celular abre o WhatsApp/Instagram direto).
- No celular: 2 cartões por linha; no computador: 4 a 5.

As demais peças de Natal não mudam.

## Como entra
- As 22 imagens são enviadas para o mesmo local onde ficam hoje os materiais do Natal e cadastradas como ativas, na ordem do arquivo (capa primeiro).
- CEO/diretora continuam podendo ocultar ou trocar qualquer peça pelo "Gerenciar materiais".

## Validação
Abrir a Campanha de Natal em 1280px e 390px, conferir as 22 peças, alternar Feed/Stories, baixar uma de cada tamanho.

## Detalhes técnicos
- Nova seção `prime` em `src/natal/central` (tipo `Secao`, prefixo `PRIME-NN-nome-feed|story` em `lerNomeArquivo`), bloco `ColecaoPrime` em `AbasArquivos.tsx`.
- Upload para o bucket `campanha-natal/prime/` e linhas em `natal_materiais` (sem migration de estrutura; só dados).
- Tudo dentro de `src/natal/` (removível junto com o tema).
