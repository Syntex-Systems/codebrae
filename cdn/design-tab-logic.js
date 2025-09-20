(function(){

  if (window.__SelectorInstalled) return;
  window.__SelectorInstalled = true;

  let isDragMode = false;
  let dragStart = null;
  const DRAG_THRESHOLD = 6; // pixels

  // Basic drag detection
  function onMouseDown(e){
    dragStart = { x: e.clientX, y: e.clientY };
    isDragMode = false;
  }
  function onMouseMove(e){
    if (!dragStart) return;
    const dx = Math.abs(e.clientX - dragStart.x);
    const dy = Math.abs(e.clientY - dragStart.y);
    if (dx > DRAG_THRESHOLD || dy > DRAG_THRESHOLD) isDragMode = true;
  }
  function onMouseUp(){
    dragStart = null;
    // keep isDragMode until next click
  }

  document.addEventListener('mousedown', onMouseDown, true);
  document.addEventListener('mousemove', onMouseMove, true);
  document.addEventListener('mouseup', onMouseUp, true);

  function safeAttrEscape(s){
    // simple escaping for double quotes and newlines inside attribute values
    return String(s).replace(/"/g, '&quot;').replace(/\n/g, ' ');
  }

  function buildSelector(target){
    const type = (target.tagName || '').toLowerCase();
    const className = (target.className && typeof target.className === 'string') ? target.className.trim() : '';
    const id = target.id || '';

    // Start with the requested root
    let selector = `.layout-element[e-type="${safeAttrEscape(type)}"]`;
    if (className) selector += `[e-class="${safeAttrEscape(className)}"]`;
    if (id) selector += `[e-id="${safeAttrEscape(id)}"]`;
    return selector;
  }

  function sendSelector(selector){
    // Preferred API as requested by the caller: window.parentMessage
    try{
      if (typeof window.parentMessage === 'function'){
        window.parentMessage({ key: '-selector', selector });
        return;
      }
    }catch(err){/* ignore */}

    // Fallback to postMessage if parent is available
    try{
      if (window.parent && window.parent.postMessage){
        window.parent.postMessage({ key: '-selector', selector }, '*');
        return;
      }
    }catch(err){/* ignore */}

    // As a last resort, store it on window for consumers
    try{ window.__lastSelector = selector; }catch(err){/* ignore */}
  }

  function clickHandler(e){
    // Only left clicks, no drags, only HTML elements
    if (e.button !== 0 || isDragMode || !(e.target instanceof window.HTMLElement)) return;

    const main = document.querySelector('main');
    const target = e.target;
    if (!main || !main.contains(target)) return; // only elements within <main>

    // Block other listeners as much as possible
    try{
      e.preventDefault();
    }catch(err){}
    try{
      e.stopImmediatePropagation();
    }catch(err){}
    try{
      e.stopPropagation();
    }catch(err){}

    const selector = buildSelector(target);

    // Try to resolve a matching .layout-element in the current document
    const layoutElement = document.querySelector(selector);
    if (layoutElement){
      // If a same-document handler exists, expose it via window (optional)
      if (typeof window.selectElement === 'function'){
        try{ window.selectElement(layoutElement); }catch(err){}
      }
    }

    // Send the selector to parent/host
    sendSelector(selector);
  }

  // Attach listeners: both delegation on <main> and direct listeners to each element to maximize precedence
  function attachListeners(){
    const main = document.querySelector('main');
    if (!main) return;

    // Delegated capture listener on <main>
    main.addEventListener('click', clickHandler, { capture: true, passive: false });

    // Also attach to every element inside main (capture) - user requested listener for every element
    const elems = Array.from(main.querySelectorAll('*'));
    elems.forEach(el => {
      try{
        el.addEventListener('click', clickHandler, { capture: true, passive: false });
      }catch(err){/* ignore elements that don't accept listeners */}
    });

    // Observe DOM changes to add listeners to newly-added elements inside <main>
    const observer = new MutationObserver(muts => {
      muts.forEach(m => {
        m.addedNodes && m.addedNodes.forEach(node => {
          if (!(node instanceof HTMLElement)) return;
          if (!main.contains(node)) return;
          try{ node.addEventListener('click', clickHandler, { capture: true, passive: false }); }catch(err){}
          // and for descendants
          node.querySelectorAll && node.querySelectorAll('*') && node.querySelectorAll('*').forEach(ch => {
            try{ ch.addEventListener('click', clickHandler, { capture: true, passive: false }); }catch(err){}
          });
        });
      });
    });
    observer.observe(main, { childList: true, subtree: true });
  }

  // Run immediately
  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', attachListeners);
  } else {
    attachListeners();
  }

})();
