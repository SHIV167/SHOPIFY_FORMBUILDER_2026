import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { sendEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

// GET /api/submissions?shop=...&formId=...&page=1&status=new
export async function GET(req: NextRequest) {
  const shopDomain = req.nextUrl.searchParams.get("shop");
  const formId = req.nextUrl.searchParams.get("formId");
  const status = req.nextUrl.searchParams.get("status") || undefined;
  const page = parseInt(req.nextUrl.searchParams.get("page") || "1", 10);
  const pageSize = 20;

  if (!shopDomain)
    return NextResponse.json({ error: "Missing shop" }, { status: 400 });

  // Auto-create shop if not exists (no auth restriction)
  let shop = await prisma.shop.findUnique({
    where: { shopifyDomain: shopDomain },
  });
  if (!shop) {
    shop = await prisma.shop.create({
      data: {
        shopifyDomain: shopDomain,
        accessToken: '', // No OAuth required
        isActive: true,
        contactFormSettings: { create: {} },
      },
    });
  }

  const where: any = { shopId: shop.id };
  if (formId) where.formId = formId;
  if (status) where.status = status;

  const [submissions, total] = await Promise.all([
    prisma.contactFormSubmission.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.contactFormSubmission.count({ where }),
  ]);

  return NextResponse.json({
    submissions,
    total,
    page,
    pageSize,
    pages: Math.ceil(total / pageSize),
  });
}

// POST /api/submissions — from embed form
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { shopDomain, formId, data, pageUrl, referrer } = body;

    if (!formId || !data)
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );

    // Honeypot check
    if (data.__hp) return NextResponse.json({ success: true }); // silently reject spam

    // Resolve shop: if shopDomain not provided, look it up via the formId
    let shop;
    if (shopDomain) {
      // Auto-create shop if not exists (no auth restriction)
      shop = await prisma.shop.findUnique({
        where: { shopifyDomain: shopDomain },
      });
      if (!shop) {
        shop = await prisma.shop.create({
          data: {
            shopifyDomain: shopDomain,
            accessToken: '', // No OAuth required
            isActive: true,
            contactFormSettings: { create: {} },
          },
        });
      }
    } else {
      // Look up the form first to get the shopId
      const formLookup = await prisma.contactForm.findUnique({
        where: { id: formId },
        include: { shop: true },
      });
      shop = formLookup?.shop ?? null;
    }
    if (!shop)
      return NextResponse.json({ error: "Shop not found" }, { status: 404 });

    const form = await prisma.contactForm.findFirst({
      where: { id: formId, shopId: shop.id, isActive: true, isPublished: true },
      include: { fields: { orderBy: { sortOrder: "asc" } } },
    });
    if (!form)
      return NextResponse.json(
        { error: "Form not found or inactive" },
        { status: 404 },
      );

    // Remove honeypot from stored data
    const cleanData = { ...data };
    delete cleanData.__hp;

    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0] ||
      req.headers.get("x-real-ip") ||
      null;
    const userAgent = req.headers.get("user-agent") || null;

    const submission = await prisma.contactFormSubmission.create({
      data: {
        formId: form.id,
        shopId: shop.id,
        formTitle: form.title,
        data: cleanData,
        ipAddress: ip,
        userAgent,
        referrer: referrer || null,
        pageUrl: pageUrl || null,
      },
    });

    // Send notification email (best-effort)
    let emailSent = false;
    let emailError: string | undefined;

    if (form.sendEmailNotification && form.recipientEmail) {
      const rows = Object.entries(cleanData)
        .map(
          ([k, v]) =>
            `<tr><td style="padding:8px;border:1px solid #e5e7eb;font-weight:600;">${k}</td><td style="padding:8px;border:1px solid #e5e7eb;">${v}</td></tr>`,
        )
        .join("");
      const html = `
        <h2 style="font-family:sans-serif;">New submission: ${form.title}</h2>
        <table style="border-collapse:collapse;width:100%;font-family:sans-serif;font-size:14px;">
          <thead><tr>
            <th style="padding:8px;border:1px solid #e5e7eb;background:#f9fafb;text-align:left;">Field</th>
            <th style="padding:8px;border:1px solid #e5e7eb;background:#f9fafb;text-align:left;">Response</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <p style="font-family:sans-serif;color:#6b7280;font-size:12px;margin-top:16px;">
          Submitted: ${new Date().toLocaleString()} | IP: ${ip || "unknown"}
        </p>`;

      // Determine reply-to from submission data if replyToField is set
      let replyTo: string | undefined;
      if (form.replyToField && cleanData[form.replyToField]) {
        const v = String(cleanData[form.replyToField]);
        if (v.includes("@")) replyTo = v;
      }

      const result = await sendEmail({
        to: form.recipientEmail,
        subject: `New form submission: ${form.title}`,
        html,
        replyTo,
      });
      emailSent = result.success;
      emailError = result.error;
    }

    // Send confirmation email to submitter (best-effort)
    if (form.sendConfirmationEmail && form.confirmationMessage) {
      // Try to find email field
      const emailField = form.fields.find((f) => f.fieldType === "email");
      if (emailField && cleanData[emailField.label]) {
        const confirmHtml = `<div style="font-family:sans-serif;max-width:600px;">
          <h2>${form.confirmationSubject}</h2>
          <p>${form.confirmationMessage}</p>
        </div>`;
        await sendEmail({
          to: cleanData[emailField.label] as string,
          subject: form.confirmationSubject,
          html: confirmHtml,
        }).catch(() => null);
      }
    }

    // Update email status on submission
    await prisma.contactFormSubmission
      .update({
        where: { id: submission.id },
        data: { emailSent, emailError: emailError || null },
      })
      .catch(() => null);

    return NextResponse.json({ success: true, message: form.successMessage });
  } catch (err) {
    console.error("[submissions POST]", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// PATCH /api/submissions — mark read / update status
export async function PATCH(req: NextRequest) {
  try {
    const { ids, shopDomain, status, isRead } = await req.json();
    if (!shopDomain || !ids?.length)
      return NextResponse.json(
        { error: "Missing ids or shopDomain" },
        { status: 400 },
      );

    // Auto-create shop if not exists (no auth restriction)
    let shop = await prisma.shop.findUnique({
      where: { shopifyDomain: shopDomain },
    });
    if (!shop) {
      shop = await prisma.shop.create({
        data: {
          shopifyDomain: shopDomain,
          accessToken: '', // No OAuth required
          isActive: true,
          contactFormSettings: { create: {} },
        },
      });
    }

    const updateData: any = {};
    if (status !== undefined) updateData.status = status;
    if (isRead !== undefined) updateData.isRead = isRead;

    await prisma.contactFormSubmission.updateMany({
      where: { id: { in: ids }, shopId: shop.id },
      data: updateData,
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[submissions PATCH]", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// DELETE /api/submissions
export async function DELETE(req: NextRequest) {
  try {
    const { ids, shopDomain } = await req.json();
    if (!shopDomain || !ids?.length)
      return NextResponse.json(
        { error: "Missing ids or shopDomain" },
        { status: 400 },
      );

    // Auto-create shop if not exists (no auth restriction)
    let shop = await prisma.shop.findUnique({
      where: { shopifyDomain: shopDomain },
    });
    if (!shop) {
      shop = await prisma.shop.create({
        data: {
          shopifyDomain: shopDomain,
          accessToken: '', // No OAuth required
          isActive: true,
          contactFormSettings: { create: {} },
        },
      });
    }

    await prisma.contactFormSubmission.deleteMany({
      where: { id: { in: ids }, shopId: shop.id },
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[submissions DELETE]", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
