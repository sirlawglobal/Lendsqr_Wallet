import { IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class FundDto {
  @IsNumber()
  @Min(1)
  amount: number;

  @IsString()
  @IsOptional()
  reference?: string;
}
