/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Registro, AuxiliarStats } from '../types';
import {
  parseFecha,
  formatoNombreCapital,
  obtenerNombreCorto,
  normalizarNombre,
  esFestivoColombia,
  esDomingo,
  esNoLaborable,
  calcularDiasLaborablesEsperados
} from '../utils';
import { Calendar, ChevronLeft, ChevronRight, Clock, MapPin, Truck, AlertCircle, Info } from 'lucide-react';

interface CalendarViewProps {
  registros: Registro[];
  auxiliares?: AuxiliarStats[];
  listaAuxiliares?: string[];
  filtroAuxiliar?: string;
  setFiltroAuxiliar?: (aux: string) => void;
  initialSelectedAuxiliar?: string;
  lockedAuxiliar?: string;
  userRole?: 'admin' | 'auxiliar' | null;
  loggedAuxiliarName?: string;
}

export const CalendarView: React.FC<CalendarViewProps> = ({
  registros,
  auxiliares,
  listaAuxiliares,
  filtroAuxiliar,
  setFiltroAuxiliar,
  initialSelectedAuxiliar = '',
  lockedAuxiliar,
  userRole,
  loggedAuxiliarName,
}) => {
  const listaNombres = useMemo(() => {
    if (listaAuxiliares && listaAuxiliares.length > 0) return listaAuxiliares;
    if (auxiliares && auxiliares.length > 0) return auxiliares.map(a => a.nombre);
    return [];
  }, [listaAuxiliares, auxiliares]);

  const effectiveLocked = lockedAuxiliar || (userRole === 'auxiliar' ? loggedAuxiliarName : undefined);

  const [selectedAux, setSelectedAux] = useState<string>(
    effectiveLocked || filtroAuxiliar || initialSelectedAuxiliar || (listaNombres[0] || '')
  );

  React.useEffect(() => {
    if (effectiveLocked) {
      setSelectedAux(effectiveLocked);
    } else if (filtroAuxiliar) {
      setSelectedAux(filtroAuxiliar);
    }
  }, [effectiveLocked, filtroAuxiliar]);

  // Filtrado de quincena en el calendario
  const [filtroQuincenaCalendario, setFiltroQuincenaCalendario] = useState<'todo' | 'q1' | 'q2'>('todo');

  // Fecha de referencia: Mes y año dinámico (sincronizado con los registros o fecha actual)
  const [currentYear, setCurrentYear] = useState<number>(() => {
    if (registros && registros.length > 0) {
      const parsed = parseFecha(registros[0]?.fecha);
      if (parsed && !isNaN(parsed.getTime())) return parsed.getFullYear();
    }
    return new Date().getFullYear();
  });
  const [currentMonth, setCurrentMonth] = useState<number>(() => {
    if (registros && registros.length > 0) {
      const parsed = parseFecha(registros[0]?.fecha);
      if (parsed && !isNaN(parsed.getTime())) return parsed.getMonth();
    }
    return new Date().getMonth();
  });

  const meses = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  const diasSemana = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

  // Cambiar mes anterior/siguiente
  const anteriorMes = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(prev => prev - 1);
    } else {
      setCurrentMonth(prev => prev - 1);
    }
  };

  const siguienteMes = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(prev => prev + 1);
    } else {
      setCurrentMonth(prev => prev + 1);
    }
  };

  // Filtrar registros del auxiliar seleccionado para el mes y año actual
  const registrosMensuales = useMemo(() => {
    if (!selectedAux) return [];
    
    return registros.filter(reg => {
      if (normalizarNombre(reg.auxiliar) !== normalizarNombre(selectedAux)) return false;
      const regDate = parseFecha(reg.fecha);
      return (
        regDate.getFullYear() === currentYear &&
        regDate.getMonth() === currentMonth
      );
    });
  }, [registros, selectedAux, currentYear, currentMonth]);

  // Agrupar registros mensuales por día (un auxiliar no debería tener múltiples al día, pero por si acaso)
  const registrosPorDia = useMemo(() => {
    const mapa: { [dia: number]: Registro } = {};
    registrosMensuales.forEach(reg => {
      const regDate = parseFecha(reg.fecha);
      mapa[regDate.getDate()] = reg;
    });
    return mapa;
  }, [registrosMensuales]);

  // Generar la matriz del calendario (días del mes anterior, mes actual, mes siguiente)
  const celdasCalendario = useMemo(() => {
    const primerDiaMes = new Date(currentYear, currentMonth, 1);
    // JS getDay(): 0 para Dom, 1 para Lun, ..., 6 para Sáb.
    // Convertir para que Lunes sea 0 y Domingo sea 6.
    let diaInicioSemana = primerDiaMes.getDay() - 1;
    if (diaInicioSemana === -1) diaInicioSemana = 6; // Domingo

    const diasEnMes = new Date(currentYear, currentMonth + 1, 0).getDate();
    const diasEnMesAnterior = new Date(currentYear, currentMonth, 0).getDate();

    const celdas = [];

    // Rellenar días del mes anterior
    for (let i = diaInicioSemana - 1; i >= 0; i--) {
      celdas.push({
        dia: diasEnMesAnterior - i,
        esMesActual: false,
        fechaCompleta: new Date(currentYear, currentMonth - 1, diasEnMesAnterior - i),
      });
    }

    // Rellenar días del mes actual
    for (let i = 1; i <= diasEnMes; i++) {
      celdas.push({
        dia: i,
        esMesActual: true,
        fechaCompleta: new Date(currentYear, currentMonth, i),
      });
    }

    // Rellenar días del mes siguiente para completar grilla múltiplo de 7
    const celdasRestantes = 42 - celdas.length;
    for (let i = 1; i <= celdasRestantes; i++) {
      celdas.push({
        dia: i,
        esMesActual: false,
        fechaCompleta: new Date(currentYear, currentMonth + 1, i),
      });
    }

    return celdas;
  }, [currentYear, currentMonth]);

  // Estadísticas del auxiliar en este mes específico y período seleccionado (Quincena o Mes completo)
  const statsMensuales = useMemo(() => {
    let diasTrabajados = 0;
    let horasExtrasTotales = 0;
    let jornadaTotal = 0;

    const registrosFiltradosPorQuincena = registrosMensuales.filter(reg => {
      const d = parseFecha(reg.fecha).getDate();
      if (filtroQuincenaCalendario === 'q1') return d >= 1 && d <= 15;
      if (filtroQuincenaCalendario === 'q2') return d >= 16;
      return true;
    });

    registrosFiltradosPorQuincena.forEach(reg => {
      diasTrabajados++;
      horasExtrasTotales += reg.horasExtras;
      jornadaTotal += reg.jornada;
    });

    // Calcular días laborables esperados (excluyendo domingos y festivos)
    let fechaInicioPeriodo = new Date(currentYear, currentMonth, 1);
    let fechaFinPeriodo = new Date(currentYear, currentMonth + 1, 0);

    if (filtroQuincenaCalendario === 'q1') {
      fechaFinPeriodo = new Date(currentYear, currentMonth, 15);
    } else if (filtroQuincenaCalendario === 'q2') {
      fechaInicioPeriodo = new Date(currentYear, currentMonth, 16);
    }

    const diasHabilesEsperados = calcularDiasLaborablesEsperados(fechaInicioPeriodo, fechaFinPeriodo);

    return {
      diasTrabajados,
      diasHabilesEsperados,
      horasExtrasTotales: Math.round(horasExtrasTotales * 10) / 10,
      jornadaTotal: Math.round(jornadaTotal * 10) / 10,
      promedioJornada: diasTrabajados > 0 ? Math.round((jornadaTotal / diasTrabajados) * 10) / 10 : 0,
    };
  }, [registrosMensuales, filtroQuincenaCalendario, currentYear, currentMonth]);

  const selectedAuxObj = useMemo(() => {
    return (auxiliares || []).find(a => normalizarNombre(a.nombre) === normalizarNombre(selectedAux));
  }, [auxiliares, selectedAux]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      {/* Panel Lateral: Selector y Estadísticas del Mes */}
      <div className="lg:col-span-1 flex flex-col gap-5">
        <div className="bg-white p-5 rounded-lg border border-gray-100 border-l-4 border-l-brand-red shadow-[0_1px_3px_rgba(21,27,43,0.06)]">
          <h3 className="font-display font-semibold text-gray-800 text-sm mb-3 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-brand-red" />
            {effectiveLocked ? 'Mi Calendario Personal' : 'Control Mensual'}
          </h3>
          <p className="text-xs text-gray-500 mb-4">
            {effectiveLocked
              ? 'Consulta tu historial de turnos, jornadas y horas extras en el calendario.'
              : 'Selecciona un auxiliar de Ferricar para analizar el historial de turnos y recargos del mes.'}
          </p>

          <label className="block text-xs font-medium text-gray-400 mb-1">
            {effectiveLocked ? 'MI USUARIO' : 'AUXILIAR LOGÍSTICO'}
          </label>
          {effectiveLocked ? (
            <div className="w-full text-sm bg-indigo-50 border border-indigo-100 text-indigo-800 py-2.5 px-3 rounded-lg font-bold mb-3 flex items-center gap-1.5 shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse" />
              {formatoNombreCapital(effectiveLocked)}
            </div>
          ) : (
            <select
              value={selectedAux}
              onChange={(e) => {
                setSelectedAux(e.target.value);
                if (setFiltroAuxiliar) setFiltroAuxiliar(e.target.value);
              }}
              className="w-full text-sm bg-gray-50 border border-gray-200 text-gray-700 py-2 px-3 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium mb-3 cursor-pointer"
            >
              {listaNombres.map((nombre) => (
                <option key={nombre} value={nombre}>
                  {formatoNombreCapital(nombre)}
                </option>
              ))}
            </select>
          )}

          {/* Selector de Quincena para Calendario */}
          <div className="mt-3 pt-3 border-t border-gray-100">
            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-2">
              Período de Nómina (15/30)
            </label>
            <div className="grid grid-cols-3 gap-1">
              <button
                onClick={() => setFiltroQuincenaCalendario('todo')}
                className={`py-1.5 px-1 text-[10px] rounded-md font-bold border text-center transition-all cursor-pointer ${
                  filtroQuincenaCalendario === 'todo'
                    ? 'bg-brand-red border-brand-red text-white shadow-sm'
                    : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                Mes Comp.
              </button>
              <button
                onClick={() => setFiltroQuincenaCalendario('q1')}
                className={`py-1.5 px-1 text-[10px] rounded-md font-bold border text-center transition-all cursor-pointer ${
                  filtroQuincenaCalendario === 'q1'
                    ? 'bg-brand-red border-brand-red text-white shadow-sm'
                    : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                1ra Quinc.
              </button>
              <button
                onClick={() => setFiltroQuincenaCalendario('q2')}
                className={`py-1.5 px-1 text-[10px] rounded-md font-bold border text-center transition-all cursor-pointer ${
                  filtroQuincenaCalendario === 'q2'
                    ? 'bg-brand-red border-brand-red text-white shadow-sm'
                    : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                2da Quinc.
              </button>
            </div>
            <p className="text-[9px] text-gray-400 mt-2 font-medium">
              *Excluye domingos y festivos de Colombia de los días hábiles esperados.
            </p>
          </div>

          {selectedAuxObj && (
            <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-brand-red font-semibold">
              Nombre corto: {obtenerNombreCorto(selectedAuxObj.nombre)}
            </div>
          )}
        </div>

        {/* Resumen Estadístico Mensual */}
        <div className="bg-graphite-900 text-white p-5 rounded-lg border-l-4 border-l-brand-red shadow-md relative overflow-hidden">
          {/* Círculo decorativo */}
          <div className="absolute -right-10 -bottom-10 w-32 h-32 bg-brand-red rounded-full opacity-10 pointer-events-none" />
          
          <h4 className="font-display font-medium text-gray-400 text-xs uppercase tracking-wider mb-3">
            {filtroQuincenaCalendario === 'todo'
              ? `Resumen ${meses[currentMonth]} ${currentYear}`
              : filtroQuincenaCalendario === 'q1'
              ? `1ra Quincena de ${meses[currentMonth]}`
              : `2da Quincena de ${meses[currentMonth]}`}
          </h4>

          <div className="flex flex-col gap-4">
            <div>
              <span className="text-3xl font-display font-bold block text-white">
                {statsMensuales.horasExtrasTotales}h
              </span>
              <span className="text-[11px] text-gray-400 block mt-0.5">
                Horas extras en el período
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-graphite-800">
              <div>
                <span className="text-lg font-display font-bold block text-white flex items-baseline gap-1">
                  {statsMensuales.diasTrabajados}
                  <span className="text-xs font-normal text-gray-400">
                    / {statsMensuales.diasHabilesEsperados}
                  </span>
                </span>
                <span className="text-[10px] text-gray-400 block">
                  Días Trabajados
                </span>
              </div>
              <div>
                <span className="text-lg font-display font-semibold block text-gray-200">
                  {statsMensuales.promedioJornada}h
                </span>
                <span className="text-[10px] text-gray-400 block">
                  Prom. Jornada/Día
                </span>
              </div>
            </div>

            {/* Mensaje de Información de Calendario */}
            <div className="text-[10.5px] bg-graphite-850/60 p-2.5 rounded-md border border-graphite-800">
              <div className="flex gap-1.5 items-start">
                <Info className="w-3.5 h-3.5 text-brand-red shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block text-gray-300">Nómina e Inasistencias</span>
                  <p className="text-gray-300 mt-0.5 leading-relaxed">
                    Días hábiles calculados: <strong className="text-white font-mono">{statsMensuales.diasHabilesEsperados}</strong>.
                    {statsMensuales.diasTrabajados === statsMensuales.diasHabilesEsperados ? (
                      <span className="text-signal-green block font-semibold mt-0.5">🎉 ¡Quincena completa laborada!</span>
                    ) : statsMensuales.diasTrabajados > statsMensuales.diasHabilesEsperados ? (
                      <span className="text-signal-amber block font-semibold mt-0.5">🚀 Laboró domingos o días festivos.</span>
                    ) : (
                      <span className="text-gray-400 block mt-0.5">Faltan {statsMensuales.diasHabilesEsperados - statsMensuales.diasTrabajados} asistencias para quincena completa.</span>
                    )}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-2 text-[11px] text-gray-300 bg-graphite-850/50 p-2 rounded-md">
              {statsMensuales.horasExtrasTotales > 20 ? (
                <p className="text-signal-alert font-medium">
                  ⚠️ Alerta: El auxiliar superó las 20h extras este mes. Requiere compensatorio.
                </p>
              ) : statsMensuales.horasExtrasTotales > 10 ? (
                <p className="text-signal-amber font-medium">
                  📈 Atención: Horas extras moderadas (entre 10h y 20h).
                </p>
              ) : statsMensuales.horasExtrasTotales > 0 ? (
                <p className="text-signal-green font-medium">
                  ✅ Normal: Nivel de recargo bajo control (menor a 10h).
                </p>
              ) : (
                <p className="text-gray-400">
                  Sin registros de horas extras este mes.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Calendario Principal */}
      <div className="lg:col-span-3 bg-white p-5 rounded-lg border border-gray-100 border-l-4 border-l-brand-red shadow-[0_1px_3px_rgba(21,27,43,0.06)] flex flex-col justify-between">
        {/* Cabecera del Calendario */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <select
              value={currentMonth}
              onChange={(e) => setCurrentMonth(parseInt(e.target.value, 10))}
              className="text-sm font-display font-bold text-gray-800 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1 focus:ring-1 focus:ring-indigo-500 cursor-pointer"
            >
              {meses.map((m, idx) => (
                <option key={m} value={idx}>{m}</option>
              ))}
            </select>
            <select
              value={currentYear}
              onChange={(e) => setCurrentYear(parseInt(e.target.value, 10))}
              className="text-sm font-display font-semibold text-gray-600 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 focus:ring-1 focus:ring-indigo-500 cursor-pointer"
            >
              {[2024, 2025, 2026, 2027].map((yr) => (
                <option key={yr} value={yr}>{yr}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={anteriorMes}
              className="p-1.5 rounded-md hover:bg-gray-100 border border-gray-200 text-gray-500 cursor-pointer transition-colors"
              title="Mes Anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                const now = new Date();
                setCurrentYear(now.getFullYear());
                setCurrentMonth(now.getMonth());
              }}
              className="px-2.5 py-1 text-xs border border-gray-200 rounded-md hover:bg-gray-100 text-gray-600 cursor-pointer font-medium"
            >
              Mes Actual
            </button>
            <button
              onClick={siguienteMes}
              className="p-1.5 rounded-md hover:bg-gray-100 border border-gray-200 text-gray-500 cursor-pointer transition-colors"
              title="Siguiente Mes"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Nombres de los Días */}
        <div className="grid grid-cols-7 gap-1 text-center font-medium text-xs text-gray-400 mb-2">
          {diasSemana.map((dia) => (
            <div key={dia} className="py-1">
              {dia}
            </div>
          ))}
        </div>

        {/* Celdas del Calendario */}
        <div className="grid grid-cols-7 gap-1.5">
          {celdasCalendario.map((celda, idx) => {
            const registro = celda.esMesActual ? registrosPorDia[celda.dia] : null;
            const tieneOvertime = registro && registro.horasExtras > 0;
            
            const esHoliday = celda.esMesActual && esFestivoColombia(celda.fechaCompleta);
            const esSun = celda.esMesActual && esDomingo(celda.fechaCompleta);
            const esDescanso = esHoliday || esSun;

            // Determinar si queda fuera de la quincena enfocada
            let fueraDeQuincena = false;
            if (celda.esMesActual) {
              if (filtroQuincenaCalendario === 'q1' && celda.dia > 15) fueraDeQuincena = true;
              if (filtroQuincenaCalendario === 'q2' && celda.dia < 16) fueraDeQuincena = true;
            }
            
            return (
              <div
                key={idx}
                className={`min-h-[90px] p-2 rounded-lg border flex flex-col justify-between transition-all relative ${
                  !celda.esMesActual
                    ? 'bg-gray-50/50 border-gray-100 text-gray-300'
                    : fueraDeQuincena
                    ? 'bg-gray-50/20 border-gray-100/40 opacity-20 text-gray-300 pointer-events-none'
                    : registro
                    ? tieneOvertime
                      ? 'bg-signal-alert-soft/50 border-signal-alert/20 text-signal-alert'
                      : 'bg-signal-green-soft/30 border-signal-green/20 text-gray-800'
                    : esDescanso
                    ? 'bg-signal-amber-soft/15 border-dashed border-signal-amber/30 text-signal-amber/80'
                    : 'bg-white border-gray-100 text-gray-800 hover:border-brand-red-soft hover:bg-gray-50/50'
                }`}
              >
                {/* Día Número */}
                <div className="flex items-center justify-between">
                  <span className={`text-[11px] font-mono font-bold ${
                    !celda.esMesActual 
                      ? 'text-gray-300' 
                      : fueraDeQuincena
                      ? 'text-gray-200'
                      : esDescanso
                      ? 'text-signal-amber font-extrabold'
                      : registro 
                      ? 'text-graphite-900' 
                      : 'text-gray-400'
                  }`}>
                    {celda.dia}
                  </span>
                  
                  {/* Badge de Horas Extra */}
                  {registro && !fueraDeQuincena && (
                    tieneOvertime ? (
                      <span className="text-[9px] font-mono font-bold text-signal-alert bg-signal-alert-soft border border-signal-alert/10 px-1 py-0.5 rounded-sm">
                        +{registro.horasExtras}h
                      </span>
                    ) : (
                      <span className="text-[9px] font-mono font-bold text-signal-green bg-signal-green-soft border border-signal-green/10 px-1 py-0.5 rounded-sm">
                        {registro.jornada}h
                      </span>
                    )
                  )}
                </div>

                {/* Detalles de Turno o Descanso */}
                {registro && !fueraDeQuincena ? (
                  <div className="flex flex-col gap-0.5 mt-1.5">
                    {/* Horas Ingreso -> Salida */}
                    <div className="flex items-center gap-0.5 text-[8.5px] font-mono text-gray-500 font-semibold">
                      <Clock className="w-2 h-2 text-brand-red shrink-0" />
                      <span className="truncate">
                        {registro.horaIngreso.slice(0, 5)} → {registro.horaSalida.slice(0, 5)}
                      </span>
                    </div>

                    {/* Vehículo o Ruta */}
                    <div className="flex items-center gap-0.5 text-[8px] text-gray-400 truncate">
                      {registro.ruta ? (
                        <>
                          <MapPin className="w-1.5 h-1.5 text-brand-red-hover shrink-0" />
                          <span className="truncate font-semibold">{registro.ruta}</span>
                        </>
                      ) : (
                        <>
                          <Truck className="w-1.5 h-1.5 text-signal-amber shrink-0" />
                          <span className="truncate">{registro.vehiculo}</span>
                        </>
                      )}
                    </div>

                    {/* Alerta de Trabajo en Descanso */}
                    {esDescanso && (
                      <span className="text-[7px] font-bold text-brand-red bg-brand-red-soft border border-brand-red/10 rounded-xs px-1 py-0.5 w-max mt-1">
                        RECARGO DOM/FEST
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="mt-auto flex flex-col items-start gap-1">
                    {esHoliday && !fueraDeQuincena && (
                      <span className="text-[7.5px] font-bold text-amber-600 bg-amber-50 border border-amber-100 rounded-sm px-1 py-0.5">
                        FESTIVO COL
                      </span>
                    )}
                    {esSun && !fueraDeQuincena && (
                      <span className="text-[7.5px] font-bold text-gray-400 bg-gray-50 border border-gray-100 rounded-sm px-1 py-0.5">
                        DOMINGO
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
