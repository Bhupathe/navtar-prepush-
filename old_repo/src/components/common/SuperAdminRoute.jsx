import { useUser } from '@clerk/clerk-react';
import { Navigate } from 'react-router-dom';

const SuperAdminRoute = ({ children }) => {
  const { isLoaded, isSignedIn, user } = useUser();

  if (!isLoaded) return <div>Loading...</div>;
  if (!isSignedIn) return <Navigate to="/login" replace />;
  if (user.unsafeMetadata?.role !== 'superadmin') return <Navigate to="/" replace />;

  return children;
};

export default SuperAdminRoute;
