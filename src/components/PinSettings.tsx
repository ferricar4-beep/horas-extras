import React, { useState, useEffect } from 'react';
import { Lock, ShieldCheck, RefreshCw, Edit3, Check, X, Search, UserCheck, UserPlus, Trash2 } from 'lucide-react';

interface PinSettingsProps {
  auxiliares: string[];
  pinsMap: Record<string, string>;
  auxiliarCargos: Record<string, string>;
  onUpdatePin: (auxiliar: string, newPin: string) => void;
  onUpdateCargo: (auxiliar: string, newCargo: string) => void;
  onCreateAuxiliar: (nombre: string, pin: string, cargo: string) => void;
  onDeleteAuxiliar?: (auxiliar: string) => void;
}

export const PinSettings: React.FC<PinSettingsProps> = ({
  auxiliares = [],
  pinsMap = {},
  auxiliarCargos = {},
  onUpdatePin,
  onUpdateCargo,
  onCreateAuxiliar,
  onDeleteAuxiliar,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [editingAux, setEditingAux] = useState<string | null>(null);
  const [tempPin, setTempPin] = useState('');
  const [tempCargo, setTempCargo] = useState('');
  const [editError, setEditError] = useState('');

  // Auxiliar activo para confirmación de reinicio de PIN
  const [confirmResetAux, setConfirmResetAux] = useState<string | null>(null);
  // Auxiliar activo para confirmación de eliminación
  const [confirmDeleteAux, setConfirmDeleteAux] = useState<string | null>(null);

  // Admin PIN separate edit state
  const [isEditingAdmin, setIsEditingAdmin] = useState(false);
  const [tempAdminPin, setTempAdminPin] = useState('');
  const [adminPinSuccess, setAdminPinSuccess] = useState('');
  const [adminPinError, setAdminPinError] = useState('');

  // Formulario para crear auxiliar
  const [newAuxName, setNewAuxName] = useState('');
  const [newAuxPin, setNewAuxPin] = useState('');
  const [newAuxCargo, setNewAuxCargo] = useState('auxiliar_carga');
  const [createError, setCreateError] = useState('');
  const [createSuccess, setCreateSuccess] = useState('');

  // Autodescartar mensaje de éxito de admin después de unos segundos
  useEffect(() => {
    if (adminPinSuccess) {
      const timer = setTimeout(() => setAdminPinSuccess(''), 4000);
      return () => clearTimeout(timer);
    }
  }, [adminPinSuccess]);

  // Autodescartar mensaje de error de admin después de unos segundos
  useEffect(() => {
    if (adminPinError) {
      const timer = setTimeout(() => setAdminPinError(''), 4000);
      return () => clearTimeout(timer);
    }
  }, [adminPinError]);

  const filteredAuxiliares = (auxiliares || []).filter((aux) =>
    aux && typeof aux === 'string' && aux.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const startEdit = (aux: string) => {
    setEditingAux(aux);
    setTempPin((pinsMap && pinsMap[aux]) || '1234');
    setTempCargo((auxiliarCargos && auxiliarCargos[aux]) || 'auxiliar_carga');
    setEditError('');
    setConfirmResetAux(null); // Cancelar reinicio en progreso si se edita
  };

  const cancelEdit = () => {
    setEditingAux(null);
    setTempPin('');
    setTempCargo('');
    setEditError('');
  };

  const saveEdit = (aux: string) => {
    // Validar que sea numérico y de 4 dígitos
    const clean = tempPin.trim();
    if (!/^\d{4}$/.test(clean)) {
      setEditError('El PIN debe ser exactamente de 4 números.');
      return;
    }
    onUpdatePin(aux, clean);
    onUpdateCargo(aux, tempCargo);
    setEditingAux(null);
    setTempPin('');
    setTempCargo('');
    setEditError('');
  };

  const handleResetPinConfirm = (aux: string) => {
    onUpdatePin(aux, '1234');
    setConfirmResetAux(null);
  };

  const saveAdminPin = () => {
    const clean = tempAdminPin.trim();
    if (!/^\d{4}$/.test(clean)) {
      setAdminPinError('El PIN de Administrador debe ser exactamente de 4 números.');
      return;
    }
    onUpdatePin('ADMIN', clean);
    setIsEditingAdmin(false);
    setTempAdminPin('');
    setAdminPinSuccess('¡PIN de Administrador actualizado con éxito!');
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError('');
    setCreateSuccess('');

    const cleanName = newAuxName.trim().toUpperCase();
    const cleanPin = newAuxPin.trim();

    if (!cleanName) {
      setCreateError('El nombre no puede estar vacío.');
      return;
    }

    if (auxiliares.includes(cleanName)) {
      setCreateError('Ya existe un auxiliar con ese nombre en el sistema.');
      return;
    }

    if (!/^\d{4}$/.test(cleanPin)) {
      setCreateError('El PIN de consulta debe ser exactamente de 4 dígitos numéricos.');
      return;
    }

    onCreateAuxiliar(cleanName, cleanPin, newAuxCargo);
    setCreateSuccess(`¡Auxiliar ${formatoNombreCapital(cleanName)} creado con éxito!`);
    setNewAuxName('');
    setNewAuxPin('');
    setNewAuxCargo('auxiliar_carga');
  };

  // Capitalize name nicely
  const formatoNombreCapital = (nombre: string): string => {
    if (!nombre || typeof nombre !== 'string') return '';
    return nombre
      .toLowerCase()
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const currentAdminPin = (pinsMap && (pinsMap['ADMIN'] || pinsMap['admin'])) || '9988';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Columna Izquierda: PIN del Administrador y Crear Auxiliar */}
      <div className="lg:col-span-1 flex flex-col gap-6">
        {/* Formulario Crear Auxiliar */}
        <div className="bg-white p-5 rounded-lg border border-gray-100 border-l-4 border-l-brand-red shadow-[0_1px_3px_rgba(21,27,43,0.06)]">
          <div className="flex items-center gap-2 mb-4 pb-2 border-b border-gray-50">
            <UserPlus className="w-4 h-4 text-brand-red" />
            <h3 className="font-display font-semibold text-gray-800 text-sm">
              Crear Auxiliar y PIN
            </h3>
          </div>

          <form onSubmit={handleCreateSubmit} className="space-y-4">
            <div>
              <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
                Nombre Completo
              </label>
              <input
                type="text"
                required
                placeholder="Ej: JUAN PEREZ"
                value={newAuxName}
                onChange={(e) => {
                  setNewAuxName(e.target.value.toUpperCase());
                  setCreateError('');
                  setCreateSuccess('');
                }}
                className="w-full text-xs bg-gray-50 border border-gray-200 text-gray-800 py-2 px-3 rounded-md focus:outline-none focus:ring-1 focus:ring-brand-red font-medium"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
                Código PIN (4 dígitos)
              </label>
              <input
                type="text"
                maxLength={4}
                required
                placeholder="Ej: 1234"
                value={newAuxPin}
                onChange={(e) => {
                  setNewAuxPin(e.target.value.replace(/\D/g, ''));
                  setCreateError('');
                  setCreateSuccess('');
                }}
                className="w-full font-mono text-xs bg-gray-50 border border-gray-200 text-gray-800 py-2 px-3 rounded-md focus:outline-none focus:ring-1 focus:ring-brand-red"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
                Cargo / Perfil
              </label>
              <select
                value={newAuxCargo}
                onChange={(e) => {
                  setNewAuxCargo(e.target.value);
                  setCreateError('');
                  setCreateSuccess('');
                }}
                className="w-full text-xs bg-gray-50 border border-gray-200 text-gray-800 py-2 px-3 rounded-md focus:outline-none focus:ring-1 focus:ring-brand-red font-medium"
              >
                <option value="auxiliar_carga">Auxiliar de Carga</option>
                <option value="escolta">Escolta</option>
                <option value="auxiliar_operaciones">Auxiliar de Operaciones</option>
              </select>
            </div>

            {createError && (
              <p className="text-[11px] text-red-500 font-semibold bg-red-50 border border-red-100 p-2.5 rounded-lg">
                ⚠️ {createError}
              </p>
            )}

            {createSuccess && (
              <p className="text-[11px] text-emerald-600 font-semibold bg-emerald-50 border border-emerald-100 p-2.5 rounded-lg">
                ✅ {createSuccess}
              </p>
            )}

            <button
              type="submit"
              className="w-full py-2 bg-brand-red hover:bg-brand-red-hover text-white font-bold text-xs rounded-md shadow-sm transition-colors cursor-pointer flex items-center justify-center gap-1.5"
            >
              <UserPlus className="w-3.5 h-3.5" />
              Registrar Auxiliar
            </button>
          </form>
        </div>

        {/* Tarjeta Admin PIN */}
        <div className="bg-white p-5 rounded-lg border border-gray-100 border-l-4 border-l-brand-red shadow-[0_1px_3px_rgba(21,27,43,0.06)]">
          <div className="flex items-center gap-2 mb-4 pb-2 border-b border-gray-50">
            <Lock className="w-4 h-4 text-brand-red" />
            <h3 className="font-display font-semibold text-gray-800 text-sm">
              PIN Maestro de Administrador
            </h3>
          </div>

          <p className="text-xs text-gray-500 leading-relaxed mb-4">
            Este PIN maestro permite el ingreso de los coordinadores para ver reportes consolidados y configurar alertas.
          </p>

          <div className="bg-gray-50 p-4 rounded-lg border border-gray-100 flex flex-col gap-3">
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-400 font-semibold">PIN ACTUAL</span>
              {!isEditingAdmin ? (
                <span className="font-mono text-sm font-bold text-gray-800 bg-white px-2 py-0.5 border border-gray-200 rounded">
                  {currentAdminPin}
                </span>
              ) : (
                <input
                  type="text"
                  maxLength={4}
                  value={tempAdminPin}
                  onChange={(e) => {
                    setTempAdminPin(e.target.value.replace(/\D/g, ''));
                    setAdminPinError('');
                  }}
                  placeholder="PIN"
                  className="w-16 text-center font-mono text-sm font-bold bg-white border border-brand-red/35 rounded focus:outline-none focus:ring-1 focus:ring-brand-red"
                />
              )}
            </div>

            {adminPinSuccess && (
              <div className="text-[10px] text-emerald-600 font-bold bg-emerald-50/80 border border-emerald-200 p-2 rounded text-center">
                {adminPinSuccess}
              </div>
            )}

            {adminPinError && (
              <div className="text-[10px] text-rose-600 font-bold bg-rose-50 border border-rose-200 p-2 rounded text-center">
                {adminPinError}
              </div>
            )}

            <div className="flex justify-end gap-2 mt-1">
              {!isEditingAdmin ? (
                <button
                  type="button"
                  onClick={() => {
                    setIsEditingAdmin(true);
                    setTempAdminPin(currentAdminPin);
                    setAdminPinSuccess('');
                    setAdminPinError('');
                  }}
                  className="text-[11px] font-bold text-brand-red hover:text-brand-red-hover transition-colors cursor-pointer"
                >
                  Cambiar PIN Maestro
                </button>
              ) : (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditingAdmin(false);
                      setAdminPinError('');
                    }}
                    className="text-[11px] font-bold text-gray-500 hover:text-gray-700 cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={saveAdminPin}
                    className="text-[11px] font-bold text-emerald-600 hover:text-emerald-700 cursor-pointer"
                  >
                    Guardar
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Tarjeta Info de Seguridad */}
        <div className="bg-brand-red-soft/30 border border-brand-red-soft p-5 rounded-lg flex flex-col gap-3 border-l-4 border-l-brand-red">
          <h4 className="font-display font-semibold text-brand-red text-xs">
            Consejo de Seguridad Logística
          </h4>
          <p className="text-[11px] text-graphite-700 leading-relaxed">
            Se recomienda a todos los auxiliares logísticos modificar su PIN por defecto (<span className="font-bold">1234</span>) tras su primer acceso para evitar que terceros consulten sus datos de turnos y salarios.
          </p>
          <div className="flex items-center gap-1.5 mt-1 text-[10px] text-graphite-700 font-semibold">
            <ShieldCheck className="w-3.5 h-3.5 text-brand-red" />
            <span>Los PINs se guardan localmente de forma segura</span>
          </div>
        </div>
      </div>

      {/* Columna Derecha: Tabla y Directorio de PINs de Auxiliares */}
      <div className="lg:col-span-2 bg-white p-5 rounded-lg border border-gray-100 border-l-4 border-l-brand-red shadow-[0_1px_3px_rgba(21,27,43,0.06)] flex flex-col">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-2 border-b border-gray-50">
          <div>
            <h3 className="font-display font-semibold text-gray-800 text-sm">
              Directorio de Accesos de Auxiliares
            </h3>
            <p className="text-[11px] text-gray-400 mt-0.5">
              Administra las claves numéricas de consulta personal para cada auxiliar
            </p>
          </div>

          {/* Buscador */}
          <div className="relative max-w-xs w-full">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar auxiliar..."
              className="w-full text-xs bg-gray-50 border border-gray-200 text-gray-700 py-1.5 pl-8 pr-3 rounded-md focus:outline-none focus:ring-1 focus:ring-brand-red"
            />
          </div>
        </div>

        {/* Tabla de PINs */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 font-semibold text-gray-500">
                <th className="py-2.5 px-3">Auxiliar Logístico</th>
                <th className="py-2.5 px-3">Cargo / Perfil</th>
                <th className="py-2.5 px-3">PIN de Consulta</th>
                <th className="py-2.5 px-3">Estado</th>
                <th className="py-2.5 px-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 text-gray-600 font-medium">
              {filteredAuxiliares.map((aux) => {
                const currentPin = (pinsMap && pinsMap[aux]) || '1234';
                const isDefault = currentPin === '1234';
                const isEditing = editingAux === aux;
                const isConfirmingReset = confirmResetAux === aux;

                return (
                  <tr key={aux} className="hover:bg-brand-red-soft/20 transition-colors">
                    <td className="py-3 px-3">
                      <div className="font-semibold text-gray-700">
                        {formatoNombreCapital(aux)}
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      {isEditing ? (
                        <select
                          value={tempCargo}
                          onChange={(e) => setTempCargo(e.target.value)}
                          className="text-xs bg-gray-50 border border-gray-200 text-gray-700 py-1 px-1.5 rounded focus:outline-none focus:ring-1 focus:ring-brand-red font-medium"
                        >
                          <option value="auxiliar_carga">Auxiliar de Carga</option>
                          <option value="escolta">Escolta</option>
                          <option value="auxiliar_operaciones">Auxiliar de Operaciones</option>
                        </select>
                      ) : (() => {
                        const carg = (auxiliarCargos && auxiliarCargos[aux]) || 'auxiliar_carga';
                        if (carg === 'escolta') {
                          return (
                            <span className="inline-flex items-center gap-1 text-[10px] bg-violet-50 text-violet-700 border border-violet-100/50 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                              👮 Escolta
                            </span>
                          );
                        } else if (carg === 'auxiliar_operaciones') {
                          return (
                            <span className="inline-flex items-center gap-1 text-[10px] bg-blue-50 text-blue-700 border border-blue-100/50 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                              ⚙️ Operaciones
                            </span>
                          );
                        } else {
                          return (
                            <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-100/50 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                              📦 Carga
                            </span>
                          );
                        }
                      })()}
                    </td>
                    <td className="py-3 px-3 font-mono">
                      {isEditing ? (
                        <div className="flex flex-col gap-1">
                          <input
                            type="text"
                            maxLength={4}
                            value={tempPin}
                            onChange={(e) => setTempPin(e.target.value.replace(/\D/g, ''))}
                            className="w-16 text-center font-bold bg-gray-50 border border-brand-red/30 rounded focus:outline-none focus:ring-1 focus:ring-brand-red py-0.5 text-xs"
                          />
                          {editError && (
                            <span className="text-[9px] text-red-500 font-sans max-w-[120px] leading-tight">
                              {editError}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="bg-gray-100 px-2 py-0.5 rounded text-gray-700 font-bold">
                          {currentPin}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3">
                      {isDefault ? (
                        <span className="inline-flex items-center gap-1 text-[10px] bg-amber-50 text-amber-700 border border-amber-100/50 px-2 py-0.5 rounded-full font-bold">
                          ⚠️ Por Defecto
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-100/50 px-2 py-0.5 rounded-full font-bold">
                          🔒 Seguro
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right">
                      {isEditing ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => saveEdit(aux)}
                            className="p-1 rounded bg-emerald-50 text-emerald-600 hover:bg-emerald-100 cursor-pointer"
                            title="Guardar PIN"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={cancelEdit}
                            className="p-1 rounded bg-gray-100 text-gray-500 hover:bg-gray-200 cursor-pointer"
                            title="Cancelar"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : isConfirmingReset ? (
                        <div className="inline-flex items-center justify-end gap-1 bg-amber-50 p-1 rounded border border-amber-200">
                          <span className="text-[10px] text-amber-800 font-bold px-1">¿Restablecer?</span>
                          <button
                            type="button"
                            onClick={() => handleResetPinConfirm(aux)}
                            className="text-[9px] bg-amber-600 hover:bg-amber-700 text-white px-2 py-0.5 rounded font-bold cursor-pointer transition-colors"
                          >
                            Sí
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmResetAux(null)}
                            className="text-[9px] bg-white text-gray-500 hover:bg-gray-100 border border-gray-200 px-2 py-0.5 rounded font-bold cursor-pointer transition-colors"
                          >
                            No
                          </button>
                        </div>
                      ) : confirmDeleteAux === aux ? (
                        <div className="inline-flex items-center justify-end gap-1 bg-rose-50 p-1 rounded border border-rose-200">
                          <span className="text-[10px] text-rose-800 font-bold px-1">¿Eliminar auxiliar y turnos?</span>
                          <button
                            type="button"
                            onClick={() => {
                              if (onDeleteAuxiliar) onDeleteAuxiliar(aux);
                              setConfirmDeleteAux(null);
                            }}
                            className="text-[9px] bg-rose-600 hover:bg-rose-700 text-white px-2 py-0.5 rounded font-bold cursor-pointer transition-colors"
                            title="Confirmar eliminación"
                          >
                            Sí
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteAux(null)}
                            className="text-[9px] bg-white text-gray-500 hover:bg-gray-100 border border-gray-200 px-2 py-0.5 rounded font-bold cursor-pointer transition-colors"
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => startEdit(aux)}
                            className="text-xs font-bold text-brand-red hover:text-brand-red-hover transition-colors cursor-pointer flex items-center gap-1"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            Editar
                          </button>
                          {!isDefault && (
                            <button
                              type="button"
                              onClick={() => {
                                setConfirmResetAux(aux);
                                setConfirmDeleteAux(null);
                              }}
                              className="text-xs font-bold text-gray-400 hover:text-amber-600 transition-colors cursor-pointer"
                              title="Restablecer PIN al de fábrica (1234)"
                            >
                              <RefreshCw className="w-3 h-3" />
                            </button>
                          )}
                          {onDeleteAuxiliar && (
                            <button
                              type="button"
                              onClick={() => {
                                setConfirmDeleteAux(aux);
                                setConfirmResetAux(null);
                              }}
                              className="text-xs font-bold text-gray-400 hover:text-rose-600 transition-colors cursor-pointer p-0.5"
                              title="Eliminar auxiliar y todos sus registros"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}

              {filteredAuxiliares.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-center py-10 text-gray-400">
                    No se encontraron auxiliares que coincidan.
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
