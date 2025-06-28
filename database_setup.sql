-- Create delivery_personnel table with zipcode column
CREATE TABLE IF NOT EXISTS delivery_personnel (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    zipcode TEXT NOT NULL,
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

-- Insert some sample delivery personnel data (optional)
-- INSERT INTO delivery_personnel (user_id, email, name, phone, zipcode, status) VALUES
-- ('sample-user-id-1', 'delivery1@example.com', 'John Doe', '+1234567890', '12345', 'active'),
-- ('sample-user-id-2', 'delivery2@example.com', 'Jane Smith', '+1234567891', '54321', 'active'); 