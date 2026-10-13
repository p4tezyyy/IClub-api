import assert from "node:assert/strict";
import { test } from "node:test";
import { IClub, IClubSignalRSession, createGuid, IClubError } from "../dist/index.js";

test("exports public SDK", () => {
  const client = new IClub();
  for (const method of ["login", "getDashboard", "getProfile", "getCalendar", "getRooms",
      "getCustomerEvents", "getLiveQrCode", "getVisitHistory", "getCredit", "getTransaction",
      "updateContactInformation", "changePassword", "prepareCreditDeposit", "rawInvoke", "logout", "close"])
    assert.equal(typeof client[method], "function");
  assert.equal(typeof IClub.listGyms, "function");
  assert.equal(typeof IClub.register, "function");
});

test("helper formatting and random IDs", () => {
  assert.equal(IClubSignalRSession.formatMoney(5.12), "5,12");
  assert.equal(IClubSignalRSession.mapTransactionStatus(2), "Closed");
  assert.equal(IClubSignalRSession.mapCountry(187), "Slovakia");
  assert.notEqual(createGuid(), createGuid());
});

test("authenticated hub access rejects before login", async () => {
  const api = new IClub();
  await assert.rejects(api.rawInvoke("personworkflowhub", "GetUser", []), (err) => err instanceof IClubError && err.code === "ICLUB_SESSION_REQUIRED");
});

test("registration consent checked before opening browser", async () => {
  await assert.rejects(IClub.register({gymName:"Gym", gender:"man", firstName:"A", lastName:"B", phone:"1", email:"a@example.org", acceptPrivacyPolicy:false, acceptTerms:true}), /Consent/);
});
