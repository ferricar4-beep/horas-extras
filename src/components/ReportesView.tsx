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
  Truck,
  Printer,
  Filter,
  X,
  RotateCcw,
  Layers,
  Table,
  Eye,
  AlertCircle
} from 'lucide-react';
import { AuxiliarStats, Registro, PeriodoFiltro } from '../types';
import {
  formatoNombreCapital,
  obtenerCargoDisplay,
  parseFecha,
  filtrarPorPeriodo,
  normalizarNombre
} from '../utils';

interface ReportesViewProps {
  statsAuxiliares?: AuxiliarStats[];
  allRegistros?: Registro[];
  registrosFiltrados?: Registro[];
  auxiliarCargos?: Record<string, string>;
  filtroPeriodo?: PeriodoFiltro;
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
  listaAuxiliares?: string[];
  onExportExcel?: (regs?: Registro[]) => void;
  searchTermExterno?: string;
}

export const ReportesView: React.FC<ReportesViewProps> = ({
  statsAuxiliares = [],
  allRegistros = [],
  registrosFiltrados = [],
  auxiliarCargos = {},
  filtroPeriodo: filtroPeriodoProp,
  setFiltroPeriodo: setFiltroPeriodoProp,
  filtroMes: filtroMesProp,
  setFiltroMes: setFiltroMesProp,
  filtroAno: filtroAnoProp,
  setFiltroAno: setFiltroAnoProp,
  fechaInicioCustom: fechaInicioCustomProp,
  setFechaInicioCustom: setFechaInicioCustomProp,
  fechaFinCustom: fechaFinCustomProp,
  setFechaFinCustom: setFechaFinCustomProp,
  rangoFechasActivo,
  rangoFechas,
  diasHabilesEsperados = 15,
  listaAuxiliares: listaAuxiliaresProp = [],
  onExportExcel,
}) => {
  // -------------------------------------------------------------
  // ESTADOS DE FILTROS REALES
  // -------------------------------------------------------------
  const [periodo, setPeriodo] = useState<PeriodoFiltro>(filtroPeriodoProp || 'quincena_2');
  const [mes, setMes] = useState<number>(filtroMesProp !== undefined ? filtroMesProp : 1); // Feb
  const [ano, setAno] = useState<number>(filtroAnoProp !== undefined ? filtroAnoProp : 2026);
  const [fechaInicioCustom, setFechaInicioCustom] = useState<string>(fechaInicioCustomProp || '');
  const [fechaFinCustom, setFechaFinCustom] = useState<string>(fechaFinCustomProp || '');

  // Sincronizar props con estado si cambian afuera
  React.useEffect(() => {
    if (filtroPeriodoProp) setPeriodo(filtroPeriodoProp);
  }, [filtroPeriodoProp]);
  React.useEffect(() => {
    if (filtroMesProp !== undefined) setMes(filtroMesProp);
  }, [filtroMesProp]);
  React.useEffect(() => {
    if (filtroAnoProp !== undefined) setAno(filtroAnoProp);
  }, [filtroAnoProp]);

  // Filtros de tabla
  const [filtroAuxiliar, setFiltroAuxiliar] = useState<string>('todos');
  const [filtroRuta, setFiltroRuta] = useState<string>('todas');
  const [filtroVehiculo, setFiltroVehiculo] = useState<string>('todos');
  const [filtroEstado, setFiltroEstado] = useState<string>('todos'); // 'todos' | 'con_extras' | 'nocturno' | 'sin_extras'
  const [busquedaTexto, setBusquedaTexto] = useState<string>('');

  // Modo de visualización: 'detallada' (fila por turno) o 'consolidada' (por auxiliar)
  const [modoVisualizacion, setModoVisualizacion] = useState<'detallada' | 'consolidada'>('detallada');

  // Fuente base de registros
  const baseRegistros = allRegistros.length > 0 ? allRegistros : registrosFiltrados;

  // 1. Filtrado primario por período temporal
  const registrosPorPeriodo = useMemo(() => {
    return filtrarPorPeriodo(
      baseRegistros,
      periodo,
      fechaInicioCustom,
      fechaFinCustom,
      mes,
      ano
    );
  }, [baseRegistros, periodo, fechaInicioCustom, fechaFinCustom, mes, ano]);

  // 2. Extraer listas únicas de opciones basadas en los registros reales
  const opcionesFiltros = useMemo(() => {
    const auxSet = new Set<string>();
    const rutaSet = new Set<string>();
    const vehiculoSet = new Set<string>();

    baseRegistros.forEach(r => {
      if (r.auxiliar) auxSet.add(r.auxiliar.trim().toUpperCase());
      if (r.ruta) rutaSet.add(r.ruta.trim().toUpperCase());
      if (r.vehiculo) vehiculoSet.add(r.vehiculo.trim().toUpperCase());
    });

    listaAuxiliaresProp.forEach(a => {
      if (a) auxSet.add(a.trim().toUpperCase());
    });

    return {
      auxiliares: Array.from(auxSet).sort(),
      rutas: Array.from(rutaSet).sort(),
      vehiculos: Array.from(vehiculoSet).sort(),
    };
  }, [baseRegistros, listaAuxiliaresProp]);

  // 3. Aplicar filtros combinados en tiempo real (MISMO DATASET PARA TABLA Y EXCEL)
  const registrosFiltradosFinal = useMemo(() => {
    return registrosPorPeriodo.filter(reg => {
      // Filtro Auxiliar
      if (filtroAuxiliar !== 'todos') {
        if (normalizarNombre(reg.auxiliar) !== normalizarNombre(filtroAuxiliar)) {
          return false;
        }
      }

      // Filtro Ruta
      if (filtroRuta !== 'todas') {
        if (reg.ruta.trim().toUpperCase() !== filtroRuta.trim().toUpperCase()) {
          return false;
        }
      }

      // Filtro Vehículo
      if (filtroVehiculo !== 'todos') {
        if (reg.vehiculo.trim().toUpperCase() !== filtroVehiculo.trim().toUpperCase()) {
          return false;
        }
      }

      // Filtro Estado
      if (filtroEstado === 'con_extras' && reg.horasExtras <= 0) return false;
      if (filtroEstado === 'sin_extras' && reg.horasExtras > 0) return false;
      if (filtroEstado === 'nocturno' && !reg.esNocturno) return false;

      // Búsqueda de texto libre
      if (busquedaTexto.trim()) {
        const q = busquedaTexto.toLowerCase().trim();
        const match =
          reg.auxiliar.toLowerCase().includes(q) ||
          reg.vehiculo.toLowerCase().includes(q) ||
          reg.ruta.toLowerCase().includes(q) ||
          reg.fecha.toLowerCase().includes(q);
        if (!match) return false;
      }

      return true;
    });
  }, [registrosPorPeriodo, filtroAuxiliar, filtroRuta, filtroVehiculo, filtroEstado, busquedaTexto]);

  // 4. Agrupación consolidada por auxiliar desde el dataset filtrado
  const consolidadosPorAuxiliar = useMemo(() => {
    const map: Record<string, {
      nombre: string;
      jornadaTotal: number;
      horasExtrasTotales: number;
      turnosCount: number;
      turnosNocturnos: number;
      rutas: Set<string>;
      vehiculos: Set<string>;
    }> = {};

    registrosFiltradosFinal.forEach(r => {
      const nom = r.auxiliar.trim().toUpperCase();
      if (!map[nom]) {
        map[nom] = {
          nombre: nom,
          jornadaTotal: 0,
          horasExtrasTotales: 0,
          turnosCount: 0,
          turnosNocturnos: 0,
          rutas: new Set(),
          vehiculos: new Set(),
        };
      }
      map[nom].jornadaTotal += r.jornada || 0;
      map[nom].horasExtrasTotales += r.horasExtras || 0;
      map[nom].turnosCount += 1;
      if (r.esNocturno) map[nom].turnosNocturnos += 1;
      if (r.ruta) map[nom].rutas.add(r.ruta);
      if (r.vehiculo) map[nom].vehiculos.add(r.vehiculo);
    });

    const list = Object.values(map).map(item => ({
      nombre: item.nombre,
      jornadaTotal: Math.round(item.jornadaTotal * 10) / 10,
      horasExtrasTotales: Math.round(item.horasExtrasTotales * 10) / 10,
      turnosCount: item.turnosCount,
      turnosNocturnos: item.turnosNocturnos,
      promedioJornada: item.turnosCount > 0 ? Math.round((item.jornadaTotal / item.turnosCount) * 10) / 10 : 0,
      rutas: Array.from(item.rutas).join(', '),
      vehiculos: Array.from(item.vehiculos).join(', '),
    }));

    return list.sort((a, b) => b.horasExtrasTotales - a.horasExtrasTotales);
  }, [registrosFiltradosFinal]);

  // 5. Totales calculados exactamente del dataset filtrado
  const totales = useMemo(() => {
    let horasTotales = 0;
    let horasExtras = 0;
    let nocturnos = 0;

    registrosFiltradosFinal.forEach(r => {
      horasTotales += r.jornada || 0;
      horasExtras += r.horasExtras || 0;
      if (r.esNocturno) nocturnos += 1;
    });

    const auxUnicos = new Set(registrosFiltradosFinal.map(r => r.auxiliar.trim().toUpperCase())).size;

    return {
      horasTotales: Math.round(horasTotales * 10) / 10,
      horasExtras: Math.round(horasExtras * 10) / 10,
      turnosTotales: registrosFiltradosFinal.length,
      colaboradores: auxUnicos,
      nocturnos,
    };
  }, [registrosFiltradosFinal]);

  // -------------------------------------------------------------
  // EXPORTACIÓN EXCEL GARANTIZADA: EXACTAMENTE LO QUE ESTÁ FILTRADO
  // -------------------------------------------------------------
  const handleExportarExcelGarantizado = () => {
    if (registrosFiltradosFinal.length === 0) {
      alert('No hay registros con los filtros activos para exportar.');
      return;
    }

    const headers = [
      'Auxiliar',
      'Cargo',
      'Vehiculo / Placa',
      'Fecha',
      'Hora Ingreso',
      'Hora Salida',
      'Ruta',
      'Jornada Total (Horas)',
      'Horas Extras (Base 8h)',
      'Tipo Turno'
    ];

    // Ordenar por Auxiliar y Fecha
    const ordenados = [...registrosFiltradosFinal].sort((a, b) => {
      const comp = a.auxiliar.localeCompare(b.auxiliar, 'es', { sensitivity: 'base' });
      if (comp !== 0) return comp;
      return parseFecha(a.fecha).getTime() - parseFecha(b.fecha).getTime();
    });

    const rows: (string | number)[][] = [];
    let currentAux = '';
    let subtotalJornada = 0;
    let subtotalExtras = 0;
    let granTotalJornada = 0;
    let granTotalExtras = 0;

    ordenados.forEach((r, idx) => {
      if (currentAux && r.auxiliar !== currentAux) {
        rows.push([
          `SUBTOTAL ${currentAux}`,
          '',
          '',
          '',
          '',
          '',
          'Suma Auxiliar',
          Math.round(subtotalJornada * 10) / 10,
          Math.round(subtotalExtras * 10) / 10,
          ''
        ]);
        rows.push(['', '', '', '', '', '', '', '', '', '']);
        subtotalJornada = 0;
        subtotalExtras = 0;
      }

      currentAux = r.auxiliar;
      subtotalJornada += r.jornada || 0;
      subtotalExtras += r.horasExtras || 0;
      granTotalJornada += r.jornada || 0;
      granTotalExtras += r.horasExtras || 0;

      rows.push([
        r.auxiliar,
        obtenerCargoDisplay(r.auxiliar, auxiliarCargos),
        r.vehiculo,
        r.fecha,
        r.horaIngreso,
        r.horaSalida,
        r.ruta,
        r.jornada,
        r.horasExtras,
        r.esNocturno ? 'Nocturno (21:00-06:00)' : 'Diurno'
      ]);

      if (idx === ordenados.length - 1) {
        rows.push([
          `SUBTOTAL ${currentAux}`,
          '',
          '',
          '',
          '',
          '',
          'Suma Auxiliar',
          Math.round(subtotalJornada * 10) / 10,
          Math.round(subtotalExtras * 10) / 10,
          ''
        ]);
      }
    });

    rows.push(['', '', '', '', '', '', '', '', '', '']);
    rows.push([
      'TOTAL GENERAL PLANILLA FILTRADA',
      '',
      '',
      '',
      '',
      '',
      `${ordenados.length} Registros Exportados`,
      Math.round(granTotalJornada * 10) / 10,
      Math.round(granTotalExtras * 10) / 10,
      ''
    ]);

    const csvContent =
      '\uFEFF' +
      [headers.join(';'), ...rows.map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';'))].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    const auxPrefix = filtroAuxiliar !== 'todos' ? `_${filtroAuxiliar.replace(/\s+/g, '_')}` : '';
    link.setAttribute(
      'download',
      `Ferricar_Planilla_${periodo}${auxPrefix}_${new Date().toISOString().split('T')[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const mesesNombres = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  const resetearFiltros = () => {
    setFiltroAuxiliar('todos');
    setFiltroRuta('todas');
    setFiltroVehiculo('todos');
    setFiltroEstado('todos');
    setBusquedaTexto('');
  };

  const hayFiltrosActivos =
    filtroAuxiliar !== 'todos' ||
    filtroRuta !== 'todas' ||
    filtroVehiculo !== 'todos' ||
    filtroEstado !== 'todos' ||
    busquedaTexto.trim() !== '';

  return (
    <div className="space-y-6 text-left">
      {/* 1. Encabezado con Acciones de Exportación */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100">
              <FileSpreadsheet className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-lg font-display font-bold text-slate-900 tracking-tight">
                Reportes de Planilla y Liquidación
              </h2>
              <p className="text-xs text-slate-500">
                Filtros en tiempo real: lo que ves en pantalla es exactamente lo que descargas en Excel.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
          >
            <Printer className="w-4 h-4 text-slate-500" />
            <span className="hidden sm:inline">Imprimir / PDF</span>
          </button>

          <button
            onClick={handleExportarExcelGarantizado}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs shadow-emerald-600/30 transition-all cursor-pointer"
            title="Descargar exactamente los registros filtrados visibles"
          >
            <Download className="w-4 h-4" />
            <span>Exportar a Excel ({registrosFiltradosFinal.length})</span>
          </button>
        </div>
      </div>

      {/* 2. Barra de Filtros Integrados y Selector de Período */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-4">
        {/* Selector de Período Rápido */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-indigo-600" />
            <span className="text-xs font-bold text-slate-800">
              Período de Liquidación:
            </span>
            <span className="text-xs font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md">
              {periodo === 'quincena_1' ? '1 al 15' : periodo === 'quincena_2' ? '16 al fin de mes' : periodo === 'este_mes' ? 'Mes Completo' : 'Rango Activo'} {mesesNombres[mes]} {ano}
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Botones de Período */}
            <div className="inline-flex p-1 bg-slate-100 rounded-xl gap-1 text-xs">
              <button
                type="button"
                onClick={() => {
                  setPeriodo('quincena_1');
                  if (setFiltroPeriodoProp) setFiltroPeriodoProp('quincena_1');
                }}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                  periodo === 'quincena_1' ? 'bg-white text-indigo-600 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                1 — 15
              </button>
              <button
                type="button"
                onClick={() => {
                  setPeriodo('quincena_2');
                  if (setFiltroPeriodoProp) setFiltroPeriodoProp('quincena_2');
                }}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                  periodo === 'quincena_2' ? 'bg-white text-indigo-600 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                16 — 30
              </button>
              <button
                type="button"
                onClick={() => {
                  setPeriodo('este_mes');
                  if (setFiltroPeriodoProp) setFiltroPeriodoProp('este_mes');
                }}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                  periodo === 'este_mes' ? 'bg-white text-indigo-600 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Mes Completo
              </button>
              <button
                type="button"
                onClick={() => {
                  setPeriodo('ultimos_15_dias');
                  if (setFiltroPeriodoProp) setFiltroPeriodoProp('ultimos_15_dias');
                }}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                  periodo === 'ultimos_15_dias' ? 'bg-white text-indigo-600 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Últimos 15d
              </button>
              <button
                type="button"
                onClick={() => {
                  setPeriodo('custom');
                  if (setFiltroPeriodoProp) setFiltroPeriodoProp('custom');
                }}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                  periodo === 'custom' ? 'bg-white text-indigo-600 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Personalizado
              </button>
              <button
                type="button"
                onClick={() => {
                  setPeriodo('todo');
                  if (setFiltroPeriodoProp) setFiltroPeriodoProp('todo');
                }}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                  periodo === 'todo' ? 'bg-white text-indigo-600 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Todo
              </button>
            </div>

            {/* Selector de Mes */}
            {(periodo === 'quincena_1' || periodo === 'quincena_2' || periodo === 'este_mes') && (
              <select
                value={mes}
                onChange={(e) => {
                  const m = parseInt(e.target.value, 10);
                  setMes(m);
                  if (setFiltroMesProp) setFiltroMesProp(m);
                }}
                className="text-xs bg-slate-50 border border-slate-200 text-slate-700 py-1 px-2.5 rounded-xl font-semibold cursor-pointer"
              >
                {mesesNombres.map((mName, idx) => (
                  <option key={mName} value={idx}>
                    {mName} {ano}
                  </option>
                ))}
              </select>
            )}

            {/* Fechas personalizadas */}
            {periodo === 'custom' && (
              <div className="flex items-center gap-1.5 bg-slate-50 p-1 rounded-xl border border-slate-200">
                <input
                  type="date"
                  value={fechaInicioCustom}
                  onChange={(e) => {
                    setFechaInicioCustom(e.target.value);
                    if (setFechaInicioCustomProp) setFechaInicioCustomProp(e.target.value);
                  }}
                  className="text-xs bg-white border border-slate-200 rounded px-1.5 py-0.5"
                />
                <span className="text-[10px] text-slate-400">a</span>
                <input
                  type="date"
                  value={fechaFinCustom}
                  onChange={(e) => {
                    setFechaFinCustom(e.target.value);
                    if (setFechaFinCustomProp) setFechaFinCustomProp(e.target.value);
                  }}
                  className="text-xs bg-white border border-slate-200 rounded px-1.5 py-0.5"
                />
              </div>
            )}
          </div>
        </div>

        {/* Fila de Filtros Multidimensionales: Auxiliar, Ruta, Vehículo, Estado */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          {/* 1. Auxiliar */}
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1 flex items-center gap-1">
              <Users className="w-3 h-3 text-slate-400" />
              <span>Auxiliar</span>
            </label>
            <select
              value={filtroAuxiliar}
              onChange={(e) => setFiltroAuxiliar(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-200 text-slate-800 py-2 px-2.5 rounded-xl font-semibold cursor-pointer focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="todos">Todos los auxiliares</option>
              {opcionesFiltros.auxiliares.map(nom => (
                <option key={nom} value={nom}>
                  {formatoNombreCapital(nom)}
                </option>
              ))}
            </select>
          </div>

          {/* 2. Ruta */}
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1 flex items-center gap-1">
              <MapPin className="w-3 h-3 text-slate-400" />
              <span>Ruta</span>
            </label>
            <select
              value={filtroRuta}
              onChange={(e) => setFiltroRuta(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-200 text-slate-800 py-2 px-2.5 rounded-xl font-semibold cursor-pointer focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="todas">Todas las rutas</option>
              {opcionesFiltros.rutas.map(r => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          {/* 3. Vehículo */}
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1 flex items-center gap-1">
              <Truck className="w-3 h-3 text-slate-400" />
              <span>Vehículo / Placa</span>
            </label>
            <select
              value={filtroVehiculo}
              onChange={(e) => setFiltroVehiculo(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-200 text-slate-800 py-2 px-2.5 rounded-xl font-semibold cursor-pointer focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="todos">Todos los vehículos</option>
              {opcionesFiltros.vehiculos.map(v => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </div>

          {/* 4. Estado del Turno */}
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1 flex items-center gap-1">
              <Filter className="w-3 h-3 text-slate-400" />
              <span>Tipo de Turno / Estado</span>
            </label>
            <select
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-200 text-slate-800 py-2 px-2.5 rounded-xl font-semibold cursor-pointer focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="todos">Todos los turnos</option>
              <option value="con_extras">Con Horas Extras (&gt; 0h)</option>
              <option value="sin_extras">Jornada Exacta (Sin Extras)</option>
              <option value="nocturno">Turno Nocturno (21:00-06:00)</option>
            </select>
          </div>
        </div>

        {/* Buscador de texto + Reset de filtros + Modo de Vista */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
          <div className="relative flex-1 max-w-md">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar en el reporte por nombre, placa, ruta o fecha..."
              value={busquedaTexto}
              onChange={(e) => setBusquedaTexto(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl pl-8.5 pr-3 py-2 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-medium"
            />
          </div>

          <div className="flex items-center gap-2">
            {hayFiltrosActivos && (
              <button
                type="button"
                onClick={resetearFiltros}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 text-xs font-semibold transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Restablecer filtros</span>
              </button>
            )}

            {/* Toggle de Modo de Vista */}
            <div className="inline-flex p-1 bg-slate-100 rounded-xl gap-1 text-xs">
              <button
                type="button"
                onClick={() => setModoVisualizacion('detallada')}
                className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  modoVisualizacion === 'detallada'
                    ? 'bg-white text-indigo-600 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Table className="w-3.5 h-3.5" />
                <span>Planilla Turnos ({registrosFiltradosFinal.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setModoVisualizacion('consolidada')}
                className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  modoVisualizacion === 'consolidada'
                    ? 'bg-white text-indigo-600 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Por Auxiliar ({consolidadosPorAuxiliar.length})</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Tarjetas KPI Calculadas Exactamente del Dataset Filtrado */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
            Colaboradores Filtrados
          </span>
          <span className="text-2xl font-display font-black text-slate-900 mt-1 block font-mono">
            {totales.colaboradores}
          </span>
          <span className="text-[10px] text-slate-500 font-medium mt-1 block">
            {filtroAuxiliar !== 'todos' ? 'Auxiliar específico' : 'Con registros en este filtro'}
          </span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
            Turnos Filtrados
          </span>
          <span className="text-2xl font-display font-black text-slate-900 mt-1 block font-mono">
            {totales.turnosTotales}
          </span>
          <span className="text-[10px] text-slate-500 font-medium mt-1 block">
            {totales.nocturnos} turnos nocturnos
          </span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
            Horas Totales Laboradas
          </span>
          <span className="text-2xl font-display font-black text-slate-900 mt-1 block font-mono">
            {totales.horasTotales}h
          </span>
          <span className="text-[10px] text-slate-500 font-medium mt-1 block">
            Jornada ordinaria + extras
          </span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-indigo-200 bg-indigo-50/20 shadow-2xs">
          <span className="text-[10px] text-indigo-600 font-bold uppercase tracking-wider block">
            Horas Extras a Liquidar
          </span>
          <span className="text-2xl font-display font-black text-indigo-700 mt-1 block font-mono">
            +{totales.horasExtras}h
          </span>
          <span className="text-[10px] text-indigo-600 font-medium mt-1 block">
            Sobre jornada base legal de 8h
          </span>
        </div>
      </div>

      {/* 4. Tabla de Datos: Planilla Detallada o Consolidado por Auxiliar */}
      {modoVisualizacion === 'detallada' ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
          <div className="p-4 border-b border-slate-150 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Planilla Detallada de Turnos ({registrosFiltradosFinal.length} registros)
              </h3>
              <p className="text-xs text-slate-500">
                Detalle cronológico turno por turno con horas extras calculadas.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Auxiliar</th>
                  <th className="py-3 px-3">Cargo</th>
                  <th className="py-3 px-3">Vehículo</th>
                  <th className="py-3 px-3">Fecha</th>
                  <th className="py-3 px-3">Ingreso</th>
                  <th className="py-3 px-3">Salida</th>
                  <th className="py-3 px-3">Ruta</th>
                  <th className="py-3 px-3 text-right">Jornada</th>
                  <th className="py-3 px-4 text-right">Horas Extras</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {registrosFiltradosFinal.map((reg) => {
                  const tieneExtras = reg.horasExtras > 0;
                  return (
                    <tr
                      key={reg.id}
                      className="hover:bg-slate-50/70 transition-colors"
                    >
                      <td className="py-3 px-4 font-bold text-slate-900">
                        {formatoNombreCapital(reg.auxiliar)}
                      </td>
                      <td className="py-3 px-3 text-slate-500">
                        {obtenerCargoDisplay(reg.auxiliar, auxiliarCargos)}
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-600">
                        {reg.vehiculo}
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-600">
                        {reg.fecha}
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-600">
                        {reg.horaIngreso}
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-600">
                        {reg.horaSalida}
                      </td>
                      <td className="py-3 px-3 text-slate-600 truncate max-w-[140px]" title={reg.ruta}>
                        {reg.ruta}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                        {reg.jornada}h
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold">
                        {tieneExtras ? (
                          <span className="text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
                            +{reg.horasExtras}h
                          </span>
                        ) : (
                          <span className="text-slate-400 font-normal">0h</span>
                        )}
                      </td>
                    </tr>
                  );
                })}

                {registrosFiltradosFinal.length === 0 && (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400">
                      <AlertCircle className="w-6 h-6 mx-auto mb-2 text-slate-300" />
                      No se encontraron registros que coincidan con los filtros seleccionados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
          <div className="p-4 border-b border-slate-150 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Consolidado Quincenal por Auxiliar ({consolidadosPorAuxiliar.length} colaboradores)
              </h3>
              <p className="text-xs text-slate-500">
                Totalización acumulada para liquidación de nómina.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Auxiliar</th>
                  <th className="py-3 px-3">Cargo</th>
                  <th className="py-3 px-3 text-center">Turnos</th>
                  <th className="py-3 px-3 text-center">Nocturnos</th>
                  <th className="py-3 px-3 text-right">Jornada Total</th>
                  <th className="py-3 px-3 text-right">Promedio / Turno</th>
                  <th className="py-3 px-4 text-right">Horas Extras</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {consolidadosPorAuxiliar.map((aux) => {
                  const tieneExtras = aux.horasExtrasTotales > 0;
                  return (
                    <tr
                      key={aux.nombre}
                      className="hover:bg-slate-50/70 transition-colors"
                    >
                      <td className="py-3 px-4 font-bold text-slate-900">
                        {formatoNombreCapital(aux.nombre)}
                      </td>
                      <td className="py-3 px-3 text-slate-500">
                        {obtenerCargoDisplay(aux.nombre, auxiliarCargos)}
                      </td>
                      <td className="py-3 px-3 text-center font-mono text-slate-700">
                        {aux.turnosCount}
                      </td>
                      <td className="py-3 px-3 text-center font-mono text-slate-600">
                        {aux.turnosNocturnos > 0 ? (
                          <span className="text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded font-bold">
                            {aux.turnosNocturnos}
                          </span>
                        ) : (
                          '0'
                        )}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                        {aux.jornadaTotal}h
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-slate-600">
                        {aux.promedioJornada}h
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold">
                        {tieneExtras ? (
                          <span className="text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md font-black">
                            +{aux.horasExtrasTotales}h
                          </span>
                        ) : (
                          <span className="text-slate-400 font-normal">0h</span>
                        )}
                      </td>
                    </tr>
                  );
                })}

                {consolidadosPorAuxiliar.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      No hay colaboradores que coincidan con los filtros.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
