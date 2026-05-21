## Conferência do fluxo (estado real no banco agora)

Os 4 leads do disparo Átrio passaram pelo fluxo completo:

| Lead | Stage | Tipo | Arquivado | Aceite | motivo_descarte | Corretor |
|---|---|---|---|---|---|---|
| Laura Heck | Novo Lead | novo_lead | false | aceito | null | Eliézer Clós |
| Janaina Beck | Novo Lead | novo_lead | false | aceito | null | Rafaela Sandin |
| Marcello | Novo Lead | novo_lead | false | aceito | null | Rafaela Sandin |
| Andréa | Novo Lead | novo_lead | false | aceito | null | William Brizola |

Cada etapa do fluxo verificada:
1. **Reengajamento (campanha-atrio-processar-resposta)**: respostas registradas em `campanha_atrio_respostas` com `enviado_para_roleta=true`.
2. **Recategorização + liberação**: `empreendimento` setado para `Átrio - ABF`, vínculo antigo limpo quando estava em Descarte.
3. **Roleta (distribute-lead)**: `distribuir_lead_atomico` rodou, `corretor_id` populado, `aceite_status=aguardando_aceite`, `stage_id=Novo Lead`, `motivo_descarte=null`, `arquivado=false` (saneamento aplicado).
4. **Aceite do corretor**: todos os 4 com `aceite_status=aceito` e `distribuido_em` registrado.
5. **Pipeline (usePipeline.ts)**: `shouldHideLeadFromPipeline` agora esconde apenas se `stage_id ∈ discardStageIds`. Como os 4 estão em `novo_lead`, aparecem normalmente para o corretor atribuído e para o CEO.

**Conclusão: o fluxo está funcionando ponta-a-ponta.** Hard reload (Ctrl+Shift+R) no pipeline mostra os 4 leads.

---

## Observação (não-bloqueante)

Andréa (`cf4e6822`) recebeu duas respostas em sequência com 24s de diferença (22:55:48 `sim` → corretor X; 22:56:12 `texto_livre` → corretor William). A idempotência de 4h **não disparou** porque o `UPDATE enviado_para_roleta=true` da primeira resposta ainda não havia sido commitado quando a segunda chegou (race condition em respostas <30s).

Resultado prático: corretor inicial perdeu o lead para William. Não é crítico (lead foi aceito), mas pode confundir o corretor original.

### Ajuste opcional (se você quiser eliminar o race)
Mudar a checagem de idempotência em `campanha-atrio-processar-resposta` para consultar diretamente `pipeline_leads.distribuido_em >= now()-4h AND aceite_status IN ('aguardando_aceite','aceito')` **antes** de chamar `distributeLeadDirect`, em vez de depender do flag `enviado_para_roleta` da tabela de respostas (que tem latência de atualização).

Sem nenhum outro ajuste, o fluxo está correto e os 4 leads estão visíveis no pipeline.