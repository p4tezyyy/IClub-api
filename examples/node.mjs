import { IClub } from "iclub-api";
const client = new IClub();
try {
  await client.login(process.env.ICLUB_EMAIL, process.env.ICLUB_PASSWORD, process.env.ICLUB_GYM);
  console.log(await client.getCredit());
  console.log(await client.getAvailableTickets());
  console.log(await client.getVisitHistory());
  console.log(await client.getCalendar({view:"week"}));
} finally {
  await client.close();
}
