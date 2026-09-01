import { Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import { useAuth } from '@/features/auth';
import { Spinner } from '@/components/ui/Spinner';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { PageContainer } from '@/components/layout/PageContainer';
import { Sidebar } from '@/components/layout/Sidebar';
import { MobileTabBar } from '@/components/layout/MobileTabBar';

export const Layout = () => {
  const { token } = useAuth();

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <div className="flex min-h-0 flex-1">
        {token && <Sidebar className="hidden md:flex" />}
        <div className="flex min-w-0 flex-1 flex-col">
          <PageContainer>
            <Suspense
              fallback={
                <div className="flex h-full items-center justify-center">
                  <Spinner />
                </div>
              }
            >
              <Outlet />
            </Suspense>
          </PageContainer>
          {/*
            When logged in, the fixed `MobileTabBar` owns the bottom of the
            viewport on mobile, so the footer would sit hidden behind it —
            hide it there (same `hidden md:flex` pattern as `Sidebar`). On
            auth screens (no token, no tab bar) the footer stays visible.
          */}
          <Footer className={token ? 'hidden md:flex' : ''} />
        </div>
      </div>
      {token && <MobileTabBar />}
    </div>
  );
};
