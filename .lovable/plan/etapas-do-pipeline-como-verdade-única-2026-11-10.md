# Etapas do Pipeline como verdade única

## O que existe hoje (conferido no banco)
O Pipeline tem 10 etapas ativas, nesta ordem:

```text
Novo Lead → Sem Contato → Qualificação → Aquecimento → Visita → Pós-Visita → Documentação → Proposta → Contrato → Ganho
```
Fora do quadro: Descarte (botão). "Caiu" está desligada.

## O problema
As regras guardadas do projeto, o documento do CRM, os resumos da IA (HOMI CEO e HOMI Gerente) e alguns textos ainda falam em "7 etapas" e "Em Negociação", que não existe mais. Isso faz a IA e quem lê o documento enxergarem um quadro diferente do real.

## O que vou fazer
1. **Regras do projeto:** trocar a descrição antiga das etapas pela lista acima (10 etapas, Ganho como etapa final), com as subetapas de cada uma.
2. **Documento do CRM:** gerar a versão 2 com a seção do Pipeline corrigida (o original fica guardado).
3. **Resumos da IA:** HOMI CEO e HOMI Gerente passam a contar negócios por Documentação, Proposta, Contrato e Ganho, lendo do Pipeline (mesma régua dos painéis), em vez de "Em Negociação".
4. **Textos na tela:** onde aparecer "Em Negociação", passa a aparecer "Proposta". Nomes antigos continuam reconhecidos por trás, para nenhum lead antigo sumir.
5. **Teste:** um teste que confere a ordem das 10 etapas e que nenhuma tela mostra "Em Negociação".

Não muda: nenhuma regra de mudança de etapa, distribuição, contagem de vendas ou permissões.

## Ponto para você decidir
A etapa **Proposta** ainda tem a subetapa "Documentação enviada", herdada de quando Documentação ficava dentro dela. Proponho tirar essa opção de Proposta, já que Documentação agora é etapa própria. Os leads que já estão marcados com ela continuam aparecendo normalmente.

## Detalhes técnicos
- Fonte: `pipeline_stages` (tipos novo_lead, sem_contato, qualificacao, aquecimento, visita, pos_visita, documentacao, proposta, contrato_gerado, venda).
- Atualizar `mem://index.md` (Core) e `mem://features/pipeline/negocio-como-etapas-pipeline`.
- `homi-ceo` e `homi-gerencial`: trocar contagem por `pdn.fase` por `v_negocios_pipeline` + `negocioEtapa.ts`; redeploy das duas.
- Rótulos: `celebrations.ts`, `stageToCategoria.ts`, comentários em `leadHelpers.ts`; aliases "Em Negociação" mantidos só como compatibilidade.
- `_legacy/useGerenteDashboard.ts` não é usado; fica como está.
- Novo arquivo `/mnt/documents/CRM_UhomeSales_Documentacao_Completa_v2.md`.
