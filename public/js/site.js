(() => {
  const qs=(s,p=document)=>p.querySelector(s), qsa=(s,p=document)=>[...p.querySelectorAll(s)];
  const toast=(message,type='success')=>{const el=document.createElement('div');el.className=`toast ${type}`;el.textContent=message;document.body.appendChild(el);setTimeout(()=>el.remove(),2600)};

  const menuBtn=qs('[data-menu-toggle]'), menu=qs('[data-mobile-menu]');
  if(menuBtn&&menu){
    menuBtn.addEventListener('click',()=>menu.classList.toggle('open'));
    qsa('a',menu).forEach(a=>a.addEventListener('click',()=>menu.classList.remove('open')));
    addEventListener('resize',()=>{if(innerWidth>820)menu.classList.remove('open')});
  }

  const flash=qs('[data-flash]'); if(flash) setTimeout(()=>flash.remove(),3500);

  const slider=qs('[data-slider]');
  if(slider){const slides=qsa('.hero-slide',slider),dots=qsa('[data-slide-to]',slider);let i=0,t;
    const go=n=>{if(!slides.length)return;i=(n+slides.length)%slides.length;slides.forEach((x,j)=>x.classList.toggle('active',j===i));dots.forEach((x,j)=>x.classList.toggle('active',j===i));};
    dots.forEach((d,j)=>d.addEventListener('click',()=>{go(j);reset()}));
    const reset=()=>{clearInterval(t);if(slides.length>1)t=setInterval(()=>go(i+1),5200)};reset();
  }

  const offer=qs('[data-offer-slider]');
  if(offer){const items=qsa('[data-offer-item]',offer);let oi=0,ot;const show=n=>{if(!items.length)return;oi=(n+items.length)%items.length;items.forEach((x,j)=>x.classList.toggle('active',j===oi));};
    qsa('[data-offer-next]',offer).forEach(b=>b.addEventListener('click',()=>{show(oi+1);resetOffer()}));
    qsa('[data-offer-prev]',offer).forEach(b=>b.addEventListener('click',()=>{show(oi-1);resetOffer()}));
    const resetOffer=()=>{clearInterval(ot);if(items.length>1)ot=setInterval(()=>show(oi+1),4000)};resetOffer();
  }

  qsa('[data-gallery-src]').forEach(btn=>btn.addEventListener('click',()=>{const stage=qs('[data-main-product-media]');if(stage){const src=btn.dataset.gallerySrc;const type=btn.dataset.galleryType||'image/jpeg';stage.innerHTML=type.startsWith('video/')?`<video src="${src}" controls playsinline preload="metadata"></video>`:`<img src="${src}" alt="Product media">`;}qsa('[data-gallery-src]').forEach(x=>x.classList.remove('active'));btn.classList.add('active')}));
  qsa('[data-gallery-nav]').forEach(btn=>btn.addEventListener('click',()=>{const thumbs=qsa('[data-gallery-src]');if(!thumbs.length)return;let idx=thumbs.findIndex(x=>x.classList.contains('active'));idx=(idx+(btn.dataset.galleryNav==='next'?1:-1)+thumbs.length)%thumbs.length;thumbs[idx].click()}));

  const syncBuyNowQty=()=>{const i=qs('[data-qty-input]'),b=qs('[data-buy-now-qty]');if(i&&b)b.value=i.value};
  qsa('[data-qty-minus]').forEach(b=>b.addEventListener('click',()=>{const i=qs('[data-qty-input]',b.closest('.qty-row'));if(i){i.value=Math.max(1,Number(i.value||1)-1);syncBuyNowQty()}}));
  qsa('[data-qty-plus]').forEach(b=>b.addEventListener('click',()=>{const i=qs('[data-qty-input]',b.closest('.qty-row'));if(i){i.value=Math.min(10,Number(i.value||1)+1);syncBuyNowQty()}}));
  const qtyInput=qs('[data-qty-input]');if(qtyInput)qtyInput.addEventListener('change',syncBuyNowQty);

  qsa('[data-add-cart]').forEach(btn=>btn.addEventListener('click',async()=>{btn.disabled=true;const old=btn.textContent;btn.textContent='Adding…';try{const body=new URLSearchParams({product_id:btn.dataset.addCart,qty:'1'});const r=await fetch('/cart/add',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded','Accept':'application/json','X-Requested-With':'XMLHttpRequest'},body});const d=await r.json();if(!r.ok||!d.ok)throw new Error(d.message||'Could not add');qsa('[data-cart-count]').forEach(x=>x.textContent=d.cartCount);toast(d.message||'Added to cart');btn.textContent='Added ✓';setTimeout(()=>btn.textContent=old,1300)}catch(e){toast(e.message,'error');btn.textContent=old}finally{btn.disabled=false}}));

  qsa('[data-wishlist-product]').forEach(btn=>btn.addEventListener('click',async()=>{try{const body=new URLSearchParams({product_id:btn.dataset.wishlistProduct});const r=await fetch('/wishlist/toggle',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded','Accept':'application/json','X-Requested-With':'XMLHttpRequest'},body});const d=await r.json();if(!d.ok)throw new Error();btn.classList.toggle('active',d.active);btn.textContent=d.active?'♥':'♡';qsa('[data-wishlist-count]').forEach(x=>x.textContent=d.wishlistCount);toast(d.active?'Saved to wishlist':'Removed from wishlist')}catch(e){toast('Could not update wishlist','error')}}));

  const filterBtn=qs('[data-filter-toggle]'); const sidebar=qs('.shop-sidebar'); if(filterBtn&&sidebar)filterBtn.addEventListener('click',()=>sidebar.classList.toggle('open'));
  const share=qs('[data-share-product]'); if(share)share.addEventListener('click',async()=>{try{if(navigator.share)await navigator.share({title:document.title,url:location.href});else{await navigator.clipboard.writeText(location.href);toast('Product link copied')}}catch(_){}});

  // Preserve shop scroll so back-navigation returns to the same product position.
  if(location.pathname==='/shop'){const key='shilptara-shop-scroll:'+location.search;const saved=sessionStorage.getItem(key);if(saved)requestAnimationFrame(()=>scrollTo(0,Number(saved)));addEventListener('pagehide',()=>sessionStorage.setItem(key,String(scrollY)));qsa('.product-card a').forEach(a=>a.addEventListener('click',()=>sessionStorage.setItem(key,String(scrollY))))}

  const activity=qs('[data-activity-toast]');
  if(activity){const close=qs('[data-activity-close]',activity);if(close)close.addEventListener('click',()=>activity.hidden=true);let seen='';const poll=async()=>{try{const r=await fetch('/api/activity');const d=await r.json();const a=d.activities?.[0];if(!a||!a.name)return;const id=`${a.action_type}-${a.name}-${a.created_at}`;if(id===seen)return;seen=id;const labels={view:'Someone recently viewed',cart:'Someone added to cart',wishlist:'Someone saved',order:'Someone ordered'};qs('[data-activity-title]',activity).textContent=a.name;qs('[data-activity-text]',activity).textContent=labels[a.action_type]||'Popular right now';const img=qs('[data-activity-img]',activity);if(a.image_id)img.src=`/media/product/${a.image_id}`;activity.hidden=false;setTimeout(()=>activity.hidden=true,4500)}catch(_){}};setTimeout(poll,6500);setInterval(poll,30000)}
})();
