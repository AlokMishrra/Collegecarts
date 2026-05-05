/**
 * User entity — wraps Supabase Auth + users table
 */
import { supabase } from '@/lib/supabase';
import { Entity } from '@/lib/entity';

const UserEntity = new Entity('users');

export const User = {
  // Get current logged-in user (merges auth + profile)
  // Uses a simple cache to prevent excessive auth calls
  _userCache: null,
  _cacheTime: 0,
  _cacheDuration: 5000, // 5 seconds
  _pendingRequest: null, // Track in-flight requests

  async me() {
    try {
      // Return cached user if still valid
      const now = Date.now();
      if (this._userCache && (now - this._cacheTime) < this._cacheDuration) {
        return this._userCache;
      }

      // If there's already a request in flight, wait for it instead of making a new one
      if (this._pendingRequest) {
        return await this._pendingRequest;
      }

      // Create a new request and store it
      this._pendingRequest = this._fetchUser();
      
      try {
        const result = await this._pendingRequest;
        return result;
      } finally {
        // Clear pending request after it completes
        this._pendingRequest = null;
      }
    } catch (err) {
      console.error('User.me() error:', err);
      this._userCache = null;
      this._cacheTime = 0;
      this._pendingRequest = null;
      return null;
    }
  },

  async _fetchUser() {
    const now = Date.now();
    
    const { data: { user: authUser }, error } = await supabase.auth.getUser();
    if (error || !authUser) {
      this._userCache = null;
      this._cacheTime = 0;
      return null;
    }

    // Try to get user profile from database
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('*')
      .eq('id', authUser.id)
      .maybeSingle();

    if (profileError) {
      console.error('Error fetching profile:', profileError);
      this._userCache = null;
      this._cacheTime = 0;
      return null;
    }

    // If profile exists, cache and return it
    if (profile) {
      const userData = { ...profile, created_date: profile.created_at };
      this._userCache = userData;
      this._cacheTime = now;
      return userData;
    }

    // If no profile, create a basic one
    const newProfile = {
      id: authUser.id,
      email: authUser.email,
      phone: authUser.phone || authUser.user_metadata?.phone || null,
      full_name: authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || '',
      role: 'customer',
    };

    // Try to insert the profile
    const { data: created, error: insertError } = await supabase
      .from('users')
      .insert(newProfile)
      .select()
      .maybeSingle();

    if (insertError) {
      console.error('Error creating profile:', insertError);
      // Return basic profile even if insert fails
      const fallbackUser = { ...newProfile, created_at: new Date().toISOString(), created_date: new Date().toISOString() };
      this._userCache = fallbackUser;
      this._cacheTime = now;
      return fallbackUser;
    }

    const userData = created ? { ...created, created_date: created.created_at } : newProfile;
    this._userCache = userData;
    this._cacheTime = now;
    return userData;
  },

  // Clear the user cache (call after logout or profile updates)
  clearCache() {
    this._userCache = null;
    this._cacheTime = 0;
    this._pendingRequest = null;
  },

  // Sign out
  async logout() {
    this.clearCache(); // Clear cache before logout
    await supabase.auth.signOut();
    window.location.href = '/';
  },

  // Update current user's profile data
  async updateMyUserData(data) {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) {
        console.warn('User.updateMyUserData: Not authenticated');
        return data;
      }

      const { data: updated, error } = await supabase
        .from('users')
        .update({ ...data, updated_at: new Date().toISOString() })
        .eq('id', authUser.id)
        .select()
        .maybeSingle();

      if (error) {
        console.error('Error updating user:', error);
        return data;
      }
      
      // Clear cache after update
      this.clearCache();
      
      return updated ? { ...updated, created_date: updated.created_at } : data;
    } catch (err) {
      console.error('User.updateMyUserData error:', err);
      return data;
    }
  },

  // Filter users (admin use)
  async filter(filters = {}, orderBy = null, limit = null) {
    return UserEntity.filter(filters, orderBy, limit);
  },

  // List all users (admin use)
  async list(orderBy = null, limit = null) {
    return UserEntity.list(orderBy, limit);
  },

  // Update any user by id (admin use)
  async update(id, data) {
    return UserEntity.update(id, data);
  },
};
