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

// --- WEB SCRAPING LOGIC ---
/**
 * Simulates a web scraper using Playwright.
 * This function is asynchronous because Playwright operations are promise-based.
 * Currently, it scrapes hardcoded HTML strings to demonstrate the parsing logic.
 * To make it a real scraper, you would replace `page.setContent(content)`
 * with `page.goto('YOUR_COURT_WEBSITE_URL')` and interact with the live site.
 * @param {object} query The user's search query (caseType, caseNumber, filingYear).
 * @returns {Promise<object|null>} A promise that resolves to the scraped data object or null if not found.
 */
async function scrapeCaseData(query) {
    const { caseType, caseNumber, filingYear } = query;

    // Mock HTML content for a successful case.
    const mockHtml = `
    <!DOCTYPE html>
    <html>
    <head><title>Case Details</title></head>
    <body>
        <h1>Case Details for ${caseType} No. ${caseNumber}/${filingYear}</h1>
        <p class="parties">Parties: State of Delhi vs. John Doe</p>
        <p class="filing-date">Filing Date: 2023-01-15</p>
        <p class="next-hearing">Next Hearing Date: 2025-09-01</p>
        <div class="orders">
            <h2>Orders and Judgments</h2>
            <ul>
                <li>
                    <span>Date: 2024-07-28</span>
                    <a href="https://placehold.co/600x400/FF0000/FFFFFF?text=Mock+Order+PDF" class="pdf-link">Final order on bail application.</a>
                </li>
            </ul>
        </div>
        <p id="not-found" style="display: none;">Case not found.</p>
    </body>
    </html>
    `;
    
    // Mock HTML content for a case not found.
    const notFoundHtml = `
    <!DOCTYPE html>
    <html>
    <head><title>Case Not Found</title></head>
    <body>
        <h1 id="not-found">No such case exists.</h1>
    </body>
    </html>
    `;

    // Simulate different responses based on a specific mock query.
    const content = (caseNumber === '123' && caseType === 'criminal' && filingYear === '2023') ? mockHtml : notFoundHtml;

    // Launch a headless Chromium browser instance.
    let browser; // Declare browser outside try-catch to ensure it's accessible in finally
    try {
        browser = await chromium.launch();
        const page = await browser.newPage();
        
        // Load the mock HTML content into the Playwright page.
        await page.setContent(content);

        let result = null;

        // Check if the "not found" element is present on the page.
        if (await page.$('#not-found')) {
            return null; // Case not found
        }

        // Extract data using Playwright's textContent and getAttribute methods based on CSS selectors.
        const parties = await page.textContent('.parties');
        const filingDate = await page.textContent('.filing-date');
        const nextHearingDate = await page.textContent('.next-hearing');
        const orderElement = await page.$('.orders a.pdf-link'); // Select the first PDF link

        const orders = [];
        if (orderElement) {
            // Extract details for the most recent order.
            orders.push({
                date: (await page.textContent('.orders span')).replace('Date: ', ''),
                description: await orderElement.textContent(),
                pdfLink: await orderElement.getAttribute('href')
            });
        }
        
        // Structure the scraped data into an object.
        result = {
            caseType,
            caseNumber,
            filingYear,
            parties: parties.replace('Parties: ', ''), // Clean up extracted text
            filingDate: filingDate.replace('Filing Date: ', ''),
            nextHearingDate: nextHearingDate.replace('Next Hearing Date: ', ''),
            orders,
            rawResponse: content // Include the raw HTML content for logging purposes
        };
        return result;

    } catch (error) {
        console.error('Scraping error:', error);
        return null; // Return null on scraping error
    } finally {
        // Always close the browser instance to free up resources.
        if (browser) {
            await browser.close();
        }
    }
}

// --- API ROUTES ---

// Endpoint to handle case data requests (POST method).
// This receives queries from the frontend, calls the scraper, and sends back results.
app.post('/api/case', async (req, res) => {
    console.log('Received API request:', req.body);
    const { caseType, caseNumber, filingYear } = req.body;

    // Call the simulated web scraper.
    const caseData = await scrapeCaseData({ caseType, caseNumber, filingYear });

    if (caseData) {
        // If data is found, log it and send a success response.
        logQueryToDb(req.body, caseData);
        res.status(200).json({ success: true, data: caseData });
    } else {
        // If no data is found, log the error and send a 404 response.
        const errorResponse = { message: 'No case found for the given details.' };
        logQueryToDb(req.body, errorResponse);
        res.status(404).json({ success: false, message: 'No case found with these details.' });
    }
});

// Endpoint to retrieve the query log (GET method).
app.get('/api/log', (req, res) => {
    // Send the current in-memory query log.
    res.status(200).json(queryLog);
});

// Start the server and listen for incoming requests on the specified port.
app.listen(port, () => {
    console.log(`Full-stack server running at http://localhost:${port}`);
});
