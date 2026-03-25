-- ============================================================
-- Avansa — Initial Database Schema
-- ============================================================

-- Enable UUID generation
create extension if not exists "pgcrypto";

-- ============================================================
-- Function: auto-update updated_at column
-- ============================================================
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
security definer
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================
-- Table: ml_accounts
-- ============================================================
create table public.ml_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  ml_user_id bigint not null,
  nickname text,
  email text,
  access_token text,
  refresh_token text,
  token_expires_at timestamptz,
  status text not null default 'active',
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (user_id, ml_user_id)
);

create index idx_ml_accounts_user_id on public.ml_accounts(user_id);
create index idx_ml_accounts_ml_user_id on public.ml_accounts(ml_user_id);
create index idx_ml_accounts_status on public.ml_accounts(status);

create trigger ml_accounts_updated_at
  before update on public.ml_accounts
  for each row execute function public.handle_updated_at();

-- ============================================================
-- Table: products
-- ============================================================
create table public.products (
  id uuid primary key default gen_random_uuid(),
  ml_account_id uuid not null references public.ml_accounts(id) on delete cascade,
  ml_item_id text not null,
  title text,
  thumbnail text,
  category_id text,
  status text,
  listing_type text,
  price decimal(12, 2),
  available_quantity integer,
  sold_quantity integer,
  permalink text,
  sku text,
  health text,
  condition text,
  cost_price decimal(12, 2),
  packaging_cost decimal(12, 2) default 0,
  other_costs decimal(12, 2) default 0,
  ml_fee decimal(12, 2),
  shipping_cost decimal(12, 2),
  net_margin decimal(12, 2),
  margin_percent decimal(5, 2),
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (ml_account_id, ml_item_id)
);

create index idx_products_ml_account_id on public.products(ml_account_id);
create index idx_products_ml_item_id on public.products(ml_item_id);
create index idx_products_status on public.products(status);
create index idx_products_sku on public.products(sku);

create trigger products_updated_at
  before update on public.products
  for each row execute function public.handle_updated_at();

-- ============================================================
-- Table: orders
-- ============================================================
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  ml_account_id uuid not null references public.ml_accounts(id) on delete cascade,
  ml_order_id bigint not null,
  status text,
  date_created timestamptz,
  date_closed timestamptz,
  total_amount decimal(12, 2),
  currency_id text default 'BRL',
  buyer_id bigint,
  buyer_nickname text,
  ml_item_id text,
  item_title text,
  quantity integer,
  unit_price decimal(12, 2),
  sku text,
  shipping_id bigint,
  shipping_status text,
  shipping_cost decimal(12, 2),
  payment_status text,
  payment_type text,
  ml_fee decimal(12, 2),
  cost_price decimal(12, 2),
  net_profit decimal(12, 2),
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),

  unique (ml_account_id, ml_order_id)
);

create index idx_orders_ml_account_id on public.orders(ml_account_id);
create index idx_orders_ml_order_id on public.orders(ml_order_id);
create index idx_orders_status on public.orders(status);
create index idx_orders_date_created on public.orders(date_created);
create index idx_orders_ml_item_id on public.orders(ml_item_id);

-- ============================================================
-- Table: webhook_events
-- ============================================================
create table public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  topic text not null,
  resource text not null,
  ml_user_id bigint not null,
  received_at timestamptz not null default now(),
  processed boolean not null default false,
  payload jsonb
);

create index idx_webhook_events_ml_user_id on public.webhook_events(ml_user_id);
create index idx_webhook_events_processed on public.webhook_events(processed);
create index idx_webhook_events_topic on public.webhook_events(topic);

-- ============================================================
-- Table: sync_logs
-- ============================================================
create table public.sync_logs (
  id uuid primary key default gen_random_uuid(),
  ml_account_id uuid not null references public.ml_accounts(id) on delete cascade,
  sync_type text not null,
  status text not null,
  items_synced integer not null default 0,
  error_message text,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create index idx_sync_logs_ml_account_id on public.sync_logs(ml_account_id);
create index idx_sync_logs_status on public.sync_logs(status);

-- ============================================================
-- RLS Policies
-- ============================================================

-- ml_accounts: users access only their own accounts
alter table public.ml_accounts enable row level security;

create policy "Users can view their own ML accounts"
  on public.ml_accounts for select
  using (auth.uid() = user_id);

create policy "Users can insert their own ML accounts"
  on public.ml_accounts for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own ML accounts"
  on public.ml_accounts for update
  using (auth.uid() = user_id);

create policy "Users can delete their own ML accounts"
  on public.ml_accounts for delete
  using (auth.uid() = user_id);

-- products: users access only products belonging to their ML accounts
alter table public.products enable row level security;

create policy "Users can view their own products"
  on public.products for select
  using (ml_account_id in (select id from public.ml_accounts where user_id = auth.uid()));

create policy "Users can insert their own products"
  on public.products for insert
  with check (ml_account_id in (select id from public.ml_accounts where user_id = auth.uid()));

create policy "Users can update their own products"
  on public.products for update
  using (ml_account_id in (select id from public.ml_accounts where user_id = auth.uid()));

create policy "Users can delete their own products"
  on public.products for delete
  using (ml_account_id in (select id from public.ml_accounts where user_id = auth.uid()));

-- orders: users access only orders belonging to their ML accounts
alter table public.orders enable row level security;

create policy "Users can view their own orders"
  on public.orders for select
  using (ml_account_id in (select id from public.ml_accounts where user_id = auth.uid()));

create policy "Users can insert their own orders"
  on public.orders for insert
  with check (ml_account_id in (select id from public.ml_accounts where user_id = auth.uid()));

create policy "Users can update their own orders"
  on public.orders for update
  using (ml_account_id in (select id from public.ml_accounts where user_id = auth.uid()));

create policy "Users can delete their own orders"
  on public.orders for delete
  using (ml_account_id in (select id from public.ml_accounts where user_id = auth.uid()));

-- webhook_events: service_role only for writes, users can read via join
alter table public.webhook_events enable row level security;

create policy "Users can view webhook events for their accounts"
  on public.webhook_events for select
  using (
    ml_user_id in (
      select ml_user_id from public.ml_accounts where user_id = auth.uid()
    )
  );

-- sync_logs: users can view logs for their own accounts
alter table public.sync_logs enable row level security;

create policy "Users can view their own sync logs"
  on public.sync_logs for select
  using (ml_account_id in (select id from public.ml_accounts where user_id = auth.uid()));
