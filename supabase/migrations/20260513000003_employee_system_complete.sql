-- ============================================================
-- EMPLOYEE OPERATIONS SYSTEM - COMPLETE DATABASE SCHEMA
-- ============================================================
-- This is a completely isolated employee ecosystem
-- Does NOT modify existing customer/admin architecture
-- ============================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. EMPLOYEE ROLES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.employee_roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  role_name TEXT NOT NULL UNIQUE,
  role_code TEXT NOT NULL UNIQUE,
  permissions JSONB DEFAULT '{}',
  dashboard_type TEXT NOT NULL, -- super_admin, delivery, finance, support, stock, operations, hostel, order
  hierarchy_level INTEGER NOT NULL DEFAULT 0,
  is_system_role BOOLEAN DEFAULT false,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_employee_roles_code ON public.employee_roles(role_code);
CREATE INDEX idx_employee_roles_hierarchy ON public.employee_roles(hierarchy_level);

-- ============================================================
-- 2. EMPLOYEE DEPARTMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.employee_departments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  department_name TEXT NOT NULL UNIQUE,
  department_code TEXT NOT NULL UNIQUE,
  description TEXT,
  manager_id UUID,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_employee_departments_code ON public.employee_departments(department_code);

-- ============================================================
-- 3. EMPLOYEE SALARY STRUCTURES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.employee_salary_structures (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  structure_name TEXT NOT NULL,
  base_salary NUMERIC(10,2) NOT NULL DEFAULT 0,
  hra NUMERIC(10,2) DEFAULT 0,
  transport_allowance NUMERIC(10,2) DEFAULT 0,
  meal_allowance NUMERIC(10,2) DEFAULT 0,
  performance_bonus_percentage NUMERIC(5,2) DEFAULT 0,
  delivery_incentive_per_order NUMERIC(10,2) DEFAULT 0,
  overtime_rate_per_hour NUMERIC(10,2) DEFAULT 0,
  attendance_bonus NUMERIC(10,2) DEFAULT 0,
  deduction_rules JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 4. EMPLOYEE ACCOUNTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.employee_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_code TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  photo TEXT,
  phone TEXT UNIQUE,
  email TEXT UNIQUE,
  password_hash TEXT NOT NULL,
  role_id UUID REFERENCES public.employee_roles(id) ON DELETE SET NULL,
  department_id UUID REFERENCES public.employee_departments(id) ON DELETE SET NULL,
  campus_id UUID,
  hostel_id UUID,
  salary_structure_id UUID REFERENCES public.employee_salary_structures(id) ON DELETE SET NULL,
  joining_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT DEFAULT 'active', -- active, inactive, suspended, terminated
  qr_code TEXT,
  employee_badge_url TEXT,
  address TEXT,
  emergency_contact TEXT,
  emergency_phone TEXT,
  blood_group TEXT,
  date_of_birth DATE,
  gender TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_employee_accounts_code ON public.employee_accounts(employee_code);
CREATE INDEX idx_employee_accounts_slug ON public.employee_accounts(slug);
CREATE INDEX idx_employee_accounts_role ON public.employee_accounts(role_id);
CREATE INDEX idx_employee_accounts_department ON public.employee_accounts(department_id);
CREATE INDEX idx_employee_accounts_status ON public.employee_accounts(status);
CREATE INDEX idx_employee_accounts_phone ON public.employee_accounts(phone);
CREATE INDEX idx_employee_accounts_email ON public.employee_accounts(email);

-- ============================================================
-- 5. EMPLOYEE SESSIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.employee_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID REFERENCES public.employee_accounts(id) ON DELETE CASCADE,
  session_token TEXT NOT NULL UNIQUE,
  device_info JSONB DEFAULT '{}',
  ip_address TEXT,
  user_agent TEXT,
  is_active BOOLEAN DEFAULT true,
  last_activity TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_employee_sessions_employee ON public.employee_sessions(employee_id);
CREATE INDEX idx_employee_sessions_token ON public.employee_sessions(session_token);
CREATE INDEX idx_employee_sessions_active ON public.employee_sessions(is_active);

-- ============================================================
-- 6. EMPLOYEE ATTENDANCE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.employee_attendance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID REFERENCES public.employee_accounts(id) ON DELETE CASCADE,
  attendance_date DATE NOT NULL,
  check_in TIMESTAMPTZ,
  check_out TIMESTAMPTZ,
  work_hours NUMERIC(5,2) DEFAULT 0,
  overtime_hours NUMERIC(5,2) DEFAULT 0,
  attendance_status TEXT DEFAULT 'absent', -- present, absent, half_day, leave, holiday
  location_check_in JSONB,
  location_check_out JSONB,
  device_info JSONB,
  notes TEXT,
  approved_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(employee_id, attendance_date)
);

