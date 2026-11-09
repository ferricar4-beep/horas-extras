import React, { useState, useMemo } from 'react';
import {
  FileSpreadsheet,
  Download,
  Calendar,
  Clock,
  Users,
  Search,
  CheckCircle2,
  TrendingUp,
  MapPin,
  Printer
} from 'lucide-react';
import { AuxiliarStats, Registro, PeriodoFiltro } from '../types';
import { formatoNombreCapital, obtenerCargoDisplay } from '../utils';

interface ReportesViewProps {
  statsAuxiliares: AuxiliarStats[];
  allRegistros?: Registro[];
  registrosFiltrados?: Registro[];
  filtroPeriodo: PeriodoFiltro;
  setFiltroPeriodo?: (p: PeriodoFiltro) => void;
  filtroMes?: number;
  setFiltroMes?: (m: number) => void;
  filtroAno?: number;
  setFiltroAno?: (a: number) => void;
  fechaInicioCustom?: string;
  setFechaInicioCustom?: (f: string) => void;
  fechaFinCustom?: string;
  setFechaFinCustom?: (f: string) => void;
  rangoFechasActivo?: { inicio: Date; fin: Date };
  rangoFechas?: { inicio: Date; fin: Date };
  diasHabilesEsperados?: number;
  onExportExcel: () => void;
  searchTermExterno?: string;
}

