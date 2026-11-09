import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  LayoutDashboard,
  Users,
  Briefcase,
  Calendar,
  FileSpreadsheet,
  AlertTriangle,
  Settings,
  PlusCircle,
  History,
  LogOut,
  ChevronRight,
  ShieldCheck,
  UserCheck,
  TrendingUp,
  X,
  Radio,
  Key
} from 'lucide-react';
import { NavTab } from '../types';

interface SidebarProps {
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
  userRole: 'admin' | 'auxiliar' | null;
  loggedAuxiliarName: string;
  onLogout: () => void;
  isMobileOpen: boolean;
  setIsMobileOpen: (open: boolean) => void;
  auxiliaresCount?: number;
  alertasCount?: number;
  alertCount?: number;
  isOnline?: boolean;
  onOpenNewTurno?: () => void;
  onOpenPrivacy?: () => void;
  onOpenChangePin?: () => void;
}

type NavItem = {
  id: NavTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string | number;
  badgeColor?: string;
};

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  userRole,
  loggedAuxiliarName,
  onLogout,
  isMobileOpen,
  setIsMobileOpen,
  auxiliaresCount = 0,
  alertasCount = 0,
  alertCount,
  isOnline = true,
  onOpenPrivacy,
  onOpenChangePin,
}) => {
  const effectiveAlertCount = alertCount !== undefined ? alertCount : alertasCount;

  // Items para Administrador
  const adminNavItems: NavItem[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'auxiliares', label: 'Auxiliares', icon: Users, badge: auxiliaresCount > 0 ? auxiliaresCount : undefined },
    { id: 'jornadas', label: 'Jornadas', icon: Briefcase },
    { id: 'calendario', label: 'Calendario', icon: Calendar },
    { id: 'reportes', label: 'Reportes', icon: FileSpreadsheet },
    { id: 'alertas', label: 'Alertas', icon: AlertTriangle, badge: effectiveAlertCount > 0 ? effectiveAlertCount : undefined, badgeColor: 'bg-rose-500 text-white' },
    { id: 'configuracion', label: 'Configuración', icon: Settings },
  ];

  // Items para Auxiliar Operativo
  const auxiliarNavItems: NavItem[] = [
    { id: 'jornadas', label: 'Registrar Turno', icon: PlusCircle },
    { id: 'dashboard', label: 'Mi Historial y Horas', icon: History },
    { id: 'calendario', label: 'Mi Calendario', icon: Calendar },
  ];

  const currentNavItems = userRole === 'admin' ? adminNavItems : auxiliarNavItems;

  const getInitials = (name: string) => {
    if (!name) return 'FC';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  };

  const navContent = (
    <div className="flex flex-col h-full bg-slate-900 text-slate-100 select-none border-r border-slate-800">
      {/* 1. Header de Marca FERRICAR */}
      <div className="p-4 sm:p-5 border-b border-slate-800/80 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center text-white shadow-md shadow-indigo-950/40 shrink-0">
            <TrendingUp className="w-5 h-5 text-white" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="font-display font-black text-base text-white tracking-tight">FERRICAR</span>
              <span className="text-[9px] uppercase tracking-wider font-mono font-bold bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded border border-indigo-500/30">
                S.A.S
              </span>
            </div>
            <span className="text-[11px] text-slate-400 font-medium truncate max-w-[140px]">
              Coopidrogas Bello
            </span>
          </div>
        </div>

        {/* Botón de cierre en móvil */}
        <button
          onClick={() => setIsMobileOpen(false)}
          className="lg:hidden p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          title="Cerrar menú"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* 2. Badge de Rol Activo */}
      <div className="px-4 py-3 bg-slate-950/40 border-b border-slate-800/60 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {userRole === 'admin' ? (
            <div className="p-1 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <ShieldCheck className="w-3.5 h-3.5" />
            </div>
          ) : (
            <div className="p-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <UserCheck className="w-3.5 h-3.5" />
            </div>
          )}
          <div className="flex flex-col text-left">
            <span className="text-[10px] uppercase font-mono font-bold text-slate-400 tracking-wider">
              {userRole === 'admin' ? 'Coordinación' : 'Personal Operativo'}
            </span>
            <span className="text-xs font-semibold text-white truncate max-w-[130px]">
              {userRole === 'admin' ? 'Administrador' : loggedAuxiliarName.split(' ')[0]}
            </span>
          </div>
        </div>

        {/* Estado Supabase */}
        <div
          className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-800/80 border border-slate-700/60 text-[10px] font-medium"
          title={isOnline ? 'Supabase conectado en vivo' : 'Modo local sin conexión'}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
          <span className="text-slate-300 text-[9px] font-mono">{isOnline ? 'Cloud' : 'Local'}</span>
        </div>
      </div>

      {/* 3. Navegación Principal */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">
          Navegación
        </div>

        {currentNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => {
                setActiveTab(item.id);
                setIsMobileOpen(false);
              }}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all group relative cursor-pointer ${
                isActive
                  ? 'bg-indigo-600 text-white font-semibold shadow-md shadow-indigo-900/30'
                  : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon
                  className={`w-4 h-4 transition-transform group-hover:scale-110 ${
                    isActive ? 'text-white' : 'text-slate-400 group-hover:text-indigo-300'
                  }`}
                />
                <span className="tracking-wide text-left">{item.label}</span>
              </div>

              <div className="flex items-center gap-1.5">
                {item.badge !== undefined && (
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full font-mono ${
                      item.badgeColor || (isActive ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-300 border border-slate-700')
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
                {isActive && <ChevronRight className="w-3.5 h-3.5 text-white/80" />}
              </div>
            </button>
          );
        })}
      </div>

      {/* 4. Pie del Sidebar: Privacidad, Perfil & Desconexión */}
      <div className="p-3 border-t border-slate-800 bg-slate-950/30 space-y-2">
        {onOpenPrivacy && (
          <button
            onClick={onOpenPrivacy}
            className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-[11px] text-slate-400 hover:text-indigo-300 hover:bg-slate-800/60 transition-all cursor-pointer group"
          >
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-3.5 h-3.5 text-slate-500 group-hover:text-indigo-400" />
              <span>Políticas de Privacidad</span>
            </div>
            <span className="text-[9px] font-mono text-slate-500 group-hover:text-indigo-300">Habeas Data</span>
          </button>
        )}

        <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-slate-800/40 border border-slate-800">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-indigo-600/30 border border-indigo-500/40 text-indigo-300 flex items-center justify-center text-xs font-bold font-mono shrink-0">
              {getInitials(userRole === 'admin' ? 'ADMIN' : loggedAuxiliarName)}
            </div>
            <div className="flex flex-col min-w-0 text-left">
              <span className="text-xs font-bold text-white truncate">
                {userRole === 'admin' ? 'Coordinador' : loggedAuxiliarName}
              </span>
              <span className="text-[10px] text-slate-400 truncate">
                {userRole === 'admin' ? 'Gestión Central' : 'Auxiliar de Ruta'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {onOpenChangePin && (
              <button
                onClick={onOpenChangePin}
                title={userRole === 'admin' ? "Cambiar clave de administrador" : "Cambiar mi PIN"}
                className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 rounded-lg transition-colors cursor-pointer"
              >
                <Key className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onClick={onLogout}
              title="Cerrar sesión de forma segura"
              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* SIDEBAR DESKTOP (FIJO A LA IZQUIERDA) */}
      <aside className="hidden lg:block w-64 shrink-0 h-screen sticky top-0 z-30">
        {navContent}
      </aside>

      {/* SIDEBAR MÓVIL (DRAWER DESLIZABLE) */}
      <AnimatePresence>
        {isMobileOpen && (
          <div className="fixed inset-0 z-50 lg:hidden flex">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-xs"
              onClick={() => setIsMobileOpen(false)}
            />

            {/* Panel */}
            <motion.div
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: 'spring', damping: 25, stiffness: 280 }}
              className="relative w-72 max-w-[85vw] h-full shadow-2xl z-10"
            >
              {navContent}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};
