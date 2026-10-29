# Parceria antiga "grudando" em lead que voltou

## O que aconteceu (confirmado no banco)
- Vicenzo Rimolo entrou em março com o **Guilherme Dias**.
- Em 30/04 o Guilherme abriu parceria com a **Rafaela Sandin** (ainda marcada como ativa).
- Em 27/10 o lead voltou (Open Arvoredo) e foi para o **Marcos Aurelio**.
- A parceria antiga não foi encerrada, então o card mostra "c/ Rafaela" mesmo com nenhum dos dois sendo o corretor atual.
- Hoje existem **23 leads** na mesma situação (parceria ativa onde nem o dono nem o parceiro é o corretor atual).

## Correção
1. **Daqui pra frente:** sempre que o lead trocar de corretor (reentrada, roleta, repasse, bolsão), as parcerias ativas em que o novo corretor não participa são encerradas automaticamente, com registro no histórico do lead ("Parceria encerrada: lead mudou de corretor").
2. **Limpeza dos 23:** encerrar essas parcerias antigas (não apagar), deixando registro. Antes, envio a lista para você conferir.
3. **Visitas antigas da Roleta:** visitas já feitas na época da parceria continuam contando 0,5 para cada lado — o encerramento vale só a partir da data em que o lead trocou de dono.

## Detalhes técnicos
- Trigger AFTER UPDATE OF corretor_id em `pipeline_leads` (SECURITY DEFINER, respeita a regra de que só admin desfaz parceria manualmente): `update pipeline_parcerias set status='encerrada', encerrada_em=now()` onde principal e parceiro ≠ novo corretor_id; insere anotação em `pipeline_historico`.
- Conferir se `roleta_visitas_realizadas_periodo` filtra parceria por `status='ativa'`; se sim, passar a considerar parceria vigente na data da visita (criada antes e não encerrada antes), para não tirar meio ponto retroativo.
- Card/selo "c/ Parceiro" já passa a sumir porque só lê parcerias ativas.
- Teste: lead de teste com parceria → trocar corretor → parceria encerrada, selo some; trocar para o próprio parceiro → parceria mantida.
