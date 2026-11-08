begin;
create table public.profiles(id uuid primary key references auth.users on delete cascade,name text not null default '',is_admin boolean not null default false);
create function public.is_admin() returns boolean language sql stable security definer set search_path=public as $$select coalesce((select is_admin from profiles where id=auth.uid()),false)$$;
create function public.new_profile() returns trigger language plpgsql security definer set search_path=public as $$begin insert into profiles(id,name) values(new.id,coalesce(new.raw_user_meta_data->>'name','Customer'));return new;end;$$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.new_profile();
create table public.services(id text primary key,name text not null,tag text not null,rate numeric not null check(rate>0),description text not null,image text not null,sort_order int default 0);
create table public.projects(id uuid primary key default gen_random_uuid(),owner_id uuid not null references auth.users,service_id text not null references services,name text not null,email text not null,phone text not null,message text default '',width numeric not null,height numeric not null,quantity int not null,material text not null,finish text not null,estimated_total numeric not null,approved_total numeric,status text not null default 'New' check(status in ('New','Contacted','Quoted','Approved','Installed','Completed')),payment_url text default '',pricing_snapshot jsonb not null,created_at timestamptz default now(),updated_at timestamptz default now());
create table public.leads(id uuid primary key default gen_random_uuid(),name text not null,email text not null,phone text not null,message text,status text not null default 'New' check(status in ('New','Contacted','Quoted','Approved','Installed','Completed')),created_at timestamptz default now());
create table public.messages(id uuid primary key default gen_random_uuid(),project_id uuid references projects on delete cascade,author_id uuid references auth.users,body text not null check(length(body) between 1 and 3000),kind text default 'message',created_at timestamptz default now());
create table public.project_files(id uuid primary key default gen_random_uuid(),project_id uuid references projects on delete cascade,owner_id uuid references auth.users,path text not null unique,name text not null,created_at timestamptz default now());
create table public.project_events(id bigint generated always as identity primary key,project_id uuid references projects on delete cascade,actor_id uuid,old_status text,new_status text,created_at timestamptz default now());
create function public.project_audit() returns trigger language plpgsql security definer set search_path=public as $$begin new.updated_at=now();if old.status is distinct from new.status then insert into project_events(project_id,actor_id,old_status,new_status) values(new.id,auth.uid(),old.status,new.status);end if;return new;end;$$;
create trigger project_changes before update on projects for each row execute function public.project_audit();
alter table profiles enable row level security;alter table services enable row level security;alter table projects enable row level security;alter table leads enable row level security;alter table messages enable row level security;alter table project_files enable row level security;alter table project_events enable row level security;
create policy profile_read on profiles for select to authenticated using(id=auth.uid() or is_admin());
create policy services_read on services for select using(true);
create policy services_admin on services for all to authenticated using(is_admin()) with check(is_admin());
create policy projects_read on projects for select to authenticated using(owner_id=auth.uid() or is_admin());
create policy projects_admin_update on projects for update to authenticated using(is_admin()) with check(is_admin());
create policy leads_insert on leads for insert to anon,authenticated with check(length(name) between 2 and 100 and length(email)<=200 and length(phone) between 8 and 20 and length(message)<=3000 and status='New');
create policy leads_admin on leads for select to authenticated using(is_admin());
create policy leads_update on leads for update to authenticated using(is_admin()) with check(is_admin());
create policy messages_read on messages for select to authenticated using(exists(select 1 from projects where id=project_id));
create policy messages_insert on messages for insert to authenticated with check(author_id=auth.uid() and exists(select 1 from projects where id=project_id));
create policy files_read on project_files for select to authenticated using(exists(select 1 from projects where id=project_id));
create policy files_insert on project_files for insert to authenticated with check(owner_id=auth.uid() and split_part(path,'/',1)=project_id::text and exists(select 1 from projects where id=project_id));
create policy events_read on project_events for select to authenticated using(exists(select 1 from projects where id=project_id));
create function public.create_estimate(input jsonb) returns uuid language plpgsql security definer set search_path=public as $$
declare svc services;w numeric;h numeric;q int;factor numeric;total numeric;pid uuid;
begin
 if auth.uid() is null then raise exception 'Authentication required';end if;
 select * into svc from services where id=input->>'service_id';if not found then raise exception 'Unknown service';end if;
 w=(input->>'width')::numeric;h=(input->>'height')::numeric;q=(input->>'quantity')::int;
 if w is null or h is null or q is null or w<=0 or h<=0 or w>100 or h>100 or q<1 or q>100 then raise exception 'Invalid measurements';end if;
 if input->>'material' is null or input->>'material' not in ('Clear','Frosted','Tinted') or input->>'finish' is null or input->>'finish' not in ('Chrome','Matte black','Brushed steel') then raise exception 'Invalid configuration';end if;
 if length(coalesce(input->>'name','')) not between 2 and 100 or length(coalesce(input->>'email','')) not between 3 and 200 or length(coalesce(input->>'phone','')) not between 8 and 20 then raise exception 'Contact details required';end if;
 factor=case input->>'material' when 'Frosted' then 1.15 when 'Tinted' then 1.2 else 1 end;
 total=round(w*h*q*svc.rate*factor+1500*q);
 insert into projects(owner_id,service_id,name,email,phone,message,width,height,quantity,material,finish,estimated_total,pricing_snapshot) values(auth.uid(),svc.id,input->>'name',input->>'email',input->>'phone',left(coalesce(input->>'message',''),3000),w,h,q,input->>'material',input->>'finish',total,jsonb_build_object('rate',svc.rate,'material_factor',factor,'installation_per_unit',1500,'currency','INR','tax_included',false)) returning id into pid;
 return pid;
