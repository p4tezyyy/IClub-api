import pytest
from datetime import datetime, timezone
from iclub_api import IClub, AuthenticationError, IClubError
from iclub_api.client import _calendar_range, _visit, _duration
from iclub_api.transport import hash_password, unwrap_result, TransportError

class FakeTransport:
    def __init__(self):
        self.calls = []
        self.responses = {}
        self.closed = False

    async def invoke(self, hub, method, args, **kwargs):
        self.calls.append((hub, method, args))
        response = self.responses.get(method)
        if callable(response):
            return response(args)
        return response

    async def close(self):
        self.closed = True


@pytest.fixture
def mock():
    transport = FakeTransport()
    api = IClub(transport=transport)
    api._context = {"Ident": "test", "SessionId": "s", "DefaultCulture": "en-GB"}
    api._user_id = 42
    api._email = "member@example.org"
    return api, transport


def test_password_hash_exact():
    import hashlib, base64
    assert hash_password("abc") == base64.b64encode(hashlib.sha256(b"abc").digest()).decode()


def test_signalr_wrapping():
    assert unwrap_result({"I":"0", "R":[{"State":2, "Right":[{"ok":True}]}]}) == {"ok":True}
    assert unwrap_result({"I":"0", "R":[{"State":2, "Right":[1,2]}]}) == [1,2]
    assert unwrap_result({"I":"0", "R":[{"State":2, "Right":[]}]}) == []
    with pytest.raises(IClubError):
        unwrap_result({"I":"1", "R":[{"Left": "Invalid query", "State":1}]})
    with pytest.raises(TransportError):
        unwrap_result({"I":"2", "R":[{"State":3, "Right":[]}]})


@pytest.mark.asyncio
async def test_unauthenticated_requires_login():
    api = IClub(transport=FakeTransport())
    with pytest.raises(AuthenticationError):
        await api.get_user()


@pytest.mark.asyncio
async def test_hub_signatures(mock):
    api, t = mock
    t.responses.update({"GetUser":{"UserId":42}, "GetVisitsTransactions":{"Transactions":[{"TransactionId":77}]},
                        "GetCustomerAvailableTickets":[]})
    assert (await api.get_user())["UserId"] == 42
    assert (await api.get_visits_transactions(3))[0]["TransactionId"] == 77
    assert await api.get_available_tickets() == []
    assert t.calls[0][0:2] == ("personworkflowhub", "GetUser")
    assert t.calls[0][2][0] == api._context
    assert t.calls[0][2][2] == 42
    assert t.calls[1][2][-3:] == [42, 0, 3]


@pytest.mark.asyncio
async def test_calendar_raw_mapping_and_booked(mock):
    api, t = mock
    t.responses.update({"GetCustomerEvents":[{"EventId":12}], "GetRooms":[{"RoomId":1}],
                        "GetRoomsEvents":[{"EventId":12, "Name":"Workout", "StartDate":"2026-10-13T10:00:00Z",
                                          "EndDate":"2026-10-13T11:00:00Z", "AttendeesCount":4, "Capacity":10}]})
    cal = await api.get_calendar(start="2026-10-11T00:00:00+00:00",end="2026-10-18T00:00:00+00:00")
    assert cal["events"][0]["booked"] is True
    assert cal["events"][0]["id"] == 12
    assert cal["events"][0]["occupancy"] == "4/10"


@pytest.mark.asyncio
async def test_profile_and_credit(mock):
    api,t = mock
    t.responses.update({"GetUser":{"UserId":42, "FirstName":"Mila", "LastName":"K", "Country":187,
                                    "Account":{"TotalBalance":22.5, "AccountType":{"MinChargeAmount":5}}},
                        "GetCustomerStats":{"TotalVisitsCount":3}, "GetCustomerAvailableTickets":[],
                        "GetVisitsTransactions":{"Transactions":[]}, "GetSalesTransactions":{"Transactions":[]}})
    profile = await api.get_profile()
    assert profile["member"]["name"] == "Mila K"
    assert profile["creditDeposit"]["minAmount"] == 5
    credit = await api.get_credit()
    assert credit["totalBalance"] == 22.5


