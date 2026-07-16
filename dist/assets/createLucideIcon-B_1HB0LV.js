import{j as l,L as w,r as n}from"./index-DbP5fpIg.js";function L({height:t=40,to:e="/",className:r,style:o,ariaLabel:s="FrameFlow home"}){const a=l.jsx("img",{src:"/frameflow-logo.png",alt:"FrameFlow",draggable:!1,style:{display:"block",height:t,width:"auto",maxWidth:"100%",objectFit:"contain",userSelect:"none",...o}});return e?l.jsx(w,{to:e,"aria-label":s,className:r,style:{display:"inline-flex",alignItems:"center",textDecoration:"none"},children:a}):a}/**
 * @license lucide-react v0.487.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const f=t=>t.replace(/([a-z0-9])([A-Z])/g,"$1-$2").toLowerCase(),C=t=>t.replace(/^([A-Z])|[\s-_]+(\w)/g,(e,r,o)=>o?o.toUpperCase():r.toLowerCase()),c=t=>{const e=C(t);return e.charAt(0).toUpperCase()+e.slice(1)},i=(...t)=>t.filter((e,r,o)=>!!e&&e.trim()!==""&&o.indexOf(e)===r).join(" ").trim();/**
 * @license lucide-react v0.487.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */var h={xmlns:"http://www.w3.org/2000/svg",width:24,height:24,viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:2,strokeLinecap:"round",strokeLinejoin:"round"};/**
 * @license lucide-react v0.487.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const x=n.forwardRef(({color:t="currentColor",size:e=24,strokeWidth:r=2,absoluteStrokeWidth:o,className:s="",children:a,iconNode:m,...u},d)=>n.createElement("svg",{ref:d,...h,width:e,height:e,stroke:t,strokeWidth:o?Number(r)*24/Number(e):r,className:i("lucide",s),...u},[...m.map(([p,g])=>n.createElement(p,g)),...Array.isArray(a)?a:[a]]));/**
 * @license lucide-react v0.487.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const j=(t,e)=>{const r=n.forwardRef(({className:o,...s},a)=>n.createElement(x,{ref:a,iconNode:e,className:i(`lucide-${f(c(t))}`,`lucide-${t}`,o),...s}));return r.displayName=c(t),r};export{L as B,j as c};
