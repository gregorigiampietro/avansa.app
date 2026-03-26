-- Add JSONB column for detailed condition breakdown from ML Fulfillment API
ALTER TABLE public.inventory_status
ADD COLUMN condition_details jsonb DEFAULT '[]'::jsonb;
