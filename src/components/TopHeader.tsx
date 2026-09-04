import React from 'react';
import {
  Menu,
  Search,
  RefreshCw,
  Plus,
  Key,
  Calendar,
  CloudCheck,
  CheckCircle2,
  ShieldCheck,
  UserCheck
} from 'lucide-react';
import { NavTab } from '../types';

interface TopHeaderProps {
  activeTab: NavTab;
  setActiveTab?: (tab: NavTab) => void;
  isMobileOpen?: boolean;
  setIsMobileOpen?: (open: boolean) => void;
  onOpenMobileSidebar?: () => void;
  userRole: 'admin' | 'auxiliar' | null;
  loggedAuxiliarName: string;
  isOnline?: boolean;
  isSyncing: boolean;
  onSync: () => void;
  busquedaGlobal?: string;
  setBusquedaGlobal?: (val: string) => void;
  onOpenCambiarPin?: () => void;
  onOpenChangePin?: () => void;
  onOpenNuevoTurno?: () => void;
  onLogout?: () => void;
  periodoActivoTexto?: string;
  totalRegistrosCount?: number;
}

export const TopHeader: React.FC<TopHeaderProps> = ({
  activeTab,
  setActiveTab,
  setIsMobileOpen,
  onOpenMobileSidebar,
  userRole,
  loggedAuxiliarName,
  isOnline,
  isSyncing,
  onSync,
  busquedaGlobal,
  setBusquedaGlobal,
  onOpenCambiarPin,
  onOpenChangePin,
  onOpenNuevoTurno,
  onLogout,
  periodoActivoTexto,
  totalRegistrosCount,
}) => {
  const handleOpenMobile = onOpenMobileSidebar || (() => setIsMobileOpen && setIsMobileOpen(true));
  const handleChangePin = onOpenChangePin || onOpenCambiarPin;
  // Títulos y subtítulos por módulo según el rol
  const adminTitlesMap: Record<NavTab, { title: string; subtitle: string; category: string }> = {
    dashboard: {
      title: 'Centro de Control Operacional',
      subtitle: 'Monitoreo en vivo de turnos, jornadas y horas extras',
      category: 'Operación Central',
    },
    auxiliares: {
      title: 'Gestión de Auxiliares',
      subtitle: 'Directorio de personal, cargos, PINs de acceso y expedientes',
      category: 'Talento y Seguridad',
    },
    jornadas: {
      title: 'Jornadas y Turnos',
      subtitle: 'Planilla general de asistencias, vehículos, rutas y cálculo de extras',
      category: 'Planilla de Campo',
    },
    calendario: {
      title: 'Calendario de Turnos',
      subtitle: 'Visualización cronológica mensual y quincenal de asistencias',
      category: 'Cronograma',
    },
    reportes: {
      title: 'Liquidación y Reportes',
      subtitle: 'Consolidado para contabilidad, horas extras y exportación a Excel',
      category: 'Auditoría Salarial',
    },
    alertas: {
      title: 'Alertas y Novedades',
      subtitle: 'Atención inmediata: turnos pendientes, faltas y alertas de fatiga',
      category: 'Supervisión Activa',
    },
    configuracion: {
      title: 'Configuración del Sistema',
      subtitle: 'Parámetros laborales, integraciones n8n y seguridad de credenciales',
      category: 'Ajustes de Plataforma',
    },
  };

  const auxiliarTitlesMap: Record<NavTab, { title: string; subtitle: string; category: string }> = {
    dashboard: {
      title: 'Mi Resumen y Horas',
      subtitle: 'Tus turnos, horas extras acumuladas y estado de nómina',
      category: 'Portal del Auxiliar',
    },
    jornadas: {
      title: 'Registrar Mi Turno',
      subtitle: 'Ingreso, salida, vehículo y ruta de tu jornada de hoy',
      category: 'Portal del Auxiliar',
    },
    calendario: {
      title: 'Mi Calendario',
      subtitle: 'Consulta de tus asistencias y turnos en el mes',
      category: 'Portal del Auxiliar',
    },
    auxiliares: { title: '', subtitle: '', category: '' },
    reportes: { title: '', subtitle: '', category: '' },
    alertas: { title: '', subtitle: '', category: '' },
    configuracion: { title: '', subtitle: '', category: '' },
  };

  const currentMeta = userRole === 'auxiliar' 
    ? (auxiliarTitlesMap[activeTab] || auxiliarTitlesMap.dashboard)
    : (adminTitlesMap[activeTab] || adminTitlesMap.dashboard);

  return (
    <header className="sticky top-0 z-20 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-4 sm:px-6 py-3 transition-colors">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Izquierda: Botón hamburguesa móvil + Breadcrumb / Título */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleOpenMobile}
            className="lg:hidden p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors border border-slate-200"
            title="Abrir menú de navegación"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="flex flex-col text-left">
            <div className="flex items-center gap-2 text-[11px] text-slate-500 font-medium">
              <span className="text-indigo-600 font-semibold">{currentMeta.category}</span>
              <span>/</span>
              <span className="capitalize">{activeTab}</span>
            </div>
            <h1 className="text-base sm:text-lg font-display font-bold text-slate-900 tracking-tight leading-tight">
              {currentMeta.title}
            </h1>
          </div>
        </div>

        {/* Derecha: Sincronización + Cambio de Clave + Acciones Contextuales */}
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          {/* Botón de Sincronización Manual con Supabase */}
          <button
            onClick={onSync}
            disabled={isSyncing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs transition-all cursor-pointer disabled:opacity-60"
            title="Sincronizar en tiempo real con Supabase"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-indigo-600 ${isSyncing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{isSyncing ? 'Sincronizando...' : 'Sincronizar'}</span>
          </button>

          {/* Botón Cambiar Clave (Disponible para Admin y Auxiliares) */}
          {(onOpenCambiarPin || onOpenChangePin) && (
            <button
              onClick={onOpenCambiarPin || onOpenChangePin}
              title={userRole === 'admin' ? "Cambiar clave de administrador" : "Cambiar mi PIN de acceso"}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs transition-all cursor-pointer"
            >
              <Key className="w-3.5 h-3.5 text-amber-500" />
              <span className="hidden sm:inline">{userRole === 'admin' ? 'Cambiar Clave' : 'Cambiar PIN'}</span>
            </button>
          )}

          {/* Acciones principales según el rol */}
          {userRole === 'admin' && (
            <button
              onClick={onOpenNuevoTurno || (() => setActiveTab && setActiveTab('jornadas'))}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs shadow-indigo-600/30 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Nuevo Turno</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
