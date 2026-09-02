import { TestBed } from '@angular/core/testing';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render the application title', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('AI Data Assistant');
  });

  it('renders a Greening Initiative chart and removes its Markdown syntax', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance as any;
    app.result.set(app.normalise({
      output: 'Kariobangi South recorded the highest number of trees planted.\n\n![Green & Clean Chart](https://example.com/greening-chart.png)',
      hasChart: true,
      chartUrl: 'https://example.com/greening-chart.png',
    }));

    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.answer')?.textContent).toContain('Kariobangi South recorded the highest number of trees planted.');
    expect(compiled.querySelector('.answer')?.textContent).not.toContain('![Green & Clean Chart]');
    expect((compiled.querySelector('.response-chart') as HTMLImageElement)?.src).toBe('https://example.com/greening-chart.png');
  });

  it('renders a Public Sensitization chart', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance as any;
    app.result.set(app.normalise({ output: 'Mathare conducted the most sensitization activities.', hasChart: true, chartUrl: 'https://example.com/sensitization-chart.png' }));

    fixture.detectChanges();
    expect((fixture.nativeElement.querySelector('.response-chart') as HTMLImageElement)?.src).toBe('https://example.com/sensitization-chart.png');
  });

  it('normalizes a Public Sensitization response returned in an n8n item array', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance as any;
    const result = app.normalise([{
      output: 'Mathare held 12 public sensitization activities.',
      source_used: 'Sensitization Programme',
      verified_facts: { primary: { label: 'activities', value: 12 } },
    }]);

    expect(result.answer).toBe('Mathare held 12 public sensitization activities.');
    expect(result.source).toBe('Sensitization Programme');
    expect(result.verified_facts).toEqual({ primary: { label: 'activities', value: 12 } });
  });

  it('extracts the supplied Chart.js block while preserving surrounding text', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance as any;
    const result = app.normalise({
      output: `Here it is again — 630 trees planted across all wards in July 2026, with Kariobangi South on top at 200.

\`\`\`chartjs
{
  "type": "bar",
  "data": {
    "labels": ["Kariobangi South", "Woodley/Kenyatta Golf Course", "Kariobangi North"],
    "datasets": [{ "label": "Trees Planted – July 2026", "data": [200, 150, 150], "borderRadius": 4 }]
  },
  "options": { "indexAxis": "y", "plugins": { "legend": { "display": false } } }
}
\`\`\`

Those five zero-planting wards are worth a proper look.`,
    });

    expect(result.answer).toContain('630 trees planted');
    expect(result.answer).toContain('Those five zero-planting wards');
    expect(result.answer).not.toContain('```chartjs');
    expect(result.parts.filter((part: any) => part.type === 'chart')[0].config.options.indexAxis).toBe('y');
  });

  it('leaves invalid Chart.js JSON as normal response text', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance as any;
    const result = app.normalise({ output: 'Summary\n```chartjs\n{ invalid JSON }\n```' });

    expect(result.parts).toEqual([{ type: 'text', content: 'Summary\n```chartjs\n{ invalid JSON }\n```' }]);
  });

  it('does not render a chart area for a text-only response', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance as any;
    app.result.set(app.normalise({ output: 'No chart is available for this answer.', hasChart: false }));

    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.response-chart')).toBeNull();
  });
});
