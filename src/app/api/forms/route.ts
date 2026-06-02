import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const fieldSchema = z.object({
  label: z.string().min(1),
  fieldType: z.enum(['text','email','phone','textarea','select','checkbox','radio','hidden','date','number','file']),
  placeholder: z.string().optional(),
  helpText: z.string().optional(),
  required: z.boolean().default(false),
  options: z.array(z.string()).default([]),
  defaultValue: z.string().optional(),
  minLength: z.number().optional(),
  maxLength: z.number().optional(),
  width: z.enum(['full','half']).default('full'),
  sortOrder: z.number().default(0),
});

const formSchema = z.object({
  shopDomain: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  recipientEmail: z.string().email().optional().or(z.literal('')),
  successMessage: z.string().optional(),
  submitButtonText: z.string().optional(),
  sendEmailNotification: z.boolean().default(true),
  sendConfirmationEmail: z.boolean().default(false),
  confirmationSubject: z.string().optional(),
  confirmationMessage: z.string().optional(),
  replyToField: z.string().optional(),
  formStyle: z.enum(['default','minimal','card']).default('default'),
  primaryColor: z.string().default('#0ea5e9'),
  bgColor: z.string().default('#ffffff'),
  enableHoneypot: z.boolean().default(true),
  isActive: z.boolean().default(true),
  isPublished: z.boolean().default(true),
  fields: z.array(fieldSchema).default([]),
});

// GET /api/forms?shop=...&formId=...
export async function GET(req: NextRequest) {
  const shopDomain = req.nextUrl.searchParams.get('shop');
  const formId = req.nextUrl.searchParams.get('formId');

  if (!shopDomain) return NextResponse.json({ error: 'Missing shop' }, { status: 400 });

  // Auto-create shop if not exists (no auth restriction)
  let shop = await prisma.shop.findUnique({ where: { shopifyDomain: shopDomain } });
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

  if (formId) {
    const form = await prisma.contactForm.findFirst({
      where: { id: formId, shopId: shop.id },
      include: { fields: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!form) return NextResponse.json({ error: 'Form not found' }, { status: 404 });
    const submissionCount = await prisma.contactFormSubmission.count({ where: { formId: form.id } });
    const unreadCount = await prisma.contactFormSubmission.count({ where: { formId: form.id, isRead: false } });
    return NextResponse.json({ form, submissionCount, unreadCount });
  }

  const forms = await prisma.contactForm.findMany({
    where: { shopId: shop.id },
    include: { fields: { orderBy: { sortOrder: 'asc' } } },
    orderBy: { createdAt: 'desc' },
  });

  const formsWithCounts = await Promise.all(forms.map(async (f) => {
    const [submissionCount, unreadCount] = await Promise.all([
      prisma.contactFormSubmission.count({ where: { formId: f.id } }),
      prisma.contactFormSubmission.count({ where: { formId: f.id, isRead: false } }),
    ]);
    return { ...f, submissionCount, unreadCount };
  }));

  const totalSubmissions = await prisma.contactFormSubmission.count({ where: { shopId: shop.id } });
  const todayStart = new Date(); todayStart.setHours(0,0,0,0);
  const todayCount = await prisma.contactFormSubmission.count({
    where: { shopId: shop.id, createdAt: { gte: todayStart } },
  });
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0,0,0,0);
  const monthCount = await prisma.contactFormSubmission.count({
    where: { shopId: shop.id, createdAt: { gte: monthStart } },
  });

  const settings = await prisma.contactFormSettings.findUnique({ where: { shopId: shop.id } });

  return NextResponse.json({ forms: formsWithCounts, totalSubmissions, todayCount, monthCount, settings });
}

// POST /api/forms — create a new form
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = formSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });

    const { shopDomain, fields, ...formData } = parsed.data;
    // Auto-create shop if not exists (no auth restriction)
    let shop = await prisma.shop.findUnique({ where: { shopifyDomain: shopDomain } });
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

    const form = await prisma.contactForm.create({
      data: {
        shopId: shop.id,
        title: formData.title,
        description: formData.description,
        recipientEmail: formData.recipientEmail || null,
        successMessage: formData.successMessage || 'Thank you! Your message has been sent.',
        submitButtonText: formData.submitButtonText || 'Send Message',
        sendEmailNotification: formData.sendEmailNotification,
        sendConfirmationEmail: formData.sendConfirmationEmail,
        confirmationSubject: formData.confirmationSubject || 'Thank you for contacting us',
        confirmationMessage: formData.confirmationMessage,
        replyToField: formData.replyToField,
        formStyle: formData.formStyle,
        primaryColor: formData.primaryColor,
        bgColor: formData.bgColor,
        enableHoneypot: formData.enableHoneypot,
        isActive: formData.isActive,
        isPublished: formData.isPublished,
        fields: {
          create: fields.map((f, i) => ({
            label: f.label, fieldType: f.fieldType, placeholder: f.placeholder,
            helpText: f.helpText, required: f.required, options: f.options,
            defaultValue: f.defaultValue, minLength: f.minLength, maxLength: f.maxLength,
            width: f.width, sortOrder: f.sortOrder ?? i,
          })),
        },
      },
      include: { fields: { orderBy: { sortOrder: 'asc' } } },
    });

    return NextResponse.json({ success: true, form });
  } catch (err) {
    console.error('[forms POST]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/forms — update a form
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, shopDomain, fields, ...updates } = body;
    if (!id || !shopDomain) return NextResponse.json({ error: 'Missing id or shopDomain' }, { status: 400 });

    // Auto-create shop if not exists (no auth restriction)
    let shop = await prisma.shop.findUnique({ where: { shopifyDomain: shopDomain } });
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

    const existing = await prisma.contactForm.findFirst({ where: { id, shopId: shop.id } });
    if (!existing) return NextResponse.json({ error: 'Form not found' }, { status: 404 });

    // Delete old fields and recreate (simple replace strategy)
    await prisma.contactFormField.deleteMany({ where: { formId: id } });

    const form = await prisma.contactForm.update({
      where: { id },
      data: {
        ...updates,
        recipientEmail: updates.recipientEmail || null,
        fields: {
          create: (fields || []).map((f: any, i: number) => ({
            label: f.label, fieldType: f.fieldType, placeholder: f.placeholder,
            helpText: f.helpText, required: f.required ?? false, options: f.options ?? [],
            defaultValue: f.defaultValue, minLength: f.minLength, maxLength: f.maxLength,
            width: f.width ?? 'full', sortOrder: f.sortOrder ?? i,
          })),
        },
      },
      include: { fields: { orderBy: { sortOrder: 'asc' } } },
    });

    return NextResponse.json({ success: true, form });
  } catch (err) {
    console.error('[forms PUT]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/forms
export async function DELETE(req: NextRequest) {
  try {
    const { id, shopDomain } = await req.json();
    if (!id || !shopDomain) return NextResponse.json({ error: 'Missing id or shopDomain' }, { status: 400 });

    // Auto-create shop if not exists (no auth restriction)
    let shop = await prisma.shop.findUnique({ where: { shopifyDomain: shopDomain } });
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

    await prisma.contactForm.deleteMany({ where: { id, shopId: shop.id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[forms DELETE]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
