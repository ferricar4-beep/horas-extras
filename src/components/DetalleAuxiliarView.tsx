import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  X,
  Edit3,
  Plus,
  Shield,
  Truck,
  MapPin,
  TrendingUp,
  TrendingDown,
  ChevronDown,
  FileCheck,
  AlertTriangle,
  HelpCircle,
  UserCheck,
  ChevronRight,
  Filter
} from 'lucide-react';
import { Registro, PeriodoFiltro, TipoJustificacion, JustificacionDia } from '../types';
import {
  formatoNombreCapital,
  obtenerCargoDisplay,
  esNoLaborable,
  esDomingo,
  esFestivoColombia,
  parseFecha,
  calcularHorasExtra,
  calcularJornada,
  esTurnoNocturno,
  obtenerJustificacionesStorage,
  guardarJustificacionStorage,
  eliminarJustificacionStorage,
  obtenerEtiquetaJustificacion,
  normalizarNombre
} from '../utils';

interface DetalleAuxiliarViewProps {
  auxiliarName: string;
  allRegistros: Registro[];
  auxiliarCargos?: Record<string, string>;
  onVolver: () => void;
  onEditarRegistro?: (reg: Registro) => void;
  onAgregarRegistro?: (nuevoReg: Registro) => Promise<boolean | void> | void;
  onSelectAuxiliar?: (aux: string) => void;
  listaAuxiliares?: string[];
  filtroPeriodoInicial?: PeriodoFiltro;
  filtroMesInicial?: number;
  filtroAnoInicial?: number;
}

const OPCIONES_JUSTIFICACION: { tipo: TipoJustificacion; label: string; desc: string }[] = [
  { tipo: 'descanso', label: 'Descanso Compensatorio / Programado', desc: 'Día de descanso acordado' },
  { tipo: 'permiso', label: 'Permiso Remunerado / No Remunerado', desc: 'Permiso autorizado por coordinación' },
  { tipo: 'incapacidad', label: 'Incapacidad Médica (EPS / ARL)', desc: 'Certificado médico oficial presentado' },
  { tipo: 'vacaciones', label: 'Vacaciones Laborales', desc: 'Período legal de vacaciones' },
  { tipo: 'no_laboro', label: 'No laboró (Sin justificar)', desc: 'Día no asistido sin justificación previa' },
  { tipo: 'error_registro', label: 'Error de Registro / Validación', desc: 'Turno en proceso de verificación' },
  { tipo: 'pendiente_validar', label: 'Pendiente de Validar con Conductor', desc: 'Confirmando planilla física' }
];

