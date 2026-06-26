-- Supabase (Postgres) schema and seed data for Alyna project

-- Pages table: store simple page-level content
CREATE TABLE IF NOT EXISTS pages (
  id SERIAL PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  title TEXT,
  hero_image TEXT,
  hero_heading TEXT,
  hero_subtext TEXT,
  content JSONB,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Accommodations / Rooms
CREATE TABLE IF NOT EXISTS accommodations (
  id SERIAL PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  price NUMERIC(12,2),
  tags TEXT[],
  images TEXT[],
  links TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE accommodations
  ADD COLUMN IF NOT EXISTS price NUMERIC(12,2);

-- Guests and bookings for the direct React reservation flow
CREATE TABLE IF NOT EXISTS guests (
  id BIGSERIAL PRIMARY KEY,
  full_name VARCHAR(255) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  nationality VARCHAR(100),
  email VARCHAR(255),
  ref_name VARCHAR(255),
  ref_phone VARCHAR(20),
  id_type VARCHAR(20),
  id_number VARCHAR(50),
  image_front TEXT,
  image_back TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bookings (
  id BIGSERIAL PRIMARY KEY,
  guest_id BIGINT REFERENCES guests(id),
  room_id BIGINT,
  checkin_date DATE NOT NULL,
  checkout_date DATE NOT NULL,
  adults INTEGER DEFAULT 1,
  children INTEGER DEFAULT 0,
  room_rate NUMERIC(10,2),
  ac_choice VARCHAR(20),
  base_amount NUMERIC(10,2),
  discount_type VARCHAR(20),
  discount_amount NUMERIC(10,2),
  discount_reason TEXT,
  payment_method TEXT,
  transaction_number TEXT,
  total_amount NUMERIC(10,2),
  advance_amount NUMERIC(10,2) DEFAULT 0,
  due_amount NUMERIC(10,2),
  notes TEXT,
  is_reservation BOOLEAN DEFAULT FALSE,
  created_by UUID,
  created_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT chk_dates CHECK (checkout_date > checkin_date)
);

-- Optional calendar table for check-in / check-out ranges
CREATE TABLE IF NOT EXISTS calendar (
  id BIGSERIAL PRIMARY KEY,
  booking_id BIGINT REFERENCES bookings(id) ON DELETE CASCADE,
  room_id BIGINT,
  check_in DATE NOT NULL,
  check_out DATE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Features / facilities
CREATE TABLE IF NOT EXISTS features (
  id SERIAL PRIMARY KEY,
  icon TEXT,
  label TEXT,
  group_name TEXT,
  meta JSONB
);

-- Facilities (structured table for home facilities)
CREATE TABLE IF NOT EXISTS facilities (
  id SERIAL PRIMARY KEY,
  page_id INTEGER REFERENCES pages(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  images TEXT[],
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Seed some example facilities for the 'home' page
INSERT INTO facilities (page_id, title, description, images)
SELECT p.id, 'Poolside Villa', 'Private villa with pool access and sea views.', ARRAY['uploads/poolside_1.jpg','uploads/poolside_2.jpg','uploads/poolside_3.jpg','uploads/poolside_4.jpg']
FROM pages p
WHERE p.slug = 'home' AND NOT EXISTS (
  SELECT 1 FROM facilities f WHERE f.page_id = p.id AND f.title = 'Poolside Villa'
);

INSERT INTO facilities (page_id, title, description, images)
SELECT p.id, 'Garden Suite', 'Quiet suite overlooking landscaped gardens.', ARRAY['uploads/garden_1.jpg','uploads/garden_2.jpg','uploads/garden_3.jpg','uploads/garden_4.jpg']
FROM pages p
WHERE p.slug = 'home' AND NOT EXISTS (
  SELECT 1 FROM facilities f WHERE f.page_id = p.id AND f.title = 'Garden Suite'
);

-- Testimonials
CREATE TABLE IF NOT EXISTS testimonials (
  id SERIAL PRIMARY KEY,
  quote TEXT NOT NULL,
  name TEXT,
  role TEXT,
  avatar TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Gallery images
CREATE TABLE IF NOT EXISTS gallery_images (
  id SERIAL PRIMARY KEY,
  label TEXT,
  url TEXT NOT NULL
);

-- Contact info (single row expected)
CREATE TABLE IF NOT EXISTS contact_info (
  id SERIAL PRIMARY KEY,
  resort_name TEXT,
  address TEXT,
  phones TEXT[],
  email TEXT,
  map_url TEXT,
  social JSONB,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Seed data
-- Pages: Home (hero + content pointer)
INSERT INTO pages (slug, title, hero_image, hero_heading, hero_subtext, content)
VALUES (
  'home',
  'Home',
  'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1200&q=80',
  'Wake Up Where the Hills Meet the Sea',
  'Comfort for Every Traveler, From Budget to Luxury at the heart of the Sitakund.',
  '{"sections": ["popular_accommodations", "features", "testimonials", "map"]}'::jsonb
)
ON CONFLICT (slug) DO NOTHING;

-- About page content (from Features component)
INSERT INTO pages (slug, title, content, hero_image, hero_heading)
VALUES (
  'about',
  'About',
  '{"description": "Attractively ornamented with complete marble & tiles and luxurious fabrics, our two prominent Presidential suites are 1900 1800 sq ft. These two unique suites boast an octagonal living area, the sides of which are fitted with windows overlooking the sea, the Bay of Bengal for the best views in the city.", "feature_images": ["https://images.unsplash.com/photo-1485846234645-a62644f84728?w=150&q=80","https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=150&q=80","https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=150&q=80"]}'::jsonb,
  'https://images.unsplash.com/photo-1558030006-450675393462?w=600&q=80',
  'What special we offer to our guests'
)
ON CONFLICT (slug) DO NOTHING;

-- Accommodations (seed from PopularAccommodations)
INSERT INTO accommodations (slug, title, description, price, tags, images, links)
VALUES
('room1', 'The Serena Suite', 'Retro-spacious. For a smooth family retreat.', 4500, ARRAY['Luxury','Comfort'], ARRAY['https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=600&q=80','https://images.unsplash.com/photo-1566665797739-1674de7a421a?w=600&q=80','https://images.unsplash.com/photo-1590490360182-c33d57733427?w=600&q=80'], '/room'),
('room2', 'The Explorer''s Hideaway', 'Save on stay with comfort.', 2800, ARRAY['Standard','Budget'], ARRAY['https://images.unsplash.com/photo-1618773928121-c32242e63f39?w=600&q=80','https://images.unsplash.com/photo-1566665797739-1674de7a421a?w=600&q=80','https://images.unsplash.com/photo-1590490360182-c33d57733427?w=600&q=80'], '/room2')
ON CONFLICT (slug) DO NOTHING;

-- Rooms detailed pages (RoomDetails and RoomDetails2)
INSERT INTO pages (slug, title, content)
VALUES
('room1-detail', 'The Serene Suite', '{"images": ["https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=600&q=80","https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=600&q=80","https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=600&q=80"], "description": "Attractively ornamented with complete marble & tiles and luxurious fabrics, our two prominent Presidential suites are 1900 & 1800 sq ft. These two unique suites boast an octagonal living area, the sides of which are fitted with windows overlooking the sea."}'::jsonb),
('room2-detail', 'Explorer Base Camp', '{"images": ["https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=600&q=80","https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=600&q=80","https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=600&q=80"], "description": "Attractively ornamented with complete marble & tiles and luxurious fabrics, our two prominent Presidential suites are 1900 & 1800 sq ft. These two unique suites boast an octagonal living area, the sides of which are fitted with windows overlooking the sea."}'::jsonb)
ON CONFLICT (slug) DO NOTHING;

-- Features / amenity items
INSERT INTO features (icon, label, group_name)
VALUES
('📶','Free Internet Access','features'),
('📱','Digital Check-In','features'),
('🅿️','Free Parking','features'),
('🏊','Swimming','features'),
('🎬','Outdoor movie','features'),
('🚶','Outdoor Activity','amenities'),
('🍽️','Restaurant On-Site','amenities')
ON CONFLICT DO NOTHING;

-- Testimonials
INSERT INTO testimonials (quote, name, role, avatar)
VALUES
('Wake up where the hills meet the sea. Comfort for every traveler from budget to luxury at the top of Sitakund.','Babilik Ahmed','Designer, SEO Agency','https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face'),
('An unforgettable experience. The views, the service, everything was perfect. We will definitely be back!','Sarun Ahmad','Travel Blogger', NULL),
('The best resort we have stayed at. Family-friendly and the staff went above and beyond.','Maria Johnson','Family Traveler', NULL)
ON CONFLICT DO NOTHING;

-- Gallery images
INSERT INTO gallery_images (label, url)
VALUES
('Lobby','https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=600'),
('Bedroom','https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=600'),
('Garden','https://images.unsplash.com/photo-1551882547-ff43c6382636?auto=format&fit=crop&w=600'),
('Lobby 2','https://images.unsplash.com/photo-1582719478250-c89cae4df85b?auto=format&fit=crop&w=600'),
('Bedroom 2','https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?auto=format&fit=crop&w=600')
ON CONFLICT DO NOTHING;

-- Contact info
INSERT INTO contact_info (resort_name, address, phones, email, map_url, social)
VALUES (
  'Alyna''s Resort',
  'Ward No. 9, Shibpur, Palli Bidyut Road, Sitakund, Chattogram-4310, Bangladesh.',
  ARRAY['+8801878150350', '+8801878150350'],
  'info@hotelthegrandalayna.com',
  'https://maps.app.goo.gl/fYQViFEFsVq5GEmb9',
  '{"facebook": "#", "whatsapp": "#", "instagram": "#", "youtube": "#"}'::jsonb
)
ON CONFLICT DO NOTHING;

-- Notes:
-- - These CREATE TABLE statements are simple and can be extended with indexes, foreign keys and ownership as needed.
-- - Use Supabase SQL Editor to run this file and populate initial data. Replace URLs and texts as desired.
