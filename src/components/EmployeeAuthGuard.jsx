import React from 'react';
import { Navigate, useLocation, useParams } from 'react-router-dom';
import { useEmployeeAuth } from '@/contexts/EmployeeAuthContext';

export default function EmployeeAuthGuard({ children }) {
  const { employee, loading } = useEmployeeAuth();
  const location = useLocation();
  const { employeeSlug } = useParams();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!employee) {
    // Redirect to employee login, preserving the intended destination
    return <Navigate to="/employee/login" state={{ from: location }} replace />;
  }

  // Validate that the slug in URL matches the logged-in employee's slug
  if (employeeSlug && employee.slug !== employeeSlug) {
    // Redirect to correct employee slug
    return <Navigate to={`/employee/${employee.slug}/dashboard`} replace />;
  }

  return children;
}

