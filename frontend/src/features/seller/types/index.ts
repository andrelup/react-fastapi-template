export interface DashboardMetric {
  label: string;
  value: string;
}

export interface RecentActivityItem {
  id: string;
  title: string;
  status: 'sold' | 'published';
  statusLabel: string;
  timeLabel: string;
  amountLabel: string;
}
