-- Applied after schema.sql on the dedicated RAMSON Supabase project.
revoke all on all tables in schema public from anon,authenticated;
revoke all on all sequences in schema public from anon,authenticated;
grant select on public.services to anon,authenticated;
grant insert on public.leads to anon,authenticated;
grant select on public.profiles,public.projects,public.leads,public.messages,public.project_files,public.project_events,public.purchases,public.purchase_events,public.customer_events,public.campaigns,public.message_outbox,public.communication_audit to authenticated;
grant insert,update,delete on public.services to authenticated;
grant update(status,approved_total,payment_url) on public.projects to authenticated;
grant update(status) on public.leads to authenticated;
grant insert on public.messages,public.project_files,public.purchases to authenticated;
grant update on public.purchases to authenticated;
grant update(name,phone,address,city,postal_code,customer_type,updated_at) on public.profiles to authenticated;
-- Triggers run as their owner; they must not be callable public RPCs.
revoke execute on function public.new_profile(),public.sync_customer_email(),public.project_audit(),public.check_purchase(),public.audit_purchase(),public.audit_customer_contact(),public.queue_project_update(),public.reset_contact_consent() from public,anon,authenticated;
revoke execute on function public.is_admin(),public.create_estimate(jsonb),public.update_customer_profile(jsonb) from public,anon;
grant execute on function public.is_admin(),public.create_estimate(jsonb),public.update_customer_profile(jsonb) to authenticated;
revoke execute on function public.unsubscribe_email(uuid) from public,anon,authenticated;
grant execute on function public.unsubscribe_email(uuid) to service_role;
-- Cache request-level identity checks rather than repeating them for each row.
alter policy profile_read on public.profiles using(id=(select auth.uid()) or (select public.is_admin()));
alter policy projects_read on public.projects using(owner_id=(select auth.uid()) or (select public.is_admin()));
alter policy messages_insert on public.messages with check(author_id=(select auth.uid()) and exists(select 1 from public.projects where id=project_id));
alter policy files_insert on public.project_files with check(owner_id=(select auth.uid()) and split_part(path,'/',1)=project_id::text and exists(select 1 from public.projects where id=project_id));
alter policy purchases_read on public.purchases using(customer_id=(select auth.uid()) or (select public.is_admin()));
alter policy purchases_insert on public.purchases with check((select public.is_admin()) and recorded_by=(select auth.uid()));
alter policy project_storage_delete on storage.objects using(bucket_id='project-files' and owner_id=(select auth.uid())::text);
-- Separate catalogue writes from its public read policy.
drop policy services_admin on public.services;
create policy services_admin_insert on public.services for insert to authenticated with check((select public.is_admin()));
create policy services_admin_update on public.services for update to authenticated using((select public.is_admin())) with check((select public.is_admin()));
create policy services_admin_delete on public.services for delete to authenticated using((select public.is_admin()));
create index projects_owner_created on public.projects(owner_id,created_at desc);
create index projects_service on public.projects(service_id);
create index messages_project_created on public.messages(project_id,created_at);
create index messages_author on public.messages(author_id);
create index project_files_project on public.project_files(project_id);
create index project_files_owner on public.project_files(owner_id);
create index project_events_project on public.project_events(project_id,created_at);
create index customer_events_customer on public.customer_events(customer_id,created_at desc);
create index purchase_events_purchase on public.purchase_events(purchase_id,created_at);
create index purchase_events_actor on public.purchase_events(actor_id);
create index purchases_project on public.purchases(project_id);
create index purchases_recorded_by on public.purchases(recorded_by);
create index campaigns_created_by on public.campaigns(created_by);
create index message_outbox_customer on public.message_outbox(customer_id);
create index message_outbox_project on public.message_outbox(project_id);
