import type { JustificacionDia, TipoJustificacion } from './types';

const SUPABASE_URL = 'https://tgouvfrpdgivtwmantby.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRnb3V2ZnJwZGdpdnR3bWFudGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMyOTc4ODEsImV4cCI6MjA5ODg3Mzg4MX0.mbz7DDXbyVZ3A8KpIRZBm8GvkRTFegd-RiPyXb_XHtM';

const headers = {
  'Content-Type': 'application/json',
  'apikey': SUPABASE_ANON_KEY,
  'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
};

export interface RegistroSupabase {
  id?: string;
  marca_temporal?: string;
  auxiliar: string;
  vehiculo: string;
  fecha: string;
  hora_ingreso: string;
  hora_salida: string;
  ruta: string;
  jornada: number;
  horas_extras: number;
  es_nocturno: boolean;
  origen?: string;
  created_at?: string;
}

export async function obtenerRegistros(auxiliar?: string): Promise<RegistroSupabase[]> {
  try {
    const allRecords: RegistroSupabase[] = [];
    const pageSize = 1000;
    let offset = 0;
    let hasMore = true;
    let iterations = 0;

    while (hasMore && iterations < 30) {
      iterations++;
      let url = `${SUPABASE_URL}/rest/v1/registros?select=*&order=created_at.desc&limit=${pageSize}&offset=${offset}`;
      if (auxiliar) url += `&auxiliar=eq.${encodeURIComponent(auxiliar)}`;
      const res = await fetch(url, { headers });
      if (!res.ok) {
        const errBody = await res.text().catch(() => '');
        throw new Error(`Supabase error ${res.status}${errBody ? `: ${errBody}` : ''}`);
      }
      const data: RegistroSupabase[] = await res.json();
      if (!Array.isArray(data) || data.length === 0) {
        hasMore = false;
      } else {
        allRecords.push(...data);
        if (data.length < pageSize) {
          hasMore = false;
        } else {
          offset += pageSize;
        }
      }
    }
    return allRecords;
  } catch (e) {
    console.error('[Supabase] Error al obtener registros:', e);
    throw e instanceof Error ? e : new Error('Error al obtener registros desde Supabase');
  }
}

export async function insertarRegistro(reg: RegistroSupabase): Promise<RegistroSupabase | null> {
  try {
    const body = {
      auxiliar: reg.auxiliar,
      vehiculo: reg.vehiculo,
      fecha: reg.fecha,
      hora_ingreso: reg.hora_ingreso,
      hora_salida: reg.hora_salida,
      ruta: reg.ruta,
      jornada: reg.jornada,
      horas_extras: reg.horas_extras,
      es_nocturno: reg.es_nocturno,
      origen: reg.origen || 'manual',
    };
    const res = await fetch(`${SUPABASE_URL}/rest/v1/registros`, {
      method: 'POST',
      headers: { ...headers, 'Prefer': 'return=representation' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Supabase insert error: ${res.status}`);
    const data = await res.json();
    return Array.isArray(data) ? data[0] : data;
  } catch (e) {
    console.error('[Supabase] Error al insertar registro:', e);
    return null;
  }
}

export async function eliminarRegistro(id: string): Promise<boolean> {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/registros?id=eq.${id}&origen=eq.manual`,
      { method: 'DELETE', headers }
    );
    if (!res.ok) {
      console.error(`[Supabase] Error HTTP ${res.status} al eliminar registro ${id}`);
      return false;
    }
    return true;
  } catch (e) {
    console.error('[Supabase] Error al eliminar:', e);
    return false;
  }
}

export async function actualizarRegistro(id: string, reg: Partial<RegistroSupabase>): Promise<boolean> {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/registros?id=eq.${id}`,
      {
        method: 'PATCH',
        headers,
        body: JSON.stringify(reg),
      }
    );
    if (!res.ok) {
      console.error(`[Supabase] Error HTTP ${res.status} al actualizar registro ${id}`);
      return false;
    }
    return true;
  } catch (e) {
    console.error('[Supabase] Error al actualizar:', e);
    return false;
  }
}

export async function eliminarRegistrosDeAuxiliar(auxiliar: string): Promise<boolean> {
  try {
    const cleanAux = auxiliar.trim().toUpperCase();
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/registros?auxiliar=eq.${encodeURIComponent(cleanAux)}`,
      { method: 'DELETE', headers }
    );
    if (!res.ok) {
      console.error(`[Supabase] Error HTTP ${res.status} al eliminar registros de auxiliar ${cleanAux}`);
      return false;
    }
    return true;
  } catch (e) {
    console.error('[Supabase] Error al eliminar registros de auxiliar:', e);
    return false;
  }
}

