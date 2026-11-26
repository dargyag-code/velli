import type { ReactNode } from 'react';
import { protegerRutaSoloAdminEnServidor } from '@/lib/organizations/servidor';

export default async function ReportesProtectedLayout({
  children,
}: {
  children: ReactNode;
}) {
  await protegerRutaSoloAdminEnServidor();
  return <>{children}</>;
}
