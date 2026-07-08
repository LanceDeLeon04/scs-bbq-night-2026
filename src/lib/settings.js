import { supabase } from './supabaseClient.js'

const KEY = 'ordering_open'

/**
 * Reads the current ordering-open flag. Fails "open" (returns true) on any
 * error — a settings-table hiccup should never accidentally lock everyone
 * out of ordering.
 */
export async function fetchOrderingOpen() {
  const { data, error } = await supabase
    .from('settings')
    .select('value')
    .eq('key', KEY)
    .maybeSingle()

  if (error) {
    console.error('Failed to fetch ordering status:', error)
    return true
  }
  // Only an explicit `false` closes ordering — anything else (missing row,
  // true, null) is treated as open.
  return data?.value !== false
}

export async function setOrderingOpen(open) {
  const { error } = await supabase
    .from('settings')
    .upsert({ key: KEY, value: open, updated_at: new Date().toISOString() }, { onConflict: 'key' })
  if (error) throw error
}

/**
 * Subscribes to live changes on the ordering_open row via Supabase
 * Realtime, so the order form can flip to "closed" immediately when an
 * admin toggles it, without a page refresh. Returns an unsubscribe fn.
 * If Realtime isn't enabled on the project, this just never fires — the
 * form still works fine off the initial fetchOrderingOpen() call.
 */
export function subscribeOrderingOpen(onChange) {
  const channel = supabase
    .channel('settings-ordering-open')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'settings', filter: `key=eq.${KEY}` },
      (payload) => {
        const value = payload.new?.value
        if (typeof value !== 'undefined') onChange(value !== false)
      }
    )
    .subscribe()

  return () => supabase.removeChannel(channel)
}