export const DetalleAuxiliarView: React.FC<DetalleAuxiliarViewProps> = ({
  auxiliarName,
  allRegistros,
  auxiliarCargos = {},
  onVolver,
  onEditarRegistro,
  onAgregarRegistro,
  onSelectAuxiliar,
  listaAuxiliares = [],
  filtroPeriodoInicial = 'quincena_2',
  filtroMesInicial = 8, // Septiembre (0-indexed = 8)
  filtroAnoInicial = 2026,
}) => {
  // Selector de período
  const [periodo, setPeriodo] = useState<PeriodoFiltro>(filtroPeriodoInicial);
  const [mes, setMes] = useState<number>(filtroMesInicial);
  const [ano, setAno] = useState<number>(filtroAnoInicial);
  const [fechaInicioCustom, setFechaInicioCustom] = useState<string>('');
  const [fechaFinCustom, setFechaFinCustom] = useState<string>('');
  const [showPeriodoSelector, setShowPeriodoSelector] = useState(false);

  // Auxiliar activo y lista de selección
  const [currentAuxiliar, setCurrentAuxiliar] = useState<string>(auxiliarName);
  const [showAuxSelector, setShowAuxSelector] = useState(false);

  // Justificaciones en memoria y almacenamiento local
  const [justificacionesVersion, setJustificacionesVersion] = useState<number>(0);
  const justificacionesMap = useMemo(() => {
    const all = obtenerJustificacionesStorage();
    return all[normalizarNombre(currentAuxiliar)] || {};
  }, [currentAuxiliar, justificacionesVersion]);

  // Modales interactivos al tocar un día
  const [selectedDiaData, setSelectedDiaData] = useState<{
    fechaStr: string; // DD/MM/YYYY
    dateObj: Date;
    esNoLaborable: boolean;
    registro?: Registro;
    justificacion?: JustificacionDia;
  } | null>(null);

  // Modal para Justificar Día
  const [modalJustificarOpen, setModalJustificarOpen] = useState(false);
  const [tipoJustificacionSelect, setTipoJustificacionSelect] = useState<TipoJustificacion>('descanso');
  const [notaJustificacion, setNotaJustificacion] = useState('');

  // Modal para Registrar Jornada Rápida desde el día
  const [modalRegistrarOpen, setModalRegistrarOpen] = useState(false);
  const [regHoraIngreso, setRegHoraIngreso] = useState('06:00');
  const [regHoraSalida, setRegHoraSalida] = useState('17:00');
  const [regVehiculo, setRegVehiculo] = useState('VEH-101');
  const [regRuta, setRegRuta] = useState('RUTA PRINCIPAL');
  const [regError, setRegError] = useState('');
  const [guardandoRegistro, setGuardandoRegistro] = useState(false);

  // Actualizar auxiliar si cambia la prop
  useEffect(() => {
    setCurrentAuxiliar(auxiliarName);
  }, [auxiliarName]);

  // Definición de fechas del período seleccionado
  const fechasPeriodo = useMemo(() => {
    let dInicio = 16;
    let dFin = new Date(ano, mes + 1, 0).getDate();

    if (periodo === 'quincena_1') {
      dInicio = 1;
      dFin = 15;
    } else if (periodo === 'quincena_2') {
      dInicio = 16;
      dFin = new Date(ano, mes + 1, 0).getDate();
    } else if (periodo === 'este_mes' || periodo === 'todo') {
      dInicio = 1;
      dFin = new Date(ano, mes + 1, 0).getDate();
    } else if (periodo === 'ultimos_15_dias') {
      dInicio = 16;
      dFin = new Date(ano, mes + 1, 0).getDate();
    }

    const list: {
      diaNumero: number;
      fechaStr: string; // DD/MM/YYYY
      dateObj: Date;
      diaSemanaNombre: string;
      esDomingo: boolean;
      esFestivo: boolean;
      esNoLaborableDia: boolean;
    }[] = [];

    const diasSemanaNombres = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

    for (let d = dInicio; d <= dFin; d++) {
      const dateObj = new Date(ano, mes, d);
      const diaSem = diasSemanaNombres[dateObj.getDay()];
      const esDom = esDomingo(dateObj);
      const esFest = esFestivoColombia(dateObj);
      const noLab = esNoLaborable(dateObj);

      list.push({
        diaNumero: d,
        fechaStr: `${d}/${mes + 1}/${ano}`,
        dateObj,
        diaSemanaNombre: diaSem,
        esDomingo: esDom,
        esFestivo: esFest,
        esNoLaborableDia: noLab,
      });
    }

    return list;
  }, [periodo, mes, ano]);

  // Registros de este auxiliar
  const registrosAuxiliar = useMemo(() => {
    const targetNorm = normalizarNombre(currentAuxiliar);
    return allRegistros.filter(r => normalizarNombre(r.auxiliar) === targetNorm);
  }, [allRegistros, currentAuxiliar]);

  // Registros dentro del período activo
  const registrosPeriodoMap = useMemo(() => {
    const map: Record<string, Registro> = {};
    fechasPeriodo.forEach(f => {
      const match = registrosAuxiliar.find(r => {
        try {
          const rDate = parseFecha(r.fecha);
          return (
            rDate.getDate() === f.diaNumero &&
            rDate.getMonth() === mes &&
            rDate.getFullYear() === ano
          );
        } catch {
          return r.fecha.trim() === f.fechaStr;
        }
      });
      if (match) {
        map[f.fechaStr] = match;
      }
    });
    return map;
  }, [fechasPeriodo, registrosAuxiliar, mes, ano]);

  // Métricas del Período
  // 1. Días esperados: Días del período que NO son domingos ni festivos
  const diasEsperados = useMemo(() => {
    return fechasPeriodo.filter(f => !f.esNoLaborableDia).length;
  }, [fechasPeriodo]);

  // 2. Días trabajados: Fechas con registro
  const diasTrabajados = useMemo(() => {
    return Object.keys(registrosPeriodoMap).length;
  }, [registrosPeriodoMap]);

  // 3. Faltantes: Días esperados sin registro y sin justificar
  const diasFaltantesList = useMemo(() => {
    return fechasPeriodo.filter(f => {
      if (f.esNoLaborableDia) return false;
      const tieneRegistro = !!registrosPeriodoMap[f.fechaStr];
      const tieneJustificacion = !!justificacionesMap[f.fechaStr];
      return !tieneRegistro && !tieneJustificacion;
    });
  }, [fechasPeriodo, registrosPeriodoMap, justificacionesMap]);

  const totalFaltantes = diasFaltantesList.length;

  // 4. Horas trabajadas y horas extras totales en el período
  const { totalHorasTrabajadas, totalHorasExtras } = useMemo(() => {
    let horas = 0;
    let extras = 0;
    Object.values(registrosPeriodoMap).forEach(reg => {
      horas += reg.jornada || 0;
      extras += reg.horasExtras || 0;
    });
    return {
      totalHorasTrabajadas: Math.round(horas * 10) / 10,
      totalHorasExtras: Math.round(extras * 10) / 10,
    };
  }, [registrosPeriodoMap]);

  // 4b. Promedio de horas por día con registro
  const promedioHorasDia = useMemo(() => {
    return diasTrabajados > 0 ? Math.round((totalHorasTrabajadas / diasTrabajados) * 10) / 10 : 0;
  }, [totalHorasTrabajadas, diasTrabajados]);

  // 5. Historial de las Últimas 4 Quincenas para este Auxiliar (Q1, Q2, Q3, Q4)
  const historialQuincenas = useMemo(() => {
    // Calculamos 4 períodos quincenales hacia atrás a partir del mes y quincena actual
    const quincenas: { id: string; label: string; extras: number; horas: number; dias: number }[] = [];

    let curYear = ano;
    let curMonth = mes;
    let curIsQ2 = periodo === 'quincena_2';

    // Generamos las 4 quincenas
    const periodosAExplorar: { y: number; m: number; isQ2: boolean; qLabel: string }[] = [];
    for (let i = 0; i < 4; i++) {
      periodosAExplorar.unshift({
        y: curYear,
        m: curMonth,
        isQ2: curIsQ2,
        qLabel: `Q${4 - i}`
      });
      if (curIsQ2) {
        curIsQ2 = false;
      } else {
        curIsQ2 = true;
        curMonth--;
        if (curMonth < 0) {
          curMonth = 11;
          curYear--;
        }
      }
    }

    const mesesNombres = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

    periodosAExplorar.forEach(p => {
      const dMin = p.isQ2 ? 16 : 1;
      const dMax = p.isQ2 ? new Date(p.y, p.m + 1, 0).getDate() : 15;

      let qExtras = 0;
      let qHoras = 0;
      let qDias = 0;

      registrosAuxiliar.forEach(reg => {
        try {
          const rDate = parseFecha(reg.fecha);
          if (
            rDate.getFullYear() === p.y &&
            rDate.getMonth() === p.m &&
            rDate.getDate() >= dMin &&
            rDate.getDate() <= dMax
          ) {
            qExtras += reg.horasExtras || 0;
            qHoras += reg.jornada || 0;
            qDias += 1;
          }
        } catch {
          // Ignorar fechas malformadas
        }
      });

      const nombrePeriodo = `${p.isQ2 ? '2Q' : '1Q'} ${mesesNombres[p.m]}`;
      quincenas.push({
        id: `${p.y}-${p.m}-${p.isQ2 ? '2' : '1'}`,
        label: p.qLabel,
        extras: Math.round(qExtras * 10) / 10,
        horas: Math.round(qHoras * 10) / 10,
        dias: qDias
      });
    });

    // Calcular tendencia entre la última y la penúltima
    const qUltima = quincenas[3]?.extras || 0;
    const qPrevia = quincenas[2]?.extras || 0;
    let porcentajeCambio = 0;
    if (qPrevia > 0) {
      porcentajeCambio = Math.round(((qUltima - qPrevia) / qPrevia) * 100);
    } else if (qUltima > 0) {
      porcentajeCambio = 100;
    }

    const maxExtras = Math.max(...quincenas.map(q => q.extras), 15);

    return {
      quincenas,
      tendencia: porcentajeCambio,
      maxExtras,
      qUltima,
      qPrevia
    };
  }, [ano, mes, periodo, registrosAuxiliar]);

  // Título del Período
  const mesesLargo = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];
  const nombreMesActivo = mesesLargo[mes];
  const labelPeriodoDisplay = useMemo(() => {
    if (periodo === 'quincena_1') return `1 — 15 ${nombreMesActivo.slice(0, 3)} ${ano}`;
    if (periodo === 'quincena_2') {
      const maxD = new Date(ano, mes + 1, 0).getDate();
      return `16 — ${maxD} ${nombreMesActivo.slice(0, 3)} ${ano}`;
    }
    if (periodo === 'este_mes') return `Mes de ${nombreMesActivo} ${ano}`;
    return `Últimos 15 días`;
  }, [periodo, mes, ano, nombreMesActivo]);

  // Manejar clic en un día del calendario
  const handleDiaClick = (diaItem: typeof fechasPeriodo[0]) => {
    const reg = registrosPeriodoMap[diaItem.fechaStr];
    const just = justificacionesMap[diaItem.fechaStr];

    setSelectedDiaData({
      fechaStr: diaItem.fechaStr,
      dateObj: diaItem.dateObj,
      esNoLaborable: diaItem.esNoLaborableDia,
      registro: reg,
      justificacion: just
    });
  };

  // Guardar Justificación
  const handleGuardarJustificacion = () => {
    if (!selectedDiaData) return;
    guardarJustificacionStorage({
      auxiliar: currentAuxiliar,
      fecha: selectedDiaData.fechaStr,
      tipo: tipoJustificacionSelect,
      nota: notaJustificacion.trim()
    });
    setJustificacionesVersion(v => v + 1);
    setModalJustificarOpen(false);
    setNotaJustificacion('');
    setSelectedDiaData(prev => prev ? {
      ...prev,
      justificacion: {
        auxiliar: currentAuxiliar,
        fecha: prev.fechaStr,
        tipo: tipoJustificacionSelect,
        nota: notaJustificacion.trim()
      }
    } : null);
  };

  // Eliminar Justificación
  const handleEliminarJustificacion = () => {
    if (!selectedDiaData) return;
    eliminarJustificacionStorage(currentAuxiliar, selectedDiaData.fechaStr);
    setJustificacionesVersion(v => v + 1);
    setSelectedDiaData(prev => prev ? { ...prev, justificacion: undefined } : null);
  };

  // Registrar Jornada Rápida desde el día
  const handleRegistrarJornadaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError('');
    if (!selectedDiaData) return;

    // Calcular jornada en horas y recargo nocturno según normativa laboral colombiana
    const durHoras = calcularJornada(regHoraIngreso, regHoraSalida);
    const esNocturno = esTurnoNocturno(regHoraIngreso, regHoraSalida);
    const extras = calcularHorasExtra(durHoras);

    const nuevoReg: Registro = {
      id: `manual-${Date.now()}`,
      marcaTemporal: new Date().toLocaleString('es-CO'),
      auxiliar: currentAuxiliar.trim().toUpperCase(),
      vehiculo: regVehiculo.trim().toUpperCase(),
      fecha: selectedDiaData.fechaStr,
      horaIngreso: `${regHoraIngreso}:00`,
      horaSalida: `${regHoraSalida}:00`,
      ruta: regRuta.trim().toUpperCase(),
      jornada: durHoras,
      horasExtras: extras,
      esNocturno,
      originalRow: {}
    };

    setGuardandoRegistro(true);
    try {
      if (onAgregarRegistro) {
        await onAgregarRegistro(nuevoReg);
      }
      setModalRegistrarOpen(false);
      setSelectedDiaData(null);
    } catch (err) {
      setRegError('Error al registrar la jornada.');
    } finally {
      setGuardandoRegistro(false);
    }
  };

  // Progreso quincena
  const porcentajeCumplimiento = diasEsperados > 0 
    ? Math.min(100, Math.round(((diasEsperados - totalFaltantes) / diasEsperados) * 100))
    : 100;

  return (
    <div className="space-y-6 text-left pb-16">
      {/* 1. ENCABEZADO SUPERIOR DEL DETALLE */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={onVolver}
              className="p-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              title="Volver a la lista de auxiliares"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>

            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Detalle Individual del Auxiliar
                </span>
                {listaAuxiliares.length > 1 && (
                  <div className="relative">
                    <button
                      onClick={() => setShowAuxSelector(!showAuxSelector)}
                      className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 bg-indigo-50 px-2 py-0.5 rounded-md cursor-pointer"
                    >
                      <span>Cambiar Auxiliar</span>
                      <ChevronDown className="w-3 h-3" />
                    </button>

                    {showAuxSelector && (
                      <div className="absolute left-0 top-full mt-1 w-64 max-h-64 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-xl z-30 p-1">
                        {listaAuxiliares.map(aux => (
                          <button
                            key={aux}
                            onClick={() => {
                              setCurrentAuxiliar(aux);
                              if (onSelectAuxiliar) onSelectAuxiliar(aux);
                              setShowAuxSelector(false);
                            }}
                            className={`w-full text-left px-3 py-2 text-xs rounded-lg transition-colors font-semibold ${
                              normalizarNombre(aux) === normalizarNombre(currentAuxiliar)
                                ? 'bg-indigo-600 text-white'
                                : 'text-slate-700 hover:bg-slate-100'
                            }`}
                          >
                            {formatoNombreCapital(aux)}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <h1 className="font-display font-black text-2xl text-slate-900 tracking-tight mt-0.5">
                {currentAuxiliar.toUpperCase()}
              </h1>
              <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md inline-block mt-1">
                {obtenerCargoDisplay(currentAuxiliar, auxiliarCargos)}
              </span>
            </div>
          </div>

          {/* Selector de Período con botones directos */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="inline-flex p-1 bg-slate-100 rounded-xl gap-1 text-xs">
              <button
                type="button"
                onClick={() => setPeriodo('quincena_1')}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                  periodo === 'quincena_1'
                    ? 'bg-white text-indigo-600 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                1 — 15
              </button>
              <button
                type="button"
                onClick={() => setPeriodo('quincena_2')}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                  periodo === 'quincena_2'
                    ? 'bg-white text-indigo-600 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                16 — 30
              </button>
              <button
                type="button"
                onClick={() => setPeriodo('este_mes')}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                  periodo === 'este_mes'
                    ? 'bg-white text-indigo-600 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Mes Completo
              </button>
              <button
                type="button"
                onClick={() => setPeriodo('ultimos_15_dias')}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                  periodo === 'ultimos_15_dias'
                    ? 'bg-white text-indigo-600 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Últimos 15 días
              </button>
              <button
                type="button"
                onClick={() => setPeriodo('custom')}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                  periodo === 'custom'
                    ? 'bg-white text-indigo-600 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Personalizado
              </button>
            </div>

            {(periodo === 'quincena_1' || periodo === 'quincena_2' || periodo === 'este_mes') && (
              <select
                value={mes}
                onChange={(e) => setMes(parseInt(e.target.value, 10))}
                className="text-xs bg-slate-50 border border-slate-200 text-slate-700 py-1.5 px-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-semibold cursor-pointer"
              >
                {mesesLargo.map((mName, idx) => (
                  <option key={mName} value={idx}>
                    {mName} {ano}
                  </option>
                ))}
              </select>
            )}

            {periodo === 'custom' && (
              <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-200 flex-wrap">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Desde:</span>
                <input
                  type="date"
                  value={fechaInicioCustom}
                  onChange={(e) => setFechaInicioCustom(e.target.value)}
                  className="text-xs bg-white border border-slate-200 rounded-lg px-2 py-1 text-slate-700 font-medium"
                />
                <span className="text-[10px] font-bold text-slate-400 uppercase">Hasta:</span>
                <input
                  type="date"
                  value={fechaFinCustom}
                  onChange={(e) => setFechaFinCustom(e.target.value)}
                  className="text-xs bg-white border border-slate-200 rounded-lg px-2 py-1 text-slate-700 font-medium"
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2. TARJETAS DE KPIS DEL AUXILIAR (100% REALES DEL PERÍODO) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        {/* DÍAS CON REGISTRO */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs text-left">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            DÍAS CON REGISTRO
          </span>
          <span className="text-3xl font-display font-black text-emerald-600 font-mono mt-2 block">
            {diasTrabajados}
          </span>
          <span className="text-[10px] text-slate-400 mt-1 block">
            Jornadas válidas
          </span>
        </div>

        {/* DÍAS SIN REGISTRO */}
        <div className={`p-4 rounded-2xl border shadow-2xs text-left transition-all ${
          totalFaltantes > 0 
            ? 'bg-amber-50/50 border-amber-300 ring-2 ring-amber-500/20' 
            : 'bg-white border-slate-200/80'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              DÍAS SIN REGISTRO
            </span>
            {totalFaltantes > 0 ? (
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            )}
          </div>
          <span className={`text-3xl font-display font-black font-mono mt-2 block ${
            totalFaltantes > 0 ? 'text-amber-600' : 'text-slate-800'
          }`}>
            {totalFaltantes}
          </span>
          <span className="text-[10px] text-slate-500 mt-1 block">
            {totalFaltantes > 0 ? '⚠️ Requiere revisión' : 'Al día'}
          </span>
        </div>

        {/* TOTAL HORAS */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs text-left">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            TOTAL HORAS
          </span>
          <span className="text-3xl font-display font-black text-slate-900 font-mono mt-2 block">
            {totalHorasTrabajadas}h
          </span>
          <span className="text-[10px] text-slate-400 mt-1 block">
            Suma total de jornadas
          </span>
        </div>

        {/* HORAS EXTRAS */}
        <div className="bg-white p-4 rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50/50 to-purple-50/30 shadow-2xs text-left">
          <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider block">
            HORAS EXTRAS
          </span>
          <span className="text-3xl font-display font-black text-indigo-700 font-mono mt-2 block">
            {totalHorasExtras}h
          </span>
          <span className="text-[10px] text-indigo-600/80 mt-1 block">
            Sobre base legal 7h/día
          </span>
        </div>

        {/* PROMEDIO HORAS/DÍA */}
        <div className="col-span-2 sm:col-span-1 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs text-left">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            PROMEDIO HORAS/DÍA
          </span>
          <span className="text-3xl font-display font-black text-slate-900 font-mono mt-2 block">
            {promedioHorasDia}h
          </span>
          <span className="text-[10px] text-slate-400 mt-1 block">
            Por jornada registrada
          </span>
        </div>
      </div>

      {/* 3. SECCIÓN PRINCIPAL: "¿QUÉ LE FALTA?" */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs text-left">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <div className={`p-1.5 rounded-lg ${totalFaltantes > 0 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
              <AlertCircle className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-display font-bold text-base text-slate-900">
                ¿Qué le falta?
              </h2>
              <span className="text-xs text-slate-500">
                Control de cumplimiento quincenal y auditoría de días sin turno
              </span>
            </div>
          </div>

          <span className={`text-xs font-bold px-3 py-1 rounded-full font-mono ${
            totalFaltantes > 0 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
          }`}>
            {totalFaltantes > 0 ? `⚠️ Faltan ${totalFaltantes} registros` : '✅ Quincena Completa'}
          </span>
        </div>

        {/* Barra de progreso de cumplimiento */}
        <div className="space-y-2 mb-5">
          <div className="flex items-center justify-between text-xs font-semibold">
            <span className="text-slate-600">Estado de quincena</span>
            <span className="font-mono text-slate-900">
              {diasEsperados - totalFaltantes} / {diasEsperados} días registrados ({porcentajeCumplimiento}%)
            </span>
          </div>
          <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden p-0.5 border border-slate-200">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                porcentajeCumplimiento === 100 
                  ? 'bg-emerald-500' 
                  : porcentajeCumplimiento > 75 
                  ? 'bg-indigo-500' 
                  : 'bg-amber-500'
              }`}
              style={{ width: `${porcentajeCumplimiento}%` }}
            />
          </div>
        </div>

        {/* Lista de Días Pendientes */}
        {totalFaltantes > 0 ? (
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
              Días pendientes por resolver
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {diasFaltantesList.map(item => (
                <div
                  key={item.fechaStr}
                  className="bg-amber-50/60 border border-amber-200 rounded-xl p-3 flex items-center justify-between gap-2"
                >
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-xs text-amber-900 font-mono">
                        {item.diaNumero} {nombreMesActivo.slice(0, 3).toUpperCase()}
                      </span>
                      <span className="text-[10px] text-amber-700 font-semibold">
                        ({item.diaSemanaNombre})
                      </span>
                    </div>
                    <span className="text-[10px] font-bold text-rose-600 flex items-center gap-1 mt-0.5">
                      ❌ Sin registro
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => {
                        setSelectedDiaData({
                          fechaStr: item.fechaStr,
                          dateObj: item.dateObj,
                          esNoLaborable: false
                        });
                        setModalRegistrarOpen(true);
                      }}
                      className="px-2 py-1 bg-white border border-amber-300 hover:bg-amber-100 text-amber-800 text-[11px] font-bold rounded-lg transition-colors cursor-pointer"
                    >
                      Registrar
                    </button>
                    <button
                      onClick={() => {
                        setSelectedDiaData({
                          fechaStr: item.fechaStr,
                          dateObj: item.dateObj,
                          esNoLaborable: false
                        });
                        setModalJustificarOpen(true);
                      }}
                      className="px-2 py-1 bg-amber-600 text-white text-[11px] font-bold rounded-lg hover:bg-amber-700 transition-colors cursor-pointer"
                    >
                      Justificar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center">
            <div className="flex items-center justify-center gap-2 text-emerald-700 font-bold text-xs">
              <CheckCircle2 className="w-4 h-4" />
              <span>Todos los días laborables esperados cuentan con turno registrado o justificación válida.</span>
            </div>
          </div>
        )}
      </div>

      {/* 4. 📅 MINI CALENDARIO DE CUMPLIMIENTO */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs text-left">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-display font-bold text-sm text-slate-900 uppercase tracking-wide">
                Mini Calendario de Cumplimiento — {nombreMesActivo} {ano}
              </h3>
              <span className="text-[11px] text-slate-400">
                Haz clic o toca cualquier día para ver el detalle, editar o registrar
              </span>
            </div>
          </div>

          <span className="text-[10px] text-indigo-600 font-semibold bg-indigo-50 px-2.5 py-1 rounded-full">
            {labelPeriodoDisplay}
          </span>
        </div>

        {/* Cuadrícula interactiva de días */}
        <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-7 lg:grid-cols-8 gap-2.5">
          {fechasPeriodo.map(f => {
            const tieneRegistro = !!registrosPeriodoMap[f.fechaStr];
            const reg = registrosPeriodoMap[f.fechaStr];
            const just = justificacionesMap[f.fechaStr];

            // Determinar estado y color exacto según especificación:
            // VERDE: Registro válido de jornada
            // AMARILLO: Registro pero requiere revisión (<4h o >16h) o justificado
            // GRIS: Día no laborable (domingos y festivos)
            // ROJO: Sin registro y requiere revisión (día laborable)
            let estadoColor = 'border-slate-200 bg-slate-50 text-slate-400 hover:bg-slate-100';
            let circuloIcono = '⚪';
            let labelBadge = 'No laborable';
            let subtext = f.esDomingo ? 'Domingo' : 'Festivo';

            if (tieneRegistro) {
              const esAnormal = (reg.jornada !== undefined && (reg.jornada < 4 || reg.jornada > 16));
              if (esAnormal) {
                circuloIcono = '🟡';
                estadoColor = 'border-amber-300 bg-amber-50/70 hover:border-amber-400 hover:bg-amber-100/70 ring-1 ring-amber-400/20';
                labelBadge = 'Requiere revisión';
                subtext = `${reg.jornada}h (Revisar)`;
              } else {
                circuloIcono = '🟢';
                estadoColor = 'border-emerald-200 bg-emerald-50/50 hover:border-emerald-300 hover:bg-emerald-50/80';
                labelBadge = 'Válido';
                subtext = `${reg.jornada}h (+${reg.horasExtras}h)`;
              }
            } else if (just) {
              circuloIcono = '🟡';
              estadoColor = 'border-amber-200 bg-amber-50/50 hover:border-amber-300 hover:bg-amber-50/80';
              labelBadge = obtenerEtiquetaJustificacion(just.tipo);
              subtext = 'Justificado';
            } else if (f.esNoLaborableDia) {
              circuloIcono = '⚪';
              estadoColor = 'border-slate-200 bg-slate-50/80 text-slate-400 hover:bg-slate-100';
              labelBadge = 'No laborable';
              subtext = f.esDomingo ? 'Domingo' : 'Festivo';
            } else {
              circuloIcono = '🔴';
              estadoColor = 'border-rose-300 bg-rose-50/60 hover:border-rose-400 hover:bg-rose-100/70 ring-1 ring-rose-400/20';
              labelBadge = 'Sin registro';
              subtext = 'Pendiente';
            }

            return (
              <button
                key={f.fechaStr}
                onClick={() => handleDiaClick(f)}
                className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center justify-between h-24 ${estadoColor}`}
              >
                <div className="w-full flex items-center justify-between text-[10px] text-slate-400">
                  <span className="font-semibold">{f.diaSemanaNombre}</span>
                  <span className="font-mono font-bold text-slate-700 text-xs">{f.diaNumero}</span>
                </div>

                <div className="text-xl my-0.5" title={labelBadge}>
                  {circuloIcono}
                </div>

                <div className="w-full truncate text-[10px] font-bold text-slate-700">
                  {subtext}
                </div>
              </button>
            );
          })}
        </div>

        {/* Leyenda de colores explicativa */}
        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-center gap-4 sm:gap-6 flex-wrap text-xs text-slate-600">
          <div className="flex items-center gap-1.5">
            <span className="text-sm">🟢</span>
            <span className="font-semibold text-slate-700">Registro válido</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-sm">🟡</span>
            <span className="font-semibold text-slate-700">Requiere revisión (&lt;4h o &gt;16h) / Justificado</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-sm">⚪</span>
            <span className="font-semibold text-slate-700">Día no laborable (domingo/festivo)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-sm">🔴</span>
            <span className="font-semibold text-slate-700">Sin registro (pendiente de revisión)</span>
          </div>
        </div>
      </div>

      {/* 5. 📊 COMPORTAMIENTO: HORAS EXTRAS — ÚLTIMAS 4 QUINCENAS */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs text-left">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3 mb-4">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Comportamiento
            </span>
            <h3 className="font-display font-bold text-base text-slate-900">
              HORAS EXTRAS — ÚLTIMAS 4 QUINCENAS
            </h3>
          </div>

          {/* Badge de tendencia */}
          <div className={`px-3 py-1.5 rounded-xl border flex items-center gap-2 text-xs font-bold ${
            historialQuincenas.tendencia > 0 
              ? 'bg-rose-50 border-rose-200 text-rose-700' 
              : historialQuincenas.tendencia < 0
              ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
              : 'bg-slate-50 border-slate-200 text-slate-700'
          }`}>
            {historialQuincenas.tendencia > 0 ? (
              <TrendingUp className="w-4 h-4 text-rose-600" />
            ) : historialQuincenas.tendencia < 0 ? (
              <TrendingDown className="w-4 h-4 text-emerald-600" />
            ) : null}
            <span>
              Tendencia: {historialQuincenas.tendencia > 0 ? `↑ ${historialQuincenas.tendencia}%` : historialQuincenas.tendencia < 0 ? `↓ ${Math.abs(historialQuincenas.tendencia)}%` : '0%'} vs período anterior
            </span>
          </div>
        </div>

        {/* Gráfica de Barras de las 4 Quincenas */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end pt-4 pb-2">
          {historialQuincenas.quincenas.map((q, idx) => {
            const barHeightPercent = Math.max(15, Math.min(100, Math.round((q.extras / historialQuincenas.maxExtras) * 100)));
            const esActual = idx === 3;

            return (
              <div key={q.id} className="flex flex-col items-center">
                <span className="font-mono font-bold text-xs text-indigo-700 mb-1">
                  {q.extras}h
                </span>

                <div className="w-full bg-slate-100 h-32 rounded-xl flex items-end p-1.5 border border-slate-200">
                  <div
                    className={`w-full rounded-lg transition-all duration-500 ${
                      esActual
                        ? 'bg-indigo-600 shadow-sm'
                        : 'bg-indigo-300 hover:bg-indigo-400'
                    }`}
                    style={{ height: `${barHeightPercent}%` }}
                  />
                </div>

                <div className="text-center mt-2">
                  <span className="font-bold text-xs text-slate-800 block">{q.label}</span>
                  <span className="text-[10px] text-slate-400 font-mono block">{q.horas}h totales</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Texto de diagnóstico de gestión para mitigar horas extras */}
        <div className="mt-4 p-3.5 bg-indigo-50/50 border border-indigo-100 rounded-xl text-xs text-slate-700 flex items-start gap-2.5">
          <Shield className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold text-indigo-900 block">
              {historialQuincenas.tendencia > 0 
                ? '⚠️ Este auxiliar está generando más horas extras que el período anterior.'
                : '✅ Horas extras controladas y estables respecto a la quincena previa.'}
            </span>
            <span className="text-slate-600 text-[11px] mt-0.5 block">
              Permite al coordinador anticipar fatiga física, programar relevos o alternar rutas de mayor distancia para mitigar sobretiempos laborales.
            </span>
          </div>
        </div>
      </div>

      {/* 6. TABLA: JORNADAS DEL PERÍODO (Detalle diario completo) */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden text-left">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="font-display font-bold text-sm text-slate-900">
              Jornadas del período
            </h3>
            <span className="text-[11px] text-slate-400">
              Detalle cronológico día a día del {labelPeriodoDisplay}
            </span>
          </div>
          <span className="text-xs font-mono font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg">
            {diasTrabajados} turnos trabajados
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-400 text-[10px] font-bold uppercase tracking-wider border-b border-slate-100">
                <th className="py-3 px-4">Fecha</th>
                <th className="py-3 px-4">Entrada</th>
                <th className="py-3 px-4">Salida</th>
                <th className="py-3 px-4">Jornada</th>
                <th className="py-3 px-4">Extras</th>
                <th className="py-3 px-4">Estado</th>
                <th className="py-3 px-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {fechasPeriodo.map(f => {
                const reg = registrosPeriodoMap[f.fechaStr];
                const just = justificacionesMap[f.fechaStr];

                if (reg) {
                  return (
                    <tr key={f.fechaStr} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-bold text-slate-800">
                        {f.diaNumero} {nombreMesActivo.slice(0, 3)} ({f.diaSemanaNombre})
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-600">
                        {reg.horaIngreso || '—'}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-600">
                        {reg.horaSalida || '—'}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">
                        {reg.jornada}h
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-indigo-600">
                        +{reg.horasExtras}h
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <span>🟢</span>
                          <span>Trabajó</span>
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        {onEditarRegistro && (
                          <button
                            onClick={() => onEditarRegistro(reg)}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg transition-colors cursor-pointer"
                          >
                            Ver / Editar
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                }

                if (just) {
                  return (
                    <tr key={f.fechaStr} className="bg-amber-50/20 hover:bg-amber-50/40 transition-colors">
                      <td className="py-3 px-4 font-bold text-slate-800">
                        {f.diaNumero} {nombreMesActivo.slice(0, 3)} ({f.diaSemanaNombre})
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-400">—</td>
                      <td className="py-3 px-4 font-mono text-slate-400">—</td>
                      <td className="py-3 px-4 font-mono text-slate-400">—</td>
                      <td className="py-3 px-4 font-mono text-slate-400">—</td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                          <span>🟡</span>
                          <span>{obtenerEtiquetaJustificacion(just.tipo)}</span>
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => {
                            setSelectedDiaData({
                              fechaStr: f.fechaStr,
                              dateObj: f.dateObj,
                              esNoLaborable: false,
                              justificacion: just
                            });
                            setTipoJustificacionSelect(just.tipo);
                            setNotaJustificacion(just.nota || '');
                            setModalJustificarOpen(true);
                          }}
                          className="px-2.5 py-1 bg-amber-100 hover:bg-amber-200 text-amber-800 font-semibold rounded-lg transition-colors cursor-pointer"
                        >
                          Modificar
                        </button>
                      </td>
                    </tr>
                  );
                }

                if (f.esNoLaborableDia) {
                  return (
                    <tr key={f.fechaStr} className="bg-slate-50/30 text-slate-400">
                      <td className="py-3 px-4 font-medium text-slate-500">
                        {f.diaNumero} {nombreMesActivo.slice(0, 3)} ({f.diaSemanaNombre})
                      </td>
                      <td className="py-3 px-4 font-mono">—</td>
                      <td className="py-3 px-4 font-mono">—</td>
                      <td className="py-3 px-4 font-mono">—</td>
                      <td className="py-3 px-4 font-mono">—</td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600">
                          <span>⚪</span>
                          <span>{f.esDomingo ? 'Domingo' : 'Festivo Nacional'}</span>
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => {
                            setSelectedDiaData({
                              fechaStr: f.fechaStr,
                              dateObj: f.dateObj,
                              esNoLaborable: true
                            });
                            setModalRegistrarOpen(true);
                          }}
                          className="text-[10px] text-slate-400 hover:text-slate-600 cursor-pointer"
                        >
                          + Turno especial
                        </button>
                      </td>
                    </tr>
                  );
                }

                // Día esperado sin registro
                return (
                  <tr key={f.fechaStr} className="bg-rose-50/20 hover:bg-rose-50/40 transition-colors">
                    <td className="py-3 px-4 font-bold text-rose-900">
                      {f.diaNumero} {nombreMesActivo.slice(0, 3)} ({f.diaSemanaNombre})
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-400">—</td>
                    <td className="py-3 px-4 font-mono text-slate-400">—</td>
                    <td className="py-3 px-4 font-mono text-slate-400">—</td>
                    <td className="py-3 px-4 font-mono text-slate-400">—</td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                        <span>🔴</span>
                        <span>Falta registro</span>
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => {
                            setSelectedDiaData({
                              fechaStr: f.fechaStr,
                              dateObj: f.dateObj,
                              esNoLaborable: false
                            });
                            setModalRegistrarOpen(true);
                          }}
                          className="px-2 py-1 bg-white border border-rose-300 hover:bg-rose-50 text-rose-800 font-bold rounded-lg transition-colors cursor-pointer"
                        >
                          Registrar
                        </button>
                        <button
                          onClick={() => {
                            setSelectedDiaData({
                              fechaStr: f.fechaStr,
                              dateObj: f.dateObj,
                              esNoLaborable: false
                            });
                            setModalJustificarOpen(true);
                          }}
                          className="px-2 py-1 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg transition-colors cursor-pointer"
                        >
                          Justificar
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL 1: DETALLE INTERACTIVO AL TOCAR UN DÍA */}
      <AnimatePresence>
        {selectedDiaData && !modalJustificarOpen && !modalRegistrarOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 relative text-left"
            >
              <button
                onClick={() => setSelectedDiaData(null)}
                className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="mb-4">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Auditoría del Día
                </span>
                <h3 className="font-display font-black text-xl text-slate-900">
                  {selectedDiaData.fechaStr}
                </h3>
              </div>

              {/* Si tiene registro de turno */}
              {selectedDiaData.registro ? (
                <div className="space-y-4">
                  <div className={`p-3 rounded-xl flex items-center gap-2 font-bold text-xs ${
                    (selectedDiaData.registro.jornada && (selectedDiaData.registro.jornada < 4 || selectedDiaData.registro.jornada > 16))
                      ? 'bg-amber-50 border border-amber-200 text-amber-800'
                      : 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                  }`}>
                    {(selectedDiaData.registro.jornada && (selectedDiaData.registro.jornada < 4 || selectedDiaData.registro.jornada > 16)) ? (
                      <>
                        <AlertCircle className="w-4 h-4 text-amber-600" />
                        <span>Estado: Requiere revisión (Jornada atípica de {selectedDiaData.registro.jornada}h)</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>Estado: Turno registrado válido</span>
                      </>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Hora Ingreso — Salida</span>
                      <span className="font-mono font-bold text-slate-800 text-sm mt-0.5 block">
                        {selectedDiaData.registro.horaIngreso || '—'} — {selectedDiaData.registro.horaSalida || '—'}
                      </span>
                    </div>

                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Horas Trabajadas / Extras</span>
                      <span className="font-mono font-bold text-indigo-700 text-sm mt-0.5 block">
                        {selectedDiaData.registro.jornada}h (+{selectedDiaData.registro.horasExtras}h extras)
                      </span>
                    </div>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl text-xs space-y-2 border border-slate-100">
                    <div className="flex items-center gap-2">
                      <Truck className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="font-semibold text-slate-700">Vehículo:</span>
                      <span className="font-mono font-bold text-slate-900">{selectedDiaData.registro.vehiculo || 'S/P'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="font-semibold text-slate-700">Ruta:</span>
                      <span className="text-slate-900 font-medium">{selectedDiaData.registro.ruta || 'Sin ruta asignada'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold uppercase block">Observaciones:</span>
                      <p className="text-slate-700 text-xs italic mt-0.5 bg-white p-2 rounded-lg border border-slate-200/60">
                        {selectedDiaData.registro.observaciones || selectedDiaData.registro.originalRow?.observaciones || selectedDiaData.registro.originalRow?.Observaciones || 'Sin observaciones registradas.'}
                      </p>
                    </div>
                  </div>

                  <div className="pt-2 flex gap-2">
                    {onEditarRegistro && (
                      <button
                        onClick={() => {
                          const r = selectedDiaData.registro;
                          setSelectedDiaData(null);
                          if (r) onEditarRegistro(r);
                        }}
                        className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Edit3 className="w-4 h-4" />
                        <span>Editar Registro</span>
                      </button>
                    )}
                    <button
                      onClick={() => setSelectedDiaData(null)}
                      className="px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-200 cursor-pointer"
                    >
                      Cerrar
                    </button>
                  </div>
                </div>
              ) : selectedDiaData.justificacion ? (
                /* Si está justificado */
                <div className="space-y-4">
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
                    <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                      <span>🟡</span>
                      <span>Estado: Justificado ({obtenerEtiquetaJustificacion(selectedDiaData.justificacion.tipo)})</span>
                    </span>
                    <div className="mt-2 text-xs">
                      <span className="text-[10px] font-bold text-amber-700 uppercase block">Observaciones / Motivo:</span>
                      <p className="text-amber-900 mt-0.5 bg-white/80 p-2 rounded-lg border border-amber-200/60 italic">
                        {selectedDiaData.justificacion.nota || 'Sin nota explicativa.'}
                      </p>
                    </div>
                  </div>

                  <div className="pt-2 flex gap-2">
                    <button
                      onClick={() => {
                        setTipoJustificacionSelect(selectedDiaData.justificacion?.tipo || 'descanso');
                        setNotaJustificacion(selectedDiaData.justificacion?.nota || '');
                        setModalJustificarOpen(true);
                      }}
                      className="flex-1 py-2.5 bg-amber-600 text-white rounded-xl text-xs font-bold hover:bg-amber-700 cursor-pointer"
                    >
                      Modificar Justificación
                    </button>
                    <button
                      onClick={handleEliminarJustificacion}
                      className="px-3 py-2.5 bg-rose-50 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold hover:bg-rose-100 cursor-pointer"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              ) : selectedDiaData.esNoLaborable ? (
                /* Si es día no laborable (Domingo o festivo) */
                <div className="space-y-4">
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                    <h4 className="font-bold text-sm text-slate-800 flex items-center gap-1.5">
                      <span>⚪</span>
                      <span>Día No Laborable (Domingo / Festivo)</span>
                    </h4>
                    <p className="text-xs text-slate-500 mt-1">
                      No correspondía jornada ordinaria obligatoria para este colaborador.
                    </p>
                  </div>

                  <p className="text-xs text-slate-500 leading-relaxed">
                    Si el auxiliar prestó servicios este día con recargo dominical o festivo, puedes cargar su jornada directamente.
                  </p>

                  <div className="pt-2 flex gap-2">
                    <button
                      onClick={() => setModalRegistrarOpen(true)}
                      className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Registrar jornada dominical</span>
                    </button>
                    <button
                      onClick={() => setSelectedDiaData(null)}
                      className="px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-200 cursor-pointer"
                    >
                      Cerrar
                    </button>
                  </div>
                </div>
              ) : (
                /* Si está sin registro (Día laborable esperado) */
                <div className="space-y-4">
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl">
                    <h4 className="font-bold text-sm text-rose-800 flex items-center gap-1.5">
                      <span>🔴</span>
                      <span>Estado: Sin registro (Requiere revisión)</span>
                    </h4>
                    <p className="text-xs text-rose-700 mt-1">
                      Este día era esperado para el auxiliar y no cuenta con registro de turno ni justificación.
                    </p>
                  </div>

                  <p className="text-xs text-slate-500 leading-relaxed">
                    Puedes cargar la jornada del colaborador o registrar una justificación (incapacidad, permiso, descanso compensatorio, etc.).
                  </p>

                  <div className="pt-2 flex flex-col sm:flex-row gap-2">
                    <button
                      onClick={() => setModalRegistrarOpen(true)}
                      className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Registrar jornada</span>
                    </button>

                    <button
                      onClick={() => setModalJustificarOpen(true)}
                      className="flex-1 py-2.5 bg-amber-600 text-white rounded-xl text-xs font-bold hover:bg-amber-700 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <FileCheck className="w-4 h-4" />
                      <span>Justificar</span>
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 2: JUSTIFICAR DÍA */}
      <AnimatePresence>
        {modalJustificarOpen && selectedDiaData && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 relative text-left"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                <div>
                  <h3 className="font-display font-bold text-base text-slate-900">
                    Justificación de Asistencia
                  </h3>
                  <span className="text-xs text-slate-500 font-mono">
                    {selectedDiaData.fechaStr} — {currentAuxiliar}
                  </span>
                </div>
                <button
                  onClick={() => setModalJustificarOpen(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Seleccione el motivo de la justificación:
                </span>

                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {OPCIONES_JUSTIFICACION.map(opc => (
                    <label
                      key={opc.tipo}
                      className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                        tipoJustificacionSelect === opc.tipo
                          ? 'border-indigo-500 bg-indigo-50/50 ring-2 ring-indigo-500/20'
                          : 'border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="justificacionTipo"
                        value={opc.tipo}
                        checked={tipoJustificacionSelect === opc.tipo}
                        onChange={() => setTipoJustificacionSelect(opc.tipo)}
                        className="mt-0.5 text-indigo-600 focus:ring-indigo-500"
                      />
                      <div>
                        <span className="text-xs font-bold text-slate-800 block">
                          ○ {opc.label}
                        </span>
                        <span className="text-[10px] text-slate-500 block mt-0.5">
                          {opc.desc}
                        </span>
                      </div>
                    </label>
                  ))}
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-500 block mb-1">
                    Nota u observación adicional (opcional):
                  </label>
                  <textarea
                    value={notaJustificacion}
                    onChange={(e) => setNotaJustificacion(e.target.value)}
                    placeholder="Ej: Aprobado por Coordinador en turno nocturno..."
                    rows={2}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>

                <div className="pt-3 flex gap-2">
                  <button
                    onClick={handleGuardarJustificacion}
                    className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-colors"
                  >
                    Guardar Justificación
                  </button>
                  <button
                    onClick={() => setModalJustificarOpen(false)}
                    className="px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-200"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 3: REGISTRAR JORNADA RÁPIDA */}
      <AnimatePresence>
        {modalRegistrarOpen && selectedDiaData && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 relative text-left"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                <div>
                  <h3 className="font-display font-bold text-base text-slate-900">
                    Registrar Jornada de Turno
                  </h3>
                  <span className="text-xs text-slate-500 font-mono">
                    Fecha: {selectedDiaData.fechaStr} • {currentAuxiliar}
                  </span>
                </div>
                <button
                  onClick={() => setModalRegistrarOpen(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleRegistrarJornadaSubmit} className="space-y-3.5 text-xs">
                {regError && (
                  <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-medium">
                    {regError}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Hora Entrada</label>
                    <input
                      type="time"
                      value={regHoraIngreso}
                      onChange={(e) => setRegHoraIngreso(e.target.value)}
                      required
                      className="w-full p-2 rounded-xl border border-slate-200 font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Hora Salida</label>
                    <input
                      type="time"
                      value={regHoraSalida}
                      onChange={(e) => setRegHoraSalida(e.target.value)}
                      required
                      className="w-full p-2 rounded-xl border border-slate-200 font-mono font-bold"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Placa / Vehículo</label>
                  <input
                    type="text"
                    value={regVehiculo}
                    onChange={(e) => setRegVehiculo(e.target.value.toUpperCase())}
                    required
                    placeholder="Ej: VEH-101"
                    className="w-full p-2 rounded-xl border border-slate-200 font-mono uppercase"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Ruta o Destino</label>
                  <input
                    type="text"
                    value={regRuta}
                    onChange={(e) => setRegRuta(e.target.value.toUpperCase())}
                    required
                    placeholder="Ej: RUTA MEDELLIN - RIONEGRO"
                    className="w-full p-2 rounded-xl border border-slate-200 uppercase"
                  />
                </div>

                <div className="pt-3 flex gap-2">
                  <button
                    type="submit"
                    disabled={guardandoRegistro}
                    className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-colors disabled:opacity-50"
                  >
                    {guardandoRegistro ? 'Guardando...' : 'Guardar Turno'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setModalRegistrarOpen(false)}
                    className="px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-200"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
