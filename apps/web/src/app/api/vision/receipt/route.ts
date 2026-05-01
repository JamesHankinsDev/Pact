import { NextResponse, type NextRequest } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { verifyAuthHeader } from '@/lib/firebase-admin';
import { parseReceiptPhoto } from '@/lib/receipt-vision';

export const runtime = 'nodejs';

const ALLOWED_MEDIA_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const;
// Vercel serverless body limit ~4.5 MB; base64 inflates ~33%, so we cap
// decoded payloads at 3 MB. Clients compress before upload.
const MAX_IMAGE_BYTES = 3 * 1024 * 1024;

type RequestBody = {
  imageBase64?: string;
  imageMediaType?: string;
};

type ParseReceiptMediaType = (typeof ALLOWED_MEDIA_TYPES)[number];

export async function POST(req: NextRequest) {
  try {
    await verifyAuthHeader(req.headers.get('authorization'));
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unauthorized' },
      { status: 401 },
    );
  }

  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { imageBase64, imageMediaType } = body;
  if (!imageBase64 || !imageMediaType) {
    return NextResponse.json(
      { error: 'imageBase64 and imageMediaType are required' },
      { status: 400 },
    );
  }
  if (!ALLOWED_MEDIA_TYPES.includes(imageMediaType as ParseReceiptMediaType)) {
    return NextResponse.json(
      { error: `Unsupported media type. Use one of: ${ALLOWED_MEDIA_TYPES.join(', ')}` },
      { status: 400 },
    );
  }

  const approxBytes = Math.ceil((imageBase64.length * 3) / 4);
  if (approxBytes > MAX_IMAGE_BYTES) {
    return NextResponse.json(
      { error: `Image too large (~${Math.round(approxBytes / 1024 / 1024)} MB). Limit is 10 MB.` },
      { status: 413 },
    );
  }

  try {
    const result = await parseReceiptPhoto({
      imageBase64,
      imageMediaType: imageMediaType as ParseReceiptMediaType,
    });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof Anthropic.APIError) {
      console.error('Anthropic API error', err.status, err.message);
      const status = err.status >= 500 ? 502 : err.status;
      return NextResponse.json({ error: 'Vision API error' }, { status });
    }
    console.error('parseReceiptPhoto failed', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 },
    );
  }
}
