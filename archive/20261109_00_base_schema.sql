-- Base schema: stations and core module tables
-- Required by station_payments and record_payment migrations

create table if not exists stations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 120),
  owner_id uuid references auth.users(id) on delete cascade,
  created_at timestamptz default now()
);

create index if not exists idx_stations_owner_id on stations(owner_id);

create table if not exists station_services (
  id uuid primary key default gen_random_uuid(),
  station_id uuid not null references stations(id) on delete cascade,
  name text not null,
  price_xof integer not null check (price_xof >= 0),
  duration_minutes integer not null check (duration_minutes > 0),
  is_active boolean not null default true,
  created_at timestamptz default now()
);

create index if not exists idx_station_services_station_id on station_services(station_id);

create table if not exists station_customers (
  id uuid primary key default gen_random_uuid(),
  station_id uuid not null references stations(id) on delete cascade,
  name text not null,
  phone text not null,
  created_at timestamptz default now()
);

create index if not exists idx_station_customers_station_id on station_customers(station_id);

create table if not exists station_orders (
  id uuid primary key default gen_random_uuid(),
  station_id uuid not null references stations(id) on delete cascade,
  customer_id uuid references station_customers(id) on delete set null,
  vehicle_info text not null,
  plate_number text,
  total_xof integer not null check (total_xof >= 0),
  status text not null default 'en_attente' check (status in ('en_attente', 'en_cours', 'termine', 'annule')),
  created_at timestamptz default now()
);

create index if not exists idx_station_orders_station_id on station_orders(station_id);
create index if not exists idx_station_orders_customer_id on station_orders(customer_id);

create table if not exists station_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references station_orders(id) on delete cascade,
  service_name text not null,
  price_xof integer not null check (price_xof >= 0)
);

create index if not exists idx_station_order_items_order_id on station_order_items(order_id);

create table if not exists station_order_assignments (
  order_id uuid not null references station_orders(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  station_id uuid not null references stations(id) on delete cascade,
  primary key (order_id, user_id)
);

create index if not exists idx_station_order_assignments_station_id on station_order_assignments(station_id);

create table if not exists station_inventory (
  id uuid primary key default gen_random_uuid(),
  station_id uuid not null references stations(id) on delete cascade,
  name text not null,
  unit text not null,
  quantity integer not null default 0,
  min_threshold integer not null default 0,
  created_at timestamptz default now()
);

create index if not exists idx_station_inventory_station_id on station_inventory(station_id);

create table if not exists station_memberships (
  user_id uuid not null references auth.users(id) on delete cascade,
  station_id uuid not null references stations(id) on delete cascade,
  role text not null check (role in ('owner', 'gerant', 'caissier', 'laveur')),
  created_at timestamptz default now(),
  revoked_at timestamptz,
  primary key (user_id, station_id)
);

create index if not exists idx_station_memberships_station_id on station_memberships(station_id);

create table if not exists station_invitations (
  id uuid primary key default gen_random_uuid(),
  station_id uuid not null references stations(id) on delete cascade,
  email text not null,
  role text not null check (role in ('owner', 'gerant', 'caissier', 'laveur')),
  created_at timestamptz default now(),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  cancelled_at timestamptz
);

create index if not exists idx_station_invitations_station_id on station_invitations(station_id);
