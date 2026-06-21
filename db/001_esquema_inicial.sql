-- =====================================================================
-- 001_esquema_inicial.sql
--
-- Esquema do app de finanças pessoais (modelo de "carteira única").
-- Decisões de modelagem:
--   * Dinheiro em CENTAVOS, inteiro, sempre POSITIVO (amount_cents).
--     O sinal vem do campo "kind", não do valor — evita ambiguidade.
--   * occurred_on (data do lançamento) é separado de created_at
--     (quando a linha foi gravada) — evita bug de fuso horário.
--   * RLS ligado em tudo: cada usuário só enxerga as próprias linhas.
--
-- Rode este arquivo no Supabase: painel > SQL Editor > New query > cole > Run.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Categorias (ex.: Alimentação, Moradia, Salário)
-- ---------------------------------------------------------------------
create table if not exists public.categories (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null,
  kind        text not null check (kind in ('expense', 'income')),
  color       text,   -- opcional, para o visual (ex.: "#8C3B2E")
  icon        text,   -- opcional, nome do ícone (ex.: "home")
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Lançamentos (entradas e gastos)
-- ---------------------------------------------------------------------
create table if not exists public.transactions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind          text not null check (kind in ('expense', 'income')),
  amount_cents  integer not null check (amount_cents > 0),
  description   text,
  category_id   uuid references public.categories (id) on delete set null,
  occurred_on   date not null default current_date,
  created_at    timestamptz not null default now()
);

-- Consulta mais comum: "meus lançamentos do mês, mais recentes primeiro"
create index if not exists transactions_user_data_idx
  on public.transactions (user_id, occurred_on desc);

-- ---------------------------------------------------------------------
-- RLS: cada usuário só acessa as próprias linhas (user_id = auth.uid())
-- ---------------------------------------------------------------------
alter table public.categories   enable row level security;
alter table public.transactions enable row level security;

create policy "categorias do próprio usuário"
  on public.categories for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "lançamentos do próprio usuário"
  on public.transactions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
