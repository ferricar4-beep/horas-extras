import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Users,
  UserPlus,
  Search,
  Key,
  Shield,
  Briefcase,
  Calendar,
  CheckCircle2,
  Clock,
  Trash2,
  Edit3,
  Eye,
  EyeOff,
  RotateCcw,
  X,
  ChevronRight,
  Truck,
  MapPin,
  FileText,
  AlertCircle,
  TrendingUp,
  UserCheck
} from 'lucide-react';
import { Registro, AuxiliarStats, CargoTipo } from '../types';
import { formatoNombreCapital, obtenerCargoDisplay } from '../utils';
import { DetalleAuxiliarView } from './DetalleAuxiliarView';

interface AuxiliaresViewProps {
  auxiliaresList?: string[];
  listaAuxiliares?: string[];
  pinsMap: Record<string, string>;
  auxiliarCargos: Record<string, string>;
  statsAuxiliares: AuxiliarStats[];
  allRegistros?: Registro[];
  registros?: Registro[];
  onUpdatePin: (auxiliar: string, newPin: string) => void;
  onUpdateCargo: (auxiliar: string, newCargo: string) => void;
  onCreateAuxiliar: (nombre: string, pin: string, cargo: string) => void;
  onDeleteAuxiliar?: (auxiliar: string) => void;
  onViewAuxiliarJornadas?: (auxiliarName: string) => void;
  onEditarRegistro?: (reg: Registro) => void;
  onEliminarRegistro?: (id: string, auxiliar: string, fecha: string) => void;
  onAgregarRegistro?: (nuevoReg: Registro) => Promise<boolean | void> | void;
  selectedAuxiliarForDetail?: string | null;
  setSelectedAuxiliarForDetail?: (aux: string | null) => void;
  reporteFaltas?: any;
}

