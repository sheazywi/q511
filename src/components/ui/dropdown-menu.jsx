
import React, { useState, useRef, useEffect } from 'react'
export function DropdownMenu({ children }) { return <div className="relative inline-block">{children}</div> }
export function DropdownMenuTrigger({ asChild=false, children }) { return React.cloneElement(children, { 'data-menu-trigger': true }) }
export function DropdownMenuContent({ align='start', className='', children }) {
  return <div className={`absolute z-50 mt-2 min-w-[12rem] rounded-xl border bg-white shadow ${className}`}>{children}</div>
}
export function DropdownMenuLabel({ children }) { return <div className="px-3 py-2 text-xs text-slate-500">{children}</div> }
export function DropdownMenuSeparator() { return <div className="my-1 border-t" /> }
export function DropdownMenuItem({ onClick, children }) {
  return <button onClick={onClick} className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50">{children}</button>
}
