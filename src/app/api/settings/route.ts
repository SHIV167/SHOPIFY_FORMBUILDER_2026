import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { shopDomain, ...updates } = body;
    if (!shopDomain) return NextResponse.json({ error: 'Missing shopDomain' }, { status: 400 });

    const shop = await prisma.shop.findUnique({ where: { shopifyDomain: shopDomain } });
    if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 });

    const settings = await prisma.contactFormSettings.upsert({
      where: { shopId: shop.id },
      update: updates,
      create: { shopId: shop.id, ...updates },
    });

    return NextResponse.json({ success: true, settings });
  } catch (err) {
    console.error('[settings POST]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
