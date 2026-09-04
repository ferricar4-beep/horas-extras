/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Registro, TipoJustificacion, JustificacionDia } from './types';

// Memoria de respaldo en caso de que localStorage esté bloqueado por políticas de iframe o cookies de terceros
const memoryStorage: Record<string, string> = {};

export const safeLocalStorage = {
  getItem(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      console.warn(`[Ferricar] Error al leer de localStorage para la clave "${key}":`, e);
      return memoryStorage[key] || null;
    }
  },
  setItem(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      console.warn(`[Ferricar] Error al escribir en localStorage para la clave "${key}":`, e);
      memoryStorage[key] = value;
    }
  },
  removeItem(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.warn(`[Ferricar] Error al eliminar de localStorage para la clave "${key}":`, e);
      delete memoryStorage[key];
    }
  }
};

/**
 * Convierte un formato de hora "H:MM:SS" o "H:MM" a minutos del día.
 */
export function toMins(t: string): number {
  if (!t) return 0;
  let str = t.trim().toUpperCase();
  
  const isPM = str.includes('PM');
  const isAM = str.includes('AM');
  
  str = str.replace(/[A-Z\s]/g, '');
  const parts = str.split(':');
  let h = parseInt(parts[0] || '0', 10);
  const m = parseInt(parts[1] || '0', 10);
  
  if (isPM) {
    if (h < 12) h += 12;
  } else if (isAM) {
    if (h === 12) h = 0;
  }
  
  return h * 60 + m;
}

/**
 * Obtiene los minutos de ingreso y salida normalizados, aplicando heurísticas para formato 12h sin sufijo AM/PM.
 */
export function obtenerMinsNormalizados(ingStr: string, salStr: string): { ingMins: number; salMins: number } {
  if (!ingStr || !salStr) return { ingMins: 0, salMins: 0 };

  const ingVal = ingStr.trim().toUpperCase();
  const salVal = salStr.trim().toUpperCase();

  const ingHasAmPm = ingVal.includes('AM') || ingVal.includes('PM');
  const salHasAmPm = salVal.includes('AM') || salVal.includes('PM');

  const ingClean = ingVal.replace(/[A-Z\s]/g, '');
  const salClean = salVal.replace(/[A-Z\s]/g, '');

  const ingParts = ingClean.split(':');
  const salParts = salClean.split(':');

  let ingH = parseInt(ingParts[0] || '0', 10);
  let salH = parseInt(salParts[0] || '0', 10);

  const ingM = parseInt(ingParts[1] || '0', 10);
  const salM = parseInt(salParts[1] || '0', 10);

  // Heurística de formato 12h sin sufijo AM/PM:
  // Si no tienen AM/PM y ambas horas están entre 1 y 12:
  if (!ingHasAmPm && !salHasAmPm && ingH > 0 && ingH <= 12 && salH > 0 && salH <= 12) {
    // Si la hora de salida está entre 1 y 11, casi siempre es de la tarde/noche (PM),
    // ya que no se laboran turnos de 1 hora (ej. de 6:00 a 7:00 es de 6:00 AM a 7:00 PM, i.e. 13h).
    if (salH >= 1 && salH <= 11) {
      salH += 12;
    } else if (salH <= ingH) {
      // Fallback de seguridad: si la salida sigue siendo menor o igual al ingreso, le sumamos 12
      salH += 12;
    }
  }

  // Convertir a minutos
  let ingMins = ingH * 60 + ingM;
  let salMins = salH * 60 + salM;

  // Ajustar si venían con AM/PM explícitos
  if (ingHasAmPm) {
    const isPM = ingVal.includes('PM');
    const isAM = ingVal.includes('AM');
    let h = parseInt(ingParts[0] || '0', 10);
    if (isPM && h < 12) h += 12;
    if (isAM && h === 12) h = 0;
    ingMins = h * 60 + ingM;
  }

  if (salHasAmPm) {
    const isPM = salVal.includes('PM');
    const isAM = salVal.includes('AM');
    let h = parseInt(salParts[0] || '0', 10);
    if (isPM && h < 12) h += 12;
    if (isAM && h === 12) h = 0;
    salMins = h * 60 + salM;
  }

  return { ingMins, salMins };
}

/**
 * Calcula la jornada total en horas.
 * Si la hora de salida es menor que la de ingreso, asume turno nocturno (suma 24 horas).
 */
export function calcularJornada(ingStr: string, salStr: string): number {
  let { ingMins, salMins } = obtenerMinsNormalizados(ingStr, salStr);
  
  if (salMins < ingMins) {
    // Turno nocturno cruza la medianoche
    salMins += 24 * 60;
  }
  
  const diffMins = salMins - ingMins;
  return Math.round((diffMins / 60) * 10) / 10; // Redondear a 1 decimal
}

