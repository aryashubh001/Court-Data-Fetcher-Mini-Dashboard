// This is your backend server file. It serves the static frontend
// and handles the API calls.
// This version uses MOCK_DATA to simulate web scraping for reliable deployment.

const express = require('express');
const path = require('path'); // Node.js built-in module for working with file and directory paths
const app = express();
const port = process.env.PORT || 3000; // Use process.env.PORT for hosting platforms like Render

// Serve static files from the 'public' directory.
// This line tells Express to look for static assets (like your index.html)
// in a folder named 'public' relative to where index.js is located.
app.use(express.static(path.join(__dirname, 'public')));

// Middleware to parse JSON bodies from incoming requests.
app.use(express.json());

// --- MOCK DATA (SIMULATING WEBSCRAPING LOGIC) ---
// This object simulates the data that would be scraped from the court website.
// It's used when real Playwright scraping is challenging to deploy.
const MOCK_DATA = {
    'criminal-123-2023': {
        caseType: 'Criminal Case',
        caseNumber: '123',
        filingYear: '2023',
        parties: 'State of Delhi vs. John Doe',
        filingDate: '2023-01-15',
        nextHearingDate: '2025-09-01',
        orders: [
            {
                date: '2024-07-28',
                description: 'Final order on bail application.',
                pdfLink: 'https://placehold.co/600x400/FF0000/FFFFFF?text=Mock+Order+PDF'
            },
        ],
        rawResponse: '<html><body>...mock HTML content from a criminal case...</body></html>'
    },
    'civil-456-2024': {
        caseType: 'Civil Suit',
        caseNumber: '456',
        filingYear: '2024',
        parties: 'Jane Doe vs. ABC Corp',
        filingDate: '2024-03-20',
        nextHearingDate: '2025-10-15',
        orders: [
            {
                date: '2024-08-01',
                description: 'Case listed for final arguments.',
                pdfLink: 'https://placehold.co/600x400/0000FF/FFFFFF?text=Mock+Order+PDF'
            }
        ],
        rawResponse: '<html><body>...mock HTML content from a civil suit...</body></html>'
    }
};

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

// --- SIMULATED WEB SCRAPING LOGIC ---
/**
 * Simulates web scraping by looking up data in the MOCK_DATA object.
 * This replaces the Playwright-based scraping for reliable deployment.
 * @param {object} query The user's search query.
 * @returns {Promise<object|null>} A promise that resolves to the mock data or null if not found.
 */
async function scrapeCaseData(query) {
    const { caseType, caseNumber, filingYear } = query;
    const key = `${caseType}-${caseNumber}-${filingYear}`;
    const caseData = MOCK_DATA[key]; // Look up in mock data

    // Simulate a network delay for realism
    await new Promise(resolve => setTimeout(resolve, 500)); 

    if (caseData) {
        console.log('Simulated scraping successful for:', key);
        return caseData;
    } else {
        console.log('Simulated scraping: No data found for:', key);
        return null;
    }
}

// --- API ROUTES ---

// Endpoint to handle case data requests (POST method).
app.post('/api/case', async (req, res) => {
    console.log('Received API request:', req.body);
    const { caseType, caseNumber, filingYear } = req.body;

    // Call the simulated web scraper.
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
