import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ── Crypto helpers (Meta data_api_version 3.0: RSA-OAEP SHA-256 + AES-GCM, IV XOR 0xFF) ──
function b64ToBytes(b64: string): Uint8Array { return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)); }
function bytesToB64(bytes: Uint8Array): string { let s=""; for(const b of bytes) s+=String.fromCharCode(b); return btoa(s); }
function derLen(n:number):number[]{ if(n<0x80) return [n]; if(n<0x100) return [0x81,n]; return [0x82,(n>>8)&0xff,n&0xff]; }
function concatBytes(...arrs: Uint8Array[]): Uint8Array { let tot=0; for(const a of arrs) tot+=a.length; const r=new Uint8Array(tot); let o=0; for(const a of arrs){r.set(a,o);o+=a.length} return r; }
function pkcs1ToPkcs8(pkcs1: Uint8Array): Uint8Array {
  const version=new Uint8Array([0x02,0x01,0x00]);
  const algId=new Uint8Array([0x30,0x0d,0x06,0x09,0x2a,0x86,0x48,0x86,0xf7,0x0d,0x01,0x01,0x01,0x05,0x00]);
  const octHdr=new Uint8Array([0x04,...derLen(pkcs1.length)]);
  const innerLen=version.length+algId.length+octHdr.length+pkcs1.length;
  const seqHdr=new Uint8Array([0x30,...derLen(innerLen)]);
  return concatBytes(seqHdr,version,algId,octHdr,pkcs1);
}
function parsePem(pem:string):Uint8Array{
  const norm=pem.replace(/\\n/g,"\n").replace(/\r/g,"");
  const b64=norm.replace(/-----BEGIN [A-Z ]+-----/,"").replace(/-----END [A-Z ]+-----/,"").replace(/\s/g,"");
  return b64ToBytes(b64);
}
async function importPrivateKey(pem:string):Promise<CryptoKey>{
  const der=parsePem(pem);
  let isPkcs8=false;
  for(let i=0;i<Math.min(der.length-9,32);i++) if(der[i]===0x2a&&der[i+1]===0x86&&der[i+2]===0x48&&der[i+3]===0x86&&der[i+4]===0xf7&&der[i+5]===0x0d&&der[i+6]===0x01&&der[i+7]===0x01&&der[i+8]===0x01){isPkcs8=true;break;}
  if(!isPkcs8&&der.length>7){ if(der[7]===0x30) isPkcs8=true; else if(der[7]===0x02) isPkcs8=false; else throw new Error("Unrecognized RSA key format"); }
  const pkcs8=isPkcs8?der:pkcs1ToPkcs8(der);
  return await crypto.subtle.importKey("pkcs8",pkcs8 as BufferSource,{name:"RSA-OAEP",hash:"SHA-256"},false,["decrypt"]);
}
async function decryptFlowRequest(priv:CryptoKey,body:any):Promise<{req:any;aesKey:CryptoKey;iv:Uint8Array}>{
  const encAes=b64ToBytes(body.encrypted_aes_key);
  const aesRaw=await crypto.subtle.decrypt({name:"RSA-OAEP"},priv,encAes as BufferSource) as ArrayBuffer;
  const aesKey=await crypto.subtle.importKey("raw",aesRaw,{name:"AES-GCM"},false,["decrypt","encrypt"]);
  const iv=b64ToBytes(body.initial_vector);
  const encData=b64ToBytes(body.encrypted_flow_data);
  const plainBuf=await crypto.subtle.decrypt({name:"AES-GCM",iv:iv as BufferSource},aesKey,encData as BufferSource);
  const req=JSON.parse(new TextDecoder().decode(plainBuf));
  return {req,aesKey,iv};
}
async function encryptFlowResponse(aesKey:CryptoKey,iv:Uint8Array,payload:any):Promise<string>{
  const plain=new TextEncoder().encode(JSON.stringify(payload));
  const invIv=new Uint8Array(iv.length); for(let i=0;i<iv.length;i++) invIv[i]=iv[i]^0xff;
  const cipher=await crypto.subtle.encrypt({name:"AES-GCM",iv:invIv as BufferSource},aesKey,plain as BufferSource) as ArrayBuffer;
  return bytesToB64(new Uint8Array(cipher));
}

// ── helpers ──
function normPhone(raw:unknown):string|null{
  if(typeof raw!=="string") return null;
  let d=raw.replace(/\D/g,"");
  if(d.length===12&&d.startsWith("91")) d=d.slice(2);
  else if(d.length===11&&d.startsWith("0")) d=d.slice(1);
  if(!/^[6-9]\d{9}$/.test(d)) return null;
  return d;
}
function isUuid(v:string){ return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v); }
function genOtp(){ const b=new Uint32Array(1); crypto.getRandomValues(b); return String(1000+(b[0]%9000)); }
const r2=(n:number)=>Math.round(n*100)/100;
async function lookupUid(sup:any, phone:string):Promise<string|null>{
  const vars=[phone,`91${phone}`,`+91${phone}`,`0${phone}`];
  const {data:a}=await sup.from("users").select("id").in("phone_number",vars).limit(1);
  if(a&&a.length>0) return a[0].id;
  const {data:b}=await sup.from("users").select("id").in("phone",vars).limit(1);
  if(b&&b.length>0) return b[0].id;
  return null;
}
async function calcPricing(sup:any, items:any[], pmap:Map<string,any>, uid:string|null){
  const subtotal=r2(items.reduce((s,i)=>s+i.price*i.quantity,0));
  const {data:sr}=await sup.from("settings").select("*").limit(1);
  const settings=sr&&sr.length>0?sr[0]:null;
  const {data:cr}=await sup.from("checkout_settings").select("*").limit(1);
  const co=cr&&cr.length>0?cr[0]:{small_cart_enabled:true,small_cart_threshold:40,small_cart_fee:10,handling_fee_enabled:true,handling_fee:10,free_delivery_handling_enabled:true,free_delivery_handling_fee:20};
  let isFirst=true;
  if(uid){ const {count}=await sup.from("orders").select("id",{count:"exact",head:true}).eq("user_id",uid); isFirst=(count??0)===0; }
  let isPrem=false;
  if(uid){ const {data:subs}=await sup.from("subscriptions").select("end_date").eq("user_id",uid).eq("status","active"); if(subs){ const now=new Date(); isPrem=subs.some((s:any)=>!s.end_date||new Date(s.end_date)>now); } }
  let del=0;
  if(settings&&!isPrem){
    const thr=isFirst?Number(settings.first_order_threshold):Number(settings.free_delivery_above);
    if(!(subtotal>=thr)){ const base=Number(settings.shipping_charge)||5; for(const it of items){ const p=pmap.get(it.product_id); const per=Number(p?.delivery_charge)||base; del+=per*it.quantity; } }
  }
  del=r2(del);
  const small=co.small_cart_enabled&&subtotal>0&&subtotal<Number(co.small_cart_threshold)?r2(Number(co.small_cart_fee)):0;
  let hand=co.handling_fee_enabled?r2(Number(co.handling_fee)):0;
  if(del===0&&co.free_delivery_handling_enabled) hand=r2(Number(co.free_delivery_handling_fee)||0);
  const total=Math.max(0,r2(subtotal+del+small+hand));
  return {subtotal, deliveryFee:del, smallCartFee:small, handlingFee:hand, totalAmount:total, isFirstOrder:isFirst, isPremiumUser:isPrem};
}
function fmtRs(n:number){ return `₹${n}`; }

// ── Flow session (in-memory, keyed by flow_token; no DB table) ──
type FlowSession = {
  hostelId?: string;
  hostelName?: string;
  categoryId?: string;
  categoryName?: string;
  cart?: Array<{product_id:string; product_name:string; price:number; quantity:number}>;
  cart_items?: Array<{product_id:string; quantity:number}>;
  cart_items_text?: string;
  cart_subtotal?: number;
  room_number?: string;
  phone_number?: string;
  selected_products?: string;
  _lastPricing?: any;
};
const flowSessions=new Map<string,FlowSession>();
function getSession(token:string):FlowSession{
  if(!flowSessions.has(token)) flowSessions.set(token,{});
  return flowSessions.get(token)!;
}
function parseSelectedProducts(raw:any):string[]{
  if(raw==null) return [];
  if(Array.isArray(raw)){
    return raw.map((x:any)=> typeof x==="string"?x.trim() : (x?.id ?? x?.product_id ?? x?.value ?? x?.key ?? "")).map((s:string)=>String(s).trim()).filter(Boolean);
  }
  if(typeof raw==="string"){
    const s=raw.trim();
    if(!s) return [];
    // Try JSON
    try{
      const j=JSON.parse(s);
      if(Array.isArray(j)) return parseSelectedProducts(j);
      if(typeof j==="object"&&j!==null){
        // e.g. {"0":"id1","1":"id2"}
        const vals=Object.values(j);
        if(vals.length>0 && vals.every(v=>typeof v==="string")) return vals.map(v=>String(v).trim()).filter(Boolean);
      }
    }catch{}
    if(s.includes(",")) return s.split(",").map(x=>x.trim()).filter(Boolean);
    if(s.includes(";")) return s.split(";").map(x=>x.trim()).filter(Boolean);
    return [s];
  }
  if(typeof raw==="object"){
    // object like { selected_products: [...] }
    if(raw.selected_products) return parseSelectedProducts(raw.selected_products);
    if(raw.products) return parseSelectedProducts(raw.products);
    if(raw.value) return parseSelectedProducts(raw.value);
  }
  return [];
}

