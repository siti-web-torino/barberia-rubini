create extension if not exists btree_gist;

create type public.app_role as enum ('admin');
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;
create policy "own roles" on public.user_roles for select to authenticated using (user_id = auth.uid());

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create or replace function public.is_admin() returns boolean language sql stable security definer set search_path = public as $$
  select public.has_role(auth.uid(), 'admin')
$$;

create table public.site_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
grant select on public.site_settings to anon, authenticated;
grant insert, update, delete on public.site_settings to authenticated;
grant all on public.site_settings to service_role;
alter table public.site_settings enable row level security;
create policy "public read settings" on public.site_settings for select to anon, authenticated using (true);
create policy "admin write settings" on public.site_settings for all to authenticated using (public.is_admin()) with check (public.is_admin());

create table public.barbers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  photo_url text,
  bio text not null default '',
  specialties text[] not null default '{}',
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
grant select on public.barbers to anon, authenticated;
grant insert, update, delete on public.barbers to authenticated;
grant all on public.barbers to service_role;
alter table public.barbers enable row level security;
create policy "public read active barbers" on public.barbers for select to anon, authenticated using (active or public.is_admin());
create policy "admin write barbers" on public.barbers for all to authenticated using (public.is_admin()) with check (public.is_admin());

create table public.services (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  price_cents int not null check (price_cents >= 0),
  duration_min int not null check (duration_min > 0),
  image_url text,
  category text not null default 'Taglio',
  active boolean not null default true,
  visible boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
grant select on public.services to anon, authenticated;
grant insert, update, delete on public.services to authenticated;
grant all on public.services to service_role;
alter table public.services enable row level security;
create policy "public read services" on public.services for select to anon, authenticated using ((active and visible) or public.is_admin());
create policy "admin write services" on public.services for all to authenticated using (public.is_admin()) with check (public.is_admin());

create table public.barber_services (
  barber_id uuid not null references public.barbers(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete cascade,
  primary key (barber_id, service_id)
);
grant select on public.barber_services to anon, authenticated;
grant insert, update, delete on public.barber_services to authenticated;
grant all on public.barber_services to service_role;
alter table public.barber_services enable row level security;
create policy "public read bs" on public.barber_services for select to anon, authenticated using (true);
create policy "admin write bs" on public.barber_services for all to authenticated using (public.is_admin()) with check (public.is_admin());

create table public.working_hours (
  id uuid primary key default gen_random_uuid(),
  barber_id uuid not null references public.barbers(id) on delete cascade,
  weekday int not null check (weekday between 0 and 6),
  start_time time not null,
  end_time time not null check (end_time > start_time)
);
grant select on public.working_hours to anon, authenticated;
grant insert, update, delete on public.working_hours to authenticated;
grant all on public.working_hours to service_role;
alter table public.working_hours enable row level security;
create policy "public read wh" on public.working_hours for select to anon, authenticated using (true);
create policy "admin write wh" on public.working_hours for all to authenticated using (public.is_admin()) with check (public.is_admin());

create table public.time_off (
  id uuid primary key default gen_random_uuid(),
  barber_id uuid references public.barbers(id) on delete cascade,
  start_date date not null,
  end_date date not null check (end_date >= start_date),
  reason text not null default '',
  created_at timestamptz not null default now()
);
grant select on public.time_off to anon, authenticated;
grant insert, update, delete on public.time_off to authenticated;
grant all on public.time_off to service_role;
alter table public.time_off enable row level security;
create policy "public read to" on public.time_off for select to anon, authenticated using (true);
create policy "admin write to" on public.time_off for all to authenticated using (public.is_admin()) with check (public.is_admin());

create type public.appointment_status as enum ('pending','confirmed','cancelled','completed','no_show');
create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  customer_name text not null,
  customer_phone text not null,
  customer_email text,
  notes text not null default '',
  barber_id uuid references public.barbers(id) on delete set null,
  barber_name text not null,
  start_at timestamptz not null,
  end_at timestamptz not null check (end_at > start_at),
  total_cents int not null,
  total_minutes int not null,
  status public.appointment_status not null default 'confirmed',
  source text not null default 'online',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint no_overlap exclude using gist (
    barber_id with =, tstzrange(start_at, end_at, '[)') with &&
  ) where (status in ('pending','confirmed'))
);
create index on public.appointments (start_at);
grant select, insert, update, delete on public.appointments to authenticated;
grant all on public.appointments to service_role;
alter table public.appointments enable row level security;
create policy "admin all appts" on public.appointments for all to authenticated using (public.is_admin()) with check (public.is_admin());

create table public.appointment_services (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  service_id uuid references public.services(id) on delete set null,
  name text not null,
  price_cents int not null,
  duration_min int not null
);
grant select, insert, update, delete on public.appointment_services to authenticated;
grant all on public.appointment_services to service_role;
alter table public.appointment_services enable row level security;
create policy "admin all as" on public.appointment_services for all to authenticated using (public.is_admin()) with check (public.is_admin());

create table public.email_log (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid references public.appointments(id) on delete cascade,
  kind text not null,
  recipient text not null,
  status text not null,
  error text,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.email_log to authenticated;
grant all on public.email_log to service_role;
alter table public.email_log enable row level security;
create policy "admin all el" on public.email_log for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "admin read media" on storage.objects for select to authenticated using (bucket_id = 'media' and public.is_admin());
create policy "admin upload media" on storage.objects for insert to authenticated with check (bucket_id = 'media' and public.is_admin());
create policy "admin update media" on storage.objects for update to authenticated using (bucket_id = 'media' and public.is_admin());
create policy "admin delete media" on storage.objects for delete to authenticated using (bucket_id = 'media' and public.is_admin());

insert into public.site_settings (key, value) values
('content', jsonb_build_object(
 'name','Barbiere Rubini',
 'logo_url','',
 'hero_title','L''arte del taglio, senza fretta.',
 'hero_subtitle','[Testo provvisorio] Tagli classici e moderni, rasature e cura della barba in un ambiente curato.',
 'hero_image','',
 'about_title','La barberia',
 'about_text','[Testo provvisorio da sostituire] Racconta qui la storia di Barbiere Rubini: da quanto tempo esiste, cosa la rende unica e che esperienza vivono i clienti.',
 'about_image','',
 'gallery', '[]'::jsonb,
 'address','', 'map_query','', 'phone','', 'email','', 'instagram','', 'facebook','',
 'footer_text','', 'legal_name','', 'vat','',
 'privacy_text', E'[Informativa provvisoria — da verificare e completare a cura del titolare prima della pubblicazione.]\n\nTitolare del trattamento: [da inserire].\n\nDati raccolti: nome, telefono, email e note facoltative, utilizzati esclusivamente per gestire la prenotazione e comunicare con il cliente riguardo all''appuntamento.\n\nConservazione: i dati vengono conservati per il tempo necessario alla gestione degli appuntamenti e poi cancellati secondo le regole stabilite dal titolare.\n\nDiritti: puoi chiedere accesso, rettifica o cancellazione dei tuoi dati contattando la barberia.'
)),
('booking', '{"timezone":"Europe/Rome","min_notice_minutes":60,"max_days_ahead":60,"buffer_minutes":0,"slot_step_minutes":15,"auto_confirm":true,"allow_multiple":true,"reminders_enabled":false}'::jsonb);

with b as (
  insert into public.barbers (name, bio, specialties, sort_order) values
  ('Barbiere 1 (provvisorio)', 'Descrizione provvisoria: inserisci la presentazione dal pannello.', array['Tagli classici','Rasatura'], 1),
  ('Barbiere 2 (provvisorio)', 'Descrizione provvisoria: inserisci la presentazione dal pannello.', array['Fade','Barba'], 2)
  returning id
), s as (
  insert into public.services (name, description, price_cents, duration_min, category, sort_order) values
  ('Taglio uomo','Taglio su misura con rifinitura.',2000,30,'Taglio',1),
  ('Taglio con shampoo','Shampoo, taglio e asciugatura.',2500,40,'Taglio',2),
  ('Sistemazione barba','Rifinitura dei contorni e della lunghezza.',1200,20,'Barba',3),
  ('Modellatura barba','Modellatura completa con panno caldo.',1800,30,'Barba',4),
  ('Taglio e barba','Il servizio completo.',3000,50,'Combo',5),
  ('Shampoo e styling','Lavaggio e piega con prodotti professionali.',1200,20,'Styling',6)
  returning id
)
insert into public.barber_services (barber_id, service_id) select b.id, s.id from b cross join s;

insert into public.working_hours (barber_id, weekday, start_time, end_time)
select b.id, d, t.s, t.e from public.barbers b
cross join generate_series(2,6) d
cross join (values ('09:00'::time,'13:00'::time),('14:30'::time,'19:00'::time)) t(s,e);