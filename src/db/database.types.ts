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
      daily_occupancy: {
        Row: {
          date: string
          occupied_spots: number
          updated_at: string
        }
        Insert: {
          date: string
          occupied_spots?: number
          updated_at?: string
        }
        Update: {
          date?: string
          occupied_spots?: number
          updated_at?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          created_by: string
          id: string
          notes: string | null
          payment_date: string
          reservation_id: string
          status: Database["public"]["Enums"]["payment_status"]
        }
        Insert: {
          amount: number
          created_at?: string
          created_by: string
          id?: string
          notes?: string | null
          payment_date?: string
          reservation_id: string
          status?: Database["public"]["Enums"]["payment_status"]
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string
          id?: string
          notes?: string | null
          payment_date?: string
          reservation_id?: string
          status?: Database["public"]["Enums"]["payment_status"]
        }
        Relationships: [
          {
            foreignKeyName: "payments_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_rules: {
        Row: {
          created_at: string
          days_from: number
          days_to: number
          id: string
          is_active: boolean
          price_per_day: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          days_from: number
          days_to: number
          id?: string
          is_active?: boolean
          price_per_day: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          days_from?: number
          days_to?: number
          id?: string
          is_active?: boolean
          price_per_day?: number
          updated_at?: string
        }
        Relationships: []
      }
      reservations: {
        Row: {
          actual_check_in: string | null
          actual_check_out: string | null
          created_at: string
          created_by: string
          email: string | null
          first_name: string | null
          flight_direction: string | null
          id: string
          is_paid: boolean
          last_modified_by: string
          last_name: string
          license_plate: string | null
          notes: string | null
          phone: string | null
          planned_check_in: string
          planned_check_out: string
          source: Database["public"]["Enums"]["reservation_source"]
          status: Database["public"]["Enums"]["reservation_status"]
          total_cost: number
          updated_at: string
        }
        Insert: {
          actual_check_in?: string | null
          actual_check_out?: string | null
          created_at?: string
          created_by: string
          email?: string | null
          first_name?: string | null
          flight_direction?: string | null
          id?: string
          is_paid?: boolean
          last_modified_by: string
          last_name: string
          license_plate?: string | null
          notes?: string | null
          phone?: string | null
          planned_check_in: string
          planned_check_out: string
          source: Database["public"]["Enums"]["reservation_source"]
          status?: Database["public"]["Enums"]["reservation_status"]
          total_cost: number
          updated_at?: string
        }
        Update: {
          actual_check_in?: string | null
          actual_check_out?: string | null
          created_at?: string
          created_by?: string
          email?: string | null
          first_name?: string | null
          flight_direction?: string | null
          id?: string
          is_paid?: boolean
          last_modified_by?: string
          last_name?: string
          license_plate?: string | null
          notes?: string | null
          phone?: string | null
          planned_check_in?: string
          planned_check_out?: string
          source?: Database["public"]["Enums"]["reservation_source"]
          status?: Database["public"]["Enums"]["reservation_status"]
          total_cost?: number
          updated_at?: string
        }
        Relationships: []
      }
      settings: {
        Row: {
          description: string | null
          key: string
          updated_at: string
          updated_by: string
          value: Json
        }
        Insert: {
          description?: string | null
          key: string
          updated_at?: string
          updated_by: string
          value: Json
        }
        Update: {
          description?: string | null
          key?: string
          updated_at?: string
          updated_by?: string
          value?: Json
        }
        Relationships: []
      }
      transfer_vehicles: {
        Row: {
          capacity: number
          created_at: string
          id: string
          is_active: boolean
          license_plate: string
          name: string
          notes: string | null
          updated_at: string
        }
        Insert: {
          capacity: number
          created_at?: string
          id?: string
          is_active?: boolean
          license_plate: string
          name: string
          notes?: string | null
          updated_at?: string
        }
        Update: {
          capacity?: number
          created_at?: string
          id?: string
          is_active?: boolean
          license_plate?: string
          name?: string
          notes?: string | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calculate_total_cost: {
        Args: { p_check_in: string; p_check_out: string }
        Returns: number
      }
      get_system_user: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
    }
    Enums: {
      payment_status: "pending" | "completed" | "refunded"
      reservation_source: "phone" | "walk_in" | "api"
      reservation_status:
        | "confirmed"
        | "in_progress"
        | "completed"
        | "cancelled"
        | "no_show"
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
    Enums: {
      payment_status: ["pending", "completed", "refunded"],
      reservation_source: ["phone", "walk_in", "api"],
      reservation_status: [
        "confirmed",
        "in_progress",
        "completed",
        "cancelled",
        "no_show",
      ],
    },
  },
} as const

