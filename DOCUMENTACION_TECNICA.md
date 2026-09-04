# DOCUMENTO DE ARQUITECTURA TÉCNICA — FERRICAR LOGÍSTICA

> **Propósito:** Guía técnica integral del sistema para desarrolladores e inteligencias artificiales que deban auditar, mantener, desplegar o extender la plataforma.

---

## 1. RESUMEN DEL SISTEMA Y DOMINIO DE NEGOCIO

**FERRICAR LOGÍSTICA** es una plataforma web progresiva (PWA / SPA) para la gestión operativa, control de asistencia, cálculo de recargos nocturnos, horas extras y preliquidación de nómina de auxiliares de carga y distribución de **FERRICAR S.A.S.** (Colombia).

### Objetivos Clave:
1. **Registro Operativo:** Registro descentralizado de turnos por parte de los auxiliares (o centralizado por coordinadores) con placa de vehículo, ruta, hora de entrada y hora de salida.
2. **Cálculo Laboral Colombiano Automático:**
   - Jornada ordinaria legal (8 horas estándar).
   - Horas extras (jornada total - 8 horas).
   - Recargo nocturno (turnos que cruzan o comprenden el horario entre 21:00 y 06:00).
   - Exclusión de domingos y festivos oficiales de Colombia de los días hábiles esperados.
3. **Control de Acceso Basado en PIN (RBAC):**
   - **Administrador / Coordinador:** Acceso total a KPIs, consolidado de liquidación, gestión de personal, auditoría de faltas y configuración.
   - **Auxiliar Logístico:** Portal personal con sus turnos, acumulado de extras, calendario individual, y **capacidad de editar o eliminar sus propios registros**.
4. **Resiliencia Local-First (Offline-Ready):**
   - Sincronización bidireccional con **Supabase (PostgreSQL)** en la nube cuando hay red.
   - Respaldo en `localStorage` ante desconexión para garantizar cero pérdida de datos en campo.

---

## 2. STACK TECNOLÓGICO Y ARQUITECTURA DE SOFTWARE

```
┌─────────────────────────────────────────────────────────────┐
│                       CAPA CLIENTE                          │
│  React 18 + TypeScript + Vite + Tailwind CSS + Lucide Icons │
│  Motion (Animaciones) + Recharts (Visualización de Datos)   │
└──────────────────────────────┬──────────────────────────────┘
                               │
            ┌──────────────────┴──────────────────┐
            ▼                                     ▼
┌─────────────────────────┐           ┌─────────────────────────┐
│     SUPABASE CLOUD      │           │      LOCAL STORAGE      │
│  PostgreSQL + REST API  │           │   Persistencia local    │
│  Tablas: turnos, pins   │           │   Cache y modo offline  │
└─────────────────────────┘           └─────────────────────────┘
```

- **Frontend:** React 18, TypeScript, Tailwind CSS v4, Motion (`motion/react`), Lucide React.
- **Backend / Persistencia:** Supabase Client (`@supabase/supabase-js`).
- **Bundler & Tooling:** Vite, ESBuild, ESLint.

---

## 3. ESTRUCTURA DE ARCHIVOS Y MÓDULOS

```
├── DOCUMENTACION_TECNICA.md         # Este documento técnico
├── src/
│   ├── main.tsx                     # Punto de entrada React
│   ├── App.tsx                      # Orquestador de estado global, autenticación y vistas
│   ├── types.ts                     # Definiciones de tipos e interfaces TypeScript
│   ├── utils.ts                     # Motor de cálculo laboral (festivos, extras, quincenas)
│   ├── supabase.ts                  # Cliente Supabase, queries CRUD y sincronización
│   └── components/
│       ├── Sidebar.tsx              # Barra de navegación lateral responsiva (Admin/Auxiliar)
│       ├── TopHeader.tsx            # Header superior contextual con estado de sincronización
│       ├── DashboardView.tsx        # Dashboard gerencial y portal operativo de auxiliar
│       ├── AuxiliaresView.tsx       # Directorio de personal, asignación de PINs y cargos
│       ├── JornadasView.tsx         # Tabla completa de turnos (con edición/eliminación por rol)
│       ├── CalendarView.tsx         # Calendario mensual con detección de domingos/festivos
│       ├── ReportesView.tsx         # Planilla de preliquidación quincenal y exportación Excel
│       ├── AlertasView.tsx          # Detección de fatiga laboral (+10h extras) y faltas
│       ├── ConfiguracionView.tsx    # Gestión del PIN maestro y monitor de salud Supabase
│       ├── HoursRegister.tsx        # Formulario rápido de captura de turno
│       ├── PrivacyModal.tsx         # Modal de Habeas Data y Política de Tratamiento de Datos
│       └── ErrorBoundary.tsx        # Captura de fallos en renderizado
```

---

