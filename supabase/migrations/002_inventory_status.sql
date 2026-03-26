-- ============================================================
-- Inventory Status Table
-- Stores fulfillment stock breakdown per product from ML API
-- ============================================================

create table public.inventory_status (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  ml_account_id uuid not null references public.ml_accounts(id) on delete cascade,
  ml_item_id text not null,
  warehouse_id text,
  available integer not null default 0,
  damaged integer not null default 0,
  expired integer not null default 0,
  lost integer not null default 0,
  in_transfer integer not null default 0,
  reserved integer not null default 0,
  not_apt_for_sale integer not null default 0,
  total_stock integer generated always as (available + damaged + expired + lost + in_transfer + reserved + not_apt_for_sale) stored,
  last_synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (product_id, warehouse_id)
);

-- Indexes
create index idx_inventory_status_product_id on public.inventory_status(product_id);
create index idx_inventory_status_ml_account_id on public.inventory_status(ml_account_id);

-- Auto-update updated_at
create trigger inventory_status_updated_at
  before update on public.inventory_status
  for each row execute function public.handle_updated_at();

-- RLS
alter table public.inventory_status enable row level security;

create policy "Users can view their own inventory status"
  on public.inventory_status for select
  using (ml_account_id in (select id from public.ml_accounts where user_id = auth.uid()));

create policy "Users can insert their own inventory status"
  on public.inventory_status for insert
  with check (ml_account_id in (select id from public.ml_accounts where user_id = auth.uid()));

create policy "Users can update their own inventory status"
  on public.inventory_status for update
  using (ml_account_id in (select id from public.ml_accounts where user_id = auth.uid()));

create policy "Users can delete their own inventory status"
  on public.inventory_status for delete
  using (ml_account_id in (select id from public.ml_accounts where user_id = auth.uid()));
