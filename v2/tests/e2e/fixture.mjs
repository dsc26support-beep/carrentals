/** The payload PostgREST returns, shaped exactly as the real query would. */
export const VEHICLES = [
  { id: "v1", slug: "nissan-march", name: "Nissan March", price_per_day: "60.00", currency: "AUD",
    is_available: true, description: null, seats: 5, transmission: "automatic", fuel: "petrol",
    air_conditioning: true, specifications: ["5 doors", "Hatchback boot"], display_order: 10,
    vehicle_images: [
      { storage_path: "march/front.jpg", alt: "Red Nissan March, front view", is_primary: true,  display_order: 0, width: 1200, height: 800 },
      { storage_path: "march/rear.jpg",  alt: "Red Nissan March, rear view",  is_primary: false, display_order: 1, width: 1200, height: 800 }
    ] },
  { id: "v2", slug: "honda-fit", name: "Honda Fit", price_per_day: "60.00", currency: "AUD",
    is_available: true, description: null, seats: 5, transmission: "automatic", fuel: "petrol",
    air_conditioning: true, specifications: ["5 doors", "Deep rear load space"], display_order: 20,
    vehicle_images: [] },
  { id: "v3", slug: "toyota-vitz-6221", name: "Toyota Vitz — white", price_per_day: "60.00", currency: "AUD",
    is_available: false, description: null, seats: 5, transmission: "automatic", fuel: "petrol",
    air_conditioning: true, specifications: ["2016 model", "White", "5 doors"], display_order: 30,
    vehicle_images: [] },
  { id: "v4", slug: "toyota-vitz-6234", name: "Toyota Vitz — white", price_per_day: "60.00", currency: "AUD",
    is_available: true, description: null, seats: 5, transmission: "automatic", fuel: "petrol",
    air_conditioning: true, specifications: ["2016 model", "White", "5 doors"], display_order: 40,
    vehicle_images: [] },
  { id: "v5", slug: "toyota-vitz-6247", name: "Toyota Vitz — gray", price_per_day: "60.00", currency: "AUD",
    is_available: true, description: null, seats: 5, transmission: "automatic", fuel: "petrol",
    air_conditioning: true, specifications: ["2017 model", "Gray", "5 doors"], display_order: 50,
    vehicle_images: [] }
];

export const SETTINGS = [
  { key: "business.name", value: "Tenana Rentals" },
  { key: "business.phone_primary", value: "+68673053005" },
  { key: "business.phone_secondary", value: "+68673039089" },
  { key: "business.whatsapp", value: "68673039089" },
  { key: "business.messenger_url", value: "https://www.facebook.com/share/1GNQMcx1cg/" },
  { key: "business.email", value: "ruuka4climatechange@gmail.com" },
  { key: "business.address", value: "Bikenibeu, South Tarawa, Kiribati" },
  { key: "business.currency", value: "AUD" }
];

/** Stub Supabase so the page exercises its real code path, not a fake mode. */
export async function stubSupabase(context, { vehicles = VEHICLES, submit } = {}) {
  await context.route(/__SUPABASE_URL__|supabase\.co/, async (route) => {
    const url = route.request().url();
    const json = (body, status = 200) =>
      route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

    if (url.includes("/functions/v1/submit-request")) {
      return json(submit?.body ?? { reference: "A3F91C24" }, submit?.status ?? 200);
    }
    if (url.includes("site_settings")) { return json(SETTINGS); }
    if (url.includes("vehicles")) { return json(vehicles); }
    return json([]);
  });
}