export const ReportesView: React.FC<ReportesViewProps> = ({
  statsAuxiliares,
  allRegistros,
  registrosFiltrados,
  filtroPeriodo,
  setFiltroPeriodo,
  filtroMes,
  setFiltroMes,
  filtroAno,
  setFiltroAno,
  fechaInicioCustom,
  setFechaInicioCustom,
  fechaFinCustom,
  setFechaFinCustom,
  rangoFechasActivo,
  rangoFechas,
  diasHabilesEsperados = 15,
  onExportExcel,
  searchTermExterno,
}) => {
  const [searchTerm, setSearchTerm] = useState(searchTermExterno || '');

  // Sincronizar si cambia el término de búsqueda global del header
  React.useEffect(() => {
    if (searchTermExterno !== undefined) {
      setSearchTerm(searchTermExterno);
    }
  }, [searchTermExterno]);

  const effectiveRegistros = allRegistros || registrosFiltrados || [];
  const effectiveRango = useMemo(() => {
    const r = rangoFechasActivo || rangoFechas;
    if (r && r.inicio && r.fin) {
      return {
        inicio: r.inicio instanceof Date ? r.inicio : new Date(r.inicio),
        fin: r.fin instanceof Date ? r.fin : new Date(r.fin),
      };
    }
    return { inicio: new Date(), fin: new Date() };
  }, [rangoFechasActivo, rangoFechas]);

  const effectiveSearch = searchTerm.trim().toLowerCase();

  // Lista filtrada en tiempo real por nombre, nombre corto o cargo
  const filteredStats = useMemo(() => {
    if (!effectiveSearch) return statsAuxiliares;
    return statsAuxiliares.filter(s => {
      const cargo = (obtenerCargoDisplay(s.nombre) || '').toLowerCase();
      return (
        s.nombre.toLowerCase().includes(effectiveSearch) ||
        s.nombreCorto.toLowerCase().includes(effectiveSearch) ||
        cargo.includes(effectiveSearch)
      );
    });
  }, [statsAuxiliares, effectiveSearch]);

  // Estadísticas consolidadas: se actualizan dinámicamente cuando el usuario busca o filtra
  const totales = useMemo(() => {
    let horasTotales = 0;
    let horasExtras = 0;
    let turnosTotales = 0;

    filteredStats.forEach(a => {
      horasTotales += a.jornadaTotal;
      horasExtras += a.horasExtrasTotales;
      turnosTotales += a.diasTrabajados;
    });

    return {
      horasTotales: Math.round(horasTotales * 10) / 10,
      horasExtras: Math.round(horasExtras * 10) / 10,
      turnosTotales,
      colaboradores: filteredStats.length,
    };
  }, [filteredStats]);

  return (
    <div className="space-y-6 text-left">
      {/* 1. Header con CTA de Exportación */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100">
              <FileSpreadsheet className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-lg font-display font-bold text-slate-900 tracking-tight">
                Consolidado de Liquidación y Horas Extras
              </h2>
              <p className="text-xs text-slate-500">
                Auditoría quincenal para cálculo salarial y nómina de distribución.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
          >
            <Printer className="w-4 h-4 text-slate-500" />
            <span className="hidden sm:inline">Imprimir</span>
          </button>

          <button
            onClick={onExportExcel}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs shadow-emerald-600/30 transition-all cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Exportar Planilla a Excel</span>
          </button>
        </div>
      </div>

      {/* 2. Selector de Período y Tarjetas de Resumen Global */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-indigo-600" />
          <span className="text-xs font-bold text-slate-800">
            {effectiveRango.inicio.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })} — {effectiveRango.fin.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })}
          </span>
          <span className="text-[10px] text-slate-400 font-semibold">
            ({diasHabilesEsperados} días hábiles esperados)
          </span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={filtroPeriodo}
            onChange={(e) => setFiltroPeriodo && setFiltroPeriodo(e.target.value as PeriodoFiltro)}
            className="text-xs bg-slate-50 border border-slate-200 text-slate-700 py-1.5 px-3 rounded-xl focus:ring-2 focus:ring-indigo-500/20 font-semibold cursor-pointer"
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
              onChange={(e) => setFiltroMes && setFiltroMes(parseInt(e.target.value, 10))}
              className="text-xs bg-slate-50 border border-slate-200 text-slate-700 py-1.5 px-3 rounded-xl focus:ring-2 focus:ring-indigo-500/20 font-semibold cursor-pointer"
            >
              <option value={0}>Enero 2026</option>
              <option value={1}>Febrero 2026</option>
              <option value={2}>Marzo 2026</option>
              <option value={3}>Abril 2026</option>
              <option value={4}>Mayo 2026</option>
              <option value={5}>Junio 2026</option>
              <option value={6}>Julio 2026</option>
              <option value={7}>Agosto 2026</option>
              <option value={8}>Septiembre 2026</option>
              <option value={9}>Octubre 2026</option>
              <option value={10}>Noviembre 2026</option>
              <option value={11}>Diciembre 2026</option>
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

      {/* Tarjetas KPI de Totales */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Colaboradores</span>
          <span className="text-2xl font-display font-black text-slate-900 mt-1 block font-mono">{totales.colaboradores}</span>
          <span className="text-[10px] text-slate-500 font-medium mt-1 block">Con turnos liquidados</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Días / Jornadas</span>
          <span className="text-2xl font-display font-black text-slate-900 mt-1 block font-mono">{totales.turnosTotales}</span>
          <span className="text-[10px] text-slate-500 font-medium mt-1 block">Asistencias acumuladas</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Horas Laboradas</span>
          <span className="text-2xl font-display font-black text-slate-900 mt-1 block font-mono">{totales.horasTotales}h</span>
          <span className="text-[10px] text-slate-500 font-medium mt-1 block">Jornada ordinaria + extras</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-indigo-200 bg-indigo-50/20 shadow-2xs">
          <span className="text-[10px] text-indigo-600 font-bold uppercase tracking-wider block">Total Horas Extras</span>
          <span className="text-2xl font-display font-black text-indigo-700 mt-1 block font-mono">+{totales.horasExtras}h</span>
          <span className="text-[10px] text-indigo-600 font-medium mt-1 block">A liquidar en nómina</span>
        </div>
      </div>

      {/* 3. Tabla Consolidada por Auxiliar */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-slate-150 flex items-center justify-between gap-3">
          <div className="relative flex-1 max-w-xs">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Filtrar por auxiliar..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl pl-8.5 pr-3 py-1.5 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-medium"
            />
          </div>
          <span className="text-xs text-slate-400 font-mono font-semibold">
            {filteredStats.length} colaboradores
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200/80 font-bold text-slate-500 uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4">#</th>
                <th className="py-3 px-4">Colaborador</th>
                <th className="py-3 px-3">Cargo Operacional</th>
                <th className="py-3 px-3 text-right">Días Laborados</th>
                <th className="py-3 px-3 text-right">Jornada Total</th>
                <th className="py-3 px-3 text-right">Promedio Diario</th>
                <th className="py-3 px-4 text-right">Horas Extras a Liquidar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {filteredStats.map((aux, idx) => (
                <tr key={aux.nombre} className="hover:bg-slate-50/60 transition-colors">
                  <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">{idx + 1}</td>

                  <td className="py-3 px-4">
                    <span className="font-bold text-slate-900 block truncate max-w-[220px]" title={aux.nombre}>
                      {formatoNombreCapital(aux.nombre)}
                    </span>
                  </td>

                  <td className="py-3 px-3">
                    <span className="text-[11px] text-slate-600">
                      {obtenerCargoDisplay(aux.nombre)}
                    </span>
                  </td>

                  <td className="py-3 px-3 text-right font-mono font-bold text-slate-800">
                    {aux.diasTrabajados} días
                  </td>

                  <td className="py-3 px-3 text-right font-mono text-slate-700">
                    {aux.jornadaTotal}h
                  </td>

                  <td className="py-3 px-3 text-right font-mono text-slate-600">
                    {aux.promedioHorasExtras}h / día
                  </td>

                  <td className="py-3 px-4 text-right">
                    <span className={`font-mono font-bold px-2.5 py-1 rounded-lg text-xs ${
                      aux.horasExtrasTotales > 0
                        ? 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                        : 'bg-slate-100 text-slate-500'
                    }`}>
                      +{aux.horasExtrasTotales}h
                    </span>
                  </td>
                </tr>
              ))}

              {filteredStats.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <FileSpreadsheet className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                    <p className="text-xs font-semibold text-slate-600">No hay datos en el período seleccionado</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
