import { Entity } from '../lib/entity';
import { supabase } from '../lib/supabase';

export class Employee extends Entity {
  static tableName = 'employee_accounts';
  static supabase = supabase;
  
  static fields = [
    'id',
    'employee_code',
    'slug',
    'full_name',
    'photo',
    'phone',
    'email',
    'password_hash',
    'role_id',
    'department_id',
    'campus_id',
    'hostel_id',
    'salary_structure_id',
    'joining_date',
    'status',
    'qr_code',
    'employee_badge_url',
    'address',
    'emergency_contact',
    'emergency_phone',
    'blood_group',
    'date_of_birth',
    'gender',
    'kyc_status',
    'aadhaar_number',
    'aadhaar_verified',
    'aadhaar_name',
    'pan_number',
    'pan_verified',
    'pan_name',
    'bank_account_number',
    'bank_ifsc',
    'bank_name',
    'bank_verified',
    'kyc_submitted_at',
    'kyc_verified_at',
    'kyc_verified_by',
    'kyc_rejection_reason',
    'kyc_documents',
    'created_by',
    'created_at',
    'updated_at'
  ];

  static async list() {
    const { data, error } = await supabase
      .from(this.tableName)
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data;
  }

  static async findBySlug(slug) {
    const { data, error } = await supabase
      .from(this.tableName)
      .select(`
        *,
        role:employee_roles(*),
        department:employee_departments(*),
        salary_structure:employee_salary_structures(*)
      `)
      .eq('slug', slug)
      .eq('status', 'active')
      .single();

    if (error) throw error;
    return data;
  }

  static async findByEmployeeCode(code) {
    const { data, error } = await supabase
      .from(this.tableName)
      .select(`
        *,
        role:employee_roles(*),
        department:employee_departments(*)
      `)
      .eq('employee_code', code)
      .single();

    if (error) throw error;
    return data;
  }

  static async findByEmail(email) {
    const { data, error } = await supabase
      .from(this.tableName)
      .select('*')
      .eq('email', email)
      .single();

    if (error) throw error;
    return data;
  }

  static async findByPhone(phone) {
    const { data, error } = await supabase
      .from(this.tableName)
      .select('*')
      .eq('phone', phone)
      .single();

    if (error) throw error;
    return data;
  }

  static async listWithDetails(filters = {}) {
    let query = supabase
      .from(this.tableName)
      .select(`
        *,
        role:employee_roles(role_name, role_code, dashboard_type),
        department:employee_departments(department_name, department_code)
      `);

    if (filters.status) {
      query = query.eq('status', filters.status);
    }

    if (filters.department_id) {
      query = query.eq('department_id', filters.department_id);
    }

    if (filters.role_id) {
      query = query.eq('role_id', filters.role_id);
    }

    query = query.order('created_at', { ascending: false });

    const { data, error } = await query;
    if (error) throw error;
    return data;
  }
}
