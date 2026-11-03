// Campanha Natal 2026 · conteúdo da campanha Natal Chave de Ouro (Uhome 2026)
// TEMPORÁRIO: some do menu em 19/12/2026 e é apagado junto com src/natal/ depois de 26/12/2026.
// Textos aprovados pelo Lucas. Não reescrever nem "melhorar" os textos: só exibir.
// Nos scripts, o que está entre [colchetes] o corretor troca antes de mandar.

export const CAMPANHA = {
  "nome": "Campanha Natal 2026",
  "inicio": "2026-11-01",
  "fim": "2026-12-18",
  "centralSaiDoAr": "2026-12-19",
  "arquivosApagados": "2026-12-27",
  "missao": {
    "meta": 100000000,
    "vgvEm0211": 68000000,
    "texto": "R$ 100 milhões em VGV em 2026. Em 02/11 estávamos em R$ 68 milhões: faltam R$ 32 milhões até 18/12."
  },
  "metaCorretorMinima": 1000000,
  "metaEquipe": 10000000,
  "conta": {
    "visitasPorVenda": 10,
    "vendaMedia": 650000,
    "frase": "10 visitas realizadas = 1 venda",
    "caminhos": [
      {
        "titulo": "1 venda de alto padrão",
        "visitas": "~10 visitas realizadas",
        "exemplos": "Boa Vista Country Club ou Golden Lake"
      },
      {
        "titulo": "2 vendas de casas",
        "visitas": "~20 visitas realizadas",
        "exemplos": "Casa Tua Porto Alegre e Casa Tua Canoas"
      },
      {
        "titulo": "3 vendas de entrada",
        "visitas": "~30 visitas realizadas",
        "exemplos": "Open Arvoredo, Open Bosque, Skyglass ou Essence: 3 Open Arvoredo já fazem R$ 1 milhão"
      }
    ],
    "rotina": "3 visitas realizadas por semana. Para realizar 3, agende 6: metade dos clientes falta."
  }
} as const;

export const PREMIOS = [
  {
    "quem": "Cliente",
    "titulo": "Urna Premiada",
    "texto": "Assinou até 18/12, pagou, ganhou: o cliente tira 1 cartão da urna, com 30 presentes de Natal."
  },
  {
    "quem": "Corretor",
    "titulo": "Fez R$ 1 milhão",
    "texto": "2 diárias no Rosa ou em Capão, com acompanhante e gasolina ou ônibus."
  },
  {
    "quem": "Gerente",
    "titulo": "Equipe fez R$ 10 milhões",
    "texto": "2 diárias no Rosa com acompanhante, com as mesmas regras dos corretores."
  },
  {
    "quem": "Toda semana",
    "titulo": "Prêmio surpresa",
    "texto": "Para quem mais realizar visitas de segunda a domingo. O resultado sai toda segunda, no Placar de Natal."
  },
  {
    "quem": "Uhome",
    "titulo": "Bateu R$ 100 milhões",
    "texto": "Festa Chave de Ouro no Quintal dos Belgas, com a família de todo mundo, sorteios e surpresas."
  }
];

export const REGRAS = [
  {
    "titulo": "A comissão entrou, o prêmio é liberado.",
    "texto": "Venda assinada e comissão recebida pela Uhome."
  },
  {
    "titulo": "A data é definida pela empresa.",
    "texto": "A Uhome agenda a hospedagem e avisa com antecedência."
  },
  {
    "titulo": "Quer levar mais alguém? Fica por sua conta.",
    "texto": "O prêmio cobre você e um acompanhante."
  },
  {
    "titulo": "Não pode ir? Perde a diária.",
    "texto": "O prêmio não vira dinheiro nem passa para outra pessoa."
  },
  {
    "titulo": "Conta o VGV assinado de 01/11 a 18/12 no Uhome Sales.",
    "texto": "Venda em parceria: o VGV é dividido conforme a participação de cada corretor."
  }
];

