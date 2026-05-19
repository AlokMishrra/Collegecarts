import { Entity } from '../lib/entity';
import { supabase } from '../lib/supabase';

export class EmployeeSalaryStructure extends Entity {
  static tableName = 'employee_salary_structures';
  static supabase = supabase;
  
  static fields = [
    'id',
    'structure_name',
    'base_salary',
    'hra',
    'transport_allowance',
    'meal_allowance',
    'performance_bonus_percentage',
    'delivery_incentive_per_order',
    'overtime_rate_per_hour',
    'attendance_bonus',
    'deduction_rules',
    'is_active',
    'created_at',
    'updated_at'
  ];

  static async list() {
    const { data, error } = await supabase
      .from(this.tableName)
      .select('*')
      .eq('is_active', true)
      .order('base_salary', { ascending: false });
    
    if (error) throw error;
    return data;
  }

  static async create(salaryData) {
    const { data, error } = await supabase
      .from(this.tableName)
      .insert(salaryData)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  static async update(id, updates) {
    const { data, error } = await supabase
      .from(this.tableName)
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  static async delete(id) {
    const { error } = await supabase
      .from(this.tableName)
      .update({ is_active: false })
      .eq('id', id);
    
    if (error) throw error;
    return true;
  }

  static async calculateTotalCTC(structureId) {
    const { data, error } = await supabase
      .from(this.tableName)
      .select('*')
      .eq('id', structureId)
      .single();
    
    if (error) throw error;
    
    const total = (
      parseFloat(data.base_salary || 0) +
      parseFloat(data.hra || 0) +
      parseFloat(data.transport_allowance || 0) +
      parseFloat(data.meal_allowance || 0) +
      parseFloat(data.attendance_bonus || 0)
    );
    
    return total;
  }
}
