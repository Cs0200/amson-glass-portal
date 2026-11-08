begin;
alter table public.profiles add column if not exists email text not null default '';
alter table public.profiles add column if not exists phone text not null default '';
alter table public.profiles add column if not exists address text not null default '';
alter table public.profiles add column if not exists city text not null default '';
alter table public.profiles add column if not exists postal_code text not null default '';
alter table public.profiles add column if not exists customer_type text not null default 'Residential' check(customer_type in ('Residential','Commercial'));
alter table public.profiles add column if not exists created_at timestamptz not null default now();
alter table public.profiles add column if not exists updated_at timestamptz not null default now();
-- Backfill existing accounts so the directory includes customers without projects.
insert into public.profiles(id,name,email,created_at) select id,left(coalesce(raw_user_meta_data->>'name','Customer'),100),coalesce(email,''),created_at from auth.users on conflict(id) do update set email=excluded.email,created_at=excluded.created_at;
create or replace function public.new_profile() returns trigger language plpgsql security definer set search_path=public as $$begin insert into profiles(id,name,email) values(new.id,left(coalesce(new.raw_user_meta_data->>'name','Customer'),100),coalesce(new.email,''));return new;end;$$;
create or replace function public.sync_customer_email() returns trigger language plpgsql security definer set search_path=public as $$begin update profiles set email=coalesce(new.email,''),updated_at=now() where id=new.id;return new;end;$$;
create trigger customer_email_changed after update of email on auth.users for each row execute function public.sync_customer_email();
alter table public.projects add column if not exists address text not null default '';
alter table public.projects add column if not exists city text not null default '';
alter table public.projects add column if not exists postal_code text not null default '';
alter table public.projects add column if not exists customer_type text not null default 'Residential' check(customer_type in ('Residential','Commercial'));
alter table public.leads add column if not exists address text not null default '';
alter table public.leads add column if not exists city text not null default '';
alter table public.leads add column if not exists postal_code text not null default '';
alter table public.leads add column if not exists customer_type text not null default 'Residential' check(customer_type in ('Residential','Commercial'));
create policy profile_admin_update on public.profiles for update to authenticated using(is_admin()) with check(is_admin());
create or replace function public.update_customer_profile(input jsonb) returns void language plpgsql security definer set search_path=public as $$begin
 if auth.uid() is null then raise exception 'Authentication required';end if;
 if length(coalesce(input->>'name','')) not between 2 and 100 or length(coalesce(input->>'phone','')) not between 8 and 20 or length(coalesce(input->>'city','')) not between 2 and 100 or length(coalesce(input->>'address',''))>500 or length(coalesce(input->>'postal_code',''))>12 or coalesce(input->>'customer_type','') not in ('Residential','Commercial') then raise exception 'Invalid customer details';end if;
 update profiles set name=input->>'name',phone=input->>'phone',address=coalesce(input->>'address',''),city=input->>'city',postal_code=coalesce(input->>'postal_code',''),customer_type=input->>'customer_type',updated_at=now() where id=auth.uid();