## 4. ESQUEMA DE BASE DE DATOS Y CONEXIÓN (SUPABASE / POSTGRESQL)

### Credenciales de Conexión Activas:
- **Supabase URL:** `https://tgouvfrpdgivtwmantby.supabase.co`
- **Supabase Anon Key:** `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRnb3V2ZnJwZGdpdnR3bWFudGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMyOTc4ODEsImV4cCI6MjA5ODg3Mzg4MX0.mbz7DDXbyVZ3A8KpIRZBm8GvkRTFegd-RiPyXb_XHtM`
- **REST Endpoints:**
  - `GET/POST/PATCH/DELETE`: `https://tgouvfrpdgivtwmantby.supabase.co/rest/v1/registros`
  - `GET/POST/PATCH/DELETE`: `https://tgouvfrpdgivtwmantby.supabase.co/rest/v1/auxiliares_credenciales`

---

### Tabla 1: `registros` (Jornadas y Turnos Operativos)
Almacena cada turno laboral registrado por los auxiliares o el administrador.

```sql
CREATE TABLE IF NOT EXISTS public.registros (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auxiliar TEXT NOT NULL,              -- Nombre en mayúsculas del colaborador
    vehiculo TEXT,                       -- Placa del vehículo o identificador de ruta
    fecha DATE NOT NULL,                 -- Fecha del turno (YYYY-MM-DD)
    hora_ingreso TIME NOT NULL,          -- Hora de entrada (HH:mm)
    hora_salida TIME NOT NULL,           -- Hora de salida (HH:mm)
    ruta TEXT,                           -- Destino o ruta asignada
    jornada NUMERIC(5,2) NOT NULL DEFAULT 8.00,      -- Duración total calculada en horas decimales
    horas_extras NUMERIC(5,2) NOT NULL DEFAULT 0.00, -- Horas por encima de la jornada ordinaria (8h)
    es_nocturno BOOLEAN NOT NULL DEFAULT FALSE,      -- Si el turno operó entre las 21:00 y las 06:00
    origen TEXT DEFAULT 'manual',        -- 'manual' o 'sistema'
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices de consulta rápida:
CREATE INDEX IF NOT EXISTS idx_registros_fecha ON public.registros(fecha);
CREATE INDEX IF NOT EXISTS idx_registros_auxiliar ON public.registros(auxiliar);
CREATE INDEX IF NOT EXISTS idx_registros_fecha_auxiliar ON public.registros(fecha, auxiliar);
```

### Tabla 2: `auxiliares_credenciales` (PINs y Acceso por Colaborador)
Almacena los PINs individuales de 4 dígitos para cada auxiliar y el rol administrador.

```sql
CREATE TABLE IF NOT EXISTS public.auxiliares_credenciales (
    auxiliar TEXT PRIMARY KEY,           -- Nombre en mayúsculas del auxiliar (o 'ADMIN')
    pin VARCHAR(10) NOT NULL,            -- PIN numérico de 4 dígitos (ej: '1234', '9988')
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Reglas de Seguridad Row Level Security (RLS en Supabase):
Para permitir que la app cliente funcione de forma fluida mediante la clave `anon`:

```sql
ALTER TABLE public.registros ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auxiliares_credenciales ENABLE ROW LEVEL SECURITY;

-- Acceso a la tabla registros
CREATE POLICY "Permitir select registros a anon" 
ON public.registros FOR SELECT TO anon USING (true);

CREATE POLICY "Permitir insert registros a anon" 
ON public.registros FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Permitir update registros a anon" 
ON public.registros FOR UPDATE TO anon USING (true);

CREATE POLICY "Permitir delete registros a anon" 
ON public.registros FOR DELETE TO anon USING (true);

-- Acceso a la tabla auxiliares_credenciales
CREATE POLICY "Permitir select auxiliares_credenciales a anon" 
ON public.auxiliares_credenciales FOR SELECT TO anon USING (true);

CREATE POLICY "Permitir insert auxiliares_credenciales a anon" 
ON public.auxiliares_credenciales FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Permitir update auxiliares_credenciales a anon" 
ON public.auxiliares_credenciales FOR UPDATE TO anon USING (true);

