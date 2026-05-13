/**
 * Enhanced Skeleton Loaders for CollegeCart
 * 
 * Provides realistic loading skeletons that match actual content layout
 * Better UX than generic spinners - prevents layout shift
 */

import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';

/**
 * Product Card Skeleton
 * Matches the ProductCard component layout
 */
export function ProductCardSkeleton() {
  return (
    <Card className="overflow-hidden border-0 bg-white rounded-2xl h-full flex flex-col">
      <Skeleton className="w-full h-48 rounded-t-2xl" />
      <CardContent className="p-4 space-y-3 flex-1">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-20" />
          <Skeleton className="h-4 w-12" />
        </div>
        <Skeleton className="h-10 w-full rounded-xl" />
      </CardContent>
    </Card>
  );
}

/**
 * Category Section Skeleton
 * Matches the CategorySection component layout
 */
export function CategorySectionSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-6 w-20" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {Array(5).fill(0).map((_, i) => (
          <ProductCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

/**
 * Shop Page Skeleton
 * Full page loading skeleton for Shop page
 */
export function ShopPageSkeleton() {
  return (
    <div className="min-h-screen">
      <div className="max-w-7xl mx-auto space-y-8 pb-tab-bar">
        {/* Hero Skeleton */}
        <Skeleton className="h-48 w-full rounded-2xl" />
        
        {/* Banner Skeleton */}
        <Skeleton className="h-32 w-full rounded-2xl" />
        
        {/* Search Bar Skeleton */}
        <div className="flex gap-4">
          <Skeleton className="h-12 flex-1 rounded-xl" />
          <Skeleton className="h-12 w-32 rounded-xl" />
        </div>
        
        {/* Category Filter Skeleton */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {Array(6).fill(0).map((_, i) => (
            <Skeleton key={i} className="h-10 w-24 rounded-full flex-shrink-0" />
          ))}
        </div>
        
        {/* Category Sections Skeleton */}
        <div className="space-y-12">
          {Array(3).fill(0).map((_, i) => (
            <CategorySectionSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Cart Item Skeleton
 * Matches cart item layout
 */
export function CartItemSkeleton() {
  return (
    <Card className="p-4">
      <div className="flex gap-4">
        <Skeleton className="w-20 h-20 rounded-lg flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <div className="flex items-center justify-between">
            <Skeleton className="h-6 w-20" />
            <Skeleton className="h-8 w-24 rounded-lg" />
          </div>
        </div>
      </div>
    </Card>
  );
}

/**
 * Cart Page Skeleton
 * Full page loading skeleton for Cart page
 */
export function CartPageSkeleton() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Skeleton className="h-10 w-48" />
      
      <div className="space-y-4">
        {Array(3).fill(0).map((_, i) => (
          <CartItemSkeleton key={i} />
        ))}
      </div>
      
      <Card className="p-6 space-y-4">
        <Skeleton className="h-6 w-32" />
        <div className="space-y-2">
          <div className="flex justify-between">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-16" />
          </div>
          <div className="flex justify-between">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-16" />
          </div>
          <div className="flex justify-between">
            <Skeleton className="h-6 w-24" />
            <Skeleton className="h-6 w-20" />
          </div>
        </div>
        <Skeleton className="h-12 w-full rounded-xl" />
      </Card>
    </div>
  );
}

/**
 * Order Card Skeleton
 * Matches order card layout
 */
export function OrderCardSkeleton() {
  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-8 w-28 rounded-lg" />
      </div>
    </Card>
  );
}

/**
 * Orders Page Skeleton
 * Full page loading skeleton for Orders page
 */
export function OrdersPageSkeleton() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Skeleton className="h-10 w-48" />
      
      <div className="flex gap-2">
        {Array(4).fill(0).map((_, i) => (
          <Skeleton key={i} className="h-10 w-24 rounded-full" />
        ))}
      </div>
      
      <div className="space-y-4">
        {Array(5).fill(0).map((_, i) => (
          <OrderCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

/**
 * Profile Section Skeleton
 * Matches profile section layout
 */
export function ProfileSectionSkeleton() {
  return (
    <Card className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Skeleton className="w-20 h-20 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
      </div>
      
      <div className="space-y-4">
        {Array(4).fill(0).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-10 w-full rounded-lg" />
          </div>
        ))}
      </div>
      
      <Skeleton className="h-12 w-full rounded-xl" />
    </Card>
  );
}

/**
 * Generic List Skeleton
 * Reusable skeleton for lists
 */
export function ListSkeleton({ count = 5, itemHeight = 16 }) {
  return (
    <div className="space-y-3">
      {Array(count).fill(0).map((_, i) => (
        <Skeleton key={i} className={`h-${itemHeight} w-full`} />
      ))}
    </div>
  );
}

/**
 * Generic Grid Skeleton
 * Reusable skeleton for grids
 */
export function GridSkeleton({ count = 8, columns = 4 }) {
  return (
    <div className={`grid grid-cols-2 md:grid-cols-${columns} gap-4`}>
      {Array(count).fill(0).map((_, i) => (
        <Skeleton key={i} className="h-48 w-full rounded-2xl" />
      ))}
    </div>
  );
}
