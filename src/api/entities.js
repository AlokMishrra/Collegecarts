import { base44 } from './base44Client';

// Re-export all entities for backward compatibility
export const Query = base44.entities.Product; // fallback

// Auth
export const User = {
  me: base44.auth.me,
  login: base44.auth.redirectToLogin,
  logout: base44.auth.logout,
  filter: base44.entities.User.filter,
  list: base44.entities.User.list,
  update: base44.entities.User.update,
};
