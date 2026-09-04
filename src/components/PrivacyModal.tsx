import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ShieldCheck, X, FileText, Lock, UserCheck, CheckCircle2, Phone, Mail } from 'lucide-react';

interface PrivacyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PrivacyModal: React.FC<PrivacyModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs"
          onClick={onClose}
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="relative bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] z-10 text-left"
        >
          {/* Header */}
          <div className="p-5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-indigo-600 text-white shadow-xs">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-display font-bold text-base text-white">
                  Políticas de Privacidad & Tratamiento de Datos
                </h3>
                <p className="text-xs text-slate-400">
                  Habeas Data — Ley Estatutaria 1581 de 2012 (Colombia) • FERRICAR S.A.S.
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              title="Cerrar modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Scrollable Body */}
          <div className="p-6 overflow-y-auto space-y-6 text-xs text-slate-600 leading-relaxed">
            {/* 1. Responsable */}
            <div className="p-4 rounded-xl bg-indigo-50/50 border border-indigo-100 space-y-1.5">
              <div className="flex items-center gap-2 text-indigo-900 font-bold">
                <FileText className="w-4 h-4 text-indigo-600" />
                <span>1. Responsable del Tratamiento de la Información</span>
              </div>
              <p className="text-slate-700">
                <strong>FERRICAR S.A.S.</strong>, sociedad comercial legalmente constituida en la República de Colombia, con operación logística en la sede <strong>Coopidrogas Bello (Antioquia)</strong>, actúa como Responsable del Tratamiento de los datos personales suministrados por los auxiliares de ruta, escoltas y personal de operaciones.
              </p>
            </div>

            {/* 2. Finalidad */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-slate-900 font-bold">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>2. Finalidades Legítimas del Tratamiento</span>
              </div>
              <p>
                Los datos registrados y procesados en esta aplicación tienen como fin exclusivo:
              </p>
              <ul className="list-disc pl-5 space-y-1 text-slate-700">
                <li>Registro fidedigno y auditoría de horarios de inicio y finalización de turnos laborales.</li>
                <li>Cálculo legal de la jornada de trabajo ordinaria y liquidación de horas extras conforme al Código Sustantivo del Trabajo y la Ley 2101 de reducción de jornada en Colombia.</li>
                <li>Monitoreo de seguridad ocupacional, fatiga laboral y prevención de exceso de horas consecutivas en rutas de distribución.</li>
                <li>Asignación y seguimiento de placas de vehículos y destinos de ruta autorizados en la operación con Coopidrogas.</li>
              </ul>
            </div>

            {/* 3. Datos Recolectados */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-slate-900 font-bold">
                <Lock className="w-4 h-4 text-indigo-600" />
                <span>3. Datos Objeto de Tratamiento</span>
              </div>
              <p>
                Se recolectan y administran: nombre y apellidos del colaborador, cargo operativo asignado, horarios diarios de turno (ingreso y salida), número de placa del vehículo, descripción de ruta y código PIN numérico personal e intransferible para el acceso a la plataforma.
              </p>
            </div>

            {/* 4. Derechos del Titular */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-slate-900 font-bold">
                <UserCheck className="w-4 h-4 text-purple-600" />
                <span>4. Derechos del Titular (Habeas Data)</span>
              </div>
              <p>
                De conformidad con el artículo 8 de la Ley 1581 de 2012, el titular de la información tiene derecho a:
              </p>
              <ul className="list-disc pl-5 space-y-1 text-slate-700">
                <li><strong>Conocer, actualizar y rectificar</strong> sus datos personales frente a FERRICAR S.A.S. (incluyendo la edición de registros inexactos o corrección de turnos).</li>
                <li><strong>Solicitar la supresión o eliminación</strong> de registros cuando considere que no se respetan los principios legales o exista un error operativo.</li>
                <li><strong>Acceder de forma gratuita</strong> a sus datos personales que hayan sido objeto de tratamiento.</li>
              </ul>
            </div>

            {/* 5. Seguridad de la Información */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-slate-900 font-bold">
                <ShieldCheck className="w-4 h-4 text-blue-600" />
                <span>5. Medidas de Seguridad & Cifrado</span>
              </div>
              <p>
                FERRICAR S.A.S. implementa protocolos técnicos y administrativos para evitar la adulteración, pérdida, consulta o acceso no autorizado. Los datos son sincronizados en tiempo real mediante conexiones TLS/SSL seguras con base de datos en la nube (Supabase PostgreSQL), contando con control de accesos segregado por roles (Coordinador de Operaciones / Auxiliar Operativo).
              </p>
            </div>

            {/* 6. Contacto */}
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-slate-600 space-y-1">
              <span className="font-bold text-slate-800 block">Canal de Contacto y Atención de Consultas:</span>
              <p className="text-[11px]">
                Para cualquier inquietud, solicitud de corrección o ejercicio de derechos de Habeas Data, puedes comunicarte directamente con la Coordinación de Operaciones de FERRICAR S.A.S. en la sede Coopidrogas Bello.
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 bg-slate-50 border-t border-slate-150 flex items-center justify-between">
            <span className="text-[11px] text-slate-400">
              Vigencia 2026 • FERRICAR S.A.S.
            </span>
            <button
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs cursor-pointer"
            >
              Entendido y Aceptado
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