@pytest.mark.asyncio
async def test_password_change_arguments(mock):
    api,t = mock
    t.responses["ChangePassword"] = True
    await api.change_password("old", "newpass", "newpass")
    assert t.calls[-1][2][-3:] == ["member@example.org", hash_password("old"), hash_password("newpass")]
    with pytest.raises(ValueError):
        await api.change_password("a", "a", "different")


@pytest.mark.asyncio
async def test_update_contact_information(mock):
    api,t = mock
    t.responses.update({"GetUser":{"UserId":42,"Country":187,"Account":{}},"GetCustomerStats":{},
                        "GetCustomerAvailableTickets":[],"GetVisitsTransactions":{"Transactions":[]},
                        "GetSalesTransactions":{"Transactions":[]},"SubmitUser":True})
    await api.update_contact_information(gender="male",first_name="P",last_name="T",email="p@example.com")
    assert t.calls[1][1] == "SubmitUser"
    assert t.calls[1][2][-1]["MarketingConsent"] == 0
    assert t.calls[1][2][-1]["UserId"] == 42


@pytest.mark.asyncio
async def test_reservation_requires_confirmed_event(mock):
    api,t=mock
    t.responses.update({"GetCustomerEvents":[], "GetRooms":[], "GetRoomsEvents":[]})
    with pytest.raises(IClubError, match="Event ID"):
        await api.reserve_event(23)
    assert "reserve_event" not in [x[1] for x in t.calls]


def test_dates_and_duration():
    d,e = _calendar_range(start="2026-11-01T12:00:00+01:00", view="month")
    assert d < e
    assert d.strftime("%Y-%m-%d") == "2026-11-01"
    assert _duration("01.01:02:03") == "25:02:03"
    assert _duration("61") == "00:01:01"
    assert _visit({"TransactionId":5,"EntryDate":"2026-10-13T12:00:00Z", "TransactionStatus":1})["status"] == "Open"


@pytest.mark.asyncio
async def test_close(mock):
    api,t=mock
    t.responses["Logout"] = True
    await api.close()
    assert t.closed
    assert t.calls[-1][1] == "Logout"

@pytest.mark.asyncio
async def test_login_signature_and_session_id(monkeypatch):
    async def list_gyms(cls):
        return [{"id": "mygym-id", "name": "My Gym"}]
    monkeypatch.setattr(IClub, "list_gyms", classmethod(list_gyms))
    t = FakeTransport()
    t.responses["Login"] = {"UserId": 123, "SessionId": "returned-session"}
    api = IClub(transport=t)
    await api.login("test@example.org", "correctpass", "MY GYM")
    hub, method, args = t.calls[0]
    assert (hub,method) == ("authenticationworkflowhub", "Login")
    assert args[0]["Ident"] == "mygym-id"
    assert args[0]["SessionId"] == "returned-session" # context updated in place after login
    assert args[3] == hash_password("correctpass")
    assert args[4] is False
    assert api._context["SessionId"] == "returned-session"
    assert api._password == ""  # not retained without browser fallback
    await api.close()


@pytest.mark.asyncio
async def test_dashboard_series(mock):
    api,t = mock
    t.responses.update({"GetUser":{"UserId":42, "FullName":"Member Name", "Account":{"TotalBalance":15}},
                        "GetCustomerStats":{"TotalVisitsCount":2,"ValidTicketsCount":1}, "GetCustomerAvailableTickets":[],
                        "GetHomePageText":"Gym news", "GetVisitsTransactions":{"Transactions":[]},
                        "GetSalesTransactions":{"Transactions":[]}})
    dash = await api.get_dashboard()
    assert dash["overviewMessage"] == "Gym news"
    assert len(dash["attendanceSeries"]) == 4
    assert len(dash["weekdayDistribution"]) == 7
    assert dash["metrics"][1]["value"] == "15,00"
