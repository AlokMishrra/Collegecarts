import { Entity } from '../lib/entity';
import { supabase } from '../lib/supabase';

export class EmployeeSalaryLog extends Entity {
  static tableName = 'employee_salary_logs';
  static supabase = supabase;
  
  static fields = [
    'id',
    'employee_id',
    'salary_month',
    'base_salary',
    'hra',
    'allowances',
    'bonus',
    'incentives',
    'overtime_pay',
    'deductions',
    'total_salary',
    'paid_status',
    'payment_mode',
    'payment_date',
    'payment_reference',
    'attendance_days',
    'working_days',
    'notes',
    'generated_by',
    'paid_by',
    'created_at',
    'updated_at'
  ];

  static async getEmployeeSalaryHistory(employeeId) {
    const { data, error } = await supabase
      .from(this.tableName)
      .select('*')
      .eq('employee_id', employeeId)
      .order('salary_month', { ascending: false });

    if (error) throw error;
    return data;
  }

  static async getMonthSalary(employeeId, salaryMonth) {
    const { data, error } = await supabase
      .from(this.tableName)
      .select('*')
      .eq('employee_id', employeeId)
      .eq('salary_month', salaryMonth)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  static async listPendingSalaries() {
    const { data, error } = await supabase
      .from(this.tableName)
      .select(`
        *,
        employee:employee_accounts(full_name, employee_code, phone)
      `)
      .eq('paid_status', 'pending')
      .order('salary_month', { ascending: false });

    if (error) throw error;
    return data;
  }
}
