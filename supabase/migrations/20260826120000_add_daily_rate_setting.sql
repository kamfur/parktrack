do $$
declare
  v_system_user_id uuid;
begin
  v_system_user_id := get_system_user();

  if v_system_user_id is not null then
    insert into public.settings (key, value, description, updated_by)
    values ('daily_rate', '0', 'Stawka dobowa parkingu (PLN)', v_system_user_id)
    on conflict (key) do nothing;
  end if;
end $$;
