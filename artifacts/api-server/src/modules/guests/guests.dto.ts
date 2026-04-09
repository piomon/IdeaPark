import { IsISO8601, IsString, MinLength } from 'class-validator';

export class CreateGuestDto {
  @IsString()
  @MinLength(2)
  guestName!: string;

  @IsString()
  @MinLength(4)
  plate!: string;

  @IsISO8601()
  validFrom!: string;

  @IsISO8601()
  validTo!: string;
}
