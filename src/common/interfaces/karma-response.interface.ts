export interface IKarmaResponse {
  status: string;
  message: string;
  data?: {
    karma_identity: string;
    amount_in_contention: string;
    reason: string;
    default_date: string;
    karma_type: string;
    karma_identity_type: string;
    reporting_entity: Record<string, unknown>;
  };
  meta?: Record<string, unknown>;
}
