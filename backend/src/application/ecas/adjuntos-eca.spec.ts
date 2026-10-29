import { ValidationError } from '../../domain/shared/domain-errors';
import { MAX_PDF_BYTES, prepararAdjuntos, validarPdf } from './adjuntos-eca';

function pdf(size: number): string {
  const bytes = Buffer.alloc(size, 32);
  bytes.write('%PDF-1.7\n');
  bytes.write('\n%%EOF', size - 6);
  return bytes.toString('base64');
}

describe('Adjuntos PDF de ECA', () => {
  it('acepta exactamente 2 MB y conserva los bytes sin usar expresiones regulares recursivas', () => {
    const contenido = pdf(MAX_PDF_BYTES);
    const result = validarPdf({ nombre: 'Documento.pdf', contenido });
    expect(result.contenido.length).toBe(MAX_PDF_BYTES);
    expect(Buffer.from(result.contenido).toString('base64')).toBe(contenido);
  });

  it('rechaza más de 2 MB, contenido no PDF, base64 inválido y nombres inválidos', () => {
    for (const dto of [
      { nombre: 'grande.pdf', contenido: pdf(MAX_PDF_BYTES + 1) },
      { nombre: 'texto.pdf', contenido: Buffer.from('texto de prueba').toString('base64') },
      { nombre: 'invalido.pdf', contenido: '%%%PDF' },
      { nombre: '../archivo.pdf', contenido: pdf(32) },
      { nombre: 'archivo.exe', contenido: pdf(32) },
      { nombre: 'incompleto.pdf', contenido: Buffer.from('%PDF-1.7 sin fin').toString('base64') },
    ]) expect(() => validarPdf(dto)).toThrow(ValidationError);
  });

  it('permite cinco PDF pero no seis', () => {
    const dto = { nombre: 'archivo.pdf', contenido: pdf(32) };
    expect(prepararAdjuntos(Array.from({ length: 5 }, () => dto))).toHaveLength(5);
    expect(() => prepararAdjuntos(Array.from({ length: 6 }, () => dto))).toThrow(ValidationError);
  });

  it('solo conserva referencias únicas de la ECA, sin contenido ni nombre adicional', () => {
    const existentes = [{ id: 1, nombre: 'archivo.pdf', tamano: 32 }];
    expect(prepararAdjuntos([{ id: 1 }], existentes)).toEqual([{ id: 1 }]);
    expect(() => prepararAdjuntos([{ id: 2 }], existentes)).toThrow(ValidationError);
    expect(() => prepararAdjuntos([{ id: 1 }, { id: 1 }], existentes)).toThrow(ValidationError);
    expect(() => prepararAdjuntos([{ id: 1, nombre: 'otro.pdf' }], existentes)).toThrow(ValidationError);
  });
});
