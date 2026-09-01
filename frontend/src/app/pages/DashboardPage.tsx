import { SellerDashboard } from '@/features/seller';

/** Example protected page, only reachable when the user is authenticated. */
const DashboardPage = () => <SellerDashboard />;

// Default export required for React.lazy().
export default DashboardPage;
