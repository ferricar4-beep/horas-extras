/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Clock,
  Calendar,
  Users,
  AlertTriangle,
  RotateCcw,
  Download,
  Key,
  ShieldCheck,
  UserCheck,
  X,
  TrendingUp,
  Unlock,
  CheckCircle2,
  Truck,
  Radio,
  LockKeyhole,
  Eye,
  EyeOff,
  ArrowRight
} from 'lucide-react';

import { Registro, AuxiliarStats, PeriodoFiltro, NavTab, CargoTipo, JustificacionDia } from './types';
import {
  filtrarPorPeriodo,
  getSemanaAno,
  formatoNombreCapital,
  obtenerNombreCorto,
  normalizarNombre,
  parseFecha,
  calcularDiasLaborablesEsperados,
  esNoLaborable,
  esTurnoNocturno,
  safeLocalStorage,
  calcularJornada,
  calcularHorasExtra,
  toMins,
  sincronizarJustificacionesDesdeNube,
  obtenerJustificacionesStorage
} from './utils';

// Importar componentes de la nueva arquitectura UX/UI
import { Sidebar } from './components/Sidebar';
import { TopHeader } from './components/TopHeader';
import { DashboardView } from './components/DashboardView';
import { AuxiliaresView } from './components/AuxiliaresView';
import { JornadasView } from './components/JornadasView';
import { CalendarView } from './components/CalendarView';
import { ReportesView } from './components/ReportesView';
import { AlertasView } from './components/AlertasView';
import { ConfiguracionView } from './components/ConfiguracionView';
import { PrivacyModal } from './components/PrivacyModal';
import { ErrorBoundary } from './components/ErrorBoundary';

import {
  obtenerRegistros,
  insertarRegistro,
  eliminarRegistro,
  verificarConexion,
  RegistroSupabase,
  CredencialSupabase,
  obtenerCredenciales,
  guardarCredencial,
  eliminarCredencial,
  eliminarRegistrosDeAuxiliar,
  actualizarRegistro,
  eliminarJustificacionesDeAuxiliar,
  guardarJustificacion,
  obtenerAppConfig,
  guardarAppConfig
} from './supabase';

const FALLBACK_REGISTROS: Registro[] = [
  {
    id: 'f1',
    marcaTemporal: '16/02/2026 18:32:10',
    auxiliar: 'AUXILIAR DE PRUEBA UNO',
    vehiculo: 'VEH123',
    fecha: '16/02/2026',
    horaIngreso: '6:00:00',
    horaSalida: '15:00:00',
    ruta: 'RUTA EJEMPLO A',
    jornada: 9,
    horasExtras: 2,
    originalRow: {}
  },
  {
    id: 'f2',
    marcaTemporal: '16/02/2026 18:34:20',
    auxiliar: 'AUXILIAR DE PRUEBA DOS',
    vehiculo: 'VEH123',
    fecha: '16/02/2026',
    horaIngreso: '22:00:00',
    horaSalida: '6:00:00',
    ruta: 'RUTA NOCTURNA EJEMPLO',
    jornada: 8,
    horasExtras: 1,
    esNocturno: true,
    originalRow: {}
  }
];

// Directorio de PINs: inicializar y devolver directorio de PINs
const getPinsDirectory = (auxiliares: string[]): Record<string, string> => {
  const stored = safeLocalStorage.getItem('ferricar_user_pins');
  let pins: Record<string, string> = {};
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        pins = parsed;
      }
    } catch (e) {
      pins = {};
    }
  }
  // Garantizar que 'ADMIN' y 'admin' tienen PIN
  if (!pins['ADMIN'] && !pins['admin']) {
    pins['ADMIN'] = '9988';
    pins['admin'] = '9988';
  } else if (!pins['ADMIN']) {
    pins['ADMIN'] = pins['admin'];
  } else if (!pins['admin']) {
    pins['admin'] = pins['ADMIN'];
  }
  // Garantizar que cada auxiliar tiene PIN por defecto '1234'
  let changed = false;
  auxiliares.forEach(aux => {
    if (aux && typeof aux === 'string') {
      const cleanAux = aux.trim().toUpperCase();
      if (cleanAux && cleanAux !== 'ADMIN' && cleanAux !== 'admin' && !pins[cleanAux]) {
        pins[cleanAux] = '1234';
        changed = true;
      }
    }
  });
  if (changed || !stored) {
    safeLocalStorage.setItem('ferricar_user_pins', JSON.stringify(pins));
  }
  return pins;
};

