import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';

declare global {
  interface Window { __NAISAFI_CONFIG__?: { webhookUrl?: string }; }
}

@Injectable({ providedIn: 'root' })
export class N8nService {
  constructor(private readonly http: HttpClient) {}

  ask(question: string, sessionId: string, userId: string): Observable<unknown> {
    const webhookUrl = window.__NAISAFI_CONFIG__?.webhookUrl;
    if (!webhookUrl) return throwError(() => new Error('NaiSafi webhook URL is not configured.'));
    return this.http.post<unknown>(webhookUrl, { chatInput: question, sessionId, userId });
  }
}
