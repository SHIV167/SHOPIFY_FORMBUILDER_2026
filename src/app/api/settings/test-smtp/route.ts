import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// POST /api/settings/test-smtp - Test SMTP configuration
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      smtpHost,
      smtpPort,
      smtpUser,
      smtpPass,
      smtpFromAddress,
      smtpFromName,
      smtpEncryption,
    } = body;

    if (!smtpHost || !smtpPort || !smtpUser || !smtpPass) {
      return NextResponse.json(
        { success: false, message: "Missing required SMTP fields" },
        { status: 400 }
      );
    }

    // Create a simple SMTP connection test
    // Since we don't have nodemailer installed, we'll do a basic validation
    // In production, you would use nodemailer to actually test the connection
    
    // Basic validation
    const port = parseInt(smtpPort);
    if (isNaN(port) || port < 1 || port > 65535) {
      return NextResponse.json(
        { success: false, message: "Invalid port number" },
        { status: 400 }
      );
    }

    if (!smtpFromAddress || !smtpFromAddress.includes("@")) {
      return NextResponse.json(
        { success: false, message: "Invalid from address" },
        { status: 400 }
      );
    }

    // Simulate SMTP test (in production, use nodemailer.createTransport)
    // For now, we'll just validate the configuration
    console.log("[SMTP Test]", {
      host: smtpHost,
      port: smtpPort,
      user: smtpUser,
      from: smtpFromAddress,
      encryption: smtpEncryption ? "TLS/SSL" : "None",
    });

    // Return success for valid configuration
    // Note: This is a basic validation. For actual SMTP testing, install nodemailer
    return NextResponse.json({
      success: true,
      message: "SMTP configuration validated successfully. Note: Install nodemailer for actual connection testing.",
    });
  } catch (err) {
    console.error("[test-smtp POST]", err);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}
