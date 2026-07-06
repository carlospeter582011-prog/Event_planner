import asyncio
import re
import time
from playwright import async_api
from playwright.async_api import expect


BASE_URL = "https://event-planner-carlos.vercel.app"
HOST_EMAIL = "carlospeter582011@gmail.com"
SECOND_EMAIL = "drpeterramsis2007@gmail.com"
PASSWORD = "K@ko2011"


async def sign_in(page, email):
    await page.goto(f"{BASE_URL}/auth/signin")
    await page.get_by_test_id("auth-email-input").wait_for(state="visible", timeout=30000)
    await page.get_by_test_id("auth-email-input").fill(email)
    await page.get_by_test_id("auth-password-input").fill(PASSWORD)
    await page.get_by_test_id("auth-submit").click()
    await expect(page.get_by_test_id("dashboard-title")).to_be_visible(timeout=45000)


async def sign_out(page):
    if await page.get_by_test_id("nav-signout").count() > 0:
        await page.get_by_test_id("nav-signout").click(timeout=15000)
    await page.goto(f"{BASE_URL}/auth/signin")
    await page.get_by_test_id("auth-email-input").wait_for(state="visible", timeout=30000)


async def open_room(page, room_url, room_title):
    await page.goto(room_url)
    await expect(page.get_by_test_id("room-workspace")).to_be_visible(timeout=45000)
    await expect(page.get_by_test_id("room-title")).to_contain_text(room_title)


async def assert_no_visible_error(page, test_id, context):
    locator = page.get_by_test_id(test_id)
    if await locator.count() > 0:
        try:
            if await locator.is_visible(timeout=1500):
                raise AssertionError(f"{context} showed visible error: {await locator.inner_text()}")
        except AssertionError:
            raise
        except Exception:
            pass


async def create_day(page, title, date):
    await page.get_by_test_id("tab-timeline").click()
    await page.get_by_test_id("btn-add-day").click()
    await page.get_by_test_id("add-day-title").fill(title)
    await page.get_by_test_id("add-day-date").fill(date)
    await page.locator("button", has_text="Add day").click()
    await assert_no_visible_error(page, "add-day-error", f"Creating day {title}")
    await expect(page.locator(f"text={title}").first).to_be_visible(timeout=45000)


async def create_activity(page, title, description, cost, location):
    await page.locator("[data-testid^='btn-add-activity-']").last.click()
    await page.get_by_test_id("activity-title").fill(title)
    await page.get_by_test_id("activity-desc").fill(description)
    await page.get_by_test_id("activity-cost").fill(str(cost))
    await page.get_by_test_id("activity-location").fill(location)
    await page.locator("button", has_text=re.compile("Add activity", re.I)).last.click()
    await expect(page.locator(f"text={title}").first).to_be_visible(timeout=45000)


async def create_poll(page, question, options):
    await page.locator("[data-testid^='btn-create-poll-']").first.click()
    await page.get_by_test_id("poll-question").fill(question)
    await page.get_by_test_id("poll-option-1").fill(options[0])
    await page.get_by_test_id("poll-option-2").fill(options[1])
    for option in options[2:]:
        await page.get_by_test_id("poll-add-option").click()
        option_count = len(await page.locator("[data-testid^='poll-option-']").all())
        await page.get_by_test_id(f"poll-option-{option_count}").fill(option)
    await page.get_by_test_id("create-poll-submit").click()
    await assert_no_visible_error(page, "create-poll-error", f"Creating poll {question}")
    await expect(page.locator(f"text={question}").first).to_be_visible(timeout=45000)


async def create_task(page, title, due_date, priority, visibility):
    await page.get_by_test_id("tab-tasks").click()
    await page.get_by_test_id("btn-add-task").click()
    await page.get_by_test_id("create-task-title").fill(title)
    await page.get_by_test_id("create-task-due").fill(due_date)
    await page.get_by_test_id("create-task-priority").select_option(priority)
    await page.get_by_test_id("create-task-visibility").select_option(visibility)
    await page.locator("button", has_text="Create to-do").click()
    await expect(page.locator(f"text={title}").first).to_be_visible(timeout=45000)


async def add_timeline_comment(page, body):
    await page.get_by_test_id("tab-timeline").click()
    await page.locator("[data-testid^='comment-input-timeline']").first.fill(body)
    await page.locator("[data-testid^='comment-submit-timeline']").first.click()
    await expect(page.locator(f"text={body}").first).to_be_visible(timeout=45000)


