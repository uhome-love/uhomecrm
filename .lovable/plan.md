
# Gerador de Instrumento de Intermediação Imobiliária

Nova página `/intermediacao` (visível só para **admin** e **gestor**) com um formulário que gera o `.docx` do Instrumento Particular de Intermediação Imobiliária da Uhome, replicando exatamente o modelo enviado (Átrio 1107).

## Arquivos afetados (checklist)
- ✅ `src/pages/IntermediacaoPage.tsx` — **novo**
- ✅ `src/config/pageRegistry.ts` — só adicionar entrada (`PAGE_COMPONENTS` + `ROUTE_TO_TAB`)
- ✅ `src/components/layout/Sidebar.tsx` — só adicionar item no grupo Vendas (admin e gestor)
- ✅ `supabase/functions/gerar-intermediacao/index.ts` — **novo**

Nenhum outro arquivo, rota, hook, query ou token de cor é alterado.

## Observação (RG dos corretores)
`profiles` tem `cpf`, `creci`, `email`, mas **não tem RG**. Ao selecionar um corretor, auto-preenche **CPF e e-mail**; o **RG fica como campo editável**. Sem alteração de schema.

## 1. Frontend — `src/pages/IntermediacaoPage.tsx`
shadcn/ui (Card, Input, Select, Button, Table), destaque `#4F46E5`.

**Comprador (CONTRATANTE)**
- Tipo: PF | PJ
- PJ: Razão Social, CNPJ, sócio-administrador
- PF: nome completo, gênero, profissão, estado civil (+ regime de bens se casado)
- Comuns: CPF, RG, telefone, e-mail, endereço completo

**Imóvel:** Empreendimento (texto livre), Unidade, VGV

**Corretores**
- Corretor 1 e 2 (opcional): busca por nome entre `user_roles` (role `corretor`) join `profiles`; auto-preenche CPF/e-mail, RG editável
- Percentual de cada corretor (%)

**Comissão**
- Valor total da corretagem
- % Gabrielle (15% padrão), % Diretoria (10% padrão), % UHome = 100% − soma (read-only)
- Parcelas: "Adicionar parcela" (data de vencimento + **valor fixo da parcela**), mín. 1, sem limite

**Data do contrato** (padrão hoje)

**Preview em tempo real** (mesma função de cálculo da edge function):
- Total por credor = % × valor total
- Por parcela = round2(% × valorParcela); última parcela do credor absorve diferença
- Linha Total por coluna
- Tabela 2.1 ZemoBank = soma de todos menos UHome

**Gerar Intermediação** → POST edge function → recebe base64 → download `intermediacao_[SOBRENOME]_[EMPREENDIMENTO]_[UNIDADE]_UHome.docx` → toast.

## 2. Roteamento e sidebar
- `pageRegistry.ts`: `intermediacao` em `PAGE_COMPONENTS`; `ROUTE_TO_TAB["/intermediacao"]` com `roles: ["admin","gestor"]`, ícone `FileSignature`.
- `Sidebar.tsx`: item "Intermediação" no grupo **Vendas** de admin e gestor.

## 3. Edge Function — `supabase/functions/gerar-intermediacao/index.ts`
- CORS + OPTIONS; valida JWT em código + `has_role(auth.uid(),'admin')` ou `'gestor'`.
- Body validado com Zod.
- Lib `docx` (npm) monta o documento.

### Logo (base64 inline)
- A logo fica embutida como constante no topo do `index.ts`:
  `const LOGO_BASE64 = "..."` — gerada de `public/images/uhome-logo-128.png` (PNG ~11 KB / base64 ~15 KB) com `base64 -w0 public/images/uhome-logo-128.png`.
- Inserida no cabeçalho via `ImageRun` (PNG) centralizada.
- Fallback: se a constante estiver vazia, texto **"UHome."** negrito centralizado + `// TODO: substituir por ImageRun com logo real`.

### Estrutura (ordem exata do modelo)
1. Cabeçalho com logo
2. Título: INSTRUMENTO PARTICULAR DE INTERMEDIAÇÃO IMOBILIÁRIA
3. Qualificação CONTRATANTE(S) — PF ou PJ
4. CONTRATADOS: corretor(es) + GABRIELLE RODRIGUES + UHOME (rep. por LUCAS)
5. Cláusula 1 — objeto (EMPREENDIMENTO / UNIDADE / VGV)
6. Cláusula 2 — tabela por credor com N colunas de parcelas (corretores, Diretoria, UHome, Total)
7. Cláusula 2.1 — tabela ZemoBank (sem linha UHome)
8. Cláusulas 2.2 a 8 — texto jurídico fixo verbatim (mora/IPCA, vencimento antecipado/título executivo, recibos/NF, irrevogabilidade, LGPD 7–7.8, foro Porto Alegre, assinatura digital MP 2.200-2)
9. "Porto Alegre, [data por extenso]."
10. Assinaturas: CONTRATANTE(S) → corretor(es) → DIRETORIA: GABRIELLE RODRIGUES → IMOBILIÁRIA UHOME
11. Testemunhas: Gabriel Vieira (gabriel.uhome@gmail.com) + Carolina de Camargo Madruga (carolina@uhome.com.br)

Retorna `{ filename, base64 }`.

### Dados fixos (hardcoded)
- Uhome CNPJ 37.900.790/0001-71 · CRECI 25.682J
- Lucas: CPF 863.851.860-91 · RG 9098653034 · CRECI 58516 · lucas@uhome.imb.br
- Gabrielle: CPF 032.416.160-37 · RG 3098226875 · gabrielle@uhome.imb.br
- Banco corretores: ZemoBank (Pix ou Boleto) · Banco Uhome: UHome (Pix ou Boleto)

## Cálculo por parcela (valor fixo, não proporcional)
- `totalCredor = round2(pct × valorTotalCorretagem)`
- Cada parcela P: `valorCredorP = round2(pct × valorP)`
- Última parcela do credor: `totalCredor − soma(parcelas anteriores)`
- Total por coluna = soma das linhas
- ZemoBank = corretores + Diretoria (exclui UHome)
- Moeda pt-BR `R$ #.###,##`; datas `dd/mm/aa`

## Restrições respeitadas
- Nenhuma rota/hook/query/cor/componente existente alterado
- Sem enum `ceo`; admin via `has_role(..., 'admin')`
- Sidebar apenas admin e gestor
