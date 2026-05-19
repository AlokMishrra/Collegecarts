import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3, TrendingUp, Users, Package, DollarSign } from 'lucide-react';

export default function Analytics() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Analytics Dashboard</h1>
        <p className="text-gray-500">Business insights and performance metrics</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-500">Total Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">1,234</div>
            <p className="text-xs text-green-600 flex items-center gap-1 mt-2">
              <TrendingUp className="h-3 w-3" />
              +18.2% from last month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-500">Active Users</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">856</div>
            <p className="text-xs text-green-600 flex items-center gap-1 mt-2">
              <TrendingUp className="h-3 w-3" />
              +8.5% from last month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-500">Products Sold</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">3,456</div>
            <p className="text-xs text-green-600 flex items-center gap-1 mt-2">
              <TrendingUp className="h-3 w-3" />
              +22.1% from last month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-500">Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">₹2.4L</div>
            <p className="text-xs text-green-600 flex items-center gap-1 mt-2">
              <TrendingUp className="h-3 w-3" />
              +15.3% from last month
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Top Performing Products</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                { name: 'Product A', sales: 234, revenue: 45000 },
                { name: 'Product B', sales: 189, revenue: 38000 },
                { name: 'Product C', sales: 156, revenue: 31000 },
                { name: 'Product D', sales: 134, revenue: 27000 },
                { name: 'Product E', sales: 112, revenue: 22000 },
              ].map((product, i) => (
                <div key={i} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center">
                      <Package className="h-5 w-5 text-purple-600" />
                    </div>
                    <div>
                      <p className="font-medium">{product.name}</p>
                      <p className="text-xs text-gray-500">{product.sales} units sold</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">₹{(product.revenue / 1000).toFixed(1)}K</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Department Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                { dept: 'Sales', performance: 92, color: 'bg-green-500' },
                { dept: 'Delivery', performance: 88, color: 'bg-blue-500' },
                { dept: 'Support', performance: 85, color: 'bg-yellow-500' },
                { dept: 'Operations', performance: 78, color: 'bg-purple-500' },
              ].map((item) => (
                <div key={item.dept} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{item.dept}</span>
                    <span className="text-sm font-semibold">{item.performance}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`${item.color} h-2 rounded-full transition-all`}
                      style={{ width: `${item.performance}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Monthly Trends</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center text-gray-400">
            <div className="text-center">
              <BarChart3 className="h-16 w-16 mx-auto mb-4" />
              <p>Chart visualization will be displayed here</p>
              <p className="text-sm">Integrate with a charting library like Recharts or Chart.js</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
