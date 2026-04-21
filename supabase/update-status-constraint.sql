-- ============================================
-- Actualización de la Restricción CHECK de access_logs
-- para soportar eventos administrativos del PIC18F45K50
-- ============================================
-- Ejecuta esto en el SQL Editor de Supabase (Proyecto de Control de Acceso)

-- 1. Eliminar la restricción CHECK antigua (solo acepta GRANTED, DENIED, ANOMALY)
ALTER TABLE public.access_logs DROP CONSTRAINT IF EXISTS access_logs_status_check;

-- 2. Crear la nueva restricción con TODOS los estados del PIC
ALTER TABLE public.access_logs ADD CONSTRAINT access_logs_status_check 
  CHECK (status IN (
    'GRANTED',        -- Acceso concedido (modo normal)
    'DENIED',         -- Acceso denegado (modo normal)
    'ANOMALY',        -- Anomalía detectada por IA
    'ADMIN_START',    -- Tarjeta maestra activó modo admin
    'ADMIN_END',      -- Tarjeta maestra desactivó modo admin
    'USER_ADDED',     -- Nueva credencial registrada en EEPROM
    'USER_REMOVED',   -- Credencial eliminada de EEPROM
    'FACTORY_RESET'   -- Borrado total de memoria (clave D311)
  ));
