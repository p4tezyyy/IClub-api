"""Use environment variables ICLUB_EMAIL, ICLUB_PASSWORD and ICLUB_GYM."""
import asyncio
import os
from iclub_api import IClub

async def main():
    async with IClub(browser_enabled=False) as api:
        await api.login(os.environ["ICLUB_EMAIL"], os.environ["ICLUB_PASSWORD"], os.environ["ICLUB_GYM"])
        print(await api.get_credit())
        print(await api.get_available_tickets())
        print(await api.get_visit_history())
        print(await api.get_calendar(view="week"))

if __name__ == "__main__":
    asyncio.run(main())
