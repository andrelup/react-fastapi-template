import type { ReactNode } from 'react';

interface PageContainerProps {
  children: ReactNode;
}

export const PageContainer = ({ children }: PageContainerProps) => (
  <main className="flex-1 overflow-auto bg-bg p-11 pb-[84px] md:pb-11">
    <div className="mx-auto h-full w-full max-w-5xl">{children}</div>
  </main>
);
