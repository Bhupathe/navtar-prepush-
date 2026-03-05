import { useEffect } from "react";
import { useUser } from "@clerk/clerk-react";
import { SUPER_ADMIN_EMAILS } from "../constants/superAdmins";

export default function useRoleAssignment() {
  const { user, isSignedIn, isLoaded } = useUser();

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !user) return;

    const currentRole = user.unsafeMetadata?.role;
    const email = user.primaryEmailAddress?.emailAddress;

    
    if (!currentRole) {
      const role = SUPER_ADMIN_EMAILS.includes(email)
        ? "superadmin"
        : "doctor";

      console.log(`Assigning role: ${role} to ${email}`);

      user
        .update({
          unsafeMetadata: { role },
        })
        .then(() => console.log("✅ Role successfully saved in unsafeMetadata"))
        .catch((err) => console.error("❌ Failed to set role", err));
    }
  }, [user, isSignedIn, isLoaded]);
}
