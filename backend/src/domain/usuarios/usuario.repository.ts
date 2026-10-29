import { CambiosUsuario, NuevoUsuario, Usuario } from './usuario.entity';

export const USUARIO_REPOSITORY = Symbol('USUARIO_REPOSITORY');

export interface UsuarioRepository {
  findById(id: number): Promise<Usuario | null>;
  findByUsuario(usuario: string): Promise<Usuario | null>;
  findByCedula(cedula: number): Promise<Usuario | null>;
  list(): Promise<Usuario[]>;
  create(data: NuevoUsuario): Promise<Usuario>;
  update(id: number, changes: CambiosUsuario): Promise<Usuario>;
}
