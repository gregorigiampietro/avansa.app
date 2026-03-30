// ============================================================
// Database types for Avansa
// Manually defined to match supabase/migrations/001_initial_schema.sql
// Format follows `supabase gen types typescript` output
// ============================================================

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      ml_accounts: {
        Row: {
          id: string
          user_id: string
          ml_user_id: number
          nickname: string | null
          email: string | null
          access_token: string | null
          refresh_token: string | null
          token_expires_at: string | null
          status: string
          connected_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          ml_user_id: number
          nickname?: string | null
          email?: string | null
          access_token: string | null
          refresh_token: string | null
          token_expires_at: string | null
          status?: string
          connected_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          ml_user_id?: number
          nickname?: string | null
          email?: string | null
          access_token?: string | null
          refresh_token?: string | null
          token_expires_at?: string | null
          status?: string
          connected_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          id: string
          ml_account_id: string
          ml_item_id: string
          title: string | null
          thumbnail: string | null
          category_id: string | null
          status: string | null
          listing_type: string | null
          price: number | null
          available_quantity: number | null
          sold_quantity: number | null
          permalink: string | null
          sku: string | null
          health: string | null
          condition: string | null
          cost_price: number | null
          packaging_cost: number | null
          other_costs: number | null
          ml_fee: number | null
          shipping_cost: number | null
          tax_percent: number | null
          net_margin: number | null
          margin_percent: number | null
          catalog_product_id: string | null
          catalog_listing: boolean
          last_synced_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          ml_account_id: string
          ml_item_id: string
          title?: string | null
          thumbnail?: string | null
          category_id?: string | null
          status?: string | null
          listing_type?: string | null
          price?: number | null
          available_quantity?: number | null
          sold_quantity?: number | null
          permalink?: string | null
          sku?: string | null
          health?: string | null
          condition?: string | null
          cost_price?: number | null
          packaging_cost?: number | null
          other_costs?: number | null
          ml_fee?: number | null
          shipping_cost?: number | null
          tax_percent?: number | null
          net_margin?: number | null
          margin_percent?: number | null
          catalog_product_id?: string | null
          catalog_listing?: boolean
          last_synced_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          ml_account_id?: string
          ml_item_id?: string
          title?: string | null
          thumbnail?: string | null
          category_id?: string | null
          status?: string | null
          listing_type?: string | null
          price?: number | null
          available_quantity?: number | null
          sold_quantity?: number | null
          permalink?: string | null
          sku?: string | null
          health?: string | null
          condition?: string | null
          cost_price?: number | null
          packaging_cost?: number | null
          other_costs?: number | null
          ml_fee?: number | null
          shipping_cost?: number | null
          tax_percent?: number | null
          net_margin?: number | null
          margin_percent?: number | null
          catalog_product_id?: string | null
          catalog_listing?: boolean
          last_synced_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          id: string
          ml_account_id: string
          ml_order_id: number
          status: string | null
          date_created: string | null
          date_closed: string | null
          total_amount: number | null
          currency_id: string | null
          buyer_id: number | null
          buyer_nickname: string | null
          ml_item_id: string | null
          item_title: string | null
          quantity: number | null
          unit_price: number | null
          sku: string | null
          shipping_id: number | null
          shipping_status: string | null
          shipping_cost: number | null
          payment_status: string | null
          payment_type: string | null
          ml_fee: number | null
          cost_price: number | null
          net_profit: number | null
          last_synced_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          ml_account_id: string
          ml_order_id: number
          status?: string | null
          date_created?: string | null
          date_closed?: string | null
          total_amount?: number | null
          currency_id?: string | null
          buyer_id?: number | null
          buyer_nickname?: string | null
          ml_item_id?: string | null
          item_title?: string | null
          quantity?: number | null
          unit_price?: number | null
          sku?: string | null
          shipping_id?: number | null
          shipping_status?: string | null
          shipping_cost?: number | null
          payment_status?: string | null
          payment_type?: string | null
          ml_fee?: number | null
          cost_price?: number | null
          net_profit?: number | null
          last_synced_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          ml_account_id?: string
          ml_order_id?: number
          status?: string | null
          date_created?: string | null
          date_closed?: string | null
          total_amount?: number | null
          currency_id?: string | null
          buyer_id?: number | null
          buyer_nickname?: string | null
          ml_item_id?: string | null
          item_title?: string | null
          quantity?: number | null
          unit_price?: number | null
          sku?: string | null
          shipping_id?: number | null
          shipping_status?: string | null
          shipping_cost?: number | null
          payment_status?: string | null
          payment_type?: string | null
          ml_fee?: number | null
          cost_price?: number | null
          net_profit?: number | null
          last_synced_at?: string | null
          created_at?: string
        }
        Relationships: []
      }
      webhook_events: {
        Row: {
          id: string
          topic: string
          resource: string
          ml_user_id: number
          received_at: string
          ml_notification_id: string | null
          status: string
          error_message: string | null
          retry_count: number
          processed_at: string | null
          payload: Json | null
        }
        Insert: {
          id?: string
          topic: string
          resource: string
          ml_user_id: number
          received_at?: string
          ml_notification_id?: string | null
          status?: string
          error_message?: string | null
          retry_count?: number
          processed_at?: string | null
          payload?: Json | null
        }
        Update: {
          id?: string
          topic?: string
          resource?: string
          ml_user_id?: number
          received_at?: string
          ml_notification_id?: string | null
          status?: string
          error_message?: string | null
          retry_count?: number
          processed_at?: string | null
          payload?: Json | null
        }
        Relationships: []
      }
      inventory_status: {
        Row: {
          id: string
          product_id: string
          ml_account_id: string
          ml_item_id: string
          warehouse_id: string | null
          available: number
          damaged: number
          expired: number
          lost: number
          in_transfer: number
          reserved: number
          not_apt_for_sale: number
          total_stock: number
          condition_details: Json
          last_synced_at: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          product_id: string
          ml_account_id: string
          ml_item_id: string
          warehouse_id?: string | null
          available?: number
          damaged?: number
          expired?: number
          lost?: number
          in_transfer?: number
          reserved?: number
          not_apt_for_sale?: number
          condition_details?: Json
          last_synced_at?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          product_id?: string
          ml_account_id?: string
          ml_item_id?: string
          warehouse_id?: string | null
          available?: number
          damaged?: number
          expired?: number
          lost?: number
          in_transfer?: number
          reserved?: number
          not_apt_for_sale?: number
          condition_details?: Json
          last_synced_at?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      sync_logs: {
        Row: {
          id: string
          ml_account_id: string
          sync_type: string
          status: string
          items_synced: number
          error_message: string | null
          started_at: string
          completed_at: string | null
        }
        Insert: {
          id?: string
          ml_account_id: string
          sync_type: string
          status: string
          items_synced?: number
          error_message?: string | null
          started_at?: string
          completed_at?: string | null
        }
        Update: {
          id?: string
          ml_account_id?: string
          sync_type?: string
          status?: string
          items_synced?: number
          error_message?: string | null
          started_at?: string
          completed_at?: string | null
        }
        Relationships: []
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
  }
}

// ============================================================
// Convenience row types
// ============================================================

export type MlAccount = Database["public"]["Tables"]["ml_accounts"]["Row"]
export type Product = Database["public"]["Tables"]["products"]["Row"]
export type Order = Database["public"]["Tables"]["orders"]["Row"]
export type WebhookEvent = Database["public"]["Tables"]["webhook_events"]["Row"]
export type InventoryStatus = Database["public"]["Tables"]["inventory_status"]["Row"]
export type SyncLog = Database["public"]["Tables"]["sync_logs"]["Row"]