end;$$;
revoke all on function public.create_estimate(jsonb) from public;grant execute on function public.create_estimate(jsonb) to authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('project-files','project-files',false,10485760,array['image/jpeg','image/png','image/webp','application/pdf']);
create policy project_storage_read on storage.objects for select to authenticated using(bucket_id='project-files' and exists(select 1 from public.projects where id::text=(storage.foldername(name))[1]));
create policy project_storage_insert on storage.objects for insert to authenticated with check(bucket_id='project-files' and exists(select 1 from public.projects where id::text=(storage.foldername(name))[1]));
create policy project_storage_delete on storage.objects for delete to authenticated using(bucket_id='project-files' and owner_id=auth.uid()::text);
commit;

-- Customer/admin portal extension (included for fresh installations).
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
begin;
alter table profiles add column email_marketing_opt_in boolean not null default false, add column whatsapp_marketing_opt_in boolean not null default false, add column email_updates_opt_in boolean not null default false, add column whatsapp_updates_opt_in boolean not null default false;
create table communication_audit(id bigint generated always as identity primary key,actor_id uuid,action text not null,metadata jsonb not null default '{}',created_at timestamptz not null default now());
create table campaigns(id uuid primary key default gen_random_uuid(),name text not null,channel text not null check(channel in ('email','whatsapp')),subject text not null default '',body text not null,template_name text not null default '',language text not null default 'en',parameters jsonb not null default '[]',audience text not null default 'All' check(audience in ('All','Residential','Commercial')),city text not null default '',status text not null default 'draft' check(status in ('draft','queued')),created_by uuid references auth.users,created_at timestamptz not null default now());
create table message_outbox(id uuid primary key default gen_random_uuid(),campaign_id uuid references campaigns,project_id uuid references projects,customer_id uuid not null references profiles,channel text not null check(channel in ('email','whatsapp')),purpose text not null check(purpose in ('marketing','update')),destination text not null,subject text not null default '',body text not null,template_name text not null default '',language text not null default 'en',parameters jsonb not null default '[]',status text not null default 'queued' check(status in ('queued','sending','accepted','delivered','read','failed','unknown','skipped')),provider_id text,error text,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(campaign_id,customer_id));
create index outbox_queue on message_outbox(status,created_at);
create unique index outbox_provider on message_outbox(channel,provider_id) where provider_id is not null;
create table message_suppressions(channel text not null,destination text not null,reason text not null,created_at timestamptz not null default now(),primary key(channel,destination));
create table unsubscribe_tokens(customer_id uuid primary key references profiles on delete cascade,token uuid not null unique default gen_random_uuid());
create table delivery_events(id text primary key,created_at timestamptz not null default now());
alter table communication_audit enable row level security;alter table campaigns enable row level security;alter table message_outbox enable row level security;alter table message_suppressions enable row level security;alter table unsubscribe_tokens enable row level security;alter table delivery_events enable row level security;
create policy communications_audit_read on communication_audit for select to authenticated using(is_admin());
create policy campaigns_read on campaigns for select to authenticated using(is_admin());
create policy outbox_read on message_outbox for select to authenticated using(is_admin());
-- No client write policies. All mutations use restricted functions below.
create function log_customer_export(metadata jsonb) returns void language plpgsql security definer set search_path=public as $$begin if not is_admin() then raise exception 'Admin required';end if;insert into communication_audit(actor_id,action,metadata) values(auth.uid(),'excel_export',metadata);end;$$;
create function set_message_preferences(customer uuid,preferences jsonb,evidence text default '') returns void language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is null or (customer<>auth.uid() and not is_admin()) then raise exception 'Access denied';end if;
 if customer<>auth.uid() and length(trim(evidence))<5 then raise exception 'Record the source and date of customer consent';end if;
 update profiles set email_marketing_opt_in=coalesce((preferences->>'email_marketing_opt_in')::boolean,false),whatsapp_marketing_opt_in=coalesce((preferences->>'whatsapp_marketing_opt_in')::boolean,false),email_updates_opt_in=coalesce((preferences->>'email_updates_opt_in')::boolean,false),whatsapp_updates_opt_in=coalesce((preferences->>'whatsapp_updates_opt_in')::boolean,false) where id=customer;
 insert into communication_audit(actor_id,action,metadata) values(auth.uid(),'preferences',jsonb_build_object('customer_id',customer,'preferences',preferences,'evidence',left(evidence,1000)));
