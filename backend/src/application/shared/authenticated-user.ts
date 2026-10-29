/** Identidad autenticada que viaja en la petición (cargada desde la BD en cada request). */
export interface AuthenticatedUser {
  id: number;
  usuario: string;
  nombre: string;
  apellido: string;
  idPerfil: number;
  perfil: string;
  /** ECA asociada (solo el perfil Administrador Eca). */
  idEca: number | null;
}
