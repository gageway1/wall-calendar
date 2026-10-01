import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { ToastErrorHandler, describeError } from './error-reporting';
import { ToastService } from './toast.service';

describe('describeError', () => {
  it('never produces [object Object]', () => {
    expect(describeError(new TypeError('x is undefined'))).toBe('TypeError: x is undefined');
    expect(
      describeError(new HttpErrorResponse({ status: 500, url: '/api/google/calendars' })),
    ).toBe('HTTP 500 /api/google/calendars');
    expect(describeError(new HttpErrorResponse({ status: 0, url: '/api/events' }))).toBe(
      'HTTP network /api/events',
    );
    expect(describeError('plain')).toBe('plain');
    expect(describeError({ reason: 'weird' })).toBe('{"reason":"weird"}');
    expect(describeError({})).toBe('Unknown error (Object)');
    expect(describeError(null)).toBe('null');
    expect(describeError(undefined)).toBe('undefined');
  });
});

describe('ToastErrorHandler', () => {
  let handler: ToastErrorHandler;
  let toasts: ToastService;
  const fetchSpy = vi.fn(() => Promise.resolve(new Response()));

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchSpy);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    fetchSpy.mockClear();
    TestBed.configureTestingModule({ providers: [ToastErrorHandler] });
    handler = TestBed.inject(ToastErrorHandler);
    toasts = TestBed.inject(ToastService);
  });

  afterEach(() => vi.unstubAllGlobals());

  it('skips HTTP errors (the interceptor already handled them)', () => {
    handler.handleError(new HttpErrorResponse({ status: 500, url: '/api/google/calendars' }));
    expect(toasts.visible().length).toBe(0);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('reports real bugs with a readable message and a friendly toast', () => {
    handler.handleError(new TypeError('boom'));
    expect(toasts.visible()[0].message).toBe('Oops! Something went wrong.');
    const body = JSON.parse(
      (fetchSpy.mock.calls[0] as unknown as [string, RequestInit])[1].body as string,
    );
    expect(body.message).toBe('TypeError: boom');
  });

  it('unwraps promise rejections', () => {
    handler.handleError({ rejection: new HttpErrorResponse({ status: 0 }) });
    expect(toasts.visible().length).toBe(0);
  });
});
