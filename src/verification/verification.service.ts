import { Injectable, Inject, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Knex } from 'knex';
import { KNEX_CONNECTION } from '../database/database.module';
import axios, { AxiosInstance } from 'axios';
import { IKarmaResponse } from '../common/interfaces';

@Injectable()
export class VerificationService {
  private readonly logger = new Logger(VerificationService.name);
  private readonly axiosInstance: AxiosInstance;

  constructor(
    private readonly configService: ConfigService,
    @Inject(KNEX_CONNECTION) private readonly knex: Knex,
  ) {
    this.axiosInstance = axios.create({
      baseURL: 'https://adjutor.lendsqr.com/v2/verification',
      headers: {
        Authorization: `Bearer ${this.configService.get<string>('ADJUTOR_API_KEY')}`,
      },
    });
  }

  async checkKarma(identity: string): Promise<IKarmaResponse> {
    // 1. Check local blacklist first
    const isBlacklistedLocal = await this.knex('blacklisted_identities')
      .where({ identity })
      .first();

    if (isBlacklistedLocal) {
      this.logger.log(`Local blacklist hit for identity: ${identity}`);
      return {
        status: 'success',
        message: 'Successful',
        data: {
          karma_identity: identity,
          amount_in_contention: '0',
          reason: isBlacklistedLocal.reason || 'Local Blacklist',
          default_date: new Date().toISOString(),
          karma_type: 'identity',
          karma_identity_type: 'identity',
          reporting_entity: {}
        }
      };
    }

    this.logger.log(`Checking external Karma API for identity: ${identity}`);
    try {
      const { data } = await this.axiosInstance.get<IKarmaResponse>(`/karma/${identity}`);

      // If the API says it was successful, that means they are blacklisted!
      if (data && data.status === 'success' && data.message === 'Successful') {
        try {
          await this.knex('blacklisted_identities').insert({
            id: require('@paralleldrive/cuid2').createId(),
            identity: identity,
            reason: data.data?.reason || 'Blacklisted by Adjutor Karma API'
          });
        } catch (insertError) {
          this.logger.warn(`Failed to insert into local blacklist (maybe duplicate): ${insertError}`);
        }
      }

      return data;
    } catch (error: unknown) {
      if (axios.isAxiosError(error) && error.response?.data) {
        const errorData = error.response.data as IKarmaResponse;
        return errorData;
      }
      return { status: 'error', message: 'Karma verification service unavailable' };
    }
  }
}
