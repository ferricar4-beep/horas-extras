import React, { useState } from 'react';
import {
  Settings,
  Sliders,
  Webhook,
  Shield,
  Key,
  Database,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Clock,
  Sparkles
} from 'lucide-react';
import { AlertsConfig } from './AlertsConfig';
import { safeLocalStorage } from '../utils';

interface ConfiguracionViewProps {
  adminPin: string;
  onUpdateAdminPin: (newPin: string) => void;
  isOnline: boolean;
  onVerificarConexion: () => Promise<boolean>;
  totalRegistrosCount: number;
}

export const ConfiguracionView: React.FC<ConfiguracionViewProps> = ({
  adminPin,
  onUpdateAdminPin,
  isOnline,
  onVerificarConexion,
  totalRegistrosCount,
}) => {
  const [subTab, setSubTab] = useState<'parametros' | 'integraciones' | 'seguridad'>('parametros');

  // Parámetros laborales
  const [jornadaBase, setJornadaBase] = useState<number>(() => {
    return Number(safeLocalStorage.getItem('ferricar_jornada_base') || '7');
  });
  const [umbralFatiga, setUmbralFatiga] = useState<number>(() => {
    return Number(safeLocalStorage.getItem('ferricar_overtime_threshold') || '10');
  });
  const [paramSaved, setParamSaved] = useState(false);

  // Cambio de PIN de Admin
  const [nuevoPinAdmin, setNuevoPinAdmin] = useState('');
  const [pinAdminError, setPinAdminError] = useState('');
  const [pinAdminSuccess, setPinAdminSuccess] = useState(false);

  // Verificación de conexión
  const [verificando, setVerificando] = useState(false);
  const [resultadoVerif, setResultadoVerif] = useState<string | null>(null);

  const guardarParametros = (e: React.FormEvent) => {
    e.preventDefault();
    safeLocalStorage.setItem('ferricar_jornada_base', String(jornadaBase));
    safeLocalStorage.setItem('ferricar_overtime_threshold', String(umbralFatiga));
    setParamSaved(true);
    setTimeout(() => setParamSaved(false), 3000);
  };

  const guardarPinAdmin = (e: React.FormEvent) => {
    e.preventDefault();
    setPinAdminError('');
    setPinAdminSuccess(false);

    if (!/^\d{4}$/.test(nuevoPinAdmin.trim())) {
      setPinAdminError('El PIN del Administrador debe contener exactamente 4 números.');
      return;
    }

    onUpdateAdminPin(nuevoPinAdmin.trim());
    setNuevoPinAdmin('');
    setPinAdminSuccess(true);
    setTimeout(() => setPinAdminSuccess(false), 3000);
  };

  const handleTestConnection = async () => {
    setVerificando(true);
    setResultadoVerif(null);
    const ok = await onVerificarConexion();
    setVerificando(false);
    setResultadoVerif(ok ? 'Conexión con Supabase verificada exitosamente (Latencia normal).' : 'Fallo al comunicarse con Supabase.');
  };

  return (
    <div className="space-y-6 text-left">
      {/* 1. Header de Configuración */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100">
              <Settings className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-lg font-display font-bold text-slate-900 tracking-tight">
                Configuración del Sistema
              </h2>
              <p className="text-xs text-slate-500">
                Ajustes laborales, webhooks de n8n en Railway y seguridad de acceso.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Sub-navegación limpia */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setSubTab('parametros')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-2 ${
            subTab === 'parametros'
              ? 'bg-indigo-600 text-white shadow-2xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span>Parámetros Laborales</span>
        </button>

        <button
          onClick={() => setSubTab('integraciones')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-2 ${
            subTab === 'integraciones'
              ? 'bg-indigo-600 text-white shadow-2xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Webhook className="w-4 h-4" />
          <span>Integraciones (n8n Webhook)</span>
        </button>

        <button
          onClick={() => setSubTab('seguridad')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-2 ${
            subTab === 'seguridad'
              ? 'bg-indigo-600 text-white shadow-2xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Shield className="w-4 h-4" />
          <span>Seguridad & Base de Datos</span>
        </button>
      </div>

      {/* 3. Contenido de la Sub-pestaña Activa */}
      {subTab === 'parametros' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-2xs max-w-2xl space-y-6">
          <div>
            <h3 className="font-display font-bold text-sm text-slate-900">Reglas de Cálculo Laboral</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Define las bases para el cálculo automático de horas extras y límites operacionales.
            </p>
          </div>

          <form onSubmit={guardarParametros} className="space-y-4">
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Jornada Ordinaria Diaria (Horas)
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min={6}
                  max={10}
                  step={0.5}
                  value={jornadaBase}
                  onChange={(e) => setJornadaBase(Number(e.target.value))}
                  className="w-32 text-xs font-mono font-bold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800"
                />
                <span className="text-xs text-slate-500">
                  Base estándar: <strong>7 horas</strong> (Reducción gradual jornada laboral Colombia).
                </span>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Umbral de Alerta Semanal (Horas Extras)
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min={5}
                  max={30}
                  value={umbralFatiga}
                  onChange={(e) => setUmbralFatiga(Number(e.target.value))}
                  className="w-32 text-xs font-mono font-bold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800"
                />
                <span className="text-xs text-slate-500">
                  Dispara alertas preventivas si un auxiliar acumula más de este valor en la semana.
                </span>
              </div>
            </div>

            {paramSaved && (
              <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 p-3 rounded-xl flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Parámetros guardados y aplicados a los cálculos del sistema.</span>
              </div>
            )}

            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs cursor-pointer"
            >
              Guardar Parámetros
            </button>
          </form>
        </div>
      )}

      {subTab === 'integraciones' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
            <h3 className="font-display font-bold text-sm text-slate-900">
              Conexión de Webhook con n8n
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Notificaciones y automatizaciones despachadas automáticamente hacia tu servidor de n8n.
            </p>
          </div>

          <AlertsConfig />
        </div>
      )}

      {subTab === 'seguridad' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Panel 1: PIN de Administrador */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-2xs space-y-4">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
                <Key className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-display font-bold text-sm text-slate-900">PIN Maestro de Coordinación</h3>
                <p className="text-[11px] text-slate-500">Clave de 4 dígitos para ingresar como Administrador</p>
              </div>
            </div>

            <form onSubmit={guardarPinAdmin} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Nuevo PIN de Administrador
                </label>
                <input
                  type="text"
                  maxLength={4}
                  required
                  placeholder="Ej: 9999"
                  value={nuevoPinAdmin}
                  onChange={(e) => setNuevoPinAdmin(e.target.value.replace(/\D/g, ''))}
                  className="w-full text-xs font-mono font-bold text-center tracking-widest bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              {pinAdminError && (
                <div className="text-xs text-rose-600 bg-rose-50 border border-rose-200 p-2.5 rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{pinAdminError}</span>
                </div>
              )}

              {pinAdminSuccess && (
                <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 p-2.5 rounded-xl flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>PIN de Administrador actualizado con éxito.</span>
                </div>
              )}

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold cursor-pointer shadow-xs"
              >
                Actualizar PIN de Administrador
              </button>
            </form>
          </div>

          {/* Panel 2: Estado de Supabase */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-2xs space-y-4">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                <Database className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-display font-bold text-sm text-slate-900">Estado de la Base de Datos</h3>
                <p className="text-[11px] text-slate-500">Conexión en la nube con Supabase PostgreSQL</p>
              </div>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-150 flex items-center justify-between">
                <span className="text-slate-600 font-medium">Estado de Conexión:</span>
                <span className={`font-bold flex items-center gap-1.5 ${isOnline ? 'text-emerald-600' : 'text-amber-600'}`}>
                  <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                  {isOnline ? 'En línea (Supabase Conectado)' : 'Modo Local'}
                </span>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-150 flex items-center justify-between">
                <span className="text-slate-600 font-medium">Registros Históricos Cargados:</span>
                <span className="font-mono font-bold text-slate-900">{totalRegistrosCount} turnos</span>
              </div>
            </div>

            {resultadoVerif && (
              <div className="text-xs p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 font-medium">
                {resultadoVerif}
              </div>
            )}

            <button
              onClick={handleTestConnection}
              disabled={verificando}
              className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${verificando ? 'animate-spin' : ''}`} />
              <span>{verificando ? 'Comprobando respuesta...' : 'Verificar Latencia con Supabase'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
