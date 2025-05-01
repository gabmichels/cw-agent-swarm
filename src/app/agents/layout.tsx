import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Agent Monitor - Crowd Wisdom',
  description: 'Real-time monitoring dashboard for agent activities',
};

export default function AgentsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <section>
      {children}
    </section>
  );
} 