end;$$;
create function reset_contact_consent() returns trigger language plpgsql set search_path=public as $$begin
 if old.email is distinct from new.email then new.email_marketing_opt_in=false;new.email_updates_opt_in=false;end if;
 if old.phone is distinct from new.phone then new.whatsapp_marketing_opt_in=false;new.whatsapp_updates_opt_in=false;end if;return new;end;$$;
create trigger reset_contact_consent before update on profiles for each row execute function reset_contact_consent();
create function eligible_for_message(c profiles,ch text,purpose text) returns boolean language sql stable set search_path=public as $$ select not c.is_admin and case when ch='email' then coalesce(c.email,'') ~ '^[^@ ]+@[^@ ]+\.[^@ ]+$' and case when purpose='marketing' then c.email_marketing_opt_in else c.email_updates_opt_in end else coalesce(c.phone,'') ~ '^\+[1-9][0-9]{7,14}$' and case when purpose='marketing' then c.whatsapp_marketing_opt_in else c.whatsapp_updates_opt_in end end and not exists(select 1 from message_suppressions s where s.channel=ch and (purpose='marketing' or s.reason<>'Unsubscribed') and s.destination=case when ch='email' then lower(c.email) else c.phone end) $$;
create function campaign_recipients(campaign uuid) returns table(customer_id uuid,name text,destination text) language plpgsql security definer set search_path=public as $$declare c campaigns;begin
 if not is_admin() then raise exception 'Admin required';end if;select * into strict c from campaigns where id=campaign;
 return query select p.id,p.name,case when c.channel='email' then lower(p.email) else p.phone end from profiles p where eligible_for_message(p,c.channel,'marketing') and (c.audience='All' or p.customer_type=c.audience) and (c.city='' or lower(p.city)=lower(c.city)) order by p.id;
end;$$;
create function create_campaign(input jsonb) returns uuid language plpgsql security definer set search_path=public as $$declare cid uuid;begin
 if not is_admin() then raise exception 'Admin required';end if;
 if length(input->>'name') not between 2 and 100 or length(input->>'body') not between 1 and 3000 or length(coalesce(input->>'subject',''))>200 or jsonb_array_length(coalesce(input->'parameters','[]'))>10 then raise exception 'Invalid campaign';end if;
 insert into campaigns(name,channel,subject,body,template_name,language,parameters,audience,city,created_by) values(input->>'name',input->>'channel',coalesce(input->>'subject',''),input->>'body',coalesce(input->>'template_name',''),coalesce(input->>'language','en'),coalesce(input->'parameters','[]'),coalesce(input->>'audience','All'),left(coalesce(input->>'city',''),100),auth.uid()) returning id into cid;
 return cid;end;$$;