/**
 * Determina si el turno es nocturno según el Código Sustantivo del Trabajo de Colombia (21:00 a 06:00).
 * Si el turno toca este rango horario o cruza la medianoche, activa automáticamente la bandera es_nocturno = true.
 */
export function esTurnoNocturno(ingStr: string, salStr: string): boolean {
  if (!ingStr || !salStr) return false;
  const { ingMins, salMins } = obtenerMinsNormalizados(ingStr, salStr);
  if (ingMins === 0 && salMins === 0) return false;

  // Turno que cruza la medianoche (ej: 22:00 a 06:00 o 20:00 a 04:00)
  if (salMins < ingMins) return true;

  // Rango nocturno legal en Colombia: 21:00 (1260 mins) a 06:00 (360 mins)
  // Toca antes de las 06:00 AM:
  if (ingMins < 6 * 60) return true;

  // Toca a partir de las 21:00 (9:00 PM):
  if (salMins > 21 * 60) return true;

  return false;
}

/**
 * Calcula las horas extras basadas en una jornada ordinaria legal de 8.0 horas.
 * Horas Extras = max(0, Jornada - 8.0)
 */
export function calcularHorasExtra(jornada: number, baseLegal: number = 8): number {
  return Math.max(0, Math.round((jornada - baseLegal) * 10) / 10);
}

/**
 * Normaliza espacios dobles o raros en los nombres de los auxiliares.
 */
export function normalizarNombre(nombre: string): string {
  if (!nombre) return '';
  return nombre.replace(/\s+/g, ' ').trim().toUpperCase();
}

/**
 * Convierte nombres en mayúscula tipo "FIGUEROA LOPEZ JUAN PABLO" a formato Capitalizado.
 */
export function formatoNombreCapital(nombre: string): string {
  const norm = normalizarNombre(nombre);
  return norm.split(' ').map(word => {
    if (!word) return '';
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  }).join(' ');
}

/**
 * Obtiene un nombre corto elegante para pantallas móviles y dashboards.
 * Ej: "FIGUEROA LOPEZ JUAN PABLO" -> "Juan P. Figueroa"
 * Ej: "AGUDELO SERNA MATEO" -> "Mateo Agudelo"
 */
export function obtenerNombreCorto(nombre: string): string {
  const cap = formatoNombreCapital(nombre);
  const parts = cap.split(' ');
  if (parts.length >= 4) {
    const s1 = parts[0]; // Apellido 1
    const n1 = parts[2]; // Nombre 1
    const n2 = parts[3]; // Nombre 2
    return `${n1} ${n2.charAt(0)}. ${s1}`;
  } else if (parts.length === 3) {
    const s1 = parts[0]; // Apellido 1
    const n1 = parts[2]; // Nombre 1
    return `${n1} ${s1}`;
  } else if (parts.length === 2) {
    return `${parts[1]} ${parts[0]}`;
  }
  return cap;
}

/**
 * Convierte la fecha del formato "D/MM/YYYY" o similar, soportando años mal digitados como "0026".
 */
export function parseFecha(fechaStr: string): Date {
  if (!fechaStr) return new Date();
  const parts = fechaStr.trim().split('/');
  if (parts.length < 3) return new Date();
  
  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1; // 0-indexed
  let year = parseInt(parts[2], 10);
  
  // Normalizar año mal digitado como "0026" o "26" a 2026
  if (year < 100) {
    year = 2000 + year;
  }
  if (year > 100 && year < 2000) {
    year = 2000 + (year % 100);
  }
  
  return new Date(year, month, day);
}



/**
 * Obtiene la semana del año para agrupar en gráficos.
 */
export function getSemanaAno(date: Date): { numero: number; etiqueta: string } {
  const tempDate = new Date(date.getTime());
  tempDate.setHours(0, 0, 0, 0);
  // Jueves en la semana en curso determina el año de la semana
  tempDate.setDate(tempDate.getDate() + 3 - (tempDate.getDay() + 6) % 7);
  // Primer jueves del año
  const week1 = new Date(tempDate.getFullYear(), 0, 4);
  // Calcular diferencia en días
  const diffDays = Math.round((tempDate.getTime() - week1.getTime()) / 86400000);
  const weekNum = 1 + Math.round(((diffDays / 7)));
  
  // Etiqueta bonita (ej: "Semana 15 (Abr)")
  const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const mesLabel = meses[date.getMonth()];
  return {
    numero: weekNum,
    etiqueta: `S${weekNum} (${mesLabel})`
  };
}

