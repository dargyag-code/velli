import type { ReactNode } from 'react';
import { protegerRutaSoloAdminEnServidor } from '@/lib/organizations/servidor';

export default async function PlanesProtectedLayout({
  children,
}: {
  children: ReactNode;
}) {
  await protegerRutaSoloAdminEnServidor();
  return <>{children}</>;
}
