import { Entity } from '../lib/entity';
import { supabase } from '../lib/supabase';

export class EmployeeNotification extends Entity {
  static tableName = 'employee_notifications';
  static supabase = supabase;
  
  static fields = [
    'id',
    'employee_id',
    'title',
    'message',
    'type',
    'priority',
    'is_read',
    'action_url',
    'action_label',
    'metadata',
    'expires_at',
    'created_at'
  ];

  static async getUnreadCount(employeeId) {
    const { count, error } = await supabase
      .from(this.tableName)
      .select('*', { count: 'exact', head: true })
      .eq('employee_id', employeeId)
      .eq('is_read', false);

    if (error) throw error;
    return count;
  }

  static async getNotifications(employeeId, limit = 50) {
    const { data, error } = await supabase
      .from(this.tableName)
      .select('*')
      .eq('employee_id', employeeId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data;
  }

  static async markAsRead(id) {
    const { error } = await supabase
      .from(this.tableName)
      .update({ is_read: true })
      .eq('id', id);

    if (error) throw error;
  }

  static async markAllAsRead(employeeId) {
    const { error } = await supabase
      .from(this.tableName)
      .update({ is_read: true })
      .eq('employee_id', employeeId)
      .eq('is_read', false);

    if (error) throw error;
  }

  static async createNotification(employeeId, title, message, type = 'info', metadata = {}) {
    const { data, error } = await supabase
      .from(this.tableName)
      .insert({
        employee_id: employeeId,
        title,
        message,
        type,
        metadata
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }
}
