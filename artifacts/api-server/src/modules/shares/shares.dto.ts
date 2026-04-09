import { IsISO8601, IsString } from 'class-validator';

export class CreateShareDto {
  @IsString()
  spaceId!: string;

  @IsISO8601()
  startsAt!: string;

  @IsISO8601()
  endsAt!: string;
}
