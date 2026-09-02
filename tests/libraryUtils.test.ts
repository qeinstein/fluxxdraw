import { describe, expect, it } from "vitest";
import {
  adaptLibraryElementsForTheme,
  filterLibraryItems,
  libraryPreviewBackground,
} from "../src/libraryUtils";

describe("library utilities", () => {
  it("filters personal components by every search word", () => {
    const items = [
      { id: "aws:s3", name: "S3 Storage" },
      { id: "checkout-api", name: "Checkout API" },
      { id: "notes", name: "Notes" },
    ];
    expect(filterLibraryItems(items, "api checkout").map((item) => item.id)).toEqual(["checkout-api"]);
    expect(filterLibraryItems(items, "")).toEqual(items);
  });

  it("adapts white and black ink without mutating saved library data", () => {
    const source = [{ id: "shape", strokeColor: "#ffffff", textColor: "#fff" }];
    const light = adaptLibraryElementsForTheme(source, "light");
    expect(light[0]).toMatchObject({ strokeColor: "#1e1e1e", textColor: "#1e1e1e" });
    expect(source[0]).toMatchObject({ strokeColor: "#ffffff", textColor: "#fff" });

    const dark = adaptLibraryElementsForTheme([{ strokeColor: "#1e1e1e", textColor: "#000000" }], "dark");
    expect(dark[0]).toMatchObject({ strokeColor: "#ffffff", textColor: "#ffffff" });
  });

  it("chooses a contrast preview surface for monochrome ink", () => {
    expect(libraryPreviewBackground([{ strokeColor: "#1e1e1e" }], "light")).toBe("#ffffff");
    expect(libraryPreviewBackground([{ strokeColor: "#ffffff" }], "light")).toBe("#252a34");
    expect(libraryPreviewBackground([{ strokeColor: "#1e1e1e" }], "dark")).toBe("#f4f6f8");
  });
});
