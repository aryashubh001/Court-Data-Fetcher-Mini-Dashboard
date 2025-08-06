// This is your backend server file. It serves the static frontend
// and handles the API calls.
// To run this file, you will need to install Express and Playwright.

const express = require('express');
const { chromium } = require('playwright'); // Required for web scraping simulation
const path = require('path'); // Node.js built-in module for working with file and directory paths
const app = express();
const port = process.env.PORT || 3000; // Use process.env.PORT for hosting platforms like Render

// Serve static files from the 'public' directory.
// This line tells Express to look for static assets (like your index.html)
// in a folder named 'public' relative to where index.js is located.
app.use(express.static(path.join(__dirname, 'public')));

// Middleware to parse JSON bodies from incoming requests.
app.use(express.json());

// --- DATABASE SIMULATION (REPLACING MYSQL LOGIC) ---
// This array will temporarily store query logs in memory.
// In a real application, this would be replaced with a connection to a database like MySQL.
const queryLog = [];

/**
 * Simulates a database operation to log a new query.
 * In a real scenario, this would insert data into a MySQL table.
 * @param {object} query The user's search query.
 * @param {object} response The simulated API response.
 */
function logQueryToDb(query, response) {
    const timestamp = new Date().toISOString();
    const logEntry = {
        timestamp,
        query,
        response: JSON.stringify(response) // Store the raw response as a string
    };
    queryLog.unshift(logEntry); // Add to the beginning of the array for chronological display
    console.log('Query logged to simulated database:', logEntry);
}

// --- WEB SCRAPING LOGIC for Delhi High Court ---
/**
 * Scrapes case data from the Delhi High Court website.
 * This function uses Playwright to automate browser interaction.
 *
 * @param {object} query The user's search query (caseType, caseNumber, filingYear).
 * @returns {Promise<object|null>} A promise that resolves to the scraped data object or null if not found/error.
 */
