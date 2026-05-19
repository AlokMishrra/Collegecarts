import { Entity } from '../lib/entity';
import { supabase } from '../lib/supabase';

export class EmployeeStockOrderItem extends Entity {
  static tableName = 'employee_stock_order_items';
  static supabase = supabase;
  
  static fields = [
    'id',
    'stock_order_id',
    'product_id',
    'product_name',
    'quantity',
    'unit_price',
    'total_price',
    'fulfilled_quantity',
    'notes',
    'created_at'
  ];

  static async getOrderItems(stockOrderId) {
    const { data, error } = await supabase
      .from(this.tableName)
      .select('*')
      .eq('stock_order_id', stockOrderId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data;
  }

  static async updateFulfilledQuantity(id, quantity) {
    const { data, error } = await supabase
      .from(this.tableName)
      .update({ fulfilled_quantity: quantity })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }
}
