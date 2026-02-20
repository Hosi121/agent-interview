import { Resend } from "resend";

let _resend: Resend | null = null;
function getResend(): Resend {
  if (!_resend) {
    _resend = new Resend(process.env.RESEND_API_KEY);
  }
  return _resend;
}

export async function sendVerificationEmail(
  to: string,
  token: string,
): Promise<void> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001";
  const verifyUrl = `${appUrl}/verify-email?token=${token}`;

  // 開発環境: APIキーが未設定またはプレースホルダーの場合はコンソール出力のみ
  if (
    !process.env.RESEND_API_KEY ||
    process.env.RESEND_API_KEY.startsWith("re_xxx")
  ) {
    console.log("[email] Verification email (dev mode):");
    console.log(`  To: ${to}`);
    console.log(`  URL: ${verifyUrl}`);
    return;
  }

  const emailFrom = process.env.EMAIL_FROM || "MeTalk <noreply@metalk.jp>";
  await getResend().emails.send({
    from: emailFrom,
    to,
    subject: "【MeTalk】メールアドレスの認証",
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <h2 style="font-size: 20px; margin-bottom: 16px;">メールアドレスの認証</h2>
        <p style="color: #555; line-height: 1.6;">
          MeTalkへのご登録ありがとうございます。<br />
          以下のボタンをクリックして、メールアドレスの認証を完了してください。
        </p>
        <div style="text-align: center; margin: 32px 0;">
          <a
            href="${verifyUrl}"
            style="display: inline-block; background: #111; color: #fff; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600;"
          >
            メールアドレスを認証する
          </a>
        </div>
        <p style="color: #888; font-size: 13px; line-height: 1.5;">
          このリンクは24時間有効です。<br />
          心当たりがない場合は、このメールを無視してください。
        </p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
        <p style="color: #aaa; font-size: 11px;">MeTalk — AIエージェントによる非同期面接プラットフォーム</p>
      </div>
    `,
  });
}
