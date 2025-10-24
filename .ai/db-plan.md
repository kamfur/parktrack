# ParkTrack MVP - Supabase Database Schema

## Schema Organization

The database will be organized into the following schemas:
- `public` - Main application tables
- `auth` - Managed by Supabase Auth (users, sessions, etc.)

## Custom Types

```sql
-- Create custom types in public schema
CREATE TYPE public.reservation_status AS ENUM (
  'confirmed',    -- Initial state after creation
  'in_progress',  -- After check-in
  'completed',    -- After check-out
  'cancelled',    -- Cancelled by staff/customer
  'no_show'       -- Customer didn't arrive
);

CREATE TYPE public.payment_status AS ENUM (
  'pending',
  'completed',
  'refunded'
);

CREATE TYPE public.reservation_source AS ENUM (
  'phone',      -- Created by staff via phone
  'walk_in',    -- Created by staff for walk-in customer
  'api'         -- Created via external API
);
```

## Tables

### Core Tables

```sql
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_cron";

-- Main reservations table
CREATE TABLE public.reservations (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  -- Customer information
  last_name text NOT NULL,
  first_name text,
  email text,
  phone text,
  flight_direction text CHECK (flight_direction IN ('departure', 'arrival')),
  license_plate text,
  
  -- Reservation details
  status public.reservation_status NOT NULL DEFAULT 'confirmed',
  source public.reservation_source NOT NULL,
  total_cost decimal(10,2) NOT NULL,
  is_paid boolean NOT NULL DEFAULT false,
  notes text,
  
  -- Planned dates
  planned_check_in timestamptz NOT NULL,
  planned_check_out timestamptz NOT NULL,
  
  -- Actual dates
  actual_check_in timestamptz,
  actual_check_out timestamptz,
  
  -- Metadata (Supabase managed)
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL REFERENCES auth.users(id),
  last_modified_by uuid NOT NULL REFERENCES auth.users(id),
  
  -- Constraints
  CONSTRAINT check_dates CHECK (planned_check_out > planned_check_in),
  CONSTRAINT check_actual_dates CHECK (
    (actual_check_out IS NULL) OR 
    (actual_check_in IS NOT NULL AND actual_check_out > actual_check_in)
  )
);

-- Daily parking occupancy
CREATE TABLE public.daily_occupancy (
  date date PRIMARY KEY,
  occupied_spots integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  CONSTRAINT positive_spots CHECK (occupied_spots >= 0)
);

-- Payments tracking
CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  reservation_id uuid NOT NULL REFERENCES public.reservations(id) ON DELETE CASCADE,
  amount decimal(10,2) NOT NULL,
  status public.payment_status NOT NULL DEFAULT 'pending',
  payment_date timestamptz NOT NULL DEFAULT now(),
  notes text,
  
  -- Metadata (Supabase managed)
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL REFERENCES auth.users(id),
  
  CONSTRAINT positive_amount CHECK (amount > 0)
);
```

### Configuration Tables

```sql
-- Global settings
CREATE TABLE public.settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  description text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NOT NULL REFERENCES auth.users(id)
);

-- Pricing rules
CREATE TABLE public.pricing_rules (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  days_from integer NOT NULL,
  days_to integer NOT NULL,
  price_per_day decimal(10,2) NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  
  -- Metadata (Supabase managed)
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  CONSTRAINT valid_range CHECK (days_to >= days_from),
  CONSTRAINT positive_price CHECK (price_per_day > 0),
  UNIQUE (days_from, days_to)
);

-- Transfer vehicles
CREATE TABLE public.transfer_vehicles (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  license_plate text NOT NULL UNIQUE,
  capacity integer NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  
  -- Metadata (Supabase managed)
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  CONSTRAINT positive_capacity CHECK (capacity > 0)
);
```

## Realtime Subscriptions

Enable realtime for specific tables:

```sql
-- Enable realtime for core tables
ALTER PUBLICATION supabase_realtime ADD TABLE reservations;
ALTER PUBLICATION supabase_realtime ADD TABLE daily_occupancy;
ALTER PUBLICATION supabase_realtime ADD TABLE payments;
```

## Row Level Security (RLS)

```sql
-- Enable RLS on all tables
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_occupancy ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transfer_vehicles ENABLE ROW LEVEL SECURITY;

-- Create policies for authenticated access
CREATE POLICY "Authenticated users can view all reservations"
  ON public.reservations FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert reservations"
  ON public.reservations FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update reservations"
  ON public.reservations FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Similar policies for other tables
CREATE POLICY "Authenticated access"
  ON public.daily_occupancy FOR ALL
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated access"
  ON public.payments FOR ALL
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated access"
  ON public.settings FOR ALL
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated access"
  ON public.pricing_rules FOR ALL
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated access"
  ON public.transfer_vehicles FOR ALL
  TO authenticated
  USING (true);
```

