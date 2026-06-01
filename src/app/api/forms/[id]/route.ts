/**
 * Public Form API — GET /api/forms/[id]
 * Returns form data by ID only (no shop param required).
 * Only exposes the fields needed to render and submit the form.
 * The form ID is globally unique (cuid), so shop lookup is internal.
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const { id } = params;
    if (!id)
      return NextResponse.json({ error: "Missing form ID" }, { status: 400 });

    const form = await prisma.contactForm.findUnique({
      where: { id },
      include: {
        fields: { orderBy: { sortOrder: "asc" } },
        shop: { select: { shopifyDomain: true } },
      },
    });

    if (!form)
      return NextResponse.json({ error: "Form not found" }, { status: 404 });
    if (!form.isActive || !form.isPublished)
      return NextResponse.json(
        { error: "Form not available" },
        { status: 404 },
      );

    // Return only public-safe fields needed to render + submit the form
    return NextResponse.json(
      {
        form: {
          id: form.id,
          title: form.title,
          description: form.description,
          successMessage: form.successMessage,
          submitButtonText: form.submitButtonText,
          primaryColor: form.primaryColor,
          bgColor: form.bgColor,
          formStyle: form.formStyle,
          enableHoneypot: form.enableHoneypot,
          shopDomain: form.shop.shopifyDomain, // needed for submission only
          fields: form.fields.map((f: (typeof form.fields)[number]) => ({
            id: f.id,
            label: f.label,
            fieldType: f.fieldType,
            placeholder: f.placeholder,
            helpText: f.helpText,
            required: f.required,
            options: f.options,
            defaultValue: f.defaultValue,
            width: f.width,
            sortOrder: f.sortOrder,
          })),
        },
      },
      {
        headers: {
          "Access-Control-Allow-Origin": "*", // allow Shopify storefront to call this
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
        },
      },
    );
  } catch (err) {
    console.error("[GET /api/forms/[id]]", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// Allow CORS preflight from Shopify storefront
export async function OPTIONS() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
