import { Toaster } from "sonner";

/**
 * Wrapper komponentu Toaster z biblioteki sonner.
 * Używany w Layout.astro do wyświetlania toast notifications.
 */
export default function ToasterWrapper() {
  return <Toaster position="top-right" richColors />;
}
