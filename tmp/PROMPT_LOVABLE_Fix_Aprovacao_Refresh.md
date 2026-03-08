# PROMPT LOVABLE — Fix Aprovação da Roleta não Atualiza

## PROBLEMA
No Dashboard CEO, ao clicar "Aprovar" no credenciamento pendente de um corretor (Roleta — Aprovações Pendentes), o status é atualizado no banco mas o card do corretor continua aparecendo na tela. Deveria sumir imediatamente após aprovação.

## CORREÇÃO

Após clicar em "Aprovar" e a query de UPDATE ter sucesso:

1. **Refazer a query** de aprovações pendentes (refetch/invalidate) para atualizar a lista
2. **Remover o card** do corretor aprovado da lista imediatamente (optimistic update)
3. **Atualizar o badge** do contador de pendentes (o badge "1" na sidebar e no card deve decrementar)
4. **Se não tiver mais pendentes**: esconder o card "Roleta — Aprovações Pendentes" inteiro (ou mostrar "✅ Nenhuma aprovação pendente")
5. **Mostrar toast** de confirmação: "✅ Rafaela Campos aprovada na Roleta!"

### Implementação sugerida:
```typescript
const aprovarCredenciamento = async (credenciamentoId: string) => {
  const { error } = await supabase
    .from('roleta_credenciamentos')
    .update({ 
      status: 'aprovado', 
      aprovado_por: userId, // CEO logado
      aprovado_em: new Date().toISOString() 
    })
    .eq('id', credenciamentoId);

  if (!error) {
    // Invalidar query para refetch
    queryClient.invalidateQueries(['roleta-pendentes']);
    // OU remover do state local imediatamente
    toast.success('✅ Corretor aprovado na Roleta!');
  }
};
```

## ⚠️ NÃO ALTERAR
- A lógica de aprovação (UPDATE está funcionando)
- O visual do card de aprovação
- O restante do Dashboard CEO
