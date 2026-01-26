
import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { DashboardProvider } from './contexts/DashboardContext';
import { Layout } from './components/ui/Layout';
import { Dashboard } from './components/pages/Dashboard';
import { InputPlan } from './components/pages/InputPlan';
import { InputActual } from './components/pages/InputActual';
import { ProductionLog } from './components/pages/ProductionLog';
import { ActivityLog } from './components/pages/ActivityLog';
import { UserManagement } from './components/pages/UserManagement';
import { ProcessAnalytics } from './components/pages/ProcessAnalytics';

const App: React.FC = () => {
  return (
    <HashRouter>
      <AuthProvider>
        <DashboardProvider>
          <Routes>
            <Route path="/" element={<Layout><Dashboard /></Layout>} />
            <Route path="/plan" element={<Layout><InputPlan /></Layout>} />
            <Route path="/actual" element={<Layout><InputActual /></Layout>} />
            <Route path="/reports" element={<Layout><ProductionLog /></Layout>} />
            <Route path="/process-analytics" element={<Layout><ProcessAnalytics /></Layout>} />
            <Route path="/logs" element={<Layout><ActivityLog /></Layout>} />
            <Route path="/users" element={<Layout><UserManagement /></Layout>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </DashboardProvider>
      </AuthProvider>
    </HashRouter>
  );
};

export default App;
