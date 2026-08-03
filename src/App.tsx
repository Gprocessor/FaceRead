import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Login } from '@/pages/Login';
import { Dashboard } from '@/pages/Dashboard';
import { Employees } from '@/pages/Employees';
import { FaceEnrollment } from '@/pages/FaceEnrollment';
import { AttendanceCheckIn } from '@/pages/AttendanceCheckIn';
import { AttendanceHistory } from '@/pages/AttendanceHistory';
import { Reports } from '@/pages/Reports';
import { AuditLogs } from '@/pages/AuditLogs';
import { Settings } from '@/pages/Settings';
import { AdminLayout } from '@/components/AdminLayout';
import { ProtectedRoute } from '@/components/ProtectedRoute';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          element={
            <ProtectedRoute>
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/dashboard" element={<Dashboard />} />
          <Route
            path="/employees"
            element={
              <ProtectedRoute allowedRoles={['super_admin', 'org_admin', 'hr_officer']}>
                <Employees />
              </ProtectedRoute>
            }
          />
          <Route
            path="/face-enrollment"
            element={
              <ProtectedRoute allowedRoles={['super_admin', 'org_admin', 'hr_officer']}>
                <FaceEnrollment />
              </ProtectedRoute>
            }
          />
          <Route path="/attendance" element={<AttendanceCheckIn />} />
          <Route path="/attendance/history" element={<AttendanceHistory />} />
          <Route
            path="/reports"
            element={
              <ProtectedRoute allowedRoles={['super_admin', 'org_admin', 'hr_officer', 'supervisor']}>
                <Reports />
              </ProtectedRoute>
            }
          />
          <Route
            path="/audit-logs"
            element={
              <ProtectedRoute allowedRoles={['super_admin', 'org_admin', 'hr_officer']}>
                <AuditLogs />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute allowedRoles={['super_admin', 'org_admin']}>
                <Settings />
              </ProtectedRoute>
            }
          />
        </Route>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
