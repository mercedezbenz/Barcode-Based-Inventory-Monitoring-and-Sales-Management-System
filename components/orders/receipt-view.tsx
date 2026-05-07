"use client"

import { forwardRef } from "react"
import type { Order } from "@/hooks/useOrders"

// ─── Helpers ───
const parseDate = (d: any): Date | null => {
  if (!d) return null
  if (typeof d === "string") return new Date(d)
  if (d instanceof Date) return d
  if (d?.toDate) return d.toDate()
  if (d?.seconds) return new Date(d.seconds * 1000)
  return null
}

const formatDate = (d: any): string => {
  const date = parseDate(d)
  if (!date || isNaN(date.getTime())) return "N/A"
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
}

const formatTime = (d: any): string => {
  const date = parseDate(d)
  if (!date || isNaN(date.getTime())) return ""
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })
}

interface ReceiptViewProps {
  order: Order
}

/**
 * Receipt-style component for printing/PDF.
 * Uses forwardRef so the parent can capture it for window.print().
 */
export const ReceiptView = forwardRef<HTMLDivElement, ReceiptViewProps>(
  ({ order }, ref) => {
    return (
      <div ref={ref} className="receipt-view">
        {/* Inline styles for print */}
        <style jsx>{`
          .receipt-view {
            max-width: 380px;
            margin: 0 auto;
            background: white;
            color: #1e293b;
            font-family: 'Inter', -apple-system, sans-serif;
            padding: 32px 28px;
            border-radius: 16px;
            border: 1px solid #e5e7eb;
            box-shadow: 0 4px 24px rgba(0,0,0,0.06);
          }

          @media print {
            .receipt-view {
              box-shadow: none;
              border: none;
              border-radius: 0;
              max-width: 100%;
              padding: 16px;
            }
          }

          .receipt-header {
            text-align: center;
            padding-bottom: 20px;
            border-bottom: 2px dashed #e5e7eb;
            margin-bottom: 20px;
          }

          .receipt-logo {
            font-size: 20px;
            font-weight: 800;
            letter-spacing: -0.02em;
            color: #0f172a;
            margin-bottom: 4px;
          }

          .receipt-logo span {
            color: #0ea5e9;
          }

          .receipt-subtitle {
            font-size: 11px;
            color: #94a3b8;
            text-transform: uppercase;
            letter-spacing: 0.1em;
            font-weight: 600;
          }

          .receipt-meta {
            font-size: 12px;
            color: #64748b;
            margin-top: 12px;
            line-height: 1.6;
          }

          .receipt-section {
            margin-bottom: 16px;
          }

          .receipt-section-title {
            font-size: 10px;
            font-weight: 700;
            color: #94a3b8;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            margin-bottom: 8px;
          }

          .receipt-customer {
            font-size: 13px;
            color: #334155;
            line-height: 1.7;
          }

          .receipt-customer strong {
            color: #0f172a;
            font-weight: 600;
          }

          .receipt-divider {
            border: none;
            border-top: 1px dashed #e5e7eb;
            margin: 16px 0;
          }

          .receipt-items {
            list-style: none;
            padding: 0;
            margin: 0;
          }

          .receipt-item {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            padding: 8px 0;
            font-size: 13px;
            border-bottom: 1px solid #f8fafc;
          }

          .receipt-item:last-child {
            border-bottom: none;
          }

          .receipt-item-name {
            flex: 1;
            color: #334155;
            font-weight: 500;
            padding-right: 12px;
          }

          .receipt-item-qty {
            color: #94a3b8;
            font-size: 12px;
            margin-top: 2px;
          }

          .receipt-item-price {
            font-weight: 600;
            color: #0f172a;
            white-space: nowrap;
          }

          .receipt-totals {
            padding-top: 12px;
            border-top: 2px dashed #e5e7eb;
          }

          .receipt-total-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 4px 0;
            font-size: 13px;
            color: #64748b;
          }

          .receipt-total-row.grand {
            font-size: 18px;
            font-weight: 700;
            color: #0f172a;
            padding: 10px 0 4px;
          }

          .receipt-status {
            text-align: center;
            margin-top: 20px;
            padding-top: 16px;
            border-top: 2px dashed #e5e7eb;
          }

          .receipt-status-badge {
            display: inline-block;
            padding: 6px 20px;
            border-radius: 9999px;
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.08em;
          }

          .receipt-status-badge.pending {
            background: #fef3c7;
            color: #92400e;
            border: 1px solid #fbbf24;
          }

          .receipt-status-badge.completed {
            background: #d1fae5;
            color: #065f46;
            border: 1px solid #34d399;
          }

          .receipt-status-badge.cancelled {
            background: #fee2e2;
            color: #991b1b;
            border: 1px solid #f87171;
          }

          .receipt-footer {
            text-align: center;
            margin-top: 20px;
            font-size: 11px;
            color: #cbd5e1;
          }

          .receipt-order-id {
            font-family: monospace;
            font-size: 10px;
            color: #cbd5e1;
            margin-top: 8px;
          }
        `}</style>

        {/* Header */}
        <div className="receipt-header">
          <div className="receipt-logo">
            Deckta<span>GO</span>
          </div>
          <div className="receipt-subtitle">Order Receipt</div>
          <div className="receipt-meta">
            <div>{formatDate(order.createdAt)}</div>
            <div>{formatTime(order.createdAt)}</div>
          </div>
        </div>

        {/* Customer Info */}
        <div className="receipt-section">
          <div className="receipt-section-title">Customer</div>
          <div className="receipt-customer">
            <div><strong>{order.customerName}</strong></div>
            {order.customerPhone && <div>Phone: {order.customerPhone}</div>}
            {order.customerAddress && <div>Address: {order.customerAddress}</div>}
          </div>
        </div>

        <hr className="receipt-divider" />

        {/* Items */}
        <div className="receipt-section">
          <div className="receipt-section-title">Items Ordered</div>
          {order.items && order.items.length > 0 ? (
            <ul className="receipt-items">
              {order.items.map((item, idx) => (
                <li key={idx} className="receipt-item">
                  <div>
                    <div className="receipt-item-name">{item.name || "Unnamed Item"}</div>
                    <div className="receipt-item-qty">Quantity: {item.quantity} {item.unit || "unit"}</div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p style={{ fontSize: 13, color: "#94a3b8" }}>No items</p>
          )}
        </div>


        {/* Status */}
        <div className="receipt-status">
          <span className={`receipt-status-badge ${order.status}`}>
            {order.status}
          </span>
        </div>

        {/* Footer */}
        <div className="receipt-footer">
          <div>Thank you for your order!</div>
          <div className="receipt-order-id">#{order.id}</div>
        </div>
      </div>
    )
  }
)

ReceiptView.displayName = "ReceiptView"
