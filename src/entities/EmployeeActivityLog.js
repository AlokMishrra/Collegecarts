import { Entity } from '../lib/entity';
import { supabase } from '../lib/supabase';

export class EmployeeActivityLog extends Entity {
  static tableName = 'employee_activity_logs';
  static supabase = supabase;
  
  static fields = [
    'id',
    'employee_id',
    'activity_type',
    'activity_description',
    'entity_type',
    'entity_id',
    'old_value',
    'new_value',
    'ip_address',
    'user_agent',
    'created_at'
  ];

  static async logActivity(employeeId, activityType, description, entityType = null, entityId = null, oldValue = null, newValue = null) {
    const { data, error } = await supabase
      .from(this.tableName)
      .insert({
        employee_id: employeeId,
        activity_type: activityType,
        activity_description: description,
        entity_type: entityType,
        entity_id: entityId,
        old_value: oldValue,
        new_value: newValue,
        ip_address: await this.getClientIP(),
        user_agent: navigator.userAgent
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async getEmployeeActivities(employeeId, limit = 50) {
    const { data, error } = await supabase
      .from(this.tableName)
      .select('*')
      .eq('employee_id', employeeId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data;
  }

  static async getRecentActivities(limit = 100) {
    const { data, error } = await supabase
      .from(this.tableName)
      .select(`
        *,
        employee:employee_accounts(full_name, employee_code)
      `)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data;
  }

  static async getClientIP() {
    try {
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      return data.ip;
    } catch {
      return 'unknown';
    }
  }
}
