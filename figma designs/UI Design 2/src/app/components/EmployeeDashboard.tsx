import EmployeeProfile from './EmployeeProfile';

export default function EmployeeDashboard() {
  // Employee viewing their own dashboard
  return <EmployeeProfile isOwnProfile={true} />;
}
