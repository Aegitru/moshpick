-- Users (extended from Supabase auth)
CREATE TABLE public.users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  name text NOT NULL,
  alias varchar(3) NOT NULL DEFAULT '',
  streaming_platform text CHECK (streaming_platform IN ('spotify', 'deezer')),
  streaming_access_token text,
  streaming_refresh_token text,
  streaming_token_expires_at timestamptz,
  preferences jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Groups
CREATE TABLE public.groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  invite_code text UNIQUE NOT NULL,
  created_by uuid REFERENCES public.users(id),
  created_at timestamptz DEFAULT now()
);

-- Group members
CREATE TABLE public.group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  notes_display_order jsonb DEFAULT '[]',
  joined_at timestamptz DEFAULT now(),
  UNIQUE(group_id, user_id)
);

-- Festivals
CREATE TABLE public.festivals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  location text,
  website text,
  clashfinder_prefix text,
  created_at timestamptz DEFAULT now()
);

-- Editions
CREATE TABLE public.editions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  festival_id uuid REFERENCES public.festivals(id) ON DELETE CASCADE,
  year integer NOT NULL,
  start_date date,
  end_date date,
  clashfinder_slug text,
  clashfinder_last_edit text,
  clashfinder_last_synced_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Stages
CREATE TABLE public.stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  edition_id uuid REFERENCES public.editions(id) ON DELETE CASCADE,
  name text NOT NULL,
  is_primary boolean DEFAULT true,
  icon text,
  color text,
  "order" integer DEFAULT 0
);

-- Artists
CREATE TABLE public.artists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  country text,
  formed_year integer,
  genres text[] DEFAULT '{}',
  photo_url text,
  website text,
  spotify_id text,
  spotify_this_is_playlist_id text,
  deezer_id text,
  created_at timestamptz DEFAULT now()
);

-- Edition artists (lineup)
CREATE TABLE public.edition_artists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  edition_id uuid REFERENCES public.editions(id) ON DELETE CASCADE,
  artist_id uuid REFERENCES public.artists(id) ON DELETE CASCADE,
  stage_id uuid REFERENCES public.stages(id),
  day date,
  start_time time,
  end_time time,
  UNIQUE(edition_id, artist_id, day, start_time)
);

-- Ratings (global per user per artist)
CREATE TYPE rating_value AS ENUM ('A+','A','A-','B+','B','B-','C+','C','C-','D+','D','D-','E+','E','E-');
CREATE TABLE public.ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  artist_id uuid REFERENCES public.artists(id) ON DELETE CASCADE,
  rating rating_value NOT NULL,
  comment text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, artist_id)
);

-- Group editions (which editions a group follows)
CREATE TABLE public.group_editions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid REFERENCES public.groups(id) ON DELETE CASCADE,
  edition_id uuid REFERENCES public.editions(id) ON DELETE CASCADE,
  UNIQUE(group_id, edition_id)
);

-- User concert picks (pinned concerts)
CREATE TABLE public.user_concert_picks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  edition_artist_id uuid REFERENCES public.edition_artists(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, edition_artist_id)
);

-- User activity blocks
CREATE TABLE public.user_activity_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  edition_id uuid REFERENCES public.editions(id) ON DELETE CASCADE,
  day date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  emoji text,
  label text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Concert reviews
CREATE TYPE concert_status AS ENUM ('seen', 'partially_seen', 'liked', 'disliked');
CREATE TABLE public.concert_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  edition_artist_id uuid REFERENCES public.edition_artists(id) ON DELETE CASCADE,
  status concert_status,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, edition_artist_id)
);

-- RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.festivals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.editions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.artists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.edition_artists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_editions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_concert_picks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_activity_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.concert_reviews ENABLE ROW LEVEL SECURITY;

-- Basic RLS policies
CREATE POLICY "Auth users can read all public data" ON public.festivals FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can read editions" ON public.editions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can read stages" ON public.stages FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can read artists" ON public.artists FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth users can read edition_artists" ON public.edition_artists FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can manage their own profile" ON public.users FOR ALL TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users can read group members" ON public.group_members FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can join groups" ON public.group_members FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can read groups they belong to" ON public.groups FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can create groups" ON public.groups FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Users can read ratings" ON public.ratings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can manage their own ratings" ON public.ratings FOR ALL TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage festivals" ON public.festivals FOR ALL TO authenticated USING (true);
CREATE POLICY "Admins can manage editions" ON public.editions FOR ALL TO authenticated USING (true);
CREATE POLICY "Admins can manage stages" ON public.stages FOR ALL TO authenticated USING (true);
CREATE POLICY "Admins can manage artists" ON public.artists FOR ALL TO authenticated USING (true);
CREATE POLICY "Admins can manage edition_artists" ON public.edition_artists FOR ALL TO authenticated USING (true);
CREATE POLICY "Users can manage their picks" ON public.user_concert_picks FOR ALL TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can read all picks" ON public.user_concert_picks FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can manage their activity blocks" ON public.user_activity_blocks FOR ALL TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can read group editions" ON public.group_editions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can manage concert reviews" ON public.concert_reviews FOR ALL TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can read concert reviews" ON public.concert_reviews FOR SELECT TO authenticated USING (true);

-- Trigger to auto-create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, email, name, alias)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    UPPER(LEFT(COALESCE(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)), 3))
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
