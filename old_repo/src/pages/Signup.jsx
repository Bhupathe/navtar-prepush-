import { SignUp } from '@clerk/clerk-react';

function Signup() {
  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-card">
          <SignUp 
            signInUrl="/login"
            forceRedirectUrl={"/landingpage"} 
          />
        </div>
      </div>
    </div>
  );
}

export default Signup;
