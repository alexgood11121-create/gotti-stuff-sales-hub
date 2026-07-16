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
      branches: {
        Row: {
          address: string | null
          created_at: string
          id: string
          name: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          address?: string | null
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          color: string | null
          created_at: string
          id: string
          name: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string
          branch_id: string | null
          created_at: string
          id: string
          is_read: boolean
          sale_id: string | null
          title: string
        }
        Insert: {
          body: string
          branch_id?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          sale_id?: string | null
          title: string
        }
        Update: {
          body?: string
          branch_id?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          sale_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category_id: string | null
          cost_price: number
          created_at: string
          id: string
          image_url: string | null
          is_active: boolean
          name: string
          sale_price: number
          stock: number
        }
        Insert: {
          category_id?: string | null
          cost_price?: number
          created_at?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          name: string
          sale_price?: number
          stock?: number
        }
        Update: {
          category_id?: string | null
          cost_price?: number
          created_at?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          name?: string
          sale_price?: number
          stock?: number
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          branch_id: string | null
          created_at: string
          email: string | null
          id: string
          nickname: string | null
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          email?: string | null
          id: string
          nickname?: string | null
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          nickname?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_items: {
        Row: {
          cost_price: number
          id: string
          product_id: string | null
          product_name: string
          qty: number
          sale_id: string
          total: number
          unit_price: number
        }
        Insert: {
          cost_price?: number
          id?: string
          product_id?: string | null
          product_name: string
          qty: number
          sale_id: string
          total: number
          unit_price: number
        }
        Update: {
          cost_price?: number
          id?: string
          product_id?: string | null
          product_name?: string
          qty?: number
          sale_id?: string
          total?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "sale_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          branch_id: string | null
          card_amount: number
          cash_amount: number
          cashier_id: string | null
          change_amount: number
          client_uuid: string
          created_at: string
          given_amount: number
          id: string
          payment_method: Database["public"]["Enums"]["payment_method"]
          status: Database["public"]["Enums"]["sale_status"]
          total: number
        }
        Insert: {
          branch_id?: string | null
          card_amount?: number
          cash_amount?: number
          cashier_id?: string | null
          change_amount?: number
          client_uuid: string
          created_at?: string
          given_amount?: number
          id?: string
          payment_method: Database["public"]["Enums"]["payment_method"]
          status?: Database["public"]["Enums"]["sale_status"]
          total: number
        }
        Update: {
          branch_id?: string | null
          card_amount?: number
          cash_amount?: number
          cashier_id?: string | null
          change_amount?: number
          client_uuid?: string
          created_at?: string
          given_amount?: number
          id?: string
          payment_method?: Database["public"]["Enums"]["payment_method"]
          status?: Database["public"]["Enums"]["sale_status"]
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          amount: number
          branch_id: string | null
          created_at: string
          id: string
          note: string | null
          product_id: string | null
          qty: number | null
          type: Database["public"]["Enums"]["movement_type"]
          unit_price: number | null
          user_id: string | null
        }
        Insert: {
          amount: number
          branch_id?: string | null
          created_at?: string
          id?: string
          note?: string | null
          product_id?: string | null
          qty?: number | null
          type: Database["public"]["Enums"]["movement_type"]
          unit_price?: number | null
          user_id?: string | null
        }
        Update: {
          amount?: number
          branch_id?: string | null
          created_at?: string
          id?: string
          note?: string | null
          product_id?: string | null
          qty?: number | null
          type?: Database["public"]["Enums"]["movement_type"]
          unit_price?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
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
      current_user_branch: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "cashier"
      movement_type: "income" | "expense"
      payment_method: "cash" | "card" | "mixed"
      sale_status: "open" | "paid" | "cancelled"
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
      app_role: ["admin", "cashier"],
      movement_type: ["income", "expense"],
      payment_method: ["cash", "card", "mixed"],
      sale_status: ["open", "paid", "cancelled"],
    },
  },
} as const
