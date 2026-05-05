-- Assign admin role to mahiisingh070@gmail.com

-- First, find the user ID
DO $$
DECLARE
    user_id_var UUID;
BEGIN
    -- Get the user ID from auth.users
    SELECT id INTO user_id_var
    FROM auth.users
    WHERE email = 'mahiisingh070@gmail.com';

    -- If user exists, update their role in users table
    IF user_id_var IS NOT NULL THEN
        -- Update role in users table
        UPDATE users
        SET role = 'admin'
        WHERE id = user_id_var;

        RAISE NOTICE 'Admin role assigned to user ID: %', user_id_var;
    ELSE
        RAISE NOTICE 'User with email mahiisingh070@gmail.com not found';
    END IF;
END $$;

-- Verify the change
SELECT 
    u.id,
    u.email,
    users.role,
    users.full_name
FROM auth.users u
LEFT JOIN users ON users.id = u.id
WHERE u.email = 'mahiisingh070@gmail.com';
