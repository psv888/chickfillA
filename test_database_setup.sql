-- Test script to verify database setup for location tracking

-- 1. Check if the delivery_person_location column exists in orders table
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'orders' 
AND column_name = 'delivery_person_location';

-- 2. Check if the get_order_with_geojson_location function exists
SELECT 
    routine_name, 
    routine_type
FROM information_schema.routines 
WHERE routine_name = 'get_order_with_geojson_location';

-- 3. Check delivery_personnel table structure
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'delivery_personnel'
ORDER BY ordinal_position;

-- 4. Test the get_order_with_geojson_location function with a sample order
-- (Replace 1 with an actual order ID from your database)
SELECT * FROM get_order_with_geojson_location(1);

-- 5. Check if there are any orders with delivery_person_location data
SELECT 
    id,
    status,
    delivery_person_id,
    delivery_person_location IS NOT NULL as has_location
FROM orders 
WHERE delivery_person_location IS NOT NULL
LIMIT 5;

-- 6. Check delivery personnel online status
SELECT 
    id,
    full_name,
    is_online,
    status
FROM delivery_personnel
LIMIT 5; 