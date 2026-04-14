

# Plano: Aba "WhatsApp" no modal do lead

## Arquivo novo

`src/components/pipeline/LeadWhatsAppTab.tsx`

Componente que recebe `leadId`, `telefone` e `corretorId` como props.

### Lógica interna

1. **Ao montar**: duas queries paralelas via Supabase client:
   - `whatsapp_mensagens` WHERE `lead_id = leadId` ORDER BY `timestamp DESC` LIMIT 3 (+ count total)
   - `whatsapp_instancias` WHERE `corretor_id = corretorId` AND `status = 'connected'` LIMIT 1

2. **Renderização condicional**:
   - Sem telefone → aviso "Lead sem telefone cadastrado"
   - Sem instância conectada → card com botão "Conectar WhatsApp" → `navigate("/configuracoes/whatsapp")`
   - Sem histórico (ESTADO A) → ícone 💬, título, subtítulo, botão "Iniciar conversa" que chama `supabase.functions.invoke("whatsapp-send", { body: { telefone, mensagem: "" } })` e insere registro em `whatsapp_mensagens`
   - Com histórico (ESTADO B) → banner verde com contagem + "Última: há Xmin", últimas 3 mensagens em mini-balões (sent à direita azul, received à esquerda cinza), botão "Abrir conversa completa" → `navigate("/whatsapp?lead={leadId}")`

## Arquivo editado

`src/components/pipeline/PipelineLeadDetail.tsx`

1. **Import**: adicionar `LeadWhatsAppTab`
2. **TabsTrigger**: adicionar após a aba "HOMI":
   ```tsx
   <TabsTrigger value="whatsapp" className="text-xs h-6 ...">
     💬 WhatsApp
   </TabsTrigger>
   ```
3. **TabsContent**: adicionar após o TabsContent de "homi":
   ```tsx
   <TabsContent value="whatsapp" className="mt-0">
     <LeadWhatsAppTab leadId={lead.id} telefone={lead.telefone} />
   </TabsContent>
   ```

## O que NÃO será alterado

- Nenhum hook, query ou componente existente
- Nenhuma outra aba do modal
- Nenhuma edge function ou tabela

## Entrega

| Arquivo | Ação |
|---|---|
| `src/components/pipeline/LeadWhatsAppTab.tsx` | Criar |
| `src/components/pipeline/PipelineLeadDetail.tsx` | Editar (3 pontos: import + trigger + content) |

