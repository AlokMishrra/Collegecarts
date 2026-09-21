import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, Edit, Trash2, Eye, EyeOff, Calendar, Link as LinkIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ImageUploader from "../shared/ImageUploader";
import ConfirmDialog from "../shared/ConfirmDialog";

export default function BannerManagement() {
  const [banners, setBanners] = useState([]);
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingBanner, setEditingBanner] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    image_url: "",
    link_type: "internal",
    link_target: "",
    background_color: "#c4b5fd",
    text_color: "#111827",
    cta_text: "SHOP NOW",
    start_date: "",
    end_date: "",
    is_active: true,
    display_order: 0
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [bannersData, categoriesData, productsData] = await Promise.all([
        base44.entities.Banner.list('display_order'),
        base44.entities.Category.list(),
        base44.entities.Product.list()
      ]);
      setBanners(bannersData);
      setCategories(categoriesData);
      setProducts(productsData);
    } catch (error) {
      console.error("Error loading data:", error);
    }
    setIsLoading(false);
  };

  const handleAdd = () => {
    setEditingBanner(null);
    setFormData({
      title: "",
      description: "",
      image_url: "",
      link_type: "internal",
      link_target: "",
      background_color: "#c4b5fd",
      text_color: "#111827",
      cta_text: "SHOP NOW",
      start_date: "",
      end_date: "",
      is_active: true,
      display_order: 0
    });
    setShowDialog(true);
  };

  const handleEdit = (banner) => {
    setEditingBanner(banner);
    setFormData({
      title: banner.title,
      description: banner.description || "",
      image_url: banner.image_url,
      link_type: banner.link_type || "internal",
      link_target: banner.link_target || "",
      background_color: banner.background_color || "#c4b5fd",
      text_color: banner.text_color || "#111827",
      cta_text: banner.cta_text || banner.cta || "SHOP NOW",
      start_date: banner.start_date ? new Date(banner.start_date).toISOString().slice(0, 16) : "",
      end_date: banner.end_date ? new Date(banner.end_date).toISOString().slice(0, 16) : "",
      is_active: banner.is_active !== false,
      display_order: banner.display_order || 0
    });
    setShowDialog(true);
  };

  const handleSave = async () => {
    // Map to real DB columns: description -> subtitle, link_target -> link_url
    // New promo columns (background_color, text_color, cta_text, link_type) may not exist yet
    const basePayload = {
      title: formData.title,
      subtitle: formData.description || null,
      image_url: formData.image_url,
      link_url: formData.link_target || null,
      is_active: formData.is_active,
      display_order: formData.display_order,
      start_date: formData.start_date ? new Date(formData.start_date).toISOString() : null,
      end_date: formData.end_date ? new Date(formData.end_date).toISOString() : null,
    };
    const fullPayload = {
      ...basePayload,
      description: formData.description || null,
      background_color: formData.background_color,
      text_color: formData.text_color,
      cta_text: formData.cta_text,
      link_type: formData.link_type,
      link_target: formData.link_target,
    };

    const save = async (payload) => {
      if (editingBanner) return base44.entities.Banner.update(editingBanner.id, payload);
      return base44.entities.Banner.create(payload);
    };

    try {
      await save(fullPayload);
      setShowDialog(false);
      loadData();
    } catch (error) {
      // PGRST204 = column not in schema cache — retry with only base columns that always exist
      const isMissingColumn = error?.code === 'PGRST204' || String(error?.message || '').includes('Could not find');
      if (isMissingColumn) {
        console.warn('Banner table missing promo columns, saving with fallback. Run the SQL migration to add them.', error.message);
        try {
          await save(basePayload);
          setShowDialog(false);
          loadData();
          // Show hint once per session
          if (!sessionStorage.getItem('cc-banner-migration-hint')) {
            sessionStorage.setItem('cc-banner-migration-hint', '1');
            alert('Banner saved (using fallback columns). To enable colors/CTA/link types, run the SQL in supabase/migrations/20260514000001_add_banner_promo_fields.sql in your Supabase SQL Editor.');
          }
          return;
        } catch (e2) {
          console.error("Error saving banner (fallback):", e2);
          alert('Save failed: ' + (e2.message || 'unknown error'));
        }
      } else {
        console.error("Error saving banner:", error);
        alert('Save failed: ' + (error.message || 'unknown error'));
      }
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      await base44.entities.Banner.delete(deleteConfirm.id);
      setDeleteConfirm(null);
      loadData();
    } catch (error) {
      console.error("Error deleting banner:", error);
    }
  };

  const toggleActive = async (banner) => {
    try {
      await base44.entities.Banner.update(banner.id, {
        is_active: !banner.is_active
      });
      loadData();
    } catch (error) {
      console.error("Error toggling banner:", error);
    }
  };

  const isScheduled = (banner) => {
    if (!banner.start_date) return false;
    const now = new Date();
    const start = new Date(banner.start_date);
    return start > now;
  };

  const isExpired = (banner) => {
    if (!banner.end_date) return false;
    const now = new Date();
    const end = new Date(banner.end_date);
    return end < now;
  };

  const isActive = (banner) => {
    if (!banner.is_active) return false;
    const now = new Date();
    if (banner.start_date && new Date(banner.start_date) > now) return false;
    if (banner.end_date && new Date(banner.end_date) < now) return false;
    return true;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Banner Management</h2>
          <p className="text-gray-600">Create and manage promotional banners</p>
        </div>
        <Button onClick={handleAdd} className="bg-emerald-600 hover:bg-emerald-700">
          <Plus className="w-4 h-4 mr-2" />
          Add Banner
        </Button>
      </div>

      <div className="grid gap-4">
        {banners.map((banner) => (
          <Card key={banner.id}>
            <CardContent className="p-6">
              <div className="flex gap-6">
                <div className="w-48 h-32 flex-shrink-0 rounded-lg overflow-hidden border">
                  <img
                    src={banner.image_url}
                    alt={banner.title}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="text-lg font-semibold">{banner.title}</h3>
                      {banner.description && (
                        <p className="text-sm text-gray-600 mt-1">{banner.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {isActive(banner) ? (
                        <Badge className="bg-green-100 text-green-800">
                          <Eye className="w-3 h-3 mr-1" />
                          Active
                        </Badge>
                      ) : isScheduled(banner) ? (
                        <Badge className="bg-blue-100 text-blue-800">
                          <Calendar className="w-3 h-3 mr-1" />
                          Scheduled
                        </Badge>
                      ) : isExpired(banner) ? (
                        <Badge className="bg-gray-100 text-gray-800">
                          Expired
                        </Badge>
                      ) : (
                        <Badge className="bg-gray-100 text-gray-800">
                          <EyeOff className="w-3 h-3 mr-1" />
                          Inactive
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                    <div>
                      <p className="text-gray-500">Link Type</p>
                      <p className="font-medium capitalize">{banner.link_type}</p>
                    </div>
                    {banner.start_date && (
                      <div>
                        <p className="text-gray-500">Start Date</p>
                        <p className="font-medium">
                          {new Date(banner.start_date).toLocaleString()}
                        </p>
                      </div>
                    )}
                    {banner.end_date && (
                      <div>
                        <p className="text-gray-500">End Date</p>
                        <p className="font-medium">
                          {new Date(banner.end_date).toLocaleString()}
                        </p>
                      </div>
                    )}
                    <div>
                      <p className="text-gray-500">Stats</p>
                      <p className="font-medium">
                        {banner.view_count || 0} views • {banner.click_count || 0} clicks
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => toggleActive(banner)}
                    >
                      {banner.is_active ? (
                        <>
                          <EyeOff className="w-4 h-4 mr-1" />
                          Deactivate
                        </>
                      ) : (
                        <>
                          <Eye className="w-4 h-4 mr-1" />
                          Activate
                        </>
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleEdit(banner)}
                    >
                      <Edit className="w-4 h-4 mr-1" />
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setDeleteConfirm(banner)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4 mr-1" />
                      Delete
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {banners.length === 0 && !isLoading && (
          <Card>
            <CardContent className="p-12 text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                <LinkIcon className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No banners yet</h3>
              <p className="text-gray-600 mb-4">Create your first promotional banner</p>
              <Button onClick={handleAdd} className="bg-emerald-600 hover:bg-emerald-700">
                <Plus className="w-4 h-4 mr-2" />
                Add Banner
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Banner Form Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingBanner ? "Edit Banner" : "Add New Banner"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Title *</Label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="e.g., Rich & Creamy Delight (use Enter for line break)"
              />
              <p className="text-xs text-gray-500 mt-1">Tip: press Enter to split into 2 lines like the reference</p>
            </div>

            <div>
              <Label>Offer Text</Label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="e.g., Up to 25% OFF"
              />
            </div>

            <div>
              <Label>Button Text</Label>
              <Input
                value={formData.cta_text}
                onChange={(e) => setFormData({ ...formData, cta_text: e.target.value })}
                placeholder="SHOP NOW"
              />
            </div>

            <div>
              <Label>Product Image (right side) *</Label>
              <ImageUploader
                currentImage={formData.image_url}
                onImageUploaded={(url) => setFormData({ ...formData, image_url: url })}
                aspectRatio="banner"
              />
              <p className="text-xs text-gray-500 mt-1">
                Recommended: transparent PNG of product, 600x600px
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Card Background</Label>
                <Input
                  type="color"
                  value={formData.background_color}
                  onChange={(e) => setFormData({ ...formData, background_color: e.target.value })}
                />
                <p className="text-xs text-gray-500 mt-1">Left side gradient base (purple like reference)</p>
              </div>
              <div>
                <Label>Text Color</Label>
                <Input
                  type="color"
                  value={formData.text_color}
                  onChange={(e) => setFormData({ ...formData, text_color: e.target.value })}
                />
              </div>
            </div>

            <div>
              <Label>Link Type</Label>
              <Select
                value={formData.link_type}
                onValueChange={(value) => setFormData({ ...formData, link_type: value, link_target: "" })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="internal">Internal Page</SelectItem>
                  <SelectItem value="category">Category</SelectItem>
                  <SelectItem value="product">Product</SelectItem>
                  <SelectItem value="external">External URL</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.link_type === "internal" && (
              <div>
                <Label>Page Name</Label>
                <Input
                  value={formData.link_target}
                  onChange={(e) => setFormData({ ...formData, link_target: e.target.value })}
                  placeholder="e.g., Shop, Cart, Orders"
                />
              </div>
            )}

            {formData.link_type === "category" && (
              <div>
                <Label>Select Category</Label>
                <Select
                  value={formData.link_target}
                  onValueChange={(value) => setFormData({ ...formData, link_target: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {formData.link_type === "product" && (
              <div>
                <Label>Select Product</Label>
                <Select
                  value={formData.link_target}
                  onValueChange={(value) => setFormData({ ...formData, link_target: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a product" />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map((prod) => (
                      <SelectItem key={prod.id} value={prod.id}>
                        {prod.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {formData.link_type === "external" && (
              <div>
                <Label>External URL</Label>
                <Input
                  value={formData.link_target}
                  onChange={(e) => setFormData({ ...formData, link_target: e.target.value })}
                  placeholder="https://example.com"
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Start Date (Optional)</Label>
                <Input
                  type="datetime-local"
                  value={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                />
              </div>
              <div>
                <Label>End Date (Optional)</Label>
                <Input
                  type="datetime-local"
                  value={formData.end_date}
                  onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                />
              </div>
            </div>

            <div>
              <Label>Display Order</Label>
              <Input
                type="number"
                value={formData.display_order}
                onChange={(e) => setFormData({ ...formData, display_order: parseInt(e.target.value) || 0 })}
              />
              <p className="text-xs text-gray-500 mt-1">
                Lower numbers appear first
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              className="bg-emerald-600 hover:bg-emerald-700"
              disabled={!formData.title || !formData.image_url}
            >
              {editingBanner ? "Update" : "Create"} Banner
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deleteConfirm}
        onOpenChange={(o) => { if (!o) setDeleteConfirm(null); }}
        onConfirm={handleDelete}
        onCancel={() => setDeleteConfirm(null)}
        title="Delete Banner"
        description={`Are you sure you want to delete "${deleteConfirm?.title}"? This action cannot be undone.`}
      />
    </div>
  );
}