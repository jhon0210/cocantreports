import { Caracterizacion } from './caracterizacion';
import { ReferenciaArchivo } from '../archivos/archivo';
import { EstadoRecuperador } from './estado-recuperador.entity';

export interface Recuperador {
  documentos?: DocumentoRecuperador[];
  id: number;
  nombre: string;
  apellido: string;
  cedula: string;
  bancarizado: boolean;
  foto: string | null;
  tieneFoto: boolean;
  codigoRegistro: string | null;
  caracterizacion: Caracterizacion | null;
  fechaRegistro: Date;
  idEstado: number;
  estado: EstadoRecuperador;
}

export interface NuevoRecuperador {
  fotoArchivo?: ReferenciaArchivo;
  documentos?: CambioDocumentoRecuperador[];
  nombre: string;
  apellido: string;
  cedula: string;
  idEstado: number;
  bancarizado: boolean;
  foto: string | null;
  codigoRegistro: string | null;
  caracterizacion: Caracterizacion | null;
}

export type CambiosRecuperador = Partial<NuevoRecuperador>;

export interface DocumentoRecuperador {
  id: number;
  tipo: string;
  nombre: string;
  mime: string;
  tamano: number;
}

export type CambioDocumentoRecuperador = { id: number } | {
  tipo: string;
  nombre: string;
  mime: string;
  contenido: Uint8Array;
} | { tipo: string; archivo: ReferenciaArchivo };