CREATE INDEX idx_employee_attendance_employee ON public.employee_attendance(employee_id);
CREATE INDEX idx_employee_attendance_date ON public.employee_attendance(attendance_date);
CREATE INDEX idx_employee_attendance_status ON public.employee_attendance(attendance_status);

-- ============================================================
-- 7. EMPLOYEE SALARY LOGS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.employee_salary_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID REFERENCES public.employee_accounts(id) ON DELETE CASCADE,
  salary_month DATE NOT NULL,
  base_salary NUMERIC(10,2) NOT NULL DEFAULT 0,
  hra NUMERIC(10,2) DEFAULT 0,
  allowances NUMERIC(10,2) DEFAULT 0,
  bonus NUMERIC(10,2) DEFAULT 0,
  incentives NUMERIC(10,2) DEFAULT 0,
  overtime_pay NUMERIC(10,2) DEFAULT 0,
  deductions NUMERIC(10,2) DEFAULT 0,
  total_salary NUMERIC(10,2) NOT NULL DEFAULT 0,
  paid_status TEXT DEFAULT 'pending', -- pending, paid, cancelled
  payment_mode TEXT, -- cash, bank_transfer, upi
  payment_date TIMESTAMPTZ,
  payment_reference TEXT,
  attendance_days INTEGER DEFAULT 0,
  working_days INTEGER DEFAULT 0,
  notes TEXT,
  generated_by UUID,
  paid_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(employee_id, salary_month)
);

CREATE INDEX idx_employee_salary_logs_employee ON public.employee_salary_logs(employee_id);
CREATE INDEX idx_employee_salary_logs_month ON public.employee_salary_logs(salary_month);
CREATE INDEX idx_employee_salary_logs_status ON public.employee_salary_logs(paid_status);

-- ============================================================
-- 8. EMPLOYEE STOCK ORDERS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.employee_stock_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_number TEXT NOT NULL UNIQUE,
  employee_id UUID REFERENCES public.employee_accounts(id) ON DELETE SET NULL,
  department_id UUID REFERENCES public.employee_departments(id) ON DELETE SET NULL,
  hostel_id UUID,
  order_type TEXT DEFAULT 'internal', -- internal, transfer, return
  total_items INTEGER DEFAULT 0,
  total_quantity INTEGER DEFAULT 0,
  total_value NUMERIC(10,2) DEFAULT 0, -- hidden from normal employees
  status TEXT DEFAULT 'pending', -- pending, approved, rejected, fulfilled, cancelled
  priority TEXT DEFAULT 'normal', -- low, normal, high, urgent
  requested_date TIMESTAMPTZ DEFAULT NOW(),
  approved_date TIMESTAMPTZ,
  fulfilled_date TIMESTAMPTZ,
  approved_by UUID,
  fulfilled_by UUID,
  notes TEXT,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_employee_stock_orders_number ON public.employee_stock_orders(order_number);
CREATE INDEX idx_employee_stock_orders_employee ON public.employee_stock_orders(employee_id);
CREATE INDEX idx_employee_stock_orders_status ON public.employee_stock_orders(status);
CREATE INDEX idx_employee_stock_orders_date ON public.employee_stock_orders(requested_date);

