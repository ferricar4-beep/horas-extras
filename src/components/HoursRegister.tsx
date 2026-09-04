/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { PlusCircle, Clock, CheckCircle2, AlertCircle, Info, Truck, MapPin, Calendar, HelpCircle, RefreshCw } from 'lucide-react';
import { Registro } from '../types';
import {
  calcularJornada,
  calcularHorasExtra,
  esTurnoNocturno,
  formatoNombreCapital,
  parseFecha,
  safeLocalStorage
} from '../utils';

interface HoursRegisterProps {
  auxiliares: string[];
  lockedAuxiliar?: string;
  onAddRegistro: (registro: Registro) => void;
  origenData?: 'supabase' | 'local' | 'sheet';
  sincronizarDatos?: () => void;
  existingRegistros?: Registro[];
}

export const HoursRegister: React.FC<HoursRegisterProps> = ({
  auxiliares = [],
  lockedAuxiliar,
  onAddRegistro,
  origenData = 'supabase',
  sincronizarDatos,
  existingRegistros = []
}) => {
  // Form fields
  const [selectedAuxiliar, setSelectedAuxiliar] = useState(() => {
    return lockedAuxiliar || (auxiliares.length > 0 ? auxiliares[0] : '');
  });
  
  const [fechaInput, setFechaInput] = useState(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  });

  const [horaIngreso, setHoraIngreso] = useState('06:00');
  const [horaSalida, setHoraSalida] = useState('14:00');
  const [aunEnTurno, setAunEnTurno] = useState(false);
  const [vehiculo, setVehiculo] = useState('');
  const [ruta, setRuta] = useState('');

  // Statuses
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [sendingWebhook, setSendingWebhook] = useState(false);

  // Sync locked auxiliary if it changes
  useEffect(() => {
    if (lockedAuxiliar) {
      setSelectedAuxiliar(lockedAuxiliar);
    }
  }, [lockedAuxiliar]);

  // If not locked and selected is empty, default to first available
  useEffect(() => {
    if (!lockedAuxiliar && !selectedAuxiliar && auxiliares.length > 0) {
      setSelectedAuxiliar(auxiliares[0]);
    }
  }, [auxiliares, lockedAuxiliar, selectedAuxiliar]);

  // Real-time calculations
  const { previewJornada, previewExtras, previewEsNocturno } = useMemo(() => {
    if (aunEnTurno) {
      return { previewJornada: 0, previewExtras: 0, previewEsNocturno: false };
    }
    try {
      const j = calcularJornada(horaIngreso, horaSalida);
      const e = calcularHorasExtra(j);
      const n = esTurnoNocturno(horaIngreso, horaSalida);
      return { previewJornada: j, previewExtras: e, previewEsNocturno: n };
    } catch (e) {
      return { previewJornada: 0, previewExtras: 0, previewEsNocturno: false };
    }
  }, [horaIngreso, horaSalida, aunEnTurno]);

  // Submit handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMsg('');
    setErrorMsg('');

    if (!selectedAuxiliar) {
      setErrorMsg('Por favor seleccione un auxiliar.');
      return;
    }

    if (!fechaInput) {
      setErrorMsg('Por favor seleccione una fecha válida.');
      return;
    }

    // Convert fecha YYYY-MM-DD to D/M/YYYY
    const parts = fechaInput.split('-');
    if (parts.length !== 3) {
      setErrorMsg('Formato de fecha inválido.');
      return;
    }
    const day = parseInt(parts[2], 10);
    const month = parseInt(parts[1], 10);
    const year = parseInt(parts[0], 10);
    const formattedFecha = `${day}/${month}/${year}`;

    // Validar duplicado de fecha para el mismo auxiliar
    if (existingRegistros && existingRegistros.length > 0) {
      const isDuplicate = existingRegistros.some((reg) => {
        if (reg.auxiliar.trim().toUpperCase() !== selectedAuxiliar.trim().toUpperCase()) {
          return false;
        }
        try {
          const d1 = parseFecha(reg.fecha);
          const d2 = parseFecha(formattedFecha);
          return d1.getDate() === d2.getDate() &&
                 d1.getMonth() === d2.getMonth() &&
                 d1.getFullYear() === d2.getFullYear();
        } catch (e) {
          return reg.fecha === formattedFecha;
        }
      });

      if (isDuplicate) {
        setErrorMsg(`Ya existe un turno registrado para ${formatoNombreCapital(selectedAuxiliar)} en la fecha ${formattedFecha}. No es posible registrar turnos duplicados en el mismo día.`);
        return;
      }
    }

    const salidaFinal = aunEnTurno ? '00:00' : horaSalida.trim();
    const jornadaFinal = aunEnTurno ? 0 : previewJornada;
    const extrasFinal = aunEnTurno ? 0 : previewExtras;
    const nocturnoFinal = aunEnTurno ? false : previewEsNocturno;

    // Create the Registro object
    const nuevoReg: Registro = {
      id: `manual-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      marcaTemporal: new Date().toLocaleString('es-CO'),
      auxiliar: selectedAuxiliar.trim().toUpperCase(),
      vehiculo: vehiculo.trim().toUpperCase() || 'N/A',
      fecha: formattedFecha,
      horaIngreso: horaIngreso.trim(),
      horaSalida: salidaFinal,
      ruta: ruta.trim().toUpperCase() || 'N/A',
      jornada: jornadaFinal,
      horasExtras: extrasFinal,
      esNocturno: nocturnoFinal,
      originalRow: {}
    };

    // Save locally/globally via App callback
    onAddRegistro(nuevoReg);
    setSuccessMsg(`¡Registro guardado con éxito!`);

    // Reset some fields
    setVehiculo('');
    setRuta('');
    setAunEnTurno(false);

    // Optional: send to n8n Webhook if configured
    const webhookUrl = safeLocalStorage.getItem('ferricar_webhook_url');
    if (webhookUrl) {
      setSendingWebhook(true);
      try {
        const response = await fetch(webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'nuevo_registro',
            registro: nuevoReg,
            metadata: {
              source: 'Ferricar App manual submission',
              timestamp: new Date().toISOString()
            }
          }),
        });
        if (!response.ok) {
          console.warn('El webhook de n8n devolvió un estado no exitoso:', response.status);
        }
      } catch (err) {
        console.warn('Error al enviar al webhook de n8n:', err);
      } finally {
        setSendingWebhook(false);
      }
    }

    // Clear success message after 3 seconds
    setTimeout(() => {
      setSuccessMsg('');
    }, 3000);
  };

  return (
    <div className="flex flex-col rounded-lg overflow-hidden shadow-[0_1px_3px_rgba(21,27,43,0.06)] border border-gray-150 border-l-4 border-l-brand-red text-left bg-white">
      
      {/* 1. WIDGET DE ESTADO DE CONEXIÓN EN FONDO OSCURO GRAPHITE-900 */}
      <div className="bg-graphite-900 text-white p-3 px-4 flex items-center justify-between border-b border-gray-850">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${origenData === 'supabase' ? 'bg-signal-green animate-pulse' : 'bg-signal-amber animate-pulse'}`} />
          <span className="text-[10px] uppercase font-bold tracking-wider text-gray-300">
            {origenData === 'supabase' ? 'Nube Supabase' : 'Contingencia Local'}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-sm uppercase ${
            origenData === 'supabase' 
              ? 'bg-signal-green-soft text-signal-green border border-signal-green/20' 
              : 'bg-signal-amber-soft text-signal-amber border border-signal-amber/20'
          }`}>
            {origenData === 'supabase' ? 'ONLINE' : 'CONTINGENCIA'}
          </span>
          {sincronizarDatos && (
            <button
              type="button"
              onClick={sincronizarDatos}
              className="p-1 rounded text-gray-400 hover:text-white hover:bg-gray-800 transition-colors cursor-pointer"
              title="Sincronizar ahora"
            >
              <RefreshCw className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Formulario de Registro Rápido */}
      <form onSubmit={handleSubmit} className="p-4 space-y-3.5 text-xs">
        <div className="flex items-center gap-1.5 pb-2 border-b border-gray-100">
          <PlusCircle className="w-4.5 h-4.5 text-brand-red" />
          <h4 className="font-display font-bold text-gray-800 text-xs uppercase tracking-wider">
            Registro Rápido de Turno
          </h4>
        </div>

        {/* Auxiliar */}
        <div>
          <label className="block text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1">
            Auxiliar Logístico
          </label>
          {lockedAuxiliar ? (
            <div className="w-full text-xs bg-gray-50 border border-gray-200 text-gray-700 py-1.5 px-2.5 rounded-lg font-bold">
              {formatoNombreCapital(lockedAuxiliar)}
            </div>
          ) : (
            <select
              value={selectedAuxiliar}
              onChange={(e) => setSelectedAuxiliar(e.target.value)}
              className="w-full text-xs bg-gray-50 border border-gray-200 text-gray-800 py-1.5 px-2 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-red font-medium"
            >
              <option value="">-- Seleccione un Auxiliar --</option>
              {auxiliares.map((aux) => (
                <option key={aux} value={aux}>
                  {formatoNombreCapital(aux)}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Fecha */}
        <div>
          <label className="block text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1">
            Fecha del Turno
          </label>
          <div className="relative">
            <Calendar className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2" />
            <input
              type="date"
              required
              value={fechaInput}
              onChange={(e) => setFechaInput(e.target.value)}
              className="w-full text-xs bg-gray-50 border border-gray-200 text-gray-800 py-1.5 pl-8 pr-2.5 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-red font-mono font-medium"
            />
          </div>
        </div>

        {/* Horas Ingreso / Salida */}
        <div className="grid grid-cols-2 gap-2.5">
          <div>
            <label className="block text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1">
              Hora Ingreso
            </label>
            <div className="relative">
              <Clock className="w-3.5 h-3.5 text-gray-400 absolute left-2 top-2" />
              <input
                type="time"
                required
                value={horaIngreso}
                onChange={(e) => setHoraIngreso(e.target.value)}
                className="w-full text-xs bg-gray-50 border border-gray-200 text-gray-800 py-1.5 pl-7 pr-2 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-red font-mono font-semibold"
              />
            </div>
          </div>

          <div>
            <label className="block text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1">
              Hora Salida
            </label>
            <div className="relative">
              <Clock className="w-3.5 h-3.5 text-gray-400 absolute left-2 top-2" />
              <input
                type="time"
                required
                disabled={aunEnTurno}
                value={aunEnTurno ? '' : horaSalida}
                onChange={(e) => setHoraSalida(e.target.value)}
                className="w-full text-xs bg-gray-50 border border-gray-200 text-gray-800 py-1.5 pl-7 pr-2 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-red font-mono font-semibold disabled:opacity-45 disabled:bg-gray-100"
              />
            </div>
          </div>
        </div>

        {/* Checkbox Aún en Turno (Turno Activo) */}
        <div className="flex items-center gap-2 py-0.5">
          <input
            type="checkbox"
            id="aunEnTurno"
            checked={aunEnTurno}
            onChange={(e) => setAunEnTurno(e.target.checked)}
            className="rounded border-gray-300 text-brand-red focus:ring-brand-red cursor-pointer h-3.5 w-3.5"
          />
          <label htmlFor="aunEnTurno" className="text-[10px] text-gray-500 font-bold select-none cursor-pointer flex items-center gap-1">
            <span>Aún en turno (Marcar ingreso sin salida)</span>
            <span className="w-1.5 h-1.5 rounded-full bg-signal-green animate-pulse shrink-0" />
          </label>
        </div>

        {/* Vehículo / Ruta */}
        <div className="grid grid-cols-2 gap-2.5">
          <div>
            <label className="block text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1">
              Placa Vehículo
            </label>
            <div className="relative">
              <Truck className="w-3.5 h-3.5 text-gray-400 absolute left-2 top-2" />
              <input
                type="text"
                required
                placeholder="Ej: LMX123"
                value={vehiculo}
                onChange={(e) => setVehiculo(e.target.value.toUpperCase())}
                className="w-full text-xs bg-gray-50 border border-gray-200 text-gray-800 py-1.5 pl-7 pr-2 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-red font-bold placeholder:font-normal placeholder:text-gray-300 placeholder:uppercase"
              />
            </div>
          </div>

          <div>
            <label className="block text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1">
              Ruta Asignada
            </label>
            <div className="relative">
              <MapPin className="w-3.5 h-3.5 text-gray-400 absolute left-2 top-2" />
              <input
                type="text"
                required
                placeholder="Ej: ORIENTE"
                value={ruta}
                onChange={(e) => setRuta(e.target.value.toUpperCase())}
                className="w-full text-xs bg-gray-50 border border-gray-200 text-gray-800 py-1.5 pl-7 pr-2 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-red font-bold placeholder:font-normal placeholder:text-gray-300 placeholder:uppercase"
              />
            </div>
          </div>
        </div>

        {/* 2. ETIQUETA "NOCTURNO" EN DETECCIÓN INMEDIATA (night-indigo) */}
        {previewEsNocturno && !aunEnTurno && (
          <div className="bg-night-indigo-soft border border-night-indigo/10 p-2.5 rounded-lg text-night-indigo text-[10px] leading-relaxed flex items-start gap-2 animate-fade-in shadow-inner">
            <span className="text-sm shrink-0">🌙</span>
            <div>
              <span className="font-bold uppercase tracking-wider block text-night-indigo">Turno Nocturno Detectado</span>
              <span className="text-graphite-700 block mt-0.5 font-medium">La jornada cruza la medianoche y califica automáticamente para recargos nocturnos.</span>
            </div>
          </div>
        )}

        {/* 3. VISTA PREVIA DE HORAS CALCULADAS */}
        <div className="bg-brand-red-soft/30 border border-brand-red-soft p-3 rounded-lg flex flex-col gap-1.5 text-[11px] text-gray-600">
          <div className="flex justify-between items-center">
            <span className="text-gray-400 font-bold text-[9px] uppercase">Jornada Calculada</span>
            <span className="font-mono font-black text-gray-800 text-xs">
              {aunEnTurno ? 'En Curso (Sin Salida)' : `${previewJornada.toFixed(1)}h`}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-400 font-bold text-[9px] uppercase">Horas Extras Calculadas</span>
            <span className={`font-mono font-black text-xs ${previewExtras > 0 && !aunEnTurno ? 'text-signal-alert font-bold' : 'text-gray-500'}`}>
              {aunEnTurno ? '---' : `+${previewExtras.toFixed(1)}h`}
            </span>
          </div>
          {previewExtras > 0 && !aunEnTurno && (
            <div className="text-[9px] text-gray-400 mt-1 flex gap-1 items-start leading-relaxed border-t border-brand-red-soft/40 pt-1.5">
              <Info className="w-3 h-3 text-brand-red shrink-0 mt-0.5" />
              <span>Suma horas extras ya que supera las 7 horas base de Ferricar.</span>
            </div>
          )}
        </div>

        {errorMsg && (
          <div className="text-[10px] text-signal-alert bg-signal-alert-soft border border-signal-alert/10 p-2 rounded-lg flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 text-signal-alert shrink-0" />
            <span className="font-semibold">{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="text-[10px] text-signal-green bg-signal-green-soft border border-signal-green/10 p-2 rounded-lg flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-signal-green shrink-0" />
            <span className="font-bold">{successMsg}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={sendingWebhook}
          className="w-full py-2 bg-brand-red hover:bg-brand-red-hover disabled:bg-brand-red/40 text-white font-black text-xs uppercase tracking-wider rounded-lg shadow-sm transition-all duration-200 cursor-pointer flex items-center justify-center gap-2"
        >
          <PlusCircle className="w-3.5 h-3.5" />
          {sendingWebhook ? 'Guardando...' : 'Guardar Turno'}
        </button>
      </form>
    </div>
  );
};
