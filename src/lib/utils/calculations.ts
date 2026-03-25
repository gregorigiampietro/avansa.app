interface MarginInput {
  price: number | null;
  cost_price: number | null;
  packaging_cost: number | null;
  other_costs: number | null;
  ml_fee: number | null;
  shipping_cost: number | null;
}

interface MarginResult {
  net_margin: number;
  margin_percent: number;
}

/**
 * Calculate net margin and margin percentage.
 * Formula: net_margin = price - cost_price - packaging_cost - other_costs - ml_fee - shipping_cost
 * margin_percent = (net_margin / price) * 100
 */
export function calculateMargin(input: MarginInput): MarginResult {
  const price = input.price ?? 0;
  const costPrice = input.cost_price ?? 0;
  const packagingCost = input.packaging_cost ?? 0;
  const otherCosts = input.other_costs ?? 0;
  const mlFee = input.ml_fee ?? 0;
  const shippingCost = input.shipping_cost ?? 0;

  const net_margin = price - costPrice - packagingCost - otherCosts - mlFee - shippingCost;
  const margin_percent = price > 0 ? (net_margin / price) * 100 : 0;

  return {
    net_margin: Math.round(net_margin * 100) / 100,
    margin_percent: Math.round(margin_percent * 100) / 100,
  };
}
