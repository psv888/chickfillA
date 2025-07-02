-- Create delivery_personnel table with zipcode column
CREATE TABLE IF NOT EXISTS delivery_personnel (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT NOT NULL,
    phone_number TEXT NOT NULL,
    zipcode TEXT NOT NULL,
    is_online BOOLEAN DEFAULT false,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on user_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_delivery_personnel_user_id ON delivery_personnel(user_id);

-- Create index on zipcode for location-based queries
CREATE INDEX IF NOT EXISTS idx_delivery_personnel_zipcode ON delivery_personnel(zipcode);

-- Create index on status for filtering active delivery personnel
CREATE INDEX IF NOT EXISTS idx_delivery_personnel_status ON delivery_personnel(status);

-- Enable Row Level Security (RLS)
ALTER TABLE delivery_personnel ENABLE ROW LEVEL SECURITY;

-- Create policies for delivery_personnel table
-- Policy for delivery personnel to view their own profile
CREATE POLICY "Delivery personnel can view own profile" ON delivery_personnel
    FOR SELECT USING (auth.uid() = user_id);

-- Policy for delivery personnel to update their own profile
CREATE POLICY "Delivery personnel can update own profile" ON delivery_personnel
    FOR UPDATE USING (auth.uid() = user_id);

-- Policy for admins to view all delivery personnel
CREATE POLICY "Admins can view all delivery personnel" ON delivery_personnel
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.user_id = auth.uid() 
            AND users.role = 'admin'
        )
    );

-- Policy for admins to manage delivery personnel
CREATE POLICY "Admins can manage delivery personnel" ON delivery_personnel
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.user_id = auth.uid() 
            AND users.role = 'admin'
        )
    );

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to automatically update updated_at column
CREATE TRIGGER update_delivery_personnel_updated_at 
    BEFORE UPDATE ON delivery_personnel 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Add zipcode column to users table for location-based filtering
-- This will add the column if it doesn't exist, or do nothing if it already exists
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'zipcode'
    ) THEN
        ALTER TABLE users ADD COLUMN zipcode TEXT;
        -- Create index on zipcode for faster location-based queries
        CREATE INDEX IF NOT EXISTS idx_users_zipcode ON users(zipcode);
        RAISE NOTICE 'Added zipcode column to users table';
    ELSE
        RAISE NOTICE 'zipcode column already exists in users table';
    END IF;
END $$;

-- Add delivery_person_location column to orders table for real-time tracking
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'orders' AND column_name = 'delivery_person_location'
    ) THEN
        ALTER TABLE orders ADD COLUMN delivery_person_location GEOMETRY(POINT, 4326);
        -- Create spatial index for faster location queries
        CREATE INDEX IF NOT EXISTS idx_orders_delivery_location ON orders USING GIST (delivery_person_location);
        RAISE NOTICE 'Added delivery_person_location column to orders table';
    ELSE
        RAISE NOTICE 'delivery_person_location column already exists in orders table';
    END IF;
END $$;

-- Create function to get order with GeoJSON location data
CREATE OR REPLACE FUNCTION get_order_with_geojson_location(order_id_param BIGINT)
RETURNS TABLE (
    id BIGINT,
    user_id UUID,
    name TEXT,
    phone TEXT,
    address TEXT,
    items JSONB,
    total_amount DECIMAL,
    status TEXT,
    delivery_person_id UUID,
    assignment_status TEXT,
    declined_delivery_person_ids TEXT,
    assignment_time TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    delivery_person_location JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        o.id,
        o.user_id,
        o.name,
        o.phone,
        o.address,
        o.items,
        o.total_amount,
        o.status,
        o.delivery_person_id,
        o.assignment_status,
        o.declined_delivery_person_ids,
        o.assignment_time,
        o.created_at,
        o.updated_at,
        CASE 
            WHEN o.delivery_person_location IS NOT NULL 
            THEN ST_AsGeoJSON(o.delivery_person_location)::JSONB
            ELSE NULL
        END as delivery_person_location
    FROM orders o
    WHERE o.id = order_id_param;
END;
$$ LANGUAGE plpgsql;

-- Migration script to update existing delivery_personnel table if needed
DO $$ 
BEGIN
    -- Check if old column names exist and migrate them
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'delivery_personnel' AND column_name = 'name'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'delivery_personnel' AND column_name = 'full_name'
    ) THEN
        ALTER TABLE delivery_personnel RENAME COLUMN name TO full_name;
        RAISE NOTICE 'Migrated name column to full_name in delivery_personnel table';
    END IF;
    
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'delivery_personnel' AND column_name = 'phone'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'delivery_personnel' AND column_name = 'phone_number'
    ) THEN
        ALTER TABLE delivery_personnel RENAME COLUMN phone TO phone_number;
        RAISE NOTICE 'Migrated phone column to phone_number in delivery_personnel table';
    END IF;
    
    -- Add is_online column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'delivery_personnel' AND column_name = 'is_online'
    ) THEN
        ALTER TABLE delivery_personnel ADD COLUMN is_online BOOLEAN DEFAULT false;
        RAISE NOTICE 'Added is_online column to delivery_personnel table';
    END IF;
END $$;

-- Insert some sample delivery personnel data (optional)
-- INSERT INTO delivery_personnel (user_id, email, full_name, phone_number, zipcode, status, is_online) VALUES
-- ('sample-user-id-1', 'delivery1@example.com', 'John Doe', '+1234567890', '12345', 'active', false),
-- ('sample-user-id-2', 'delivery2@example.com', 'Jane Smith', '+1234567891', '54321', 'active', false); 