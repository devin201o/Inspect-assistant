from playwright.sync_api import sync_playwright, expect
import os
import time

def run(playwright):
    # Path to the extension's 'dist' directory
    extension_path = os.path.join(os.getcwd(), 'dist')

    # Launch browser with the extension loaded
    context = playwright.chromium.launch_persistent_context(
        '',  # empty user data dir
        headless=True,
        args=[
            f"--disable-extensions-except={extension_path}",
            f"--load-extension={extension_path}",
        ],
    )

    # Open a new page and navigate to a URL to activate the extension
    page = context.new_page()
    page.goto("https://www.google.com")
    time.sleep(2) # Give the extension time to load

    # Find the extension's ID from the service worker
    extension_id = None
    for sw in context.service_workers:
        if "chrome-extension://" in sw.url:
            extension_id = sw.url.split('/')[2]
            break

    if not extension_id:
        raise Exception("Could not find extension ID")

    # Go to the options page
    options_page = context.new_page()
    options_page.goto(f"chrome-extension://{extension_id}/options.html")

    discrete_mode_toggle = options_page.locator("#discreteMode")
    expect(discrete_mode_toggle).to_be_visible()
    discrete_mode_toggle.check()

    opacity_slider = options_page.locator("#discreteModeOpacity")
    expect(opacity_slider).to_be_visible()
    opacity_slider.fill("0.5")

    options_page.screenshot(path="jules-scratch/verification/verification.png")

    context.close()

with sync_playwright() as playwright:
    run(playwright)