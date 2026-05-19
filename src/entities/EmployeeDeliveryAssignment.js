import { Entity } from '../lib/entity';
import { supabase } from '../lib/supabase';

export class EmployeeDeliveryAssignment extends Entity {
  static tableName = 'employee_delivery_assignments';
  static supabase = supabase;
  
  static fields = [
    'id',
    'employee_id',
    'order_id',
    'assignment_date',
    'pickup_time',
    'delivery_time',
    'status',
    'delivery_location',
    'delivery_proof',
    'customer_rating',
    'customer_feedback',
    'distance_km',
    'delivery_fee',
    'incentive',
    'notes',
    'created_at',
    'updated_at'
  ];

  static async getEmployeeDeliveries(employeeId, status = null) {
    let query = supabase
      .from(this.tableName)
      .select('*')
      .eq('employee_id', employeeId);

    if (status) {
      query = query.eq('status', status);
    }

    query = query.order('assignment_date', { ascending: false });

    const { data, error } = await query;
    if (error) throw error;
    return data;
  }

  static async getTodayDeliveries(employeeId) {
    const today = new Date().toISOString().split('T')[0];
    const { data, error } = await supabase
      .from(this.tableName)
      .select('*')
      .eq('employee_id', employeeId)
      .gte('assignment_date', today)
      .order('assignment_date', { ascending: true });

    if (error) throw error;
    return data;
  }

  static async updateStatus(id, status, additionalData = {}) {
    const updateData = {
      status,
      ...additionalData,
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from(this.tableName)
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async getDeliveryStats(employeeId, startDate, endDate) {
    const { data, error } = await supabase
      .from(this.tableName)
      .select('*')
      .eq('employee_id', employeeId)
      .gte('assignment_date', startDate)
      .lte('assignment_date', endDate);

    if (error) throw error;

    const stats = {
      total: data.length,
      completed: data.filter(d => d.status === 'delivered').length,
      failed: data.filter(d => d.status === 'failed').length,
      totalDistance: data.reduce((sum, d) => sum + (parseFloat(d.distance_km) || 0), 0),
      totalIncentive: data.reduce((sum, d) => sum + (parseFloat(d.incentive) || 0), 0),
      averageRating: data.filter(d => d.customer_rating).reduce((sum, d, _, arr) => 
        sum + d.customer_rating / arr.length, 0
      )
    };

    return stats;
  }
}
