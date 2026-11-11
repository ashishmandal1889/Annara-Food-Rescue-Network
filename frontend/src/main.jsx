import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Leaf, Search, Plus, MapPin, Clock3, Users, Utensils, HeartHandshake,
  Truck, LogOut, UserRound, ArrowUpRight, ShieldCheck, Menu, X,
  CircleCheck, PackageCheck, HandHeart, Filter, ChevronRight, Camera,
  ClipboardList, Navigation, Edit3, Trash2, AlertCircle, ExternalLink,
  ToggleLeft, ToggleRight, Eye, RefreshCw
} from 'lucide-react';
import './style.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:8080/api';

const fmt = v => {
  if (!v) return '—';
  try {
    return new Date(v).toLocaleString([], { hour: 'numeric', minute: '2-digit', month: 'short', day: 'numeric' });
  } catch {
    return v;
  }
};

function App() {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('annara-user')); } catch { return null; }
  });
  const [token, setToken] = useState(() => localStorage.getItem('annara-token') || '');
  const [page, setPage] = useState('discover');

  // Distinct data collections
  const [discoverItems, setDiscoverItems] = useState([]);
  const [myDonations, setMyDonations] = useState([]);
  const [claims, setClaims] = useState([]);
  const [donorClaims, setDonorClaims] = useState([]);
  const [requests, setRequests] = useState([]);
  const [deliveries, setDeliveries] = useState([]);
  const [drivers, setDrivers] = useState([]);

  // Search & Filters
  const [query, setQuery] = useState('');
  const [cityFilter, setCityFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');

  // UI state
  const [notice, setNotice] = useState('');
  const [noticeType, setNoticeType] = useState('success');
  const [authMode, setAuthMode] = useState('login');
  const [showAuth, setShowAuth] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState(null);

  // Modals
  const [showDonation, setShowDonation] = useState(false);
  const [editDonationTarget, setEditDonationTarget] = useState(null);
  const [showRequest, setShowRequest] = useState(false);
  const [claimTarget, setClaimTarget] = useState(null);
  const [claimMealsCount, setClaimMealsCount] = useState(1);
  const [driverAssignTarget, setDriverAssignTarget] = useState(null); // { type: 'claim'|'request', item }
  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [deliveryDropoffAddress, setDeliveryDropoffAddress] = useState('');
  const [matchRequestTarget, setMatchRequestTarget] = useState(null); // request
  const [selectedDonationIdForMatch, setSelectedDonationIdForMatch] = useState('');
  const [trackingTarget, setTrackingTarget] = useState(null); // delivery
  const [trackingData, setTrackingData] = useState(null);
  const [proofTarget, setProofTarget] = useState(null); // delivery
  const [proofFile, setProofFile] = useState(null);
  const [confirmModal, setConfirmModal] = useState(null); // { title, message, onConfirm }

  // Forms
  const [authForm, setAuthForm] = useState({ fullName: '', organisationName: '', email: '', password: '', role: 'NGO', city: 'Bengaluru', phone: '' });
  const [donation, setDonation] = useState({ foodName: '', description: '', foodType: 'Vegetarian', sourceType: 'RESTAURANT', sourceName: '', totalMeals: 20, pickupAddress: '', pickupBefore: '' });
  const [donationFile, setDonationFile] = useState(null);
  const [request, setRequest] = useState({ foodName: '', requestedMeals: 10, description: '', urgency: 'NORMAL', neededBefore: '', deliveryAddress: '' });

  const headers = () => (token ? { Authorization: `Bearer ${token}` } : {});

  async function api(path, opts = {}) {
    const isFormData = opts.body instanceof FormData;
    const res = await fetch(`${API}${path}`, {
      ...opts,
      headers: {
        ...headers(),
        ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
        ...(opts.headers || {})
      }
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (res.status === 401 && token) {
        logout('Session expired. Please sign in again.');
      }
      throw new Error(data.error || data.message || `Request failed (${res.status})`);
    }
    return data;
  }

  function flash(s, type = 'success') {
    setNotice(s);
    setNoticeType(type);
    setTimeout(() => setNotice(''), 3800);
  }

  // Session verification on mount
  useEffect(() => {
    if (token) {
      api('/me')
        .then(u => {
          if (u && u.id) {
            setUser(u);
            localStorage.setItem('annara-user', JSON.stringify(u));
          }
        })
        .catch(() => {});
    }
  }, [token]);

  async function refresh() {
    // 1. Fetch public donations (Always fetch for Discover)
    try {
      const publicDonations = await api('/donations');
      setDiscoverItems(Array.isArray(publicDonations) ? publicDonations : []);
    } catch {
      setDiscoverItems([]);
    }

    // 2. Fetch authenticated workspace data
    if (token) {
      if (user?.role === 'RESTAURANT' || user?.role === 'ADMIN') {
        try {
          const own = await api('/donations/mine');
          setMyDonations(Array.isArray(own) ? own : []);
          const claimsLists = await Promise.all(
            (Array.isArray(own) ? own : []).map(d => api(`/donations/${d.id}/claims`).catch(() => []))
          );
          setDonorClaims(claimsLists.flat());
        } catch {
          setMyDonations([]);
          setDonorClaims([]);
        }
      }

      if (['NGO', 'RECIPIENT', 'ADMIN'].includes(user?.role)) {
        try { setClaims(await api('/claims/mine')); } catch { setClaims([]); }
      }

      try {
        setRequests(await api('/requests'));
      } catch {
        setRequests([]);
      }

      try {
        setDeliveries(await api('/deliveries/mine'));
      } catch {
        setDeliveries([]);
      }

      if (['NGO', 'RECIPIENT', 'ADMIN'].includes(user?.role)) {
        try {
          const drvs = await api('/drivers');
          setDrivers(Array.isArray(drvs) ? drvs : []);
        } catch {
          setDrivers([]);
        }
      }
    } else {
      setMyDonations([]);
      setClaims([]);
      setDonorClaims([]);
      setRequests([]);
      setDeliveries([]);
      setDrivers([]);
    }
  }

  useEffect(() => {
    refresh();
  }, [token, user?.role]);

  // Derived filter list
  const availableCities = useMemo(() => {
    const set = new Set();
    discoverItems.forEach(x => { if (x.city) set.add(x.city); });
    return Array.from(set);
  }, [discoverItems]);

  const filteredDiscover = useMemo(() => {
    return discoverItems.filter(x => {
      const textMatch = `${x.foodName} ${x.description || ''} ${x.donorName || ''} ${x.city || ''} ${x.sourceName || ''} ${x.foodType || ''}`.toLowerCase().includes(query.toLowerCase());
      const cityMatch = cityFilter === 'ALL' || (x.city || '').toLowerCase() === cityFilter.toLowerCase();
      const typeMatch = typeFilter === 'ALL' || (x.foodType || '').toLowerCase() === typeFilter.toLowerCase();
      return textMatch && cityMatch && typeMatch;
    });
  }, [discoverItems, query, cityFilter, typeFilter]);

  function logout(msg) {
    setToken('');
    setUser(null);
    localStorage.removeItem('annara-token');
    localStorage.removeItem('annara-user');
    setPage('discover');
    flash(msg || 'You have been signed out.');
  }

  async function submitAuth(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const path = authMode === 'login' ? '/auth/login' : '/auth/register';
      const payload = authMode === 'login' ? { email: authForm.email, password: authForm.password } : authForm;
      const data = await api(path, { method: 'POST', body: JSON.stringify(payload) });
      setToken(data.token);
      setUser(data.user);
      localStorage.setItem('annara-token', data.token);
      localStorage.setItem('annara-user', JSON.stringify(data.user));
      setShowAuth(false);
      if (data.user.role === 'RESTAURANT') setPage('my-donations');
      else if (data.user.role === 'DRIVER') setPage('deliveries');
      else setPage('discover');
      flash(`Welcome to Annara, ${data.user.fullName.split(' ')[0]}!`);
    } catch (err) {
      flash(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  // --- DONATIONS ---
  async function createDonation(e) {
    e.preventDefault();
    if (!token) { setShowAuth(true); return; }
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('data', new Blob([JSON.stringify({
        ...donation,
        totalMeals: Number(donation.totalMeals),
        pickupBefore: new Date(donation.pickupBefore).toISOString().slice(0, 19)
      })], { type: 'application/json' }));
      if (donationFile) fd.append('image', donationFile);

      await api('/donations', { method: 'POST', body: fd });
      setShowDonation(false);
      setDonationFile(null);
      setDonation({ foodName: '', description: '', foodType: 'Vegetarian', sourceType: 'RESTAURANT', sourceName: '', totalMeals: 20, pickupAddress: '', pickupBefore: '' });
      await refresh();
      setPage('my-donations');
      flash('Donation published. Thank you for rescuing food!');
    } catch (err) {
      flash(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  async function updateDonation(e) {
    e.preventDefault();
    if (!editDonationTarget) return;
    setLoading(true);
    try {
      await api(`/donations/${editDonationTarget.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          foodName: editDonationTarget.foodName,
          description: editDonationTarget.description,
          foodType: editDonationTarget.foodType,
          sourceType: editDonationTarget.sourceType,
          sourceName: editDonationTarget.sourceName,
          totalMeals: Number(editDonationTarget.totalMeals),
          pickupAddress: editDonationTarget.pickupAddress,
          pickupBefore: new Date(editDonationTarget.pickupBefore).toISOString().slice(0, 19)
        })
      });
      setEditDonationTarget(null);
      await refresh();
      flash('Donation details updated.');
    } catch (err) {
      flash(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  async function cancelDonationAction(donationId) {
    setConfirmModal({
      title: 'Cancel Donation',
      message: 'Are you sure you want to cancel this donation? Any pending claims will also be cancelled.',
      onConfirm: async () => {
        try {
          await api(`/donations/${donationId}/cancel`, { method: 'PATCH' });
          flash('Donation cancelled.');
          await refresh();
        } catch (e) {
          flash(e.message, 'error');
        }
      }
    });
  }

  // --- CLAIMS ---
  function openClaimModal(item) {
    if (!token) { setShowAuth(true); return; }
    setClaimTarget(item);
    setClaimMealsCount(Math.min(10, item.remainingMeals || 1));
  }

  async function submitClaim(e) {
    e.preventDefault();
    if (!claimTarget) return;
    setLoading(true);
    try {
      await api(`/donations/${claimTarget.id}/claims`, {
        method: 'POST',
        body: JSON.stringify({ requestedMeals: Number(claimMealsCount) })
      });
      flash(`Claim requested for ${claimMealsCount} meals. Waiting for donor confirmation.`);
      setClaimTarget(null);
      await refresh();
      setPage('claims');
    } catch (err) {
      flash(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  async function reviewClaim(claimId, status) {
    try {
      await api(`/claims/${claimId}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
      flash(status === 'APPROVED' ? 'Claim approved.' : 'Claim rejected and portions returned to availability.');
      await refresh();
    } catch (e) {
      flash(e.message, 'error');
    }
  }

  async function cancelClaimAction(claimId) {
    setConfirmModal({
      title: 'Cancel Claim',
      message: 'Are you sure you want to cancel this pending claim? Reserved portions will be returned to the donation.',
      onConfirm: async () => {
        try {
          await api(`/claims/${claimId}`, { method: 'DELETE' });
          flash('Pending claim cancelled.');
          await refresh();
        } catch (e) {
          flash(e.message, 'error');
        }
      }
    });
  }

  // --- REQUESTS ---
  async function createRequest(e) {
    e.preventDefault();
    setLoading(true);
    try {
      await api('/requests', {
        method: 'POST',
        body: JSON.stringify({
          ...request,
          requestedMeals: Number(request.requestedMeals),
          neededBefore: request.neededBefore || null
        })
      });
      setShowRequest(false);
      setRequest({ foodName: '', requestedMeals: 10, description: '', urgency: 'NORMAL', neededBefore: '', deliveryAddress: '' });
      await refresh();
      setPage('requests');
      flash('Your food request has been posted.');
    } catch (err) {
      flash(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  async function cancelRequestAction(requestId) {
    setConfirmModal({
      title: 'Cancel Food Request',
      message: 'Are you sure you want to cancel this food request?',
      onConfirm: async () => {
        try {
          await api(`/requests/${requestId}`, { method: 'DELETE' });
          flash('Food request cancelled.');
          await refresh();
        } catch (e) {
          flash(e.message, 'error');
        }
      }
    });
  }

  function openMatchModal(req) {
    const eligible = myDonations.filter(d =>
      d.status !== 'CANCELLED' &&
      Number(d.remainingMeals) >= Number(req.requestedMeals)
    );
    if (!eligible.length) {
      flash(`You need a donation with at least ${req.requestedMeals} remaining portions to match this request.`, 'error');
      return;
    }
    setMatchRequestTarget(req);
    setSelectedDonationIdForMatch(String(eligible[0].id));
  }

  async function submitMatchRequest(e) {
    e.preventDefault();
    if (!matchRequestTarget || !selectedDonationIdForMatch) return;
    setLoading(true);
    try {
      await api(`/requests/${matchRequestTarget.id}/match`, {
        method: 'POST',
        body: JSON.stringify({ donationId: String(selectedDonationIdForMatch) })
      });
      flash('Your donation was matched to the food request.');
      setMatchRequestTarget(null);
      await refresh();
    } catch (err) {
      flash(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  // --- DELIVERY ARRANGEMENT ---
  function openDriverAssignModal(type, item) {
    if (!drivers.length) {
      flash('No registered drivers found. Please register a driver account first.', 'error');
      return;
    }
    setDriverAssignTarget({ type, item });
    setSelectedDriverId(String(drivers[0].id));
    setDeliveryDropoffAddress(item.deliveryAddress || user?.city || '');
  }

  async function submitDriverAssignment(e) {
    e.preventDefault();
    if (!driverAssignTarget || !selectedDriverId || !deliveryDropoffAddress.trim()) return;
    setLoading(true);
    try {
      const { type, item } = driverAssignTarget;
      const path = type === 'claim' ? `/claims/${item.id}/delivery` : `/requests/${item.id}/delivery`;
      await api(path, {
        method: 'POST',
        body: JSON.stringify({
          driverId: String(selectedDriverId),
          deliveryAddress: deliveryDropoffAddress.trim()
        })
      });
      flash('Delivery successfully assigned to driver.');
      setDriverAssignTarget(null);
      await refresh();
      setPage('deliveries');
    } catch (err) {
      flash(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  // --- DRIVER WORKFLOW & GPS ---
  async function advanceDeliveryStatus(delivery) {
    const next = delivery.status === 'ASSIGNED' ? 'PICKED_UP' : delivery.status === 'PICKED_UP' ? 'IN_TRANSIT' : 'DELIVERED';
    setBusyId(delivery.id);
    try {
      await api(`/deliveries/${delivery.id}/status`, { method: 'PATCH', body: JSON.stringify({ status: next }) });
      flash(`Delivery status updated to ${next}.`);
      await refresh();
    } catch (e) {
      flash(e.message, 'error');
    } finally {
      setBusyId(null);
    }
  }

  async function toggleTracking(delivery) {
    const nextState = !delivery.trackingEnabled;
    try {
      await api(`/deliveries/${delivery.id}/tracking`, { method: 'PATCH', body: JSON.stringify({ enabled: nextState }) });
      flash(`Location tracking ${nextState ? 'enabled' : 'disabled'} for this delivery.`);
      await refresh();
    } catch (e) {
      flash(e.message, 'error');
    }
  }

  async function shareLocation(delivery) {
    if (!navigator.geolocation) {
      flash('This browser does not support GPS location.', 'error');
      return;
    }
    flash('Acquiring high-accuracy GPS coordinates...');
    navigator.geolocation.getCurrentPosition(
      async pos => {
        try {
          await api('/tracking', {
            method: 'POST',
            body: JSON.stringify({
              deliveryId: delivery.id,
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              speed: pos.coords.speed == null ? null : Math.max(0, pos.coords.speed)
            })
          });
          flash(`Location broadcast: Lat ${pos.coords.latitude.toFixed(4)}, Lon ${pos.coords.longitude.toFixed(4)}`);
        } catch (e) {
          flash(e.message, 'error');
        }
      },
      err => flash(`Could not get GPS location: ${err.message}`, 'error'),
      { enableHighAccuracy: true, timeout: 12000 }
    );
  }

  async function viewTrackingModal(delivery) {
    setTrackingTarget(delivery);
    setTrackingData(null);
    try {
      const latest = await api(`/tracking/delivery/${delivery.id}/latest`);
      setTrackingData(latest);
    } catch {
      setTrackingData({ empty: true });
    }
  }

  async function submitProof(e) {
    e.preventDefault();
    if (!proofTarget || !proofFile) return;
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('image', proofFile);
      await api(`/deliveries/${proofTarget.id}/proof`, { method: 'POST', body: fd });
      flash('Proof of delivery photo uploaded.');
      setProofTarget(null);
      setProofFile(null);
      await refresh();
    } catch (err) {
      flash(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  // --- NAVIGATION SPEC ---
  const nav = [
    { id: 'discover', label: 'Discover food', icon: Search },
    { id: 'my-donations', label: 'My donations', icon: PackageCheck, roles: ['RESTAURANT', 'ADMIN'] },
    { id: 'claims', label: 'My claims', icon: HandHeart, roles: ['NGO', 'RECIPIENT', 'ADMIN'] },
    { id: 'requests', label: 'Food requests', icon: ClipboardList, roles: ['NGO', 'RECIPIENT', 'RESTAURANT', 'ADMIN'] },
    { id: 'deliveries', label: 'Deliveries', icon: Truck, roles: ['NGO', 'RECIPIENT', 'DRIVER', 'RESTAURANT', 'ADMIN'] }
  ];

  const activeNav = nav.filter(n => !n.roles || n.roles.includes(user?.role));
  const currentTitle = ({
    discover: 'Discover surplus food',
    'my-donations': 'Your donations',
    claims: 'Your food claims',
    requests: 'Community food requests',
    deliveries: 'Delivery workspace'
  })[page] || 'Discover surplus food';

  return (
    <div className="app-shell">
      {/* SIDEBAR */}
      <aside className={`sidebar ${mobileNav ? 'open' : ''}`}>
        <div className="brand">
          <span className="brand-mark"><Leaf size={21} /></span>
          <span>annara<span className="brand-dot">.</span><small>FOOD RESCUE NETWORK</small></span>
          <button className="icon-btn close-mobile" onClick={() => setMobileNav(false)}><X /></button>
        </div>
        <div className="workspace-label">WORKSPACE</div>
        <nav>
          {activeNav.map(n => (
            <button
              key={n.id}
              className={`nav-item ${page === n.id ? 'active' : ''}`}
              onClick={() => { setPage(n.id); setMobileNav(false); }}
            >
              <n.icon size={18} />
              <span>{n.label}</span>
              {n.id === 'discover' && <span className="nav-count">{discoverItems.length}</span>}
              {n.id === 'my-donations' && user?.role === 'RESTAURANT' && <span className="nav-count">{myDonations.length}</span>}
              {n.id === 'deliveries' && deliveries.length > 0 && <span className="nav-count">{deliveries.length}</span>}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="impact-card">
            <div className="impact-icon"><HeartHandshake size={19} /></div>
            <strong>Good food. Shared good.</strong>
            <p>Every rescued meal is a step forward in reducing waste and hunger.</p>
            <div className="impact-line"><span /></div>
            <small>LOCAL IMPACT STARTS HERE</small>
          </div>
          {user ? (
            <div className="user-mini">
              <div className="avatar">{(user.fullName || 'A').slice(0, 1).toUpperCase()}</div>
              <div className="user-mini-text">
                <strong>{user.organisationName || user.fullName}</strong>
                <span>{user.role} · {user.city || 'Active'}</span>
              </div>
              <button className="icon-btn" onClick={() => logout()} title="Sign out"><LogOut size={17} /></button>
            </div>
          ) : (
            <button className="sign-in-side" onClick={() => { setAuthMode('login'); setShowAuth(true); }}>
              <UserRound size={17} /> Sign in to your account <ChevronRight size={16} />
            </button>
          )}
        </div>
      </aside>

      {mobileNav && <div className="mobile-scrim" onClick={() => setMobileNav(false)} />}

      {/* MAIN VIEW */}
      <main className="main">
        <header className="topbar">
          <button className="icon-btn mobile-menu" onClick={() => setMobileNav(true)}><Menu /></button>
          <div className="crumb">
            <span>Workspace</span>
            <ChevronRight size={14} />
            <strong>{currentTitle}</strong>
          </div>
          <div className="top-actions">
            <span className="status-pill"><span /> Community network</span>
            {user ? (
              <button className="profile-pill" onClick={() => flash(`${user.fullName} (${user.role}) · ${user.email}`)}>
                <span className="avatar small">{(user.fullName || 'U').slice(0, 1).toUpperCase()}</span>
                <span>{user.fullName.split(' ')[0]}</span>
              </button>
            ) : (
              <button className="btn btn-dark btn-sm" onClick={() => { setAuthMode('login'); setShowAuth(true); }}>
                Sign in <ArrowUpRight size={15} />
              </button>
            )}
          </div>
        </header>

        <div className="content">
          {/* HERO BANNER */}
          <section className="hero">
            <div className="hero-copy">
              <div className="eyebrow"><span className="eyebrow-dot" /> FOOD RESCUE, MADE HUMAN</div>
              <h1>Good food deserves<br /><em>another table.</em></h1>
              <p>Connecting surplus food from restaurants, events, and catering with NGOs and communities who need it most.</p>
              <div className="hero-actions">
                {user?.role === 'RESTAURANT' ? (
                  <button className="btn btn-lime" onClick={() => setShowDonation(true)}>
                    <Plus size={17} /> Post a donation
                  </button>
                ) : (
                  <button className="btn btn-lime" onClick={() => document.getElementById('food-list')?.scrollIntoView({ behavior: 'smooth' })}>
                    Explore available food <ArrowUpRight size={16} />
                  </button>
                )}
                <button
                  className="btn btn-ghost"
                  onClick={() => {
                    if (!user) { setShowAuth(true); return; }
                    if (['NGO', 'RECIPIENT', 'ADMIN'].includes(user.role)) setShowRequest(true);
                    else flash('Food requests can be posted by NGOs and recipients.', 'error');
                  }}
                >
                  <HeartHandshake size={17} /> Request food
                </button>
              </div>
              <div className="hero-proof">
                <div className="proof-avatars">
                  <span>R</span><span>N</span><span>♥</span>
                </div>
                <span>For restaurants, caterers, NGOs & neighbors</span>
              </div>
            </div>
            <div className="hero-visual">
              <img src="https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=1000&q=90" alt="Fresh food ready to share" />
              <div className="visual-badge">
                <span className="visual-badge-icon"><Leaf size={17} /></span>
                <span><strong>Make good go further</strong><small>Share a meal. Share hope.</small></span>
              </div>
              <div className="visual-stamp"><HeartHandshake size={21} /><span>FOOD<br />FOR ALL</span></div>
            </div>
          </section>

          {/* STATS */}
          <section className="stats-grid">
            <Stat icon={Utensils} value={discoverItems.reduce((a, x) => a + (Number(x.remainingMeals) || 0), 0).toLocaleString()} label="Meals available" note="Ready to be rescued" />
            <Stat icon={MapPin} value={new Set(discoverItems.map(x => x.city).filter(Boolean)).size || 1} label="Communities" note="Places connected" />
            <Stat icon={Users} value={new Set(discoverItems.map(x => x.donorName).filter(Boolean)).size || 1} label="Food partners" note="Sharing surplus" />
            <Stat icon={HeartHandshake} value="100%" label="Impact verified" note="Every meal counts" last />
          </section>

          {/* SECTION HEADER */}
          <section className="section-head" id="food-list">
            <div>
              <div className="eyebrow muted">THE RESCUE BOARD</div>
              <h2>{page === 'discover' ? 'Food looking for a home' : currentTitle}</h2>
              <p>{page === 'discover' ? 'Fresh listings from kitchens, caterers, events, and local food partners.' : 'Manage your food rescue operations and track active lifecycles.'}</p>
            </div>
            <div className="section-actions">
              {user?.role === 'RESTAURANT' && (
                <button className="btn btn-dark" onClick={() => setShowDonation(true)}>
                  <Plus size={17} /> New donation
                </button>
              )}
              {['NGO', 'RECIPIENT'].includes(user?.role) && (
                <button className="btn btn-dark" onClick={() => setShowRequest(true)}>
                  <Plus size={17} /> Request food
                </button>
              )}
            </div>
          </section>

          {/* PAGE: DISCOVER */}
          {page === 'discover' && (
            <>
              <div className="filter-row">
                <div className="searchbox">
                  <Search size={18} />
                  <input
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder="Search food name, description, kitchen, or city..."
                  />
                  {query && <button onClick={() => setQuery('')}><X size={15} /></button>}
                </div>

                <div className="filter-group">
                  <select className="filter-select" value={cityFilter} onChange={e => setCityFilter(e.target.value)}>
                    <option value="ALL">All Cities</option>
                    {availableCities.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>

                  <select className="filter-select" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
                    <option value="ALL">All Food Types</option>
                    <option value="Vegetarian">Vegetarian</option>
                    <option value="Vegan">Vegan</option>
                    <option value="Bakery">Bakery</option>
                    <option value="Mixed">Mixed</option>
                    <option value="Other">Other</option>
                  </select>

                  <div className="filter-note">
                    <Filter size={15} /> {filteredDiscover.length} listing{filteredDiscover.length === 1 ? '' : 's'}
                  </div>
                </div>
              </div>

              <div className="food-grid">
                {filteredDiscover.map(item => (
                  <FoodCard
                    key={item.id}
                    item={item}
                    onClaim={() => openClaimModal(item)}
                    loading={busyId === item.id}
                    user={user}
                  />
                ))}
                {!filteredDiscover.length && (
                  <Empty
                    title="No surplus food available right now"
                    text={discoverItems.length === 0 ? "No donations have been published yet. Be the first to rescue food and feed the community!" : "No food listings match your search or filter criteria."}
                    action={user?.role === 'RESTAURANT' ? 'Post Food Donation' : (!user ? 'Sign In as Donor' : null)}
                    onAction={() => {
                      if (user?.role === 'RESTAURANT') setShowDonation(true);
                      else if (!user) { setAuthMode('login'); setShowAuth(true); }
                    }}
                  />
                )}
              </div>
            </>
          )}

          {/* PAGE: MY DONATIONS */}
          {page === 'my-donations' && (
            <>
              <div className="food-grid">
                {myDonations.map(item => (
                  <FoodCard
                    key={item.id}
                    item={item}
                    own
                    user={user}
                    onEdit={() => setEditDonationTarget(item)}
                    onCancel={() => cancelDonationAction(item.id)}
                  />
                ))}
                {!myDonations.length && (
                  <Empty
                    title="No donations posted yet"
                    text="Share your surplus food from your kitchen, wedding, or event so it feeds someone in need."
                    action="Post a donation"
                    onAction={() => setShowDonation(true)}
                  />
                )}
              </div>

              <div className="table-card" style={{ marginTop: 28 }}>
                <div className="table-head">
                  <strong>Claims on your donations</strong>
                  <span>{donorClaims.length} claim{donorClaims.length === 1 ? '' : 's'}</span>
                </div>
                {donorClaims.length ? (
                  donorClaims.map(c => (
                    <div className="activity-row" key={c.id}>
                      <div className="activity-icon"><HandHeart /></div>
                      <div className="activity-main">
                        <strong>{c.foodName} · {c.requestedMeals} portions</strong>
                        <span>
                          {c.claimantName || 'Community member'}
                          {c.claimantOrganisation ? ` · ${c.claimantOrganisation}` : ''}
                          {c.claimantRole ? ` (${c.claimantRole})` : ''}
                          {c.claimantPhone ? ` · ${c.claimantPhone}` : ''}
                          {c.claimantEmail ? ` · ${c.claimantEmail}` : ''}
                        </span>
                      </div>
                      <span className={`badge-${c.status.toLowerCase()}`}>{c.status}</span>
                      {c.status === 'PENDING' && (
                        <div className="card-actions">
                          <button className="btn btn-outline btn-sm" onClick={() => reviewClaim(c.id, 'APPROVED')}>Approve</button>
                          <button className="btn btn-outline btn-sm btn-danger" onClick={() => reviewClaim(c.id, 'REJECTED')}>Reject</button>
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <Empty
                    title="No incoming claims yet"
                    text="When an NGO or recipient claims your food, their details will appear here for review."
                  />
                )}
              </div>
            </>
          )}

          {/* PAGE: CLAIMS */}
          {page === 'claims' && (
            <div className="table-card">
              <div className="table-head">
                <strong>Your food claims</strong>
                <span>{claims.length} claim{claims.length === 1 ? '' : 's'}</span>
              </div>
              {claims.length ? (
                claims.map(c => (
                  <div className="activity-row" key={c.id}>
                    <div className="activity-icon"><HandHeart /></div>
                    <div className="activity-main">
                      <strong>{c.foodName}</strong>
                      <span>Donor: {c.donorName || 'Community donor'} · Requested: {c.requestedMeals} meals</span>
                      <small style={{ color: '#8d988b' }}>Claimed {fmt(c.createdAt)}</small>
                    </div>
                    <span className={`badge-${c.status.toLowerCase()}`}>{c.status}</span>
                    <div className="card-actions">
                      {c.status === 'PENDING' && (
                        <button className="btn btn-outline btn-sm" onClick={() => cancelClaimAction(c.id)}>
                          Cancel claim
                        </button>
                      )}
                      {(c.status === 'APPROVED' || c.status === 'CONFIRMED') && (
                        <button className="btn btn-dark btn-sm" onClick={() => openDriverAssignModal('claim', c)}>
                          <Truck size={14} /> Assign delivery
                        </button>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <Empty
                  title="No active claims"
                  text="Browse available donations and request the meal portions your organization can collect."
                  action="Discover food"
                  onAction={() => setPage('discover')}
                />
              )}
            </div>
          )}

          {/* PAGE: REQUESTS */}
          {page === 'requests' && (
            <div className="table-card">
              <div className="table-head">
                <strong>Community food requests</strong>
                {['NGO', 'RECIPIENT', 'ADMIN'].includes(user?.role) && (
                  <button className="btn btn-outline btn-sm" onClick={() => setShowRequest(true)}>
                    <Plus size={15} /> New request
                  </button>
                )}
              </div>
              {requests.length ? (
                requests.map(r => (
                  <div className="activity-row" key={r.id}>
                    <div className="activity-icon"><ClipboardList /></div>
                    <div className="activity-main">
                      <strong>{r.foodName} · {r.requestedMeals} portions</strong>
                      <span>
                        Requester: {r.requesterName} · Destination: {r.deliveryAddress}
                        {r.urgency ? ` · Urgency: ${r.urgency}` : ''}
                        {r.neededBefore ? ` · Needed by ${fmt(r.neededBefore)}` : ''}
                      </span>
                      {r.description && <span style={{ color: '#687766' }}>"{r.description}"</span>}
                    </div>
                    <span className={`badge-${r.status.toLowerCase()}`}>{r.status}</span>
                    <div className="card-actions">
                      {['RESTAURANT', 'ADMIN'].includes(user?.role) && r.status === 'OPEN' && (
                        <button className="btn btn-outline btn-sm" onClick={() => openMatchModal(r)}>
                          Offer donation
                        </button>
                      )}
                      {['NGO', 'RECIPIENT', 'ADMIN'].includes(user?.role) && r.status === 'MATCHED' && (
                        <button className="btn btn-dark btn-sm" onClick={() => openDriverAssignModal('request', r)}>
                          <Truck size={14} /> Assign driver
                        </button>
                      )}
                      {['NGO', 'RECIPIENT', 'ADMIN'].includes(user?.role) && (r.status === 'OPEN' || r.status === 'MATCHED') && (
                        <button className="btn btn-outline btn-sm" onClick={() => cancelRequestAction(r.id)}>
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <Empty
                  title="No food requests yet"
                  text="Post a food request to let restaurants and catering services know what meals your community needs."
                  action={['NGO', 'RECIPIENT', 'ADMIN'].includes(user?.role) ? "Post request" : undefined}
                  onAction={() => setShowRequest(true)}
                />
              )}
            </div>
          )}

          {/* PAGE: DELIVERIES */}
          {page === 'deliveries' && (
            <div className="table-card">
              <div className="table-head">
                <strong>Delivery coordination & live tracking</strong>
                <span>{deliveries.length} deliver{deliveries.length === 1 ? 'y' : 'ies'}</span>
              </div>
              {deliveries.length ? (
                deliveries.map(d => (
                  <div className="activity-row" key={d.id}>
                    <div className="activity-icon"><Truck /></div>
                    <div className="activity-main">
                      <strong>{d.foodName} · {d.mealCount} meals</strong>
                      <span>Pickup: {d.pickupAddress || 'Provided upon confirmation'} · Drop-off: {d.deliveryAddress}</span>
                      <span>
                        Driver: {d.driverName} ({d.driverPhone || 'No phone'}) · Recipient: {d.recipientName} ({d.recipientPhone || 'No phone'})
                      </span>
                      {d.deliveredAt && <small style={{ color: '#2e7d32' }}>Delivered at {fmt(d.deliveredAt)}</small>}
                    </div>

                    <span className={`badge-${d.status.toLowerCase()}`}>{d.status}</span>

                    <div className="card-actions">
                      {/* Driver Status Transition Controls */}
                      {user?.role === 'DRIVER' && d.status !== 'DELIVERED' && d.status !== 'CANCELLED' && (
                        <>
                          <button
                            className="btn btn-dark btn-sm"
                            disabled={busyId === d.id}
                            onClick={() => advanceDeliveryStatus(d)}
                          >
                            {d.status === 'ASSIGNED' ? 'Mark Picked Up' : d.status === 'PICKED_UP' ? 'Start Transit' : 'Mark Delivered'}
                          </button>
                          <button className="btn btn-outline btn-sm" onClick={() => shareLocation(d)} title="Broadcast current GPS to participants">
                            <Navigation size={13} /> Share GPS
                          </button>
                          <button
                            className="btn btn-outline btn-sm"
                            onClick={() => toggleTracking(d)}
                            title={d.trackingEnabled ? 'Disable location sharing' : 'Enable location sharing'}
                          >
                            {d.trackingEnabled ? <ToggleRight size={15} color="#2e7d32" /> : <ToggleLeft size={15} />}
                          </button>
                        </>
                      )}

                      {/* Proof Photo Upload & View */}
                      {['DRIVER', 'NGO', 'ADMIN'].includes(user?.role) && d.status !== 'CANCELLED' && (
                        <button className="btn btn-outline btn-sm" onClick={() => setProofTarget(d)}>
                          <Camera size={13} /> {d.proofImageUrl ? 'View Proof' : 'Upload Proof'}
                        </button>
                      )}

                      {/* Participant View Location */}
                      {d.status !== 'CANCELLED' && (
                        <button className="btn btn-outline btn-sm" onClick={() => viewTrackingModal(d)}>
                          <Eye size={13} /> Track
                        </button>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <Empty
                  title="No active deliveries"
                  text="Once an approved claim or matched request has a registered driver assigned, delivery tracking appears here."
                />
              )}
            </div>
          )}

          {/* FOOTER */}
          <footer>
            <div className="footer-brand"><Leaf size={17} /> annara<span>.</span></div>
            <span>Built around the belief that good food should be shared.</span>
            <span>Food safety comes first · <a href="#food-list">Explore food</a></span>
          </footer>
        </div>
      </main>

      {/* TOAST NOTIFICATION */}
      {notice && (
        <div className="toast" style={noticeType === 'error' ? { background: '#842029' } : {}}>
          {noticeType === 'error' ? <AlertCircle size={18} /> : <CircleCheck size={18} />}
          <span>{notice}</span>
        </div>
      )}

      {/* MODAL: AUTH */}
      {showAuth && (
        <Modal
          title={authMode === 'login' ? 'Welcome back' : 'Join the food rescue network'}
          subtitle={authMode === 'login' ? 'Sign in to manage donations, claims, and deliveries.' : 'Create an account for your organization, kitchen, or delivery role.'}
          onClose={() => setShowAuth(false)}
        >
          <form onSubmit={submitAuth} className="form-stack">
            {authMode === 'register' && (
              <>
                <Field label="Your full name">
                  <input required value={authForm.fullName} onChange={e => setAuthForm({ ...authForm, fullName: e.target.value })} placeholder="e.g. Aanya Sharma" />
                </Field>
                <Field label="Organization / Restaurant name (optional)">
                  <input value={authForm.organisationName} onChange={e => setAuthForm({ ...authForm, organisationName: e.target.value })} placeholder="Kitchen, Hotel, NGO, or Community Name" />
                </Field>
                <div className="form-two">
                  <Field label="Account type">
                    <select value={authForm.role} onChange={e => setAuthForm({ ...authForm, role: e.target.value })}>
                      <option value="NGO">NGO</option>
                      <option value="RESTAURANT">Restaurant / Hotel / Caterer</option>
                      <option value="RECIPIENT">Recipient (Community member)</option>
                      <option value="DRIVER">Delivery driver</option>
                    </select>
                  </Field>
                  <Field label="City">
                    <input required value={authForm.city} onChange={e => setAuthForm({ ...authForm, city: e.target.value })} placeholder="e.g. Bengaluru" />
                  </Field>
                </div>
                <Field label="Phone number">
                  <input value={authForm.phone} onChange={e => setAuthForm({ ...authForm, phone: e.target.value })} placeholder="+91 9876543210" />
                </Field>
              </>
            )}

            <Field label="Email address">
              <input type="email" required value={authForm.email} onChange={e => setAuthForm({ ...authForm, email: e.target.value })} placeholder="you@example.com" />
            </Field>
            <Field label="Password">
              <input type="password" minLength={8} required value={authForm.password} onChange={e => setAuthForm({ ...authForm, password: e.target.value })} placeholder="At least 8 characters" />
            </Field>

            <button className="btn btn-dark full" disabled={loading}>
              {loading ? 'Please wait...' : authMode === 'login' ? 'Sign in securely' : 'Create account'} <ArrowUpRight size={16} />
            </button>

            <p className="form-switch">
              {authMode === 'login' ? 'New to Annara?' : 'Already part of Annara?'}
              <button type="button" onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}>
                {authMode === 'login' ? 'Create an account' : 'Sign in'}
              </button>
            </p>
          </form>
        </Modal>
      )}

      {/* MODAL: POST DONATION */}
      {showDonation && (
        <Modal
          title="Share surplus food"
          subtitle="Accurate details help NGOs and recipients collect meals safely and on time."
          onClose={() => setShowDonation(false)}
        >
          <form onSubmit={createDonation} className="form-stack">
            <Field label="Food name">
              <input required value={donation.foodName} onChange={e => setDonation({ ...donation, foodName: e.target.value })} placeholder="e.g. Fresh lunch packs, Steamed rice & curry" />
            </Field>

            <div className="form-two">
              <Field label="Food type">
                <select value={donation.foodType} onChange={e => setDonation({ ...donation, foodType: e.target.value })}>
                  <option value="Vegetarian">Vegetarian</option>
                  <option value="Vegan">Vegan</option>
                  <option value="Bakery">Bakery</option>
                  <option value="Mixed">Mixed</option>
                  <option value="Other">Other</option>
                </select>
              </Field>
              <Field label="Meal portions">
                <input type="number" min="1" max="100000" required value={donation.totalMeals} onChange={e => setDonation({ ...donation, totalMeals: e.target.value })} />
              </Field>
            </div>

            <div className="form-two">
              <Field label="Donation source type">
                <select value={donation.sourceType} onChange={e => setDonation({ ...donation, sourceType: e.target.value })}>
                  <option value="RESTAURANT">Restaurant / Hotel</option>
                  <option value="CATERING">Catering service</option>
                  <option value="WEDDING">Wedding / Party</option>
                  <option value="COLLEGE_EVENT">College festival / event</option>
                  <option value="CORPORATE_EVENT">Corporate gathering</option>
                  <option value="COMMUNITY_EVENT">Community event</option>
                  <option value="OTHER">Other</option>
                </select>
              </Field>
              <Field label="Source name / Event name">
                <input value={donation.sourceName} onChange={e => setDonation({ ...donation, sourceName: e.target.value })} placeholder="e.g. Annual College Fest or Green Table" />
              </Field>
            </div>

            <Field label="Description, allergens & storage instructions">
              <textarea rows={3} value={donation.description} onChange={e => setDonation({ ...donation, description: e.target.value })} placeholder="Preparation time, packaging, storage condition, allergens (peanuts, dairy, wheat)..." />
            </Field>

            <Field label="Pickup address">
              <input required value={donation.pickupAddress} onChange={e => setDonation({ ...donation, pickupAddress: e.target.value })} placeholder="Street address, area, landmark" />
            </Field>

            <Field label="Collect before deadline">
              <input
                type="datetime-local"
                required
                min={new Date(Date.now() + 60000).toISOString().slice(0, 16)}
                value={donation.pickupBefore}
                onChange={e => setDonation({ ...donation, pickupBefore: e.target.value })}
              />
            </Field>

            <label className="upload-box">
              <input type="file" accept="image/*" onChange={e => setDonationFile(e.target.files?.[0] || null)} />
              {donationFile ? (
                <>
                  <img src={URL.createObjectURL(donationFile)} alt="Preview" />
                  <span>{donationFile.name}</span>
                </>
              ) : (
                <>
                  <span className="upload-icon"><Camera size={22} /></span>
                  <strong>Add food photo</strong>
                  <small>Take a photo or choose an image · Max 5 MB</small>
                </>
              )}
            </label>

            <p className="safety-note">
              <ShieldCheck size={16} /> Please ensure food is hygienic and list any known allergens. Food photos assist visual identification but do not replace food safety guidelines.
            </p>

            <button className="btn btn-dark full" disabled={loading}>
              {loading ? 'Publishing...' : 'Publish donation'} <ArrowUpRight size={16} />
            </button>
          </form>
        </Modal>
      )}

      {/* MODAL: EDIT DONATION */}
      {editDonationTarget && (
        <Modal
          title="Edit Donation"
          subtitle={`Update details for "${editDonationTarget.foodName}".`}
          onClose={() => setEditDonationTarget(null)}
        >
          <form onSubmit={updateDonation} className="form-stack">
            <Field label="Food name">
              <input required value={editDonationTarget.foodName} onChange={e => setEditDonationTarget({ ...editDonationTarget, foodName: e.target.value })} />
            </Field>

            <div className="form-two">
              <Field label="Food type">
                <select value={editDonationTarget.foodType} onChange={e => setEditDonationTarget({ ...editDonationTarget, foodType: e.target.value })}>
                  <option value="Vegetarian">Vegetarian</option>
                  <option value="Vegan">Vegan</option>
                  <option value="Bakery">Bakery</option>
                  <option value="Mixed">Mixed</option>
                  <option value="Other">Other</option>
                </select>
              </Field>
              <Field label="Total meal portions">
                <input type="number" min="1" max="100000" required value={editDonationTarget.totalMeals} onChange={e => setEditDonationTarget({ ...editDonationTarget, totalMeals: e.target.value })} />
              </Field>
            </div>

            <Field label="Description & allergens">
              <textarea rows={3} value={editDonationTarget.description || ''} onChange={e => setEditDonationTarget({ ...editDonationTarget, description: e.target.value })} />
            </Field>

            <Field label="Pickup address">
              <input required value={editDonationTarget.pickupAddress} onChange={e => setEditDonationTarget({ ...editDonationTarget, pickupAddress: e.target.value })} />
            </Field>

            <Field label="Pickup deadline">
              <input
                type="datetime-local"
                required
                value={editDonationTarget.pickupBefore ? new Date(editDonationTarget.pickupBefore).toISOString().slice(0, 16) : ''}
                onChange={e => setEditDonationTarget({ ...editDonationTarget, pickupBefore: e.target.value })}
              />
            </Field>

            <button className="btn btn-dark full" disabled={loading}>
              {loading ? 'Saving...' : 'Update donation'}
            </button>
          </form>
        </Modal>
      )}

      {/* MODAL: CLAIM MEALS (Replaces window.prompt) */}
      {claimTarget && (
        <Modal
          title="Claim Food Donation"
          subtitle={`Request portions of "${claimTarget.foodName}".`}
          onClose={() => setClaimTarget(null)}
        >
          <form onSubmit={submitClaim} className="form-stack">
            <div className="alert-banner info">
              <strong>Available: {claimTarget.remainingMeals} portions</strong>
              <div>Pickup location: {claimTarget.pickupAddress || claimTarget.city}</div>
              <div>Collect before: {fmt(claimTarget.pickupBefore)}</div>
            </div>

            <Field label="Number of meal portions to claim">
              <input
                type="number"
                min="1"
                max={claimTarget.remainingMeals}
                required
                value={claimMealsCount}
                onChange={e => setClaimMealsCount(Math.min(claimTarget.remainingMeals, Math.max(1, Number(e.target.value))))}
              />
            </Field>

            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setClaimTarget(null)}>Cancel</button>
              <button type="submit" className="btn btn-dark" disabled={loading}>
                {loading ? 'Submitting...' : `Confirm Claim (${claimMealsCount} meals)`}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL: ASSIGN DRIVER (Replaces window.prompt) */}
      {driverAssignTarget && (
        <Modal
          title="Assign Delivery Driver"
          subtitle="Select an eligible registered driver and confirm the delivery address."
          onClose={() => setDriverAssignTarget(null)}
        >
          <form onSubmit={submitDriverAssignment} className="form-stack">
            <Field label="Select Registered Driver">
              <select required value={selectedDriverId} onChange={e => setSelectedDriverId(e.target.value)}>
                {drivers.map(d => (
                  <option key={d.id} value={d.id}>
                    {d.fullName} {d.phone ? `(${d.phone})` : ''} — {d.city || 'No city'}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Drop-off Delivery Address">
              <input
                required
                value={deliveryDropoffAddress}
                onChange={e => setDeliveryDropoffAddress(e.target.value)}
                placeholder="Enter complete drop-off location"
              />
            </Field>

            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setDriverAssignTarget(null)}>Cancel</button>
              <button type="submit" className="btn btn-dark" disabled={loading}>
                {loading ? 'Assigning...' : 'Confirm Assignment'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL: MATCH FOOD REQUEST (Replaces window.prompt) */}
      {matchRequestTarget && (
        <Modal
          title="Offer Food for Request"
          subtitle={`Select one of your eligible donations to fulfill "${matchRequestTarget.foodName}".`}
          onClose={() => setMatchRequestTarget(null)}
        >
          <form onSubmit={submitMatchRequest} className="form-stack">
            <div className="alert-banner info">
              <strong>Requested: {matchRequestTarget.requestedMeals} meals</strong>
              <div>Delivery to: {matchRequestTarget.deliveryAddress}</div>
            </div>

            <Field label="Your Available Donation">
              <select required value={selectedDonationIdForMatch} onChange={e => setSelectedDonationIdForMatch(e.target.value)}>
                {myDonations
                  .filter(d => d.status !== 'CANCELLED' && Number(d.remainingMeals) >= Number(matchRequestTarget.requestedMeals))
                  .map(d => (
                    <option key={d.id} value={d.id}>
                      {d.foodName} ({d.remainingMeals} portions remaining)
                    </option>
                  ))}
              </select>
            </Field>

            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setMatchRequestTarget(null)}>Cancel</button>
              <button type="submit" className="btn btn-dark" disabled={loading}>
                {loading ? 'Matching...' : 'Offer This Donation'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL: POST FOOD REQUEST */}
      {showRequest && (
        <Modal
          title="Request food for your community"
          subtitle="Tell local restaurants, caterers, and food partners what is needed."
          onClose={() => setShowRequest(false)}
        >
          <form onSubmit={createRequest} className="form-stack">
            <Field label="Food needed">
              <input required value={request.foodName} onChange={e => setRequest({ ...request, foodName: e.target.value })} placeholder="e.g. Vegetarian dinner meals, Cooked rice, Bread packs" />
            </Field>

            <Field label="Portions needed">
              <input type="number" min="1" max="100000" required value={request.requestedMeals} onChange={e => setRequest({ ...request, requestedMeals: e.target.value })} />
            </Field>

            <div className="form-two">
              <Field label="Urgency level">
                <select value={request.urgency} onChange={e => setRequest({ ...request, urgency: e.target.value })}>
                  <option value="LOW">Low</option>
                  <option value="NORMAL">Normal</option>
                  <option value="HIGH">High</option>
                  <option value="URGENT">Urgent (Immediate need)</option>
                </select>
              </Field>
              <Field label="Needed before (optional)">
                <input
                  type="datetime-local"
                  min={new Date(Date.now() + 60000).toISOString().slice(0, 16)}
                  value={request.neededBefore}
                  onChange={e => setRequest({ ...request, neededBefore: e.target.value })}
                />
              </Field>
            </div>

            <Field label="Who needs it & dietary details">
              <textarea rows={3} value={request.description} onChange={e => setRequest({ ...request, description: e.target.value })} placeholder="Target beneficiaries (elderly home, night shelter, students), packaging preference..." />
            </Field>

            <Field label="Drop-off address">
              <input required value={request.deliveryAddress} onChange={e => setRequest({ ...request, deliveryAddress: e.target.value })} placeholder="Area, landmark, city" />
            </Field>

            <button className="btn btn-dark full" disabled={loading}>
              {loading ? 'Posting...' : 'Post food request'} <ArrowUpRight size={16} />
            </button>
          </form>
        </Modal>
      )}

      {/* MODAL: LIVE GPS TRACKING VIEWER */}
      {trackingTarget && (
        <Modal
          title="Live Delivery Tracking"
          subtitle={`Tracking delivery #${trackingTarget.id} for "${trackingTarget.foodName}".`}
          onClose={() => setTrackingTarget(null)}
        >
          <div className="tracking-box">
            <div>
              <strong>Status: <span className={`badge-${trackingTarget.status.toLowerCase()}`}>{trackingTarget.status}</span></strong>
              <div style={{ fontSize: 11, color: '#7a8677', marginTop: 4 }}>
                Driver: {trackingTarget.driverName} · Recipient: {trackingTarget.recipientName}
              </div>
            </div>

            {trackingData && !trackingData.empty ? (
              <>
                <div className="coord-grid">
                  <div className="coord-item">
                    <small>Latitude</small>
                    <strong>{Number(trackingData.latitude).toFixed(6)}</strong>
                  </div>
                  <div className="coord-item">
                    <small>Longitude</small>
                    <strong>{Number(trackingData.longitude).toFixed(6)}</strong>
                  </div>
                </div>

                <div style={{ fontSize: 11, color: '#687865', display: 'flex', justifyContent: 'space-between' }}>
                  <span>Speed: {trackingData.speed != null ? `${Number(trackingData.speed).toFixed(1)} km/h` : 'Stationary'}</span>
                  <span>Recorded: {fmt(trackingData.recordedAt)}</span>
                </div>

                <a
                  href={`https://www.google.com/maps?q=${trackingData.latitude},${trackingData.longitude}`}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-outline"
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}
                >
                  <ExternalLink size={15} /> Open coordinates in Google Maps
                </a>
              </>
            ) : (
              <div className="alert-banner warning">
                {trackingTarget.trackingEnabled
                  ? 'No GPS broadcast received yet from the assigned driver.'
                  : 'Location sharing is currently paused for this delivery.'}
              </div>
            )}

            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={async () => {
                  try {
                    const latest = await api(`/tracking/delivery/${trackingTarget.id}/latest`);
                    setTrackingData(latest);
                    flash('Location updated.');
                  } catch {
                    flash('No new location recorded.', 'error');
                  }
                }}
              >
                <RefreshCw size={13} /> Refresh Position
              </button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setTrackingTarget(null)}>Close</button>
            </div>
          </div>
        </Modal>
      )}

      {/* MODAL: PROOF OF DELIVERY */}
      {proofTarget && (
        <Modal
          title="Delivery Proof"
          subtitle={`Proof documentation for delivery #${proofTarget.id}.`}
          onClose={() => { setProofTarget(null); setProofFile(null); }}
        >
          <div className="form-stack">
            {proofTarget.proofImageUrl ? (
              <div>
                <img
                  src={proofTarget.proofImageUrl.startsWith('http') ? proofTarget.proofImageUrl : `${API.replace('/api', '')}${proofTarget.proofImageUrl}`}
                  alt="Delivery Proof"
                  style={{ width: '100%', borderRadius: 10, maxHeight: 260, objectFit: 'cover' }}
                />
                <p style={{ fontSize: 11, color: '#6f7f6d', textAlign: 'center' }}>Proof of collection / handover on file.</p>
              </div>
            ) : (
              <p style={{ fontSize: 11, color: '#7a8677' }}>No proof photo uploaded yet.</p>
            )}

            {user?.role === 'DRIVER' && (
              <form onSubmit={submitProof} className="form-stack">
                <label className="upload-box">
                  <input type="file" accept="image/*" onChange={e => setProofFile(e.target.files?.[0] || null)} />
                  {proofFile ? (
                    <>
                      <img src={URL.createObjectURL(proofFile)} alt="Preview" />
                      <span>{proofFile.name}</span>
                    </>
                  ) : (
                    <>
                      <span className="upload-icon"><Camera size={22} /></span>
                      <strong>Upload Handover Photo</strong>
                      <small>Capture handover photo at drop-off location</small>
                    </>
                  )}
                </label>

                {proofFile && (
                  <button className="btn btn-dark full" disabled={loading}>
                    {loading ? 'Uploading...' : 'Submit Proof Photo'}
                  </button>
                )}
              </form>
            )}
          </div>
        </Modal>
      )}

      {/* CONFIRMATION MODAL */}
      {confirmModal && (
        <Modal title={confirmModal.title} subtitle="" onClose={() => setConfirmModal(null)}>
          <div className="form-stack">
            <p style={{ fontSize: 12, lineHeight: 1.6, color: '#3f5342', margin: '0 0 16px' }}>{confirmModal.message}</p>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setConfirmModal(null)}>Cancel</button>
              <button
                className="btn btn-danger"
                onClick={async () => {
                  const fn = confirmModal.onConfirm;
                  setConfirmModal(null);
                  if (fn) await fn();
                }}
              >
                Confirm
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Stat({ icon: Icon, value, label, note, last }) {
  return (
    <div className={`stat-card ${last ? 'last' : ''}`}>
      <div className="stat-top">
        <span className="stat-icon"><Icon size={18} /></span>
        <span className="stat-note">{note}</span>
      </div>
      <strong className="stat-value">{value}</strong>
      <span className="stat-label">{label}</span>
    </div>
  );
}

function FoodCard({ item, onClaim, onEdit, onCancel, loading, user, own }) {
  const [broken, setBroken] = useState(false);
  const isAvailable = item.status === 'AVAILABLE' || item.status === 'PARTIALLY_CLAIMED';

  return (
    <article className="food-card">
      <div className="food-image">
        {item.imageUrl && !broken ? (
          <img
            src={item.imageUrl.startsWith('http') ? item.imageUrl : `${API.replace('/api', '')}${item.imageUrl}`}
            alt={item.foodName}
            onError={() => setBroken(true)}
          />
        ) : (
          <div className="food-placeholder">
            <Utensils size={35} />
            <span>Fresh food, shared with care</span>
          </div>
        )}
        <span className="food-tag">{item.foodType || 'Prepared food'}</span>
        <span className="meals-tag"><Users size={14} />{item.remainingMeals} portions</span>
      </div>

      <div className="food-body">
        <div className="donor-line">
          <span className="donor-avatar"><Utensils size={13} /></span>
          <span>{item.sourceName || item.donorName || 'Community donor'}</span>
          <ShieldCheck size={14} className="verified" />
        </div>

        <h3>{item.foodName}</h3>
        <p className="food-description">{item.description || 'Surplus food available for collection.'}</p>

        <div className="food-meta">
          <div><MapPin size={15} /><span>{item.pickupAddress || item.city || 'Pickup location provided'}</span></div>
          <div><Clock3 size={15} /><span>Collect before {fmt(item.pickupBefore)}</span></div>
        </div>

        <div className="food-footer">
          <span className="fresh-status">
            <span /> {item.status === 'PARTIALLY_CLAIMED' ? 'Partially claimed' : isAvailable ? 'Available for pickup' : item.status}
          </span>

          {own ? (
            <div className="card-actions">
              <span className={`badge-${item.status.toLowerCase()}`}>{item.status}</span>
              {isAvailable && (
                <>
                  <button className="icon-btn" onClick={onEdit} title="Edit donation"><Edit3 size={15} /></button>
                  <button className="icon-btn" onClick={onCancel} title="Cancel donation"><Trash2 size={15} color="#c62828" /></button>
                </>
              )}
            </div>
          ) : (
            <button className="claim-btn" onClick={onClaim} disabled={loading || !isAvailable}>
              {loading ? 'Processing...' : isAvailable ? 'Claim meals' : 'Unavailable'} <ArrowUpRight size={15} />
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

function Empty({ title, text, action, onAction }) {
  return (
    <div className="empty-state">
      <span><HandHeart size={26} /></span>
      <h3>{title}</h3>
      <p>{text}</p>
      {action && (
        <button className="btn btn-dark" onClick={onAction}>
          {action} <ArrowUpRight size={15} />
        </button>
      )}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

function Modal({ title, subtitle, onClose, children }) {
  return (
    <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-head">
          <div>
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button className="icon-btn" onClick={onClose}><X size={20} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
