begin;
create table public.board_tabs(id uuid primary key default gen_random_uuid(),group_id uuid not null references public.groups on delete cascade,name text not null check(length(btrim(name)) between 1 and 40),created_at timestamptz not null default now());create index board_tabs_group on public.board_tabs(group_id);
create table public.board_shapes(id uuid primary key,tab_id uuid not null references public.board_tabs on delete cascade,data jsonb not null,revision int not null default 1,deleted boolean not null default false,updated_by uuid not null references auth.users,updated_at timestamptz not null default now(),lease_user uuid references auth.users,lease_until timestamptz);create index board_shapes_tab on public.board_shapes(tab_id);create index board_shapes_actor on public.board_shapes(updated_by);create index board_shapes_lease on public.board_shapes(lease_user);
alter table public.board_tabs enable row level security;alter table public.board_shapes enable row level security;
create policy board_tabs_members on public.board_tabs for select to authenticated using(private.member_of(group_id));
create policy board_shapes_members on public.board_shapes for select to authenticated using(exists(select 1 from public.board_tabs t where t.id=tab_id and private.member_of(t.group_id)));
revoke all on public.board_tabs,public.board_shapes from anon,authenticated;grant select on public.board_tabs,public.board_shapes to authenticated;
create function public.create_board_tab(p_group_id uuid,p_name text) returns uuid language plpgsql security definer set search_path='' as $$declare t uuid;begin
 perform 1 from public.groups where id=p_group_id for update;if not private.member_of(p_group_id) then raise exception 'NOT_MEMBER';end if;
 if (select count(*) from public.board_tabs where group_id=p_group_id)>=20 then raise exception 'TAB_LIMIT';end if;
 insert into public.board_tabs(group_id,name) values(p_group_id,btrim(p_name)) returning id into t;return t;end $$;
create function public.rename_board_tab(p_tab_id uuid,p_name text) returns void language plpgsql security definer set search_path='' as $$declare g uuid;begin
 select group_id into g from public.board_tabs where id=p_tab_id;perform 1 from public.groups where id=g for update;if not private.member_of(g) then raise exception 'NOT_MEMBER';end if;update public.board_tabs set name=btrim(p_name) where id=p_tab_id;end $$;
create function private.valid_board_shape(d jsonb) returns boolean language plpgsql immutable set search_path='' as $$declare p jsonb;begin
 if d is null or jsonb_typeof(d)<>'object' or octet_length(d::text)>120000 or d->>'kind' not in('pen','highlight','text') or d->>'kind' is null or coalesce(d->>'color','')!~'^#[0-9a-fA-F]{6}$' or jsonb_typeof(d->'width') is distinct from 'number' or (d->>'width')::numeric not between 1 and 64 then return false;end if;
 if d->>'kind'='text' then return jsonb_typeof(d->'x')='number' and jsonb_typeof(d->'y')='number' and (d->>'x')::numeric between 0 and 1920 and (d->>'y')::numeric between 0 and 1080 and jsonb_typeof(d->'text')='string' and length(d->>'text') between 1 and 2000;end if;
 if jsonb_typeof(d->'points') is distinct from 'array' or jsonb_array_length(d->'points') not between 1 and 2000 then return false;end if;
 for p in select value from jsonb_array_elements(d->'points') loop
 if jsonb_typeof(p)<>'array' or jsonb_array_length(p)<>2 or jsonb_typeof(p->0)<>'number' or jsonb_typeof(p->1)<>'number' or (p->>0)::numeric not between 0 and 1920 or (p->>1)::numeric not between 0 and 1080 then return false;end if;end loop;return true;
 exception when others then return false;
