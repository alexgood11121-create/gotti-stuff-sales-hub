
-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM ('admin', 'cashier');
CREATE TYPE public.payment_method AS ENUM ('cash', 'card', 'mixed');
CREATE TYPE public.movement_type AS ENUM ('income', 'expense');
CREATE TYPE public.sale_status AS ENUM ('open', 'paid', 'cancelled');

-- ============ BRANCHES ============
CREATE TABLE public.branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.branches TO authenticated;
GRANT ALL ON public.branches TO service_role;
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nickname TEXT UNIQUE,
  email TEXT,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ============ USER_ROLES ============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.current_user_branch()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT branch_id FROM public.profiles WHERE id = auth.uid()
$$;

-- ============ CATEGORIES ============
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  color TEXT DEFAULT '#4b5563',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO authenticated;
GRANT ALL ON public.categories TO service_role;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- ============ PRODUCTS ============
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  image_url TEXT,
  cost_price NUMERIC(14,2) NOT NULL DEFAULT 0,
  sale_price NUMERIC(14,2) NOT NULL DEFAULT 0,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  stock NUMERIC(14,3) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- ============ STOCK MOVEMENTS (приход/расход) ============
CREATE TABLE public.stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type movement_type NOT NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  qty NUMERIC(14,3),
  unit_price NUMERIC(14,2),
  amount NUMERIC(14,2) NOT NULL,
  note TEXT,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_movements TO authenticated;
GRANT ALL ON public.stock_movements TO service_role;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

-- ============ SALES ============
CREATE TABLE public.sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_uuid UUID UNIQUE NOT NULL,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  cashier_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  total NUMERIC(14,2) NOT NULL,
  cash_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  card_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  given_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  change_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  payment_method payment_method NOT NULL,
  status sale_status NOT NULL DEFAULT 'paid',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales TO authenticated;
GRANT ALL ON public.sales TO service_role;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;

-- ============ SALE ITEMS ============
CREATE TABLE public.sale_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  qty NUMERIC(14,3) NOT NULL,
  unit_price NUMERIC(14,2) NOT NULL,
  cost_price NUMERIC(14,2) NOT NULL DEFAULT 0,
  total NUMERIC(14,2) NOT NULL
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sale_items TO authenticated;
GRANT ALL ON public.sale_items TO service_role;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;

-- ============ POLICIES ============
-- branches
CREATE POLICY "admin manages branches" ON public.branches FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "cashier reads branches" ON public.branches FOR SELECT
  USING (public.has_role(auth.uid(), 'cashier'));

-- profiles
CREATE POLICY "user reads own profile" ON public.profiles FOR SELECT
  USING (id = auth.uid());
CREATE POLICY "user updates own profile" ON public.profiles FOR UPDATE
  USING (id = auth.uid());
CREATE POLICY "admin reads all profiles" ON public.profiles FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin manages profiles" ON public.profiles FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- user_roles
CREATE POLICY "user reads own roles" ON public.user_roles FOR SELECT
  USING (user_id = auth.uid());
CREATE POLICY "admin reads all roles" ON public.user_roles FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- categories (все читают, только админ пишет)
CREATE POLICY "auth reads categories" ON public.categories FOR SELECT
  USING (auth.uid() IS NOT NULL);
CREATE POLICY "admin manages categories" ON public.categories FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- products
CREATE POLICY "auth reads products" ON public.products FOR SELECT
  USING (auth.uid() IS NOT NULL);
CREATE POLICY "admin manages products" ON public.products FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- stock_movements
CREATE POLICY "admin reads all movements" ON public.stock_movements FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "cashier reads own branch movements" ON public.stock_movements FOR SELECT
  USING (public.has_role(auth.uid(), 'cashier') AND branch_id = public.current_user_branch());
CREATE POLICY "auth inserts movements" ON public.stock_movements FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND user_id = auth.uid());
CREATE POLICY "admin manages movements" ON public.stock_movements FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- sales
CREATE POLICY "admin reads all sales" ON public.sales FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "cashier reads own branch sales" ON public.sales FOR SELECT
  USING (public.has_role(auth.uid(), 'cashier') AND branch_id = public.current_user_branch());
CREATE POLICY "cashier inserts own sales" ON public.sales FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND cashier_id = auth.uid());
CREATE POLICY "admin manages sales" ON public.sales FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- sale_items (доступ через родительский чек)
CREATE POLICY "read items via sale" ON public.sale_items FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.sales s WHERE s.id = sale_id
    AND (public.has_role(auth.uid(), 'admin')
      OR (public.has_role(auth.uid(), 'cashier') AND s.branch_id = public.current_user_branch()))));
CREATE POLICY "insert items via sale" ON public.sale_items FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.sales s WHERE s.id = sale_id
    AND (s.cashier_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))));
CREATE POLICY "admin manages items" ON public.sale_items FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============ TRIGGERS ============
-- Автосоздание профиля + роль (первый пользователь = admin, остальные = cashier)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_count INT;
  assigned_role app_role;
BEGIN
  INSERT INTO public.profiles (id, email, nickname)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'nickname', split_part(NEW.email, '@', 1)));

  SELECT COUNT(*) INTO user_count FROM public.user_roles WHERE role = 'admin';
  IF user_count = 0 THEN
    assigned_role := 'admin';
  ELSE
    assigned_role := COALESCE((NEW.raw_user_meta_data->>'role')::app_role, 'cashier');
  END IF;

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, assigned_role);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Обновление остатков при движении
CREATE OR REPLACE FUNCTION public.apply_stock_movement()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.product_id IS NOT NULL AND NEW.qty IS NOT NULL AND NEW.type = 'income' THEN
    UPDATE public.products SET stock = stock + NEW.qty WHERE id = NEW.product_id;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_stock_movement
  AFTER INSERT ON public.stock_movements
  FOR EACH ROW EXECUTE FUNCTION public.apply_stock_movement();

-- Уменьшение остатков при продаже
CREATE OR REPLACE FUNCTION public.apply_sale_item()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.product_id IS NOT NULL THEN
    UPDATE public.products SET stock = stock - NEW.qty WHERE id = NEW.product_id;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_sale_item
  AFTER INSERT ON public.sale_items
  FOR EACH ROW EXECUTE FUNCTION public.apply_sale_item();
