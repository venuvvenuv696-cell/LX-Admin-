-- 1. Create Products Table (if not exists)
CREATE TABLE IF NOT EXISTS public.products (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    price numeric NOT NULL,
    stock integer NOT NULL DEFAULT 0,
    image_url text,
    category text NOT NULL,
    status text NOT NULL DEFAULT 'available',
    description text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Create Orders Table (if not exists)
CREATE TABLE IF NOT EXISTS public.orders (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    customer_name text NOT NULL,
    email text NOT NULL,
    phone text NOT NULL,
    city text NOT NULL,
    address text NOT NULL,
    product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
    product_variant text, -- Nullable to support customer website which uses product_name
    product_name text,    -- Support direct website placements
    quantity integer NOT NULL DEFAULT 1,
    total_price numeric NOT NULL,
    status text NOT NULL DEFAULT 'pending',
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Create Profiles Table (for Login System)
CREATE TABLE IF NOT EXISTS public.profiles (
    id uuid REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
    email text UNIQUE NOT NULL,
    full_name text,
    avatar_url text,
    role text DEFAULT 'member',
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Enable RLS
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 5. Set up Policies (Public full access for this prototype)
DROP POLICY IF EXISTS "Public full access products" ON public.products;
CREATE POLICY "Public full access products" ON public.products FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public full access orders" ON public.orders;
CREATE POLICY "Public full access orders" ON public.orders FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public full access profiles" ON public.profiles;
CREATE POLICY "Public full access profiles" ON public.profiles FOR ALL TO public USING (true) WITH CHECK (true);

-- 6. Trigger for New User Profiles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (new.id, new.email, new.raw_user_meta_data->>'full_name');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 7. Enable Realtime (Idempotent approach)
DO $$
BEGIN
    -- Create publication if not exists
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        CREATE PUBLICATION supabase_realtime;
    END IF;
    
    -- Add tables only if they are not already members
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'products'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.products;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'orders'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
    END IF;
EXCEPTION
    WHEN others THEN NULL;
END $$;

-- 8. Data Migration: Update categories to match UI labels
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_category_check;
UPDATE public.products SET category = '3D Machine' WHERE category IN ('3D Printing Manufacturing');
UPDATE public.products SET category = 'VMC Machine' WHERE category IN ('VMC Machining Manufacturing', 'DMC Machine');
UPDATE public.products SET category = 'VMC Machining Parts' WHERE category IN ('VMC Machining Parts', 'DMC Machining Parts');
ALTER TABLE public.products ADD CONSTRAINT products_category_check 
CHECK (category IN ('3D Printing Parts', 'VMC Machining Parts', '3D Machine', 'VMC Machine', 'Filament Shop'));

-- 9. Customized Orders System
CREATE TABLE IF NOT EXISTS public.custom_orders (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    full_name text NOT NULL,
    email_reference text NOT NULL,
    secure_line text,
    project_name text,
    details text,
    file_url text, -- To store the link to the uploaded design
    status text DEFAULT 'pending' CHECK (status IN ('pending', 'reviewing', 'quoted', 'in_production', 'delivered', 'cancelled')),
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.custom_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public full access custom orders" ON public.custom_orders;
CREATE POLICY "Public full access custom orders" ON public.custom_orders FOR ALL TO public USING (true) WITH CHECK (true);

-- Enable Realtime for custom orders
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'custom_orders'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.custom_orders;
    END IF;
EXCEPTION
    WHEN others THEN NULL;
END $$;
