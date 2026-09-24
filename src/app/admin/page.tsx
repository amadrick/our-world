import type { Metadata } from "next";
import { connection } from "next/server";

import { AdminDashboard } from "@/components/admin/admin-dashboard";
import { AdminLogin } from "@/components/admin/admin-login";
import { site } from "@/config/site";
import { aiConfigured, aiModel } from "@/lib/ai/summary";
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

  if (!(await isAdmin())) {
    return (
      <AdminLogin
        enabled={adminLoginEnabled()}
        defaultPasswordHint={
          usingDefaultPassword() && adminLoginEnabled() ? DEFAULT_ADMIN_PASSWORD : null
        }
      />
    );
  }

  return (
    <AdminDashboard
      initialPlaces={await getPlaceStore().list()}
      ai={{ enabled: aiConfigured(), model: aiModel() }}
      usingDefaultPassword={usingDefaultPassword()}
    />
  );
}
