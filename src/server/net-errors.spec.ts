import { networkErrorCode } from './net-errors';

const fetchFailed = (cause: unknown) => Object.assign(new TypeError('fetch failed'), { cause });

describe('networkErrorCode', () => {
  it('finds the code inside fetch failures', () => {
    expect(
      networkErrorCode(fetchFailed(Object.assign(new Error('x'), { code: 'ENOTFOUND' }))),
    ).toBe('ENOTFOUND');
    expect(
      networkErrorCode(fetchFailed(Object.assign(new Error('x'), { code: 'ECONNRESET' }))),
    ).toBe('ECONNRESET');
  });

  it('recognizes timeouts and bare fetch failures', () => {
    expect(networkErrorCode(new DOMException('t', 'TimeoutError'))).toBe('TIMEOUT');
    expect(networkErrorCode(fetchFailed(undefined))).toBe('FETCH_FAILED');
  });

  it('ignores real bugs', () => {
    expect(networkErrorCode(new TypeError('x is undefined'))).toBeUndefined();
    expect(networkErrorCode(Object.assign(new Error('403'), { code: '403' }))).toBeUndefined();
    expect(networkErrorCode(undefined)).toBeUndefined();
  });
});
