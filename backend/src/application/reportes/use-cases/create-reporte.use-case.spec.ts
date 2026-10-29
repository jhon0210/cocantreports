import { NotFoundError, ValidationError } from '../../../domain/shared/domain-errors';
import { NuevoReporte, Reporte, calcularSubtotal } from '../../../domain/reportes/reporte.entity';
import { Recuperador } from '../../../domain/recuperadores/recuperador.entity';
import { AuthenticatedUser } from '../../shared/authenticated-user';
import { CreateReporteUseCase } from './create-reporte.use-case';

const actor: AuthenticatedUser = { id: 7, usuario: 'operario1', nombre: 'Olga', apellido: 'Op', idPerfil: 3, perfil: 'Operario', idEca: null };
const hoy = new Date(Date.UTC(2026, 9, 14));

const recuperador: Recuperador = {
  id: 10,
  nombre: 'Juan',
  apellido: 'Pérez',
  cedula: '1090000001',
  bancarizado: true,
  foto: null,
  tieneFoto: false,
  codigoRegistro: null,
  caracterizacion: null,
  fechaRegistro: hoy,
  idEstado: 1,
  estado: { id: 1, nombre: 'Activo' },
};

function build(overrides: { recuperador?: Recuperador | null; material?: boolean; eca?: boolean } = {}) {
  const creados: NuevoReporte[] = [];
  const reportes = {
    create: jest.fn(async (n: NuevoReporte): Promise<Reporte> => {
      creados.push(n);
      return {
        consecutivo: 1,
        numeroReporte: 1,
        idMat: n.idMat,
        material: { codigo: 101, nombre: 'Cartón' },
        cantidad: n.cantidad,
        valor: n.valor,
        subtotal: calcularSubtotal(n.cantidad, n.valor),
        idUser: n.idUser,
        usuario: { nombre: 'Olga', apellido: 'Op', usuario: 'operario1' },
        idEca: n.idEca,
        eca: { nombre: 'ECA', direccion: 'Calle 1', comuna: 'C1' },
        idRecuperador: n.idRecuperador,
        recuperador: { nombre: 'Juan', apellido: 'Pérez', cedula: '1090000001' },
        fechaRegistro: n.fechaRegistro,
        fechaVenta: n.fechaVenta,
      };
    }),
    findById: jest.fn(),
    list: jest.fn(),
    createBatch: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    findComprobante: jest.fn(),
  };
  const materiales = { list: jest.fn(), findById: jest.fn(async () => (overrides.material === false ? null : { id: 2, codigo: 101, nombre: 'Cartón' })) };
  const recuperadores = {
    list: jest.fn(),
    findByCedula: jest.fn(),
    findByCodigoRegistro: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    hasReportes: jest.fn(),
    findDocumento: jest.fn(),
    findById: jest.fn(async () => (overrides.recuperador === undefined ? recuperador : overrides.recuperador)),
  };
  const ecas = {
    findAdjunto: jest.fn(),
    list: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    hasRelations: jest.fn(),
    findById: jest.fn(async () =>
      overrides.eca === false
        ? null
        : { id: 4, nombre: 'ECA', direccion: 'Calle 1', comuna: 'C1', estado: 'Activa', categoria: 'A', ruta: 'R', macroruta: 'M', representante: null, codigoNuec: null, adjuntos: [] },
    ),
  };
  const clock = { now: () => new Date(), today: () => hoy };
  return { useCase: new CreateReporteUseCase(reportes, materiales, recuperadores, ecas, clock), creados, reportes };
}

const dto = { id_recuperador: 10, id_mat: 2, id_eca: 4, cantidad: 12.5, valor: 800 };

describe('CreateReporteUseCase', () => {
  it('valida todo el lote antes de persistir', async () => {
    const { useCase, reportes } = build();
    await expect(useCase.executeBatch(actor, [dto, { ...dto, valor: -1 }])).rejects.toBeInstanceOf(ValidationError);
    expect(reportes.createBatch).not.toHaveBeenCalled();
    expect(reportes.create).not.toHaveBeenCalled();
  });

  it('rechaza lotes vacios', async () => {
    const { useCase, reportes } = build();
    await expect(useCase.executeBatch(actor, [])).rejects.toBeInstanceOf(ValidationError);
    expect(reportes.createBatch).not.toHaveBeenCalled();
  });
  it('toma id_user del actor, la ECA elegida y las fechas del servidor', async () => {
    const { useCase, creados } = build();
    const res = await useCase.execute(actor, dto);
    expect(creados[0]).toMatchObject({ idUser: 7, idEca: 4, idRecuperador: 10, fechaRegistro: hoy, fechaVenta: hoy });
    expect(res).toMatchObject({ consecutivo: 1, id_user: 7, id_eca: 4, subtotal: 10000, FechaVenta: '2026-10-14', FechaRegistro: '2026-10-14' });
  });

  it('falla si la ECA elegida no existe', async () => {
    const { useCase, reportes } = build({ eca: false });
    await expect(useCase.execute(actor, dto)).rejects.toBeInstanceOf(NotFoundError);
    expect(reportes.create).not.toHaveBeenCalled();
  });
  it('rechaza ventas de un recuperador Inactivo o Fallecido', async () => {
    for (const [id, nombre] of [[2, 'Inactivo'], [3, 'Fallecido']] as const) {
      const { useCase, reportes } = build({ recuperador: { ...recuperador, idEstado: id, estado: { id, nombre } } });
      await expect(useCase.execute(actor, dto)).rejects.toThrow(new RegExp(nombre));
      expect(reportes.create).not.toHaveBeenCalled();
    }
  });

  it('falla si el recuperador o el material no existen', async () => {
    await expect(build({ recuperador: null }).useCase.execute(actor, dto)).rejects.toBeInstanceOf(NotFoundError);
    await expect(build({ material: false }).useCase.execute(actor, dto)).rejects.toBeInstanceOf(NotFoundError);
  });

  it('valida la fecha de venta (formato, existencia y no futura)', async () => {
    const { useCase } = build();
    await expect(useCase.execute(actor, { ...dto, FechaVenta: '2026-10-15' })).rejects.toBeInstanceOf(ValidationError);
    await expect(useCase.execute(actor, { ...dto, FechaVenta: '2026-02-30' })).rejects.toBeInstanceOf(ValidationError);
    await expect(useCase.execute(actor, { ...dto, FechaVenta: '2026-10-01' })).resolves.toMatchObject({ FechaVenta: '2026-10-01' });
  });

  it('acepta cero kg y rechaza cantidades negativas y valores inválidos', async () => {
    const { useCase } = build();
    await expect(useCase.execute(actor, { ...dto, cantidad: 0 })).resolves.toMatchObject({ cantidad: 0, subtotal: 0 });
    await expect(useCase.execute(actor, { ...dto, cantidad: -1 })).rejects.toBeInstanceOf(ValidationError);
    await expect(useCase.execute(actor, { ...dto, valor: -5 })).rejects.toBeInstanceOf(ValidationError);
    await expect(useCase.execute(actor, { ...dto, valor: 10.5 })).rejects.toBeInstanceOf(ValidationError);
  });
});

describe('calcularSubtotal', () => {
  it('redondea a pesos', () => {
    expect(calcularSubtotal(2.5, 1001)).toBe(2503);
    expect(calcularSubtotal(0.333, 1000)).toBe(333);
  });
});
