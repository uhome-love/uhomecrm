export type LeadPriority = "muito_quente" | "quente" | "morno" | "frio" | "perdido";

export type ScoreClassification = "alta" | "boa" | "media" | "baixa";

export type StatusRecuperacao = "pendente" | "contato_realizado" | "respondeu" | "reativado" | "sem_interesse" | "numero_invalido" | "recuperado";

export type TipoSituacao = "sem_contato" | "parou_responder" | "pediu_info_sumiu" | "lead_antigo" | "pos_visita_sem_retorno";

export interface Lead {
  id: string;
  nome: string;
  email: string;
  telefone: string;
  interesse: string;
  origem: string;
  ultimoContato: string;
  status: string;
  prioridade?: LeadPriority;
  mensagemGerada?: string;
  canalEnvio?: "whatsapp" | "email" | "ambos";
  imovel?: ImovelJetimob;
  corretor?: string;
  etapa?: string;
  dataCriacao?: string;
  recoveryScore?: number;
  statusRecuperacao?: StatusRecuperacao;
  tipoSituacao?: TipoSituacao;
  corretorResponsavel?: string;
  observacoes?: string;
}

export interface ImovelJetimob {
  codigo: string;
  contrato: string;
  descricao_anuncio: string;
  endereco_bairro: string;
  endereco_cidade: string;
  endereco_logradouro: string;
  dormitorios: number;
  garagens: number;
  area_privativa: number;
  valor: number;
  imagem_thumb?: string;
  tipo: string;
}

export interface LeadCSVRow {
  [key: string]: string;
}
