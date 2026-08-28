export interface DashboardResponse { output?: string; answer?: string; source_used?: string; verified_facts?: unknown; insights?: unknown[]; }
export interface QueryResult { answer: string; source: string; verified_facts: unknown; insights: unknown[]; }
export interface MetricCard { label: string; value: string; icon: string; }