end $$;
create table private.board_write_limits(user_id uuid primary key references auth.users on delete cascade,window_start timestamptz not null,writes int not null);
alter table private.board_write_limits enable row level security;
create function public.write_board_shape(p_tab_id uuid,p_shape_id uuid,p_revision int,p_data jsonb,p_deleted boolean) returns int language plpgsql security definer set search_path='' as $$declare g uuid;s public.board_shapes;next_revision int;begin
 perform pg_advisory_xact_lock(74439013);
 select group_id into g from public.board_tabs where id=p_tab_id;perform 1 from public.groups where id=g for update;
 if not private.member_of(g) then raise exception 'NOT_MEMBER';end if;
 if private.valid_board_shape(p_data) is distinct from true or p_deleted is null or p_revision is null or p_revision<0 then raise exception 'INVALID_SHAPE';end if;
 select * into s from public.board_shapes where id=p_shape_id for update;
 if s.id is not null and(s.tab_id<>p_tab_id or s.revision<>p_revision) or s.id is null and p_revision<>0 then raise exception 'REVISION_CONFLICT';end if;
 if s.lease_until>now() and s.lease_user<>auth.uid() and exists(select 1 from public.memberships where group_id=g and user_id=s.lease_user) then raise exception 'TEXT_BUSY';end if;
 if s.id is null and(select count(*) from public.board_shapes where tab_id=p_tab_id)>=3000 then raise exception 'BOARD_FULL';end if;
 if (select coalesce(sum(octet_length(data::text)),0) from public.board_shapes)-coalesce(octet_length(s.data::text),0)+octet_length(p_data::text)>67108864 then raise exception 'BOARD_STORAGE_FULL';end if;
 insert into private.board_write_limits(user_id,window_start,writes) values(auth.uid(),date_trunc('minute',now()),1) on conflict(user_id) do update set window_start=excluded.window_start,writes=case when private.board_write_limits.window_start=excluded.window_start then private.board_write_limits.writes+1 else 1 end;
 if (select writes from private.board_write_limits where user_id=auth.uid())>120 then raise exception 'RATE_LIMITED';end if;
 next_revision:=p_revision+1;
 insert into public.board_shapes(id,tab_id,data,revision,deleted,updated_by) values(p_shape_id,p_tab_id,p_data,next_revision,p_deleted,auth.uid()) on conflict(id) do update set data=excluded.data,revision=excluded.revision,deleted=excluded.deleted,updated_by=excluded.updated_by,updated_at=now();return next_revision;
end $$;
create function public.lease_board_text(p_tab_id uuid,p_shape_id uuid) returns void language plpgsql security definer set search_path='' as $$declare g uuid;s public.board_shapes;begin
 select group_id into g from public.board_tabs where id=p_tab_id;perform 1 from public.groups where id=g for update;if not private.member_of(g) then raise exception 'NOT_MEMBER';end if;
 select * into s from public.board_shapes where id=p_shape_id and tab_id=p_tab_id for update;
 if s.id is null or s.data->>'kind'<>'text' or s.deleted then raise exception 'NOT_FOUND';end if;
 if s.lease_until>now() and s.lease_user<>auth.uid() and exists(select 1 from public.memberships where group_id=g and user_id=s.lease_user) then raise exception 'TEXT_BUSY';end if;
 update public.board_shapes set lease_user=auth.uid(),lease_until=now()+interval '45 seconds' where id=p_shape_id;
end $$;
revoke all on function private.valid_board_shape(jsonb),public.create_board_tab(uuid,text),public.rename_board_tab(uuid,text),public.write_board_shape(uuid,uuid,int,jsonb,boolean),public.lease_board_text(uuid,uuid) from public,anon,authenticated;
grant execute on function public.create_board_tab(uuid,text),public.rename_board_tab(uuid,text),public.write_board_shape(uuid,uuid,int,jsonb,boolean),public.lease_board_text(uuid,uuid) to authenticated;
do $$begin if exists(select 1 from pg_publication where pubname='supabase_realtime') then alter publication supabase_realtime add table public.board_tabs,public.board_shapes;end if;end $$;

do $presence$ begin
 if to_regclass('realtime.messages') is not null then
 create policy chatter_board_presence_read on realtime.messages for select to authenticated using(case when realtime.topic()~'^board:[0-9a-f-]{36}$' then private.member_of(substring(realtime.topic() from 7)::uuid) else false end);
 create policy chatter_board_presence_write on realtime.messages for insert to authenticated with check(case when realtime.topic()~'^board:[0-9a-f-]{36}$' then private.member_of(substring(realtime.topic() from 7)::uuid) else false end);
 end if;
end $presence$;

commit;

