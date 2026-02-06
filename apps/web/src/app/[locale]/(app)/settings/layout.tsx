import * as React from 'react';
import { SettingsSidebar } from '@/components/settings-sidebar';

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-full">
      <SettingsSidebar />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}