export const URNA = [
  {
    "nivel": "Estrela",
    "estrelas": 1,
    "faixa": "R$ 100 a R$ 200",
    "cartoes": 21,
    "itens": [
      {
        "nome": "Vinho com saca-rolhas",
        "qtd": 5
      },
      {
        "nome": "Panetone trufado + espumante",
        "qtd": 4
      },
      {
        "nome": "Kit de facas de churrasco",
        "qtd": 4
      },
      {
        "nome": "Copo térmico",
        "qtd": 4
      },
      {
        "nome": "Kit Casa Nova",
        "qtd": 4
      }
    ]
  },
  {
    "nivel": "Ouro",
    "estrelas": 2,
    "faixa": "R$ 300 a R$ 600",
    "cartoes": 6,
    "itens": [
      {
        "nome": "Alexa",
        "qtd": 2
      },
      {
        "nome": "Air fryer",
        "qtd": 2
      },
      {
        "nome": "Nespresso",
        "qtd": 2
      }
    ]
  },
  {
    "nivel": "Diamante",
    "estrelas": 3,
    "faixa": "R$ 700 a R$ 1.200",
    "cartoes": 3,
    "itens": [
      {
        "nome": "Caixa de som JBL",
        "qtd": 1
      },
      {
        "nome": "Diária em Gramado no Natal Luz",
        "qtd": 1
      },
      {
        "nome": "Cesta de Natal com espumante",
        "qtd": 1
      }
    ]
  }
];

export const SEMANAS = [
  {
    "semana": "S1",
    "inicio": "2026-11-01",
    "fim": "2026-11-08"
  },
  {
    "semana": "S2",
    "inicio": "2026-11-09",
    "fim": "2026-11-15"
  },
  {
    "semana": "S3",
    "inicio": "2026-11-16",
    "fim": "2026-11-22"
  },
  {
    "semana": "S4",
    "inicio": "2026-11-23",
    "fim": "2026-11-29"
  },
  {
    "semana": "S5",
    "inicio": "2026-11-30",
    "fim": "2026-12-06"
  },
  {
    "semana": "S6",
    "inicio": "2026-12-07",
    "fim": "2026-12-13"
  },
  {
    "semana": "S7",
    "inicio": "2026-12-14",
    "fim": "2026-12-18"
  }
];

