-- ============================================================
-- CATAN DASHBOARD — Schema completo para Supabase
-- Ejecutar en el SQL editor de Supabase
-- ============================================================

-- Tabla jugadores
create table if not exists jugadores (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  es_miembro_oficial boolean default false,
  activo boolean default true,
  created_at timestamptz default now()
);

-- Datos iniciales
insert into jugadores (nombre, es_miembro_oficial) values
  ('Gallo', true), ('Ivo', true), ('Gaspa', true),
  ('Hugo', true), ('Moch', true), ('Max', true)
on conflict (nombre) do nothing;

-- Tabla eventos
create table if not exists eventos (
  id serial primary key,
  numero_evento integer not null unique,
  fecha date not null,
  ubicacion text not null,
  created_at timestamptz default now()
);

-- Tabla partidas
create table if not exists partidas (
  id serial primary key,
  numero_partida integer not null unique,
  evento_id integer references eventos(id) on delete cascade,
  fecha date not null,
  total_jugadores integer not null check (total_jugadores between 4 and 6),
  es_grand_slam boolean default false,
  orden_turno text[],
  created_at timestamptz default now()
);

-- Tabla resultados
create table if not exists resultados (
  id serial primary key,
  partida_id integer references partidas(id) on delete cascade,
  jugador_id uuid references jugadores(id) on delete cascade,
  puntos_tablero integer not null,
  puntos_pv integer default 0,
  ejercito_mas_grande boolean default false,
  camino_mas_largo boolean default false,
  puntos_totales integer not null,
  rank_en_partida integer not null,
  penalidad integer default 0,
  created_at timestamptz default now(),
  unique(partida_id, jugador_id)
);

-- Tabla backup_logs
create table if not exists backup_logs (
  id serial primary key,
  tipo text not null default 'google_sheets',
  resultado text not null,
  mensaje text,
  created_at timestamptz default now()
);

-- Vista estadísticas jugadores
create or replace view estadisticas_jugadores as
select
  j.id,
  j.nombre,
  j.es_miembro_oficial,
  count(distinct r.partida_id) as partidas_jugadas,
  count(case when r.rank_en_partida = 1 then 1 end) as victorias,
  round(
    count(case when r.rank_en_partida = 1 then 1 end)::numeric
    / nullif(count(distinct r.partida_id), 0) * 100, 1
  ) as pct_victorias,
  round(avg(r.puntos_totales), 2) as promedio_puntos,
  sum(case when r.ejercito_mas_grande then 1 else 0 end) as total_ejercitos,
  sum(case when r.camino_mas_largo then 1 else 0 end) as total_caminos,
  sum(r.puntos_pv) as total_pv,
  count(case when r.rank_en_partida = 1 and r.puntos_totales = 11 then 1 end) as victorias_flawless,
  count(case when r.rank_en_partida = 1 and r.puntos_tablero = 10 then 1 end) as diez_tablero
from jugadores j
left join resultados r on j.id = r.jugador_id
group by j.id, j.nombre, j.es_miembro_oficial;

-- ============================================================
-- Row Level Security
-- ============================================================
alter table jugadores enable row level security;
alter table eventos enable row level security;
alter table partidas enable row level security;
alter table resultados enable row level security;
alter table backup_logs enable row level security;

-- Lectura pública
create policy "lectura publica" on jugadores for select using (true);
create policy "lectura publica" on eventos for select using (true);
create policy "lectura publica" on partidas for select using (true);
create policy "lectura publica" on resultados for select using (true);
create policy "lectura publica" on backup_logs for select using (true);

-- Escritura solo admin autenticado
create policy "escritura admin" on jugadores for all using (auth.role() = 'authenticated');
create policy "escritura admin" on eventos for all using (auth.role() = 'authenticated');
create policy "escritura admin" on partidas for all using (auth.role() = 'authenticated');
create policy "escritura admin" on resultados for all using (auth.role() = 'authenticated');
create policy "escritura admin" on backup_logs for all using (auth.role() = 'authenticated');
