// This is the dedicated backend server for the Court-Data Fetcher app.
// It should be deployed as a separate Vercel project from the frontend.
// To run this file, you will need Node.js installed.
// First, initialize a Node.js project: `npm init -y`
// Then, install the required packages: `npm install express cors playwright`

const express = require('express');
const cors = require('cors'); // Used to allow cross-origin requests from the frontend
const { chromium } = require('playwright');
const path = require('path');
const app = express();
const port = 3000;

// Middleware to parse JSON bodies and enable CORS
app.use(express.json());
app.use(cors());

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));


// --- DATABASE SIMULATION (REPLACING MYSQL LOGIC) ---
const queryLog = [];

/**
 * Simulates a database operation to log a new query.
 * @param {object} query The user's search query.
 * @param {object} response The simulated API response.
 */
function logQueryToDb(query, response) {
    const timestamp = new Date().toISOString();
    const logEntry = {
        timestamp,
        query,
        response: JSON.stringify(response)
    };
    queryLog.unshift(logEntry); // Add to the beginning of the array
    console.log('Query logged to simulated database:', logEntry);
}

// --- WEB SCRAPING LOGIC ---
/**
 * Simulates a real web scraper using Playwright.
 * In a real-world scenario, this would navigate to a court website
 * and extract the relevant data. For this example, it scrapes a
 * hardcoded HTML string to demonstrate the process.
 * @param {object} query The user's search query.
 * @returns {Promise<object|null>} A promise that resolves to the scraped data or null if not found.
 */
async function scrapeCaseData(query) {
    const { caseType, caseNumber, filingYear } = query;

    // A mock HTML page content that a scraper would retrieve
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
    
    // A mock HTML page for a non-existent case
    const notFoundHtml = `
    <!DOCTYPE html>
    <html>
    <head><title>Case Not Found</title></head>
    <body>
        <h1 id="not-found">No such case exists.</h1>
    </body>
    </html>
    `;

    // Simulate different responses based on the query
    const content = (caseNumber === '123' && caseType === 'criminal' && filingYear === '2023') ? mockHtml : notFoundHtml;

    // Use Playwright to "scrape" the HTML
    const browser = await chromium.launch();
    const page = await browser.newPage();
    
    // Use setContent to load the mock HTML string into the page
    await page.setContent(content);

    let result = null;

    // Check for a "not found" message
    if (await page.$('#not-found')) {
        await browser.close();
        return null;
    }

    try {
        // Extract the data using CSS selectors
        const parties = await page.textContent('.parties');
        const filingDate = await page.textContent('.filing-date');
        const nextHearingDate = await page.textContent('.next-hearing');
        const orderElement = await page.$('.orders a.pdf-link');
        
        const orders = [];
        if (orderElement) {
            orders.push({
                date: (await page.textContent('.orders span')).replace('Date: ', ''),
                description: await orderElement.textContent(),
                pdfLink: await orderElement.getAttribute('href')
            });
        }
        
        result = {
            caseType,
            caseNumber,
            filingYear,
            parties: parties.replace('Parties: ', ''),
            filingDate: filingDate.replace('Filing Date: ', ''),
            nextHearingDate: nextHearingDate.replace('Next Hearing Date: ', ''),
            orders,
            rawResponse: content // Simulate the raw HTML response
        };

    } catch (error) {
        console.error('Scraping error:', error);
    } finally {
        await browser.close();
    }

    return result;
}

// --- API ROUTES ---

// Endpoint to handle case data requests
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

// Endpoint to retrieve the query log from the simulated database
app.get('/api/log', (req, res) => {
    res.status(200).json(queryLog);
});

// Start the server
app.listen(port, () => {
    console.log(`Backend server running at http://localhost:${port}`);
});
