import { Injectable } from '@angular/core';
import { Conversation } from '../models/dashboard.models';

const MAX_RECENT_CONVERSATIONS = 20;

@Injectable({ providedIn: 'root' })
export class ConversationStorageService {
  load(userId: string): Conversation[] {
    try {
      const conversations = JSON.parse(localStorage.getItem(this.storageKey(userId)) ?? '[]') as Conversation[];
      return conversations
        .filter(conversation => conversation.userId === userId)
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(0, MAX_RECENT_CONVERSATIONS);
    } catch {
      return [];
    }
  }

  save(userId: string, conversations: Conversation[]): void {
    const userConversations = conversations
      .filter(conversation => conversation.userId === userId)
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, MAX_RECENT_CONVERSATIONS);
    localStorage.setItem(this.storageKey(userId), JSON.stringify(userConversations));
  }

  private storageKey(userId: string): string {
    return `naisafi_conversations_${userId}`;
  }
}
