import { describe, expect, it } from "vitest";
import { allLicensePlates, joinLicensePlates, platesForInputs, splitLicensePlates } from "./vehicles";

describe("vehicles helpers", () => {
  const reservation = { license_plate: "WX 1", extra_license_plates: ["KR 2", " "], vehicle_count: 3 };

  it("lists the plates of all cars, car 1 first, dropping blanks", () => {
    expect(allLicensePlates(reservation)).toEqual(["WX 1", "KR 2"]);
    expect(joinLicensePlates(reservation)).toBe("WX 1 · KR 2");
    expect(joinLicensePlates({ license_plate: null })).toBe("");
  });

  it("pads the inputs to the car count", () => {
    expect(platesForInputs(reservation, 3)).toEqual(["WX 1", "KR 2", " "]);
    expect(platesForInputs({ license_plate: "WX 1" }, 2)).toEqual(["WX 1", ""]);
    expect(platesForInputs(reservation, 1)).toEqual(["WX 1"]);
  });

  it("splits per-car plates into the DB shape", () => {
    expect(splitLicensePlates(["wx 1", " kr 2 ", ""], 3)).toEqual({
      license_plate: "WX 1",
      extra_license_plates: ["KR 2"],
    });
    expect(splitLicensePlates(["", "", "po 3"], 3)).toEqual({
      license_plate: null,
      extra_license_plates: ["", "PO 3"],
    });
    expect(splitLicensePlates(["a", "b", "c"], 2).extra_license_plates).toEqual(["B"]);
  });
});
