-- Fix 1: Allow authenticated users to insert their own profile row
-- (needed when a new user signs in for the first time)
drop policy if exists "Users can insert own data" on public.users;
create policy "Users can insert own data"
  on public.users for insert
  with check (auth.uid() = id);

-- Fix 2: Allow authenticated users to update their own row
-- (already exists but re-create to be safe)
drop policy if exists "Users can update own data" on public.users;
create policy "Users can update own data"
  on public.users for update
  using (auth.uid() = id);

-- Fix 3: Allow authenticated users to read their own row
drop policy if exists "Users can read own data" on public.users;
create policy "Users can read own data"
  on public.users for select
  using (auth.uid() = id);

-- Fix 4: Allow upsert by email during login linking
-- We need a function that runs as security definer to link email→id
create or replace function public.link_user_by_email(
  p_auth_id uuid,
  p_email text,
  p_full_name text default null,
  p_phone text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Try to update existing row that was seeded by email (has no auth id yet)
  update public.users
  set id = p_auth_id,
      full_name = coalesce(nullif(p_full_name, ''), full_name),
      phone_number = coalesce(nullif(p_phone, ''), phone_number),
      updated_at = now()
  where email = p_email
    and id != p_auth_id;  -- only update if id doesn't already match

  -- If no row exists at all, insert a new one
  insert into public.users (id, email, full_name, phone_number, role, created_at)
  values (p_auth_id, p_email, coalesce(nullif(p_full_name,''), split_part(p_email,'@',1)), p_phone, 'customer', now())
  on conflict (id) do nothing;
end;
$$;

-- Grant execute to authenticated users
grant execute on function public.link_user_by_email to authenticated;
grant execute on function public.link_user_by_email to anon;
