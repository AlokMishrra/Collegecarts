-- Seed categories from Base44 CSV data
-- These IDs match the category_id values in the uploaded products CSV

insert into public.categories (id, name, description, is_active, display_order) values
  ('6885bbf34725104adf64ac85', 'Snacks & Chips',      'Chips, namkeen and snacks',         true, 1),
  ('69ecf8631f9e8c5717d4eb2c', 'Biscuits & Cookies',  'Biscuits, cookies and wafers',      true, 2),
  ('69c616f922ef4048088e9aeb', 'Noodles & Instant',   'Maggi, ramen and instant noodles',  true, 3),
  ('693d680fa08e8413d81fc186', 'Cold Drinks',         'Soft drinks and cold beverages',    true, 4),
  ('693aa927980f2ac97f054e74', 'Hot Beverages',       'Tea, coffee and hot drinks',        true, 5),
  ('693d52ffe5ceabf40fd93861', 'Roti & Paratha',      'Roti, paratha and Indian breads',   true, 6),
  ('6943d0d63ec530b4b953ca51', 'Paneer Dishes',       'Paneer curries and dishes',         true, 7),
  ('693d1437268386acee4a3997', 'Veg Curries',         'Vegetable curries and sabzi',       true, 8),
  ('6942424bf8d5002de71353ea', 'Rice & Pulao',        'Rice, pulao and rice dishes',       true, 9),
  ('693d91828cc8803c4762153a', 'Pizza',               'Pizzas and Italian food',           true, 10),
  ('693aaf17c3da1ef8fa5024a1', 'Chinese & Fast Food', 'Noodles, manchurian and fast food', true, 11),
  ('693c066fe0adb39df74bf7ac', 'Shakes & Juices',     'Milkshakes and fruit juices',       true, 12),
  ('693d6d83aa86e9de5743eb04', 'Burgers',             'Burgers and sandwiches',            true, 13),
  ('694530e2454833b1bee327da', 'Pasta',               'Pasta and Italian dishes',          true, 14),
  ('69452e94975c681520ea7484', 'French Fries',        'Fries and potato snacks',           true, 15),
  ('6945278f5e36dc769c62e13f', 'Raita & Dahi',        'Raita, dahi and yogurt dishes',     true, 16),
  ('694534a76d0e57387afad1fa', 'Sandwiches',          'Grilled and toasted sandwiches',    true, 17),
  ('694537aac2def1eeaf0b4224', 'Chaat & Snacks',      'Chaat, bhature and street food',    true, 18),
  ('69467ac215fedb333ee523e6', 'Biryani',             'Veg and non-veg biryani',           true, 19),
  ('693a77ef1a391d19b5f53055', 'South Indian',        'Dosa, idli and south Indian food',  true, 20),
  ('6988b753b6208c1c525237ff', 'Gifts & Combos',      'Gift combos and special packs',     true, 21),
  ('698b776f5315bfa282461aec', 'Special Combos',      'Night study and special combos',    true, 22),
  ('69a59870af23a62108fba2b9', 'Holi Special',        'Holi festival special items',       true, 23),
  ('6885bbf34725104adf64ac84', 'Dairy & Eggs',        'Milk, dahi and dairy products',     true, 24),
  ('69d13a99b7111df5ada61f02', 'Household',           'Household and daily use items',     true, 25),
  ('69b99894b88096cd0df2e20d', 'Personal Care',       'Personal hygiene and care',         true, 26),
  ('69cdfbeec4ef67798648ccbb', 'Sweets',              'Mithai and Indian sweets',          true, 27)
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  is_active = excluded.is_active,
  display_order = excluded.display_order;
