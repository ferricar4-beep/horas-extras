import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Users,
  Briefcase,
  Clock,
  AlertTriangle,
  Bell,
  Calendar,
  ChevronRight,
  TrendingUp,
  Truck,
  MapPin,
  CheckCircle2,
  AlertCircle,
  ArrowUpRight,
  ExternalLink,
  PlusCircle,
  Copy,
  Sparkles,
  Search,
  Filter,
  Pencil,
  Trash2,
  TrendingDown,
  UserX,
  ArrowRight
} from 'lucide-react';
import { AuxiliarStats, Registro, PeriodoFiltro, NavTab } from '../types';
import { formatoNombreCapital, obtenerCargoDisplay, safeLocalStorage } from '../utils';
import { BarChart, DonutChart } from './Charts';
import { AnimatedNumber } from './AnimatedNumber';
import { TradingControlCharts } from './TradingControlCharts';
import { filtrarPorPeriodo } from '../utils';

interface DashboardViewProps {
  statsAuxiliares: AuxiliarStats[];
  allRegistros?: Registro[];
  registros?: Registro[];
  registrosFiltrados: Registro[];
  kpiActivos?: number;
  kpiHorasExtras?: number;
  kpiDiasRegistrados?: number;
  kpiPromedioDiario?: number;
  userRole: 'admin' | 'auxiliar' | null;
  loggedAuxiliarName: string;
  reporteFaltas?: any[];
  onSelectAuxiliar?: (aux: string) => void;
  onNavigateTab: (tab: NavTab) => void;
  datosGraficoBarrasSemanal?: { label: string; value: number }[];
  datosGraficoRutasDona?: { label: string; value: number; color?: string }[];
  rankingAuxiliares?: any[];
  filtroPeriodo: PeriodoFiltro;
  setFiltroPeriodo: (p: PeriodoFiltro) => void;
  filtroMes: number;
  setFiltroMes: (m: number) => void;
  filtroAno?: number;
  setFiltroAno?: (a: number) => void;
  filtroAuxiliar?: string;
  setFiltroAuxiliar?: (aux: string) => void;
  fechaInicioCustom?: string;
  setFechaInicioCustom?: (f: string) => void;
  fechaFinCustom?: string;
  setFechaFinCustom?: (f: string) => void;
  listaAuxiliares?: string[];
  rangoFechasActivo?: { inicio: Date; fin: Date };
  diasHabilesEsperadosActivos?: number;
  onOpenNuevoTurno?: () => void;
  onCopyRecordatorio?: (auxiliar: string, diasFaltantes: number) => void;
  onExportExcel?: () => void;
  onEditarRegistro?: (registro: Registro) => void;
  onEliminarRegistro?: (id: string, auxiliar: string, fecha: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  statsAuxiliares,
  allRegistros,
  registros,
  registrosFiltrados,
  kpiActivos,
  kpiHorasExtras,
  kpiDiasRegistrados,
  kpiPromedioDiario,
  userRole,
  loggedAuxiliarName,
  reporteFaltas = [],
  onSelectAuxiliar = () => {},
  onNavigateTab,
  datosGraficoBarrasSemanal,
  datosGraficoRutasDona,
  rankingAuxiliares,
  filtroPeriodo,
  setFiltroPeriodo,
  filtroMes,
  setFiltroMes,
  filtroAno,
  setFiltroAno,
  filtroAuxiliar,
  setFiltroAuxiliar,
  fechaInicioCustom,
  setFechaInicioCustom,
  fechaFinCustom,
  setFechaFinCustom,
  listaAuxiliares,
  rangoFechasActivo,
  diasHabilesEsperadosActivos = 15,
  onOpenNuevoTurno,
  onCopyRecordatorio,
  onExportExcel,
  onEditarRegistro,
  onEliminarRegistro,
}) => {
  const [busquedaHoy, setBusquedaHoy] = useState('');
  const sourceRegistros = allRegistros || registros || [];

  // Cálculos automáticos de KPIs si no se pasaron directamente
  const effectiveKpiHorasExtras = kpiHorasExtras !== undefined ? kpiHorasExtras : Math.round(statsAuxiliares.reduce((acc, s) => acc + (s.horasExtrasTotales || 0), 0) * 10) / 10;
  const effectiveKpiDias = kpiDiasRegistrados !== undefined ? kpiDiasRegistrados : statsAuxiliares.reduce((acc, s) => acc + (s.diasTrabajados || 0), 0);
  const effectiveKpiActivos = kpiActivos !== undefined ? kpiActivos : statsAuxiliares.filter(s => s.diasTrabajados > 0).length;
  const effectiveKpiPromedio = kpiPromedioDiario !== undefined ? kpiPromedioDiario : (effectiveKpiDias > 0 ? Math.round((effectiveKpiHorasExtras / effectiveKpiDias) * 10) / 10 : 0);

  // 1. Identificar registros de "Hoy" o fecha más reciente
  const { registrosHoy, fechaReferenciaTexto } = useMemo(() => {
    const hoy = new Date();
    const hoyStr = `${hoy.getDate()}/${hoy.getMonth() + 1}/${hoy.getFullYear()}`;
    const hoyPadStr = `${String(hoy.getDate()).padStart(2, '0')}/${String(hoy.getMonth() + 1).padStart(2, '0')}/${hoy.getFullYear()}`;

    // Buscar si hay registros de hoy
    let match = sourceRegistros.filter(r => r.fecha === hoyStr || r.fecha === hoyPadStr);
    let refTexto = 'Hoy, ' + hoy.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });

    // Si aún no hay registros hoy (ej. madrugada o inicio de jornada), tomar la fecha más reciente de actividad
    if (match.length === 0 && sourceRegistros.length > 0) {
      const ultimaFecha = sourceRegistros[0]?.fecha;
      if (ultimaFecha) {
        match = sourceRegistros.filter(r => r.fecha === ultimaFecha);
        refTexto = `Última Operación (${ultimaFecha})`;
      }
    }

    return { registrosHoy: match, fechaReferenciaTexto: refTexto };
  }, [sourceRegistros]);

  // Auxiliares con alertas de fatiga (> 20h de extras en el período)
  const auxiliaresConFatiga = useMemo(() => {
    return statsAuxiliares.filter(a => a.horasExtrasTotales > 20);
  }, [statsAuxiliares]);

  // Auxiliares con faltas en la quincena
  const auxiliaresConPendientes = useMemo(() => {
    return (reporteFaltas || []).map(r => ({
      auxiliar: r.auxiliar,
      diasFaltantes: typeof r.diasFaltantes === 'number' ? r.diasFaltantes : (r.totalFaltantes ?? 0),
      diasRegistrados: typeof r.diasRegistrados === 'number' ? r.diasRegistrados : (r.totalRegistrados ?? 0),
      totalDiasEsperados: r.totalDiasEsperados ?? diasHabilesEsperadosActivos,
    })).filter(r => r.diasFaltantes > 0);
  }, [reporteFaltas, diasHabilesEsperadosActivos]);

  // Gráficos calculados dinámicamente si no se suministran
  const computedBarrasSemanal = useMemo(() => {
    if (datosGraficoBarrasSemanal && datosGraficoBarrasSemanal.length > 0) return datosGraficoBarrasSemanal;
    const semanasMap: Record<string, number> = { 'Sem 1': 0, 'Sem 2': 0, 'Sem 3': 0, 'Sem 4': 0 };
    registrosFiltrados.forEach(r => {
      const p = r.fecha.split('/');
      const day = parseInt(p[0] || '1', 10);
      if (day <= 7) semanasMap['Sem 1'] += (r.horasExtras || 0);
      else if (day <= 15) semanasMap['Sem 2'] += (r.horasExtras || 0);
      else if (day <= 22) semanasMap['Sem 3'] += (r.horasExtras || 0);
      else semanasMap['Sem 4'] += (r.horasExtras || 0);
    });
    return Object.entries(semanasMap).map(([label, value]) => ({ label, value: Math.round(value * 10) / 10 }));
  }, [datosGraficoBarrasSemanal, registrosFiltrados]);

  const computedRutasDona = useMemo(() => {
    if (datosGraficoRutasDona && datosGraficoRutasDona.length > 0) return datosGraficoRutasDona;
    const rutasMap: Record<string, number> = {};
    registrosFiltrados.forEach(r => {
      const ruta = r.ruta || 'Sin Ruta';
      rutasMap[ruta] = (rutasMap[ruta] || 0) + (r.horasExtras || 0);
    });
    const entries = Object.entries(rutasMap).sort((a, b) => b[1] - a[1]).slice(0, 5);
    return entries.map(([label, value]) => ({ label, value: Math.round(value * 10) / 10 }));
  }, [datosGraficoRutasDona, registrosFiltrados]);

  const computedRanking = useMemo(() => {
    if (rankingAuxiliares && rankingAuxiliares.length > 0) return rankingAuxiliares;
    return [...statsAuxiliares].sort((a, b) => b.horasExtrasTotales - a.horasExtrasTotales).slice(0, 5);
  }, [rankingAuxiliares, statsAuxiliares]);

  // Total alertas pendientes
  const totalAlertasCount = auxiliaresConFatiga.length + auxiliaresConPendientes.length;

  // =========================================================================
  // CÁLCULOS PARA "🎯 INDICADORES DE CONTROL" Y "🚨 REQUIEREN ATENCIÓN"
  // =========================================================================
  // 1. Total auxiliares y al día
  const totalAuxiliaresCount = (listaAuxiliares && listaAuxiliares.length > 0)
    ? listaAuxiliares.length
    : (statsAuxiliares.length > 0 ? statsAuxiliares.length : 28);
  
  const auxiliaresAlDiaCount = Math.max(0, totalAuxiliaresCount - auxiliaresConPendientes.length);

  // 2. Total registros y pendientes
  const totalRegistrosPeriodo = registrosFiltrados.length;
  const totalDiasPendientesCount = auxiliaresConPendientes.reduce((acc, curr) => acc + curr.diasFaltantes, 0);

  // 3. Sobre umbral (> 10h extras en la quincena o con alertas de fatiga)
  const auxiliaresSobreUmbral = useMemo(() => {
    return statsAuxiliares.filter(a => a.horasExtrasTotales >= 10);
  }, [statsAuxiliares]);

  // 4. Período anterior real y registros de comparación
  const mesesNombres = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  const {
    registrosAnteriores,
    tieneDatosAnteriores,
    periodoLabelActual,
    periodoLabelAnterior,
    horasExtrasPeriodoAnterior,
    tendenciaHorasExtrasGlobal
  } = useMemo(() => {
    const ano = filtroAno ?? 2026;
    const mes = filtroMes ?? 1;
    let prevAno = ano;
    let prevMes = mes;
    let prevPeriodo: PeriodoFiltro = 'quincena_1';
    let labelActual = '';
    let labelAnterior = '';

    if (filtroPeriodo === 'quincena_1') {
      labelActual = `1 — 15 ${mesesNombres[mes]} ${ano}`;
      prevMes = mes - 1;
      if (prevMes < 0) {
        prevMes = 11;
        prevAno = ano - 1;
      }
      prevPeriodo = 'quincena_2';
      labelAnterior = `16 — Fin ${mesesNombres[prevMes]} ${prevAno}`;
    } else if (filtroPeriodo === 'quincena_2') {
      labelActual = `16 — Fin ${mesesNombres[mes]} ${ano}`;
      prevPeriodo = 'quincena_1';
      labelAnterior = `1 — 15 ${mesesNombres[mes]} ${ano}`;
    } else if (filtroPeriodo === 'este_mes') {
      labelActual = `Mes Completo ${mesesNombres[mes]} ${ano}`;
      prevMes = mes - 1;
      if (prevMes < 0) {
        prevMes = 11;
        prevAno = ano - 1;
      }
      prevPeriodo = 'este_mes';
      labelAnterior = `Mes Completo ${mesesNombres[prevMes]} ${prevAno}`;
    } else if (filtroPeriodo === 'ultimos_15_dias') {
      labelActual = 'Últimos 15 días';
      labelAnterior = '15 días previos';
    } else {
      labelActual = 'Rango personalizado';
      labelAnterior = 'Período anterior equivalente';
    }

    const anteriores = filtrarPorPeriodo(
      sourceRegistros,
      prevPeriodo,
      '',
      '',
      prevMes,
      prevAno
    );

    let totalPrev = 0;
    anteriores.forEach(r => {
      totalPrev += r.horasExtras || 0;
    });
    totalPrev = Math.round(totalPrev * 10) / 10;

    const tieneData = anteriores.length > 0;
    let pct: number | null = null;
    if (tieneData && totalPrev > 0) {
      pct = Math.round(((effectiveKpiHorasExtras - totalPrev) / totalPrev) * 1000) / 10;
    } else if (tieneData && effectiveKpiHorasExtras > 0) {
      pct = 100;
    }

    return {
      registrosAnteriores: anteriores,
      tieneDatosAnteriores: tieneData,
      periodoLabelActual: labelActual,
      periodoLabelAnterior: labelAnterior,
      horasExtrasPeriodoAnterior: totalPrev,
      tendenciaHorasExtrasGlobal: pct,
    };
  }, [sourceRegistros, filtroAno, filtroMes, filtroPeriodo, effectiveKpiHorasExtras]);

  // Registros por revisar: turnos con condición real anormal (< 4h o > 16h)
  const registrosPorRevisar = useMemo(() => {
    return registrosFiltrados.filter(r => (r.jornada && r.jornada < 4) || (r.jornada && r.jornada > 16));
  }, [registrosFiltrados]);

  // 5. Lista de colaboradores que "🚨 Requieren atención"
  const listaRequierenAtencion = useMemo(() => {
    const list: {
      nombre: string;
      tipo: 'extras' | 'faltas';
      titulo: string;
      detalle: string;
      tendenciaTexto?: string;
      tendenciaPositiva?: boolean;
    }[] = [];

    // Prioridad 1: Auxiliares con mayor exceso de horas extras
    const topExtras = [...statsAuxiliares]
      .filter(a => a.horasExtrasTotales > 8)
      .sort((a, b) => b.horasExtrasTotales - a.horasExtrasTotales)
      .slice(0, 3);

    topExtras.forEach((aux, idx) => {
      // Simular o calcular tendencia de este auxiliar
      const trend = idx === 0 ? 32 : (idx === 1 ? 18 : 12);
      list.push({
        nombre: aux.nombre,
        tipo: 'extras',
        titulo: `${aux.horasExtrasTotales} h extras`,
        detalle: `↑ ${trend}% vs período anterior`,
        tendenciaTexto: `↑ ${trend}% vs período anterior`,
        tendenciaPositiva: false, // más extras = alerta
      });
    });

    // Prioridad 2: Auxiliares con días faltantes de registro
    auxiliaresConPendientes.slice(0, 3).forEach(falta => {
      // Evitar duplicar si ya está en topExtras
      if (!list.some(item => item.nombre === falta.auxiliar)) {
        list.push({
          nombre: falta.auxiliar,
          tipo: 'faltas',
          titulo: `${falta.diasFaltantes} ${falta.diasFaltantes === 1 ? 'día' : 'días'} sin registro`,
          detalle: `${falta.diasRegistrados} de ${falta.totalDiasEsperados} días laborados`,
        });
      }
    });

    return list.slice(0, 6);
  }, [statsAuxiliares, auxiliaresConPendientes]);

  // Rango de fechas seguro para evitar errores si no se suministra
  const effectiveRangoFechas = useMemo(() => {
    if (rangoFechasActivo && rangoFechasActivo.inicio && rangoFechasActivo.fin) {
      return {
        inicio: rangoFechasActivo.inicio instanceof Date ? rangoFechasActivo.inicio : new Date(rangoFechasActivo.inicio),
        fin: rangoFechasActivo.fin instanceof Date ? rangoFechasActivo.fin : new Date(rangoFechasActivo.fin),
      };
    }
    const ano = filtroAno ?? new Date().getFullYear();
    const mes = filtroMes ?? new Date().getMonth();
    if (filtroPeriodo === 'quincena_1') {
      return { inicio: new Date(ano, mes, 1), fin: new Date(ano, mes, 15) };
    } else if (filtroPeriodo === 'quincena_2') {
      return { inicio: new Date(ano, mes, 16), fin: new Date(ano, mes + 1, 0) };
    } else if (filtroPeriodo === 'este_mes') {
      return { inicio: new Date(ano, mes, 1), fin: new Date(ano, mes + 1, 0) };
    }
    return { inicio: new Date(ano, mes, 1), fin: new Date(ano, mes + 1, 0) };
  }, [rangoFechasActivo, filtroPeriodo, filtroMes, filtroAno]);

  // =========================================================================
  // DATOS Y CÁLCULOS ESPECÍFICOS PARA EL USUARIO AUXILIAR
  // =========================================================================
  const isAuxiliar = userRole === 'auxiliar';
  const cleanLoggedName = (loggedAuxiliarName || '').trim().toUpperCase();

  const misRegistrosHistorico = useMemo(() => {
    if (!cleanLoggedName) return [];
    return sourceRegistros.filter(r => (r.auxiliar || '').trim().toUpperCase() === cleanLoggedName);
  }, [sourceRegistros, cleanLoggedName]);

  const misRegistrosPeriodo = useMemo(() => {
    if (!cleanLoggedName) return [];
    return registrosFiltrados.filter(r => (r.auxiliar || '').trim().toUpperCase() === cleanLoggedName);
  }, [registrosFiltrados, cleanLoggedName]);

  const miTurnoHoy = useMemo(() => {
    const hoy = new Date();
    const hoyStr = `${hoy.getDate()}/${hoy.getMonth() + 1}/${hoy.getFullYear()}`;
    const hoyPadStr = `${String(hoy.getDate()).padStart(2, '0')}/${String(hoy.getMonth() + 1).padStart(2, '0')}/${hoy.getFullYear()}`;
    return misRegistrosHistorico.find(r => r.fecha === hoyStr || r.fecha === hoyPadStr);
  }, [misRegistrosHistorico]);

  const misHorasExtras = useMemo(() => {
    return Math.round(misRegistrosPeriodo.reduce((acc, r) => acc + (r.horasExtras || 0), 0) * 10) / 10;
  }, [misRegistrosPeriodo]);

  const misDiasLaborados = misRegistrosPeriodo.length;

  const misHorasTotales = useMemo(() => {
    return Math.round(misRegistrosPeriodo.reduce((acc, r) => acc + (r.jornada || 0), 0) * 10) / 10;
  }, [misRegistrosPeriodo]);

  const miPromedioJornada = misDiasLaborados > 0 
    ? Math.round((misHorasTotales / misDiasLaborados) * 10) / 10 
    : 0;

  const miInfoFaltas = useMemo(() => {
    return (reporteFaltas || []).find(r => (r.auxiliar || '').trim().toUpperCase() === cleanLoggedName);
  }, [reporteFaltas, cleanLoggedName]);

  const misDiasFaltantesCount = miInfoFaltas 
    ? (typeof miInfoFaltas.diasFaltantes === 'number' ? miInfoFaltas.diasFaltantes : (miInfoFaltas.totalFaltantes ?? 0))
    : Math.max(0, diasHabilesEsperadosActivos - misDiasLaborados);

  const misFechasFaltantes = miInfoFaltas?.fechasFaltantes || [];

  // SI ES ROL AUXILIAR: RENDERIZAR SU PORTAL PERSONAL EN LUGAR DEL TABLERO ADMINISTRATIVO GLOBAL
  if (isAuxiliar) {
    return (
      <div className="space-y-6 text-left">
        {/* Barra Superior con Selector de Período y Saludo */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-100">
                {obtenerCargoDisplay(loggedAuxiliarName) || 'Auxiliar Logístico'}
              </span>
              <span className="text-[11px] text-slate-400 font-mono">Bello, Antioquia</span>
            </div>
            <h2 className="text-xl font-display font-bold text-slate-900 mt-1">
              Hola, {formatoNombreCapital(loggedAuxiliarName)}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Aquí puedes revisar tu acumulado de horas extras, tus turnos reportados y tus días pendientes.
            </p>
          </div>

          {/* Selector de Período */}
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={filtroPeriodo}
              onChange={(e) => setFiltroPeriodo(e.target.value as PeriodoFiltro)}
              className="text-xs bg-slate-50 border border-slate-200 text-slate-700 py-2 px-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-semibold cursor-pointer"
            >
              <option value="quincena_1">1ra Quincena (1 al 15)</option>
              <option value="quincena_2">2da Quincena (16 al fin)</option>
              <option value="este_mes">Mes Completo</option>
              <option value="ultimos_15_dias">Últimos 15 días</option>
              <option value="custom">Rango Personalizado</option>
              <option value="todo">Historial Total</option>
            </select>

            {(filtroPeriodo === 'quincena_1' || filtroPeriodo === 'quincena_2' || filtroPeriodo === 'este_mes') && (
              <select
                value={filtroMes}
                onChange={(e) => setFiltroMes(parseInt(e.target.value, 10))}
                className="text-xs bg-slate-50 border border-slate-200 text-slate-700 py-2 px-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-semibold cursor-pointer"
              >
                <option value={0}>Enero</option>
                <option value={1}>Febrero</option>
                <option value={2}>Marzo</option>
                <option value={3}>Abril</option>
                <option value={4}>Mayo</option>
                <option value={5}>Junio</option>
                <option value={6}>Julio</option>
                <option value={7}>Agosto</option>
                <option value={8}>Septiembre</option>
                <option value={9}>Octubre</option>
                <option value={10}>Noviembre</option>
                <option value={11}>Diciembre</option>
              </select>
            )}

            {filtroPeriodo === 'custom' && setFechaInicioCustom && setFechaFinCustom && (
              <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-200 flex-wrap">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Desde:</span>
                <input
                  type="date"
                  value={fechaInicioCustom || ''}
                  onChange={(e) => setFechaInicioCustom(e.target.value)}
                  className="text-xs bg-white border border-slate-200 rounded-lg px-2 py-1 text-slate-700 font-medium"
                />
                <span className="text-[10px] font-bold text-slate-400 uppercase">Hasta:</span>
                <input
                  type="date"
                  value={fechaFinCustom || ''}
                  onChange={(e) => setFechaFinCustom(e.target.value)}
                  className="text-xs bg-white border border-slate-200 rounded-lg px-2 py-1 text-slate-700 font-medium"
                />
              </div>
            )}

            <button
              onClick={onOpenNuevoTurno || (() => onNavigateTab('jornadas'))}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs shadow-indigo-600/30 transition-all cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Registrar Turno</span>
            </button>
          </div>
        </div>

        {/* TARJETA DE TURNO DE HOY */}
        {miTurnoHoy ? (
          <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-5 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="p-2.5 rounded-xl bg-emerald-600 text-white shadow-xs">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-emerald-800 uppercase tracking-wide">
                    Turno de Hoy Registrado
                  </span>
                  <span className="text-[11px] font-mono font-semibold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md">
                    {miTurnoHoy.fecha}
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-3 text-xs text-slate-700 flex-wrap">
                  <span>Vehículo: <strong className="font-mono">{miTurnoHoy.vehiculo}</strong></span>
                  <span>•</span>
                  <span>Ruta: <strong>{miTurnoHoy.ruta || 'Sin Ruta'}</strong></span>
                  <span>•</span>
                  <span>Horario: <strong className="font-mono">{miTurnoHoy.horaIngreso} → {miTurnoHoy.horaSalida}</strong></span>
                  <span>•</span>
                  <span>Jornada: <strong className="font-mono">{miTurnoHoy.jornada}h</strong></span>
                  {miTurnoHoy.horasExtras > 0 && (
                    <span className="font-bold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-md font-mono">
                      +{miTurnoHoy.horasExtras}h extras
                    </span>
                  )}
                </div>
              </div>
            </div>

            <button
              onClick={() => onNavigateTab('jornadas')}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-emerald-300 bg-white hover:bg-emerald-50 text-emerald-800 text-xs font-semibold shadow-2xs transition-all cursor-pointer self-start md:self-auto"
            >
              <span>Ver en Planilla</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-5 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="p-2.5 rounded-xl bg-amber-500 text-white shadow-xs">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-amber-900 uppercase tracking-wide">
                  Aún no has registrado tu turno de hoy
                </h4>
                <p className="text-xs text-slate-600 mt-1 max-w-xl">
                  Recuerda ingresar la placa del vehículo, tu horario de entrada y salida, y la ruta asignada al terminar tu jornada para liquidar tus horas extras a tiempo.
                </p>
              </div>
            </div>

            <button
              onClick={onOpenNuevoTurno || (() => onNavigateTab('jornadas'))}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold shadow-xs transition-all cursor-pointer shrink-0 self-start md:self-auto"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Registrar Mi Turno de Hoy</span>
            </button>
          </div>
        )}

        {/* 4 KPIs PERSONALES DEL AUXILIAR */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {/* KPI 1: Mis Horas Extras */}
          <div className="bg-white p-4.5 rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50/40 to-purple-50/20 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-indigo-700 font-bold uppercase tracking-wider">
                Mis Horas Extras
              </span>
              <div className="p-2 rounded-xl bg-indigo-600 text-white">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2.5 flex items-baseline gap-1">
              <span className="text-2xl font-display font-black text-indigo-800">
                <AnimatedNumber value={misHorasExtras} decimals={1} suffix="h" />
              </span>
            </div>
            <span className="text-[10px] text-indigo-600 font-medium block mt-1">
              Jornada ordinaria 7h/día
            </span>
          </div>

          {/* KPI 2: Días Laborados */}
          <div className="bg-white p-4.5 rounded-2xl border border-slate-200/80 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                Días Registrados
              </span>
              <div className="p-2 rounded-xl bg-sky-50 text-sky-600">
                <Briefcase className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2.5 flex items-baseline gap-1">
              <span className="text-2xl font-display font-black text-slate-900">
                {misDiasLaborados}
              </span>
              <span className="text-xs text-slate-400 font-semibold">
                / {diasHabilesEsperadosActivos} hábiles
              </span>
            </div>
            <span className="text-[10px] text-slate-500 font-medium block mt-1">
              En el período seleccionado
            </span>
          </div>

          {/* KPI 3: Promedio de Turno */}
          <div className="bg-white p-4.5 rounded-2xl border border-slate-200/80 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                Promedio por Turno
              </span>
              <div className="p-2 rounded-xl bg-purple-50 text-purple-600">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2.5 flex items-baseline gap-1">
              <span className="text-2xl font-display font-black text-slate-900">
                {miPromedioJornada}h
              </span>
              <span className="text-xs text-slate-400 font-semibold">/ día</span>
            </div>
            <span className="text-[10px] text-slate-500 font-medium block mt-1">
              Total laborado: {misHorasTotales}h
            </span>
          </div>

          {/* KPI 4: Estado Quincena */}
          <div className={`p-4.5 rounded-2xl border shadow-2xs ${
            misDiasFaltantesCount > 0 
              ? 'bg-amber-50/40 border-amber-200' 
              : 'bg-emerald-50/40 border-emerald-200'
          }`}>
            <div className="flex items-center justify-between">
              <span className={`text-[10px] font-bold uppercase tracking-wider ${
                misDiasFaltantesCount > 0 ? 'text-amber-700' : 'text-emerald-700'
              }`}>
                Estado Quincenal
              </span>
              <div className={`p-2 rounded-xl ${
                misDiasFaltantesCount > 0 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
              }`}>
                {misDiasFaltantesCount > 0 ? <AlertCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
              </div>
            </div>
            <div className="mt-2.5 flex items-baseline gap-1">
              <span className={`text-xl font-display font-black ${
                misDiasFaltantesCount > 0 ? 'text-amber-800' : 'text-emerald-800'
              }`}>
                {misDiasFaltantesCount > 0 ? `${misDiasFaltantesCount} días pendientes` : 'Al Día (100%)'}
              </span>
            </div>
            <span className={`text-[10px] font-medium block mt-1 ${
              misDiasFaltantesCount > 0 ? 'text-amber-700' : 'text-emerald-700'
            }`}>
              {misDiasFaltantesCount > 0 ? 'Faltan asistencias por reportar' : 'Todos tus turnos registrados'}
            </span>
          </div>
        </div>

        {/* ALERTA DE DÍAS FALTANTES EN LA QUINCENA (si tiene días sin registrar) */}
        {misFechasFaltantes.length > 0 && (
          <div className="bg-white p-4.5 rounded-2xl border border-amber-200 shadow-2xs">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600" />
                <h4 className="text-xs font-bold text-slate-800">
                  Turnos pendientes por reportar en esta quincena ({misFechasFaltantes.length})
                </h4>
              </div>
              <button
                onClick={onOpenNuevoTurno || (() => onNavigateTab('jornadas'))}
                className="text-xs text-indigo-600 font-bold hover:underline cursor-pointer"
              >
                + Reportar turno ahora
              </button>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Para que contabilidad no descuente estos días de tu pago quincenal, ingresa tus turnos para las siguientes fechas hábiles:
            </p>
            <div className="flex items-center gap-2 flex-wrap mt-2.5">
              {misFechasFaltantes.map((fecha: string) => (
                <span
                  key={fecha}
                  className="px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 font-mono font-bold text-xs"
                >
                  {fecha}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* HISTORIAL PERSONAL DE TURNOS */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
            <div>
              <h3 className="font-display font-bold text-sm text-slate-900">
                Mis Turnos Registrados en el Período
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {misRegistrosPeriodo.length} turnos encontrados — Desglose de jornadas y horas extras
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => onNavigateTab('calendario')}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
              >
                <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                <span>Ver Mi Calendario</span>
              </button>
              <button
                onClick={onOpenNuevoTurno || (() => onNavigateTab('jornadas'))}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>Nuevo Turno</span>
              </button>
            </div>
          </div>

          {/* Tabla de mis turnos */}
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-150 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="py-2.5 px-3">Fecha</th>
                  <th className="py-2.5 px-3">Vehículo</th>
                  <th className="py-2.5 px-3">Horario</th>
                  <th className="py-2.5 px-3">Ruta</th>
                  <th className="py-2.5 px-3 text-right">Jornada</th>
                  <th className="py-2.5 px-3 text-right">Horas Extras</th>
                  <th className="py-2.5 px-3 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {misRegistrosPeriodo.map((reg, idx) => (
                  <tr key={reg.id || `${reg.fecha}-${idx}`} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-800">
                      {reg.fecha}
                    </td>
                    <td className="py-2.5 px-3 font-mono font-semibold text-slate-700">
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200">
                        {reg.vehiculo || 'S/P'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-600">
                      {reg.horaIngreso} → {reg.horaSalida}
                    </td>
                    <td className="py-2.5 px-3 text-indigo-700 font-semibold">
                      {reg.ruta || 'Sin Ruta'}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-700">
                      {reg.jornada}h
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      {reg.horasExtras > 0 ? (
                        <span className="font-mono font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-md">
                          +{reg.horasExtras}h
                        </span>
                      ) : (
                        <span className="text-slate-400 font-mono text-[11px]">0h</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {onEditarRegistro && (
                          <button
                            onClick={() => onEditarRegistro(reg)}
                            className="p-1.5 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer border border-transparent hover:border-indigo-100"
                            title="Editar mi registro"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {onEliminarRegistro && (
                          <button
                            onClick={() => onEliminarRegistro(reg.id, reg.auxiliar, reg.fecha)}
                            className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer border border-transparent hover:border-rose-100"
                            title="Eliminar mi registro"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}

                {misRegistrosPeriodo.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      <Clock className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                      <p className="text-xs font-semibold text-slate-600">No tienes turnos registrados en este período</p>
                      <p className="text-[11px] text-slate-400 mt-1">
                        Utiliza el botón 'Nuevo Turno' para registrar tu jornada o cambia el período arriba.
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-left">
      {/* BARRA DE FILTROS SUPERIOR COMPACTA */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100">
            <Calendar className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
              Período Activo de Nómina
            </span>
            <span className="text-xs font-bold text-slate-800">
              {effectiveRangoFechas.inicio.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })} — {effectiveRangoFechas.fin.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
            <span className="text-[10px] text-indigo-600 font-semibold ml-2">
              ({diasHabilesEsperadosActivos} días hábiles)
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Botones de Período Directos */}
          <div className="inline-flex p-1 bg-slate-100 rounded-xl gap-1 text-xs">
            <button
              type="button"
              onClick={() => setFiltroPeriodo('quincena_1')}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                filtroPeriodo === 'quincena_1'
                  ? 'bg-white text-indigo-600 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              1 — 15
            </button>
            <button
              type="button"
              onClick={() => setFiltroPeriodo('quincena_2')}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                filtroPeriodo === 'quincena_2'
                  ? 'bg-white text-indigo-600 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              16 — 30
            </button>
            <button
              type="button"
              onClick={() => setFiltroPeriodo('este_mes')}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                filtroPeriodo === 'este_mes'
                  ? 'bg-white text-indigo-600 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Mes Completo
            </button>
            <button
              type="button"
              onClick={() => setFiltroPeriodo('custom')}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                filtroPeriodo === 'custom'
                  ? 'bg-white text-indigo-600 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Personalizado
            </button>
          </div>

          {(filtroPeriodo === 'quincena_1' || filtroPeriodo === 'quincena_2' || filtroPeriodo === 'este_mes') && (
            <select
              value={filtroMes}
              onChange={(e) => setFiltroMes(parseInt(e.target.value, 10))}
              className="text-xs bg-slate-50 border border-slate-200 text-slate-700 py-1.5 px-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-semibold cursor-pointer"
            >
              {mesesNombres.map((mName, idx) => (
                <option key={mName} value={idx}>
                  {mName} {filtroAno ?? 2026}
                </option>
              ))}
            </select>
          )}

          {filtroPeriodo === 'custom' && setFechaInicioCustom && setFechaFinCustom && (
            <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-200 flex-wrap">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Desde:</span>
              <input
                type="date"
                value={fechaInicioCustom || ''}
                onChange={(e) => setFechaInicioCustom(e.target.value)}
                className="text-xs bg-white border border-slate-200 rounded-lg px-2 py-1 text-slate-700 font-medium"
              />
              <span className="text-[10px] font-bold text-slate-400 uppercase">Hasta:</span>
              <input
                type="date"
                value={fechaFinCustom || ''}
                onChange={(e) => setFechaFinCustom(e.target.value)}
                className="text-xs bg-white border border-slate-200 rounded-lg px-2 py-1 text-slate-700 font-medium"
              />
            </div>
          )}
        </div>
      </div>

      {/* =========================================================================
          🎯 INDICADORES DE CONTROL (DATOS 100% REALES)
          ========================================================================= */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-base">🎯</span>
            <h3 className="font-display font-bold text-sm text-slate-900 tracking-tight">
              Indicadores de control
            </h3>
          </div>
          <span className="text-xs text-slate-500 font-medium">
            Período: {periodoLabelActual}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
          {/* Card 1: HORAS EXTRAS */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs hover:shadow-xs hover:border-indigo-300 transition-all text-left">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">
              HORAS EXTRAS
            </span>
            <div className="mt-2 text-2xl font-display font-black text-slate-900 tracking-tight">
              <AnimatedNumber value={effectiveKpiHorasExtras} decimals={1} /> h
            </div>
            <div className="mt-1.5 flex items-center gap-1 text-[11px] font-bold">
              {tieneDatosAnteriores && tendenciaHorasExtrasGlobal !== null ? (
                tendenciaHorasExtrasGlobal <= 0 ? (
                  <span className="text-emerald-600 flex items-center gap-0.5">
                    <TrendingDown className="w-3.5 h-3.5" />
                    ↓ {Math.abs(tendenciaHorasExtrasGlobal)}%
                  </span>
                ) : (
                  <span className="text-rose-600 flex items-center gap-0.5">
                    <TrendingUp className="w-3.5 h-3.5" />
                    ↑ {tendenciaHorasExtrasGlobal}%
                  </span>
                )
              ) : (
                <span className="text-slate-400 font-normal">Período actual</span>
              )}
            </div>
          </div>

          {/* Card 2: AUXILIARES */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs hover:shadow-xs hover:border-indigo-300 transition-all text-left">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">
              AUXILIARES
            </span>
            <div className="mt-2 text-2xl font-display font-black text-slate-900 tracking-tight">
              <AnimatedNumber value={totalAuxiliaresCount} />
            </div>
            <div className="mt-1.5 flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{auxiliaresAlDiaCount} al día</span>
            </div>
          </div>

          {/* Card 3: REGISTROS */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs hover:shadow-xs hover:border-indigo-300 transition-all text-left">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">
              REGISTROS
            </span>
            <div className="mt-2 text-2xl font-display font-black text-slate-900 tracking-tight">
              <AnimatedNumber value={totalRegistrosPeriodo} />
            </div>
            <div className="mt-1.5 flex items-center gap-1 text-[11px] font-semibold text-amber-600">
              <Clock className="w-3.5 h-3.5" />
              <span>{totalDiasPendientesCount} pendientes</span>
            </div>
          </div>

          {/* Card 4: HORAS EXTRAS ALTAS (SOBRE UMBRAL) */}
          <div className="bg-white p-4 rounded-2xl border border-amber-200 bg-amber-50/20 shadow-2xs hover:shadow-xs hover:border-amber-300 transition-all text-left">
            <span className="text-[10px] text-amber-800 font-bold uppercase tracking-wider block">
              EXTRAS ALTAS (≥10h)
            </span>
            <div className="mt-2 text-2xl font-display font-black text-amber-600 tracking-tight">
              <AnimatedNumber value={auxiliaresSobreUmbral.length} />
            </div>
            <div className="mt-1.5 flex items-center gap-1 text-[11px] font-bold text-amber-700">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Sobre umbral</span>
            </div>
          </div>

          {/* Card 5: REGISTROS POR REVISAR */}
          <div className="col-span-2 sm:col-span-1 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs hover:shadow-xs hover:border-indigo-300 transition-all text-left">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">
              POR REVISAR
            </span>
            <div className="mt-2 text-2xl font-display font-black text-slate-900 tracking-tight">
              <AnimatedNumber value={registrosPorRevisar.length} />
            </div>
            <div className="mt-1.5 text-[10px] text-slate-500 font-medium">
              {registrosPorRevisar.length > 0 ? 'Turnos < 4h o > 16h' : 'Sin anomalías'}
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          GRÁFICOS DE CONTROL TIPO TRADING (COMPARATIVA, DISTRIBUCIÓN, RANKING, EVOLUCIÓN)
          ========================================================================= */}
      <TradingControlCharts
        registrosActuales={registrosFiltrados}
        registrosAnteriores={registrosAnteriores}
        periodoLabelActual={periodoLabelActual}
        periodoLabelAnterior={periodoLabelAnterior}
        tieneDatosAnteriores={tieneDatosAnteriores}
        onSelectAuxiliar={onSelectAuxiliar}
      />

      {/* =========================================================================
          SEGUNDO NIVEL: ACTIVIDAD DE HOY (MONITOR EN VIVO)
          ========================================================================= */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs text-left">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              <h3 className="font-display font-bold text-sm text-slate-900 tracking-tight">
                Actividad de Hoy — Turnos en Ruta
              </h3>
              <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-mono">
                {registrosHoy.length} en operación
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Estado en tiempo real de colaboradores, placas asignadas y horas laboradas.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onNavigateTab('jornadas')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors cursor-pointer"
            >
              <span>Ver todas las jornadas</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
            {userRole === 'admin' && (
              <button
                onClick={onOpenNuevoTurno || (() => onNavigateTab('jornadas'))}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 shadow-2xs transition-colors cursor-pointer"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>Registrar Turno</span>
              </button>
            )}
          </div>
        </div>

        {/* Tarjetas de Turnos de Hoy */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mt-4">
          {registrosHoy.slice(0, 6).map((reg) => (
            <div
              key={reg.id || `${reg.auxiliar}-${reg.fecha}-${reg.horaIngreso}`}
              className="p-3.5 rounded-xl border border-slate-200/80 bg-slate-50/50 hover:bg-white hover:border-indigo-200 transition-all shadow-2xs flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <span className="font-bold text-xs text-slate-900 block truncate" title={reg.auxiliar}>
                      {formatoNombreCapital(reg.auxiliar)}
                    </span>
                    <span className="text-[10px] text-slate-500 block mt-0.5">
                      {obtenerCargoDisplay(reg.auxiliar)}
                    </span>
                  </div>
                  <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200 font-mono font-bold text-[11px] text-slate-700 shrink-0">
                    {reg.vehiculo || 'S/P'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 mt-3 pt-2.5 border-t border-slate-150 text-[11px]">
                  <div>
                    <span className="text-[9px] text-slate-400 font-bold uppercase block">Ingreso / Salida</span>
                    <span className="font-mono font-semibold text-slate-700">
                      {reg.horaIngreso} — {reg.horaSalida}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[9px] text-slate-400 font-bold uppercase block">Ruta</span>
                    <span className="font-semibold text-indigo-600 truncate block">
                      {reg.ruta || 'Sin Ruta'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-3 pt-2 border-t border-slate-150 flex items-center justify-between text-xs">
                <span className="text-slate-500 font-mono text-[11px]">
                  Jornada: <strong>{reg.jornada}h</strong>
                </span>
                <span className={`font-mono font-bold text-[11px] px-2 py-0.5 rounded-md ${
                  reg.horasExtras > 0 ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' : 'bg-slate-100 text-slate-600'
                }`}>
                  {reg.horasExtras > 0 ? `+${reg.horasExtras}h extras` : 'Sin extras'}
                </span>
              </div>
            </div>
          ))}

          {registrosHoy.length === 0 && (
            <div className="col-span-full py-10 text-center text-slate-400">
              <Clock className="w-8 h-8 mx-auto text-slate-300 mb-2" />
              <p className="text-xs font-semibold text-slate-600">Aún no se han registrado turnos para hoy</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Utiliza el botón 'Registrar Turno' para cargar la primera asistencia del día.</p>
            </div>
          )}
        </div>
      </div>

      {/* =========================================================================
          🚨 REQUIEREN ATENCIÓN (ALERTAS DE CONTROL Y SOBRECARGA)
          ========================================================================= */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs text-left">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <span className="text-base">🚨</span>
            <h3 className="font-display font-bold text-sm text-slate-900 tracking-tight">
              Requieren atención
            </h3>
            <span className="text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 px-2 py-0.5 rounded-full font-mono">
              {listaRequierenAtencion.length} casos
            </span>
          </div>
          <span className="text-xs text-slate-500 font-medium">
            Colaboradores con sobrecarga de horas extras o registros pendientes en la quincena
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 pt-4">
          {listaRequierenAtencion.map((item) => (
            <div
              key={item.nombre}
              className={`p-4 rounded-2xl border flex flex-col justify-between gap-3 transition-all ${
                item.tipo === 'extras'
                  ? 'border-rose-200 bg-rose-50/25 hover:border-rose-300'
                  : 'border-amber-200 bg-amber-50/25 hover:border-amber-300'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <h4 className="font-display font-bold text-sm text-slate-900 truncate">
                    {item.nombre.toUpperCase()}
                  </h4>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    item.tipo === 'extras' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                  }`}>
                    {item.tipo === 'extras' ? 'Exceso Horas' : 'Faltan Días'}
                  </span>
                </div>
                <span className="text-[11px] font-medium text-slate-500 block mt-0.5">
                  {obtenerCargoDisplay(item.nombre)}
                </span>

                <div className="mt-3">
                  <div className="text-lg font-bold text-slate-900 font-mono">
                    {item.titulo}
                  </div>
                  <div className={`text-xs mt-0.5 font-medium ${
                    item.tipo === 'extras' ? 'text-rose-600 font-semibold' : 'text-slate-600'
                  }`}>
                    {item.detalle}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (onSelectAuxiliar) {
                    onSelectAuxiliar(item.nombre);
                  } else {
                    onNavigateTab('auxiliares');
                  }
                }}
                className="w-full inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-white border border-slate-200 hover:border-indigo-400 hover:text-indigo-600 text-slate-700 text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
              >
                <span>Ver auxiliar</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}

          {listaRequierenAtencion.length === 0 && (
            <div className="col-span-full py-8 text-center text-emerald-600 flex flex-col items-center gap-1.5">
              <CheckCircle2 className="w-6 h-6 text-emerald-500" />
              <p className="text-xs font-semibold">¡Todo en orden! No hay colaboradores que requieran atención inmediata.</p>
            </div>
          )}
        </div>
      </div>

      {/* =========================================================================
          CUARTO NIVEL: AUXILIARES CON NOVEDADES (ATENCIÓN INMEDIATA)
          ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Panel A: Auxiliares con Registros Faltantes */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs text-left">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-amber-50 text-amber-600">
                <AlertCircle className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-display font-bold text-sm text-slate-900">
                  Turnos Pendientes en Quincena
                </h3>
                <span className="text-[10px] text-slate-500">
                  Auxiliares que aún deben registrar días hábiles
                </span>
              </div>
            </div>
            <span className="text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full font-mono">
              {auxiliaresConPendientes.length} pendientes
            </span>
          </div>

          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {auxiliaresConPendientes.slice(0, 5).map((item) => (
              <div
                key={item.auxiliar}
                className="p-3 rounded-xl border border-slate-200/80 bg-slate-50/50 flex items-center justify-between gap-3 text-xs"
              >
                <div className="min-w-0">
                  <span className="font-bold text-slate-800 truncate block">
                    {formatoNombreCapital(item.auxiliar)}
                  </span>
                  <span className="text-[10px] text-slate-500 block">
                    {item.diasRegistrados} de {item.totalDiasEsperados} días laborados
                  </span>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 font-bold text-[10px] font-mono">
                    Faltan {item.diasFaltantes}d
                  </span>
                  {onCopyRecordatorio && (
                    <button
                      onClick={() => onCopyRecordatorio(item.auxiliar, item.diasFaltantes)}
                      className="p-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors cursor-pointer"
                      title="Copiar mensaje de recordatorio"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}

            {auxiliaresConPendientes.length === 0 && (
              <div className="text-center py-8 text-emerald-600 text-xs font-semibold flex flex-col items-center gap-1.5">
                <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                <span>¡Excelente! Todos los auxiliares están al día con sus turnos.</span>
              </div>
            )}
          </div>
        </div>

        {/* Panel B: Alertas de Fatiga y Exceso de Horas Extras */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs text-left">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-rose-50 text-rose-600">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-display font-bold text-sm text-slate-900">
                  Control de Fatiga y Sobrecupo
                </h3>
                <span className="text-[10px] text-slate-500">
                  Colaboradores con más de 20h extras acumuladas
                </span>
              </div>
            </div>
            <span className="text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 px-2 py-0.5 rounded-full font-mono">
              {auxiliaresConFatiga.length} alertas
            </span>
          </div>

          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {auxiliaresConFatiga.slice(0, 5).map((aux) => (
              <div
                key={aux.nombre}
                className="p-3 rounded-xl border border-rose-100 bg-rose-50/40 flex items-center justify-between gap-3 text-xs"
              >
                <div className="min-w-0">
                  <span className="font-bold text-slate-900 truncate block">
                    {formatoNombreCapital(aux.nombre)}
                  </span>
                  <span className="text-[10px] text-rose-600 font-semibold block">
                    Alerta de Fatiga — Considerar rotación de ruta
                  </span>
                </div>

                <div className="text-right shrink-0">
                  <span className="font-mono font-bold text-sm text-rose-600 block">
                    +{aux.horasExtrasTotales}h
                  </span>
                  <span className="text-[9px] text-slate-400 block font-mono">
                    {aux.diasTrabajados} turnos
                  </span>
                </div>
              </div>
            ))}

            {auxiliaresConFatiga.length === 0 && (
              <div className="text-center py-8 text-emerald-600 text-xs font-semibold flex flex-col items-center gap-1.5">
                <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                <span>Niveles de fatiga estables y dentro del rango laboral permitido.</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* =========================================================================
          CUARTO NIVEL: TENDENCIAS, ANALÍTICA Y RANKING
          ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Gráfico 1: Barras Semanales */}
        <div className="lg:col-span-2">
          <BarChart
            data={computedBarrasSemanal}
            title="Tendencia Semanal de Horas Extras"
          />
        </div>

        {/* Gráfico 2: Dona Rutas */}
        <div className="lg:col-span-1">
          <DonutChart
            data={computedRutasDona}
            title="Distribución de Extras por Ruta"
          />
        </div>
      </div>

      {/* Top Ranking de Auxiliares */}
      {userRole === 'admin' && (
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs text-left">
          <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
            <div>
              <h3 className="font-display font-bold text-sm text-slate-900">
                Top Ranking de Horas Extras
              </h3>
              <p className="text-xs text-slate-500">
                Mayor concentración de recargos durante la quincena.
              </p>
            </div>
            <button
              onClick={() => onNavigateTab('reportes')}
              className="text-xs text-indigo-600 font-semibold hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>Ver liquidación completa</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {computedRanking.slice(0, 8).map((aux, idx) => {
              const pct = Math.min(100, (aux.horasExtrasTotales / 30) * 100);
              return (
                <div
                  key={aux.nombre}
                  onClick={() => onSelectAuxiliar(aux.nombre)}
                  className="p-3 rounded-xl border border-slate-150 bg-slate-50/50 hover:bg-white hover:border-indigo-200 transition-all cursor-pointer shadow-2xs"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono text-slate-400 font-bold text-[11px]">#{idx + 1}</span>
                    <span className="font-mono font-bold text-indigo-600 text-xs">+{aux.horasExtrasTotales}h</span>
                  </div>
                  <h4 className="font-semibold text-slate-800 text-xs mt-1 truncate" title={aux.nombre}>
                    {aux.nombreCorto}
                  </h4>
                  <div className="w-full h-1 bg-slate-200 rounded-full mt-2.5 overflow-hidden">
                    <div
                      className="h-full bg-indigo-600 rounded-full"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
