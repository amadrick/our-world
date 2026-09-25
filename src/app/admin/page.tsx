import type { Metadata } from "next";
import { connection } from "next/server";

import { AdminDashboard } from "@/components/admin/admin-dashboard";
import { AdminLogin } from "@/components/admin/admin-login";
import { site } from "@/config/site";
import { aiConfigured, aiModel } from "@/lib/ai/summary";
import { imageGenerationEnabled } from "@/lib/images/render.mjs";
import {
  DEFAULT_ADMIN_PASSWORD,
  adminLoginEnabled,
  isAdmin,
  usingDefaultPassword,
} from "@/lib/auth";
import { getPlaceStore } from "@/lib/storage";

export const metadata: Metadata = {
  title: `Add places · ${site.name}`,
  robots: { index: false, follow: false },
};

export default async function AdminPage() {
  await connection();

  const places = await getPlaceStore().list();
  const backdrop = places.flatMap((p) => (p.image ? [p.image] : []));

  if (!(await isAdmin())) {
    return (
      <AdminLogin
        backdrop={backdrop}
        enabled={adminLoginEnabled()}
        defaultPasswordHint={
          usingDefaultPassword() && adminLoginEnabled() ? DEFAULT_ADMIN_PASSWORD : null
        }
      />
    );
  }

  return (
    <AdminDashboard
      initialPlaces={places}
      backdrop={backdrop}
      ai={{ enabled: aiConfigured(), model: aiModel() }}
      imagesEnabled={aiConfigured() && imageGenerationEnabled()}
      usingDefaultPassword={usingDefaultPassword()}
    />
  );
}
