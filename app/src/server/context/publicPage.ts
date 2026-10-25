import 'server-only';
import { lookup } from 'node:dns/promises';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { isIP } from 'node:net';
import { brotliDecompressSync, gunzipSync, inflateSync } from 'node:zlib';
import ipaddr from 'ipaddr.js';
import { ServiceError } from '../errors';

const MAX_BYTES = 2_000_000;
const blocked = () =>
  new ServiceError(
    'Use a public HTTP or HTTPS page URL.',
    'source_url_blocked',
    400,
  );

export function isPublicAddress(address: string): boolean {
  try {
    // process() also converts IPv4-mapped IPv6 before checking its range.
    return ipaddr.process(address).range() === 'unicast';
  } catch {
    return false;
  }
}

export async function publicTarget(url: URL, signal?: AbortSignal) {
  signal?.throwIfAborted();
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    (url.port && !['80', '443'].includes(url.port))
  )
    throw blocked();
  const hostname = url.hostname.replace(/^\[|\]$/gu, '');
  const pending = isIP(hostname)
    ? [{ address: hostname, family: isIP(hostname) }]
    : lookup(hostname, { all: true });
  // dns.lookup itself has no AbortSignal support. Do not let a stalled resolver
  // consume the entire draft deadline before trying the extraction service.
  let onAbort: (() => void) | undefined;
  const cancellation = signal
    ? new Promise<never>((_resolve, reject) => {
        onAbort = () => reject(signal.reason);
        signal.addEventListener('abort', onAbort, { once: true });
        if (signal.aborted) onAbort();
      })
    : null;
  const addresses = await (
    cancellation
      ? Promise.race([pending, cancellation])
      : Promise.resolve(pending)
  ).finally(() => {
    if (signal && onAbort) signal.removeEventListener('abort', onAbort);
  });
  if (
    !addresses.length ||
    addresses.some((item) => !isPublicAddress(item.address))
  )
    throw blocked();
  return addresses.find((item) => item.family === 4) ?? addresses[0];
}

/** Validate and pin DNS for each hop; redirects may not reach local services. */
export async function fetchPublicPage(
  input: string,
  parentSignal?: AbortSignal,
): Promise<{ url: string; body: string; contentType: string }> {
  const signal = AbortSignal.any([
    AbortSignal.timeout(12_000),
    ...(parentSignal ? [parentSignal] : []),
  ]);
  let url = new URL(input);
  for (let hop = 0; hop <= 5; hop++) {
    signal.throwIfAborted();
    const target = await publicTarget(url, signal);
    signal.throwIfAborted();
    const result = await new Promise<{
      location?: string;
      body: string;
      contentType: string;
    }>((resolve, reject) => {
      const req = (url.protocol === 'https:' ? httpsRequest : httpRequest)(
        url,
        {
          signal,
          // Do not reuse sockets or resolve the name again after validation.
          agent: false,
          family: target.family,
          lookup: (_host, _options, callback) =>
            callback(null, target.address, target.family),
          headers: {
            'user-agent': 'Kept/0.1 (public promise source reader)',
            accept: 'text/html,application/xhtml+xml,text/plain;q=0.9',
            'accept-encoding': 'identity',
          },
        },
        (response) => {
          const status = response.statusCode ?? 500;
          if (
            [301, 302, 303, 307, 308].includes(status) &&
            response.headers.location
          ) {
            response.destroy();
            resolve({
              location: response.headers.location,
              body: '',
              contentType: '',
            });
            return;
          }
          const contentType = response.headers['content-type'] ?? '';
          if (
            status < 200 ||
            status >= 300 ||
            !/^(text\/html|application\/xhtml\+xml|text\/plain)(?:;|$)/iu.test(
              contentType,
            )
          ) {
            response.destroy();
            reject(
              new ServiceError(
                'The page did not return readable public HTML or text.',
                'source_unavailable',
              ),
            );
            return;
          }
          const chunks: Buffer[] = [];
          let bytes = 0;
          response.on('error', reject);
          response.on('data', (chunk: Buffer) => {
            bytes += chunk.length;
            if (bytes > MAX_BYTES) {
              response.destroy(
                new ServiceError(
                  'The source page is too large to read.',
                  'source_too_large',
                ),
              );
              return;
            }
            chunks.push(chunk);
          });
          response.on('end', () => {
            try {
              let body = Buffer.concat(chunks);
              const encoding = response.headers['content-encoding'];
              const options = { maxOutputLength: MAX_BYTES };
              if (encoding === 'gzip') body = gunzipSync(body, options);
              else if (encoding === 'br')
                body = brotliDecompressSync(body, options);
              else if (encoding === 'deflate')
                body = inflateSync(body, options);
              else if (encoding && encoding !== 'identity')
                throw new Error('Unsupported encoding.');
              const charset =
                contentType.match(/charset=["']?([^\s;"']+)/iu)?.[1] ?? 'utf-8';
              resolve({
                body: new TextDecoder(charset).decode(body),
                contentType,
              });
            } catch (error) {
              reject(error);
            }
          });
        },
      );
      req.on('error', reject);
      req.end();
    });
    if (result.location) {
      url = new URL(result.location, url);
      continue;
    }
    url.hash = '';
    return {
      url: url.toString(),
      body: result.body,
      contentType: result.contentType,
    };
  }
  throw new ServiceError(
    'The source redirects too many times.',
    'source_unavailable',
  );
}
