import { ConflictError, ForbiddenError } from '../../../domain/shared/domain-errors';
import { CambiosUsuario, Usuario } from '../../../domain/usuarios/usuario.entity';
import { RoleName } from '../../../shared/constants/roles';
import { AuthenticatedUser } from '../../shared/authenticated-user';
import { assertCanManagePerfil } from '../usuario-policy';
import { DeactivateUsuarioUseCase } from './deactivate-usuario.use-case';
import { UpdateUsuarioUseCase } from './update-usuario.use-case';

const now = new Date('2026-10-14T12:00:00Z');
const actor: AuthenticatedUser = { id: 1, usuario: 'coord', nombre: 'A', apellido: 'B', idPerfil: 2, perfil: RoleName.COORDINADOR, idEca: null };
const usuario: Usuario = {
  id: 2, nombre: 'Op', apellido: 'Prueba', usuario: 'operario', claveHash: 'hash',
  cedula: 12345, idPerfil: 3, perfil: RoleName.OPERARIO, idCargo: null, cargo: null, idEca: null, eca: null, activo: true,
};

function build(target: Usuario = usuario) {
  const usuarios = {
    findById: jest.fn().mockResolvedValue(target), findByUsuario: jest.fn(), findByCedula: jest.fn(),
    list: jest.fn(), create: jest.fn(),
    update: jest.fn(async (_id: number, changes: CambiosUsuario) => ({ ...target, ...changes })),
  };
  const catalogos = {
    listRoles: jest.fn(), findRolById: jest.fn(), listCargos: jest.fn(), findCargoById: jest.fn(),
  };
  const sesiones = {
    create: jest.fn(), findById: jest.fn(), rotate: jest.fn(), revokeFamily: jest.fn(),
    revokeAllForUser: jest.fn(), deleteExpired: jest.fn(),
  };
  const hasher = { hash: jest.fn(), compare: jest.fn() };
  const ecas = { list: jest.fn(), findById: jest.fn().mockResolvedValue({ id: 5 }), create: jest.fn(), update: jest.fn(), delete: jest.fn(), hasRelations: jest.fn(), findAdjunto: jest.fn() };
  const useCase = new UpdateUsuarioUseCase(usuarios, catalogos, sesiones, hasher, { now: () => now, today: () => now }, ecas);
  return { useCase, usuarios, sesiones, catalogos, ecas };
}

describe('Permisos de gestión de usuarios', () => {
  it.each([RoleName.ADMINISTRADOR, RoleName.COORDINADOR])('%s puede cambiar el nombre de acceso', async (perfil) => {
    const { useCase, usuarios, sesiones } = build();
    await expect(useCase.execute({ ...actor, perfil }, usuario.id, { usuario: 'nuevo.usuario' }))
      .resolves.toMatchObject({ usuario: 'nuevo.usuario', id_user: usuario.id });
    expect(usuarios.findByUsuario).toHaveBeenCalledWith('nuevo.usuario');
    expect(usuarios.update).toHaveBeenCalledWith(usuario.id, { usuario: 'nuevo.usuario' });
    expect(sesiones.revokeAllForUser).not.toHaveBeenCalled();
  });

  it('rechaza un nombre de acceso que pertenece a otra cuenta', async () => {
    const { useCase, usuarios } = build();
    usuarios.findByUsuario.mockResolvedValue({ ...usuario, id: 3 });
    await expect(useCase.execute(actor, usuario.id, { usuario: 'ocupado' })).rejects.toThrow(ConflictError);
    expect(usuarios.update).not.toHaveBeenCalled();
  });

  it('conservar el nombre actual no produce conflictos ni escrituras', async () => {
    const { useCase, usuarios } = build();
    await expect(useCase.execute(actor, usuario.id, { usuario: usuario.usuario })).resolves.toMatchObject({ usuario: usuario.usuario });
    expect(usuarios.findByUsuario).not.toHaveBeenCalled();
    expect(usuarios.update).not.toHaveBeenCalled();
  });

  it('permite cambiar el nombre de acceso propio sin cambiar el ID', async () => {
    const { useCase } = build({ ...usuario, id: actor.id, perfil: actor.perfil, idPerfil: actor.idPerfil });
    await expect(useCase.execute(actor, actor.id, { usuario: 'coordinador.nuevo' }))
      .resolves.toMatchObject({ usuario: 'coordinador.nuevo', id_user: actor.id });
  });

  it('el Coordinador edita cuentas de Operario', async () => {
    const { useCase, usuarios } = build();
    await useCase.execute(actor, usuario.id, { nomUser: 'Nuevo' });
    expect(usuarios.update).toHaveBeenCalledWith(usuario.id, { nombre: 'Nuevo' });
  });

  it('el Coordinador no puede desactivar mediante PATCH ni mediante baja lógica', async () => {
    const { useCase, usuarios, sesiones } = build();
    await expect(useCase.execute(actor, usuario.id, { activo: false })).rejects.toThrow(ForbiddenError);
    await expect(new DeactivateUsuarioUseCase(useCase).execute(actor, usuario.id)).rejects.toThrow(ForbiddenError);
    expect(usuarios.update).not.toHaveBeenCalled();
    expect(sesiones.revokeAllForUser).not.toHaveBeenCalled();
  });

  it('el Administrador puede desactivar y revoca las sesiones', async () => {
    const { useCase, sesiones } = build();
    await expect(useCase.execute({ ...actor, perfil: RoleName.ADMINISTRADOR }, usuario.id, { activo: false })).resolves.toMatchObject({ activo: false });
    expect(sesiones.revokeAllForUser).toHaveBeenCalledWith(usuario.id, now);
  });

  it('el Coordinador puede reactivar una cuenta de Operario', async () => {
    const { useCase } = build({ ...usuario, activo: false });
    await expect(useCase.execute(actor, usuario.id, { activo: true })).resolves.toMatchObject({ activo: true });
  });

  it('el Coordinador no puede editar una cuenta de Administrador', async () => {
    const { useCase, usuarios } = build({ ...usuario, perfil: RoleName.ADMINISTRADOR, idPerfil: 1 });
    await expect(useCase.execute(actor, usuario.id, { nomUser: 'Nuevo' })).rejects.toThrow(ForbiddenError);
    expect(usuarios.update).not.toHaveBeenCalled();
  });

  it('el Coordinador no puede asignar el perfil Administrador', async () => {
    const { useCase, usuarios, catalogos } = build();
    catalogos.findRolById.mockResolvedValue({ id: 1, perfil: RoleName.ADMINISTRADOR });
    await expect(useCase.execute(actor, usuario.id, { id_perfil: 1 })).rejects.toThrow(ForbiddenError);
    expect(() => assertCanManagePerfil(actor, RoleName.ADMINISTRADOR)).toThrow(ForbiddenError);
    expect(usuarios.update).not.toHaveBeenCalled();
  });
});
