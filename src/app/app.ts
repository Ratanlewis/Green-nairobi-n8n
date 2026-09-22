import { AfterViewChecked, Component, ElementRef, OnDestroy, QueryList, ViewChildren, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Chart, ChartConfiguration, registerables } from 'chart.js';
import { N8nService } from './core/services/n8n.service';
import { ConversationStorageService } from './core/services/conversation-storage.service';
import { UserIdentityService } from './core/services/user-identity.service';
import { ChatMessage, Conversation, N8nResponse } from './core/models/dashboard.models';

Chart.register(...registerables);
@Component({ selector: 'app-root', imports: [FormsModule], templateUrl: './app.html', styleUrl: './app.css' })
export class App implements AfterViewChecked, OnDestroy {
  private readonly n8n = inject(N8nService);
  private readonly userIdentity = inject(UserIdentityService);
  private readonly conversationStorage = inject(ConversationStorageService);
  @ViewChildren('chartCanvas') private readonly chartCanvases!: QueryList<ElementRef<HTMLCanvasElement>>;
  @ViewChildren('messageInput') private readonly inputs!: QueryList<ElementRef<HTMLTextAreaElement>>;
  private charts: Chart[] = [];
  private renderedChartKey = '';
  protected readonly userId = this.userIdentity.getUserId();
  private readonly conversations = signal<Conversation[]>(this.conversationStorage.load(this.userId));
  private draftConversationId = crypto.randomUUID();
  protected readonly activeConversation = signal<Conversation | null>(null);
  protected readonly sidebarOpen = signal(false);
  protected readonly loading = signal(false);
  protected readonly error = signal('');
  protected question = '';

  protected get recentConversations(): Conversation[] { return [...this.conversations()].sort((a, b) => b.updatedAt - a.updatedAt); }

  protected send(question = this.question): void {
    const text = question.trim();
    if (!text || this.loading()) return;
    let conversation = this.activeConversation();
    if (!conversation) conversation = this.createConversation(text);
    const pending: ChatMessage = { ...this.message('assistant', ''), pending: true };
    conversation = { ...conversation, updatedAt: Date.now(), messages: [...conversation.messages, this.message('user', text), pending] };
    this.setActive(conversation);
    this.question = ''; this.error.set(''); this.loading.set(true); this.sidebarOpen.set(false);
    this.resizeAfterRender();
    this.n8n.ask(text, conversation.sessionId, this.userId).subscribe({
      next: response => {
        const current = this.activeConversation();
        if (!current || current.id !== conversation!.id) return;
        this.setActive({ ...current, updatedAt: Date.now(), messages: [...current.messages.slice(0, -1), this.responseToMessage(response)] });
        this.loading.set(false);
      },
      error: () => {
        const current = this.activeConversation();
        if (!current || current.id !== conversation!.id) return;
        this.setActive({ ...current, updatedAt: Date.now(), messages: [...current.messages.slice(0, -1), this.message('assistant', "Sorry, I couldn't process that request. Please try again.")] });
        this.error.set('Sorry, I couldn’t process that request. Please try again.'); this.loading.set(false);
      }
    });
  }

