import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockEmailSend = vi.fn();

vi.mock('resend', () => ({
    Resend: class MockResend {
        emails = {
            send: mockEmailSend,
        };
    },
}));

const ORIGINAL_RESEND_API_KEY = process.env.RESEND_API_KEY;
const ORIGINAL_RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL;
const ORIGINAL_RESEND_FROM_NAME = process.env.RESEND_FROM_NAME;

describe('email sending helpers', () => {
    beforeEach(() => {
        vi.resetModules();
        mockEmailSend.mockReset();
        mockEmailSend.mockResolvedValue({ error: null });
        process.env.RESEND_API_KEY = 're_test_key';
        process.env.RESEND_FROM_EMAIL = 'onboarding@resend.dev';
        process.env.RESEND_FROM_NAME = '知更鸟';
    });

    afterEach(() => {
        if (ORIGINAL_RESEND_API_KEY === undefined) {
            delete process.env.RESEND_API_KEY;
        } else {
            process.env.RESEND_API_KEY = ORIGINAL_RESEND_API_KEY;
        }

        if (ORIGINAL_RESEND_FROM_EMAIL === undefined) {
            delete process.env.RESEND_FROM_EMAIL;
        } else {
            process.env.RESEND_FROM_EMAIL = ORIGINAL_RESEND_FROM_EMAIL;
        }

        if (ORIGINAL_RESEND_FROM_NAME === undefined) {
            delete process.env.RESEND_FROM_NAME;
        } else {
            process.env.RESEND_FROM_NAME = ORIGINAL_RESEND_FROM_NAME;
        }
    });

    it('uses the Chinese brand consistently in verification emails', async () => {
        const { sendVerificationEmail } = await import('@/lib/email/send');

        await sendVerificationEmail('user@example.com', 'token-123');

        const message = mockEmailSend.mock.calls.at(-1)?.[0];

        expect(message).toMatchObject({
            from: '知更鸟 <onboarding@resend.dev>',
            to: 'user@example.com',
            subject: '验证您的邮箱 — 知更鸟',
        });
        expect(message.html).toContain('感谢注册知更鸟');
        expect(message.html).toContain('background:#000000');
        expect(message.html).toContain('background:#111111');
        expect(message.html).toContain('color:#C0F0FB');
        expect(message.html).toContain('账户验证');
    });

    it('uses the Chinese brand consistently in password reset emails', async () => {
        const { sendPasswordResetEmail } = await import('@/lib/email/send');

        await sendPasswordResetEmail('user@example.com', 'token-123');

        const message = mockEmailSend.mock.calls.at(-1)?.[0];

        expect(message).toMatchObject({
            from: '知更鸟 <onboarding@resend.dev>',
            to: 'user@example.com',
            subject: '重置密码 — 知更鸟',
        });
        expect(message.html).toContain('background:#000000');
        expect(message.html).toContain('background:#111111');
        expect(message.html).toContain('color:#C0F0FB');
        expect(message.html).toContain('账户安全');
        expect(message.html).toContain('如果这不是你本人的操作');
    });
});
