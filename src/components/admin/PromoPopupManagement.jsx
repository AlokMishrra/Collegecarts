import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, Edit, Trash2, Eye, EyeOff, Calendar, Smartphone, ExternalLink } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import ImageUploader from "../shared/ImageUploader";
import ConfirmDialog from "../shared/ConfirmDialog";

export default function PromoPopupManagement() {
  const [popups, setPopups] = useState([]);
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [previewId, setPreviewId] = useState(null);
  const [formData, setFormData] = useState({
    badge_text: "LIMITED TIME ONLY",
    title_small: "FREE DELIVERIES WITH",
    title_highlight: "One",
    title: "At just ₹49 for 3+3 months",
    subtitle: "on both Shop & Meals.",
    image_url: "",
    cta_text: "Claim Now",
    cta_link_type: "internal",
    cta_link_target: "",
    background_color: "#FFFBF5",
    is_active: true,
    once_per_session: true,
    start_date: "",
    end_date: "",
    display_order: 0,
  });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [popupsData, cats, prods] = await Promise.all([
        base44.entities.PromoPopup.list("display_order").catch(() => []),
        base44.entities.Category.list().catch(() => []),
        base44.entities.Product.list().catch(() => []),
      ]);
      setPopups(popupsData || []);
      setCategories(cats || []);
      setProducts(prods || []);
    } catch (e) {
      console.error("[PromoPopup] load failed", e);
    }
    setIsLoading(false);
  };

  const resetForm = () => ({
    badge_text: "LIMITED TIME ONLY",
    title_small: "FREE DELIVERIES WITH",
    title_highlight: "One",
    title: "At just ₹49 for 3+3 months",
    subtitle: "on both Shop & Meals.",
    image_url: "",
    cta_text: "Claim Now",
    cta_link_type: "internal",
    cta_link_target: "",
    background_color: "#FFFBF5",
    is_active: true,
    once_per_session: true,
    start_date: "",
    end_date: "",
    display_order: 0,
  });

  const handleAdd = () => {
    setEditing(null);
    setFormData(resetForm());
    setShowDialog(true);
  };

  const handleEdit = (p) => {
    setEditing(p);
    setFormData({
      badge_text: p.badge_text || "LIMITED TIME ONLY",
      title_small: p.title_small || "FREE DELIVERIES WITH",
      title_highlight: p.title_highlight || "One",
      title: p.title || "",
      subtitle: p.subtitle || "",
      image_url: p.image_url || "",
      cta_text: p.cta_text || "Claim Now",
      cta_link_type: p.cta_link_type || "internal",
      cta_link_target: p.cta_link_target || "",
      background_color: p.background_color || "#FFFBF5",
      is_active: p.is_active !== false,
      once_per_session: p.once_per_session !== false,
      start_date: p.start_date ? new Date(p.start_date).toISOString().slice(0, 16) : "",
      end_date: p.end_date ? new Date(p.end_date).toISOString().slice(0, 16) : "",
      display_order: p.display_order || 0,
    });
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!formData.title) {
      alert("Title is required");
      return;
    }
    const payload = {
      badge_text: formData.badge_text || null,
      title_small: formData.title_small || null,
      title_highlight: formData.title_highlight || null,
      title: formData.title,
      subtitle: formData.subtitle || null,
      image_url: formData.image_url || null,
      cta_text: formData.cta_text || "Claim Now",
      cta_link_type: formData.cta_link_type,
      cta_link_target: formData.cta_link_target || null,
      background_color: formData.background_color,
      is_active: formData.is_active,
      once_per_session: formData.once_per_session,
      display_order: Number(formData.display_order) || 0,
      start_date: formData.start_date ? new Date(formData.start_date).toISOString() : null,
      end_date: formData.end_date ? new Date(formData.end_date).toISOString() : null,
    };
    try {
      if (editing) await base44.entities.PromoPopup.update(editing.id, payload);
      else await base44.entities.PromoPopup.create(payload);
      setShowDialog(false);
      loadData();
    } catch (e) {
      // table missing?
      if (String(e.message || "").includes("Could not find") || e.code === "PGRST204" || String(e.message).includes("promo_popups")) {
        alert("Table promo_popups does not exist yet. Run the SQL in supabase/migrations/20260515000001_promo_popups.sql in Supabase SQL Editor, then try again.");
      } else {
        console.error(e);
        alert("Save failed: " + (e.message || "unknown"));
      }
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      await base44.entities.PromoPopup.delete(deleteConfirm.id);
      setDeleteConfirm(null);
      loadData();
    } catch (e) {
      console.error("[PromoPopup] delete failed", e);
      alert("Delete failed: " + (e.message || "Unknown error. Check RLS policies — run the promo_popups migration if table was just created."));
    }
  };

  const toggleActive = async (p) => {
    try {
      await base44.entities.PromoPopup.update(p.id, { is_active: !p.is_active });
      loadData();
    } catch (e) { console.error(e); }
  };

  const isScheduled = (p) => p.start_date && new Date(p.start_date) > new Date();
  const isExpired = (p) => p.end_date && new Date(p.end_date) < new Date();
  const isLive = (p) => {
    if (!p.is_active) return false;
    const now = new Date();
    if (p.start_date && new Date(p.start_date) > now) return false;
    if (p.end_date && new Date(p.end_date) < now) return false;
    return true;
  };

  // Inline preview card (exact popup mini)
  const PreviewCard = ({ p, small }) => (
    <div
      className={`relative rounded-[24px] overflow-hidden shadow-lg border text-center ${small ? "w-[280px] mx-auto" : "w-full max-w-[320px] mx-auto"}`}
      style={{ background: p.background_color || "#FFFBF5" }}
    >
      <div className="flex justify-center">
        <div className="inline-flex items-center gap-1 bg-[#0c831f] text-white text-[10px] font-extrabold tracking-widest px-4 py-1.5 rounded-b-[12px]">
          {p.badge_text || "LIMITED TIME ONLY"}
        </div>
      </div>
      <div className="px-5 pt-3 pb-5">
        <p className="text-[11px] font-extrabold tracking-widest">
          <span className="text-[#0c831f]">{p.title_small}</span>{" "}
          <span className="text-[#0c831f]">{p.title_highlight}</span>
        </p>
        <p className="mt-2 text-[16px] font-extrabold leading-tight text-[#111827] whitespace-pre-wrap">{p.title}</p>
        {p.subtitle && <p className="text-[13px] font-semibold text-[#374151]">{p.subtitle}</p>}
        <div className="mt-3 h-[120px] flex items-center justify-center">
          {p.image_url ? (
            <img src={p.image_url} alt={p.title} className="h-[110px] object-contain" />
          ) : (
            <span className="text-6xl">🛵</span>
          )}
        </div>
        <div className="mt-3 h-9 rounded-full bg-[#0c831f] text-white text-sm font-bold flex items-center justify-center">
          {p.cta_text || "Claim Now"}
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Smartphone className="w-6 h-6 text-[#0c831f]" /> Promo Popup
          </h2>
          <p className="text-gray-600 text-sm mt-1">Mobile-only popup — CollegeCart theme (green #0c831f, cream #FFFBF5). Like Swiggy One screenshot.</p>
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1 mt-2 inline-block">
            Shows only on mobile (&lt;768px). Set “Once per session” to avoid annoying users.
          </p>
        </div>
        <Button onClick={handleAdd} className="bg-[#0c831f] hover:bg-[#0a6d1a]">
          <Plus className="w-4 h-4 mr-2" /> Add Popup
        </Button>
      </div>

      {/* List */}
      <div className="grid gap-4">
        {popups.map((p) => (
          <Card key={p.id} className={isLive(p) ? "ring-1 ring-[#0c831f]/20" : ""}>
            <CardContent className="p-5">
              <div className="flex flex-col md:flex-row gap-5">
                <div className="flex-shrink-0">
                  <PreviewCard p={p} small />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-bold text-gray-900 line-clamp-2">{p.title}</h3>
                      <p className="text-xs text-gray-500 mt-1">{p.title_small} <span className="text-[#0c831f] font-bold">{p.title_highlight}</span> • {p.subtitle}</p>
                      <p className="text-xs text-gray-500 mt-1">Badge: {p.badge_text} • CTA: {p.cta_text} → {p.cta_link_type}:{p.cta_link_target || "(shop)"}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {isLive(p) ? (
                        <Badge className="bg-green-100 text-green-800"><Eye className="w-3 h-3 mr-1" />Live</Badge>
                      ) : isScheduled(p) ? (
                        <Badge className="bg-blue-100 text-blue-800"><Calendar className="w-3 h-3 mr-1" />Scheduled</Badge>
                      ) : isExpired(p) ? (
                        <Badge className="bg-gray-100 text-gray-800">Expired</Badge>
                      ) : (
                        <Badge className="bg-gray-100 text-gray-800"><EyeOff className="w-3 h-3 mr-1" />Inactive</Badge>
                      )}
                      <span className="text-xs text-gray-400">{p.view_count || 0} views • {p.click_count || 0} clicks</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 mt-4">
                    <Button size="sm" variant="outline" onClick={() => toggleActive(p)}>
                      {p.is_active ? <><EyeOff className="w-4 h-4 mr-1" />Deactivate</> : <><Eye className="w-4 h-4 mr-1" />Activate</>}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleEdit(p)}>
                      <Edit className="w-4 h-4 mr-1" />Edit
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setPreviewId(previewId === p.id ? null : p.id)}>
                      <Smartphone className="w-4 h-4 mr-1" />{previewId === p.id ? "Hide" : "Preview"}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setDeleteConfirm(p)} className="text-red-600 hover:text-red-700">
                      <Trash2 className="w-4 h-4 mr-1" />Delete
                    </Button>
                  </div>

                  {previewId === p.id && (
                    <div className="mt-4 p-4 bg-gray-50 rounded-xl border">
                      <p className="text-xs font-bold text-gray-500 mb-3">MOBILE PREVIEW (exact as user sees)</p>
                      <PreviewCard p={p} />
                      <p className="text-xs text-gray-400 mt-2 text-center">Cream #FFFBF5 • Green #0c831f • Only on &lt;768px</p>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {popups.length === 0 && !isLoading && (
          <Card>
            <CardContent className="p-10 text-center">
              <div className="w-14 h-14 mx-auto mb-3 bg-[#0c831f]/10 rounded-full flex items-center justify-center">
                <Smartphone className="w-7 h-7 text-[#0c831f]" />
              </div>
              <h3 className="font-semibold text-gray-900">No promo popups yet</h3>
              <p className="text-sm text-gray-500 mt-1">Create one to show the Swiggy One-style offer on mobile Shop.</p>
              <Button onClick={handleAdd} className="mt-4 bg-[#0c831f] hover:bg-[#0a6d1a]"><Plus className="w-4 h-4 mr-2" />Add Popup</Button>
              <p className="text-xs text-gray-400 mt-3">Requires table promo_popups — run supabase/migrations/20260515000001_promo_popups.sql if save fails.</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Promo Popup" : "Add Promo Popup"} — CollegeCart Theme</DialogTitle>
            <p className="text-xs text-gray-500">Replica of screenshot: LIMITED TIME ONLY badge • FREE DELIVERIES WITH One • price • scooter image • Renew Now CTA</p>
          </DialogHeader>

          <div className="space-y-4">
            {/* Live preview */}
            <div className="p-4 bg-gray-50 rounded-xl border">
              <p className="text-xs font-bold text-gray-500 mb-2">LIVE PREVIEW</p>
              <PreviewCard p={{
                badge_text: formData.badge_text,
                title_small: formData.title_small,
                title_highlight: formData.title_highlight,
                title: formData.title,
                subtitle: formData.subtitle,
                image_url: formData.image_url,
                cta_text: formData.cta_text,
                background_color: formData.background_color,
              }} />
            </div>

            <div>
              <Label>Badge Text *</Label>
              <Input value={formData.badge_text} onChange={(e) => setFormData({ ...formData, badge_text: e.target.value })} placeholder="LIMITED TIME ONLY" />
              <p className="text-xs text-gray-400">Green pill at top, like screenshot</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Small Title</Label>
                <Input value={formData.title_small} onChange={(e) => setFormData({ ...formData, title_small: e.target.value })} placeholder="FREE DELIVERIES WITH" />
              </div>
              <div>
                <Label>Highlight (green)</Label>
                <Input value={formData.title_highlight} onChange={(e) => setFormData({ ...formData, title_highlight: e.target.value })} placeholder="One" />
              </div>
            </div>

            <div>
              <Label>Main Title *</Label>
              <Textarea value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} placeholder="At just ₹49 for 3+3 months" rows={2} />
              <p className="text-xs text-gray-400">Bold black line, e.g. At just ₹30 for 3+3 months</p>
            </div>

            <div>
              <Label>Subtitle</Label>
              <Input value={formData.subtitle} onChange={(e) => setFormData({ ...formData, subtitle: e.target.value })} placeholder="on both Shop & Meals." />
            </div>

            <div>
              <Label>Center Image (scooter + green arrow)</Label>
              <ImageUploader
                currentImage={formData.image_url}
                onImageUploaded={(url) => setFormData({ ...formData, image_url: url })}
                aspectRatio="square"
              />
              <p className="text-xs text-gray-500 mt-1">Upload transparent PNG of delivery on scooter (like screenshot). Leave empty to use 🛵 fallback with green arrow backdrop.</p>
            </div>

            <div>
              <Label>CTA Button Text *</Label>
              <Input value={formData.cta_text} onChange={(e) => setFormData({ ...formData, cta_text: e.target.value })} placeholder="Renew Now / Claim Now" />
            </div>

            <div>
              <Label>CTA Link Type</Label>
              <Select value={formData.cta_link_type} onValueChange={(v) => setFormData({ ...formData, cta_link_type: v, cta_link_target: "" })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="internal">Internal Page</SelectItem>
                  <SelectItem value="category">Category</SelectItem>
                  <SelectItem value="product">Product</SelectItem>
                  <SelectItem value="external">External URL</SelectItem>
                  <SelectItem value="none">No action (just close)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.cta_link_type === "internal" && (
              <div>
                <Label>Page Name</Label>
                <Input value={formData.cta_link_target} onChange={(e) => setFormData({ ...formData, cta_link_target: e.target.value })} placeholder="Shop, Cart, Orders, Subscription" />
              </div>
            )}
            {formData.cta_link_type === "category" && (
              <div>
                <Label>Category</Label>
                <Select value={formData.cta_link_target} onValueChange={(v) => setFormData({ ...formData, cta_link_target: v })}>
                  <SelectTrigger><SelectValue placeholder="Choose category" /></SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            {formData.cta_link_type === "product" && (
              <div>
                <Label>Product</Label>
                <Select value={formData.cta_link_target} onValueChange={(v) => setFormData({ ...formData, cta_link_target: v })}>
                  <SelectTrigger><SelectValue placeholder="Choose product" /></SelectTrigger>
                  <SelectContent>
                    {products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            {formData.cta_link_type === "external" && (
              <div>
                <Label>External URL</Label>
                <Input value={formData.cta_link_target} onChange={(e) => setFormData({ ...formData, cta_link_target: e.target.value })} placeholder="https://..." />
              </div>
            )}

            <div>
              <Label>Background Color</Label>
              <Input type="color" value={formData.background_color} onChange={(e) => setFormData({ ...formData, background_color: e.target.value })} />
              <p className="text-xs text-gray-400">Cream #FFFBF5 like screenshot (or pick custom)</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Start Date (optional)</Label>
                <Input type="datetime-local" value={formData.start_date} onChange={(e) => setFormData({ ...formData, start_date: e.target.value })} />
              </div>
              <div>
                <Label>End Date (optional)</Label>
                <Input type="datetime-local" value={formData.end_date} onChange={(e) => setFormData({ ...formData, end_date: e.target.value })} />
              </div>
            </div>

            <div>
              <Label>Display Order</Label>
              <Input type="number" value={formData.display_order} onChange={(e) => setFormData({ ...formData, display_order: parseInt(e.target.value) || 0 })} />
            </div>

            <div className="flex items-center justify-between py-2 border-t">
              <div>
                <Label>Active</Label>
                <p className="text-xs text-gray-500">Show to users</p>
              </div>
              <Switch checked={formData.is_active} onCheckedChange={(v) => setFormData({ ...formData, is_active: v })} />
            </div>

            <div className="flex items-center justify-between py-2 border-t">
              <div>
                <Label>Once per session</Label>
                <p className="text-xs text-gray-500">Show only once until tab closed (recommended)</p>
              </div>
              <Switch checked={formData.once_per_session} onCheckedChange={(v) => setFormData({ ...formData, once_per_session: v })} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
            <Button onClick={handleSave} className="bg-[#0c831f] hover:bg-[#0a6d1a]" disabled={!formData.title}>
              {editing ? "Update" : "Create"} Popup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteConfirm}
        onOpenChange={(o) => { if (!o) setDeleteConfirm(null); }}
        onConfirm={handleDelete}
        onCancel={() => setDeleteConfirm(null)}
        title="Delete Popup"
        description={`Delete "${deleteConfirm?.title}"? This cannot be undone.`}
      />
    </div>
  );
}
