
import React from 'react'
export function Card({ className='', ...props }) {
  return <div className={`rounded-2xl border border-slate-200 bg-white ${className}`} {...props} />
}
export function CardContent({ className='', ...props }) {
  return <div className={`p-4 ${className}`} {...props} />
}
