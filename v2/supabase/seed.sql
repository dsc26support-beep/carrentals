-- Development seed. Vehicles and public settings only.
--
-- There are no customer rows here and there never will be. Seed data lives in
-- a public repository; customer data does not go in public repositories.

-- The fleet as the owner has confirmed it: five cars, all automatic, all $60.
-- The sixth car is deliberately absent until its details are known — V1 shipped
-- a card reading "Sixth car" with no photograph for weeks.
insert into public.vehicles
  (slug, name, plate, price_per_day, currency, is_available, is_published,
   seats, transmission, fuel, air_conditioning, specifications, display_order)
values
  ('nissan-march',      'Nissan March',        'KLTA 6113', 60.00, 'AUD', true, true,
   5, 'automatic', 'petrol', true, '["5 doors","Hatchback boot"]'::jsonb, 10),

  ('honda-fit',         'Honda Fit',           'KLTA 6991', 60.00, 'AUD', true, true,
   5, 'automatic', 'petrol', true, '["5 doors","Deep rear load space"]'::jsonb, 20),

  ('toyota-vitz-6221',  'Toyota Vitz — white', 'KLTA 6221', 60.00, 'AUD', true, true,
   5, 'automatic', 'petrol', true, '["2016 model","White","5 doors"]'::jsonb, 30),

  ('toyota-vitz-6234',  'Toyota Vitz — white', 'KLTA 6234', 60.00, 'AUD', true, true,
   5, 'automatic', 'petrol', true, '["2016 model","White","5 doors"]'::jsonb, 40),

  ('toyota-vitz-6247',  'Toyota Vitz — gray',  'KLTA 6247', 60.00, 'AUD', true, true,
   5, 'automatic', 'petrol', true, '["2017 model","Gray","5 doors"]'::jsonb, 50)
on conflict (slug) do nothing;

-- Business details. One copy, so correcting a number is one edit — V1 had the
-- phone numbers in twenty places across two files.
insert into public.site_settings (key, value, description, is_public) values
  ('business.name',            '"Tenana Rentals"'::jsonb,
   'Shown in the header, the footer and structured data.', true),
  ('business.phone_primary',   '"+68673053005"'::jsonb,
   'Main number. Call buttons everywhere on the site.', true),
  ('business.phone_secondary', '"+68673039089"'::jsonb,
   'Second number. Also the WhatsApp number.', true),
  ('business.whatsapp',        '"68673039089"'::jsonb,
   'Digits only, for wa.me links.', true),
  ('business.messenger_url',   '"https://www.facebook.com/share/1GNQMcx1cg/"'::jsonb,
   'Messenger button. Leave empty to hide the button entirely.', true),
  ('business.email',           '"ruuka4climatechange@gmail.com"'::jsonb,
   'Shown under Contact.', true),
  ('business.address',         '"Bikenibeu, South Tarawa, Kiribati"'::jsonb,
   'Must match the Google Business Profile exactly.', true),
  ('business.currency',        '"AUD"'::jsonb,
   'Rates are quoted in Australian dollars.', true)
on conflict (key) do nothing;
