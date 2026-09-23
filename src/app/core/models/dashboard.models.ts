import { ChartConfiguration } from 'chart.js';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: number;
  chartUrl?: string | null;
  chartConfig?: ChartConfiguration | null;
  pending?: boolean;
}

export interface Conversation {
  id: string;
  userId: string;
  sessionId: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: ChatMessage[];
}

export interface N8nResponse { output?: string; answer?: string; message?: string; chartUrl?: string; hasChart?: boolean; }
