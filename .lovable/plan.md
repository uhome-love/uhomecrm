# Aviso de novo lead: canal separado do WhatsApp de clientes

O template `novo_leaduhome` foi aprovado pela Meta. Agora o aviso de novo lead (interno, para corretores) precisa parar de usar o WhatsApp de nutrição — esse número fala com clientes e não deve ser usado para recados internos.

## Situação atual

- O aviso de novo lead tenta enviar pelo template da Meta.
- Se falhar, hoje ele cai para a instância de nutrição (`uhome-nutricao`), lida hoje da configuração de reengajamento — que é o número usado para clientes.
- A tabela de instâncias de WhatsApp do CRM está vazia, ou seja, não existe nenhuma instância interna cadastrada hoje.

## O que muda

1. **Remover o número de nutrição do fluxo de avisos internos.** O aviso de novo lead nunca mais usa a instância de clientes.
2. **Criar um canal próprio de avisos internos**, configurável, guardado numa chave dedicada (`avisos_internos_evolution_instance`) na tabela de flags do sistema.
   - Enquanto essa chave estiver vazia, o aviso usa apenas os canais oficiais da Meta (template aprovado e, em último caso, texto livre dentro da janela de 24h).
   - Quando você cadastrar uma instância interna, ela passa a ser o fallback — sem nunca tocar no número de clientes.
3. **Registro de saúde separado:** os eventos do aviso de novo lead passam a marcar canal `meta`, `meta_text` ou `avisos_internos`, para o painel de saúde não misturar com disparos de cliente.

## Detalhes técnicos

- `supabase/functions/whatsapp-notificacao/index.ts`:
  - remover a leitura de `reengajamento_config.evolution_instance`;
  - ler a instância de avisos internos de `system_flags` (chave `avisos_internos_evolution_instance`); se ausente/vazia, pular o passo Evolution;
  - manter a ordem: template Meta aprovado → (instância interna, se configurada) → texto livre Meta;
  - ajustar os `ops_events` para o novo nome de canal.
- Migration mínima: inserir a flag `avisos_internos_evolution_instance` com valor vazio (documenta o ponto de configuração; nenhuma tabela nova).
- Nada muda em reengajamento, nutrição ou campanhas.

## Validação

- Disparo de teste do aviso de novo lead: deve sair pelo template `novo_leaduhome` (canal `meta`).
- Simular falha do template: com a flag vazia, deve cair direto para texto livre Meta e **nunca** para o número de nutrição.
- Conferir em `ops_events` que o canal registrado não é mais `evolution`/nutrição.
