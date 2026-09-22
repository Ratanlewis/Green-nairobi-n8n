import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { App } from './app';
import { ConversationStorageService } from './core/services/conversation-storage.service';
import { UserIdentityService } from './core/services/user-identity.service';

describe('NaiSafi chat history', () => {
  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({ imports: [App], providers: [provideHttpClient()] }).compileComponents();
  });

  it('creates and reuses an anonymous browser user ID', () => {
    const identity = TestBed.inject(UserIdentityService);
    const userId = identity.getUserId();
    expect(userId).toBeTruthy();
    expect(identity.getUserId()).toBe(userId);
  });

  it('keeps each user’s conversations in a separate storage key', () => {
    const storage = TestBed.inject(ConversationStorageService);
    const conversation = {
      id: 'conversation-a', sessionId: 'conversation-a', userId: 'user-a', title: 'Trees in July',
      createdAt: 1, updatedAt: 1, messages: []
    };
    storage.save('user-a', [conversation]);
    expect(storage.load('user-a')).toEqual([conversation]);
    expect(storage.load('user-b')).toEqual([]);
  });

  it('shows the welcome screen for a new chat', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('h1')?.textContent).toContain('NaiSafi');
  });
});