async function scrapeCaseData(query) {
    const { caseType, caseNumber, filingYear } = query;
    let browser; // Declare browser here to ensure it's in scope for finally block

    try {
        // 1. Launch a headless Chromium browser
        // headless: true for deployment (no visible browser window)
        // For local debugging, you can temporarily change headless: true to headless: false
        // to see the browser automation in action. Remember to change it back to true for deployment.
        browser = await chromium.launch({ headless: true });
        const page = await browser.newPage();

        // Set a default timeout for navigation and actions
        page.setDefaultNavigationTimeout(60000); // 60 seconds for page navigation
        page.setDefaultTimeout(30000); // 30 seconds for individual actions like fill, click

        // 2. Navigate to the Delhi High Court's case status search page
        const courtSearchUrl = 'https://delhihighcourt.nic.in/case-status.asp';
        console.log(`Navigating to: ${courtSearchUrl}`);
        await page.goto(courtSearchUrl, { waitUntil: 'domcontentloaded' }); // Wait until the DOM is loaded

        // 3. Interact with the form elements using identified selectors
        // Selectors based on the HTML snippet you provided and common DHC structure.
        
        // Fill Case Number (id="case_number")
        await page.fill('#case_number', caseNumber);
        console.log(`Filled Case Number: ${caseNumber}`);

        // Select Case Type from dropdown (id="case_type")
        // Map your generic types to the specific 'value' attributes found in the HTML
        let courtCaseTypeValue;
        switch (caseType) {
            case 'criminal': courtCaseTypeValue = 'CRL.A.'; break; // Common criminal appeal type
            case 'civil': courtCaseTypeValue = 'CS(OS)'; break;   // Common civil suit type (Original Side)
            case 'writ': courtCaseTypeValue = 'W.P.(C)'; break;    // Common writ petition type (Civil)
            // Add more mappings if your frontend has more specific types
            default: courtCaseTypeValue = ''; // Fallback for unknown types
        }
        if (courtCaseTypeValue) {
            await page.selectOption('#case_type', { value: courtCaseTypeValue });
            console.log(`Selected Case Type: ${caseType} (${courtCaseTypeValue})`);
        } else {
            console.warn(`Unknown case type: ${caseType}. Cannot select option.`);
        }

        // Fill Filing Year (id="case_year")
        await page.selectOption('#case_year', { value: filingYear });
        console.log(`Selected Filing Year: ${filingYear}`);

        // 4. Handle CAPTCHA
        // This is a critical part. The Delhi High Court uses a simple numeric CAPTCHA displayed as text.
        // We can extract this text and fill the input.
        const captchaCodeElement = await page.$('#captcha-code'); // The span displaying the CAPTCHA number
        let captchaSolution = '';
        if (captchaCodeElement) {
            captchaSolution = await captchaCodeElement.textContent();
            console.log(`Extracted CAPTCHA: ${captchaSolution}`);
            await page.fill('#captchaInput', captchaSolution); // The input field for CAPTCHA
            await page.waitForTimeout(500); // Small delay after filling, sometimes helps
            console.log('CAPTCHA field filled.');
        } else {
            console.warn('CAPTCHA code element not found. Proceeding without CAPTCHA.');
        }

        // 5. Click the Search/Submit Button (id="search")
        await page.click('#search');
        console.log('Clicked submit button.');

        // 6. Wait for Results to Load
        // The Delhi High Court uses DataTables, which load content via AJAX.
        // We'll wait for the "No data available in table" message to disappear,
        // or for the main results table body to contain actual data rows.
        await page.waitForFunction(() => {
            const emptyMessageCell = document.querySelector('table#caseTable tbody td.dt-empty');
            // If the empty message is gone OR if there are actual data rows in the table
            return !emptyMessageCell || document.querySelectorAll('table#caseTable tbody tr:not(.dt-empty)').length > 0;
        }, { timeout: 30000 }); // Wait up to 30 seconds for results to appear

        console.log('Results page loaded or table updated.');

        // 7. Extract the Data from the Results Table
        let result = null;

        // Check for "No data available in table" after waiting
        const noDataMessage = await page.$('table#caseTable tbody td.dt-empty');
        if (noDataMessage && await noDataMessage.isVisible()) {
            console.log('No case found on the live site for provided details (dt-empty message visible).');
            return null; // No case found
        }

        // --- Extracting specific data points from the first result row ---
        // Assuming the first row of results contains the primary case info.
        const firstDataRowSelector = 'table#caseTable tbody tr.odd, table#caseTable tbody tr.even'; // Selects the first actual data row
        const firstRow = await page.$(firstDataRowSelector);

        if (!firstRow) {
            console.log('No data rows found in the table after search (unexpected structure).');
            return null; // No results found
        }

        // Extract Parties' names (3rd column in the table, 0-indexed)
        const parties = await firstRow.$eval('td:nth-child(3)', el => el.textContent);
        console.log(`Extracted Parties: ${parties}`);

        // Extract Listing Date / Court No. (4th column)
        const listingDateCourtNo = await firstRow.$eval('td:nth-child(4)', el => el.textContent);
        
        // For simplicity, we'll use the first part of "Listing Date / Court No." as both Filing and Next Hearing Date.
        // In a real scenario, you'd parse this more precisely if separate dates are available.
        let filingDate = 'N/A';
        let nextHearingDate = 'N/A';
        const dateParts = listingDateCourtNo.split(' / ');
        if (dateParts.length > 0) {
            filingDate = dateParts[0].trim();
            nextHearingDate = dateParts[0].trim(); // Assuming same date for simplicity
        }
        console.log(`Extracted Filing Date: ${filingDate}, Next Hearing Date: ${nextHearingDate}`);

        // Extract the most recent order PDF link
        // This is highly site-specific. We'll look for any PDF link within the first result row.
        const orderPdfLinkSelector = 'table#caseTable tbody tr:first-child a[href$=".pdf"]'; // First link ending in .pdf in the first row
        const pdfLinkElement = await page.$(orderPdfLinkSelector);
        const orders = [];
        if (pdfLinkElement) {
            const pdfUrl = await pdfLinkElement.getAttribute('href');
            const pdfDescription = await pdfLinkElement.textContent(); 
            orders.push({
                date: filingDate, // Using filing date as order date for simplicity
                description: pdfDescription ? pdfDescription.trim() : 'PDF Order',
                pdfLink: pdfUrl
            });
            console.log(`Extracted PDF Link: ${pdfUrl}`);
        } else {
            console.log('No PDF link found in the first row of orders table.');
        }

        // Get the raw HTML content of the results page for logging (optional, but good for debugging)
        const rawResponse = await page.content();

        result = {
            caseType,
            caseNumber,
            filingYear,
            parties: parties ? parties.trim() : 'N/A',
            filingDate: filingDate,
            nextHearingDate: nextHearingDate,
            orders,
            rawResponse: rawResponse
        };
        return result;

    } catch (error) {
        console.error('Real scraping error:', error);
        // Return null on any scraping error so the frontend displays 'No case found'
        return null;
    } finally {
        // Always ensure the browser instance is closed to free up resources
        if (browser) {
            await browser.close();
        }
    }
}

// --- API ROUTES ---

// Endpoint to handle case data requests (POST method).
app.post('/api/case', async (req, res) => {
    console.log('Received API request:', req.body);
    const { caseType, caseNumber, filingYear } = req.body;

    const caseData = await scrapeCaseData({ caseType, caseNumber, filingYear });

    if (caseData) {
        logQueryToDb(req.body, caseData);
        res.status(200).json({ success: true, data: caseData });
    } else {
        const errorResponse = { message: 'No case found for the given details.' };
        logQueryToDb(req.body, errorResponse);
        res.status(404).json({ success: false, message: 'No case found with these details.' });
    }
});

// Endpoint to retrieve the query log (GET method).
app.get('/api/log', (req, res) => {
    res.status(200).json(queryLog);
});

// Start the server and listen for incoming requests on the specified port.
app.listen(port, () => {
    console.log(`Full-stack server running at http://localhost:${port}`);
});
