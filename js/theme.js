(function(){
"use strict";
var $=function(s,r){return (r||document).querySelector(s)};
var $$=function(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s))};
/* theme switch */
(function(){var KEY='ccs-theme',root=document.documentElement,box=$('#theme');if(!box)return;
  function mode(){try{var m=localStorage.getItem(KEY);return m==='light'||m==='dark'?m:'system'}catch(e){return 'system'}}
  function apply(m){if(m==='light'||m==='dark')root.setAttribute('data-theme',m);else root.removeAttribute('data-theme');
    $$('button',box).forEach(function(b){b.setAttribute('aria-checked',String(b.dataset.themeSet===m))})}
  apply(mode());
  box.addEventListener('click',function(e){var b=e.target.closest('button[data-theme-set]');if(!b)return;var m=b.dataset.themeSet;
    try{if(m==='system')localStorage.removeItem(KEY);else localStorage.setItem(KEY,m)}catch(err){}apply(m)})})();

})();
