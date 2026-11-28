import type { ReactNode } from 'react';
import { protegerRutaSoloAdminEnServidor } from '@/lib/organizations/servidor';

export default async function VitrinaProtectedLayout({
  children,
}: {
  children: ReactNode;
}) {
  await protegerRutaSoloAdminEnServidor();
  return <>{children}</>;
}