export const AuxiliaresView: React.FC<AuxiliaresViewProps> = ({
  auxiliaresList,
  listaAuxiliares,
  pinsMap = {},
  auxiliarCargos = {},
  statsAuxiliares = [],
  allRegistros,
  registros,
  onUpdatePin,
  onUpdateCargo,
  onCreateAuxiliar,
  onDeleteAuxiliar,
  onViewAuxiliarJornadas,
  onEditarRegistro,
  onEliminarRegistro,
  onAgregarRegistro,
  selectedAuxiliarForDetail,
  setSelectedAuxiliarForDetail,
}) => {
  const effectiveAuxiliaresList = auxiliaresList || listaAuxiliares || [];
  const effectiveRegistros = allRegistros || registros || [];
  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [cargoFilter, setCargoFilter] = useState<string>('todos');
  const [revealedPins, setRevealedPins] = useState<Record<string, boolean>>({});

  // Modales
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingAux, setEditingAux] = useState<string | null>(null);
  const [detailAux, setDetailAux] = useState<string | null>(null);
  const [deleteConfirmAux, setDeleteConfirmAux] = useState<string | null>(null);

  const currentDetailAux = selectedAuxiliarForDetail || detailAux;

  if (currentDetailAux) {
    return (
      <DetalleAuxiliarView
        auxiliarName={currentDetailAux}
        allRegistros={effectiveRegistros}
        auxiliarCargos={auxiliarCargos}
        onVolver={() => {
          setDetailAux(null);
          if (setSelectedAuxiliarForDetail) {
            setSelectedAuxiliarForDetail(null);
          }
        }}
        onEditarRegistro={onEditarRegistro}
        onAgregarRegistro={onAgregarRegistro}
        onSelectAuxiliar={(newAux) => {
          setDetailAux(newAux);
          if (setSelectedAuxiliarForDetail) {
            setSelectedAuxiliarForDetail(newAux);
          }
        }}
        listaAuxiliares={effectiveAuxiliaresList}
      />
    );
  }

  // Estados de formularios
  const [newNombre, setNewNombre] = useState('');
  const [newPin, setNewPin] = useState('');
  const [newCargo, setNewCargo] = useState<CargoTipo>('auxiliar_carga');
  const [createError, setCreateError] = useState('');

  // Edición
  const [editNombre, setEditNombre] = useState('');
  const [editPin, setEditPin] = useState('');
  const [editCargo, setEditCargo] = useState<CargoTipo>('auxiliar_carga');
  const [editError, setEditError] = useState('');

  // Toggle revelación de PIN
  const toggleRevealPin = (auxName: string) => {
    setRevealedPins(prev => ({ ...prev, [auxName]: !prev[auxName] }));
  };

  // Crear auxiliar
  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError('');
    const cleanNombre = newNombre.trim().toUpperCase();
    const cleanPin = newPin.trim();

    if (!cleanNombre) {
      setCreateError('Por favor ingrese el nombre completo del auxiliar.');
      return;
    }
    if (!/^\d{4}$/.test(cleanPin)) {
      setCreateError('El código PIN debe ser exactamente de 4 dígitos numéricos.');
      return;
    }
    if (effectiveAuxiliaresList.some(a => a.toUpperCase() === cleanNombre)) {
      setCreateError('Ya existe un auxiliar registrado con este nombre exacto.');
      return;
    }

    onCreateAuxiliar(cleanNombre, cleanPin, newCargo);
    setIsCreateModalOpen(false);
    setNewNombre('');
    setNewPin('');
    setNewCargo('auxiliar_carga');
  };

  // Iniciar edición
  const startEdit = (aux: string) => {
    setEditingAux(aux);
    setEditNombre(aux);
    setEditPin(pinsMap[aux] || '1234');
    setEditCargo((auxiliarCargos[aux] as CargoTipo) || 'auxiliar_carga');
    setEditError('');
  };

  // Guardar edición
  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAux) return;
    const cleanPin = editPin.trim();
    if (!/^\d{4}$/.test(cleanPin)) {
      setEditError('El PIN debe tener exactamente 4 números.');
      return;
    }

    onUpdatePin(editingAux, cleanPin);
    onUpdateCargo(editingAux, editCargo);
    setEditingAux(null);
  };

  // Resumen de cargos
  const conteoCargos = useMemo(() => {
    const counts = { total: effectiveAuxiliaresList.length, carga: 0, escolta: 0, operaciones: 0 };
    effectiveAuxiliaresList.forEach(aux => {
      const cargo = auxiliarCargos[aux] || 'auxiliar_carga';
      if (cargo === 'escolta') counts.escolta++;
      else if (cargo === 'auxiliar_operaciones') counts.operaciones++;
      else counts.carga++;
    });
    return counts;
  }, [effectiveAuxiliaresList, auxiliarCargos]);

  // Lista filtrada
  const filteredAuxiliares = useMemo(() => {
    return effectiveAuxiliaresList.filter(aux => {
      const matchesSearch = aux.toLowerCase().includes(searchTerm.toLowerCase());
      const cargo = auxiliarCargos[aux] || 'auxiliar_carga';
      const matchesCargo = cargoFilter === 'todos' || cargo === cargoFilter;
      return matchesSearch && matchesCargo;
    });
  }, [effectiveAuxiliaresList, searchTerm, cargoFilter, auxiliarCargos]);

  // Obtener estadísticas de un auxiliar para el drawer de detalle
  const detailStats = useMemo(() => {
    if (!detailAux) return null;
    const stat = statsAuxiliares.find(s => s.nombre === detailAux);
    const registros = effectiveRegistros.filter(r => r.auxiliar === detailAux);
    const vehiculosCount: Record<string, number> = {};
    const rutasCount: Record<string, number> = {};

    registros.forEach(r => {
      if (r.vehiculo) vehiculosCount[r.vehiculo] = (vehiculosCount[r.vehiculo] || 0) + 1;
      if (r.ruta) rutasCount[r.ruta] = (rutasCount[r.ruta] || 0) + 1;
    });

    const topVehiculo = Object.entries(vehiculosCount).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';
    const topRuta = Object.entries(rutasCount).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';

    return {
      nombre: detailAux,
      cargo: auxiliarCargos[detailAux] || 'auxiliar_carga',
      pin: pinsMap[detailAux] || '1234',
      totalTurnos: registros.length,
      horasExtras: stat ? stat.horasExtrasTotales : registros.reduce((acc, r) => acc + (r.horasExtras || 0), 0),
      jornadaTotal: stat ? stat.jornadaTotal : registros.reduce((acc, r) => acc + (r.jornada || 0), 0),
      registros,
      topVehiculo,
      topRuta,
    };
  }, [detailAux, statsAuxiliares, effectiveRegistros, auxiliarCargos, pinsMap]);

  return (
    <div className="space-y-6 text-left">
      {/* 1. Header del Módulo con Métricas y CTA */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100">
              <Users className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-lg font-display font-bold text-slate-900 tracking-tight">
                Directorio de Colaboradores
              </h2>
              <p className="text-xs text-slate-500">
                Gestiona roles, credenciales PIN de 4 dígitos y expedientes operativos.
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-sm shadow-indigo-600/30 transition-all cursor-pointer shrink-0"
        >
          <UserPlus className="w-4 h-4" />
          <span>Crear Nuevo Auxiliar</span>
        </button>
      </div>

      {/* 2. Barra de Filtros y Contadores por Cargo */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Buscador */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por nombre o apellido..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium"
            />
          </div>

          {/* Filtro por cargo estilo Píldoras */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => setCargoFilter('todos')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                cargoFilter === 'todos'
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Todos ({conteoCargos.total})
            </button>
            <button
              onClick={() => setCargoFilter('auxiliar_carga')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                cargoFilter === 'auxiliar_carga'
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
              }`}
            >
              Auxiliar de Carga ({conteoCargos.carga})
            </button>
            <button
              onClick={() => setCargoFilter('escolta')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                cargoFilter === 'escolta'
                  ? 'bg-purple-600 text-white shadow-2xs'
                  : 'bg-purple-50 text-purple-700 hover:bg-purple-100'
              }`}
            >
              Escoltas ({conteoCargos.escolta})
            </button>
            <button
              onClick={() => setCargoFilter('auxiliar_operaciones')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                cargoFilter === 'auxiliar_operaciones'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
              }`}
            >
              Operaciones ({conteoCargos.operaciones})
            </button>
          </div>
        </div>
      </div>

      {/* 3. Listado de Auxiliares (Tarjetas Limpias y Jerarquizadas) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredAuxiliares.map((aux) => {
          const stat = statsAuxiliares.find(s => s.nombre === aux);
          const cargo = auxiliarCargos[aux] || 'auxiliar_carga';
          const pin = pinsMap[aux] || '1234';
          const isRevealed = revealedPins[aux];
          const totalDias = stat ? stat.diasTrabajados : 0;
          const horasExtras = stat ? stat.horasExtrasTotales : 0;

          // Badges según cargo
          const cargoBadge = {
            auxiliar_carga: { label: 'Auxiliar de Carga', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
            escolta: { label: 'Escolta', color: 'bg-purple-50 text-purple-700 border-purple-200' },
            auxiliar_operaciones: { label: 'Auxiliar Operaciones', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
          }[cargo] || { label: 'Auxiliar', color: 'bg-slate-100 text-slate-700 border-slate-200' };

          return (
            <motion.div
              key={aux}
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs hover:shadow-md hover:border-indigo-200 transition-all flex flex-col justify-between"
            >
              {/* Parte superior: Avatar, Nombre y Cargo */}
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-11 h-11 rounded-xl bg-slate-100 border border-slate-200 text-slate-800 flex items-center justify-center font-display font-bold text-sm shrink-0">
                      {aux.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-xs sm:text-sm font-display font-bold text-slate-900 truncate" title={aux}>
                        {formatoNombreCapital(aux)}
                      </h3>
                      <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-md border mt-1 ${cargoBadge.color}`}>
                        {cargoBadge.label}
                      </span>
                    </div>
                  </div>

                  {/* Botón de opciones rápidas */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => startEdit(aux)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer"
                      title="Editar datos y cargo"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    {onDeleteAuxiliar && (
                      <button
                        onClick={() => setDeleteConfirmAux(aux)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                        title="Eliminar colaborador"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Métricas de Jornada del Colaborador */}
                <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-slate-100">
                  <div className="bg-slate-50 p-2.5 rounded-xl text-left">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                      Días en Período
                    </span>
                    <span className="text-sm font-bold text-slate-800 font-mono mt-0.5 block">
                      {totalDias} días
                    </span>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-xl text-left">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                      Horas Extras
                    </span>
                    <span className="text-sm font-bold text-indigo-600 font-mono mt-0.5 block">
                      +{horasExtras}h
                    </span>
                  </div>
                </div>

                {/* Acceso PIN */}
                <div className="mt-3 p-2.5 rounded-xl bg-slate-50 border border-slate-150 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Key className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-[11px] text-slate-500 font-medium">PIN de Acceso:</span>
                    <span className="font-mono font-bold text-xs text-slate-800 tracking-wider">
                      {isRevealed ? pin : '••••'}
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => toggleRevealPin(aux)}
                      className="p-1 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                      title={isRevealed ? 'Ocultar PIN' : 'Ver PIN'}
                    >
                      {isRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`¿Restablecer el PIN de ${formatoNombreCapital(aux)} a '1234'?`)) {
                          onUpdatePin(aux, '1234');
                        }
                      }}
                      className="p-1 text-slate-400 hover:text-amber-600 transition-colors cursor-pointer"
                      title="Resetear PIN a 1234"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Botón para ver Ficha Completa */}
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                <button
                  onClick={() => setDetailAux(aux)}
                  className="w-full inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5 text-slate-500" />
                  <span>Ver Ficha e Historial</span>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400 ml-auto" />
                </button>
              </div>
            </motion.div>
          );
        })}

        {filteredAuxiliares.length === 0 && (
          <div className="col-span-full bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400">
            <Users className="w-10 h-10 mx-auto text-slate-300 mb-3" />
            <p className="text-sm font-semibold text-slate-600">No se encontraron colaboradores</p>
            <p className="text-xs text-slate-400 mt-1">Prueba con otro término de búsqueda o cambia el filtro de cargo.</p>
          </div>
        )}
      </div>

      {/* 4. MODAL PARA CREAR AUXILIAR */}
      <AnimatePresence>
        {isCreateModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-xs"
              onClick={() => setIsCreateModalOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 z-10"
            >
              <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-150">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
                    <UserPlus className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-display font-bold text-base text-slate-900">Crear Nuevo Auxiliar</h3>
                    <p className="text-[11px] text-slate-500">Registra un nuevo colaborador y asigna su PIN</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsCreateModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateSubmit} className="space-y-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Nombre Completo (Apellidos y Nombres)
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: PEREZ LONDOÑO ANDRES"
                    value={newNombre}
                    onChange={(e) => setNewNombre(e.target.value.toUpperCase())}
                    className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                      Código PIN (4 Dígitos)
                    </label>
                    <input
                      type="text"
                      maxLength={4}
                      required
                      placeholder="Ej: 1234"
                      value={newPin}
                      onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                      className="w-full text-xs font-mono font-bold text-center tracking-widest bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                      Cargo Asignado
                    </label>
                    <select
                      value={newCargo}
                      onChange={(e) => setNewCargo(e.target.value as CargoTipo)}
                      className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    >
                      <option value="auxiliar_carga">Auxiliar de Carga</option>
                      <option value="escolta">Escolta</option>
                      <option value="auxiliar_operaciones">Auxiliar Operaciones</option>
                    </select>
                  </div>
                </div>

                {createError && (
                  <div className="text-xs text-rose-600 bg-rose-50 border border-rose-200 p-3 rounded-xl flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{createError}</span>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsCreateModalOpen(false)}
                    className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs cursor-pointer"
                  >
                    Guardar Colaborador
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 5. MODAL PARA EDITAR AUXILIAR */}
      <AnimatePresence>
        {editingAux && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-xs"
              onClick={() => setEditingAux(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 z-10"
            >
              <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-150">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
                    <Edit3 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-display font-bold text-base text-slate-900">Editar Colaborador</h3>
                    <p className="text-[11px] text-slate-500">{editingAux}</p>
                  </div>
                </div>
                <button
                  onClick={() => setEditingAux(null)}
                  className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleEditSubmit} className="space-y-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Código PIN (4 Dígitos)
                  </label>
                  <input
                    type="text"
                    maxLength={4}
                    required
                    value={editPin}
                    onChange={(e) => setEditPin(e.target.value.replace(/\D/g, ''))}
                    className="w-full text-xs font-mono font-bold text-center tracking-widest bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Cargo Operacional
                  </label>
                  <select
                    value={editCargo}
                    onChange={(e) => setEditCargo(e.target.value as CargoTipo)}
                    className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  >
                    <option value="auxiliar_carga">Auxiliar de Carga</option>
                    <option value="escolta">Escolta</option>
                    <option value="auxiliar_operaciones">Auxiliar de Operaciones</option>
                  </select>
                </div>

                {editError && (
                  <div className="text-xs text-rose-600 bg-rose-50 border border-rose-200 p-3 rounded-xl flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{editError}</span>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setEditingAux(null)}
                    className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs cursor-pointer"
                  >
                    Guardar Cambios
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 6. DRAWER / MODAL DE DETALLE INDIVIDUAL DE AUXILIAR */}
      <AnimatePresence>
        {detailStats && (
          <div className="fixed inset-0 z-50 flex items-center justify-end">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-xs"
              onClick={() => setDetailAux(null)}
            />

            <motion.div
              initial={{ x: 400 }}
              animate={{ x: 0 }}
              exit={{ x: 400 }}
              transition={{ type: 'spring', damping: 25, stiffness: 280 }}
              className="relative w-full max-w-xl h-full bg-white shadow-2xl border-l border-slate-200 z-10 flex flex-col"
            >
              {/* Header Drawer */}
              <div className="p-5 border-b border-slate-150 flex items-center justify-between bg-slate-50">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-display font-bold text-lg shadow-sm">
                    {detailStats.nombre.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-display font-bold text-base text-slate-900">
                      {formatoNombreCapital(detailStats.nombre)}
                    </h3>
                    <span className="text-xs font-semibold text-indigo-600">
                      {obtenerCargoDisplay(detailStats.nombre)}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => setDetailAux(null)}
                  className="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-200 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Contenido scrolleable */}
              <div className="flex-1 overflow-y-auto p-5 space-y-6 text-left">
                {/* Métricas clave */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-150 text-left">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Jornadas</span>
                    <span className="text-xl font-bold font-mono text-slate-900 block mt-1">{detailStats.totalTurnos}</span>
                  </div>
                  <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-150 text-left">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Horas Extras</span>
                    <span className="text-xl font-bold font-mono text-indigo-600 block mt-1">+{detailStats.horasExtras}h</span>
                  </div>
                  <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-150 text-left">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Horas Totales</span>
                    <span className="text-xl font-bold font-mono text-slate-900 block mt-1">{detailStats.jornadaTotal}h</span>
                  </div>
                </div>

                {/* Resumen Operativo */}
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-150 space-y-3">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Patrones Habituales</h4>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-slate-400 block text-[11px]">Vehículo Habitual:</span>
                      <span className="font-mono font-bold text-slate-800 flex items-center gap-1.5 mt-0.5">
                        <Truck className="w-3.5 h-3.5 text-indigo-600" />
                        {detailStats.topVehiculo}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">Ruta Frecuente:</span>
                      <span className="font-semibold text-slate-800 flex items-center gap-1.5 mt-0.5">
                        <MapPin className="w-3.5 h-3.5 text-purple-600" />
                        {detailStats.topRuta}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Historial de Turnos de este Auxiliar */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                      <Clock className="w-4 h-4 text-indigo-600" />
                      Historial Cronológico de Turnos
                    </h4>
                    <span className="text-[10px] text-slate-400 font-mono font-semibold">
                      {detailStats.registros.length} registros
                    </span>
                  </div>

                  <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                    {detailStats.registros.map((reg) => (
                      <div
                        key={reg.id || `${reg.fecha}-${reg.horaIngreso}`}
                        className="bg-white p-3 rounded-xl border border-slate-200 text-xs flex items-center justify-between gap-3 shadow-2xs hover:border-indigo-200"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-800">{reg.fecha}</span>
                            <span className="font-mono text-[10px] px-1.5 py-0.5 bg-slate-100 rounded text-slate-600 font-semibold">
                              {reg.vehiculo || 'S/P'}
                            </span>
                            {reg.esNocturno && (
                              <span className="text-[9px] px-1.5 py-0.5 bg-purple-50 text-purple-700 font-bold rounded">
                                Nocturno
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-slate-500 block mt-0.5">
                            {reg.horaIngreso} - {reg.horaSalida} • {reg.ruta || 'Sin ruta'}
                          </span>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="font-mono font-bold text-xs text-slate-800 block">
                            {reg.jornada}h
                          </span>
                          <span className="font-mono text-[11px] font-bold text-indigo-600 block">
                            +{reg.horasExtras}h ext
                          </span>
                        </div>
                      </div>
                    ))}

                    {detailStats.registros.length === 0 && (
                      <p className="text-xs text-slate-400 text-center py-6">
                        No hay turnos registrados aún para este colaborador.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 7. CONFIRMACIÓN DE ELIMINACIÓN */}
      <AnimatePresence>
        {deleteConfirmAux && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-xs"
              onClick={() => setDeleteConfirmAux(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-sm w-full p-6 z-10 text-center"
            >
              <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-3">
                <Trash2 className="w-6 h-6" />
              </div>
              <h3 className="font-display font-bold text-base text-slate-900">¿Eliminar colaborador?</h3>
              <p className="text-xs text-slate-500 mt-1 mb-4 leading-relaxed">
                Estás a punto de remover a <strong className="text-slate-800">{formatoNombreCapital(deleteConfirmAux)}</strong> del sistema. Sus credenciales y accesos serán eliminados.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setDeleteConfirmAux(null)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => {
                    if (onDeleteAuxiliar) onDeleteAuxiliar(deleteConfirmAux);
                    setDeleteConfirmAux(null);
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold cursor-pointer shadow-xs"
                >
                  Confirmar Eliminación
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
