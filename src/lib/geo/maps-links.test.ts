import { describe, expect, it } from "vitest";

import { extractUrl, isShortMapsLink, parseLatLng, parseMapsUrl } from "./maps-links";

describe("parseMapsUrl — Apple Maps", () => {
  it("reads the current place-card format", () => {
    const link =
      "https://maps.apple.com/place?address=600%20Guerrero%20St,%20San%20Francisco,%20CA%2094110,%20United%20States&coordinate=37.761432,-122.424095&name=Tartine%20Bakery&place-id=I6A1B2C3D&map=explore";
    expect(parseMapsUrl(link)).toEqual({
      provider: "apple",
      position: { lat: 37.761432, lng: -122.424095 },
      near: undefined,
      name: "Tartine Bakery",
      address: "600 Guerrero St, San Francisco, CA 94110, United States",
    });
  });

  it("reads the classic ?q=&ll= format", () => {
    const parsed = parseMapsUrl(
      "https://maps.apple.com/?address=1658%20Market%20St&auid=123&ll=37.77356,-122.42165&lsp=9902&q=Zuni%20Caf%C3%A9",
    );
    expect(parsed?.name).toBe("Zuni Café");
    expect(parsed?.position).toEqual({ lat: 37.77356, lng: -122.42165 });
    expect(parsed?.address).toBe("1658 Market St");
  });

  it("treats a bare address as a search query", () => {
    const parsed = parseMapsUrl("https://maps.apple.com/?address=2889+Mission+St,+San+Francisco");
    expect(parsed?.query).toBe("2889 Mission St, San Francisco");
    expect(parsed?.position).toBeUndefined();
  });

  it("uses sll only as a search bias", () => {
    const parsed = parseMapsUrl("https://maps.apple.com/?q=Trick+Dog&sll=37.759,-122.411");
    expect(parsed?.name).toBe("Trick Dog");
    expect(parsed?.position).toBeUndefined();
    expect(parsed?.near).toEqual({ lat: 37.759, lng: -122.411 });
  });
});

describe("parseMapsUrl — Google Maps", () => {
  it("prefers the pin in the data blob over the viewport center", () => {
    const parsed = parseMapsUrl(
      "https://www.google.com/maps/place/Tartine+Bakery/@37.7614,-122.4262,17z/data=!3m1!4b1!4m6!3m5!1s0x808f7e3dabcdef:0x123!8m2!3d37.7614611!4d-122.4240106!16s%2Fm%2F02r3xyz",
    );
    expect(parsed).toMatchObject({
      provider: "google",
      name: "Tartine Bakery",
      position: { lat: 37.7614611, lng: -122.4240106 },
      near: { lat: 37.7614, lng: -122.4262 },
    });
  });

  it("splits a place label into name and address", () => {
    const parsed = parseMapsUrl(
      "https://www.google.com/maps/place/Swan+Oyster+Depot,+1517+Polk+St,+San+Francisco,+CA+94109/",
    );
    expect(parsed?.name).toBe("Swan Oyster Depot");
    expect(parsed?.address).toBe("1517 Polk St, San Francisco, CA 94109");
  });

  it("reads coordinates from ?q=", () => {
    expect(parseMapsUrl("https://maps.google.com/?q=37.80778,-122.47485")?.position).toEqual({
      lat: 37.80778,
      lng: -122.47485,
    });
  });

  it("reads the api=1 search format", () => {
    const parsed = parseMapsUrl(
      "https://www.google.com/maps/search/?api=1&query=La+Taqueria+San+Francisco",
    );
    expect(parsed?.query).toBe("La Taqueria San Francisco");
  });

  it("ignores Google links that aren't maps", () => {
    expect(parseMapsUrl("https://www.google.com/search?q=tartine")).toBeNull();
  });
});

describe("helpers", () => {
  it("rejects non-maps and malformed links", () => {
    expect(parseMapsUrl("https://example.com/?ll=37.7,-122.4")).toBeNull();
    expect(parseMapsUrl("not a url")).toBeNull();
  });

  it("detects short links that need expanding", () => {
    expect(isShortMapsLink(new URL("https://maps.app.goo.gl/AbC123"))).toBe(true);
    expect(isShortMapsLink(new URL("https://goo.gl/maps/AbC123"))).toBe(true);
    expect(isShortMapsLink(new URL("https://maps.apple/p/AbC123"))).toBe(true);
    expect(isShortMapsLink(new URL("https://maps.apple.com/?q=x&ll=1,2"))).toBe(false);
  });

  it("pulls the link out of share-sheet text", () => {
    expect(
      extractUrl("Tartine Bakery\n600 Guerrero St\nhttps://maps.app.goo.gl/AbC123"),
    ).toEqual({ url: "https://maps.app.goo.gl/AbC123", rest: "Tartine Bakery\n600 Guerrero St" });
  });

  it("validates coordinate pairs", () => {
    expect(parseLatLng("37.7, -122.4")).toEqual({ lat: 37.7, lng: -122.4 });
    expect(parseLatLng("137.7,-122.4")).toBeUndefined();
    expect(parseLatLng("Tartine")).toBeUndefined();
  });
});
