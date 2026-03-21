const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

export async function sendTelegramMessage(text: string, chatId?: string) {
  const targetChat = chatId || CHAT_ID;
  if (!targetChat) {
    throw new Error("No Telegram chat ID configured");
  }

  const res = await fetch(
    `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: targetChat,
        text,
        parse_mode: "Markdown",
      }),
    }
  );

  if (!res.ok) {
    const error = await res.json();
    throw new Error(`Telegram API error: ${JSON.stringify(error)}`);
  }

  return res.json();
}