create function queue_campaign(campaign uuid,expected_count int) returns int language plpgsql security definer set search_path=public as $$declare c campaigns;n int;begin
 if not is_admin() then raise exception 'Admin required';end if;select * into strict c from campaigns where id=campaign for update;
 if c.status<>'draft' then raise exception 'Already queued';end if;
 select count(*) into n from campaign_recipients(campaign);if n<>expected_count or n=0 then raise exception 'Audience changed or empty. Review recipients again.';end if;
 insert into message_outbox(campaign_id,customer_id,channel,purpose,destination,subject,body,template_name,language,parameters) select c.id,r.customer_id,c.channel,'marketing',r.destination,c.subject,replace(c.body,'{name}',r.name),c.template_name,c.language,(select coalesce(jsonb_agg(replace(v,'{name}',r.name)),'[]') from jsonb_array_elements_text(c.parameters) v) from campaign_recipients(campaign) r;
 update campaigns set status='queued' where id=campaign;
 insert into communication_audit(actor_id,action,metadata) values(auth.uid(),'campaign_queued',jsonb_build_object('campaign_id',campaign,'recipients',n));return n;end;$$;
create function queue_project_update() returns trigger language plpgsql security definer set search_path=public as $$declare c profiles;ch text;begin
 if old.status is not distinct from new.status then return new;end if;
 select * into c from profiles where id=new.owner_id;
 foreach ch in array array['email','whatsapp'] loop
 if eligible_for_message(c,ch,'update') then insert into message_outbox(project_id,customer_id,channel,purpose,destination,subject,body,parameters) values(new.id,c.id,ch,'update',case when ch='email' then lower(c.email) else c.phone end,'RAMSON Glass project update','Hello '||c.name||', your RAMSON Glass project '||new.id||' is now '||new.status||'.',jsonb_build_array(c.name,new.status,new.id));end if;end loop;
 return new;end;$$;
create trigger queue_project_update after update on projects for each row execute function queue_project_update();
create function claim_messages() returns setof message_outbox language plpgsql security definer set search_path=public as $$begin
 if not is_admin() then raise exception 'Admin required';end if;
 update message_outbox set status='unknown',error='Interrupted send. Check provider before taking action.',updated_at=now() where status='sending' and updated_at<now()-interval '10 minutes';
 update message_outbox m set status='skipped',error='Consent withdrawn, contact changed or destination suppressed.',updated_at=now() from profiles p where m.customer_id=p.id and m.status='queued' and (not eligible_for_message(p,m.channel,m.purpose) or m.destination<>case when m.channel='email' then lower(p.email) else p.phone end);
 return query update message_outbox set status='sending',updated_at=now() where id in(select id from message_outbox where status='queued' order by created_at for update skip locked limit 5) returning *;
end;$$;
create function finish_message(message uuid,result text,provider text default null,detail text default null) returns void language plpgsql security definer set search_path=public as $$begin
 if not is_admin() or result not in ('accepted','failed','unknown') then raise exception 'Access denied';end if;
 update message_outbox set status=result,provider_id=provider,error=left(detail,1000),updated_at=now() where id=message and status='sending';
 insert into communication_audit(actor_id,action,metadata) values(auth.uid(),'message_attempt',jsonb_build_object('message_id',message,'result',result));end;$$;
create function get_unsubscribe_token(customer uuid) returns uuid language plpgsql security definer set search_path=public as $$declare t uuid;begin
 if not is_admin() then raise exception 'Admin required';end if;
 insert into unsubscribe_tokens(customer_id) values(customer) on conflict do nothing;select token into t from unsubscribe_tokens where customer_id=customer;return t;end;$$;
