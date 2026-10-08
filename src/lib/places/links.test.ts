import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { uberRideUrl } from "./links";
import type { Place } from "./types";

describe("uberRideUrl", () => {
  it("builds Uber's universal link with every special character escaped", () => {
    const url = uberRideUrl({
      name: "Joe's Café & Bar #2 + 50% (rooftop)",
      address: "1 Fake St, Apt 3/4, San Francisco, CA 94110?",
      lat: 37.758987,
      lng: -122.412369,
    });
    expect(url).toBe(
      "https://m.uber.com/ul/?action=setPickup&pickup=my_location" +
        "&dropoff[latitude]=37.758987&dropoff[longitude]=-122.412369" +
        "&dropoff[nickname]=Joe%27s%20Caf%C3%A9%20%26%20Bar%20%232%20%2B%2050%25%20%28rooftop%29" +
        "&dropoff[formatted_address]=1%20Fake%20St%2C%20Apt%203%2F4%2C%20San%20Francisco%2C%20CA%2094110%3F",
    );
    const params = new URL(url).searchParams;
    expect(params.get("dropoff[nickname]")).toBe("Joe's Café & Bar #2 + 50% (rooftop)");
    expect(params.get("dropoff[formatted_address]")).toBe("1 Fake St, Apt 3/4, San Francisco, CA 94110?");
    expect([...params.keys()]).toEqual([
      "action",
      "pickup",
      "dropoff[latitude]",
      "dropoff[longitude]",
      "dropoff[nickname]",
      "dropoff[formatted_address]",
    ]);
  });

  it("leaves the address out when a place has none", () => {
    const url = uberRideUrl({ name: "Ocean Beach", address: "", lat: 37.76, lng: -122.51 });
    expect(new URL(url).searchParams.has("dropoff[formatted_address]")).toBe(false);
  });

  it("round-trips every place in the guide to its own name, address, and coordinates", () => {
    const { places }: { places: Place[] } = JSON.parse(
      readFileSync(path.join(process.cwd(), "data/places.json"), "utf8"),
    );
    expect(places.length).toBeGreaterThan(100);
    for (const place of places) {
      const params = new URL(uberRideUrl(place)).searchParams;
      expect(params.get("dropoff[nickname]"), place.id).toBe(place.name);
      expect(Number(params.get("dropoff[latitude]")), place.id).toBe(place.lat);
      expect(Number(params.get("dropoff[longitude]")), place.id).toBe(place.lng);
      if (place.address) expect(params.get("dropoff[formatted_address]"), place.id).toBe(place.address);
    }
  });
});
