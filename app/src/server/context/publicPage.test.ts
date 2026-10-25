import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import { Readable } from 'node:stream';
import { gzipSync } from 'node:zlib';
import { fetchPublicPage, isPublicAddress, publicTarget } from './publicPage';

const mocks = vi.hoisted(() => ({ lookup: vi.fn(), request: vi.fn() }));
vi.mock('node:dns/promises', () => ({ lookup: mocks.lookup }));
vi.mock('node:http', () => ({ request: mocks.request }));
vi.mock('node:https', () => ({ request: mocks.request }));
function respond(
  body: string | Buffer,
  statusCode = 200,
  headers: Record<string, string> = { 'content-type': 'text/html' },
) {
  mocks.request.mockImplementationOnce((_url, _options, callback) => {
    const request = new EventEmitter() as EventEmitter & { end: () => void };
    request.end = () => {
      const response = Object.assign(Readable.from([Buffer.from(body)]), {
        statusCode,
        headers,
      });
      callback(response);
    };
    return request;
  });
}
beforeEach(() => {
  mocks.lookup
    .mockReset()
    .mockResolvedValue([{ address: '93.184.216.34', family: 4 }]);
  mocks.request.mockReset();
});

describe('public page transport', () => {
  it.each([
    '127.0.0.1',
    '10.1.2.3',
    '172.16.0.1',
    '192.168.0.1',
    '169.254.169.254',
    '0.0.0.0',
    '100.64.0.1',
    '224.0.0.1',
    '::1',
    'fc00::1',
    'fe80::1',
    '::ffff:127.0.0.1',
  ])('blocks non-public address %s', (address) => {
    expect(isPublicAddress(address)).toBe(false);
  });
  it.each(['93.184.216.34', '2606:4700::1111'])(
    'permits public address %s',
    (address) => expect(isPublicAddress(address)).toBe(true),
  );
  it('rejects a hostname if any DNS answer is private', async () => {
    mocks.lookup.mockResolvedValue([
      { address: '93.184.216.34', family: 4 },
      { address: '127.0.0.1', family: 4 },
    ]);
    await expect(
      publicTarget(new URL('https://example.com')),
    ).rejects.toMatchObject({ code: 'source_url_blocked' });
  });
  it.each([
    'http://127.1/',
    'http://2130706433/',
    'http://[::ffff:127.0.0.1]/',
    'https://user:password@example.com/',
    'https://example.com:8080/',
    'file:///etc/passwd',
  ])('rejects URL %s before requesting it', async (url) => {
    await expect(fetchPublicPage(url)).rejects.toMatchObject({
      code: 'source_url_blocked',
    });
    expect(mocks.request).not.toHaveBeenCalled();
  });
  it('pins the checked address in the socket lookup', async () => {
    respond('<html>Page</html>');
    expect((await fetchPublicPage('https://example.com')).body).toBe(
      '<html>Page</html>',
    );
    const options = mocks.request.mock.calls[0][1];
    const callback = vi.fn();
    options.lookup('example.com', {}, callback);
    expect(callback).toHaveBeenCalledWith(null, '93.184.216.34', 4);
    expect(options.agent).toBe(false);
  });
  it('follows a relative redirect and keeps the final source URL', async () => {
    respond('', 302, { location: '/article' });
    respond('<html>Article</html>');
    expect((await fetchPublicPage('https://example.com/start')).url).toBe(
      'https://example.com/article',
    );
    expect(mocks.lookup).toHaveBeenCalledTimes(2);
  });
  it('rejects redirects into local services before the second request', async () => {
    respond('', 302, { location: 'http://169.254.169.254/latest/meta-data/' });
    await expect(fetchPublicPage('https://example.com')).rejects.toMatchObject({
      code: 'source_url_blocked',
    });
    expect(mocks.request).toHaveBeenCalledTimes(1);
  });
  it('limits redirect loops', async () => {
    for (let i = 0; i < 6; i++) respond('', 302, { location: '/again' });
    await expect(fetchPublicPage('https://example.com')).rejects.toThrow(
      'redirects too many',
    );
  });
  it('rejects binary responses', async () => {
    respond('PDF', 200, { 'content-type': 'application/pdf' });
    await expect(fetchPublicPage('https://example.com')).rejects.toMatchObject({
      code: 'source_unavailable',
    });
  });
  it('limits streamed response size', async () => {
    respond(Buffer.alloc(2_000_001));
    await expect(fetchPublicPage('https://example.com')).rejects.toMatchObject({
      code: 'source_too_large',
    });
  });
  it('decodes gzip even when the server ignores identity encoding', async () => {
    respond(gzipSync('Readable text'), 200, {
      'content-type': 'text/html',
      'content-encoding': 'gzip',
    });
    expect((await fetchPublicPage('https://example.com')).body).toBe(
      'Readable text',
    );
  });
  it('bounds decompressed response size', async () => {
    respond(gzipSync(Buffer.alloc(2_000_001)), 200, {
      'content-type': 'text/html',
      'content-encoding': 'gzip',
    });
    await expect(fetchPublicPage('https://example.com')).rejects.toThrow();
  });
  it('honors cancellation before fetching', async () => {
    await expect(
      fetchPublicPage('https://example.com', AbortSignal.abort()),
    ).rejects.toThrow();
    expect(mocks.request).not.toHaveBeenCalled();
  });
  it('cancels stalled DNS resolution before starting a request', async () => {
    mocks.lookup.mockImplementation(() => new Promise(() => {}));
    const controller = new AbortController();
    const pending = fetchPublicPage('https://example.com', controller.signal);
    controller.abort();
    await expect(pending).rejects.toThrow();
    expect(mocks.request).not.toHaveBeenCalled();
  });
});
