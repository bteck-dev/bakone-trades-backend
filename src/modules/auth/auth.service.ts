import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { supabase } from "../../config/supabase";
import { config } from "../../config/env";
import { LoginDto, ChangePasswordDto, JwtPayload } from "./auth.model";

export class AuthService {
  async login(dto: LoginDto): Promise<{ token: string; admin: { id: string; email: string } }> {
    const { data: admins, error } = await supabase
      .from("admins")
      .select("*")
      .eq("email", dto.email)
      .limit(1);

    if (error || !admins || admins.length === 0) {
      throw new Error("Invalid credentials");
    }

    const admin = admins[0];
    const isMatch = await bcrypt.compare(dto.password, admin.password);
    if (!isMatch) throw new Error("Invalid credentials");

    const token = jwt.sign(
      { id: admin.id, email: admin.email },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn } as jwt.SignOptions
    );

    return { token, admin: { id: admin.id, email: admin.email } };
  }

  async changePassword(adminId: string, dto: ChangePasswordDto): Promise<void> {
    const { data: admins } = await supabase
      .from("admins")
      .select("*")
      .eq("id", adminId)
      .limit(1);

    if (!admins || admins.length === 0) throw new Error("Admin not found");

    const isMatch = await bcrypt.compare(dto.currentPassword, admins[0].password);
    if (!isMatch) throw new Error("Current password is incorrect");

    if (dto.newPassword.length < 8) throw new Error("Password must be at least 8 characters");

    const hashed = await bcrypt.hash(dto.newPassword, 12);
    await supabase.from("admins").update({ password: hashed }).eq("id", adminId);
  }

  verifyToken(token: string): JwtPayload {
    return jwt.verify(token, config.jwt.secret) as JwtPayload;
  }
}

export const authService = new AuthService();