export const EMPREENDIMENTOS = [
  {
    "nome": "Open Bosque",
    "slug": "Open_Bosque",
    "incorporadora": "Open",
    "local": "",
    "aPartirDe": "R$ 240 mil",
    "linhas": [
      {
        "tipo": "1 dormitório",
        "valor": "R$ 240 mil"
      },
      {
        "tipo": "2 dormitórios sem vaga",
        "valor": "R$ 269 mil"
      },
      {
        "tipo": "2 dormitórios com vaga",
        "valor": "R$ 292 mil"
      }
    ],
    "selos": [
      {
        "texto": "3 dormitórios esgotados",
        "tom": "vermelho"
      }
    ],
    "gancho": "1 dormitório a partir de R$ 240 mil. O 3 dormitórios já esgotou. O melhor é você ver de perto. Fica melhor [dia] às [hora] ou [dia] às [hora]?",
    "legendaDisparo": "🎄 Condição de Natal no Open Bosque: 1 dormitório a partir de R$ 240 mil. O de 3 dormitórios já esgotou.\nQuer que eu te mostre quanto fica a parcela?",
    "arquivos": {
      "foto": "FOTO-01-Open_Bosque",
      "card": "CARD-01-Open_Bosque",
      "disparo": "DISP-01-Open_Bosque"
    }
  },
  {
    "nome": "Essence Canoas",
    "slug": "Essence_Canoas",
    "incorporadora": "Ábaco",
    "local": "",
    "aPartirDe": "R$ 289 mil",
    "linhas": [
      {
        "tipo": "Lotes",
        "valor": "R$ 289 mil"
      }
    ],
    "selos": [
      {
        "texto": "Lote em condomínio clube",
        "tom": "dourado"
      }
    ],
    "gancho": "Lote em condomínio clube em Canoas a partir de R$ 289 mil. O melhor é você ver de perto. Fica melhor [dia] às [hora] ou [dia] às [hora]?",
    "legendaDisparo": "🎄 Lote em condomínio clube em Canoas a partir de R$ 289 mil, no Essence.\nQuer saber quais lotes ainda estão disponíveis?",
    "arquivos": {
      "foto": "FOTO-02-Essence_Canoas",
      "card": "CARD-02-Essence_Canoas",
      "disparo": "DISP-07-Essence_Canoas"
    }
  },
  {
    "nome": "Open Arvoredo",
    "slug": "Open_Arvoredo",
    "incorporadora": "Open",
    "local": "",
    "aPartirDe": "R$ 329 mil",
    "linhas": [
      {
        "tipo": "2 dormitórios com suíte",
        "valor": "R$ 329 mil"
      },
      {
        "tipo": "3 dormitórios com suíte",
        "valor": "R$ 392 mil"
      }
    ],
    "selos": [],
    "gancho": "2 dormitórios com suíte a partir de R$ 329 mil. O melhor é você ver de perto. Fica melhor [dia] às [hora] ou [dia] às [hora]?",
    "legendaDisparo": "🎄 Condição de Natal no Open Arvoredo: 2 dormitórios com suíte a partir de R$ 329 mil.\nQuer que eu te conte como funciona?",
    "arquivos": {
      "foto": "FOTO-03-Open_Arvoredo",
      "card": "CARD-03-Open_Arvoredo",
      "disparo": "DISP-02-Open_Arvoredo"
    }
  },
  {
    "nome": "Skyglass",
    "slug": "Skyglass",
    "incorporadora": "Cyrela",
    "local": "",
    "aPartirDe": "R$ 369 mil",
    "linhas": [],
    "selos": [
      {
        "texto": "ITBI e registro grátis",
        "tom": "dourado"
      },
      {
        "texto": "1 ano de condomínio",
        "tom": "dourado"
      }
    ],
    "gancho": "ITBI e registro grátis e 1 ano de condomínio. O melhor é você ver de perto. Fica melhor [dia] às [hora] ou [dia] às [hora]?",
    "legendaDisparo": "🎄 Natal no Skyglass: ITBI e registro grátis e 1 ano de condomínio.\nQuer saber quais unidades ainda estão disponíveis?",
    "arquivos": {
      "foto": "FOTO-04-Skyglass",
      "card": "CARD-04-Skyglass",
      "disparo": "DISP-03-Skyglass"
    }
  },
  {
    "nome": "Casa Tua Porto Alegre",
    "slug": "Casa_Tua_Porto_Alegre",
    "incorporadora": "Encorp",
    "local": "Alto Petrópolis",
    "aPartirDe": "R$ 520 mil",
    "linhas": [
      {
        "tipo": "2 dormitórios",
        "valor": "R$ 520 mil"
      },
      {
        "tipo": "3 dormitórios",
        "valor": "R$ 610 mil"
      },
      {
        "tipo": "3 dormitórios com terraço",
        "valor": "R$ 750 mil"
      }
    ],
    "selos": [
      {
        "texto": "Desconto no crédito associativo",
        "tom": "dourado"
      }
    ],
    "gancho": "Casa de 3 dormitórios a partir de R$ 610 mil, com desconto no crédito associativo. O melhor é você ver de perto. Fica melhor [dia] às [hora] ou [dia] às [hora]?",
    "legendaDisparo": "🎄 Casa de 3 dormitórios no Casa Tua Porto Alegre a partir de R$ 610 mil, com desconto no crédito associativo.\nQuer que eu te explique o desconto?",
    "arquivos": {
      "foto": "FOTO-05-Casa_Tua_Porto_Alegre",
      "card": "CARD-05-Casa_Tua_Porto_Alegre",
      "disparo": "DISP-05-Casa_Tua_Porto_Alegre"
    }
  },
  {
    "nome": "Casa Tua Canoas",
    "slug": "Casa_Tua_Canoas",
    "incorporadora": "Encorp",
    "local": "Santos Ferreira",
    "aPartirDe": "R$ 735 mil",
    "linhas": [
      {
        "tipo": "3 dormitórios",
        "valor": "R$ 735 mil"
      },
      {
        "tipo": "4 dormitórios",
        "valor": "R$ 879 mil"
      }
    ],
    "selos": [
      {
        "texto": "Desconto no crédito associativo",
        "tom": "dourado"
      }
    ],
    "gancho": "Casa de 3 ou 4 dormitórios em Canoas, com desconto no crédito associativo. O melhor é você ver de perto. Fica melhor [dia] às [hora] ou [dia] às [hora]?",
    "legendaDisparo": "🎄 Casas de 3 ou 4 dormitórios no Casa Tua Canoas, com desconto no crédito associativo.\nQuer que eu te explique como funciona?",
    "arquivos": {
      "foto": "FOTO-06-Casa_Tua_Canoas",
      "card": "CARD-06-Casa_Tua_Canoas",
      "disparo": "DISP-06-Casa_Tua_Canoas"
    }
  },
  {
    "nome": "Boa Vista Country Club",
    "slug": "Boa_Vista",
    "incorporadora": "Cyrela",
    "local": "",
    "aPartirDe": "R$ 849 mil",
    "linhas": [
      {
        "tipo": "2 dormitórios com varanda",
        "valor": "R$ 849 mil"
      },
      {
        "tipo": "3 dormitórios com varanda",
        "valor": "R$ 978 mil"
      }
    ],
    "selos": [],
    "gancho": "2 dormitórios com varanda a partir de R$ 849 mil. O melhor é você ver de perto. Fica melhor [dia] às [hora] ou [dia] às [hora]?",
    "legendaDisparo": "🎄 Condição de Natal no Boa Vista Country Club: 2 dormitórios com varanda a partir de R$ 849 mil.\nQuer conhecer pessoalmente esta semana?",
    "arquivos": {
      "foto": "FOTO-07-Boa_Vista",
      "card": "CARD-07-Boa_Vista_Country_Club",
      "disparo": "DISP-04-Boa_Vista"
    }
  },
  {
    "nome": "Golden Lake",
    "slug": "Golden_Lake",
    "incorporadora": "Multiplan",
    "local": "",
    "aPartirDe": "R$ 2,48 mi",
    "linhas": [
      {
        "tipo": "Lake Eyre · 127 m²",
        "valor": "R$ 2,48 mi"
      },
      {
        "tipo": "Lake Baikal · 197 m²",
        "valor": "R$ 3,8 mi"
      },
      {
        "tipo": "Lake Victoria · 299 m²",
        "valor": "R$ 5,9 mi"
      }
    ],
    "selos": [],
    "gancho": "Lake Eyre, 127 m², a partir de R$ 2,48 milhões. O melhor é você ver de perto. Fica melhor [dia] às [hora] ou [dia] às [hora]?",
    "legendaDisparo": "🎄 Golden Lake: Lake Eyre, 127 m², a partir de R$ 2,48 milhões.\nQuer conhecer pessoalmente esta semana?",
    "arquivos": {
      "foto": "FOTO-08-Golden_Lake",
      "card": "CARD-08-Golden_Lake",
      "disparo": "DISP-08-Golden_Lake"
    }
  }
];

