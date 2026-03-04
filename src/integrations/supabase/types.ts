export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      audit_log: {
        Row: {
          acao: string
          antes: Json | null
          chave_unica: string | null
          created_at: string
          depois: Json | null
          descricao: string | null
          id: string
          modulo: string
          origem: string | null
          request_id: string | null
          user_id: string
        }
        Insert: {
          acao: string
          antes?: Json | null
          chave_unica?: string | null
          created_at?: string
          depois?: Json | null
          descricao?: string | null
          id?: string
          modulo: string
          origem?: string | null
          request_id?: string | null
          user_id: string
        }
        Update: {
          acao?: string
          antes?: Json | null
          chave_unica?: string | null
          created_at?: string
          depois?: Json | null
          descricao?: string | null
          id?: string
          modulo?: string
          origem?: string | null
          request_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      ceo_metas_mensais: {
        Row: {
          created_at: string
          gerente_id: string
          id: string
          mes: string
          meta_vgv_assinado: number
          meta_visitas_marcadas: number
          meta_visitas_realizadas: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          gerente_id: string
          id?: string
          mes: string
          meta_vgv_assinado?: number
          meta_visitas_marcadas?: number
          meta_visitas_realizadas?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          gerente_id?: string
          id?: string
          mes?: string
          meta_vgv_assinado?: number
          meta_visitas_marcadas?: number
          meta_visitas_realizadas?: number
          updated_at?: string
        }
        Relationships: []
      }
      checkpoint_lines: {
        Row: {
          checkpoint_id: string
          corretor_id: string
          created_at: string
          id: string
          meta_leads: number | null
          meta_ligacoes: number | null
          meta_presenca: string | null
          meta_propostas: number | null
          meta_vgv_assinado: number | null
          meta_vgv_gerado: number | null
          meta_visitas_marcadas: number | null
          meta_visitas_realizadas: number | null
          obs_dia: string | null
          obs_gerente: string | null
          real_leads: number | null
          real_ligacoes: number | null
          real_presenca: string | null
          real_propostas: number | null
          real_vgv_assinado: number | null
          real_vgv_gerado: number | null
          real_visitas_marcadas: number | null
          real_visitas_realizadas: number | null
          status_dia: string | null
          updated_at: string
        }
        Insert: {
          checkpoint_id: string
          corretor_id: string
          created_at?: string
          id?: string
          meta_leads?: number | null
          meta_ligacoes?: number | null
          meta_presenca?: string | null
          meta_propostas?: number | null
          meta_vgv_assinado?: number | null
          meta_vgv_gerado?: number | null
          meta_visitas_marcadas?: number | null
          meta_visitas_realizadas?: number | null
          obs_dia?: string | null
          obs_gerente?: string | null
          real_leads?: number | null
          real_ligacoes?: number | null
          real_presenca?: string | null
          real_propostas?: number | null
          real_vgv_assinado?: number | null
          real_vgv_gerado?: number | null
          real_visitas_marcadas?: number | null
          real_visitas_realizadas?: number | null
          status_dia?: string | null
          updated_at?: string
        }
        Update: {
          checkpoint_id?: string
          corretor_id?: string
          created_at?: string
          id?: string
          meta_leads?: number | null
          meta_ligacoes?: number | null
          meta_presenca?: string | null
          meta_propostas?: number | null
          meta_vgv_assinado?: number | null
          meta_vgv_gerado?: number | null
          meta_visitas_marcadas?: number | null
          meta_visitas_realizadas?: number | null
          obs_dia?: string | null
          obs_gerente?: string | null
          real_leads?: number | null
          real_ligacoes?: number | null
          real_presenca?: string | null
          real_propostas?: number | null
          real_vgv_assinado?: number | null
          real_vgv_gerado?: number | null
          real_visitas_marcadas?: number | null
          real_visitas_realizadas?: number | null
          status_dia?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "checkpoint_lines_checkpoint_id_fkey"
            columns: ["checkpoint_id"]
            isOneToOne: false
            referencedRelation: "checkpoints"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkpoint_lines_corretor_id_fkey"
            columns: ["corretor_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      checkpoints: {
        Row: {
          created_at: string
          data: string
          gerente_id: string
          id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          data: string
          gerente_id: string
          id?: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          data?: string
          gerente_id?: string
          id?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      corretor_reports: {
        Row: {
          conteudo_relatorio: string
          contexto_gerente: string
          corretor_id: string
          corretor_nome: string
          created_at: string
          dados_metricas: Json
          gerente_id: string
          id: string
          observacoes: string | null
          periodo_fim: string
          periodo_inicio: string
          periodo_tipo: string
          score_performance: number | null
        }
        Insert: {
          conteudo_relatorio: string
          contexto_gerente: string
          corretor_id: string
          corretor_nome: string
          created_at?: string
          dados_metricas?: Json
          gerente_id: string
          id?: string
          observacoes?: string | null
          periodo_fim: string
          periodo_inicio: string
          periodo_tipo?: string
          score_performance?: number | null
        }
        Update: {
          conteudo_relatorio?: string
          contexto_gerente?: string
          corretor_id?: string
          corretor_nome?: string
          created_at?: string
          dados_metricas?: Json
          gerente_id?: string
          id?: string
          observacoes?: string | null
          periodo_fim?: string
          periodo_inicio?: string
          periodo_tipo?: string
          score_performance?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "corretor_reports_corretor_id_fkey"
            columns: ["corretor_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      funnel_entries: {
        Row: {
          analise_ia: string | null
          cac_estimado: number | null
          corretor_nome: string | null
          cpl_real: number | null
          created_at: string
          custo_medio_lead: number
          gerente_id: string
          id: string
          investimento_midia: number
          leads_gerados: number
          observacoes: string | null
          periodo_fim: string
          periodo_inicio: string
          periodo_tipo: string
          propostas_geradas: number
          taxa_fechamento: number | null
          taxa_proposta: number | null
          taxa_venda: number | null
          updated_at: string
          vendas_fechadas: number
          vgv_vendido: number
        }
        Insert: {
          analise_ia?: string | null
          cac_estimado?: number | null
          corretor_nome?: string | null
          cpl_real?: number | null
          created_at?: string
          custo_medio_lead?: number
          gerente_id: string
          id?: string
          investimento_midia?: number
          leads_gerados?: number
          observacoes?: string | null
          periodo_fim: string
          periodo_inicio: string
          periodo_tipo?: string
          propostas_geradas?: number
          taxa_fechamento?: number | null
          taxa_proposta?: number | null
          taxa_venda?: number | null
          updated_at?: string
          vendas_fechadas?: number
          vgv_vendido?: number
        }
        Update: {
          analise_ia?: string | null
          cac_estimado?: number | null
          corretor_nome?: string | null
          cpl_real?: number | null
          created_at?: string
          custo_medio_lead?: number
          gerente_id?: string
          id?: string
          investimento_midia?: number
          leads_gerados?: number
          observacoes?: string | null
          periodo_fim?: string
          periodo_inicio?: string
          periodo_tipo?: string
          propostas_geradas?: number
          taxa_fechamento?: number | null
          taxa_proposta?: number | null
          taxa_venda?: number | null
          updated_at?: string
          vendas_fechadas?: number
          vgv_vendido?: number
        }
        Relationships: []
      }
      integration_settings: {
        Row: {
          id: string
          key: string
          label: string | null
          updated_at: string
          updated_by: string | null
          value: string
        }
        Insert: {
          id?: string
          key: string
          label?: string | null
          updated_at?: string
          updated_by?: string | null
          value: string
        }
        Update: {
          id?: string
          key?: string
          label?: string | null
          updated_at?: string
          updated_by?: string | null
          value?: string
        }
        Relationships: []
      }
      lead_messages: {
        Row: {
          canal: Database["public"]["Enums"]["message_channel"]
          enviado_em: string
          erro: string | null
          id: string
          lead_id: string
          mensagem: string
          status: Database["public"]["Enums"]["message_status"]
          user_id: string
        }
        Insert: {
          canal: Database["public"]["Enums"]["message_channel"]
          enviado_em?: string
          erro?: string | null
          id?: string
          lead_id: string
          mensagem: string
          status?: Database["public"]["Enums"]["message_status"]
          user_id: string
        }
        Update: {
          canal?: Database["public"]["Enums"]["message_channel"]
          enviado_em?: string
          erro?: string | null
          id?: string
          lead_id?: string
          mensagem?: string
          status?: Database["public"]["Enums"]["message_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_messages_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_tasks: {
        Row: {
          concluida_em: string | null
          created_at: string
          descricao: string | null
          id: string
          lead_id: string
          prioridade: Database["public"]["Enums"]["lead_priority"] | null
          status: Database["public"]["Enums"]["task_status"]
          titulo: string
          updated_at: string
          user_id: string
          vence_em: string | null
        }
        Insert: {
          concluida_em?: string | null
          created_at?: string
          descricao?: string | null
          id?: string
          lead_id: string
          prioridade?: Database["public"]["Enums"]["lead_priority"] | null
          status?: Database["public"]["Enums"]["task_status"]
          titulo: string
          updated_at?: string
          user_id: string
          vence_em?: string | null
        }
        Update: {
          concluida_em?: string | null
          created_at?: string
          descricao?: string | null
          id?: string
          lead_id?: string
          prioridade?: Database["public"]["Enums"]["lead_priority"] | null
          status?: Database["public"]["Enums"]["task_status"]
          titulo?: string
          updated_at?: string
          user_id?: string
          vence_em?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_tasks_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          atualizado_em: string
          corretor_responsavel: string | null
          email: string | null
          id: string
          imovel_codigo: string | null
          imovel_data: Json | null
          importado_em: string
          interesse: string | null
          mensagem_gerada: string | null
          nome: string
          observacoes: string | null
          origem: string | null
          prioridade: Database["public"]["Enums"]["lead_priority"] | null
          recovery_score: number | null
          status: string | null
          status_recuperacao: string | null
          telefone: string | null
          tipo_situacao: string | null
          ultimo_contato: string | null
          user_id: string
        }
        Insert: {
          atualizado_em?: string
          corretor_responsavel?: string | null
          email?: string | null
          id?: string
          imovel_codigo?: string | null
          imovel_data?: Json | null
          importado_em?: string
          interesse?: string | null
          mensagem_gerada?: string | null
          nome: string
          observacoes?: string | null
          origem?: string | null
          prioridade?: Database["public"]["Enums"]["lead_priority"] | null
          recovery_score?: number | null
          status?: string | null
          status_recuperacao?: string | null
          telefone?: string | null
          tipo_situacao?: string | null
          ultimo_contato?: string | null
          user_id: string
        }
        Update: {
          atualizado_em?: string
          corretor_responsavel?: string | null
          email?: string | null
          id?: string
          imovel_codigo?: string | null
          imovel_data?: Json | null
          importado_em?: string
          interesse?: string | null
          mensagem_gerada?: string | null
          nome?: string
          observacoes?: string | null
          origem?: string | null
          prioridade?: Database["public"]["Enums"]["lead_priority"] | null
          recovery_score?: number | null
          status?: string | null
          status_recuperacao?: string | null
          telefone?: string | null
          tipo_situacao?: string | null
          ultimo_contato?: string | null
          user_id?: string
        }
        Relationships: []
      }
      manager_checklist: {
        Row: {
          concluido: boolean
          concluido_em: string | null
          created_at: string
          data: string
          gerente_id: string
          id: string
          item: string
        }
        Insert: {
          concluido?: boolean
          concluido_em?: string | null
          created_at?: string
          data: string
          gerente_id: string
          id?: string
          item: string
        }
        Update: {
          concluido?: boolean
          concluido_em?: string | null
          created_at?: string
          data?: string
          gerente_id?: string
          id?: string
          item?: string
        }
        Relationships: []
      }
      marketing_entries: {
        Row: {
          anuncio: string | null
          campanha: string | null
          canal: string
          cliques: number | null
          conversoes: number | null
          cpc: number | null
          cpl: number | null
          created_at: string
          ctr: number | null
          empreendimento: string | null
          id: string
          impressoes: number | null
          investimento: number | null
          leads_gerados: number | null
          periodo: string | null
          propostas: number | null
          report_id: string | null
          updated_at: string
          user_id: string
          vendas: number | null
          visitas: number | null
        }
        Insert: {
          anuncio?: string | null
          campanha?: string | null
          canal?: string
          cliques?: number | null
          conversoes?: number | null
          cpc?: number | null
          cpl?: number | null
          created_at?: string
          ctr?: number | null
          empreendimento?: string | null
          id?: string
          impressoes?: number | null
          investimento?: number | null
          leads_gerados?: number | null
          periodo?: string | null
          propostas?: number | null
          report_id?: string | null
          updated_at?: string
          user_id: string
          vendas?: number | null
          visitas?: number | null
        }
        Update: {
          anuncio?: string | null
          campanha?: string | null
          canal?: string
          cliques?: number | null
          conversoes?: number | null
          cpc?: number | null
          cpl?: number | null
          created_at?: string
          ctr?: number | null
          empreendimento?: string | null
          id?: string
          impressoes?: number | null
          investimento?: number | null
          leads_gerados?: number | null
          periodo?: string | null
          propostas?: number | null
          report_id?: string | null
          updated_at?: string
          user_id?: string
          vendas?: number | null
          visitas?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "marketing_entries_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "marketing_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_reports: {
        Row: {
          canal: string
          created_at: string
          dados_brutos: Json | null
          id: string
          nome_arquivo: string
          periodo_fim: string | null
          periodo_inicio: string | null
          resumo_ia: string | null
          user_id: string
        }
        Insert: {
          canal?: string
          created_at?: string
          dados_brutos?: Json | null
          id?: string
          nome_arquivo: string
          periodo_fim?: string | null
          periodo_inicio?: string | null
          resumo_ia?: string | null
          user_id: string
        }
        Update: {
          canal?: string
          created_at?: string
          dados_brutos?: Json | null
          id?: string
          nome_arquivo?: string
          periodo_fim?: string | null
          periodo_inicio?: string | null
          resumo_ia?: string | null
          user_id?: string
        }
        Relationships: []
      }
      pdn_entries: {
        Row: {
          corretor: string | null
          created_at: string
          data_proxima_acao: string | null
          data_visita: string | null
          docs_status: string
          empreendimento: string | null
          equipe: string | null
          gerente_id: string
          id: string
          mes: string
          nome: string
          observacoes: string | null
          proxima_acao: string | null
          quando_assina: string | null
          situacao: string
          status_pagamento: string | null
          temperatura: string
          tipo_visita: string | null
          ultimo_contato: string | null
          und: string | null
          updated_at: string
          valor_potencial: number | null
          vgv: number | null
        }
        Insert: {
          corretor?: string | null
          created_at?: string
          data_proxima_acao?: string | null
          data_visita?: string | null
          docs_status?: string
          empreendimento?: string | null
          equipe?: string | null
          gerente_id: string
          id?: string
          mes: string
          nome: string
          observacoes?: string | null
          proxima_acao?: string | null
          quando_assina?: string | null
          situacao?: string
          status_pagamento?: string | null
          temperatura?: string
          tipo_visita?: string | null
          ultimo_contato?: string | null
          und?: string | null
          updated_at?: string
          valor_potencial?: number | null
          vgv?: number | null
        }
        Update: {
          corretor?: string | null
          created_at?: string
          data_proxima_acao?: string | null
          data_visita?: string | null
          docs_status?: string
          empreendimento?: string | null
          equipe?: string | null
          gerente_id?: string
          id?: string
          mes?: string
          nome?: string
          observacoes?: string | null
          proxima_acao?: string | null
          quando_assina?: string | null
          situacao?: string
          status_pagamento?: string | null
          temperatura?: string
          tipo_visita?: string | null
          ultimo_contato?: string | null
          und?: string | null
          updated_at?: string
          valor_potencial?: number | null
          vgv?: number | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          cargo: string | null
          created_at: string
          email: string | null
          id: string
          jetimob_user_id: string | null
          nome: string
          telefone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          cargo?: string | null
          created_at?: string
          email?: string | null
          id?: string
          jetimob_user_id?: string | null
          nome?: string
          telefone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          cargo?: string | null
          created_at?: string
          email?: string | null
          id?: string
          jetimob_user_id?: string | null
          nome?: string
          telefone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      saved_scripts: {
        Row: {
          conteudo: string
          created_at: string
          empreendimento: string
          id: string
          objetivo: string | null
          situacao_lead: string | null
          tipo: string
          tipo_abordagem: string | null
          titulo: string | null
          user_id: string
        }
        Insert: {
          conteudo: string
          created_at?: string
          empreendimento: string
          id?: string
          objetivo?: string | null
          situacao_lead?: string | null
          tipo?: string
          tipo_abordagem?: string | null
          titulo?: string | null
          user_id: string
        }
        Update: {
          conteudo?: string
          created_at?: string
          empreendimento?: string
          id?: string
          objetivo?: string | null
          situacao_lead?: string | null
          tipo?: string
          tipo_abordagem?: string | null
          titulo?: string | null
          user_id?: string
        }
        Relationships: []
      }
      team_members: {
        Row: {
          created_at: string
          equipe: string | null
          gerente_id: string
          id: string
          nome: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          equipe?: string | null
          gerente_id: string
          id?: string
          nome: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          equipe?: string | null
          gerente_id?: string
          id?: string
          nome?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calculate_recovery_score: {
        Args: {
          p_email: string
          p_interesse: string
          p_origem: string
          p_telefone: string
          p_ultimo_contato: string
        }
        Returns: number
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      recalculate_all_scores: { Args: never; Returns: undefined }
    }
    Enums: {
      app_role: "admin" | "gestor" | "corretor"
      lead_priority: "alta" | "media" | "baixa" | "frio" | "perdido"
      message_channel: "whatsapp" | "sms" | "email"
      message_status: "pendente" | "enviado" | "entregue" | "falhou"
      task_status: "pendente" | "em_andamento" | "concluida" | "cancelada"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "gestor", "corretor"],
      lead_priority: ["alta", "media", "baixa", "frio", "perdido"],
      message_channel: ["whatsapp", "sms", "email"],
      message_status: ["pendente", "enviado", "entregue", "falhou"],
      task_status: ["pendente", "em_andamento", "concluida", "cancelada"],
    },
  },
} as const
