export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      activity_log: {
        Row: {
          created_at: string
          descricao: string
          id: string
          project_id: string
          tipo: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          descricao: string
          id?: string
          project_id: string
          tipo: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          descricao?: string
          id?: string
          project_id?: string
          tipo?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_log_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_accounts: {
        Row: {
          client_id: string
          created_at: string
          id: string
          last_sync_at: string | null
          last_sync_error: string | null
          meta_account_id: string
          nome: string
          status: string
          subscription_id: string | null
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          last_sync_at?: string | null
          last_sync_error?: string | null
          meta_account_id: string
          nome: string
          status?: string
          subscription_id?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          last_sync_at?: string | null
          last_sync_error?: string | null
          meta_account_id?: string
          nome?: string
          status?: string
          subscription_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ad_accounts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_accounts_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_campaign_metrics_daily: {
        Row: {
          campaign_id: string
          cliques: number | null
          conversoes: number | null
          data: string
          gasto: number
          id: string
          impressoes: number | null
          receita: number | null
        }
        Insert: {
          campaign_id: string
          cliques?: number | null
          conversoes?: number | null
          data: string
          gasto?: number
          id?: string
          impressoes?: number | null
          receita?: number | null
        }
        Update: {
          campaign_id?: string
          cliques?: number | null
          conversoes?: number | null
          data?: string
          gasto?: number
          id?: string
          impressoes?: number | null
          receita?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ad_campaign_metrics_daily_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "ad_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_campaigns: {
        Row: {
          ad_account_id: string
          created_at: string
          id: string
          meta_campaign_id: string
          nome: string
          objetivo: string | null
          status: string | null
        }
        Insert: {
          ad_account_id: string
          created_at?: string
          id?: string
          meta_campaign_id: string
          nome: string
          objetivo?: string | null
          status?: string | null
        }
        Update: {
          ad_account_id?: string
          created_at?: string
          id?: string
          meta_campaign_id?: string
          nome?: string
          objetivo?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ad_campaigns_ad_account_id_fkey"
            columns: ["ad_account_id"]
            isOneToOne: false
            referencedRelation: "ad_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_metrics_daily: {
        Row: {
          ad_account_id: string
          cliques: number | null
          conversoes: number | null
          data: string
          gasto: number
          id: string
          impressoes: number | null
          receita: number | null
        }
        Insert: {
          ad_account_id: string
          cliques?: number | null
          conversoes?: number | null
          data: string
          gasto?: number
          id?: string
          impressoes?: number | null
          receita?: number | null
        }
        Update: {
          ad_account_id?: string
          cliques?: number | null
          conversoes?: number | null
          data?: string
          gasto?: number
          id?: string
          impressoes?: number | null
          receita?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ad_metrics_daily_ad_account_id_fkey"
            columns: ["ad_account_id"]
            isOneToOne: false
            referencedRelation: "ad_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      agenda_events: {
        Row: {
          cor: string
          created_at: string
          criado_por: string | null
          descricao: string | null
          fim: string
          id: string
          inicio: string
          project_id: string | null
          titulo: string
        }
        Insert: {
          cor?: string
          created_at?: string
          criado_por?: string | null
          descricao?: string | null
          fim: string
          id?: string
          inicio: string
          project_id?: string | null
          titulo: string
        }
        Update: {
          cor?: string
          created_at?: string
          criado_por?: string | null
          descricao?: string | null
          fim?: string
          id?: string
          inicio?: string
          project_id?: string | null
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "agenda_events_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agenda_events_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      briefing_templates: {
        Row: {
          id: string
          perguntas: Json
          tipo_servico: string
        }
        Insert: {
          id?: string
          perguntas: Json
          tipo_servico: string
        }
        Update: {
          id?: string
          perguntas?: Json
          tipo_servico?: string
        }
        Relationships: []
      }
      briefings: {
        Row: {
          id: string
          project_id: string
          respostas: Json | null
          status: string
          submitted_at: string | null
          template_id: string
          token: string
        }
        Insert: {
          id?: string
          project_id: string
          respostas?: Json | null
          status?: string
          submitted_at?: string | null
          template_id: string
          token?: string
        }
        Update: {
          id?: string
          project_id?: string
          respostas?: Json | null
          status?: string
          submitted_at?: string | null
          template_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "briefings_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "briefings_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "briefing_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          created_at: string
          email: string | null
          empresa: string | null
          id: string
          nome: string
          origem: string | null
          telefone: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          empresa?: string | null
          id?: string
          nome: string
          origem?: string | null
          telefone?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          empresa?: string | null
          id?: string
          nome?: string
          origem?: string | null
          telefone?: string | null
        }
        Relationships: []
      }
      contract_templates: {
        Row: {
          corpo: string
          id: string
          tipo_servico: string
        }
        Insert: {
          corpo: string
          id?: string
          tipo_servico: string
        }
        Update: {
          corpo?: string
          id?: string
          tipo_servico?: string
        }
        Relationships: []
      }
      contracts: {
        Row: {
          corpo_final: string
          created_at: string
          id: string
          project_id: string
          proposal_id: string | null
          signed_at: string | null
          signer_document: string | null
          signer_name: string | null
          status: string
          token: string
        }
        Insert: {
          corpo_final: string
          created_at?: string
          id?: string
          project_id: string
          proposal_id?: string | null
          signed_at?: string | null
          signer_document?: string | null
          signer_name?: string | null
          status?: string
          token?: string
        }
        Update: {
          corpo_final?: string
          created_at?: string
          id?: string
          project_id?: string
          proposal_id?: string | null
          signed_at?: string | null
          signer_document?: string | null
          signer_name?: string | null
          status?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "contracts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          categoria: string
          created_at: string
          data: string
          descricao: string
          id: string
          project_id: string | null
          recorrente: boolean
          valor: number
        }
        Insert: {
          categoria: string
          created_at?: string
          data: string
          descricao: string
          id?: string
          project_id?: string | null
          recorrente?: boolean
          valor: number
        }
        Update: {
          categoria?: string
          created_at?: string
          data?: string
          descricao?: string
          id?: string
          project_id?: string | null
          recorrente?: boolean
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "expenses_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_submissions: {
        Row: {
          created_at: string
          email: string
          id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          descricao: string | null
          id: string
          lida: boolean
          link: string | null
          tipo: string
          titulo: string
        }
        Insert: {
          created_at?: string
          descricao?: string | null
          id?: string
          lida?: boolean
          link?: string | null
          tipo: string
          titulo: string
        }
        Update: {
          created_at?: string
          descricao?: string | null
          id?: string
          lida?: boolean
          link?: string | null
          tipo?: string
          titulo?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          id: string
          nome: string
          role: string
        }
        Insert: {
          created_at?: string
          id: string
          nome: string
          role?: string
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
          role?: string
        }
        Relationships: []
      }
      project_files: {
        Row: {
          created_at: string
          id: string
          nome: string
          project_id: string
          storage_path: string
          tamanho: number | null
          tipo_mime: string | null
          uploaded_by: string | null
          visivel_cliente: boolean
        }
        Insert: {
          created_at?: string
          id?: string
          nome: string
          project_id: string
          storage_path: string
          tamanho?: number | null
          tipo_mime?: string | null
          uploaded_by?: string | null
          visivel_cliente?: boolean
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
          project_id?: string
          storage_path?: string
          tamanho?: number | null
          tipo_mime?: string | null
          uploaded_by?: string | null
          visivel_cliente?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "project_files_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_files_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      project_status_history: {
        Row: {
          entrou_em: string
          id: string
          project_id: string
          status: string
        }
        Insert: {
          entrou_em?: string
          id?: string
          project_id: string
          status: string
        }
        Update: {
          entrou_em?: string
          id?: string
          project_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_status_history_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_tasks: {
        Row: {
          concluida: boolean
          created_at: string
          id: string
          ordem: number
          prazo: string | null
          project_id: string
          responsavel_id: string | null
          titulo: string
        }
        Insert: {
          concluida?: boolean
          created_at?: string
          id?: string
          ordem?: number
          prazo?: string | null
          project_id: string
          responsavel_id?: string | null
          titulo: string
        }
        Update: {
          concluida?: boolean
          created_at?: string
          id?: string
          ordem?: number
          prazo?: string | null
          project_id?: string
          responsavel_id?: string | null
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_tasks_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          client_id: string
          created_at: string
          id: string
          nome: string
          portal_token: string
          status: string
          tipo_servico: string
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          nome: string
          portal_token?: string
          status?: string
          tipo_servico: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          nome?: string
          portal_token?: string
          status?: string
          tipo_servico?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      proposal_templates: {
        Row: {
          condicoes: string | null
          id: string
          itens: Json
          tipo_servico: string
          titulo: string
        }
        Insert: {
          condicoes?: string | null
          id?: string
          itens?: Json
          tipo_servico: string
          titulo: string
        }
        Update: {
          condicoes?: string | null
          id?: string
          itens?: Json
          tipo_servico?: string
          titulo?: string
        }
        Relationships: []
      }
      proposals: {
        Row: {
          accepted_at: string | null
          aceite_nome: string | null
          condicoes: string | null
          created_at: string
          desconto: number
          id: string
          itens: Json
          parcelas: Json | null
          project_id: string
          sent_at: string | null
          status: string
          titulo: string
          token: string
          updated_at: string
          validade: string | null
          valor_total: number
        }
        Insert: {
          accepted_at?: string | null
          aceite_nome?: string | null
          condicoes?: string | null
          created_at?: string
          desconto?: number
          id?: string
          itens?: Json
          parcelas?: Json | null
          project_id: string
          sent_at?: string | null
          status?: string
          titulo: string
          token?: string
          updated_at?: string
          validade?: string | null
          valor_total?: number
        }
        Update: {
          accepted_at?: string | null
          aceite_nome?: string | null
          condicoes?: string | null
          created_at?: string
          desconto?: number
          id?: string
          itens?: Json
          parcelas?: Json | null
          project_id?: string
          sent_at?: string | null
          status?: string
          titulo?: string
          token?: string
          updated_at?: string
          validade?: string | null
          valor_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "proposals_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      receivables: {
        Row: {
          client_id: string
          created_at: string
          descricao: string
          forma_pagamento: string | null
          gateway_payment_id: string | null
          id: string
          pago_em: string | null
          payment_link: string | null
          project_id: string
          proposal_id: string | null
          status: string
          valor: number
          vencimento: string
        }
        Insert: {
          client_id: string
          created_at?: string
          descricao: string
          forma_pagamento?: string | null
          gateway_payment_id?: string | null
          id?: string
          pago_em?: string | null
          payment_link?: string | null
          project_id: string
          proposal_id?: string | null
          status?: string
          valor: number
          vencimento: string
        }
        Update: {
          client_id?: string
          created_at?: string
          descricao?: string
          forma_pagamento?: string | null
          gateway_payment_id?: string | null
          id?: string
          pago_em?: string | null
          payment_link?: string | null
          project_id?: string
          proposal_id?: string | null
          status?: string
          valor?: number
          vencimento?: string
        }
        Relationships: [
          {
            foreignKeyName: "receivables_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receivables_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receivables_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      settings: {
        Row: {
          chave: string
          valor: string
        }
        Insert: {
          chave: string
          valor: string
        }
        Update: {
          chave?: string
          valor?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          ativo: boolean
          client_id: string
          created_at: string
          descricao: string
          dia_vencimento: number
          id: string
          project_id: string | null
          started_at: string
          valor_mensal: number
        }
        Insert: {
          ativo?: boolean
          client_id: string
          created_at?: string
          descricao: string
          dia_vencimento: number
          id?: string
          project_id?: string | null
          started_at?: string
          valor_mensal: number
        }
        Update: {
          ativo?: boolean
          client_id?: string
          created_at?: string
          descricao?: string
          dia_vencimento?: number
          id?: string
          project_id?: string | null
          started_at?: string
          valor_mensal?: number
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          created_at: string
          descricao: string | null
          id: string
          prioridade: string
          project_id: string
          resolved_at: string | null
          status: string
          titulo: string
        }
        Insert: {
          created_at?: string
          descricao?: string | null
          id?: string
          prioridade?: string
          project_id: string
          resolved_at?: string | null
          status?: string
          titulo: string
        }
        Update: {
          created_at?: string
          descricao?: string | null
          id?: string
          prioridade?: string
          project_id?: string
          resolved_at?: string | null
          status?: string
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      task_templates: {
        Row: {
          id: string
          ordem: number
          tipo_servico: string
          titulo: string
        }
        Insert: {
          id?: string
          ordem: number
          tipo_servico: string
          titulo: string
        }
        Update: {
          id?: string
          ordem?: number
          tipo_servico?: string
          titulo?: string
        }
        Relationships: []
      }
      time_entries: {
        Row: {
          created_at: string
          data: string
          descricao: string | null
          horas: number
          id: string
          profile_id: string | null
          project_id: string
        }
        Insert: {
          created_at?: string
          data?: string
          descricao?: string | null
          horas: number
          id?: string
          profile_id?: string | null
          project_id: string
        }
        Update: {
          created_at?: string
          data?: string
          descricao?: string | null
          horas?: number
          id?: string
          profile_id?: string | null
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_entries_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      approve_project_stage: { Args: { p_token: string }; Returns: Json }
      create_lead: {
        Args: {
          p_email: string
          p_mensagem: string
          p_nome: string
          p_telefone: string
          p_tipo_servico: string
        }
        Returns: Json
      }
      create_ticket: {
        Args: { p_descricao: string; p_titulo: string; p_token: string }
        Returns: Json
      }
      generate_subscription_receivables: { Args: never; Returns: number }
      get_briefing_by_token: { Args: { t: string }; Returns: Json }
      get_contract_by_token: { Args: { p_token: string }; Returns: Json }
      get_portal_ads: { Args: { p_token: string }; Returns: Json }
      get_portal_by_token: { Args: { t: string }; Returns: Json }
      get_portal_files: { Args: { p_token: string }; Returns: Json }
      get_proposal_by_token: { Args: { t: string }; Returns: Json }
      is_admin: { Args: never; Returns: boolean }
      is_team_member: { Args: never; Returns: boolean }
      is_visible_client_file: {
        Args: { p_storage_path: string }
        Returns: boolean
      }
      push_notification: {
        Args: {
          p_descricao: string
          p_link: string
          p_tipo: string
          p_titulo: string
        }
        Returns: undefined
      }
      respond_proposal: {
        Args: { p_aceite: boolean; p_nome: string; t: string }
        Returns: Json
      }
      sign_contract: {
        Args: {
          p_signer_document: string
          p_signer_name: string
          p_token: string
        }
        Returns: Json
      }
      submit_briefing: { Args: { p_respostas: Json; t: string }; Returns: Json }
    }
    Enums: {
      [_ in never]: never
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const

