import { IsOptional, IsEnum, IsInt, Min, IsDateString, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export enum TransactionType {
  CREDIT = 'credit',
  DEBIT = 'debit',
}

export class TransactionQueryDto {
  @IsOptional()
  @IsEnum(TransactionType)
  type?: TransactionType;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 10;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsString()
  reference?: string;
}
