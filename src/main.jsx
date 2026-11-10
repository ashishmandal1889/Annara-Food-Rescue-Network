import React, {useEffect, useMemo, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Leaf, Search, Plus, MapPin, Clock3, Users, Utensils, HeartHandshake, Truck, LayoutDashboard, LogOut, UserRound, ImagePlus, ArrowUpRight, ShieldCheck, Menu, X, CircleCheck, PackageCheck, HandHeart, Filter, ChevronRight, Camera, ClipboardList} from 'lucide-react';
import './style.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:8080/api';
const demo = [
 {id:'demo-1',foodName:'Fresh vegetable rice bowls',description:'Freshly prepared vegetarian meals, packed separately. Best collected today.',foodType:'Vegetarian',totalMeals:35,remainingMeals:35,pickupAddress:'Indiranagar, Bengaluru',pickupBefore:new Date(Date.now()+4*3600000).toISOString(),status:'AVAILABLE',donorName:'Green Table Kitchen',city:'Bengaluru',imageUrl:'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=900&q=85'},
 {id:'demo-2',foodName:'Bakery bread & rolls',description:'Assorted bread rolls from today’s morning batch. Please bring reusable crates.',foodType:'Bakery',totalMeals:24,remainingMeals:24,pickupAddress:'Koramangala, Bengaluru',pickupBefore:new Date(Date.now()+3*3600000).toISOString(),status:'AVAILABLE',donorName:'Daily Crumb Bakery',city:'Bengaluru',imageUrl:'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=900&q=85'},
 {id:'demo-3',foodName:'Packed lunch boxes',description:'Sealed lunch boxes from a corporate event. Contains wheat; check allergens before serving.',foodType:'Mixed',totalMeals:60,remainingMeals:60,pickupAddress:'Whitefield, Bengaluru',pickupBefore:new Date(Date.now()+5*3600000).toISOString(),status:'AVAILABLE',donorName:'Northstar Events',city:'Bengaluru',imageUrl:'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=900&q=85'}
];
const fmt = v => {try{return new Date(v).toLocaleString([], {hour:'numeric',minute:'2-digit',month:'short',day:'numeric'})}catch{return v}};
function App(){
 const [user,setUser]=useState(()=>{try{return JSON.parse(localStorage.getItem('annara-user'))}catch{return null}});
 const [token,setToken]=useState(()=>localStorage.getItem('annara-token')||'');
 const [page,setPage]=useState('discover');
 const [items,setItems]=useState(demo);
 const [claims,setClaims]=useState([]);
 const [donorClaims,setDonorClaims]=useState([]);
 const [requests,setRequests]=useState([]);
 const [deliveries,setDeliveries]=useState([]);
 const [query,setQuery]=useState('');
 const [notice,setNotice]=useState('');
 const [authMode,setAuthMode]=useState('login');
 const [showAuth,setShowAuth]=useState(false);
 const [mobileNav,setMobileNav]=useState(false);
 const [loading,setLoading]=useState(false);
 const [showDonation,setShowDonation]=useState(false);
 const [showRequest,setShowRequest]=useState(false);
 const [authForm,setAuthForm]=useState({fullName:'',organisationName:'',email:'',password:'',role:'NGO',city:'Bengaluru',phone:''});
 const [donation,setDonation]=useState({foodName:'',description:'',foodType:'Vegetarian',sourceType:'RESTAURANT',sourceName:'',totalMeals:20,pickupAddress:'',pickupBefore:''});
 const [donationFile,setDonationFile]=useState(null);
 const [request,setRequest]=useState({foodName:'',requestedMeals:10,description:'',urgency:'NORMAL',neededBefore:'',deliveryAddress:''});
 const [busyId,setBusyId]=useState(null);
 const headers=()=>token?{Authorization:`Bearer ${token}`}:{};
 async function api(path,opts={}) {
   const res=await fetch(`${API}${path}`,{...opts,headers:{...headers(),...(opts.body instanceof FormData?{}:{'Content-Type':'application/json'}),...(opts.headers||{})}});
   const data=await res.json().catch(()=>({}));
   if(!res.ok) throw new Error(data.error||data.message||`Request failed (${res.status})`);
   return data;
 }
 async function refresh(){
   try {
    let d=await api('/donations');
    if(token && user?.role==='RESTAURANT') {
      try { d=await api('/donations/mine'); } catch {}
    }
    setItems(Array.isArray(d)?d:[]);
   } catch { setItems([]); }
   if(token){
    try{setClaims(await api('/claims/mine'))}catch{setClaims([])}
    try{setRequests(await api('/requests'))}catch{setRequests([])}
    try{setDeliveries(await api('/deliveries/mine'))}catch{setDeliveries([])}
    if(user?.role==='RESTAURANT') {
      try {
        const own=await api('/donations/mine');
        const all=await Promise.all((Array.isArray(own)?own:[]).map(d=>api(`/donations/${d.id}/claims`).catch(()=>[])));
        setDonorClaims(all.flat());
      } catch { setDonorClaims([]); }
    } else setDonorClaims([]);
   } else {setClaims([]);setRequests([]);setDeliveries([]);setDonorClaims([])}
 }
 useEffect(()=>{refresh()},[token,user?.role]);
 function flash(s){setNotice(s);setTimeout(()=>setNotice(''),3500)}
 const filtered=useMemo(()=>items.filter(x=>`${x.foodName} ${x.description||''} ${x.donorName||''} ${x.city||''} ${x.foodType||''}`.toLowerCase().includes(query.toLowerCase())),[items,query]);
 function logout(){setToken('');setUser(null);localStorage.removeItem('annara-token');localStorage.removeItem('annara-user');setPage('discover');flash('You have been signed out.')}
 async function submitAuth(e){
  e.preventDefault();setLoading(true);
  try{
   const path=authMode==='login'?'/auth/login':'/auth/register';
   const payload=authMode==='login'?{email:authForm.email,password:authForm.password}:authForm;
   const data=await api(path,{method:'POST',body:JSON.stringify(payload)});
   setToken(data.token);setUser(data.user);localStorage.setItem('annara-token',data.token);localStorage.setItem('annara-user',JSON.stringify(data.user));
   setShowAuth(false);setPage(data.user.role==='RESTAURANT'?'my-donations':'discover');flash(`Welcome to Annara, ${data.user.fullName.split(' ')[0]}!`);
  }catch(err){flash(err.message)}finally{setLoading(false)}
 }
 async function createDonation(e){
  e.preventDefault();if(!token){setShowAuth(true);return}
  setLoading(true);
  try{
   const fd=new FormData();fd.append('data',new Blob([JSON.stringify({...donation,totalMeals:Number(donation.totalMeals),pickupBefore:new Date(donation.pickupBefore).toISOString().slice(0,19)})],{type:'application/json'}));
   if(donationFile)fd.append('image',donationFile);
   await api('/donations',{method:'POST',body:fd});setShowDonation(false);setDonationFile(null);setDonation({foodName:'',description:'',foodType:'Vegetarian',sourceType:'RESTAURANT',sourceName:'',totalMeals:20,pickupAddress:'',pickupBefore:''});await refresh();setPage('my-donations');flash('Donation published. Thank you for rescuing food!');
  }catch(err){flash(err.message)}finally{setLoading(false)}
 }
 async function claim(item){
  if(String(item.id).startsWith('demo-')){flash('Demo listing: sign in and connect the backend to create a real claim.');return}
  if(!token){setShowAuth(true);return}
  const n=Number(prompt(`How many meals would you like to claim? (Available: ${item.remainingMeals})`,Math.min(10,item.remainingMeals)));
  if(!n||n<1)return;
  setBusyId(item.id);
  try{await api(`/donations/${item.id}/claims`,{method:'POST',body:JSON.stringify({requestedMeals:n})});flash(`Claim confirmed for ${n} meals.`);await refresh()}
  catch(err){flash(err.message)}finally{setBusyId(null)}
 }
 async function createRequest(e){
  e.preventDefault();setLoading(true);
  try{await api('/requests',{method:'POST',body:JSON.stringify({...request,requestedMeals:Number(request.requestedMeals),neededBefore:request.neededBefore||null})});setShowRequest(false);setRequest({foodName:'',requestedMeals:10,description:'',urgency:'NORMAL',neededBefore:'',deliveryAddress:''});await refresh();setPage('requests');flash('Your food request has been posted.')}
  catch(err){flash(err.message)}finally{setLoading(false)}
 }
 async function reviewClaim(claimId,status){
  try {
   await api(`/claims/${claimId}/status`,{method:'PATCH',body:JSON.stringify({status})});
   flash(status==='APPROVED'?'Claim approved.':'Claim rejected and meals returned to availability.');
   await refresh();
  } catch(e){flash(e.message)}
 }
 async function arrangeDelivery(claim){
  try {
   const drivers=await api('/drivers');
   if(!drivers.length){flash('No driver accounts are registered yet.');return}
   const choices=drivers.map(d=>`${d.id}: ${d.fullName} (${d.city||'city not set'})`).join('\n');
   const driverId=Number(prompt(`Enter the driver ID to assign:\n${choices}`,String(drivers[0].id)));
   if(!driverId || !drivers.some(d=>d.id===driverId)) return;
   const deliveryAddress=prompt('Enter the delivery address for this claim:',user?.city||'');
   if(!deliveryAddress?.trim()) return;
   await api(`/claims/${claim.id}/delivery`,{method:'POST',body:JSON.stringify({driverId,deliveryAddress:deliveryAddress.trim()})});
   flash('Delivery assigned to driver.');
   await refresh();
   setPage('deliveries');
  } catch(e){flash(e.message)}
 }
 async function matchFoodRequest(requestRow){
  const available=items.filter(d=>!String(d.id).startsWith('demo-')&&Number(d.remainingMeals)>=Number(requestRow.requestedMeals));
  if(!available.length){flash('You need a donation with enough available meals before matching this request.');return}
  const choices=available.map(d=>`${d.id}: ${d.foodName} (${d.remainingMeals} meals)`).join('\n');
  const donationId=Number(prompt(`Choose your donation ID to offer for this request:\n${choices}`,String(available[0].id)));
  if(!donationId||!available.some(d=>Number(d.id)===donationId))return;
  try{await api(`/requests/${requestRow.id}/match`,{method:'POST',body:JSON.stringify({donationId})});flash('Your donation was matched to the food request.');await refresh()}
  catch(e){flash(e.message)}
 }
 async function arrangeRequestDelivery(requestRow){
  try{
   const drivers=await api('/drivers');
   if(!drivers.length){flash('No driver accounts are registered yet.');return}
   const choices=drivers.map(d=>`${d.id}: ${d.fullName} (${d.city||'city not set'})`).join('\n');
   const driverId=Number(prompt(`Enter the driver ID to assign:\n${choices}`,String(drivers[0].id)));
   if(!driverId||!drivers.some(d=>d.id===driverId))return;
   const deliveryAddress=prompt('Confirm delivery address:',requestRow.deliveryAddress||user?.city||'');
   if(!deliveryAddress?.trim())return;
   await api(`/requests/${requestRow.id}/delivery`,{method:'POST',body:JSON.stringify({driverId,deliveryAddress:deliveryAddress.trim()})});
   flash('Delivery assigned for the matched food request.');await refresh();setPage('deliveries');
  }catch(e){flash(e.message)}
 }
 async function shareLocation(delivery){
  if(!navigator.geolocation){flash('This browser does not support GPS location.');return}
  navigator.geolocation.getCurrentPosition(async pos=>{
   try{
    await api('/tracking',{method:'POST',body:JSON.stringify({deliveryId:delivery.id,latitude:pos.coords.latitude,longitude:pos.coords.longitude,speed:pos.coords.speed==null?null:pos.coords.speed})});
    flash('Your current location was shared for this delivery.');
   }catch(e){flash(e.message)}
  },err=>flash(`Could not get GPS location: ${err.message}`),{enableHighAccuracy:true,timeout:10000});
 }
 const nav=[
  {id:'discover',label:'Discover food',icon:Search},
  {id:'my-donations',label:'My donations',icon:PackageCheck,roles:['RESTAURANT']},
  {id:'claims',label:'My claims',icon:HandHeart,roles:['NGO','RECIPIENT']},
  {id:'requests',label:'Food requests',icon:ClipboardList,roles:['NGO','RECIPIENT','RESTAURANT']},
  {id:'deliveries',label:'Deliveries',icon:Truck,roles:['NGO','RECIPIENT','DRIVER']},
 ];
 const activeNav=nav.filter(n=>!n.roles||n.roles.includes(user?.role));
 const currentTitle=({discover:'Discover surplus food','my-donations':'Your donations',claims:'Your food claims',requests:'Community food requests',deliveries:'Delivery workspace'})[page]||'Discover surplus food';
 return <div className="app-shell">
  <aside className={`sidebar ${mobileNav?'open':''}`}>
   <div className="brand"><span className="brand-mark"><Leaf size={21}/></span><span>annara<span className="brand-dot">.</span><small>FOOD RESCUE NETWORK</small></span><button className="icon-btn close-mobile" onClick={()=>setMobileNav(false)}><X/></button></div>
   <div className="workspace-label">WORKSPACE</div>
   <nav>{activeNav.map(n=><button key={n.id} className={`nav-item ${page===n.id?'active':''}`} onClick={()=>{setPage(n.id);setMobileNav(false)}}><n.icon size={18}/><span>{n.label}</span>{n.id==='discover'&&<span className="nav-count">{items.length}</span>}</button>)}</nav>
   <div className="sidebar-bottom">
    <div className="impact-card"><div className="impact-icon"><HeartHandshake size={19}/></div><strong>Good food. Shared good.</strong><p>Every rescued meal is a small win for someone.</p><div className="impact-line"><span/></div><small>LOCAL IMPACT STARTS HERE</small></div>
    {user?<div className="user-mini"><div className="avatar">{(user.fullName||'A').slice(0,1).toUpperCase()}</div><div className="user-mini-text"><strong>{user.organisationName||user.fullName}</strong><span>{user.role}</span></div><button className="icon-btn" onClick={logout} title="Sign out"><LogOut size={17}/></button></div>:<button className="sign-in-side" onClick={()=>setShowAuth(true)}><UserRound size={17}/> Sign in to your account <ChevronRight size={16}/></button>}
   </div>
  </aside>
  {mobileNav&&<div className="mobile-scrim" onClick={()=>setMobileNav(false)}/>}
  <main className="main">
   <header className="topbar"><button className="icon-btn mobile-menu" onClick={()=>setMobileNav(true)}><Menu/></button><div className="crumb"><span>Workspace</span><ChevronRight size={14}/><strong>{currentTitle}</strong></div><div className="top-actions"><span className="status-pill"><span/> Community network</span>{user?<button className="profile-pill" onClick={()=>flash(`${user.fullName} · ${user.role}`)}><span className="avatar small">{user.fullName.slice(0,1)}</span><span>{user.fullName.split(' ')[0]}</span></button>:<button className="btn btn-dark btn-sm" onClick={()=>setShowAuth(true)}>Sign in <ArrowUpRight size={15}/></button>}</div></header>
   <div className="content">
    <section className="hero"><div className="hero-copy"><div className="eyebrow"><span className="eyebrow-dot"/> FOOD RESCUE, MADE HUMAN</div><h1>Good food deserves<br/><em>another table.</em></h1><p>Connect surplus meals with the people and communities who need them. A little less waste, a lot more care.</p><div className="hero-actions"><button className="btn btn-lime" onClick={()=>user?.role==='RESTAURANT'?setShowDonation(true):document.getElementById('food-list')?.scrollIntoView({behavior:'smooth'})}>{user?.role==='RESTAURANT'?<><Plus size={17}/> Post a donation</>:<>Explore available food <ArrowUpRight size={16}/></>}</button><button className="btn btn-ghost" onClick={()=>user?setShowRequest(true):setShowAuth(true)}><HeartHandshake size={17}/> Request food</button></div><div className="hero-proof"><div className="proof-avatars"><span>R</span><span>N</span><span>♥</span></div><span>For restaurants, NGOs & neighbours</span></div></div><div className="hero-visual"><img src="https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=1000&q=90" alt="Fresh food ready to share"/><div className="visual-badge"><span className="visual-badge-icon"><Leaf size={17}/></span><span><strong>Make good go further</strong><small>Share a meal. Share hope.</small></span></div><div className="visual-stamp"><HeartHandshake size={21}/><span>FOOD<br/>FOR ALL</span></div></div></section>
    <section className="stats-grid"><Stat icon={Utensils} value={items.reduce((a,x)=>a+(Number(x.remainingMeals)||0),0).toLocaleString()} label="Meals available" note="Ready to be rescued"/><Stat icon={MapPin} value={new Set(items.map(x=>x.city).filter(Boolean)).size||'—'} label="Communities" note="Places connected"/><Stat icon={Users} value={new Set(items.map(x=>x.donorName).filter(Boolean)).size} label="Food partners" note="Sharing what they can"/><Stat icon={HeartHandshake} value="100%" label="Heart behind it" note="Every meal matters" last/></section>
    <section className="section-head" id="food-list"><div><div className="eyebrow muted">THE RESCUE BOARD</div><h2>{page==='discover'?'Food looking for a home':currentTitle}</h2><p>{page==='discover'?'Fresh listings from kitchens, hotels, events and local partners.':'Your community activity, all in one place.'}</p></div><div className="section-actions">{user?.role==='RESTAURANT'&&<button className="btn btn-dark" onClick={()=>setShowDonation(true)}><Plus size={17}/> New donation</button>}{(user?.role==='NGO'||user?.role==='RECIPIENT')&&<button className="btn btn-dark" onClick={()=>setShowRequest(true)}><Plus size={17}/> Request food</button>}</div></section>
    {page==='discover'&&<div className="filter-row"><div className="searchbox"><Search size={18}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search food, kitchens or neighbourhoods..."/>{query&&<button onClick={()=>setQuery('')}><X size={15}/></button>}</div><div className="filter-note"><Filter size={15}/> Showing {filtered.length} listings</div></div>}
    {page==='discover'&&<div className="food-grid">{filtered.map(item=><FoodCard key={item.id} item={item} onClaim={()=>claim(item)} loading={busyId===item.id} user={user}/>)}{!filtered.length&&<Empty title="No food found just yet" text="Try another search. New donations can appear at any time."/>}</div>}
    {page==='my-donations'&&<><div className="food-grid">{items.filter(x=>!String(x.id).startsWith('demo-')&&user).map(item=><FoodCard key={item.id} item={item} onClaim={()=>{}} user={user} own/>)}{!items.some(x=>!String(x.id).startsWith('demo-'))&&<Empty title="Your rescue story starts here" text="Post surplus food from your restaurant, hotel or organisation so it can find a new home." action="Post a donation" onAction={()=>setShowDonation(true)}/>}</div><div className="table-card" style={{marginTop:24}}><div className="table-head"><strong>Claims on your donations</strong><span>{donorClaims.length} claims</span></div>{donorClaims.length?donorClaims.map(c=><div className="activity-row" key={c.id}><div className="activity-icon"><HandHeart/></div><div className="activity-main"><strong>{c.foodName} · {c.requestedMeals} meals</strong><span>{c.claimantName||'Community member'}{c.claimantOrganisation?` · ${c.claimantOrganisation}`:''} · {c.claimantRole||'Recipient'} · {c.claimantPhone||c.claimantEmail||''}</span></div><span className="badge-green">{c.status}</span>{c.status==='PENDING'&&<><button className="btn btn-outline btn-sm" onClick={()=>reviewClaim(c.id,'APPROVED')}>Approve</button><button className="btn btn-outline btn-sm" onClick={()=>reviewClaim(c.id,'REJECTED')}>Reject</button></>}</div>):<Empty title="No claims yet" text="When an NGO or community member claims your food, their details and claim will appear here."/>}</div></>}
    {page==='claims'&&<div className="table-card"><div className="table-head"><strong>Claim history</strong><span>{claims.length} records</span></div>{claims.length?claims.map(c=><div className="activity-row" key={c.id}><div className="activity-icon"><HandHeart/></div><div className="activity-main"><strong>{c.foodName}</strong><span>{c.donorName} · {c.requestedMeals} meals</span></div><span className="badge-green">{c.status}</span>{c.status==='PENDING'&&<button className="btn btn-outline btn-sm" onClick={async()=>{try{await api(`/claims/${c.id}`,{method:'DELETE'});flash('Pending claim cancelled.');await refresh()}catch(e){flash(e.message)}}}>Cancel claim</button>}{(c.status==='APPROVED'||c.status==='CONFIRMED')&&<button className="btn btn-outline btn-sm" onClick={()=>arrangeDelivery(c)}>Arrange delivery</button>}</div>):<Empty title="No claims yet" text="Find food in Discover and claim the quantity your community can collect." action="Discover food" onAction={()=>setPage('discover')}/>}</div>}
    {page==='requests'&&<div className="table-card"><div className="table-head"><strong>Community requests</strong><button className="btn btn-outline btn-sm" onClick={()=>setShowRequest(true)}><Plus size={15}/> New request</button></div>{requests.length?requests.map(r=><div className="activity-row" key={r.id}><div className="activity-icon"><ClipboardList/></div><div className="activity-main"><strong>{r.foodName} · {r.requestedMeals} meals</strong><span>{r.requesterName} · {r.deliveryAddress}{r.urgency?` · ${r.urgency}`:''}{r.neededBefore?` · Needed by ${fmt(r.neededBefore)}`:''}</span></div><span className="badge-green">{r.status}</span>{user?.role==='RESTAURANT'&&r.status==='OPEN'&&<button className="btn btn-outline btn-sm" onClick={()=>matchFoodRequest(r)}>Offer donation</button>}{(user?.role==='NGO'||user?.role==='RECIPIENT')&&r.status==='MATCHED'&&<button className="btn btn-outline btn-sm" onClick={()=>arrangeRequestDelivery(r)}>Arrange delivery</button>}</div>):<Empty title="Requests bring help closer" text="Post a request for food needed by your community." action="Create request" onAction={()=>setShowRequest(true)}/>}</div>}
    {page==='deliveries'&&<div className="table-card"><div className="table-head"><strong>Delivery coordination</strong><span>{deliveries.length} deliveries</span></div>{deliveries.length?deliveries.map(d=><div className="activity-row" key={d.id}><div className="activity-icon"><Truck/></div><div className="activity-main"><strong>{d.foodName} · {d.mealCount} meals</strong><span>Pickup: {d.pickupAddress||'—'} · Drop-off: {d.deliveryAddress}{d.recipientName?` · Recipient: ${d.recipientName}`:''}{d.recipientPhone?` · ${d.recipientPhone}`:''}</span></div><span className="badge-green">{d.status}</span>{user?.role==='DRIVER'&&d.status!=='DELIVERED'&&d.status!=='CANCELLED'&&<><button className="btn btn-outline btn-sm" onClick={async()=>{try{const next=d.status==='ASSIGNED'?'PICKED_UP':d.status==='PICKED_UP'?'IN_TRANSIT':'DELIVERED';await api(`/deliveries/${d.id}/status`,{method:'PATCH',body:JSON.stringify({status:next})});await refresh();flash('Delivery status updated.')}catch(e){flash(e.message)}}}>Update status</button><button className="btn btn-outline btn-sm" onClick={()=>shareLocation(d)}>Share GPS</button></>}</div>):<Empty title="Every delivery connects a community" text="Once an approved claim has a driver assigned, the delivery will appear here."/>}</div>}
    <footer><div className="footer-brand"><Leaf size={17}/> annara<span>.</span></div><span>Built around the belief that good food should be shared.</span><span>Food safety comes first · <a href="#food-list">Explore food</a></span></footer>
   </div>
  </main>
  {notice&&<div className="toast"><CircleCheck size={18}/>{notice}</div>}
  {showAuth&&<Modal title={authMode==='login'?'Welcome back':'Join the food rescue network'} subtitle={authMode==='login'?'Good to have you here again.':'Create an account for your organisation or community.'} onClose={()=>setShowAuth(false)}><form onSubmit={submitAuth} className="form-stack">
   {authMode==='register'&&<><Field label="Your full name"><input required value={authForm.fullName} onChange={e=>setAuthForm({...authForm,fullName:e.target.value})} placeholder="e.g. Aanya Sharma"/></Field><Field label="Organisation name (optional)"><input value={authForm.organisationName} onChange={e=>setAuthForm({...authForm,organisationName:e.target.value})} placeholder="Hotel, NGO, restaurant or group"/></Field><div className="form-two"><Field label="Account type"><select value={authForm.role} onChange={e=>setAuthForm({...authForm,role:e.target.value})}><option value="NGO">NGO</option><option value="RESTAURANT">Restaurant / Hotel</option><option value="RECIPIENT">Community member</option><option value="DRIVER">Delivery driver</option></select></Field><Field label="City"><input value={authForm.city} onChange={e=>setAuthForm({...authForm,city:e.target.value})} placeholder="Your city"/></Field></div><Field label="Phone (optional)"><input value={authForm.phone} onChange={e=>setAuthForm({...authForm,phone:e.target.value})} placeholder="+91 ..."/></Field></>}
   <Field label="Email address"><input type="email" required value={authForm.email} onChange={e=>setAuthForm({...authForm,email:e.target.value})} placeholder="you@example.com"/></Field><Field label="Password"><input type="password" minLength="8" required value={authForm.password} onChange={e=>setAuthForm({...authForm,password:e.target.value})} placeholder="At least 8 characters"/></Field>
   <button className="btn btn-dark full" disabled={loading}>{loading?'Please wait...':authMode==='login'?'Sign in securely':'Create account'} <ArrowUpRight size={16}/></button>
   <p className="form-switch">{authMode==='login'?"New to Annara?":"Already part of Annara?"} <button type="button" onClick={()=>setAuthMode(authMode==='login'?'register':'login')}>{authMode==='login'?'Create an account':'Sign in'}</button></p>
  </form></Modal>}
  {showDonation&&<Modal title="Share surplus food" subtitle="A few details help the right people collect it in time." onClose={()=>setShowDonation(false)}><form onSubmit={createDonation} className="form-stack">
   <Field label="Food name"><input required value={donation.foodName} onChange={e=>setDonation({...donation,foodName:e.target.value})} placeholder="e.g. Fresh lunch boxes"/></Field>
   <div className="form-two"><Field label="Food type"><select value={donation.foodType} onChange={e=>setDonation({...donation,foodType:e.target.value})}><option>Vegetarian</option><option>Vegan</option><option>Bakery</option><option>Mixed</option><option>Other</option></select></Field><Field label="Meal portions"><input type="number" min="1" max="100000" required value={donation.totalMeals} onChange={e=>setDonation({...donation,totalMeals:e.target.value})}/></Field></div>
   <div className="form-two"><Field label="Donation source"><select value={donation.sourceType} onChange={e=>setDonation({...donation,sourceType:e.target.value})}><option value="RESTAURANT">Restaurant / Hotel</option><option value="CATERING">Catering service</option><option value="WEDDING">Wedding / Party</option><option value="COLLEGE_EVENT">College festival / event</option><option value="CORPORATE_EVENT">Corporate gathering</option><option value="COMMUNITY_EVENT">Community event</option><option value="OTHER">Other</option></select></Field><Field label="Restaurant / event name"><input value={donation.sourceName} onChange={e=>setDonation({...donation,sourceName:e.target.value})} placeholder="e.g. Test Kitchen or College Fest"/></Field></div>
   <Field label="Description & allergens"><textarea rows="3" value={donation.description} onChange={e=>setDonation({...donation,description:e.target.value})} placeholder="Preparation time, packaging, allergens, storage..."/></Field>
   <Field label="Pickup address"><input required value={donation.pickupAddress} onChange={e=>setDonation({...donation,pickupAddress:e.target.value})} placeholder="Street, area, landmark"/></Field>
   <Field label="Collect before"><input type="datetime-local" required min={new Date(Date.now()+60000).toISOString().slice(0,16)} value={donation.pickupBefore} onChange={e=>setDonation({...donation,pickupBefore:e.target.value})}/></Field>
   <label className="upload-box"><input type="file" accept="image/*" capture="environment" onChange={e=>setDonationFile(e.target.files?.[0]||null)}/>{donationFile?<><img src={URL.createObjectURL(donationFile)} alt="Preview"/><span>{donationFile.name}</span></>:<><span className="upload-icon"><Camera size={22}/></span><strong>Add a food photo</strong><small>Take a photo or choose from your device · Max 5 MB</small></>}</label>
   <p className="safety-note"><ShieldCheck size={16}/> Please list allergens and follow local food-safety requirements. A photo alone cannot establish food safety.</p>
   <button className="btn btn-dark full" disabled={loading}>{loading?'Publishing...':'Publish donation'} <ArrowUpRight size={16}/></button>
  </form></Modal>}
  {showRequest&&<Modal title="Request food for your community" subtitle="Tell donors what is needed and where it should go." onClose={()=>setShowRequest(false)}><form onSubmit={createRequest} className="form-stack">
   <Field label="Food needed"><input required value={request.foodName} onChange={e=>setRequest({...request,foodName:e.target.value})} placeholder="e.g. Vegetarian meals"/></Field>
   <Field label="Meal portions"><input type="number" min="1" max="100000" required value={request.requestedMeals} onChange={e=>setRequest({...request,requestedMeals:e.target.value})}/></Field>
   <Field label="Who needs it / extra details"><textarea rows="3" value={request.description} onChange={e=>setRequest({...request,description:e.target.value})} placeholder="Number of families, dietary requirements, extra details..."/></Field>
   <div className="form-two"><Field label="Urgency"><select value={request.urgency} onChange={e=>setRequest({...request,urgency:e.target.value})}><option value="LOW">Low</option><option value="NORMAL">Normal</option><option value="HIGH">High</option><option value="URGENT">Urgent</option></select></Field><Field label="Needed before (optional)"><input type="datetime-local" min={new Date(Date.now()+60000).toISOString().slice(0,16)} value={request.neededBefore} onChange={e=>setRequest({...request,neededBefore:e.target.value})}/></Field></div>
   <Field label="Delivery or collection address"><input required value={request.deliveryAddress} onChange={e=>setRequest({...request,deliveryAddress:e.target.value})} placeholder="Area, city, landmark"/></Field>
   <button className="btn btn-dark full" disabled={loading}>{loading?'Posting...':'Post food request'} <ArrowUpRight size={16}/></button>
  </form></Modal>}
 </div>
}
function Stat({icon:Icon,value,label,note,last}){return <div className={`stat-card ${last?'last':''}`}><div className="stat-top"><span className="stat-icon"><Icon size={18}/></span><span className="stat-note">{note}</span></div><strong className="stat-value">{value}</strong><span className="stat-label">{label}</span></div>}
function FoodCard({item,onClaim,loading,user,own}){const [broken,setBroken]=useState(false);return <article className="food-card"><div className="food-image">{item.imageUrl&&!broken?<img src={item.imageUrl.startsWith('http')?item.imageUrl:`${API.replace('/api','')}${item.imageUrl}`} alt={item.foodName} onError={()=>setBroken(true)}/>:<div className="food-placeholder"><Utensils size={35}/><span>Fresh food, shared with care</span></div>}<span className="food-tag">{item.foodType||'Prepared food'}</span><span className="meals-tag"><Users size={14}/>{item.remainingMeals} portions</span></div><div className="food-body"><div className="donor-line"><span className="donor-avatar"><Utensils size={13}/></span><span>{item.donorName||'Community donor'}</span><ShieldCheck size={14} className="verified"/></div><h3>{item.foodName}</h3><p className="food-description">{item.description||'Surplus food available for collection.'}</p><div className="food-meta"><div><MapPin size={15}/><span>{item.pickupAddress||item.city||'Pickup location provided after sign-in'}</span></div><div><Clock3 size={15}/><span>Collect before {fmt(item.pickupBefore)}</span></div></div><div className="food-footer"><span className="fresh-status"><span/> {item.status==='PARTIALLY_CLAIMED'?'Partially claimed':'Available for pickup'}</span>{own?<span className="badge-green">{item.status}</span>:<button className="claim-btn" onClick={onClaim} disabled={loading}>{loading?'Claiming...':'Claim meals'} <ArrowUpRight size={15}/></button>}</div></div></article>}
function Empty({title,text,action,onAction}){return <div className="empty-state"><span><HandHeart size={26}/></span><h3>{title}</h3><p>{text}</p>{action&&<button className="btn btn-dark" onClick={onAction}>{action} <ArrowUpRight size={15}/></button>}</div>}
function Field({label,children}){return <label className="field"><span>{label}</span>{children}</label>}
function Modal({title,subtitle,onClose,children}){return <div className="modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&onClose()}><div className="modal"><div className="modal-head"><div><h2>{title}</h2><p>{subtitle}</p></div><button className="icon-btn" onClick={onClose}><X size={20}/></button></div>{children}</div></div>}
createRoot(document.getElementById('root')).render(<App/>);
