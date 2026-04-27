import { Resend } from 'resend';

// ════════════════════════════════════════════════════════════════
// 邮件发送 — 基于 Resend
// ════════════════════════════════════════════════════════════════

const SITE_URL = process.env.SITE_URL || 'http://localhost:5046';

function getResendClient(): Resend {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
        throw new Error('RESEND_API_KEY 未配置');
    }
    return new Resend(apiKey);
}

interface SendResult {
    success: boolean;
    error?: string;
}

/**
 * 发送邮箱验证邮件
 */
export async function sendVerificationEmail(
    email: string,
    token: string,
): Promise<SendResult> {
    try {
        const resend = getResendClient();
        const verifyUrl = `${SITE_URL}/verify-email?token=${token}`;

        const { error } = await resend.emails.send({
            from: 'Mockingbird <noreply@mockingbird.ai>',
            to: email,
            subject: '验证您的邮箱 — Mockingbird Knowledge',
            html: `
                <div style="max-width:480px;margin:0 auto;font-family:sans-serif;padding:32px;">
                    <h2 style="color:#1a1a1a;">验证您的邮箱地址</h2>
                    <p style="color:#555;line-height:1.6;">
                        感谢注册 Mockingbird Knowledge！请点击下方按钮完成邮箱验证：
                    </p>
                    <a href="${verifyUrl}"
                       style="display:inline-block;padding:12px 32px;background:#4f46e5;color:#fff;
                              text-decoration:none;border-radius:8px;margin:16px 0;font-weight:600;">
                        验证邮箱
                    </a>
                    <p style="color:#888;font-size:13px;">
                        如果按钮无法点击，请复制以下链接到浏览器打开：<br/>
                        <a href="${verifyUrl}" style="color:#4f46e5;word-break:break-all;">${verifyUrl}</a>
                    </p>
                </div>
            `,
        });

        if (error) {
            return { success: false, error: error.message };
        }
        return { success: true };
    } catch (err) {
        const message = err instanceof Error ? err.message : '邮件发送失败';
        return { success: false, error: message };
    }
}

/**
 * 发送密码重置邮件
 */
export async function sendPasswordResetEmail(
    email: string,
    token: string,
): Promise<SendResult> {
    try {
        const resend = getResendClient();
        const resetUrl = `${SITE_URL}/reset-password?token=${token}`;

        const { error } = await resend.emails.send({
            from: 'Mockingbird <noreply@mockingbird.ai>',
            to: email,
            subject: '重置密码 — Mockingbird Knowledge',
            html: `
                <div style="max-width:480px;margin:0 auto;font-family:sans-serif;padding:32px;">
                    <h2 style="color:#1a1a1a;">重置您的密码</h2>
                    <p style="color:#555;line-height:1.6;">
                        我们收到了您的密码重置请求。请点击下方按钮设置新密码：
                    </p>
                    <a href="${resetUrl}"
                       style="display:inline-block;padding:12px 32px;background:#4f46e5;color:#fff;
                              text-decoration:none;border-radius:8px;margin:16px 0;font-weight:600;">
                        重置密码
                    </a>
                    <p style="color:#888;font-size:13px;">
                        如果这不是您本人的操作，请忽略此邮件。<br/><br/>
                        如果按钮无法点击，请复制以下链接到浏览器打开：<br/>
                        <a href="${resetUrl}" style="color:#4f46e5;word-break:break-all;">${resetUrl}</a>
                    </p>
                </div>
            `,
        });

        if (error) {
            return { success: false, error: error.message };
        }
        return { success: true };
    } catch (err) {
        const message = err instanceof Error ? err.message : '邮件发送失败';
        return { success: false, error: message };
    }
}
