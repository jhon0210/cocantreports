export const USOS_ARCHIVO = ['foto', 'eca', 'identificacion', 'salud', 'servicios'] as const;
export type UsoArchivo = typeof USOS_ARCHIVO[number];
export interface ReferenciaArchivo {
  id: string;
  propietarioId: number;
}
export interface ArchivoCarga {
  id: string;
  propietarioId: number | null;
  uso: string;
  nombre: string;
  mime: string;
  tamano: number;
  sha256: string;
  claveTemporal: string;
  clave: string;
  estado: string;
  vinculoId: number | null;
  creadoEn: Date;
  expiraEn: Date;
}

export const ARCHIVO_REPOSITORY = Symbol('ARCHIVO_REPOSITORY');
export interface ArchivoRepository {
  create(archivo: ArchivoCarga): Promise<void>;
  find(id: string): Promise<ArchivoCarga | null>;
  ready(id: string, propietarioId: number): Promise<boolean>;
  expired(limit: number): Promise<ArchivoCarga[]>;
  deleting(id: string): Promise<boolean>;
  remove(id: string): Promise<void>;
}
