import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { normalizeArtistName } from '@/lib/utils'

interface ClashfinderEvent {
  name: string
  short: string
  start: string
  end: string
}

interface ClashfinderLocation {
  name: string
  events: ClashfinderEvent[]
}

interface ClashfinderData {
  name: string
  lastEdit: string
  locations: ClashfinderLocation[]
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

  const username = process.env.CLASHFINDER_USERNAME
  const publicKey = process.env.CLASHFINDER_PUBLIC_KEY
  if (!username || !publicKey) return Response.json({ error: 'Clashfinder credentials not configured' }, { status: 500 })

  // Fetch Clashfinder data
  let cfData: ClashfinderData
  try {
    const url = `https://clashfinder.com/data/event/${encodeURIComponent(slug)}.json?authUsername=${username}&authPublicKey=${publicKey}`
    const res = await fetch(url, { signal: AbortSignal.timeout(30000) })
    if (!res.ok) throw new Error('Clashfinder fetch failed')
    cfData = await res.json()
    if ((cfData as any).error) throw new Error((cfData as any).error)
  } catch (e) {
    return Response.json({ error: `Failed to fetch Clashfinder data: ${(e as Error).message}` }, { status: 502 })
  }

  const locations = cfData.locations ?? []

  // Upsert stages (events are nested inside each location)
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
  const artistNormMap: Record<string, string> = {}
  for (const a of existingArtists ?? []) {
    artistNormMap[normalizeArtistName(a.name)] = a.id
  }

  let created = 0
  let updated = 0
  let conflicts: string[] = []
  let totalEvents = 0

  // Events are nested inside each location
  for (const location of locations) {
    const stageName = location.name
    const stageId = stageMap[stageName] ?? null

    for (const event of location.events ?? []) {
      totalEvents++
      const artistName = event.name?.trim()
      if (!artistName) continue

      // Parse "2026-06-18 16:00" → day + time
      const startStr = event.start ?? ''
      const endStr = event.end ?? ''
      const spaceIdx = startStr.indexOf(' ')
      const dayPart = spaceIdx > 0 ? startStr.slice(0, spaceIdx) : null
      const startTimePart = spaceIdx > 0 ? startStr.slice(spaceIdx + 1) : null
      const endSpaceIdx = endStr.indexOf(' ')
      const endTimePart = endSpaceIdx > 0 ? endStr.slice(endSpaceIdx + 1) : null

      // Find or create artist
      const normalized = normalizeArtistName(artistName)
      let artistId = artistNormMap[normalized]

      if (!artistId) {
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

      if (!artistId) continue

      const { error } = await supabase.from('edition_artists').upsert({
        edition_id: editionId,
        artist_id: artistId,
        stage_id: stageId,
        day: dayPart,
        start_time: startTimePart,
        end_time: endTimePart,
      }, { onConflict: 'edition_id,artist_id,day,start_time' })

      if (!error) updated++
    }
  }

  // Update edition with clashfinder metadata
  await supabase.from('editions').update({
    clashfinder_slug: slug,
    clashfinder_last_edit: cfData.lastEdit ?? null,
    clashfinder_last_synced_at: new Date().toISOString(),
  }).eq('id', editionId)

  return Response.json({
    success: true,
    totalEvents,
    stagesCreated: Object.keys(stageMap).length,
    artistsCreated: created,
    artistsUpdated: updated,
    conflicts,
  })
}
