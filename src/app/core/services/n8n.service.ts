import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { DashboardResponse } from '../models/dashboard.models';
// Set this once for the deployed n8n Chat Trigger / webhook endpoint.
export const N8N_WEBHOOK_URL = 'https://n8n.venturepal.africa/webhook/72dfdefb-3726-4e85-872a-8ffb224b0e22/chat';
@Injectable({ providedIn: 'root' })
export class N8nService {
  constructor(private readonly http: HttpClient) { }
  ask(query: string) { return this.http.post<DashboardResponse>(N8N_WEBHOOK_URL, { chatInput: query, sessionId: this.sessionId }); }
  private get sessionId(): string { const key = 'nairobi-ai-session'; const existing = localStorage.getItem(key); if (existing) return existing; const id = crypto.randomUUID(); localStorage.setItem(key, id); return id; }
}
