import type { ReactNode } from 'react';

export default function CopilotLayout({ children }: { children: ReactNode }) {
  return <div className="h-full">{children}</div>;
}
