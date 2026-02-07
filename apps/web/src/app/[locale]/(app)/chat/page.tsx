import { useTranslations } from "next-intl";

export default function ChatPage() {
  const t = useTranslations("chat");

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-4">{t("title")}</h1>
      <p className="text-muted-foreground">{t("description")}</p>
    </div>
  );
}