// ── DB helpers ──
async function resolveHostel(sup:any, hostelRef:string){
  const q=isUuid(hostelRef.trim())? sup.from("hostels").select("id,name,is_active").eq("id",hostelRef.trim()).eq("is_active",true).maybeSingle() : sup.from("hostels").select("id,name,is_active").eq("name",hostelRef.trim()).eq("is_active",true).maybeSingle();
  const {data,error}=await q;
  if(error||!data) return null;
  return data;
}

// ── handlers (plain objects) ──
async function hInit(){ return {success:true,action:"INIT",message:"CollegeCart WhatsApp backend connected",version:"2.0.0"}; }
async function hHostelsDb(sup:any){
  const {data,error}=await sup.from("hostels").select("id, name, code, is_active, display_order").eq("is_active",true).order("display_order",{ascending:true,nullsFirst:false});
  if(error){ console.error("[wf] hostels",error.message); return null; }
  const hostels=[...(data||[])];
  if(!hostels.some((h:any)=>h.name==="Other")) hostels.push({id:"Other",name:"Other",code:"other",is_active:true,display_order:999});
  return hostels;
}
async function hCatsDb(sup:any){
  const {data,error}=await sup.from("categories").select("id, name, display_order").eq("is_active",true).order("display_order",{ascending:true,nullsFirst:false});
  if(error){ console.error("[wf] cats",error.message); return null; }
  return data??[];
}

// ── Flow action handlers (return {screen, data}) ──
async function flowGetHostels(sup:any){
  const hostels=await hHostelsDb(sup);
  if(!hostels) return {screen:"HOSTEL",data:{hostels:[], error:"Failed to fetch hostels"}};
  // Map to title for Meta Flow
  const mapped=hostels.map((h:any)=>({id:h.id, title:h.name}));
  return {screen:"HOSTEL",data:{hostels:mapped}};
}

async function flowGetCategories(sup:any, payload:any, session:FlowSession){
  const hostelRef = payload.hostel_id ?? payload.hostelId ?? (payload as any).hostel ?? payload.selected_hostel ?? payload.hostel_name ?? (payload as any).hostel_name;
  if(typeof hostelRef==="string" && hostelRef.trim()){
    const hostel=await resolveHostel(sup, hostelRef.trim());
    if(hostel){
      session.hostelId=hostel.id;
      session.hostelName=hostel.name;
    } else {
      // If hostelRef is already a name that matches active hostel, use directly
      session.hostelName=hostelRef.trim();
      // try to resolve id for later stock lookup
      const {data}=await sup.from("hostels").select("id").eq("name",hostelRef.trim()).maybeSingle();
      if(data) session.hostelId=data.id;
    }
  }
  const cats=await hCatsDb(sup);
  if(!cats) return {screen:"CATEGORY",data:{categories:[], selected_hostel: session.hostelName ?? ""}};
  const mapped=cats.map((c:any)=>({id:c.id, title:c.name}));
  return {screen:"CATEGORY",data:{categories:mapped, selected_hostel: session.hostelName ?? ""}};
}

async function flowGetProducts(sup:any, payload:any, session:FlowSession){
  const catIdRaw = payload.category_id ?? payload.categoryId ?? payload.selected_category ?? (payload as any).selectedCategory;
  const catId = typeof catIdRaw==="string"?catIdRaw.trim(): null;
  const hostelName = typeof payload.hostel_name==="string"?payload.hostel_name.trim(): typeof payload.selected_hostel==="string"?payload.selected_hostel.trim(): session.hostelName;
  const hostelId = typeof payload.hostel_id==="string"?payload.hostel_id.trim(): session.hostelId;
  // Update session with latest hostel/category
  if(hostelName) session.hostelName=hostelName;
  if(hostelId) session.hostelId=hostelId;
  // Resolve category name for display, but keep selected_category as ID per Flow spec
  let catName="";
  if(catId){
    const {data:cat}=await sup.from("categories").select("id, name").eq("id",catId).maybeSingle();
    if(cat){ catName=cat.name; session.categoryId=cat.id; session.categoryName=cat.name; }
    else { session.categoryId=catId; catName=catId; }
  }
  // Fetch products
  let products:any[]=[];
  if(catId){
    const {data:prods,error}=await sup.from("products").select("id, name, price, stock_quantity, is_available, display_order").eq("category_id",catId).eq("is_available",true).order("display_order",{ascending:true,nullsFirst:false});
    if(error){ console.error("[wf] prods filt",error.message); return {screen:"PRODUCTS",data:{products:[], selected_hostel: session.hostelName??"", selected_category: catName}}; }
    products=prods??[];
  } else {
    const {data:prods}=await sup.from("products").select("id, name, price, stock_quantity, is_available, display_order").eq("is_available",true).order("display_order",{ascending:true,nullsFirst:false}).limit(50);
    products=prods??[];
  }
  // Hostel stock override
  let hid=hostelId;
  if(!hid && hostelName && hostelName!=="Other"){
    const {data:r}=await sup.from("hostels").select("id").eq("name",hostelName).maybeSingle();
    if(r) hid=r.id;
  }
  let fps=products.map((p:any)=>({id:p.id,name:p.name,price:Number(p.price),stock_quantity:Number(p.stock_quantity??0),is_available:p.is_available}));
  if(hid && hid!=="Other" && fps.length>0){
    const pids=fps.map((p:any)=>p.id);
    const {data:hs}=await sup.from("hostel_stock").select("product_id, stock_quantity").in("product_id",pids).eq("hostel_id",hid);
    if(hs){ const m=new Map(hs.map((r:any)=>[r.product_id,r.stock_quantity??0])); for(const p of fps) p.stock_quantity=m.has(p.id)?(m.get(p.id)??0):0; }
  }
  const mapped=fps.map((p:any)=>({
    id:p.id,
    title: `${p.name} - ${fmtRs(p.price)}`,
    description: p.stock_quantity>0 ? "Available" : "Out of stock"
  }));
  return {screen:"PRODUCTS",data:{products:mapped, selected_hostel: session.hostelName??"", selected_category: catId ?? "", category_name: catName}};
}

