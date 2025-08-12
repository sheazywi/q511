
import React from 'react'
export function Switch({ checked, onCheckedChange, id }) {
  return (
    <label htmlFor={id} className="relative inline-flex cursor-pointer items-center">
      <input id={id} type="checkbox" checked={!!checked} onChange={e=>onCheckedChange?.(e.target.checked)} className="sr-only peer"/>
      <div className="h-6 w-11 rounded-full bg-slate-300 peer-checked:bg-slate-900 transition-all"></div>
      <div className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all peer-checked:translate-x-5"></div>
    </label>
  )
}
