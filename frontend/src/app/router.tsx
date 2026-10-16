import { lazy } from 'react';
import { createBrowserRouter } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { ProtectedRoute, RoleRoute } from '@/features/auth';

const HomePage = lazy(() => import('./pages/HomePage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const RegisterPage = lazy(() => import('./pages/RegisterPage'));
const ItemsPage = lazy(() => import('./pages/ItemsPage'));
const ItemFormPage = lazy(() => import('./pages/ItemFormPage'));
const ItemDetailPage = lazy(() => import('./pages/ItemDetailPage'));
const CollectionsPage = lazy(() => import('./pages/CollectionsPage'));
const CollectionDetailPage = lazy(() => import('./pages/CollectionDetailPage'));
const UiComponentsPage = lazy(() => import('./pages/UiComponentsPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));

export const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      {
        path: '/',
        element: (
          <ProtectedRoute>
            <HomePage />
          </ProtectedRoute>
        ),
      },
      {
        path: '/login',
        element: <LoginPage />,
      },
      {
        path: '/register',
        element: <RegisterPage />,
      },
      {
        path: '/items',
        element: (
          <ProtectedRoute>
            <ItemsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: '/items/nuevo',
        element: (
          <RoleRoute allow={['admin', 'editor']}>
            <ItemFormPage />
          </RoleRoute>
        ),
      },
      {
        path: '/items/:id/editar',
        element: (
          <RoleRoute allow={['admin', 'editor']}>
            <ItemFormPage />
          </RoleRoute>
        ),
      },
      {
        path: '/items/:id',
        element: (
          <ProtectedRoute>
            <ItemDetailPage />
          </ProtectedRoute>
        ),
      },
      {
        path: '/colecciones',
        element: (
          <ProtectedRoute>
            <CollectionsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: '/colecciones/:id',
        element: (
          <ProtectedRoute>
            <CollectionDetailPage />
          </ProtectedRoute>
        ),
      },
      {
        path: '/components-ui',
        element: <UiComponentsPage />,
      },
      {
        path: '*',
        element: <NotFoundPage />,
      },
    ],
  },
]);