async function flowBuildCart(sup:any, payload:any, session:FlowSession){
  // 1. FIX BUILD_CART INPUT PARSING — read payload.selected_products with data fallback, normalize all 4 formats
  // Note: payload already merges ...data, so payload.selected_products covers data.selected_products
  const dataForFallback = (payload as any)._data ?? payload;
  let selectedProducts: any =
    (payload as any).selected_products ??
    (dataForFallback as any).selected_products ??
    [];

  if (typeof selectedProducts === "string") {
    const raw = selectedProducts.trim();
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        selectedProducts = parsed;
      } else {
        selectedProducts = [parsed];
      }
    } catch {
      selectedProducts = raw
        .replace(/^\[|\]$/g, "")
        .split(",")
        .map((value: string) =>
          value.trim().replace(/^["']|["']$/g, "")
        )
        .filter(Boolean);
    }
  }

  if (!Array.isArray(selectedProducts)) {
    selectedProducts = [selectedProducts];
  }

  const productIds = (selectedProducts as any[])
    .map((item: any) => {
      if (typeof item === "string") {
        return item.trim();
      }
      if (item && typeof item === "object") {
        return String(
          item.id ??
          item.product_id ??
          item.productId ??
          item.value ??
          ""
        ).trim();
      }
      return "";
    })
    .filter(Boolean);

  // Deduplicate
  const dedupedIds = [...new Set(productIds)];

  const selectedHostel =
    (payload as any).selected_hostel ??
    (dataForFallback as any).selected_hostel ??
    "";
  const selectedCategory =
    (payload as any).selected_category ??
    (dataForFallback as any).selected_category ??
    "";

  console.log("=== BUILD_CART ===");
  console.log("selected_hostel:", selectedHostel);
  console.log("selected_category:", selectedCategory);
  console.log("raw selected_products:", (payload as any).selected_products ?? (dataForFallback as any).selected_products);
  console.log("normalized product IDs:", dedupedIds);

  // 3. FETCH SELECTED PRODUCTS — empty handling
  if (dedupedIds.length === 0) {
    session.cart=[]; session.cart_items=[];
    console.log("BUILD_CART requested product IDs:", dedupedIds);
    console.log("BUILD_CART products returned:", 0);
    console.log("BUILD_CART returned product IDs:", []);
    console.log("cart subtotal:", 0);
    console.log("cart total:", 0);
    return {
      screen: "CART",
      data: {
        cart_summary:
          "No valid items selected\n\n" +
          "Subtotal: ₹0\n" +
          "Delivery: ₹0\n" +
          "Small Cart Fee: ₹0\n" +
          "Handling Fee: ₹0\n\n" +
          "Total: ₹0",
        selected_hostel: String(selectedHostel ?? ""),
        selected_category: String(selectedCategory ?? ""),
        selected_products: ""
      }
    };
  }

  if (dedupedIds.length > 100) {
    return {
      screen: "CART",
      data: {
        cart_summary:
          "Too many items\n\n" +
          "Subtotal: ₹0\n" +
          "Delivery: ₹0\n" +
          "Small Cart Fee: ₹0\n" +
          "Handling Fee: ₹0\n\n" +
          "Total: ₹0",
        selected_hostel: String(selectedHostel ?? ""),
        selected_category: String(selectedCategory ?? ""),
        selected_products: dedupedIds.join(",")
      }
    };
  }

  // 2. USE SAME PRODUCT TABLE AS GET_PRODUCTS — products with id, name, price
  // GET_PRODUCTS uses supabase.from("products").select("id, name, price, stock_quantity, is_available, ...")
  console.log("BUILD_CART requested product IDs:", dedupedIds);
  const { data: products, error } = await sup
    .from("products")
    .select("id, name, price, stock_quantity, is_available, delivery_charge")
    .in("id", dedupedIds);

  if (error) {
    console.error("[wf] BUILD_CART products error", error.message);
    return {
      screen: "CART",
      data: {
        cart_summary:
          "No valid items selected\n\n" +
          "Subtotal: ₹0\n" +
          "Delivery: ₹0\n" +
          "Small Cart Fee: ₹0\n" +
          "Handling Fee: ₹0\n\n" +
          "Total: ₹0",
        selected_hostel: String(selectedHostel ?? ""),
        selected_category: String(selectedCategory ?? ""),
        selected_products: dedupedIds.join(",")
      }
    };
  }

  console.log("BUILD_CART products returned:", products?.length ?? 0);
  console.log("BUILD_CART returned product IDs:", (products ?? []).map((p: any) => p.id));

  // 4. HANDLE NOT FOUND — keep valid, ignore invalid
  const pmap = new Map((products ?? []).map((p: any) => [p.id, p]));
  const validProducts = dedupedIds.map(id => pmap.get(id)).filter(Boolean) as any[];

  // 5. CALCULATE CART ITEMS — use existing price field (price), default quantity 1
  const cartItems = validProducts.map((p: any) => ({
    product_name: p.name,
    price: Number(p.price),
    quantity: 1,
    product_id: p.id
  }));

  const cartItemsText = cartItems.map((item: any) => `${item.product_name} x1 - ₹${item.price}`).join("\n");

  // 6. CALCULATE SUBTOTAL
  const subtotal = cartItems.reduce((sum: number, item: any) => sum + item.price * item.quantity, 0);

  // 7. FEES — use simple handlingFee 5 if no existing fee logic for BUILD_CART
  const deliveryFee = 0;
  const smallCartFee = 0;
  const handlingFee = 5;
  const totalAmount = subtotal + deliveryFee + smallCartFee + handlingFee;

  console.log("cart subtotal:", subtotal);
  console.log("cart total:", totalAmount);

  // Preserve for session (for ROOM/CREATE_ORDER)
  session.cart = cartItems.map((c:any)=>({product_id:c.product_id, product_name:c.product_name, price:c.price, quantity:c.quantity}));
  session.cart_items = cartItems.map((c:any)=>({product_id:c.product_id, quantity:c.quantity}));
  session.cart_items_text = cartItemsText;
  session.cart_subtotal = subtotal;
  if (selectedHostel) session.hostelName = String(selectedHostel);
  if (selectedCategory) session.categoryName = String(selectedCategory);
  session.selected_products = dedupedIds.join(",");

  // Also store hostel for stock validation consistency (keep existing hostel logic)
  const hostelName = (payload as any).selected_hostel ?? selectedHostel ?? session.hostelName;
  let hostelId = (payload as any).hostel_id ?? session.hostelId;
  if(!hostelId && hostelName && hostelName!=="Other"){
    const {data:r}=await sup.from("hostels").select("id").eq("name",hostelName).maybeSingle();
    if(r) hostelId=r.id;
  }
  if(hostelName) session.hostelName=hostelName;
  if(hostelId) session.hostelId=hostelId;

  // Validate stock like original (optional but preserve)
  // If any valid product is out of stock in hostel, filter it out and recalc? For now keep all valid products as per spec (spec does not require stock check for BUILD_CART display, only for CREATE)
  // We will keep cart as validProducts regardless of stock for display purposes, but log if needed

  const cartSummary =
    `${cartItemsText || "No valid items selected"}\n\n` +
    `Subtotal: ₹${subtotal}\n` +
    `Delivery: ₹${deliveryFee}\n` +
    `Small Cart Fee: ₹${smallCartFee}\n` +
    `Handling Fee: ₹${handlingFee}\n\n` +
    `Total: ₹${totalAmount}`;

  // 8. RETURN EXACT META FLOW DATA MODEL — cart_summary + selected_*
  const responseData = {
    cart_summary: cartSummary,
    selected_hostel: String(selectedHostel ?? ""),
    selected_category: String(selectedCategory ?? ""),
    selected_products: dedupedIds.join(",")
  };

  console.log("[wf-debug] BUILD_CART response", {
    screen: "CART",
    dataKeys: Object.keys(responseData ?? {}),
    cartSummaryType: typeof responseData?.cart_summary,
    hasCartSummary: responseData?.cart_summary != null,
    hasSelectedHostel: responseData?.selected_hostel != null
  });

  return {
    screen: "CART",
    data: responseData
  };
}

async function flowContinueToRoom(_sup:any, payload:any, session:FlowSession){
  // Preserve hostel/category/products for ROOM (navigate from CART)
  const hostelName = payload.hostel_name ?? payload.selected_hostel ?? payload.hostel_id ?? session.hostelName ?? "";
  const category = payload.selected_category ?? payload.category_id ?? session.categoryName ?? session.categoryId ?? "";
  const prods = payload.selected_products ?? session.selected_products ?? "";
  const selProds = typeof prods==="string" ? prods : Array.isArray(prods) ? prods.join(",") : String(prods ?? "");
  if(hostelName) session.hostelName=hostelName;
  if(category) session.categoryName=String(category);
  if(selProds) session.selected_products=selProds;
  return {screen:"ROOM",data:{
    selected_hostel: session.hostelName ?? "",
    selected_category: session.categoryName ?? session.categoryId ?? "",
    selected_products: session.selected_products ?? ""
  }};
}

