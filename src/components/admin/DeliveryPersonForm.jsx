import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Phone } from "lucide-react";

export default function DeliveryPersonForm({ person, onSave, onCancel }) {
  const [hostels, setHostels] = useState([]);
  const [isLoadingHostels, setIsLoadingHostels] = useState(true);
  
  const [formData, setFormData] = useState({
    name: person?.name || "",
    email: person?.email || "",
    phone_number: person?.phone_number || "",
    password: person?.password || "",
    vehicle_type: person?.vehicle_type || "bike",
    assigned_hostel: person?.assigned_hostel || "All",
    is_available: person?.is_available ?? true
  });

  // Load hostels from Base44
  useEffect(() => {
    const loadHostels = async () => {
      try {
        const defaultHostels = ["Mithali", "Gavaskar", "Virat", "Tendulkar"];
        
        try {
          const hostelData = await base44.entities.Hostel.list();
          const additionalHostels = hostelData
            .filter(h => h.is_active !== false)
            .filter(h => !defaultHostels.includes(h.name))
            .map(h => h.name);
          
          // Include default hostels, additional hostels, "Other", and "All"
          const allHostels = [...defaultHostels, ...additionalHostels, "Other", "All"];
          setHostels(allHostels);
        } catch (error) {
          console.error("Error loading hostels:", error);
          // Fallback to default hostels
          setHostels([...defaultHostels, "Other", "All"]);
        }
      } finally {
        setIsLoadingHostels(false);
      }
    };

    loadHostels();
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    // Ensure email is null if empty, and password has a default if not provided
    const dataToSave = {
      ...formData,
      password: formData.password || 'default123', // Default password if not provided
      email: formData.email || null // Ensure email is null if empty
    };
    onSave(dataToSave);
  };

  const set = (field, value) => setFormData(prev => ({ ...prev, [field]: value }));

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Full Name</Label>
          <Input value={formData.name} onChange={e => set("name", e.target.value)} required />
        </div>
        <div>
          <Label>Email (optional)</Label>
          <Input type="email" value={formData.email} onChange={e => set("email", e.target.value)} placeholder="partner@email.com" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Phone Number <span className="text-red-500">*</span></Label>
          <div className="relative mt-1">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
              <Phone className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-500 border-r pr-2">+91</span>
            </div>
            <Input
              type="tel"
              value={formData.phone_number.replace(/^\+91/, '').replace(/\D/g, '')}
              onChange={e => set("phone_number", e.target.value.replace(/\D/g, '').slice(0, 10))}
              className="pl-20"
              placeholder="9876543210"
              maxLength={10}
              required
            />
          </div>
          <p className="text-xs text-gray-400 mt-1">Partner uses this number to login via OTP</p>
        </div>
        <div>
          <Label>Password <span className="text-red-500">*</span></Label>
          <Input 
            type="password" 
            value={formData.password} 
            onChange={e => set("password", e.target.value)} 
            placeholder="Enter password"
            autoComplete="new-password"
            required
            className="mt-1"
          />
          <p className="text-xs text-gray-400 mt-1">Password for delivery partner login</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Vehicle Type</Label>
          <Select value={formData.vehicle_type} onValueChange={v => set("vehicle_type", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="bike">Bike</SelectItem>
              <SelectItem value="scooter">Scooter</SelectItem>
              <SelectItem value="car">Car</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Assigned Hostel</Label>
          <Select value={formData.assigned_hostel} onValueChange={v => set("assigned_hostel", v)}>
            <SelectTrigger><SelectValue placeholder="Select hostel" /></SelectTrigger>
            <SelectContent>
              {isLoadingHostels ? (
                <SelectItem value="loading" disabled>Loading hostels...</SelectItem>
              ) : (
                hostels.map(h => (
                  <SelectItem key={h} value={h}>
                    {h === "All" ? "All Hostels (No restriction)" : h}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          <p className="text-xs text-gray-400 mt-1">Partner can only accept orders from this hostel</p>
        </div>
      </div>

      <div className="flex items-center space-x-2">
        <Switch checked={formData.is_available} onCheckedChange={v => set("is_available", v)} />
        <Label>Available for delivery</Label>
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700">
          {person ? "Update Person" : "Add Person"}
        </Button>
      </div>
    </form>
  );
}
