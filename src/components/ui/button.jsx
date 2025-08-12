
import React from 'react'
export function Button({ variant='default', size='default', className='', ...props }) {
  const base = 'inline-flex items-center justify-center rounded-2xl border text-sm px-3 py-2 transition active:scale-[.99]'
  const styles = {
    default: 'bg-slate-900 text-white border-slate-900 hover:bg-slate-800',
    outline: 'bg-white text-slate-900 border-slate-200 hover:bg-slate-50',
  }[variant] || ''
  const sizes = { icon: 'p-2 h-9 w-9', default: '' }[size] || ''
  return <button className={`${base} ${styles} ${sizes} ${className}`} {...props} />
}
