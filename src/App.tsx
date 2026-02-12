import { Outlet } from 'react-router-dom';
import { AppShell } from '@/layouts/AppShell';

export default function App() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
