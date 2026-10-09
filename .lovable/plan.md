# Padronizar o nome do arquivo da Intermediação

## Como fica
Hoje: `intermediacao_JoaoSilva_OpenBosque_A302_UHome.docx`

Novo padrão:
```text
Intermediação - João Silva, Unidade 302, Open Bosque - Corretor Douglas Costa e Gerente Junior Padilha.docx
```
- Cliente: nome completo do comprador (PJ: razão social; 2+ compradores: "João Silva e Maria Souza").
- Corretor: o corretor principal; se houver 2, "Corretores Douglas Costa e Pedro Jorge".
- Gerente: gerente da equipe do corretor principal. Se não for encontrado, o trecho "e Gerente ..." é omitido.
- Mantém acentos e espaços; remove só caracteres proibidos em nome de arquivo (/ \ : * ? " < > |). Limite de ~180 caracteres.

## O que não muda
Conteúdo do contrato, permissões e histórico. Documentos antigos mantêm o nome antigo.

## Detalhes técnicos
- Só na função `gerar-intermediacao`: nova montagem do `filename`.
- Gerente: localizar o corretor em `profiles` pelo e-mail (fallback nome), depois `team_members` → gerente → nome em `profiles`.
- Nome guardado no Storage continua com prefixo do id, usando versão sem acentos para evitar erro de caminho; o download usa o nome bonito.
- Deploy da função e teste gerando 1 documento de teste (sem salvar dado real).
