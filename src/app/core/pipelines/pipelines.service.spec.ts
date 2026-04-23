/**
 * Unit tests for PipelinesService — GitLab API proxy talker. Uses
 * HttpClientTesting to assert the URL shape + parameters without
 * hitting the actual docker-api.mjs proxy.
 */
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { PipelinesService, PROJECTS } from './pipelines.service';

// eslint-disable-next-line max-lines-per-function
describe('PipelinesService', () => {
  let service: PipelinesService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(PipelinesService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('PROJECTS', () => {
    it('exports url-encoded slugs for ui + service projects', () => {
      // Pinned: slugs must be URL-encoded (`%2F` for `/`) so they paste
      // directly into the GitLab REST path. Un-encoding silently breaks
      // the proxy (404s with no obvious cause).
      expect(PROJECTS.ui).toBe('mirador1%2Fmirador-ui');
      expect(PROJECTS.service).toBe('mirador1%2Fmirador-service');
    });
  });

  describe('proxyBase', () => {
    it('defaults to http://localhost:3333 (docker-api.mjs convention)', () => {
      expect(service.proxyBase()).toBe('http://localhost:3333');
    });

    it('is a writable signal (operator could re-point in a Settings panel)', () => {
      service.proxyBase.set('http://other:9999');
      expect(service.proxyBase()).toBe('http://other:9999');
    });
  });

  describe('list()', () => {
    it('builds the /projects/<slug>/pipelines URL with default per_page=20', () => {
      service.list('ui').subscribe();

      const req = httpMock.expectOne(
        'http://localhost:3333/gitlab/projects/mirador1%2Fmirador-ui/pipelines?per_page=20&order_by=id&sort=desc',
      );
      expect(req.request.method).toBe('GET');
      req.flush([]);
    });

    it('uses the service project slug when key is "service"', () => {
      service.list('service').subscribe();

      const req = httpMock.expectOne(
        (r) =>
          r.url.includes('mirador1%2Fmirador-service/pipelines') && r.url.includes('per_page=20'),
      );
      req.flush([]);
    });

    it('respects custom perPage parameter', () => {
      service.list('ui', 50).subscribe();

      httpMock.expectOne((r) => r.url.includes('per_page=50')).flush([]);
    });

    it('respects updated proxyBase signal', () => {
      service.proxyBase.set('http://custom:8888');

      service.list('ui').subscribe();

      const req = httpMock.expectOne((r) =>
        r.url.startsWith('http://custom:8888/gitlab/projects/'),
      );
      req.flush([]);
    });

    it('order_by=id + sort=desc are pinned (newest pipeline first)', () => {
      // Pinned because the dashboard relies on the first item being the
      // most-recent pipeline. Switching to default sort (chronological)
      // would silently break the "latest run" badge.
      service.list('ui').subscribe();

      httpMock
        .expectOne((r) => r.url.includes('order_by=id') && r.url.includes('sort=desc'))
        .flush([]);
    });

    it('parses GitlabPipeline fields verbatim from response', () => {
      const fakePipeline = {
        id: 12345,
        iid: 678,
        status: 'success',
        ref: 'main',
        sha: 'abc123def',
        web_url: 'https://gitlab.com/mirador1/mirador-ui/-/pipelines/12345',
        created_at: '2026-04-23T05:00:00Z',
        updated_at: '2026-04-23T05:15:00Z',
        started_at: '2026-04-23T05:00:30Z',
        finished_at: '2026-04-23T05:15:00Z',
        duration: 870,
        source: 'push',
      };

      let received: unknown = null;
      service.list('ui').subscribe((data) => (received = data));

      httpMock.expectOne((r) => r.url.includes('/pipelines?')).flush([fakePipeline]);

      expect(received).toEqual([fakePipeline]);
    });
  });

  describe('jobs()', () => {
    it('builds the /pipelines/<id>/jobs URL with per_page=100', () => {
      service.jobs('ui', 12345).subscribe();

      const req = httpMock.expectOne(
        'http://localhost:3333/gitlab/projects/mirador1%2Fmirador-ui/pipelines/12345/jobs?per_page=100',
      );
      expect(req.request.method).toBe('GET');
      req.flush([]);
    });

    it('per_page=100 is hardcoded (one fetch covers most pipelines)', () => {
      // Pinned: 100 is GitLab's default max per_page; rare pipelines have
      // > 100 jobs so this keeps the call shape simple. If we ever need
      // pagination, this test fails first → forcing a deliberate change.
      service.jobs('service', 999).subscribe();

      httpMock.expectOne((r) => r.url.includes('per_page=100')).flush([]);
    });
  });
});
