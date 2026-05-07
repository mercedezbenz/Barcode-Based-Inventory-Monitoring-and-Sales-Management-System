"use client"

import { useState, useEffect } from "react"
import { X, BookOpen, Shield, ShoppingCart, ScanBarcode, ChevronRight, AlertTriangle, CheckCircle2, Info, Package, Bell, BarChart3, Truck, ClipboardList, Sparkles } from "lucide-react"

type TabKey = "general" | "owner" | "sales" | "encoder" | "rules" | "troubleshooting"

interface UserManualModalProps {
  open: boolean
  onClose: () => void
  isWelcome?: boolean
  defaultTab?: TabKey
}

export function UserManualModal({ open, onClose, isWelcome = false, defaultTab }: UserManualModalProps) {
  const [activeTab, setActiveTab] = useState<TabKey>(defaultTab || "general")

  // Sync defaultTab when it changes (e.g. welcome mode sets role tab)
  useEffect(() => {
    if (defaultTab) setActiveTab(defaultTab)
  }, [defaultTab])

  // Lock body scroll when modal is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = ""
    }
    return () => { document.body.style.overflow = "" }
  }, [open])

  if (!open) return null

  const tabs: { key: TabKey; label: string; icon: React.ReactNode }[] = [
    { key: "general", label: "Getting Started", icon: <BookOpen className="w-4 h-4" /> },
    { key: "owner", label: "Owner", icon: <Shield className="w-4 h-4" /> },
    { key: "sales", label: "Sales", icon: <ShoppingCart className="w-4 h-4" /> },
    { key: "encoder", label: "Encoder", icon: <ScanBarcode className="w-4 h-4" /> },
    { key: "rules", label: "System Rules", icon: <AlertTriangle className="w-4 h-4" /> },
    { key: "troubleshooting", label: "Help", icon: <Info className="w-4 h-4" /> },
  ]

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className="relative w-full max-w-4xl bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 flex flex-col animate-in fade-in zoom-in-95 duration-200"
        style={{ maxHeight: "85vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/40">
              <BookOpen className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                {isWelcome ? "Welcome to DeckTaGo 👋" : "DeckTaGo User Manual"}
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {isWelcome ? "Here's a quick guide on how to use the system" : "Supply Chain Management System Guide"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex items-center justify-center w-8 h-8 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-6 py-3 border-b border-gray-100 dark:border-gray-800 overflow-x-auto shrink-0">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all duration-150 ${
                activeTab === tab.key
                  ? "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 shadow-sm"
                  : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-200"
              }`}
            >
              {tab.icon}
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {/* Welcome banner */}
          {isWelcome && (
            <div className="mb-5 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/40 border border-blue-100 dark:border-blue-900/50 p-4 flex items-start gap-3">
              <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-blue-100 dark:bg-blue-900/40 shrink-0 mt-0.5">
                <Sparkles className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-blue-800 dark:text-blue-200 mb-1">First time here?</p>
                <p className="text-xs text-blue-600 dark:text-blue-400 leading-relaxed">
                  We&apos;ve opened this guide to help you get started. Browse through the tabs to learn about your dashboard features. You can always reopen this manual using the <strong>help icon</strong> in the top bar.
                </p>
              </div>
            </div>
          )}
          {activeTab === "general" && <GeneralContent />}
          {activeTab === "owner" && <OwnerContent />}
          {activeTab === "sales" && <SalesContent />}
          {activeTab === "encoder" && <EncoderContent />}
          {activeTab === "rules" && <RulesContent />}
          {activeTab === "troubleshooting" && <TroubleshootingContent />}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between shrink-0">
          <p className="text-xs text-gray-400 dark:text-gray-500">
            DeckTaGo Supply Chain Management System
          </p>
          {isWelcome ? (
            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                Don&apos;t show again
              </button>
              <button
                onClick={onClose}
                className="px-5 py-1.5 text-sm font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-sm"
              >
                Got it!
              </button>
            </div>
          ) : (
            <button
              onClick={onClose}
              className="px-4 py-1.5 text-sm font-medium rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

/* ── Section Wrapper ── */
function Section({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="mb-6 last:mb-0">
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
      </div>
      <div className="space-y-2 text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
        {children}
      </div>
    </div>
  )
}

function InfoCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/50 p-4 text-sm text-blue-700 dark:text-blue-300">
      {children}
    </div>
  )
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-1.5 ml-1">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2">
          <ChevronRight className="w-3.5 h-3.5 mt-0.5 text-blue-500 dark:text-blue-400 shrink-0" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  )
}

function CheckList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-1.5 ml-1">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2">
          <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 text-emerald-500 shrink-0" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  )
}

/* ── Tab Content Components ── */

function GeneralContent() {
  return (
    <div className="space-y-6">
      <Section title="Purpose" icon={<BookOpen className="w-4 h-4 text-blue-500" />}>
        <p>This manual explains how to use the DeckTaGo Supply Chain Management System for the following roles:</p>
        <BulletList items={[
          "🧑💼 Owner (Admin) — Monitor & manage inventory",
          "🧾 Sales — Handle customer orders",
          "🧑🔧 Encoder — Process stock deductions via barcode scanning",
        ]} />
      </Section>

      <Section title="How to Log In" icon={<Shield className="w-4 h-4 text-emerald-500" />}>
        <ol className="space-y-2 ml-1">
          <li className="flex items-start gap-2">
            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 text-xs font-bold shrink-0">1</span>
            <span>Go to the system URL</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 text-xs font-bold shrink-0">2</span>
            <span>Enter your <strong>Email</strong> and <strong>Password</strong></span>
          </li>
          <li className="flex items-start gap-2">
            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 text-xs font-bold shrink-0">3</span>
            <span>Click <strong>Login</strong></span>
          </li>
        </ol>
      </Section>

      <Section title="Account Menu (Top Right)" icon={<Info className="w-4 h-4 text-violet-500" />}>
        <p>Click your profile icon to access:</p>
        <BulletList items={[
          "Role Display — Shows if you are Owner / Sales / Encoder",
          "Appearance Toggle — Switch between Light / Dark mode",
          "Logout — Securely exit the system",
        ]} />
      </Section>

      <Section title="Sample Accounts" icon={<Shield className="w-4 h-4 text-amber-500" />}>
        <div className="space-y-3">
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-3">
            <p className="font-medium text-gray-800 dark:text-gray-200 mb-1">🧑💼 Owner Account</p>
            <p className="text-xs text-gray-500">Email: <span className="font-mono text-gray-700 dark:text-gray-300">owner@decktago.com</span></p>
            <p className="text-xs text-gray-400 italic">Password: (provided by system administrator)</p>
          </div>
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-3">
            <p className="font-medium text-gray-800 dark:text-gray-200 mb-1">🧾 Sales Account</p>
            <p className="text-xs text-gray-500">Email: <span className="font-mono text-gray-700 dark:text-gray-300">sales@decktago.com</span></p>
            <p className="text-xs text-gray-400 italic">Password: (provided by system administrator)</p>
          </div>
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-3">
            <p className="font-medium text-gray-800 dark:text-gray-200 mb-1">🧑🔧 Encoder Account</p>
            <p className="text-xs text-gray-500">Email: <span className="font-mono text-gray-700 dark:text-gray-300">encoder@decktago.com</span></p>
            <p className="text-xs text-gray-400 italic">Password: (provided by system administrator)</p>
          </div>
        </div>
        <InfoCard>
          🔒 Passwords are managed securely and are not included in this manual.
        </InfoCard>
      </Section>
    </div>
  )
}

function OwnerContent() {
  return (
    <div className="space-y-6">
      <InfoCard>
        The Owner Dashboard lets you monitor overall inventory and system status at a glance.
      </InfoCard>

      <Section title="Main Dashboard Features" icon={<BarChart3 className="w-4 h-4 text-blue-500" />}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { num: "1", title: "Total Items", desc: "Shows total unique products, total kg and boxes" },
            { num: "2", title: "Low Stock", desc: "Products with ≤ 50 kg remaining" },
            { num: "3", title: "Out of Stock", desc: "Items with 0 kg remaining" },
            { num: "4", title: "Sales Summary", desc: "Sales Today (kg), This Week (kg), Top Products" },
            { num: "5", title: "Stock Status Overview", desc: "In Stock / Low Stock / Out of Stock distribution" },
            { num: "6", title: "Inventory Insights", desc: "Smart alerts for out-of-stock and low stock items" },
            { num: "7", title: "Stock Alert & Updates", desc: "Real-time critical items with status and last update" },
          ].map((f) => (
            <div key={f.num} className="rounded-xl border border-gray-200 dark:border-gray-700 p-3">
              <div className="flex items-center gap-2 mb-1">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 text-xs font-bold">{f.num}</span>
                <span className="font-medium text-gray-800 dark:text-gray-200 text-sm">{f.title}</span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 ml-7">{f.desc}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="What Owner Does" icon={<CheckCircle2 className="w-4 h-4 text-emerald-500" />}>
        <CheckList items={[
          "Monitor stock levels",
          "Check low stock alerts",
          "Review sales activity (kg-based)",
          "Make decisions for restocking",
        ]} />
      </Section>
    </div>
  )
}

function SalesContent() {
  return (
    <div className="space-y-6">
      <InfoCard>
        The Sales Dashboard helps you handle customer orders and monitor outgoing products.
      </InfoCard>

      <Section title="Dashboard Features" icon={<BarChart3 className="w-4 h-4 text-blue-500" />}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { num: "1", title: "Orders Today", desc: "Number of orders received today" },
            { num: "2", title: "Pending Orders", desc: "Orders waiting for processing" },
            { num: "3", title: "Completed Orders", desc: "Successfully fulfilled orders" },
            { num: "4", title: "KG Sold Today", desc: "Total kg of completed orders today" },
            { num: "5", title: "Sales This Week", desc: "Weekly outgoing kg" },
            { num: "6", title: "Top Products", desc: "Most sold products based on kg" },
            { num: "7", title: "Low Stock Warning", desc: "Items near the 50 kg threshold" },
          ].map((f) => (
            <div key={f.num} className="rounded-xl border border-gray-200 dark:border-gray-700 p-3">
              <div className="flex items-center gap-2 mb-1">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-orange-100 dark:bg-orange-900/40 text-orange-600 dark:text-orange-400 text-xs font-bold">{f.num}</span>
                <span className="font-medium text-gray-800 dark:text-gray-200 text-sm">{f.title}</span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 ml-7">{f.desc}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Order Process" icon={<ClipboardList className="w-4 h-4 text-violet-500" />}>
        <ol className="space-y-3 ml-1">
          <li className="flex items-start gap-2">
            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-400 text-xs font-bold shrink-0">1</span>
            <div>
              <p className="font-medium text-gray-800 dark:text-gray-200">Create Order</p>
              <p className="text-xs text-gray-500">Input customer details, select products (kg-based)</p>
            </div>
          </li>
          <li className="flex items-start gap-2">
            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-400 text-xs font-bold shrink-0">2</span>
            <div>
              <p className="font-medium text-gray-800 dark:text-gray-200">Submit Order</p>
              <p className="text-xs text-gray-500">Order goes to Encoder Tasks for processing</p>
            </div>
          </li>
        </ol>
      </Section>

      <Section title="What Sales Does" icon={<CheckCircle2 className="w-4 h-4 text-emerald-500" />}>
        <CheckList items={[
          "Create customer orders",
          "Monitor order status",
          "Track outgoing inventory (kg)",
        ]} />
      </Section>
    </div>
  )
}

function EncoderContent() {
  return (
    <div className="space-y-6">
      <InfoCard>
        The Encoder Dashboard processes and verifies stock deductions using barcode scanning.
      </InfoCard>

      <Section title="Encoder Task Tabs" icon={<ClipboardList className="w-4 h-4 text-blue-500" />}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { num: "1", title: "Pending", desc: "Newly created orders from Sales", color: "bg-yellow-100 dark:bg-yellow-900/40 text-yellow-600 dark:text-yellow-400" },
            { num: "2", title: "Verification", desc: "Scan barcodes, confirm stock allocation", color: "bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400" },
            { num: "3", title: "For Delivery", desc: "Ready for dispatch", color: "bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-400" },
            { num: "4", title: "On Delivery", desc: "Currently being delivered", color: "bg-orange-100 dark:bg-orange-900/40 text-orange-600 dark:text-orange-400" },
            { num: "5", title: "Completed", desc: "Finished transactions", color: "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400" },
          ].map((f) => (
            <div key={f.num} className="rounded-xl border border-gray-200 dark:border-gray-700 p-3">
              <div className="flex items-center gap-2 mb-1">
                <span className={`flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold ${f.color}`}>{f.num}</span>
                <span className="font-medium text-gray-800 dark:text-gray-200 text-sm">{f.title}</span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 ml-7">{f.desc}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Scanning Process" icon={<ScanBarcode className="w-4 h-4 text-red-500" />}>
        <div className="rounded-xl border-2 border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20 p-4">
          <p className="font-semibold text-red-700 dark:text-red-400 text-sm mb-2">⚠️ Important Workflow</p>
          <ol className="space-y-2 ml-1 text-sm">
            <li className="flex items-start gap-2">
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 text-xs font-bold shrink-0">1</span>
              <span>Open a task in <strong>Verification</strong></span>
            </li>
            <li className="flex items-start gap-2">
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 text-xs font-bold shrink-0">2</span>
              <span>Scan barcode of product</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 text-xs font-bold shrink-0">3</span>
              <span>System deducts stock (kg) using <strong>FIFO</strong> (oldest first)</span>
            </li>
          </ol>
        </div>
      </Section>

      <Section title="System Behavior After Scanning" icon={<Package className="w-4 h-4 text-emerald-500" />}>
        <CheckList items={[
          "Inventory table updates automatically",
          "Remaining weight decreases",
          "If 0 kg → marked OUT OF STOCK",
          "Item moves to bottom of its batch group",
          "Transaction is recorded",
        ]} />
      </Section>

      <Section title="Transaction History" icon={<ClipboardList className="w-4 h-4 text-violet-500" />}>
        <p>Each scan creates a record:</p>
        <BulletList items={[
          "OUT — usage (stock deduction)",
          "IN — restock (incoming goods)",
          "RETURN — if applicable",
        ]} />
      </Section>

      <Section title="What Encoder Does" icon={<CheckCircle2 className="w-4 h-4 text-emerald-500" />}>
        <CheckList items={[
          "Scan products via barcode",
          "Deduct stock accurately",
          "Verify order fulfillment",
          "Ensure FIFO is followed",
        ]} />
      </Section>
    </div>
  )
}

function RulesContent() {
  return (
    <div className="space-y-6">
      <Section title="Weight-Based System" icon={<Package className="w-4 h-4 text-blue-500" />}>
        <BulletList items={[
          "All calculations are in kg",
          "1 BOX = 25 kg (display only)",
        ]} />
      </Section>

      <Section title="Low Stock Rule" icon={<AlertTriangle className="w-4 h-4 text-amber-500" />}>
        <div className="rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-4">
          <p className="font-semibold text-amber-700 dark:text-amber-400 text-sm mb-1">🚨 Low Stock Trigger</p>
          <p className="text-sm">Triggered when a product has <strong>≤ 50 kg</strong> remaining</p>
        </div>
      </Section>

      <Section title="FIFO System" icon={<Truck className="w-4 h-4 text-violet-500" />}>
        <BulletList items={[
          "Oldest stock is used first",
          "Expiring items are prioritized",
        ]} />
      </Section>

      <Section title="Notifications" icon={<Bell className="w-4 h-4 text-red-500" />}>
        <BulletList items={[
          "Based on total product weight (not per batch)",
          "Aggregated across all batches for each product",
        ]} />
      </Section>

      <Section title="Best Practices" icon={<CheckCircle2 className="w-4 h-4 text-emerald-500" />}>
        <CheckList items={[
          "Always scan before confirming",
          "Monitor low stock daily",
          "Avoid manual stock edits",
          "Use barcode for accuracy",
          "Check transactions if mismatch occurs",
        ]} />
      </Section>

      <Section title="Role Summary" icon={<Shield className="w-4 h-4 text-blue-500" />}>
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800/50">
                <th className="text-left py-2 px-4 font-semibold text-gray-700 dark:text-gray-300">Role</th>
                <th className="text-left py-2 px-4 font-semibold text-gray-700 dark:text-gray-300">Responsibility</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-gray-100 dark:border-gray-800">
                <td className="py-2 px-4 text-gray-700 dark:text-gray-300">🧑💼 Owner</td>
                <td className="py-2 px-4 text-gray-500 dark:text-gray-400">Monitor & decide</td>
              </tr>
              <tr className="border-t border-gray-100 dark:border-gray-800">
                <td className="py-2 px-4 text-gray-700 dark:text-gray-300">🧾 Sales</td>
                <td className="py-2 px-4 text-gray-500 dark:text-gray-400">Create orders</td>
              </tr>
              <tr className="border-t border-gray-100 dark:border-gray-800">
                <td className="py-2 px-4 text-gray-700 dark:text-gray-300">🧑🔧 Encoder</td>
                <td className="py-2 px-4 text-gray-500 dark:text-gray-400">Execute stock deduction</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  )
}

function TroubleshootingContent() {
  return (
    <div className="space-y-4">
      {[
        {
          title: "Stock not updating",
          solution: "Ensure barcode was scanned in the Verification tab. The scan triggers the stock deduction.",
        },
        {
          title: "Wrong remaining kg",
          solution: "Check if there are multiple batches for the product. Verify the FIFO allocation is being applied correctly.",
        },
        {
          title: "Notifications mismatch",
          solution: "Verify the totalRemainingWeight calculation. Notifications are based on aggregated product weight, not individual batches.",
        },
        {
          title: "N/A in transactions",
          solution: "This indicates a missing product reference. Check the data mapping to ensure productName, productId, and barcode are properly saved.",
        },
      ].map((item, i) => (
        <div key={i} className="rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="flex items-center justify-center w-6 h-6 rounded-full bg-red-100 dark:bg-red-900/40">
              <X className="w-3.5 h-3.5 text-red-500" />
            </div>
            <h4 className="font-semibold text-gray-800 dark:text-gray-200 text-sm">{item.title}</h4>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 ml-8">
            → {item.solution}
          </p>
        </div>
      ))}
    </div>
  )
}
