import {useEffect, useRef, type ReactNode} from 'react';
import {X} from '@phosphor-icons/react';

/** Native nonmodal popover: Escape and outside clicks dismiss without trapping chat focus. */
export function RoomPopover({className,label,onClose,children}:{className:string;label:string;onClose:()=>void;children:ReactNode}) {
 const panel=useRef<HTMLDivElement>(null);
 const close=useRef(onClose);
 close.current=onClose;
 useEffect(()=>{
  const node=panel.current!;
  const opener=document.activeElement as HTMLElement|null;
  const toggle=(event:Event)=>{if((event as ToggleEvent).newState==='closed')close.current();};
  node.addEventListener('toggle',toggle);
  node.showPopover();
  node.querySelector<HTMLButtonElement>('.room-panel-close')?.focus({preventScroll:true});
  return()=>{node.removeEventListener('toggle',toggle);if(node.contains(document.activeElement))opener?.focus({preventScroll:true});};
 },[]);
 return <div ref={panel} popover="auto" role="region" aria-label={label} className={`${className} room-popover`}>
  <div className="room-panel-heading"><strong>{label}</strong><button className="room-panel-close" aria-label={`Close ${label.toLowerCase()}`} onClick={onClose}><X size={18}/></button></div>
  {children}
 </div>;
}