/**
 * Filtra los registros según el período.
 * Fecha actual de referencia: 2026-07-04 (Julio 2026, según metadatos).
 */
/**
 * Detecta si una fecha es un día festivo oficial en Colombia (Año 2026 completo y festivos fijos).
 */
export function esFestivoColombia(date: Date): boolean {
  const year = date.getFullYear();
  const month = date.getMonth(); // 0-indexed
  const day = date.getDate();

  // Festivos fijos en Colombia (aplica para cualquier año)
  // 1 de Enero: Año Nuevo
  if (month === 0 && day === 1) return true;
  // 1 de Mayo: Día del Trabajo
  if (month === 4 && day === 1) return true;
  // 20 de Julio: Grito de Independencia
  if (month === 6 && day === 20) return true;
  // 7 de Agosto: Batalla de Boyacá
  if (month === 7 && day === 7) return true;
  // 8 de Diciembre: Inmaculada Concepción
  if (month === 11 && day === 8) return true;
  // 25 de Diciembre: Navidad
  if (month === 11 && day === 25) return true;

  // Calendario de festivos oficiales móviles de Colombia para el año 2026 (Ley Emiliani)
  if (year === 2026) {
    // Enero 12: Reyes Magos
    if (month === 0 && day === 12) return true;
    // Marzo 23: San José
    if (month === 2 && day === 23) return true;
    // Abril 2: Jueves Santo
    if (month === 3 && day === 2) return true;
    // Abril 3: Viernes Santo
    if (month === 3 && day === 3) return true;
    // Mayo 18: Ascensión del Señor
    if (month === 4 && day === 18) return true;
    // Junio 8: Corpus Christi
    if (month === 5 && day === 8) return true;
    // Junio 15: Sagrado Corazón
    if (month === 5 && day === 15) return true;
    // Junio 29: San Pedro y San Pablo
    if (month === 5 && day === 29) return true;
    // Agosto 17: Asunción de la Virgen
    if (month === 7 && day === 17) return true;
    // Octubre 12: Día de la Raza
    if (month === 9 && day === 12) return true;
    // Noviembre 2: Todos los Santos
    if (month === 10 && day === 2) return true;
    // Noviembre 16: Independencia de Cartagena
    if (month === 10 && day === 16) return true;
  }
  
  return false;
}

/**
 * Determina si la fecha es Domingo.
 */
export function esDomingo(date: Date): boolean {
  return date.getDay() === 0;
}

/**
 * Determina si un día es no laborable en Colombia (Domingos y Festivos).
 */
export function esNoLaborable(date: Date): boolean {
  return esDomingo(date) || esFestivoColombia(date);
}

/**
 * Calcula los días hábiles/laborables esperados en un rango de fechas (excluyendo domingos y festivos de Colombia).
 */
export function calcularDiasLaborablesEsperados(fechaInicio: Date, fechaFin: Date): number {
  let count = 0;
  const curr = new Date(fechaInicio.getTime());
  curr.setHours(0, 0, 0, 0);
  const fin = new Date(fechaFin.getTime());
  fin.setHours(23, 59, 59, 999);

  while (curr <= fin) {
    if (!esNoLaborable(curr)) {
      count++;
    }
    curr.setDate(curr.getDate() + 1);
  }
  return count;
}

/**
 * Filtra los registros según el período.
 * Fecha actual de referencia: 2026-07-04 (Julio 2026, según metadatos).
 */
