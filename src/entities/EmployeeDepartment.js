import { Entity } from '../lib/entity';
import { supabase } from '../lib/supabase';

export class EmployeeDepartment extends Entity {
  static tableName = 'employee_departments';
  static supabase = supabase;
  
  static fields = [
    'id',
    'department_name',
    'department_code',
    'description',
    'manager_id',
    'is_active',
    'created_at',
    'updated_at'
  ];

  static async findByCode(code) {
    const { data, error } = await supabase
      .from(this.tableName)
      .select('*')
      .eq('department_code', code)
      .single();

    if (error) throw error;
    return data;
  }

  static async list() {
    const { data, error } = await supabase
      .from(this.tableName)
      .select('*')
      .order('department_name');

    if (error) throw error;
    return data || [];
  }

  static async listActive() {
    const { data, error } = await supabase
      .from(this.tableName)
      .select('*')
      .eq('is_active', true)
      .order('department_name');

    if (error) throw error;
    return data;
  }
}
