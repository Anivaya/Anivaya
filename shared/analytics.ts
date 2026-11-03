export interface Ratio {
  count: number;
  total: number;
}
export interface AdminAnalytics {
  available: boolean;
  asOf: string;
  zones: string[];
  channels: string[];
  activation: Ratio;
  active: Ratio;
  retention: Ratio[];
  cohorts: {
    month: string;
    households: number;
    activation: Ratio;
    retention: Ratio[];
  }[];
}
