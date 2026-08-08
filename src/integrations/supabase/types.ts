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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      audit_findings: {
        Row: {
          audit_id: string
          category: string
          created_at: string
          detected_from_document: string | null
          id: string
          needs_human_verification: boolean
          requirement_from_source: string | null
          severity: string
          source_url: string | null
          title: string
          user_id: string
        }
        Insert: {
          audit_id: string
          category?: string
          created_at?: string
          detected_from_document?: string | null
          id?: string
          needs_human_verification?: boolean
          requirement_from_source?: string | null
          severity?: string
          source_url?: string | null
          title: string
          user_id: string
        }
        Update: {
          audit_id?: string
          category?: string
          created_at?: string
          detected_from_document?: string | null
          id?: string
          needs_human_verification?: boolean
          requirement_from_source?: string | null
          severity?: string
          source_url?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_findings_audit_id_fkey"
            columns: ["audit_id"]
            isOneToOne: false
            referencedRelation: "audits"
            referencedColumns: ["id"]
          },
        ]
      }
      audits: {
        Row: {
          case_id: string
          created_at: string
          id: string
          mode: string
          readiness_score: number | null
          status: string
          summary: string | null
          user_id: string
        }
        Insert: {
          case_id: string
          created_at?: string
          id?: string
          mode?: string
          readiness_score?: number | null
          status?: string
          summary?: string | null
          user_id: string
        }
        Update: {
          case_id?: string
          created_at?: string
          id?: string
          mode?: string
          readiness_score?: number | null
          status?: string
          summary?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audits_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
        ]
      }
      case_documents: {
        Row: {
          case_id: string
          created_at: string
          doc_kind: string | null
          extracted_text: string | null
          file_name: string
          id: string
          mime_type: string | null
          size_bytes: number | null
          storage_path: string
          user_id: string
        }
        Insert: {
          case_id: string
          created_at?: string
          doc_kind?: string | null
          extracted_text?: string | null
          file_name: string
          id?: string
          mime_type?: string | null
          size_bytes?: number | null
          storage_path: string
          user_id: string
        }
        Update: {
          case_id?: string
          created_at?: string
          doc_kind?: string | null
          extracted_text?: string | null
          file_name?: string
          id?: string
          mime_type?: string | null
          size_bytes?: number | null
          storage_path?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_documents_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
        ]
      }
      case_messages: {
        Row: {
          answer: Json | null
          case_id: string
          citations: Json
          content: string
          created_at: string
          id: string
          mode: string
          role: string
          user_id: string
        }
        Insert: {
          answer?: Json | null
          case_id: string
          citations?: Json
          content: string
          created_at?: string
          id?: string
          mode?: string
          role: string
          user_id: string
        }
        Update: {
          answer?: Json | null
          case_id?: string
          citations?: Json
          content?: string
          created_at?: string
          id?: string
          mode?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_messages_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
        ]
      }
      cases: {
        Row: {
          application_date: string | null
          created_at: string
          destination: string | null
          employment_status: string | null
          financial_summary: string | null
          id: string
          name: string
          nationality: string | null
          residence_country: string | null
          sponsor_info: string | null
          travel_date: string | null
          travel_history: string | null
          updated_at: string
          user_id: string
          visa_type: string | null
        }
        Insert: {
          application_date?: string | null
          created_at?: string
          destination?: string | null
          employment_status?: string | null
          financial_summary?: string | null
          id?: string
          name?: string
          nationality?: string | null
          residence_country?: string | null
          sponsor_info?: string | null
          travel_date?: string | null
          travel_history?: string | null
          updated_at?: string
          user_id: string
          visa_type?: string | null
        }
        Update: {
          application_date?: string | null
          created_at?: string
          destination?: string | null
          employment_status?: string | null
          financial_summary?: string | null
          id?: string
          name?: string
          nationality?: string | null
          residence_country?: string | null
          sponsor_info?: string | null
          travel_date?: string | null
          travel_history?: string | null
          updated_at?: string
          user_id?: string
          visa_type?: string | null
        }
        Relationships: []
      }
      checklist_items: {
        Row: {
          case_id: string
          created_at: string
          id: string
          label: string
          last_verified_at: string | null
          position: number
          source_tier: number | null
          source_title: string | null
          source_url: string | null
          status: string
          user_id: string
          why: string | null
        }
        Insert: {
          case_id: string
          created_at?: string
          id?: string
          label: string
          last_verified_at?: string | null
          position?: number
          source_tier?: number | null
          source_title?: string | null
          source_url?: string | null
          status?: string
          user_id: string
          why?: string | null
        }
        Update: {
          case_id?: string
          created_at?: string
          id?: string
          label?: string
          last_verified_at?: string | null
          position?: number
          source_tier?: number | null
          source_title?: string | null
          source_url?: string | null
          status?: string
          user_id?: string
          why?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "checklist_items_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
        ]
      }
      crawls: {
        Row: {
          bytes: number | null
          error: string | null
          finished_at: string | null
          http_status: number | null
          id: string
          robots_allowed: boolean | null
          source_id: string
          started_at: string
          status: string
        }
        Insert: {
          bytes?: number | null
          error?: string | null
          finished_at?: string | null
          http_status?: number | null
          id?: string
          robots_allowed?: boolean | null
          source_id: string
          started_at?: string
          status?: string
        }
        Update: {
          bytes?: number | null
          error?: string | null
          finished_at?: string | null
          http_status?: number | null
          id?: string
          robots_allowed?: boolean | null
          source_id?: string
          started_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "crawls_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
        ]
      }
      document_chunks: {
        Row: {
          content: string
          created_at: string
          document_id: string
          embedding_status: string
          id: string
          position: number
          source_id: string
          token_estimate: number
        }
        Insert: {
          content: string
          created_at?: string
          document_id: string
          embedding_status?: string
          id?: string
          position: number
          source_id: string
          token_estimate?: number
        }
        Update: {
          content?: string
          created_at?: string
          document_id?: string
          embedding_status?: string
          id?: string
          position?: number
          source_id?: string
          token_estimate?: number
        }
        Relationships: [
          {
            foreignKeyName: "document_chunks_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_chunks_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          content: string
          content_hash: string
          id: string
          lang: string
          published_at: string | null
          retrieved_at: string
          source_id: string
          title: string | null
          url: string
        }
        Insert: {
          content: string
          content_hash: string
          id?: string
          lang?: string
          published_at?: string | null
          retrieved_at?: string
          source_id: string
          title?: string | null
          url: string
        }
        Update: {
          content?: string
          content_hash?: string
          id?: string
          lang?: string
          published_at?: string | null
          retrieved_at?: string
          source_id?: string
          title?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
        }
        Relationships: []
      }
      sources: {
        Row: {
          content_hash: string | null
          country: string | null
          crawl_status: string
          created_at: string
          destination: string | null
          domain: string
          enabled: boolean
          freshness_days: number | null
          id: string
          language: string
          last_crawled_at: string | null
          last_error: string | null
          notes: string | null
          source_type: string
          tier: number
          title: string
          updated_at: string
          url: string
          visa_types: string[]
        }
        Insert: {
          content_hash?: string | null
          country?: string | null
          crawl_status?: string
          created_at?: string
          destination?: string | null
          domain: string
          enabled?: boolean
          freshness_days?: number | null
          id?: string
          language?: string
          last_crawled_at?: string | null
          last_error?: string | null
          notes?: string | null
          source_type?: string
          tier: number
          title: string
          updated_at?: string
          url: string
          visa_types?: string[]
        }
        Update: {
          content_hash?: string | null
          country?: string | null
          crawl_status?: string
          created_at?: string
          destination?: string | null
          domain?: string
          enabled?: boolean
          freshness_days?: number | null
          id?: string
          language?: string
          last_crawled_at?: string | null
          last_error?: string | null
          notes?: string | null
          source_type?: string
          tier?: number
          title?: string
          updated_at?: string
          url?: string
          visa_types?: string[]
        }
        Relationships: []
      }
      usage_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          metadata: Json
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json
          user_id?: string | null
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
          role: Database["public"]["Enums"]["app_role"]
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const
