import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class VerificationService {
  private readonly axiosInstance;

  constructor(private configService: ConfigService) {
    this.axiosInstance = axios.create({
      baseURL: 'https://adjutor.lendsqr.com/v2/verification',
      headers: {
        Authorization: `Bearer ${this.configService.get<string>('ADJUTOR_API_KEY')}`,
      },
    });
  }

  async checkKarma(identity: string): Promise<any> {
    try {
      const { data } = await this.axiosInstance.get(`/karma/${identity}`);
      return data;
    } catch (error: any) {
      return error.response?.data || { status: 'error' };
    }
  }
}
