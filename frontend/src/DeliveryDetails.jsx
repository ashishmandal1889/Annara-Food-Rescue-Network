import React, { useState } from 'react';
import { X, Truck, MapPin, Clock, CheckCircle2, AlertTriangle, ShieldCheck, Camera, Navigation, User, Phone } from 'lucide-react';

export default function DeliveryDetails({ delivery, onClose, onTrack, onProof, onConfirm, onFail, user, fmt }) {
  const [reportReason, setReportReason] = useState('');
  const [showReportForm, setShowReportForm] = useState(false);
  const [confirmNotes, setConfirmNotes] = useState('');
  const [showConfirmForm, setShowConfirmForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const isRecipient = (delivery.recipientId && user?.id === delivery.recipientId) || user?.role === 'NGO' || user?.role === 'RECIPIENT';
  const isAdmin = user?.role === 'ADMIN';

  const handleConfirm = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onConfirm(delivery, confirmNotes);
      setShowConfirmForm(false);
    } finally {
      setSubmitting(false);
    }
  };

  const handleFail = async (e) => {
    e.preventDefault();
    if (!reportReason.trim()) return;
    setSubmitting(true);
    try {
      await onFail(delivery, reportReason);
      setShowReportForm(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ width: 'min(100%, 620px)' }}>
        <div className="modal-head">
          <div>
            <h2>Delivery Details #{delivery.id}</h2>
            <p>{delivery.foodName} · {delivery.mealCount} meals</p>
          </div>
          <button className="icon-btn" onClick={onClose}><X size={20} /></button>
        </div>

        <div className="form-stack">
          {/* Status Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: '#f5f8f3', borderRadius: 12, border: '1px solid #e1eadc' }}>
            <div>
              <span style={{ fontSize: 10, color: '#7a8677', fontWeight: 700, display: 'block' }}>CURRENT LIFECYCLE STAGE</span>
              <span className={`badge-${delivery.status?.toLowerCase()}`} style={{ fontSize: 11, padding: '4px 10px', marginTop: 4, display: 'inline-block' }}>
                {delivery.status}
              </span>
            </div>
            {delivery.recipientConfirmed && (
              <span style={{ color: '#2e7d32', display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700 }}>
                <CheckCircle2 size={16} /> Verified by Recipient
              </span>
            )}
          </div>

          {/* Timeline */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 8, padding: '10px 0', borderBottom: '1px solid #e5e9e0' }}>
            <div style={{ fontSize: 10, color: '#687865' }}>
              <strong>Created:</strong><br />{delivery.createdAt ? fmt(delivery.createdAt) : '—'}
            </div>
            {delivery.acceptedAt && (
              <div style={{ fontSize: 10, color: '#687865' }}>
                <strong>Accepted:</strong><br />{fmt(delivery.acceptedAt)}
              </div>
            )}
            {delivery.pickedUpAt && (
              <div style={{ fontSize: 10, color: '#687865' }}>
                <strong>Picked Up:</strong><br />{fmt(delivery.pickedUpAt)}
              </div>
            )}
            {delivery.deliveredAt && (
              <div style={{ fontSize: 10, color: '#2e7d32' }}>
                <strong>Delivered:</strong><br />{fmt(delivery.deliveredAt)}
              </div>
            )}
            {delivery.confirmedAt && (
              <div style={{ fontSize: 10, color: '#1b5e20' }}>
                <strong>Confirmed:</strong><br />{fmt(delivery.confirmedAt)}
              </div>
            )}
          </div>

          {/* Participants Information */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ background: '#fff', border: '1px solid #e2ebd8', borderRadius: 10, padding: 12 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: '#7a8677', display: 'block' }}>DONOR / PICKUP</span>
              <strong style={{ fontSize: 13, color: '#263b28' }}>{delivery.donorName}</strong>
              <div style={{ fontSize: 11, color: '#566654', marginTop: 4, display: 'flex', alignItems: 'center', gap: 5 }}>
                <MapPin size={12} /> {delivery.pickupAddress || 'Address on file'}
              </div>
              {delivery.donorPhone && (
                <div style={{ fontSize: 11, color: '#566654', marginTop: 2, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Phone size={12} /> {delivery.donorPhone}
                </div>
              )}
            </div>

            <div style={{ background: '#fff', border: '1px solid #e2ebd8', borderRadius: 10, padding: 12 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: '#7a8677', display: 'block' }}>RECIPIENT / DROP-OFF</span>
              <strong style={{ fontSize: 13, color: '#263b28' }}>{delivery.recipientName}</strong>
              <div style={{ fontSize: 11, color: '#566654', marginTop: 4, display: 'flex', alignItems: 'center', gap: 5 }}>
                <MapPin size={12} /> {delivery.deliveryAddress}
              </div>
              {delivery.recipientPhone && (
                <div style={{ fontSize: 11, color: '#566654', marginTop: 2, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Phone size={12} /> {delivery.recipientPhone}
                </div>
              )}
            </div>
          </div>

          {/* Assigned Driver Card */}
          <div style={{ background: '#f8faf5', border: '1px solid #e2ebd8', borderRadius: 10, padding: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: 50, background: '#e3edcf', display: 'grid', placeItems: 'center', color: '#283593' }}>
                <Truck size={17} />
              </div>
              <div>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#7a8677', display: 'block' }}>ASSIGNED DRIVER</span>
                <strong style={{ fontSize: 13, color: '#263b28' }}>{delivery.driverName}</strong>
                <span style={{ fontSize: 11, color: '#566654', display: 'block' }}>{delivery.driverPhone || 'No phone registered'}</span>
              </div>
            </div>

            {delivery.status !== 'CANCELLED' && (
              <button type="button" className="btn btn-outline btn-sm" onClick={() => onTrack(delivery)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Navigation size={13} /> Live Map
              </button>
            )}
          </div>

          {/* Handover Proof Details */}
          {delivery.proofImageUrl ? (
            <div style={{ background: '#fff', border: '1px solid #e2ebd8', borderRadius: 10, padding: 14 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: '#2e7d32', display: 'flex', alignItems: 'center', gap: 5, marginBottom: 8 }}>
                <Camera size={13} /> DELIVERY PROOF ON FILE
              </span>
              <img
                src={delivery.proofImageUrl.startsWith('http') ? delivery.proofImageUrl : delivery.proofImageUrl}
                alt="Delivery Handover Proof"
                style={{ width: '100%', maxHeight: 220, objectFit: 'cover', borderRadius: 8, border: '1px solid #d4ded0' }}
              />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 8, fontSize: 11, color: '#5a6958' }}>
                <div><strong>Receiver:</strong> {delivery.receiverName || 'Recorded on handover'}</div>
                <div><strong>Delivered At:</strong> {delivery.deliveredAt ? fmt(delivery.deliveredAt) : 'Recorded'}</div>
                {delivery.deliveryLatitude && (
                  <div style={{ gridColumn: 'span 2' }}>
                    <strong>GPS Coordinates:</strong> {Number(delivery.deliveryLatitude).toFixed(6)}, {Number(delivery.deliveryLongitude).toFixed(6)}
                  </div>
                )}
              </div>
            </div>
          ) : (
            delivery.status === 'DELIVERED' && (
              <div className="alert-banner warning">
                Delivery marked as delivered. Awaiting handover photo verification.
              </div>
            )
          )}

          {/* Failure reason if marked failed */}
          {delivery.status === 'FAILED' && delivery.failureReason && (
            <div className="alert-banner danger" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertTriangle size={16} />
              <div>
                <strong>Delivery Failed:</strong> {delivery.failureReason}
                {delivery.failedAt && <div style={{ fontSize: 10, marginTop: 2 }}>Reported at {fmt(delivery.failedAt)}</div>}
              </div>
            </div>
          )}

          {/* Recipient Confirmation Form */}
          {showConfirmForm && (
            <form onSubmit={handleConfirm} style={{ padding: 14, background: '#f1f8e9', borderRadius: 10, border: '1px solid #c5e1a5', display: 'grid', gap: 10 }}>
              <strong style={{ fontSize: 12, color: '#2e7d32' }}>Confirm Food Collection & Handover</strong>
              <textarea
                rows={2}
                placeholder="Optional notes or feedback (e.g. food in good condition, meal count verified)"
                value={confirmNotes}
                onChange={e => setConfirmNotes(e.target.value)}
                style={{ width: '100%', borderRadius: 8, padding: 8, fontSize: 11, border: '1px solid #aed581' }}
              />
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowConfirmForm(false)}>Cancel</button>
                <button type="submit" className="btn btn-dark btn-sm" disabled={submitting}>
                  {submitting ? 'Confirming...' : 'Submit Confirmation'}
                </button>
              </div>
            </form>
          )}

          {/* Failure Report Form */}
          {showReportForm && (
            <form onSubmit={handleFail} style={{ padding: 14, background: '#ffebee', borderRadius: 10, border: '1px solid #ffcdd2', display: 'grid', gap: 10 }}>
              <strong style={{ fontSize: 12, color: '#c62828' }}>Report Delivery Issue / Failure</strong>
              <textarea
                required
                rows={2}
                placeholder="Specify the reason (e.g. food damaged in transit, wrong address, driver did not arrive)"
                value={reportReason}
                onChange={e => setReportReason(e.target.value)}
                style={{ width: '100%', borderRadius: 8, padding: 8, fontSize: 11, border: '1px solid #e57373' }}
              />
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowReportForm(false)}>Cancel</button>
                <button type="submit" className="btn btn-danger btn-sm" disabled={submitting}>
                  {submitting ? 'Reporting...' : 'Submit Report'}
                </button>
              </div>
            </form>
          )}

          {/* Action Buttons */}
          <div className="modal-actions" style={{ marginTop: 12 }}>
            {(isRecipient || isAdmin) && delivery.status === 'DELIVERED' && !showConfirmForm && (
              <button type="button" className="btn btn-dark btn-sm" onClick={() => setShowConfirmForm(true)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <CheckCircle2 size={14} /> Confirm Food Receipt
              </button>
            )}

            {(isRecipient || isAdmin) && delivery.status !== 'CONFIRMED' && delivery.status !== 'CANCELLED' && delivery.status !== 'FAILED' && !showReportForm && (
              <button type="button" className="btn btn-outline btn-sm" onClick={() => setShowReportForm(true)} style={{ color: '#c62828' }}>
                Report Issue
              </button>
            )}

            <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>Close</button>
          </div>
        </div>
      </div>
    </div>
  );
}