CREATE POLICY "Permitir delete auxiliares_credenciales a anon" 
ON public.auxiliares_credenciales FOR DELETE TO anon USING (true);
```

---

## 5. REGLAS DE NEGOCIO Y CÁLCULOS MATEMÁTICOS

### 5.1. Duración de Jornada y Horas Extras (`src/utils.ts`)
- Las horas se calculan convirtiendo `HH:mm` a minutos transcurridos desde medianoche.
- Si `horaSalida < horaIngreso`, el turno cruzó la medianoche:
  $$\text{minutos} = (1440 - \text{ingreso}) + \text{salida}$$
- **Jornada Ordinaria:** 8 horas.
- **Horas Extras:** $\max(0, \text{Jornada} - 8)$.

### 5.2. Recargo Nocturno
- El horario nocturno legal en Colombia opera entre las **21:00 (9:00 PM)** y las **06:00 (6:00 AM)**.
- Cualquier turno cuya ventana contenga minutos en este rango activa la bandera `esNocturno = true`.

### 5.3. Días Hábiles Esperados y Días No Laborables
- Se calcula de forma dinámica para el período activo:
  - Se evalúan todos los días entre `fechaInicio` y `fechaFin`.
  - Se descartan automáticamente los **Domingos** (`dia.getDay() === 0`).
  - Se descartan los **Festivos oficiales de Colombia** (incluyendo Ley Emiliani y cálculo astronómico de Pascua: Jueves Santo, Viernes Santo, Ascensión, Corpus Christi, Sagrado Corazón).
- Los turnos laborados en domingos o festivos computan como turnos adicionales/recargos especiales.

---

## 6. SISTEMA DE PERMISOS Y PRIVILEGIOS (RBAC)

| Funcionalidad | Rol Administrador | Rol Auxiliar Logístico |
|---|:---:|:---:|
| Ver Dashboard General (KPIs globales de flota) |  Sí |  No (Ve su Portal Personal) |
| Ver Portal Personal (Mis turnos, Mis horas) |  Sí |  Sí |
| Registrar Nuevo Turno |  Sí (Cualquier auxiliar) |  Sí (Solo a su nombre) |
| **Editar Registro de Turno** |  **Sí (Todos)** |  **Sí (Únicamente sus propios registros)** |
| **Eliminar Registro de Turno** |  **Sí (Todos)** |  **Sí (Únicamente sus propios registros)** |
| Gestión de Auxiliares y asignación de PINs |  Sí |  No |
| Cambiar su propio PIN |  Sí (PIN Admin) |  Sí (Desde su sesión) |
| Consolidado de Nómina & Exportar a Excel |  Sí |  No |
| Panel de Alertas de Fatiga y Faltas |  Sí |  No |
| Calendario de Asistencia |  Sí (Todos los auxiliares) |  Sí (Solo su calendario) |
| Filtro Personalizado de Fechas (Desde/Hasta) |  Sí (En todas las vistas) |  Sí (En sus turnos) |
| Consultar Políticas de Privacidad (Habeas Data) |  Sí |  Sí |

---

## 7. VARIABLES DE ENTORNO Y CONFIGURACIÓN

Las credenciales de conexión con Supabase se leen mediante variables públicas de Vite:

```env
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu-anon-public-key
```

*Nota: La aplicación incluye credenciales seguras integradas por defecto para arranque inmediato si no se suministran externamente.*

---

## 8. CUMPLIMIENTO LEGAL Y PRIVACIDAD DE DATOS (HABEAS DATA)

- Cumple con la **Ley Estatutaria 1581 de 2012** y el **Decreto 1377 de 2013** de la República de Colombia.
- Finalidad exclusiva: control de asistencia laboral, liquidación de tiempos y seguridad física.
- El usuario puede consultar la política completa en cualquier momento desde la pantalla de autenticación o el pie de la barra lateral.

---

## 9. RADAR DE EXCESO DE HORAS & SOBRECARGA OPERATIVA (EXCLUSIVO ADMIN)

Diseñado para identificar con precisión dónde y por qué se generan sobrecostos por horas extras y riesgos de fatiga:

1. **Tasa de Sobrecarga Global**: Ratio porcentual `(Horas Extras / Horas Laboradas Totales) * 100` con semáforo inteligente:
   - 🟢 **Operación Balanceada**: `< 14%`
   - 🟡 **Alerta Moderada**: `14% - 22%`
   - 🔴 **Sobrecarga Crítica**: `> 22%`
2. **Foco Territorial por Rutas**: Ranking de rutas con mayor volumen de extras, porcentaje del sobrecosto de la empresa, promedio de jornada por viaje y conteo de jornadas extendidas (>10h).
3. **Foco de Flota por Placas / Vehículos**: Detección de camiones con tiempos excesivos de recorrido o demoras en cargue/descargue.
4. **Foco Temporal por Día de la Semana**: Gráfico comparativo de Lunes a Domingo que identifica el "Día Pico" de despachos para anticipar refuerzos logísticos.
5. **Auditoría de Cumplimiento Legal (C.S.T. Colombia)**: Alerta automática de turnos que superaron las 2 horas extras diarias máximas permitidas por ley, facilitando planes de rotación y mitigación de riesgos laborales.
6. **Diagnósticos y Recomendaciones Ejecutivas**: Motor heurístico que genera planes de acción sugeridos (ej. escalonar cargue, auditar descargue en ruta crítica o redistribuir frecuencias).