  protected newChat(): void { this.draftConversationId = crypto.randomUUID(); this.activeConversation.set(null); this.question = ''; this.error.set(''); this.sidebarOpen.set(false); setTimeout(() => { this.resizeInput(this.inputs.first?.nativeElement); this.inputs.first?.nativeElement.focus(); }); }
  protected openConversation(conversation: Conversation): void { this.draftConversationId = crypto.randomUUID(); this.activeConversation.set(conversation); this.error.set(''); this.sidebarOpen.set(false); }
  protected deleteConversation(conversation: Conversation, event: MouseEvent): void {
    event.stopPropagation();
    this.conversations.update(items => items.filter(item => item.id !== conversation.id));
    this.conversationStorage.save(this.userId, this.conversations());
    if (this.activeConversation()?.id === conversation.id) {
      this.loading.set(false);
      this.newChat();
    }
  }
  protected retry(): void { const question = [...(this.activeConversation()?.messages ?? [])].reverse().find(item => item.role === 'user'); if (question) this.send(question.content); }
  protected onKeydown(event: KeyboardEvent): void { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); this.send(); } }
  protected resizeInput(textarea?: HTMLTextAreaElement): void {
    if (!textarea) return;
    textarea.style.height = 'auto';
    const maxHeight = Number.parseFloat(getComputedStyle(textarea).maxHeight) || 150;
    textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeight)}px`;
  }

  protected markdown(content: string): string {
    const escape = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    let html = escape(content);
    html = html.replace(/^### (.*)$/gm, '<h3>$1</h3>').replace(/^## (.*)$/gm, '<h2>$1</h2>');
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\*(.+?)\*/g, '<em>$1</em>').replace(/`([^`]+)`/g, '<code>$1</code>');
    html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
    html = this.tables(html);
    html = html.replace(/^\s*[-*] (.+)$/gm, '<li>$1</li>').replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');
    return html.split(/\n{2,}/).map(part => /<(h[23]|ul|ol)/.test(part) ? part : `<p>${part.replace(/\n/g, '<br>')}</p>`).join('');
  }
  private tables(html: string): string {
    return html.replace(/(^\|.*\|\n\|(?:\s*:?-+:?\s*\|)+\n)(\|.*\|(?:\n\|.*\|)*)/gm, (match) => {
      const rows = match.trim().split('\n').filter(row => !/^\|(?:\s*:?-+:?\s*\|)+$/.test(row));
      const cells = (row: string) => row.split('|').slice(1, -1).map(cell => cell.trim());
      const [head, ...body] = rows.map(cells);
      return `<table><thead><tr>${head.map(cell => `<th>${cell}</th>`).join('')}</tr></thead><tbody>${body.map(row => `<tr>${row.map(cell => `<td>${cell}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
    });
  }
  ngAfterViewChecked(): void { this.renderCharts(); }
  ngOnDestroy(): void { this.destroyCharts(); }

  private createConversation(firstQuestion: string): Conversation {
    const now = Date.now();
    const id = this.draftConversationId;
    this.draftConversationId = crypto.randomUUID();
    return { id, sessionId: id, userId: this.userId, title: this.createTitle(firstQuestion), createdAt: now, updatedAt: now, messages: [] };
  }
  private createTitle(question: string): string { const maxLength = 45; return question.length > maxLength ? `${question.slice(0, maxLength)}...` : question; }
  private setActive(conversation: Conversation): void {
    this.activeConversation.set(conversation);
    const userConversations = [conversation, ...this.conversations().filter(item => item.id !== conversation.id && item.userId === this.userId)];
    this.conversations.set(userConversations.slice(0, 20));
    this.conversationStorage.save(this.userId, this.conversations());
  }
  private responseToMessage(value: unknown): ChatMessage { const raw = this.body(value) as N8nResponse; const output = raw.output || raw.answer || raw.message || 'I received the request, but no readable answer was returned.'; return { ...this.message('assistant', this.removeChartConfig(output)), chartUrl: raw.hasChart && raw.chartUrl ? raw.chartUrl : null, chartConfig: this.chartConfig(output) }; }
  private body(value: unknown): Record<string, unknown> { const candidate = Array.isArray(value) ? value[0] : value; if (!candidate || typeof candidate !== 'object') return {}; const record = candidate as Record<string, unknown>; return record['output'] || record['answer'] || record['message'] ? record : this.body(record['data'] ?? record['body'] ?? record['json']); }
  private chartConfig(output: string): ChartConfiguration | null { const match = /```chartjs\s*([\s\S]*?)```/i.exec(output); if (!match) return null; try { const config = JSON.parse(match[1]) as ChartConfiguration; return config.type && config.data ? config : null; } catch { return null; } }
  private removeChartConfig(output: string): string {
    return output
      .replace(/```chartjs\s*[\s\S]*?```/gi, '')
      .replace(/\[[^\]]*\]\(https?:\/\/(?:www\.)?quickchart\.io\/chart\)(?:\?[^\s]*)?/gi, '')
      .replace(/!?\[[^\]]*\]\(https?:\/\/(?:www\.)?quickchart\.io\/chart[^)]*\)/gi, '')
      .replace(/https?:\/\/(?:www\.)?quickchart\.io\/chart[^\s<]*/gi, '')
      .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }
  private resizeAfterRender(): void { setTimeout(() => this.resizeInput(this.inputs.first?.nativeElement)); }
  private renderCharts(): void { const messages = this.activeConversation()?.messages.filter(message => message.chartConfig) ?? []; const key = messages.map(message => message.id).join(','); if (key === this.renderedChartKey || this.chartCanvases.length !== messages.length) return; this.destroyCharts(); this.renderedChartKey = key; this.charts = this.chartCanvases.toArray().map((canvas, index) => new Chart(canvas.nativeElement, messages[index].chartConfig!)); }
  private destroyCharts(): void { this.charts.forEach(chart => chart.destroy()); this.charts = []; this.renderedChartKey = ''; }
  private message(role: ChatMessage['role'], content: string): ChatMessage { return { id: crypto.randomUUID(), role, content, createdAt: Date.now() }; }
}
