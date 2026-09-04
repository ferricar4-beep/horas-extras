import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Briefcase,
  Plus,
  Filter,
  Search,
  Download,
  Calendar,
  Clock,
  Edit2,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Moon,
  Sun,
  Truck,
  RotateCcw,
  Sparkles
} from 'lucide-react';
import { Registro, PeriodoFiltro, AuxiliarStats } from '../types';
import { formatoNombreCapital, obtenerCargoDisplay, normalizarNombre } from '../utils';
import { HoursRegister } from './HoursRegister';

interface JornadasViewProps {
  registros: Registro[];
  registrosFiltrados?: Registro[];
  auxiliaresList?: string[];
  listaAuxiliares?: string[];
  statsAuxiliares?: AuxiliarStats[];
  userRole: 'admin' | 'auxiliar' | null;
  loggedAuxiliarName: string;
  onAddRegistro?: (reg: any) => Promise<any> | any;
  onAgregarRegistro?: (reg: any) => Promise<any> | any;
  onEditRegistro?: (reg: Registro) => void;
  onEditarRegistro?: (reg: Registro) => void;
  onDeleteRegistro?: (id: string, auxiliar: string, fecha: string) => void;
  onEliminarRegistro?: (id: string, auxiliar: string, fecha: string) => void;
  filtroPeriodo: PeriodoFiltro;
  setFiltroPeriodo: (p: PeriodoFiltro) => void;
  filtroMes: number;
  setFiltroMes: (m: number) => void;
  filtroAno?: number;
  setFiltroAno?: (a: number) => void;
  filtroAuxiliar: string;
  setFiltroAuxiliar: (aux: string) => void;
  fechaInicioCustom: string;
  setFechaInicioCustom: (f: string) => void;
  fechaFinCustom: string;
  setFechaFinCustom: (f: string) => void;
  onExportExcel: () => void;
  onResetFiltros?: () => void;
  origenData?: 'supabase' | 'local';
  sincronizarDatos?: () => Promise<void>;
  justAddedId?: string | null;
  searchTermExterno?: string;
}

