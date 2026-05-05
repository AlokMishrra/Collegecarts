/**
 * Entity base class — mimics Base44 SDK API
 * Wraps Supabase so existing components need minimal changes.
 *
 * Supported methods (same signature as Base44):
 *   Entity.filter(filters, orderBy, limit)
 *   Entity.list(orderBy, limit)
 *   Entity.create(data)
 *   Entity.update(id, data)
 *   Entity.delete(id)
 *   Entity.subscribe(callback)  → Supabase realtime
 */

import { supabase } from './supabase';

export class Entity {
  constructor(tableName) {
    this.table = tableName;
  }

  /**
   * Filter rows by field equality.
   * @param {object} filters  - { field: value, ... }
   * @param {string} orderBy  - e.g. '-created_at' (prefix - = descending)
   * @param {number} limit    - max rows
   */
  async filter(filters = {}, orderBy = null, limit = null) {
    let query = supabase.from(this.table).select('*');

    // Apply equality filters
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        query = query.eq(key, value);
      }
    });

    // Apply ordering
    if (orderBy) {
      const desc = orderBy.startsWith('-');
      const col = desc ? orderBy.slice(1) : orderBy;
      // Map Base44 field names to Supabase column names
      const mappedCol = this._mapField(col);
      query = query.order(mappedCol, { ascending: !desc });
    } else {
      // Default ordering - use created_date for support tables, created_at for others
      const defaultCol = (this.table === 'support_tickets' || this.table === 'support_ticket_comments') 
        ? 'created_date' 
        : 'created_at';
      query = query.order(defaultCol, { ascending: false });
    }

    if (limit) query = query.limit(limit);

    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map(row => this._mapOut(row));
  }

  /**
   * List all rows (optionally ordered/limited)
   */
  async list(orderBy = null, limit = null) {
    return this.filter({}, orderBy, limit);
  }

  /**
   * Create a new row
   */
  async create(data) {
    const mapped = this._mapIn(data);
    const { data: row, error } = await supabase
      .from(this.table)
      .insert(mapped)
      .select()
      .single();
    if (error) throw error;
    return this._mapOut(row);
  }

  /**
   * Update a row by id
   */
  async update(id, data) {
    const mapped = this._mapIn(data);
    
    // Determine the correct updated timestamp column name
    const updatedCol = (this.table === 'support_tickets' || this.table === 'support_ticket_comments') 
      ? 'updated_date' 
      : 'updated_at';
    
    const { data: row, error } = await supabase
      .from(this.table)
      .update({ ...mapped, [updatedCol]: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return this._mapOut(row);
  }

  /**
   * Delete a row by id
   */
  async delete(id) {
    const { error } = await supabase
      .from(this.table)
      .delete()
      .eq('id', id);
    if (error) throw error;
    return true;
  }

  /**
   * Subscribe to realtime changes (mimics Base44 subscribe)
   * Returns unsubscribe function.
   */
  subscribe(callback) {
    const channel = supabase
      .channel(`${this.table}_changes_${Date.now()}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: this.table },
        (payload) => {
          const eventType = payload.eventType; // INSERT | UPDATE | DELETE
          callback({
            type: eventType === 'INSERT' ? 'create' : eventType === 'UPDATE' ? 'update' : 'delete',
            id: payload.new?.id || payload.old?.id,
            data: payload.new ? this._mapOut(payload.new) : null
          });
        }
      )
      .subscribe();

    // Return unsubscribe function
    return () => supabase.removeChannel(channel);
  }

  // ---- Field name mapping (Base44 → Supabase) ----
  // Base44 uses camelCase in some places, Supabase uses snake_case
  // Most fields are already snake_case so this is mostly a passthrough
  _mapField(field) {
    // Special handling for support_tickets table which uses created_date
    if (this.table === 'support_tickets' || this.table === 'support_ticket_comments') {
      // Don't map created_date for these tables
      return field;
    }
    
    const fieldMap = {
      'created_date': 'created_at',
      'createdDate': 'created_at',
    };
    return fieldMap[field] || field;
  }

  // Map incoming data (Base44 format → Supabase format)
  _mapIn(data) {
    const result = {};
    Object.entries(data).forEach(([key, value]) => {
      const mapped = this._mapField(key);
      result[mapped] = value;
    });
    return result;
  }

  // Map outgoing data (Supabase format → Base44-compatible format)
  // Adds created_date alias so existing code still works
  _mapOut(row) {
    if (!row) return row;
    
    // Special handling for support_tickets table which uses created_date
    if (this.table === 'support_tickets' || this.table === 'support_ticket_comments') {
      return row; // Return as-is, already has created_date
    }
    
    return {
      ...row,
      created_date: row.created_at, // backward compat alias
    };
  }
}
