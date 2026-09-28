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
      driver_shifts: {
        Row: {
          created_at: string
          driver_user_id: string
          ends_at: string
          id: string
          starts_at: string
        }
        Insert: {
          created_at?: string
          driver_user_id: string
          ends_at: string
          id?: string
          starts_at: string
        }
        Update: {
          created_at?: string
          driver_user_id?: string
          ends_at?: string
          id?: string
          starts_at?: string
        }
        Relationships: []
      }
      garage_assignments: {
        Row: {
          assigned_at: string
          assigned_by: string
          created_at: string
          garage_spot_id: string
          id: string
          reservation_id: string
          superseded_at: string | null
        }
        Insert: {
          assigned_at?: string
          assigned_by: string
          created_at?: string
          garage_spot_id: string
          id?: string
          reservation_id: string
          superseded_at?: string | null
        }
        Update: {
          assigned_at?: string
          assigned_by?: string
          created_at?: string
          garage_spot_id?: string
          id?: string
          reservation_id?: string
          superseded_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "garage_assignments_garage_spot_id_fkey"
            columns: ["garage_spot_id"]
            isOneToOne: false
            referencedRelation: "garage_spots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "garage_assignments_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
        ]
      }
      garage_spots: {
        Row: {
          capacity_label: string
          created_at: string
          id: string
          is_available: boolean
          name: string
          spot_type: string
          updated_at: string
        }
        Insert: {
          capacity_label: string
          created_at?: string
          id?: string
          is_available?: boolean
          name: string
          spot_type: string
          updated_at?: string
        }
        Update: {
          capacity_label?: string
          created_at?: string
          id?: string
          is_available?: boolean
          name?: string
          spot_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      invoice_items: {
        Row: {
          days_count: number
          description: string
          gross_amount: number
          guest_name: string
          id: string
          invoice_id: string
          license_plate: string | null
          net_amount: number | null
          parking_type: string
          period_end: string
          period_start: string
          position: number
          reservation_id: string
          vat_amount: number | null
        }
        Insert: {
          days_count: number
          description: string
          gross_amount: number
          guest_name: string
          id?: string
          invoice_id: string
          license_plate?: string | null
          net_amount?: number | null
          parking_type: string
          period_end: string
          period_start: string
          position: number
          reservation_id: string
          vat_amount?: number | null
        }
        Update: {
          days_count?: number
          description?: string
          gross_amount?: number
          guest_name?: string
          id?: string
          invoice_id?: string
          license_plate?: string | null
          net_amount?: number | null
          parking_type?: string
          period_end?: string
          period_start?: string
          position?: number
          reservation_id?: string
          vat_amount?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: true
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          billing_month: number | null
          billing_year: number | null
          buyer_address: string
          buyer_email: string | null
          buyer_name: string
          buyer_nip: string
          created_at: string | null
          created_by: string
          id: string
          invoice_month: number
          invoice_number: string
          invoice_seq: number
          invoice_year: number
          issue_date: string
          payment_due_date: string | null
          sale_date: string | null
          seller_address: string
          seller_bank_account: string
          seller_name: string
          seller_nip: string
          total_amount: number
          total_net: number | null
          total_vat: number | null
          travel_agency_id: string | null
          vat_rate: number | null
        }
        Insert: {
          billing_month?: number | null
          billing_year?: number | null
          buyer_address: string
          buyer_email?: string | null
          buyer_name: string
          buyer_nip: string
          created_at?: string | null
          created_by: string
          id?: string
          invoice_month: number
          invoice_number: string
          invoice_seq: number
          invoice_year: number
          issue_date?: string
          payment_due_date?: string | null
          sale_date?: string | null
          seller_address: string
          seller_bank_account: string
          seller_name: string
          seller_nip: string
          total_amount: number
          total_net?: number | null
          total_vat?: number | null
          travel_agency_id?: string | null
          vat_rate?: number | null
        }
        Update: {
          billing_month?: number | null
          billing_year?: number | null
          buyer_address?: string
          buyer_email?: string | null
          buyer_name?: string
          buyer_nip?: string
          created_at?: string | null
          created_by?: string
          id?: string
          invoice_month?: number
          invoice_number?: string
          invoice_seq?: number
          invoice_year?: number
          issue_date?: string
          payment_due_date?: string | null
          sale_date?: string | null
          seller_address?: string
          seller_bank_account?: string
          seller_name?: string
          seller_nip?: string
          total_amount?: number
          total_net?: number | null
          total_vat?: number | null
          travel_agency_id?: string | null
          vat_rate?: number | null
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
      price_list_rates: {
        Row: {
          day_prices: number[]
          extra_day_price: number
          parking_type: string
          price_list_id: string
        }
        Insert: {
          day_prices: number[]
          extra_day_price: number
          parking_type: string
          price_list_id: string
        }
        Update: {
          day_prices?: number[]
          extra_day_price?: number
          parking_type?: string
          price_list_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "price_list_rates_price_list_id_fkey"
            columns: ["price_list_id"]
            isOneToOne: false
            referencedRelation: "price_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      price_lists: {
        Row: {
          created_at: string
          id: string
          updated_at: string
          valid_from: string
          valid_to: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          updated_at?: string
          valid_from: string
          valid_to?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          updated_at?: string
          valid_from?: string
          valid_to?: string | null
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
          paid_at_arrival: boolean
          paid_at_departure: boolean
          parking_sector: string | null
          parking_type: string
          passenger_count: number | null
          phone: string | null
          planned_check_in: string
          planned_check_out: string
          source: Database["public"]["Enums"]["reservation_source"]
          status: Database["public"]["Enums"]["reservation_status"]
          surcharge_amount: number | null
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
          paid_at_arrival?: boolean
          paid_at_departure?: boolean
          parking_sector?: string | null
          parking_type?: string
          passenger_count?: number | null
          phone?: string | null
          planned_check_in: string
          planned_check_out: string
          source: Database["public"]["Enums"]["reservation_source"]
          status?: Database["public"]["Enums"]["reservation_status"]
          surcharge_amount?: number | null
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
          paid_at_arrival?: boolean
          paid_at_departure?: boolean
          parking_sector?: string | null
          parking_type?: string
          passenger_count?: number | null
          phone?: string | null
          planned_check_in?: string
          planned_check_out?: string
          source?: Database["public"]["Enums"]["reservation_source"]
          status?: Database["public"]["Enums"]["reservation_status"]
          surcharge_amount?: number | null
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
      assign_garage_spot: {
        Args: {
          p_assigned_by: string
          p_garage_spot_id: string
          p_reservation_id: string
        }
        Returns: {
          assigned_at: string
          assigned_by: string
          created_at: string
          garage_spot_id: string
          id: string
          reservation_id: string
          superseded_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "garage_assignments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      calculate_total_cost: {
        Args: {
          p_check_in: string
          p_check_out: string
          p_parking_type?: string
        }
        Returns: number
      }
      create_invoice: {
        Args: {
          p_buyer_address: string
          p_buyer_email?: string
          p_buyer_name: string
          p_buyer_nip: string
          p_reservation_id: string
        }
        Returns: string
      }
      current_app_role: { Args: never; Returns: string }
      get_system_user: { Args: never; Returns: string }
      is_driver_role: { Args: never; Returns: boolean }
      is_staff_role: { Args: never; Returns: boolean }
      next_invoice_number: {
        Args: { p_at?: string }
        Returns: {
          invoice_month: number
          invoice_number: string
          invoice_seq: number
          invoice_year: number
        }[]
      }
      save_price_list: {
        Args: {
          p_id: string
          p_rates: Json
          p_valid_from: string
          p_valid_to: string
        }
        Returns: string
      }
      setting_text: {
        Args: { p_key: string }
        Returns: string
      }
      vat_net_from_gross: {
        Args: { p_gross: number; p_rate: number }
        Returns: number
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
