// ============================================================
// Mercado Livre API types
// ============================================================

export interface MlTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
  user_id: number;
  refresh_token: string;
}

export interface MlUserResponse {
  id: number;
  nickname: string;
  email: string;
  first_name: string;
  last_name: string;
  site_id: string;
  country_id: string;
  registration_date: string;
  seller_reputation?: {
    level_id: string;
    power_seller_status: string | null;
    transactions: {
      total: number;
      completed: number;
      canceled: number;
    };
  };
}

export interface MlItemsSearchResponse {
  seller_id: string;
  results: string[];
  paging: {
    total: number;
    offset: number;
    limit: number;
  };
}

export interface MlItem {
  id: string;
  title: string;
  thumbnail: string;
  category_id: string;
  status: string;
  listing_type_id: string;
  price: number;
  available_quantity: number;
  sold_quantity: number;
  permalink: string;
  seller_sku?: string;
  condition: string;
  health?: number;
  date_created: string;
  last_updated: string;
}

export interface MlListingPrice {
  listing_type_id: string;
  listing_type_name: string;
  sale_fee_amount: number;
  currency_id: string;
  listing_exposure: string;
}

export interface MlInventoryStatusResponse {
  result: {
    available_quantity: number;
    not_available_quantity: number;
    not_available_detail: Array<{
      status: string;
      quantity: number;
    }>;
  };
}

export interface MlApiError {
  message: string;
  error: string;
  status: number;
  cause: string[];
}

// ============================================================
// Orders
// ============================================================

export interface MlOrderSearchResponse {
  query: string;
  results: MlOrder[];
  paging: {
    total: number;
    offset: number;
    limit: number;
  };
}

export interface MlOrderItem {
  item: {
    id: string;
    title: string;
    category_id: string;
    seller_sku: string | null;
  };
  quantity: number;
  unit_price: number;
  full_unit_price: number;
  currency_id: string;
  sale_fee: number;
}

export interface MlPayment {
  id: number;
  payment_type: string;
  status: string;
  transaction_amount: number;
  shipping_cost: number;
  date_approved: string | null;
}

export interface MlOrder {
  id: number;
  date_created: string;
  date_closed: string | null;
  status: string;
  paid_amount: number;
  currency_id: string;
  order_items: MlOrderItem[];
  payments: MlPayment[];
  shipping: { id: number } | null;
  buyer: {
    id: number;
    nickname: string;
  };
}
