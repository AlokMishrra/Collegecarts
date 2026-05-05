-- Add the one missing category found in products
insert into public.categories (id, name, description, is_active, display_order)
values ('693ff3d9360832e72f82b90f', 'Cooked Meals', 'Cooked maggie, meals and combos', true, 30)
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  is_active = excluded.is_active;