async function flowReviewOrder(sup:any, payload:any, session:FlowSession){
  // Request may have hostel_name/room_number at top level or in data
  const hostelName = payload.hostel_name ?? payload.selected_hostel ?? session.hostelName;
  const room = typeof payload.room_number==="string"?payload.room_number.trim(): typeof payload.roomNumber==="string"?payload.roomNumber.trim(): "";
  if(!hostelName) return {screen:"REVIEW",data:{error:"Hostel not selected", review_items:"No items", subtotal: fmtRs(0), delivery_charge: fmtRs(0), small_cart_fee: fmtRs(0), handling_fee: fmtRs(0), total_amount: fmtRs(0), hostel_name:"", room_number: room}};
  if(!room) return {screen:"REVIEW",data:{error:"Room number required", review_items:"No items", subtotal: fmtRs(0), delivery_charge: fmtRs(0), small_cart_fee: fmtRs(0), handling_fee: fmtRs(0), total_amount: fmtRs(0), hostel_name: hostelName, room_number:""}};
  session.room_number=room;
  session.hostelName=hostelName;

  // Cart from session
  let cart = session.cart;
  let cart_items = session.cart_items;
  // Fallback: if session empty but payload has selected_products, build on the fly
  if((!cart || cart.length===0) && (payload.selected_products || payload.cart_items || payload.cart)){
    const raw = payload.selected_products ?? payload.cart_items ?? payload.cart;
    const ids=parseSelectedProducts(raw);
    if(ids.length>0){
      // Reuse build logic quickly
      const {data:prods}=await sup.from("products").select("id,name,price,is_available,stock_quantity,delivery_charge").in("id",ids);
      const pmap=new Map((prods??[]).map((p:any)=>[p.id,p]));
      cart=[];
      for(const pid of ids){
        const pr=pmap.get(pid);
        if(!pr || pr.is_available===false) continue;
        cart.push({product_id:pr.id, product_name:pr.name, price:Number(pr.price), quantity:1});
      }
      session.cart=cart;
    }
  }
  if(!cart || cart.length===0){
    return {screen:"REVIEW",data:{error:"Cart empty. Please select products.", review_items:"No items", subtotal: fmtRs(0), delivery_charge: fmtRs(0), small_cart_fee: fmtRs(0), handling_fee: fmtRs(0), total_amount: fmtRs(0), hostel_name: hostelName, room_number: room}};
  }

  // Resolve hostel id for stock/pricing
  let hostelId=session.hostelId;
  if(!hostelId && hostelName!=="Other"){
    const {data:r}=await sup.from("hostels").select("id").eq("name",hostelName).maybeSingle();
    if(r) hostelId=r.id;
  }
  // Validate products still available & stock
  const pids=cart.map((c:any)=>c.product_id);
  const {data:prods}=await sup.from("products").select("id,name,price,is_available,stock_quantity,delivery_charge").in("id",pids);
  const pmap=new Map((prods??[]).map((p:any)=>[p.id,p]));
  for(const it of cart){
    const pr=pmap.get(it.product_id);
    if(!pr) return {screen:"REVIEW",data:{error:`Product ${it.product_name} not found`, review_items: cart.map((c:any)=>`${c.product_name} × ${c.quantity}`).join("\n"), subtotal: fmtRs(0), delivery_charge: fmtRs(0), small_cart_fee: fmtRs(0), handling_fee: fmtRs(0), total_amount: fmtRs(0), hostel_name: hostelName, room_number: room}};
    if(pr.is_available===false) return {screen:"REVIEW",data:{error:`${pr.name} unavailable`, review_items: cart.map((c:any)=>`${c.product_name} × ${c.quantity}`).join("\n"), subtotal: fmtRs(0), delivery_charge: fmtRs(0), small_cart_fee: fmtRs(0), handling_fee: fmtRs(0), total_amount: fmtRs(0), hostel_name: hostelName, room_number: room}};
    // Update price to current DB price
    it.price=Number(pr.price);
  }
  // Stock check
  if(hostelName!=="Other" && hostelId){
    const {data:hs}=await sup.from("hostel_stock").select("product_id,stock_quantity").in("product_id",pids).eq("hostel_id",hostelId);
    const hm=new Map((hs??[]).map((r:any)=>[r.product_id,r.stock_quantity??0]));
    for(const it of cart){
      const av=hm.has(it.product_id)?Number(hm.get(it.product_id)):0;
      if(av < it.quantity) return {screen:"REVIEW",data:{error:`Only ${av} of ${it.product_name} available in ${hostelName}`, review_items: cart.map((c:any)=>`${c.product_name} × ${c.quantity}`).join("\n"), subtotal: fmtRs(0), delivery_charge: fmtRs(0), small_cart_fee: fmtRs(0), handling_fee: fmtRs(0), total_amount: fmtRs(0), hostel_name: hostelName, room_number: room}};
    }
  }

  // Pricing - try to lookup user if phone available (from session or payload)
  const phoneRaw = payload.phone_number ?? payload.phoneNumber ?? session.phone_number;
  let uid:string|null=null;
  const phone=phoneRaw ? normPhone(phoneRaw) : null;
  if(phone) uid=await lookupUid(sup, phone);

  const orderItems=cart.map((c:any)=>({product_id:c.product_id, price:c.price, quantity:c.quantity}));
  const pricing=await calcPricing(sup, orderItems, pmap, uid);

  const review_items=cart.map((c:any)=>`${c.product_name} × ${c.quantity}`).join("\n");
  // Store pricing for confirmation display
  session._lastPricing=pricing;

  return {screen:"REVIEW",data:{
    review_items,
    subtotal: fmtRs(pricing.subtotal),
    delivery_charge: fmtRs(pricing.deliveryFee),
    small_cart_fee: fmtRs(pricing.smallCartFee),
    handling_fee: fmtRs(pricing.handlingFee),
    total_amount: fmtRs(pricing.totalAmount),
    hostel_name: hostelName,
    room_number: room
  }};
}

async function flowCreateOrder(sup:any, payload:any, session:FlowSession){
  console.log("[wf-debug] CREATE_ORDER started", {
    hasSelectedHostel: !!(payload.selected_hostel ?? payload.hostel_name),
    selected_hostel_type: typeof (payload.selected_hostel ?? payload.hostel_name),
    selected_hostel_value: String(payload.selected_hostel ?? payload.hostel_name ?? session.hostelName ?? "").slice(0,20),
    selected_category_type: typeof (payload.selected_category ?? payload.category_id),
    selected_category_value: String(payload.selected_category ?? payload.category_id ?? "").slice(0,20),
    selected_products_type: typeof payload.selected_products,
    selected_products_length: Array.isArray(payload.selected_products) ? payload.selected_products.length : typeof payload.selected_products==="string" ? payload.selected_products.length : 0,
    room_number_type: typeof payload.room_number,
    room_number_value: typeof payload.room_number==="string" ? payload.room_number.slice(0,10) : "",
    hasCartInSession: !!(session.cart && session.cart.length>0)
  });
  const hostelName = payload.hostel_name ?? payload.selected_hostel ?? session.hostelName;
  const room = typeof payload.room_number==="string"?payload.room_number.trim(): typeof payload.roomNumber==="string"?payload.roomNumber.trim(): session.room_number ?? "";
  if(!hostelName) {
    console.log("[wf-debug] CREATE_ORDER error", {error:"Hostel not selected", step:"hostel validation"});
    return {screen:"CONFIRMATION",data:{error:"Hostel not selected"}};
  }
  if(!room) {
    console.log("[wf-debug] CREATE_ORDER error", {error:"Room number required", step:"room validation"});
    return {screen:"CONFIRMATION",data:{error:"Room number required"}};
  }
  let cart = session.cart;
  if(!cart || cart.length===0){
    // Fallback: reconstruct cart from payload if session was lost (stateless edge)
    const rawSel = payload.selected_products ?? payload.selectedProducts ?? (payload as any).selected_products;
    if(rawSel){
      const idsFallback = parseSelectedProducts(rawSel);
      if(idsFallback.length>0){
        // Fetch products for fallback cart
        const {data:prodsFallback, error:fallbackErr}=await sup.from("products").select("id,name,price").in("id", idsFallback);
        if(fallbackErr){
          console.log("[wf-debug] CREATE_ORDER Supabase error", {step:"fallback products fetch", message:fallbackErr.message, code:(fallbackErr as any).code, details:(fallbackErr as any).details, hint:(fallbackErr as any).hint});
        }
        const pmapFallback=new Map((prodsFallback??[]).map((p:any)=>[p.id,p]));
        cart = idsFallback.map(id=>pmapFallback.get(id)).filter(Boolean).map((p:any)=>({product_id:p.id, product_name:p.name, price:Number(p.price), quantity:1}));
        if(cart.length>0) session.cart=cart;
      }
    }
  }
  if(!cart || cart.length===0) {
    console.log("[wf-debug] CREATE_ORDER error", {error:"Cart empty", step:"cart validation", hasCart:!!cart, cartLength:cart?.length ?? 0});
    return {screen:"CONFIRMATION",data:{error:"Cart empty. Cannot create order."}};
  }
  console.log("[wf-debug] CREATE_ORDER invoked", {hasCart:true, cartLength:cart.length, hasHostel:!!hostelName, hasRoom:!!room});

  // Customer identity: prefer payload.phone_number, then session, then flow_token-derived fallback
  // Spec says do NOT trust editable phone; production must inject authenticated WhatsApp sender.
  // For now, require phone to be present in session or payload; if missing, return actionable error instead of creating with fake data.
  let phoneRaw = payload.phone_number ?? payload.phoneNumber ?? payload.whatsapp_number ?? payload.sender_phone ?? session.phone_number;
  // Also check flow_token as possible identifier (opaque)
  // If still missing, we cannot safely create user — return error directing integration to provide sender
  if(!phoneRaw){
    console.log("[wf-debug] CREATE_ORDER error", {error:"Customer identity not available", step:"phone validation", hasPhoneRaw:!!phoneRaw});
    // Try to use hostel+room as identifier? No, must have phone for orders.phone_number.
    return {screen:"CONFIRMATION",data:{
      error:"Customer identity not available. Production integration must provide authenticated WhatsApp sender phone_number. Add phone_number to Flow data_exchange or inject from WhatsApp context.",
      hostel_name: hostelName, room_number: room
    }};
  }
  const phone=normPhone(phoneRaw);
  if(!phone) {
    console.log("[wf-debug] CREATE_ORDER error", {error:"Valid phone_number required", step:"phone validation", phoneRawType: typeof phoneRaw});
    return {screen:"CONFIRMATION",data:{error:"Valid phone_number required"}};
  }

  // Customer name: prefer payload, fallback to phone-based name
  let customerName = typeof payload.customer_name==="string"?payload.customer_name.trim(): typeof payload.customerName==="string"?payload.customerName.trim(): "";
  if(!customerName) customerName=`WhatsApp User ${phone.slice(-4)}`;

  // Validate hostel
  const hostel=await resolveHostel(sup, hostelName);
  if(!hostel) {
    console.log("[wf-debug] CREATE_ORDER Supabase error", {step:"hostel resolve", error:"Unknown hostel", hostelNameType: typeof hostelName, hasHostelName: !!hostelName});
    return {screen:"CONFIRMATION",data:{error:`Unknown hostel: ${hostelName}`}};
  }
  const hName=hostel.name, hId=hostel.id;

  // Re-validate products, prices, stock, then create order using existing hCreate logic
  // Build body for hCreate
  const bodyForCreate={
    phone_number: phone,
    customer_name: customerName,
    hostel_name: hName,
    room_number: room,
    items: cart.map((c:any)=>({product_id:c.product_id, quantity:c.quantity}))
  };
  const result=await hCreate(sup, bodyForCreate);
  console.log("[wf-debug] CREATE_ORDER hCreate result", {
    success: result.success,
    error: (result as any).error ?? (result as any).message ?? null,
    hasOrder: !!(result as any).order,
    orderKeys: Object.keys((result as any).order ?? {})
  });
  if(!result.success){
    console.log("[wf-debug] CREATE_ORDER error", {error: (result as any).error ?? (result as any).message, step:"hCreate", hasOrder:!!(result as any).order});
    // Map to confirmation screen error
    return {screen:"CONFIRMATION",data:{error: (result as any).error ?? (result as any).message ?? "Failed to create order", hostel_name: hName, room_number: room}};
  }
  const order=(result as any).order;
  // Need delivery_otp for confirmation: fetch from DB
  let otp="";
  try{
    const {data:o}=await sup.from("orders").select("delivery_otp").eq("order_number",order.order_number).maybeSingle();
    if(o) otp=o.delivery_otp;
  }catch{}
  // Clear session cart after success
  session.cart=[]; session.cart_items=[];

  const confirmation_message =
    `Your order has been placed successfully.\n\nOrder ID: ${String(order.order_number)}\nTotal: ₹${order.total_amount}`;

  console.log("[wf-debug] CREATE_ORDER success", {
    screen: "CONFIRMATION",
    dataKeys: ["confirmation_message"],
    hasConfirmationMessage: typeof confirmation_message === "string" && confirmation_message.length > 0,
    confirmationMessageType: typeof confirmation_message,
    hasOrderId: !!order.order_number,
    hasTotalAmount: order.total_amount !== undefined && order.total_amount !== null
  });

  return {
    screen: "CONFIRMATION",
    data: {
      confirmation_message
    }
  };
}

