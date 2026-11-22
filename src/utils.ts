/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Registro, TipoJustificacion, JustificacionDia } from './types';
import {
  obtenerJustificaciones,
  guardarJustificacion as guardarJustificacionSupa,
  eliminarJustificacion as eliminarJustificacionSupa,
} from './supabase';

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
 * Determina si el turno es nocturno (cruza la medianoche).
 */
export function esTurnoNocturno(ingStr: string, salStr: string): boolean {
  const { ingMins, salMins } = obtenerMinsNormalizados(ingStr, salStr);
  return salMins < ingMins;
}

/**
 * Calcula las horas extras basadas en la jornada base configurada (por defecto 7 horas).
 */
export function calcularHorasExtra(jornada: number): number {
  const rawBase = safeLocalStorage.getItem('ferricar_jornada_base');
  const parsedBase = rawBase !== null ? Number(rawBase) : NaN;
  const jornadaBase = Number.isFinite(parsedBase) && parsedBase > 0 ? parsedBase : 7;
  return Math.max(0, Math.round((jornada - jornadaBase) * 10) / 10);
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
 * Convierte fechas en formato "D/M/AAAA" o "AAAA-MM-DD" (con o sin hora) a Date.
 * Devuelve null si la fecha es vacía o inválida.
 */
export function parseFecha(fechaStr: string): Date | null {
  if (!fechaStr || typeof fechaStr !== 'string') return null;
  const trimmed = fechaStr.trim();
  if (!trimmed) return null;

  let day: number;
  let month: number; // 0-indexed
  let year: number;

  const isoMatch = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s].*)?$/.exec(trimmed);
  if (isoMatch) {
    year = parseInt(isoMatch[1], 10);
    month = parseInt(isoMatch[2], 10) - 1;
    day = parseInt(isoMatch[3], 10);
  } else {
    const datePart = trimmed.split(/\s+/)[0];
    const parts = datePart.split('/');
    if (parts.length !== 3 || parts.some(p => !/^\d+$/.test(p))) {
      return null;
    }

    day = parseInt(parts[0], 10);
    month = parseInt(parts[1], 10) - 1; // 0-indexed
    year = parseInt(parts[2], 10);

    // Normalizar año mal digitado como "0026" o "26" a 2026
    if (year < 100) {
      year = 2000 + year;
    } else if (year > 100 && year < 2000) {
      year = 2000 + (year % 100);
    }
  }

  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    !Number.isFinite(day) ||
    month < 0 ||
    month > 11 ||
    day < 1 ||
    day > 31
  ) {
    return null;
  }

  const parsed = new Date(year, month, day);
  if (
    isNaN(parsed.getTime()) ||
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month ||
    parsed.getDate() !== day
  ) {
    return null;
  }

  return parsed;
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
 * Calcula el Domingo de Pascua para un año dado (Algoritmo de Meeus/Jones/Butcher).
 */
function calcularPascua(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31); // 3 = Marzo, 4 = Abril
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function sumarDias(date: Date, days: number): Date {
  const res = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  res.setDate(res.getDate() + days);
  return res;
}

/**
 * Traslada una fecha al lunes siguiente si no cae en lunes (Ley Emiliani - Ley 51 de 1983).
 */
function trasladarALunes(date: Date): Date {
  const dow = date.getDay();
  if (dow === 1) return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const offset = dow === 0 ? 1 : 8 - dow;
  return sumarDias(date, offset);
}

/**
 * Detecta si una fecha es un día festivo oficial en Colombia para cualquier año.
 */