export default function App() {
  // Navegación principal de la nueva arquitectura UX/UI
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [busquedaGlobal, setBusquedaGlobal] = useState('');
  const [selectedAuxiliarForDetail, setSelectedAuxiliarForDetail] = useState<string | null>(null);

  // ID del último registro agregado para micro-animaciones
  const [justAddedId, setJustAddedId] = useState<string | null>(null);

  // Datos globales de turnos (cargados desde Supabase)
  const [sheetRegistros, setSheetRegistros] = useState<Registro[]>([]);
  
  // Registros manuales del usuario guardados localmente
  const [manualRegistros, setManualRegistros] = useState<Registro[]>(() => {
    const stored = safeLocalStorage.getItem('ferricar_manual_registros');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {
        console.error('Error al cargar registros manuales de localStorage:', e);
      }
    }
    return [];
  });

  // Combinación en tiempo real de ambos orígenes de datos sin duplicados y ordenados desc
  const registros = useMemo(() => {
    const seenIds = new Set<string>();
    const seenBusinessKeys = new Set<string>();
    const unique: Registro[] = [];

    // Priorizar registros oficiales provenientes de Supabase
    sheetRegistros.forEach(r => {
      if (!r || !r.auxiliar || !r.fecha) return;
      if (r.id && seenIds.has(r.id)) return;
      
      const normAux = normalizarNombre(r.auxiliar);
      const bKey = `${normAux}|${r.fecha.trim()}|${(r.horaIngreso || '').trim()}|${(r.horaSalida || '').trim()}|${(r.vehiculo || '').trim().toUpperCase()}`;
      if (seenBusinessKeys.has(bKey)) return;

      if (r.id) seenIds.add(r.id);
      seenBusinessKeys.add(bKey);
      unique.push(r);
    });

    // Añadir registros locales de contingencia que no existan ya en Supabase
    manualRegistros.forEach(r => {
      if (!r || !r.auxiliar || !r.fecha) return;
      if (r.id && seenIds.has(r.id)) return;

      const normAux = normalizarNombre(r.auxiliar);
      const bKey = `${normAux}|${r.fecha.trim()}|${(r.horaIngreso || '').trim()}|${(r.horaSalida || '').trim()}|${(r.vehiculo || '').trim().toUpperCase()}`;
      if (seenBusinessKeys.has(bKey)) return;

      // Verificar si ya existe un registro para este auxiliar en la misma fecha con el mismo vehículo
      const yaExisteEnSheet = unique.some(
        u => normalizarNombre(u.auxiliar) === normAux &&
             u.fecha.trim() === r.fecha.trim() &&
             (u.vehiculo || '').trim().toUpperCase() === (r.vehiculo || '').trim().toUpperCase()
      );
      if (yaExisteEnSheet) return;

      if (r.id) seenIds.add(r.id);
      seenBusinessKeys.add(bKey);
      unique.push(r);
    });

    return unique.sort((a, b) => {
      const dateA = parseFecha(a.fecha)?.getTime() ?? 0;
      const dateB = parseFecha(b.fecha)?.getTime() ?? 0;
      if (dateB !== dateA) {
        return dateB - dateA;
      }
      const minsA = toMins(a.horaIngreso);
      const minsB = toMins(b.horaIngreso);
      if (minsB !== minsA) {
        return minsB - minsA;
      }
      return (b.id || '').localeCompare(a.id || '');
    });
  }, [manualRegistros, sheetRegistros]);

  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [cargando, setCargando] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [origenData, setOrigenData] = useState<'sheet' | 'local' | 'supabase'>('local');
  const [supabaseConectado, setSupabaseConectado] = useState<boolean>(false);
  const syncingQueueRef = React.useRef<boolean>(false);

  // Filtros globales
  const [filtroPeriodo, setFiltroPeriodo] = useState<PeriodoFiltro>('ultimos_15_dias');
  const [fechaInicioCustom, setFechaInicioCustom] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 15);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  });
  const [fechaFinCustom, setFechaFinCustom] = useState<string>(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  });
  const [filtroMes, setFiltroMes] = useState<number>(() => new Date().getMonth());
  const [filtroAno, setFiltroAno] = useState<number>(() => new Date().getFullYear());
  const [filtroAuxiliar, setFiltroAuxiliar] = useState<string>('');

  // Autenticación y Control de Acceso
  const [userRole, setUserRole] = useState<'admin' | 'auxiliar' | null>(() => {
    const stored = safeLocalStorage.getItem('ferricar_user_role');
    return (stored as 'admin' | 'auxiliar' | null) || null;
  });
  const [loggedAuxiliarName, setLoggedAuxiliarName] = useState<string>(() => {
    return safeLocalStorage.getItem('ferricar_logged_auxiliar') || '';
  });

  // Auto-dismiss toast
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => {
        setToastMessage(null);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  const [pinsMap, setPinsMap] = useState<Record<string, string>>({});

  // Lista de auxiliares con credencial en Supabase (caché offline desde ferricar_user_pins)
  const [credencialesAuxiliares, setCredencialesAuxiliares] = useState<string[]>(() => {
    const storedPins = safeLocalStorage.getItem('ferricar_user_pins');
    if (storedPins) {
      try {
        const parsed = JSON.parse(storedPins);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          return Object.keys(parsed)
            .map(k => normalizarNombre(k))
            .filter(k => k && k !== 'ADMIN');
        }
      } catch {
        return [];
      }
    }
    return [];
  });

  // Cargos de auxiliares (sincronizado con Supabase, caché en localStorage)
  const [auxiliarCargos, setAuxiliarCargos] = useState<Record<string, string>>(() => {
    const stored = safeLocalStorage.getItem('ferricar_auxiliar_cargos');
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {
        return {};
      }
    }
    return {};
  });

  // Configuración global de la app (sincronizada con app_config en Supabase)
  const [appConfig, setAppConfig] = useState<Record<string, string>>(() => ({
    jornada_base: safeLocalStorage.getItem('ferricar_jornada_base') || '7',
    overtime_threshold: safeLocalStorage.getItem('ferricar_overtime_threshold') || '10',
    webhook_url: safeLocalStorage.getItem('ferricar_webhook_url') || 'https://n8n.ferricar.com.co/webhook-test/67f7da3c-1a22-44f2-9ad2-921d26c59b2d',
    notif_email: safeLocalStorage.getItem('ferricar_notif_email') || 'juan.ruiz@mct.com.co',
  }));

  // Snapshot previo a sincronización para migración única al iniciar como admin
  const preSyncLocalRef = React.useRef<{
    cargos: Record<string, string>;
    customAux: string[];
    pins: Record<string, string>;
    justificaciones: Record<string, Record<string, JustificacionDia>>;
    config: Partial<Record<'jornada_base' | 'overtime_threshold' | 'webhook_url' | 'notif_email', string>>;
  } | null>(null);

  if (preSyncLocalRef.current === null && safeLocalStorage.getItem('ferricar_migracion_v1_done') !== 'true') {
    let cargosInit: Record<string, string> = {};
    try {
      const rawC = safeLocalStorage.getItem('ferricar_auxiliar_cargos');
      if (rawC) cargosInit = JSON.parse(rawC) || {};
    } catch { cargosInit = {}; }

    let customInit: string[] = [];
    try {
      const rawCust = safeLocalStorage.getItem('ferricar_custom_auxiliares');
      if (rawCust) {
        const parsed = JSON.parse(rawCust);
        if (Array.isArray(parsed)) customInit = parsed.map(x => normalizarNombre(String(x))).filter(Boolean);
      }
    } catch { customInit = []; }

    let pinsInit: Record<string, string> = {};
    try {
      const rawP = safeLocalStorage.getItem('ferricar_user_pins');
      if (rawP) pinsInit = JSON.parse(rawP) || {};
    } catch { pinsInit = {}; }

    const justifInit = obtenerJustificacionesStorage();
    const configInit: Partial<Record<'jornada_base' | 'overtime_threshold' | 'webhook_url' | 'notif_email', string>> = {};
    const jb = safeLocalStorage.getItem('ferricar_jornada_base');
    if (jb !== null && jb.trim() !== '') configInit.jornada_base = jb;
    const ot = safeLocalStorage.getItem('ferricar_overtime_threshold');
    if (ot !== null && ot.trim() !== '') configInit.overtime_threshold = ot;
    const wu = safeLocalStorage.getItem('ferricar_webhook_url');
    if (wu !== null && wu.trim() !== '') configInit.webhook_url = wu;
    const ne = safeLocalStorage.getItem('ferricar_notif_email');
    if (ne !== null && ne.trim() !== '') configInit.notif_email = ne;

    preSyncLocalRef.current = {
      cargos: cargosInit,
      customAux: customInit,
      pins: pinsInit,
      justificaciones: justifInit,
      config: configInit,
    };
  }

  const cloudSnapshotRef = React.useRef<{
    creds: CredencialSupabase[];
    justifMap: Record<string, Record<string, JustificacionDia>>;
    appConfig: Record<string, string>;
  } | null>(null);
  const [cloudSyncTick, setCloudSyncTick] = useState(0);
  const migratingRef = React.useRef(false);

  const obtenerCargoDisplay = (name: string): string => {
    if (!name) return 'Auxiliar de Carga';
    const cargo = auxiliarCargos[normalizarNombre(name)];
    if (cargo === 'escolta') return 'Escolta';
    if (cargo === 'auxiliar_operaciones') return 'Auxiliar de Operaciones';
    return 'Auxiliar de Carga';
  };

  // Modales
  const [editingRegistro, setEditingRegistro] = useState<Registro | null>(null);
  const [isPrivacyModalOpen, setIsPrivacyModalOpen] = useState<boolean>(false);
  const [isChangingOwnPin, setIsChangingOwnPin] = useState(false);
  const [currentOwnPin, setCurrentOwnPin] = useState('');
  const [newOwnPin, setNewOwnPin] = useState('');
  const [confirmOwnPin, setConfirmOwnPin] = useState('');
  const [ownPinError, setOwnPinError] = useState('');
  const [ownPinSuccess, setOwnPinSuccess] = useState('');

  // Login
  const [inputPin, setInputPin] = useState<string>('');
  const [showPin, setShowPin] = useState<boolean>(false);
  const [loginError, setLoginError] = useState<string>('');
  const [matchingAuxiliares, setMatchingAuxiliares] = useState<string[]>([]);
  const [isWelcoming, setIsWelcoming] = useState<boolean>(false);
  const [welcomingUser, setWelcomingUser] = useState<{ role: 'admin' | 'auxiliar'; name: string } | null>(null);
  const [isBrowserOnline, setIsBrowserOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [loginBgError, setLoginBgError] = useState<boolean>(false);

  const triggerLoginSuccess = (role: 'admin' | 'auxiliar', name: string) => {
    setIsWelcoming(true);
    setWelcomingUser({ role, name });
    safeLocalStorage.setItem('ferricar_user_role', role);
    if (role === 'auxiliar') {
      safeLocalStorage.setItem('ferricar_logged_auxiliar', name);
    } else {
      safeLocalStorage.removeItem('ferricar_logged_auxiliar');
    }

    setTimeout(() => {
      setUserRole(role);
      setLoggedAuxiliarName(name);
      setIsWelcoming(false);
      setWelcomingUser(null);
    }, 2200);
  };

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setMatchingAuxiliares([]);

    const cleanPin = inputPin.trim();
    if (!cleanPin) {
      setLoginError('Por favor ingresa tu código PIN de acceso.');
      return;
    }

    const correctAdminPin = pinsMap['ADMIN'] || pinsMap['admin'] || '9988';
    if (cleanPin === correctAdminPin) {
      triggerLoginSuccess('admin', '');
      return;
    }

    const matches = Object.entries(pinsMap)
      .filter(([name, pin]) => name !== 'admin' && name !== 'ADMIN' && pin === cleanPin)
      .map(([name]) => name);

    if (matches.length === 0) {
      setLoginError('El código PIN ingresado no coincide con ningún usuario en el sistema.');
    } else if (matches.length === 1) {
      const matchedAux = matches[0];
      triggerLoginSuccess('auxiliar', matchedAux);
    } else {
      setMatchingAuxiliares(matches);
    }
  };

  const handleConfirmSelectAuxiliar = (name: string) => {
    triggerLoginSuccess('auxiliar', name);
    setMatchingAuxiliares([]);
  };

  const handleLogout = () => {
    setUserRole(null);
    setLoggedAuxiliarName('');
    safeLocalStorage.removeItem('ferricar_user_role');
    safeLocalStorage.removeItem('ferricar_logged_auxiliar');
    setFiltroAuxiliar('');
    setActiveTab('dashboard');
    setInputPin('');
    setLoginError('');
    setMatchingAuxiliares([]);
  };

  const buildBusinessKey = (r: { auxiliar?: string; fecha?: string; horaIngreso?: string; horaSalida?: string; vehiculo?: string }) => {
    const normAux = normalizarNombre(r.auxiliar || '');
    return `${normAux}|${(r.fecha || '').trim()}|${(r.horaIngreso || '').trim()}|${(r.horaSalida || '').trim()}|${(r.vehiculo || '').trim().toUpperCase()}`;
  };

  const mapSupabaseRegistros = (regs: RegistroSupabase[]): Registro[] =>
    regs.map(r => ({
      id: r.id || '',
      marcaTemporal: r.marca_temporal || '',
      auxiliar: r.auxiliar,
      vehiculo: r.vehiculo,
      fecha: r.fecha,
      horaIngreso: r.hora_ingreso,
      horaSalida: r.hora_salida,
      ruta: r.ruta,
      jornada: r.jornada,
      horasExtras: r.horas_extras,
      esNocturno: r.es_nocturno,
      originalRow: {}
    }));

  // Sincronización de la cola offline ('ferricar_manual_registros') hacia Supabase
  const sincronizarColaOffline = async (registrosNube: Registro[]): Promise<number> => {
    if (syncingQueueRef.current) return 0;
    syncingQueueRef.current = true;
    try {
      const rawQueue = safeLocalStorage.getItem('ferricar_manual_registros');
      if (!rawQueue) return 0;

      let queue: Registro[] = [];
      try {
        const parsed = JSON.parse(rawQueue);
        if (Array.isArray(parsed)) queue = parsed;
      } catch {
        return 0;
      }

      if (queue.length === 0) return 0;

      const existingKeys = new Set<string>(registrosNube.map(buildBusinessKey));
      const remaining: Registro[] = [];
      let syncedCount = 0;

      for (const item of queue) {
        if (!item || !item.auxiliar || !item.fecha) continue;
        const bKey = buildBusinessKey(item);

        // Si ya existe en Supabase por llave de negocio, retirarlo de la cola sin duplicar
        if (existingKeys.has(bKey)) {
          continue;
        }

        const regSupa: RegistroSupabase = {
          auxiliar: item.auxiliar.trim().toUpperCase(),
          vehiculo: (item.vehiculo || 'N/A').trim().toUpperCase(),
          fecha: item.fecha.trim(),
          hora_ingreso: item.horaIngreso,
          hora_salida: item.horaSalida,
          ruta: (item.ruta || 'N/A').trim().toUpperCase(),
          jornada: item.jornada,
          horas_extras: item.horasExtras,
          es_nocturno: item.esNocturno || false,
          origen: 'manual',
        };

        const guardado = await insertarRegistro(regSupa);
        if (guardado) {
          syncedCount++;
          existingKeys.add(bKey);
        } else {
          remaining.push(item);
        }
      }

      setManualRegistros(remaining);
      safeLocalStorage.setItem('ferricar_manual_registros', JSON.stringify(remaining));

      if (syncedCount > 0) {
        try {
          const updatedCloud = await obtenerRegistros();
          setSheetRegistros(mapSupabaseRegistros(updatedCloud));
        } catch {
          // Si falla la recarga inmediata, ya quedaron en Supabase y se reflejarán en el próximo sync
        }
        setToastMessage({
          text: `${syncedCount} turnos pendientes sincronizados`,
          type: 'success',
        });
      }

      return syncedCount;
    } finally {
      syncingQueueRef.current = false;
    }
  };

  // Carga inicial y sincronización
  const sincronizarDatos = async () => {
    setCargando(true);
    try {
      const conectado = await verificarConexion();
      setSupabaseConectado(conectado);

      if (conectado) {
        const [regs, creds, cloudConfig, cloudJustifMap] = await Promise.all([
          obtenerRegistros(),
          obtenerCredenciales(),
          obtenerAppConfig(),
          sincronizarJustificacionesDesdeNube(),
        ]);

        const convertidos = mapSupabaseRegistros(regs);
        setSheetRegistros(convertidos);
        setOrigenData('supabase');
        setLoadError(null);

        // Cargar credenciales y cargos desde Supabase
        const dbPins: Record<string, string> = {};
        const dbCargos: Record<string, string> = {};
        const credsAuxList: string[] = [];

        if (Array.isArray(creds)) {
          creds.forEach(c => {
            if (!c.auxiliar) return;
            const cleanA = normalizarNombre(c.auxiliar);
            if (c.pin) {
              dbPins[cleanA] = c.pin;
              if (cleanA === 'ADMIN') {
                dbPins['admin'] = c.pin;
              }
            }
            if (cleanA !== 'ADMIN') {
              credsAuxList.push(cleanA);
              if (c.cargo && c.cargo.trim()) {
                dbCargos[cleanA] = c.cargo.trim();
              }
            }
          });
        }

        const localPins = getPinsDirectory([]);
        const mergedPins = { ...localPins, ...dbPins };
        setPinsMap(mergedPins);
        safeLocalStorage.setItem('ferricar_user_pins', JSON.stringify(mergedPins));

        // Actualizar lista de auxiliares sin turnos derivada de auxiliares_credenciales
        setCredencialesAuxiliares(Array.from(new Set(credsAuxList)));

        // Actualizar mapa de cargos con Supabase como fuente de verdad (manteniendo caché local si nube aún no tiene cargo)
        let localCargosCache: Record<string, string> = {};
        try {
          const rawCargos = safeLocalStorage.getItem('ferricar_auxiliar_cargos');
          if (rawCargos) localCargosCache = JSON.parse(rawCargos) || {};
        } catch { localCargosCache = {}; }
        const mergedCargos = { ...localCargosCache, ...dbCargos };
        setAuxiliarCargos(mergedCargos);
        safeLocalStorage.setItem('ferricar_auxiliar_cargos', JSON.stringify(mergedCargos));

        // Sincronizar app_config desde Supabase y espejar en localStorage para lecturas síncronas
        const nextConfig: Record<string, string> = {
          jornada_base: cloudConfig.jornada_base ?? safeLocalStorage.getItem('ferricar_jornada_base') ?? '7',
          overtime_threshold: cloudConfig.overtime_threshold ?? safeLocalStorage.getItem('ferricar_overtime_threshold') ?? '10',
          webhook_url: cloudConfig.webhook_url ?? safeLocalStorage.getItem('ferricar_webhook_url') ?? 'https://n8n.ferricar.com.co/webhook-test/67f7da3c-1a22-44f2-9ad2-921d26c59b2d',
          notif_email: cloudConfig.notif_email ?? safeLocalStorage.getItem('ferricar_notif_email') ?? 'juan.ruiz@mct.com.co',
        };
        if (cloudConfig.jornada_base !== undefined) safeLocalStorage.setItem('ferricar_jornada_base', cloudConfig.jornada_base);
        if (cloudConfig.overtime_threshold !== undefined) safeLocalStorage.setItem('ferricar_overtime_threshold', cloudConfig.overtime_threshold);
        if (cloudConfig.webhook_url !== undefined) safeLocalStorage.setItem('ferricar_webhook_url', cloudConfig.webhook_url);
        if (cloudConfig.notif_email !== undefined) safeLocalStorage.setItem('ferricar_notif_email', cloudConfig.notif_email);
        setAppConfig(nextConfig);

        cloudSnapshotRef.current = {
          creds: Array.isArray(creds) ? creds : [],
          justifMap: cloudJustifMap || {},
          appConfig: cloudConfig || {},
        };
        setCloudSyncTick(t => t + 1);

        // Intentar subir registros pendientes de la cola offline
        await sincronizarColaOffline(convertidos);
      } else {
        setOrigenData('local');
        setLoadError('No se pudieron cargar los datos desde Supabase');
        setToastMessage({
          text: 'No se pudieron cargar los datos desde Supabase',
          type: 'error',
        });
      }
    } catch (e) {
      console.error('Error al sincronizar con Supabase:', e);
      setSupabaseConectado(false);
      setOrigenData('local');
      setLoadError('No se pudieron cargar los datos desde Supabase');
      setToastMessage({
        text: 'No se pudieron cargar los datos desde Supabase',
        type: 'error',
      });
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    sincronizarDatos();

    const handleOnline = () => {
      setIsBrowserOnline(true);
      sincronizarDatos();
    };
    const handleOffline = () => {
      setIsBrowserOnline(false);
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Migración única al iniciar sesión como admin: sube datos locales faltantes sin sobrescribir la nube
  useEffect(() => {
    if (userRole !== 'admin') return;
    if (!cloudSnapshotRef.current) return;
    if (safeLocalStorage.getItem('ferricar_migracion_v1_done') === 'true') return;
    if (migratingRef.current) return;

    const snapshotLocal = preSyncLocalRef.current;
    if (!snapshotLocal) {
      safeLocalStorage.setItem('ferricar_migracion_v1_done', 'true');
      return;
    }

    const runMigration = async () => {
      migratingRef.current = true;
      try {
        const cloud = cloudSnapshotRef.current;
        if (!cloud) return;

        let migratedCount = 0;
        let hadError = false;

        // 1. Migrar auxiliares sin turnos y cargos faltantes en auxiliares_credenciales
        const cloudCredsByAux: Record<string, CredencialSupabase> = {};
        cloud.creds.forEach(c => {
          if (c.auxiliar) {
            cloudCredsByAux[normalizarNombre(c.auxiliar)] = c;
          }
        });

        const candidateAuxSet = new Set<string>([
          ...snapshotLocal.customAux.map(a => normalizarNombre(a)),
          ...Object.keys(snapshotLocal.cargos).map(a => normalizarNombre(a)),
        ]);

        for (const cleanAux of candidateAuxSet) {
          if (!cleanAux || cleanAux === 'ADMIN') continue;
          const cloudCred = cloudCredsByAux[cleanAux];
          const localCargo = snapshotLocal.cargos[cleanAux] || '';
          const localPin = snapshotLocal.pins[cleanAux] || '1234';

          if (!cloudCred) {
            const ok = await guardarCredencial(cleanAux, localPin, localCargo || 'auxiliar_carga');
            if (ok) migratedCount++;
            else hadError = true;
          } else if ((!cloudCred.cargo || !cloudCred.cargo.trim()) && localCargo) {
            const ok = await guardarCredencial(cleanAux, undefined, localCargo);
            if (ok) migratedCount++;
            else hadError = true;
          }
        }

        // 2. Migrar justificaciones locales faltantes en auxiliares_justificaciones
        for (const [rawAux, fechasObj] of Object.entries(snapshotLocal.justificaciones || {})) {
          const auxKey = normalizarNombre(rawAux);
          if (!auxKey || !fechasObj || typeof fechasObj !== 'object') continue;
          for (const [fechaKey, justif] of Object.entries(fechasObj)) {
            if (!justif || !justif.tipo) continue;
            const existeEnNube = !!cloud.justifMap?.[auxKey]?.[fechaKey.trim()];
            if (!existeEnNube) {
              const saved = await guardarJustificacion({
                ...justif,
                auxiliar: auxKey,
                fecha: fechaKey.trim(),
              });
              if (saved) migratedCount++;
              else hadError = true;
            }
          }
        }

        // 3. Migrar app_config faltante sin sobrescribir claves existentes en la nube
        const configToUpload: Record<string, string> = {};
        (Object.entries(snapshotLocal.config || {}) as [string, string | undefined][]).forEach(([clave, valor]) => {
          if (valor !== undefined && valor.trim() !== '' && !(clave in cloud.appConfig)) {
            configToUpload[clave] = valor;
          }
        });

        if (Object.keys(configToUpload).length > 0) {
          const ok = await guardarAppConfig(configToUpload);
          if (ok) migratedCount++;
          else hadError = true;
        }

        if (!hadError) {
          safeLocalStorage.setItem('ferricar_migracion_v1_done', 'true');
          if (migratedCount > 0) {
            setToastMessage({ text: 'Datos locales migrados a la nube', type: 'success' });
            await sincronizarDatos();
          }
        } else {
          setToastMessage({
            text: 'Algunos datos locales no pudieron migrarse a Supabase. Se reintentará al sincronizar.',
            type: 'error',
          });
        }
      } finally {
        migratingRef.current = false;
      }
    };

    runMigration();
  }, [userRole, cloudSyncTick]);

  // Lista unificada de auxiliares (registros + credenciales en Supabase)
  const listaAuxiliaresUnicos = useMemo(() => {
    const set = new Set<string>();
    registros.forEach(r => {
      if (r.auxiliar && typeof r.auxiliar === 'string') {
        const clean = normalizarNombre(r.auxiliar);
        if (clean && clean !== 'ADMIN') set.add(clean);
      }
    });
    credencialesAuxiliares.forEach(c => {
      if (c && typeof c === 'string') {
        const clean = normalizarNombre(c);
        if (clean && clean !== 'ADMIN') set.add(clean);
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
  }, [registros, credencialesAuxiliares]);

  // Actualizar pinsMap cuando cambie la lista de auxiliares
  useEffect(() => {
    if (listaAuxiliaresUnicos.length > 0) {
      const pins = getPinsDirectory(listaAuxiliaresUnicos);
      setPinsMap(prev => ({ ...pins, ...prev }));
    }
  }, [listaAuxiliaresUnicos]);

  // Filtrado de registros
  const registrosFiltrados = useMemo(() => {
    let res = filtrarPorPeriodo(
      registros,
      filtroPeriodo,
      fechaInicioCustom,
      fechaFinCustom,
      filtroMes,
      filtroAno
    );
    if (userRole === 'auxiliar' && loggedAuxiliarName) {
      res = res.filter(r => r.auxiliar.trim().toUpperCase() === loggedAuxiliarName.trim().toUpperCase());
    } else if (filtroAuxiliar) {
      res = res.filter(r => r.auxiliar.trim().toUpperCase() === filtroAuxiliar.trim().toUpperCase());
    }
    return res;
  }, [registros, filtroPeriodo, fechaInicioCustom, fechaFinCustom, filtroAuxiliar, filtroMes, filtroAno, userRole, loggedAuxiliarName]);

  // Rango activo de fechas
  const rangoFechasActivo = useMemo(() => {
    let inicio = new Date();
    let fin = new Date();

    if (filtroPeriodo === 'quincena_1') {
      inicio = new Date(filtroAno, filtroMes, 1);
      fin = new Date(filtroAno, filtroMes, 15);
    } else if (filtroPeriodo === 'quincena_2') {
      inicio = new Date(filtroAno, filtroMes, 16);
      fin = new Date(filtroAno, filtroMes + 1, 0);
    } else if (filtroPeriodo === 'este_mes') {
      inicio = new Date(filtroAno, filtroMes, 1);
      fin = new Date(filtroAno, filtroMes + 1, 0);
    } else if (filtroPeriodo === 'esta_semana') {
      fin = new Date();
      inicio = new Date();
      inicio.setDate(fin.getDate() - 7);
    } else if (filtroPeriodo === 'ultimos_15_dias') {
      fin = new Date();
      inicio = new Date();
      inicio.setDate(fin.getDate() - 15);
    } else if (filtroPeriodo === 'custom') {
      if (fechaInicioCustom) {
        const p = fechaInicioCustom.split('-');
        inicio = new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10));
      }
      if (fechaFinCustom) {
        const p = fechaFinCustom.split('-');
        fin = new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10));
      }
    } else {
      const validDates = registros
        .map(r => parseFecha(r.fecha))
        .filter((d): d is Date => d !== null);
      if (validDates.length > 0) {
        let minDate = validDates[0];
        let maxDate = validDates[0];
        validDates.forEach(d => {
          if (d < minDate) minDate = d;
          if (d > maxDate) maxDate = d;
        });
        inicio = minDate;
        fin = maxDate;
      }
    }

    return { inicio, fin };
  }, [filtroPeriodo, filtroMes, filtroAno, fechaInicioCustom, fechaFinCustom, registros]);

  // Días laborables/hábiles esperados en el período activo (excluyendo domingos y festivos)
  const diasHabilesEsperadosActivos = useMemo(() => {
    return calcularDiasLaborablesEsperados(rangoFechasActivo.inicio, rangoFechasActivo.fin);
  }, [rangoFechasActivo]);

  // Reporte de faltas de registro
  const reporteFaltasAsistencia = useMemo(() => {
    let dInicio = 1;
    let dFin = 15;
    
    if (filtroPeriodo === 'quincena_2') {
      dInicio = 16;
      dFin = new Date(filtroAno, filtroMes + 1, 0).getDate();
    } else if (filtroPeriodo === 'este_mes' || !['quincena_1', 'quincena_2'].includes(filtroPeriodo)) {
      dInicio = 1;
      dFin = new Date(filtroAno, filtroMes + 1, 0).getDate();
    }

    const fechasPeriodo: string[] = [];
    for (let d = dInicio; d <= dFin; d++) {
      fechasPeriodo.push(`${d}/${filtroMes + 1}/${filtroAno}`);
    }

    const report = listaAuxiliaresUnicos.map(auxName => {
      const regsAux = registros.filter(r => r.auxiliar.trim().toUpperCase() === auxName.trim().toUpperCase());
      const diasFaltantes: { fecha: string; diaSemana: string; d: number }[] = [];
      const diasRegistrados: { fecha: string; d: number }[] = [];

      fechasPeriodo.forEach(fStr => {
        const [day, m, y] = fStr.split('/').map(Number);
        const dateObj = new Date(y, m - 1, day);
        const diasSemanaNombres = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
        const diaSemana = diasSemanaNombres[dateObj.getDay()];

        const tieneRegistro = regsAux.some(r => {
          const rDate = parseFecha(r.fecha);
          if (rDate) {
            return rDate.getDate() === day && rDate.getMonth() === (m - 1) && rDate.getFullYear() === y;
          }
          return r.fecha === fStr;
        });

        if (tieneRegistro) {
          diasRegistrados.push({ fecha: fStr, d: day });
        } else {
          diasFaltantes.push({ fecha: fStr, diaSemana, d: day });
        }
      });

      return {
        auxiliar: auxName,
        diasFaltantes,
        diasRegistrados,
        totalFaltantes: diasFaltantes.length,
        totalRegistrados: diasRegistrados.length,
      };
    });

    return report;
  }, [listaAuxiliaresUnicos, registros, filtroMes, filtroAno, filtroPeriodo]);

  // Estadísticas agrupadas de auxiliares
  const statsAuxiliares = useMemo(() => {
    const mapa: { [nombre: string]: { horas: number; jornada: number; dias: number } } = {};

    registrosFiltrados.forEach(reg => {
      if (!mapa[reg.auxiliar]) {
        mapa[reg.auxiliar] = { horas: 0, jornada: 0, dias: 0 };
      }
      mapa[reg.auxiliar].horas += reg.horasExtras;
      mapa[reg.auxiliar].jornada += reg.jornada;
      mapa[reg.auxiliar].dias += 1;
    });

    return Object.entries(mapa)
      .map(([nombre, stats]) => ({
        nombre,
        nombreCorto: obtenerNombreCorto(nombre),
        horasExtrasTotales: Math.round(stats.horas * 10) / 10,
        jornadaTotal: Math.round(stats.jornada * 10) / 10,
        diasTrabajados: stats.dias,
        promedioHorasExtras: stats.dias > 0 ? Math.round((stats.horas / stats.dias) * 10) / 10 : 0,
        registros: registrosFiltrados.filter(r => r.auxiliar === nombre)
      }))
      .sort((a, b) => b.horasExtrasTotales - a.horasExtrasTotales);
  }, [registrosFiltrados]);

  // Handlers para Registros
  const handleAgregarRegistro = async (nuevoReg: Registro): Promise<boolean> => {
    // Validar duplicados existentes para el mismo auxiliar y misma fecha/horario
    const yaExiste = registros.some(r =>
      normalizarNombre(r.auxiliar) === normalizarNombre(nuevoReg.auxiliar) &&
      r.fecha.trim() === nuevoReg.fecha.trim() &&
      (r.horaIngreso || '').trim() === (nuevoReg.horaIngreso || '').trim() &&
      (r.horaSalida || '').trim() === (nuevoReg.horaSalida || '').trim()
    );
    if (yaExiste) {
      setToastMessage({
        text: `Ya existe un registro de turno para ${formatoNombreCapital(nuevoReg.auxiliar)} en la fecha ${nuevoReg.fecha}.`,
        type: 'error'
      });
      return false;
    }

    if (supabaseConectado && navigator.onLine) {
      const regSupa: RegistroSupabase = {
        auxiliar: nuevoReg.auxiliar,
        vehiculo: nuevoReg.vehiculo,
        fecha: nuevoReg.fecha,
        hora_ingreso: nuevoReg.horaIngreso,
        hora_salida: nuevoReg.horaSalida,
        ruta: nuevoReg.ruta,
        jornada: nuevoReg.jornada,
        horas_extras: nuevoReg.horasExtras,
        es_nocturno: nuevoReg.esNocturno || false,
        origen: 'manual'
      };
      const guardado = await insertarRegistro(regSupa);
      if (!guardado) {
        setToastMessage({
          text: 'Error al guardar el registro en Supabase. No se guardó el cambio.',
          type: 'error',
        });
        return false;
      }

      setJustAddedId(String(guardado.id));
      setTimeout(() => setJustAddedId(null), 4000);
      try {
        const regs = await obtenerRegistros();
        setSheetRegistros(mapSupabaseRegistros(regs));
      } catch {
        setSheetRegistros(prev => [{ ...nuevoReg, id: String(guardado.id || nuevoReg.id) }, ...prev]);
      }
      setToastMessage({ text: 'Registro guardado exitosamente en Supabase.', type: 'success' });
      return true;
    }

    // Fallback offline de contingencia (solo cuando no hay conexión)
    setJustAddedId(nuevoReg.id);
    setTimeout(() => setJustAddedId(null), 4000);
    const updated = [nuevoReg, ...manualRegistros];
    setManualRegistros(updated);
    safeLocalStorage.setItem('ferricar_manual_registros', JSON.stringify(updated));
    setToastMessage({ text: 'Guardado localmente de contingencia (sin conexión).', type: 'info' });
    return true;
  };

  const handleEliminarRegistro = async (id: string): Promise<boolean> => {
    const isLocalOnly = id.startsWith('manual') || !sheetRegistros.some(r => r.id === id);
    if (!isLocalOnly) {
      const exito = await eliminarRegistro(id);
      if (!exito) {
        setToastMessage({
          text: 'Error al eliminar el registro en Supabase. No se realizaron cambios.',
          type: 'error',
        });
        return false;
      }
      try {
        const regs = await obtenerRegistros();
        setSheetRegistros(mapSupabaseRegistros(regs));
      } catch {
        setSheetRegistros(prev => prev.filter(r => r.id !== id));
      }
      setToastMessage({ text: 'Registro eliminado de Supabase.', type: 'success' });
      return true;
    }

    const updated = manualRegistros.filter(r => r.id !== id);
    setManualRegistros(updated);
    safeLocalStorage.setItem('ferricar_manual_registros', JSON.stringify(updated));
    setToastMessage({ text: 'Registro local eliminado.', type: 'info' });
    return true;
  };

  const handleActualizarRegistro = async (id: string, updatedFields: Partial<Registro>): Promise<boolean> => {
    let jornada = updatedFields.jornada;
    let horasExtras = updatedFields.horasExtras;
    let esNocturno = updatedFields.esNocturno;

    if (updatedFields.horaIngreso && updatedFields.horaSalida) {
      jornada = calcularJornada(updatedFields.horaIngreso, updatedFields.horaSalida);
      horasExtras = calcularHorasExtra(jornada);
      esNocturno = esTurnoNocturno(updatedFields.horaIngreso, updatedFields.horaSalida);
    }

    const fieldsToApply = {
      ...updatedFields,
      jornada,
      horasExtras,
      esNocturno,
    };

    const isManual = id.startsWith('manual') || !sheetRegistros.some(r => r.id === id);

    if (!isManual) {
      const regSupa: Partial<RegistroSupabase> = {
        auxiliar: fieldsToApply.auxiliar ? fieldsToApply.auxiliar.trim().toUpperCase() : undefined,
        vehiculo: fieldsToApply.vehiculo ? fieldsToApply.vehiculo.trim().toUpperCase() : undefined,
        fecha: fieldsToApply.fecha,
        hora_ingreso: fieldsToApply.horaIngreso,
        hora_salida: fieldsToApply.horaSalida,
        ruta: fieldsToApply.ruta ? fieldsToApply.ruta.trim().toUpperCase() : undefined,
        jornada,
        horas_extras: horasExtras,
        es_nocturno: esNocturno,
      };

      const exitoSupa = await actualizarRegistro(id, regSupa);
      if (!exitoSupa) {
        setToastMessage({
          text: 'Error al actualizar el registro en Supabase. No se guardaron los cambios.',
          type: 'error',
        });
        return false;
      }

      try {
        const regs = await obtenerRegistros();
        setSheetRegistros(mapSupabaseRegistros(regs));
      } catch {
        setSheetRegistros(prev => prev.map(r => (r.id === id ? { ...r, ...fieldsToApply } : r)));
      }
      setToastMessage({ text: 'Registro actualizado en Supabase.', type: 'success' });
      return true;
    }

    const updatedManual = manualRegistros.map(r => {
      if (r.id === id) {
        return {
          ...r,
          ...fieldsToApply,
          auxiliar: fieldsToApply.auxiliar ? fieldsToApply.auxiliar.trim().toUpperCase() : r.auxiliar,
          vehiculo: fieldsToApply.vehiculo ? fieldsToApply.vehiculo.trim().toUpperCase() : r.vehiculo,
          ruta: fieldsToApply.ruta ? fieldsToApply.ruta.trim().toUpperCase() : r.ruta,
        };
      }
      return r;
    });
    setManualRegistros(updatedManual);
    safeLocalStorage.setItem('ferricar_manual_registros', JSON.stringify(updatedManual));
    setToastMessage({ text: 'Registro local actualizado.', type: 'success' });
    return true;
  };

  // Handlers para Auxiliares (Supabase como fuente de verdad)
  const handleCrearAuxiliar = async (nombre: string, pin: string, cargo: string): Promise<boolean> => {
    const cleanNombre = normalizarNombre(nombre);
    const cleanPin = pin.trim();

    const ok = await guardarCredencial(cleanNombre, cleanPin, cargo);
    if (!ok) {
      setToastMessage({
        text: `Error al crear a ${formatoNombreCapital(cleanNombre)} en Supabase. No se guardó el cambio.`,
        type: 'error',
      });
      return false;
    }

    setCredencialesAuxiliares(prev => (prev.includes(cleanNombre) ? prev : [...prev, cleanNombre]));

    const updatedPins = { ...pinsMap, [cleanNombre]: cleanPin };
    setPinsMap(updatedPins);
    safeLocalStorage.setItem('ferricar_user_pins', JSON.stringify(updatedPins));

    const updatedCargos = { ...auxiliarCargos, [cleanNombre]: cargo };
    setAuxiliarCargos(updatedCargos);
    safeLocalStorage.setItem('ferricar_auxiliar_cargos', JSON.stringify(updatedCargos));

    setToastMessage({ text: `Auxiliar ${formatoNombreCapital(cleanNombre)} creado en Supabase.`, type: 'success' });
    return true;
  };

  const handleUpdatePin = async (auxiliarName: string, newPin: string): Promise<boolean> => {
    const isEditingAdmin = auxiliarName === 'ADMIN' || auxiliarName === 'admin';
    const cleanName = isEditingAdmin ? 'ADMIN' : normalizarNombre(auxiliarName);
    const cleanPin = newPin.trim();

    const ok = await guardarCredencial(cleanName, cleanPin);
    if (!ok) {
      setToastMessage({
        text: `Error al actualizar el PIN de ${isEditingAdmin ? 'ADMIN' : formatoNombreCapital(cleanName)} en Supabase. No se guardó el cambio.`,
        type: 'error',
      });
      return false;
    }

    const updatedPins = { ...pinsMap, [cleanName]: cleanPin };
    if (isEditingAdmin) updatedPins['admin'] = cleanPin;
    setPinsMap(updatedPins);
    safeLocalStorage.setItem('ferricar_user_pins', JSON.stringify(updatedPins));

    if (!isEditingAdmin) {
      setCredencialesAuxiliares(prev => (prev.includes(cleanName) ? prev : [...prev, cleanName]));
    }

    setToastMessage({ text: `PIN de ${isEditingAdmin ? 'ADMIN' : formatoNombreCapital(cleanName)} actualizado en Supabase.`, type: 'success' });
    return true;
  };

  const handleUpdateCargo = async (auxiliarName: string, newCargo: string): Promise<boolean> => {
    const cleanName = normalizarNombre(auxiliarName);

    const ok = await guardarCredencial(cleanName, undefined, newCargo);
    if (!ok) {
      setToastMessage({
        text: `Error al actualizar el cargo de ${formatoNombreCapital(cleanName)} en Supabase. No se guardó el cambio.`,
        type: 'error',
      });
      return false;
    }

    const updatedCargos = { ...auxiliarCargos, [cleanName]: newCargo };
    setAuxiliarCargos(updatedCargos);
    safeLocalStorage.setItem('ferricar_auxiliar_cargos', JSON.stringify(updatedCargos));
    setCredencialesAuxiliares(prev => (prev.includes(cleanName) ? prev : [...prev, cleanName]));

    setToastMessage({ text: `Cargo de ${formatoNombreCapital(cleanName)} actualizado en Supabase.`, type: 'success' });
    return true;
  };

  const handleSaveAppConfig = async (entries: Record<string, string>): Promise<boolean> => {
    const ok = await guardarAppConfig(entries);
    if (!ok) {
      setToastMessage({
        text: 'Error al guardar la configuración en Supabase. No se aplicaron los cambios.',
        type: 'error',
      });
      return false;
    }

    if (entries.jornada_base !== undefined) safeLocalStorage.setItem('ferricar_jornada_base', entries.jornada_base);
    if (entries.overtime_threshold !== undefined) safeLocalStorage.setItem('ferricar_overtime_threshold', entries.overtime_threshold);
    if (entries.webhook_url !== undefined) safeLocalStorage.setItem('ferricar_webhook_url', entries.webhook_url);
    if (entries.notif_email !== undefined) safeLocalStorage.setItem('ferricar_notif_email', entries.notif_email);

    setAppConfig(prev => ({ ...prev, ...entries }));
    setToastMessage({ text: 'Configuración guardada en Supabase.', type: 'success' });
    return true;
  };

  const handleDeleteAuxiliar = async (auxiliarName: string) => {
    const cleanName = normalizarNombre(auxiliarName);
    const normTarget = normalizarNombre(cleanName);
    const turnosCount = registros.filter(r => normalizarNombre(r.auxiliar) === normTarget).length;

    const confirmado = window.confirm(
      `¿Confirmas eliminar a ${formatoNombreCapital(cleanName)}?\nSe eliminarán ${turnosCount} turno(s) registrado(s), sus credenciales, cargo y justificaciones.`
    );
    if (!confirmado) return;

    const [credOk, regsOk, justifOk] = await Promise.all([
      eliminarCredencial(cleanName),
      eliminarRegistrosDeAuxiliar(cleanName),
      eliminarJustificacionesDeAuxiliar(cleanName),
    ]);
    if (!credOk || !regsOk || !justifOk) {
      setToastMessage({
        text: `Error al eliminar a ${formatoNombreCapital(cleanName)} en Supabase. No se eliminó ningún dato local.`,
        type: 'error',
      });
      return;
    }

    setCredencialesAuxiliares(prev => prev.filter(a => normalizarNombre(a) !== normTarget));

    const updatedPins = { ...pinsMap };
    delete updatedPins[cleanName];
    setPinsMap(updatedPins);
    safeLocalStorage.setItem('ferricar_user_pins', JSON.stringify(updatedPins));

    const updatedCargos = { ...auxiliarCargos };
    delete updatedCargos[cleanName];
    setAuxiliarCargos(updatedCargos);
    safeLocalStorage.setItem('ferricar_auxiliar_cargos', JSON.stringify(updatedCargos));

    const storedJustif = safeLocalStorage.getItem('ferricar_justificaciones_dias');
    if (storedJustif) {
      try {
        const parsedJustif = JSON.parse(storedJustif);
        if (parsedJustif && typeof parsedJustif === 'object' && normTarget in parsedJustif) {
          delete parsedJustif[normTarget];
          safeLocalStorage.setItem('ferricar_justificaciones_dias', JSON.stringify(parsedJustif));
        }
      } catch {
        // Ignorar errores de parseo en justificaciones locales
      }
    }

    setSheetRegistros(prev => prev.filter(r => normalizarNombre(r.auxiliar) !== normTarget));
    const updatedManual = manualRegistros.filter(r => normalizarNombre(r.auxiliar) !== normTarget);
    setManualRegistros(updatedManual);
    safeLocalStorage.setItem('ferricar_manual_registros', JSON.stringify(updatedManual));

    if (selectedAuxiliarForDetail && normalizarNombre(selectedAuxiliarForDetail) === normTarget) {
      setSelectedAuxiliarForDetail(null);
    }

    setToastMessage({ text: `Auxiliar ${formatoNombreCapital(cleanName)} eliminado del sistema.`, type: 'info' });
  };

  // Exportar a Excel CSV (soporta conjunto filtrado específico desde Reportes)
  const exportarExcel = (registrosCustom?: Registro[]) => {
    let fuenteRegistros = registrosCustom && Array.isArray(registrosCustom)
      ? [...registrosCustom]
      : [...registrosFiltrados];

    // Solo aplicar filtro global si no vienen registros filtrados específicos
    if (!registrosCustom) {
      const qGlobal = busquedaGlobal.trim().toLowerCase();
      if (qGlobal) {
        fuenteRegistros = fuenteRegistros.filter(r =>
          (r.auxiliar && r.auxiliar.toLowerCase().includes(qGlobal)) ||
          (r.vehiculo && r.vehiculo.toLowerCase().includes(qGlobal)) ||
          (r.fecha && r.fecha.toLowerCase().includes(qGlobal)) ||
          (r.ruta && r.ruta.toLowerCase().includes(qGlobal))
        );
      }
    }

    const headers = [
      'Auxiliar',
      'Vehiculo (Placa/Turno)',
      'Fecha',
      'Hora de Ingreso',
      'Hora Salida',
      'Ruta',
      'Jornada Completa (Horas)',
      'Horas Extras Calculadas'
    ];
    
    const registrosOrdenados = fuenteRegistros.sort((a, b) => {
      const compAux = a.auxiliar.localeCompare(b.auxiliar, 'es', { sensitivity: 'base' });
      if (compAux !== 0) return compAux;
      const dateA = parseFecha(a.fecha)?.getTime() ?? 0;
      const dateB = parseFecha(b.fecha)?.getTime() ?? 0;
      return dateA - dateB;
    });

    const rows: (string | number)[][] = [];
    let currentAuxiliar = '';
    let subtotalJornada = 0;
    let subtotalExtras = 0;
    let granTotalJornada = 0;
    let granTotalExtras = 0;

    registrosOrdenados.forEach((r, index) => {
      if (currentAuxiliar && r.auxiliar !== currentAuxiliar) {
        rows.push([
          `SUBTOTAL ${currentAuxiliar}`,
          '',
          '',
          '',
          '',
          'Suma de Horas del Auxiliar',
          Math.round(subtotalJornada * 10) / 10,
          Math.round(subtotalExtras * 10) / 10
        ]);
        rows.push(['', '', '', '', '', '', '', '']);
        subtotalJornada = 0;
        subtotalExtras = 0;
      }

      currentAuxiliar = r.auxiliar;
      subtotalJornada += r.jornada;
      subtotalExtras += r.horasExtras;
      granTotalJornada += r.jornada;
      granTotalExtras += r.horasExtras;

      rows.push([
        r.auxiliar,
        r.vehiculo,
        r.fecha,
        r.horaIngreso,
        r.horaSalida,
        r.ruta,
        r.jornada,
        r.horasExtras
      ]);

      if (index === registrosOrdenados.length - 1) {
        rows.push([
          `SUBTOTAL ${currentAuxiliar}`,
          '',
          '',
          '',
          '',
          'Suma de Horas del Auxiliar',
          Math.round(subtotalJornada * 10) / 10,
          Math.round(subtotalExtras * 10) / 10
        ]);
      }
    });

    if (registrosOrdenados.length > 0) {
      rows.push(['', '', '', '', '', '', '', '']);
      rows.push([
        'TOTAL GENERAL DE LA PLANILLA',
        '',
        '',
        '',
        '',
        'Total Período Consolidado',
        Math.round(granTotalJornada * 10) / 10,
        Math.round(granTotalExtras * 10) / 10
      ]);
    }

    const csvContent =
      '\uFEFF' +
      [headers.join(';'), ...rows.map(row => row.map(v => `"${v}"`).join(';'))].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute(
      'download',
      `Ferricar_Planilla_${filtroPeriodo}_${new Date().toISOString().split('T')[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setToastMessage({ text: `Se exportaron ${registrosOrdenados.length} registros a Excel (CSV).`, type: 'success' });
  };

  const handleCopyRecordatorio = (auxiliar: string, diasFaltantes: number) => {
    const texto = `Hola ${formatoNombreCapital(auxiliar)}, desde la coordinación de FERRICAR te recordamos que tienes ${diasFaltantes} turno(s) pendiente(s) por registrar en la planilla de turnos. Por favor ingresa a la aplicación para ponerte al día. ¡Gracias!`;
    navigator.clipboard.writeText(texto);
    setToastMessage({ text: `Recordatorio copiado al portapapeles para ${formatoNombreCapital(auxiliar)}.`, type: 'success' });
  };

  // Guardar cambio de PIN propio (Administrador o Auxiliar) con validaciones completas
  const handleSaveOwnPin = async (e: React.FormEvent) => {
    e.preventDefault();
    setOwnPinError('');
    setOwnPinSuccess('');

    const cleanCurrent = currentOwnPin.trim();
    const cleanNew = newOwnPin.trim();
    const cleanConfirm = confirmOwnPin.trim();

    // 1. Obtener PIN esperado según el rol activo
    let expectedPin = '';
    const isAdmin = userRole === 'admin';
    if (isAdmin) {
      expectedPin = pinsMap['ADMIN'] || pinsMap['admin'] || '9988';
    } else if (userRole === 'auxiliar' && loggedAuxiliarName) {
      const norm = loggedAuxiliarName.trim().toUpperCase();
      expectedPin = pinsMap[norm] || pinsMap[loggedAuxiliarName] || '1234';
    } else {
      setOwnPinError('No hay una sesión activa para cambiar la clave.');
      return;
    }

    // 2. Validación de PIN Actual
    if (!cleanCurrent) {
      setOwnPinError('Debes ingresar tu clave o PIN actual.');
      return;
    }
    if (cleanCurrent !== expectedPin) {
      setOwnPinError('La clave actual ingresada es incorrecta.');
      return;
    }

    // 3. Validación de Nuevo PIN
    if (!/^\d{4}$/.test(cleanNew)) {
      setOwnPinError('La nueva clave debe tener exactamente 4 dígitos numéricos.');
      return;
    }

    // 4. Validación de Confirmación
    if (!cleanConfirm) {
      setOwnPinError('Debes confirmar tu nueva clave.');
      return;
    }
    if (cleanNew !== cleanConfirm) {
      setOwnPinError('La nueva clave y su confirmación no coinciden.');
      return;
    }

    // 5. Que no sea igual a la actual
    if (cleanNew === cleanCurrent) {
      setOwnPinError('La nueva clave debe ser diferente a la clave actual.');
      return;
    }

    try {
      const ok = isAdmin
        ? await handleUpdatePin('ADMIN', cleanNew)
        : await handleUpdatePin(loggedAuxiliarName, cleanNew);
      if (!ok) {
        setOwnPinError('No se pudo guardar la nueva clave en Supabase. Verifica tu conexión e inténtalo de nuevo.');
        return;
      }
      setOwnPinSuccess('¡Tu clave ha sido actualizada con éxito!');
      setCurrentOwnPin('');
      setNewOwnPin('');
      setConfirmOwnPin('');
      setTimeout(() => {
        setIsChangingOwnPin(false);
        setOwnPinSuccess('');
      }, 1800);
    } catch (err) {
      setOwnPinError('No se pudo guardar la nueva clave. Inténtalo de nuevo.');
    }
  };

  // Contadores de alertas para el sidebar
  const totalAlertasCount = useMemo(() => {
    const sinRegistros = reporteFaltasAsistencia.filter(r => r.totalFaltantes > 0).length;
    const umbral = Number(appConfig.overtime_threshold || '10') || 10;
    const conFatiga = statsAuxiliares.filter(a => a.horasExtrasTotales >= umbral).length;
    return sinRegistros + conFatiga;
  }, [reporteFaltasAsistencia, statsAuxiliares, appConfig.overtime_threshold]);

  // Pantalla de Bienvenida con animación fluida
  if (isWelcoming && welcomingUser) {
    const isAux = welcomingUser.role === 'auxiliar';
    const cleanName = formatoNombreCapital(welcomingUser.name);

    return (
      <div className="min-h-screen bg-slate-900 font-sans text-white flex items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] rounded-full bg-indigo-500/10 blur-[140px]" />
        <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] rounded-full bg-indigo-600/10 blur-[140px]" />

        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: -15 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="text-center z-10 max-w-md w-full bg-slate-800/80 backdrop-blur-2xl border border-slate-700 p-8 rounded-2xl shadow-2xl flex flex-col items-center"
        >
          <div className="relative mb-6 flex items-center justify-center">
            <motion.div
              animate={{ scale: [1, 1.4, 1], opacity: [0.5, 0, 0.5] }}
              transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
              className="absolute w-24 h-24 border border-emerald-500/30 rounded-full"
            />
            <motion.div
              initial={{ scale: 0.4, rotate: -45 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 220, damping: 15, delay: 0.1 }}
              className="w-18 h-18 bg-emerald-500/15 rounded-full border border-emerald-500/40 flex items-center justify-center text-emerald-400 z-10 relative"
            >
              {isAux ? <UserCheck className="w-9 h-9" /> : <ShieldCheck className="w-9 h-9" />}
            </motion.div>
          </div>

          <p className="text-emerald-400 text-xs uppercase font-bold tracking-widest mb-1">
            ACCESO CONCEDIDO
          </p>

          <h2 className="font-display font-bold text-2xl text-white tracking-tight leading-snug mb-3 px-2">
            {isAux ? `Hola, ${cleanName}` : 'Panel de Coordinación Ferricar'}
          </h2>

          <div className="h-[3px] w-16 bg-emerald-500 rounded-full mb-4" />

          <p className="text-xs text-slate-400 leading-relaxed max-w-xs">
            {isAux 
              ? 'Sincronizando tus turnos y horas extras en tiempo real...' 
              : 'Verificando turnos y cargando centro de control...'}
          </p>

          <div className="flex gap-2 mt-6">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce [animation-delay:-0.3s]" />
            <span className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce [animation-delay:-0.15s]" />
            <span className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce" />
          </div>
        </motion.div>
      </div>
    );
  }

  // Pantalla de Login (Portón de Acceso)
  if (userRole === null) {
    const heroFeatures = [
      'Registro de turno en segundos',
      'Horas extras calculadas automáticamente',
    ];

    return (
      <div
        className="login-scope relative min-h-screen overflow-hidden flex flex-col justify-between"
        style={{
          background:
            'radial-gradient(circle at 76% 24%, color-mix(in oklab, var(--primary-strong) 26%, var(--background)), var(--background) 72%)',
        }}
      >
        {/* Capa (a): Fondo fotográfico nocturno con respaldo degradado azul marino */}
        {!loginBgError && (
          <img
            src="/ferricar-logistics-blue.jpg"
            alt=""
            aria-hidden="true"
            onError={() => setLoginBgError(true)}
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}

        {/* Capa (b): Veladura direccional */}
        <div className="lg-overlay absolute inset-0" aria-hidden="true" />

        {/* Capa (c): Dos halos de luz */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-32 -left-32 w-[460px] h-[460px] rounded-full blur-[120px]"
          style={{ background: 'color-mix(in oklab, var(--primary) 10%, transparent)' }}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-36 -right-28 w-[520px] h-[520px] rounded-full blur-[140px]"
          style={{ background: 'color-mix(in oklab, var(--primary) 15%, transparent)' }}
        />

        {/* HEADER */}
        <header className="relative z-10 w-full max-w-[1320px] mx-auto px-5 sm:px-8 h-20 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="glass-subtle w-11 h-11 rounded-xl flex items-center justify-center shrink-0">
              <Truck className="w-5 h-5" style={{ color: 'var(--primary)' }} aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <div
                className="text-sm font-extrabold tracking-[0.2em] leading-none"
                style={{ color: 'var(--foreground)' }}
              >
                FERRICAR
              </div>
              <div
                className="font-login-mono text-[8px] uppercase tracking-[0.22em] mt-1.5"
                style={{ color: 'var(--muted-foreground)' }}
              >
                Logistics intelligence
              </div>
            </div>
          </div>

          <div
            className="glass-subtle rounded-full px-3.5 py-1.5 flex items-center gap-2 shrink-0"
            role="status"
            aria-live="polite"
          >
            <span className="relative flex h-2 w-2" aria-hidden="true">
              {isBrowserOnline && (
                <span
                  className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
                  style={{ backgroundColor: 'var(--success)' }}
                />
              )}
              <span
                className="relative inline-flex rounded-full h-2 w-2"
                style={{ backgroundColor: isBrowserOnline ? 'var(--success)' : 'var(--destructive)' }}
              />
            </span>
            <span
              className="font-login-mono text-[10px] uppercase tracking-[0.14em]"
              style={{ color: 'var(--foreground)' }}
            >
              {isBrowserOnline ? 'Conectado' : 'Sin conexión'}
            </span>
          </div>
        </header>

        {/* MAIN */}
        <main className="relative z-10 w-full max-w-[1320px] mx-auto px-5 sm:px-8 py-6 md:py-10 flex-1 flex items-center">
          <div className="w-full grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(360px,420px)] gap-10 lg:gap-16 items-center">
            {/* COLUMNA IZQUIERDA (Hero) */}
            <section className="animate-enter min-w-0">
              <div className="glass-subtle inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 mb-6">
                <Radio className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--primary)' }} aria-hidden="true" />
                <span
                  className="font-login-mono text-[9px] uppercase tracking-[0.18em] font-medium"
                  style={{ color: 'var(--primary)' }}
                >
                  CONTROL LOGÍSTICO INTELIGENTE
                </span>
              </div>

              <h1
                className="font-extrabold tracking-[-0.055em] leading-[1.02] mb-5"
                style={{
                  fontSize: 'clamp(2.65rem, 5.4vw, 4.7rem)',
                  color: 'var(--foreground)',
                }}
              >
                <span className="block">Tu jornada,</span>
                <span className="block">siempre</span>
                <span className="block" style={{ color: 'var(--primary)' }}>
                  al día.
                </span>
              </h1>

              <p
                className="max-w-md text-sm sm:text-base leading-relaxed mb-8"
                style={{ color: 'var(--muted-foreground)' }}
              >
                Registra tu turno en segundos y consulta tus horas de la quincena.
              </p>

              <div className="animate-float flex flex-col items-start gap-2.5 max-w-sm">
                {heroFeatures.map((label) => (
                  <div
                    key={label}
                    className="glass-subtle rounded-xl px-3.5 py-2.5 flex items-center gap-2.5 text-xs sm:text-sm font-medium"
                    style={{ color: 'var(--foreground)' }}
                  >
                    <CheckCircle2
                      className="w-4 h-4 shrink-0"
                      style={{ color: 'var(--success)' }}
                      aria-hidden="true"
                    />
                    <span>{label}</span>
                  </div>
                ))}
              </div>
            </section>

            {/* COLUMNA DERECHA (Tarjeta de acceso) */}
            <section className="animate-enter-delay w-full max-w-[420px] mx-auto relative">
              {/* Halo detrás de la tarjeta */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -inset-5 rounded-[36px]"
                style={{
                  border: '1px solid color-mix(in oklab, var(--glass-border) 40%, transparent)',
                  backgroundColor: 'color-mix(in oklab, var(--foreground) 5%, transparent)',
                }}
              />

              <div className="glass-panel relative rounded-[28px] p-6 sm:p-7 overflow-hidden">
                {/* Línea de luz superior */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-10 top-0 h-px"
                  style={{
                    background:
                      'linear-gradient(90deg, transparent, color-mix(in oklab, var(--primary) 60%, transparent), transparent)',
                  }}
                />

                {/* Modal de colisión de PINs con estética glass */}
                {matchingAuxiliares && matchingAuxiliares.length > 1 && (
                  <div
                    className="absolute inset-0 z-30 p-6 sm:p-7 flex flex-col justify-center text-left rounded-[28px]"
                    style={{
                      background: 'color-mix(in oklab, var(--background) 88%, transparent)',
                      backdropFilter: 'blur(24px) saturate(140%)',
                      WebkitBackdropFilter: 'blur(24px) saturate(140%)',
                    }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span
                        className="font-login-mono text-[10px] uppercase tracking-[0.18em]"
                        style={{ color: 'var(--primary)' }}
                      >
                        PIN COMPARTIDO
                      </span>
                      <ShieldCheck className="w-4 h-4" style={{ color: 'var(--primary)' }} aria-hidden="true" />
                    </div>
                    <h4
                      className="text-lg font-bold tracking-[-0.03em] mb-1"
                      style={{ color: 'var(--foreground)' }}
                    >
                      Coincidencia de PIN
                    </h4>
                    <p className="text-xs mb-4" style={{ color: 'var(--muted-foreground)' }}>
                      Múltiples auxiliares comparten este PIN. Selecciona tu nombre:
                    </p>
                    <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                      {matchingAuxiliares.map((name) => (
                        <button
                          key={name}
                          type="button"
                          onClick={() => handleConfirmSelectAuxiliar(name)}
                          className="glass-subtle w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all flex items-center justify-between gap-2 cursor-pointer focus-visible:outline-none focus-visible:ring-2"
                          style={{
                            color: 'var(--foreground)',
                            '--tw-ring-color': 'var(--primary)',
                          } as React.CSSProperties}
                        >
                          <span className="truncate">{formatoNombreCapital(name)}</span>
                          <span
                            className="font-login-mono text-[10px] uppercase tracking-wider shrink-0"
                            style={{ color: 'var(--primary)' }}
                          >
                            Entrar →
                          </span>
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setMatchingAuxiliares([]);
                        setInputPin('');
                      }}
                      className="mt-4 text-center text-xs cursor-pointer transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:underline"
                      style={{ color: 'var(--muted-foreground)' }}
                    >
                      ← Probar otro PIN
                    </button>
                  </div>
                )}

                {/* Cabecera de la tarjeta */}
                <div className="flex items-center justify-between mb-3">
                  <span
                    className="font-login-mono text-[10px] uppercase tracking-[0.2em] font-medium"
                    style={{ color: 'var(--primary)' }}
                  >
                    ACCESO SEGURO
                  </span>
                  <ShieldCheck className="w-4 h-4" style={{ color: 'var(--primary)' }} aria-hidden="true" />
                </div>

                <h2
                  className="text-[28px] font-bold tracking-[-0.04em] leading-tight mb-1.5"
                  style={{ color: 'var(--foreground)' }}
                >
                  Bienvenido de nuevo
                </h2>
                <p className="text-sm mb-6" style={{ color: 'var(--muted-foreground)' }}>
                  Ingresa tu PIN para continuar.
                </p>

                {/* Formulario (solo PIN de 4 dígitos) */}
                <form onSubmit={handleLoginSubmit} className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label
                        htmlFor="login-pin-input"
                        className="text-xs font-semibold"
                        style={{ color: 'var(--foreground)' }}
                      >
                        PIN de acceso
                      </label>
                      <span
                        className="font-login-mono text-[10px] uppercase tracking-[0.16em]"
                        style={{ color: 'var(--muted-foreground)' }}
                      >
                        4 DÍGITOS
                      </span>
                    </div>

                    <div className="relative">
                      <LockKeyhole
                        className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                        style={{ color: 'var(--muted-foreground)' }}
                        aria-hidden="true"
                      />
                      <input
                        id="login-pin-input"
                        type={showPin ? 'text' : 'password'}
                        inputMode="numeric"
                        maxLength={4}
                        autoComplete="one-time-code"
                        placeholder="••••"
                        value={inputPin}
                        onChange={(e) => {
                          setInputPin(e.target.value.replace(/\D/g, '').slice(0, 4));
                          if (loginError) setLoginError('');
                        }}
                        className="lg-field rounded-xl pl-11 pr-11 text-center font-login-mono tracking-[0.55em] text-base font-semibold"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPin(!showPin)}
                        aria-label={showPin ? 'Ocultar PIN' : 'Mostrar PIN'}
                        className="eye-toggle absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg cursor-pointer transition-opacity hover:opacity-90"
                        style={{ color: 'var(--muted-foreground)' }}
                      >
                        {showPin ? (
                          <EyeOff className="w-4 h-4" aria-hidden="true" />
                        ) : (
                          <Eye className="w-4 h-4" aria-hidden="true" />
                        )}
                      </button>
                    </div>
                  </div>

                  {loginError && (
                    <div
                      role="alert"
                      className="p-3 rounded-xl text-xs flex items-center gap-2"
                      style={{
                        color: 'var(--destructive)',
                        backgroundColor: 'color-mix(in oklab, var(--destructive) 12%, transparent)',
                        border: '1px solid color-mix(in oklab, var(--destructive) 32%, transparent)',
                      }}
                    >
                      <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
                      <span>{loginError}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    className="lg-button group h-12 w-full rounded-xl font-semibold text-sm flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>Entrar a la plataforma</span>
                    <ArrowRight
                      className="w-4 h-4 transition-transform duration-150 group-hover:translate-x-1"
                      aria-hidden="true"
                    />
                  </button>
                </form>

                <p className="text-xs text-center mt-5" style={{ color: 'var(--muted-foreground)' }}>
                  ¿Olvidaste tu PIN? Contacta al coordinador
                </p>

                <div
                  className="mt-5 pt-4 flex items-center justify-center gap-2 text-xs"
                  style={{
                    borderTop: '1px solid var(--border)',
                    color: 'var(--muted-foreground)',
                  }}
                >
                  <LockKeyhole className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>Acceso personal con tu PIN</span>
                </div>
              </div>
            </section>
          </div>
        </main>

        {/* FOOTER */}
        <footer
          className="relative z-10 w-full max-w-[1320px] mx-auto px-5 sm:px-8 py-5 flex items-center justify-between gap-4 font-login-mono text-[8px] uppercase tracking-[0.18em]"
          style={{ color: 'var(--muted-foreground)' }}
        >
          <span>© 2026 Ferricar</span>
          <span className="hidden sm:inline">Precisión en cada movimiento</span>
          <span>V 2.0.4</span>
        </footer>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-slate-50 text-slate-900 font-sans flex antialiased">
        {/* 1. SIDEBAR PRINCIPAL (Columna Izquierda) */}
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          userRole={userRole}
          loggedAuxiliarName={loggedAuxiliarName}
          onLogout={handleLogout}
          alertCount={totalAlertasCount}
          isMobileOpen={isMobileSidebarOpen}
          setIsMobileOpen={setIsMobileSidebarOpen}
          onOpenPrivacy={() => setIsPrivacyModalOpen(true)}
          onOpenChangePin={() => setIsChangingOwnPin(true)}
        />

        {/* 2. ÁREA DE CONTENIDO (Columna Derecha / Main) */}
        <div className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto">
          {/* Encabezado Superior Contextual */}
          <TopHeader
            activeTab={activeTab}
            userRole={userRole}
            loggedAuxiliarName={loggedAuxiliarName}
            isOnline={supabaseConectado}
            isSyncing={cargando}
            onSync={sincronizarDatos}
            onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)}
            onLogout={handleLogout}
            onOpenChangePin={() => setIsChangingOwnPin(true)}
            busquedaGlobal={busquedaGlobal}
            setBusquedaGlobal={setBusquedaGlobal}
            totalRegistrosCount={registros.length}
          />

          {/* Contenido Principal con Vistas Modulares */}
          <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
            {loadError && (
              <div className="mb-4 bg-rose-50 border border-rose-200 text-rose-800 px-4 py-3 rounded-xl flex items-center justify-between gap-3 text-xs font-semibold shadow-2xs">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{loadError}</span>
                </div>
                <button
                  type="button"
                  onClick={sincronizarDatos}
                  className="px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold transition-colors cursor-pointer shrink-0"
                >
                  Reintentar
                </button>
              </div>
            )}
            {cargando && registros.length === 0 ? (
              <div className="py-20 flex flex-col items-center justify-center text-center">
                <div className="w-10 h-10 border-3 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-3" />
                <p className="text-xs text-slate-500 font-medium">Sincronizando base de datos en la nube...</p>
              </div>
            ) : (
              <>
                {/* VISTA 1: DASHBOARD (Centro de Control Operacional en 4 Niveles) */}
                {activeTab === 'dashboard' && (
                  <DashboardView
                    registros={registros}
                    registrosFiltrados={registrosFiltrados}
                    statsAuxiliares={statsAuxiliares}
                    reporteFaltas={reporteFaltasAsistencia}
                    userRole={userRole}
                    loggedAuxiliarName={loggedAuxiliarName}
                    filtroPeriodo={filtroPeriodo}
                    setFiltroPeriodo={setFiltroPeriodo}
                    filtroMes={filtroMes}
                    setFiltroMes={setFiltroMes}
                    filtroAno={filtroAno}
                    setFiltroAno={setFiltroAno}
                    filtroAuxiliar={filtroAuxiliar}
                    setFiltroAuxiliar={setFiltroAuxiliar}
                    fechaInicioCustom={fechaInicioCustom}
                    setFechaInicioCustom={setFechaInicioCustom}
                    fechaFinCustom={fechaFinCustom}
                    setFechaFinCustom={setFechaFinCustom}
                    listaAuxiliares={listaAuxiliaresUnicos}
                    rangoFechasActivo={rangoFechasActivo}
                    onNavigateTab={setActiveTab}
                    onSelectAuxiliar={(aux) => {
                      setSelectedAuxiliarForDetail(aux);
                      setActiveTab('auxiliares');
                    }}
                    onExportExcel={exportarExcel}
                    onEditarRegistro={setEditingRegistro}
                    onEliminarRegistro={handleEliminarRegistro}
                  />
                )}

                {/* VISTA 2: AUXILIARES (Módulo Principal Requerido) */}
                {activeTab === 'auxiliares' && userRole === 'admin' && (
                  <AuxiliaresView
                    listaAuxiliares={listaAuxiliaresUnicos}
                    pinsMap={pinsMap}
                    auxiliarCargos={auxiliarCargos}
                    statsAuxiliares={statsAuxiliares}
                    reporteFaltas={reporteFaltasAsistencia}
                    registros={registros}
                    onCreateAuxiliar={handleCrearAuxiliar}
                    onUpdatePin={handleUpdatePin}
                    onUpdateCargo={handleUpdateCargo}
                    onDeleteAuxiliar={handleDeleteAuxiliar}
                    onEditarRegistro={setEditingRegistro}
                    onEliminarRegistro={handleEliminarRegistro}
                    onAgregarRegistro={handleAgregarRegistro}
                    selectedAuxiliarForDetail={selectedAuxiliarForDetail}
                    setSelectedAuxiliarForDetail={setSelectedAuxiliarForDetail}
                  />
                )}

                {/* VISTA 3: JORNADAS (Turnos y Horas Extras) */}
                {activeTab === 'jornadas' && (
                  <JornadasView
                    registros={registros}
                    registrosFiltrados={registrosFiltrados}
                    userRole={userRole}
                    loggedAuxiliarName={loggedAuxiliarName}
                    listaAuxiliares={listaAuxiliaresUnicos}
                    auxiliaresList={listaAuxiliaresUnicos}
                    filtroPeriodo={filtroPeriodo}
                    setFiltroPeriodo={setFiltroPeriodo}
                    filtroMes={filtroMes}
                    setFiltroMes={setFiltroMes}
                    filtroAno={filtroAno}
                    setFiltroAno={setFiltroAno}
                    filtroAuxiliar={filtroAuxiliar}
                    setFiltroAuxiliar={setFiltroAuxiliar}
                    fechaInicioCustom={fechaInicioCustom}
                    setFechaInicioCustom={setFechaInicioCustom}
                    fechaFinCustom={fechaFinCustom}
                    setFechaFinCustom={setFechaFinCustom}
                    onAgregarRegistro={handleAgregarRegistro}
                    onEditarRegistro={setEditingRegistro}
                    onEliminarRegistro={handleEliminarRegistro}
                    onExportExcel={exportarExcel}
                    justAddedId={justAddedId}
                    searchTermExterno={busquedaGlobal}
                  />
                )}

                {/* VISTA 4: CALENDARIO */}
                {activeTab === 'calendario' && (
                  <CalendarView
                    registros={registros}
                    auxiliares={statsAuxiliares}
                    listaAuxiliares={listaAuxiliaresUnicos}
                    filtroAuxiliar={userRole === 'auxiliar' ? loggedAuxiliarName : filtroAuxiliar}
                    setFiltroAuxiliar={setFiltroAuxiliar}
                    userRole={userRole}
                    loggedAuxiliarName={loggedAuxiliarName}
                  />
                )}

                {/* VISTA 5: REPORTES & LIQUIDACIÓN */}
                {activeTab === 'reportes' && userRole === 'admin' && (
                  <ReportesView
                    allRegistros={registros}
                    registrosFiltrados={registrosFiltrados}
                    statsAuxiliares={statsAuxiliares}
                    filtroPeriodo={filtroPeriodo}
                    setFiltroPeriodo={setFiltroPeriodo}
                    filtroMes={filtroMes}
                    setFiltroMes={setFiltroMes}
                    filtroAno={filtroAno}
                    setFiltroAno={setFiltroAno}
                    fechaInicioCustom={fechaInicioCustom}
                    setFechaInicioCustom={setFechaInicioCustom}
                    fechaFinCustom={fechaFinCustom}
                    setFechaFinCustom={setFechaFinCustom}
                    rangoFechas={rangoFechasActivo}
                    rangoFechasActivo={rangoFechasActivo}
                    diasHabilesEsperados={diasHabilesEsperadosActivos}
                    onExportExcel={exportarExcel}
                    searchTermExterno={busquedaGlobal}
                  />
                )}

                {/* VISTA 6: ALERTAS & NOVEDADES */}
                {activeTab === 'alertas' && userRole === 'admin' && (
                  <AlertasView
                    reporteFaltas={reporteFaltasAsistencia}
                    statsAuxiliares={statsAuxiliares}
                    registros={registrosFiltrados}
                    allRegistros={registros}
                    filtroPeriodo={filtroPeriodo}
                    setFiltroPeriodo={setFiltroPeriodo}
                    filtroMes={filtroMes}
                    setFiltroMes={setFiltroMes}
                    filtroAno={filtroAno}
                    setFiltroAno={setFiltroAno}
                    fechaInicioCustom={fechaInicioCustom}
                    setFechaInicioCustom={setFechaInicioCustom}
                    fechaFinCustom={fechaFinCustom}
                    setFechaFinCustom={setFechaFinCustom}
                    rangoFechasActivo={rangoFechasActivo}
                    diasHabilesEsperados={diasHabilesEsperadosActivos}
                    onCopyRecordatorio={handleCopyRecordatorio}
                    onNavigateTab={setActiveTab}
                    onSelectAuxiliar={(aux) => {
                      setSelectedAuxiliarForDetail(aux);
                      setActiveTab('auxiliares');
                    }}
                  />
                )}

                {/* VISTA 7: CONFIGURACIÓN */}
                {activeTab === 'configuracion' && userRole === 'admin' && (
                  <ConfiguracionView
                    adminPin={pinsMap['ADMIN'] || '9988'}
                    onUpdateAdminPin={(newPin) => handleUpdatePin('ADMIN', newPin)}
                    isOnline={supabaseConectado}
                    onVerificarConexion={verificarConexion}
                    totalRegistrosCount={registros.length}
                    appConfig={appConfig}
                    onSaveAppConfig={handleSaveAppConfig}
                  />
                )}
              </>
            )}
          </main>
        </div>

        {/* TOAST FLOTANTE */}
        <AnimatePresence>
          {toastMessage && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl shadow-lg border text-xs font-semibold flex items-center gap-2.5 max-w-md ${
                toastMessage.type === 'success'
                  ? 'bg-slate-900 text-emerald-300 border-emerald-500/30'
                  : toastMessage.type === 'error'
                  ? 'bg-slate-900 text-rose-300 border-rose-500/30'
                  : 'bg-slate-900 text-indigo-300 border-indigo-500/30'
              }`}
            >
              {toastMessage.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
              {toastMessage.type === 'error' && <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />}
              {toastMessage.type === 'info' && <TrendingUp className="w-4 h-4 text-indigo-400 shrink-0" />}
              <span>{toastMessage.text}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* MODAL EDITAR TURNO */}
        <AnimatePresence>
          {editingRegistro && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 text-left">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white w-full max-w-lg rounded-2xl shadow-xl border border-slate-200 overflow-hidden"
              >
                <div className="bg-slate-900 text-white p-4 flex justify-between items-center">
                  <h3 className="font-display font-bold text-sm">Editar Registro de Turno</h3>
                  <button
                    onClick={() => setEditingRegistro(null)}
                    className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const form = e.currentTarget;
                    const fecha = (form.elements.namedItem('fecha') as HTMLInputElement).value;
                    const horaIngreso = (form.elements.namedItem('horaIngreso') as HTMLInputElement).value;
                    const horaSalida = (form.elements.namedItem('horaSalida') as HTMLInputElement).value;
                    const vehiculo = (form.elements.namedItem('vehiculo') as HTMLInputElement).value;
                    const ruta = (form.elements.namedItem('ruta') as HTMLInputElement).value;

                    const ok = await handleActualizarRegistro(editingRegistro.id, {
                      fecha,
                      horaIngreso,
                      horaSalida,
                      vehiculo,
                      ruta
                    });
                    if (ok !== false) {
                      setEditingRegistro(null);
                    }
                  }}
                  className="p-5 space-y-4"
                >
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                      Auxiliar
                    </label>
                    <input
                      type="text"
                      disabled
                      value={editingRegistro.auxiliar}
                      className="w-full text-xs font-bold bg-slate-100 border border-slate-200 rounded-xl p-2 text-slate-600"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                        Fecha
                      </label>
                      <input
                        type="text"
                        name="fecha"
                        defaultValue={editingRegistro.fecha}
                        required
                        className="w-full text-xs border border-slate-200 rounded-xl p-2 focus:ring-2 focus:ring-indigo-500/20"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                        Hora Ingreso
                      </label>
                      <input
                        type="text"
                        name="horaIngreso"
                        defaultValue={editingRegistro.horaIngreso}
                        required
                        className="w-full text-xs border border-slate-200 rounded-xl p-2 focus:ring-2 focus:ring-indigo-500/20"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                        Hora Salida
                      </label>
                      <input
                        type="text"
                        name="horaSalida"
                        defaultValue={editingRegistro.horaSalida}
                        required
                        className="w-full text-xs border border-slate-200 rounded-xl p-2 focus:ring-2 focus:ring-indigo-500/20"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                        Vehículo / Placa
                      </label>
                      <input
                        type="text"
                        name="vehiculo"
                        defaultValue={editingRegistro.vehiculo}
                        required
                        className="w-full text-xs uppercase font-bold border border-slate-200 rounded-xl p-2 focus:ring-2 focus:ring-indigo-500/20"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                        Ruta
                      </label>
                      <input
                        type="text"
                        name="ruta"
                        defaultValue={editingRegistro.ruta}
                        required
                        className="w-full text-xs uppercase font-bold border border-slate-200 rounded-xl p-2 focus:ring-2 focus:ring-indigo-500/20"
                      />
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingRegistro(null)}
                      className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold cursor-pointer shadow-xs"
                    >
                      Guardar Cambios
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* MODAL CAMBIAR CLAVE / PIN (Administrador y Auxiliares) */}
        <AnimatePresence>
          {isChangingOwnPin && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 text-left">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white w-full max-w-sm rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
              >
                <div className="bg-slate-900 text-white p-4 flex justify-between items-center">
                  <div>
                    <h3 className="font-display font-bold text-sm">
                      {userRole === 'admin' ? 'Cambiar Clave de Administrador' : 'Cambiar Mi PIN de Acceso'}
                    </h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {userRole === 'admin' ? 'Coordinación FERRICAR' : formatoNombreCapital(loggedAuxiliarName)}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setIsChangingOwnPin(false);
                      setOwnPinError('');
                      setOwnPinSuccess('');
                      setCurrentOwnPin('');
                      setNewOwnPin('');
                      setConfirmOwnPin('');
                    }}
                    className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <form onSubmit={handleSaveOwnPin} className="p-5 space-y-3.5">
                  {/* Campo 1: Clave Actual */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                      1. Clave / PIN Actual
                    </label>
                    <input
                      type="password"
                      inputMode="numeric"
                      maxLength={6}
                      placeholder="Ingresa tu clave actual"
                      value={currentOwnPin}
                      onChange={(e) => setCurrentOwnPin(e.target.value.replace(/\D/g, ''))}
                      className="w-full text-center tracking-widest font-mono font-bold text-sm bg-slate-50 border border-slate-200 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white transition-all"
                      required
                      autoFocus
                    />
                  </div>

                  {/* Campo 2: Nueva Clave */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                      2. Nueva Clave (4 dígitos)
                    </label>
                    <input
                      type="password"
                      inputMode="numeric"
                      maxLength={4}
                      placeholder="Ej: 5824"
                      value={newOwnPin}
                      onChange={(e) => setNewOwnPin(e.target.value.replace(/\D/g, ''))}
                      className="w-full text-center tracking-widest font-mono font-bold text-sm bg-slate-50 border border-slate-200 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white transition-all"
                      required
                    />
                  </div>

                  {/* Campo 3: Confirmar Nueva Clave */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                      3. Confirmar Nueva Clave
                    </label>
                    <input
                      type="password"
                      inputMode="numeric"
                      maxLength={4}
                      placeholder="Repite la nueva clave"
                      value={confirmOwnPin}
                      onChange={(e) => setConfirmOwnPin(e.target.value.replace(/\D/g, ''))}
                      className="w-full text-center tracking-widest font-mono font-bold text-sm bg-slate-50 border border-slate-200 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white transition-all"
                      required
                    />
                  </div>

                  {ownPinError && (
                    <div className="text-xs text-rose-600 bg-rose-50 p-2.5 rounded-xl border border-rose-200 flex items-start gap-1.5">
                      <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500 mt-0.5" />
                      <span>{ownPinError}</span>
                    </div>
                  )}

                  {ownPinSuccess && (
                    <div className="text-xs text-emerald-700 bg-emerald-50 p-2.5 rounded-xl border border-emerald-200 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                      <span className="font-semibold">{ownPinSuccess}</span>
                    </div>
                  )}

                  <div className="pt-2 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setIsChangingOwnPin(false);
                        setOwnPinError('');
                        setOwnPinSuccess('');
                        setCurrentOwnPin('');
                        setNewOwnPin('');
                        setConfirmOwnPin('');
                      }}
                      className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold cursor-pointer shadow-xs transition-colors"
                    >
                      Guardar Clave
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* MODAL DE POLÍTICAS DE PRIVACIDAD & HABEAS DATA */}
        <PrivacyModal
          isOpen={isPrivacyModalOpen}
          onClose={() => setIsPrivacyModalOpen(false)}
        />
      </div>
    </ErrorBoundary>
  );
}
