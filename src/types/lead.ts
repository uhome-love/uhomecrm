export interface Lead {
  id: string;
  nome: string;
  email: string;
  telefone: string;
  interesse: string;
  origem: string;
  ultimoContato: string;
  status: string;
  prioridade?: "alta" | "media" | "baixa" | "frio" | "perdido";
  mensagemGerada?: string;
  canalEnvio?: "whatsapp" | "email" | "ambos";
  imovel?: ImovelJetimob;
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