end;$$;
revoke all on function public.update_customer_profile(jsonb) from public;grant execute on function public.update_customer_profile(jsonb) to authenticated;
create table public.purchases(
 id uuid primary key default gen_random_uuid(),customer_id uuid not null references public.profiles(id),project_id uuid references public.projects(id),
 description text not null check(length(description) between 2 and 500),reference text not null check(length(reference) between 2 and 100),purchased_on date not null,
 amount numeric(12,2) not null check(amount>0),paid_amount numeric(12,2) not null default 0 check(paid_amount>=0 and paid_amount<=amount),currency text not null default 'INR' check(currency='INR'),
 status text not null default 'Recorded' check(status in ('Recorded','Voided')),void_reason text,recorded_by uuid not null references auth.users(id),created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create unique index purchase_customer_reference on public.purchases(customer_id,lower(reference));
create index purchases_customer_date on public.purchases(customer_id,purchased_on desc);
create table public.purchase_events(id bigint generated always as identity primary key,purchase_id uuid not null references public.purchases(id),actor_id uuid references auth.users(id),action text not null,old_data jsonb,new_data jsonb,created_at timestamptz not null default now());
alter table public.purchases enable row level security;alter table public.purchase_events enable row level security;
create policy purchases_read on public.purchases for select to authenticated using(customer_id=auth.uid() or public.is_admin());
create policy purchases_insert on public.purchases for insert to authenticated with check(public.is_admin() and recorded_by=auth.uid());
create policy purchases_update on public.purchases for update to authenticated using(public.is_admin()) with check(public.is_admin());
create policy purchase_events_read on public.purchase_events for select to authenticated using(public.is_admin());
create function public.check_purchase() returns trigger language plpgsql security definer set search_path=public as $$begin
 if not public.is_admin() then raise exception 'Admin access required';end if;
 if new.project_id is not null and not exists(select 1 from projects where id=new.project_id and owner_id=new.customer_id) then raise exception 'Project does not belong to customer';end if;
 if new.status='Voided' and length(trim(coalesce(new.void_reason,'')))<3 then raise exception 'Reason is required when voiding a record';end if;
 if TG_OP='UPDATE' then
  if new.customer_id is distinct from old.customer_id or new.project_id is distinct from old.project_id or new.recorded_by is distinct from old.recorded_by or new.created_at is distinct from old.created_at or new.reference is distinct from old.reference then raise exception 'Purchase identity cannot be changed';end if;
  if old.status='Voided' then raise exception 'Voided records are immutable';end if;
 end if;
 new.updated_at=now();return new;
end;$$;
create trigger purchase_validation before insert or update on public.purchases for each row execute function public.check_purchase();
create function public.audit_purchase() returns trigger language plpgsql security definer set search_path=public as $$begin
 insert into purchase_events(purchase_id,actor_id,action,old_data,new_data) values(new.id,auth.uid(),TG_OP,case when TG_OP='UPDATE' then to_jsonb(old) else null end,to_jsonb(new));return new;
end;$$;
create trigger purchase_history after insert or update on public.purchases for each row execute function public.audit_purchase();
create or replace function public.create_estimate(input jsonb) returns uuid language plpgsql security definer set search_path=public as $$
declare svc services;w numeric;h numeric;q int;factor numeric;total numeric;pid uuid;
begin
 if auth.uid() is null then raise exception 'Authentication required';end if;
 select * into svc from services where id=input->>'service_id';if not found then raise exception 'Unknown service';end if;
 w=(input->>'width')::numeric;h=(input->>'height')::numeric;q=(input->>'quantity')::int;
 if w is null or h is null or q is null or w<=0 or h<=0 or w>100 or h>100 or q<1 or q>100 then raise exception 'Invalid measurements';end if;
 if input->>'material' is null or input->>'material' not in ('Clear','Frosted','Tinted') or input->>'finish' is null or input->>'finish' not in ('Chrome','Matte black','Brushed steel') then raise exception 'Invalid configuration';end if;
 if length(coalesce(input->>'name','')) not between 2 and 100 or length(coalesce(input->>'email','')) not between 3 and 200 or length(coalesce(input->>'phone','')) not between 8 and 20 then raise exception 'Contact details required';end if;
 if length(coalesce(input->>'city','')) not between 2 and 100 or length(coalesce(input->>'address',''))>500 or length(coalesce(input->>'postal_code',''))>12 or coalesce(input->>'customer_type','') not in ('Residential','Commercial') then raise exception 'Invalid project location';end if;
 factor=case input->>'material' when 'Frosted' then 1.15 when 'Tinted' then 1.2 else 1 end;
 total=round(w*h*q*svc.rate*factor+1500*q);
 insert into projects(owner_id,service_id,name,email,phone,message,width,height,quantity,material,finish,estimated_total,address,city,postal_code,customer_type,pricing_snapshot) values(auth.uid(),svc.id,input->>'name',input->>'email',input->>'phone',left(coalesce(input->>'message',''),3000),w,h,q,input->>'material',input->>'finish',total,coalesce(input->>'address',''),input->>'city',coalesce(input->>'postal_code',''),input->>'customer_type',jsonb_build_object('rate',svc.rate,'material_factor',factor,'installation_per_unit',1500,'currency','INR','tax_included',false)) returning id into pid;
 update profiles set name=input->>'name',phone=input->>'phone',city=input->>'city',address=coalesce(input->>'address',''),postal_code=coalesce(input->>'postal_code',''),customer_type=input->>'customer_type',updated_at=now() where id=auth.uid();
 return pid;
end;$$;


-- Keep a private audit trail of customer contact/location changes.
create table public.customer_events(id bigint generated always as identity primary key,customer_id uuid not null references public.profiles(id),actor_id uuid,old_data jsonb,new_data jsonb,created_at timestamptz not null default now());
alter table public.customer_events enable row level security;
create policy customer_events_admin on public.customer_events for select to authenticated using(public.is_admin());
create function public.audit_customer_contact() returns trigger language plpgsql security definer set search_path=public as $$begin
 if row(old.name,old.email,old.phone,old.address,old.city,old.postal_code,old.customer_type) is distinct from row(new.name,new.email,new.phone,new.address,new.city,new.postal_code,new.customer_type) then
 insert into customer_events(customer_id,actor_id,old_data,new_data) values(new.id,auth.uid(),jsonb_build_object('name',old.name,'email',old.email,'phone',old.phone,'address',old.address,'city',old.city,'postal_code',old.postal_code,'customer_type',old.customer_type),jsonb_build_object('name',new.name,'email',new.email,'phone',new.phone,'address',new.address,'city',new.city,'postal_code',new.postal_code,'customer_type',new.customer_type));
 end if;return new;
end;$$;
create trigger customer_contact_history after update on public.profiles for each row execute function public.audit_customer_contact();
alter table public.leads add constraint lead_location_limits check(length(address)<=500 and length(city)<=100 and length(postal_code)<=12);
alter table public.projects add constraint project_location_limits check(length(address)<=500 and length(city)<=100 and length(postal_code)<=12);
alter table public.profiles add constraint profile_contact_limits check(length(name)<=100 and length(email)<=200 and length(phone)<=20 and length(address)<=500 and length(city)<=100 and length(postal_code)<=12);
grant select,insert,update on public.purchases to authenticated;
grant select on public.purchase_events,public.customer_events to authenticated;
commit;
