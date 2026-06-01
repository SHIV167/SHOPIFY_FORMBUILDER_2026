import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import prisma from '@/lib/prisma';
import { exchangeCodeForAccessToken, normalizeShopDomain, verifyShopifyCallback } from '@/lib/shopify-oauth';
import { setShopSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const host = process.env.HOST || '';
  const { searchParams } = req.nextUrl;

  const rawShop = searchParams.get('shop');
  const code = searchParams.get('code');
  const hmac = searchParams.get('hmac');
  const state = searchParams.get('state');
  const expectedState = cookies().get('cf_oauth_state')?.value;

  if (!rawShop || !code || !hmac || !state || !expectedState || state !== expectedState)
    return NextResponse.redirect(new URL('/install?error=invalid_state', host));

  const shop = normalizeShopDomain(rawShop);
  if (!shop) return NextResponse.redirect(new URL('/install?error=invalid_shop', host));

  const params: Record<string, string | null> = {
    code, shop: rawShop, state,
    timestamp: searchParams.get('timestamp'),
    host: searchParams.get('host'),
    hmac,
  };

  if (!verifyShopifyCallback(params))
    return NextResponse.redirect(new URL('/install?error=invalid_hmac', host));

  try {
    const accessToken = await exchangeCodeForAccessToken(shop, code);

    const installedShop = await prisma.shop.upsert({
      where: { shopifyDomain: shop },
      update: { accessToken, isActive: true },
      create: {
        shopifyDomain: shop,
        accessToken,
        isActive: true,
        contactFormSettings: { create: {} },
      },
    });

    setShopSession(installedShop.shopifyDomain);
    cookies().delete('cf_oauth_state');

    const embedHost = searchParams.get('host');
    const adminUrl = new URL('/admin', host);
    adminUrl.searchParams.set('shop', installedShop.shopifyDomain);
    if (embedHost) adminUrl.searchParams.set('host', embedHost);

    return NextResponse.redirect(adminUrl);
  } catch (err) {
    const msg = err instanceof Error ? err.message.slice(0, 200) : String(err);
    console.error('[cf] OAuth callback failed:', msg);
    return NextResponse.redirect(new URL(`/install?error=oauth_failed&details=${encodeURIComponent(msg)}`, host));
  }
}
