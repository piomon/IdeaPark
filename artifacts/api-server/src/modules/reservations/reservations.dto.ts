import { IsISO8601, IsString } from 'class-validator';

export class CreateReservationDto {
  @IsString()
  spaceId!: string;

  @IsString()
  vehicleId!: string;

  @IsISO8601()
  startsAt!: string;

  @IsISO8601()
  endsAt!: string;
}
