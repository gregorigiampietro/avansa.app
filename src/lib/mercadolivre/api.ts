import { createAdminClient } from "@/lib/supabase/admin";
import { refreshAccessToken } from "./oauth";
import type { MlUserResponse, MlItem, MlItemsSearchResponse, MlShippingOptionsResponse } from "./types";

const ML_API_BASE = "https://api.mercadolibre.com";

/** Max items per multi-get request (ML API limit) */
const MULTI_GET_BATCH_SIZE = 20;

/** Max items per search page (ML API limit) */
const SEARCH_PAGE_LIMIT = 50;

/** Buffer before token expiry to trigger a refresh */
const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000;

// ============================================================
// Token management
// ============================================================

/**
 * Get a valid access token for an ML account.
 * If the token is expired or about to expire (within 5 minutes),
 * refresh it and update the database.
 */
export async function getValidToken(accountId: string): Promise<string> {
  const supabase = createAdminClient();

  const { data: account, error } = await supabase
    .from("ml_accounts")
    .select("*")
    .eq("id", accountId)
    .single();

  if (error || !account) {
    throw new Error("Conta ML não encontrada");
  }

  const expiresAt = new Date(account.token_expires_at!).getTime();
  const now = Date.now();

  if (expiresAt - now > TOKEN_REFRESH_BUFFER_MS) {
    return account.access_token!;
  }

  // Token expired or about to expire — refresh it
  try {
    const tokenData = await refreshAccessToken(account.refresh_token!);

    const newExpiresAt = new Date(
      Date.now() + tokenData.expires_in * 1000
    ).toISOString();

    const { error: updateError } = await supabase
      .from("ml_accounts")
      .update({
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        token_expires_at: newExpiresAt,
        status: "active",
      })
      .eq("id", accountId);

    if (updateError) {
      throw new Error(`Erro ao atualizar token no banco: ${updateError.message}`);
    }

    return tokenData.access_token;
  } catch (err) {
    // Mark account as expired so the user knows they need to reconnect
    await supabase
      .from("ml_accounts")
      .update({ status: "expired" })
      .eq("id", accountId);

    throw new Error(
      `Falha ao renovar token. Reconecte a conta. ${err instanceof Error ? err.message : ""}`
    );
  }
}

// ============================================================
// Generic HTTP helpers
// ============================================================

/**
 * Make an authenticated GET request to the ML API.
 */
export async function mlGet<T>(accountId: string, path: string): Promise<T> {
  const token = await getValidToken(accountId);

  const response = await fetch(`${ML_API_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    next: { revalidate: 0 },
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `ML API GET ${path} retornou ${response.status}: ${errorBody}`
    );
  }

  return response.json() as Promise<T>;
}

/**
 * Make an authenticated PUT request to the ML API.
 */
export async function mlPut<T>(
  accountId: string,
  path: string,
  body: unknown
): Promise<T> {
  const token = await getValidToken(accountId);

  const response = await fetch(`${ML_API_BASE}${path}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `ML API PUT ${path} retornou ${response.status}: ${errorBody}`
    );
  }

  return response.json() as Promise<T>;
}

/**
 * Make an authenticated POST request to the ML API.
 */
