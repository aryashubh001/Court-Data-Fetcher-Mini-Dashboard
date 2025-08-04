// A single-file Node.js/Express.js application that serves both the frontend
// and handles the backend API calls.
// This version uses Playwright to simulate web scraping instead of mock data.
// To run this file, you will need Node.js installed.
// First, initialize a Node.js project: `npm init -y`
// Then, install the required packages: `npm install express playwright`
// You do not need 'cors' because the frontend is served from the same server.

const express = require('express');
const { chromium } = require('playwright');
const path = require('path');
const app = express();
const port = 3000;

// Middleware to parse JSON bodies
app.use(express.json());

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
    queryLog.unshift(logEntry);
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

app.get('/api/log', (req, res) => {
    res.status(200).json(queryLog);
});

// --- FRONTEND ROUTE ---
app.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Court-Data Fetcher & Mini-Dashboard</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        body {
            font-family: 'Inter', sans-serif;
            background-color: #f3f4f6;
            color: #1f2937;
        }
        .container {
            max-width: 900px;
            margin: 2rem auto;
            padding: 1.5rem;
        }
        .card {
            background-color: white;
            border-radius: 12px;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
            padding: 2rem;
        }
    </style>
</head>
<body class="bg-gray-100">

    <div class="container mx-auto p-4 md:p-8">
        <header class="text-center mb-8">
            <h1 class="4xl:text-5xl font-bold text-gray-800">Court Case Dashboard</h1>
            <p class="text-lg text-gray-600 mt-2">Find and view case details from a simulated eCourts portal.</p>
        </header>

        <!-- Main Form Section -->
        <div class="card mb-8">
            <h2 class="text-2xl font-semibold mb-6 text-gray-700">Fetch Case Details</h2>
            <form id="search-form" class="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                    <label for="case-type" class="block text-sm font-medium text-gray-700 mb-1">Case Type</label>
                    <select id="case-type" name="case-type" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50 p-2">
                        <option value="criminal">Criminal Case</option>
                        <option value="civil">Civil Suit</option>
                        <option value="writ">Writ Petition</option>
                    </select>
                </div>
                <div>
                    <label for="case-number" class="block text-sm font-medium text-gray-700 mb-1">Case Number</label>
                    <input type="text" id="case-number" name="case-number" placeholder="e.g., 123" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50 p-2">
                </div>
                <div>
                    <label for="filing-year" class="block text-sm font-medium text-gray-700 mb-1">Filing Year</label>
                    <select id="filing-year" name="filing-year" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50 p-2">
                        <script>
                            const currentYear = new Date().getFullYear();
                            for (let i = currentYear; i >= 2000; i--) {
                                document.write(\`<option value="\${i}">\${i}</option>\`);
                            }
                        </script>
                    </select>
                </div>
                <div class="md:col-span-3 text-center">
                    <button type="submit" class="w-full md:w-auto px-6 py-3 bg-indigo-600 text-white font-bold rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-all duration-300">
                        Fetch Data
                    </button>
                </div>
            </form>
        </div>

        <!-- Result Display Section -->
        <div id="result-section" class="card mb-8 hidden">
            <h2 class="text-2xl font-semibold mb-6 text-gray-700">Case Details</h2>
            <div id="result-content">
                <!-- Case details will be dynamically injected here -->
            </div>
            <div id="error-message" class="text-red-500 font-semibold hidden mt-4"></div>
        </div>

        <!-- Query Log Section -->
        <div class="card">
            <h2 class="text-2xl font-semibold mb-6 text-gray-700">Query Log</h2>
            <div id="log-list" class="space-y-4">
                <!-- Query history will be dynamically injected here -->
            </div>
        </div>

    </div>

    <script>
        const searchForm = document.getElementById('search-form');
        const caseTypeSelect = document.getElementById('case-type');
        const caseNumberInput = document.getElementById('case-number');
        const filingYearSelect = document.getElementById('filing-year');
        const resultSection = document.getElementById('result-section');
        const resultContent = document.getElementById('result-content');
        const errorMessage = document.getElementById('error-message');
        const logList = document.getElementById('log-list');

        document.addEventListener('DOMContentLoaded', () => {
            fetchQueryLog();
            searchForm.addEventListener('submit', handleFormSubmit);
        });

        async function handleFormSubmit(event) {
            event.preventDefault();
            const query = {
                caseType: caseTypeSelect.value,
                caseNumber: caseNumberInput.value.trim(),
                filingYear: filingYearSelect.value
            };
            resultContent.innerHTML = \`<p class="text-center text-gray-500">Fetching data...</p>\`;
            resultSection.classList.remove('hidden');
            errorMessage.classList.add('hidden');
            try {
                // REPLACE THIS URL with your live Vercel URL
                const response = await fetch('https://your-backend-app-url.vercel.app/api/case', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(query)
                });
                const result = await response.json();
                if (response.ok && result.success) {
                    displayCaseData(result.data);
                } else {
                    displayErrorMessage(result.message);
                }
            } catch (error) {
                console.error('Error fetching data:', error);
                displayErrorMessage('Failed to connect to the backend server. Please make sure it is running.');
            }
            fetchQueryLog();
        }

        async function fetchQueryLog() {
            try {
                // REPLACE THIS URL with your live Vercel URL
                const response = await fetch('https://your-backend-app-url.vercel.app/api/log');
                const logs = await response.json();
                renderQueryLog(logs);
            } catch (error) {
                console.error('Error fetching log:', error);
                logList.innerHTML = \`<p class="text-center text-gray-500">Could not fetch query log from the server.</p>\`;
            }
        }

        function displayCaseData(data) {
            let ordersHtml = \`<p class="text-sm text-gray-600 mb-2">No recent orders or judgments found.</p>\`;
            if (data.orders && data.orders.length > 0) {
                const mostRecentOrder = data.orders[0];
                ordersHtml = \`
                    <div class="bg-gray-50 p-4 rounded-lg border border-gray-200">
                        <p class="text-sm text-gray-700"><span class="font-bold">Date:</span> \${mostRecentOrder.date}</p>
                        <p class="text-sm text-gray-700"><span class="font-bold">Description:</span> \${mostRecentOrder.description}</p>
                        <div class="mt-2">
                            <a href="\${mostRecentOrder.pdfLink}" class="inline-flex items-center px-4 py-2 bg-blue-500 text-white font-medium rounded-md hover:bg-blue-600 transition-colors" download="Order_\${mostRecentOrder.date}.pdf">
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                                    <path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 11.586V3a1 1 0 112 0v8.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clip-rule="evenodd" />
                                </svg>
                                Download Recent PDF
                            </a>
                        </div>
                    </div>
                \`;
            }
            resultContent.innerHTML = \`
                <div class="space-y-4">
                    <p><span class="font-semibold">Case Type:</span> \${data.caseType}</p>
                    <p><span class="font-semibold">Case Number:</span> \${data.caseNumber}</p>
                    <p><span class="font-semibold">Filing Year:</span> \${data.filingYear}</p>
                    <p><span class="font-semibold">Parties:</span> \${data.parties}</p>
                    <p><span class="font-semibold">Filing Date:</span> \${data.filingDate}</p>
                    <p><span class="font-semibold">Next Hearing Date:</span> \${data.nextHearingDate}</p>
                    <div class="mt-6">
                        <h3 class="lg:text-lg font-semibold text-gray-700 mb-2">Latest Orders/Judgments</h3>
                        \${ordersHtml}
                    </div>
                </div>
            \`;
            errorMessage.classList.add('hidden');
        }
        
        function displayErrorMessage(message) {
            resultContent.innerHTML = '';
            errorMessage.textContent = message;
            errorMessage.classList.remove('hidden');
        }

        function renderQueryLog(logs) {
            logList.innerHTML = '';
            if (logs.length === 0) {
                logList.innerHTML = \`<p class="text-center text-gray-500">No past queries found.</p>\`;
                return;
            }
            logs.forEach(log => {
                const logItem = document.createElement('div');
                logItem.classList.add('bg-white', 'p-4', 'rounded-lg', 'border', 'border-gray-200', 'shadow-sm');
                const queryDetails = \`
                    <p class="font-semibold">Query at \${new Date(log.timestamp).toLocaleString()}</p>
                    <ul class="list-disc list-inside text-sm text-gray-600 ml-4 mt-2">
                        <li>Case Type: \${log.query.caseType}</li>
                        <li>Case Number: \${log.query.caseNumber}</li>
                        <li>Filing Year: \${log.query.filingYear}</li>
                    </ul>
                \`;
                const parsedResponse = JSON.parse(log.response);
                let responseDetails;
                if (parsedResponse.message) {
                    responseDetails = \`<p class="text-sm text-red-500 font-medium mt-2">Status: \${parsedResponse.message}</p>\`;
                } else {
                    responseDetails = \`
                        <p class="text-sm text-green-600 font-medium mt-2">Status: Success</p>
                        <p class="text-sm text-gray-700 mt-1">Parties: \${parsedResponse.parties}</p>
                    \`;
                }
                logItem.innerHTML = queryDetails + responseDetails;
                logList.appendChild(logItem);
            });
        }
    </script>
</body>
</html>
`);
});

// Start the server
app.listen(port, () => {
    console.log(`Full-stack server running at http://localhost:${port}`);
});
