import { Entity } from '../lib/entity';
import { supabase } from '../lib/supabase';

export class EmployeeSession extends Entity {
  static tableName = 'employee_sessions';
  static supabase = supabase;
  
  static fields = [
    'id',
    'employee_id',
    'session_token',
    'device_info',
    'ip_address',
    'user_agent',
    'is_active',
    'last_activity',
    'expires_at',
    'created_at'
  ];

  static async findByToken(token) {
    const { data, error } = await supabase
      .from(this.tableName)
      .select(`
        *,
        employee:employee_accounts(
          *,
          role:employee_roles(*),
          department:employee_departments(*)
        )
      `)
      .eq('session_token', token)
      .eq('is_active', true)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (error) throw error;
    return data;
  }

  static async deactivateSession(token) {
    const { error } = await supabase
      .from(this.tableName)
      .update({ is_active: false })
      .eq('session_token', token);

    if (error) throw error;
  }

  static async deactivateAllSessions(employeeId) {
    const { error } = await supabase
      .from(this.tableName)
      .update({ is_active: false })
      .eq('employee_id', employeeId);

    if (error) throw error;
  }

  static async getActiveSessions(employeeId) {
    const { data, error } = await supabase
      .from(this.tableName)
      .select('*')
      .eq('employee_id', employeeId)
      .eq('is_active', true)
      .order('last_activity', { ascending: false });

    if (error) throw error;
    return data;
  }
}