export async function verificarConexion(): Promise<boolean> {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/registros?select=id&limit=1`,
      { headers }
    );
    return res.ok;
  } catch {
    return false;
  }
}

export interface CredencialSupabase {
  auxiliar: string;
  pin: string;
  cargo?: string | null;
  created_at?: string;
}

export async function obtenerCredenciales(): Promise<CredencialSupabase[]> {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/auxiliares_credenciales?select=*`,
      { headers }
    );
    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      throw new Error(`Supabase error ${res.status}${errBody ? `: ${errBody}` : ''}`);
    }
    return await res.json();
  } catch (e) {
    console.error('[Supabase] Error al obtener credenciales:', e);
    throw e instanceof Error ? e : new Error('Error al obtener credenciales desde Supabase');
  }
}

export async function guardarCredencial(
  auxiliar: string,
  pin?: string,
  cargo?: string
): Promise<boolean> {
  try {
    const cleanAuxiliar = auxiliar.trim().toUpperCase();
    const patchBody: Record<string, string> = {};
    if (pin !== undefined) patchBody.pin = pin.trim();
    if (cargo !== undefined) patchBody.cargo = cargo.trim();

    if (Object.keys(patchBody).length === 0) return true;

    const patchRes = await fetch(
      `${SUPABASE_URL}/rest/v1/auxiliares_credenciales?auxiliar=eq.${encodeURIComponent(cleanAuxiliar)}`,
      {
        method: 'PATCH',
        headers: { ...headers, 'Prefer': 'return=representation' },
        body: JSON.stringify(patchBody),
      }
    );

    if (!patchRes.ok) {
      const errorMsg = await patchRes.text().catch(() => '');
      console.error(`[Supabase] Error HTTP ${patchRes.status} al actualizar credencial:`, errorMsg);
      return false;
    }

    const updatedData = await patchRes.json();
    if (Array.isArray(updatedData) && updatedData.length > 0) {
      return true;
    }

    // No existía fila previa: insertar con POST
    const postBody: Record<string, string> = {
      auxiliar: cleanAuxiliar,
      pin: pin !== undefined ? pin.trim() : '1234',
    };
    if (cargo !== undefined) {
      postBody.cargo = cargo.trim();
    }

    const postRes = await fetch(
      `${SUPABASE_URL}/rest/v1/auxiliares_credenciales`,
      {
        method: 'POST',
        headers: { ...headers, 'Prefer': 'return=representation' },
        body: JSON.stringify(postBody),
      }
    );

    if (!postRes.ok) {
      const errorMsg = await postRes.text().catch(() => '');
      console.error(`[Supabase] Error HTTP ${postRes.status} al insertar credencial:`, errorMsg);
      return false;
    }

    return true;
  } catch (e) {
    console.error('[Supabase] Error de red al guardar credencial:', e);
    return false;
  }
}

export async function eliminarCredencial(auxiliar: string): Promise<boolean> {
  try {
    const cleanAux = auxiliar.trim().toUpperCase();
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/auxiliares_credenciales?auxiliar=eq.${encodeURIComponent(cleanAux)}`,
      { method: 'DELETE', headers }
    );
    if (!res.ok) {
      console.error(`[Supabase] Error HTTP ${res.status} al eliminar credencial de ${cleanAux}`);
      return false;
    }
    return true;
  } catch (e) {
    console.error('[Supabase] Error al eliminar credencial:', e);
    return false;
  }
}

// ============================================================================
// JUSTIFICACIONES DE DÍAS (tabla: auxiliares_justificaciones)
// ============================================================================

export interface JustificacionSupabase {
  id?: string;
  auxiliar: string;
  fecha: string;
  tipo: TipoJustificacion | string;
  nota?: string | null;
  detalle?: Record<string, any> | null;
  created_at?: string;
}

export async function obtenerJustificaciones(): Promise<JustificacionSupabase[]> {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/auxiliares_justificaciones?select=*`,
      { headers }
    );
    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      throw new Error(`Supabase error ${res.status}${errBody ? `: ${errBody}` : ''}`);
    }
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (e) {
    console.error('[Supabase] Error al obtener justificaciones:', e);
    throw e instanceof Error ? e : new Error('Error al obtener justificaciones desde Supabase');
  }
}

