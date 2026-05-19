import { Entity } from '../lib/entity';
import { supabase } from '../lib/supabase';

export class EmployeeAttendance extends Entity {
  static tableName = 'employee_attendance';
  static supabase = supabase;
  
  static fields = [
    'id',
    'employee_id',
    'attendance_date',
    'check_in',
    'check_out',
    'work_hours',
    'overtime_hours',
    'attendance_status',
    'location_check_in',
    'location_check_out',
    'device_info',
    'notes',
    'approved_by',
    'created_at',
    'updated_at'
  ];

  static async getTodayAttendance(employeeId) {
    const today = new Date().toISOString().split('T')[0];
    const { data, error} = await supabase
      .from(this.tableName)
      .select('*')
      .eq('employee_id', employeeId)
      .eq('attendance_date', today)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  static async getMonthlyAttendance(employeeId, year, month) {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = new Date(year, month, 0).toISOString().split('T')[0];

    const { data, error } = await supabase
      .from(this.tableName)
      .select('*')
      .eq('employee_id', employeeId)
      .gte('attendance_date', startDate)
      .lte('attendance_date', endDate)
      .order('attendance_date', { ascending: false });

    if (error) throw error;
    return data;
  }

  static async checkIn(employeeId, location, deviceInfo) {
    const today = new Date().toISOString().split('T')[0];
    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from(this.tableName)
      .upsert({
        employee_id: employeeId,
        attendance_date: today,
        check_in: now,
        attendance_status: 'present',
        location_check_in: location,
        device_info: deviceInfo
      }, {
        onConflict: 'employee_id,attendance_date'
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async checkOut(employeeId, location) {
    const today = new Date().toISOString().split('T')[0];
    const now = new Date().toISOString();

    const attendance = await this.getTodayAttendance(employeeId);
    if (!attendance) throw new Error('No check-in found for today');

    const checkInTime = new Date(attendance.check_in);
    const checkOutTime = new Date(now);
    const workHours = (checkOutTime - checkInTime) / (1000 * 60 * 60);

    const { data, error } = await supabase
      .from(this.tableName)
      .update({
        check_out: now,
        work_hours: workHours.toFixed(2),
        overtime_hours: workHours > 8 ? (workHours - 8).toFixed(2) : 0,
        location_check_out: location
      })
      .eq('employee_id', employeeId)
      .eq('attendance_date', today)
      .select()
      .single();

    if (error) throw error;
    return data;
  }
}
