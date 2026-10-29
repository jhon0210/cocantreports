import { CapturaBalance, FuenteBalance, gramos, resumirBalance, validarCapturaBalance } from './balance.entity';

const captura: CapturaBalance = {
  periodo: '2026-10', id_eca: 1, id_mat: 1, inventario_inicial_kg: 50, salidas_kg: 100,
  rechazos_kg: 10, entradas_cat_kg: 20, entradas_al_guardar_kg: 100,
  soporte_salidas: 'Comprador A; factura F-1', receptor_rechazos: 'Prestador; entrega R-1',
  observaciones: null, id_user: 1, version: 1, actualizado_en: '2026-10-27T00:00:00Z',
};
const fuente: FuenteBalance = {
  id_eca: 1, id_mat: 1, eca: 'ECA', material: 'Carton', codigo: 202,
  entradas_kg: 100, captura, anterior: null,
};

describe('balance mensual', () => {
  it('concilia sin sumar nuevamente CAT y sin descontar una prefactura', () => {
    expect(resumirBalance(fuente).inventario_final_kg).toBe(40);
    expect(() => validarCapturaBalance(captura, fuente)).not.toThrow();
  });

  it('trabaja en gramos para evitar diferencias de punto flotante', () => {
    expect(resumirBalance({ ...fuente, entradas_kg: 0.2, captura: { ...captura, inventario_inicial_kg: 0.1, salidas_kg: 0.3, rechazos_kg: 0, entradas_cat_kg: 0 } }).inventario_final_kg).toBe(0);
  });

  it('mantiene vacios los datos no capturados, sin asumir inventario o rechazos cero', () => {
    const fila = resumirBalance({ ...fuente, captura: null });
    expect(fila.inventario_final_kg).toBeNull();
    expect(fila.novedades.join(' ')).toContain('Falta registrar');
  });

  it.each([
    [{ salidas_kg: 151 }, 'superan'],
    [{ salidas_kg: 1, soporte_salidas: null }, 'facturas'],
    [{ rechazos_kg: 1, receptor_rechazos: null }, 'rechazos'],
    [{ entradas_cat_kg: 101 }, 'CAT'],
    [{ inventario_inicial_kg: -1 }, 'no negativa'],
  ])('rechaza captura inconsistente %j', (cambios, error) => {
    expect(() => validarCapturaBalance({ ...captura, ...cambios }, fuente)).toThrow(error);
  });

  it('exige continuidad con el saldo previo, incluido un mes sin entradas', () => {
    const conAnterior = { ...fuente, anterior: { entradas_kg: 100, captura: { ...captura, periodo: '2026-09' } } };
    expect(resumirBalance(conAnterior).inventario_anterior_kg).toBe(40);
    expect(() => validarCapturaBalance(captura, conAnterior)).toThrow('mes anterior');
    expect(() => validarCapturaBalance({ ...captura, inventario_inicial_kg: 40 }, conAnterior)).not.toThrow();
  });

  it('detecta entradas editadas despues de capturar y saldos negativos sin esconderlos', () => {
    const fila = resumirBalance({ ...fuente, entradas_kg: 0 });
    expect(fila.inventario_final_kg).toBe(-60);
    expect(fila.novedades.join(' ')).toContain('entradas cambiaron');
    expect(fila.novedades.join(' ')).toContain('negativo');
  });

  it('no permite conciliar con un mes previo desactualizado', () => {
    expect(() => validarCapturaBalance(captura, { ...fuente, anterior: { entradas_kg: 101, captura } })).toThrow('guarda primero');
  });

  it.each([NaN, Infinity, -1, 0.1234])('rechaza peso inválido %s', (value) => {
    expect(() => gramos(value)).toThrow();
  });
});
