import { ReferenciaArchivo } from '../archivos/archivo';

export interface Eca {
  id: number;
  nombre: string | null;
  direccion: string | null;
  comuna: string | null;
  estado: string | null;
  categoria: string | null;
  ruta: string | null;
  macroruta: string | null;
  representante: string | null;
  codigoNuec: string | null;
  adjuntos: AdjuntoEca[];
}

export interface AdjuntoEca {
  id: number;
  nombre: string;
  tamano: number;
}

export type NuevoAdjuntoEca = {
  nombre: string;
  contenido: Uint8Array;
} | { archivo: ReferenciaArchivo };

export type CambioAdjuntoEca = { id: number } | NuevoAdjuntoEca;
export type NuevaEca = Omit<Eca, 'id' | 'adjuntos'> & { adjuntos?: NuevoAdjuntoEca[] };
export type CambiosEca = Partial<Omit<NuevaEca, 'adjuntos'>> & { adjuntos?: CambioAdjuntoEca[] };
