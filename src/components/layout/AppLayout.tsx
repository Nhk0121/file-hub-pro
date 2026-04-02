import { Outlet } from 'react-router-dom';
import AppSidebar from './AppSidebar';
import SecurityNoticeDialog from '@/components/SecurityNoticeDialog';

const AppLayout = () => {
  return (
    <div className="flex h-screen overflow-hidden">
      <AppSidebar />
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
      <SecurityNoticeDialog />
    </div>
  );
};

export default AppLayout;