export async function mlPost<T>(
  accountId: string,
  path: string,
  body: unknown
): Promise<T> {
  const token = await getValidToken(accountId);

  const response = await fetch(`${ML_API_BASE}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `ML API POST ${path} retornou ${response.status}: ${errorBody}`
    );
  }

  return response.json() as Promise<T>;
}

// ============================================================
// Domain-specific helpers
// ============================================================

/**
 * Fetch ML user info for the authenticated account.
 */
export async function getMlUser(accountId: string): Promise<MlUserResponse> {
  return mlGet<MlUserResponse>(accountId, "/users/me");
}

/**
 * Fetch all item IDs for a seller, handling pagination automatically.
 * Uses `/users/{mlUserId}/items/search` with offset + limit (max 50 per page).
 */
export async function getAllItemIds(
  accountId: string,
  mlUserId: number
): Promise<string[]> {
  const allIds: string[] = [];
  let offset = 0;
  let total = Infinity;

  while (offset < total) {
    const data = await mlGet<MlItemsSearchResponse>(
      accountId,
      `/users/${mlUserId}/items/search?status=active&offset=${offset}&limit=${SEARCH_PAGE_LIMIT}`
    );

    total = data.paging.total;
    allIds.push(...data.results);
    offset += SEARCH_PAGE_LIMIT;
  }

  return allIds;
}

/** Shape returned by the ML multi-get /items?ids= endpoint */
interface MlMultiGetEntry {
  code: number;
  body: MlItem;
}

/**
 * Fetch full item details for a list of item IDs.
 * Batches requests in groups of 20 (ML API limit for multi-get).
 * Items that fail to load (non-200 code) are silently skipped.
 */
export async function getItems(
  accountId: string,
  itemIds: string[]
): Promise<MlItem[]> {
  if (itemIds.length === 0) return [];

  const items: MlItem[] = [];

  // Split into batches of 20
  const batches: string[][] = [];
  for (let i = 0; i < itemIds.length; i += MULTI_GET_BATCH_SIZE) {
    batches.push(itemIds.slice(i, i + MULTI_GET_BATCH_SIZE));
  }

  // Process batches sequentially to avoid hitting rate limits
  for (const batch of batches) {
    const ids = batch.join(",");
    const results = await mlGet<MlMultiGetEntry[]>(
      accountId,
      `/items?ids=${ids}`
    );

    for (const entry of results) {
      if (entry.code === 200) {
        items.push(entry.body);
      }
    }
  }

  return items;
}

/**
 * Convenience: fetch all items for a seller in one call.
 * First fetches all IDs, then multi-gets the full item details.
 */
export async function getAllItems(
  accountId: string,
  mlUserId: number
): Promise<MlItem[]> {
  const itemIds = await getAllItemIds(accountId, mlUserId);
  return getItems(accountId, itemIds);
}

// ============================================================
// Item mutation helpers
// ============================================================

/**
 * Update the price of an item.
 */
export async function updateItemPrice(
  accountId: string,
  itemId: string,
  price: number
): Promise<MlItem> {
  return mlPut<MlItem>(accountId, `/items/${itemId}`, { price });
}

/**
 * Update the available quantity (stock) of an item.
 */
export async function updateItemStock(
  accountId: string,
  itemId: string,
  availableQuantity: number
): Promise<MlItem> {
  return mlPut<MlItem>(accountId, `/items/${itemId}`, {
    available_quantity: availableQuantity,
  });
}

/**
 * Pause an active listing.
 */
export async function pauseItem(
  accountId: string,
  itemId: string
): Promise<MlItem> {
  return mlPut<MlItem>(accountId, `/items/${itemId}`, { status: "paused" });
}

/**
 * Reactivate a paused listing.
 */
export async function activateItem(
  accountId: string,
  itemId: string
): Promise<MlItem> {
  return mlPut<MlItem>(accountId, `/items/${itemId}`, { status: "active" });
}

/**
 * Calculate ML commission for a given price, listing type, and category.
 */
export async function getListingPrices(
  accountId: string,
  price: number,
  listingTypeId: string,
  categoryId: string
): Promise<MlListingPriceResponse> {
  return mlGet<MlListingPriceResponse>(
    accountId,
    `/sites/MLB/listing_prices?price=${price}&listing_type_id=${listingTypeId}&category_id=${categoryId}`
  );
}

/** Response shape for the listing_prices endpoint (array at top level) */
type MlListingPriceResponse = Array<{
  listing_type_id: string;
  listing_type_name: string;
  sale_fee_amount: number;
  currency_id: string;
  listing_exposure: string;
}>;

/**
 * Fetch shipping options for an item to extract the seller's shipping cost.
 * Uses a reference ZIP (SP centro) — the list_cost is fixed for the seller
 * regardless of destination.
 */
export async function getShippingOptions(
  accountId: string,
  itemId: string
): Promise<MlShippingOptionsResponse> {
  return mlGet<MlShippingOptionsResponse>(
    accountId,
    `/items/${itemId}/shipping_options?zip_code=01310100`
  );
}
