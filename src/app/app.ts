import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { N8nService } from './core/services/n8n.service';
import { DashboardResponse, MetricCard, QueryResult } from './core/models/dashboard.models';

@Component({ selector: 'app-root', imports: [FormsModule], templateUrl: './app.html', styleUrl: './app.css' })
export class App {
  private readonly n8n = inject(N8nService);
  protected question = '';
  protected loading = signal(false);
  protected error = signal('');
  protected result = signal<QueryResult | null>(null);
  protected recent = signal<string[]>([]);
  protected readonly hasResponse = computed(() => !!this.result());
  protected readonly scorecards = computed<MetricCard[]>(() => this.toCards(this.result()?.verified_facts));

  protected ask(question = this.question): void {
    const query = question.trim(); if (!query || this.loading()) return;
    this.question = query; this.loading.set(true); this.error.set('');
    this.n8n.ask(query).subscribe({
      next: response => { this.result.set(this.normalise(response)); this.recent.update(items => [query, ...items.filter(item => item !== query)].slice(0, 5)); this.loading.set(false); },
      error: () => { this.error.set('We could not reach the data assistant. Check the configured n8n webhook URL and try again.'); this.loading.set(false); },
    });
  }
  protected runRecent(query: string): void { this.question = query; this.ask(query); }
  protected onEnter(event: Event): void { if (!(event instanceof KeyboardEvent) || !event.shiftKey) { event.preventDefault(); this.ask(); } }
  private normalise(value: DashboardResponse): QueryResult {
    const raw = value as Record<string, unknown>;
    return { answer: value.output || value.answer || (typeof raw['message'] === 'string' ? raw['message'] : 'The workflow returned no readable answer.'), source: value.source_used || 'Nairobi Green & Clean data', verified_facts: value.verified_facts ?? raw['facts'] ?? null, insights: Array.isArray(value.insights) ? value.insights : [] };
  }
  private toCards(facts: unknown): MetricCard[] {
    if (!facts || typeof facts !== 'object') return [];
    const source = facts as Record<string, unknown>; const candidates = Array.isArray(source['cards']) ? source['cards'] : this.findMetrics(source);
    return candidates.slice(0, 4).map((item: unknown, index: number) => { const row = item as Record<string, unknown>; const value = row['value'] ?? row['total'] ?? row['result'] ?? item; const label = String(row['label'] ?? row['metric'] ?? row['name'] ?? `Verified indicator ${index + 1}`); return { label: this.pretty(label), value: this.format(value), icon: ['⌁', '♧', '◈', '◌'][index] }; }).filter(card => card.value !== '—');
  }
  private findMetrics(source: Record<string, unknown>): unknown[] { const primary = source['primary']; if (primary && typeof primary === 'object') return [primary]; return Object.entries(source).filter(([, value]) => typeof value === 'number' || typeof value === 'string').map(([label, value]) => ({ label, value })); }
  private pretty(value: string): string { return value.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase()); }
  private format(value: unknown): string { if (typeof value === 'number') return new Intl.NumberFormat('en-KE', { maximumFractionDigits: 2 }).format(value); return value == null || value === '' ? '—' : String(value); }
}
