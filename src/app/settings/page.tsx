import { redirect } from "next/navigation";

export default function SettingsPage() {
    redirect("/portfolios?settings=1");
}
