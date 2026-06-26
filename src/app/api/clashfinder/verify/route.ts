import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const slug = request.nextUrl.searchParams.get('slug')
  if (!slug) return Response.json({ error: 'Missing slug' }, { status: 400 })

  const username = process.env.CLASHFINDER_USERNAME
  const publicKey = process.env.CLASHFINDER_PUBLIC_KEY
  if (!username || !publicKey) return Response.json({ error: 'Clashfinder credentials not configured' }, { status: 500 })

  try {
    const url = `https://clashfinder.com/data/event/${encodeURIComponent(slug)}.json?authUsername=${username}&authPublicKey=${publicKey}`
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) })
    if (!res.ok) return Response.json({ error: 'Clashfinder not found for this slug' }, { status: 404 })

    const data = await res.json()
    if (data.error) return Response.json({ error: `Clashfinder: ${data.error}` }, { status: 404 })

    const artistCount = Array.isArray(data.events) ? data.events.length : 0
    const stageCount = Array.isArray(data.locations) ? data.locations.length : 0

    return Response.json({
      name: data.name ?? slug,
      artistCount,
      stageCount,
      lastEdit: data.lastEdit ?? null,
    })
  } catch (e) {
    return Response.json({ error: 'Failed to reach Clashfinder' }, { status: 502 })
  }
}
