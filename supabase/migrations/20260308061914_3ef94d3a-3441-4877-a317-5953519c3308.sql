
-- Templates de comunicação
CREATE TABLE IF NOT EXISTS comunicacao_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo TEXT NOT NULL,
  tipo TEXT NOT NULL,
  canal TEXT NOT NULL,
  empreendimento TEXT,
  campanha TEXT,
  conteudo TEXT NOT NULL,
  variaveis JSONB DEFAULT '[]',
  criado_por UUID,
  visivel_para TEXT DEFAULT 'todos',
  ativo BOOLEAN DEFAULT true,
  uso_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE comunicacao_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read active templates"
  ON comunicacao_templates FOR SELECT TO authenticated
  USING (ativo = true);

CREATE POLICY "Admins and gestors can manage templates"
  ON comunicacao_templates FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'gestor'))
  );

-- Histórico de uso
CREATE TABLE IF NOT EXISTS comunicacao_historico (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id UUID REFERENCES comunicacao_templates(id),
  lead_id UUID,
  corretor_id UUID,
  canal TEXT NOT NULL,
  mensagem_enviada TEXT,
  personalizado_homi BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE comunicacao_historico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own history"
  ON comunicacao_historico FOR SELECT TO authenticated
  USING (corretor_id = auth.uid());

CREATE POLICY "Users can insert own history"
  ON comunicacao_historico FOR INSERT TO authenticated
  WITH CHECK (corretor_id = auth.uid());

-- Seed templates
INSERT INTO comunicacao_templates (titulo, tipo, canal, conteudo, variaveis) VALUES
('Contato Inicial WhatsApp', 'contato_inicial', 'whatsapp',
'Olá, {{nome}}! 😊
Aqui é {{corretor}}, da Uhome Negócios Imobiliários.
Vi que você se interessou pelo *{{empreendimento}}* — uma oportunidade incrível que tenho certeza que vai te surpreender!
Tenho informações atualizadas sobre valores e condições especiais. Posso te contar em 2 minutinhos?
Quando seria um bom momento? 🏠',
'["{{nome}}", "{{corretor}}", "{{empreendimento}}"]'),

('Script Contato Inicial', 'contato_inicial', 'ligacao',
'ABERTURA:
"Olá, {{nome}}! Tudo bem? Aqui é {{corretor}}, da Uhome. Você se interessou pelo {{empreendimento}}, correto? Tenho novidades sobre valores e condições — posso falar 2 minutos com você agora?"

SE SIM:
Apresentar: localização, diferenciais, faixa de valor
CTA: "Que tal conhecer pessoalmente? Posso agendar uma visita sem compromisso essa semana."

SE OCUPADO:
"Sem problema! Quando posso te ligar? Amanhã de manhã ou à tarde funciona melhor?"

SE NÃO LEMBRA:
"Você demonstrou interesse pelo {{empreendimento}}, um empreendimento [bairro/cidade]. Tenho 2 minutos para apresentar os destaques?"',
'["{{nome}}", "{{corretor}}", "{{empreendimento}}"]'),

('Follow Up - Não Atendeu', 'follow_up_ligacao', 'whatsapp',
'Olá, {{nome}}! 👋
Tentei falar com você sobre o *{{empreendimento}}* mas não consegui te pegar.
Sem pressão — só queria compartilhar algumas informações que podem ser do seu interesse.
Quando tiver um momento, é só responder aqui! 😊
{{corretor}} | Uhome',
'["{{nome}}", "{{corretor}}", "{{empreendimento}}"]'),

('Follow Up Pós-Visita', 'follow_up_visita', 'whatsapp',
'Olá, {{nome}}! 😊
Foi muito bom te receber no {{empreendimento}} hoje!
Conforme conversamos, estou preparando as condições especiais para você. Te mando ainda hoje.
Ficou com alguma dúvida sobre o apartamento? Pode falar à vontade! 🏠
{{corretor}} | Uhome',
'["{{nome}}", "{{corretor}}", "{{empreendimento}}"]'),

('Script Follow Up Visita', 'follow_up_visita', 'ligacao',
'ABERTURA:
"{{nome}}, oi! Aqui é {{corretor}}, da Uhome. Estou ligando para saber o que achou da visita ao {{empreendimento}}!"

PERGUNTAS CHAVE:
- "O que mais te chamou atenção?"
- "Você consegue se imaginar morando lá?"
- "Tem alguma dúvida sobre valores ou condições?"

SE POSITIVO:
"Ótimo! Vou preparar uma proposta personalizada para você. Posso enviar ainda hoje?"

SE HESITANTE:
"Entendo. O que faria você se sentir mais confortável em avançar?"',
'["{{nome}}", "{{corretor}}", "{{empreendimento}}"]'),

('Envio de Proposta', 'proposta', 'whatsapp',
'Olá, {{nome}}! 📋
Conforme combinado, aqui está a proposta personalizada para o *{{empreendimento}}*:
✅ Unidade selecionada para você
💰 Condições especiais de pagamento
📅 Prazo de validade: 48 horas
Vou te ligar em breve para tirar qualquer dúvida!
Qualquer coisa, estou à disposição. 😊
{{corretor}} | Uhome',
'["{{nome}}", "{{corretor}}", "{{empreendimento}}"]'),

('Melnick Day - Contato', 'campanha', 'whatsapp',
'Olá, {{nome}}! 🎉
Tenho uma novidade IMPERDÍVEL para te contar!
O *Melnick Day* está chegando — o maior evento de vendas da Melnick com condições EXCLUSIVAS e que só acontecem uma vez por ano!
São oportunidades únicas no {{empreendimento}} com:
🔥 Condições especiais de entrada
🔥 Descontos exclusivos do evento
🔥 Bônus surpresa no dia
Você topa conhecer as ofertas antes de todo mundo?
{{corretor}} | Uhome 🏠',
'["{{nome}}", "{{corretor}}", "{{empreendimento}}"]'),

('Reengajamento - Lead Frio', 'reengajamento', 'whatsapp',
'Oi, {{nome}}! Tudo bem? 😊
Faz um tempo que não conversamos sobre o *{{empreendimento}}* e queria dar um oi!
O mercado imobiliário está aquecido e surgiram condições que não existiam antes — especialmente para quem estava em dúvida.
Valeria 5 minutos para eu te contar as novidades? Prometo que vai valer a pena! 🏠
{{corretor}} | Uhome',
'["{{nome}}", "{{corretor}}", "{{empreendimento}}"]'),

('Pós-Venda - Parabéns', 'pos_venda', 'whatsapp',
'{{nome}}, PARABÉNS! 🎉🏠
É com muita alegria que celebro essa conquista com você! Seu novo lar no *{{empreendimento}}* é mais que um imóvel — é um sonho realizado!
Foi um prazer enorme te acompanhar nessa jornada.
Conte comigo sempre que precisar!
Um abraço,
{{corretor}} | Uhome 💙',
'["{{nome}}", "{{corretor}}", "{{empreendimento}}"]'),

('Pedido de Indicação', 'pos_venda', 'whatsapp',
'Oi, {{nome}}! Tudo bem com você? 😊
Fico feliz em saber que está gostando do *{{empreendimento}}*!
Se você conhece alguém que também está pensando em realizar o sonho da casa própria ou investir em imóveis, eu adoraria ajudar!
Com o mesmo cuidado e atenção que tive com você. 💙
{{corretor}} | Uhome',
'["{{nome}}", "{{corretor}}", "{{empreendimento}}"]');
