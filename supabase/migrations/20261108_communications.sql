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
