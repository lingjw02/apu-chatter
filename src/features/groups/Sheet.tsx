import { useEffect, useRef } from 'react';
export function Sheet({label,onClose,children}:{label:string;onClose:()=>void;children:React.ReactNode}){
 const ref=useRef<HTMLDialogElement>(null);
 useEffect(()=>{const node=ref.current;node?.showModal();return()=>node?.close();},[]);
 return <dialog ref={ref} className="sheet-dialog" aria-label={label} onCancel={onClose} onClick={e=>{if(e.target===e.currentTarget)onClose();}}><section>{children}</section></dialog>;
}