## Database Functions

```sql
-- Automatically update updated_at columns
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create updated_at triggers for all tables
CREATE TRIGGER handle_updated_at
  BEFORE UPDATE ON public.reservations
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Similar triggers for other tables with updated_at

-- Calculate total cost based on pricing rules
CREATE OR REPLACE FUNCTION public.calculate_total_cost(
  p_check_in timestamptz,
  p_check_out timestamptz
) RETURNS decimal(10,2) AS $$
DECLARE
  v_total_days integer;
  v_total_cost decimal(10,2) := 0;
  v_rule RECORD;
BEGIN
  v_total_days := CEIL(EXTRACT(EPOCH FROM (p_check_out - p_check_in)) / 86400);
  
  FOR v_rule IN 
    SELECT * FROM public.pricing_rules 
    WHERE is_active = true 
    ORDER BY days_from
  LOOP
    IF v_total_days >= v_rule.days_from THEN
      v_total_cost := v_total_cost + (
        LEAST(
          v_total_days - v_rule.days_from + 1,
          v_rule.days_to - v_rule.days_from + 1
        ) * v_rule.price_per_day
      );
    END IF;
  END LOOP;
  
  RETURN v_total_cost;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update daily_occupancy
CREATE OR REPLACE FUNCTION public.update_daily_occupancy()
RETURNS TRIGGER AS $$
BEGIN
  -- Implementation will be added after confirming exact business logic
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create occupancy trigger
CREATE TRIGGER trg_update_occupancy
  AFTER INSERT OR UPDATE OR DELETE ON public.reservations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_daily_occupancy();

-- Update reservation cost on date changes
CREATE OR REPLACE FUNCTION public.update_reservation_cost()
RETURNS TRIGGER AS $$
BEGIN
  IF (NEW.planned_check_in != OLD.planned_check_in) OR 
     (NEW.planned_check_out != OLD.planned_check_out) THEN
    NEW.total_cost := public.calculate_total_cost(NEW.planned_check_in, NEW.planned_check_out);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_update_cost
  BEFORE UPDATE ON public.reservations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_reservation_cost();
```

## Data Retention

```sql
-- Schedule cleanup of old customer data (using pg_cron)
SELECT cron.schedule(
  'cleanup-old-reservations',
  '0 0 * * *', -- Run daily at midnight
  $$
    UPDATE public.reservations
    SET 
      first_name = NULL,
      email = NULL,
      phone = NULL,
      license_plate = NULL
    WHERE 
      status = 'completed' 
      AND actual_check_out < now() - interval '1 month'
  $$
);
```

## Initial Data

```sql
-- Insert default settings
INSERT INTO public.settings (key, value, description) VALUES
  ('total_parking_spots', '100', 'Total number of parking spots available'),
  ('reservation_buffer', '30', 'Buffer time in minutes between reservations'),
  ('default_currency', 'PLN', 'Default currency for payments'),
  ('retention_period_days', '30', 'Number of days to keep customer data');

-- Insert initial pricing rules
INSERT INTO public.pricing_rules (days_from, days_to, price_per_day) VALUES
  (1, 7, 30.00),    -- First week
  (8, 14, 25.00),   -- Second week
  (15, 999, 20.00); -- Beyond two weeks
```

## Notes

1. **Supabase Specific Features**
   - All tables are in the `public` schema
   - Auth is handled by Supabase Auth (`auth` schema)
   - RLS policies are configured for authenticated access
   - Realtime enabled for key tables
   - Functions use `SECURITY DEFINER` for proper RLS bypass

2. **Data Types**
   - Using Supabase recommended types (e.g., `uuid`, `timestamptz`)
   - JSONB for flexible configuration storage
   - Custom ENUMs for strict type checking

3. **Security**
   - RLS enabled on all tables
   - Policies defined for authenticated access
   - Data retention automated via pg_cron

4. **Performance**
   - Appropriate indexes will be created by Supabase
   - Denormalized structure for MVP simplicity
   - Realtime subscriptions for live updates

5. **Maintenance**
   - Automated data cleanup
   - Triggers for timestamp management
   - Cascading deletes where appropriate

6. **Future Considerations**
   - Schema supports future customer accounts
   - Extensible for online payments
   - Ready for role-based access control