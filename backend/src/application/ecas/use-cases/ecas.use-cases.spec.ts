import { Eca } from '../../../domain/ecas/eca.entity';
import { EcaRepository } from '../../../domain/ecas/eca.repository';
import { ConflictError, NotFoundError } from '../../../domain/shared/domain-errors';
import { DeleteEcaUseCase } from './ecas.use-cases';

const eca: Eca = {
  id: 1,
  nombre: 'ECA Centro',
  direccion: 'Calle 1',
  ruta: 'R-01',
  macroruta: 'Centro',
  comuna: null,
  estado: 'Activa',
  categoria: null,
  representante: null,
  codigoNuec: null,
  adjuntos: [],
};

describe('DeleteEcaUseCase', () => {
  let repository: jest.Mocked<EcaRepository>;
  let useCase: DeleteEcaUseCase;

  beforeEach(() => {
    repository = {
      list: jest.fn(),
      findById: jest.fn().mockResolvedValue(eca),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn().mockResolvedValue(undefined),
      hasRelations: jest.fn().mockResolvedValue(false),
      findAdjunto: jest.fn(),
    };
    useCase = new DeleteEcaUseCase(repository);
  });

  it('elimina una ECA existente sin relaciones', async () => {
    await expect(useCase.execute(1)).resolves.toBeUndefined();
    expect(repository.hasRelations).toHaveBeenCalledWith(1);
    expect(repository.delete).toHaveBeenCalledWith(1);
  });

  it('bloquea una ECA con registros relacionados', async () => {
    repository.hasRelations.mockResolvedValue(true);
    await expect(useCase.execute(1)).rejects.toThrow(ConflictError);
    expect(repository.delete).not.toHaveBeenCalled();
  });

  it('rechaza una ECA inexistente', async () => {
    repository.findById.mockResolvedValue(null);
    await expect(useCase.execute(99)).rejects.toThrow(NotFoundError);
    expect(repository.hasRelations).not.toHaveBeenCalled();
    expect(repository.delete).not.toHaveBeenCalled();
  });

  it('propaga errores de persistencia sin informar exito', async () => {
    const error = new Error('Database unavailable');
    repository.delete.mockRejectedValue(error);
    await expect(useCase.execute(1)).rejects.toThrow(error);
  });
});
