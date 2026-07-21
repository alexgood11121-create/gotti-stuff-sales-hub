
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS sizes jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS sales_count integer NOT NULL DEFAULT 0;

ALTER TABLE public.sale_items
  ADD COLUMN IF NOT EXISTS variant_size text;

CREATE OR REPLACE FUNCTION public.apply_sale_item()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.product_id IS NOT NULL THEN
    UPDATE public.products
      SET stock = stock - NEW.qty,
          sales_count = sales_count + NEW.qty
      WHERE id = NEW.product_id;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.apply_sale_item() FROM PUBLIC, anon, authenticated;
