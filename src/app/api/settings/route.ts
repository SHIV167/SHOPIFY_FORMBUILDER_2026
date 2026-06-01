import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/settings?shop=...
export async function GET(req: NextRequest) {
  try {
    const shopDomain = req.nextUrl.searchParams.get("shop");
    if (!shopDomain)
      return NextResponse.json({ error: "Missing shop" }, { status: 400 });

    const shop = await prisma.shop.findUnique({
      where: { shopifyDomain: shopDomain },
    });
    if (!shop)
      return NextResponse.json({ error: "Shop not found" }, { status: 404 });

    const settings = await prisma.contactFormSettings.findUnique({
      where: { shopId: shop.id },
    });
    return NextResponse.json({ settings: settings ?? null });
  } catch (err) {
    console.error("[settings GET]", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// POST /api/settings — save / upsert settings
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { shopDomain, generateApiToken, ...updates } = body;

    if (!shopDomain)
      return NextResponse.json(
        { error: "Missing shopDomain" },
        { status: 400 },
      );

    const shop = await prisma.shop.findUnique({
      where: { shopifyDomain: shopDomain },
    });
    if (!shop)
      return NextResponse.json({ error: "Shop not found" }, { status: 404 });

    // Whitelist safe-to-save scalar fields (strip relations/internal fields)
    const allowedFields = [
      "senderName",
      "senderEmail",
      "customEmail",
      "adminEmail",
      "adminEmailSubject",
      "adminEmailBody",
      "allowCustomerEmail",
      "customerEmailSubject",
      "customerEmailBody",
      "globalCss",
      "emailProvider",
      "emailFrom",
      "emailFromName",
      "smtpEnabled",
      "smtpHost",
      "smtpPort",
      "smtpUser",
      "smtpPass",
      "smtpEncryption",
      "smtpFromAddress",
      "smtpFromName",
      "klaviyoEnabled",
      "klaviyoApiKey",
      "mailchimpEnabled",
      "mailchimpApiKey",
      "enableRecaptcha",
      "recaptchaType",
      "recaptchaSiteKey",
      "recaptchaSecretKey",
      "maxSubmissionsPerIpPerHour",
      "blockedEmailDomains",
      "twilioAccountSid",
      "twilioAuthToken",
      "twilioFromNumber",
      "whatsappAccountSid",
      "whatsappFromNumber",
      "hubspotToken",
      "activecampaignUrl",
      "activecampaignApiKey",
      "airtableToken",
      "stripePublishableKey",
      "stripeSecretKey",
      "slackEnabled",
      "slackWebhookUrl",
      "blockedIps",
      "blockIpMessage",
    ];

    const data: Record<string, unknown> = {};
    for (const key of allowedFields) {
      if (key in updates) data[key] = updates[key];
    }

    // Generate a new API token if requested
    if (generateApiToken) {
      data.apiToken = randomBytes(32).toString("hex");
      data.apiTokenCreatedAt = new Date();
    }

    const settings = await prisma.contactFormSettings.upsert({
      where: { shopId: shop.id },
      update: data,
      create: { shopId: shop.id, ...data },
    });

    return NextResponse.json({ success: true, settings });
  } catch (err) {
    console.error("[settings POST]", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
