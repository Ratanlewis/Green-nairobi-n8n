import { Injectable } from '@angular/core';

const USER_ID_KEY = 'naisafi_user_id';

@Injectable({ providedIn: 'root' })
export class UserIdentityService {
  /** Replace this implementation with the authenticated user's ID when login is added. */
  getUserId(): string {
    const existingId = localStorage.getItem(USER_ID_KEY);
    if (existingId) return existingId;

    const userId = crypto.randomUUID();
    localStorage.setItem(USER_ID_KEY, userId);
    return userId;
  }
}
