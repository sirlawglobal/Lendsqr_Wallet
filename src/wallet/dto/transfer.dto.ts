import { IsEmail, IsNotEmpty, IsNumber, Min } from 'class-validator';

export class TransferDto {
  @IsEmail()
  recipientEmail: string;

  @IsNumber()
  @Min(1)
  amount: number;
}