export const JornadasView: React.FC<JornadasViewProps> = ({
  registros,
  registrosFiltrados: registrosFiltradosProp,
  auxiliaresList,
  listaAuxiliares,
  statsAuxiliares = [],
  userRole,
  loggedAuxiliarName,
  onAddRegistro,
  onAgregarRegistro,
  onEditRegistro,
  onEditarRegistro,
  onDeleteRegistro,
  onEliminarRegistro,
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
  onExportExcel,
  onResetFiltros,
  origenData,
  sincronizarDatos,
  justAddedId,
  searchTermExterno,
}) => {
  const [showRegisterForm, setShowRegisterForm] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [pagina, setPagina] = useState(1);
  const porPagina = 15;

  const handleAdd = async (reg: any): Promise<boolean> => {
    const fn = onAgregarRegistro || onAddRegistro;
    if (fn) {
      const res = await fn(reg);
      return res !== false;
    }
    return false;
  };
  const handleEdit = onEditarRegistro || onEditRegistro || (() => {});
  const handleDelete = onEliminarRegistro || onDeleteRegistro || (() => {});
  const effectiveAuxiliares = auxiliaresList || listaAuxiliares || [];

  // Filtrado local en tabla (soporta tanto buscador de la vista como buscador global del header)
  const sourceList = registrosFiltradosProp || registros;
  const effectiveSearch = busqueda.trim() || (searchTermExterno || '').trim();

  const registrosFiltrados = sourceList.filter(reg => {
    const q = effectiveSearch.toLowerCase().trim();
    if (!q) return true;
    const cargo = (obtenerCargoDisplay(reg.auxiliar) || '').toLowerCase();
    return (
      (reg.auxiliar && reg.auxiliar.toLowerCase().includes(q)) ||
      (reg.vehiculo && reg.vehiculo.toLowerCase().includes(q)) ||
      (reg.fecha && reg.fecha.toLowerCase().includes(q)) ||
      (reg.ruta && reg.ruta.toLowerCase().includes(q)) ||
      cargo.includes(q)
    );
  });

  const totalPaginas = Math.max(1, Math.ceil(registrosFiltrados.length / porPagina));
  const registrosPaginados = registrosFiltrados.slice((pagina - 1) * porPagina, pagina * porPagina);

  return (
    <div className="space-y-6 text-left">
      {/* 1. Barra de Acción & Formulario Plegable */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100">
              <Briefcase className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-lg font-display font-bold text-slate-900 tracking-tight">
                Planilla General de Jornadas y Turnos
              </h2>
              <p className="text-xs text-slate-500">
                Consulta, audita y registra las asistencias de distribución en ruta.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowRegisterForm(prev => !prev)}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs ${
              showRegisterForm
                ? 'bg-slate-800 hover:bg-slate-900 text-white'
                : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/30'
            }`}
          >
            <Plus className={`w-4 h-4 transition-transform ${showRegisterForm ? 'rotate-45' : ''}`} />
            <span>{showRegisterForm ? 'Ocultar Formulario' : 'Registrar Nuevo Turno'}</span>
          </button>

          {userRole === 'admin' && (
            <button
              onClick={onExportExcel}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
              title="Descargar datos en Excel CSV"
            >
              <Download className="w-4 h-4 text-emerald-600" />
              <span className="hidden sm:inline">Exportar Excel</span>
            </button>
          )}
        </div>
      </div>

      {/* Formulario de registro de turno desplegable */}
      <AnimatePresence>
        {showRegisterForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-white p-6 rounded-2xl border border-indigo-200 shadow-md">
              <div className="mb-4 pb-3 border-b border-slate-150 flex items-center justify-between">
                <div>
                  <h3 className="font-display font-bold text-base text-slate-900 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-indigo-600" />
                    Nuevo Registro de Asistencia
                  </h3>
                  <p className="text-xs text-slate-500">
                    Ingresa los datos del turno para cálculo automático de jornada y horas extras.
                  </p>
                </div>
              </div>

              <HoursRegister
                auxiliares={effectiveAuxiliares}
                lockedAuxiliar={userRole === 'auxiliar' ? loggedAuxiliarName : undefined}
                onAddRegistro={async (reg) => {
                  const res = await handleAdd(reg);
                  if (res) setShowRegisterForm(false);
                  return res;
                }}
                origenData={origenData || 'supabase'}
                sincronizarDatos={sincronizarDatos || (async () => {})}
                existingRegistros={registros}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 2. Filtros de Período y Búsqueda */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Buscador */}
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por auxiliar, placa, ruta o fecha..."
              value={busqueda}
              onChange={(e) => {
                setBusqueda(e.target.value);
                setPagina(1);
              }}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium"
            />
          </div>

          {/* Selectores de Período y Filtro */}
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={filtroPeriodo}
              onChange={(e) => setFiltroPeriodo(e.target.value as PeriodoFiltro)}
              className="text-xs bg-slate-50 border border-slate-200 text-slate-700 py-1.5 px-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-semibold"
            >
              <option value="quincena_1">1ra Quincena (1 al 15)</option>
              <option value="quincena_2">2da Quincena (16 al fin)</option>
              <option value="este_mes">Mes Completo</option>
              <option value="ultimos_15_dias">Últimos 15 días</option>
              <option value="todo">Historial Completo</option>
              <option value="custom">Rango Personalizado</option>
            </select>

            {userRole === 'admin' && (
              <select
                value={filtroAuxiliar}
                onChange={(e) => {
                  setFiltroAuxiliar(e.target.value);
                  setPagina(1);
                }}
                className="text-xs bg-slate-50 border border-slate-200 text-slate-700 py-1.5 px-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-semibold max-w-[200px]"
              >
                <option value="">Todos los Auxiliares</option>
                {effectiveAuxiliares.map((aux) => (
                  <option key={aux} value={aux}>
                    {formatoNombreCapital(aux)}
                  </option>
                ))}
              </select>
            )}

            <button
              onClick={onResetFiltros}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer border border-slate-200"
              title="Limpiar filtros"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Fechas personalizadas condicionales */}
        {filtroPeriodo === 'custom' && (
          <div className="flex items-center gap-3 pt-2 border-t border-slate-100 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Desde:</span>
              <input
                type="date"
                value={fechaInicioCustom}
                onChange={(e) => setFechaInicioCustom(e.target.value)}
                className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-slate-700 font-medium"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Hasta:</span>
              <input
                type="date"
                value={fechaFinCustom}
                onChange={(e) => setFechaFinCustom(e.target.value)}
                className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-slate-700 font-medium"
              />
            </div>
          </div>
        )}
      </div>

      {/* 3. Tabla Empresarial de Turnos */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200/80 font-bold text-slate-500 uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4">Colaborador</th>
                <th className="py-3 px-3">Placa / Vehículo</th>
                <th className="py-3 px-3">Fecha</th>
                <th className="py-3 px-3">Turno (Ing - Sal)</th>
                <th className="py-3 px-3">Ruta</th>
                <th className="py-3 px-3 text-right">Jornada</th>
                <th className="py-3 px-3 text-right">Horas Extras</th>
                <th className="py-3 px-4 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {registrosPaginados.map((reg) => (
                <tr key={reg.id || `${reg.auxiliar}-${reg.fecha}-${reg.horaIngreso}`} className="hover:bg-slate-50/60 transition-colors">
                  <td className="py-3 px-4">
                    <span className="font-bold text-slate-900 block truncate max-w-[200px]" title={reg.auxiliar}>
                      {formatoNombreCapital(reg.auxiliar)}
                    </span>
                    <span className="text-[10px] text-slate-500 block mt-0.5">
                      {obtenerCargoDisplay(reg.auxiliar)}
                    </span>
                  </td>

                  <td className="py-3 px-3">
                    <span className="font-mono font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200 text-[11px]">
                      {reg.vehiculo || 'S/P'}
                    </span>
                  </td>

                  <td className="py-3 px-3">
                    <span className="font-medium text-slate-700">{reg.fecha}</span>
                  </td>

                  <td className="py-3 px-3">
                    <div className="flex items-center gap-1.5 font-mono text-[11px] text-slate-700">
                      <span>{reg.horaIngreso} — {reg.horaSalida}</span>
                      {reg.esNocturno && (
                        <span className="p-1 rounded bg-purple-50 text-purple-700" title="Turno con recargo nocturno">
                          <Moon className="w-3 h-3" />
                        </span>
                      )}
                    </div>
                  </td>

                  <td className="py-3 px-3">
                    <span className="text-slate-600 truncate max-w-[150px] block" title={reg.ruta}>
                      {reg.ruta || 'Sin Ruta'}
                    </span>
                  </td>

                  <td className="py-3 px-3 text-right font-mono font-bold text-slate-800">
                    {reg.jornada}h
                  </td>

                  <td className="py-3 px-3 text-right">
                    <span className={`font-mono font-bold px-2 py-0.5 rounded-md ${
                      reg.horasExtras > 0
                        ? 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                        : 'bg-slate-100 text-slate-500'
                    }`}>
                      {reg.horasExtras > 0 ? `+${reg.horasExtras}h` : '0h'}
                    </span>
                  </td>

                  {(() => {
                    const canEditOrDelete = userRole === 'admin' || (
                      userRole === 'auxiliar' &&
                      normalizarNombre(reg.auxiliar) === normalizarNombre(loggedAuxiliarName)
                    );

                    return (
                      <td className="py-3 px-4 text-center">
                        {canEditOrDelete ? (
                          <div className="inline-flex items-center gap-1">
                            <button
                              onClick={() => handleEdit(reg)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer"
                              title="Editar registro"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDelete(reg.id, reg.auxiliar, reg.fecha)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                              title="Eliminar registro"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-300 font-mono">—</span>
                        )}
                      </td>
                    );
                  })()}
                </tr>
              ))}

              {registrosPaginados.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <Briefcase className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                    <p className="text-xs font-semibold text-slate-600">No se encontraron jornadas registradas</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Ajusta los filtros o utiliza el buscador para localizar registros.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        <div className="p-4 border-t border-slate-150 flex items-center justify-between text-xs text-slate-500">
          <span>
            Mostrando <strong>{registrosFiltrados.length === 0 ? 0 : (pagina - 1) * porPagina + 1}</strong> a <strong>{Math.min(pagina * porPagina, registrosFiltrados.length)}</strong> de <strong>{registrosFiltrados.length}</strong> turnos
          </span>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setPagina(p => Math.max(1, p - 1))}
              disabled={pagina === 1}
              className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-mono font-bold px-2 text-slate-700">
              {pagina} / {totalPaginas}
            </span>
            <button
              onClick={() => setPagina(p => Math.min(totalPaginas, p + 1))}
              disabled={pagina === totalPaginas}
              className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
