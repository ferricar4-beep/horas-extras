import React, { useState, useMemo } from 'react';
import {
  AlertTriangle,
  AlertCircle,
  Clock,
  Users,
  Copy,
  CheckCircle2,
  ChevronRight,
  Send,
  Calendar,
  Sparkles,
  Search,
  Filter,
  Flame,
  UserX,
  RotateCcw
} from 'lucide-react';
import { AuxiliarStats, Registro, NavTab, PeriodoFiltro } from '../types';
import { formatoNombreCapital, obtenerCargoDisplay } from '../utils';

interface AlertasViewProps {
  statsAuxiliares: AuxiliarStats[];
  allRegistros?: Registro[];
  registros?: Registro[];
  reporteFaltas: any[];
  onNavigateTab: (tab: NavTab) => void;
  onSelectAuxiliar?: (aux: string) => void;
  onCopyRecordatorio?: (auxiliar: string, diasFaltantes: number) => void;
  diasHabilesEsperados?: number;
  filtroPeriodo?: PeriodoFiltro;
  setFiltroPeriodo?: (periodo: PeriodoFiltro) => void;
  filtroMes?: number;
  setFiltroMes?: (mes: number) => void;
  filtroAno?: number;
  setFiltroAno?: (ano: number) => void;
  fechaInicioCustom?: string;
  setFechaInicioCustom?: (fecha: string) => void;
  fechaFinCustom?: string;
  setFechaFinCustom?: (fecha: string) => void;
  rangoFechasActivo?: { inicio: Date; fin: Date };
}

