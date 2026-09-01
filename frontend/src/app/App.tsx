import { RouterProvider } from 'react-router-dom';
import { AppProviders } from './providers';
import { router } from './router';

/** Root application component: wires providers and the router. */
export const App = () => (
  <AppProviders>
    <RouterProvider router={router} />
  </AppProviders>
);
