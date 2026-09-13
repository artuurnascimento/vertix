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
    PostgrestVersion: "14.5"
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
            referencedRelation: "fila_comercial"
            referencedColumns: ["project_id"]
          },
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
            referencedRelation: "client_health"
            referencedColumns: ["client_id"]
          },
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
          google_event_id: string | null
          id: string
          inicio: string
          lead_id: string | null
          meet_url: string | null
          project_id: string | null
          titulo: string
        }
        Insert: {
          cor?: string
          created_at?: string
          criado_por?: string | null
          descricao?: string | null
          fim: string
          google_event_id?: string | null
          id?: string
          inicio: string
          lead_id?: string | null
          meet_url?: string | null
          project_id?: string | null
          titulo: string
        }
        Update: {
          cor?: string
          created_at?: string
          criado_por?: string | null
          descricao?: string | null
          fim?: string
          google_event_id?: string | null
          id?: string
          inicio?: string
          lead_id?: string | null
          meet_url?: string | null
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
            referencedRelation: "fila_comercial"
            referencedColumns: ["project_id"]
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
      analyses: {
        Row: {
          created_at: string | null
          deep_attempts: number
          deep_result: Json | null
          domain: string
          error: string | null
          id: string
          light_result: Json | null
          score: number | null
          status: string
          updated_at: string
          url: string
        }
        Insert: {
          created_at?: string | null
          deep_attempts?: number
          deep_result?: Json | null
          domain: string
          error?: string | null
          id?: string
          light_result?: Json | null
          score?: number | null
          status?: string
          updated_at?: string
          url: string
        }
        Update: {
          created_at?: string | null
          deep_attempts?: number
          deep_result?: Json | null
          domain?: string
          error?: string | null
          id?: string
          light_result?: Json | null
          score?: number | null
          status?: string
          updated_at?: string
          url?: string
        }
        Relationships: []
      }
      bio_events: {
        Row: {
          created_at: string
          id: string
          link_id: string | null
          sessao: string
          tipo: string
          utm_campaign: string | null
          utm_medium: string | null
          utm_source: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          link_id?: string | null
          sessao: string
          tipo: string
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          link_id?: string | null
          sessao?: string
          tipo?: string
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bio_events_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "bio_links"
            referencedColumns: ["id"]
          },
        ]
      }
      bio_links: {
        Row: {
          ativo: boolean
          chamada: string | null
          created_at: string
          descricao: string | null
          destino: string
          formato: string
          icone: string | null
          id: string
          inicia_em: string | null
          mensagem: string | null
          posicao: number
          rotulo: string
          termina_em: string | null
          texto_botao: string | null
          tipo_destino: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          chamada?: string | null
          created_at?: string
          descricao?: string | null
          destino?: string
          formato?: string
          icone?: string | null
          id?: string
          inicia_em?: string | null
          mensagem?: string | null
          posicao?: number
          rotulo: string
          termina_em?: string | null
          texto_botao?: string | null
          tipo_destino: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          chamada?: string | null
          created_at?: string
          descricao?: string | null
          destino?: string
          formato?: string
          icone?: string | null
          id?: string
          inicia_em?: string | null
          mensagem?: string | null
          posicao?: number
          rotulo?: string
          termina_em?: string | null
          texto_botao?: string | null
          tipo_destino?: string
          updated_at?: string
        }
        Relationships: []
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
          resumo: string | null
          resumo_gerado_em: string | null
          resumo_meta: Json | null
          status: string
          submitted_at: string | null
          template_id: string
          token: string
        }
        Insert: {
          id?: string
          project_id: string
          respostas?: Json | null
          resumo?: string | null
          resumo_gerado_em?: string | null
          resumo_meta?: Json | null
          status?: string
          submitted_at?: string | null
          template_id: string
          token?: string
        }
        Update: {
          id?: string
          project_id?: string
          respostas?: Json | null
          resumo?: string | null
          resumo_gerado_em?: string | null
          resumo_meta?: Json | null
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
            referencedRelation: "fila_comercial"
            referencedColumns: ["project_id"]
          },
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
      checkout_eventos: {
        Row: {
          criado_em: string
          dados: Json
          id: number
          sessao_id: string
          tipo: string
        }
        Insert: {
          criado_em?: string
          dados?: Json
          id?: never
          sessao_id: string
          tipo: string
        }
        Update: {
          criado_em?: string
          dados?: Json
          id?: never
          sessao_id?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "checkout_eventos_sessao_id_fkey"
            columns: ["sessao_id"]
            isOneToOne: false
            referencedRelation: "checkout_sessoes"
            referencedColumns: ["id"]
          },
        ]
      }
      checkout_sessoes: {
        Row: {
          agente: string | null
          altura: number | null
          aprovado_em: string | null
          bot: boolean
          bot_motivo: string | null
          bump: boolean
          checkout_id: string
          cidade: string | null
          cupom: string | null
          dados_em: string | null
          dispositivo: string | null
          documento_preenchido: boolean
          email: string | null
          encerrada_em: string | null
          estado: string | null
          etapa: string
          eventos: number
          foco: string | null
          id: string
          iniciado_em: string
          interagiu_em: string | null
          largura: number | null
          latitude: number | null
          longitude: number | null
          metodo: string | null
          navegador: string | null
          nome: string | null
          obrigado_em: string | null
          pagamento_em: string | null
          pagar_em: string | null
          pais: string | null
          pedido_id: string | null
          referrer: string | null
          secao: string | null
          so: string | null
          total_centavos: number | null
          ultimo_evento_em: string
          updated_at: string
          utm: Json
          visitante_id: string | null
          visivel: boolean
          whatsapp: string | null
        }
        Insert: {
          agente?: string | null
          altura?: number | null
          aprovado_em?: string | null
          bot?: boolean
          bot_motivo?: string | null
          bump?: boolean
          checkout_id: string
          cidade?: string | null
          cupom?: string | null
          dados_em?: string | null
          dispositivo?: string | null
          documento_preenchido?: boolean
          email?: string | null
          encerrada_em?: string | null
          estado?: string | null
          etapa?: string
          eventos?: number
          foco?: string | null
          id: string
          iniciado_em?: string
          interagiu_em?: string | null
          largura?: number | null
          latitude?: number | null
          longitude?: number | null
          metodo?: string | null
          navegador?: string | null
          nome?: string | null
          obrigado_em?: string | null
          pagamento_em?: string | null
          pagar_em?: string | null
          pais?: string | null
          pedido_id?: string | null
          referrer?: string | null
          secao?: string | null
          so?: string | null
          total_centavos?: number | null
          ultimo_evento_em?: string
          updated_at?: string
          utm?: Json
          visitante_id?: string | null
          visivel?: boolean
          whatsapp?: string | null
        }
        Update: {
          agente?: string | null
          altura?: number | null
          aprovado_em?: string | null
          bot?: boolean
          bot_motivo?: string | null
          bump?: boolean
          checkout_id?: string
          cidade?: string | null
          cupom?: string | null
          dados_em?: string | null
          dispositivo?: string | null
          documento_preenchido?: boolean
          email?: string | null
          encerrada_em?: string | null
          estado?: string | null
          etapa?: string
          eventos?: number
          foco?: string | null
          id?: string
          iniciado_em?: string
          interagiu_em?: string | null
          largura?: number | null
          latitude?: number | null
          longitude?: number | null
          metodo?: string | null
          navegador?: string | null
          nome?: string | null
          obrigado_em?: string | null
          pagamento_em?: string | null
          pagar_em?: string | null
          pais?: string | null
          pedido_id?: string | null
          referrer?: string | null
          secao?: string | null
          so?: string | null
          total_centavos?: number | null
          ultimo_evento_em?: string
          updated_at?: string
          utm?: Json
          visitante_id?: string | null
          visivel?: boolean
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "checkout_sessoes_checkout_id_fkey"
            columns: ["checkout_id"]
            isOneToOne: false
            referencedRelation: "checkouts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkout_sessoes_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
        ]
      }
      checkouts: {
        Row: {
          ativo: boolean
          banner: Json
          bump_imagem: Json
          bump_produto_id: string | null
          bump_texto: string | null
          bump_titulo: string | null
          created_at: string
          cronometro_ate: string | null
          cronometro_cor_fundo: string | null
          cronometro_cor_texto: string | null
          cronometro_minutos: number | null
          cronometro_texto: string | null
          desconto_pix_percentual: number | null
          downsell_produto_id: string | null
          downsell_texto: string | null
          downsell_titulo: string | null
          garantia_dias: number | null
          garantia_texto: string | null
          id: string
          produto_id: string
          prova: Json
          resumo_aberto: boolean
          slug: string
          subtitulo: string | null
          titulo: string
          updated_at: string
          upsell_produto_id: string | null
          upsell_texto: string | null
          upsell_titulo: string | null
        }
        Insert: {
          ativo?: boolean
          banner?: Json
          bump_imagem?: Json
          bump_produto_id?: string | null
          bump_texto?: string | null
          bump_titulo?: string | null
          created_at?: string
          cronometro_ate?: string | null
          cronometro_cor_fundo?: string | null
          cronometro_cor_texto?: string | null
          cronometro_minutos?: number | null
          cronometro_texto?: string | null
          desconto_pix_percentual?: number | null
          downsell_produto_id?: string | null
          downsell_texto?: string | null
          downsell_titulo?: string | null
          garantia_dias?: number | null
          garantia_texto?: string | null
          id?: string
          produto_id: string
          prova?: Json
          resumo_aberto?: boolean
          slug: string
          subtitulo?: string | null
          titulo: string
          updated_at?: string
          upsell_produto_id?: string | null
          upsell_texto?: string | null
          upsell_titulo?: string | null
        }
        Update: {
          ativo?: boolean
          banner?: Json
          bump_imagem?: Json
          bump_produto_id?: string | null
          bump_texto?: string | null
          bump_titulo?: string | null
          created_at?: string
          cronometro_ate?: string | null
          cronometro_cor_fundo?: string | null
          cronometro_cor_texto?: string | null
          cronometro_minutos?: number | null
          cronometro_texto?: string | null
          desconto_pix_percentual?: number | null
          downsell_produto_id?: string | null
          downsell_texto?: string | null
          downsell_titulo?: string | null
          garantia_dias?: number | null
          garantia_texto?: string | null
          id?: string
          produto_id?: string
          prova?: Json
          resumo_aberto?: boolean
          slug?: string
          subtitulo?: string | null
          titulo?: string
          updated_at?: string
          upsell_produto_id?: string | null
          upsell_texto?: string | null
          upsell_titulo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "checkouts_bump_produto_id_fkey"
            columns: ["bump_produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkouts_downsell_produto_id_fkey"
            columns: ["downsell_produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkouts_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkouts_upsell_produto_id_fkey"
            columns: ["upsell_produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
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
          signer_ip: unknown
          signer_name: string | null
          signer_user_agent: string | null
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
          signer_ip?: unknown
          signer_name?: string | null
          signer_user_agent?: string | null
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
          signer_ip?: unknown
          signer_name?: string | null
          signer_user_agent?: string | null
          status?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "contracts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "fila_comercial"
            referencedColumns: ["project_id"]
          },
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
      cupons: {
        Row: {
          ativo: boolean
          codigo: string
          created_at: string
          id: string
          limite_uso: number | null
          produto_id: string | null
          tipo: string
          usos: number
          validade: string | null
          valor: number
        }
        Insert: {
          ativo?: boolean
          codigo: string
          created_at?: string
          id?: string
          limite_uso?: number | null
          produto_id?: string | null
          tipo: string
          usos?: number
          validade?: string | null
          valor: number
        }
        Update: {
          ativo?: boolean
          codigo?: string
          created_at?: string
          id?: string
          limite_uso?: number | null
          produto_id?: string | null
          tipo?: string
          usos?: number
          validade?: string | null
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "cupons_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      esforco_por_regra: {
        Row: {
          ativo: boolean
          horas: number
          regra: string
          titulo: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          horas: number
          regra: string
          titulo: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          horas?: number
          regra?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: []
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
            referencedRelation: "fila_comercial"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "expenses_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      internal_config: {
        Row: {
          created_at: string
          key: string
          value: string
        }
        Insert: {
          created_at?: string
          key: string
          value: string
        }
        Update: {
          created_at?: string
          key?: string
          value?: string
        }
        Relationships: []
      }
      job_runs: {
        Row: {
          created_at: string
          detalhe: string | null
          id: string
          itens: number
          job: string
          status: string
        }
        Insert: {
          created_at?: string
          detalhe?: string | null
          id?: string
          itens?: number
          job: string
          status?: string
        }
        Update: {
          created_at?: string
          detalhe?: string | null
          id?: string
          itens?: number
          job?: string
          status?: string
        }
        Relationships: []
      }
      job_status: {
        Row: {
          erro: string | null
          itens: number | null
          job: string
          origem: string
          ultimo_erro: string | null
          ultimo_inicio: string | null
          ultimo_ok: string | null
          updated_at: string
        }
        Insert: {
          erro?: string | null
          itens?: number | null
          job: string
          origem?: string
          ultimo_erro?: string | null
          ultimo_inicio?: string | null
          ultimo_ok?: string | null
          updated_at?: string
        }
        Update: {
          erro?: string | null
          itens?: number | null
          job?: string
          origem?: string
          ultimo_erro?: string | null
          ultimo_inicio?: string | null
          ultimo_ok?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      lead_submissions: {
        Row: {
          created_at: string
          email: string
          id: string
          ip: unknown
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          ip?: unknown
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          ip?: unknown
        }
        Relationships: []
      }
      leads: {
        Row: {
          analysis_id: string
          client_id: string | null
          created_at: string | null
          dor: string | null
          email: string | null
          emails_sequencia: number
          faturamento_mensal: number | null
          id: string
          name: string
          origem: Json | null
          plataforma: string | null
          relatorio_aberto_em: string | null
          relatorio_enviado_em: string | null
          report_code: string | null
          report_token: string | null
          reuniao_em: string | null
          status: string
          ultimo_email_em: string | null
          whatsapp: string
        }
        Insert: {
          analysis_id: string
          client_id?: string | null
          created_at?: string | null
          dor?: string | null
          email?: string | null
          emails_sequencia?: number
          faturamento_mensal?: number | null
          id?: string
          name: string
          origem?: Json | null
          plataforma?: string | null
          relatorio_aberto_em?: string | null
          relatorio_enviado_em?: string | null
          report_code?: string | null
          report_token?: string | null
          reuniao_em?: string | null
          status?: string
          ultimo_email_em?: string | null
          whatsapp: string
        }
        Update: {
          analysis_id?: string
          client_id?: string | null
          created_at?: string | null
          dor?: string | null
          email?: string | null
          emails_sequencia?: number
          faturamento_mensal?: number | null
          id?: string
          name?: string
          origem?: Json | null
          plataforma?: string | null
          relatorio_aberto_em?: string | null
          relatorio_enviado_em?: string | null
          report_code?: string | null
          report_token?: string | null
          reuniao_em?: string | null
          status?: string
          ultimo_email_em?: string | null
          whatsapp?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_analysis_id_fkey"
            columns: ["analysis_id"]
            isOneToOne: false
            referencedRelation: "analyses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_health"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "leads_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      loja_apps: {
        Row: {
          id: string
          loja_id: string
          metricas_cache: Json | null
          produto: string
          provisionado_em: string
          status: string
          ultimo_sync: string | null
        }
        Insert: {
          id?: string
          loja_id: string
          metricas_cache?: Json | null
          produto: string
          provisionado_em?: string
          status?: string
          ultimo_sync?: string | null
        }
        Update: {
          id?: string
          loja_id?: string
          metricas_cache?: Json | null
          produto?: string
          provisionado_em?: string
          status?: string
          ultimo_sync?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "loja_apps_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
        ]
      }
      lojas: {
        Row: {
          client_id: string | null
          created_at: string
          id: string
          observacoes: string | null
          plano: string | null
          shop_domain: string
          status: string
          updated_at: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          id?: string
          observacoes?: string | null
          plano?: string | null
          shop_domain: string
          status?: string
          updated_at?: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          id?: string
          observacoes?: string | null
          plano?: string | null
          shop_domain?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lojas_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_health"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "lojas_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
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
      nps_surveys: {
        Row: {
          client_id: string
          comentario: string | null
          created_at: string
          id: string
          project_id: string
          responded_at: string | null
          score: number | null
          sent_at: string | null
          status: string
          token: string
        }
        Insert: {
          client_id: string
          comentario?: string | null
          created_at?: string
          id?: string
          project_id: string
          responded_at?: string | null
          score?: number | null
          sent_at?: string | null
          status?: string
          token?: string
        }
        Update: {
          client_id?: string
          comentario?: string | null
          created_at?: string
          id?: string
          project_id?: string
          responded_at?: string | null
          score?: number | null
          sent_at?: string | null
          status?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "nps_surveys_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_health"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "nps_surveys_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nps_surveys_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "fila_comercial"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "nps_surveys_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      nudges: {
        Row: {
          client_id: string | null
          created_at: string
          dedupe_key: string
          descricao: string | null
          id: string
          link: string | null
          project_id: string | null
          resolved_at: string | null
          resolvido: boolean
          severidade: string
          tipo: string
          titulo: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          dedupe_key: string
          descricao?: string | null
          id?: string
          link?: string | null
          project_id?: string | null
          resolved_at?: string | null
          resolvido?: boolean
          severidade?: string
          tipo: string
          titulo: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          dedupe_key?: string
          descricao?: string | null
          id?: string
          link?: string | null
          project_id?: string | null
          resolved_at?: string | null
          resolvido?: boolean
          severidade?: string
          tipo?: string
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "nudges_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_health"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "nudges_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nudges_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "fila_comercial"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "nudges_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      pedido_entregas: {
        Row: {
          concluida_em: string | null
          contato_em: string | null
          created_at: string
          email_enviado_em: string | null
          entrega: string
          id: string
          observacoes: string | null
          pedido_id: string
          produto_id: string
          status: string
          updated_at: string
        }
        Insert: {
          concluida_em?: string | null
          contato_em?: string | null
          created_at?: string
          email_enviado_em?: string | null
          entrega: string
          id?: string
          observacoes?: string | null
          pedido_id: string
          produto_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          concluida_em?: string | null
          contato_em?: string | null
          created_at?: string
          email_enviado_em?: string | null
          entrega?: string
          id?: string
          observacoes?: string | null
          pedido_id?: string
          produto_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pedido_entregas_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedido_entregas_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      pedido_medicoes: {
        Row: {
          agendada_para: string
          analysis_id: string | null
          created_at: string
          email_enviado_em: string | null
          id: string
          pedido_id: string
          semana: number
          tentativas: number
        }
        Insert: {
          agendada_para: string
          analysis_id?: string | null
          created_at?: string
          email_enviado_em?: string | null
          id?: string
          pedido_id: string
          semana: number
          tentativas?: number
        }
        Update: {
          agendada_para?: string
          analysis_id?: string | null
          created_at?: string
          email_enviado_em?: string | null
          id?: string
          pedido_id?: string
          semana?: number
          tentativas?: number
        }
        Relationships: [
          {
            foreignKeyName: "pedido_medicoes_analysis_id_fkey"
            columns: ["analysis_id"]
            isOneToOne: false
            referencedRelation: "analyses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedido_medicoes_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
        ]
      }
      pedidos: {
        Row: {
          acompanhamento_enviado_em: string | null
          analysis_id: string | null
          checkout_id: string
          client_id: string | null
          cliente_documento: string | null
          cliente_email: string
          cliente_nome: string
          cliente_whatsapp: string | null
          concorrentes: string[] | null
          created_at: string
          cupom_id: string | null
          desconto_centavos: number
          desconto_metodo_centavos: number
          entregue_em: string | null
          id: string
          itens: Json
          lead_id: string | null
          mp_card_id: string | null
          mp_customer_id: string | null
          mp_payment_id: string | null
          origem: string | null
          passos_feitos: Json
          plano: Json | null
          plano_code: string | null
          plano_gerado_em: string | null
          receivable_id: string | null
          recibo_enviado_em: string | null
          reembolsado_em: string | null
          reembolso_iniciado_em: string | null
          reembolso_mp_id: string | null
          reembolso_por: string | null
          reembolso_valor_centavos: number | null
          status: string
          subtotal_centavos: number
          total_centavos: number
          updated_at: string
        }
        Insert: {
          acompanhamento_enviado_em?: string | null
          analysis_id?: string | null
          checkout_id: string
          client_id?: string | null
          cliente_documento?: string | null
          cliente_email: string
          cliente_nome: string
          cliente_whatsapp?: string | null
          concorrentes?: string[] | null
          created_at?: string
          cupom_id?: string | null
          desconto_centavos?: number
          desconto_metodo_centavos?: number
          entregue_em?: string | null
          id?: string
          itens?: Json
          lead_id?: string | null
          mp_card_id?: string | null
          mp_customer_id?: string | null
          mp_payment_id?: string | null
          origem?: string | null
          passos_feitos?: Json
          plano?: Json | null
          plano_code?: string | null
          plano_gerado_em?: string | null
          receivable_id?: string | null
          recibo_enviado_em?: string | null
          reembolsado_em?: string | null
          reembolso_iniciado_em?: string | null
          reembolso_mp_id?: string | null
          reembolso_por?: string | null
          reembolso_valor_centavos?: number | null
          status?: string
          subtotal_centavos?: number
          total_centavos?: number
          updated_at?: string
        }
        Update: {
          acompanhamento_enviado_em?: string | null
          analysis_id?: string | null
          checkout_id?: string
          client_id?: string | null
          cliente_documento?: string | null
          cliente_email?: string
          cliente_nome?: string
          cliente_whatsapp?: string | null
          concorrentes?: string[] | null
          created_at?: string
          cupom_id?: string | null
          desconto_centavos?: number
          desconto_metodo_centavos?: number
          entregue_em?: string | null
          id?: string
          itens?: Json
          lead_id?: string | null
          mp_card_id?: string | null
          mp_customer_id?: string | null
          mp_payment_id?: string | null
          origem?: string | null
          passos_feitos?: Json
          plano?: Json | null
          plano_code?: string | null
          plano_gerado_em?: string | null
          receivable_id?: string | null
          recibo_enviado_em?: string | null
          reembolsado_em?: string | null
          reembolso_iniciado_em?: string | null
          reembolso_mp_id?: string | null
          reembolso_por?: string | null
          reembolso_valor_centavos?: number | null
          status?: string
          subtotal_centavos?: number
          total_centavos?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pedidos_checkout_id_fkey"
            columns: ["checkout_id"]
            isOneToOne: false
            referencedRelation: "checkouts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_health"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "pedidos_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_cupom_id_fkey"
            columns: ["cupom_id"]
            isOneToOne: false
            referencedRelation: "cupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_receivable_id_fkey"
            columns: ["receivable_id"]
            isOneToOne: false
            referencedRelation: "receivables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_reembolso_por_fkey"
            columns: ["reembolso_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      produtos: {
        Row: {
          ativo: boolean
          categoria: string | null
          created_at: string
          descricao: string | null
          entrega: string
          id: string
          nome: string
          preco_ancora_centavos: number | null
          preco_centavos: number
          slug: string
          tipo: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          categoria?: string | null
          created_at?: string
          descricao?: string | null
          entrega?: string
          id?: string
          nome: string
          preco_ancora_centavos?: number | null
          preco_centavos: number
          slug: string
          tipo?: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          categoria?: string | null
          created_at?: string
          descricao?: string | null
          entrega?: string
          id?: string
          nome?: string
          preco_ancora_centavos?: number | null
          preco_centavos?: number
          slug?: string
          tipo?: string
          updated_at?: string
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
            referencedRelation: "fila_comercial"
            referencedColumns: ["project_id"]
          },
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
            referencedRelation: "fila_comercial"
            referencedColumns: ["project_id"]
          },
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
            referencedRelation: "fila_comercial"
            referencedColumns: ["project_id"]
          },
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
          horas_estimadas: number | null
          id: string
          motivo_perda: string | null
          nome: string
          origem: string | null
          perdido_em: string | null
          portal_token: string
          previsao_fechamento: string | null
          proxima_acao: string | null
          proxima_acao_em: string | null
          responsavel_id: string | null
          status: string
          tipo_servico: string
          updated_at: string
          valor_estimado: number | null
        }
        Insert: {
          client_id: string
          created_at?: string
          horas_estimadas?: number | null
          id?: string
          motivo_perda?: string | null
          nome: string
          origem?: string | null
          perdido_em?: string | null
          portal_token?: string
          previsao_fechamento?: string | null
          proxima_acao?: string | null
          proxima_acao_em?: string | null
          responsavel_id?: string | null
          status?: string
          tipo_servico: string
          updated_at?: string
          valor_estimado?: number | null
        }
        Update: {
          client_id?: string
          created_at?: string
          horas_estimadas?: number | null
          id?: string
          motivo_perda?: string | null
          nome?: string
          origem?: string | null
          perdido_em?: string | null
          portal_token?: string
          previsao_fechamento?: string | null
          proxima_acao?: string | null
          proxima_acao_em?: string | null
          responsavel_id?: string | null
          status?: string
          tipo_servico?: string
          updated_at?: string
          valor_estimado?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_health"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "projects_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
          aceite_ip: unknown
          aceite_nome: string | null
          aceite_user_agent: string | null
          apresentacao: Json | null
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
          aceite_ip?: unknown
          aceite_nome?: string | null
          aceite_user_agent?: string | null
          apresentacao?: Json | null
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
          aceite_ip?: unknown
          aceite_nome?: string | null
          aceite_user_agent?: string | null
          apresentacao?: Json | null
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
            referencedRelation: "fila_comercial"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "proposals_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      raiox_compras: {
        Row: {
          acompanhamento_enviado_em: string | null
          analysis_id: string
          client_id: string | null
          concorrentes: string[] | null
          created_at: string
          id: string
          lead_id: string | null
          pago_em: string | null
          passos_feitos: Json
          plano: Json | null
          plano_code: string | null
          plano_gerado_em: string | null
          project_id: string | null
          reanalise_agendada_em: string | null
          reanalise_analysis_id: string | null
          receivable_id: string | null
          recibo_enviado_em: string | null
          recuperacao_enviada_em: string | null
          reembolsado_em: string | null
          reembolso_iniciado_em: string | null
          reembolso_mp_id: string | null
          reembolso_por: string | null
          reembolso_valor_centavos: number | null
          status: string
          updated_at: string
          valor_centavos: number
        }
        Insert: {
          acompanhamento_enviado_em?: string | null
          analysis_id: string
          client_id?: string | null
          concorrentes?: string[] | null
          created_at?: string
          id?: string
          lead_id?: string | null
          pago_em?: string | null
          passos_feitos?: Json
          plano?: Json | null
          plano_code?: string | null
          plano_gerado_em?: string | null
          project_id?: string | null
          reanalise_agendada_em?: string | null
          reanalise_analysis_id?: string | null
          receivable_id?: string | null
          recibo_enviado_em?: string | null
          recuperacao_enviada_em?: string | null
          reembolsado_em?: string | null
          reembolso_iniciado_em?: string | null
          reembolso_mp_id?: string | null
          reembolso_por?: string | null
          reembolso_valor_centavos?: number | null
          status?: string
          updated_at?: string
          valor_centavos: number
        }
        Update: {
          acompanhamento_enviado_em?: string | null
          analysis_id?: string
          client_id?: string | null
          concorrentes?: string[] | null
          created_at?: string
          id?: string
          lead_id?: string | null
          pago_em?: string | null
          passos_feitos?: Json
          plano?: Json | null
          plano_code?: string | null
          plano_gerado_em?: string | null
          project_id?: string | null
          reanalise_agendada_em?: string | null
          reanalise_analysis_id?: string | null
          receivable_id?: string | null
          recibo_enviado_em?: string | null
          recuperacao_enviada_em?: string | null
          reembolsado_em?: string | null
          reembolso_iniciado_em?: string | null
          reembolso_mp_id?: string | null
          reembolso_por?: string | null
          reembolso_valor_centavos?: number | null
          status?: string
          updated_at?: string
          valor_centavos?: number
        }
        Relationships: [
          {
            foreignKeyName: "raiox_compras_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_health"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "raiox_compras_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "raiox_compras_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "fila_comercial"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "raiox_compras_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "raiox_compras_receivable_id_fkey"
            columns: ["receivable_id"]
            isOneToOne: false
            referencedRelation: "receivables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "raiox_compras_reembolso_por_fkey"
            columns: ["reembolso_por"]
            isOneToOne: false
            referencedRelation: "profiles"
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
          lembretes_enviados: number
          origem: string | null
          pago_em: string | null
          payment_link: string | null
          payment_token: string
          project_id: string
          proposal_id: string | null
          status: string
          ultimo_lembrete_em: string | null
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
          lembretes_enviados?: number
          origem?: string | null
          pago_em?: string | null
          payment_link?: string | null
          payment_token?: string
          project_id: string
          proposal_id?: string | null
          status?: string
          ultimo_lembrete_em?: string | null
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
          lembretes_enviados?: number
          origem?: string | null
          pago_em?: string | null
          payment_link?: string | null
          payment_token?: string
          project_id?: string
          proposal_id?: string | null
          status?: string
          ultimo_lembrete_em?: string | null
          valor?: number
          vencimento?: string
        }
        Relationships: [
          {
            foreignKeyName: "receivables_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_health"
            referencedColumns: ["client_id"]
          },
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
            referencedRelation: "fila_comercial"
            referencedColumns: ["project_id"]
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
            referencedRelation: "client_health"
            referencedColumns: ["client_id"]
          },
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
            referencedRelation: "fila_comercial"
            referencedColumns: ["project_id"]
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
          first_response_at: string | null
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
          first_response_at?: string | null
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
          first_response_at?: string | null
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
            referencedRelation: "fila_comercial"
            referencedColumns: ["project_id"]
          },
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
            referencedRelation: "fila_comercial"
            referencedColumns: ["project_id"]
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
      utm_conversions: {
        Row: {
          created_at: string
          id: string
          pedido_ref: string | null
          session_id: string
          tipo: string
          valor: number
        }
        Insert: {
          created_at?: string
          id?: string
          pedido_ref?: string | null
          session_id: string
          tipo: string
          valor?: number
        }
        Update: {
          created_at?: string
          id?: string
          pedido_ref?: string | null
          session_id?: string
          tipo?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "utm_conversions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "utm_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      utm_links: {
        Row: {
          created_at: string
          id: string
          nome: string
          url_destino: string
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string
          utm_term: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          nome: string
          url_destino: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string
          utm_term?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
          url_destino?: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string
          utm_term?: string | null
        }
        Relationships: []
      }
      utm_sessions: {
        Row: {
          created_at: string
          id: string
          landing_url: string | null
          referrer: string | null
          session_key: string
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          landing_url?: string | null
          referrer?: string | null
          session_key: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          landing_url?: string | null
          referrer?: string | null
          session_key?: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      client_health: {
        Row: {
          atraso_qtd: number | null
          client_id: string | null
          dias_inativo: number | null
          em_atraso_valor: number | null
          empresa: string | null
          faixa: string | null
          nome: string | null
          nudges_urgentes: number | null
          projetos_parados: number | null
          score: number | null
          sla_estourados: number | null
          tickets_abertos: number | null
          ultimo_nps: number | null
        }
        Relationships: []
      }
      client_timeline: {
        Row: {
          client_id: string | null
          detalhe: string | null
          link: string | null
          quando: string | null
          ref_id: string | null
          tipo: string | null
          titulo: string | null
        }
        Relationships: []
      }
      entregas_pendentes: {
        Row: {
          cliente: string | null
          email: string | null
          faltando: string | null
          id: string | null
          pago_em: string | null
          plano_code: string | null
          tipo: string | null
          valor: number | null
        }
        Relationships: []
      }
      fila_comercial: {
        Row: {
          client_id: string | null
          cliente: string | null
          comprou_plano: boolean | null
          empresa: string | null
          pediu_ajuda: string | null
          previsao_fechamento: string | null
          project_id: string | null
          projeto: string | null
          proxima_acao: string | null
          proxima_acao_em: string | null
          relatorio_aberto_em: string | null
          responsavel: string | null
          responsavel_id: string | null
          reuniao_em: string | null
          status: string | null
          tickets_abertos: number | null
          updated_at: string | null
          valor_estimado: number | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_health"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "projects_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      funil_pessoas: {
        Row: {
          campanha: string | null
          compra_em: string | null
          contratado_em: string | null
          email: string | null
          lead_em: string | null
          origem: string | null
          receita_contratos: number | null
          receita_plano: number | null
          recorrencia_em: string | null
          relatorio_em: string | null
          reuniao_em: string | null
        }
        Relationships: []
      }
      nps_summary: {
        Row: {
          detratores: number | null
          neutros: number | null
          nps: number | null
          promotores: number | null
          total_enviadas: number | null
          total_respostas: number | null
        }
        Relationships: []
      }
      support_ticket_sla: {
        Row: {
          created_at: string | null
          descricao: string | null
          first_response_at: string | null
          id: string | null
          prioridade: string | null
          project_id: string | null
          resolved_at: string | null
          sla_due_at: string | null
          sla_horas: number | null
          status: string | null
          status_sla: string | null
          titulo: string | null
        }
        Insert: {
          created_at?: string | null
          descricao?: string | null
          first_response_at?: string | null
          id?: string | null
          prioridade?: string | null
          project_id?: string | null
          resolved_at?: string | null
          sla_due_at?: never
          sla_horas?: never
          status?: string | null
          status_sla?: never
          titulo?: string | null
        }
        Update: {
          created_at?: string | null
          descricao?: string | null
          first_response_at?: string | null
          id?: string | null
          prioridade?: string | null
          project_id?: string | null
          resolved_at?: string | null
          sla_due_at?: never
          sla_horas?: never
          status?: string | null
          status_sla?: never
          titulo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "fila_comercial"
            referencedColumns: ["project_id"]
          },
          {
            foreignKeyName: "support_tickets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      _call_edge: {
        Args: { p_body: Json; p_function: string }
        Returns: undefined
      }
      _cron_checkout_rastreio_limpar: { Args: never; Returns: undefined }
      _cron_generate_receivables: { Args: never; Returns: undefined }
      _cron_payment_reminders: { Args: never; Returns: undefined }
      _cron_scan_nudges: { Args: never; Returns: undefined }
      _generate_subscription_receivables_internal: {
        Args: never
        Returns: number
      }
      _scan_nudges: { Args: never; Returns: number }
      approve_project_stage: { Args: { p_token: string }; Returns: Json }
      bio_zerar_eventos: { Args: never; Returns: number }
      checkout_item_baixar: {
        Args: {
          p_aprovado: boolean
          p_mp_payment_id?: string
          p_pedido_id: string
          p_produto_id: string
        }
        Returns: boolean
      }
      checkout_item_recebivel: {
        Args: {
          p_pedido_id: string
          p_produto_id: string
          p_receivable_id: string
        }
        Returns: boolean
      }
      checkout_item_reservar: {
        Args: { p_item: Json; p_pedido_id: string }
        Returns: boolean
      }
      checkout_rastrear: {
        Args: {
          p_dados?: Json
          p_sessao: string
          p_slug: string
          p_tipo: string
        }
        Returns: undefined
      }
      converter_lead_em_cliente: {
        Args: { p_lead_id: string }
        Returns: {
          client_id: string
          cliente_criado: boolean
          project_id: string
        }[]
      }
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
      cupom_registrar_uso: { Args: { p_cupom_id: string }; Returns: boolean }
      generate_subscription_receivables: { Args: never; Returns: number }
      get_bio_links: { Args: never; Returns: Json }
      get_briefing_by_token: { Args: { t: string }; Returns: Json }
      get_checkout_info: { Args: { p_slug: string }; Returns: Json }
      get_checkout_prefill: { Args: { p_token: string }; Returns: Json }
      get_contract_by_token: { Args: { p_token: string }; Returns: Json }
      get_nps_by_token: { Args: { p_token: string }; Returns: Json }
      get_payment_info: { Args: { p_token: string }; Returns: Json }
      get_pedido_info: { Args: { p_pedido_id: string }; Returns: Json }
      get_portal_ads: { Args: { p_token: string }; Returns: Json }
      get_portal_antes_depois: { Args: { p_token: string }; Returns: Json }
      get_portal_by_token: { Args: { t: string }; Returns: Json }
      get_portal_files: { Args: { p_token: string }; Returns: Json }
      get_proposal_by_token: { Args: { t: string }; Returns: Json }
      internal_secret: { Args: { p_key: string }; Returns: string }
      is_admin: { Args: never; Returns: boolean }
      is_service_role: { Args: never; Returns: boolean }
      is_team_member: { Args: never; Returns: boolean }
      is_visible_client_file: {
        Args: { p_storage_path: string }
        Returns: boolean
      }
      pedido_reembolso_concluir: {
        Args: {
          p_mp_refund_id?: string
          p_pedido_id: string
          p_valor_centavos?: number
        }
        Returns: Json
      }
      pedido_reembolso_iniciar: {
        Args: {
          p_pedido_id: string
          p_retomar_apos?: string
          p_usuario_id?: string
        }
        Returns: Json
      }
      pedido_reembolso_liberar: {
        Args: { p_pedido_id: string }
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
      push_nudge: {
        Args: {
          p_client_id: string
          p_dedupe_key: string
          p_descricao: string
          p_link: string
          p_project_id: string
          p_severidade: string
          p_tipo: string
          p_titulo: string
        }
        Returns: boolean
      }
      raiox_excluir_lead: { Args: { p_lead_id: string }; Returns: undefined }
      raiox_reprocessar_analise: {
        Args: { p_analysis_id: string }
        Returns: boolean
      }
      raiox_zerar_tudo: {
        Args: never
        Returns: {
          analises_apagadas: number
          leads_apagados: number
        }[]
      }
      registrar_evento_bio: {
        Args: {
          p_campaign?: string
          p_link_id?: string
          p_medium?: string
          p_sessao: string
          p_source?: string
          p_tipo: string
        }
        Returns: Json
      }
      request_client_ip: { Args: never; Returns: unknown }
      request_user_agent: { Args: never; Returns: string }
      respond_proposal: {
        Args: { p_aceite: boolean; p_nome: string; t: string }
        Returns: Json
      }
      revert_proposal_acceptance: {
        Args: { p_proposal_id: string }
        Returns: Json
      }
      scan_compra_reembolso_concluir: {
        Args: {
          p_compra_id: string
          p_mp_refund_id?: string
          p_valor_centavos?: number
        }
        Returns: Json
      }
      scan_compra_reembolso_iniciar: {
        Args: {
          p_compra_id: string
          p_retomar_apos?: string
          p_usuario_id?: string
        }
        Returns: Json
      }
      scan_compra_reembolso_liberar: {
        Args: { p_compra_id: string }
        Returns: boolean
      }
      scan_compra_reembolso_pagamento: {
        Args: { p_gateway_payment_id: string; p_receivable_id: string }
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
      sla_hours: { Args: { p_prioridade: string }; Returns: number }
      submit_briefing: { Args: { p_respostas: Json; t: string }; Returns: Json }
      submit_nps: {
        Args: { p_comentario: string; p_score: number; p_token: string }
        Returns: Json
      }
      track_utm_conversion: {
        Args: {
          p_pedido_ref?: string
          p_session_key: string
          p_tipo: string
          p_valor?: number
        }
        Returns: Json
      }
      track_utm_visit: {
        Args: {
          p_campaign?: string
          p_content?: string
          p_landing_url?: string
          p_medium?: string
          p_referrer?: string
          p_session_key: string
          p_source?: string
          p_term?: string
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
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
