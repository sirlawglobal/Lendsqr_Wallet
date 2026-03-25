import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import { IKarmaResponse } from '../common/interfaces';

@Injectable()
export class VerificationService {
  private readonly axiosInstance: AxiosInstance;

  constructor(private readonly configService: ConfigService) {
    this.axiosInstance = axios.create({
      baseURL: 'https://adjutor.lendsqr.com/v2/verification',
      headers: {
        Authorization: `Bearer ${this.configService.get<string>('ADJUTOR_API_KEY')}`,
      },
    });
  }

  async checkKarma(identity: string): Promise<IKarmaResponse> {
    try {
      const { data } = await this.axiosInstance.get<IKarmaResponse>(`/karma/${identity}`);
      return data;
    } catch (error: unknown) {
      if (axios.isAxiosError(error) && error.response?.data) {
        return error.response.data as IKarmaResponse;
      }
      return { status: 'error', message: 'Karma verification service unavailable' };
    }
  }
}
