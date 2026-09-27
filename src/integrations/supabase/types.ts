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
      import_batches: {
        Row: {
          column_map: Json | null
          created_at: string
          filename: string | null
          id: string
          inserted_count: number
          kind: string
          row_count: number
          updated_count: number
          user_id: string
        }
        Insert: {
          column_map?: Json | null
          created_at?: string
          filename?: string | null
          id?: string
          inserted_count?: number
          kind: string
          row_count?: number
          updated_count?: number
          user_id?: string
        }
        Update: {
          column_map?: Json | null
          created_at?: string
          filename?: string | null
          id?: string
          inserted_count?: number
          kind?: string
          row_count?: number
          updated_count?: number
          user_id?: string
        }
        Relationships: []
      }
      integration_settings: {
        Row: {
          api_key: string | null
          base_url: string | null
          capabilities: Json | null
          created_at: string
          enabled: boolean
          id: string
          last_sync_at: string | null
          provider: string
          user_id: string
        }
        Insert: {
          api_key?: string | null
          base_url?: string | null
          capabilities?: Json | null
          created_at?: string
          enabled?: boolean
          id?: string
          last_sync_at?: string | null
          provider: string
          user_id?: string
        }
        Update: {
          api_key?: string | null
          base_url?: string | null
          capabilities?: Json | null
          created_at?: string
          enabled?: boolean
          id?: string
          last_sync_at?: string | null
          provider?: string
          user_id?: string
        }
        Relationships: []
      }
      match_suggestions: {
        Row: {
          created_at: string
          id: string
          method: string
          order_id: string
          score: number
          shipment_id: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          method: string
          order_id: string
          score?: number
          shipment_id: string
          status?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          method?: string
          order_id?: string
          score?: number
          shipment_id?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_suggestions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_suggestions_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          cod_amount: number
          created_at: string
          customer_name: string | null
          id: string
          order_date: string | null
          order_ref: string
          phone: string | null
          phone_norm: string | null
          source: string
          tracking_number: string | null
          user_id: string
          zone: string | null
        }
        Insert: {
          cod_amount?: number
          created_at?: string
          customer_name?: string | null
          id?: string
          order_date?: string | null
          order_ref: string
          phone?: string | null
          phone_norm?: string | null
          source?: string
          tracking_number?: string | null
          user_id?: string
          zone?: string | null
        }
        Update: {
          cod_amount?: number
          created_at?: string
          customer_name?: string | null
          id?: string
          order_date?: string | null
          order_ref?: string
          phone?: string | null
          phone_norm?: string | null
          source?: string
          tracking_number?: string | null
          user_id?: string
          zone?: string | null
        }
        Relationships: []
      }
      payout_items: {
        Row: {
          amount: number
          created_at: string
          fees: number
          id: string
          payout_id: string
          shipment_id: string | null
          tracking_number: string
          user_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          fees?: number
          id?: string
          payout_id: string
          shipment_id?: string | null
          tracking_number: string
          user_id?: string
        }
        Update: {
          amount?: number
          created_at?: string
          fees?: number
          id?: string
          payout_id?: string
          shipment_id?: string | null
          tracking_number?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payout_items_payout_id_fkey"
            columns: ["payout_id"]
            isOneToOne: false
            referencedRelation: "payouts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payout_items_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
        ]
      }
      payouts: {
        Row: {
          created_at: string
          id: string
          payout_date: string | null
          payout_ref: string
          total_amount: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          payout_date?: string | null
          payout_ref: string
          total_amount?: number
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          payout_date?: string | null
          payout_ref?: string
          total_amount?: number
          user_id?: string
        }
        Relationships: []
      }
      pricing_rules: {
        Row: {
          cod_fee_fixed: number
          cod_fee_percent: number
          created_at: string
          id: string
          return_fee: number
          shipping_fee: number
          user_id: string
          zone: string
        }
        Insert: {
          cod_fee_fixed?: number
          cod_fee_percent?: number
          created_at?: string
          id?: string
          return_fee?: number
          shipping_fee?: number
          user_id?: string
          zone?: string
        }
        Update: {
          cod_fee_fixed?: number
          cod_fee_percent?: number
          created_at?: string
          id?: string
          return_fee?: number
          shipping_fee?: number
          user_id?: string
          zone?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          business_name: string | null
          cod_tolerance: number
          created_at: string
          id: string
        }
        Insert: {
          business_name?: string | null
          cod_tolerance?: number
          created_at?: string
          id: string
        }
        Update: {
          business_name?: string | null
          cod_tolerance?: number
          created_at?: string
          id?: string
        }
        Relationships: []
      }
      shipments: {
        Row: {
          cod_amount: number
          collected_amount: number | null
          customer_name: string | null
          delivered_at: string | null
          fees_amount: number | null
          id: string
          is_delivered: boolean
          is_returned: boolean
          match_method: string | null
          match_score: number | null
          matched_at: string | null
          order_id: string | null
          phone: string | null
          phone_norm: string | null
          raw: Json | null
          reference: string | null
          source: string
          status: string | null
          tracking_number: string
          updated_at: string
          user_id: string
          zone: string | null
        }
        Insert: {
          cod_amount?: number
          collected_amount?: number | null
          customer_name?: string | null
          delivered_at?: string | null
          fees_amount?: number | null
          id?: string
          is_delivered?: boolean
          is_returned?: boolean
          match_method?: string | null
          match_score?: number | null
          matched_at?: string | null
          order_id?: string | null
          phone?: string | null
          phone_norm?: string | null
          raw?: Json | null
          reference?: string | null
          source?: string
          status?: string | null
          tracking_number: string
          updated_at?: string
          user_id?: string
          zone?: string | null
        }
        Update: {
          cod_amount?: number
          collected_amount?: number | null
          customer_name?: string | null
          delivered_at?: string | null
          fees_amount?: number | null
          id?: string
          is_delivered?: boolean
          is_returned?: boolean
          match_method?: string | null
          match_score?: number | null
          matched_at?: string | null
          order_id?: string | null
          phone?: string | null
          phone_norm?: string | null
          raw?: Json | null
          reference?: string | null
          source?: string
          status?: string | null
          tracking_number?: string
          updated_at?: string
          user_id?: string
          zone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shipments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
