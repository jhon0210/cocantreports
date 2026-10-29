import { BalanceMasasUseCases } from './balance.use-cases';
import { GuardarBalanceDto } from './balance.dto';

const dto: GuardarBalanceDto = {
  periodo: '2026-10', id_eca: 1, id_mat: 1, inventario_inicial_kg: 20, salidas_kg: 0, rechazos_kg: 0,
  entradas_esperadas_kg: 0, mediciones_confirmadas: true, version: null,
};

describe('BalanceMasasUseCases', () => {
  const balances = { consultar: jest.fn(), guardar: jest.fn() };
  const ecas = { list: jest.fn(), findById: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn(), hasRelations: jest.fn(), findAdjunto: jest.fn() };
  const materiales = { list: jest.fn(), findById: jest.fn() };
  const useCases = new BalanceMasasUseCases(balances, ecas, materiales, {
    today: () => new Date('2026-10-27'), now: () => new Date('2026-10-27T12:00:00Z'),
  });
  beforeEach(() => {
    jest.clearAllMocks();
    balances.consultar.mockResolvedValue([]);
    balances.guardar.mockResolvedValue(undefined);
    ecas.findById.mockResolvedValue({ id: 1, nombre: 'ECA' });
    materiales.findById.mockResolvedValue({ id: 1, nombre: 'Carton', codigo: 202 });
  });

  it('permite declarar inventario inicial para un material sin entradas', async () => {
    await useCases.guardar(dto, 9);
    expect(balances.guardar).toHaveBeenCalledWith(expect.objectContaining({ inventario_inicial_kg: 20, entradas_al_guardar_kg: 0, entradas_cat_kg: null, id_user: 9 }));
  });

  it.each(['2026-13', '2026-11', '0000-01'])('rechaza periodo inválido o futuro %s', async (periodo) => {
    await expect(useCases.consultar({ periodo })).rejects.toThrow();
  });

  it('rechaza entradas cambiadas y no guarda una captura obsoleta', async () => {
    await expect(useCases.guardar({ ...dto, entradas_esperadas_kg: 1 }, 9)).rejects.toThrow('entradas cambiaron');
    expect(balances.guardar).not.toHaveBeenCalled();
  });

  it('exige confirmar las mediciones', async () => {
    await expect(useCases.guardar({ ...dto, mediciones_confirmadas: false }, 9)).rejects.toThrow('Confirma');
  });

  it('rechaza referencias inexistentes', async () => {
    ecas.findById.mockResolvedValue(null);
    await expect(useCases.guardar(dto, 9)).rejects.toThrow('ECA no existe');
  });
});
