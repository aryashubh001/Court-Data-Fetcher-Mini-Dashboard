// A proper backend using Node.js and Express.js for the Court-Data Fetcher app.
// This file serves as a complete, runnable backend server.
// To run this file, you'll need Node.js installed.
// First, initialize a Node.js project: `npm init -y`
// Then, install the required packages: `npm install express cors`

const express = require('express');
const cors = require('cors'); // Used to allow cross-origin requests from the frontend
const app = express();
const port = 3000;

// Middleware to parse JSON bodies and enable CORS
app.use(express.json());
app.use(cors());

// --- DATA SIMULATION (REPLACING WEBSCRAPING LOGIC) ---
// This object simulates the data that would be scraped from the court website.
// In a real application, you would replace this with a web scraping library
// like Playwright or Cheerio to fetch data dynamically from a URL.
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
        rawResponse: '<html><body>...raw HTML content from a criminal case...</body></html>'
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
        rawResponse: '<html><body>...raw HTML content from a civil suit...</body></html>'
    }
};

// --- DATABASE SIMULATION (REPLACING MYSQL LOGIC) ---
// This array simulates a database table for logging queries.
// In a real application, you would connect to a MySQL database here
// and insert new logs into a table.
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

// --- API ROUTES ---

// Endpoint to handle case data requests
app.post('/api/case', (req, res) => {
    console.log('Received request:', req.body);
    const { caseType, caseNumber, filingYear } = req.body;

    // Simulate the web scraping process with a small delay
    setTimeout(() => {
        const key = `${caseType}-${caseNumber}-${filingYear}`;
        const caseData = MOCK_DATA[key];

        if (caseData) {
            // Log the successful query before sending the response
            logQueryToDb(req.body, caseData);
            // Send a success response
            res.status(200).json({ success: true, data: caseData });
        } else {
            // Log the failed query
            const errorResponse = { message: 'No case found for the given details.' };
            logQueryToDb(req.body, errorResponse);
            // Send an error response
            res.status(404).json({ success: false, message: 'No case found with these details.' });
        }
    }, 1000); // 1-second delay to simulate network latency and scraping
});

// Endpoint to retrieve the query log from the simulated database
app.get('/api/log', (req, res) => {
    res.status(200).json(queryLog);
});

// Start the server
app.listen(port, () => {
    console.log(`Backend server running at http://localhost:${port}`);
});