export const SCRIPTS = [
  {
    "titulo": "1. Lead novo · primeiro contato",
    "quando": "WhatsApp · responder em até 5 minutos",
    "texto": "Oi, [Nome]! Aqui é o [Corretor], da Uhome 🎄\nVi que você se interessou pelo [Empreendimento].\nO que mais chamou a sua atenção nele?",
    "dica": "Não mande tabela nem planta agora. Responda só o que ele perguntar e termine sempre com uma pergunta."
  },
  {
    "titulo": "2. Convite para visita com a condição de Natal",
    "quando": "WhatsApp · depois que ele respondeu",
    "texto": "[Responda em 1 frase o que ele perguntou.]\nE tem novidade: neste fim de ano as incorporadoras estão com as melhores condições de 2026, porque fecham o balanço em dezembro.\nE quem compra agora ainda ganha um presente de Natal da Uhome 🎁\nO melhor é você ver de perto. Fica melhor [dia] às [hora] ou [dia] às [hora]?",
    "dica": "Sempre dois horários. Quem escolhe entre dois horários não pensa em dizer não."
  },
  {
    "titulo": "3. Reengajamento da base",
    "quando": "Disparo para quem já falou com a gente e não comprou",
    "texto": "Oi, [Nome], tudo bem? Aqui é o [Corretor], da Uhome 🎄\nLembrei de você porque o [Empreendimento] entrou na nossa campanha de Natal: é a melhor condição do ano, e quem fecha até 18/12 ganha um presente de Natal.\nAinda faz sentido para você?",
    "dica": "Se responder \"sim\" ou \"como assim?\", vá direto para o script 2."
  },
  {
    "titulo": "4. Pós-visita: \"vou pensar\"",
    "quando": "WhatsApp · no dia seguinte à visita",
    "texto": "Oi, [Nome]! Ficou alguma dúvida da visita?\nPergunto porque essa condição de fim de ano vale até 18/12 e, fechando, você ainda leva o seu presente de Natal 🎁\nPosso te apresentar a proposta [dia] às [hora] ou [dia] às [hora]?",
    "dica": ""
  },
  {
    "titulo": "5. Pediu proposta",
    "quando": "WhatsApp · em até 24 horas",
    "texto": "[Nome], sua proposta está pronta! 🎄\nPrefiro te mostrar ao vivo: em 15 minutos eu explico a condição de Natal e tiro as tuas dúvidas.\nPode ser hoje às [hora] ou amanhã às [hora]?",
    "dica": "Proposta se apresenta, não se manda solta. Gerente junto quando der."
  },
  {
    "titulo": "6. Objeção: \"vou deixar para o ano que vem\"",
    "quando": "Ligação ou WhatsApp",
    "texto": "Entendo! Só te conto uma coisa: dezembro é quando as incorporadoras fecham o balanço e precisam bater meta. Por isso as condições de agora são as melhores do ano, e eu não sei se elas se repetem em janeiro.\nQue tal a gente ver juntos se a condição de hoje cabe no teu bolso? [dia] às [hora] ou [dia] às [hora]?",
    "dica": ""
  },
  {
    "titulo": "7. Objeção: \"está caro\"",
    "quando": "Ligação ou WhatsApp",
    "texto": "Faz sentido olhar com calma. E é justamente por isso que essa época é boa: as incorporadoras estão abertas a negociar entrada e parcelas para fechar o ano.\nVamos montar uma simulação juntos na visita? [dia] às [hora] ou [dia] às [hora]?",
    "dica": ""
  },
  {
    "titulo": "8. Confirmação da visita (D-1 e D-0)",
    "quando": "WhatsApp · véspera e manhã da visita",
    "texto": "Oi, [Nome]! Passando para confirmar a nossa visita [amanhã/hoje] às [hora] no [Empreendimento] 🎄\nJá deixei tudo separado para você. Posso confirmar?",
    "dica": "Metade das visitas não acontece. Confirmar véspera e dia muda o jogo."
  },
  {
    "titulo": "9. Depois da assinatura",
    "quando": "WhatsApp · no dia",
    "texto": "Parabéns pela conquista, [Nome]! 🎉🏡\nAssim que o pagamento for confirmado, você tira o seu cartão na nossa urna premiada e leva o seu presente de Natal 🎁\nE se alguém da família ou algum amigo também está procurando imóvel, me indica: a condição de Natal vale para ele também.",
    "dica": "Pedir a foto com o presente (com autorização) e a indicação no mesmo dia."
  },
  {
    "titulo": "10. Ligação em 4 passos",
    "quando": "Abertura, pergunta, gancho de Natal e convite",
    "texto": "Abertura: Oi, [Nome]! Aqui é o [Corretor], da Uhome. Tudo bem? Falo rapidinho: você se interessou pelo [Empreendimento].\nPergunta: O que mais te chamou a atenção nele?\nGancho de Natal: [Responda o que ele falou.] E tem mais: dezembro é o mês em que as incorporadoras fecham o balanço: é a melhor condição do ano, e quem compra agora ainda ganha um presente de Natal da Uhome.\nConvite: O melhor é você ver de perto. Fica melhor [dia] às [hora] ou [dia] às [hora]?",
    "dica": ""
  },
  {
    "titulo": "11. Áudio pronto (30 segundos)",
    "quando": "Grave uma vez, guarde numa conversa com você mesmo e só encaminhe",
    "texto": "Oi, [Nome]! Aqui é o [Corretor], da Uhome. Tô te mandando esse áudio rapidinho porque o [Empreendimento] entrou na nossa campanha de Natal. As incorporadoras estão fechando o ano com as melhores condições de 2026, e quem compra até dia 18 de dezembro ainda ganha um presente de Natal da Uhome. Queria muito te mostrar de perto. Fica melhor [dia] às [hora] ou [dia] às [hora]?",
    "dica": ""
  }
];

