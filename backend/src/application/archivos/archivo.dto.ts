import { IsIn, IsInt, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
import { USOS_ARCHIVO, UsoArchivo } from '../../domain/archivos/archivo';

export class AutorizarArchivoDto {
  @IsIn(USOS_ARCHIVO)
  uso: UsoArchivo;

  @IsString()
  @MaxLength(150)
  @Matches(/^[^\\/\x00-\x1f\x7f]{1,150}$/)
  nombre: string;

  @IsIn(['application/pdf', 'image/png', 'image/jpeg'])
  mime: string;

  @IsInt()
  @Min(8)
  @Max(2 * 1024 * 1024)
  tamano: number;

  @IsString()
  @Matches(/^[A-Za-z0-9+/]{43}=$/)
  sha256: string;
}
