import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import bcrypt from 'bcryptjs';

const EmployeeAuthContext = createContext();

export const useEmployeeAuth = () => {
  const context = useContext(EmployeeAuthContext);
  if (!context) {
    throw new Error('useEmployeeAuth must be used within EmployeeAuthProvider');
  }
  return context;
};

export const EmployeeAuthProvider = ({ children }) => {
  const [employee, setEmployee] = useState(null);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);

  useEffect(() => {
    checkSession();
  }, []);

  const checkSession = async () => {
    try {
      const sessionToken = localStorage.getItem('employee_session_token');
      if (!sessionToken) {
        setLoading(false);
        return;
      }

      // Verify session
      const { data: sessionData, error: sessionError } = await supabase
        .from('employee_sessions')
        .select(`
          *,
          employee:employee_accounts(
            *,
            role:employee_roles(*),
            department:employee_departments(*)
          )
        `)
        .eq('session_token', sessionToken)
        .eq('is_active', true)
        .gt('expires_at', new Date().toISOString())
        .single();

      if (sessionError || !sessionData) {
        localStorage.removeItem('employee_session_token');
        setLoading(false);
        return;
      }

      // Update last activity
      await supabase
        .from('employee_sessions')
        .update({ last_activity: new Date().toISOString() })
        .eq('id', sessionData.id);

      // Ensure employee has slug (generate if missing)
      let employeeWithSlug = sessionData.employee;
      if (!employeeWithSlug.slug) {
        const generatedSlug = generateSlug(employeeWithSlug.full_name, employeeWithSlug.employee_code);
        employeeWithSlug = { ...employeeWithSlug, slug: generatedSlug };
        
        // Update database with generated slug
        await supabase
          .from('employee_accounts')
          .update({ slug: generatedSlug })
          .eq('id', employeeWithSlug.id);
      }

      setEmployee(employeeWithSlug);
      setSession(sessionData);
    } catch (error) {
      console.error('Session check error:', error);
    } finally {
      setLoading(false);
    }
  };

  const login = async (emailOrPhone, password, rememberDevice = false) => {
    try {
      // Find employee by email or phone
      let query = supabase
        .from('employee_accounts')
        .select(`
          *,
          role:employee_roles(*),
          department:employee_departments(*)
        `)
        .eq('status', 'active');

      if (emailOrPhone.includes('@')) {
        query = query.eq('email', emailOrPhone);
      } else {
        query = query.eq('phone', emailOrPhone);
      }

      const { data: employeeData, error: employeeError } = await query.single();

      if (employeeError) {
        console.error('Employee query error:', employeeError);
        throw new Error('Invalid credentials');
      }

      if (!employeeData) {
        throw new Error('Invalid credentials');
      }

      // Verify password
      const passwordMatch = await bcrypt.compare(password, employeeData.password_hash);
      if (!passwordMatch) {
        throw new Error('Invalid credentials');
      }

      // Ensure employee has slug (generate if missing)
      if (!employeeData.slug) {
        const generatedSlug = generateSlug(employeeData.full_name, employeeData.employee_code);
        employeeData.slug = generatedSlug;
        
        // Update database with generated slug
        await supabase
          .from('employee_accounts')
          .update({ slug: generatedSlug })
          .eq('id', employeeData.id);
      }

      // Create session
      const sessionToken = generateSessionToken();
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + (rememberDevice ? 720 : 24)); // 30 days or 24 hours

      const deviceInfo = {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language,
        rememberDevice
      };

      const { data: sessionData, error: sessionError } = await supabase
        .from('employee_sessions')
        .insert({
          employee_id: employeeData.id,
          session_token: sessionToken,
          device_info: deviceInfo,
          ip_address: await getClientIP(),
          user_agent: navigator.userAgent,
          expires_at: expiresAt.toISOString()
        })
        .select()
        .single();

      if (sessionError) throw sessionError;

      // Log activity
      await logActivity(employeeData.id, 'login', 'Employee logged in successfully');

      // Store session token
      localStorage.setItem('employee_session_token', sessionToken);

      setEmployee(employeeData);
      setSession(sessionData);

      return { 
        success: true, 
        employee: employeeData,
        mustChangePassword: employeeData.must_change_password === true || false
      };
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: error.message };
    }
  };

  const logout = async () => {
    try {
      const sessionToken = localStorage.getItem('employee_session_token');
      if (sessionToken && employee) {
        // Deactivate session
        await supabase
          .from('employee_sessions')
          .update({ is_active: false })
          .eq('session_token', sessionToken);

        // Log activity
        await logActivity(employee.id, 'logout', 'Employee logged out');
      }

      localStorage.removeItem('employee_session_token');
      setEmployee(null);
      setSession(null);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const updateEmployee = (updates) => {
    setEmployee(prev => ({ ...prev, ...updates }));
  };

  const hasPermission = (permission) => {
    if (!employee || !employee.role) return false;
    
    const permissions = employee.role.permissions || {};
    
    // Super admin has all permissions
    if (permissions.all === true) return true;
    
    // Check specific permission
    return permissions[permission] === true;
  };

  const isSuperAdmin = () => {
    return employee?.role?.role_code === 'employee_super_admin';
  };

  const value = {
    employee,
    session,
    loading,
    login,
    logout,
    updateEmployee,
    hasPermission,
    isSuperAdmin,
    isAuthenticated: !!employee
  };

  return (
    <EmployeeAuthContext.Provider value={value}>
      {children}
    </EmployeeAuthContext.Provider>
  );
};

// Helper functions
function generateSlug(name, code) {
  if (!name || !code) return `employee-${Date.now()}`;
  
  const slug = name.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${slug}-${code}`;
}

function generateSessionToken() {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

async function getClientIP() {
  try {
    const response = await fetch('https://api.ipify.org?format=json');
    const data = await response.json();
    return data.ip;
  } catch {
    return 'unknown';
  }
}

async function logActivity(employeeId, activityType, description) {
  try {
    await supabase.from('employee_activity_logs').insert({
      employee_id: employeeId,
      activity_type: activityType,
      activity_description: description,
      ip_address: await getClientIP(),
      user_agent: navigator.userAgent
    });
  } catch (error) {
    console.error('Activity log error:', error);
  }
}
