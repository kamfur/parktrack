do $$
declare
  v_system_user_id uuid;
begin
  select id into v_system_user_id from auth.users limit 1;

  if v_system_user_id is not null then
    insert into public.settings (key, value, description, updated_by)
    values ('daily_rate', '0', 'Stawka dobowa parkingu (PLN)', v_system_user_id)
    on conflict (key) do nothing;
  end if;
end $$;
