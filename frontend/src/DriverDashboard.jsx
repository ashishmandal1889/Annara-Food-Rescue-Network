import React, { useState } from 'react';
import { Truck, Check, X, Navigation, Camera, Eye, MapPin, Clock, ArrowRight, ShieldCheck, AlertCircle, RefreshCw, FileText } from 'lucide-react';

export default function DriverDashboard({ deliveries, onRefresh, onAccept, onReject, onAdvance, onTrack, onProof, onDetails, busyId, fmt }) {
  const [activeTab, setActiveTab] = useState('active'); // 'assigned', 'active', 'completed', 'history'

  const assignedDeliveries = deliveries.filter(d => d.status === 'ASSIGNED');
  const activeDeliveries = deliveries.filter(d => d.status === 'ACCEPTED' || d.status === 'PICKED_UP' || d.status === 'IN_TRANSIT');
  const completedDeliveries = deliveries.filter(d => d.status === 'DELIVERED' || d.status === 'CONFIRMED');
  const historyDeliveries = deliveries.filter(d => d.status === 'CONFIRMED' || d.status === 'CANCELLED' || d.status === 'FAILED');

  const getNextAction = (delivery) => {
    switch (delivery.status) {
      case 'ACCEPTED':
        return { label: 'Mark Picked Up', nextStatus: 'PICKED_UP' };
      case 'PICKED_UP':
        return { label: 'Start Transit (Live GPS)', nextStatus: 'IN_TRANSIT' };
      case 'IN_TRANSIT':
        return { label: 'Complete Delivery (Upload Proof)', isProof: true };
      default:
        return null;
    }
  };

  return (
    <div className="table-card">
      <div className="table-head" style={{ flexWrap: 'wrap', gap: 12 }}>
        <div>
          <strong>Driver Operations Hub</strong>
          <span style={{ display: 'block', fontSize: 11, color: '#7a8677', fontWeight: 400 }}>
            Manage assignments, coordinate pickups, broadcast live GPS, and document drop-off proofs.
          </span>
        </div>

        {/* Tab Filters */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button
            className={`btn btn-sm ${activeTab === 'assigned' ? 'btn-dark' : 'btn-outline'}`}
            onClick={() => setActiveTab('assigned')}
          >
            Pending Acceptance ({assignedDeliveries.length})
          </button>
          <button
            className={`btn btn-sm ${activeTab === 'active' ? 'btn-dark' : 'btn-outline'}`}
            onClick={() => setActiveTab('active')}
          >
            In-Transit / Active ({activeDeliveries.length})
          </button>
          <button
            className={`btn btn-sm ${activeTab === 'completed' ? 'btn-dark' : 'btn-outline'}`}
            onClick={() => setActiveTab('completed')}
          >
            Completed ({completedDeliveries.length})
          </button>
          <button
            className={`btn btn-sm ${activeTab === 'history' ? 'btn-dark' : 'btn-outline'}`}
            onClick={() => setActiveTab('history')}
          >
            All History ({deliveries.length})
          </button>
        </div>
      </div>

      {/* SECTION: ASSIGNED AWAITING ACCEPTANCE */}
      {activeTab === 'assigned' && (
        <div>
          {assignedDeliveries.length > 0 ? (
            assignedDeliveries.map(d => (
              <div className="activity-row" key={d.id} style={{ background: '#fff9ef' }}>
                <div className="activity-icon" style={{ background: '#ffe0b2', color: '#e65100' }}>
                  <Truck size={18} />
                </div>
                <div className="activity-main">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <strong>{d.foodName} · {d.mealCount} meals</strong>
                    <span className="badge-assigned">ASSIGNMENT PENDING</span>
                  </div>
                  <span>Pickup: {d.pickupAddress || 'Donation pickup address'}</span>
                  <span>Drop-off: {d.deliveryAddress}</span>
                  <small style={{ color: '#8d7045' }}>Assigned for: {d.recipientName} ({d.recipientPhone || 'No phone'})</small>
                </div>

                <div className="card-actions">
                  <button
                    className="btn btn-dark btn-sm"
                    disabled={busyId === d.id}
                    onClick={() => onAccept(d)}
                    style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#2e7d32' }}
                  >
                    <Check size={14} /> Accept Assignment
                  </button>
                  <button
                    className="btn btn-outline btn-sm"
                    disabled={busyId === d.id}
                    onClick={() => onReject(d)}
                    style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#c62828' }}
                  >
                    <X size={14} /> Decline
                  </button>
                  <button className="btn btn-outline btn-sm" onClick={() => onDetails(d)}>
                    <FileText size={13} /> Details
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div style={{ padding: '36px 20px', textAlign: 'center', color: '#7a8677', fontSize: 12 }}>
              No pending driver assignments right now. New requests will appear here.
            </div>
          )}
        </div>
      )}

      {/* SECTION: ACTIVE / IN TRANSIT */}
      {activeTab === 'active' && (
        <div>
          {activeDeliveries.length > 0 ? (
            activeDeliveries.map(d => {
              const action = getNextAction(d);
              return (
                <div className="activity-row" key={d.id}>
                  <div className="activity-icon" style={{ background: '#e3edcf', color: '#283593' }}>
                    <Truck size={18} />
                  </div>
                  <div className="activity-main">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <strong>{d.foodName} · {d.mealCount} meals</strong>
                      <span className={`badge-${d.status?.toLowerCase()}`}>{d.status}</span>
                    </div>
                    <span>Pickup: <strong>{d.pickupAddress || 'Address on file'}</strong></span>
                    <span>Drop-off: <strong>{d.deliveryAddress}</strong></span>
                    <span>Recipient: {d.recipientName} ({d.recipientPhone || 'No phone'}) · Donor: {d.donorName}</span>
                    {d.pickedUpAt && <small style={{ color: '#00838f' }}>Picked up at {fmt(d.pickedUpAt)}</small>}
                  </div>

                  <div className="card-actions">
                    {action && (
                      <button
                        className="btn btn-dark btn-sm"
                        disabled={busyId === d.id}
                        onClick={() => action.isProof ? onProof(d) : onAdvance(d, action.nextStatus)}
                      >
                        {action.label}
                      </button>
                    )}

                    <button
                      className="btn btn-outline btn-sm"
                      onClick={() => onTrack(d)}
                      title="Open live interactive map and GPS controls"
                      style={{ display: 'flex', alignItems: 'center', gap: 5 }}
                    >
                      <Navigation size={13} /> Live GPS Map
                    </button>

                    <button
                      className="btn btn-outline btn-sm"
                      onClick={() => onProof(d)}
                      title="Upload or review handover photo proof"
                      style={{ display: 'flex', alignItems: 'center', gap: 5 }}
                    >
                      <Camera size={13} /> {d.proofImageUrl ? 'View Proof' : 'Upload Proof'}
                    </button>

                    <button className="btn btn-outline btn-sm" onClick={() => onDetails(d)}>
                      <FileText size={13} /> Details
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            <div style={{ padding: '36px 20px', textAlign: 'center', color: '#7a8677', fontSize: 12 }}>
              No deliveries currently in transit. Accept an assigned order above to start delivery.
            </div>
          )}
        </div>
      )}

      {/* SECTION: COMPLETED */}
      {activeTab === 'completed' && (
        <div>
          {completedDeliveries.length > 0 ? (
            completedDeliveries.map(d => (
              <div className="activity-row" key={d.id}>
                <div className="activity-icon" style={{ background: '#e8f5e9', color: '#2e7d32' }}>
                  <ShieldCheck size={18} />
                </div>
                <div className="activity-main">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <strong>{d.foodName} · {d.mealCount} meals</strong>
                    <span className={`badge-${d.status?.toLowerCase()}`}>{d.status}</span>
                  </div>
                  <span>Delivered to: {d.deliveryAddress}</span>
                  <small style={{ color: '#2e7d32' }}>
                    {d.confirmedAt ? `Confirmed by recipient at ${fmt(d.confirmedAt)}` : `Delivered at ${fmt(d.deliveredAt)}`}
                  </small>
                </div>

                <div className="card-actions">
                  {d.proofImageUrl && (
                    <button className="btn btn-outline btn-sm" onClick={() => onProof(d)}>
                      <Camera size={13} /> View Proof
                    </button>
                  )}
                  <button className="btn btn-outline btn-sm" onClick={() => onDetails(d)}>
                    <FileText size={13} /> Details
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div style={{ padding: '36px 20px', textAlign: 'center', color: '#7a8677', fontSize: 12 }}>
              No completed deliveries yet.
            </div>
          )}
        </div>
      )}

      {/* SECTION: ALL HISTORY */}
      {activeTab === 'history' && (
        <div>
          {deliveries.length > 0 ? (
            deliveries.map(d => (
              <div className="activity-row" key={d.id}>
                <div className="activity-icon"><Truck size={17} /></div>
                <div className="activity-main">
                  <strong>{d.foodName} · {d.mealCount} meals</strong>
                  <span>Drop-off: {d.deliveryAddress}</span>
                  <small style={{ color: '#7a8677' }}>Date: {fmt(d.createdAt)}</small>
                </div>
                <span className={`badge-${d.status?.toLowerCase()}`}>{d.status}</span>
                <div className="card-actions">
                  <button className="btn btn-outline btn-sm" onClick={() => onDetails(d)}>
                    <FileText size={13} /> Details
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div style={{ padding: '36px 20px', textAlign: 'center', color: '#7a8677', fontSize: 12 }}>
              No delivery records found.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
