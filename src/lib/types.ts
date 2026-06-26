export type RatingValue = 'A+' | 'A' | 'A-' | 'B+' | 'B' | 'B-' | 'C+' | 'C' | 'C-' | 'D+' | 'D' | 'D-' | 'E+' | 'E' | 'E-'
export type ConcertStatus = 'seen' | 'partially_seen' | 'liked' | 'disliked'

export interface User {
  id: string
  email: string
  name: string
  alias: string
  streaming_platform: 'spotify' | 'deezer' | null
  streaming_access_token: string | null
  streaming_refresh_token: string | null
  streaming_token_expires_at: string | null
  preferences: Record<string, unknown>
  created_at: string
}

export interface Group {
  id: string
  name: string
  invite_code: string
  created_by: string | null
  created_at: string
}

export interface GroupMember {
  id: string
  group_id: string
  user_id: string
  role: 'admin' | 'member'
  notes_display_order: string[]
  joined_at: string
  user?: User
}

export interface Festival {
  id: string
  name: string
  location: string | null
  website: string | null
  clashfinder_prefix: string | null
  created_at: string
}

export interface Edition {
  id: string
  festival_id: string
  year: number
  start_date: string | null
  end_date: string | null
  clashfinder_slug: string | null
  clashfinder_last_edit: string | null
  clashfinder_last_synced_at: string | null
  created_at: string
  festival?: Festival
}

export interface Stage {
  id: string
  edition_id: string
  name: string
  is_primary: boolean
  icon: string | null
  color: string | null
  order: number
}

export interface Artist {
  id: string
  name: string
  country: string | null
  formed_year: number | null
  genres: string[]
  photo_url: string | null
  website: string | null
  spotify_id: string | null
  spotify_this_is_playlist_id: string | null
  deezer_id: string | null
  created_at: string
}

export interface EditionArtist {
  id: string
  edition_id: string
  artist_id: string
  stage_id: string | null
  day: string | null
  start_time: string | null
  end_time: string | null
  artist?: Artist
  stage?: Stage
}

export interface Rating {
  id: string
  user_id: string
  artist_id: string
  rating: RatingValue
  comment: string | null
  created_at: string
  updated_at: string
  user?: User
}

export interface GroupEdition {
  id: string
  group_id: string
  edition_id: string
  edition?: Edition
}

export interface UserConcertPick {
  id: string
  user_id: string
  edition_artist_id: string
  created_at: string
  edition_artist?: EditionArtist
}

export interface UserActivityBlock {
  id: string
  user_id: string
  edition_id: string
  day: string
  start_time: string
  end_time: string
  emoji: string | null
  label: string
  created_at: string
}

export interface ConcertReview {
  id: string
  user_id: string
  edition_artist_id: string
  status: ConcertStatus | null
  created_at: string
  updated_at: string
}
