import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { Navigation, RefreshCw, X, Clock, Compass, AlertCircle, Play, Square, ExternalLink, ShieldCheck } from 'lucide-react';

const driverIcon = L.divIcon({
  html: '<div style="background:#283593;color:white;width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(40,53,147,0.4);border:2px solid white;font-size:16px;">🚚</div>',
  className: 'driver-leaflet-pin',
  iconSize: [34, 34],
  iconAnchor: [17, 17]
});

const destIcon = L.divIcon({
  html: '<div style="background:#2e7d32;color:white;width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 3px 8px rgba(46,125,50,0.35);border:2px solid white;font-size:14px;">📍</div>',
  className: 'dest-leaflet-pin',
  iconSize: [30, 30],
  iconAnchor: [15, 15]
});

export default function DeliveryTracking({ delivery, onClose, api, flash, user }) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);
  const pathPolylineRef = useRef(null);
  const watchIdRef = useRef(null);

  const [points, setPoints] = useState([]);
  const [latestPoint, setLatestPoint] = useState(null);
  const [loading, setLoading] = useState(true);
  const [broadcasting, setBroadcasting] = useState(false);
  const [gpsError, setGpsError] = useState(null);
  const [etaMinutes, setEtaMinutes] = useState(null);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    const defaultLat = delivery.deliveryLatitude || 12.9716;
    const defaultLng = delivery.deliveryLongitude || 77.5946;

    const map = L.map(mapContainerRef.current, {
      center: [defaultLat, defaultLng],
      zoom: 14,
      zoomControl: true
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19
    }).addTo(map);

    mapInstanceRef.current = map;

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      map.remove();
    };
  }, []);

  // Fetch tracking points
  const loadTracking = async () => {
    try {
      const history = await api(`/deliveries/${delivery.id}/tracking`);
      setPoints(history || []);
      if (history && history.length > 0) {
        const latest = history[history.length - 1];
        setLatestPoint(latest);
        updateMapWithPoints(history, latest);
      } else {
        // Try fallback latest
        try {
          const lat = await api(`/deliveries/${delivery.id}/tracking/latest`);
          setLatestPoint(lat);
          updateMapWithPoints([lat], lat);
        } catch {
          // No points yet
        }
      }
    } catch (err) {
      console.warn('Failed to load tracking data:', err);
    } finally {
      setLoading(false);
    }
  };

  const updateMapWithPoints = (pts, latest) => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const latLngs = pts.map(p => [p.latitude, p.longitude]);

    // Update Polyline
    if (pathPolylineRef.current) {
      pathPolylineRef.current.setLatLngs(latLngs);
    } else if (latLngs.length > 1) {
      pathPolylineRef.current = L.polyline(latLngs, {
        color: '#283593',
        weight: 4,
        opacity: 0.8,
        dashArray: '6, 8'
      }).addTo(map);
    }

    // Update Driver Marker
    if (latest && latest.latitude && latest.longitude) {
      const pos = [latest.latitude, latest.longitude];
      if (markerRef.current) {
        markerRef.current.setLatLng(pos);
      } else {
        markerRef.current = L.marker(pos, { icon: driverIcon }).addTo(map);
        markerRef.current.bindPopup(`<strong>${delivery.driverName || 'Driver'}</strong><br/>Live Location`).openPopup();
      }
      map.panTo(pos);

      // Estimate arrival if speed is recorded
      if (latest.speed && latest.speed > 5) {
        // Simple rough estimate: 15-20 min in transit or distance / speed
        setEtaMinutes(Math.max(5, Math.round(15 / (latest.speed / 20))));
      } else {
        setEtaMinutes(delivery.status === 'IN_TRANSIT' ? 12 : 20);
      }
    }
  };

  useEffect(() => {
    loadTracking();
    const timer = setInterval(loadTracking, 4000);
    return () => clearInterval(timer);
  }, [delivery.id]);

  // Driver Live GPS Broadcast
  const startGpsBroadcast = () => {
    if (!('geolocation' in navigator)) {
      setGpsError('Geolocation is not supported by your browser.');
      return;
    }

    setGpsError(null);
    setBroadcasting(true);

    const sendPosition = async pos => {
      const { latitude, longitude, speed } = pos.coords;
      try {
        await api(`/deliveries/${delivery.id}/tracking`, {
          method: 'POST',
          body: JSON.stringify({
            latitude,
            longitude,
            speed: speed != null ? speed * 3.6 : 0 // convert m/s to km/h
          })
        });
        loadTracking();
      } catch (e) {
        console.error('Failed to send GPS update', e);
      }
    };

    const handleError = err => {
      let msg = 'Failed to retrieve location.';
      if (err.code === 1) msg = 'Location access denied. Please enable GPS in your browser.';
      else if (err.code === 2) msg = 'Location unavailable. Ensure GPS is turned on.';
      else if (err.code === 3) msg = 'GPS lookup timed out.';
      setGpsError(msg);
      setBroadcasting(false);
      flash(msg, 'error');
    };

    watchIdRef.current = navigator.geolocation.watchPosition(sendPosition, handleError, {
      enableHighAccuracy: true,
      maximumAge: 3000,
      timeout: 10000
    });

    flash('Live GPS broadcasting started.');
  };

  const stopGpsBroadcast = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setBroadcasting(false);
    flash('GPS broadcast stopped.');
  };

  const isDriver = user?.role === 'DRIVER' && delivery.driverId === user.id;

  return (
    <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ width: 'min(100%, 680px)' }}>
        <div className="modal-head">
          <div>
            <h2>Live Delivery Tracking</h2>
            <p>Delivery #{delivery.id} · {delivery.foodName} ({delivery.mealCount} portions)</p>
          </div>
          <button className="icon-btn" onClick={onClose}><X size={20} /></button>
        </div>

        <div className="form-stack">
          {/* Status Banner */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#f5f7ef', borderRadius: 10, border: '1px solid #e2ebd8' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Navigation size={18} color="#283593" />
              <div>
                <strong style={{ fontSize: 13 }}>Status: <span className={`badge-${delivery.status?.toLowerCase()}`}>{delivery.status}</span></strong>
                <div style={{ fontSize: 11, color: '#687865', marginTop: 2 }}>
                  Driver: {delivery.driverName} ({delivery.driverPhone || 'No phone'})
                </div>
              </div>
            </div>
            {etaMinutes !== null && (delivery.status === 'IN_TRANSIT' || delivery.status === 'PICKED_UP') && (
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: 10, color: '#7a8677', display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
                  <Clock size={12} /> Estimated Arrival
                </span>
                <strong style={{ fontSize: 14, color: '#2e7d32' }}>~{etaMinutes} mins</strong>
              </div>
            )}
          </div>

          {/* Leaflet OpenStreetMap Container */}
          <div
            id="leaflet-map"
            ref={mapContainerRef}
            style={{
              height: 320,
              width: '100%',
              borderRadius: 12,
              border: '1px solid #d4ded0',
              overflow: 'hidden'
            }}
          />

          {/* Route info */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 11, background: '#fff', padding: 12, borderRadius: 10, border: '1px solid #e5e9e0' }}>
            <div>
              <span style={{ color: '#879283', display: 'block', fontSize: 10, fontWeight: 700 }}>PICKUP LOCATION</span>
              <strong style={{ color: '#2e4531' }}>{delivery.pickupAddress || 'Location on file'}</strong>
            </div>
            <div>
              <span style={{ color: '#879283', display: 'block', fontSize: 10, fontWeight: 700 }}>DROP-OFF DESTINATION</span>
              <strong style={{ color: '#2e4531' }}>{delivery.deliveryAddress || 'Recipient address'}</strong>
            </div>
          </div>

          {/* Live Telemetry Card */}
          {latestPoint ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              <div style={{ background: '#f8faf5', padding: '10px 12px', borderRadius: 8, border: '1px solid #e5ebdf', textAlign: 'center' }}>
                <small style={{ color: '#7d887d', fontSize: 10, display: 'block' }}>Latitude</small>
                <strong style={{ fontSize: 13, color: '#283593' }}>{Number(latestPoint.latitude).toFixed(6)}</strong>
              </div>
              <div style={{ background: '#f8faf5', padding: '10px 12px', borderRadius: 8, border: '1px solid #e5ebdf', textAlign: 'center' }}>
                <small style={{ color: '#7d887d', fontSize: 10, display: 'block' }}>Longitude</small>
                <strong style={{ fontSize: 13, color: '#283593' }}>{Number(latestPoint.longitude).toFixed(6)}</strong>
              </div>
              <div style={{ background: '#f8faf5', padding: '10px 12px', borderRadius: 8, border: '1px solid #e5ebdf', textAlign: 'center' }}>
                <small style={{ color: '#7d887d', fontSize: 10, display: 'block' }}>Speed</small>
                <strong style={{ fontSize: 13, color: '#2e7d32' }}>
                  {latestPoint.speed != null ? `${Number(latestPoint.speed).toFixed(1)} km/h` : 'Stationary'}
                </strong>
              </div>
            </div>
          ) : (
            <div className="alert-banner warning" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertCircle size={16} />
              <span>Waiting for initial GPS coordinates from driver...</span>
            </div>
          )}

          {/* GPS Error */}
          {gpsError && (
            <div className="alert-banner danger" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertCircle size={16} />
              <span>{gpsError}</span>
            </div>
          )}

          {/* Driver Controls */}
          {isDriver && (delivery.status === 'ACCEPTED' || delivery.status === 'PICKED_UP' || delivery.status === 'IN_TRANSIT') && (
            <div style={{ padding: 12, background: '#f0f4ea', borderRadius: 10, border: '1px solid #dbe5d2', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <strong style={{ fontSize: 12, color: '#29432d' }}>Live GPS Broadcast</strong>
                <p style={{ margin: 0, fontSize: 10, color: '#687865' }}>Broadcast periodic device coordinates to recipient and donors.</p>
              </div>
              {broadcasting ? (
                <button type="button" className="btn btn-danger btn-sm" onClick={stopGpsBroadcast} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Square size={13} /> Stop Sharing
                </button>
              ) : (
                <button type="button" className="btn btn-dark btn-sm" onClick={startGpsBroadcast} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Play size={13} /> Start Live GPS
                </button>
              )}
            </div>
          )}

          {/* External Map & Refresh Controls */}
          <div className="modal-actions" style={{ marginTop: 8 }}>
            {latestPoint && (
              <a
                href={`https://www.google.com/maps?q=${latestPoint.latitude},${latestPoint.longitude}`}
                target="_blank"
                rel="noreferrer"
                className="btn btn-outline btn-sm"
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <ExternalLink size={13} /> Open in Google Maps
              </a>
            )}
            <button type="button" className="btn btn-outline btn-sm" onClick={loadTracking} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <RefreshCw size={13} /> Refresh
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>Close</button>
          </div>
        </div>
      </div>
    </div>
  );
}
