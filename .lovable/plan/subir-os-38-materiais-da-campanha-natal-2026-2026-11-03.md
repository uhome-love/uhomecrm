# Subir os 38 materiais da Campanha Natal 2026

O pacote tem 38 arquivos, todos com nome no padrão e abaixo de 25 MB:
- 10 Cards (CARD-00 a 09), 8 Disparos (DISP-01 a 08), 6 Instagram (INSTA-1 a 6)
- 2 Molduras (MOLD-1, 2), 8 Fotos (FOTO-01 a 08), 4 PDFs (PDF-1 a 4)

## O que vou fazer
1. Enviar os 38 arquivos para o armazenamento privado da campanha, com os nomes originais.
2. Registrar cada um na lista de materiais da página (seção, ordem, nome, ativo), igual ao que o "Gerenciar materiais" faria. Se um arquivo com o mesmo nome já existir, ele é substituído, sem duplicar.
3. Conferir na página Campanha Natal 2026, como corretora: abas Cards, Disparos, Instagram e PDFs mostrando os arquivos, com Baixar/Compartilhar funcionando.

## O que não muda
Nenhum texto, regra, meta ou outra tela. Os arquivos continuam sendo apagados sozinhos em 27/12.

## Detalhes técnicos
- Upload via storage para o bucket `campanha-natal`; inserção em `natal_materiais` por consulta de dados (sem migration).
- Seção/ordem derivadas por `lerNomeArquivo`.
