import React, { createContext, useState, useContext, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [appPublicSettings] = useState({ id: 'collegecart', public_settings: {} });
  
  // Prevent concurrent profile loads
  const loadingProfileRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    let subscription = null;

    const initAuth = async () => {
      await checkSession();

      // Set up auth state listener
      const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (!mountedRef.current) return;

        if (event === 'SIGNED_IN' && session?.user) {
          await loadUserProfile(session.user);
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
          setIsAuthenticated(false);
        } else if (event === 'TOKEN_REFRESHED' && session?.user) {
          // Don't reload profile on token refresh if we already have user data
          if (!user) {
            await loadUserProfile(session.user);
          }
        }
      });

      subscription = authListener.subscription;
    };

    initAuth();

    return () => {
      mountedRef.current = false;
      loadingProfileRef.current = false;
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, []);

  const checkSession = async () => {
    if (!mountedRef.current) return;
    
    try {
      setIsLoadingAuth(true);
      
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) throw error;
      
      if (session?.user && mountedRef.current) {
        await loadUserProfile(session.user);
      } else if (mountedRef.current) {
        setIsAuthenticated(false);
      }
    } catch (error) {
      console.error('Session check failed:', error);
      if (mountedRef.current) {
        setIsAuthenticated(false);
        setUser(null);
      }
    } finally {
      if (mountedRef.current) {
        setIsLoadingAuth(false);
      }
    }
  };

  const loadUserProfile = async (authUser) => {
    // Prevent concurrent loads
    if (loadingProfileRef.current || !mountedRef.current) return;
    
    loadingProfileRef.current = true;
    
    try {
      const { data: profile, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', authUser.id)
        .single();

      if (!mountedRef.current) return;

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      let finalProfile = profile;

      if (!profile) {
        // Auto-create profile on first login
        const phone = authUser.phone || authUser.user_metadata?.phone || null;
        const email = authUser.email || null;
        const newProfile = {
          id: authUser.id,
          email,
          phone,
          phone_number: phone,
          full_name: authUser.user_metadata?.full_name || '',
          role: 'customer',
        };
        
        const { data: created, error: insertError } = await supabase
          .from('users')
          .insert(newProfile)
          .select()
          .single();
          
        if (!mountedRef.current) return;
        
        if (insertError) {
          console.error('Failed to create profile:', insertError);
          finalProfile = newProfile;
        } else {
          finalProfile = created;
        }
      } else {
        // Sync phone from auth if missing in profile
        const authPhone = authUser.phone || null;
        if (authPhone && !profile.phone) {
          // Fire and forget - don't wait for this
          supabase
            .from('users')
            .update({ phone: authPhone, phone_number: authPhone })
            .eq('id', authUser.id)
            .then(() => {})
            .catch(() => {});
          finalProfile = { ...profile, phone: authPhone, phone_number: authPhone };
        }
      }

      if (mountedRef.current) {
        setUser({ ...finalProfile, created_date: finalProfile?.created_at });
        setIsAuthenticated(true);
        setAuthError(null);
      }
    } catch (error) {
      console.error('Failed to load user profile:', error);
      if (mountedRef.current) {
        // Fallback to basic auth user data
        setUser({ id: authUser.id, email: authUser.email, phone: authUser.phone, role: 'customer' });
        setIsAuthenticated(true);
      }
    } finally {
      loadingProfileRef.current = false;
    }
  };

  const logout = async (shouldRedirect = true) => {
    await supabase.auth.signOut();
    setUser(null);
    setIsAuthenticated(false);
    if (shouldRedirect) {
      // Use window.history.pushState to avoid full page reload
      window.history.pushState({}, '', '/');
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  };

  const navigateToLogin = () => {
    // Use window.history.pushState to avoid full page reload
    window.history.pushState({}, '', '/login');
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated,
      isLoadingAuth,
      isLoadingPublicSettings,
      authError,
      appPublicSettings,
      logout,
      navigateToLogin,
      checkAppState: checkSession,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
