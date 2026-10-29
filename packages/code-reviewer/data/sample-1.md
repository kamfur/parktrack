diff --git a/src/pages/api/vehicles/index.ts b/src/pages/api/vehicles/index.ts
index 1111111..2222222 100644
--- a/src/pages/api/vehicles/index.ts
+++ b/src/pages/api/vehicles/index.ts
@@ -1,12 +1,22 @@
-import type { APIRoute } from "astro";
-import { z } from "zod";
-
-export const prerender = false;
-
-const bodySchema = z.object({
-  plate: z.string().min(1),
-});
-
-export const POST: APIRoute = async ({ request, locals }) => {
-  const parsed = bodySchema.safeParse(await request.json());
-  if (!parsed.success) {
-    return new Response(JSON.stringify({ error: "invalid" }), { status: 400 });
-  }
-  const supabase = locals.supabase;
-  // ...
-  return new Response(JSON.stringify({ ok: true }), { status: 201 });
-};
+import type { APIRoute } from "astro";
+import { createClient } from "@supabase/supabase-js";
+
+// brak prerender = false
+export const post: APIRoute = async ({ request }) => {
+  const body = await request.json();
+  // brak walidacji Zod — plate idzie prosto do query
+  const supabase = createClient(
+    process.env.PUBLIC_SUPABASE_URL!,
+    process.env.SUPABASE_SERVICE_ROLE_KEY!
+  );
+  const { data } = await supabase
+    .from("vehicles")
+    .insert({ plate: body.plate })
+    .select();
+  return new Response(JSON.stringify(data), { status: 200 });
+};
