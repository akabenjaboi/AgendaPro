create extension if not exists pg_net;
create extension if not exists pg_cron;

do $$
declare
  existing_job_id bigint;
begin
  begin
    select jobid
      into existing_job_id
    from cron.job
    where jobname = 'whatsapp-reminders-every-15-min';

    if existing_job_id is not null then
      perform cron.unschedule(existing_job_id);
    end if;
  exception
    when undefined_table then
      null;
  end;
end $$;

select cron.schedule(
  'whatsapp-reminders-every-15-min',
  '*/15 * * * *',
  $$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/whatsapp-reminders',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-reminder-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'whatsapp_reminder_secret')
      ),
      body := jsonb_build_object(
        'hours_before', 24,
        'window_minutes', 90,
        'limit', 50
      )
    );
  $$
);
