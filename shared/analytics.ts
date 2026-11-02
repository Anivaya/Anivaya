export interface Ratio {
  count: number;
  total: number;
}
export interface AdminAnalytics {
  source: "installation" | "maquette";
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
