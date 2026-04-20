-- ============================================
-- IoT Access Control System — Estadísticas Avanzadas (Vistas)
-- Copia e invoca este script en el Supabase SQL Editor
-- ============================================

-- ============================================
-- 1. Vista: Usuarios más frecuentes (Top Entrants)
-- Cuenta los accesos físicos por usuario y los ordena.
-- ============================================
CREATE OR REPLACE VIEW public.view_top_users AS
SELECT 
  u.id,
  u.name, 
  COUNT(a.id) as total_accesses, 
  MAX(a.timestamp) as last_access
FROM public.users u
JOIN public.access_logs a ON u.id = a.user_id
WHERE a.status = 'GRANTED'
GROUP BY u.id, u.name
ORDER BY total_accesses DESC;

-- ============================================
-- 2. Vista: Usuarios Inactivos (Fantasmas/Ausentismo)
-- Muestra a los usuarios que tienen credencial asignada
-- pero no registran TIENEN CERO ingresos (nunca han cruzado la puerta)
-- ============================================
CREATE OR REPLACE VIEW public.view_inactive_users AS
SELECT 
  u.id, 
  u.name, 
  u.rfid_tag, 
  u.role
FROM public.users u
LEFT JOIN public.access_logs a ON u.id = a.user_id
WHERE a.id IS NULL;

-- ============================================
-- 3. Vista: Mapa de Calor u Horas Pico (Peak Hours)
-- Analiza los registros 'GRANTED' sumando el volumen según 
-- el momento horario del día, configurado en Hora Venezuela.
-- ============================================
CREATE OR REPLACE VIEW public.view_peak_hours AS
SELECT 
  EXTRACT(HOUR FROM timestamp AT TIME ZONE 'America/Caracas') AS hour_of_day,
  COUNT(id) AS access_count
FROM public.access_logs
WHERE status = 'GRANTED'
GROUP BY hour_of_day
ORDER BY access_count DESC;

-- ============================================
-- 4. Actualización de Políticas de Seguridad (RLS)
-- Los Administradores y Service Role necesitan leer estar vistas
-- ============================================
-- Las Vistas en Postgres por defecto heredan los privilegios 
-- y son accesibles por roles con permisos SELECT. 
-- Nos aseguramos concediendo SELECT al rol "authenticated" y "service_role"
GRANT SELECT ON public.view_top_users TO authenticated, service_role;
GRANT SELECT ON public.view_inactive_users TO authenticated, service_role;
GRANT SELECT ON public.view_peak_hours TO authenticated, service_role;
