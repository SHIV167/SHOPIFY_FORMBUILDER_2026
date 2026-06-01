import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { buildAuthUrl, createState, normalizeShopDomain } from '@/lib/shopify-oauth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const rawShop = req.nextUrl.searchParams.get('shop');
  const host = process.env.HOST || '';

  if (!rawShop) return NextResponse.redirect(new URL('/install', host));

  const shop = normalizeShopDomain(rawShop);
  if (!shop) return NextResponse.redirect(new URL('/install?error=invalid_shop', host));

  const state = createState();
  cookies().set('cf_oauth_state', state, {
    httpOnly: true, sameSite: 'none', secure: true, path: '/',
  });

  return NextResponse.redirect(buildAuthUrl(shop, state));
}