export async function guardarJustificacion(justificacion: JustificacionDia): Promise<JustificacionSupabase | null> {
  try {
    const { auxiliar, fecha, tipo, nota, ...extraFields } = justificacion;
    const cleanAux = auxiliar.replace(/\s+/g, ' ').trim().toUpperCase();
    const cleanFecha = fecha.trim();

    const detallePayload: Record<string, any> = {
      ...extraFields,
      fechaCreacion: extraFields.fechaCreacion || new Date().toISOString(),
    };
    if (detallePayload.id === undefined) {
      delete detallePayload.id;
    }

    const body = {
      auxiliar: cleanAux,
      fecha: cleanFecha,
      tipo,
      nota: nota ?? null,
      detalle: detallePayload,
    };

    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/auxiliares_justificaciones?on_conflict=auxiliar,fecha`,
      {
        method: 'POST',
        headers: {
          ...headers,
          'Prefer': 'resolution=merge-duplicates,return=representation',
        },
        body: JSON.stringify(body),
      }
    );

    if (!res.ok) {
      const errorMsg = await res.text().catch(() => '');
      console.error(`[Supabase] Error HTTP ${res.status} al guardar justificación:`, errorMsg);
      return null;
    }

    const data = await res.json();
    return Array.isArray(data) ? data[0] : data;
  } catch (e) {
    console.error('[Supabase] Error de red al guardar justificación:', e);
    return null;
  }
}

export async function eliminarJustificacion(auxiliar: string, fecha: string): Promise<boolean> {
  try {
    const cleanAux = auxiliar.replace(/\s+/g, ' ').trim().toUpperCase();
    const cleanFecha = fecha.trim();
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/auxiliares_justificaciones?auxiliar=eq.${encodeURIComponent(cleanAux)}&fecha=eq.${encodeURIComponent(cleanFecha)}`,
      { method: 'DELETE', headers }
    );
    if (!res.ok) {
      console.error(`[Supabase] Error HTTP ${res.status} al eliminar justificación`);
      return false;
    }
    return true;
  } catch (e) {
    console.error('[Supabase] Error al eliminar justificación:', e);
    return false;
  }
}

export async function eliminarJustificacionesDeAuxiliar(auxiliar: string): Promise<boolean> {
  try {
    const cleanAux = auxiliar.replace(/\s+/g, ' ').trim().toUpperCase();
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/auxiliares_justificaciones?auxiliar=eq.${encodeURIComponent(cleanAux)}`,
      { method: 'DELETE', headers }
    );
    if (!res.ok) {
      console.error(`[Supabase] Error HTTP ${res.status} al eliminar justificaciones de ${cleanAux}`);
      return false;
    }
    return true;
  } catch (e) {
    console.error('[Supabase] Error al eliminar justificaciones de auxiliar:', e);
    return false;
  }
}

// ============================================================================
// CONFIGURACIÓN DE LA APLICACIÓN (tabla: app_config)
// ============================================================================

export async function obtenerAppConfig(): Promise<Record<string, string>> {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/app_config?select=*`,
      { headers }
    );
    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      throw new Error(`Supabase error ${res.status}${errBody ? `: ${errBody}` : ''}`);
    }
    const rows: { clave: string; valor: string }[] = await res.json();
    const map: Record<string, string> = {};
    if (Array.isArray(rows)) {
      rows.forEach(row => {
        if (row && row.clave) {
          map[row.clave] = row.valor ?? '';
        }
      });
    }
    return map;
  } catch (e) {
    console.error('[Supabase] Error al obtener app_config:', e);
    throw e instanceof Error ? e : new Error('Error al obtener configuración desde Supabase');
  }
}

export async function guardarAppConfig(entries: Record<string, string>): Promise<boolean> {
  try {
    const payload = Object.entries(entries).map(([clave, valor]) => ({
      clave,
      valor: String(valor ?? ''),
    }));
    if (payload.length === 0) return true;

    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/app_config?on_conflict=clave`,
      {
        method: 'POST',
        headers: {
          ...headers,
          'Prefer': 'resolution=merge-duplicates,return=representation',
        },
        body: JSON.stringify(payload),
      }
    );

    if (!res.ok) {
      const errorMsg = await res.text().catch(() => '');
      console.error(`[Supabase] Error HTTP ${res.status} al guardar app_config:`, errorMsg);
      return false;
    }

    return true;
  } catch (e) {
    console.error('[Supabase] Error de red al guardar app_config:', e);
    return false;
  }
}
