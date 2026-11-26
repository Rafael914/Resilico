-- Run this migration in the Supabase project shared with Novyr.
-- Supabase Auth owns passwords; the public profile table must not duplicate password hashes.

alter table public.users
  add column if not exists auth_user_id uuid unique references auth.users(id) on delete cascade;

alter table public.users alter column password_hash drop not null;
alter table public.users alter column role set default 'customer';

create or replace function public.create_user_profile_from_auth()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.users (
    auth_user_id,
    first_name,
    last_name,
    email,
    phone_number,
    role
  ) values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'first_name', ''), 'New'),
    coalesce(nullif(new.raw_user_meta_data ->> 'last_name', ''), 'User'),
    new.email,
    nullif(new.raw_user_meta_data ->> 'phone_number', ''),
    'customer'
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
  after insert on auth.users
  for each row execute function public.create_user_profile_from_auth();

-- Backfill Auth accounts created before this profile trigger was installed.
insert into public.users (
  auth_user_id,
  first_name,
  last_name,
  email,
  phone_number,
  role
)
select
  au.id,
  coalesce(nullif(au.raw_user_meta_data ->> 'first_name', ''), split_part(au.email, '@', 1)),
  coalesce(nullif(au.raw_user_meta_data ->> 'last_name', ''), 'User'),
  au.email,
  nullif(au.raw_user_meta_data ->> 'phone_number', ''),
  'customer'
from auth.users as au
where au.email is not null
on conflict (email) do update
set auth_user_id = coalesce(public.users.auth_user_id, excluded.auth_user_id),
    phone_number = coalesce(public.users.phone_number, excluded.phone_number);

alter table public.users enable row level security;
drop policy if exists "Users can view their own profile" on public.users;
create policy "Users can view their own profile"
  on public.users for select
  to authenticated
  using (auth_user_id = (select auth.uid()));
