import { GoogleOAuthProvider } from "@react-oauth/google";
import { useState, useEffect, createContext, useContext } from "react";
import { API_BASE_URL } from "../const";

// Context to signal whether Google OAuth is ready (provider is mounted with valid clientId)
const GoogleAuthReadyContext = createContext(false);

export function useGoogleAuthReady() {
  return useContext(GoogleAuthReadyContext);
}

// Wrapper that fetches Google Client ID from backend (not baked into bundle)
export function GoogleAuthWrapper({ children }: { children: React.ReactNode }) {
  const [clientId, setClientId] = useState<string>("");

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/google-client-id`)
      .then(res => res.json())
      .then(data => {
        if (data?.clientId) setClientId(data.clientId);
      })
      .catch(() => {
        console.warn("[Auth] Could not fetch Google Client ID from backend");
      });
  }, []);

  // Don't mount GoogleOAuthProvider until we have the client ID (it crashes with empty string)
  if (!clientId) {
    return (
      <GoogleAuthReadyContext.Provider value={false}>
        {children}
      </GoogleAuthReadyContext.Provider>
    );
  }

  return (
    <GoogleOAuthProvider clientId={clientId}>
      <GoogleAuthReadyContext.Provider value={true}>
        {children}
      </GoogleAuthReadyContext.Provider>
    </GoogleOAuthProvider>
  );
}
