import { IsString } from 'class-validator';

export class OpenGateDto {
  @IsString()
  gateName!: string;
}
