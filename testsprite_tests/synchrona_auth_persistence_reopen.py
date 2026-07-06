import asyncio
import os
import tempfile

from playwright.async_api import async_playwright, expect


BASE_URL = os.getenv("BASE_URL", "https://event-planner-carlos.vercel.app")
EMAIL = os.getenv("TEST_EMAIL", "carlospeter582011@gmail.com")
PASSWORD = os.getenv("TEST_PASSWORD", "K@ko2011")


async def sign_in(page):
    await page.goto(f"{BASE_URL}/auth/signin", wait_until="domcontentloaded")
    await expect(page.get_by_test_id("auth-card")).to_be_visible(timeout=45000)
    await page.get_by_test_id("auth-email-input").fill(EMAIL)
    await page.get_by_test_id("auth-password-input").fill(PASSWORD)
    await page.get_by_test_id("auth-submit").click()
    await expect(page.get_by_test_id("dashboard-title")).to_be_visible(timeout=45000)


async def run_test():
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        storage_path = os.path.join(tempfile.gettempdir(), "synchrona-auth-state.json")

        first_context = await browser.new_context()
        first_page = await first_context.new_page()
        await sign_in(first_page)
        await first_context.storage_state(path=storage_path)
        await first_context.close()

        reopened_context = await browser.new_context(storage_state=storage_path)
        reopened_page = await reopened_context.new_page()
        await reopened_page.goto(f"{BASE_URL}/dashboard", wait_until="domcontentloaded")
        await expect(reopened_page.get_by_test_id("dashboard-title")).to_be_visible(timeout=45000)
        assert "/auth/signin" not in reopened_page.url, "Saved auth state redirected back to sign-in"

        signin_page = await reopened_context.new_page()
        await signin_page.goto(f"{BASE_URL}/auth/signin", wait_until="domcontentloaded")
        await expect(signin_page.get_by_test_id("dashboard-title")).to_be_visible(timeout=45000)

        await reopened_context.close()
        await browser.close()


if __name__ == "__main__":
    asyncio.run(run_test())
