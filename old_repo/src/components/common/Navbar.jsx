import { useNavigate } from 'react-router-dom';
import './Navbar.css';
import {
  useUser,
  SignedIn,
  SignedOut,
  UserButton
} from '@clerk/clerk-react';

function Navbar() {
  const { user } = useUser();
  const navigate = useNavigate();
  const role = user?.unsafeMetadata?.role;

  return (
    <nav className="navbar">
      <div className="navbar-container">
       
        <div className="navbar-logo" onClick={() => navigate('/')}>
          <span className="logo-text">Navatar</span>
        </div>

        <SignedIn>
          <div className="navbar-user">
            <span className="user-welcome">
              Welcome, {role === 'superadmin' ? 'Admin' : `Dr. ${user?.firstName}`}
            </span>

           
            {role === 'superadmin' && (
              <button
                className="btn btn-admin btn-sm"
                onClick={() => navigate('/admin')}
              >
                Admin Panel
              </button>
            )}

           
            <UserButton />
          </div>
        </SignedIn>

        
        <SignedOut>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => navigate('/login')}
          >
            Login
          </button>
        </SignedOut>
      </div>
    </nav>
  );
}

export default Navbar;
