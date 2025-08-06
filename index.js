// This is your backend server file. It serves the static frontend
// and handles the API calls.
// This version uses MOCK_DATA for simulated web scraping and SQLite for persistent logging.

const express = require('express');
const path = require('path');
const sqlite3 = require('sqlite3').verbose(); // Import sqlite3
const app = express();
const port = process.env.PORT || 3000;

// Serve static files from the 'public' directory.
app.use(express.static(path.join(__dirname, 'public')));

// Middleware to parse JSON bodies from incoming requests.
app.use(express.json());

// --- DATABASE INITIALIZATION (SQLite) ---
// Initialize SQLite database
const db = new sqlite3.Database('./queries.db', (err) => {
    if (err) {
        console.error('Error connecting to SQLite database:', err.message);
    } else {
        console.log('Connected to the SQLite database.');
        // Create queries_log table if it doesn't exist
        db.run(`CREATE TABLE IF NOT EXISTS queries_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL,
            case_type TEXT,
            case_number TEXT,
            filing_year TEXT,
            response_data TEXT
        )`, (createErr) => {
            if (createErr) {
                console.error('Error creating table:', createErr.message);
            } else {
                console.log('Table "queries_log" ready.');
            }
        });
    }
});

/**
 * Logs a query and its response to the SQLite database.
 * @param {object} query The user's search query.
 * @param {object} response The simulated API response.
 */
function logQueryToDb(query, response) {
    const timestamp = new Date().toISOString();
    const sql = `INSERT INTO queries_log (timestamp, case_type, case_number, filing_year, response_data) VALUES (?, ?, ?, ?, ?)`;
    db.run(sql, [
        timestamp,
        query.caseType,
        query.caseNumber,
        query.filingYear,
        JSON.stringify(response) // Store the full response as a JSON string
    ], function(err) {
        if (err) {
            console.error('Error inserting into database:', err.message);
        } else {
            console.log(`Query logged with ID: ${this.lastID}`);
        }
    });
}

// --- MOCK DATA (SIMULATING WEBSCRAPING LOGIC) ---
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

// --- SIMULATED WEB SCRAPING LOGIC ---
async function scrapeCaseData(query) {
    const { caseType, caseNumber, filingYear } = query;
    const key = `${caseType}-${caseNumber}-${filingYear}`;
    const caseData = MOCK_DATA[key];

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

// Endpoint to retrieve the query log from the SQLite database
app.get('/api/log', (req, res) => {
    db.all("SELECT * FROM queries_log ORDER BY timestamp DESC", [], (err, rows) => {
        if (err) {
            console.error('Error fetching logs from database:', err.message);
            res.status(500).json({ error: err.message });
            return;
        }
        // Map rows to match the expected frontend format (query, response)
        const logs = rows.map(row => ({
            timestamp: row.timestamp,
            query: {
                caseType: row.case_type,
                caseNumber: row.case_number,
                filingYear: row.filing_year
            },
            response: row.response_data // response_data is already JSON string
        }));
        res.status(200).json(logs);
    });
});

// Start the server
app.listen(port, () => {
    console.log(`Full-stack server running at http://localhost:${port}`);
});
