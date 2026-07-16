
# Ajustar critério de "Em risco" no PDN — considerar Observações preenchidas

## O problema

Hoje o cálculo (`src/hooks/usePdn.ts:472`) é:

```
emRisco = !caiu && (riscoManual || (grupoBase !== "ganho" && !proximaAcao && dias > 7))
```

Só olha o campo **"Próxima ação"**. Mas a planilha do PDN tem duas colunas de texto que o gestor edita: **"Próxima ação"** e **"Observações"**. Quando o gestor escreve na coluna Observações (que é onde a maioria escreve, como no print — "aguardando docs", "pai faleceu, tocando esse cliente", etc.), o sistema ainda marca o card como amarelo/risco. Isso está errado: preencher Observações **é** um sinal de que o negócio foi tocado.

## Ajuste proposto

Uma linha só é "Em risco" quando:

1. Não caiu, não é Ganho
2. Está parada há mais de 7 dias no pipeline
3. **E** não tem nada preenchido no PDN da semana: sem Próxima ação, sem Observações, e sem edição manual no override nos últimos 7 dias
4. (Ou o gestor marcou Risco manualmente — isso continua valendo sempre)

Fórmula nova:

```ts
const foiEditadoRecente = ov?.updated_at
  && diffDays(ov.updated_at) <= 7;

const temSinalDeAtualizacao =
  !!proximaAcao || !!observacoes || foiEditadoRecente;

const emRisco = !caiu && (
  riscoManual ||
  (grupoBase !== "ganho" && !temSinalDeAtualizacao && dias > 7)
);
```

## O que muda na prática

- Linha com Observações preenchida → **sai** do amarelo. 
- Linha sem nada preenchido e parada > 7d → continua amarela (é o caso legítimo).
- Card marcado manualmente com "Risco" pelo gestor → continua amarelo (comportamento intencional).
- Ganho e Caído → nunca ficam amarelos (sem mudança).

No print do usuário, todas as 5 linhas mostradas (Arthur, Rodrigo Maués, Larissa, Js_sports, Louie) têm Observações preenchidas → todas saem do amarelo depois do ajuste.

## Arquivos a mexer

Só um: `src/hooks/usePdn.ts`, na função que monta cada `PdnRow` (linhas ~468–472). Preciso ler `observacoes` e `ov?.updated_at` (já existem no scope) e usar na fórmula. Não mexo em UI nem em banco.

## O que NÃO faço

- Não mudo o critério de 7 dias (`dias > 7`) — só o usuário pediu para reconhecer Observações, não afrouxar o limite.
- Não removo o toggle de risco manual.
- Não altero a lógica de contagem "Em risco" do resumo (ela deriva do mesmo campo, então já pega o ajuste de graça).
- Não altero o PdnKanban / PdnCardDrawer — eles só leem `r.emRisco`.

## Risco

Zero — o único efeito colateral é o KPI "Em risco" cair (menos falsos positivos), que é justamente o objetivo.
