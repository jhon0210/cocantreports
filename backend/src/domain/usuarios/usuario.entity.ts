export interface Usuario {
  id: number;
  nombre: string;
  apellido: string;
  usuario: string;
  claveHash: string | null;
  cedula: number | null;
  idPerfil: number | null;
  perfil: string | null;
  idCargo: number | null;
  cargo: string | null;
  idEca: number | null;
  eca: string | null;
  activo: boolean;
}

export interface NuevoUsuario {
  nombre: string;
  apellido: string;
  usuario: string;
  claveHash: string;
  cedula: number;
  idPerfil: number;
  idCargo: number | null;
  idEca: number | null;
}

export interface CambiosUsuario {
  usuario?: string;
  nombre?: string;
  apellido?: string;
  cedula?: number;
  idPerfil?: number;
  idCargo?: number | null;
  idEca?: number | null;
  activo?: boolean;
  claveHash?: string;
}
