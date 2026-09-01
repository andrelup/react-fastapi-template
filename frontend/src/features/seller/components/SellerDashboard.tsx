import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { useAuth } from '@/features/auth';
import type { DashboardMetric, RecentActivityItem } from '../types';

const metrics: DashboardMetric[] = [
  { label: 'Libros publicados', value: '12' },
  { label: 'Ventas del mes', value: '€248' },
  { label: 'Pedidos pendientes', value: '3' },
];

const activity: RecentActivityItem[] = [
  {
    id: '1',
    title: 'El nombre de la rosa',
    status: 'sold',
    statusLabel: 'Vendido',
    timeLabel: 'hace 2 días',
    amountLabel: '€14,00',
  },
  {
    id: '2',
    title: 'Cien años de soledad',
    status: 'published',
    statusLabel: 'Publicado',
    timeLabel: 'hace 4 días',
    amountLabel: '€9,50',
  },
];

/** Seller dashboard: metrics overview plus recent activity. */
export const SellerDashboard = () => {
  const { user } = useAuth();

  return (
    <>
      <h1 className="font-serif text-2xl font-bold text-ink md:text-[30px]">Dashboard</h1>
      <p className="mt-2 text-sm text-body">
        {user ? `Sesión iniciada como ${user.email}` : 'Cargando usuario...'}
      </p>

      <div className="mt-6 grid grid-cols-1 gap-2.5 md:mt-7 md:grid-cols-3 md:gap-4">
        {metrics.map((metric) => (
          <Card key={metric.label}>
            <div className="flex items-center justify-between md:flex-col md:items-start md:gap-1.5">
              <span className="text-[13px] text-muted">{metric.label}</span>
              <span className="font-serif text-[22px] font-bold text-ink md:text-[30px]">
                {metric.value}
              </span>
            </div>
          </Card>
        ))}
      </div>

      <Card className="mt-6 hidden md:mt-7 md:block">
        <h2 className="text-[15px] font-semibold text-ink">Actividad reciente</h2>
        <div className="mt-4 flex flex-col gap-3">
          {activity.map((item, index) => (
            <div key={item.id}>
              <div className="flex items-center gap-3">
                <div className="h-14 w-10 flex-none rounded bg-primary-100" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-ink">{item.title}</p>
                  <p className="mt-1 text-[13px] text-muted">
                    <Badge>{item.statusLabel}</Badge> · {item.timeLabel}
                  </p>
                </div>
                <span className="font-semibold text-primary-dark">{item.amountLabel}</span>
              </div>
              {index < activity.length - 1 && <div className="mt-3 h-px bg-border" />}
            </div>
          ))}
        </div>
      </Card>
    </>
  );
};
