import { TestBed, ComponentFixture } from '@angular/core/testing';
import { InfoTipComponent } from './info-tip.component';

describe('InfoTipComponent — parsedLines', () => {
  let fixture: ComponentFixture<InfoTipComponent>;
  let cmp: InfoTipComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [InfoTipComponent] }).compileComponents();
    fixture = TestBed.createComponent(InfoTipComponent);
    cmp = fixture.componentInstance;
  });

  it('classifies an empty input as []', () => {
    cmp.text = '';
    expect(cmp.parsedLines()).toEqual([]);
  });

  it('renders a plain one-liner as a single text segment', () => {
    cmp.text = 'Live JVM and OS metrics.';
    const lines = cmp.parsedLines();
    expect(lines).toHaveLength(1);
    expect(lines[0]).toEqual({ kind: 'text', key: 'Live JVM and OS metrics.', value: '' });
  });

  it('detects bullets (- and •) and strips the marker', () => {
    cmp.text = '- First item\n• Second item\n* Third item';
    expect(cmp.parsedLines()).toEqual([
      { kind: 'bullet', key: 'First item', value: '' },
      { kind: 'bullet', key: 'Second item', value: '' },
      { kind: 'bullet', key: 'Third item', value: '' },
    ]);
  });

  it('splits newline-separated kv pairs into aligned rows', () => {
    cmp.text = 'Heap: jvm_memory_used / max\nCPU: process_cpu_usage\nThreads: jvm_threads_live';
    expect(cmp.parsedLines()).toEqual([
      { kind: 'kv', key: 'Heap', value: 'jvm_memory_used / max' },
      { kind: 'kv', key: 'CPU', value: 'process_cpu_usage' },
      { kind: 'kv', key: 'Threads', value: 'jvm_threads_live' },
    ]);
  });

  it('auto-splits prose like "Heap: X / Y. CPU: Z. Threads: W." into kv rows', () => {
    cmp.text =
      'Heap: jvm_memory_used_bytes{area=heap} / jvm_memory_max_bytes. CPU: process_cpu_usage (fraction). Threads: jvm_threads_live_threads.';
    const lines = cmp.parsedLines();
    expect(lines).toHaveLength(3);
    expect(lines[0].kind).toBe('kv');
    expect(lines[0].key).toBe('Heap');
    expect(lines[0].value).toBe('jvm_memory_used_bytes{area=heap} / jvm_memory_max_bytes');
    expect(lines[1].key).toBe('CPU');
    expect(lines[2].key).toBe('Threads');
  });

  it('keeps prose without label markers as a single text line', () => {
    cmp.text =
      'Bar chart showing requests/second. Computed by comparing http_server_requests_seconds_count between two polls.';
    const lines = cmp.parsedLines();
    expect(lines).toHaveLength(1);
    expect(lines[0].kind).toBe('text');
  });

  it('does not mis-classify a colon inside a URL as a kv row', () => {
    cmp.text = 'See https://example.com:8080/health for details.';
    const lines = cmp.parsedLines();
    expect(lines).toHaveLength(1);
    expect(lines[0].kind).toBe('text');
  });

  it('tolerates trailing whitespace and blank lines', () => {
    cmp.text = '  Heap: used  \n\n  CPU: high  \n';
    expect(cmp.parsedLines()).toEqual([
      { kind: 'kv', key: 'Heap', value: 'used' },
      { kind: 'kv', key: 'CPU', value: 'high' },
    ]);
  });
});
