/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Registro {
  id: string;
  marcaTemporal: string;
  auxiliar: string;
  vehiculo: string;
  fecha: string;
  horaIngreso: string;
  horaSalida: string;
  ruta: string;
  jornada: number; // Horas totales laboradas
  horasExtras: number; // Horas extras calculadas por encima de 8h (jornada - 8)
  originalRow: any;
  esNocturno?: boolean; // Turno nocturno
  observaciones?: string;
}

export interface AuxiliarStats {
  nombre: string;
  nombreCorto: string;
  horasExtrasTotales: number;
  jornadaTotal: number;
  diasTrabajados: number;
  promedioHorasExtras: number;
  registros: Registro[];
}

export type PeriodoFiltro = 'este_mes' | 'esta_semana' | 'ultimos_15_dias' | 'todo' | 'custom' | 'quincena_1' | 'quincena_2';

export type NavTab = 'dashboard' | 'auxiliares' | 'jornadas' | 'calendario' | 'reportes' | 'alertas' | 'configuracion';

export type CargoTipo = 'auxiliar_carga' | 'escolta' | 'auxiliar_operaciones';

export type TipoJustificacion =
  | 'descanso'
  | 'permiso'
  | 'incapacidad'
  | 'vacaciones'
  | 'no_laboro'
  | 'error_registro'
  | 'pendiente_validar';

export interface JustificacionDia {
  id?: string;
  auxiliar: string;
  fecha: string; // DD/MM/YYYY
  tipo: TipoJustificacion;
  nota?: string;
  fechaCreacion?: string;
}