async def add_budget_comment(page, body):
    await page.get_by_test_id("tab-budget").click()
    await page.locator("[data-testid^='comment-input-budget']").first.fill(body)
    await page.locator("[data-testid^='comment-submit-budget']").first.click()
    await expect(page.locator(f"text={body}").first).to_be_visible(timeout=45000)


async def send_chat(page, body):
    await page.get_by_test_id("tab-chat").click()
    await page.get_by_test_id("chat-input").fill(body)
    await page.get_by_test_id("chat-send").click()
    await assert_no_visible_error(page, "chat-send-error", f"Sending chat {body}")
    await expect(page.locator(f"text={body}").first).to_be_visible(timeout=45000)


async def vote_first_option(page):
    await page.get_by_test_id("tab-timeline").click()
    vote_buttons = page.locator("[data-testid^='poll-vote-']")
    await expect(vote_buttons.first).to_be_visible(timeout=30000)
    await vote_buttons.first.click()
    await expect(page.locator("text=/Your vote|1 \\(/").first).to_be_visible(timeout=45000)


async def expect_poll_voters_visible(page):
    await page.get_by_test_id("tab-timeline").click()
    voters = page.locator("[data-testid^='poll-voters-']").filter(
        has_text=re.compile("Voted:|carlospeter|drpeterramsis|Carlos|Peter|Participant", re.I)
    )
    await expect(voters.first).to_be_visible(timeout=45000)


async def delete_last_poll(page, question):
    await page.get_by_test_id("tab-timeline").click()
    delete_buttons = page.locator("[data-testid^='poll-delete-']")
    await expect(delete_buttons.last).to_be_visible(timeout=30000)
    await delete_buttons.last.click()
    await expect(page.locator(f"text={question}").first).to_be_hidden(timeout=45000)


async def assert_viewer_is_restricted(page):
    await page.get_by_test_id("tab-command").click()
    assert await page.get_by_test_id("host-user-controller").count() == 0, "Viewer can see Host User Controller"
    await page.get_by_test_id("tab-budget").click()
    assert await page.get_by_test_id("btn-edit-budget").count() == 0, "Viewer can edit budget"
    await page.get_by_test_id("tab-timeline").click()
    assert await page.get_by_test_id("btn-add-day").count() == 0, "Viewer can add days before permission grant"


async def select_second_participant(page):
    await page.get_by_test_id("tab-command").click()
    await expect(page.get_by_test_id("host-user-controller")).to_be_visible(timeout=30000)
    participant = page.locator("[data-testid^='participant-']").filter(
        has_text=re.compile("drpeterramsis2007|Peter|Ramsis", re.I)
    ).first
    await expect(participant).to_be_visible(timeout=45000)
    await participant.click()


async def set_permission(page, key, enabled):
    toggles = page.locator(f"[data-testid^='permission-toggle-'][data-testid$='-{key}']")
    count = await toggles.count()
    for index in range(count):
        toggle = toggles.nth(index)
        if await toggle.is_visible() and await toggle.is_enabled():
            checked = await toggle.is_checked()
            if checked != enabled:
                await toggle.click()
                await page.wait_for_timeout(1000)
            return
    raise AssertionError(f"No enabled permission toggle found for {key}")


async def grant_viewer_timeline_and_collab_permissions(page):
    await select_second_participant(page)
    for key in [
        "manage_itinerary",
        "manage_polls",
        "delete_polls",
        "vote",
        "chat",
        "manage_tasks",
        "create_public_tasks",
        "manage_comments",
    ]:
        await set_permission(page, key, True)


async def revoke_viewer_timeline_permission(page):
    await select_second_participant(page)
    await set_permission(page, "manage_itinerary", False)


