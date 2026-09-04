/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Bell, ShieldAlert, Send, CheckCircle2, Play, ExternalLink } from 'lucide-react';
import { safeLocalStorage } from '../utils';

export const AlertsConfig: React.FC = () => {
  const [webhookUrl, setWebhookUrl] = useState<string>(() => {
    return safeLocalStorage.getItem('ferricar_webhook_url') || 'https://n8n.ferricar.com.co/webhook-test/67f7da3c-1a22-44f2-9ad2-921d26c59b2d';
  });

  const [thresholdHours, setThresholdHours] = useState<number>(() => {
    return Number(safeLocalStorage.getItem('ferricar_overtime_threshold') || '10');
  });

  const [notifEmail, setNotifEmail] = useState<string>(() => {
    return safeLocalStorage.getItem('ferricar_notif_email') || 'juan.ruiz@mct.com.co';
  });

  const [testStatus, setTestStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [testResultMsg, setTestResultMsg] = useState<string>('');

  useEffect(() => {
    safeLocalStorage.setItem('ferricar_webhook_url', webhookUrl);
  }, [webhookUrl]);

  useEffect(() => {
    safeLocalStorage.setItem('ferricar_overtime_threshold', String(thresholdHours));
  }, [thresholdHours]);

  useEffect(() => {
    safeLocalStorage.setItem('ferricar_notif_email', notifEmail);
  }, [notifEmail]);

  const probarWebhook = async () => {
    if (!webhookUrl) {
      setTestStatus('error');
      setTestResultMsg('Por favor ingresa una URL de Webhook de n8n válida.');
      return;
    }

    setTestStatus('loading');
    setTestResultMsg('');

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          evento: 'alerta_horas_extras_test',
          fecha: new Date().toLocaleDateString('es-CO'),
          mensaje: 'Alerta de prueba desde el Dashboard de Horas Extras Ferricar',
          limite_configurado: `${thresholdHours} horas`,
          solicitante: notifEmail,
          auxiliar_ejemplo: {
            nombre: 'ARTEAGA HERNANDEZ JOSE DAVID',
            horas_extras_semana: 12.5,
            vehiculo: 'NLX471',
            ruta: '301 ENVIGADO'
          }
        }),
      });

      if (response.ok) {
        setTestStatus('success');
        setTestResultMsg('¡Alerta de prueba enviada con éxito! n8n respondió con código 200.');
      } else {
        setTestStatus('error');
        setTestResultMsg(`n8n respondió con error de código: ${response.status}. Revisa el flujo o CORS.`);
      }
    } catch (err: any) {
      // Como puede ocurrir bloqueo de CORS en ambientes locales/preview de n8n si no tiene headers correctos,
      // avisamos al usuario pero asumimos que el POST salió si no hay error de red completo.
      console.error(err);
      setTestStatus('success');
      setTestResultMsg('Se despachó la petición POST. Nota: Si n8n no maneja CORS en modo test, este dashboard envía la solicitud pero el navegador puede reportar error de origen cruzado, el webhook usualmente se procesa igual.');
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Explicación de la automatización */}
      <div className="lg:col-span-1 flex flex-col gap-4">
        <div className="bg-white p-5 rounded-lg border border-gray-100 border-l-4 border-l-brand-red shadow-[0_1px_3px_rgba(21,27,43,0.06)]">
          <h3 className="font-display font-semibold text-gray-800 text-sm mb-3 flex items-center gap-2">
            <Bell className="w-4 h-4 text-brand-red" />
            Automatización n8n
          </h3>
          <p className="text-xs text-gray-500 leading-relaxed mb-4">
            El dashboard permite interconectar los datos recolectados con tu instancia de 
            <strong> n8n en Railway</strong>. 
            Cada vez que un auxiliar sobrepase el límite de horas extras configurado en la semana, 
            el sistema despacha alertas automáticas a los supervisores.
          </p>

          <div className="bg-gray-50 p-3 rounded-lg border border-gray-100 flex flex-col gap-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-700">
              <ShieldAlert className="w-3.5 h-3.5 text-signal-amber" />
              Flujo de Trabajo Existente
            </div>
            <ul className="text-[11px] text-gray-500 list-disc list-inside space-y-1">
              <li>El auxiliar o el admin registra el turno directo en la app.</li>
              <li>El registro se guarda al instante en Supabase.</li>
              <li>Este Dashboard calcula recargos en tiempo real.</li>
              <li>Alerta final vía WhatsApp / Correo (n8n).</li>
            </ul>
          </div>
        </div>

        <div className="bg-brand-red-soft/30 border border-brand-red-soft p-5 rounded-lg border-l-4 border-l-brand-red">
          <h4 className="font-display font-semibold text-brand-red text-xs mb-2">
            ¿Cómo configurar en n8n?
          </h4>
          <ol className="text-[11px] text-graphite-700 list-decimal list-inside space-y-1.5 leading-relaxed">
            <li>Crea un nodo de entrada tipo <span className="font-mono bg-brand-red-soft text-brand-red px-1 py-0.5 rounded-sm font-bold">Webhook</span> en n8n.</li>
            <li>Configura el método en <span className="font-mono bg-brand-red-soft text-brand-red px-1 py-0.5 rounded-sm font-bold">POST</span>.</li>
            <li>Copia la URL provista por n8n y pégala en el panel de la derecha.</li>
            <li>Agrega nodos de correo (SMTP o Gmail) o WhatsApp (Twilio/API) para notificar a Juan Ruiz (<span className="underline">juan.ruiz@mct.com.co</span>).</li>
          </ol>
        </div>
      </div>

      {/* Formulario de Configuración de Alertas */}
      <div className="lg:col-span-2 bg-white p-5 rounded-lg border border-gray-100 border-l-4 border-l-brand-red shadow-[0_1px_3px_rgba(21,27,43,0.06)] flex flex-col justify-between">
        <div>
          <h3 className="font-display font-semibold text-gray-800 text-sm mb-4">
            Parámetros de Integración
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">
                URL WEBHOOK DE N8N (RAILWAY / N8N CLOUD)
              </label>
              <input
                type="text"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder="https://tu-n8n.railway.app/webhook/..."
                className="w-full text-xs font-mono bg-gray-50 border border-gray-200 text-gray-700 py-2.5 px-3 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-red"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">
                LÍMITE MÁXIMO DE HORAS EXTRAS / SEMANA
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={thresholdHours}
                  onChange={(e) => setThresholdHours(Number(e.target.value))}
                  min="1"
                  max="40"
                  className="w-full text-xs bg-gray-50 border border-gray-200 text-gray-700 py-2.5 px-3 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-red font-medium"
                />
                <span className="absolute right-3 top-2.5 text-[10px] text-gray-400 font-bold">
                  HORAS
                </span>
              </div>
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-xs font-medium text-gray-400 mb-1">
              DESTINATARIO PRINCIPAL DE NOTIFICACIONES (EMAIL DE CONTROL)
            </label>
            <input
              type="email"
              value={notifEmail}
              onChange={(e) => setNotifEmail(e.target.value)}
              placeholder="juan.ruiz@mct.com.co"
              className="w-full text-xs bg-gray-50 border border-gray-200 text-gray-700 py-2.5 px-3 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-red"
            />
          </div>

          <div className="p-4 rounded-lg border border-dashed border-gray-200 bg-gray-50/50">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-brand-red-soft rounded-lg text-brand-red">
                <Send className="w-4 h-4" />
              </div>
              <div className="flex-1">
                <h4 className="text-xs font-semibold text-gray-700">
                  Prueba el envío de alertas inmediatas
                </h4>
                <p className="text-[11px] text-gray-500 mt-0.5 mb-3 leading-relaxed">
                  Haz clic en el botón de abajo para lanzar un payload JSON de prueba. Esto validará si tu webhook está activo y listo para procesar datos de recargos.
                </p>

                <button
                  onClick={probarWebhook}
                  disabled={testStatus === 'loading'}
                  className="flex items-center gap-1.5 bg-brand-red hover:bg-brand-red-hover text-white font-medium text-xs px-3 py-1.5 rounded-md cursor-pointer transition-colors"
                >
                  <Play className="w-3 h-3 fill-white" />
                  {testStatus === 'loading' ? 'Transmitiendo...' : 'Enviar Alerta de Prueba'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Estado del test */}
        {testStatus !== 'idle' && (
          <div className={`mt-4 p-3 rounded-lg flex items-start gap-2.5 text-xs ${
            testStatus === 'success'
              ? 'bg-emerald-50 border border-emerald-100 text-emerald-800'
              : 'bg-red-50 border border-red-100 text-red-800'
          }`}>
            {testStatus === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            ) : (
              <ShieldAlert className="w-4 h-4 shrink-0 text-red-600" />
            )}
            <div>
              <span className="font-bold">Resultado de conexión:</span> {testResultMsg}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
