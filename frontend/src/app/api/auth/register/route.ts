import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import {
  DuplicateCredentialUserError,
  createCredentialUser,
} from "@/lib/credential-user-store";

export async function POST(req: Request) {
  try {
    const { name, email, password } = await req.json();
    const normalizedEmail = String(email ?? "").trim().toLowerCase();
    const normalizedName = String(name ?? "").trim();
    const normalizedPassword = String(password ?? "");

    if (!normalizedEmail || !normalizedPassword) {
      return NextResponse.json(
        { error: "Email and password are required." },
        { status: 400 }
      );
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return NextResponse.json(
        { error: "Please enter a valid email address." },
        { status: 400 }
      );
    }

    if (normalizedPassword.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters." },
        { status: 400 }
      );
    }

    const passwordHash = await bcrypt.hash(normalizedPassword, 12);
    const user = await createCredentialUser({
      name: normalizedName || null,
      email: normalizedEmail,
      passwordHash,
    });

    return NextResponse.json(
      { id: user.id, email: user.email, name: user.name },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof DuplicateCredentialUserError) {
      return NextResponse.json(
        { error: "An account with this email already exists." },
        { status: 409 }
      );
    }

    console.error("[auth] Registration failed", error);
    return NextResponse.json(
      { error: "Registration failed. Please try again." },
      { status: 500 }
    );
  }
}