// ── existing hCreate for direct use ──
async function hCreate(sup:any, body:any){
  const phone=normPhone(body.phone_number); if(!phone) return {success:false,error:"Valid phone_number is required (10-digit Indian mobile number)"};
  const cname=typeof body.customer_name==="string"?body.customer_name.trim():""; if(!cname) return {success:false,error:"customer_name is required"};
  const href=body.hostel_id??body.hostel_name; if(typeof href!=="string"||!href.trim()) return {success:false,error:"hostel_id or hostel_name is required"};
  const room=typeof body.room_number==="string"?body.room_number.trim():""; if(!room) return {success:false,error:"room_number is required"};
  const raw=body.items; if(!Array.isArray(raw)||raw.length===0) return {success:false,error:"items must be a non-empty array"};
  const MAXI=100, MAXQ=999; if(raw.length>MAXI) return {success:false,error:`items must contain at most ${MAXI} entries`};
  const mq=new Map<string,number>(); for(const it of raw){ if(typeof it!=="object"||it===null||typeof (it as any).product_id!=="string"||!(it as any).product_id) return {success:false,error:"Each item must have a product_id"}; const q=Number((it as any).quantity); if(!Number.isInteger(q)||q<=0) return {success:false,error:"Each item quantity must be a positive integer"}; if(q>MAXQ) return {success:false,error:`Each item quantity must be at most ${MAXQ}`}; mq.set((it as any).product_id as string,(mq.get((it as any).product_id as string)??0)+q); }
  const req:any[]=[]; for(const [pid,q] of mq){ if(q>MAXQ) return {success:false,error:`Total quantity for a product must be at most ${MAXQ}`}; req.push({product_id:pid,quantity:q}); }
  const ago=new Date(Date.now()-60_000).toISOString();
  const {data:rec,error:re}=await sup.from("orders").select("id,status,created_at").eq("phone_number",phone).gt("created_at",ago).neq("status","cancelled").limit(1);
  if(re){ console.error("[wf] dup check",re.message); return {success:false,error:"Failed to validate order"}; }
  if(rec&&rec.length>0) return {success:false,error:"DUPLICATE_ORDER",message:"An order from this number was placed less than 60 seconds ago. Please wait before ordering again."};
  const hq=isUuid(href.trim())?sup.from("hostels").select("id,name,is_active").eq("id",href.trim()).eq("is_active",true).maybeSingle():sup.from("hostels").select("id,name,is_active").eq("name",href.trim()).eq("is_active",true).maybeSingle();
  const {data:host,error:he}=await hq; if(he||!host) return {success:false,error:`Unknown hostel: ${href}`};
  const hName:string=host.name, hId:string=host.id;
  let uid:string|null=null;
  const pids=[...new Set(req.map((i:any)=>i.product_id))];
  const {data:prods,error:pe}=await sup.from("products").select("id,name,price,is_available,stock_quantity,delivery_charge").in("id",pids);
  if(pe){ console.error("[wf] create prods",pe.message); return {success:false,error:"Failed to validate products"}; }
  const pmap=new Map((prods??[]).map((p:any)=>[p.id,p]));
  const oItems:any[]=[]; for(const r of req){ const pr=pmap.get(r.product_id); if(!pr) return {success:false,error:`Unknown product: ${r.product_id}`}; if(pr.is_available===false) return {success:false,error:"PRODUCT_UNAVAILABLE",message:`${pr.name} is currently unavailable.`}; const prc=Number(pr.price); if(!Number.isFinite(prc)||prc<0) return {success:false,error:`Invalid price for product: ${pr.name}`}; oItems.push({product_id:pr.id,product_name:pr.name??"",price:prc,quantity:r.quantity,dhaba_name:null,hostel:hName==="Other"?null:hName}); }
  if(hName!=="Other"){ const {data:hs,error:hsE}=await sup.from("hostel_stock").select("product_id,stock_quantity").in("product_id",pids).eq("hostel_id",hId); if(hsE){ console.error("[wf] create stock",hsE.message); return {success:false,error:"Failed to check stock"}; } const hm=new Map((hs??[]).map((r:any)=>[r.product_id,r.stock_quantity??0])); for(const it of oItems){ const av=hm.has(it.product_id)?Number(hm.get(it.product_id)):0; if(av<it.quantity) return {success:false,error:"INSUFFICIENT_STOCK",message:`Only ${Math.max(0,av)} unit(s) of ${it.product_name} are available in ${hName}.`}; } } else { for(const it of oItems){ const pr=pmap.get(it.product_id); const av=Number(pr?.stock_quantity??0); if(av<it.quantity) return {success:false,error:"INSUFFICIENT_STOCK",message:`Only ${Math.max(0,av)} unit(s) of ${it.product_name} are available.`}; } }
  const vars=[phone,`91${phone}`,`+91${phone}`,`0${phone}`];
  const {data:byNum}=await sup.from("users").select("id").in("phone_number",vars).limit(1);
  if(byNum&&byNum.length>0) uid=byNum[0].id; else { const {data:byPh}=await sup.from("users").select("id").in("phone",vars).limit(1); if(byPh&&byPh.length>0) uid=byPh[0].id; }
  if(uid){ await sup.from("users").update({full_name:cname,selected_hostel:hName,updated_at:new Date().toISOString()}).eq("id",uid); }
  else { const {data:nu,error:ue}=await sup.from("users").insert({phone_number:phone,phone,full_name:cname,role:"customer",selected_hostel:hName}).select("id").single(); if(ue||!nu){ if(ue&&(ue as any).code==="23505"){ const {data:r}=await sup.from("users").select("id").in("phone",vars).limit(1); if(r&&r.length>0) uid=r[0].id; if(!uid){ const {data:r2}=await sup.from("users").select("id").in("phone_number",vars).limit(1); if(r2&&r2.length>0) uid=r2[0].id; } } if(!uid){ console.error("[wf] user resolve",ue?.code??"unknown"); return {success:false,error:"Failed to identify customer"}; } } else uid=nu.id; }
  const pricing=await calcPricing(sup, oItems, pmap, uid);
  const addr=`${hName}, Room ${room}`, notes=`Room No: ${room}`, onum=`CC${Date.now()}`, otp=genOtp();
  const {data:created,error:ce}=await sup.from("orders").insert({user_id:uid,order_number:onum,customer_name:cname,items:oItems,hostel_id:hName,total_amount:pricing.totalAmount,subtotal_before_fees:pricing.subtotal,small_cart_fee:pricing.smallCartFee,handling_fee:pricing.handlingFee,delivery_fee:pricing.deliveryFee,delivery_address:addr,phone_number:phone,delivery_notes:notes,status:"confirmed",payment_method:"cash",is_paid:false,payment_id:null,delivery_otp:otp}).select("id,order_number").single();
  if(ce||!created){ console.error("[wf] insert",ce?.message); return {success:false,error:"Failed to create order"}; }
  const errs:string[]=[]; for(const it of oItems){ try{ const {data,error}=await sup.rpc("deduct_stock_on_order",{p_product_id:it.product_id,p_quantity:it.quantity,p_hostel_name:hName}); const res=typeof data==="string"?JSON.parse(data):data; if(error||res?.success===false) errs.push(`${it.product_name}: ${error?.message??res?.error??"rejected"}`);}catch(e){ errs.push(`${it.product_name}: ${(e as Error).message}`);} }
  if(errs.length>0){ console.error("[wf] deduct",{onum,errs}); return {success:false,error:"STOCK_DEDUCTION_FAILED",message:"Order was created but stock deduction failed. Admin review required.",order_number:onum,order_id:created.id}; }
  try{ await sup.from("notifications").insert({user_id:uid,title:"Order Placed Successfully!",message:`Your order ${onum} has been placed! Total: \u20B9${pricing.totalAmount.toFixed(2)}`,type:"success"});}catch(e){ console.error("[wf] notif",(e as Error).message); }
  return {success:true,action:"CREATE_ORDER",order:{order_id:created.id,order_number:onum,total_amount:pricing.totalAmount,hostel:hName,room_number:room,payment_method:"cash",status:"confirmed",delivery_otp:otp}};
}

