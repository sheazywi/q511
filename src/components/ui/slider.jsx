
import React from 'react'
export function Slider({ value=[0], min=0, max=100, step=1, onValueChange=()=>{}, disabled=false }) {
  const v = Array.isArray(value) ? value[0] : value
  return (
    <input type="range" min={min} max={max} step={step} value={v}
      disabled={disabled}
      onChange={(e)=>onValueChange([Number(e.target.value)])}
      className="w-full h-2 rounded-lg bg-slate-200 accent-slate-900"/>
  )
}
