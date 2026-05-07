"use client"

import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader } from "@/components/ui/card"

// ─── Reusable Building Blocks ────────────────────────────────────────────────

/** A single KPI stat card skeleton */
function SkeletonCard() {
  return (
    <Card className="shadow-md">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-8 rounded-full" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-8 w-20 mb-2" />
        <Skeleton className="h-3 w-32" />
      </CardContent>
    </Card>
  )
}

/** KPI card skeleton styled for the main dashboard (rounded-2xl, with trend chart area) */
function DashboardKpiCard() {
  return (
    <Card className="rounded-2xl border border-[#E5E7EB] dark:border-border shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-4 pt-4 md:px-5 md:pt-5">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-8 rounded-full" />
      </CardHeader>
      <CardContent className="px-4 pb-4 md:px-5 md:pb-5">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-16 mb-2" />
            <div className="flex items-center gap-1.5">
              <Skeleton className="h-3 w-3 rounded-full" />
              <Skeleton className="h-3 w-28" />
            </div>
          </div>
          {/* Trend chart placeholder */}
          <div className="flex items-end gap-1 h-16 w-20 opacity-40">
            <Skeleton className="w-3 h-5 rounded-t-sm" />
            <Skeleton className="w-3 h-8 rounded-t-sm" />
            <Skeleton className="w-3 h-12 rounded-t-sm" />
            <Skeleton className="w-3 h-10 rounded-t-sm" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

/** A single skeleton table row with configurable column count */
function SkeletonTableRow({ columns = 4 }: { columns?: number }) {
  return (
    <div
      className={`grid gap-4 py-3 px-0 border-b border-[#E5E7EB] dark:border-border last:border-0`}
      style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
    >
      {Array.from({ length: columns }).map((_, i) => (
        <div key={i} className="flex items-center">
          <Skeleton className="h-4 w-full max-w-[120px]" />
        </div>
      ))}
    </div>
  )
}

// ─── Full-Page Skeletons ─────────────────────────────────────────────────────

/** Skeleton for the main Dashboard Overview page (home) */
export function DashboardOverviewSkeleton() {
  return (
    <div className="space-y-8 pb-8 animate-in fade-in duration-300">
      {/* Page Header */}
      <div>
        <Skeleton className="h-8 w-48 mb-2" />
        <Skeleton className="h-4 w-64" />
      </div>

      {/* 3 KPI Cards */}
      <div className="grid gap-5 md:grid-cols-3">
        <DashboardKpiCard />
        <DashboardKpiCard />
        <DashboardKpiCard />
      </div>

      {/* 2 Data Tables side by side */}
      <div className="grid gap-5 md:grid-cols-2">
        {/* Stock Alert & Updates skeleton */}
        <Card className="rounded-2xl border border-[#E5E7EB] dark:border-border shadow-sm">
          <CardHeader className="pb-4 px-6 pt-6">
            <Skeleton className="h-5 w-44 mb-1.5" />
            <Skeleton className="h-3 w-56" />
          </CardHeader>
          <CardContent className="px-6 pb-6">
            {/* Table header */}
            <div className="grid grid-cols-[2.5fr_1.3fr_0.7fr_1fr] gap-4 bg-[#F3F4F6] dark:bg-secondary/50 border-b border-[#E5E7EB] dark:border-border py-3 mb-0">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3 w-24 mx-auto" />
              <Skeleton className="h-3 w-16 mx-auto" />
              <Skeleton className="h-3 w-20 ml-auto" />
            </div>
            {/* Table rows */}
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className={`grid grid-cols-[2.5fr_1.3fr_0.7fr_1fr] gap-4 py-3 border-b border-[#E5E7EB] dark:border-border last:border-0 ${i % 2 === 1 ? "bg-[#F9FAFB] dark:bg-secondary/20" : ""}`}
              >
                <div className="flex flex-col gap-1">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-20" />
                </div>
                <Skeleton className="h-4 w-20 mx-auto self-center" />
                <Skeleton className="h-4 w-8 mx-auto self-center" />
                <Skeleton className="h-4 w-16 ml-auto self-center" />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Delivery Status skeleton — card layout */}
        <Card className="rounded-2xl border border-[#E5E7EB] dark:border-border shadow-sm">
          <CardHeader className="pb-4 px-6 pt-6">
            <Skeleton className="h-5 w-36 mb-1.5" />
            <Skeleton className="h-3 w-52" />
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <div className="grid gap-3 md:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="rounded-xl border border-[#E5E7EB] dark:border-border p-4 space-y-3 border-l-4 border-l-[#E5E7EB]">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <Skeleton className="h-4 w-28 mb-1.5" />
                      <Skeleton className="h-3 w-36" />
                    </div>
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <Skeleton className="h-6 w-24 rounded-md" />
                    <Skeleton className="h-6 w-12 rounded-md" />
                    <Skeleton className="h-6 w-28 rounded-md" />
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-[#F3F4F6] dark:border-border/50">
                    <div className="flex items-center gap-1.5">
                      <Skeleton className="h-5 w-5 rounded-full" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                    <Skeleton className="h-3 w-16" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

/** Skeleton for the Inventory Dashboard page */
export function InventoryDashboardSkeleton() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-50 to-gray-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 pb-8 animate-in fade-in duration-300">
      <div className="space-y-8">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-56 mb-2" />
            <Skeleton className="h-4 w-72" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-10 w-24 rounded-md" />
            <Skeleton className="h-10 w-28 rounded-md" />
            <Skeleton className="h-10 w-36 rounded-md" />
          </div>
        </div>

        {/* 4 Stat Cards */}
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>

        {/* Main table card */}
        <Card className="border-border/50 shadow-md bg-white dark:bg-card">
          <CardHeader className="pb-6 px-6 pt-6">
            {/* Title + description */}
            <Skeleton className="h-6 w-40 mb-2" />
            <Skeleton className="h-4 w-52 mb-4" />

            {/* Filter bar */}
            <div className="flex flex-wrap items-end gap-3 pb-4 border-b border-border/40">
              <div className="flex flex-col gap-1.5 min-w-[165px]">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-10 w-full rounded-lg" />
              </div>
              <div className="flex flex-col gap-1.5 min-w-[145px]">
                <Skeleton className="h-3 w-10" />
                <Skeleton className="h-10 w-full rounded-lg" />
              </div>
              <div className="flex flex-col gap-1.5 min-w-[155px]">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-10 w-full rounded-lg" />
              </div>
              <div className="flex flex-col gap-1.5 flex-1 min-w-[250px]">
                <Skeleton className="h-3 w-12" />
                <div className="flex gap-2">
                  <Skeleton className="h-10 flex-1 rounded-lg" />
                  <Skeleton className="h-10 w-24 rounded-lg" />
                </div>
              </div>
              <div className="flex items-end gap-2 ml-auto">
                <div className="flex flex-col gap-1.5">
                  <Skeleton className="h-3 w-12" />
                  <Skeleton className="h-10 w-28 rounded-lg" />
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-6 pb-6 pt-0">
            {/* Table rows */}
            {Array.from({ length: 8 }).map((_, i) => (
              <SkeletonTableRow key={i} columns={7} />
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

/** Skeleton for the Delivery Dashboard page */
export function DeliveryDashboardSkeleton() {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Page Header */}
      <div>
        <Skeleton className="h-8 w-48 mb-2" />
        <Skeleton className="h-4 w-72" />
      </div>

      {/* 4 Stat Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>

      {/* Tabs card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <Skeleton className="h-6 w-28 mb-2" />
              <Skeleton className="h-4 w-64" />
            </div>
            <Skeleton className="h-10 w-[180px] rounded-md" />
          </div>
        </CardHeader>
        <CardContent>
          {/* Tab bar */}
          <div className="grid w-full grid-cols-3 gap-1 bg-muted p-1 rounded-lg mb-4">
            <Skeleton className="h-9 rounded-md" />
            <Skeleton className="h-9 rounded-md" />
            <Skeleton className="h-9 rounded-md" />
          </div>

          {/* Table rows */}
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonTableRow key={i} columns={6} />
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

/** Lightweight skeleton for auth loading on the main page */
export function AuthLoadingSkeleton() {
  return (
    <div className="min-h-screen bg-background p-6 animate-in fade-in duration-300">
      <div className="max-w-7xl mx-auto space-y-8 pt-16">
        {/* Header area */}
        <div>
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-64" />
        </div>
        {/* 3 card placeholders */}
        <div className="grid gap-5 md:grid-cols-3">
          <DashboardKpiCard />
          <DashboardKpiCard />
          <DashboardKpiCard />
        </div>
        {/* Table placeholder */}
        <Card className="rounded-2xl border border-[#E5E7EB] dark:border-border shadow-sm">
          <CardHeader className="px-6 pt-6 pb-4">
            <Skeleton className="h-5 w-44 mb-1.5" />
            <Skeleton className="h-3 w-56" />
          </CardHeader>
          <CardContent className="px-6 pb-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonTableRow key={i} columns={4} />
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
