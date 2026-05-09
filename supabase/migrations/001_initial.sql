-- Flormar Tunisia — Initial Schema

create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  image_url text,
  created_at timestamptz not null default now()
);

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  price numeric(10,3) not null,
  sale_price numeric(10,3),
  category_id uuid references categories(id) on delete set null,
  source_url text,
  created_at timestamptz not null default now()
);

create index if not exists products_category_id_idx on products(category_id);

create table if not exists product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  sku text,
  shade_name text not null,
  color_hex text,
  swatch_image_url text,
  stock_qty integer not null default 99,
  created_at timestamptz not null default now()
);

create index if not exists variants_product_id_idx on product_variants(product_id);

create table if not exists product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  url text not null,
  sort_order integer not null default 0
);

create index if not exists images_product_id_idx on product_images(product_id);

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null,
  customer_phone text not null,
  customer_address text not null,
  customer_city text not null,
  status text not null default 'pending' check (status in ('pending','confirmed','shipped','delivered','cancelled')),
  total numeric(10,3) not null,
  created_at timestamptz not null default now()
);

create table if not exists order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  variant_id uuid references product_variants(id) on delete set null,
  product_id uuid references products(id) on delete set null,
  quantity integer not null default 1,
  price numeric(10,3) not null
);

create index if not exists order_items_order_id_idx on order_items(order_id);
