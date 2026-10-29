import { prepararDocumentos } from './documentos-recuperador';

const pdf = { tipo: 'identificacion', nombre: 'cedula.pdf', contenido: Buffer.from('%PDF-1.4\nDocumento de prueba\n%%EOF').toString('base64') };

describe('documentos escaneados de recuperador', () => {
  it('acepta PDF y conserva referencias propias sin devolver el contenido', () => {
    expect(prepararDocumentos([pdf])[0]).toMatchObject({ tipo: 'identificacion', nombre: 'cedula.pdf', mime: 'application/pdf' });
    expect(prepararDocumentos([{ id: 8 }], [{ id: 8, tipo: 'salud', nombre: 'eps.pdf', mime: 'application/pdf', tamano: 50 }])).toEqual([{ id: 8 }]);
  });

  it('rechaza tipos repetidos, referencias ajenas y archivos que no corresponden a su extensión', () => {
    expect(() => prepararDocumentos([pdf, pdf])).toThrow();
    expect(() => prepararDocumentos([{ id: 99 }])).toThrow();
    expect(() => prepararDocumentos([{ ...pdf, nombre: 'cedula.png' }])).toThrow();
    expect(() => prepararDocumentos([{ ...pdf, nombre: '..\\cedula.pdf' }])).toThrow();
    expect(() => prepararDocumentos([{ ...pdf, contenido: Buffer.alloc(1024 * 1024 + 1).toString('base64') }])).toThrow();
  });
});