// ── also keep plain hReview for backward compat plain JSON testing ──
async function hReviewPlain(sup:any, body:any){
  const phone=normPhone(body.phone_number); if(!phone) return {success:false,error:"Valid phone_number is required (10-digit Indian mobile number)"};
  const href=body.hostel_id??body.hostel_name; if(typeof href!=="string"||!href.trim()) return {success:false,error:"hostel_id or hostel_name is required"};
  const room=typeof body.room_number==="string"?body.room_number.trim():""; if(!room) return {success:false,error:"room_number is required"};
  const raw=body.items; if(!Array.isArray(raw)||raw.length===0) return {success:false,error:"items must be a non-empty array"};
  const MAXI=100, MAXQ=999; if(raw.length>MAXI) return {success:false,error:`items must contain at most ${MAXI} entries`};
  const mq=new Map<string,number>(); for(const it of raw){ if(typeof it!=="object"||it===null||typeof (it as any).product_id!=="string"||!(it as any).product_id) return {success:false,error:"Each item must have a product_id"}; const q=Number((it as any).quantity); if(!Number.isInteger(q)||q<=0) return {success:false,error:"Each item quantity must be a positive integer"}; if(q>MAXQ) return {success:false,error:`Each item quantity must be at most ${MAXQ}`}; mq.set((it as any).product_id as string,(mq.get((it as any).product_id as string)??0)+q); }
  const req:any[]=[]; for(const [pid,q] of mq){ if(q>MAXQ) return {success:false,error:`Total quantity for a product must be at most ${MAXQ}`}; req.push({product_id:pid,quantity:q}); }
  const hq=isUuid(href.trim())?sup.from("hostels").select("id,name,is_active").eq("id",href.trim()).eq("is_active",true).maybeSingle():sup.from("hostels").select("id,name,is_active").eq("name",href.trim()).eq("is_active",true).maybeSingle();
  const {data:host,error:he}=await hq; if(he||!host) return {success:false,error:`Unknown hostel: ${href}`};
  const hName:string=host.name, hId:string=host.id;
  const pids=[...new Set(req.map((i:any)=>i.product_id))];
  const {data:prods,error:pe}=await sup.from("products").select("id,name,price,is_available,stock_quantity,delivery_charge").in("id",pids);
  if(pe){ console.error("[wf] review prods",pe.message); return {success:false,error:"Failed to validate products"}; }
  const pmap=new Map((prods??[]).map((p:any)=>[p.id,p]));
  const oItems:any[]=[]; for(const r of req){ const pr=pmap.get(r.product_id); if(!pr) return {success:false,error:`Unknown product: ${r.product_id}`}; if(pr.is_available===false) return {success:false,error:"PRODUCT_UNAVAILABLE",message:`${pr.name} is currently unavailable.`}; const prc=Number(pr.price); if(!Number.isFinite(prc)||prc<0) return {success:false,error:`Invalid price for product: ${pr.name}`}; oItems.push({product_id:pr.id,product_name:pr.name??"",price:prc,quantity:r.quantity,dhaba_name:null,hostel:hName==="Other"?null:hName}); }
  if(hName!=="Other"){ const {data:hs,error:hsE}=await sup.from("hostel_stock").select("product_id,stock_quantity").in("product_id",pids).eq("hostel_id",hId); if(hsE){ console.error("[wf] review stock",hsE.message); return {success:false,error:"Failed to check stock"}; } const hm=new Map((hs??[]).map((r:any)=>[r.product_id,r.stock_quantity??0])); for(const it of oItems){ const av=hm.has(it.product_id)?Number(hm.get(it.product_id)):0; if(av<it.quantity) return {success:false,error:"INSUFFICIENT_STOCK",message:`Only ${Math.max(0,av)} unit(s) of ${it.product_name} are available in ${hName}.`}; } } else { for(const it of oItems){ const pr=pmap.get(it.product_id); const av=Number(pr?.stock_quantity??0); if(av<it.quantity) return {success:false,error:"INSUFFICIENT_STOCK",message:`Only ${Math.max(0,av)} unit(s) of ${it.product_name} are available.`}; } }
  const uid=await lookupUid(sup, phone);
  const pricing=await calcPricing(sup, oItems, pmap, uid);
  const br=oItems.map((i:any)=>({product_id:i.product_id,product_name:i.product_name,price:i.price,quantity:i.quantity}));
  return {success:true,action:"REVIEW_ORDER",breakdown:{subtotal:pricing.subtotal,delivery_fee:pricing.deliveryFee,small_cart_fee:pricing.smallCartFee,handling_fee:pricing.handlingFee,total_amount:pricing.totalAmount},items:br,item_count:oItems.reduce((s,i)=>s+i.quantity,0),hostel:hName,room_number:room};
}

