# Ask LLM

A Chrome extension to highlight text and ask your LLM via context menu.

## Features

- **Context Menu Integration:** Right-click on any highlighted text to send it to your configured LLM.
- **Customizable LLM Endpoint:** Configure the API endpoint for your preferred LLM in the extension's options.
- **Easy to use:** Simple and intuitive interface.
- **Developer Friendly:** Built with modern tools like Vite and TypeScript.

## Installation

1.  Clone this repository to your local machine.
2.  Install the dependencies:
    ```bash
    npm install
    ```
3.  Build the extension:
    ```bash
    npm run build
    ```
4.  Open Google Chrome and navigate to `chrome://extensions`.
5.  Enable "Developer mode" in the top right corner.
6.  Click on "Load unpacked" and select the `dist` directory from this project.

## Usage

1.  After installation, right-click on the extension icon in the Chrome toolbar and select "Options" to configure the LLM API endpoint.
2.  Enter the URL for your LLM API and save the settings.
3.  Highlight any text on a webpage, right-click, and select "Ask LLM" from the context menu.
4.  The selected text will be sent to your configured LLM, and the response will be displayed in a new tab.

## Development

To set up the development environment:

1.  Clone the repository.
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Run the development server:
    ```bash
    npm run dev
    ```
    This command will watch for file changes and automatically rebuild the extension.

### Building

To create a production build, run:

```bash
npm run build
```

This will create a `dist` directory with the production-ready extension files.

### Type Checking

To run the TypeScript type checker, use:

```bash
npm run type-check
```

## Technology Stack

- **TypeScript:** For type-safe JavaScript development.
- **Vite:** As the build tool for the extension.
- **Chrome Extension API:** For interacting with the Chrome browser.
