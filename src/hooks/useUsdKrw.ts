import { useEffect, useState } from 'react'
import { getUsdKrwRate } from '../lib/fx'

export function useUsdKrw() {
  const [rate, setRate] = useState<number>(1380)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    getUsdKrwRate().then((r) => {
      if (!mounted) return
      setRate(r)
      setLoading(false)
    })
    return () => {
      mounted = false
    }
  }, [])

  return { rate, loading }
}