create function unsubscribe_email(secret uuid) returns void language plpgsql security definer set search_path=public as $$declare c uuid;begin
 select customer_id into c from unsubscribe_tokens where token=secret;if c is null then return;end if;
 update profiles set email_marketing_opt_in=false where id=c;
 insert into message_suppressions(channel,destination,reason) select 'email',lower(email),'Unsubscribed' from profiles where id=c on conflict do nothing;
 insert into communication_audit(action,metadata) values('unsubscribe',jsonb_build_object('customer_id',c));end;$$;
-- Only the server's service-role client may apply verified provider callbacks.
create function apply_delivery_event(event_id text,ch text,provider text,new_status text,destination text default null,suppress boolean default false) returns void language plpgsql security definer set search_path=public as $$begin
 if exists(select 1 from delivery_events where id=event_id) then return;end if;
 if provider is not null and not exists(select 1 from message_outbox where channel=ch and provider_id=provider) then raise exception 'Message not yet reconciled';end if;
 if new_status in ('delivered','read','failed') then update message_outbox set status=new_status,updated_at=now() where channel=ch and provider_id=provider and (status in ('accepted','unknown') or (status='delivered' and new_status='read'));end if;
 if suppress and destination is not null then
 insert into message_suppressions(channel,destination,reason) values(ch,case when ch='email' then lower(destination) else destination end,'Provider suppression / STOP') on conflict do nothing;
 if ch='whatsapp' then update profiles set whatsapp_marketing_opt_in=false,whatsapp_updates_opt_in=false where phone=destination;end if;
 end if;
 insert into delivery_events(id) values(event_id) on conflict do nothing;end;$$;
revoke all on function apply_delivery_event(text,text,text,text,text,boolean) from public,anon,authenticated;
grant execute on function apply_delivery_event(text,text,text,text,text,boolean) to service_role;
revoke all on function eligible_for_message(profiles,text,text) from public,anon,authenticated;
revoke all on function log_customer_export(jsonb),set_message_preferences(uuid,jsonb,text),campaign_recipients(uuid),create_campaign(jsonb),queue_campaign(uuid,int),claim_messages(),finish_message(uuid,text,text,text),get_unsubscribe_token(uuid) from public,anon;
grant execute on function log_customer_export(jsonb),set_message_preferences(uuid,jsonb,text),campaign_recipients(uuid),create_campaign(jsonb),queue_campaign(uuid,int),claim_messages(),finish_message(uuid,text,text,text),get_unsubscribe_token(uuid) to authenticated;
grant execute on function unsubscribe_email(uuid) to anon,authenticated;
revoke update on profiles from authenticated;
grant update(name,phone,address,city,postal_code,customer_type,updated_at) on profiles to authenticated;
grant select on campaigns,message_outbox,communication_audit to authenticated;
create function cancel_campaign(campaign uuid) returns int language plpgsql security definer set search_path=public as $$declare n int;begin
 if not is_admin() then raise exception 'Admin required';end if;
 update message_outbox set status='skipped',error='Cancelled by administrator',updated_at=now() where campaign_id=campaign and status='queued';get diagnostics n=row_count;
 insert into communication_audit(actor_id,action,metadata) values(auth.uid(),'campaign_cancelled',jsonb_build_object('campaign_id',campaign,'count',n));return n;end;$$;
revoke all on function cancel_campaign(uuid) from public,anon;
grant execute on function cancel_campaign(uuid) to authenticated;
create function authorize_message(message uuid) returns boolean language plpgsql security definer set search_path=public as $$declare m message_outbox;c profiles;begin
 if not is_admin() then raise exception 'Admin required';end if;
 select * into strict m from message_outbox where id=message for update;
 select * into strict c from profiles where id=m.customer_id;
 if m.status<>'sending' then return false;end if;
 if not eligible_for_message(c,m.channel,m.purpose) or m.destination<>(case when m.channel='email' then lower(c.email) else c.phone end) then
 update message_outbox set status='skipped',error='Consent or contact changed before send',updated_at=now() where id=message;return false;end if;
 return true;end;$$;
revoke all on function authorize_message(uuid) from public,anon;
grant execute on function authorize_message(uuid) to authenticated;
commit;
