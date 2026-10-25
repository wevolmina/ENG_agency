"use client";
import {useEffect,useId,useState,type InputHTMLAttributes} from "react";
import "./private-fields.css";
function Eye({shown}:{shown:boolean}){
 return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true" focusable="false">
  <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>
  {shown&&<path d="m3 3 18 18"/>}
 </svg>;
}
export function PrivateValue({value,label,emptyText="제공되지 않음"}:{value:string|null|undefined;label:string;emptyText?:string}){
 const [visibleValue,setVisibleValue]=useState<string|null>(null),id=useId();
 const shown=!!value&&visibleValue===value;
 return <span className="private-value">
  <span id={id} className="private-value-text">{value?(shown?value:"***"):emptyText}</span>
  {!!value&&<button type="button" className="privacy-toggle" aria-controls={id} aria-pressed={shown}
   aria-label={label+(shown?" 숨기기":" 표시")} onClick={()=>setVisibleValue(shown?null:value)}><Eye shown={shown}/></button>}
 </span>;
}
type InputProps=Omit<InputHTMLAttributes<HTMLInputElement>,"type">&{label:string;visibilityLabel?:string};
export function PrivateInput({label,visibilityLabel=label,id:providedId,...props}:InputProps){
 const id=useId(),inputId=providedId||id,[shown,setShown]=useState(false);
 useEffect(()=>{if(!props.value)setShown(false)},[props.value]);
 return <div className="private-input-field">
  <label htmlFor={inputId}>{label}</label>
  <span className="private-input"><input {...props} id={inputId} type={shown?"text":"password"} aria-label={label}/>
   <button type="button" className="privacy-toggle" aria-controls={inputId} aria-pressed={shown} disabled={props.disabled}
    aria-label={visibilityLabel+(shown?" 숨기기":" 표시")} onClick={()=>setShown(v=>!v)}><Eye shown={shown}/></button>
  </span>
 </div>;
}
