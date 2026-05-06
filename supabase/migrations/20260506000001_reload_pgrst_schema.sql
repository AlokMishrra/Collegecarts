-- Force PostgREST to reload its schema cache.
-- This makes the reserve_stock, deliver_stock, release_stock functions
-- visible to the REST API (/rest/v1/rpc/...) immediately.
NOTIFY pgrst, 'reload schema';
