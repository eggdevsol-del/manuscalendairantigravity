/** No Shopify authentication is performed. Explicit opt-in for deployed test environments. */
export function shopifyImportSimulatorEnabled(
  env: NodeJS.ProcessEnv = process.env
) {
  return (
    env.NODE_ENV === "development" ||
    env.ENABLE_SHOPIFY_IMPORT_SIMULATOR === "true"
  );
}
