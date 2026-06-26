import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { normalizeArtistName } from '@/lib/utils'

interface ClashfinderEvent {
  name: string
  location: string
  start: string
  end: string
}

interface ClashfinderLocation {
  name: string
}

interface ClashfinderData {
  name: string
  lastEdit: string
  locations: ClashfinderLocation[]
  events: ClashfinderEvent[]
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { editionId, slug } = await request.json()
  if (!editionId || !slug) return Response.json({ error: 'Missing editionId or slug' }, { status: 400 })

  // Verify edition exists
  const { data: edition } = await supabase.from('editions').select('id, festival_id').eq('id', editionId).single()
  if (!edition) return Response.json({ error: 'Edition not found' }, { status: 404 })

  // Fetch Clashfinder data
  let cfData: ClashfinderData
  try {
    const url = `https://clashfinder.com/data/event/${encodeURIComponent(slug)}.json`
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) })
    if (!res.ok) throw new Error('Clashfinder fetch failed')
    cfData = await res.json()
  } catch (e) {
    return Response.json({ error: 'Failed to fetch Clashfinder data' }, { status: 502 })
  }

  const locations = cfData.locations ?? []
  const events = cfData.events ?? []

  // Upsert stages
  const stageMap: Record<string, string> = {} // stage name -> stage id
  for (let i = 0; i < locations.length; i++) {
    const loc = locations[i]
    const { data: existingStage } = await supabase
      .from('stages')
      .select('id')
      .eq('edition_id', editionId)
      .eq('name', loc.name)
      .single()

    if (existingStage) {
      stageMap[loc.name] = existingStage.id
    } else {
      const { data: newStage } = await supabase
        .from('stages')
        .insert({ edition_id: editionId, name: loc.name, is_primary: true, order: i })
        .select('id')
        .single()
      if (newStage) stageMap[loc.name] = newStage.id
    }
  }

  // Load existing artists in DB for matching
  const { data: existingArtists } = await supabase.from('artists').select('id, name')
  const artistNormMap: Record<string, string> = {} // normalized name -> id
  for (const a of existingArtists ?? []) {
    artistNormMap[normalizeArtistName(a.name)] = a.id
  }

  let created = 0
  let updated = 0
  let conflicts: string[] = []

  for (const event of events) {
    const artistName = event.name?.trim()
    if (!artistName) continue

    // Parse day from start time (Clashfinder format: "2026-06-19 16:00")
    const startStr = event.start ?? ''
    const endStr = event.end ?? ''
    const [dayPart, startTimePart] = startStr.split(' ')
    const [, endTimePart] = endStr.split(' ')

    const stageName = event.location
    const stageId = stageName ? stageMap[stageName] ?? null : null

    // Find or create artist
    const normalized = normalizeArtistName(artistName)
    let artistId = artistNormMap[normalized]

    if (!artistId) {
      // Check fuzzy match (simple: first 6 chars)
      const fuzzyKey = normalized.slice(0, 6)
      const fuzzyMatch = Object.keys(artistNormMap).find(k => k.slice(0, 6) === fuzzyKey && k !== normalized)
      if (fuzzyMatch) {
        conflicts.push(`"${artistName}" possible doublon de "${existingArtists?.find(a => a.id === artistNormMap[fuzzyMatch])?.name}"`)
        artistId = artistNormMap[fuzzyMatch]
      } else {
        // Create new artist
        const { data: newArtist } = await supabase
          .from('artists')
          .insert({ name: artistName })
          .select('id')
          .single()
        if (newArtist) {
          artistId = newArtist.id
          artistNormMap[normalized] = artistId
          created++
        }
      }
    }

    if (!artistId) continue

    // Upsert edition_artist
    const { error } = await supabase.from('edition_artists').upsert({
      edition_id: editionId,
      artist_id: artistId,
      stage_id: stageId,
      day: dayPart || null,
      start_time: startTimePart || null,
      end_time: endTimePart || null,
    }, { onConflict: 'edition_id,artist_id,day,start_time' })

    if (!error) updated++
  }

  // Update edition with clashfinder metadata
  await supabase.from('editions').update({
    clashfinder_slug: slug,
    clashfinder_last_edit: cfData.lastEdit ?? null,
    clashfinder_last_synced_at: new Date().toISOString(),
  }).eq('id', editionId)

  return Response.json({
    success: true,
    totalEvents: events.length,
    stagesCreated: Object.keys(stageMap).length,
    artistsCreated: created,
    artistsUpdated: updated,
    conflicts,
  })
}