export const AlertasView: React.FC<AlertasViewProps> = ({
  statsAuxiliares,
  allRegistros,
  registros,
  reporteFaltas = [],
  onNavigateTab,
  onSelectAuxiliar,
  onCopyRecordatorio,
  diasHabilesEsperados = 15,
  filtroPeriodo = 'quincena_2',
  setFiltroPeriodo,
  filtroMes = 6,
  setFiltroMes,
  filtroAno = 2026,
  setFiltroAno,
  fechaInicioCustom = '',
  setFechaInicioCustom,
  fechaFinCustom = '',
  setFechaFinCustom,
  rangoFechasActivo,
}) => {
  const [filterType, setFilterType] = useState<'todos' | 'faltas' | 'fatiga' | 'duracion'>('todos');
  const [copiadoId, setCopiadoId] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState<string>('');

  const effectiveRegistros = allRegistros || registros || [];

  // Rango activo seguro
  const effectiveRango = useMemo(() => {
    if (rangoFechasActivo && rangoFechasActivo.inicio && rangoFechasActivo.fin) {
      return {
        inicio: rangoFechasActivo.inicio instanceof Date ? rangoFechasActivo.inicio : new Date(rangoFechasActivo.inicio),
        fin: rangoFechasActivo.fin instanceof Date ? rangoFechasActivo.fin : new Date(rangoFechasActivo.fin),
      };
    }
    return {
      inicio: new Date(filtroAno, filtroMes, 1),
      fin: new Date(filtroAno, filtroMes + 1, 0)
    };
  }, [rangoFechasActivo, filtroAno, filtroMes]);

  const searchClean = busqueda.trim().toLowerCase();

  // 1. Auxiliares con días faltantes (filtrados también por búsqueda)
  const faltas = useMemo(() => {
    return (reporteFaltas || [])
      .map(r => ({
        auxiliar: r.auxiliar,
        diasFaltantes: typeof r.diasFaltantes === 'number' ? r.diasFaltantes : (r.totalFaltantes ?? 0),
        diasRegistrados: typeof r.diasRegistrados === 'number' ? r.diasRegistrados : (r.totalRegistrados ?? 0),
        totalDiasEsperados: r.totalDiasEsperados ?? diasHabilesEsperados,
      }))
      .filter(r => r.diasFaltantes > 0)
      .filter(r => !searchClean || r.auxiliar.toLowerCase().includes(searchClean));
  }, [reporteFaltas, diasHabilesEsperados, searchClean]);

  // 2. Auxiliares con alerta de fatiga (> 20 horas extras)
  const fatiga = useMemo(() => {
    return statsAuxiliares
      .filter(a => a.horasExtrasTotales > 20)
      .filter(a => !searchClean || a.nombre.toLowerCase().includes(searchClean));
  }, [statsAuxiliares, searchClean]);

  // 3. Turnos con duración inusual (> 12 horas en un solo turno)
  const jornadasProlongadas = useMemo(() => {
    return effectiveRegistros
      .filter(r => r.jornada > 12)
      .filter(r => !searchClean || r.auxiliar.toLowerCase().includes(searchClean) || (r.ruta && r.ruta.toLowerCase().includes(searchClean)));
  }, [effectiveRegistros, searchClean]);

  // Total novedades
  const totalNovedades = faltas.length + fatiga.length + jornadasProlongadas.length;

  const handleCopyWhatsapp = (auxiliar: string, diasFaltantes: number) => {
    if (onCopyRecordatorio) {
      onCopyRecordatorio(auxiliar, diasFaltantes);
    }
    const texto = `Hola ${formatoNombreCapital(auxiliar)}, desde la coordinación de FERRICAR te recordamos que tienes ${diasFaltantes} turno(s) pendiente(s) por registrar en la planilla quincenal. Por favor ingresa a la app para ponerte al día. ¡Gracias!`;
    navigator.clipboard.writeText(texto);
    setCopiadoId(auxiliar);
    setTimeout(() => setCopiadoId(null), 2500);
  };

  return (
    <div className="space-y-6 text-left">
      {/* 1. Header con Resumen de Situación Operacional */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-rose-50 text-rose-600 border border-rose-100">
              <AlertTriangle className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-lg font-display font-bold text-slate-900 tracking-tight">
                Panel de Novedades y Supervisión Activa
              </h2>
              <p className="text-xs text-slate-500">
                Identifica ausencias, retrasos en registros y sobrecargas de horas en tiempo real.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className={`px-3 py-1.5 rounded-xl text-xs font-bold font-mono border ${
            totalNovedades > 0
              ? 'bg-rose-50 text-rose-700 border-rose-200'
              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
          }`}>
            {totalNovedades > 0 ? `${totalNovedades} novedades activas` : 'Sin novedades pendientes'}
          </span>
        </div>
      </div>

      {/* 2. Barra de Filtro de Fechas y Períodos */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Indicador de Rango Activo */}
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-100">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                Período Auditado
              </span>
              <span className="text-xs font-bold text-slate-800">
                {effectiveRango.inicio.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })} — {effectiveRango.fin.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
              <span className="text-[10px] text-indigo-600 font-semibold ml-2">
                ({diasHabilesEsperados} días hábiles esperados)
              </span>
            </div>
          </div>

          {/* Selectores de Período y Búsqueda */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Buscador de Auxiliar */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar colaborador..."
                className="text-xs bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-1.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 w-44 font-medium"
              />
            </div>

            {/* Selector de Período */}
            {setFiltroPeriodo && (
              <select
                value={filtroPeriodo}
                onChange={(e) => setFiltroPeriodo(e.target.value as PeriodoFiltro)}
                className="text-xs bg-slate-50 border border-slate-200 text-slate-700 py-1.5 px-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-semibold cursor-pointer"
              >
                <option value="quincena_1">1ra Quincena (1 al 15)</option>
                <option value="quincena_2">2da Quincena (16 al fin)</option>
                <option value="este_mes">Mes Completo</option>
                <option value="ultimos_15_dias">Últimos 15 días</option>
                <option value="custom">Rango Personalizado</option>
                <option value="todo">Historial Completo</option>
              </select>
            )}

            {/* Selector de Mes */}
            {setFiltroMes && (filtroPeriodo === 'quincena_1' || filtroPeriodo === 'quincena_2' || filtroPeriodo === 'este_mes') && (
              <select
                value={filtroMes}
                onChange={(e) => setFiltroMes(parseInt(e.target.value, 10))}
                className="text-xs bg-slate-50 border border-slate-200 text-slate-700 py-1.5 px-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-semibold cursor-pointer"
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

            {busqueda && (
              <button
                onClick={() => setBusqueda('')}
                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-500 transition-colors"
                title="Limpiar búsqueda"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Inputs de Fecha Personalizada si se elige 'custom' */}
        {filtroPeriodo === 'custom' && setFechaInicioCustom && setFechaFinCustom && (
          <div className="flex items-center gap-3 pt-3 border-t border-slate-150 flex-wrap bg-slate-50/50 p-2.5 rounded-xl">
            <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-indigo-600" />
              Selecciona la fecha que quieras auditar:
            </span>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-slate-500 uppercase">Desde:</span>
              <input
                type="date"
                value={fechaInicioCustom}
                onChange={(e) => setFechaInicioCustom(e.target.value)}
                className="text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-slate-700 font-medium focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-slate-500 uppercase">Hasta:</span>
              <input
                type="date"
                value={fechaFinCustom}
                onChange={(e) => setFechaFinCustom(e.target.value)}
                className="text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-slate-700 font-medium focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
          </div>
        )}
      </div>

      {/* 2. Tarjetas de Diagnóstico Rápido */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div
          onClick={() => setFilterType('faltas')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            filterType === 'faltas'
              ? 'bg-amber-50/50 border-amber-300 ring-2 ring-amber-500/20 shadow-xs'
              : 'bg-white border-slate-200/80 hover:border-amber-200 shadow-2xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              Turnos Pendientes
            </span>
            <div className="p-1.5 rounded-lg bg-amber-50 text-amber-600">
              <UserX className="w-4 h-4" />
            </div>
          </div>
          <span className="text-2xl font-display font-black text-amber-600 mt-2 block font-mono">
            {faltas.length} colaboradores
          </span>
          <span className="text-[11px] text-slate-500 mt-1 block">
            Deben días de registro en la quincena
          </span>
        </div>

        <div
          onClick={() => setFilterType('fatiga')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            filterType === 'fatiga'
              ? 'bg-rose-50/50 border-rose-300 ring-2 ring-rose-500/20 shadow-xs'
              : 'bg-white border-slate-200/80 hover:border-rose-200 shadow-2xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              Control de Fatiga
            </span>
            <div className="p-1.5 rounded-lg bg-rose-50 text-rose-600">
              <Flame className="w-4 h-4" />
            </div>
          </div>
          <span className="text-2xl font-display font-black text-rose-600 mt-2 block font-mono">
            {fatiga.length} alertas
          </span>
          <span className="text-[11px] text-slate-500 mt-1 block">
            Superan las 20h extras acumuladas
          </span>
        </div>

        <div
          onClick={() => setFilterType('duracion')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            filterType === 'duracion'
              ? 'bg-purple-50/50 border-purple-300 ring-2 ring-purple-500/20 shadow-xs'
              : 'bg-white border-slate-200/80 hover:border-purple-200 shadow-2xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              Jornadas Excesivas
            </span>
            <div className="p-1.5 rounded-lg bg-purple-50 text-purple-600">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <span className="text-2xl font-display font-black text-purple-600 mt-2 block font-mono">
            {jornadasProlongadas.length} turnos
          </span>
          <span className="text-[11px] text-slate-500 mt-1 block">
            Jornadas individuales mayores a 12 horas
          </span>
        </div>
      </div>

      {/* 3. Filtros por Píldoras */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setFilterType('todos')}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
            filterType === 'todos' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          Todas las Novedades ({totalNovedades})
        </button>
        <button
          onClick={() => setFilterType('faltas')}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
            filterType === 'faltas' ? 'bg-amber-600 text-white' : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
          }`}
        >
          Turnos Faltantes ({faltas.length})
        </button>
        <button
          onClick={() => setFilterType('fatiga')}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
            filterType === 'fatiga' ? 'bg-rose-600 text-white' : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
          }`}
        >
          Fatiga y Horas ({fatiga.length})
        </button>
        <button
          onClick={() => setFilterType('duracion')}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
            filterType === 'duracion' ? 'bg-purple-600 text-white' : 'bg-purple-50 text-purple-700 hover:bg-purple-100'
          }`}
        >
          Jornadas &gt;12h ({jornadasProlongadas.length})
        </button>
      </div>

      {/* 4. Lista Detallada de Novedades */}
      <div className="space-y-4">
        {/* SECCIÓN A: TURNOS FALTANTES - REVISAR */}
        {(filterType === 'todos' || filterType === 'faltas') && faltas.length > 0 && (
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-500" />
                <span>Colaboradores con Turnos Pendientes por Registrar</span>
              </h3>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                REVISAR
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {faltas.map((item) => (
                <div
                  key={item.auxiliar}
                  className="p-3.5 rounded-xl border border-amber-200/80 bg-amber-50/20 flex items-center justify-between gap-3"
                >
                  <div>
                    <span className="font-bold text-xs text-slate-900 block">
                      {formatoNombreCapital(item.auxiliar)}
                    </span>
                    <span className="text-[10px] text-slate-500 block mt-0.5">
                      {item.diasRegistrados} de {item.totalDiasEsperados} días hábiles registrados
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 font-mono font-bold text-[10px]">
                      Faltan {item.diasFaltantes}d
                    </span>

                    <button
                      onClick={() => handleCopyWhatsapp(item.auxiliar, item.diasFaltantes)}
                      className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-colors cursor-pointer"
                      title="Copiar mensaje para WhatsApp"
                    >
                      {copiadoId === item.auxiliar ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SECCIÓN B: CONTROL DE FATIGA - ATENCIÓN */}
        {(filterType === 'todos' || filterType === 'fatiga') && fatiga.length > 0 && (
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                <Flame className="w-4 h-4 text-rose-500" />
                <span>Control de Fatiga — Exceso de Horas Extras (&gt;20h)</span>
              </h3>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-200">
                ATENCIÓN
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {fatiga.map((aux) => (
                <div
                  key={aux.nombre}
                  className="p-3.5 rounded-xl border border-rose-200/80 bg-rose-50/20 flex items-center justify-between gap-3"
                >
                  <div>
                    <span className="font-bold text-xs text-slate-900 block">
                      {formatoNombreCapital(aux.nombre)}
                    </span>
                    <span className="text-[10px] text-rose-600 font-semibold block mt-0.5">
                      {aux.diasTrabajados} jornadas laboradas en el período
                    </span>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-sm font-bold font-mono text-rose-600 block">
                      +{aux.horasExtrasTotales}h extras
                    </span>
                    <span className="text-[9px] text-slate-400 block font-mono">
                      {aux.jornadaTotal}h totales
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SECCIÓN C: JORNADAS PROLONGADAS - ATENCIÓN / REVISAR */}
        {(filterType === 'todos' || filterType === 'duracion') && jornadasProlongadas.length > 0 && (
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                <Clock className="w-4 h-4 text-purple-500" />
                <span>Turnos Individuales con Jornada Superior a 12 Horas</span>
              </h3>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                REVISAR
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {jornadasProlongadas.slice(0, 8).map((reg) => {
                const esCritico = reg.jornada >= 14;
                return (
                  <div
                    key={reg.id || `${reg.auxiliar}-${reg.fecha}`}
                    className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 text-xs ${
                      esCritico
                        ? 'border-rose-200 bg-rose-50/30'
                        : 'border-purple-200/80 bg-purple-50/20'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 block">
                          {formatoNombreCapital(reg.auxiliar)}
                        </span>
                        {esCritico && (
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-rose-100 text-rose-700 font-mono">
                            ATENCIÓN
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-500 block mt-0.5">
                        {reg.fecha} • {reg.horaIngreso} - {reg.horaSalida} ({reg.ruta || 'Sin Ruta'})
                      </span>
                    </div>

                    <div className="text-right shrink-0">
                      <span className={`font-mono font-bold text-xs block ${esCritico ? 'text-rose-700' : 'text-purple-700'}`}>
                        {reg.jornada} horas
                      </span>
                      <span className="text-[10px] text-purple-600 font-mono font-bold">
                        +{reg.horasExtras}h extras
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* SECCIÓN D: INFORMATIVO - RESUMEN DE CUMPLIMIENTO */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
            <div>
              <span className="text-xs font-bold text-slate-800">
                Auditoría Automática de Reglas Operativas
              </span>
              <p className="text-[11px] text-slate-500">
                Límite de jornada legal estándar: 8h ordinarias. Detección automática de fatiga quincenal &gt; 20h extras y alertas de turno individual prolongado &gt; 12h.
              </p>
            </div>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
            INFORMATIVO
          </span>
        </div>

        {totalNovedades === 0 && (
          <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center text-slate-400">
            <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-500 mb-3" />
            <h3 className="text-sm font-bold text-slate-800">Operación en Estado Óptimo</h3>
            <p className="text-xs text-slate-500 mt-1">
              Todos los colaboradores están al día con sus turnos y dentro de los límites de horas permitidos.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
