import React, { useState, useEffect } from 'react';
import { Truck, Navigation, Camera, CheckCircle2, AlertTriangle, UserCheck, Search, Filter, RefreshCw, FileText, ChevronRight, Users, Clock } from 'lucide-react';

export default function DeliveryDashboard({
  deliveries,
  user,
  onAssignDriver,
  onConfirmReceipt,
  onReportIssue,
  onTrack,
  onProof,
  onDetails,
  api,
  busyId,
  fmt
}) {
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [adminSummary, setAdminSummary] = useState(null);

  const isAdmin = user?.role === 'ADMIN';

  useEffect(() => {
    if (isAdmin) {
      api('/deliveries/summary')
        .then(data => setAdminSummary(data))
        .catch(err => console.warn('Could not load summary metrics:', err));
    }
  }, [isAdmin, deliveries.length]);

  const filteredDeliveries = deliveries.filter(d => {
    const matchStatus = statusFilter === 'ALL' || d.status === statusFilter;
    const q = searchQuery.toLowerCase().trim();
    const matchQuery = !q ||
      d.foodName?.toLowerCase().includes(q) ||
      d.donorName?.toLowerCase().includes(q) ||
      d.recipientName?.toLowerCase().includes(q) ||
      d.driverName?.toLowerCase().includes(q) ||
      d.deliveryAddress?.toLowerCase().includes(q);
    return matchStatus && matchQuery;
  });

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      {/* ADMIN METRICS CARDS */}
      {isAdmin && adminSummary && (
        <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))' }}>
          <div className="stat-card">
            <span className="stat-note">ALL TIME</span>
            <strong className="stat-value">{adminSummary.totalDeliveries || 0}</strong>
            <span className="stat-label">Total Deliveries</span>
          </div>
          <div className="stat-card">
            <span className="stat-note" style={{ color: '#e65100' }}>PENDING</span>
            <strong className="stat-value" style={{ color: '#e65100' }}>{adminSummary.pendingDeliveries || 0}</strong>
            <span className="stat-label">Need Driver</span>
          </div>
          <div className="stat-card">
            <span className="stat-note" style={{ color: '#283593' }}>IN TRANSIT</span>
            <strong className="stat-value" style={{ color: '#283593' }}>{adminSummary.inTransitDeliveries || 0}</strong>
            <span className="stat-label">On The Move</span>
          </div>
          <div className="stat-card">
            <span className="stat-note" style={{ color: '#2e7d32' }}>CONFIRMED</span>
            <strong className="stat-value" style={{ color: '#2e7d32' }}>{adminSummary.confirmedDeliveries || 0}</strong>
            <span className="stat-label">Handover Complete</span>
          </div>
          <div className="stat-card">
            <span className="stat-note" style={{ color: '#c62828' }}>FAILED</span>
            <strong className="stat-value" style={{ color: '#c62828' }}>{adminSummary.failedDeliveries || 0}</strong>
            <span className="stat-label">Issues Reported</span>
          </div>
          <div className="stat-card">
            <span className="stat-note">DRIVERS</span>
            <strong className="stat-value" style={{ color: '#1565c0' }}>{adminSummary.availableDrivers || 0} / {adminSummary.totalDrivers || 0}</strong>
            <span className="stat-label">Drivers Available</span>
          </div>
        </div>
      )}

      {/* FILTER & SEARCH BAR */}
      <div className="filter-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 260 }}>
          <div className="searchbox" style={{ width: '100%', maxWidth: 380, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Search size={15} color="#7a8677" />
            <input
              type="text"
              placeholder="Search by food, address, driver, recipient..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ border: 'none', background: 'transparent', outline: 'none', width: '100%', fontSize: 12 }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Filter size={14} color="#7a8677" />
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #d4ded0', fontSize: 11, background: '#fff' }}
          >
            <option value="ALL">All Statuses ({deliveries.length})</option>
            <option value="PENDING">Pending Assignment</option>
            <option value="ASSIGNED">Assigned</option>
            <option value="ACCEPTED">Accepted</option>
            <option value="PICKED_UP">Picked Up</option>
            <option value="IN_TRANSIT">In Transit</option>
            <option value="DELIVERED">Delivered</option>
            <option value="CONFIRMED">Confirmed</option>
            <option value="FAILED">Failed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>
      </div>

      {/* DELIVERIES LIST */}
      <div className="table-card">
        <div className="table-head">
          <strong>Delivery Coordination & Handover Queue</strong>
          <span>{filteredDeliveries.length} deliver{filteredDeliveries.length === 1 ? 'y' : 'ies'}</span>
        </div>

        {filteredDeliveries.length > 0 ? (
          filteredDeliveries.map(d => {
            const isRecipient = (d.recipientId && user?.id === d.recipientId) || user?.role === 'NGO' || user?.role === 'RECIPIENT';
            return (
              <div className="activity-row" key={d.id}>
                <div className="activity-icon" style={{ background: d.status === 'CONFIRMED' ? '#e8f5e9' : d.status === 'FAILED' ? '#ffebee' : '#e3edcf' }}>
                  <Truck size={17} color={d.status === 'CONFIRMED' ? '#2e7d32' : d.status === 'FAILED' ? '#c62828' : '#283593'} />
                </div>

                <div className="activity-main">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <strong>{d.foodName} · {d.mealCount} meals</strong>
                    <span className={`badge-${d.status?.toLowerCase()}`}>{d.status}</span>
                  </div>
                  <span>Pickup: {d.pickupAddress || 'Donation pickup point'}</span>
                  <span>Destination: {d.deliveryAddress}</span>
                  <div style={{ fontSize: 11, color: '#687865', marginTop: 3 }}>
                    Driver: <strong>{d.driverName}</strong> ({d.driverPhone || 'No phone'}) · Recipient: <strong>{d.recipientName}</strong> · Donor: {d.donorName}
                  </div>
                  {d.deliveredAt && (
                    <small style={{ color: '#2e7d32', display: 'block', marginTop: 2 }}>
                      {d.confirmedAt ? `Confirmed: ${fmt(d.confirmedAt)}` : `Delivered: ${fmt(d.deliveredAt)}`}
                    </small>
                  )}
                  {d.failureReason && (
                    <small style={{ color: '#c62828', display: 'block', marginTop: 2 }}>
                      Reason: {d.failureReason}
                    </small>
                  )}
                </div>

                <div className="card-actions" style={{ flexWrap: 'wrap' }}>
                  {/* PENDING: Assign Driver */}
                  {d.status === 'PENDING' && (user?.role === 'ADMIN' || user?.role === 'NGO' || user?.role === 'RECIPIENT' || user?.role === 'RESTAURANT') && (
                    <button
                      className="btn btn-dark btn-sm"
                      onClick={() => onAssignDriver(d)}
                      style={{ display: 'flex', alignItems: 'center', gap: 5 }}
                    >
                      <UserCheck size={13} /> Assign Driver
                    </button>
                  )}

                  {/* DELIVERED: Confirm Receipt (Recipient / Admin) */}
                  {d.status === 'DELIVERED' && (isRecipient || isAdmin) && (
                    <button
                      className="btn btn-dark btn-sm"
                      onClick={() => onConfirmReceipt(d)}
                      style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#2e7d32' }}
                    >
                      <CheckCircle2 size={13} /> Confirm Receipt
                    </button>
                  )}

                  {/* Report Issue */}
                  {['DELIVERED', 'IN_TRANSIT', 'PICKED_UP'].includes(d.status) && (isRecipient || isAdmin) && (
                    <button
                      className="btn btn-outline btn-sm"
                      onClick={() => onReportIssue(d)}
                      style={{ color: '#c62828' }}
                    >
                      Report Issue
                    </button>
                  )}

                  {/* Live Tracking */}
                  {d.status !== 'CANCELLED' && d.status !== 'PENDING' && (
                    <button
                      className="btn btn-outline btn-sm"
                      onClick={() => onTrack(d)}
                      style={{ display: 'flex', alignItems: 'center', gap: 5 }}
                    >
                      <Navigation size={13} /> Track Live
                    </button>
                  )}

                  {/* View Proof */}
                  {d.proofImageUrl && (
                    <button
                      className="btn btn-outline btn-sm"
                      onClick={() => onProof(d)}
                      style={{ display: 'flex', alignItems: 'center', gap: 5 }}
                    >
                      <Camera size={13} /> Proof
                    </button>
                  )}

                  {/* Full Details */}
                  <button
                    className="btn btn-outline btn-sm"
                    onClick={() => onDetails(d)}
                    style={{ display: 'flex', alignItems: 'center', gap: 5 }}
                  >
                    <FileText size={13} /> Details
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: '#7a8677', fontSize: 12 }}>
            No deliveries match the selected filter.
          </div>
        )}
      </div>
    </div>
  );
}