export const FOLLOWUPS = [
  {
    "situacao": "Lead não respondeu",
    "mensagens": [
      {
        "quando": "Mesmo dia · 2 a 3 horas depois",
        "texto": "Oi, [Nome]! Consegui te chamar numa hora boa? 🎄\nMe conta: o que mais te chamou atenção no [Empreendimento]?"
      },
      {
        "quando": "Dia seguinte",
        "texto": "Bom dia, [Nome]! A condição de Natal do [Empreendimento] vale para contratos assinados até 18/12.\nVocê está procurando para morar ou para investir?"
      },
      {
        "quando": "3 dias depois · prefira áudio ou ligação",
        "texto": "[Nome], tentei falar contigo esses dias.\nAinda faz sentido eu te ajudar com o [Empreendimento] ou prefere que eu te mostre outras opções na mesma faixa de valor?"
      },
      {
        "quando": "7 dias depois · encerramento leve",
        "texto": "[Nome], vou parar de te chamar para não incomodar 🙂\nSó me diz uma coisa: posso te avisar se aparecer uma condição ainda melhor até o Natal?"
      }
    ]
  },
  {
    "situacao": "Depois da visita",
    "mensagens": [
      {
        "quando": "Dia seguinte",
        "texto": "Oi, [Nome]! O que mais pesou para você depois da visita: o valor, o imóvel ou o momento?"
      },
      {
        "quando": "3 dias depois",
        "texto": "[Nome], conversei com o meu gerente sobre o que você me falou e consegui [condição ou simulação] para a unidade que você gostou.\nTe mostro em 10 minutos: hoje às [hora] ou amanhã às [hora]?"
      },
      {
        "quando": "7 dias depois",
        "texto": "[Nome], a unidade que você gostou ainda está disponível 🎄\nComo a condição de Natal acaba em 18/12, me conta: o que falta para você decidir?"
      }
    ]
  },
  {
    "situacao": "Proposta sem resposta",
    "mensagens": [
      {
        "quando": "2 dias depois",
        "texto": "[Nome], conseguiu olhar a proposta com calma?\nFicou alguma dúvida que eu possa resolver agora?"
      },
      {
        "quando": "5 dias depois",
        "texto": "[Nome], segurei a condição da sua proposta até [data].\nPrefere ajustar alguma coisa ou seguimos assim? Posso te ligar hoje às [hora] ou amanhã às [hora]?"
      }
    ]
  },
  {
    "situacao": "Agendou e faltou",
    "mensagens": [
      {
        "quando": "No mesmo dia",
        "texto": "[Nome], senti sua falta hoje! Aconteceu alguma coisa?\nPodemos remarcar para [dia] às [hora] ou [dia] às [hora]?"
      },
      {
        "quando": "Dia seguinte, se não respondeu",
        "texto": "Oi, [Nome]! A unidade que separei para você continua reservada até [dia] 🎄\nFica melhor [dia] às [hora] ou [dia] às [hora]?"
      }
    ]
  },
  {
    "situacao": "Base antiga",
    "mensagens": [
      {
        "quando": "Primeira mensagem",
        "texto": "Oi, [Nome]! Aqui é o [Corretor], da Uhome 🎄\nUm tempo atrás você procurou imóvel com a gente. Ainda está nos seus planos?"
      },
      {
        "quando": "Se respondeu que sim",
        "texto": "Que bom! Neste Natal as incorporadoras liberaram a melhor condição do ano, e quem compra ainda tira um presente na nossa urna premiada 🎁\nVocê prefere apartamento ou casa?"
      }
    ]
  },
  {
    "situacao": "Última semana (14 a 18/12)",
    "mensagens": [
      {
        "quando": "Para quem já conversou com você",
        "texto": "[Nome], última semana da condição de Natal 🎄\nAté 18/12 ainda dá para garantir [condição]. Separo um horário para você ver de perto: [dia] às [hora] ou [dia] às [hora]?"
      }
    ]
  }
];

