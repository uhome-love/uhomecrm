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
      academia_aulas: {
        Row: {
          conteudo: Json | null
          conteudo_url: string | null
          created_at: string | null
          descricao: string | null
          duracao_minutos: number | null
          id: string
          obrigatoria: boolean | null
          ordem: number | null
          tipo: string
          titulo: string
          trilha_id: string | null
          xp_recompensa: number | null
          youtube_id: string | null
        }
        Insert: {
          conteudo?: Json | null
          conteudo_url?: string | null
          created_at?: string | null
          descricao?: string | null
          duracao_minutos?: number | null
          id?: string
          obrigatoria?: boolean | null
          ordem?: number | null
          tipo: string
          titulo: string
          trilha_id?: string | null
          xp_recompensa?: number | null
          youtube_id?: string | null
        }
        Update: {
          conteudo?: Json | null
          conteudo_url?: string | null
          created_at?: string | null
          descricao?: string | null
          duracao_minutos?: number | null
          id?: string
          obrigatoria?: boolean | null
          ordem?: number | null
          tipo?: string
          titulo?: string
          trilha_id?: string | null
          xp_recompensa?: number | null
          youtube_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "academia_aulas_trilha_id_fkey"
            columns: ["trilha_id"]
            isOneToOne: false
            referencedRelation: "academia_trilhas"
            referencedColumns: ["id"]
          },
        ]
      }
      academia_certificados: {
        Row: {
          codigo: string | null
          corretor_id: string | null
          emitido_at: string | null
          id: string
          trilha_id: string | null
        }
        Insert: {
          codigo?: string | null
          corretor_id?: string | null
          emitido_at?: string | null
          id?: string
          trilha_id?: string | null
        }
        Update: {
          codigo?: string | null
          corretor_id?: string | null
          emitido_at?: string | null
          id?: string
          trilha_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "academia_certificados_corretor_id_fkey"
            columns: ["corretor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academia_certificados_trilha_id_fkey"
            columns: ["trilha_id"]
            isOneToOne: false
            referencedRelation: "academia_trilhas"
            referencedColumns: ["id"]
          },
        ]
      }
      academia_checklist: {
        Row: {
          aula_id: string | null
          id: string
          item: string
          ordem: number | null
        }
        Insert: {
          aula_id?: string | null
          id?: string
          item: string
          ordem?: number | null
        }
        Update: {
          aula_id?: string | null
          id?: string
          item?: string
          ordem?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "academia_checklist_aula_id_fkey"
            columns: ["aula_id"]
            isOneToOne: false
            referencedRelation: "academia_aulas"
            referencedColumns: ["id"]
          },
        ]
      }
      academia_progresso: {
        Row: {
          aula_id: string | null
          checklist_items: Json | null
          concluida_at: string | null
          corretor_id: string | null
          created_at: string | null
          id: string
          quiz_score: number | null
          status: string | null
          trilha_id: string | null
          xp_ganho: number | null
        }
        Insert: {
          aula_id?: string | null
          checklist_items?: Json | null
          concluida_at?: string | null
          corretor_id?: string | null
          created_at?: string | null
          id?: string
          quiz_score?: number | null
          status?: string | null
          trilha_id?: string | null
          xp_ganho?: number | null
        }
        Update: {
          aula_id?: string | null
          checklist_items?: Json | null
          concluida_at?: string | null
          corretor_id?: string | null
          created_at?: string | null
          id?: string
          quiz_score?: number | null
          status?: string | null
          trilha_id?: string | null
          xp_ganho?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "academia_progresso_aula_id_fkey"
            columns: ["aula_id"]
            isOneToOne: false
            referencedRelation: "academia_aulas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academia_progresso_corretor_id_fkey"
            columns: ["corretor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academia_progresso_trilha_id_fkey"
            columns: ["trilha_id"]
            isOneToOne: false
            referencedRelation: "academia_trilhas"
            referencedColumns: ["id"]
          },
        ]
      }
      academia_quiz: {
        Row: {
          aula_id: string | null
          explicacao: string | null
          id: string
          opcoes: Json
          ordem: number | null
          pergunta: string
        }
        Insert: {
          aula_id?: string | null
          explicacao?: string | null
          id?: string
          opcoes: Json
          ordem?: number | null
          pergunta: string
        }
        Update: {
          aula_id?: string | null
          explicacao?: string | null
          id?: string
          opcoes?: Json
          ordem?: number | null
          pergunta?: string
        }
        Relationships: [
          {
            foreignKeyName: "academia_quiz_aula_id_fkey"
            columns: ["aula_id"]
            isOneToOne: false
            referencedRelation: "academia_aulas"
            referencedColumns: ["id"]
          },
        ]
      }
      academia_quiz_perguntas: {
        Row: {
          aula_id: string | null
          explicacao: string | null
          id: string
          opcao_a: string
          opcao_b: string
          opcao_c: string
          opcao_d: string
          ordem: number | null
          pergunta: string
          resposta_correta: string
        }
        Insert: {
          aula_id?: string | null
          explicacao?: string | null
          id?: string
          opcao_a: string
          opcao_b: string
          opcao_c: string
          opcao_d: string
          ordem?: number | null
          pergunta: string
          resposta_correta: string
        }
        Update: {
          aula_id?: string | null
          explicacao?: string | null
          id?: string
          opcao_a?: string
          opcao_b?: string
          opcao_c?: string
          opcao_d?: string
          ordem?: number | null
          pergunta?: string
          resposta_correta?: string
        }
        Relationships: [
          {
            foreignKeyName: "academia_quiz_perguntas_aula_id_fkey"
            columns: ["aula_id"]
            isOneToOne: false
            referencedRelation: "academia_aulas"
            referencedColumns: ["id"]
          },
        ]
      }
      academia_trilhas: {
        Row: {
          categoria: string | null
          created_at: string | null
          criado_por: string | null
          descricao: string | null
          id: string
          nivel: string | null
          ordem: number | null
          publicada: boolean | null
          thumbnail_url: string | null
          titulo: string
          visibilidade: string | null
          xp_total: number | null
        }
        Insert: {
          categoria?: string | null
          created_at?: string | null
          criado_por?: string | null
          descricao?: string | null
          id?: string
          nivel?: string | null
          ordem?: number | null
          publicada?: boolean | null
          thumbnail_url?: string | null
          titulo: string
          visibilidade?: string | null
          xp_total?: number | null
        }
        Update: {
          categoria?: string | null
          created_at?: string | null
          criado_por?: string | null
          descricao?: string | null
          id?: string
          nivel?: string | null
          ordem?: number | null
          publicada?: boolean | null
          thumbnail_url?: string | null
          titulo?: string
          visibilidade?: string | null
          xp_total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "academia_trilhas_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      anuncio_materiais: {
        Row: {
          created_at: string
          empreendimento_codigo: string
          empreendimento_nome: string
          id: string
          mime_type: string | null
          nome_arquivo: string
          segmento: string
          tipo: string
          uploaded_by: string | null
          url: string
        }
        Insert: {
          created_at?: string
          empreendimento_codigo: string
          empreendimento_nome: string
          id?: string
          mime_type?: string | null
          nome_arquivo: string
          segmento: string
          tipo?: string
          uploaded_by?: string | null
          url: string
        }
        Update: {
          created_at?: string
          empreendimento_codigo?: string
          empreendimento_nome?: string
          id?: string
          mime_type?: string | null
          nome_arquivo?: string
          segmento?: string
          tipo?: string
          uploaded_by?: string | null
          url?: string
        }
        Relationships: []
      }
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
      automation_logs: {
        Row: {
          actions_executed: Json
          automation_id: string
          error_message: string | null
          id: string
          lead_id: string | null
          status: string
          triggered_at: string
        }
        Insert: {
          actions_executed?: Json
          automation_id: string
          error_message?: string | null
          id?: string
          lead_id?: string | null
          status?: string
          triggered_at?: string
        }
        Update: {
          actions_executed?: Json
          automation_id?: string
          error_message?: string | null
          id?: string
          lead_id?: string | null
          status?: string
          triggered_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_logs_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "automations"
            referencedColumns: ["id"]
          },
        ]
      }
      automations: {
        Row: {
          actions: Json
          conditions: Json
          created_at: string
          created_by: string
          id: string
          is_active: boolean
          last_run_at: string | null
          name: string
          run_count: number
          trigger_config: Json
          trigger_type: string
          updated_at: string
        }
        Insert: {
          actions?: Json
          conditions?: Json
          created_at?: string
          created_by: string
          id?: string
          is_active?: boolean
          last_run_at?: string | null
          name: string
          run_count?: number
          trigger_config?: Json
          trigger_type: string
          updated_at?: string
        }
        Update: {
          actions?: Json
          conditions?: Json
          created_at?: string
          created_by?: string
          id?: string
          is_active?: boolean
          last_run_at?: string | null
          name?: string
          run_count?: number
          trigger_config?: Json
          trigger_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      backoffice_tasks: {
        Row: {
          categoria: string
          concluida_em: string | null
          created_at: string
          data: string
          id: string
          pontos: number
          status: string
          titulo: string
          user_id: string
        }
        Insert: {
          categoria?: string
          concluida_em?: string | null
          created_at?: string
          data?: string
          id?: string
          pontos?: number
          status?: string
          titulo: string
          user_id: string
        }
        Update: {
          categoria?: string
          concluida_em?: string | null
          created_at?: string
          data?: string
          id?: string
          pontos?: number
          status?: string
          titulo?: string
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
          meta_ligacoes: number
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
          meta_ligacoes?: number
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
          meta_ligacoes?: number
          meta_vgv_assinado?: number
          meta_visitas_marcadas?: number
          meta_visitas_realizadas?: number
          updated_at?: string
        }
        Relationships: []
      }
      checkpoint_diario: {
        Row: {
          corretor_id: string
          created_at: string | null
          data: string
          id: string
          meta_aproveitados: number | null
          meta_ligacoes: number | null
          meta_visitas_marcar: number | null
          obs_dia: string | null
          obs_gerente: string | null
          presenca: string
          publicado: boolean | null
          res_aproveitados: number | null
          res_ligacoes: number | null
          res_propostas: number | null
          res_vgv: number | null
          res_visitas_marcadas: number | null
          res_visitas_realizadas: number | null
          updated_at: string | null
        }
        Insert: {
          corretor_id: string
          created_at?: string | null
          data: string
          id?: string
          meta_aproveitados?: number | null
          meta_ligacoes?: number | null
          meta_visitas_marcar?: number | null
          obs_dia?: string | null
          obs_gerente?: string | null
          presenca?: string
          publicado?: boolean | null
          res_aproveitados?: number | null
          res_ligacoes?: number | null
          res_propostas?: number | null
          res_vgv?: number | null
          res_visitas_marcadas?: number | null
          res_visitas_realizadas?: number | null
          updated_at?: string | null
        }
        Update: {
          corretor_id?: string
          created_at?: string | null
          data?: string
          id?: string
          meta_aproveitados?: number | null
          meta_ligacoes?: number | null
          meta_visitas_marcar?: number | null
          obs_dia?: string | null
          obs_gerente?: string | null
          presenca?: string
          publicado?: boolean | null
          res_aproveitados?: number | null
          res_ligacoes?: number | null
          res_propostas?: number | null
          res_vgv?: number | null
          res_visitas_marcadas?: number | null
          res_visitas_realizadas?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "checkpoint_diario_corretor_id_fkey"
            columns: ["corretor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
      coaching_sessions: {
        Row: {
          corretor_id: string
          created_at: string
          duracao_segundos: number
          feedback_ia: string | null
          id: string
          lista_id: string | null
          media_corretor_30d: Json | null
          media_time_hoje: Json | null
          metricas: Json | null
          session_end: string
          session_start: string
          taxa_aproveitamento: number | null
          taxa_atendimento: number | null
          total_aproveitados: number
          total_atenderam: number
          total_tentativas: number
        }
        Insert: {
          corretor_id: string
          created_at?: string
          duracao_segundos?: number
          feedback_ia?: string | null
          id?: string
          lista_id?: string | null
          media_corretor_30d?: Json | null
          media_time_hoje?: Json | null
          metricas?: Json | null
          session_end?: string
          session_start: string
          taxa_aproveitamento?: number | null
          taxa_atendimento?: number | null
          total_aproveitados?: number
          total_atenderam?: number
          total_tentativas?: number
        }
        Update: {
          corretor_id?: string
          created_at?: string
          duracao_segundos?: number
          feedback_ia?: string | null
          id?: string
          lista_id?: string | null
          media_corretor_30d?: Json | null
          media_time_hoje?: Json | null
          metricas?: Json | null
          session_end?: string
          session_start?: string
          taxa_aproveitamento?: number | null
          taxa_atendimento?: number | null
          total_aproveitados?: number
          total_atenderam?: number
          total_tentativas?: number
        }
        Relationships: [
          {
            foreignKeyName: "coaching_sessions_lista_id_fkey"
            columns: ["lista_id"]
            isOneToOne: false
            referencedRelation: "oferta_ativa_listas"
            referencedColumns: ["id"]
          },
        ]
      }
      cobrancas_enviadas: {
        Row: {
          created_at: string | null
          destinatarios: Json | null
          enviado_por: string
          id: string
          leads_afetados: Json | null
          mensagem: string | null
          tipo: string
        }
        Insert: {
          created_at?: string | null
          destinatarios?: Json | null
          enviado_por: string
          id?: string
          leads_afetados?: Json | null
          mensagem?: string | null
          tipo: string
        }
        Update: {
          created_at?: string | null
          destinatarios?: Json | null
          enviado_por?: string
          id?: string
          leads_afetados?: Json | null
          mensagem?: string | null
          tipo?: string
        }
        Relationships: []
      }
      comissao_faixas: {
        Row: {
          created_at: string
          id: string
          nome: string
          percentual: number
          updated_at: string
          vgv_max: number | null
          vgv_min: number
        }
        Insert: {
          created_at?: string
          id?: string
          nome?: string
          percentual?: number
          updated_at?: string
          vgv_max?: number | null
          vgv_min?: number
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
          percentual?: number
          updated_at?: string
          vgv_max?: number | null
          vgv_min?: number
        }
        Relationships: []
      }
      comunicacao_historico: {
        Row: {
          canal: string
          corretor_id: string | null
          created_at: string | null
          id: string
          lead_id: string | null
          mensagem_enviada: string | null
          personalizado_homi: boolean | null
          template_id: string | null
        }
        Insert: {
          canal: string
          corretor_id?: string | null
          created_at?: string | null
          id?: string
          lead_id?: string | null
          mensagem_enviada?: string | null
          personalizado_homi?: boolean | null
          template_id?: string | null
        }
        Update: {
          canal?: string
          corretor_id?: string | null
          created_at?: string | null
          id?: string
          lead_id?: string | null
          mensagem_enviada?: string | null
          personalizado_homi?: boolean | null
          template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "comunicacao_historico_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "comunicacao_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      comunicacao_templates: {
        Row: {
          ativo: boolean | null
          campanha: string | null
          canal: string
          conteudo: string
          created_at: string | null
          criado_por: string | null
          empreendimento: string | null
          id: string
          tipo: string
          titulo: string
          uso_count: number | null
          variaveis: Json | null
          visivel_para: string | null
        }
        Insert: {
          ativo?: boolean | null
          campanha?: string | null
          canal: string
          conteudo: string
          created_at?: string | null
          criado_por?: string | null
          empreendimento?: string | null
          id?: string
          tipo: string
          titulo: string
          uso_count?: number | null
          variaveis?: Json | null
          visivel_para?: string | null
        }
        Update: {
          ativo?: boolean | null
          campanha?: string | null
          canal?: string
          conteudo?: string
          created_at?: string | null
          criado_por?: string | null
          empreendimento?: string | null
          id?: string
          tipo?: string
          titulo?: string
          uso_count?: number | null
          variaveis?: Json | null
          visivel_para?: string | null
        }
        Relationships: []
      }
      conteudos_marketing: {
        Row: {
          aprovado_at: string | null
          aprovado_por: string | null
          brief: Json | null
          created_at: string
          criado_por: string
          data_publicacao: string | null
          descricao: string | null
          id: string
          plataforma: string[]
          status: string
          tema: string
          tipo: string
          updated_at: string
        }
        Insert: {
          aprovado_at?: string | null
          aprovado_por?: string | null
          brief?: Json | null
          created_at?: string
          criado_por: string
          data_publicacao?: string | null
          descricao?: string | null
          id?: string
          plataforma?: string[]
          status?: string
          tema: string
          tipo?: string
          updated_at?: string
        }
        Update: {
          aprovado_at?: string | null
          aprovado_por?: string | null
          brief?: Json | null
          created_at?: string
          criado_por?: string
          data_publicacao?: string | null
          descricao?: string | null
          id?: string
          plataforma?: string[]
          status?: string
          tema?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: []
      }
      corretor_conquistas: {
        Row: {
          conquista_id: string
          desbloqueada_em: string
          id: string
          notificado: boolean
          user_id: string
        }
        Insert: {
          conquista_id: string
          desbloqueada_em?: string
          id?: string
          notificado?: boolean
          user_id: string
        }
        Update: {
          conquista_id?: string
          desbloqueada_em?: string
          id?: string
          notificado?: boolean
          user_id?: string
        }
        Relationships: []
      }
      corretor_daily_goals: {
        Row: {
          aprovado_por: string | null
          corretor_id: string
          created_at: string
          data: string
          feedback_gerente: string | null
          id: string
          meta_aproveitados: number
          meta_aproveitados_aprovada: number | null
          meta_ligacoes: number
          meta_ligacoes_aprovada: number | null
          meta_visitas_marcadas: number
          observacao: string | null
          status: string
          updated_at: string
        }
        Insert: {
          aprovado_por?: string | null
          corretor_id: string
          created_at?: string
          data?: string
          feedback_gerente?: string | null
          id?: string
          meta_aproveitados?: number
          meta_aproveitados_aprovada?: number | null
          meta_ligacoes?: number
          meta_ligacoes_aprovada?: number | null
          meta_visitas_marcadas?: number
          observacao?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          aprovado_por?: string | null
          corretor_id?: string
          created_at?: string
          data?: string
          feedback_gerente?: string | null
          id?: string
          meta_aproveitados?: number
          meta_aproveitados_aprovada?: number | null
          meta_ligacoes?: number
          meta_ligacoes_aprovada?: number | null
          meta_visitas_marcadas?: number
          observacao?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      corretor_disponibilidade: {
        Row: {
          created_at: string
          entrada_em: string | null
          id: string
          leads_recebidos_turno: number
          na_roleta: boolean
          saida_em: string | null
          segmentos: string[]
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          entrada_em?: string | null
          id?: string
          leads_recebidos_turno?: number
          na_roleta?: boolean
          saida_em?: string | null
          segmentos?: string[]
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          entrada_em?: string | null
          id?: string
          leads_recebidos_turno?: number
          na_roleta?: boolean
          saida_em?: string | null
          segmentos?: string[]
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      corretor_motivations: {
        Row: {
          autor: string | null
          created_at: string
          criado_por: string | null
          data: string
          fixada: boolean
          id: string
          mensagem: string
        }
        Insert: {
          autor?: string | null
          created_at?: string
          criado_por?: string | null
          data?: string
          fixada?: boolean
          id?: string
          mensagem: string
        }
        Update: {
          autor?: string | null
          created_at?: string
          criado_por?: string | null
          data?: string
          fixada?: boolean
          id?: string
          mensagem?: string
        }
        Relationships: []
      }
      corretor_onboarding: {
        Row: {
          completed: boolean
          completed_at: string | null
          created_at: string
          id: string
          step_id: string
          user_id: string
        }
        Insert: {
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          id?: string
          step_id: string
          user_id: string
        }
        Update: {
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          id?: string
          step_id?: string
          user_id?: string
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
      custom_list_sessions: {
        Row: {
          aproveitados: number
          corretor_id: string
          encerrada_at: string | null
          id: string
          iniciada_at: string
          ligacoes: number
          lista_id: string
          pts_ganhos: number
        }
        Insert: {
          aproveitados?: number
          corretor_id: string
          encerrada_at?: string | null
          id?: string
          iniciada_at?: string
          ligacoes?: number
          lista_id: string
          pts_ganhos?: number
        }
        Update: {
          aproveitados?: number
          corretor_id?: string
          encerrada_at?: string | null
          id?: string
          iniciada_at?: string
          ligacoes?: number
          lista_id?: string
          pts_ganhos?: number
        }
        Relationships: [
          {
            foreignKeyName: "custom_list_sessions_lista_id_fkey"
            columns: ["lista_id"]
            isOneToOne: false
            referencedRelation: "custom_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_lists: {
        Row: {
          corretor_id: string
          criada_at: string
          filtros: Json
          id: string
          nome: string
          ultima_usada_at: string | null
          vezes_usada: number
        }
        Insert: {
          corretor_id: string
          criada_at?: string
          filtros?: Json
          id?: string
          nome?: string
          ultima_usada_at?: string | null
          vezes_usada?: number
        }
        Update: {
          corretor_id?: string
          criada_at?: string
          filtros?: Json
          id?: string
          nome?: string
          ultima_usada_at?: string | null
          vezes_usada?: number
        }
        Relationships: []
      }
      distribuicao_escala: {
        Row: {
          aprovacao_status: string
          aprovado_em: string | null
          aprovado_por: string | null
          ativo: boolean
          corretor_id: string
          created_at: string
          criado_por: string
          data: string
          id: string
          segmento_id: string
        }
        Insert: {
          aprovacao_status?: string
          aprovado_em?: string | null
          aprovado_por?: string | null
          ativo?: boolean
          corretor_id: string
          created_at?: string
          criado_por: string
          data?: string
          id?: string
          segmento_id: string
        }
        Update: {
          aprovacao_status?: string
          aprovado_em?: string | null
          aprovado_por?: string | null
          ativo?: boolean
          corretor_id?: string
          created_at?: string
          criado_por?: string
          data?: string
          id?: string
          segmento_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "distribuicao_escala_segmento_id_fkey"
            columns: ["segmento_id"]
            isOneToOne: false
            referencedRelation: "pipeline_segmentos"
            referencedColumns: ["id"]
          },
        ]
      }
      distribuicao_historico: {
        Row: {
          acao: string
          corretor_id: string
          created_at: string
          id: string
          motivo_rejeicao: string | null
          pipeline_lead_id: string
          segmento_id: string | null
          tempo_resposta_seg: number | null
        }
        Insert: {
          acao?: string
          corretor_id: string
          created_at?: string
          id?: string
          motivo_rejeicao?: string | null
          pipeline_lead_id: string
          segmento_id?: string | null
          tempo_resposta_seg?: number | null
        }
        Update: {
          acao?: string
          corretor_id?: string
          created_at?: string
          id?: string
          motivo_rejeicao?: string | null
          pipeline_lead_id?: string
          segmento_id?: string | null
          tempo_resposta_seg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "distribuicao_historico_pipeline_lead_id_fkey"
            columns: ["pipeline_lead_id"]
            isOneToOne: false
            referencedRelation: "pipeline_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "distribuicao_historico_segmento_id_fkey"
            columns: ["segmento_id"]
            isOneToOne: false
            referencedRelation: "pipeline_segmentos"
            referencedColumns: ["id"]
          },
        ]
      }
      empreendimento_fichas: {
        Row: {
          atualizado_por: string | null
          desconto: string | null
          empreendimento: string
          entrada: string | null
          entrega: string | null
          id: string
          localizacao: string | null
          metragens: string | null
          notas: string | null
          updated_at: string | null
        }
        Insert: {
          atualizado_por?: string | null
          desconto?: string | null
          empreendimento: string
          entrada?: string | null
          entrega?: string | null
          id?: string
          localizacao?: string | null
          metragens?: string | null
          notas?: string | null
          updated_at?: string | null
        }
        Update: {
          atualizado_por?: string | null
          desconto?: string | null
          empreendimento?: string
          entrada?: string | null
          entrega?: string | null
          id?: string
          localizacao?: string | null
          metragens?: string | null
          notas?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "empreendimento_fichas_atualizado_por_fkey"
            columns: ["atualizado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      empreendimento_overrides: {
        Row: {
          area_privativa: number | null
          bairro: string | null
          codigo: string
          cor_primaria: string | null
          created_at: string | null
          descricao: string | null
          diferenciais: string[] | null
          dormitorios: number | null
          fotos: string[] | null
          id: string
          landing_subtitulo: string | null
          landing_titulo: string | null
          mapa_url: string | null
          nome: string | null
          plantas: string[] | null
          previsao_entrega: string | null
          status_obra: string | null
          suites: number | null
          tipologias: Json | null
          updated_at: string | null
          updated_by: string | null
          vagas: number | null
          valor_max: number | null
          valor_min: number | null
          valor_venda: number | null
          video_url: string | null
        }
        Insert: {
          area_privativa?: number | null
          bairro?: string | null
          codigo: string
          cor_primaria?: string | null
          created_at?: string | null
          descricao?: string | null
          diferenciais?: string[] | null
          dormitorios?: number | null
          fotos?: string[] | null
          id?: string
          landing_subtitulo?: string | null
          landing_titulo?: string | null
          mapa_url?: string | null
          nome?: string | null
          plantas?: string[] | null
          previsao_entrega?: string | null
          status_obra?: string | null
          suites?: number | null
          tipologias?: Json | null
          updated_at?: string | null
          updated_by?: string | null
          vagas?: number | null
          valor_max?: number | null
          valor_min?: number | null
          valor_venda?: number | null
          video_url?: string | null
        }
        Update: {
          area_privativa?: number | null
          bairro?: string | null
          codigo?: string
          cor_primaria?: string | null
          created_at?: string | null
          descricao?: string | null
          diferenciais?: string[] | null
          dormitorios?: number | null
          fotos?: string[] | null
          id?: string
          landing_subtitulo?: string | null
          landing_titulo?: string | null
          mapa_url?: string | null
          nome?: string | null
          plantas?: string[] | null
          previsao_entrega?: string | null
          status_obra?: string | null
          suites?: number | null
          tipologias?: Json | null
          updated_at?: string | null
          updated_by?: string | null
          vagas?: number | null
          valor_max?: number | null
          valor_min?: number | null
          valor_venda?: number | null
          video_url?: string | null
        }
        Relationships: []
      }
      executive_reports: {
        Row: {
          campanhas: Json | null
          comparativo: Json | null
          conteudo_completo: string | null
          created_at: string
          diagnostico_ia: string | null
          funil: Json | null
          id: string
          mes: string
          metricas: Json | null
          ranking_corretores: Json | null
          ranking_equipes: Json | null
          status: string
          sumario_executivo: string | null
          titulo: string
          updated_at: string
        }
        Insert: {
          campanhas?: Json | null
          comparativo?: Json | null
          conteudo_completo?: string | null
          created_at?: string
          diagnostico_ia?: string | null
          funil?: Json | null
          id?: string
          mes: string
          metricas?: Json | null
          ranking_corretores?: Json | null
          ranking_equipes?: Json | null
          status?: string
          sumario_executivo?: string | null
          titulo: string
          updated_at?: string
        }
        Update: {
          campanhas?: Json | null
          comparativo?: Json | null
          conteudo_completo?: string | null
          created_at?: string
          diagnostico_ia?: string | null
          funil?: Json | null
          id?: string
          mes?: string
          metricas?: Json | null
          ranking_corretores?: Json | null
          ranking_equipes?: Json | null
          status?: string
          sumario_executivo?: string | null
          titulo?: string
          updated_at?: string
        }
        Relationships: []
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
      homi_briefing_diario: {
        Row: {
          acao_prioritaria: string | null
          alertas: Json | null
          dados_contexto: Json | null
          data: string
          destaques: Json | null
          frase_do_dia: string | null
          gerado_em: string | null
          id: string
          previsao: string | null
          status_geral: string | null
          user_id: string
        }
        Insert: {
          acao_prioritaria?: string | null
          alertas?: Json | null
          dados_contexto?: Json | null
          data?: string
          destaques?: Json | null
          frase_do_dia?: string | null
          gerado_em?: string | null
          id?: string
          previsao?: string | null
          status_geral?: string | null
          user_id: string
        }
        Update: {
          acao_prioritaria?: string | null
          alertas?: Json | null
          dados_contexto?: Json | null
          data?: string
          destaques?: Json | null
          frase_do_dia?: string | null
          gerado_em?: string | null
          id?: string
          previsao?: string | null
          status_geral?: string | null
          user_id?: string
        }
        Relationships: []
      }
      homi_chunks: {
        Row: {
          content: string
          created_at: string | null
          document_id: string | null
          embedding: string | null
          id: string
          metadata: Json | null
        }
        Insert: {
          content: string
          created_at?: string | null
          document_id?: string | null
          embedding?: string | null
          id?: string
          metadata?: Json | null
        }
        Update: {
          content?: string
          created_at?: string | null
          document_id?: string | null
          embedding?: string | null
          id?: string
          metadata?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "homi_chunks_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "homi_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      homi_conversations: {
        Row: {
          acao: string | null
          created_at: string
          empreendimento: string | null
          id: string
          mensagens: Json
          objetivo: string | null
          resultado: string | null
          situacao: string | null
          tipo: string
          titulo: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          acao?: string | null
          created_at?: string
          empreendimento?: string | null
          id?: string
          mensagens?: Json
          objetivo?: string | null
          resultado?: string | null
          situacao?: string | null
          tipo?: string
          titulo?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          acao?: string | null
          created_at?: string
          empreendimento?: string | null
          id?: string
          mensagens?: Json
          objetivo?: string | null
          resultado?: string | null
          situacao?: string | null
          tipo?: string
          titulo?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      homi_documents: {
        Row: {
          category: string
          chunk_count: number | null
          content: string | null
          created_at: string | null
          created_by: string | null
          empreendimento: string | null
          file_type: string | null
          file_url: string | null
          id: string
          status: string | null
          subcategory: string | null
          title: string
        }
        Insert: {
          category: string
          chunk_count?: number | null
          content?: string | null
          created_at?: string | null
          created_by?: string | null
          empreendimento?: string | null
          file_type?: string | null
          file_url?: string | null
          id?: string
          status?: string | null
          subcategory?: string | null
          title: string
        }
        Update: {
          category?: string
          chunk_count?: number | null
          content?: string | null
          created_at?: string | null
          created_by?: string | null
          empreendimento?: string | null
          file_type?: string | null
          file_url?: string | null
          id?: string
          status?: string | null
          subcategory?: string | null
          title?: string
        }
        Relationships: []
      }
      integracao_field_mappings: {
        Row: {
          ativo: boolean
          categoria: string
          id: string
          jetimob_description: string | null
          jetimob_field: string
          notes: string | null
          ordem: number
          status: string
          transform: string | null
          uhome_field: string
          uhome_table: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          ativo?: boolean
          categoria: string
          id?: string
          jetimob_description?: string | null
          jetimob_field: string
          notes?: string | null
          ordem?: number
          status?: string
          transform?: string | null
          uhome_field?: string
          uhome_table?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          ativo?: boolean
          categoria?: string
          id?: string
          jetimob_description?: string | null
          jetimob_field?: string
          notes?: string | null
          ordem?: number
          status?: string
          transform?: string | null
          uhome_field?: string
          uhome_table?: string
          updated_at?: string
          updated_by?: string | null
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
      jetimob_campaign_map: {
        Row: {
          campaign_id: string
          created_at: string
          empreendimento: string
          id: string
          notas: string | null
          segmento: string | null
          updated_at: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          empreendimento: string
          id?: string
          notas?: string | null
          segmento?: string | null
          updated_at?: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          empreendimento?: string
          id?: string
          notas?: string | null
          segmento?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      jetimob_processed: {
        Row: {
          created_at: string
          jetimob_lead_id: string
          telefone: string | null
        }
        Insert: {
          created_at?: string
          jetimob_lead_id: string
          telefone?: string | null
        }
        Update: {
          created_at?: string
          jetimob_lead_id?: string
          telefone?: string | null
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
        Relationships: []
      }
      lead_progressao: {
        Row: {
          corretor_id: string | null
          created_at: string | null
          fase_destino: string | null
          fase_origem: string | null
          id: string
          lead_id: string | null
          modulo_destino: string
          modulo_origem: string
          negocio_id: string | null
          triggered_by: string | null
          visita_id: string | null
        }
        Insert: {
          corretor_id?: string | null
          created_at?: string | null
          fase_destino?: string | null
          fase_origem?: string | null
          id?: string
          lead_id?: string | null
          modulo_destino: string
          modulo_origem: string
          negocio_id?: string | null
          triggered_by?: string | null
          visita_id?: string | null
        }
        Update: {
          corretor_id?: string | null
          created_at?: string | null
          fase_destino?: string | null
          fase_origem?: string | null
          id?: string
          lead_id?: string | null
          modulo_destino?: string
          modulo_origem?: string
          negocio_id?: string | null
          triggered_by?: string | null
          visita_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_progressao_corretor_id_fkey"
            columns: ["corretor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_progressao_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_progressao_visita_id_fkey"
            columns: ["visita_id"]
            isOneToOne: false
            referencedRelation: "visitas"
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
        Relationships: []
      }
      leads_backup: {
        Row: {
          atualizado_em: string | null
          corretor_responsavel: string | null
          dias_parado: number | null
          email: string | null
          id: string | null
          imovel_codigo: string | null
          imovel_data: Json | null
          importado_em: string | null
          interesse: string | null
          mensagem_gerada: string | null
          modulo_atual: string | null
          negocio_id: string | null
          nome: string | null
          observacoes: string | null
          origem: string | null
          pipeline_fase: string | null
          prioridade: Database["public"]["Enums"]["lead_priority"] | null
          recovery_score: number | null
          roleta_distribuido_em: string | null
          roleta_expira_em: string | null
          roleta_respondido_em: string | null
          roleta_status: string | null
          status: string | null
          status_recuperacao: string | null
          telefone: string | null
          tipo_situacao: string | null
          ultima_acao_at: string | null
          ultimo_contato: string | null
          user_id: string | null
        }
        Insert: {
          atualizado_em?: string | null
          corretor_responsavel?: string | null
          dias_parado?: number | null
          email?: string | null
          id?: string | null
          imovel_codigo?: string | null
          imovel_data?: Json | null
          importado_em?: string | null
          interesse?: string | null
          mensagem_gerada?: string | null
          modulo_atual?: string | null
          negocio_id?: string | null
          nome?: string | null
          observacoes?: string | null
          origem?: string | null
          pipeline_fase?: string | null
          prioridade?: Database["public"]["Enums"]["lead_priority"] | null
          recovery_score?: number | null
          roleta_distribuido_em?: string | null
          roleta_expira_em?: string | null
          roleta_respondido_em?: string | null
          roleta_status?: string | null
          status?: string | null
          status_recuperacao?: string | null
          telefone?: string | null
          tipo_situacao?: string | null
          ultima_acao_at?: string | null
          ultimo_contato?: string | null
          user_id?: string | null
        }
        Update: {
          atualizado_em?: string | null
          corretor_responsavel?: string | null
          dias_parado?: number | null
          email?: string | null
          id?: string | null
          imovel_codigo?: string | null
          imovel_data?: Json | null
          importado_em?: string | null
          interesse?: string | null
          mensagem_gerada?: string | null
          modulo_atual?: string | null
          negocio_id?: string | null
          nome?: string | null
          observacoes?: string | null
          origem?: string | null
          pipeline_fase?: string | null
          prioridade?: Database["public"]["Enums"]["lead_priority"] | null
          recovery_score?: number | null
          roleta_distribuido_em?: string | null
          roleta_expira_em?: string | null
          roleta_respondido_em?: string | null
          roleta_status?: string | null
          status?: string | null
          status_recuperacao?: string | null
          telefone?: string | null
          tipo_situacao?: string | null
          ultima_acao_at?: string | null
          ultimo_contato?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      leads_legado: {
        Row: {
          atualizado_em: string
          corretor_responsavel: string | null
          dias_parado: number | null
          email: string | null
          id: string
          imovel_codigo: string | null
          imovel_data: Json | null
          importado_em: string
          interesse: string | null
          mensagem_gerada: string | null
          modulo_atual: string | null
          negocio_id: string | null
          nome: string
          observacoes: string | null
          origem: string | null
          pipeline_fase: string | null
          prioridade: Database["public"]["Enums"]["lead_priority"] | null
          recovery_score: number | null
          roleta_distribuido_em: string | null
          roleta_expira_em: string | null
          roleta_respondido_em: string | null
          roleta_status: string | null
          status: string | null
          status_recuperacao: string | null
          telefone: string | null
          tipo_situacao: string | null
          ultima_acao_at: string | null
          ultimo_contato: string | null
          user_id: string
        }
        Insert: {
          atualizado_em?: string
          corretor_responsavel?: string | null
          dias_parado?: number | null
          email?: string | null
          id?: string
          imovel_codigo?: string | null
          imovel_data?: Json | null
          importado_em?: string
          interesse?: string | null
          mensagem_gerada?: string | null
          modulo_atual?: string | null
          negocio_id?: string | null
          nome: string
          observacoes?: string | null
          origem?: string | null
          pipeline_fase?: string | null
          prioridade?: Database["public"]["Enums"]["lead_priority"] | null
          recovery_score?: number | null
          roleta_distribuido_em?: string | null
          roleta_expira_em?: string | null
          roleta_respondido_em?: string | null
          roleta_status?: string | null
          status?: string | null
          status_recuperacao?: string | null
          telefone?: string | null
          tipo_situacao?: string | null
          ultima_acao_at?: string | null
          ultimo_contato?: string | null
          user_id: string
        }
        Update: {
          atualizado_em?: string
          corretor_responsavel?: string | null
          dias_parado?: number | null
          email?: string | null
          id?: string
          imovel_codigo?: string | null
          imovel_data?: Json | null
          importado_em?: string
          interesse?: string | null
          mensagem_gerada?: string | null
          modulo_atual?: string | null
          negocio_id?: string | null
          nome?: string
          observacoes?: string | null
          origem?: string | null
          pipeline_fase?: string | null
          prioridade?: Database["public"]["Enums"]["lead_priority"] | null
          recovery_score?: number | null
          roleta_distribuido_em?: string | null
          roleta_expira_em?: string | null
          roleta_respondido_em?: string | null
          roleta_status?: string | null
          status?: string | null
          status_recuperacao?: string | null
          telefone?: string | null
          tipo_situacao?: string | null
          ultima_acao_at?: string | null
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
      marketplace_items: {
        Row: {
          aprovado_em: string | null
          aprovado_por: string | null
          autor_id: string
          autor_nome: string
          categoria: string
          conteudo: string
          created_at: string
          id: string
          media_avaliacao: number | null
          origem: string | null
          status: string
          tags: string[] | null
          titulo: string
          total_avaliacoes: number | null
          total_usos: number | null
          updated_at: string
        }
        Insert: {
          aprovado_em?: string | null
          aprovado_por?: string | null
          autor_id: string
          autor_nome?: string
          categoria?: string
          conteudo: string
          created_at?: string
          id?: string
          media_avaliacao?: number | null
          origem?: string | null
          status?: string
          tags?: string[] | null
          titulo: string
          total_avaliacoes?: number | null
          total_usos?: number | null
          updated_at?: string
        }
        Update: {
          aprovado_em?: string | null
          aprovado_por?: string | null
          autor_id?: string
          autor_nome?: string
          categoria?: string
          conteudo?: string
          created_at?: string
          id?: string
          media_avaliacao?: number | null
          origem?: string | null
          status?: string
          tags?: string[] | null
          titulo?: string
          total_avaliacoes?: number | null
          total_usos?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      marketplace_ratings: {
        Row: {
          comentario: string | null
          created_at: string
          id: string
          item_id: string
          nota: number
          user_id: string
        }
        Insert: {
          comentario?: string | null
          created_at?: string
          id?: string
          item_id: string
          nota: number
          user_id: string
        }
        Update: {
          comentario?: string | null
          created_at?: string
          id?: string
          item_id?: string
          nota?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_ratings_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "marketplace_items"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_scripts: {
        Row: {
          ativo: boolean | null
          autor_id: string | null
          autor_nome: string | null
          categoria: string
          conteudo: string
          created_at: string | null
          descricao: string | null
          downloads: number | null
          empreendimento: string | null
          id: string
          likes: number | null
          tags: string[] | null
          tipo: string
          titulo: string
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          autor_id?: string | null
          autor_nome?: string | null
          categoria: string
          conteudo: string
          created_at?: string | null
          descricao?: string | null
          downloads?: number | null
          empreendimento?: string | null
          id?: string
          likes?: number | null
          tags?: string[] | null
          tipo?: string
          titulo: string
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          autor_id?: string | null
          autor_nome?: string | null
          categoria?: string
          conteudo?: string
          created_at?: string | null
          descricao?: string | null
          downloads?: number | null
          empreendimento?: string | null
          id?: string
          likes?: number | null
          tags?: string[] | null
          tipo?: string
          titulo?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_scripts_autor_id_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_usage: {
        Row: {
          id: string
          item_id: string
          used_at: string
          user_id: string
        }
        Insert: {
          id?: string
          item_id: string
          used_at?: string
          user_id: string
        }
        Update: {
          id?: string
          item_id?: string
          used_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_usage_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "marketplace_items"
            referencedColumns: ["id"]
          },
        ]
      }
      negocios: {
        Row: {
          corretor_id: string | null
          created_at: string | null
          data_assinatura: string | null
          documentacao_situacao: string | null
          empreendimento: string | null
          fase: string | null
          fase_changed_at: string | null
          gerente_id: string | null
          id: string
          imovel_interesse: string | null
          lead_id: string | null
          negociacao_contra_proposta: string | null
          negociacao_pendencia: string | null
          negociacao_situacao: string | null
          nome_cliente: string | null
          observacoes: string | null
          origem: string | null
          pipeline_lead_id: string | null
          proposta_imovel: string | null
          proposta_situacao: string | null
          proposta_valor: number | null
          status: string | null
          telefone: string | null
          unidade: string | null
          updated_at: string | null
          vgv_estimado: number | null
          vgv_final: number | null
          visita_id: string | null
        }
        Insert: {
          corretor_id?: string | null
          created_at?: string | null
          data_assinatura?: string | null
          documentacao_situacao?: string | null
          empreendimento?: string | null
          fase?: string | null
          fase_changed_at?: string | null
          gerente_id?: string | null
          id?: string
          imovel_interesse?: string | null
          lead_id?: string | null
          negociacao_contra_proposta?: string | null
          negociacao_pendencia?: string | null
          negociacao_situacao?: string | null
          nome_cliente?: string | null
          observacoes?: string | null
          origem?: string | null
          pipeline_lead_id?: string | null
          proposta_imovel?: string | null
          proposta_situacao?: string | null
          proposta_valor?: number | null
          status?: string | null
          telefone?: string | null
          unidade?: string | null
          updated_at?: string | null
          vgv_estimado?: number | null
          vgv_final?: number | null
          visita_id?: string | null
        }
        Update: {
          corretor_id?: string | null
          created_at?: string | null
          data_assinatura?: string | null
          documentacao_situacao?: string | null
          empreendimento?: string | null
          fase?: string | null
          fase_changed_at?: string | null
          gerente_id?: string | null
          id?: string
          imovel_interesse?: string | null
          lead_id?: string | null
          negociacao_contra_proposta?: string | null
          negociacao_pendencia?: string | null
          negociacao_situacao?: string | null
          nome_cliente?: string | null
          observacoes?: string | null
          origem?: string | null
          pipeline_lead_id?: string | null
          proposta_imovel?: string | null
          proposta_situacao?: string | null
          proposta_valor?: number | null
          status?: string | null
          telefone?: string | null
          unidade?: string | null
          updated_at?: string | null
          vgv_estimado?: number | null
          vgv_final?: number | null
          visita_id?: string | null
        }
        Relationships: []
      }
      negocios_atividades: {
        Row: {
          created_at: string
          created_by: string | null
          descricao: string | null
          id: string
          negocio_id: string
          resultado: string | null
          tipo: string
          titulo: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          id?: string
          negocio_id: string
          resultado?: string | null
          tipo: string
          titulo?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          id?: string
          negocio_id?: string
          resultado?: string | null
          tipo?: string
          titulo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "negocios_atividades_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocios"
            referencedColumns: ["id"]
          },
        ]
      }
      negocios_tarefas: {
        Row: {
          concluida_em: string | null
          created_at: string
          created_by: string | null
          descricao: string | null
          hora_vencimento: string | null
          id: string
          negocio_id: string
          prioridade: string
          responsavel_id: string | null
          status: string
          tipo: string
          titulo: string
          updated_at: string
          vence_em: string | null
        }
        Insert: {
          concluida_em?: string | null
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          hora_vencimento?: string | null
          id?: string
          negocio_id: string
          prioridade?: string
          responsavel_id?: string | null
          status?: string
          tipo?: string
          titulo: string
          updated_at?: string
          vence_em?: string | null
        }
        Update: {
          concluida_em?: string | null
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          hora_vencimento?: string | null
          id?: string
          negocio_id?: string
          prioridade?: string
          responsavel_id?: string | null
          status?: string
          tipo?: string
          titulo?: string
          updated_at?: string
          vence_em?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "negocios_tarefas_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocios"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          agrupar_similares: boolean
          categorias_silenciadas: string[]
          dashboard_alerts_enabled: boolean
          horario_silencio_fim: string | null
          horario_silencio_inicio: string | null
          id: string
          intervalo_minimo_minutos: number
          popup_enabled: boolean
          push_enabled: boolean
          updated_at: string
          user_id: string
          whatsapp_enabled: boolean
        }
        Insert: {
          agrupar_similares?: boolean
          categorias_silenciadas?: string[]
          dashboard_alerts_enabled?: boolean
          horario_silencio_fim?: string | null
          horario_silencio_inicio?: string | null
          id?: string
          intervalo_minimo_minutos?: number
          popup_enabled?: boolean
          push_enabled?: boolean
          updated_at?: string
          user_id: string
          whatsapp_enabled?: boolean
        }
        Update: {
          agrupar_similares?: boolean
          categorias_silenciadas?: string[]
          dashboard_alerts_enabled?: boolean
          horario_silencio_fim?: string | null
          horario_silencio_inicio?: string | null
          id?: string
          intervalo_minimo_minutos?: number
          popup_enabled?: boolean
          push_enabled?: boolean
          updated_at?: string
          user_id?: string
          whatsapp_enabled?: boolean
        }
        Relationships: []
      }
      notifications: {
        Row: {
          agrupamento_count: number
          agrupamento_key: string | null
          cargo_destino: string[] | null
          categoria: string
          created_at: string
          dados: Json | null
          id: string
          lida: boolean
          lida_em: string | null
          mensagem: string
          tipo: string
          titulo: string
          user_id: string
        }
        Insert: {
          agrupamento_count?: number
          agrupamento_key?: string | null
          cargo_destino?: string[] | null
          categoria: string
          created_at?: string
          dados?: Json | null
          id?: string
          lida?: boolean
          lida_em?: string | null
          mensagem: string
          tipo: string
          titulo: string
          user_id: string
        }
        Update: {
          agrupamento_count?: number
          agrupamento_key?: string | null
          cargo_destino?: string[] | null
          categoria?: string
          created_at?: string
          dados?: Json | null
          id?: string
          lida?: boolean
          lida_em?: string | null
          mensagem?: string
          tipo?: string
          titulo?: string
          user_id?: string
        }
        Relationships: []
      }
      oa_events: {
        Row: {
          attempt_id: string | null
          created_at: string
          event_type: string
          id: string
          lead_id: string | null
          lista_id: string | null
          metadata: Json | null
          session_id: string | null
          user_id: string
        }
        Insert: {
          attempt_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          lead_id?: string | null
          lista_id?: string | null
          metadata?: Json | null
          session_id?: string | null
          user_id: string
        }
        Update: {
          attempt_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          lead_id?: string | null
          lista_id?: string | null
          metadata?: Json | null
          session_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "oa_events_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "oferta_ativa_tentativas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "oa_events_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "oferta_ativa_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "oa_events_lista_id_fkey"
            columns: ["lista_id"]
            isOneToOne: false
            referencedRelation: "oferta_ativa_listas"
            referencedColumns: ["id"]
          },
        ]
      }
      oferta_ativa_leads: {
        Row: {
          cadastrado_jetimob: boolean
          cadastrado_jetimob_em: string | null
          campanha: string | null
          corretor_id: string | null
          created_at: string
          data_lead: string | null
          em_atendimento_ate: string | null
          em_atendimento_por: string | null
          email: string | null
          empreendimento: string | null
          id: string
          interesse_tipo: string | null
          jetimob_id: string | null
          lista_id: string
          motivo_descarte: string | null
          nome: string
          observacoes: string | null
          origem: string | null
          proxima_tentativa_apos: string | null
          status: string
          telefone: string | null
          telefone_normalizado: string | null
          telefone2: string | null
          tentativas_count: number
          ultima_tentativa: string | null
          updated_at: string
        }
        Insert: {
          cadastrado_jetimob?: boolean
          cadastrado_jetimob_em?: string | null
          campanha?: string | null
          corretor_id?: string | null
          created_at?: string
          data_lead?: string | null
          em_atendimento_ate?: string | null
          em_atendimento_por?: string | null
          email?: string | null
          empreendimento?: string | null
          id?: string
          interesse_tipo?: string | null
          jetimob_id?: string | null
          lista_id: string
          motivo_descarte?: string | null
          nome: string
          observacoes?: string | null
          origem?: string | null
          proxima_tentativa_apos?: string | null
          status?: string
          telefone?: string | null
          telefone_normalizado?: string | null
          telefone2?: string | null
          tentativas_count?: number
          ultima_tentativa?: string | null
          updated_at?: string
        }
        Update: {
          cadastrado_jetimob?: boolean
          cadastrado_jetimob_em?: string | null
          campanha?: string | null
          corretor_id?: string | null
          created_at?: string
          data_lead?: string | null
          em_atendimento_ate?: string | null
          em_atendimento_por?: string | null
          email?: string | null
          empreendimento?: string | null
          id?: string
          interesse_tipo?: string | null
          jetimob_id?: string | null
          lista_id?: string
          motivo_descarte?: string | null
          nome?: string
          observacoes?: string | null
          origem?: string | null
          proxima_tentativa_apos?: string | null
          status?: string
          telefone?: string | null
          telefone_normalizado?: string | null
          telefone2?: string | null
          tentativas_count?: number
          ultima_tentativa?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "oferta_ativa_leads_lista_id_fkey"
            columns: ["lista_id"]
            isOneToOne: false
            referencedRelation: "oferta_ativa_listas"
            referencedColumns: ["id"]
          },
        ]
      }
      oferta_ativa_listas: {
        Row: {
          campanha: string | null
          cooldown_dias: number
          created_at: string
          criado_por: string
          empreendimento: string
          id: string
          max_tentativas: number
          nome: string
          origem: string | null
          status: string
          total_leads: number
          updated_at: string
        }
        Insert: {
          campanha?: string | null
          cooldown_dias?: number
          created_at?: string
          criado_por: string
          empreendimento: string
          id?: string
          max_tentativas?: number
          nome: string
          origem?: string | null
          status?: string
          total_leads?: number
          updated_at?: string
        }
        Update: {
          campanha?: string | null
          cooldown_dias?: number
          created_at?: string
          criado_por?: string
          empreendimento?: string
          id?: string
          max_tentativas?: number
          nome?: string
          origem?: string | null
          status?: string
          total_leads?: number
          updated_at?: string
        }
        Relationships: []
      }
      oferta_ativa_templates: {
        Row: {
          canal: string
          conteudo: string
          created_at: string
          criado_por: string
          empreendimento: string | null
          id: string
          tipo: string
          titulo: string
        }
        Insert: {
          canal: string
          conteudo: string
          created_at?: string
          criado_por: string
          empreendimento?: string | null
          id?: string
          tipo: string
          titulo: string
        }
        Update: {
          canal?: string
          conteudo?: string
          created_at?: string
          criado_por?: string
          empreendimento?: string | null
          id?: string
          tipo?: string
          titulo?: string
        }
        Relationships: []
      }
      oferta_ativa_tentativas: {
        Row: {
          canal: string
          corretor_id: string
          created_at: string
          empreendimento: string | null
          feedback: string
          id: string
          idempotency_key: string | null
          lead_id: string
          lista_id: string | null
          pontos: number
          resultado: string
        }
        Insert: {
          canal: string
          corretor_id: string
          created_at?: string
          empreendimento?: string | null
          feedback: string
          id?: string
          idempotency_key?: string | null
          lead_id: string
          lista_id?: string | null
          pontos?: number
          resultado: string
        }
        Update: {
          canal?: string
          corretor_id?: string
          created_at?: string
          empreendimento?: string | null
          feedback?: string
          id?: string
          idempotency_key?: string | null
          lead_id?: string
          lista_id?: string | null
          pontos?: number
          resultado?: string
        }
        Relationships: [
          {
            foreignKeyName: "oferta_ativa_tentativas_lista_id_fkey"
            columns: ["lista_id"]
            isOneToOne: false
            referencedRelation: "oferta_ativa_listas"
            referencedColumns: ["id"]
          },
        ]
      }
      one_on_one_reports: {
        Row: {
          aprovado_em: string | null
          aprovado_por: string | null
          conteudo_relatorio: string | null
          contexto_auto: string | null
          corretor_id: string
          corretor_nome: string
          created_at: string
          dados_semana: Json
          gerente_id: string
          id: string
          periodo_fim: string
          periodo_inicio: string
          score_performance: number | null
          status: string
          updated_at: string
        }
        Insert: {
          aprovado_em?: string | null
          aprovado_por?: string | null
          conteudo_relatorio?: string | null
          contexto_auto?: string | null
          corretor_id: string
          corretor_nome?: string
          created_at?: string
          dados_semana?: Json
          gerente_id: string
          id?: string
          periodo_fim: string
          periodo_inicio: string
          score_performance?: number | null
          status?: string
          updated_at?: string
        }
        Update: {
          aprovado_em?: string | null
          aprovado_por?: string | null
          conteudo_relatorio?: string | null
          contexto_auto?: string | null
          corretor_id?: string
          corretor_nome?: string
          created_at?: string
          dados_semana?: Json
          gerente_id?: string
          id?: string
          periodo_fim?: string
          periodo_inicio?: string
          score_performance?: number | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      pagadoria_config: {
        Row: {
          config: Json
          id: string
          tipo: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          config?: Json
          id?: string
          tipo: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          config?: Json
          id?: string
          tipo?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      pagadoria_credores: {
        Row: {
          created_at: string
          credor_id: string | null
          credor_nome: string
          credor_tipo: string
          id: string
          pagadoria_id: string
          parcelas: Json | null
          percentual: number
          valor: number
        }
        Insert: {
          created_at?: string
          credor_id?: string | null
          credor_nome: string
          credor_tipo?: string
          id?: string
          pagadoria_id: string
          parcelas?: Json | null
          percentual?: number
          valor?: number
        }
        Update: {
          created_at?: string
          credor_id?: string | null
          credor_nome?: string
          credor_tipo?: string
          id?: string
          pagadoria_id?: string
          parcelas?: Json | null
          percentual?: number
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "pagadoria_credores_pagadoria_id_fkey"
            columns: ["pagadoria_id"]
            isOneToOne: false
            referencedRelation: "pagadorias"
            referencedColumns: ["id"]
          },
        ]
      }
      pagadoria_solicitacoes: {
        Row: {
          comprovante_residencia_url: string | null
          contrato_pdf_url: string | null
          cpf: string | null
          cpf_url: string | null
          created_at: string
          email: string | null
          empreendimento: string | null
          ficha_construtora_url: string | null
          id: string
          negocio_id: string
          nome_cliente: string
          obs_backoffice: string | null
          observacoes: string | null
          percentual_comissao: number | null
          rg: string | null
          rg_url: string | null
          solicitante_id: string
          status: string
          telefone: string | null
          unidade: string | null
          updated_at: string
          vgv_contrato: number | null
        }
        Insert: {
          comprovante_residencia_url?: string | null
          contrato_pdf_url?: string | null
          cpf?: string | null
          cpf_url?: string | null
          created_at?: string
          email?: string | null
          empreendimento?: string | null
          ficha_construtora_url?: string | null
          id?: string
          negocio_id: string
          nome_cliente: string
          obs_backoffice?: string | null
          observacoes?: string | null
          percentual_comissao?: number | null
          rg?: string | null
          rg_url?: string | null
          solicitante_id: string
          status?: string
          telefone?: string | null
          unidade?: string | null
          updated_at?: string
          vgv_contrato?: number | null
        }
        Update: {
          comprovante_residencia_url?: string | null
          contrato_pdf_url?: string | null
          cpf?: string | null
          cpf_url?: string | null
          created_at?: string
          email?: string | null
          empreendimento?: string | null
          ficha_construtora_url?: string | null
          id?: string
          negocio_id?: string
          nome_cliente?: string
          obs_backoffice?: string | null
          observacoes?: string | null
          percentual_comissao?: number | null
          rg?: string | null
          rg_url?: string | null
          solicitante_id?: string
          status?: string
          telefone?: string | null
          unidade?: string | null
          updated_at?: string
          vgv_contrato?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pagadoria_solicitacoes_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocios"
            referencedColumns: ["id"]
          },
        ]
      }
      pagadorias: {
        Row: {
          cliente_cpf: string | null
          cliente_email: string | null
          cliente_endereco: string | null
          cliente_nome: string
          cliente_telefone: string | null
          comissao_pct: number | null
          comissao_total: number | null
          contrato_gerado_em: string | null
          created_at: string
          criada_por: string
          data_venda: string
          docusign_link: string | null
          empreendimento: string
          forma_pagamento: string
          id: string
          notas: string | null
          parcelas_config: Json | null
          status: string
          unidade: string | null
          updated_at: string
          vgv: number
        }
        Insert: {
          cliente_cpf?: string | null
          cliente_email?: string | null
          cliente_endereco?: string | null
          cliente_nome: string
          cliente_telefone?: string | null
          comissao_pct?: number | null
          comissao_total?: number | null
          contrato_gerado_em?: string | null
          created_at?: string
          criada_por: string
          data_venda?: string
          docusign_link?: string | null
          empreendimento: string
          forma_pagamento?: string
          id?: string
          notas?: string | null
          parcelas_config?: Json | null
          status?: string
          unidade?: string | null
          updated_at?: string
          vgv?: number
        }
        Update: {
          cliente_cpf?: string | null
          cliente_email?: string | null
          cliente_endereco?: string | null
          cliente_nome?: string
          cliente_telefone?: string | null
          comissao_pct?: number | null
          comissao_total?: number | null
          contrato_gerado_em?: string | null
          created_at?: string
          criada_por?: string
          data_venda?: string
          docusign_link?: string | null
          empreendimento?: string
          forma_pagamento?: string
          id?: string
          notas?: string | null
          parcelas_config?: Json | null
          status?: string
          unidade?: string | null
          updated_at?: string
          vgv?: number
        }
        Relationships: []
      }
      pdn_entries: {
        Row: {
          corretor: string | null
          created_at: string
          created_from_visit: boolean
          data_proxima_acao: string | null
          data_visita: string | null
          docs_status: string
          empreendimento: string | null
          equipe: string | null
          gerente_id: string
          id: string
          linked_visit_id: string | null
          mes: string
          motivo_queda: string | null
          nome: string
          objecao_cliente: string | null
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
          created_from_visit?: boolean
          data_proxima_acao?: string | null
          data_visita?: string | null
          docs_status?: string
          empreendimento?: string | null
          equipe?: string | null
          gerente_id: string
          id?: string
          linked_visit_id?: string | null
          mes: string
          motivo_queda?: string | null
          nome: string
          objecao_cliente?: string | null
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
          created_from_visit?: boolean
          data_proxima_acao?: string | null
          data_visita?: string | null
          docs_status?: string
          empreendimento?: string | null
          equipe?: string | null
          gerente_id?: string
          id?: string
          linked_visit_id?: string | null
          mes?: string
          motivo_queda?: string | null
          nome?: string
          objecao_cliente?: string | null
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
        Relationships: [
          {
            foreignKeyName: "pdn_entries_linked_visit_id_fkey"
            columns: ["linked_visit_id"]
            isOneToOne: false
            referencedRelation: "visitas"
            referencedColumns: ["id"]
          },
        ]
      }
      pipeline_anotacoes: {
        Row: {
          autor_id: string
          autor_nome: string | null
          conteudo: string
          created_at: string
          fixada: boolean
          id: string
          pipeline_lead_id: string
        }
        Insert: {
          autor_id: string
          autor_nome?: string | null
          conteudo: string
          created_at?: string
          fixada?: boolean
          id?: string
          pipeline_lead_id: string
        }
        Update: {
          autor_id?: string
          autor_nome?: string | null
          conteudo?: string
          created_at?: string
          fixada?: boolean
          id?: string
          pipeline_lead_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_anotacoes_pipeline_lead_id_fkey"
            columns: ["pipeline_lead_id"]
            isOneToOne: false
            referencedRelation: "pipeline_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      pipeline_atividades: {
        Row: {
          created_at: string
          created_by: string
          data: string
          descricao: string | null
          hora: string | null
          id: string
          pipeline_lead_id: string
          prioridade: string
          responsavel_id: string | null
          status: string
          tipo: string
          titulo: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          data?: string
          descricao?: string | null
          hora?: string | null
          id?: string
          pipeline_lead_id: string
          prioridade?: string
          responsavel_id?: string | null
          status?: string
          tipo?: string
          titulo: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          data?: string
          descricao?: string | null
          hora?: string | null
          id?: string
          pipeline_lead_id?: string
          prioridade?: string
          responsavel_id?: string | null
          status?: string
          tipo?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_atividades_pipeline_lead_id_fkey"
            columns: ["pipeline_lead_id"]
            isOneToOne: false
            referencedRelation: "pipeline_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      pipeline_comissoes: {
        Row: {
          corretor_id: string
          created_at: string
          id: string
          papel: string
          percentual: number
          pipeline_lead_id: string
          registrado_por: string
          valor_comissao: number | null
        }
        Insert: {
          corretor_id: string
          created_at?: string
          id?: string
          papel?: string
          percentual?: number
          pipeline_lead_id: string
          registrado_por: string
          valor_comissao?: number | null
        }
        Update: {
          corretor_id?: string
          created_at?: string
          id?: string
          papel?: string
          percentual?: number
          pipeline_lead_id?: string
          registrado_por?: string
          valor_comissao?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_comissoes_pipeline_lead_id_fkey"
            columns: ["pipeline_lead_id"]
            isOneToOne: false
            referencedRelation: "pipeline_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      pipeline_historico: {
        Row: {
          created_at: string
          id: string
          movido_por: string
          observacao: string | null
          pipeline_lead_id: string
          stage_anterior_id: string | null
          stage_novo_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          movido_por: string
          observacao?: string | null
          pipeline_lead_id: string
          stage_anterior_id?: string | null
          stage_novo_id: string
        }
        Update: {
          created_at?: string
          id?: string
          movido_por?: string
          observacao?: string | null
          pipeline_lead_id?: string
          stage_anterior_id?: string | null
          stage_novo_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_historico_pipeline_lead_id_fkey"
            columns: ["pipeline_lead_id"]
            isOneToOne: false
            referencedRelation: "pipeline_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipeline_historico_stage_anterior_id_fkey"
            columns: ["stage_anterior_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipeline_historico_stage_novo_id_fkey"
            columns: ["stage_novo_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      pipeline_lead_sequencias: {
        Row: {
          concluida_em: string | null
          created_at: string
          id: string
          iniciada_em: string
          passo_atual: number
          pausada_em: string | null
          pipeline_lead_id: string
          proximo_envio_em: string | null
          sequencia_id: string
          status: string
        }
        Insert: {
          concluida_em?: string | null
          created_at?: string
          id?: string
          iniciada_em?: string
          passo_atual?: number
          pausada_em?: string | null
          pipeline_lead_id: string
          proximo_envio_em?: string | null
          sequencia_id: string
          status?: string
        }
        Update: {
          concluida_em?: string | null
          created_at?: string
          id?: string
          iniciada_em?: string
          passo_atual?: number
          pausada_em?: string | null
          pipeline_lead_id?: string
          proximo_envio_em?: string | null
          sequencia_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_lead_sequencias_pipeline_lead_id_fkey"
            columns: ["pipeline_lead_id"]
            isOneToOne: false
            referencedRelation: "pipeline_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipeline_lead_sequencias_sequencia_id_fkey"
            columns: ["sequencia_id"]
            isOneToOne: false
            referencedRelation: "pipeline_sequencias"
            referencedColumns: ["id"]
          },
        ]
      }
      pipeline_leads: {
        Row: {
          aceite_expira_em: string | null
          aceite_status: string
          aceito_em: string | null
          anuncio: string | null
          bairro_regiao: string | null
          campanha: string | null
          campanha_id: string | null
          complexidade_score: number
          conjunto_anuncio: string | null
          corretor_id: string | null
          created_at: string
          created_by: string | null
          data_proxima_acao: string | null
          distribuido_em: string | null
          email: string | null
          empreendimento: string | null
          escalation_level: number | null
          forma_pagamento: string | null
          formulario: string | null
          gerente_id: string | null
          hora_proxima_acao: string | null
          id: string
          imovel_troca: boolean | null
          jetimob_lead_id: string | null
          last_escalation_at: string | null
          modo_conducao: string
          modulo_atual: string
          motivo_descarte: string | null
          motivo_rejeicao: string | null
          negocio_id: string | null
          nivel_interesse: string | null
          nome: string
          objetivo_cliente: string | null
          observacoes: string | null
          oportunidade_score: number | null
          ordem_no_stage: number
          origem: string | null
          origem_detalhe: string | null
          plataforma: string | null
          primeiro_contato_em: string | null
          prioridade_acao: string | null
          prioridade_lead: string
          produto_id: string | null
          proxima_acao: string | null
          radar_atualizado_em: string | null
          radar_bairros: string[] | null
          radar_quartos: number | null
          radar_status_imovel: string | null
          radar_tipologia: string | null
          radar_valor_max: number | null
          segmento_id: string | null
          stage_changed_at: string
          stage_id: string
          telefone: string | null
          telefone2: string | null
          temperatura: string | null
          ultima_acao_at: string | null
          updated_at: string
          valor_estimado: number | null
        }
        Insert: {
          aceite_expira_em?: string | null
          aceite_status?: string
          aceito_em?: string | null
          anuncio?: string | null
          bairro_regiao?: string | null
          campanha?: string | null
          campanha_id?: string | null
          complexidade_score?: number
          conjunto_anuncio?: string | null
          corretor_id?: string | null
          created_at?: string
          created_by?: string | null
          data_proxima_acao?: string | null
          distribuido_em?: string | null
          email?: string | null
          empreendimento?: string | null
          escalation_level?: number | null
          forma_pagamento?: string | null
          formulario?: string | null
          gerente_id?: string | null
          hora_proxima_acao?: string | null
          id?: string
          imovel_troca?: boolean | null
          jetimob_lead_id?: string | null
          last_escalation_at?: string | null
          modo_conducao?: string
          modulo_atual?: string
          motivo_descarte?: string | null
          motivo_rejeicao?: string | null
          negocio_id?: string | null
          nivel_interesse?: string | null
          nome: string
          objetivo_cliente?: string | null
          observacoes?: string | null
          oportunidade_score?: number | null
          ordem_no_stage?: number
          origem?: string | null
          origem_detalhe?: string | null
          plataforma?: string | null
          primeiro_contato_em?: string | null
          prioridade_acao?: string | null
          prioridade_lead?: string
          produto_id?: string | null
          proxima_acao?: string | null
          radar_atualizado_em?: string | null
          radar_bairros?: string[] | null
          radar_quartos?: number | null
          radar_status_imovel?: string | null
          radar_tipologia?: string | null
          radar_valor_max?: number | null
          segmento_id?: string | null
          stage_changed_at?: string
          stage_id: string
          telefone?: string | null
          telefone2?: string | null
          temperatura?: string | null
          ultima_acao_at?: string | null
          updated_at?: string
          valor_estimado?: number | null
        }
        Update: {
          aceite_expira_em?: string | null
          aceite_status?: string
          aceito_em?: string | null
          anuncio?: string | null
          bairro_regiao?: string | null
          campanha?: string | null
          campanha_id?: string | null
          complexidade_score?: number
          conjunto_anuncio?: string | null
          corretor_id?: string | null
          created_at?: string
          created_by?: string | null
          data_proxima_acao?: string | null
          distribuido_em?: string | null
          email?: string | null
          empreendimento?: string | null
          escalation_level?: number | null
          forma_pagamento?: string | null
          formulario?: string | null
          gerente_id?: string | null
          hora_proxima_acao?: string | null
          id?: string
          imovel_troca?: boolean | null
          jetimob_lead_id?: string | null
          last_escalation_at?: string | null
          modo_conducao?: string
          modulo_atual?: string
          motivo_descarte?: string | null
          motivo_rejeicao?: string | null
          negocio_id?: string | null
          nivel_interesse?: string | null
          nome?: string
          objetivo_cliente?: string | null
          observacoes?: string | null
          oportunidade_score?: number | null
          ordem_no_stage?: number
          origem?: string | null
          origem_detalhe?: string | null
          plataforma?: string | null
          primeiro_contato_em?: string | null
          prioridade_acao?: string | null
          prioridade_lead?: string
          produto_id?: string | null
          proxima_acao?: string | null
          radar_atualizado_em?: string | null
          radar_bairros?: string[] | null
          radar_quartos?: number | null
          radar_status_imovel?: string | null
          radar_tipologia?: string | null
          radar_valor_max?: number | null
          segmento_id?: string | null
          stage_changed_at?: string
          stage_id?: string
          telefone?: string | null
          telefone2?: string | null
          temperatura?: string | null
          ultima_acao_at?: string | null
          updated_at?: string
          valor_estimado?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_leads_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipeline_leads_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "pipeline_produtos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipeline_leads_segmento_id_fkey"
            columns: ["segmento_id"]
            isOneToOne: false
            referencedRelation: "pipeline_segmentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipeline_leads_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      pipeline_materiais: {
        Row: {
          arquivo_nome: string | null
          ativo: boolean
          categoria: string
          created_at: string
          criado_por: string
          descricao: string | null
          empreendimento: string | null
          id: string
          tamanho_bytes: number | null
          tipo: string
          titulo: string
          updated_at: string
          url: string
        }
        Insert: {
          arquivo_nome?: string | null
          ativo?: boolean
          categoria?: string
          created_at?: string
          criado_por: string
          descricao?: string | null
          empreendimento?: string | null
          id?: string
          tamanho_bytes?: number | null
          tipo?: string
          titulo: string
          updated_at?: string
          url: string
        }
        Update: {
          arquivo_nome?: string | null
          ativo?: boolean
          categoria?: string
          created_at?: string
          criado_por?: string
          descricao?: string | null
          empreendimento?: string | null
          id?: string
          tamanho_bytes?: number | null
          tipo?: string
          titulo?: string
          updated_at?: string
          url?: string
        }
        Relationships: []
      }
      pipeline_parcerias: {
        Row: {
          corretor_parceiro_id: string
          corretor_principal_id: string
          created_at: string
          criado_por: string
          divisao_parceiro: number
          divisao_principal: number
          id: string
          motivo: string | null
          pipeline_lead_id: string
          status: string
          updated_at: string
        }
        Insert: {
          corretor_parceiro_id: string
          corretor_principal_id: string
          created_at?: string
          criado_por: string
          divisao_parceiro?: number
          divisao_principal?: number
          id?: string
          motivo?: string | null
          pipeline_lead_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          corretor_parceiro_id?: string
          corretor_principal_id?: string
          created_at?: string
          criado_por?: string
          divisao_parceiro?: number
          divisao_principal?: number
          id?: string
          motivo?: string | null
          pipeline_lead_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_parcerias_pipeline_lead_id_fkey"
            columns: ["pipeline_lead_id"]
            isOneToOne: false
            referencedRelation: "pipeline_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      pipeline_produtos: {
        Row: {
          ativo: boolean
          created_at: string
          descricao: string | null
          id: string
          nome: string
          segmento_id: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          nome: string
          segmento_id: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          nome?: string
          segmento_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_produtos_segmento_id_fkey"
            columns: ["segmento_id"]
            isOneToOne: false
            referencedRelation: "pipeline_segmentos"
            referencedColumns: ["id"]
          },
        ]
      }
      pipeline_segmentos: {
        Row: {
          ativo: boolean
          cor: string | null
          created_at: string
          descricao: string | null
          empreendimentos: string[]
          id: string
          max_leads_ativos: number
          nome: string
          ordem: number
          roleta_fim: string | null
          roleta_inicio: string | null
          sla_minutos: number
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          cor?: string | null
          created_at?: string
          descricao?: string | null
          empreendimentos?: string[]
          id?: string
          max_leads_ativos?: number
          nome: string
          ordem?: number
          roleta_fim?: string | null
          roleta_inicio?: string | null
          sla_minutos?: number
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          cor?: string | null
          created_at?: string
          descricao?: string | null
          empreendimentos?: string[]
          id?: string
          max_leads_ativos?: number
          nome?: string
          ordem?: number
          roleta_fim?: string | null
          roleta_inicio?: string | null
          sla_minutos?: number
          updated_at?: string
        }
        Relationships: []
      }
      pipeline_sequencia_passos: {
        Row: {
          ativo: boolean
          canal: string
          conteudo: string | null
          created_at: string
          dias_apos_inicio: number
          id: string
          material_id: string | null
          ordem: number
          sequencia_id: string
          tipo: string
          titulo: string
        }
        Insert: {
          ativo?: boolean
          canal?: string
          conteudo?: string | null
          created_at?: string
          dias_apos_inicio?: number
          id?: string
          material_id?: string | null
          ordem?: number
          sequencia_id: string
          tipo?: string
          titulo: string
        }
        Update: {
          ativo?: boolean
          canal?: string
          conteudo?: string | null
          created_at?: string
          dias_apos_inicio?: number
          id?: string
          material_id?: string | null
          ordem?: number
          sequencia_id?: string
          tipo?: string
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_sequencia_passos_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "pipeline_materiais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipeline_sequencia_passos_sequencia_id_fkey"
            columns: ["sequencia_id"]
            isOneToOne: false
            referencedRelation: "pipeline_sequencias"
            referencedColumns: ["id"]
          },
        ]
      }
      pipeline_sequencias: {
        Row: {
          ativa: boolean
          created_at: string
          criado_por: string
          descricao: string | null
          empreendimento: string | null
          id: string
          nome: string
          segmento_id: string | null
          stage_gatilho: string
          updated_at: string
        }
        Insert: {
          ativa?: boolean
          created_at?: string
          criado_por: string
          descricao?: string | null
          empreendimento?: string | null
          id?: string
          nome: string
          segmento_id?: string | null
          stage_gatilho?: string
          updated_at?: string
        }
        Update: {
          ativa?: boolean
          created_at?: string
          criado_por?: string
          descricao?: string | null
          empreendimento?: string | null
          id?: string
          nome?: string
          segmento_id?: string | null
          stage_gatilho?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_sequencias_segmento_id_fkey"
            columns: ["segmento_id"]
            isOneToOne: false
            referencedRelation: "pipeline_segmentos"
            referencedColumns: ["id"]
          },
        ]
      }
      pipeline_stages: {
        Row: {
          ativo: boolean
          cor: string | null
          id: string
          nome: string
          ordem: number
          pipeline_tipo: string
          tipo: string
        }
        Insert: {
          ativo?: boolean
          cor?: string | null
          id?: string
          nome: string
          ordem?: number
          pipeline_tipo?: string
          tipo: string
        }
        Update: {
          ativo?: boolean
          cor?: string | null
          id?: string
          nome?: string
          ordem?: number
          pipeline_tipo?: string
          tipo?: string
        }
        Relationships: []
      }
      pipeline_tarefas: {
        Row: {
          concluida_em: string | null
          created_at: string
          created_by: string
          descricao: string | null
          hora_vencimento: string | null
          id: string
          pipeline_lead_id: string
          prioridade: string
          responsavel_id: string | null
          status: string
          tipo: string | null
          titulo: string
          updated_at: string
          vence_em: string | null
        }
        Insert: {
          concluida_em?: string | null
          created_at?: string
          created_by: string
          descricao?: string | null
          hora_vencimento?: string | null
          id?: string
          pipeline_lead_id: string
          prioridade?: string
          responsavel_id?: string | null
          status?: string
          tipo?: string | null
          titulo: string
          updated_at?: string
          vence_em?: string | null
        }
        Update: {
          concluida_em?: string | null
          created_at?: string
          created_by?: string
          descricao?: string | null
          hora_vencimento?: string | null
          id?: string
          pipeline_lead_id?: string
          prioridade?: string
          responsavel_id?: string | null
          status?: string
          tipo?: string | null
          titulo?: string
          updated_at?: string
          vence_em?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_tarefas_pipeline_lead_id_fkey"
            columns: ["pipeline_lead_id"]
            isOneToOne: false
            referencedRelation: "pipeline_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_vendas: {
        Row: {
          corretor_id: string | null
          created_at: string | null
          data_assinatura: string | null
          empreendimento: string | null
          id: string
          indicacoes: number | null
          lead_id: string | null
          negocio_id: string | null
          nome_cliente: string
          nps_score: number | null
          observacoes: string | null
          vgv_final: number | null
        }
        Insert: {
          corretor_id?: string | null
          created_at?: string | null
          data_assinatura?: string | null
          empreendimento?: string | null
          id?: string
          indicacoes?: number | null
          lead_id?: string | null
          negocio_id?: string | null
          nome_cliente: string
          nps_score?: number | null
          observacoes?: string | null
          vgv_final?: number | null
        }
        Update: {
          corretor_id?: string | null
          created_at?: string | null
          data_assinatura?: string | null
          empreendimento?: string | null
          id?: string
          indicacoes?: number | null
          lead_id?: string | null
          negocio_id?: string | null
          nome_cliente?: string
          nps_score?: number | null
          observacoes?: string | null
          vgv_final?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pos_vendas_corretor_id_fkey"
            columns: ["corretor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_vendas_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocios"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_gamificado_url: string | null
          avatar_preview_url: string | null
          avatar_updated_at: string | null
          avatar_url: string | null
          cargo: string | null
          cpf: string | null
          created_at: string
          creci: string | null
          email: string | null
          id: string
          jetimob_user_id: string | null
          nome: string
          status_online: string | null
          status_updated_at: string | null
          telefone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_gamificado_url?: string | null
          avatar_preview_url?: string | null
          avatar_updated_at?: string | null
          avatar_url?: string | null
          cargo?: string | null
          cpf?: string | null
          created_at?: string
          creci?: string | null
          email?: string | null
          id?: string
          jetimob_user_id?: string | null
          nome?: string
          status_online?: string | null
          status_updated_at?: string | null
          telefone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_gamificado_url?: string | null
          avatar_preview_url?: string | null
          avatar_updated_at?: string | null
          avatar_url?: string | null
          cargo?: string | null
          cpf?: string | null
          created_at?: string
          creci?: string | null
          email?: string | null
          id?: string
          jetimob_user_id?: string | null
          nome?: string
          status_online?: string | null
          status_updated_at?: string | null
          telefone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      pulse_desafio_contribuicoes: {
        Row: {
          corretor_id: string
          created_at: string | null
          desafio_id: string
          event_id: string | null
          id: string
          quantidade: number
        }
        Insert: {
          corretor_id: string
          created_at?: string | null
          desafio_id: string
          event_id?: string | null
          id?: string
          quantidade?: number
        }
        Update: {
          corretor_id?: string
          created_at?: string | null
          desafio_id?: string
          event_id?: string | null
          id?: string
          quantidade?: number
        }
        Relationships: [
          {
            foreignKeyName: "pulse_desafio_contribuicoes_desafio_id_fkey"
            columns: ["desafio_id"]
            isOneToOne: false
            referencedRelation: "pulse_desafios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pulse_desafio_contribuicoes_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "pulse_events"
            referencedColumns: ["id"]
          },
        ]
      }
      pulse_desafios: {
        Row: {
          created_at: string | null
          criado_por: string
          data_fim: string
          data_inicio: string
          descricao: string | null
          id: string
          meta: number
          metrica: string
          progresso_atual: number | null
          recompensa_badge: string | null
          status: string
          tipo: string
          titulo: string
        }
        Insert: {
          created_at?: string | null
          criado_por: string
          data_fim: string
          data_inicio: string
          descricao?: string | null
          id?: string
          meta: number
          metrica: string
          progresso_atual?: number | null
          recompensa_badge?: string | null
          status?: string
          tipo?: string
          titulo: string
        }
        Update: {
          created_at?: string | null
          criado_por?: string
          data_fim?: string
          data_inicio?: string
          descricao?: string | null
          id?: string
          meta?: number
          metrica?: string
          progresso_atual?: number | null
          recompensa_badge?: string | null
          status?: string
          tipo?: string
          titulo?: string
        }
        Relationships: []
      }
      pulse_events: {
        Row: {
          agrupamento_key: string | null
          corretor_id: string
          created_at: string | null
          desafio_id: string | null
          descricao: string | null
          gerente_id: string | null
          id: string
          metadata: Json | null
          prioridade: string
          tipo: string
          titulo: string
        }
        Insert: {
          agrupamento_key?: string | null
          corretor_id: string
          created_at?: string | null
          desafio_id?: string | null
          descricao?: string | null
          gerente_id?: string | null
          id?: string
          metadata?: Json | null
          prioridade?: string
          tipo: string
          titulo: string
        }
        Update: {
          agrupamento_key?: string | null
          corretor_id?: string
          created_at?: string | null
          desafio_id?: string | null
          descricao?: string | null
          gerente_id?: string | null
          id?: string
          metadata?: Json | null
          prioridade?: string
          tipo?: string
          titulo?: string
        }
        Relationships: []
      }
      pulse_reactions: {
        Row: {
          created_at: string | null
          emoji: string
          event_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          emoji: string
          event_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          emoji?: string
          event_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pulse_reactions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "pulse_events"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      referral_config: {
        Row: {
          ativo: boolean
          descricao_premiacao: string | null
          id: string
          regra_conversao: string
          tipo_premiacao: string
          updated_at: string
          updated_by: string | null
          valor_premiacao: number
        }
        Insert: {
          ativo?: boolean
          descricao_premiacao?: string | null
          id?: string
          regra_conversao?: string
          tipo_premiacao?: string
          updated_at?: string
          updated_by?: string | null
          valor_premiacao?: number
        }
        Update: {
          ativo?: boolean
          descricao_premiacao?: string | null
          id?: string
          regra_conversao?: string
          tipo_premiacao?: string
          updated_at?: string
          updated_by?: string | null
          valor_premiacao?: number
        }
        Relationships: []
      }
      referral_leads: {
        Row: {
          convertido: boolean
          convertido_em: string | null
          created_at: string
          email: string | null
          id: string
          interesse: string | null
          nome: string
          pipeline_lead_id: string | null
          referral_id: string
          status: string
          telefone: string | null
        }
        Insert: {
          convertido?: boolean
          convertido_em?: string | null
          created_at?: string
          email?: string | null
          id?: string
          interesse?: string | null
          nome: string
          pipeline_lead_id?: string | null
          referral_id: string
          status?: string
          telefone?: string | null
        }
        Update: {
          convertido?: boolean
          convertido_em?: string | null
          created_at?: string
          email?: string | null
          id?: string
          interesse?: string | null
          nome?: string
          pipeline_lead_id?: string | null
          referral_id?: string
          status?: string
          telefone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "referral_leads_referral_id_fkey"
            columns: ["referral_id"]
            isOneToOne: false
            referencedRelation: "referrals"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_rewards: {
        Row: {
          created_at: string
          id: string
          processado_em: string | null
          referral_id: string
          referral_lead_id: string
          status: string
          tipo: string
          valor: number
        }
        Insert: {
          created_at?: string
          id?: string
          processado_em?: string | null
          referral_id: string
          referral_lead_id: string
          status?: string
          tipo?: string
          valor?: number
        }
        Update: {
          created_at?: string
          id?: string
          processado_em?: string | null
          referral_id?: string
          referral_lead_id?: string
          status?: string
          tipo?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "referral_rewards_referral_id_fkey"
            columns: ["referral_id"]
            isOneToOne: false
            referencedRelation: "referrals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_rewards_referral_lead_id_fkey"
            columns: ["referral_lead_id"]
            isOneToOne: false
            referencedRelation: "referral_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      referrals: {
        Row: {
          ativo: boolean
          cliente_email: string | null
          cliente_nome: string
          cliente_telefone: string | null
          codigo_unico: string
          corretor_id: string | null
          created_at: string
          created_by: string
          id: string
          indicacoes_convertidas: number
          pipeline_lead_id: string | null
          premiacao_acumulada: number
          total_indicacoes: number
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          cliente_email?: string | null
          cliente_nome: string
          cliente_telefone?: string | null
          codigo_unico: string
          corretor_id?: string | null
          created_at?: string
          created_by: string
          id?: string
          indicacoes_convertidas?: number
          pipeline_lead_id?: string | null
          premiacao_acumulada?: number
          total_indicacoes?: number
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          cliente_email?: string | null
          cliente_nome?: string
          cliente_telefone?: string | null
          codigo_unico?: string
          corretor_id?: string | null
          created_at?: string
          created_by?: string
          id?: string
          indicacoes_convertidas?: number
          pipeline_lead_id?: string | null
          premiacao_acumulada?: number
          total_indicacoes?: number
          updated_at?: string
        }
        Relationships: []
      }
      relatorios_1_1: {
        Row: {
          conteudo_json: Json
          corretor_id: string
          created_at: string
          dados_periodo: Json | null
          gerado_em: string
          gerente_id: string
          id: string
          periodo_fim: string
          periodo_inicio: string
        }
        Insert: {
          conteudo_json?: Json
          corretor_id: string
          created_at?: string
          dados_periodo?: Json | null
          gerado_em?: string
          gerente_id: string
          id?: string
          periodo_fim: string
          periodo_inicio: string
        }
        Update: {
          conteudo_json?: Json
          corretor_id?: string
          created_at?: string
          dados_periodo?: Json | null
          gerado_em?: string
          gerente_id?: string
          id?: string
          periodo_fim?: string
          periodo_inicio?: string
        }
        Relationships: []
      }
      rh_candidatos: {
        Row: {
          created_at: string
          created_by: string | null
          email: string | null
          etapa: string
          id: string
          nome: string
          observacoes: string | null
          origem: string | null
          telefone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          email?: string | null
          etapa?: string
          id?: string
          nome: string
          observacoes?: string | null
          origem?: string | null
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          email?: string | null
          etapa?: string
          id?: string
          nome?: string
          observacoes?: string | null
          origem?: string | null
          telefone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      rh_conversas: {
        Row: {
          colaborador_id: string
          colaborador_nome: string
          created_at: string
          created_by: string | null
          data_conversa: string
          id: string
          resumo: string | null
          tipo: string
        }
        Insert: {
          colaborador_id: string
          colaborador_nome: string
          created_at?: string
          created_by?: string | null
          data_conversa?: string
          id?: string
          resumo?: string | null
          tipo?: string
        }
        Update: {
          colaborador_id?: string
          colaborador_nome?: string
          created_at?: string
          created_by?: string | null
          data_conversa?: string
          id?: string
          resumo?: string | null
          tipo?: string
        }
        Relationships: []
      }
      roleta_campanhas: {
        Row: {
          ativo: boolean | null
          empreendimento: string
          id: string
          segmento_id: string | null
        }
        Insert: {
          ativo?: boolean | null
          empreendimento: string
          id?: string
          segmento_id?: string | null
        }
        Update: {
          ativo?: boolean | null
          empreendimento?: string
          id?: string
          segmento_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "roleta_campanhas_segmento_id_fkey"
            columns: ["segmento_id"]
            isOneToOne: false
            referencedRelation: "roleta_segmentos"
            referencedColumns: ["id"]
          },
        ]
      }
      roleta_credenciamentos: {
        Row: {
          aprovado_em: string | null
          aprovado_por: string | null
          corretor_id: string | null
          created_at: string | null
          data: string
          id: string
          janela: string
          saiu_em: string | null
          segmento_1_id: string | null
          segmento_2_id: string | null
          status: string | null
        }
        Insert: {
          aprovado_em?: string | null
          aprovado_por?: string | null
          corretor_id?: string | null
          created_at?: string | null
          data?: string
          id?: string
          janela: string
          saiu_em?: string | null
          segmento_1_id?: string | null
          segmento_2_id?: string | null
          status?: string | null
        }
        Update: {
          aprovado_em?: string | null
          aprovado_por?: string | null
          corretor_id?: string | null
          created_at?: string | null
          data?: string
          id?: string
          janela?: string
          saiu_em?: string | null
          segmento_1_id?: string | null
          segmento_2_id?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "roleta_credenciamentos_aprovado_por_fkey"
            columns: ["aprovado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roleta_credenciamentos_corretor_id_fkey"
            columns: ["corretor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roleta_credenciamentos_segmento_1_id_fkey"
            columns: ["segmento_1_id"]
            isOneToOne: false
            referencedRelation: "roleta_segmentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roleta_credenciamentos_segmento_2_id_fkey"
            columns: ["segmento_2_id"]
            isOneToOne: false
            referencedRelation: "roleta_segmentos"
            referencedColumns: ["id"]
          },
        ]
      }
      roleta_distribuicoes: {
        Row: {
          aceito_em: string | null
          avisos_enviados: number | null
          corretor_id: string | null
          enviado_em: string | null
          expira_em: string | null
          id: string
          janela: string
          lead_id: string | null
          primeira_interacao_em: string | null
          segmento_id: string | null
          status: string | null
        }
        Insert: {
          aceito_em?: string | null
          avisos_enviados?: number | null
          corretor_id?: string | null
          enviado_em?: string | null
          expira_em?: string | null
          id?: string
          janela: string
          lead_id?: string | null
          primeira_interacao_em?: string | null
          segmento_id?: string | null
          status?: string | null
        }
        Update: {
          aceito_em?: string | null
          avisos_enviados?: number | null
          corretor_id?: string | null
          enviado_em?: string | null
          expira_em?: string | null
          id?: string
          janela?: string
          lead_id?: string | null
          primeira_interacao_em?: string | null
          segmento_id?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "roleta_distribuicoes_corretor_id_fkey"
            columns: ["corretor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roleta_distribuicoes_segmento_id_fkey"
            columns: ["segmento_id"]
            isOneToOne: false
            referencedRelation: "roleta_segmentos"
            referencedColumns: ["id"]
          },
        ]
      }
      roleta_fila: {
        Row: {
          ativo: boolean | null
          corretor_id: string | null
          credenciamento_id: string | null
          data: string
          id: string
          janela: string
          leads_recebidos: number | null
          posicao: number
          segmento_id: string | null
        }
        Insert: {
          ativo?: boolean | null
          corretor_id?: string | null
          credenciamento_id?: string | null
          data?: string
          id?: string
          janela: string
          leads_recebidos?: number | null
          posicao: number
          segmento_id?: string | null
        }
        Update: {
          ativo?: boolean | null
          corretor_id?: string | null
          credenciamento_id?: string | null
          data?: string
          id?: string
          janela?: string
          leads_recebidos?: number | null
          posicao?: number
          segmento_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "roleta_fila_corretor_id_fkey"
            columns: ["corretor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roleta_fila_credenciamento_id_fkey"
            columns: ["credenciamento_id"]
            isOneToOne: false
            referencedRelation: "roleta_credenciamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roleta_fila_segmento_id_fkey"
            columns: ["segmento_id"]
            isOneToOne: false
            referencedRelation: "roleta_segmentos"
            referencedColumns: ["id"]
          },
        ]
      }
      roleta_segmentos: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          descricao: string | null
          faixa_preco: string | null
          id: string
          nome: string
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          descricao?: string | null
          faixa_preco?: string | null
          id?: string
          nome: string
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          descricao?: string | null
          faixa_preco?: string | null
          id?: string
          nome?: string
        }
        Relationships: []
      }
      sala_reuniao_reservas: {
        Row: {
          assunto: string | null
          created_at: string
          created_by: string | null
          data: string
          hora_fim: string
          hora_inicio: string
          id: string
          responsavel: string
        }
        Insert: {
          assunto?: string | null
          created_at?: string
          created_by?: string | null
          data: string
          hora_fim: string
          hora_inicio: string
          id?: string
          responsavel: string
        }
        Update: {
          assunto?: string | null
          created_at?: string
          created_by?: string | null
          data?: string
          hora_fim?: string
          hora_inicio?: string
          id?: string
          responsavel?: string
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
      segmento_campanhas: {
        Row: {
          campanha_nome: string
          created_at: string
          id: string
          segmento_id: string
        }
        Insert: {
          campanha_nome: string
          created_at?: string
          id?: string
          segmento_id: string
        }
        Update: {
          campanha_nome?: string
          created_at?: string
          id?: string
          segmento_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "segmento_campanhas_segmento_id_fkey"
            columns: ["segmento_id"]
            isOneToOne: false
            referencedRelation: "pipeline_segmentos"
            referencedColumns: ["id"]
          },
        ]
      }
      tarefas: {
        Row: {
          anexo_url: string | null
          categoria: string | null
          concluida_em: string | null
          created_at: string | null
          criado_por: string | null
          descricao: string | null
          id: string
          observacoes: string | null
          prazo: string | null
          prazo_hora: string | null
          prioridade: string | null
          responsavel_id: string | null
          status: string | null
          titulo: string
          updated_at: string | null
        }
        Insert: {
          anexo_url?: string | null
          categoria?: string | null
          concluida_em?: string | null
          created_at?: string | null
          criado_por?: string | null
          descricao?: string | null
          id?: string
          observacoes?: string | null
          prazo?: string | null
          prazo_hora?: string | null
          prioridade?: string | null
          responsavel_id?: string | null
          status?: string | null
          titulo: string
          updated_at?: string | null
        }
        Update: {
          anexo_url?: string | null
          categoria?: string | null
          concluida_em?: string | null
          created_at?: string | null
          criado_por?: string | null
          descricao?: string | null
          id?: string
          observacoes?: string | null
          prazo?: string | null
          prazo_hora?: string | null
          prioridade?: string | null
          responsavel_id?: string | null
          status?: string | null
          titulo?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tarefas_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tarefas_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
          user_id: string | null
        }
        Insert: {
          created_at?: string
          equipe?: string | null
          gerente_id: string
          id?: string
          nome: string
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          equipe?: string | null
          gerente_id?: string
          id?: string
          nome?: string
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      team_scripts: {
        Row: {
          ativo: boolean
          campanha: string | null
          created_at: string
          empreendimento: string
          gerente_id: string
          id: string
          script_email: string | null
          script_ligacao: string | null
          script_whatsapp: string | null
          titulo: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          campanha?: string | null
          created_at?: string
          empreendimento: string
          gerente_id: string
          id?: string
          script_email?: string | null
          script_ligacao?: string | null
          script_whatsapp?: string | null
          titulo?: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          campanha?: string | null
          created_at?: string
          empreendimento?: string
          gerente_id?: string
          id?: string
          script_email?: string | null
          script_ligacao?: string | null
          script_whatsapp?: string | null
          titulo?: string
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
      visitas: {
        Row: {
          cancel_reason: string | null
          confirmation_token: string | null
          confirmed_at: string | null
          converted_to_pdn_at: string | null
          converted_to_pdn_by: string | null
          corretor_id: string
          created_at: string
          created_by: string
          data_visita: string
          empreendimento: string | null
          gerente_id: string
          hora_visita: string | null
          id: string
          lead_id: string | null
          linked_attempt_id: string | null
          linked_pdn_id: string | null
          local_visita: string | null
          negocio_id: string | null
          nome_cliente: string
          observacoes: string | null
          origem: string
          origem_detalhe: string | null
          pipeline_lead_id: string | null
          responsavel_visita: string | null
          resultado_visita: string | null
          status: string
          telefone: string | null
          tipo: string
          tipo_reuniao: string | null
          token_expires_at: string | null
          updated_at: string
        }
        Insert: {
          cancel_reason?: string | null
          confirmation_token?: string | null
          confirmed_at?: string | null
          converted_to_pdn_at?: string | null
          converted_to_pdn_by?: string | null
          corretor_id: string
          created_at?: string
          created_by: string
          data_visita: string
          empreendimento?: string | null
          gerente_id: string
          hora_visita?: string | null
          id?: string
          lead_id?: string | null
          linked_attempt_id?: string | null
          linked_pdn_id?: string | null
          local_visita?: string | null
          negocio_id?: string | null
          nome_cliente: string
          observacoes?: string | null
          origem?: string
          origem_detalhe?: string | null
          pipeline_lead_id?: string | null
          responsavel_visita?: string | null
          resultado_visita?: string | null
          status?: string
          telefone?: string | null
          tipo?: string
          tipo_reuniao?: string | null
          token_expires_at?: string | null
          updated_at?: string
        }
        Update: {
          cancel_reason?: string | null
          confirmation_token?: string | null
          confirmed_at?: string | null
          converted_to_pdn_at?: string | null
          converted_to_pdn_by?: string | null
          corretor_id?: string
          created_at?: string
          created_by?: string
          data_visita?: string
          empreendimento?: string | null
          gerente_id?: string
          hora_visita?: string | null
          id?: string
          lead_id?: string | null
          linked_attempt_id?: string | null
          linked_pdn_id?: string | null
          local_visita?: string | null
          negocio_id?: string | null
          nome_cliente?: string
          observacoes?: string | null
          origem?: string
          origem_detalhe?: string | null
          pipeline_lead_id?: string | null
          responsavel_visita?: string | null
          resultado_visita?: string | null
          status?: string
          telefone?: string | null
          tipo?: string
          tipo_reuniao?: string | null
          token_expires_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "visitas_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "oferta_ativa_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visitas_linked_attempt_id_fkey"
            columns: ["linked_attempt_id"]
            isOneToOne: false
            referencedRelation: "oferta_ativa_tentativas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visitas_linked_pdn_id_fkey"
            columns: ["linked_pdn_id"]
            isOneToOne: false
            referencedRelation: "pdn_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visitas_negocio_id_fkey"
            columns: ["negocio_id"]
            isOneToOne: false
            referencedRelation: "negocios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visitas_pipeline_lead_id_fkey"
            columns: ["pipeline_lead_id"]
            isOneToOne: false
            referencedRelation: "pipeline_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      vitrines: {
        Row: {
          created_at: string | null
          created_by: string
          dados_custom: Json | null
          expires_at: string | null
          id: string
          imovel_ids: Json
          lead_nome: string | null
          lead_telefone: string | null
          mensagem_corretor: string | null
          tipo: string
          titulo: string
          visualizacoes: number | null
        }
        Insert: {
          created_at?: string | null
          created_by: string
          dados_custom?: Json | null
          expires_at?: string | null
          id?: string
          imovel_ids?: Json
          lead_nome?: string | null
          lead_telefone?: string | null
          mensagem_corretor?: string | null
          tipo?: string
          titulo?: string
          visualizacoes?: number | null
        }
        Update: {
          created_at?: string | null
          created_by?: string
          dados_custom?: Json | null
          expires_at?: string | null
          id?: string
          imovel_ids?: Json
          lead_nome?: string | null
          lead_telefone?: string | null
          mensagem_corretor?: string | null
          tipo?: string
          titulo?: string
          visualizacoes?: number | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      aceitar_lead: {
        Args: {
          p_corretor_id: string
          p_lead_id: string
          p_status_inicial?: string
        }
        Returns: Json
      }
      aprovar_lead_exclusivo: {
        Args: {
          p_canal: string
          p_corretor_id: string
          p_empreendimento?: string
          p_feedback: string
          p_lead_id: string
          p_lista_id?: string
        }
        Returns: Json
      }
      buscar_conhecimento: {
        Args: {
          filter_empreendimento?: string
          match_count?: number
          match_threshold?: number
          query_embedding: string
        }
        Returns: {
          content: string
          document_id: string
          id: string
          metadata: Json
          similarity: number
        }[]
      }
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
      cleanup_expired_locks: { Args: never; Returns: number }
      criar_notificacao: {
        Args: {
          p_agrupamento_key?: string
          p_categoria: string
          p_dados?: Json
          p_mensagem: string
          p_tipo: string
          p_titulo: string
          p_user_id: string
        }
        Returns: string
      }
      criar_pulse_event: {
        Args: {
          p_corretor_id: string
          p_descricao?: string
          p_metadata?: Json
          p_prioridade?: string
          p_tipo: string
          p_titulo: string
        }
        Returns: string
      }
      detectar_leads_parados: { Args: never; Returns: number }
      distribuir_lead_roleta: {
        Args: { p_pipeline_lead_id: string; p_segmento_id?: string }
        Returns: Json
      }
      escalonar_notificacoes_leads: { Args: never; Returns: number }
      fetch_next_lead: {
        Args: {
          p_corretor_id: string
          p_lista_id: string
          p_lock_minutes?: number
        }
        Returns: Json
      }
      finalizar_tentativa_v2:
        | {
            Args: {
              p_canal: string
              p_corretor_id: string
              p_empreendimento?: string
              p_feedback: string
              p_idempotency_key?: string
              p_lead_id: string
              p_lista_id?: string
              p_resultado: string
              p_visita_marcada?: boolean
            }
            Returns: Json
          }
        | {
            Args: {
              p_canal: string
              p_corretor_id: string
              p_empreendimento?: string
              p_feedback: string
              p_idempotency_key?: string
              p_interesse_tipo?: string
              p_lead_id: string
              p_lista_id?: string
              p_resultado: string
              p_visita_marcada?: boolean
            }
            Returns: Json
          }
      finalizar_trabalho_corretor: {
        Args: { p_user_id: string }
        Returns: Json
      }
      get_batch_lista_stats: {
        Args: { p_corretor_id?: string; p_lista_ids: string[] }
        Returns: Json
      }
      get_corretor_daily_visitas: {
        Args: { p_user_id?: string }
        Returns: number
      }
      get_corretor_pdn: {
        Args: { p_mes?: string }
        Returns: {
          corretor: string | null
          created_at: string
          created_from_visit: boolean
          data_proxima_acao: string | null
          data_visita: string | null
          docs_status: string
          empreendimento: string | null
          equipe: string | null
          gerente_id: string
          id: string
          linked_visit_id: string | null
          mes: string
          motivo_queda: string | null
          nome: string
          objecao_cliente: string | null
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
        }[]
        SetofOptions: {
          from: "*"
          to: "pdn_entries"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_distribuicao_performance: {
        Args: { p_periodo?: string }
        Returns: Json
      }
      get_individual_oa_ranking: { Args: { p_period?: string }; Returns: Json }
      get_profile_id_for_auth: { Args: never; Returns: string }
      get_ranking_gestao_leads: {
        Args: { p_periodo: string }
        Returns: {
          contatos: number
          corretor_id: string
          corretor_nome: string
          pontos_total: number
          qualificados: number
          visitas_marcadas: number
          visitas_realizadas: number
        }[]
      }
      get_ranking_pipeline_leads: {
        Args: { p_periodo?: string }
        Returns: {
          contatos: number
          corretor_id: string
          corretor_nome: string
          novos: number
          pontos_total: number
          possiveis_visitas: number
          qualificados: number
          visitas_marcadas: number
          visitas_realizadas: number
        }[]
      }
      get_team_oa_ranking: { Args: { p_period?: string }; Returns: Json }
      get_team_visitas: {
        Args: { p_date_from?: string; p_date_to?: string }
        Returns: {
          corretor_id: string
          corretor_nome: string
          data_visita: string
          empreendimento: string
          hora_visita: string
          id: string
          local_visita: string
          nome_cliente: string
          observacoes: string
          status: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      higienizar_lead: {
        Args: {
          p_acao: string
          p_admin_id?: string
          p_corretor_id?: string
          p_lead_id: string
          p_motivo?: string
        }
        Returns: Json
      }
      increment_comunicacao_usage: {
        Args: { p_template_id: string }
        Returns: undefined
      }
      increment_marketplace_usage: {
        Args: { p_item_id: string }
        Returns: undefined
      }
      increment_referral_count: {
        Args: { p_referral_id: string }
        Returns: undefined
      }
      is_corretor_in_my_team: {
        Args: { p_corretor_id: string }
        Returns: boolean
      }
      is_gerente_or_above: { Args: never; Returns: boolean }
      is_lead_in_my_team: { Args: { p_corretor_id: string }; Returns: boolean }
      lock_lead_atomic: {
        Args: {
          p_corretor_id: string
          p_lead_id: string
          p_lock_minutes?: number
        }
        Returns: Json
      }
      marcar_todas_notificacoes_lidas: { Args: never; Returns: number }
      rate_marketplace_item: {
        Args: { p_comentario?: string; p_item_id: string; p_nota: number }
        Returns: undefined
      }
      recalculate_all_scores: { Args: never; Returns: undefined }
      reciclar_leads_expirados: { Args: never; Returns: number }
      redistribuir_leads_pendentes: {
        Args: { p_segmento_id?: string }
        Returns: Json
      }
      rejeitar_lead: {
        Args: { p_corretor_id: string; p_lead_id: string; p_motivo: string }
        Returns: Json
      }
      renew_lead_lock: {
        Args: {
          p_corretor_id: string
          p_lead_id: string
          p_lock_minutes?: number
        }
        Returns: Json
      }
      reset_roleta_turno: { Args: never; Returns: undefined }
    }
    Enums: {
      app_role: "admin" | "gestor" | "corretor" | "backoffice"
      lead_priority: "alta" | "media" | "baixa" | "frio" | "perdido"
      message_channel: "whatsapp" | "sms" | "email"
      message_status: "pendente" | "enviado" | "entregue" | "falhou"
      pipeline_stage_type:
        | "novo_lead"
        | "sem_contato"
        | "atendimento_inicial"
        | "qualificacao_busca"
        | "visita"
        | "proposta"
        | "venda"
        | "descarte"
        | "contato_inicial"
        | "atendimento"
        | "possibilidade_visita"
        | "visita_marcada"
        | "visita_realizada"
        | "negociacao"
        | "assinatura"
        | "qualificacao"
        | "contrato_gerado"
        | "caiu"
        | "boas_vindas"
        | "envio_oportunidades"
        | "atualizacao_bem_estar"
        | "indicacoes"
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
      app_role: ["admin", "gestor", "corretor", "backoffice"],
      lead_priority: ["alta", "media", "baixa", "frio", "perdido"],
      message_channel: ["whatsapp", "sms", "email"],
      message_status: ["pendente", "enviado", "entregue", "falhou"],
      pipeline_stage_type: [
        "novo_lead",
        "sem_contato",
        "atendimento_inicial",
        "qualificacao_busca",
        "visita",
        "proposta",
        "venda",
        "descarte",
        "contato_inicial",
        "atendimento",
        "possibilidade_visita",
        "visita_marcada",
        "visita_realizada",
        "negociacao",
        "assinatura",
        "qualificacao",
        "contrato_gerado",
        "caiu",
        "boas_vindas",
        "envio_oportunidades",
        "atualizacao_bem_estar",
        "indicacoes",
      ],
      task_status: ["pendente", "em_andamento", "concluida", "cancelada"],
    },
  },
} as const
