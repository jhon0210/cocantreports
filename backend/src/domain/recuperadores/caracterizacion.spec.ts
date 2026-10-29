import { ValidationError } from '../shared/domain-errors';
import { Caracterizacion, validarCaracterizacion } from './caracterizacion';

const hoy = new Date(Date.UTC(2026, 9, 14));
const base: Caracterizacion = { fecha_inscripcion: '2026-10-14', tipo_documento: 'CC', autoriza_datos: true };

describe('validarCaracterizacion', () => {
  it('normaliza la placa habitual opcional sin crear una placa para quien no la tiene', () => {
    expect(validarCaracterizacion({ ...base, placa_habitual: ' abc123 ' }, hoy, true).placa_habitual).toBe('ABC123');
    expect(validarCaracterizacion(base, hoy, true)).not.toHaveProperty('placa_habitual');
    expect(() => validarCaracterizacion({ ...base, placa_habitual: '<placa>' }, hoy, true)).toThrow('placa habitual');
  });
  it('acepta lo mínimo y no modifica el objeto recibido', () => {
    const entrada = { ...base };
    expect(validarCaracterizacion(entrada, hoy, true)).toEqual(base);
    expect(entrada).toEqual(base);
  });

  it.each([
    [{ fecha_inscripcion: undefined }, 'fecha de inscripción es obligatoria'],
    [{ fecha_inscripcion: '2026-02-30' }, 'no es una fecha válida'],
    [{ fecha_inscripcion: '2026-10-15' }, 'no puede ser futura'],
    [{ tipo_documento: undefined }, 'tipo de documento es obligatorio'],
    [{ fecha_nacimiento: '2026-10-15' }, 'no puede ser futura'],
    [{ fecha_nacimiento: '1890-01-01' }, 'no es válida'],
    [{ tipo_documento: 'Otro' }, 'Especifica el tipo de documento'],
    [{ pertenece_organizacion: true }, 'nombre de la organización'],
    [{ discapacidad: true }, 'tipo de discapacidad'],
    [{ transporte: ['Otro'] }, 'otro medio de transporte'],
    [{ materiales: ['Otros'] }, 'otros materiales'],
    [{ autoriza_datos: false }, 'autorización'],
  ])('rechaza %j', (cambios, mensaje) => {
    expect(() => validarCaracterizacion({ ...base, ...cambios }, hoy, true)).toThrow(ValidationError);
    expect(() => validarCaracterizacion({ ...base, ...cambios }, hoy, true)).toThrow(mensaje);
  });

  it('no exige la autorización al actualizar', () => {
    expect(validarCaracterizacion({ ...base, autoriza_datos: false }, hoy, false).autoriza_datos).toBe(false);
  });

  it('descarta las respuestas dependientes de una opción no elegida', () => {
    const resultado = validarCaracterizacion(
      {
        ...base,
        pertenece_organizacion: false, organizacion_nombre: 'Coop', organizacion_nit: '1',
        discapacidad: false, discapacidad_tipo: 'Visual',
        victima_conflicto: false, ruv: true,
        tipo_documento_otro: 'x',
        transporte: ['Carretilla manual'], transporte_otro: 'x',
        materiales: ['Vidrio'], materiales_otros: 'x',
      },
      hoy,
      true,
    );
    expect(resultado).toEqual({
      ...base,
      pertenece_organizacion: false, discapacidad: false, victima_conflicto: false,
      transporte: ['Carretilla manual'], materiales: ['Vidrio'],
    });
  });

  it('conserva las respuestas dependientes cuando la opción está elegida', () => {
    const completa: Caracterizacion = {
      ...base, tipo_documento: 'Otro', tipo_documento_otro: 'Visa',
      pertenece_organizacion: true, organizacion_nombre: 'Coop', organizacion_nit: '900',
      discapacidad: true, discapacidad_tipo: 'Visual', victima_conflicto: true, ruv: true,
      transporte: ['Otro'], transporte_otro: 'Bicicleta', materiales: ['Otros'], materiales_otros: 'Madera',
    };
    expect(validarCaracterizacion(completa, hoy, true)).toEqual(completa);
  });
});
