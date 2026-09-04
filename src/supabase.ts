const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string) || 'https://tgouvfrpdgivtwmantby.supabase.co';
const SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRnb3V2ZnJwZGdpdnR3bWFudGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMyOTc4ODEsImV4cCI6MjA5ODg3Mzg4MX0.mbz7DDXbyVZ3A8KpIRZBm8GvkRTFegd-RiPyXb_XHtM';

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
      if (!res.ok) throw new Error(`Supabase error: ${res.status}`);
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
    return [];
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
    return res.ok;
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
    return res.ok;
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
    return res.ok;
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
  created_at?: string;
}

export async function obtenerCredenciales(): Promise<CredencialSupabase[]> {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/auxiliares_credenciales?select=*`,
      { headers }
    );
    if (!res.ok) throw new Error(`Supabase error: ${res.status}`);
    return await res.json();
  } catch (e) {
    console.error('[Supabase] Error al obtener credenciales:', e);
    return [];
  }
}

export async function guardarCredencial(auxiliar: string, pin: string): Promise<boolean> {
  try {
    const cleanAuxiliar = auxiliar.trim().toUpperCase();
    const cleanPin = pin.trim();

    // Intentar upsert directo con PostgREST resolution=merge-duplicates
    const upsertRes = await fetch(
      `${SUPABASE_URL}/rest/v1/auxiliares_credenciales`,
      {
        method: 'POST',
        headers: {
          ...headers,
          'Prefer': 'resolution=merge-duplicates,return=representation',
        },
        body: JSON.stringify({ auxiliar: cleanAuxiliar, pin: cleanPin }),
      }
    );

    if (upsertRes.ok) {
      return true;
    }

    // Fallback: Si merge-duplicates da error o RLS, intentar PATCH directo
    const patchRes = await fetch(
      `${SUPABASE_URL}/rest/v1/auxiliares_credenciales?auxiliar=eq.${encodeURIComponent(cleanAuxiliar)}`,
      {
        method: 'PATCH',
        headers: { ...headers, 'Prefer': 'return=representation' },
        body: JSON.stringify({ pin: cleanPin }),
      }
    );

    if (patchRes.ok) {
      const updatedData = await patchRes.json();
      if (Array.isArray(updatedData) && updatedData.length > 0) {
        return true;
      }
    }

    // Fallback 2: Si el registro no existía para actualizar, intentar INSERT normal
    const insertRes = await fetch(
      `${SUPABASE_URL}/rest/v1/auxiliares_credenciales`,
      {
        method: 'POST',
        headers: { ...headers, 'Prefer': 'return=representation' },
        body: JSON.stringify({ auxiliar: cleanAuxiliar, pin: cleanPin }),
      }
    );

    if (insertRes.ok) {
      return true;
    }

    return false;
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
    return res.ok;
  } catch (e) {
    console.error('[Supabase] Error al eliminar credencial:', e);
    return false;
  }
}

