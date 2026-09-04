import React, { useMemo, useState } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  BarChart3,
  Clock,
  Users,
  Calendar,
  AlertCircle,
  HelpCircle,
  Activity,
  ArrowRight
} from 'lucide-react';
import { Registro } from '../types';
import { formatoNombreCapital, parseFecha } from '../utils';

interface TradingControlChartsProps {
  registrosActuales: Registro[];
  registrosAnteriores: Registro[];
  periodoLabelActual: string;
  periodoLabelAnterior: string;
  tieneDatosAnteriores: boolean;
  onSelectAuxiliar?: (nombre: string) => void;
}

export const TradingControlCharts: React.FC<TradingControlChartsProps> = ({
  registrosActuales = [],
  registrosAnteriores = [],
  periodoLabelActual,
  periodoLabelAnterior,
  tieneDatosAnteriores,
  onSelectAuxiliar,
}) => {
  const [hoveredAux, setHoveredAux] = useState<string | null>(null);

  // -------------------------------------------------------------
  // 1. COMPARATIVA: PERÍODO ANTERIOR VS PERÍODO ACTUAL
  // -------------------------------------------------------------
  const comparativa = useMemo(() => {
    let horasActual = 0;
    let horasAnterior = 0;

    registrosActuales.forEach(r => {
      horasActual += r.horasExtras || 0;
    });

    registrosAnteriores.forEach(r => {
      horasAnterior += r.horasExtras || 0;
    });

    horasActual = Math.round(horasActual * 10) / 10;
    horasAnterior = Math.round(horasAnterior * 10) / 10;

    const diff = Math.round((horasActual - horasAnterior) * 10) / 10;
    let pct: number | null = null;
    if (horasAnterior > 0) {
      pct = Math.round(((horasActual - horasAnterior) / horasAnterior) * 1000) / 10;
    } else if (horasActual > 0 && tieneDatosAnteriores) {
      pct = 100;
    }

    const maxVal = Math.max(horasActual, horasAnterior, 10);
    const pctActualBar = Math.min(100, Math.round((horasActual / maxVal) * 100));
    const pctAnteriorBar = Math.min(100, Math.round((horasAnterior / maxVal) * 100));

    return {
      horasActual,
      horasAnterior,
      diff,
      pct,
      pctActualBar,
      pctAnteriorBar,
    };
  }, [registrosActuales, registrosAnteriores, tieneDatosAnteriores]);

  // -------------------------------------------------------------
  // 2. HORAS NORMALES VS HORAS EXTRAS
  // -------------------------------------------------------------
  const horasDistribucion = useMemo(() => {
    let totalJornada = 0;
    let totalExtras = 0;

    registrosActuales.forEach(r => {
      totalJornada += r.jornada || 0;
      totalExtras += r.horasExtras || 0;
    });

    totalJornada = Math.round(totalJornada * 10) / 10;
    totalExtras = Math.round(totalExtras * 10) / 10;
    const totalNormales = Math.max(0, Math.round((totalJornada - totalExtras) * 10) / 10);

    const pctNormales = totalJornada > 0 ? Math.round((totalNormales / totalJornada) * 100) : 0;
    const pctExtras = totalJornada > 0 ? 100 - pctNormales : 0;

    return {
      totalJornada,
      totalNormales,
      totalExtras,
      pctNormales,
      pctExtras,
    };
  }, [registrosActuales]);

  // -------------------------------------------------------------
  // 3. RANKING DE HORAS EXTRAS POR AUXILIAR
  // -------------------------------------------------------------
  const rankingAuxiliares = useMemo(() => {
    const map: Record<string, { horasExtras: number; jornada: number; turnos: number }> = {};

    registrosActuales.forEach(r => {
      const nom = r.auxiliar.trim().toUpperCase();
      if (!map[nom]) {
        map[nom] = { horasExtras: 0, jornada: 0, turnos: 0 };
      }
      map[nom].horasExtras += r.horasExtras || 0;
      map[nom].jornada += r.jornada || 0;
      map[nom].turnos += 1;
    });

    const list = Object.entries(map).map(([nombre, stats]) => ({
      nombre,
      horasExtras: Math.round(stats.horasExtras * 10) / 10,
      jornada: Math.round(stats.jornada * 10) / 10,
      turnos: stats.turnos,
    }));

    // Ordenar de mayor a menor horas extras
    list.sort((a, b) => b.horasExtras - a.horasExtras);
    const maxExtras = list.length > 0 ? Math.max(list[0].horasExtras, 1) : 1;

    return {
      items: list,
      maxExtras,
    };
  }, [registrosActuales]);

  // -------------------------------------------------------------
  // 4. EVOLUCIÓN DÍA POR DÍA DE HORAS EXTRAS
  // -------------------------------------------------------------
  const evolucion = useMemo(() => {
    if (registrosActuales.length === 0) {
      return { dias: [], maxDia: 0, tendencia: 'neutral' as const };
    }

    const mapaDias: Record<string, { fecha: string; timestamp: number; extras: number; count: number }> = {};

    registrosActuales.forEach(r => {
      const fStr = r.fecha.trim();
      const dateObj = parseFecha(fStr);
      const ts = dateObj.getTime();
      if (!mapaDias[fStr]) {
        mapaDias[fStr] = { fecha: fStr, timestamp: ts, extras: 0, count: 0 };
      }
      mapaDias[fStr].extras += r.horasExtras || 0;
      mapaDias[fStr].count += 1;
    });

    const diasOrdenados = Object.values(mapaDias).sort((a, b) => a.timestamp - b.timestamp);
    const maxDia = Math.max(...diasOrdenados.map(d => d.extras), 5);

    // Determinar tendencia dividiendo en dos mitades
    let tendencia: 'up' | 'down' | 'neutral' = 'neutral';
    if (diasOrdenados.length >= 4) {
      const mid = Math.floor(diasOrdenados.length / 2);
      const firstHalf = diasOrdenados.slice(0, mid);
      const secondHalf = diasOrdenados.slice(mid);

      const avg1 = firstHalf.reduce((acc, c) => acc + c.extras, 0) / firstHalf.length;
      const avg2 = secondHalf.reduce((acc, c) => acc + c.extras, 0) / secondHalf.length;

      if (avg2 - avg1 > 1.5) {
        tendencia = 'up';
      } else if (avg1 - avg2 > 1.5) {
        tendencia = 'down';
      } else {
        tendencia = 'neutral';
      }
    }

    return {
      dias: diasOrdenados,
      maxDia,
      tendencia,
    };
  }, [registrosActuales]);

  return (
    <div className="space-y-6 text-left">
      {/* Encabezado del bloque de control */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="p-1.5 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100">
            <Activity className="w-4 h-4" />
          </span>
          <div>
            <h3 className="font-display font-bold text-sm text-slate-900 tracking-tight">
              Análisis Operativo y Control de Horas Extras
            </h3>
            <p className="text-[11px] text-slate-500 font-medium">
              Comparativas, distribución de tiempo y ranking calculado desde registros reales
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 bg-slate-100 px-3 py-1 rounded-xl">
          <Calendar className="w-3.5 h-3.5 text-slate-400" />
          <span>Período Activo: {periodoLabelActual}</span>
        </div>
      </div>

      {/* Grid de Gráficos de Control */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ============================================================
            GRÁFICO 1: HORAS EXTRAS POR PERÍODO (TRADING COMPARISON)
           ============================================================ */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Comparativa de Gestión
                </span>
                <h4 className="font-display font-bold text-sm text-slate-900 mt-0.5">
                  HORAS EXTRAS POR PERÍODO
                </h4>
              </div>
              <span className="text-[11px] font-semibold text-slate-500 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-md">
                Anterior vs Actual
              </span>
            </div>

            {tieneDatosAnteriores ? (
              <div className="space-y-4">
                {/* PnL Style Metric Card */}
                <div className="p-4 rounded-xl bg-slate-50/70 border border-slate-200/80 flex items-center justify-between gap-4">
                  <div>
                    <span className="text-[11px] text-slate-500 font-medium block">
                      Variación entre períodos
                    </span>
                    <div className="flex items-baseline gap-2 mt-1">
                      <span className="text-2xl font-display font-black text-slate-900 font-mono">
                        {comparativa.horasAnterior} h → {comparativa.horasActual} h
                      </span>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold font-mono ${
                      comparativa.diff > 0
                        ? 'bg-rose-100 text-rose-800 border border-rose-200'
                        : comparativa.diff < 0
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        : 'bg-slate-200 text-slate-800'
                    }`}>
                      {comparativa.diff > 0 ? (
                        <TrendingUp className="w-3.5 h-3.5" />
                      ) : comparativa.diff < 0 ? (
                        <TrendingDown className="w-3.5 h-3.5" />
                      ) : (
                        <Minus className="w-3.5 h-3.5" />
                      )}
                      <span>
                        {comparativa.diff > 0 ? `+${comparativa.diff}` : comparativa.diff} h
                      </span>
                      {comparativa.pct !== null && (
                        <span>
                          ({comparativa.pct > 0 ? `+${comparativa.pct}` : comparativa.pct}%)
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-400 block mt-1">
                      {comparativa.diff > 0 ? 'Mayor sobrecarga operativa' : 'Menor sobrecarga operativa'}
                    </span>
                  </div>
                </div>

                {/* Barras de comparación visual */}
                <div className="space-y-3 pt-1">
                  {/* Período Anterior */}
                  <div>
                    <div className="flex justify-between text-xs font-semibold mb-1">
                      <span className="text-slate-500 flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-slate-300 inline-block" />
                        <span>PERÍODO ANTERIOR ({periodoLabelAnterior})</span>
                      </span>
                      <span className="font-mono font-bold text-slate-700">{comparativa.horasAnterior} h</span>
                    </div>
                    <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden p-0.5 border border-slate-200">
                      <div
                        className="h-full bg-slate-400 rounded-full transition-all duration-500"
                        style={{ width: `${comparativa.pctAnteriorBar}%` }}
                      />
                    </div>
                  </div>

                  {/* Período Actual */}
                  <div>
                    <div className="flex justify-between text-xs font-semibold mb-1">
                      <span className="text-indigo-900 flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 inline-block" />
                        <span className="font-bold">PERÍODO ACTUAL ({periodoLabelActual})</span>
                      </span>
                      <span className="font-mono font-black text-indigo-700">{comparativa.horasActual} h</span>
                    </div>
                    <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden p-0.5 border border-indigo-100">
                      <div
                        className="h-full bg-indigo-600 rounded-full transition-all duration-500 shadow-xs"
                        style={{ width: `${comparativa.pctActualBar}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-10 text-center text-slate-500 bg-slate-50/60 rounded-xl border border-slate-200 flex flex-col items-center justify-center gap-2">
                <HelpCircle className="w-6 h-6 text-slate-400" />
                <span className="text-xs font-semibold text-slate-700">
                  Sin datos suficientes para comparar
                </span>
                <span className="text-[11px] text-slate-400 max-w-xs">
                  No existen registros previos para el período de referencia inmediato.
                </span>
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-400 flex items-center justify-between">
            <span>Fuente: Registros de jornada validados en Supabase</span>
            <span className="font-mono font-bold text-slate-600">{registrosActuales.length} turnos analizados</span>
          </div>
        </div>

        {/* ============================================================
            GRÁFICO 2: HORAS NORMALES VS HORAS EXTRAS
           ============================================================ */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Distribución de Tiempo
                </span>
                <h4 className="font-display font-bold text-sm text-slate-900 mt-0.5">
                  HORAS NORMALES VS HORAS EXTRAS
                </h4>
              </div>
              <span className="text-[11px] font-semibold text-slate-500 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-md font-mono">
                {horasDistribucion.totalJornada} h Totales
              </span>
            </div>

            {horasDistribucion.totalJornada > 0 ? (
              <div className="space-y-4">
                {/* Visual Segmented Bar */}
                <div>
                  <div className="w-full bg-slate-100 h-6 rounded-xl overflow-hidden p-1 flex border border-slate-200 gap-1 shadow-2xs">
                    <div
                      className="h-full bg-emerald-500 rounded-lg transition-all duration-500 flex items-center justify-center text-[10px] text-white font-bold font-mono"
                      style={{ width: `${horasDistribucion.pctNormales}%` }}
                      title={`Jornada Ordinaria: ${horasDistribucion.totalNormales}h (${horasDistribucion.pctNormales}%)`}
                    >
                      {horasDistribucion.pctNormales >= 20 ? `${horasDistribucion.pctNormales}%` : ''}
                    </div>
                    <div
                      className="h-full bg-indigo-600 rounded-lg transition-all duration-500 flex items-center justify-center text-[10px] text-white font-bold font-mono"
                      style={{ width: `${horasDistribucion.pctExtras}%` }}
                      title={`Horas Extras: ${horasDistribucion.totalExtras}h (${horasDistribucion.pctExtras}%)`}
                    >
                      {horasDistribucion.pctExtras >= 15 ? `${horasDistribucion.pctExtras}%` : ''}
                    </div>
                  </div>
                </div>

                {/* KPI Breakdown Cards */}
                <div className="grid grid-cols-2 gap-3 pt-1">
                  {/* Horas Normales */}
                  <div className="p-3.5 rounded-xl bg-emerald-50/40 border border-emerald-100">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-800">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                      <span>Horas Normales</span>
                    </div>
                    <div className="mt-2 text-2xl font-display font-black text-emerald-950 font-mono">
                      {horasDistribucion.totalNormales} h
                    </div>
                    <span className="text-[10px] text-emerald-700 font-medium block mt-0.5">
                      {horasDistribucion.pctNormales}% de la jornada (base legal)
                    </span>
                  </div>

                  {/* Horas Extras */}
                  <div className="p-3.5 rounded-xl bg-indigo-50/40 border border-indigo-100">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-800">
                      <span className="w-2.5 h-2.5 rounded-full bg-indigo-600" />
                      <span>Horas Extras</span>
                    </div>
                    <div className="mt-2 text-2xl font-display font-black text-indigo-950 font-mono">
                      +{horasDistribucion.totalExtras} h
                    </div>
                    <span className="text-[10px] text-indigo-700 font-medium block mt-0.5">
                      {horasDistribucion.pctExtras}% recargos a liquidar
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-10 text-center text-slate-400 text-xs">
                No hay registros de jornada en el período seleccionado.
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-400">
            Regla legal aplicada: 8 horas ordinarias de base diaria; excedente calificado como hora extra.
          </div>
        </div>

        {/* ============================================================
            GRÁFICO 3: RANKING DE HORAS EXTRAS POR AUXILIAR
           ============================================================ */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Concentración de Recargos
                </span>
                <h4 className="font-display font-bold text-sm text-slate-900 mt-0.5">
                  HORAS EXTRAS POR AUXILIAR (RANKING)
                </h4>
              </div>
              <span className="text-[11px] font-semibold text-slate-500 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-md">
                De mayor a menor
              </span>
            </div>

            {rankingAuxiliares.items.length > 0 ? (
              <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                {rankingAuxiliares.items.slice(0, 8).map((aux, idx) => {
                  const pct = Math.min(100, Math.round((aux.horasExtras / rankingAuxiliares.maxExtras) * 100));
                  const esSobreUmbral = aux.horasExtras >= 10;

                  return (
                    <div
                      key={aux.nombre}
                      onClick={() => onSelectAuxiliar && onSelectAuxiliar(aux.nombre)}
                      onMouseEnter={() => setHoveredAux(aux.nombre)}
                      onMouseLeave={() => setHoveredAux(null)}
                      className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                        hoveredAux === aux.nombre
                          ? 'border-indigo-300 bg-indigo-50/40 shadow-xs'
                          : 'border-slate-200/70 bg-slate-50/40 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold font-mono ${
                            idx === 0
                              ? 'bg-amber-100 text-amber-900 border border-amber-300'
                              : idx === 1
                              ? 'bg-slate-200 text-slate-800'
                              : idx === 2
                              ? 'bg-amber-50 text-amber-800'
                              : 'bg-slate-100 text-slate-600'
                          }`}>
                            {idx + 1}
                          </span>
                          <span className="font-bold text-slate-800 truncate block">
                            {aux.nombre}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="font-display font-black text-xs text-indigo-700 font-mono">
                            {aux.horasExtras} h
                          </span>
                          {esSobreUmbral && (
                            <span className="text-[9px] font-bold bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded-md">
                              ≥10h
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Barra de progreso */}
                      <div className="w-full bg-slate-200/70 h-2 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            idx === 0
                              ? 'bg-indigo-600'
                              : idx < 3
                              ? 'bg-indigo-500'
                              : 'bg-indigo-400'
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-10 text-center text-slate-400 text-xs">
                No hay registros con horas extras en el período.
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-400 flex items-center justify-between">
            <span>Haz clic en un auxiliar para ver su desglose individual</span>
            <span className="font-semibold text-indigo-600">Top 8 colaboradores</span>
          </div>
        </div>

        {/* ============================================================
            GRÁFICO 4: EVOLUCIÓN DÍA TRAS DÍA
           ============================================================ */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Tendencia Cronológica
                </span>
                <h4 className="font-display font-bold text-sm text-slate-900 mt-0.5">
                  EVOLUCIÓN DE HORAS EXTRAS
                </h4>
              </div>

              {/* Indicador de tendencia */}
              <div className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 font-mono ${
                evolucion.tendencia === 'up'
                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                  : evolucion.tendencia === 'down'
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-slate-100 text-slate-700'
              }`}>
                {evolucion.tendencia === 'up' && (
                  <>
                    <TrendingUp className="w-3.5 h-3.5" />
                    <span>↑ Aumentan</span>
                  </>
                )}
                {evolucion.tendencia === 'down' && (
                  <>
                    <TrendingDown className="w-3.5 h-3.5" />
                    <span>↓ Disminuyen</span>
                  </>
                )}
                {evolucion.tendencia === 'neutral' && (
                  <>
                    <Minus className="w-3.5 h-3.5" />
                    <span>→ Se mantienen</span>
                  </>
                )}
              </div>
            </div>

            {evolucion.dias.length > 0 ? (
              <div className="space-y-4">
                {/* Gráfico de Barras por Día */}
                <div className="h-44 flex items-end gap-1.5 sm:gap-2 pt-6 pb-1 overflow-x-auto">
                  {evolucion.dias.map(d => {
                    const barHeight = Math.max(8, Math.min(100, Math.round((d.extras / evolucion.maxDia) * 100)));
                    const p = d.fecha.split('/');
                    const diaNum = p[0];

                    return (
                      <div
                        key={d.fecha}
                        className="flex-1 min-w-[24px] flex flex-col items-center justify-end h-full group relative"
                      >
                        {/* Tooltip con valor */}
                        <div className="absolute -top-7 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 text-white text-[10px] font-bold px-1.5 py-0.5 rounded font-mono pointer-events-none z-10 whitespace-nowrap shadow-sm">
                          {d.fecha}: {d.extras}h ({d.count} turnos)
                        </div>

                        <div
                          className="w-full bg-indigo-500 group-hover:bg-indigo-600 rounded-t transition-all"
                          style={{ height: `${barHeight}%` }}
                        />
                        <span className="text-[10px] text-slate-400 font-mono font-medium mt-1">
                          {diaNum}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="py-10 text-center text-slate-400 text-xs">
                Sin actividad registrada en este período.
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-400 flex items-center justify-between">
            <span>Evolución diaria para detectar picos operativos</span>
            <span className="font-mono text-slate-500 font-semibold">{evolucion.dias.length} días con actividad</span>
          </div>
        </div>
      </div>
    </div>
  );
};