export const LISTA_TRANSMISSAO = {
  "texto": "Oi, [Nome], tudo bem? Aqui é o [Corretor], da Uhome 🎄\nLembrei de você porque o [Empreendimento] entrou na nossa campanha de Natal: é a melhor condição do ano, e quem fecha até 18/12 ganha um presente de Natal.\nAinda faz sentido para você?",
  "dicas": [
    "A lista de transmissão só chega para quem salvou o seu número.",
    "Cada lista vai para até 256 contatos: separe por interesse (apartamento, casa, lote).",
    "Mande o card de disparo com a legenda dele. Quem responder, siga com o script 2."
  ]
};

export const INSTAGRAM = {
  "legenda": "Comprar o seu imóvel em dezembro tem um presente a mais. 🎄🔑\n\nEm dezembro, as incorporadoras fecham o balanço e as metas do ano. É quando entram com as melhores condições de 2026.\n\nE na Uhome tem mais: quem assinar o contrato até 18/12 tira 1 cartão da nossa urna premiada. São 30 presentes de Natal, do vinho à diária em Gramado no Natal Luz. 🎁\n\nEmpreendimentos participantes: Open Bosque, Open Arvoredo, Skyglass, Boa Vista, Casa Tua Porto Alegre, Casa Tua Canoas, Essence Canoas e Golden Lake.\n\nComente NATAL que a gente te manda as condições do imóvel que é a sua cara. 👇\n\nVálido para contratos assinados de 02/11 a 18/12/2026. Consulte o regulamento.",
  "dica": "Poste o carrossel no seu perfil e use as molduras nos stories. Quem comentar NATAL, chame no direct em até 5 minutos."
};

