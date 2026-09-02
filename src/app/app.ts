import { AfterViewChecked, Component, ElementRef, OnDestroy, QueryList, ViewChildren, computed, inject, signal } from '@angular/core';
import { Chart, ChartConfiguration, registerables } from 'chart.js';
import { FormsModule } from '@angular/forms';
import { N8nService } from './core/services/n8n.service';
import { DashboardResponse, MetricCard, QueryResult, ResponsePart } from './core/models/dashboard.models';

Chart.register(...registerables);

@Component({ selector: 'app-root', imports: [FormsModule], templateUrl: './app.html', styleUrl: './app.css' })
export class App implements AfterViewChecked, OnDestroy {
  private readonly n8n = inject(N8nService);
  @ViewChildren('chartCanvas') private readonly chartCanvases!: QueryList<ElementRef<HTMLCanvasElement>>;
  private chartInstances: Chart[] = [];
  private renderedChartSignature = '';
  private chartVersion = 0;
  protected question = '';
  protected loading = signal(false);
  protected error = signal('');
  protected result = signal<QueryResult | null>(null);
  protected recent = signal<string[]>([]);
  protected shareStatus = signal('');
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
  protected async sharePage(): Promise<void> {
    this.shareStatus.set('');
    const shareData = {
      title: 'Nairobi City County Green & Clean AI Data Assistant',
      text: 'Explore verified insights from Nairobi City County Green & Clean field reports.',
      url: window.location.href,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
        return;
      }

      await navigator.clipboard.writeText(shareData.url);
      this.shareStatus.set('Link copied to your clipboard.');
    } catch (error) {
      if ((error as DOMException).name !== 'AbortError') {
        this.shareStatus.set('Unable to share the link. Please copy it from your browser address bar.');
      }
    }
  }
  protected onEnter(event: Event): void { if (!(event instanceof KeyboardEvent) || !event.shiftKey) { event.preventDefault(); this.ask(); } }
  ngAfterViewChecked(): void { this.renderCharts(); }
  ngOnDestroy(): void { this.destroyCharts(); }
  private normalise(value: unknown): QueryResult {
    const raw = this.responseBody(value);
    const response = raw as DashboardResponse;
    const answer = response.output || response.answer || (typeof raw['message'] === 'string' ? raw['message'] : 'The workflow returned no readable answer.');
    const parts = this.extractChartParts(answer);
    const hasChartBlock = parts.some(part => part.type === 'chart');
    const chartUrl = !hasChartBlock && response.hasChart === true && typeof response.chartUrl === 'string' && response.chartUrl ? response.chartUrl : null;
    return { answer: parts.filter((part): part is Extract<ResponsePart, { type: 'text' }> => part.type === 'text').map(part => part.content).join('\n\n'), parts, chartVersion: ++this.chartVersion, chartUrl, source: response.source_used || 'Nairobi Green & Clean data', verified_facts: response.verified_facts ?? raw['facts'] ?? null, insights: Array.isArray(response.insights) ? response.insights : [] };
  }
  private responseBody(value: unknown): Record<string, unknown> {
    const candidate = Array.isArray(value) ? value[0] : value;
    if (!candidate || typeof candidate !== 'object') return {};
    const body = candidate as Record<string, unknown>;
    if ('output' in body || 'answer' in body || 'message' in body) return body;
    const nested = body['data'] ?? body['body'] ?? body['json'];
    return nested === candidate ? body : this.responseBody(nested);
  }
  private extractChartParts(answer: string): ResponsePart[] {
    const parts: ResponsePart[] = [];
    const pattern = /```chartjs\s*([\s\S]*?)```/gi;
    let cursor = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(answer))) {
      const config = this.parseChartConfig(match[1]);
      if (!config) continue;
      this.addTextPart(parts, answer.slice(cursor, match.index));
      parts.push({ type: 'chart', config });
      cursor = match.index + match[0].length;
    }
    this.addTextPart(parts, answer.slice(cursor));
    return parts.length ? parts : [{ type: 'text', content: this.removeChartMarkdown(answer) }];
  }
  private addTextPart(parts: ResponsePart[], text: string): void { const content = this.removeChartMarkdown(text); if (content) parts.push({ type: 'text', content }); }
  private parseChartConfig(json: string): ChartConfiguration | null {
    try {
      const config = JSON.parse(json) as ChartConfiguration;
      return ['bar', 'line', 'pie', 'doughnut'].includes(config.type) && Array.isArray(config.data?.labels) && Array.isArray(config.data?.datasets) ? config : null;
    } catch { return null; }
  }
  private removeChartMarkdown(answer: string): string {
  return answer
    // Remove Markdown image links
    .replace(/!?\[[^\]]*\]\([^)]*\)/g, '')
    // Remove QuickChart URLs
    .replace(/https?:\/\/quickchart\.io\/chart[^\s]*/gi, '')
    // Remove URL-encoded Chart.js payload that leaks into the message
    .replace(/%22%2C%22data%22%3A[\s\S]*?(?=\n|$)/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
  private renderCharts(): void {
    const configs = this.result()?.parts.filter((part): part is Extract<ResponsePart, { type: 'chart' }> => part.type === 'chart').map(part => part.config) ?? [];
    const signature = String(this.result()?.chartVersion ?? 0);
    if (signature === this.renderedChartSignature || this.chartCanvases.length !== configs.length) return;
    this.destroyCharts();
    this.renderedChartSignature = signature;
    this.chartInstances = this.chartCanvases.toArray().map((canvas, index) => new Chart(canvas.nativeElement, configs[index]));
  }
  private destroyCharts(): void { this.chartInstances.forEach(chart => chart.destroy()); this.chartInstances = []; this.renderedChartSignature = ''; }
  private toCards(facts: unknown): MetricCard[] {
    if (!facts || typeof facts !== 'object') return [];
    const source = facts as Record<string, unknown>; const candidates = Array.isArray(source['cards']) ? source['cards'] : this.findMetrics(source);
    return candidates.slice(0, 4).map((item: unknown, index: number) => { const row = item as Record<string, unknown>; const value = row['value'] ?? row['total'] ?? row['result'] ?? item; const label = String(row['label'] ?? row['metric'] ?? row['name'] ?? `Verified indicator ${index + 1}`); return { label: this.pretty(label), value: this.format(value), icon: ['⌁', '♧', '◈', '◌'][index] }; }).filter(card => card.value !== '—');
  }
  private findMetrics(source: Record<string, unknown>): unknown[] { const primary = source['primary']; if (primary && typeof primary === 'object') return [primary]; return Object.entries(source).filter(([, value]) => typeof value === 'number' || typeof value === 'string').map(([label, value]) => ({ label, value })); }
  private pretty(value: string): string { return value.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase()); }
  private format(value: unknown): string { if (typeof value === 'number') return new Intl.NumberFormat('en-KE', { maximumFractionDigits: 2 }).format(value); return value == null || value === '' ? '—' : String(value); }
}