async def run_test():
    pw = None
    browser = None
    context = None

    try:
        pw = await async_api.async_playwright().start()
        browser = await pw.chromium.launch(
            headless=True,
            args=["--window-size=1440,900", "--disable-dev-shm-usage"],
        )
        context = await browser.new_context(viewport={"width": 1440, "height": 900})
        context.set_default_timeout(25000)
        page = await context.new_page()

        unique_suffix = str(int(time.time()))
        room_title = f"Deep Two Account Event {unique_suffix}"

        # Cycle 1: public site, host auth, room creation, host-only setup.
        await page.goto(BASE_URL)
        await expect(page.get_by_test_id("nav-signin")).to_be_visible(timeout=30000)
        await sign_in(page, HOST_EMAIL)
        await expect(page.get_by_test_id("btn-create-room")).to_be_visible()
        await page.get_by_test_id("btn-create-room").click()
        await page.get_by_test_id("create-room-title").fill(room_title)
        await page.get_by_test_id("create-room-desc").fill("Deep TestSprite two-account regression")
        await page.get_by_test_id("create-room-budget").fill("1200")
        await page.get_by_test_id("create-room-submit").click()
        await expect(page.get_by_test_id("room-workspace")).to_be_visible(timeout=45000)
        await expect(page.get_by_test_id("room-title")).to_contain_text(room_title)
        await expect(page.locator("text=HOST").first).to_be_visible()

        room_url = page.url
        room_identifier = room_url.rstrip("/").split("/")[-1]
        slug = await page.get_by_test_id("room-slug").inner_text()
        assert slug.strip(), "Room slug was empty"

        await page.get_by_test_id("btn-copy-link").click()
        await expect(page.get_by_test_id("invite-dialog")).to_be_visible(timeout=30000)
        await expect(page.get_by_test_id("invite-link-input")).to_be_visible()
        await expect(page.get_by_test_id("invite-code-input")).to_be_visible()
        await page.keyboard.press("Escape")

        for test_id in ["tab-command", "tab-timeline", "tab-tasks", "tab-budget", "tab-chat"]:
            await expect(page.get_by_test_id(test_id)).to_be_visible()
        await page.get_by_test_id("tab-command").click()
        await expect(page.get_by_test_id("readiness-score")).to_be_visible()
        await expect(page.get_by_test_id("command-budget-health")).to_be_visible()
        await expect(page.get_by_test_id("host-user-controller")).to_be_visible()

        await create_day(page, "Arrival Day", "2026-08-10")
        await create_activity(page, "Welcome Dinner", "Team kickoff dinner", 250, "Main Hall")
        await create_day(page, "Workshop Day", "2026-08-11")
        await create_activity(page, "Planning Workshop", "Collaborative planning block", 300, "Studio A")
        await create_poll(
            page,
            "Where should dinner happen?",
            ["Main Hall Buffet", "Rooftop Dinner", "Garden Venue", "Seafood House", "Private Lounge"],
        )
        await vote_first_option(page)
        await add_timeline_comment(page, "Host timeline comment one")
        await add_timeline_comment(page, "Host timeline comment two")
        await create_task(page, "Confirm catering", "2026-08-09", "HIGH", "PRIVATE")
        await create_task(page, "Publish agenda", "2026-08-09", "MEDIUM", "PUBLIC")
        await page.locator("[data-testid^='task-toggle-']").first.click()
        await add_budget_comment(page, "Host budget comment")
        await send_chat(page, "Host deep chat message one")
        await send_chat(page, "Host deep chat message two")

        # Cycle 2: second account joins and verifies Viewer restrictions.
        await sign_out(page)
        await sign_in(page, SECOND_EMAIL)
        await page.goto(f"{BASE_URL}/join?slug={room_identifier}")
        await expect(page.get_by_test_id("room-workspace")).to_be_visible(timeout=45000)
        await expect(page.get_by_test_id("room-title")).to_contain_text(room_title)
        await assert_viewer_is_restricted(page)
        await vote_first_option(page)
        await add_timeline_comment(page, "Viewer timeline comment before grant")
        await create_task(page, "Viewer private preparation", "2026-08-08", "LOW", "PRIVATE")
        await send_chat(page, "Viewer chat before grant")

        # Cycle 3: host grants timeline and collaboration permissions to the viewer.
        await sign_out(page)
        await sign_in(page, HOST_EMAIL)
        await open_room(page, room_url, room_title)
        await expect(page.get_by_text(re.compile("drpeterramsis2007|Peter|Ramsis", re.I)).first).to_be_visible(timeout=45000)
        await grant_viewer_timeline_and_collab_permissions(page)
        await expect_poll_voters_visible(page)
        await page.get_by_test_id("tab-chat").click()
        await expect(page.locator("text=Viewer chat before grant").first).to_be_visible(timeout=45000)
        await page.get_by_test_id("tab-timeline").click()
        await expect(page.locator("text=Viewer timeline comment before grant").first).to_be_visible(timeout=45000)

        # Cycle 4: viewer uses newly granted timeline permissions.
        await sign_out(page)
        await sign_in(page, SECOND_EMAIL)
        await open_room(page, room_url, room_title)
        await page.get_by_test_id("tab-timeline").click()
        await expect(page.get_by_test_id("btn-add-day")).to_be_visible(timeout=30000)
        await create_day(page, "Viewer Added Day", "2026-08-12")
        await create_activity(page, "Viewer Added Activity", "Viewer-created itinerary item", 125, "Gallery")
        await create_poll(
            page,
            "Viewer poll choice?",
            ["Morning Slot", "Afternoon Slot", "Evening Slot"],
        )
        await delete_last_poll(page, "Viewer poll choice?")
        await add_timeline_comment(page, "Viewer comment after timeline grant")
        await create_task(page, "Viewer public task after grant", "2026-08-10", "MEDIUM", "PUBLIC")
        await send_chat(page, "Viewer chat after grant")

        # Cycle 5: host verifies viewer-created data, resolves a poll, then revokes timeline editing.
        await sign_out(page)
        await sign_in(page, HOST_EMAIL)
        await open_room(page, room_url, room_title)
        await page.get_by_test_id("tab-timeline").click()
        await expect(page.locator("text=Viewer Added Day").first).to_be_visible(timeout=45000)
        await expect(page.locator("text=Viewer Added Activity").first).to_be_visible(timeout=45000)
        await expect(page.locator("text=Viewer comment after timeline grant").first).to_be_visible(timeout=45000)
        if await page.locator("[data-testid^='poll-auto-commit-']").count() > 0:
            await page.locator("[data-testid^='poll-auto-commit-']").first.click()
            await expect(page.locator("text=CONFIRMED").first).to_be_visible(timeout=45000)
        await page.get_by_test_id("tab-tasks").click()
        await expect(page.locator("text=Viewer public task after grant").first).to_be_visible(timeout=45000)
        await page.get_by_test_id("tab-chat").click()
        await expect(page.locator("text=Viewer chat after grant").first).to_be_visible(timeout=45000)
        await revoke_viewer_timeline_permission(page)

        # Cycle 6: viewer confirms timeline edit access is gone while read/vote/chat still works.
        await sign_out(page)
        await sign_in(page, SECOND_EMAIL)
        await open_room(page, room_url, room_title)
        await page.get_by_test_id("tab-timeline").click()
        assert await page.get_by_test_id("btn-add-day").count() == 0, "Viewer can still add days after revoke"
        await expect(page.locator("text=Viewer Added Day").first).to_be_visible(timeout=45000)
        await add_timeline_comment(page, "Viewer comment after revoke")
        await send_chat(page, "Viewer chat after revoke")

        # Cycle 7: host final cross-account audit across all tabs.
        await sign_out(page)
        await sign_in(page, HOST_EMAIL)
        await open_room(page, room_url, room_title)
        await page.get_by_test_id("tab-command").click()
        await expect(page.get_by_test_id("permission-matrix")).to_be_visible(timeout=30000)
        await expect(page.get_by_test_id("room-health-board")).to_be_visible(timeout=30000)
        await page.get_by_test_id("tab-timeline").click()
        for text in [
            "Arrival Day",
            "Welcome Dinner",
            "Workshop Day",
            "Viewer Added Day",
            "Viewer comment after revoke",
        ]:
            await expect(page.locator(f"text={text}").first).to_be_visible(timeout=45000)
        await page.get_by_test_id("tab-budget").click()
        await expect(page.get_by_test_id("budget-remaining")).to_be_visible(timeout=30000)
        await expect(page.get_by_test_id("budget-usage-bar")).to_be_visible(timeout=30000)
        await page.get_by_test_id("tab-tasks").click()
        for text in ["Confirm catering", "Publish agenda", "Viewer public task after grant"]:
            await expect(page.locator(f"text={text}").first).to_be_visible(timeout=45000)
        await page.get_by_test_id("tab-chat").click()
        for text in [
            "Host deep chat message one",
            "Viewer chat before grant",
            "Viewer chat after grant",
            "Viewer chat after revoke",
        ]:
            await expect(page.locator(f"text={text}").first).to_be_visible(timeout=45000)

    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()
        if pw:
            await pw.stop()


asyncio.run(run_test())