export function filtrarPorPeriodo(
  registros: Registro[],
  filtro: string,
  fechaInicioCustom?: string,
  fechaFinCustom?: string,
  mesRef?: number, // 0-indexed (ej: 5 = Junio, 6 = Julio)
  anoRef?: number
): Registro[] {
  const hoyRef = new Date();
  const defaultAno = anoRef !== undefined ? anoRef : hoyRef.getFullYear();
  const defaultMes = mesRef !== undefined ? mesRef : hoyRef.getMonth();
  
  return registros.filter(reg => {
    const regDate = parseFecha(reg.fecha);
    const regY = regDate.getFullYear();
    const regM = regDate.getMonth();
    const regD = regDate.getDate();
    
    if (filtro === 'quincena_1') {
      return regY === defaultAno && regM === defaultMes && regD >= 1 && regD <= 15;
    } else if (filtro === 'quincena_2') {
      return regY === defaultAno && regM === defaultMes && regD >= 16 && regD <= 31;
    } else if (filtro === 'este_mes') {
      return regY === defaultAno && regM === defaultMes;
    } else if (filtro === 'esta_semana') {
      const limInicio = new Date(hoyRef);
      limInicio.setDate(hoyRef.getDate() - 7);
      limInicio.setHours(0, 0, 0, 0);
      const limFin = new Date(hoyRef);
      limFin.setHours(23, 59, 59, 999);
      return regDate >= limInicio && regDate <= limFin;
    } else if (filtro === 'ultimos_15_dias') {
      const limInicio = new Date(hoyRef);
      limInicio.setDate(hoyRef.getDate() - 15);
      limInicio.setHours(0, 0, 0, 0);
      const limFin = new Date(hoyRef);
      limFin.setHours(23, 59, 59, 999);
      return regDate >= limInicio && regDate <= limFin;
    } else if (filtro === 'custom') {
      if (!fechaInicioCustom && !fechaFinCustom) return true;
      let cumple = true;
      if (fechaInicioCustom) {
        const parts = fechaInicioCustom.split('-');
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10) - 1;
        const d = parseInt(parts[2], 10);
        const dInicio = new Date(y, m, d, 0, 0, 0, 0);
        cumple = cumple && regDate >= dInicio;
      }
      if (fechaFinCustom) {
        const parts = fechaFinCustom.split('-');
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10) - 1;
        const d = parseInt(parts[2], 10);
        const dFin = new Date(y, m, d, 23, 59, 59, 999);
        cumple = cumple && regDate <= dFin;
      }
      return cumple;
    }
    
    return true; // Todo
  });
}

/**
 * Obtiene la etiqueta legible del cargo del auxiliar según la configuración.
 */
export function obtenerCargoDisplay(auxiliarName: string, customCargos?: Record<string, string>): string {
  if (!auxiliarName) return 'Auxiliar de Carga';
  let cargos = customCargos;
  if (!cargos) {
    const stored = safeLocalStorage.getItem('ferricar_auxiliar_cargos');
    if (stored) {
      try {
        cargos = JSON.parse(stored);
      } catch {
        cargos = {};
      }
    } else {
      cargos = {};
    }
  }
  const cargo = cargos?.[auxiliarName.toUpperCase()] || '';
  if (cargo === 'escolta') return 'Escolta';
  if (cargo === 'auxiliar_operaciones') return 'Auxiliar de Operaciones';
  return 'Auxiliar de Carga';
}

/**
 * Devuelve la etiqueta legible de un tipo de justificación.
 */
export function obtenerEtiquetaJustificacion(tipo: TipoJustificacion): string {
  switch (tipo) {
    case 'descanso':
      return 'Descanso';
    case 'permiso':
      return 'Permiso';
    case 'incapacidad':
      return 'Incapacidad';
    case 'vacaciones':
      return 'Vacaciones';
    case 'no_laboro':
      return 'No laboró';
    case 'error_registro':
      return 'Error de registro';
    case 'pendiente_validar':
      return 'Pendiente de validar';
    default:
      return 'Justificado';
  }
}

/**
 * Obtiene el mapa de justificaciones guardadas de localStorage.
 * Estructura: { [AUXILIAR_UPPER]: { [FECHA_DD_MM_YYYY]: JustificacionDia } }
 */
export function obtenerJustificacionesStorage(): Record<string, Record<string, JustificacionDia>> {
  const raw = safeLocalStorage.getItem('ferricar_justificaciones_dias');
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

/**
 * Guarda o actualiza una justificación para un auxiliar y fecha específica.
 */
export function guardarJustificacionStorage(justificacion: JustificacionDia): void {
  const current = obtenerJustificacionesStorage();
  const auxKey = normalizarNombre(justificacion.auxiliar);
  if (!current[auxKey]) {
    current[auxKey] = {};
  }
  current[auxKey][justificacion.fecha.trim()] = {
    ...justificacion,
    auxiliar: auxKey,
    fecha: justificacion.fecha.trim(),
    fechaCreacion: justificacion.fechaCreacion || new Date().toISOString()
  };
  safeLocalStorage.setItem('ferricar_justificaciones_dias', JSON.stringify(current));
}

/**
 * Elimina una justificación registrada para un auxiliar en una fecha.
 */
export function eliminarJustificacionStorage(auxiliar: string, fecha: string): void {
  const current = obtenerJustificacionesStorage();
  const auxKey = normalizarNombre(auxiliar);
  if (current[auxKey] && current[auxKey][fecha.trim()]) {
    delete current[auxKey][fecha.trim()];
    safeLocalStorage.setItem('ferricar_justificaciones_dias', JSON.stringify(current));
  }
}

