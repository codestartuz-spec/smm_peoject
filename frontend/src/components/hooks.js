import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useToast } from './ui'

/** Mutatsiya + toast + keshni yangilash. */
export function useAct(fn, { success, invalidate = [], onSuccess } = {}) {
  const toast = useToast()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: (data, vars) => {
      const msg = typeof success === 'function' ? success(data, vars) : success ?? data?.message
      if (msg) toast.success(msg)
      invalidate.forEach((k) => qc.invalidateQueries({ queryKey: Array.isArray(k) ? k : [k] }))
      onSuccess?.(data, vars)
    },
    onError: (e) => toast.error(e.message),
  })
}
