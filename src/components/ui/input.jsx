
import React from 'react'
export function Input(props) {
  return <input {...props} className={`h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-slate-200 ${props.className||''}`} />
}
