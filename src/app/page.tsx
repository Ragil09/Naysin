import { PublicHome } from "@/frontend/components/public/PublicHome";
import { getPublicMenuCatalog } from "@/backend/public/menu-catalog";
import { normalizeWhatsAppNumber } from "@/shared/whatsapp-order";

export const dynamic = "force-dynamic";

export default async function RootPage() {
  const menus = await getPublicMenuCatalog();
  const orderNumber = normalizeWhatsAppNumber(process.env.NAYSIN_WHATSAPP_NUMBER);
  return <PublicHome menus={menus} orderNumber={orderNumber} />;
}
