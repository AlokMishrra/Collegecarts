import { Entity } from '../lib/entity';
import { supabase } from '../lib/supabase';

export class EmployeeRole extends Entity {
  static tableName = 'employee_roles';
  static supabase = supabase;
  
  static fields = [
    'id',
    'role_name',
    'role_code',
    'permissions',
    'dashboard_type',
    'hierarchy_level',
    'is_system_role',
    'description',
    'created_at',
    'updated_at'
  ];

  static async list() {
    const { data, error } = await supabase
      .from(this.tableName)
      .select('*')
      .order('hierarchy_level', { ascending: false });
    
    if (error) throw error;
    return data;
  }

  static async findByCode(code) {
    const { data, error } = await supabase
      .from(this.tableName)
      .select('*')
      .eq('role_code', code)
      .single();

    if (error) throw error;
    return data;
  }

  static async listByDashboardType(dashboardType) {
    const { data, error } = await supabase
      .from(this.tableName)
      .select('*')
      .eq('dashboard_type', dashboardType)
      .order('hierarchy_level', { ascending: false });

    if (error) throw error;
    return data;
  }
}
