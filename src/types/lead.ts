export interface Lead {
  id: string;
  nome: string;
  email: string;
  telefone: string;
  interesse: string;
  origem: string;
  ultimoContato: string;
  status: string;
  prioridade?: "alta" | "media" | "baixa";
  mensagemGerada?: string;
  canalEnvio?: "whatsapp" | "email" | "ambos";
}

export interface LeadCSVRow {
  [key: string]: string;
}
