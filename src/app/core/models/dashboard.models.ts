import { ChartConfiguration } from 'chart.js';

export interface DashboardResponse { output?: string; answer?: string; chartUrl?: string; hasChart?: boolean; source_used?: string; verified_facts?: unknown; insights?: unknown[]; }
export type ResponsePart = { type: 'text'; content: string } | { type: 'chart'; config: ChartConfiguration };
export interface QueryResult { answer: string; parts: ResponsePart[]; chartVersion: number; chartUrl: string | null; source: string; verified_facts: unknown; insights: unknown[]; }
export interface MetricCard { label: string; value: string; icon: string; }