// ── Flow routing (action-primary) ──
async function routeFlow(sup:any, req:any){
  const action = (req.action as string) || "";
  const screen = (req.screen as string) || "";
  const flowToken = (req.flow_token as string) || "default";
  const session=getSession(flowToken);
  // payload merges data + top-level fields (hostel_name, room_number etc may be top-level per spec)
  const data = req.data ?? {};
  // Merge top-level relevant fields into data for handlers that look in payload
  const payload:any = {
    ...data,
    // top-level overrides - handle multiple possible hostel/category field names from Meta Flow
    hostel_id: req.hostel_id ?? data.hostel_id ?? data.hostelId ?? (data as any).hostel ?? (data as any).hostels ?? data.selected_hostel ?? (data as any).selected_hostel_id ?? data.selectedHostel,
    hostel_name: req.hostel_name ?? data.hostel_name ?? data.hostelName ?? data.selected_hostel ?? (data as any).hostel ?? (data as any).hostel_id ?? data.selectedHostel,
    selected_hostel: req.selected_hostel ?? req.hostel_name ?? data.selected_hostel ?? data.selectedHostel ?? data.hostel_name ?? data.hostelName ?? (data as any).hostel ?? data.hostel_id,
    category_id: req.category_id ?? data.category_id ?? data.categoryId ?? data.selected_category ?? data.selectedCategory ?? (data as any).category ?? (data as any).category_id,
    selected_category: req.selected_category ?? data.selected_category ?? data.selectedCategory ?? data.category_id ?? data.categoryId ?? (data as any).category,
    hostelId: req.hostel_id ?? data.hostel_id ?? data.selected_hostel ?? (data as any).hostel,
    categoryId: req.category_id ?? data.category_id ?? data.selected_category ?? (data as any).category,
    selected_products: req.selected_products ?? data.selected_products ?? data.selectedProducts ?? data.products ?? data.selected_products,
    room_number: req.room_number ?? data.room_number ?? data.roomNumber ?? data.room,
    phone_number: req.phone_number ?? data.phone_number ?? data.phoneNumber ?? data.whatsapp_number ?? data.sender_phone,
    // keep flow token for debugging - _action captures business action for routing (data.action takes precedence)
    _flow_token: flowToken,
    _action: (data as any)?.action ?? (req as any)?._action ?? action,
    _screen: screen,
  };
  // Also carry hostel/category selections through data propagation
  // If payload has hostel info, persist to session

  console.log("[wf-debug] Meta request", {
    action,
    screen,
    dataAction: (data as any)?.action,
    dataKeys: Object.keys(data ?? {}),
    payloadKeys: Object.keys(payload ?? {}),
    dataHostelId: (data as any)?.hostel_id,
    dataHostelIdCamel: (data as any)?.hostelId,
    dataHostel: (data as any)?.hostel,
    dataHostels: (data as any)?.hostels,
    dataSelectedHostel: (data as any)?.selected_hostel,
    dataSelectedHostelId: (data as any)?.selected_hostel_id,
    payloadHostelId: (payload as any)?.hostel_id,
    payloadHostelIdCamel: (payload as any)?.hostelId,
    payloadHostel: (payload as any)?.hostel,
    payloadHostels: (payload as any)?.hostels,
    payloadSelectedHostel: (payload as any)?.selected_hostel,
    payloadSelectedHostelId: (payload as any)?.selected_hostel_id,
    topLevelKeys: Object.keys(req ?? {}),
    dataKeysFull: Object.keys(data ?? {}),
    payloadKeysFull: Object.keys(payload ?? {}),
  });
  // Effective action: for direct business actions (local testing) use data.action/payload._action/action; for Meta data_exchange infer from screen+fields
  const effectiveAction =
    (typeof (data as any)?.action === "string" && (data as any).action
      ? (data as any).action
      : typeof (payload as any)?._action === "string" && (payload as any)._action
        ? (payload as any)._action
        : action) as string;
  console.log("[wf-debug] Routing decision", {
    action,
    effectiveAction,
    screen,
    payloadAction: (payload as any)?._action,
    hasHostelId: Boolean(payload.hostel_id),
    hostel_id_type: typeof payload.hostel_id,
  });
  // Temporary safe logging for GET_CATEGORIES debugging (no secrets)
  if(effectiveAction==="GET_CATEGORIES" || action==="GET_CATEGORIES" || screen==="HOSTEL"){
    const hasHostel = !!(payload.hostel_id || payload.hostelId || (data as any).hostel_id || (data as any).hostel || payload.selected_hostel);
    console.log("[wf] GET_CATEGORIES check",{action, effectiveAction, screen, hasHostelId: hasHostel});
  }
  // Screen-based inference for Meta data_exchange (actual production request: action=data_exchange, screen=HOSTEL, data:{hostel_id})
  if(action==="data_exchange"){
    const hasHostelId = typeof payload.hostel_id === "string" && payload.hostel_id.trim() !== "" || typeof payload.selected_hostel === "string" && payload.selected_hostel.trim() !== "";
    const hasCategoryId = typeof payload.category_id === "string" && payload.category_id.trim() !== "" || typeof payload.selected_category === "string" && payload.selected_category.trim() !== "";
    const rawSel = (payload as any).selected_products ?? (payload as any).selectedProducts;
    const hasSelectedProducts = rawSel!=null && (
      Array.isArray(rawSel) ? rawSel.length>0 :
      typeof rawSel==="string" ? rawSel.trim()!=="" : true
    );
    const hasRoomNumber = typeof payload.room_number === "string" && payload.room_number.trim() !== "";
    let inferredOperation = effectiveAction;
    if(screen==="HOSTEL" && hasHostelId) inferredOperation="GET_CATEGORIES";
    else if(screen==="CATEGORY" && hasCategoryId) inferredOperation="GET_PRODUCTS";
    else if(screen==="PRODUCTS" && hasSelectedProducts) inferredOperation="BUILD_CART";
    else if(screen==="CART") inferredOperation="CONTINUE_TO_ROOM";
    else if(screen==="ROOM" && hasRoomNumber) inferredOperation="CREATE_ORDER";
    else if(screen==="REVIEW") inferredOperation="CREATE_ORDER";
    // Required debug log for every data_exchange (no IDs/phone/tokens, only booleans and screen names)
    const responseScreenMap: Record<string,string> = {
      GET_CATEGORIES:"CATEGORY", GET_PRODUCTS:"PRODUCTS", BUILD_CART:"CART",
      CONTINUE_TO_ROOM:"ROOM", REVIEW_ORDER:"REVIEW", CREATE_ORDER:"CONFIRMATION",
      GET_HOSTELS:"HOSTEL"
    };
    const previewResponseScreen = responseScreenMap[inferredOperation] ?? inferredOperation;
    console.log(`ACTION: ${action}\nCURRENT SCREEN: ${screen}\nselected_hostel: ${hasHostelId}\nselected_category: ${hasCategoryId}\nselected_products: ${hasSelectedProducts}\nROOM: ${hasRoomNumber}\nRESPONSE SCREEN: ${previewResponseScreen}`);
    console.log("[wf-debug] Inferred Flow operation", {
      action,
      screen,
      inferredOperation,
      hasHostelId,
      hasCategoryId,
      hasSelectedProducts,
      hasRoomNumber,
    });
    switch(inferredOperation){
      case "GET_CATEGORIES":
        return await flowGetCategories(sup, payload, session);
      case "GET_PRODUCTS":
        return await flowGetProducts(sup, payload, session);
      case "BUILD_CART":
        return await flowBuildCart(sup, payload, session);
      case "CONTINUE_TO_ROOM":
        return await flowContinueToRoom(sup, payload, session);
      case "REVIEW_ORDER":
        return await flowReviewOrder(sup, payload, session);
      case "CREATE_ORDER":
        return await flowCreateOrder(sup, payload, session);
      case "GET_HOSTELS":
        return await flowGetHostels(sup);
      default:
        // fall through to direct-action switch for unhandled data_exchange
        break;
    }
  }
  switch(effectiveAction){
    case "INIT":
      return {screen:"WELCOME", data:{}};
    case "GET_HOSTELS":
      return await flowGetHostels(sup);
    case "GET_CATEGORIES":
      return await flowGetCategories(sup, payload, session);
    case "GET_PRODUCTS":
      return await flowGetProducts(sup, payload, session);
    case "BUILD_CART":
      return await flowBuildCart(sup, payload, session);
    case "CONTINUE_TO_ROOM":
      return await flowContinueToRoom(sup, payload, session);
    case "REVIEW_ORDER":
      return await flowReviewOrder(sup, payload, session);
    case "CREATE_ORDER":
      return await flowCreateOrder(sup, payload, session);
    // Backwards compat: handle screen-based fallbacks if action missing/misrouted
    default:
      // Try to infer from screen if action unknown
      if(screen==="HOSTEL"||screen==="WELCOME") return await flowGetHostels(sup);
      if(screen==="CATEGORY") return await flowGetCategories(sup, payload, session);
      if(screen==="PRODUCTS") return await flowGetProducts(sup, payload, session);
      if(screen==="CART") return await flowBuildCart(sup, payload, session);
      if(screen==="ROOM") return await flowContinueToRoom(sup, payload, session);
      if(screen==="REVIEW") return await flowReviewOrder(sup, payload, session);
      if(screen==="CONFIRMATION") return await flowCreateOrder(sup, payload, session);
      console.error("[wf] unknown action",action,"screen",screen);
      return {screen: screen || "HOSTEL", data:{error:`Unknown action: ${action}`}};
  }
}

