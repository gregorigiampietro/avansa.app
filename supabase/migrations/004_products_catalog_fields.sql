-- Add catalog fields to products table
-- catalog_product_id: links to ML catalog product (shared between catalog + traditional listings)
-- catalog_listing: true if this is a catalog-backed listing

ALTER TABLE products ADD COLUMN IF NOT EXISTS catalog_product_id TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS catalog_listing BOOLEAN DEFAULT false;