export const PDFS = [
  {
    "arquivo": "PDF-1-Encarte_de_Natal_A4_Clientes",
    "titulo": "Encarte de Natal para o cliente",
    "descricao": "A4, para mandar em PDF ou imprimir."
  },
  {
    "arquivo": "PDF-2-Encarte_de_Natal_A4_Corretores_com_cola",
    "titulo": "Encarte do corretor, com cola",
    "descricao": "O mesmo encarte com as frases prontas de cada empreendimento."
  },
  {
    "arquivo": "PDF-3-Scripts_de_Natal_para_o_grupo",
    "titulo": "Scripts de Natal (celular)",
    "descricao": "Uma mensagem por tela, para copiar e colar."
  },
  {
    "arquivo": "PDF-4-Regulamento_Missao_100_Milhoes_Corretores",
    "titulo": "Regulamento Missão 100 milhões",
    "descricao": "As regras completas dos prêmios de corretores e gerentes."
  }
];

// Prefixo do nome do arquivo -> seção da Central (ex.: "CARD-01-Open_Bosque.jpg" = seção cards, ordem 1, título "Open Bosque")
export const SECOES_ARQUIVOS = {
  "CARD": {
    "secao": "cards",
    "titulo": "Cards de Natal para WhatsApp"
  },
  "DISP": {
    "secao": "disparos",
    "titulo": "Cards de disparo"
  },
  "INSTA": {
    "secao": "instagram",
    "titulo": "Carrossel do Instagram"
  },
  "MOLD": {
    "secao": "molduras",
    "titulo": "Molduras para stories e feed"
  },
  "FOTO": {
    "secao": "fotos",
    "titulo": "Fotos dos empreendimentos"
  },
  "PDF": {
    "secao": "pdfs",
    "titulo": "PDFs"
  }
};