-- ============================================================
-- 9. EMPLOYEE STOCK ORDER ITEMS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.employee_stock_order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  stock_order_id UUID REFERENCES public.employee_stock_orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC(10,2) DEFAULT 0, -- hidden from normal employees
  total_price NUMERIC(10,2) DEFAULT 0, -- hidden from normal employees
  fulfilled_quantity INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_employee_stock_order_items_order ON public.employee_stock_order_items(stock_order_id);
CREATE INDEX idx_employee_stock_order_items_product ON public.employee_stock_order_items(product_id);

-- ============================================================
-- 10. EMPLOYEE DELIVERY ASSIGNMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.employee_delivery_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID REFERENCES public.employee_accounts(id) ON DELETE SET NULL,
  order_id UUID NOT NULL,
  assignment_date TIMESTAMPTZ DEFAULT NOW(),
  pickup_time TIMESTAMPTZ,
  delivery_time TIMESTAMPTZ,
  status TEXT DEFAULT 'assigned', -- assigned, picked_up, in_transit, delivered, failed, cancelled
  delivery_location JSONB,
  delivery_proof TEXT,
  customer_rating INTEGER,
  customer_feedback TEXT,
  distance_km NUMERIC(5,2),
  delivery_fee NUMERIC(10,2) DEFAULT 0,
  incentive NUMERIC(10,2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_employee_delivery_assignments_employee ON public.employee_delivery_assignments(employee_id);
CREATE INDEX idx_employee_delivery_assignments_order ON public.employee_delivery_assignments(order_id);
CREATE INDEX idx_employee_delivery_assignments_status ON public.employee_delivery_assignments(status);
CREATE INDEX idx_employee_delivery_assignments_date ON public.employee_delivery_assignments(assignment_date);

-- ============================================================
-- 11. EMPLOYEE FINANCE LOGS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.employee_finance_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID REFERENCES public.employee_accounts(id) ON DELETE SET NULL,
  transaction_type TEXT NOT NULL, -- salary, bonus, deduction, advance, reimbursement, penalty
  amount NUMERIC(10,2) NOT NULL,
  description TEXT,
  reference_id UUID,
  reference_type TEXT,
  payment_mode TEXT,
  payment_date TIMESTAMPTZ,
  status TEXT DEFAULT 'pending',
  processed_by UUID,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_employee_finance_logs_employee ON public.employee_finance_logs(employee_id);
CREATE INDEX idx_employee_finance_logs_type ON public.employee_finance_logs(transaction_type);
CREATE INDEX idx_employee_finance_logs_date ON public.employee_finance_logs(created_at);

-- ============================================================
-- 12. EMPLOYEE ACTIVITY LOGS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.employee_activity_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID REFERENCES public.employee_accounts(id) ON DELETE SET NULL,
  activity_type TEXT NOT NULL,
  activity_description TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  old_value JSONB,
  new_value JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_employee_activity_logs_employee ON public.employee_activity_logs(employee_id);
CREATE INDEX idx_employee_activity_logs_type ON public.employee_activity_logs(activity_type);
CREATE INDEX idx_employee_activity_logs_date ON public.employee_activity_logs(created_at);
CREATE INDEX idx_employee_activity_logs_entity ON public.employee_activity_logs(entity_type, entity_id);

-- ============================================================
-- 13. EMPLOYEE NOTIFICATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.employee_notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID REFERENCES public.employee_accounts(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT DEFAULT 'info', -- info, success, warning, error, alert
  priority TEXT DEFAULT 'normal', -- low, normal, high, urgent
  is_read BOOLEAN DEFAULT false,
  action_url TEXT,
  action_label TEXT,
  metadata JSONB,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_employee_notifications_employee ON public.employee_notifications(employee_id);
CREATE INDEX idx_employee_notifications_read ON public.employee_notifications(is_read);
CREATE INDEX idx_employee_notifications_date ON public.employee_notifications(created_at);

-- ============================================================
-- 14. EMPLOYEE PERMISSIONS OVERRIDE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.employee_permissions_override (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID REFERENCES public.employee_accounts(id) ON DELETE CASCADE,
  permission_key TEXT NOT NULL,
  permission_value BOOLEAN NOT NULL,
  granted_by UUID,
  reason TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(employee_id, permission_key)
);

CREATE INDEX idx_employee_permissions_override_employee ON public.employee_permissions_override(employee_id);

-- ============================================================
-- 15. EMPLOYEE INVENTORY TRANSACTIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.employee_inventory_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID REFERENCES public.employee_accounts(id) ON DELETE SET NULL,
  product_id UUID NOT NULL,
  transaction_type TEXT NOT NULL, -- issue, return, adjust, transfer
  quantity INTEGER NOT NULL,
  from_location TEXT,
  to_location TEXT,
  reference_id UUID,
  reference_type TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_employee_inventory_transactions_employee ON public.employee_inventory_transactions(employee_id);
CREATE INDEX idx_employee_inventory_transactions_product ON public.employee_inventory_transactions(product_id);
CREATE INDEX idx_employee_inventory_transactions_type ON public.employee_inventory_transactions(transaction_type);
CREATE INDEX idx_employee_inventory_transactions_date ON public.employee_inventory_transactions(created_at);

-- ============================================================
-- 16. EMPLOYEE SHIFT MANAGEMENT
-- ============================================================
CREATE TABLE IF NOT EXISTS public.employee_shift_management (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID REFERENCES public.employee_accounts(id) ON DELETE CASCADE,
  shift_date DATE NOT NULL,
  shift_type TEXT NOT NULL, -- morning, afternoon, evening, night, full_day
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  break_duration INTEGER DEFAULT 0, -- in minutes
  assigned_by UUID,
  status TEXT DEFAULT 'scheduled', -- scheduled, completed, missed, cancelled
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_employee_shift_management_employee ON public.employee_shift_management(employee_id);
CREATE INDEX idx_employee_shift_management_date ON public.employee_shift_management(shift_date);
CREATE INDEX idx_employee_shift_management_status ON public.employee_shift_management(status);

-- ============================================================
-- 17. EMPLOYEE PERFORMANCE METRICS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.employee_performance_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID REFERENCES public.employee_accounts(id) ON DELETE CASCADE,
  metric_month DATE NOT NULL,
  deliveries_completed INTEGER DEFAULT 0,
  average_delivery_time NUMERIC(5,2) DEFAULT 0,
  customer_rating NUMERIC(3,2) DEFAULT 0,
  attendance_percentage NUMERIC(5,2) DEFAULT 0,
  punctuality_score NUMERIC(5,2) DEFAULT 0,
  stock_accuracy_percentage NUMERIC(5,2) DEFAULT 0,
  orders_processed INTEGER DEFAULT 0,
  complaints_received INTEGER DEFAULT 0,
  compliments_received INTEGER DEFAULT 0,
  performance_score NUMERIC(5,2) DEFAULT 0,
  notes TEXT,
  reviewed_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(employee_id, metric_month)
);

CREATE INDEX idx_employee_performance_metrics_employee ON public.employee_performance_metrics(employee_id);
CREATE INDEX idx_employee_performance_metrics_month ON public.employee_performance_metrics(metric_month);

-- ============================================================
-- 18. EMPLOYEE SUPPORT TICKETS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.employee_support_tickets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_number TEXT NOT NULL UNIQUE,
  employee_id UUID REFERENCES public.employee_accounts(id) ON DELETE SET NULL,
  category TEXT NOT NULL, -- technical, hr, payroll, equipment, other
  priority TEXT DEFAULT 'normal',
  subject TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT DEFAULT 'open', -- open, in_progress, resolved, closed
  assigned_to UUID,
  resolution TEXT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_employee_support_tickets_number ON public.employee_support_tickets(ticket_number);
CREATE INDEX idx_employee_support_tickets_employee ON public.employee_support_tickets(employee_id);
CREATE INDEX idx_employee_support_tickets_status ON public.employee_support_tickets(status);

-- ============================================================
-- 19. EMPLOYEE INTERNAL CHAT
-- ============================================================
CREATE TABLE IF NOT EXISTS public.employee_internal_chat (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sender_id UUID REFERENCES public.employee_accounts(id) ON DELETE SET NULL,
  receiver_id UUID REFERENCES public.employee_accounts(id) ON DELETE SET NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ,
  attachments JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_employee_internal_chat_sender ON public.employee_internal_chat(sender_id);
CREATE INDEX idx_employee_internal_chat_receiver ON public.employee_internal_chat(receiver_id);
CREATE INDEX idx_employee_internal_chat_read ON public.employee_internal_chat(is_read);

-- ============================================================
-- 20. EMPLOYEE AUDIT TRAIL
-- ============================================================
CREATE TABLE IF NOT EXISTS public.employee_audit_trail (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  changes JSONB,
  ip_address TEXT,
  user_agent TEXT,
  severity TEXT DEFAULT 'info', -- info, warning, critical
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_employee_audit_trail_employee ON public.employee_audit_trail(employee_id);
CREATE INDEX idx_employee_audit_trail_entity ON public.employee_audit_trail(entity_type, entity_id);
CREATE INDEX idx_employee_audit_trail_date ON public.employee_audit_trail(created_at);
CREATE INDEX idx_employee_audit_trail_severity ON public.employee_audit_trail(severity);

-- ============================================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE public.employee_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_salary_structures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_salary_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_stock_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_stock_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_delivery_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_finance_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_permissions_override ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_inventory_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_shift_management ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_performance_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_internal_chat ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_audit_trail ENABLE ROW LEVEL SECURITY;

-- Helper function to check if user is employee super admin
CREATE OR REPLACE FUNCTION public.is_employee_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.employee_accounts ea
    JOIN public.employee_roles er ON ea.role_id = er.id
    WHERE ea.id = auth.uid()
    AND er.role_code = 'employee_super_admin'
    AND ea.status = 'active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Basic RLS policies (employees can read their own data, super admins can manage all)
CREATE POLICY "Employees can view their own account" ON public.employee_accounts
  FOR SELECT USING (id = auth.uid() OR public.is_employee_super_admin());

CREATE POLICY "Super admins can manage all accounts" ON public.employee_accounts
  FOR ALL USING (public.is_employee_super_admin());

CREATE POLICY "Employees can view their own attendance" ON public.employee_attendance
  FOR SELECT USING (employee_id = auth.uid() OR public.is_employee_super_admin());

CREATE POLICY "Employees can view their own salary logs" ON public.employee_salary_logs
  FOR SELECT USING (employee_id = auth.uid() OR public.is_employee_super_admin());

CREATE POLICY "Employees can view their own notifications" ON public.employee_notifications
  FOR SELECT USING (employee_id = auth.uid());

CREATE POLICY "Employees can update their own notifications" ON public.employee_notifications
  FOR UPDATE USING (employee_id = auth.uid());

-- ============================================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_employee_roles_updated_at BEFORE UPDATE ON public.employee_roles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_employee_departments_updated_at BEFORE UPDATE ON public.employee_departments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_employee_salary_structures_updated_at BEFORE UPDATE ON public.employee_salary_structures
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_employee_accounts_updated_at BEFORE UPDATE ON public.employee_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_employee_attendance_updated_at BEFORE UPDATE ON public.employee_attendance
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_employee_salary_logs_updated_at BEFORE UPDATE ON public.employee_salary_logs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_employee_stock_orders_updated_at BEFORE UPDATE ON public.employee_stock_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- SEED DEFAULT ROLES
-- ============================================================

INSERT INTO public.employee_roles (role_name, role_code, dashboard_type, hierarchy_level, is_system_role, permissions) VALUES
('Employee Super Admin', 'employee_super_admin', 'super_admin', 100, true, '{"all": true}'::jsonb),
('Delivery Partner', 'delivery_partner', 'delivery', 10, true, '{"view_deliveries": true, "update_delivery_status": true}'::jsonb),
('Stock Manager', 'stock_manager', 'stock', 50, true, '{"manage_stock": true, "approve_stock_orders": true, "view_inventory": true}'::jsonb),
('Finance Manager', 'finance_manager', 'finance', 70, true, '{"manage_salaries": true, "view_finance": true, "process_payments": true}'::jsonb),
('Finance Executive', 'finance_executive', 'finance', 40, true, '{"view_finance": true, "process_payments": true}'::jsonb),
('Support Executive', 'support_executive', 'support', 30, true, '{"manage_tickets": true, "view_support": true}'::jsonb),
('Order Manager', 'order_manager', 'order', 50, true, '{"manage_orders": true, "assign_deliveries": true}'::jsonb),
('Hostel Manager', 'hostel_manager', 'hostel', 60, true, '{"manage_hostel_stock": true, "view_hostel_orders": true}'::jsonb),
('Inventory Manager', 'inventory_manager', 'stock', 60, true, '{"manage_inventory": true, "track_stock": true}'::jsonb),
('Operations Manager', 'operations_manager', 'operations', 80, true, '{"view_all_operations": true, "manage_employees": true}'::jsonb)
ON CONFLICT (role_code) DO NOTHING;

-- ============================================================
-- SEED DEFAULT DEPARTMENTS
-- ============================================================

INSERT INTO public.employee_departments (department_name, department_code, description) VALUES
('Delivery', 'DELIVERY', 'Handles all delivery operations'),
('Stock Management', 'STOCK', 'Manages inventory and stock'),
('Finance', 'FINANCE', 'Handles financial operations and payroll'),
('Customer Support', 'SUPPORT', 'Manages customer support and tickets'),
('Operations', 'OPERATIONS', 'Overall operations management'),
('Management', 'MANAGEMENT', 'Executive management')
ON CONFLICT (department_code) DO NOTHING;

-- ============================================================
-- FUNCTION: Generate Employee Code
-- ============================================================

CREATE OR REPLACE FUNCTION public.generate_employee_code()
RETURNS TEXT AS $$
DECLARE
  new_code TEXT;
  code_exists BOOLEAN;
BEGIN
  LOOP
    new_code := 'CCEMP' || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
    SELECT EXISTS(SELECT 1 FROM public.employee_accounts WHERE employee_code = new_code) INTO code_exists;
    EXIT WHEN NOT code_exists;
  END LOOP;
  RETURN new_code;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- FUNCTION: Generate Employee Slug
-- ============================================================

CREATE OR REPLACE FUNCTION public.generate_employee_slug(p_full_name TEXT, p_employee_code TEXT)
RETURNS TEXT AS $$
DECLARE
  base_slug TEXT;
  final_slug TEXT;
BEGIN
  base_slug := LOWER(REGEXP_REPLACE(p_full_name, '[^a-zA-Z0-9]+', '-', 'g'));
  base_slug := TRIM(BOTH '-' FROM base_slug);
  final_slug := base_slug || '-' || p_employee_code;
  RETURN final_slug;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- FUNCTION: Sync Stock with Main Inventory
-- ============================================================

CREATE OR REPLACE FUNCTION public.sync_employee_stock_to_main_inventory()
RETURNS TRIGGER AS $$
BEGIN
  -- When stock order is fulfilled, reduce main inventory
  IF NEW.status = 'fulfilled' AND OLD.status != 'fulfilled' THEN
    -- Update product stock in main products table
    UPDATE public.products p
    SET 
      hostel_stock = hostel_stock - COALESCE(
        (SELECT SUM(quantity) 
         FROM public.employee_stock_order_items 
         WHERE stock_order_id = NEW.id 
         AND product_id = p.id), 0
      )
    WHERE id IN (
      SELECT product_id 
      FROM public.employee_stock_order_items 
      WHERE stock_order_id = NEW.id
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sync_stock_on_fulfillment
  AFTER UPDATE ON public.employee_stock_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_employee_stock_to_main_inventory();

-- ============================================================
-- COMMENTS
-- ============================================================

COMMENT ON TABLE public.employee_accounts IS 'Isolated employee accounts - completely separate from customer/admin auth';
COMMENT ON TABLE public.employee_stock_orders IS 'Internal stock orders by employees - prices hidden from normal employees';
COMMENT ON TABLE public.employee_audit_trail IS 'Complete audit trail for all employee actions';
COMMENT ON FUNCTION public.sync_employee_stock_to_main_inventory() IS 'Automatically syncs employee stock orders with main inventory';
