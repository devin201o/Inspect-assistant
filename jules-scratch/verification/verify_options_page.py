import asyncio
from playwright.async_api import async_playwright
import os

CHROME_EXTENSION_PATH = os.path.abspath('../dist-chrome')
FIREFOX_EXTENSION_PATH = os.path.abspath('../dist-firefox')

async def verify_browser(browser_type, extension_path, screenshot_path):
    """
    Launches a browser, loads the extension, navigates to the options page,
    and takes a screenshot.
    """
    print(f"Verifying for {browser_type} from {extension_path}...")

    async with async_playwright() as p:
        # Use a persistent context to load the extension
        context = await p[browser_type].launch_persistent_context(
            '',  # Empty user data dir
            headless=True,
            args=[
                f"--disable-extensions-except={extension_path}",
                f"--load-extension={extension_path}",
            ],
        )

        # For Manifest V3, find the extension's background service worker
        # to get the extension ID.
        if browser_type == 'chromium':
            # Wait for the service worker to be available
            try:
                service_worker = await context.wait_for_event('serviceworker', timeout=5000)
                if not service_worker:
                    raise Exception("Service worker not found.")

                extension_id = service_worker.url.split('/')[2]
                print(f"  Found Chrome extension ID: {extension_id}")
                options_url = f"chrome-extension://{extension_id}/options.html"

            except Exception as e:
                print(f"Could not find service worker for Chrome: {e}")
                print("Attempting to find extension ID from context.pages...")
                # Fallback for when the service worker is slow or inactive
                extension_id = None
                for p in context.pages:
                     if p.url.startswith('chrome-extension://'):
                        extension_id = p.url.split('/')[2]
                        break
                if not extension_id:
                    print("Could not determine extension ID for Chrome.")
                    await context.close()
                    return
                options_url = f"chrome-extension://{extension_id}/options.html"

        else: # Firefox
            # Firefox uses a different URL scheme and the ID is in the manifest
            extension_id = "ask-llm@example.com"
            print(f"  Using Firefox extension ID: {extension_id}")
            options_url = f"moz-extension://{extension_id}/options.html"


        page = await context.new_page()
        print(f"  Navigating to: {options_url}")

        try:
            await page.goto(options_url)
            # Wait for the form to be visible to ensure the page is loaded
            await page.wait_for_selector('#settingsForm')
            print("  Options page loaded successfully.")
        except Exception as e:
            print(f"  Failed to load options page: {e}")
            await context.close()
            return

        print(f"  Taking screenshot: {screenshot_path}")
        await page.screenshot(path=screenshot_path)

        await context.close()
        print(f"  Verification complete for {browser_type}.")

async def main():
    print("Starting verification process...")
    await verify_browser(
        'chromium',
        CHROME_EXTENSION_PATH,
        'jules-scratch/verification/chrome_options.png'
    )
    # await verify_browser(
    #     'firefox',
    #     FIREFOX_EXTENSION_PATH,
    #     'jules-scratch/verification/firefox_options.png'
    # )
    print("Verification process finished.")

if __name__ == "__main__":
    asyncio.run(main())