export function esFestivoColombia(date: Date): boolean {
  const year = date.getFullYear();
  const month = date.getMonth(); // 0-indexed
  const day = date.getDate();

  // 1. Festivos fijos en Colombia (no se trasladan)
  if (
    (month === 0 && day === 1) ||   // 1 de Enero: Año Nuevo
    (month === 4 && day === 1) ||   // 1 de Mayo: Día del Trabajo
    (month === 6 && day === 20) ||  // 20 de Julio: Grito de Independencia
    (month === 7 && day === 7) ||   // 7 de Agosto: Batalla de Boyacá
    (month === 11 && day === 8) ||  // 8 de Diciembre: Inmaculada Concepción
    (month === 11 && day === 25)    // 25 de Diciembre: Navidad
  ) {
    return true;
  }

  // 2. Festivos móviles trasladados al lunes (Ley Emiliani) y basados en Pascua
  const pascua = calcularPascua(year);
  const festivosMoviles: Date[] = [
    trasladarALunes(new Date(year, 0, 6)),   // Reyes Magos (6 Ene)
    trasladarALunes(new Date(year, 2, 19)),  // San José (19 Mar)
    sumarDias(pascua, -3),                   // Jueves Santo
    sumarDias(pascua, -2),                   // Viernes Santo
    trasladarALunes(sumarDias(pascua, 39)),  // Ascensión del Señor
    trasladarALunes(sumarDias(pascua, 60)),  // Corpus Christi
    trasladarALunes(sumarDias(pascua, 68)),  // Sagrado Corazón de Jesús
    trasladarALunes(new Date(year, 5, 29)),  // San Pedro y San Pablo (29 Jun)
    trasladarALunes(new Date(year, 7, 15)),  // Asunción de la Virgen (15 Ago)
    trasladarALunes(new Date(year, 9, 12)),  // Día de la Raza (12 Oct)
    trasladarALunes(new Date(year, 10, 1)),  // Todos los Santos (1 Nov)
    trasladarALunes(new Date(year, 10, 11)), // Independencia de Cartagena (11 Nov)
  ];

  return festivosMoviles.some(
    f => f.getFullYear() === year && f.getMonth() === month && f.getDate() === day
  );
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
    if (!regDate) return false;
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
 * Obtiene el mapa de justificaciones en caché local (sincronizado desde Supabase).
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
 * Descarga todas las justificaciones desde Supabase, reconstruye la forma
 * { [AUXILIAR_UPPER]: { [FECHA]: JustificacionDia } } y actualiza el caché local.
 */
export async function sincronizarJustificacionesDesdeNube(): Promise<Record<string, Record<string, JustificacionDia>>> {
  const rows = await obtenerJustificaciones();
  const map: Record<string, Record<string, JustificacionDia>> = {};

  rows.forEach(row => {
    if (!row || !row.auxiliar || !row.fecha) return;
    const auxKey = normalizarNombre(row.auxiliar);
    const fechaKey = row.fecha.trim();
    if (!map[auxKey]) {
      map[auxKey] = {};
    }
    const detalle = (row.detalle && typeof row.detalle === 'object') ? row.detalle : {};
    map[auxKey][fechaKey] = {
      ...detalle,
      id: row.id || detalle.id,
      auxiliar: auxKey,
      fecha: fechaKey,
      tipo: row.tipo as TipoJustificacion,
      nota: row.nota ?? undefined,
      fechaCreacion: detalle.fechaCreacion || row.created_at,
    };
  });

  safeLocalStorage.setItem('ferricar_justificaciones_dias', JSON.stringify(map));
  return map;
}

/**
 * Guarda o actualiza una justificación en Supabase y actualiza el caché local solo si tuvo éxito.
 */
export async function guardarJustificacionStorage(justificacion: JustificacionDia): Promise<boolean> {
  const auxKey = normalizarNombre(justificacion.auxiliar);
  const fechaKey = justificacion.fecha.trim();
  const fechaCreacion = justificacion.fechaCreacion || new Date().toISOString();

  const payload: JustificacionDia = {
    ...justificacion,
    auxiliar: auxKey,
    fecha: fechaKey,
    fechaCreacion,
  };

  const saved = await guardarJustificacionSupa(payload);
  if (!saved) {
    return false;
  }

  const current = obtenerJustificacionesStorage();
  if (!current[auxKey]) {
    current[auxKey] = {};
  }
  const detalle = (saved.detalle && typeof saved.detalle === 'object') ? saved.detalle : {};
  current[auxKey][fechaKey] = {
    ...payload,
    ...detalle,
    id: saved.id || payload.id,
    auxiliar: auxKey,
    fecha: fechaKey,
    tipo: (saved.tipo as TipoJustificacion) || payload.tipo,
    nota: saved.nota ?? payload.nota,
    fechaCreacion: detalle.fechaCreacion || fechaCreacion,
  };
  safeLocalStorage.setItem('ferricar_justificaciones_dias', JSON.stringify(current));
  return true;
}

/**
 * Elimina una justificación en Supabase y actualiza el caché local solo si tuvo éxito.
 */
export async function eliminarJustificacionStorage(auxiliar: string, fecha: string): Promise<boolean> {
  const auxKey = normalizarNombre(auxiliar);
  const fechaKey = fecha.trim();

  const ok = await eliminarJustificacionSupa(auxKey, fechaKey);
  if (!ok) {
    return false;
  }

  const current = obtenerJustificacionesStorage();
  if (current[auxKey] && current[auxKey][fechaKey]) {
    delete current[auxKey][fechaKey];
    safeLocalStorage.setItem('ferricar_justificaciones_dias', JSON.stringify(current));
  }
  return true;
}

