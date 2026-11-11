import type { MetadataRoute } from "next"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/$", "/signup", "/login", "/warranty-lookup", "/video"],
        disallow: ["/api/", "/d/", "/driver", "/onboarding", "/pending", "/admin", "/settings", "/receive-order", "/auto-reorders",
          "/inventory", "/batteries", "/fleet", "/team", "/reports", "/alerts", "/locations", "/reconcile", "/warranty-report",
          "/warranty$", "/core-", "/driver-sales", "/print-labels", "/truck-labels", "/forgot-password", "/reset-password", "/analytics"],
      },
    ],
    sitemap: "https://www.battery-city.com/sitemap.xml",
    host: "https://www.battery-city.com",
  }
}
