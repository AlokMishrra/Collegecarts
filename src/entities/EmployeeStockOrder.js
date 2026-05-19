import { Entity } from '../lib/entity';
import { supabase } from '../lib/supabase';

export class EmployeeStockOrder extends Entity {
  static tableName = 'employee_stock_orders';
  static supabase = supabase;
  
  static fields = [
    'id',
    'order_number',
    'employee_id',
    'department_id',
    'hostel_id',
    'order_type',
    'total_items',
    'total_quantity',
    'total_value',
    'status',
    'priority',
    'requested_date',
    'approved_date',
    'fulfilled_date',
    'approved_by',
    'fulfilled_by',
    'notes',
    'rejection_reason',
    'created_at',
    'updated_at'
  ];

  static async listWithItems(filters = {}) {
    let query = supabase
      .from(this.tableName)
      .select(`
        *,
        employee:employee_accounts(full_name, employee_code, photo),
        department:employee_departments(department_name),
        items:employee_stock_order_items(*)
      `);

    if (filters.employee_id) {
      query = query.eq('employee_id', filters.employee_id);
    }

    if (filters.status) {
      query = query.eq('status', filters.status);
    }

    if (filters.department_id) {
      query = query.eq('department_id', filters.department_id);
    }

    query = query.order('requested_date', { ascending: false });

    const { data, error } = await query;
    if (error) throw error;
    return data;
  }

  static async generateOrderNumber() {
    const prefix = 'ESO';
    const timestamp = Date.now().toString().slice(-8);
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `${prefix}${timestamp}${random}`;
  }
}
