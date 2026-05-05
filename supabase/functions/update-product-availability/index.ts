import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log("=== Updating Product Availability Based on Schedule ===");

    // Get all products that have scheduled availability
    const { data: products, error: fetchError } = await supabase
      .from('products')
      .select('id, name, available_from, available_to, is_available')
      .not('available_from', 'is', null)
      .not('available_to', 'is', null);

    if (fetchError) {
      console.error("Error fetching products:", fetchError);
      return new Response(JSON.stringify({ error: fetchError.message }), { status: 500 });
    }

    if (!products || products.length === 0) {
      console.log("No products with scheduled availability found");
      return new Response(JSON.stringify({ message: "No scheduled products" }), { status: 200 });
    }

    console.log(`Found ${products.length} products with scheduled availability`);

    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes(); // Current time in minutes

    let updatedCount = 0;
    const updates = [];

    for (const product of products) {
      try {
        // Parse available_from (format: "HH:MM")
        const [fromHour, fromMin] = product.available_from.split(':').map(Number);
        const availableFromMinutes = fromHour * 60 + fromMin;

        // Parse available_to (format: "HH:MM")
        const [toHour, toMin] = product.available_to.split(':').map(Number);
        const availableToMinutes = toHour * 60 + toMin;

        let shouldBeAvailable = false;

        // Check if current time is within available range
        if (availableFromMinutes <= availableToMinutes) {
          // Normal case: e.g., 09:00 to 18:00
          shouldBeAvailable = currentTime >= availableFromMinutes && currentTime <= availableToMinutes;
        } else {
          // Overnight case: e.g., 22:00 to 02:00
          shouldBeAvailable = currentTime >= availableFromMinutes || currentTime <= availableToMinutes;
        }

        // Update product if availability status needs to change
        if (product.is_available !== shouldBeAvailable) {
          updates.push(
            supabase
              .from('products')
              .update({ is_available: shouldBeAvailable })
              .eq('id', product.id)
          );

          console.log(`${product.name}: ${product.is_available ? 'Available' : 'Unavailable'} → ${shouldBeAvailable ? 'Available' : 'Unavailable'}`);
          updatedCount++;
        }
      } catch (error) {
        console.error(`Error processing product ${product.id}:`, error);
      }
    }

    // Execute all updates in parallel
    if (updates.length > 0) {
      await Promise.all(updates);
      console.log(`✅ Updated ${updatedCount} products`);
    } else {
      console.log("No products needed updating");
    }

    return new Response(
      JSON.stringify({
        success: true,
        checked: products.length,
        updated: updatedCount,
        timestamp: now.toISOString()
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in update-product-availability:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
