import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Sparkles, Plus, Trash2 } from "lucide-react";
import ImageUploader from "../shared/ImageUploader";
import AIDescriptionGenerator from "./AIDescriptionGenerator";
import { useDialog } from "@/components/ui/alert-dialog-custom";

export default function ProductForm({ product, categories, onSave, onCancel }) {
  const { warning } = useDialog();
  const [showAIGenerator, setShowAIGenerator] = useState(false);
  const [hostels, setHostels] = useState([]);
  const [isLoadingHostels, setIsLoadingHostels] = useState(true);

  // Load hostels from Base44
  useEffect(() => {
    const loadHostels = async () => {
      try {
        // Default hostels
        const defaultHostels = ["Mithali", "Gavaskar", "Virat", "Tendulkar"];
        
        try {
          // Fetch additional hostels from Base44
          const hostelData = await base44.entities.Hostel.list();
          const additionalHostels = hostelData
            .filter(h => h.is_active !== false)
            .filter(h => !defaultHostels.includes(h.name))
            .map(h => h.name);
          
          // Merge default with additional hostels, always include "Other" at the end
          const allHostels = [...defaultHostels, ...additionalHostels, "Other"];
          setHostels(allHostels);
        } catch (error) {
          console.error("Error loading hostels:", error);
          // Fallback to default hostels
          setHostels([...defaultHostels, "Other"]);
        }
      } finally {
        setIsLoadingHostels(false);
      }
    };

    loadHostels();
  }, []);

  // Initialize hostel_stock with all hostels
  const initializeHostelStock = () => {
    const stock = product?.hostel_stock || {};
    const initialStock = {};
    
    // Ensure all hostels have a stock value
    hostels.forEach(hostel => {
      initialStock[hostel] = stock[hostel] || 0;
    });
    
    return initialStock;
  };
  // Convert 12-hour format to 24-hour for input, and vice versa
  const convert12to24 = (time12) => {
    if (!time12) return "";
    const match = time12.match(/(\d+):(\d+)\s*(AM|PM)/i);
    if (!match) return "";
    
    let hours = parseInt(match[1], 10);
    const minutes = match[2];
    const period = match[3].toUpperCase();
    
    if (period === 'PM' && hours !== 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;
    
    return `${hours.toString().padStart(2, '0')}:${minutes}`;
  };

  const convert24to12 = (time24) => {
    if (!time24) return "";
    const [hours24, minutes] = time24.split(':');
    let hours = parseInt(hours24, 10);
    const period = hours >= 12 ? 'PM' : 'AM';
    
    if (hours > 12) hours -= 12;
    if (hours === 0) hours = 12;
    
    return `${hours.toString().padStart(2, '0')}:${minutes} ${period}`;
  };

  const calcAutoPrice = (cost) => {
    const c = parseFloat(cost);
    if (!c || c <= 0) return "";
    let selling;
    if (c <= 20) selling = c + 5;
    else if (c <= 40) selling = c + 7;
    else if (c <= 80) selling = c + 10;
    else if (c <= 150) selling = c + 12;
    else selling = c + 15;
    // Round to nearest 5
    return Math.ceil(selling / 5) * 5;
  };

  const [formData, setFormData] = useState({
    name: product?.name || "",
    description: product?.description || "",
    price: product?.price || "",
    original_price: product?.original_price || "",
    category_id: product?.category_id || "",
    image_url: product?.image_url || "",
    stock_quantity: product?.stock_quantity || 0,
    hostel_stock: {},
    dhaba_options: product?.dhaba_options || [],
    source_dhaba: product?.source_dhaba || "",
    unit: product?.unit || "piece",
    is_available: product?.is_available ?? true,
    delivery_charge: product?.delivery_charge || 0,
    profit_margin: product?.profit_margin || 0,
    delivery_time: product?.delivery_time || "13 mins",
    available_from: convert12to24(product?.available_from || ""),
    available_to: convert12to24(product?.available_to || "")
  });

  // Update hostel_stock when hostels are loaded
  // Update hostel_stock when hostels are loaded
  useEffect(() => {
    if (!isLoadingHostels && hostels.length > 0) {
      setFormData(prev => ({
        ...prev,
        hostel_stock: initializeHostelStock()
      }));
    }
  }, [isLoadingHostels, hostels]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validation
    if (!formData.name || !formData.name.trim()) {
      await warning('Product name is required', 'Validation Error');
      return;
    }
    
    if (!formData.category_id) {
      await warning('Please select a category', 'Validation Error');
      return;
    }
    
    if (!formData.price || parseFloat(formData.price) <= 0) {
      await warning('Please enter a valid price', 'Validation Error');
      return;
    }
    
    const totalStock = parseInt(formData.stock_quantity);

    // Build hostel_stock dynamically from all hostels
    const hostelStockData = {};
    hostels.forEach(hostel => {
      hostelStockData[hostel] = formData.hostel_stock[hostel] !== "" ? parseInt(formData.hostel_stock[hostel]) : 0;
    });

    const productData = {
      ...formData,
      price: parseFloat(formData.price),
      original_price: formData.original_price ? parseFloat(formData.original_price) : null,
      stock_quantity: totalStock,
      hostel_stock: hostelStockData,
      dhaba_options: formData.dhaba_options.map(opt => ({
        dhaba_name: opt.dhaba_name,
        price: parseFloat(opt.price)
      })),
      source_dhaba: formData.source_dhaba || null,
      delivery_charge: parseFloat(formData.delivery_charge) || 0,
      profit_margin: parseFloat(formData.profit_margin) || 0,
      delivery_time: formData.delivery_time,
      available_from: convert24to12(formData.available_from) || "",
      available_to: convert24to12(formData.available_to) || ""
    };
    
    onSave(productData);
  };

  const handleHostelStockChange = (hostel, value) => {
    setFormData(prev => ({
      ...prev,
      hostel_stock: {
        ...prev.hostel_stock,
        [hostel]: value
      }
    }));
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div>
            <Label htmlFor="name">Product Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => handleInputChange("name", e.target.value)}
              required
            />
          </div>

          <div>
            <Label htmlFor="category">Category</Label>
            <Select value={formData.category_id} onValueChange={(value) => handleInputChange("category_id", value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent className="max-h-60 overflow-y-auto">
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                    {!category.is_active && <span className="ml-2 text-xs text-red-500">(Inactive)</span>}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="price">Price (₹)</Label>
              <Input
                id="price"
                type="number"
                step="0.01"
                value={formData.price}
                onChange={(e) => handleInputChange("price", e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="original_price">Cost Price (₹)</Label>
              <Input
                id="original_price"
                type="number"
                step="0.01"
                value={formData.original_price}
                onChange={(e) => {
                  const cost = e.target.value;
                  handleInputChange("original_price", cost);
                  const auto = calcAutoPrice(cost);
                  if (auto) handleInputChange("price", auto);
                }}
              />
              {formData.original_price && (
                <p className="text-xs text-emerald-600 mt-1">Auto price: ₹{calcAutoPrice(formData.original_price)} (override below)</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="stock">Total Stock Quantity</Label>
              <Input
                id="stock"
                type="number"
                value={formData.stock_quantity}
                onChange={(e) => handleInputChange("stock_quantity", e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="unit">Unit</Label>
              <Select value={formData.unit} onValueChange={(value) => handleInputChange("unit", value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="piece">Piece</SelectItem>
                  <SelectItem value="kg">Kilogram</SelectItem>
                  <SelectItem value="gram">Gram</SelectItem>
                  <SelectItem value="liter">Liter</SelectItem>
                  <SelectItem value="ml">Milliliter</SelectItem>
                  <SelectItem value="packet">Packet</SelectItem>
                  <SelectItem value="box">Box</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="mb-3 block">Hostel-wise Stock</Label>
            {isLoadingHostels ? (
              <div className="text-sm text-gray-500">Loading hostels...</div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                {hostels.map((hostel) => (
                  <div key={hostel}>
                    <Label htmlFor={hostel.toLowerCase()} className="text-sm">{hostel} {hostel !== "Other" && "Hostel"}</Label>
                    <Input
                      id={hostel.toLowerCase()}
                      type="number"
                      value={formData.hostel_stock[hostel] || 0}
                      onChange={(e) => handleHostelStockChange(hostel, e.target.value)}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="delivery_charge">Delivery Charge (₹)</Label>
              <Input
                id="delivery_charge"
                type="number"
                step="0.01"
                value={formData.delivery_charge}
                onChange={(e) => handleInputChange("delivery_charge", e.target.value)}
              />
              <p className="text-xs text-gray-500 mt-1">0 for free delivery</p>
            </div>
            <div>
              <Label htmlFor="profit_margin">Profit Margin (%)</Label>
              <Input
                id="profit_margin"
                type="number"
                step="0.01"
                value={formData.profit_margin}
                onChange={(e) => handleInputChange("profit_margin", e.target.value)}
              />
              <p className="text-xs text-gray-500 mt-1">For recommendations</p>
            </div>
          </div>

          <div>
            <Label htmlFor="delivery_time">Delivery Time</Label>
            <Input
              id="delivery_time"
              value={formData.delivery_time}
              onChange={(e) => handleInputChange("delivery_time", e.target.value)}
              placeholder="e.g., 13 mins, 20 mins"
            />
            <p className="text-xs text-gray-500 mt-1">Estimated delivery time shown to customers</p>
          </div>

          <div>
            <Label className="mb-3 block">Availability Timing (Optional)</Label>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="available_from" className="text-sm">From (12-hour)</Label>
                <Input
                  id="available_from"
                  type="time"
                  value={formData.available_from}
                  onChange={(e) => handleInputChange("available_from", e.target.value)}
                  placeholder="08:00"
                />
                {formData.available_from && (
                  <p className="text-xs text-emerald-600 mt-1">
                    Saves as: {convert24to12(formData.available_from)}
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor="available_to" className="text-sm">To (12-hour)</Label>
                <Input
                  id="available_to"
                  type="time"
                  value={formData.available_to}
                  onChange={(e) => handleInputChange("available_to", e.target.value)}
                  placeholder="22:00"
                />
                {formData.available_to && (
                  <p className="text-xs text-emerald-600 mt-1">
                    Saves as: {convert24to12(formData.available_to)}
                  </p>
                )}
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-1">Leave empty for 24/7 availability. Will be saved in 12-hour format (AM/PM)</p>
          </div>

          <div>
            <Label htmlFor="source_dhaba">Source Dhaba (Admin/Delivery Only)</Label>
            <Input
              id="source_dhaba"
              value={formData.source_dhaba}
              onChange={(e) => handleInputChange("source_dhaba", e.target.value)}
              placeholder="e.g., Dhaba 1, Main Canteen"
            />
            <p className="text-xs text-gray-500 mt-1">
              This indicates which dhaba this product is sourced from (only visible to admin and delivery)
            </p>
          </div>

          <div>
            <Label className="mb-3 block">Dhaba Options (Optional)</Label>
            <div className="space-y-3">
              {formData.dhaba_options.map((option, index) => (
                <div key={index} className="flex gap-2 items-end">
                  <div className="flex-1">
                    <Label htmlFor={`dhaba_${index}`} className="text-sm">Dhaba Name</Label>
                    <Input
                      id={`dhaba_${index}`}
                      value={option.dhaba_name}
                      onChange={(e) => {
                        const newOptions = [...formData.dhaba_options];
                        newOptions[index].dhaba_name = e.target.value;
                        setFormData({ ...formData, dhaba_options: newOptions });
                      }}
                      placeholder="e.g., Dhaba 1, Canteen A"
                    />
                  </div>
                  <div className="w-32">
                    <Label htmlFor={`price_${index}`} className="text-sm">Price (₹)</Label>
                    <Input
                      id={`price_${index}`}
                      type="number"
                      step="0.01"
                      value={option.price}
                      onChange={(e) => {
                        const newOptions = [...formData.dhaba_options];
                        newOptions[index].price = e.target.value;
                        setFormData({ ...formData, dhaba_options: newOptions });
                      }}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      const newOptions = formData.dhaba_options.filter((_, i) => i !== index);
                      setFormData({ ...formData, dhaba_options: newOptions });
                    }}
                    className="text-red-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setFormData({
                    ...formData,
                    dhaba_options: [...formData.dhaba_options, { dhaba_name: "", price: "" }]
                  });
                }}
              >
                <Plus className="w-3 h-3 mr-1" />
                Add Dhaba Option
              </Button>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Add different dhaba options with varying prices for this product
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="available"
              checked={formData.is_available}
              onCheckedChange={(checked) => handleInputChange("is_available", checked)}
            />
            <Label htmlFor="available">Available for sale</Label>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label htmlFor="description">Description</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowAIGenerator(!showAIGenerator)}
                className="text-purple-600 border-purple-300"
              >
                <Sparkles className="w-3 h-3 mr-1" />
                {showAIGenerator ? "Hide" : "AI Generator"}
              </Button>
            </div>
            {showAIGenerator && (
              <div className="mb-4 p-4 bg-purple-50 border border-purple-200 rounded-lg">
                <AIDescriptionGenerator
                  productName={formData.name}
                  onSelectDescription={(desc) => {
                    setFormData({ ...formData, description: desc });
                    setShowAIGenerator(false);
                  }}
                />
              </div>
            )}
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleInputChange("description", e.target.value)}
              rows={4}
            />
          </div>

          <ImageUploader
            currentImage={formData.image_url}
            onImageSelect={(url) => handleInputChange("image_url", url)}
            placeholder="https://images.unsplash.com/photo-1542838132-92c53300491e?w=300"
          />
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-6 border-t">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700">
          {product ? "Update Product" : "Create Product"}
        </Button>
      </div>
    </form>
  );
}