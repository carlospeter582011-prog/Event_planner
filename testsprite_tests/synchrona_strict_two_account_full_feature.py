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
    await page.get_by_test_id("auth-email-input").wait_for(state="visible", timeout=15000)
    await page.get_by_test_id("auth-email-input").fill(email)
    await page.get_by_test_id("auth-password-input").fill(PASSWORD)
    await page.get_by_test_id("auth-submit").click()
    await expect(page.get_by_test_id("dashboard-title")).to_be_visible(timeout=30000)


async def sign_out(page):
    await page.get_by_test_id("nav-signout").click(timeout=15000)
    await page.goto(f"{BASE_URL}/auth/signin")
    await page.get_by_test_id("auth-email-input").wait_for(state="visible", timeout=30000)


async def click_first_visible(page, *selectors):
    for selector in selectors:
        locator = page.locator(selector).first()
        if await locator.count() > 0:
            try:
                await locator.click(timeout=5000)
                return
            except Exception:
                pass
    raise AssertionError(f"No clickable selector found: {selectors}")


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
        context.set_default_timeout(20000)
        page = await context.new_page()

        # Public entry and host login.
        await page.goto(BASE_URL)
        await expect(page.get_by_test_id("nav-signin")).to_be_visible(timeout=30000)
        await sign_in(page, HOST_EMAIL)
        await expect(page.get_by_test_id("btn-create-room")).to_be_visible()
        await expect(page.get_by_test_id("btn-join-room")).to_be_visible()

        # Host creates a fresh room.
        unique_suffix = str(int(time.time()))
        room_title = f"Strict Two Account Event {unique_suffix}"
        await page.get_by_test_id("btn-create-room").click()
        await page.get_by_test_id("create-room-title").fill(room_title)
        await page.get_by_test_id("create-room-desc").fill("Strict TestSprite two-account coverage")
        await page.get_by_test_id("create-room-budget").fill("1200")
        await page.get_by_test_id("create-room-submit").click()
        await expect(page.get_by_test_id("room-workspace")).to_be_visible(timeout=30000)
        await expect(page.get_by_test_id("room-title")).to_contain_text(room_title)
        await expect(page.locator("text=HOST").first()).to_be_visible()

        room_url = page.url
        room_identifier = room_url.rstrip("/").split("/")[-1]
        slug = await page.get_by_test_id("room-slug").inner_text()
        assert slug.strip(), "Room slug was empty"

        # Host inspects shell and Command Center.
        for test_id in ["tab-command", "tab-timeline", "tab-tasks", "tab-budget", "tab-chat"]:
            await expect(page.get_by_test_id(test_id)).to_be_visible()
        await page.get_by_test_id("tab-command").click()
        await expect(page.get_by_test_id("participant-sidebar")).to_be_visible()
        await expect(page.get_by_test_id("host-user-controller")).to_be_visible()

        # Host creates timeline day and activity.
        await page.get_by_test_id("tab-timeline").click()
        await page.get_by_test_id("btn-add-day").click()
        await page.get_by_test_id("add-day-title").fill("Arrival Day")
        await page.get_by_test_id("add-day-date").fill("2026-08-10")
        await page.locator("button", has_text="Add day").click()
        await expect(page.locator("text=Arrival Day").first()).to_be_visible(timeout=30000)

        add_activity_button = page.locator("[data-testid^='btn-add-activity-']").first()
        await add_activity_button.click()
        await page.get_by_test_id("activity-title").fill("Welcome Dinner")
        await page.get_by_test_id("activity-desc").fill("Team kickoff dinner")
        await page.get_by_test_id("activity-cost").fill("250")
        await page.get_by_test_id("activity-location").fill("Main Hall")
        await page.locator("button", has_text=re.compile("Add activity", re.I)).last.click()
        await expect(page.locator("text=Welcome Dinner").first()).to_be_visible(timeout=30000)

        # Host creates a poll with more than five options.
        await page.locator("[data-testid^='btn-create-poll-']").first.click()
        await page.get_by_test_id("poll-question").fill("Where should dinner happen?")
        await page.get_by_test_id("poll-option-1").fill("Main Hall Buffet")
        await page.get_by_test_id("poll-option-2").fill("Rooftop Dinner")
        for value in ["Garden Venue", "Seafood House", "Private Lounge", "Local Bistro"]:
            await page.get_by_test_id("poll-add-option").click()
            index = len(await page.locator("[data-testid^='poll-option-']").all())
            await page.get_by_test_id(f"poll-option-{index}").fill(value)
        await page.get_by_test_id("create-poll-submit").click()
        error = page.get_by_test_id("create-poll-error")
        if await error.count() > 0 and await error.is_visible(timeout=3000):
            error_text = await error.inner_text()
            raise AssertionError(f"Poll creation showed visible error: {error_text}")
        await expect(page.locator("text=Where should dinner happen?").first()).to_be_visible(timeout=30000)

        # Host comments and task.
        await page.locator("[data-testid^='comment-input-timeline']").first.fill("Host timeline comment")
        await page.locator("[data-testid^='comment-submit-timeline']").first.click()
        await expect(page.locator("text=Host timeline comment").first()).to_be_visible(timeout=30000)

        await page.get_by_test_id("tab-tasks").click()
        await page.get_by_test_id("btn-add-task").click()
        await page.get_by_test_id("create-task-title").fill("Confirm catering")
        await page.get_by_test_id("create-task-due").fill("2026-08-09")
        await page.get_by_test_id("create-task-priority").select_option("HIGH")
        await page.get_by_test_id("create-task-visibility").select_option("PRIVATE")
        await page.locator("button", has_text="Create to-do").click()
        await expect(page.locator("text=Confirm catering").first()).to_be_visible(timeout=30000)

        await page.get_by_test_id("tab-budget").click()
        await expect(page.get_by_text(re.compile("Budget|Allocated|Remaining|\\$1,200")).first).to_be_visible()

        await page.get_by_test_id("tab-chat").click()
        await page.get_by_test_id("chat-input").fill("Host strict chat message")
        await page.get_by_test_id("chat-send").click()
        await expect(page.locator("text=Host strict chat message").first()).to_be_visible(timeout=30000)

        # Switch to second account and join exact room.
        await sign_out(page)
        await sign_in(page, SECOND_EMAIL)
        await page.goto(f"{BASE_URL}/join?slug={room_identifier}")
        await expect(page.get_by_test_id("room-workspace")).to_be_visible(timeout=30000)
        await expect(page.get_by_test_id("room-title")).to_contain_text(room_title)
        await expect(page.locator("text=HOST").first()).to_be_visible()
        await expect(page.get_by_text(re.compile("Peter|drpeterramsis2007|DR", re.I)).first).to_be_visible(timeout=30000)

        # Second account can inspect, vote, comment, make private task, and chat.
        await page.get_by_test_id("tab-timeline").click()
        await expect(page.locator("text=Welcome Dinner").first()).to_be_visible()
        await page.locator("[data-testid^='poll-vote-']").first.click()
        await expect(page.locator("text=/Your vote|1 \\(/").first()).to_be_visible(timeout=30000)
        await page.locator("[data-testid^='comment-input-timeline']").first.fill("Second account timeline comment")
        await page.locator("[data-testid^='comment-submit-timeline']").first.click()
        await expect(page.locator("text=Second account timeline comment").first()).to_be_visible(timeout=30000)

        await page.get_by_test_id("tab-chat").click()
        await page.get_by_test_id("chat-input").fill("Second account strict chat message")
        await page.get_by_test_id("chat-send").click()
        await expect(page.locator("text=Second account strict chat message").first()).to_be_visible(timeout=30000)

        # Second account should not see host-only permission controller.
        assert await page.get_by_test_id("host-user-controller").count() == 0, "Second account incorrectly sees Host User Controller"

        # Switch back to host and verify second participant data is present.
        await sign_out(page)
        await sign_in(page, HOST_EMAIL)
        await page.goto(room_url)
        await expect(page.get_by_test_id("room-workspace")).to_be_visible(timeout=30000)
        await expect(page.get_by_text(re.compile("Peter|drpeterramsis2007|DR", re.I)).first).to_be_visible(timeout=30000)
        await page.get_by_test_id("tab-chat").click()
        await expect(page.locator("text=Second account strict chat message").first()).to_be_visible(timeout=30000)
        await page.get_by_test_id("tab-timeline").click()
        await expect(page.locator("text=Second account timeline comment").first()).to_be_visible(timeout=30000)

    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()
        if pw:
            await pw.stop()


asyncio.run(run_test())