async function routePlain(sup:any, body:any){
  const a=(body.action as string)||"UNKNOWN";
  switch(a){
    case "ping": return {data:{status:"active"}};
    case "INIT": return await hInit();
    case "GET_HOSTELS": {
      const r=await hHostelsDb(sup);
      if(!r) return {success:false,error:"Failed to fetch hostels"};
      return {success:true,action:"GET_HOSTELS",hostels:r};
    }
    case "GET_CATEGORIES": {
      const d=await hCatsDb(sup);
      if(!d) return {success:false,error:"Failed to fetch categories"};
      return {success:true,action:"GET_CATEGORIES",categories:d};
    }
    case "GET_PRODUCTS": {
      // reuse hProducts wrapper that returns plain object with action
      const cols=["id","name","description","price","original_price","image_url","category_id","is_available","stock_quantity","average_rating","review_count","available_from","available_to","delivery_charge","display_order"].join(",");
      const catId=typeof body.category_id==="string"?body.category_id.trim():null;
      if(!catId){
        const [pr,cr]=await Promise.all([sup.from("products").select(cols).eq("is_available",true).order("display_order",{ascending:true,nullsFirst:false}), sup.from("categories").select("id, name, description, image_url, is_active, display_order").eq("is_active",true).order("display_order",{ascending:true})]);
        if(pr.error) return {success:false,error:"Failed to fetch products"};
        if(cr.error) return {success:false,error:"Failed to fetch categories"};
        return {success:true,action:"GET_PRODUCTS",products:pr.data??[],categories:cr.data??[]};
      } else {
        const {data:prods,error:e}=await sup.from("products").select("id, name, price, stock_quantity, is_available, display_order").eq("category_id",catId).eq("is_available",true).order("display_order",{ascending:true,nullsFirst:false});
        if(e) return {success:false,error:"Failed to fetch products"};
        const fps=(prods??[]).map((p:any)=>({id:p.id,name:p.name,price:Number(p.price),stock_quantity:Number(p.stock_quantity??0),is_available:p.is_available}));
        return {success:true,action:"GET_PRODUCTS",category_id:catId,products:fps};
      }
    }
    case "GET_STOCK": {
      let hid=body.hostel_id as string|undefined; const hname=body.hostel_name as string|undefined;
      if(!hid&&hname){ const {data:r}=await sup.from("hostels").select("id").eq("name",hname).maybeSingle(); if(r) hid=r.id; else return {success:false,error:`Unknown hostel: ${hname}`}; }
      if(!hid) return {success:false,error:"hostel_id or hostel_name is required"};
      if(hid==="Other"){ const {data,error}=await sup.from("products").select("id, stock_quantity").eq("is_available",true); if(error) return {success:false,error:"Failed to fetch stock"}; return {success:true,action:"GET_STOCK",hostel_id:hid,stock:(data||[]).map((p:any)=>({product_id:p.id,stock_quantity:p.stock_quantity||0}))}; }
      const {data,error}=await sup.from("hostel_stock").select("product_id, stock_quantity").eq("hostel_id",hid);
      if(error) return {success:false,error:"Failed to fetch hostel stock"};
      return {success:true,action:"GET_STOCK",hostel_id:hid,stock:data??[]};
    }
    case "REVIEW_ORDER": return await hReviewPlain(sup, body);
    case "CREATE_ORDER": return await hCreate(sup, body);
    // Also support Flow actions via plain for testing (action-primary routing)
    case "BUILD_CART": {
      const sess=getSession(body.flow_token||"test-plain");
      const r=await flowBuildCart(sup, body, sess);
      return {success:true,action:"BUILD_CART",...r};
    }
    case "CONTINUE_TO_ROOM": {
      const sess=getSession(body.flow_token||"test-plain");
      const r=await flowContinueToRoom(sup, body, sess);
      return {success:true,action:"CONTINUE_TO_ROOM",...r};
    }
    case "FLOW_GET_HOSTELS": {
      const r=await flowGetHostels(sup);
      return {success:true,action:"FLOW_GET_HOSTELS",...r};
    }
    case "FLOW_GET_CATEGORIES": {
      const sess=getSession(body.flow_token||"test-flow-cat");
      const r=await flowGetCategories(sup, body, sess);
      return {success:true,action:"FLOW_GET_CATEGORIES",...r};
    }
    case "FLOW_GET_PRODUCTS": {
      const sess=getSession(body.flow_token||"test-flow-prod");
      // pre-seed hostel if provided
      if(body.hostel_name) sess.hostelName=body.hostel_name;
      if(body.hostel_id) sess.hostelId=body.hostel_id;
      const r=await flowGetProducts(sup, body, sess);
      return {success:true,action:"FLOW_GET_PRODUCTS",...r};
    }
    case "FLOW_BUILD_CART": {
      const sess=getSession(body.flow_token||"test-flow-cart");
      if(body.hostel_name) sess.hostelName=body.hostel_name;
      const r=await flowBuildCart(sup, body, sess);
      return {success:true,action:"FLOW_BUILD_CART",...r};
    }
    case "FLOW_REVIEW": {
      const sess=getSession(body.flow_token||"test-flow-review");
      // If cart not in session, seed it from body
      if(body.selected_products && !sess.cart) {
        const tmp=await flowBuildCart(sup, {selected_products: body.selected_products, hostel_name: body.hostel_name}, sess);
      }
      if(body.hostel_name) sess.hostelName=body.hostel_name;
      const r=await flowReviewOrder(sup, body, sess);
      return {success:true,action:"FLOW_REVIEW",...r};
    }
    default: return {success:false,error:`Unknown action: ${a}`};
  }
}

// ── serve ──
serve(async (req)=>{
  if(req.method==="OPTIONS") return new Response(null,{headers:corsHeaders,status:200});
  if(req.method!=="POST") return new Response(JSON.stringify({success:false,error:"Method not allowed"}),{status:405,headers:{...corsHeaders,"Content-Type":"application/json"}});
  try{
    const SUPABASE_URL=Deno.env.get("SUPABASE_URL");
    const SRK=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")??Deno.env.get("SERVICE_ROLE_KEY")??Deno.env.get("COLLEGECART_SERVICE_ROLE_KEY");
    const WHATSAPP_PRIVATE_KEY=Deno.env.get("WHATSAPP_PRIVATE_KEY");
    if(!SUPABASE_URL||!SRK){
      console.error("[wf] missing env",{url:!!SUPABASE_URL,key:!!SRK});
      return new Response(JSON.stringify({success:false,error:"Server configuration error"}),{status:500,headers:{...corsHeaders,"Content-Type":"application/json"}});
    }
    const sup=createClient(SUPABASE_URL, SRK, {auth:{persistSession:false}});
    let body:any;
    try{ body=await req.json(); }catch{ return new Response(JSON.stringify({success:false,error:"Invalid JSON body"}),{status:400,headers:{...corsHeaders,"Content-Type":"application/json"}}); }

    const isMeta=typeof body.encrypted_flow_data==="string"&&typeof body.encrypted_aes_key==="string"&&typeof body.initial_vector==="string";
    if(isMeta){
      if(!WHATSAPP_PRIVATE_KEY){
        console.error("[wf] WHATSAPP_PRIVATE_KEY missing for encrypted request");
        return new Response(JSON.stringify({success:false,error:"Server configuration error"}),{status:500,headers:{...corsHeaders,"Content-Type":"application/json"}});
      }
      let priv:CryptoKey;
      try{ priv=await importPrivateKey(WHATSAPP_PRIVATE_KEY); }catch(e){ console.error("[wf] priv import",(e as Error).message); return new Response(JSON.stringify({success:false,error:"Encryption configuration error"}),{status:500,headers:{...corsHeaders,"Content-Type":"application/json"}}); }
      let dec:{req:any;aesKey:CryptoKey;iv:Uint8Array};
      try{ dec=await decryptFlowRequest(priv, body); }catch(e){ console.error("[wf] decrypt",(e as Error).message); return new Response(JSON.stringify({success:false,error:"Decryption failed"}),{status:421,headers:{...corsHeaders,"Content-Type":"application/json"}}); }
      console.log("[wf] Meta Flow",{action:dec.req.action,screen:dec.req.screen,version:dec.req.version});
      // Meta health-check ping — must be handled before normal routing and encrypted with same AES key/IV
      if(dec.req.action==="ping"){
        const pingResp={data:{status:"active"}};
        try{
          const enc=await encryptFlowResponse(dec.aesKey, dec.iv, pingResp);
          return new Response(enc,{status:200,headers:{...corsHeaders,"Content-Type":"text/plain"}});
        }catch(e){ console.error("[wf] ping encrypt",(e as Error).message); return new Response(JSON.stringify({success:false,error:"Encryption error"}),{status:500,headers:{...corsHeaders,"Content-Type":"application/json"}}); }
      }
      let flowResp:any;
      try{ flowResp=await routeFlow(sup, dec.req); }catch(e){ console.error("[wf] flow action",(e as Error).message); flowResp={screen: dec.req.screen || "HOSTEL", data:{error:"Internal processing error"}}; }
      // Safe diagnostic for CONFIRMATION — verify exact object sent to Meta (no double-stringify, correct nesting)
      if(flowResp?.screen==="CONFIRMATION"){
        console.log("[wf-debug] CONFIRMATION final response", {
          screen: flowResp.screen,
          dataKeys: Object.keys(flowResp.data ?? {}),
          hasConfirmationMessage: typeof flowResp.data?.confirmation_message === "string",
          confirmationMessageType: typeof flowResp.data?.confirmation_message,
          isDataObject: typeof flowResp.data === "object" && flowResp.data !== null && !Array.isArray(flowResp.data),
          hasNestedData: !!(flowResp.data as any)?.data,
          hasOrderId: !!flowResp.data?.order_id,
          hasTotalAmount: !!flowResp.data?.total_amount
        });
      }
      try{
        const enc=await encryptFlowResponse(dec.aesKey, dec.iv, flowResp);
        return new Response(enc,{status:200,headers:{...corsHeaders,"Content-Type":"text/plain"}});
      }catch(e){ console.error("[wf] encrypt",(e as Error).message); return new Response(JSON.stringify({success:false,error:"Encryption error"}),{status:500,headers:{...corsHeaders,"Content-Type":"application/json"}}); }
    }
    let out:any;
    try{ out=await routePlain(sup, body); }catch(e){ console.error("[wf] plain",(e as Error).message); out={success:false,error:"Internal processing error"}; }
    return new Response(JSON.stringify(out),{status:200,headers:{...corsHeaders,"Content-Type":"application/json"}});
  }catch(e){
    console.error("[wf] unhandled",e);
    return new Response(JSON.stringify({success:false,error:"Internal server error"}),{status:500,headers:{...corsHeaders,"Content-Type":"application/json"}});
  }
});
