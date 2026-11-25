import React, { useState } from 'react';
import { Clock, ShieldCheck, Truck, FileText, Search, CheckCircle2, AlertTriangle, Camera } from 'lucide-react';

export default function DeliveryHistory({ deliveries, onDetails, onProof, fmt }) {
  const [searchTerm, setSearchTerm] = useState('');

  const historyList = deliveries.filter(d => {
    const isClosed = ['DELIVERED', 'CONFIRMED', 'CANCELLED', 'FAILED'].includes(d.status);
    const q = searchTerm.toLowerCase().trim();
    const match = !q ||
      d.foodName?.toLowerCase().includes(q) ||
      d.donorName?.toLowerCase().includes(q) ||
      d.recipientName?.toLowerCase().includes(q) ||
      d.deliveryAddress?.toLowerCase().includes(q);
    return isClosed && match;
  });

  return (
    <div className="table-card">
      <div className="table-head" style={{ flexWrap: 'wrap', gap: 10 }}>
        <div>
          <strong>Delivery Audit & Handover History</strong>
          <span style={{ display: 'block', fontSize: 11, color: '#7a8677', fontWeight: 400 }}>
            Completed, confirmed, and finalized food rescue runs.
          </span>
        </div>

        <div className="searchbox" style={{ maxWidth: 280, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Search size={14} color="#7a8677" />
          <input
            type="text"
            placeholder="Search history..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: 11, width: '100%' }}
          />
        </div>
      </div>

      {historyList.length > 0 ? (
        historyList.map(d => (
          <div className="activity-row" key={d.id}>
            <div className="activity-icon" style={{ background: d.status === 'CONFIRMED' ? '#e8f5e9' : d.status === 'FAILED' ? '#ffebee' : '#f5f7ef' }}>
              {d.status === 'CONFIRMED' ? <CheckCircle2 size={16} color="#2e7d32" /> : d.status === 'FAILED' ? <AlertTriangle size={16} color="#c62828" /> : <Truck size={16} color="#455a64" />}
            </div>

            <div className="activity-main">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <strong>{d.foodName} · {d.mealCount} meals</strong>
                <span className={`badge-${d.status?.toLowerCase()}`}>{d.status}</span>
              </div>
              <span>From: {d.donorName} ({d.pickupAddress || 'Pickup Point'})</span>
              <span>To: {d.recipientName} ({d.deliveryAddress})</span>
              <small style={{ color: '#687865' }}>
                Driver: {d.driverName} · Finalized: {d.confirmedAt ? fmt(d.confirmedAt) : d.deliveredAt ? fmt(d.deliveredAt) : fmt(d.createdAt)}
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
          No delivery history records found.
        </div>
      )}
    </div>
  );
}
